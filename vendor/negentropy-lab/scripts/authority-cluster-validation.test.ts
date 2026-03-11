import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { runAuthorityClusterValidation } from "./authority-cluster-validation";

interface StubServer {
  close(): Promise<void>;
  baseUrl: string;
}

async function createClusterStub(options: {
  localNodeId: string;
  leaderNodeId: string;
  role: "leader" | "follower";
  clusterId?: string;
  syncStatus?: "leader" | "follower" | "stale";
  alerts?: string[];
}): Promise<StubServer> {
  const server = http.createServer((req, res) => {
    const payload = (() => {
      switch (req.url) {
        case "/health":
          return { status: "healthy" };
        case "/api/authority/cluster/status":
        case "/api/authority/cluster/sync":
          return {
            ok: true,
            cluster: {
              enabled: true,
              clusterId: options.clusterId || "authority-staging",
              localNodeId: options.localNodeId,
              leaderNodeId: options.leaderNodeId,
              role: options.role,
              syncStatus: options.syncStatus || options.role,
              activeNodeCount: 3,
              lastSyncAt: Date.now(),
            },
          };
        case "/api/authority/cluster/recommend-node":
          return {
            ok: true,
            recommendation: {
              recommendedNodeId: options.leaderNodeId,
            },
          };
        case "/api/authority/monitoring":
          return {
            status: "healthy",
            alerts: options.alerts || [],
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

describe("runAuthorityClusterValidation", () => {
  it("passes when all nodes agree on the same leader", async () => {
    servers.push(
      await createClusterStub({ localNodeId: "node-a", leaderNodeId: "node-a", role: "leader" }),
      await createClusterStub({ localNodeId: "node-b", leaderNodeId: "node-a", role: "follower" }),
      await createClusterStub({ localNodeId: "node-c", leaderNodeId: "node-a", role: "follower" }),
    );

    const report = await runAuthorityClusterValidation(servers.map((server) => server.baseUrl), {
      expectedNodeCount: 3,
      requireLeader: true,
    });

    expect(report.status).toBe("PASS");
    expect(report.leaderNodeId).toBe("node-a");
    expect(report.leaderCount).toBe(1);
    expect(report.checks.singleLeader).toBe(true);
    expect(report.checks.noStaleSync).toBe(true);
  });

  it("fails when cluster alerts indicate stale sync or missing leader", async () => {
    servers.push(
      await createClusterStub({
        localNodeId: "node-a",
        leaderNodeId: "",
        role: "follower",
        syncStatus: "stale",
        alerts: ["authority_cluster_sync_stale", "authority_cluster_leader_missing"],
      }),
      await createClusterStub({
        localNodeId: "node-b",
        leaderNodeId: "",
        role: "follower",
        syncStatus: "stale",
        alerts: ["authority_cluster_sync_stale", "authority_cluster_leader_missing"],
      }),
    );

    const report = await runAuthorityClusterValidation(servers.map((server) => server.baseUrl), {
      expectedNodeCount: 2,
      requireLeader: true,
    });

    expect(report.status).toBe("FAIL");
    expect(report.checks.singleLeader).toBe(false);
    expect(report.checks.noStaleSync).toBe(false);
  });
});
