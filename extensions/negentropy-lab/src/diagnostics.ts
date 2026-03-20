import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DecisionMode } from "./decision-bridge.js";
import {
  BUSINESS_ARTIFACT_ABSORB_CONTRACT_SNAPSHOT_VERSION,
  HOST_MEMORY_SUMMARY_CONTRACT_SNAPSHOT_VERSION,
  MEMORY_BUSINESS_PROJECTION_CONTRACT_SNAPSHOT_VERSION,
  SKILL_CANDIDATE_ABSORB_CONTRACT_SNAPSHOT_VERSION,
} from "./memory-business-contracts.snapshot.js";

type JsonRecord = Record<string, unknown>;

export type ReachabilityDiagnostic = {
  reachable: boolean | null;
  checkedUrl: string | null;
  detail: string;
};

export type RepoLocalDiagnosticsContext = {
  diagnosticsBaselineVersion: string | null;
  consumerBaselineVersion: string | null;
  contractSnapshotVersion: string | null;
  workflowContractSnapshotVersion: string | null;
  hostDiagnosticsSurfaceVersion: string | null;
  hostMemorySummaryContractVersion: string | null;
  businessArtifactAbsorbContractVersion: string | null;
  skillCandidateAbsorbContractVersion: string | null;
  memoryBusinessProjectionContractVersion: string | null;
  minimalVendorSnapshotVersion: {
    allowlistVersion: string | null;
    driftBaselineVersion: string | null;
  };
  discipline: {
    sourceRoot: string | null;
    vendorRoot: string | null;
    extensionRoot: string | null;
  };
  sourceRoot: {
    path: string | null;
    reachable: boolean | null;
  };
};

export type HostFacingDiagnostics = {
  surface: "host-facing";
  upstreamReachable: {
    sourceRoot: ReachabilityDiagnostic;
    decisionApi: ReachabilityDiagnostic;
    workflowApi: ReachabilityDiagnostic | null;
  };
  extensionMode: DecisionMode;
  failOpenOrClosed: "fail-open" | "fail-closed";
  rollbackSwitchEnabled: boolean;
  workflowBridge: {
    workflowEnabled: boolean;
    orchestrationApiBaseUrl: string;
    autoDispatchSubagents: boolean;
  };
  consumerBaselineVersion: string | null;
  contractSnapshotVersion: string | null;
  workflowContractSnapshotVersion: string | null;
  hostDiagnosticsSurfaceVersion: string | null;
  hostMemorySummaryContractVersion: string | null;
  businessArtifactAbsorbContractVersion: string | null;
  skillCandidateAbsorbContractVersion: string | null;
  memoryBusinessProjectionContractVersion: string | null;
  minimalVendorSnapshotVersion: {
    allowlistVersion: string | null;
    driftBaselineVersion: string | null;
  };
  discipline: {
    sourceRoot: string | null;
    vendorRoot: string | null;
    extensionRoot: string | null;
  };
  diagnosticsBaselineVersion: string | null;
};

function repoRootFromHere(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..", "..");
}

async function readJsonIfExists(filePath: string): Promise<JsonRecord | null> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as JsonRecord;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function readConsumerAnchorValue(baseline: JsonRecord | null, consumerKey: string): string | null {
  const extension = baseline?.extension;
  if (!extension || typeof extension !== "object") {
    return null;
  }

  const consumers = (extension as JsonRecord).consumers;
  if (!consumers || typeof consumers !== "object") {
    return null;
  }

  const consumer = (consumers as JsonRecord)[consumerKey];
  if (!consumer || typeof consumer !== "object") {
    return null;
  }

  const version = (consumer as JsonRecord).version;
  return typeof version === "string" ? version : null;
}

function resolveRepoPath(repoRoot: string, value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value);
}

