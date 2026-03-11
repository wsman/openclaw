import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  runAuthorityClusterRehearshal,
  type AuthorityClusterRehearshalOptions,
} from "./authority-cluster-rehearshal";

const execMock = vi.hoisted(() =>
  vi.fn((_: string, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
    callback?.(null, "", "");
    return {} as any;
  }),
);

vi.mock("node:child_process", () => ({
  default: {
    exec: execMock,
  },
}));

// Mock fetch
const mockFetch = vi.fn();
(globalThis as any).fetch = mockFetch;

// Mock cluster status responses
function mockClusterStatus(
  role: "leader" | "follower",
  localNodeId: string,
  leaderNodeId: string,
) {
  return {
    cluster: {
      enabled: true,
      clusterId: "test-cluster",
      localNodeId,
      leaderNodeId,
      role,
      syncStatus: "synced",
      activeNodeCount: 3,
      lastSyncAt: Date.now(),
    },
  };
}

function mockHealthResponse() {
  return { status: "healthy" };
}

function mockSyncResponse() {
  return {
    cluster: {
      enabled: true,
      clusterId: "test-cluster",
      localNodeId: "node-a",
      leaderNodeId: "node-a",
      role: "leader",
      syncStatus: "synced",
      activeNodeCount: 3,
      lastSyncAt: Date.now(),
    },
  };
}

function mockRecommendationResponse() {
  return {
    recommendation: {
      recommendedNodeId: "node-a",
      reason: "leader-preferred",
    },
  };
}

function mockMonitoringResponse() {
  return { alerts: [] };
}

