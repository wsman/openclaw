import { describe, expect, it } from "vitest";
import { buildServerOptionsFromEnv } from "./serverProcessOptions";

describe("buildServerOptionsFromEnv", () => {
  it("reads cluster and discovery toggles plus cluster metadata from env", () => {
    const options = buildServerOptionsFromEnv({
      CLUSTER_ENABLED: "true",
      DISCOVERY_ENABLED: "false",
      CLUSTER_ROLE: "authority",
      CLUSTER_NODE_VERSION: "2026.03",
      CLUSTER_CAPABILITIES: "gateway, authority ,mcp",
      CLUSTER_HEARTBEAT_INTERVAL_MS: "1200",
      CLUSTER_NODE_TTL_MS: "3600",
      CLUSTER_PEER_REQUEST_TIMEOUT_MS: "1800",
      CLUSTER_WS_PORT: "4514",
      CLUSTER_RPC_PORT: "5514",
      CLUSTER_REGION: "cn-east-1",
    });

    expect(options.cluster?.enabled).toBe(true);
    expect(options.discovery?.enabled).toBe(false);
    expect(options.cluster?.role).toBe("authority");
    expect(options.cluster?.version).toBe("2026.03");
    expect(options.cluster?.capabilities).toEqual(["gateway", "authority", "mcp"]);
    expect(options.cluster?.heartbeatIntervalMs).toBe(1200);
    expect(options.cluster?.nodeTtlMs).toBe(3600);
    expect(options.cluster?.peerRequestTimeoutMs).toBe(1800);
    expect(options.cluster?.wsPort).toBe(4514);
    expect(options.cluster?.rpcPort).toBe(5514);
    expect((options.cluster as any)?.metadata).toEqual({ region: "cn-east-1" });
  });

  it("falls back to enabled defaults and ignores invalid numeric values", () => {
    const options = buildServerOptionsFromEnv({
      CLUSTER_ENABLED: "",
      DISCOVERY_ENABLED: "",
      CLUSTER_HEARTBEAT_INTERVAL_MS: "abc",
      CLUSTER_CAPABILITIES: " , ",
    });

    expect(options.cluster?.enabled).toBe(true);
    expect(options.discovery?.enabled).toBe(true);
    expect(options.cluster?.heartbeatIntervalMs).toBeUndefined();
    expect(options.cluster?.capabilities).toBeUndefined();
    expect((options.cluster as any)?.metadata).toBeUndefined();
  });
});
