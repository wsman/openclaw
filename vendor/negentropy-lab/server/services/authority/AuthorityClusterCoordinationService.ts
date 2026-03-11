/**
 * @constitution
 * §101 同步公理: authority 集群协同实现与真理源文档保持同步
 * §102 熵减原则: 保持 authority 集群协调逻辑简洁可维护
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename AuthorityClusterCoordinationService.ts
 * @version 1.0.0
 * @category authority
 * @last_updated 2026-03-10
 */

import { ClusterNode } from "../../cluster/ClusterNode";
import { ClusterTaskDispatcher } from "../../cluster/ClusterTaskDispatcher";
import { TaskLeaseManager } from "../../cluster/TaskLeaseManager";
import { ClusterNodeRecord } from "../../cluster/types";
import { ClusterNodeProjectionState, AuthorityState } from "../../schema/AuthorityState";
import { authorityStateToPlain, hydrateAuthorityState } from "../../runtime/authorityStateSnapshot";
import { EventStore } from "./EventStore";
import {
  AuthorityClusterCoordinationSnapshot,
  AuthorityClusterNodeSnapshot,
  AuthorityEventType,
} from "./types";
import { AuthorityMcpTransportService } from "./AuthorityMcpTransportService";

const LEADER_LEASE_KEY = "authority:cluster:leader";
const HEARTBEAT_CHANNEL = "authority:cluster:heartbeat";
const SNAPSHOT_CHANNEL = "authority:cluster:snapshot";
const SNAPSHOT_REQUEST_CHANNEL = "authority:cluster:snapshot:request";

function createId(prefix: string): string {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))].sort();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type AuthorityClusterHeartbeatPayload = {
  nodeId: string;
  clusterId: string;
  coordinationMode: "memory" | "redis";
  eventCursor: string;
  healthScore: number;
  load: number;
  status: string;
  coordinationRole: "leader" | "follower" | "standalone";
  serviceGroups: string[];
  region: string;
  generatedAt: number;
};

type AuthorityClusterSnapshotPayload = {
  nodeId: string;
  clusterId: string;
  eventCursor: string;
  generatedAt: number;
  authority: Record<string, unknown>;
};

export interface AuthorityClusterCoordinationServiceOptions {
  coordinationIntervalMs?: number;
  leaderLeaseTtlMs?: number;
  snapshotPublishIntervalMs?: number;
  staleSyncThresholdMs?: number;
}

export class AuthorityClusterCoordinationService {
  private readonly coordinationIntervalMs: number;
  private readonly leaderLeaseTtlMs: number;
  private readonly snapshotPublishIntervalMs: number;
  private readonly staleSyncThresholdMs: number;
  private clusterNode: ClusterNode | null = null;
  private leaseManager: TaskLeaseManager | null = null;
  private coordinationTimer: NodeJS.Timeout | null = null;
  private unsubscribeHeartbeat: (() => Promise<void>) | null = null;
  private unsubscribeSnapshot: (() => Promise<void>) | null = null;
  private unsubscribeSnapshotRequest: (() => Promise<void>) | null = null;
  private taskDispatcher: ClusterTaskDispatcher | null = null;
  private lastPublishedCursor = "";
  private lastAppliedSyncCursor = "";
  private lastTopologySyncAt = 0;
  private tickInFlight = false;

  constructor(
    private readonly state: AuthorityState,
    private readonly eventStore: EventStore,
    private readonly mcpTransportService: AuthorityMcpTransportService,
    options: AuthorityClusterCoordinationServiceOptions = {},
  ) {
    this.coordinationIntervalMs = Math.max(250, options.coordinationIntervalMs ?? 1_000);
    this.leaderLeaseTtlMs = Math.max(this.coordinationIntervalMs * 2, options.leaderLeaseTtlMs ?? 3_000);
    this.snapshotPublishIntervalMs = Math.max(this.coordinationIntervalMs, options.snapshotPublishIntervalMs ?? 2_000);
    this.staleSyncThresholdMs = Math.max(this.snapshotPublishIntervalMs * 2, options.staleSyncThresholdMs ?? 5_000);
    this.resetClusterState();
  }