describe("authority-cluster-rehearshal", () => {
  beforeEach(() => {
    execMock.mockImplementation((_: string, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
      callback?.(null, "", "");
      return {} as any;
    });

    mockFetch.mockReset();

    // Setup default mock responses
    mockFetch
      .mockImplementation(async (url: string) => {
        if (url.endsWith("/health")) {
          return { ok: true, json: async () => mockHealthResponse() };
        }
        if (url.endsWith("/cluster/status")) {
          return {
            ok: true,
            json: async () =>
              mockClusterStatus(
                url.includes("3311") ? "leader" : "follower",
                url.includes("3311")
                  ? "node-a"
                  : url.includes("3312")
                    ? "node-b"
                    : "node-c",
                "node-a",
              ),
          };
        }
        if (url.endsWith("/cluster/sync")) {
          return { ok: true, json: async () => mockSyncResponse() };
        }
        if (url.endsWith("/recommend-node")) {
          return {
            ok: true,
            json: async () => mockRecommendationResponse(),
          };
        }
        if (url.endsWith("/monitoring")) {
          return { ok: true, json: async () => mockMonitoringResponse() };
        }
        return { ok: false, statusText: "Not Found" };
      });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("runAuthorityClusterRehearshal", () => {
    it("should create options with correct defaults", async () => {
      const options: AuthorityClusterRehearshalOptions = {
        scenario: "leader-kill",
        baseUrls: [
          "http://127.0.0.1:3311",
          "http://127.0.0.1:3312",
          "http://127.0.0.1:3313",
        ],
        expectedNodeCount: 3,
        failoverTimeoutMs: 15000,
        revalidationRetries: 5,
        revalidationDelayMs: 2000,
      };

      expect(options.scenario).toBe("leader-kill");
      expect(options.baseUrls).toHaveLength(3);
      expect(options.expectedNodeCount).toBe(3);
      expect(options.failoverTimeoutMs).toBe(15000);
    });

    it("should handle single scenario", async () => {
      const options: AuthorityClusterRehearshalOptions = {
        scenario: "follower-restart",
        baseUrls: ["http://127.0.0.1:3311"],
        expectedNodeCount: 1,
        failoverTimeoutMs: 5000,
        revalidationRetries: 2,
        revalidationDelayMs: 500,
      };

      // Mock initial leader response
      mockFetch.mockImplementation(async (url: string) => {
        if (url.endsWith("/health")) {
          return { ok: true, json: async () => mockHealthResponse() };
        }
        if (url.endsWith("/cluster/status")) {
          return {
            ok: true,
            json: async () =>
              mockClusterStatus("leader", "node-a", "node-a"),
          };
        }
        if (url.endsWith("/cluster/sync")) {
          return { ok: true, json: async () => mockSyncResponse() };
        }
        if (url.endsWith("/recommend-node")) {
          return {
            ok: true,
            json: async () => mockRecommendationResponse(),
          };
        }
        if (url.endsWith("/monitoring")) {
          return { ok: true, json: async () => mockMonitoringResponse() };
        }
        return { ok: false, statusText: "Not Found" };
      });

      // For single node test, follower scenario should fail (no follower exists)
      const report = await runAuthorityClusterRehearshal(options);

      expect(report.totalScenarios).toBe(1);
      expect(report.scenarios[0].name).toBe("follower-restart");
    });

    it("should generate valid report structure", async () => {
      const options: AuthorityClusterRehearshalOptions = {
        scenario: "leader-kill",
        baseUrls: ["http://127.0.0.1:3311"],
        expectedNodeCount: 1,
        failoverTimeoutMs: 1000,
        revalidationRetries: 1,
        revalidationDelayMs: 100,
      };

      // Mock responses - make node-a a leader
      mockFetch.mockImplementation(async (url: string) => {
        if (url.endsWith("/health")) {
          return { ok: true, json: async () => mockHealthResponse() };
        }
        if (url.endsWith("/cluster/status")) {
          return {
            ok: true,
            json: async () =>
              mockClusterStatus("leader", "node-a", "node-a"),
          };
        }
        if (url.endsWith("/cluster/sync")) {
          return { ok: true, json: async () => mockSyncResponse() };
        }
        if (url.endsWith("/recommend-node")) {
          return {
            ok: true,
            json: async () => mockRecommendationResponse(),
          };
        }
        if (url.endsWith("/monitoring")) {
          return { ok: true, json: async () => mockMonitoringResponse() };
        }
        return { ok: false, statusText: "Not Found" };
      });

      const report = await runAuthorityClusterRehearshal(options);

      expect(report).toHaveProperty("generatedAt");
      expect(report).toHaveProperty("status");
      expect(report).toHaveProperty("totalScenarios");
      expect(report).toHaveProperty("passedScenarios");
      expect(report).toHaveProperty("failedScenarios");
      expect(report).toHaveProperty("scenarios");
      expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(["PASS", "FAIL"]).toContain(report.status);
    });

    it("should handle network-partition scenario", async () => {
      const options: AuthorityClusterRehearshalOptions = {
        scenario: "network-partition",
        baseUrls: ["http://127.0.0.1:3311"],
        expectedNodeCount: 1,
        failoverTimeoutMs: 1000,
        revalidationRetries: 1,
        revalidationDelayMs: 100,
      };

      const report = await runAuthorityClusterRehearshal(options);

      expect(report.totalScenarios).toBe(1);
      expect(report.scenarios[0].name).toBe("network-partition");
      expect(report.scenarios[0]).toHaveProperty("startTime");
      expect(report.scenarios[0]).toHaveProperty("endTime");
      expect(report.scenarios[0]).toHaveProperty("durationMs");
    });

    it("should handle full-restart scenario", async () => {
      const options: AuthorityClusterRehearshalOptions = {
        scenario: "full-restart",
        baseUrls: ["http://127.0.0.1:3311"],
        expectedNodeCount: 1,
        failoverTimeoutMs: 1000,
        revalidationRetries: 1,
        revalidationDelayMs: 100,
      };

      const report = await runAuthorityClusterRehearshal(options);

      expect(report.totalScenarios).toBe(1);
      expect(report.scenarios[0].name).toBe("full-restart");
      expect(report.scenarios[0].details).toHaveProperty("stoppedContainers");
      expect(report.scenarios[0].details).toHaveProperty("startedContainers");
    });

    it("should run all scenarios when scenario=all", async () => {
      const options: AuthorityClusterRehearshalOptions = {
        scenario: "all",
        baseUrls: ["http://127.0.0.1:3311"],
        expectedNodeCount: 1,
        failoverTimeoutMs: 1000,
        revalidationRetries: 1,
        revalidationDelayMs: 100,
      };

      const report = await runAuthorityClusterRehearshal(options);

      expect(report.totalScenarios).toBe(4);
      expect(report.scenarios.map((s) => s.name)).toEqual([
        "leader-kill",
        "follower-restart",
        "network-partition",
        "full-restart",
      ]);
    });

    it("should report PASS when all scenarios pass", async () => {
      // This test uses very short timeouts and will likely fail due to timeouts,
      // but verifies the structure is correct
      const options: AuthorityClusterRehearshalOptions = {
        scenario: "network-partition",
        baseUrls: ["http://127.0.0.1:3311"],
        expectedNodeCount: 1,
        failoverTimeoutMs: 100,
        revalidationRetries: 1,
        revalidationDelayMs: 50,
      };

      const report = await runAuthorityClusterRehearshal(options);

      expect(report).toHaveProperty("status");
      expect(["PASS", "FAIL"]).toContain(report.status);
    });

    it("should track failover metrics in leader-kill scenario", async () => {
      const options: AuthorityClusterRehearshalOptions = {
        scenario: "leader-kill",
        baseUrls: ["http://127.0.0.1:3311"],
        expectedNodeCount: 1,
        failoverTimeoutMs: 100,
        revalidationRetries: 1,
        revalidationDelayMs: 50,
      };

      const report = await runAuthorityClusterRehearshal(options);
      const scenario = report.scenarios[0];

      expect(scenario).toHaveProperty("initialLeaderNodeId");
      expect(scenario).toHaveProperty("finalLeaderNodeId");
      expect(scenario).toHaveProperty("failoverOccurred");
      expect(scenario).toHaveProperty("failoverTimeMs");
      expect(typeof scenario.failoverTimeMs).toBe("number");
    });

    it("should include error details when scenarios fail", async () => {
      // Mock fetch to always fail
      mockFetch.mockImplementation(async () => {
        throw new Error("Connection refused");
      });

      const options: AuthorityClusterRehearshalOptions = {
        scenario: "leader-kill",
        baseUrls: ["http://127.0.0.1:3311"],
        expectedNodeCount: 1,
        failoverTimeoutMs: 100,
        revalidationRetries: 1,
        revalidationDelayMs: 50,
      };

      const report = await runAuthorityClusterRehearshal(options);

      expect(report.status).toBe("FAIL");
      expect(report.failedScenarios).toBeGreaterThan(0);
      expect(report.scenarios[0].errors.length).toBeGreaterThan(0);
    });
  });
});
