/**
 * @constitution
 * §101 同步公理: authority 监控测试需与真理源文档保持同步
 * §102 熵减原则: 保持 authority 监控测试验证路径清晰可维护
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename AuthorityMonitoringService.test.ts
 * @version 1.0.0
 * @category authority/test
 * @last_updated 2026-03-10
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AuthorityState } from "../../schema/AuthorityState";
import { EntropyEngine } from "../governance/EntropyEngine";
import { BreakerService } from "../governance/BreakerService";
import { AuthorityAgentSessionRegistry } from "./AuthorityAgentSessionRegistry";
import { AuthorityMcpTransportService } from "./AuthorityMcpTransportService";
import { AuthorityMonitoringService } from "./AuthorityMonitoringService";
import { AuthorityReplicationService } from "./AuthorityReplicationService";
import { AuthorityToolCallBridge } from "./AuthorityToolCallBridge";
import { EventStore } from "./EventStore";
import { MutationPipeline } from "./MutationPipeline";

const tempDirs: string[] = [];

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

describe("AuthorityMonitoringService", () => {
  it("aggregates authority, session, entropy, and replication health for ops", async () => {
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "negentropy-monitoring-"));
    tempDirs.push(storageDir);

    const state = new AuthorityState();
    const eventStore = new EventStore();
    const entropyEngine = new EntropyEngine(state);
    const breakerService = new BreakerService(state);
    const pipeline = new MutationPipeline(state, eventStore, entropyEngine, breakerService);
    const registry = new AuthorityAgentSessionRegistry(state, pipeline);
    const toolBridge = new AuthorityToolCallBridge(state, eventStore);
    const mcpTransport = new AuthorityMcpTransportService(state, eventStore, toolBridge);
    const replication = new AuthorityReplicationService(state, eventStore, pipeline, {
      storageDir,
      snapshotEventThreshold: 100,
      snapshotIntervalMs: 60_000,
    });

    registry.registerSession({
      agentId: "agent:ops",
      name: "Ops",
      department: "OFFICE",
      role: "director",
      model: "zai/glm-5",
      provider: "zai",
      capabilities: ["observe:*"],
    });
    registry.heartbeat({
      agentId: "agent:ops",
      load: 0.9,
      pendingTasks: 2,
      healthStatus: "degraded",
    });

    replication.snapshot();
    await mcpTransport.registerService({
      serviceId: "ops-paused-service",
      provider: "fixture",
      transport: "http",
      endpoint: "http://127.0.0.1:65510",
      enabled: true,
      operationalMode: "paused",
      source: "fixture",
      modules: ["remote"],
      traffic: {
        allocationPercent: 40,
        canaryPercent: 10,
        lane: "canary",
      },
      orchestration: {
        serviceGroup: "ops-group",
        templateId: "template:ops",
        preferredNodes: ["node-a"],
      },
      maintenanceWindows: [
        {
          windowId: "ops-window-1",
          startAt: Date.now() + 5_000,
          endAt: Date.now() + 10_000,
          action: "pause",
        },
        {
          windowId: "ops-window-2",
          startAt: Date.now() + 7_000,
          endAt: Date.now() + 12_000,
          action: "disable",
        },
      ],
    });

    const monitoring = new AuthorityMonitoringService(state, eventStore, entropyEngine, registry, replication, mcpTransport);
    const snapshot = monitoring.getSnapshot();
    const ops = monitoring.getOpsReport();

    expect(snapshot.sessions.total).toBe(1);
    expect(snapshot.sessions.degraded).toBe(1);
    expect(snapshot.replication.snapshotPath).toContain("snapshot.json");
    expect(snapshot.replication.storage.files.some((entry) => entry.kind === "snapshot")).toBe(true);
    expect(snapshot.tools.registered).toBe(0);
    expect(snapshot.tools.pausedMcpServices).toBe(1);
    expect(snapshot.tools.servicesInMaintenance).toBe(0);
    expect(snapshot.tools.sloViolatedMcpServices).toBe(0);
    expect(snapshot.tools.canaryMcpServices).toBeGreaterThanOrEqual(1);
    expect(snapshot.tools.maintenanceConflictMcpServices).toBeGreaterThanOrEqual(1);
    expect(snapshot.tools.orchestratedServiceGroups).toBeGreaterThanOrEqual(1);
    expect(snapshot.tools.mcpPollingActive).toBe(true);
    expect(snapshot.status).toBe("warning");
    expect(ops.recommendedActions).toContain("rebalance_agent_load");
    expect(ops.recommendedActions).toContain("inspect_mcp_service_controls");
    expect(ops.recommendedActions).toContain("review_mcp_canary_ramp");
    expect(ops.recommendedActions).toContain("review_mcp_maintenance_conflicts");

    mcpTransport.dispose();
    replication.dispose();
  });

  it("recommends failback review and polling resume when MCP services are unhealthy and polling is disabled", async () => {
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "negentropy-monitoring-disabled-"));
    tempDirs.push(storageDir);

    const state = new AuthorityState();
    const eventStore = new EventStore();
    const entropyEngine = new EntropyEngine(state);
    const breakerService = new BreakerService(state);
    const pipeline = new MutationPipeline(state, eventStore, entropyEngine, breakerService);
    const registry = new AuthorityAgentSessionRegistry(state, pipeline);
    const toolBridge = new AuthorityToolCallBridge(state, eventStore);
    const mcpTransport = new AuthorityMcpTransportService(state, eventStore, toolBridge, {
      enableHealthPolling: false,
    });
    const replication = new AuthorityReplicationService(state, eventStore, pipeline, {
      storageDir,
      snapshotEventThreshold: 100,
      snapshotIntervalMs: 60_000,
    });

    await mcpTransport.registerService({
      serviceId: "ops-disabled-service",
      provider: "fixture",
      transport: "http",
      endpoint: "http://127.0.0.1:65511",
      enabled: false,
      source: "fixture",
      modules: ["remote"],
    });

    const monitoring = new AuthorityMonitoringService(state, eventStore, entropyEngine, registry, replication, mcpTransport);
    const snapshot = monitoring.getSnapshot();
    const ops = monitoring.getOpsReport();

    expect(snapshot.tools.unhealthyMcpServices).toBeGreaterThanOrEqual(1);
    expect(snapshot.tools.recoveryLockedMcpServices).toBe(0);
    expect(snapshot.tools.mcpPollingActive).toBe(false);
    expect(ops.recommendedActions).toContain("review_mcp_failback");
    expect(ops.recommendedActions).toContain("resume_mcp_health_polling");

    mcpTransport.dispose();
    replication.dispose();
  });

  it("surfaces cluster sync and failover recommendations when authority coordination degrades", () => {
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "negentropy-monitoring-cluster-"));
    tempDirs.push(storageDir);

    const state = new AuthorityState();
    const eventStore = new EventStore();
    const entropyEngine = new EntropyEngine(state);
    const breakerService = new BreakerService(state);
    const pipeline = new MutationPipeline(state, eventStore, entropyEngine, breakerService);
    const registry = new AuthorityAgentSessionRegistry(state, pipeline);
    const toolBridge = new AuthorityToolCallBridge(state, eventStore);
    const mcpTransport = new AuthorityMcpTransportService(state, eventStore, toolBridge);
    const replication = new AuthorityReplicationService(state, eventStore, pipeline, {
      storageDir,
      snapshotEventThreshold: 100,
      snapshotIntervalMs: 60_000,
    });

    const monitoring = new AuthorityMonitoringService(state, eventStore, entropyEngine, registry, replication, mcpTransport);
    monitoring.setClusterCoordinationService({
      getSnapshot: () => ({
        enabled: true,
        clusterId: "negentropy-lan",
        coordinationMode: "memory",
        localNodeId: "node-b",
        leaderNodeId: "",
        role: "follower",
        syncStatus: "stale",
        leaderLeaseExpiresAt: 0,
        lastLeaseRenewedAt: 0,
        lastSyncAt: Date.now() - 30_000,
        lastSyncCursor: "event:stale",
        lastSyncSource: "node-a",
        lastPublishedAt: 0,
        lastFailoverAt: Date.now() - 10_000,
        lastRecommendationAt: 0,
        activeNodeCount: 2,
        degradedNodeCount: 0,
        offlineNodeCount: 0,
        nodes: [],
      }),
    } as any);

    const snapshot = monitoring.getSnapshot();
    const ops = monitoring.getOpsReport();

    expect(snapshot.cluster.enabled).toBe(true);
    expect(snapshot.cluster.syncStatus).toBe("stale");
    expect(snapshot.alerts).toContain("authority_cluster_sync_stale");
    expect(snapshot.alerts).toContain("authority_cluster_leader_missing");
    expect(ops.recommendedActions).toContain("review_authority_cluster_sync");
    expect(ops.recommendedActions).toContain("inspect_authority_cluster_failover");

    mcpTransport.dispose();
    replication.dispose();
  });
});
