/**
 * @constitution
 * §101 同步公理: authority 监控实现与真理源文档保持同步
 * §102 熵减原则: 保持 authority 监控逻辑简洁可维护
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename AuthorityMonitoringService.ts
 * @version 1.0.0
 * @category authority
 * @last_updated 2026-03-10
 */

import { AuthorityState } from "../../schema/AuthorityState";
import { AuthorityAgentSessionRegistry } from "./AuthorityAgentSessionRegistry";
import { AuthorityClusterCoordinationService } from "./AuthorityClusterCoordinationService";
import { AuthorityMcpTransportService } from "./AuthorityMcpTransportService";
import { AuthorityReplicationService } from "./AuthorityReplicationService";
import { AuthorityMonitoringSnapshot } from "./types";
import { EventStore } from "./EventStore";
import { EntropyEngine } from "../governance/EntropyEngine";

export class AuthorityMonitoringService {
  private clusterCoordinationService: AuthorityClusterCoordinationService | null = null;

  constructor(
    private readonly state: AuthorityState,
    private readonly eventStore: EventStore,
    private readonly entropyEngine: EntropyEngine,
    private readonly agentSessionRegistry: AuthorityAgentSessionRegistry,
    private readonly replicationService: AuthorityReplicationService,
    private readonly mcpTransportService: AuthorityMcpTransportService,
  ) {}

  setClusterCoordinationService(service: AuthorityClusterCoordinationService | null): void {
    this.clusterCoordinationService = service;
  }