async function pathExists(targetPath: string | null): Promise<boolean> {
  if (!targetPath) {
    return false;
  }
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function loadRepoLocalDiagnosticsContext(): Promise<RepoLocalDiagnosticsContext> {
  const repoRoot = repoRootFromHere();
  const [baselineFile, stackLocal] = await Promise.all([
    readJsonIfExists(path.join(repoRoot, "custom", "negentropy-baselines.json")),
    readJsonIfExists(path.join(repoRoot, "custom", "stack.local.json")),
  ]);

  const seamBaseline = (baselineFile?.seam as JsonRecord | undefined) ?? null;
  const diagnosticsBaseline = (baselineFile?.diagnostics as JsonRecord | undefined) ?? null;
  const consumerBaseline = (baselineFile?.extensionConsumer as JsonRecord | undefined) ?? null;
  const vendor = (baselineFile?.vendor as JsonRecord | undefined) ?? null;
  const vendorAllowlist = (vendor?.allowlist as JsonRecord | undefined) ?? null;
  const vendorDriftBaseline = (vendor?.driftBaseline as JsonRecord | undefined) ?? null;

  const mergedStack = {
    negentropy: {
      ...((stackLocal?.negentropy as JsonRecord | undefined) ?? {}),
    },
  };

  const sourceRootPath = resolveRepoPath(
    repoRoot,
    (mergedStack.negentropy as JsonRecord | undefined)?.sourceRoot,
  );

  return {
    diagnosticsBaselineVersion:
      typeof diagnosticsBaseline?.version === "string" ? diagnosticsBaseline.version : null,
    consumerBaselineVersion:
      typeof consumerBaseline?.version === "string" ? consumerBaseline.version : null,
    contractSnapshotVersion: readConsumerAnchorValue(consumerBaseline, "decisionContractSnapshot"),
    workflowContractSnapshotVersion: readConsumerAnchorValue(
      consumerBaseline,
      "workflowContractSnapshot",
    ),
    hostDiagnosticsSurfaceVersion: readConsumerAnchorValue(
      consumerBaseline,
      "hostDiagnosticsSurface",
    ),
    hostMemorySummaryContractVersion: HOST_MEMORY_SUMMARY_CONTRACT_SNAPSHOT_VERSION,
    businessArtifactAbsorbContractVersion: BUSINESS_ARTIFACT_ABSORB_CONTRACT_SNAPSHOT_VERSION,
    skillCandidateAbsorbContractVersion: SKILL_CANDIDATE_ABSORB_CONTRACT_SNAPSHOT_VERSION,
    memoryBusinessProjectionContractVersion: MEMORY_BUSINESS_PROJECTION_CONTRACT_SNAPSHOT_VERSION,
    minimalVendorSnapshotVersion: {
      allowlistVersion:
        typeof vendorAllowlist?.version === "string" ? vendorAllowlist.version : null,
      driftBaselineVersion:
        typeof vendorDriftBaseline?.version === "string" ? vendorDriftBaseline.version : null,
    },
    discipline: {
      sourceRoot:
        typeof (seamBaseline?.negentropy as JsonRecord | undefined)?.sourceRoot === "object" &&
        typeof ((seamBaseline?.negentropy as JsonRecord | undefined)?.sourceRoot as JsonRecord)
          .role === "string"
          ? (((seamBaseline?.negentropy as JsonRecord | undefined)?.sourceRoot as JsonRecord)
              .role as string)
          : null,
      vendorRoot:
        typeof (seamBaseline?.negentropy as JsonRecord | undefined)?.vendorRoot === "object" &&
        typeof ((seamBaseline?.negentropy as JsonRecord | undefined)?.vendorRoot as JsonRecord)
          .role === "string"
          ? (((seamBaseline?.negentropy as JsonRecord | undefined)?.vendorRoot as JsonRecord)
              .role as string)
          : null,
      extensionRoot:
        typeof (seamBaseline?.negentropy as JsonRecord | undefined)?.extensionRoot === "object" &&
        typeof ((seamBaseline?.negentropy as JsonRecord | undefined)?.extensionRoot as JsonRecord)
          .role === "string"
          ? (((seamBaseline?.negentropy as JsonRecord | undefined)?.extensionRoot as JsonRecord)
              .role as string)
          : null,
    },
    sourceRoot: {
      path: sourceRootPath,
      reachable: sourceRootPath ? await pathExists(sourceRootPath) : null,
    },
  };
}

export function buildHostFacingDiagnostics(input: {
  extensionMode: DecisionMode;
  failClosed: boolean;
  rollbackSwitchEnabled: boolean;
  workflowBridge: {
    workflowEnabled: boolean;
    orchestrationApiBaseUrl: string;
    autoDispatchSubagents: boolean;
  };
  decisionApi: ReachabilityDiagnostic;
  workflowApi: ReachabilityDiagnostic | null;
  repoLocal: RepoLocalDiagnosticsContext;
}): HostFacingDiagnostics {
  return {
    surface: "host-facing",
    upstreamReachable: {
      sourceRoot: {
        reachable: input.repoLocal.sourceRoot.reachable,
        checkedUrl: input.repoLocal.sourceRoot.path,
        detail:
          input.repoLocal.sourceRoot.reachable === null
            ? "not configured"
            : input.repoLocal.sourceRoot.reachable
              ? "external sourceRoot present"
              : "external sourceRoot missing",
      },
      decisionApi: input.decisionApi,
      workflowApi: input.workflowApi,
    },
    extensionMode: input.extensionMode,
    failOpenOrClosed: input.failClosed ? "fail-closed" : "fail-open",
    rollbackSwitchEnabled: input.rollbackSwitchEnabled,
    workflowBridge: input.workflowBridge,
    consumerBaselineVersion: input.repoLocal.consumerBaselineVersion,
    contractSnapshotVersion: input.repoLocal.contractSnapshotVersion,
    workflowContractSnapshotVersion: input.repoLocal.workflowContractSnapshotVersion,
    hostDiagnosticsSurfaceVersion: input.repoLocal.hostDiagnosticsSurfaceVersion,
    hostMemorySummaryContractVersion: input.repoLocal.hostMemorySummaryContractVersion,
    businessArtifactAbsorbContractVersion: input.repoLocal.businessArtifactAbsorbContractVersion,
    skillCandidateAbsorbContractVersion: input.repoLocal.skillCandidateAbsorbContractVersion,
    memoryBusinessProjectionContractVersion:
      input.repoLocal.memoryBusinessProjectionContractVersion,
    minimalVendorSnapshotVersion: input.repoLocal.minimalVendorSnapshotVersion,
    discipline: input.repoLocal.discipline,
    diagnosticsBaselineVersion: input.repoLocal.diagnosticsBaselineVersion,
  };
}

function formatReachability(label: string, diagnostic: ReachabilityDiagnostic | null): string {
  if (!diagnostic) {
    return `- ${label}: disabled`;
  }
  const state =
    diagnostic.reachable === null ? "unknown" : diagnostic.reachable ? "reachable" : "unreachable";
  const location = diagnostic.checkedUrl ? ` @ ${diagnostic.checkedUrl}` : "";
  const detail = diagnostic.detail ? ` (${diagnostic.detail})` : "";
  return `- ${label}: ${state}${location}${detail}`;
}

export function formatHostFacingDiagnostics(diagnostics: HostFacingDiagnostics): string {
  const allowlistVersion = diagnostics.minimalVendorSnapshotVersion.allowlistVersion ?? "unknown";
  const driftVersion = diagnostics.minimalVendorSnapshotVersion.driftBaselineVersion ?? "unknown";
  const workflowEnabled = diagnostics.workflowBridge.workflowEnabled ? "enabled" : "disabled";
  const rollbackSwitch = diagnostics.rollbackSwitchEnabled ? "enabled" : "disabled";
  const autoDispatch = diagnostics.workflowBridge.autoDispatchSubagents ? "on" : "off";

  return [
    "Negentropy host diagnostics",
    "- surface: host-facing only",
    formatReachability("upstreamReachable.sourceRoot", diagnostics.upstreamReachable.sourceRoot),
    formatReachability("upstreamReachable.decisionApi", diagnostics.upstreamReachable.decisionApi),
    formatReachability("upstreamReachable.workflowApi", diagnostics.upstreamReachable.workflowApi),
    `- extensionMode: ${diagnostics.extensionMode}`,
    `- failOpenOrClosed: ${diagnostics.failOpenOrClosed}`,
    `- rollbackSwitchEnabled: ${rollbackSwitch}`,
    `- workflowBridge: ${workflowEnabled} api=${diagnostics.workflowBridge.orchestrationApiBaseUrl} autoDispatchSubagents=${autoDispatch}`,
    `- consumerBaselineVersion: ${diagnostics.consumerBaselineVersion ?? "unknown"}`,
    `- contractSnapshotVersion: ${diagnostics.contractSnapshotVersion ?? "unknown"}`,
    `- workflowContractSnapshotVersion: ${diagnostics.workflowContractSnapshotVersion ?? "unknown"}`,
    `- hostDiagnosticsSurfaceVersion: ${diagnostics.hostDiagnosticsSurfaceVersion ?? "unknown"}`,
    `- hostMemorySummaryContractVersion: ${diagnostics.hostMemorySummaryContractVersion ?? "unknown"}`,
    `- businessArtifactAbsorbContractVersion: ${diagnostics.businessArtifactAbsorbContractVersion ?? "unknown"}`,
    `- skillCandidateAbsorbContractVersion: ${diagnostics.skillCandidateAbsorbContractVersion ?? "unknown"}`,
    `- memoryBusinessProjectionContractVersion: ${diagnostics.memoryBusinessProjectionContractVersion ?? "unknown"}`,
    `- minimalVendorSnapshotVersion: allowlist=${allowlistVersion} drift=${driftVersion}`,
    `- sourceRootDiscipline: ${diagnostics.discipline.sourceRoot ?? "unknown"}`,
    `- vendorRootDiscipline: ${diagnostics.discipline.vendorRoot ?? "unknown"}`,
    `- extensionRootDiscipline: ${diagnostics.discipline.extensionRoot ?? "unknown"}`,
    `- diagnosticsBaselineVersion: ${diagnostics.diagnosticsBaselineVersion ?? "unknown"}`,
  ].join("\n");
}