  async attach(clusterNode: ClusterNode, taskDispatcher?: ClusterTaskDispatcher, leaseManager?: TaskLeaseManager): Promise<void> {
    if (this.clusterNode?.getLocalNode().nodeId === clusterNode.getLocalNode().nodeId) {
      return;
    }

    await this.detach();

    this.clusterNode = clusterNode;
    this.taskDispatcher = taskDispatcher || null;
    this.leaseManager = leaseManager || new TaskLeaseManager(clusterNode.getBackplane());

    this.state.cluster.enabled = true;
    this.state.cluster.clusterId = clusterNode.getLocalNode().clusterId;
    this.state.cluster.coordinationMode = clusterNode.getCoordinationMode();
    this.state.cluster.localNodeId = clusterNode.getLocalNode().nodeId;
    this.state.cluster.syncStatus = "catching_up";

    this.registerTaskHandlers();
    this.unsubscribeHeartbeat = await clusterNode.subscribe<AuthorityClusterHeartbeatPayload>(
      HEARTBEAT_CHANNEL,
      async (payload, sourceNodeId) => {
        await this.handleHeartbeat(payload, sourceNodeId);
      },
    );
    this.unsubscribeSnapshot = await clusterNode.subscribe<AuthorityClusterSnapshotPayload>(
      SNAPSHOT_CHANNEL,
      async (payload, sourceNodeId) => {
        await this.handleSnapshot(payload, sourceNodeId);
      },
    );
    this.unsubscribeSnapshotRequest = await clusterNode.subscribe<{ requestedAt: number }>(
      SNAPSHOT_REQUEST_CHANNEL,
      async (_payload, sourceNodeId) => {
        if (sourceNodeId && sourceNodeId !== this.state.cluster.localNodeId && this.isLeader()) {
          await this.publishSnapshot("manual_request");
        }
      },
    );

    await this.coordinationTick("attach");
    this.start();
  }

  async detach(): Promise<void> {
    if (this.coordinationTimer) {
      clearInterval(this.coordinationTimer);
      this.coordinationTimer = null;
    }
    if (this.unsubscribeHeartbeat) {
      await this.unsubscribeHeartbeat();
      this.unsubscribeHeartbeat = null;
    }
    if (this.unsubscribeSnapshot) {
      await this.unsubscribeSnapshot();
      this.unsubscribeSnapshot = null;
    }
    if (this.unsubscribeSnapshotRequest) {
      await this.unsubscribeSnapshotRequest();
      this.unsubscribeSnapshotRequest = null;
    }

    this.clusterNode = null;
    this.leaseManager = null;
    this.taskDispatcher = null;
    this.lastPublishedCursor = "";
    this.lastAppliedSyncCursor = "";
    this.tickInFlight = false;
    this.resetClusterState();
  }

  dispose(): void {
    void this.detach();
  }

  getSnapshot(): AuthorityClusterCoordinationSnapshot {
    const nodes = [...this.state.cluster.nodes.values()]
      .map((entry): AuthorityClusterNodeSnapshot => ({
        nodeId: entry.nodeId,
        role: entry.role,
        status: entry.status,
        host: entry.host,
        coordinationRole: (entry.coordinationRole as AuthorityClusterNodeSnapshot["coordinationRole"]) || "standalone",
        healthScore: entry.healthScore,
        load: entry.load,
        syncLagMs: entry.syncLagMs,
        lastSeen: entry.lastSeen,
        lastCursor: entry.lastCursor,
        serviceGroups: unique(String(entry.metadata.get("serviceGroups") || "").split(",").filter(Boolean)),
        metadata: [...entry.metadata.entries()].reduce<Record<string, string>>((acc, [key, value]) => {
          acc[key] = value;
          return acc;
        }, {}),
      }))
      .sort((left, right) => left.nodeId.localeCompare(right.nodeId));

    return {
      enabled: this.state.cluster.enabled,
      clusterId: this.state.cluster.clusterId,
      coordinationMode: (this.state.cluster.coordinationMode as AuthorityClusterCoordinationSnapshot["coordinationMode"]) || "standalone",
      localNodeId: this.state.cluster.localNodeId,
      leaderNodeId: this.state.cluster.leaderNodeId,
      role: (this.state.cluster.role as AuthorityClusterCoordinationSnapshot["role"]) || "standalone",
      syncStatus: (this.state.cluster.syncStatus as AuthorityClusterCoordinationSnapshot["syncStatus"]) || "idle",
      leaderLeaseExpiresAt: this.state.cluster.leaderLeaseExpiresAt,
      lastLeaseRenewedAt: this.state.cluster.lastLeaseRenewedAt,
      lastSyncAt: this.state.cluster.lastSyncAt,
      lastSyncCursor: this.state.cluster.lastSyncCursor,
      lastSyncSource: this.state.cluster.lastSyncSource,
      lastPublishedAt: this.state.cluster.lastPublishedAt,
      lastFailoverAt: this.state.cluster.lastFailoverAt,
      lastRecommendationAt: this.state.cluster.lastRecommendationAt,
      activeNodeCount: this.state.cluster.activeNodeCount,
      degradedNodeCount: this.state.cluster.degradedNodeCount,
      offlineNodeCount: this.state.cluster.offlineNodeCount,
      nodes,
    };
  }