  getSnapshot(): AuthorityMonitoringSnapshot {
    const entropy = this.entropyEngine.getReport();
    const replication = this.replicationService.getStatus();
    const sessions = this.agentSessionRegistry.listSessions();
    const mcpServices = this.mcpTransportService.listServices();
    const polling = this.mcpTransportService.getPollingStatus();
    const maintenance = this.mcpTransportService.getMaintenanceStatus();
    const cluster = this.clusterCoordinationService?.getSnapshot() || {
      enabled: false,
      coordinationMode: "standalone" as const,
      localNodeId: "",
      leaderNodeId: "",
      role: "standalone" as const,
      syncStatus: "idle" as const,
      leaderLeaseExpiresAt: 0,
      lastLeaseRenewedAt: 0,
      lastSyncAt: 0,
      lastSyncCursor: "",
      lastSyncSource: "",
      lastPublishedAt: 0,
      lastFailoverAt: 0,
      lastRecommendationAt: 0,
      activeNodeCount: 0,
      degradedNodeCount: 0,
      offlineNodeCount: 0,
      nodes: [],
    };

    const connected = sessions.filter((session) => session.connectionStatus === "connected").length;
    const available = sessions.filter((session) => session.available).length;
    const degraded = sessions.filter((session) => session.healthStatus === "degraded").length;
    const unhealthy = sessions.filter((session) => session.healthStatus === "unhealthy").length;
    const overloaded = sessions.filter((session) => session.currentLoad >= 0.85).length;
    const busy = sessions.filter((session) => session.pendingTasks > 0 || session.status !== "idle").length;

    const alerts: string[] = [];
    if (entropy.global >= (entropy.thresholds.global_danger ?? 0.85)) {
      alerts.push("entropy_global_high");
    } else if (entropy.global >= (entropy.thresholds.global_warning ?? 0.7)) {
      alerts.push("entropy_global_warning");
    }
    if (this.state.entropy.breakerLevel >= 2) {
      alerts.push("breaker_escalated");
    } else if (this.state.entropy.breakerLevel === 1) {
      alerts.push("breaker_guarded");
    }
    if (!replication.storage.healthy) {
      alerts.push(...replication.storage.warnings.map((warning) => `replication_${warning}`));
    }
    if (replication.lastError) {
      alerts.push("replication_error");
    }
    if (mcpServices.some((service) => !service.healthy && service.lastCheckedAt > 0)) {
      alerts.push("mcp_service_unhealthy");
    }
    if (mcpServices.some((service) => service.healthStatus === "recovering")) {
      alerts.push("mcp_service_recovering");
    }
    if (mcpServices.some((service) => service.operationalMode !== "active")) {
      alerts.push("mcp_service_constrained");
    }
    if (mcpServices.some((service) => service.servicesInMaintenance)) {
      alerts.push("mcp_service_in_maintenance");
    }
    if (mcpServices.some((service) => service.sloStatus === "violated")) {
      alerts.push("mcp_service_slo_violation");
    }
    if (mcpServices.some((service) => service.recoveryLockoutUntil > Date.now())) {
      alerts.push("mcp_service_recovery_locked");
    }
    if (mcpServices.some((service) => service.effectiveTrafficPercent < service.configuredTrafficPercent)) {
      alerts.push("mcp_service_canary_ramp");
    }
    if (mcpServices.some((service) => service.maintenanceConflictCount > 0)) {
      alerts.push("mcp_service_maintenance_conflict");
    }
    if (cluster.enabled && cluster.activeNodeCount > 0 && !cluster.leaderNodeId) {
      alerts.push("authority_cluster_leader_missing");
    }
    if (cluster.enabled && cluster.syncStatus === "stale") {
      alerts.push("authority_cluster_sync_stale");
    }
    if (unhealthy > 0) {
      alerts.push("agent_unhealthy_present");
    } else if (degraded > 0) {
      alerts.push("agent_degraded_present");
    }

    const healthScore = Math.max(
      0,
      100 -
        Math.round(entropy.global * 30) -
        this.state.entropy.breakerLevel * 15 -
        unhealthy * 15 -
        degraded * 5 -
        overloaded * 3 -
        mcpServices.filter((service) => !service.healthy && service.lastCheckedAt > 0).length * 4 -
        (replication.storage.warnings.length + (replication.lastError ? 1 : 0)) * 6,
    );

    let status: AuthorityMonitoringSnapshot["status"] = "healthy";
    if (
      this.state.entropy.breakerLevel >= 2 ||
      unhealthy > 0 ||
      Boolean(replication.lastError)
    ) {
      status = "critical";
    } else if (alerts.length > 0) {
      status = "warning";
    }

    return {
      status,
      healthScore,
      generatedAt: Date.now(),
      alerts,
      authority: {
        version: this.state.system.version,
        roomId: this.state.roomId,
        uptimeMs: Math.max(0, Date.now() - this.state.createdAt),
        lastUpdate: this.state.lastUpdate,
        eventCount: this.eventStore.count(),
      },
      entropy,
      breaker: {
        level: this.state.entropy.breakerLevel,
        mode: this.state.system.mode,
        status: this.state.system.status,
      },
      sessions: {
        total: sessions.length,
        connected,
        available,
        degraded,
        unhealthy,
        overloaded,
        busy,
      },
      tools: {
        registered: this.state.tools.registry.size,
        activeCalls: this.state.tools.activeCalls.size,
        quotas: this.state.tools.quotas.size,
        mcpServices: mcpServices.length,
        healthyMcpServices: mcpServices.filter((service) => service.healthy).length,
        degradedMcpServices: mcpServices.filter((service) => service.healthStatus === "degraded").length,
        unhealthyMcpServices: mcpServices.filter((service) => service.healthStatus === "unhealthy").length,
        recoveringMcpServices: mcpServices.filter((service) => service.healthStatus === "recovering").length,
        servicesInMaintenance: mcpServices.filter((service) => service.servicesInMaintenance).length,
        sloViolatedMcpServices: mcpServices.filter((service) => service.sloStatus === "violated").length,
        recoveryLockedMcpServices: mcpServices.filter((service) => service.recoveryLockoutUntil > Date.now()).length,
        canaryMcpServices: mcpServices.filter((service) => service.effectiveTrafficPercent < service.configuredTrafficPercent).length,
        maintenanceConflictMcpServices: mcpServices.filter((service) => service.maintenanceConflictCount > 0).length,
        orchestratedServiceGroups: new Set(mcpServices.map((service) => service.orchestrationGroup).filter(Boolean)).size,
        pausedMcpServices: mcpServices.filter((service) => service.operationalMode === "paused").length,
        isolatedMcpServices: mcpServices.filter((service) => service.operationalMode === "isolated").length,
        mcpPollingActive: polling.active,
        lastMcpPollAt: polling.lastPollCompletedAt || polling.lastPollAt,
        lastMaintenanceRunAt: maintenance.lastCompletedAt || maintenance.lastRunAt,
        lastUpdate: this.state.tools.lastUpdate,
      },
      workflows: {
        total: this.state.workflows.size,
        active: [...this.state.workflows.values()].filter((workflow) => workflow.status !== "completed").length,
        blocked: [...this.state.workflows.values()].filter((workflow) =>
          ["blocked", "failed", "circuit_open"].includes(workflow.status),
        ).length,
      },
      governance: {
        proposals: this.state.governance.proposals.size,
        approvals: this.state.governance.approvals.size,
        sanctions: this.state.governance.sanctions.size,
        mutationQueueDepth: this.state.governance.mutationQueue.length,
      },
      collaboration: {
        topics: this.state.collaboration.topics.size,
        subscriptions: this.state.collaboration.subscriptions.size,
        lastMessages: this.state.collaboration.lastMessages.size,
      },
      cluster: {
        enabled: cluster.enabled,
        coordinationMode: cluster.coordinationMode,
        localNodeId: cluster.localNodeId,
        leaderNodeId: cluster.leaderNodeId,
        role: cluster.role,
        syncStatus: cluster.syncStatus,
        activeNodes: cluster.activeNodeCount,
        degradedNodes: cluster.degradedNodeCount,
        offlineNodes: cluster.offlineNodeCount,
        lastSyncAt: cluster.lastSyncAt,
        lastFailoverAt: cluster.lastFailoverAt,
      },
      replication,
    };
  }

