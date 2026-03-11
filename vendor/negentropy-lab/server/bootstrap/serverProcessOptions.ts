import { NegentropyServerOptions } from "./createNegentropyServer";

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim().length === 0) {
    return fallback;
  }
  return !["0", "false", "no", "off"].includes(value.trim().toLowerCase());
}

function readNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim().length === 0) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readCsv(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }
  const values = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  return values.length > 0 ? values : undefined;
}

export function buildServerOptionsFromEnv(env: NodeJS.ProcessEnv = process.env): NegentropyServerOptions {
  const clusterEnabled = readBoolean(env.CLUSTER_ENABLED, true);
  const discoveryEnabled = readBoolean(env.DISCOVERY_ENABLED, true);
  const region = env.CLUSTER_REGION?.trim();

  return {
    cluster: {
      enabled: clusterEnabled,
      role: env.CLUSTER_ROLE || undefined,
      version: env.CLUSTER_NODE_VERSION || undefined,
      capabilities: readCsv(env.CLUSTER_CAPABILITIES),
      heartbeatIntervalMs: readNumber(env.CLUSTER_HEARTBEAT_INTERVAL_MS),
      nodeTtlMs: readNumber(env.CLUSTER_NODE_TTL_MS),
      peerRequestTimeoutMs: readNumber(env.CLUSTER_PEER_REQUEST_TIMEOUT_MS),
      wsPort: readNumber(env.CLUSTER_WS_PORT),
      rpcPort: readNumber(env.CLUSTER_RPC_PORT),
      metadata: region ? { region } : undefined,
    },
    discovery: {
      enabled: discoveryEnabled,
    },
  };
}