  async triggerSync(): Promise<AuthorityClusterCoordinationSnapshot> {
    if (!this.clusterNode) {
      return this.getSnapshot();
    }

    const startedAt = Date.now();
    if (this.isLeader()) {
      await this.publishSnapshot("manual");
      return this.getSnapshot();
    }

    await this.clusterNode.publish(SNAPSHOT_REQUEST_CHANNEL, { requestedAt: startedAt });
    const deadline = Date.now() + Math.max(1_000, this.snapshotPublishIntervalMs * 2);
    while (Date.now() < deadline) {
      if (this.state.cluster.lastSyncAt >= startedAt) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return this.getSnapshot();
  }

  recommendNode(options: {
    serviceGroup?: string;
    preferredRegion?: string;
    requireLeader?: boolean;
    requiredCapabilities?: string[];
  } = {}): {
    recommendedNodeId: string;
    generatedAt: number;
    nodes: Array<AuthorityClusterNodeSnapshot & { score: number }>;
  } {
    const now = Date.now();
    const snapshots = this.getSnapshot();
    const scored = snapshots.nodes.map((node) => {
      const serviceGroups = node.serviceGroups;
      let score = 0;
      if (node.status === "active") {
        score += 50;
      } else if (node.status === "degraded") {
        score += 20;
      } else {
        score -= 100;
      }
      if (options.requireLeader && node.nodeId === snapshots.leaderNodeId) {
        score += 25;
      }
      if (!options.requireLeader && node.nodeId === snapshots.leaderNodeId) {
        score += 5;
      }
      if (options.serviceGroup && serviceGroups.includes(options.serviceGroup)) {
        score += 20;
      }
      if (
        options.preferredRegion &&
        String(node.metadata.region || "") === options.preferredRegion
      ) {
        score += 10;
      }
      score += Math.round(node.healthScore / 5);
      score -= Math.round(node.load * 20);
      score -= Math.round(node.syncLagMs / 500);
      return {
        ...node,
        score,
      };
    }).sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      if (left.load !== right.load) {
        return left.load - right.load;
      }
      return right.lastSeen - left.lastSeen;
    });