  getOpsReport(): AuthorityMonitoringSnapshot & { recommendedActions: string[] } {
    const snapshot = this.getSnapshot();
    const recommendedActions: string[] = [];

    if (snapshot.replication.storage.warnings.includes("snapshot_missing")) {
      recommendedActions.push("create_authority_snapshot");
    }
    if (snapshot.replication.lastError) {
      recommendedActions.push("inspect_replication_storage");
    }
    if (snapshot.breaker.level > 0) {
      recommendedActions.push("review_entropy_and_breaker");
    }
    if (snapshot.sessions.unhealthy > 0) {
      recommendedActions.push("drain_unhealthy_agents");
    }
    if (snapshot.sessions.overloaded > 0) {
      recommendedActions.push("rebalance_agent_load");
    }
    if (snapshot.tools.unhealthyMcpServices > 0) {
      recommendedActions.push("review_mcp_failback");
    }
    if (snapshot.tools.sloViolatedMcpServices > 0) {
      recommendedActions.push("review_mcp_slo_policy");
    }
    if (snapshot.tools.servicesInMaintenance > 0) {
      recommendedActions.push("review_mcp_maintenance_windows");
    }
    if (snapshot.tools.recoveryLockedMcpServices > 0) {
      recommendedActions.push("clear_mcp_recovery_lockout");
    }
    if (snapshot.tools.canaryMcpServices > 0) {
      recommendedActions.push("review_mcp_canary_ramp");
    }
    if (snapshot.tools.maintenanceConflictMcpServices > 0) {
      recommendedActions.push("review_mcp_maintenance_conflicts");
    }
    if (snapshot.cluster.enabled && snapshot.cluster.syncStatus === "stale") {
      recommendedActions.push("review_authority_cluster_sync");
    }
    if (snapshot.cluster.enabled && !snapshot.cluster.leaderNodeId && snapshot.cluster.activeNodes > 0) {
      recommendedActions.push("inspect_authority_cluster_failover");
    }
    if (snapshot.tools.pausedMcpServices > 0 || snapshot.tools.isolatedMcpServices > 0) {
      recommendedActions.push("inspect_mcp_service_controls");
    }
    if (!snapshot.tools.mcpPollingActive) {
      recommendedActions.push("resume_mcp_health_polling");
    }

    return {
      ...snapshot,
      recommendedActions,
    };
  }
}

export default AuthorityMonitoringService;
