import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { runAuthorityClusterMonitoring } from "./authority-cluster-monitoring";

interface StubServer {
  close(): Promise<void>;
  baseUrl: string;
}

async function createMonitoringStub(options: {
  localNodeId: string;
  leaderNodeId: string;
  role: "leader" | "follower";
  status?: "healthy" | "warning" | "critical";
  syncStatus?: "leader" | "follower" | "stale";
  alerts?: string[];
  recommendedActions?: string[];
}): Promise<StubServer> {
  const server = http.createServer((req, res) => {
    const payload = (() => {
      switch (req.url) {
        case "/api/authority/monitoring":
          return {
            status: options.status || "healthy",
            healthScore: options.status === "critical" ? 0.2 : options.status === "warning" ? 0.6 : 0.95,
            alerts: options.alerts || [],
            cluster: {
              enabled: true,
              localNodeId: options.localNodeId,
              leaderNodeId: options.leaderNodeId,
              role: options.role,
              syncStatus: options.syncStatus || options.role,
              activeNodes: 3,
              degradedNodes: 0,
              offlineNodes: 0,
              lastSyncAt: Date.now(),
              lastFailoverAt: 0,
            },
          };
        case "/api/authority/ops":
          return {
            status: options.status || "healthy",
            alerts: options.alerts || [],
            recommendedActions: options.recommendedActions || [],
            cluster: {
              enabled: true,
              localNodeId: options.localNodeId,
              leaderNodeId: options.leaderNodeId,
              role: options.role,
              syncStatus: options.syncStatus || options.role,
              activeNodes: 3,
              degradedNodes: 0,
              offlineNodes: 0,
              lastSyncAt: Date.now(),
              lastFailoverAt: 0,
            },
          };
        default:
          return { ok: true };
      }
    })();

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    },
  };
}

const servers: StubServer[] = [];

afterEach(async () => {
  while (servers.length > 0) {
    await servers.pop()!.close();
  }
});

describe("runAuthorityClusterMonitoring", () => {
  it("passes for a healthy cluster with a consistent leader", async () => {
    servers.push(
      await createMonitoringStub({ localNodeId: "node-a", leaderNodeId: "node-a", role: "leader" }),
      await createMonitoringStub({ localNodeId: "node-b", leaderNodeId: "node-a", role: "follower" }),
      await createMonitoringStub({ localNodeId: "node-c", leaderNodeId: "node-a", role: "follower" }),
    );

    const report = await runAuthorityClusterMonitoring(servers.map((server) => server.baseUrl), {
      expectedNodeCount: 3,
      maxWarnings: 0,
    });

    expect(report.status).toBe("PASS");
    expect(report.summary.leaderNodeId).toBe("node-a");
    expect(report.summary.expectedNodeCount).toBe(3);
    expect(report.summary.warningNodes).toBe(0);
    expect(report.summary.criticalNodes).toBe(0);
    expect(report.checks.expectedNodeCountMet).toBe(true);
    expect(report.checks.warningNodesWithinBudget).toBe(true);
    expect(report.checks.expectedAlertsObserved).toBe(true);
  });

  it("fails when warning status breaches the configured threshold", async () => {
    servers.push(
      await createMonitoringStub({
        localNodeId: "node-a",
        leaderNodeId: "node-a",
        role: "leader",
        status: "warning",
        syncStatus: "stale",
        alerts: ["authority_cluster_sync_stale"],
        recommendedActions: ["review_authority_cluster_sync"],
      }),
      await createMonitoringStub({ localNodeId: "node-b", leaderNodeId: "node-a", role: "follower" }),
    );

    const report = await runAuthorityClusterMonitoring(servers.map((server) => server.baseUrl), {
      failOn: "never",
      maxWarnings: 0,
    });

    expect(report.status).toBe("FAIL");
    expect(report.summary.warningNodes).toBe(1);
    expect(report.checks.statusThresholdOk).toBe(true);
    expect(report.checks.warningNodesWithinBudget).toBe(false);
    expect(report.checks.staleNodesWithinBudget).toBe(false);
  });

  it("fails when the observed node count is below the expected cluster size", async () => {
    servers.push(
      await createMonitoringStub({ localNodeId: "node-a", leaderNodeId: "node-a", role: "leader" }),
      await createMonitoringStub({ localNodeId: "node-b", leaderNodeId: "node-a", role: "follower" }),
    );

    const report = await runAuthorityClusterMonitoring(servers.map((server) => server.baseUrl), {
      expectedNodeCount: 3,
    });

    expect(report.status).toBe("FAIL");
    expect(report.summary.nodeCount).toBe(2);
    expect(report.checks.expectedNodeCountMet).toBe(false);
  });

  it("supports alert calibration by requiring observed alerts", async () => {
    servers.push(
      await createMonitoringStub({
        localNodeId: "node-a",
        leaderNodeId: "",
        role: "follower",
        status: "warning",
        syncStatus: "stale",
        alerts: ["authority_cluster_sync_stale", "authority_cluster_leader_missing"],
        recommendedActions: ["inspect_authority_cluster_failover", "review_authority_cluster_sync"],
      }),
      await createMonitoringStub({
        localNodeId: "node-b",
        leaderNodeId: "",
        role: "follower",
        status: "warning",
        syncStatus: "stale",
        alerts: ["authority_cluster_sync_stale", "authority_cluster_leader_missing"],
      }),
    );

    const report = await runAuthorityClusterMonitoring(servers.map((server) => server.baseUrl), {
      failOn: "never",
      requireLeader: false,
      maxStaleNodes: 2,
      maxLeaderMissingNodes: 2,
      expectedAlerts: ["authority_cluster_sync_stale", "authority_cluster_leader_missing"],
    });

    expect(report.status).toBe("PASS");
    expect(report.checks.expectedAlertsObserved).toBe(true);
    expect(report.summary.observedAlerts).toContain("authority_cluster_sync_stale");
    expect(report.summary.recommendedActions).toContain("inspect_authority_cluster_failover");
  });

  it("fails when a forbidden alert is observed", async () => {
    servers.push(
      await createMonitoringStub({
        localNodeId: "node-a",
        leaderNodeId: "node-a",
        role: "leader",
        alerts: ["authority_cluster_leader_missing"],
      }),
    );

    const report = await runAuthorityClusterMonitoring(servers.map((server) => server.baseUrl), {
      forbiddenAlerts: ["authority_cluster_leader_missing"],
    });

    expect(report.status).toBe("FAIL");
    expect(report.checks.forbiddenAlertsAbsent).toBe(false);
  });
});
