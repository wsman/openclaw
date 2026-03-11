/**
 * @constitution
 * §101 同步公理: authority 集群协同测试需与真理源文档保持同步
 * §102 熵减原则: 保持 authority 集群测试验证路径清晰可维护
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename AuthorityClusterCoordinationService.test.ts
 * @version 1.0.0
 * @category authority/test
 * @last_updated 2026-03-10
 */

import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ClusterNode } from "../../cluster/ClusterNode";
import { MemoryClusterBackplane } from "../../cluster/backplane/MemoryClusterBackplane";
import { AuthorityState } from "../../schema/AuthorityState";
import { AuthorityToolCallBridge } from "./AuthorityToolCallBridge";
import { AuthorityMcpTransportService } from "./AuthorityMcpTransportService";
import { EventStore } from "./EventStore";
import { AuthorityClusterCoordinationService } from "./AuthorityClusterCoordinationService";

async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("failed to allocate port"));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function waitFor(assertion: () => boolean | Promise<boolean>, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await assertion()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("condition not met before timeout");
}

type Harness = {
  node: ClusterNode;
  state: AuthorityState;
  eventStore: EventStore;
  transport: AuthorityMcpTransportService;
  coordination: AuthorityClusterCoordinationService;
  cleanupDir: string;
};

const harnesses: Harness[] = [];

afterEach(async () => {
  while (harnesses.length > 0) {
    const harness = harnesses.pop()!;
    harness.coordination.dispose();
    harness.transport.dispose();
    await harness.node.stop();
    fs.rmSync(harness.cleanupDir, { recursive: true, force: true });
  }
});

async function createHarness(options: {
  namespace: string;
  nodeId: string;
  serviceGroup: string;
  seedPeers?: string[];
}): Promise<Harness> {
  const cleanupDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `authority-cluster-${options.nodeId}-`));
  const configPath = path.join(cleanupDir, "authority-mcp-services.json");
  const port = await getFreePort();
  const state = new AuthorityState();
  const eventStore = new EventStore();
  const bridge = new AuthorityToolCallBridge(state, eventStore);
  const transport = new AuthorityMcpTransportService(state, eventStore, bridge, {
    configPath,
    enableHealthPolling: false,
  });

  await transport.registerService({
    serviceId: `service:${options.nodeId}`,
    provider: "fixture",
    transport: "http",
    endpoint: `http://127.0.0.1:${port}/fixture`,
    enabled: true,
    source: "fixture",
    modules: ["remote"],
    orchestration: {
      serviceGroup: options.serviceGroup,
      templateId: `template:${options.serviceGroup}`,
      preferredNodes: [options.nodeId],
      regions: [options.nodeId.endsWith("a") ? "cn-east-1" : "cn-north-1"],
    },
    defaultAllowedDepartments: ["TECHNOLOGY"],
    defaultRequiredCapabilities: ["observe:*"],
  });

  const node = new ClusterNode({
    nodeId: options.nodeId,
    clusterId: options.namespace,
    name: options.nodeId,
    role: "gateway",
    host: "127.0.0.1",
    httpPort: port,
    capabilities: ["gateway", "cluster", "authority"],
    heartbeatIntervalMs: 100,
    nodeTtlMs: 400,
    backplane: new MemoryClusterBackplane(options.namespace),
    seedPeers: options.seedPeers,
  });
  await node.start();

  const coordination = new AuthorityClusterCoordinationService(state, eventStore, transport, {
    coordinationIntervalMs: 100,
    leaderLeaseTtlMs: 250,
    snapshotPublishIntervalMs: 150,
    staleSyncThresholdMs: 500,
  });
  await coordination.attach(node);

  const harness = {
    node,
    state,
    eventStore,
    transport,
    coordination,
    cleanupDir,
  };
  harnesses.push(harness);
  return harness;
}

describe("AuthorityClusterCoordinationService", () => {
  it("elects a leader, syncs follower state, recommends nodes by service group, and fails over", async () => {
    const namespace = `authority-cluster-${Date.now()}`;
    const nodeA = await createHarness({
      namespace,
      nodeId: "node-a",
      serviceGroup: "finance",
    });
    const nodeB = await createHarness({
      namespace,
      nodeId: "node-b",
      serviceGroup: "research",
      seedPeers: [`http://127.0.0.1:${nodeA.node.getLocalNode().httpPort}`],
    });

    await waitFor(() => {
      const snapshots = [nodeA.coordination.getSnapshot(), nodeB.coordination.getSnapshot()];
      return snapshots.every((snapshot) => snapshot.enabled && snapshot.leaderNodeId.length > 0) &&
        snapshots.some((snapshot) => snapshot.role === "leader") &&
        snapshots.some((snapshot) => snapshot.role === "follower");
    });

    const leader = nodeA.coordination.getSnapshot().role === "leader" ? nodeA : nodeB;
    const follower = leader === nodeA ? nodeB : nodeA;

    leader.state.governance.proposals.set("proposal:cluster-sync", "{\"status\":\"approved\"}");
    leader.state.audit.eventCursor = "authority.cluster:test-sync";
    leader.state.lastUpdate = Date.now();

    await waitFor(() =>
      follower.state.governance.proposals.get("proposal:cluster-sync") === "{\"status\":\"approved\"}" &&
      follower.coordination.getSnapshot().lastSyncSource === leader.node.getLocalNode().nodeId,
    );

    const recommendation = leader.coordination.recommendNode({
      serviceGroup: "research",
      preferredRegion: "cn-north-1",
    });
    expect(recommendation.recommendedNodeId).toBe("node-b");
    expect(recommendation.nodes[0].serviceGroups).toContain("research");

    const originalLeaderId = leader.node.getLocalNode().nodeId;
    await leader.coordination.detach();
    await leader.node.stop();

    await waitFor(() => {
      const snapshot = follower.coordination.getSnapshot();
      return snapshot.role === "leader" && snapshot.leaderNodeId === follower.node.getLocalNode().nodeId;
    }, 8_000);

    const failoverSnapshot = follower.coordination.getSnapshot();
    expect(failoverSnapshot.leaderNodeId).not.toBe(originalLeaderId);
    expect(failoverSnapshot.lastFailoverAt).toBeGreaterThan(0);
    expect(
      follower.eventStore.getAll().some((event) =>
        event.type === "authority.cluster.failover" || event.type === "authority.cluster.leader.elected"),
    ).toBe(true);
  });
});
