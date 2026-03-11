import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface AuthorityClusterMonitoringOptions {
  failOn?: "never" | "warning" | "critical";
  requireLeader?: boolean;
  expectedNodeCount?: number;
  maxWarnings?: number;
  maxStaleNodes?: number;
  maxLeaderMissingNodes?: number;
  expectedAlerts?: string[];
  forbiddenAlerts?: string[];
}

export interface AuthorityClusterMonitoringNodeReport {
  baseUrl: string;
  status: string;
  healthScore: number;
  alerts: string[];
  recommendedActions: string[];
  cluster: {
    enabled: boolean;
    localNodeId: string;
    leaderNodeId: string;
    role: string;
    syncStatus: string;
    activeNodes: number;
    degradedNodes: number;
    offlineNodes: number;
    lastSyncAt: number;
    lastFailoverAt: number;
  };
}

export interface AuthorityClusterMonitoringReport {
  generatedAt: string;
  status: "PASS" | "FAIL";
  checks: {
    clusterEnabled: boolean;
    leaderPresent: boolean;
    consistentLeader: boolean;
    expectedNodeCountMet: boolean;
    statusThresholdOk: boolean;
    warningNodesWithinBudget: boolean;
    staleNodesWithinBudget: boolean;
    leaderMissingWithinBudget: boolean;
    expectedAlertsObserved: boolean;
    forbiddenAlertsAbsent: boolean;
  };
  summary: {
    nodeCount: number;
    expectedNodeCount: number;
    leaderNodeId: string;
    warningNodes: number;
    criticalNodes: number;
    staleSyncNodes: number;
    leaderMissingNodes: number;
    observedAlerts: string[];
    recommendedActions: string[];
  };
  nodes: AuthorityClusterMonitoringNodeReport[];
}