    const recommended = scored[0]?.nodeId || "";
    this.state.cluster.lastRecommendationAt = now;
    this.audit("authority.cluster.recommendation", {
      recommendedNodeId: recommended,
      serviceGroup: options.serviceGroup || "",
      preferredRegion: options.preferredRegion || "",
      requireLeader: options.requireLeader === true,
    });
    return {
      recommendedNodeId: recommended,
      generatedAt: now,
      nodes: scored,
    };
  }

  private start(): void {
    if (this.coordinationTimer) {
      return;
    }
    this.coordinationTimer = setInterval(() => {
      void this.coordinationTick("interval");
    }, this.coordinationIntervalMs);
    this.coordinationTimer.unref?.();
  }

  private async coordinationTick(reason: string): Promise<void> {
    if (!this.clusterNode || !this.leaseManager || this.tickInFlight) {
      return;
    }
    this.tickInFlight = true;
    try {
      await this.clusterNode.syncFromBackplane();
      this.lastTopologySyncAt = Date.now();
      this.refreshTopologyProjection();
      await this.ensureLeadership(reason);
      await this.publishHeartbeat();
      if (this.isLeader() && this.shouldPublishSnapshot()) {
        await this.publishSnapshot(reason);
      }
      this.refreshClusterCounters();
      this.state.lastUpdate = Date.now();
    } finally {
      this.tickInFlight = false;
    }
  }

  private async ensureLeadership(reason: string): Promise<void> {
    if (!this.clusterNode || !this.leaseManager) {
      return;
    }

    const now = Date.now();
    const localNodeId = this.clusterNode.getLocalNode().nodeId;
    const previousLeader = this.state.cluster.leaderNodeId;
    let lease = await this.leaseManager.getLease(LEADER_LEASE_KEY);

    if (lease?.ownerNodeId === localNodeId) {
      const renewed = await this.leaseManager.renew(LEADER_LEASE_KEY, localNodeId, this.leaderLeaseTtlMs);
      lease = renewed || lease;
      if (renewed) {
        this.state.cluster.lastLeaseRenewedAt = now;
      }
    } else if (!lease) {
      const acquired = await this.leaseManager.acquire(
        LEADER_LEASE_KEY,
        localNodeId,
        this.leaderLeaseTtlMs,
        { reason },
      );
      if (acquired) {
        lease = acquired;
        this.state.cluster.lastLeaseRenewedAt = now;
      }
    }

    const leaderNodeId = lease?.ownerNodeId || this.pickFallbackLeader();
    this.state.cluster.leaderNodeId = leaderNodeId;
    this.state.cluster.leaderLeaseExpiresAt = lease?.expiresAt || 0;
    this.state.cluster.localNodeId = localNodeId;
    this.state.cluster.coordinationMode = this.clusterNode.getCoordinationMode();
    this.state.cluster.role = localNodeId === leaderNodeId ? "leader" : "follower";
    this.state.cluster.syncStatus = this.state.cluster.role === "leader"
      ? "leader"
      : this.state.cluster.lastSyncAt === 0
        ? "catching_up"
        : now - this.state.cluster.lastSyncAt > this.staleSyncThresholdMs
          ? "stale"
          : "follower";

    const localEntry = this.getOrCreateNodeProjection(localNodeId);
    localEntry.coordinationRole = this.state.cluster.role;
    localEntry.lastSeen = now;

    if (previousLeader !== leaderNodeId) {
      this.state.cluster.lastFailoverAt = previousLeader ? now : this.state.cluster.lastFailoverAt;
      this.audit("authority.cluster.leader.elected", {
        previousLeaderNodeId: previousLeader,
        leaderNodeId,
        reason,
      });
      if (previousLeader) {
        this.audit("authority.cluster.failover", {
          previousLeaderNodeId: previousLeader,
          leaderNodeId,
          reason,
        });
      }
    }
  }

  private pickFallbackLeader(): string {
    const nodes = [...this.state.cluster.nodes.values()]
      .filter((node) => node.status !== "offline")
      .sort((left, right) => {
        if (left.status !== right.status) {
          return left.status === "active" ? -1 : 1;
        }
        if (left.load !== right.load) {
          return left.load - right.load;
        }
        return left.nodeId.localeCompare(right.nodeId);
      });
    return nodes[0]?.nodeId || this.state.cluster.localNodeId;
  }

  private async publishHeartbeat(): Promise<void> {
    if (!this.clusterNode) {
      return;
    }
    const localNode = this.clusterNode.getLocalNode();
    const payload: AuthorityClusterHeartbeatPayload = {
      nodeId: localNode.nodeId,
      clusterId: localNode.clusterId,
      coordinationMode: this.clusterNode.getCoordinationMode(),
      eventCursor: this.state.audit.eventCursor,
      healthScore: this.computeLocalHealthScore(),
      load: this.computeLocalLoad(localNode),
      status: this.computeLocalStatus(),
      coordinationRole: this.isLeader() ? "leader" : "follower",
      serviceGroups: this.getLocalServiceGroups(),
      region: String(localNode.metadata?.region || ""),
      generatedAt: Date.now(),
    };
    await this.clusterNode.publish(HEARTBEAT_CHANNEL, payload);
    this.audit("authority.cluster.heartbeat", {
      nodeId: payload.nodeId,
      coordinationRole: payload.coordinationRole,
      healthScore: payload.healthScore,
      load: payload.load,
    });
    this.updateProjectionFromHeartbeat(payload, payload.nodeId);
  }

  private shouldPublishSnapshot(): boolean {
    const now = Date.now();
    return (
      now - this.state.cluster.lastPublishedAt >= this.snapshotPublishIntervalMs ||
      this.lastPublishedCursor !== this.state.audit.eventCursor
    );
  }

  private async publishSnapshot(reason: string): Promise<void> {
    if (!this.clusterNode) {
      return;
    }
    const payload: AuthorityClusterSnapshotPayload = {
      nodeId: this.clusterNode.getLocalNode().nodeId,
      clusterId: this.clusterNode.getLocalNode().clusterId,
      eventCursor: this.state.audit.eventCursor,
      generatedAt: Date.now(),
      authority: authorityStateToPlain(this.state) as Record<string, unknown>,
    };
    await this.clusterNode.publish(SNAPSHOT_CHANNEL, payload);
    this.state.cluster.lastPublishedAt = payload.generatedAt;
    this.lastPublishedCursor = payload.eventCursor;
  }

  private async handleHeartbeat(payload: AuthorityClusterHeartbeatPayload, sourceNodeId?: string): Promise<void> {
    const nodeId = sourceNodeId || payload.nodeId;
    if (!nodeId) {
      return;
    }
    this.updateProjectionFromHeartbeat(payload, nodeId);
    if (payload.coordinationRole === "leader") {
      this.state.cluster.leaderNodeId = nodeId;
    }
    this.refreshClusterCounters();
  }

  private async handleSnapshot(payload: AuthorityClusterSnapshotPayload, sourceNodeId?: string): Promise<void> {
    const nodeId = sourceNodeId || payload.nodeId;
    if (!nodeId || nodeId === this.state.cluster.localNodeId || this.isLeader()) {
      return;
    }
    if (payload.eventCursor && payload.eventCursor === this.lastAppliedSyncCursor) {
      return;
    }
    if (this.state.cluster.leaderNodeId && nodeId !== this.state.cluster.leaderNodeId) {
      return;
    }

    this.applyReplicaSnapshot(payload.authority);
    this.lastAppliedSyncCursor = payload.eventCursor;
    this.state.cluster.lastSyncAt = Date.now();
    this.state.cluster.lastSyncCursor = payload.eventCursor;
    this.state.cluster.lastSyncSource = nodeId;
    this.state.cluster.syncStatus = "follower";
    const projection = this.getOrCreateNodeProjection(nodeId);
    projection.syncLagMs = Math.max(0, Date.now() - payload.generatedAt);
    projection.lastCursor = payload.eventCursor;
    this.audit("authority.cluster.synced", {
      sourceNodeId: nodeId,
      eventCursor: payload.eventCursor,
      generatedAt: payload.generatedAt,
    });
  }

  private applyReplicaSnapshot(source: Record<string, unknown>): void {
    const localRoomId = this.state.roomId;
    const localReplication = {
      logPath: this.state.replication.logPath,
      snapshotPath: this.state.replication.snapshotPath,
    };
    const localCluster = {
      enabled: this.state.cluster.enabled,
      clusterId: this.state.cluster.clusterId,
      coordinationMode: this.state.cluster.coordinationMode,
      localNodeId: this.state.cluster.localNodeId,
      leaderNodeId: this.state.cluster.leaderNodeId,
      role: this.state.cluster.role,
      lastLeaseRenewedAt: this.state.cluster.lastLeaseRenewedAt,
      lastFailoverAt: this.state.cluster.lastFailoverAt,
      lastRecommendationAt: this.state.cluster.lastRecommendationAt,
    };

    hydrateAuthorityState(this.state, source);
    this.state.roomId = localRoomId;
    this.state.replication.logPath = localReplication.logPath;
    this.state.replication.snapshotPath = localReplication.snapshotPath;
    this.state.replication.lastRecoveredAt = Date.now();
    this.state.cluster.enabled = localCluster.enabled;
    this.state.cluster.clusterId = localCluster.clusterId;
    this.state.cluster.coordinationMode = localCluster.coordinationMode;
    this.state.cluster.localNodeId = localCluster.localNodeId;
    this.state.cluster.leaderNodeId = localCluster.leaderNodeId;
    this.state.cluster.role = localCluster.role;
    this.state.cluster.lastLeaseRenewedAt = localCluster.lastLeaseRenewedAt;
    this.state.cluster.lastFailoverAt = localCluster.lastFailoverAt;
    this.state.cluster.lastRecommendationAt = localCluster.lastRecommendationAt;
    this.refreshTopologyProjection();
  }

  private refreshTopologyProjection(): void {
    if (!this.clusterNode) {
      return;
    }

    const topology = this.clusterNode.getTopology();
    const seen = new Set<string>();
    topology.forEach((node) => {
      seen.add(node.nodeId);
      const projection = this.getOrCreateNodeProjection(node.nodeId);
      projection.nodeId = node.nodeId;
      projection.role = node.role;
      projection.status = node.status;
      projection.host = `${node.host}:${node.httpPort}`;
      projection.load = node.load;
      projection.lastSeen = node.lastSeen;
      projection.metadata.set("version", node.version);
      projection.metadata.set("capabilities", (node.capabilities || []).join(","));
      projection.metadata.set("region", String(node.metadata?.region || ""));
    });

    [...this.state.cluster.nodes.keys()].forEach((nodeId) => {
      if (!seen.has(nodeId)) {
        const projection = this.getOrCreateNodeProjection(nodeId);
        projection.status = "offline";
      }
    });
    this.updateProjectionFromHeartbeat({
      nodeId: this.clusterNode.getLocalNode().nodeId,
      clusterId: this.clusterNode.getLocalNode().clusterId,
      coordinationMode: this.clusterNode.getCoordinationMode(),
      eventCursor: this.state.audit.eventCursor,
      healthScore: this.computeLocalHealthScore(),
      load: this.computeLocalLoad(this.clusterNode.getLocalNode()),
      status: this.computeLocalStatus(),
      coordinationRole: this.isLeader() ? "leader" : "follower",
      serviceGroups: this.getLocalServiceGroups(),
      region: String(this.clusterNode.getLocalNode().metadata?.region || ""),
      generatedAt: Date.now(),
    }, this.clusterNode.getLocalNode().nodeId);
  }

  private updateProjectionFromHeartbeat(payload: AuthorityClusterHeartbeatPayload, nodeId: string): void {
    const projection = this.getOrCreateNodeProjection(nodeId);
    projection.nodeId = nodeId;
    projection.healthScore = payload.healthScore;
    projection.load = payload.load;
    projection.status = payload.status;
    projection.coordinationRole = payload.coordinationRole;
    projection.lastSeen = payload.generatedAt;
    projection.lastCursor = payload.eventCursor;
    projection.syncLagMs = nodeId === this.state.cluster.localNodeId || !this.state.cluster.lastSyncAt
      ? 0
      : Math.max(0, Date.now() - this.state.cluster.lastSyncAt);
    projection.metadata.set("serviceGroups", unique(payload.serviceGroups).join(","));
    projection.metadata.set("region", payload.region);
    projection.metadata.set("coordinationMode", payload.coordinationMode);
  }

  private refreshClusterCounters(): void {
    const nodes = [...this.state.cluster.nodes.values()];
    this.state.cluster.activeNodeCount = nodes.filter((node) => node.status === "active").length;
    this.state.cluster.degradedNodeCount = nodes.filter((node) => node.status === "degraded").length;
    this.state.cluster.offlineNodeCount = nodes.filter((node) => node.status === "offline").length;
  }

  private getLocalServiceGroups(): string[] {
    return unique(
      this.mcpTransportService
        .listServices()
        .map((service) => service.orchestrationGroup)
        .filter((value) => value && value.length > 0),
    );
  }

  private computeLocalHealthScore(): number {
    const unhealthyAgents = [...this.state.agents.values()].filter((agent) => agent.healthStatus === "unhealthy").length;
    const degradedAgents = [...this.state.agents.values()].filter((agent) => agent.healthStatus === "degraded").length;
    const unhealthyMcp = this.mcpTransportService.listServices().filter((service) => !service.healthy).length;
    return clamp(
      100
      - this.state.entropy.breakerLevel * 15
      - Math.round(this.state.entropy.global * 20)
      - unhealthyAgents * 12
      - degradedAgents * 4
      - unhealthyMcp * 5,
      0,
      100,
    );
  }

  private computeLocalLoad(localNode: ClusterNodeRecord): number {
    const sessionLoads = [...this.state.agents.values()].map((agent) => agent.currentLoad);
    const sessionAverage = sessionLoads.length
      ? sessionLoads.reduce((sum, value) => sum + value, 0) / sessionLoads.length
      : 0;
    return Number(clamp(Math.max(localNode.load || 0, sessionAverage), 0, 1).toFixed(4));
  }

  private computeLocalStatus(): string {
    const healthScore = this.computeLocalHealthScore();
    if (healthScore >= 75) {
      return "active";
    }
    if (healthScore >= 40) {
      return "degraded";
    }
    return "maintenance";
  }

  private getOrCreateNodeProjection(nodeId: string): ClusterNodeProjectionState {
    let entry = this.state.cluster.nodes.get(nodeId);
    if (!entry) {
      entry = new ClusterNodeProjectionState();
      entry.nodeId = nodeId;
      this.state.cluster.nodes.set(nodeId, entry);
    }
    return entry;
  }

  private isLeader(): boolean {
    return Boolean(this.clusterNode && this.state.cluster.localNodeId && this.state.cluster.localNodeId === this.state.cluster.leaderNodeId);
  }

  private registerTaskHandlers(): void {
    if (!this.taskDispatcher) {
      return;
    }
    this.taskDispatcher.registerHandler("authority.cluster.snapshot.pull", async () => ({
      authority: authorityStateToPlain(this.state),
      eventCursor: this.state.audit.eventCursor,
      generatedAt: Date.now(),
    }));
    this.taskDispatcher.registerHandler("authority.cluster.node.recommend", async (request) =>
      this.recommendNode((request.payload || {}) as {
        serviceGroup?: string;
        preferredRegion?: string;
        requireLeader?: boolean;
        requiredCapabilities?: string[];
      }));
  }

  private resetClusterState(): void {
    this.state.cluster.enabled = false;
    this.state.cluster.clusterId = "";
    this.state.cluster.coordinationMode = "standalone";
    this.state.cluster.localNodeId = "";
    this.state.cluster.leaderNodeId = "";
    this.state.cluster.role = "standalone";
    this.state.cluster.syncStatus = "idle";
    this.state.cluster.leaderLeaseExpiresAt = 0;
    this.state.cluster.lastLeaseRenewedAt = 0;
    this.state.cluster.lastSyncAt = 0;
    this.state.cluster.lastSyncCursor = "";
    this.state.cluster.lastSyncSource = "";
    this.state.cluster.lastPublishedAt = 0;
    this.state.cluster.lastFailoverAt = 0;
    this.state.cluster.lastRecommendationAt = 0;
    this.state.cluster.activeNodeCount = 0;
    this.state.cluster.degradedNodeCount = 0;
    this.state.cluster.offlineNodeCount = 0;
    [...this.state.cluster.nodes.keys()].forEach((key) => this.state.cluster.nodes.delete(key));
  }

  private audit(type: AuthorityEventType, payload: Record<string, unknown>): void {
    this.eventStore.append({
      eventId: createId("event"),
      mutationId: createId("cluster-audit"),
      type,
      timestamp: Date.now(),
      payload,
    });
    this.state.audit.totalEvents = this.eventStore.count();
    this.state.audit.eventCursor = `cluster:${type}:${Date.now()}`;
  }
}

export default AuthorityClusterCoordinationService;
