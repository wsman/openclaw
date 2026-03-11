import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface AuthorityClusterValidationOptions {
  serviceGroup?: string;
  preferredRegion?: string;
  requireLeader?: boolean;
  expectedNodeCount?: number;
  maxSyncLagMs?: number;
}

export interface AuthorityClusterNodeValidation {
  baseUrl: string;
  healthOk: boolean;
  leaderNodeId: string;
  localNodeId: string;
  role: string;
  syncStatus: string;
  activeNodeCount: number;
  recommendationNodeId: string;
  alerts: string[];
}

export interface AuthorityClusterValidationReport {
  generatedAt: string;
  status: "PASS" | "FAIL";
  clusterId: string;
  leaderNodeId: string;
  leaderCount: number;
  expectedNodeCount: number;
  checks: {
    healthOk: boolean;
    clusterEnabled: boolean;
    consistentClusterId: boolean;
    singleLeader: boolean;
    expectedNodeCountMet: boolean;
    recommendationsOk: boolean;
    noStaleSync: boolean;
  };
  nodes: AuthorityClusterNodeValidation[];
}

function readOption(name: string, fallback?: string): string | undefined {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) {
    return direct.slice(name.length + 3);
  }
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && index + 1 < process.argv.length) {
    return process.argv[index + 1];
  }
  return fallback;
}

async function requestJson(url: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status} ${response.statusText} ${JSON.stringify(body)}`);
  }
  return body;
}

export async function runAuthorityClusterValidation(
  baseUrls: string[],
  options: AuthorityClusterValidationOptions = {},
): Promise<AuthorityClusterValidationReport> {
  const expectedNodeCount = options.expectedNodeCount ?? baseUrls.length;
  const maxSyncLagMs = options.maxSyncLagMs ?? 1_000;

  const nodes: AuthorityClusterNodeValidation[] = [];
  const clusterIds = new Set<string>();
  const leaderIds = new Set<string>();
  let clusterEnabled = true;
  let healthOk = true;
  let recommendationsOk = true;
  let noStaleSync = true;

  for (const baseUrl of baseUrls) {
    const health = await requestJson(`${baseUrl}/health`);
    const status = await requestJson(`${baseUrl}/api/authority/cluster/status`);
    const sync = await requestJson(`${baseUrl}/api/authority/cluster/sync`, { method: "POST" });
    const recommendation = await requestJson(`${baseUrl}/api/authority/cluster/recommend-node`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceGroup: options.serviceGroup,
        preferredRegion: options.preferredRegion,
        requireLeader: options.requireLeader !== false,
      }),
    });
    const monitoring = await requestJson(`${baseUrl}/api/authority/monitoring`);

    const cluster = status.cluster || sync.cluster || {};
    clusterEnabled = clusterEnabled && cluster.enabled === true;
    clusterIds.add(cluster.clusterId || "");
    if (cluster.leaderNodeId) {
      leaderIds.add(cluster.leaderNodeId);
    }
    healthOk = healthOk && health.status === "healthy";
    recommendationsOk = recommendationsOk && Boolean(recommendation.recommendation?.recommendedNodeId);
    const staleAlert = monitoring.alerts?.includes("authority_cluster_sync_stale");
    const staleStatus = cluster.syncStatus === "stale";
    const lagExceeded =
      typeof cluster.lastSyncAt === "number" &&
      cluster.lastSyncAt > 0 &&
      Date.now() - cluster.lastSyncAt > maxSyncLagMs &&
      cluster.role !== "leader";
    noStaleSync = noStaleSync && !staleAlert && !staleStatus && !lagExceeded;

    nodes.push({
      baseUrl,
      healthOk: health.status === "healthy",
      leaderNodeId: cluster.leaderNodeId || "",
      localNodeId: cluster.localNodeId || "",
      role: cluster.role || "standalone",
      syncStatus: cluster.syncStatus || "idle",
      activeNodeCount: cluster.activeNodeCount || 0,
      recommendationNodeId: recommendation.recommendation?.recommendedNodeId || "",
      alerts: Array.isArray(monitoring.alerts) ? monitoring.alerts : [],
    });
  }

  const clusterId = clusterIds.size === 1 ? [...clusterIds][0] : "";
  const leaderNodeId = leaderIds.size === 1 ? [...leaderIds][0] : "";
  const leaderCount = nodes.filter((node) => node.role === "leader").length;
  const checks = {
    healthOk,
    clusterEnabled,
    consistentClusterId: clusterIds.size === 1 && clusterId.length > 0,
    singleLeader: leaderIds.size === 1 && leaderCount === 1 && leaderNodeId.length > 0,
    expectedNodeCountMet: nodes.length >= expectedNodeCount,
    recommendationsOk,
    noStaleSync,
  };

  return {
    generatedAt: new Date().toISOString(),
    status: Object.values(checks).every(Boolean) ? "PASS" : "FAIL",
    clusterId,
    leaderNodeId,
    leaderCount,
    expectedNodeCount,
    checks,
    nodes,
  };
}

function parseOptions(): { baseUrls: string[]; options: AuthorityClusterValidationOptions } {
  const baseUrls = (readOption("base-urls", "http://127.0.0.1:3311,http://127.0.0.1:3312,http://127.0.0.1:3313") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    baseUrls,
    options: {
      serviceGroup: readOption("service-group"),
      preferredRegion: readOption("preferred-region"),
      requireLeader: readOption("require-leader", "true") !== "false",
      expectedNodeCount: Number(readOption("expected-node-count", String(baseUrls.length))),
      maxSyncLagMs: Number(readOption("max-sync-lag-ms", "1000")),
    },
  };
}

async function main(): Promise<void> {
  const { baseUrls, options } = parseOptions();
  const report = await runAuthorityClusterValidation(baseUrls, options);
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const outputPath = path.join(process.cwd(), "reports", `authority-cluster-validation-${ts}.json`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ reportPath: outputPath, ...report }, null, 2));
  if (report.status !== "PASS") {
    process.exitCode = 1;
  }
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, null, 2));
    process.exitCode = 1;
  });
}