interface CliOptions extends AuthorityClusterMonitoringOptions {
  baseUrls: string[];
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

function parseList(value?: string): string[] {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }
  return !["false", "0", "no"].includes(value.toLowerCase());
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptions(): CliOptions {
  const failOn = (readOption("fail-on", "critical") || "critical") as CliOptions["failOn"];
  const baseUrls = parseList(readOption("base-urls"));

  if (baseUrls.length === 0) {
    throw new Error("missing --base-urls");
  }

  return {
    baseUrls,
    failOn: ["never", "warning", "critical"].includes(failOn || "") ? failOn : "critical",
    requireLeader: parseBoolean(readOption("require-leader"), true),
    expectedNodeCount: parseOptionalNumber(readOption("expected-node-count")),
    maxWarnings: parseOptionalNumber(readOption("max-warnings")),
    maxStaleNodes: parseNumber(readOption("max-stale-nodes"), 0),
    maxLeaderMissingNodes: parseNumber(readOption("max-leader-missing-nodes"), 0),
    expectedAlerts: parseList(readOption("expect-alerts")),
    forbiddenAlerts: parseList(readOption("forbidden-alerts", readOption("forbid-alerts"))),
  };
}

async function requestJson(url: string): Promise<any> {
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status} ${response.statusText} ${JSON.stringify(body)}`);
  }
  return body;
}

function shouldFailForThreshold(
  warningNodes: number,
  criticalNodes: number,
  failOn: AuthorityClusterMonitoringOptions["failOn"],
): boolean {
  if (failOn === "warning") {
    return warningNodes > 0 || criticalNodes > 0;
  }
  if (failOn === "critical") {
    return criticalNodes > 0;
  }
  return false;
}

export async function runAuthorityClusterMonitoring(
  baseUrls: string[],
  options: AuthorityClusterMonitoringOptions = {},
): Promise<AuthorityClusterMonitoringReport> {
  const failOn = options.failOn || "critical";
  const requireLeader = options.requireLeader !== false;
  const expectedNodeCount = options.expectedNodeCount ?? baseUrls.length;
  const maxWarnings = options.maxWarnings ?? Number.POSITIVE_INFINITY;
  const maxStaleNodes = options.maxStaleNodes ?? 0;
  const maxLeaderMissingNodes = options.maxLeaderMissingNodes ?? 0;
  const expectedAlerts = options.expectedAlerts || [];
  const forbiddenAlerts = options.forbiddenAlerts || [];

  const nodes: AuthorityClusterMonitoringNodeReport[] = [];
  const leaderIds = new Set<string>();
  const observedAlerts = new Set<string>();
  const recommendedActions = new Set<string>();
  let warningNodes = 0;
  let criticalNodes = 0;
  let staleSyncNodes = 0;
  let leaderMissingNodes = 0;
  let clusterEnabled = true;

  for (const baseUrl of baseUrls) {
    const monitoring = await requestJson(`${baseUrl}/api/authority/monitoring`);
    const ops = await requestJson(`${baseUrl}/api/authority/ops`);
    const cluster = monitoring.cluster || ops.cluster || {};
    const alerts = Array.isArray(monitoring.alerts) ? monitoring.alerts : [];
    const actions = Array.isArray(ops.recommendedActions) ? ops.recommendedActions : [];

    clusterEnabled = clusterEnabled && cluster.enabled === true;
    if (monitoring.status === "warning") {
      warningNodes += 1;
    }
    if (monitoring.status === "critical") {
      criticalNodes += 1;
    }

    alerts.forEach((alert: string) => observedAlerts.add(alert));
    actions.forEach((action: string) => recommendedActions.add(action));

    if (cluster.leaderNodeId) {
      leaderIds.add(cluster.leaderNodeId);
    }

    const staleSync =
      cluster.syncStatus === "stale" || alerts.includes("authority_cluster_sync_stale");
    const leaderMissing =
      alerts.includes("authority_cluster_leader_missing") ||
      (cluster.enabled === true && !cluster.leaderNodeId && (cluster.activeNodes || 0) > 0);

    if (staleSync) {
      staleSyncNodes += 1;
    }
    if (leaderMissing) {
      leaderMissingNodes += 1;
    }

    nodes.push({
      baseUrl,
      status: monitoring.status || "unknown",
      healthScore: typeof monitoring.healthScore === "number" ? monitoring.healthScore : 0,
      alerts,
      recommendedActions: actions,
      cluster: {
        enabled: cluster.enabled === true,
        localNodeId: cluster.localNodeId || "",
        leaderNodeId: cluster.leaderNodeId || "",
        role: cluster.role || "standalone",
        syncStatus: cluster.syncStatus || "idle",
        activeNodes: cluster.activeNodes || cluster.activeNodeCount || 0,
        degradedNodes: cluster.degradedNodes || cluster.degradedNodeCount || 0,
        offlineNodes: cluster.offlineNodes || cluster.offlineNodeCount || 0,
        lastSyncAt: cluster.lastSyncAt || 0,
        lastFailoverAt: cluster.lastFailoverAt || 0,
      },
    });
  }

  const leaderNodeId = leaderIds.size === 1 ? [...leaderIds][0] : "";
  const checks = {
    clusterEnabled,
    leaderPresent: !requireLeader || leaderIds.size > 0,
    consistentLeader: leaderIds.size <= 1 && (!requireLeader || leaderNodeId.length > 0),
    expectedNodeCountMet: nodes.length >= expectedNodeCount,
    statusThresholdOk: !shouldFailForThreshold(warningNodes, criticalNodes, failOn),
    warningNodesWithinBudget: warningNodes <= maxWarnings,
    staleNodesWithinBudget: staleSyncNodes <= maxStaleNodes,
    leaderMissingWithinBudget: leaderMissingNodes <= maxLeaderMissingNodes,
    expectedAlertsObserved: expectedAlerts.every((alert) => observedAlerts.has(alert)),
    forbiddenAlertsAbsent: forbiddenAlerts.every((alert) => !observedAlerts.has(alert)),
  };

  const status: "PASS" | "FAIL" = Object.values(checks).every(Boolean) ? "PASS" : "FAIL";

  return {
    generatedAt: new Date().toISOString(),
    status,
    checks,
    summary: {
      nodeCount: nodes.length,
      expectedNodeCount,
      leaderNodeId,
      warningNodes,
      criticalNodes,
      staleSyncNodes,
      leaderMissingNodes,
      observedAlerts: [...observedAlerts].sort(),
      recommendedActions: [...recommendedActions].sort(),
    },
    nodes,
  };
}

async function main(): Promise<void> {
  const options = parseOptions();
  const report = await runAuthorityClusterMonitoring(options.baseUrls, options);
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const outputPath = path.join(process.cwd(), "reports", `authority-cluster-monitoring-${ts}.json`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ ...report, outputPath }, null, 2));
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
