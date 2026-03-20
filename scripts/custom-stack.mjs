#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const localConfigPath = path.join(repoRoot, "custom", "stack.local.json");
const negentropyBaselinesPath = path.join(repoRoot, "custom", "negentropy-baselines.json");
const negentropyDisciplinePath = path.join(repoRoot, "custom", "negentropy-discipline.md");
const negentropySeamBaselinePath = negentropyBaselinesPath;
const negentropySeamDisciplinePath = negentropyDisciplinePath;
const negentropyBridgeSeamBaselinePath = negentropyBaselinesPath;
const negentropyBridgeSeamDisciplinePath = negentropyDisciplinePath;
const negentropyExtensionConsumerBaselinePath = negentropyBaselinesPath;
const negentropyDiagnosticsBaselinePath = negentropyBaselinesPath;
const negentropyDiagnosticsDisciplinePath = negentropyDisciplinePath;
const negentropyVendorAllowlistPath = negentropyBaselinesPath;
const negentropyVendorDriftBaselinePath = negentropyBaselinesPath;
const negentropyVendorSnapshotPolicyPath = negentropyDisciplinePath;
const negentropyVendorInventoryRuntimeBaselineJsonPath = negentropyBaselinesPath;
const negentropyVendorInventoryRuntimeBaselineMdPath = negentropyBaselinesPath;
const vendorMetadataFile = ".openclaw-vendor.json";
const defaultNegentropyExtensionRoot = path.join(repoRoot, "extensions", "negentropy-lab");

function usage() {
  process.stderr.write(
    [
      "Usage: node scripts/custom-stack.mjs <command>",
      "",
      "Commands:",
      "  status",
      "  check-negentropy-seam",
      "  check-negentropy-vendor-snapshot [--manifest-only] [--write-baseline]",
      "  check-negentropy-bridge-seam",
      "  check-negentropy-diagnostics",
      "  sync-negentropy [--dry-run]",
      "  build-opendoge-web",
      "  apply-openclaw-ui-root",
      "  test-opendoge-quick",
      "  test-opendoge-full-live",
    ].join("\n") + "\n",
  );
}

function commandRunner() {
  return process.platform === "win32" ? "pnpm.cmd" : "pnpm";
}

function quoteForCmd(arg) {
  const text = String(arg ?? "");
  if (!/[\s"&|<>^]/.test(text)) {
    return text;
  }
  return `"${text.replace(/(["^])/g, "^$1")}"`;
}

async function readJsonIfExists(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function mergeConfig(baseConfig, overrideConfig) {
  return {
    ...baseConfig,
    ...overrideConfig,
    negentropy: {
      ...baseConfig.negentropy,
      ...overrideConfig.negentropy,
    },
    opendogeUi: {
      ...baseConfig.opendogeUi,
      ...overrideConfig.opendogeUi,
    },
  };
}

function resolveRepoPath(inputPath) {
  if (!inputPath) {
    return null;
  }
  if (path.isAbsolute(inputPath)) {
    return path.normalize(inputPath);
  }
  return path.resolve(repoRoot, inputPath);
}

function normalizeForCompare(targetPath) {
  return path.resolve(targetPath).replace(/\\/g, "/").toLowerCase();
}

function isSameOrNestedPath(parentPath, childPath) {
  const parent = normalizeForCompare(parentPath);
  const child = normalizeForCompare(childPath);
  return child === parent || child.startsWith(`${parent}/`);
}

function normalizeRelativePath(targetPath) {
  return targetPath.replace(/\\/g, "/");
}

function normalizeBasePath(value) {
  const trimmed = String(value ?? "/").trim();
  if (!trimmed || trimmed === "/") {
    return "/";
  }
  let normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (!normalized.endsWith("/")) {
    normalized += "/";
  }
  return normalized;
}

const DEFAULT_NEGENTROPY_PLUGIN_DIAGNOSTICS = {
  serviceUrl: "http://127.0.0.1:3000/internal/openclaw/decision",
  workflowEnabled: true,
  orchestrationApiBaseUrl: "http://127.0.0.1:3000/internal/openclaw/workflows",
  autoDispatchSubagents: true,
};

function normalizeConfiguredString(value) {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function deriveWorkflowApiBaseFromDecisionServiceUrl(serviceUrl) {
  if (!serviceUrl) {
    return undefined;
  }
  if (serviceUrl.endsWith("/decision")) {
    return `${serviceUrl.slice(0, -"/decision".length)}/workflows`;
  }
  if (serviceUrl.endsWith("/internal/openclaw")) {
    return `${serviceUrl}/workflows`;
  }
  return undefined;
}

function normalizeNegentropyMode(value) {
  const normalized = normalizeConfiguredString(value)?.toUpperCase();
  return normalized && ["OFF", "SHADOW", "ENFORCE"].includes(normalized) ? normalized : undefined;
}

function sortStrings(values) {
  return [...values].toSorted((left, right) => left.localeCompare(right));
}

function normalizeManifestRelativePath(inputPath, label) {
  const normalized = normalizeRelativePath(String(inputPath ?? "").trim()).replace(/^\.\/+/, "");
  if (!normalized) {
    throw new Error(`${label} must not be empty`);
  }
  if (path.isAbsolute(normalized)) {
    throw new Error(`${label} must stay repo-relative: ${normalized}`);
  }
  if (normalized === "." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error(`${label} must not escape the source root: ${normalized}`);
  }
  return normalized;
}

function normalizeManifestStringList(values, label) {
  if (!Array.isArray(values)) {
    throw new Error(`${label} must be an array`);
  }
  const normalized = values.map((value, index) =>
    normalizeManifestRelativePath(value, `${label}[${index}]`),
  );
  return sortStrings(new Set(normalized));
}

function normalizePlainStringList(values, label) {
  if (!Array.isArray(values)) {
    throw new Error(`${label} must be an array`);
  }
  const normalized = values.map((value, index) => {
    const text = String(value ?? "").trim();
    if (!text) {
      throw new Error(`${label}[${index}] must not be empty`);
    }
    return text;
  });
  return sortStrings(new Set(normalized));
}

function buildTopLevelEntriesFromPaths(relativePaths) {
  return sortStrings(
    new Set(
      relativePaths.map((entry) => normalizeRelativePath(entry).split("/")[0]).filter(Boolean),
    ),
  );
}

function listDriftIssues(label, expectedValues, actualValues) {
  const expectedSet = new Set(expectedValues);
  const actualSet = new Set(actualValues);
  const issues = [];

  for (const entry of expectedValues) {
    if (!actualSet.has(entry)) {
      issues.push(`${label} is missing ${entry}`);
    }
  }

  for (const entry of actualValues) {
    if (!expectedSet.has(entry)) {
      issues.push(`${label} has unexpected ${entry}`);
    }
  }

  return issues;
}

async function loadConfig() {
  const baseConfig = {
    negentropy: {
      vendorRoot: "vendor/negentropy-lab",
    },
    opendogeUi: {
      webAppDir: "apps/control-ui-web",
      gatewayDir: "apps/gateway",
      webBasePath: "/",
      gatewayBaseUrl: "http://127.0.0.1:3000",
      gatewayWsUrl: "ws://127.0.0.1:3000/ws",
    },
  };
  const localConfig = (await readJsonIfExists(localConfigPath)) ?? {};
  const merged = mergeConfig(baseConfig, localConfig);

  return {
    negentropy: {
      sourceRoot: resolveRepoPath(merged.negentropy?.sourceRoot),
      vendorRoot: resolveRepoPath(merged.negentropy?.vendorRoot ?? "vendor/negentropy-lab"),
    },
    opendogeUi: {
      root: resolveRepoPath(merged.opendogeUi?.root),
      webAppDir: merged.opendogeUi?.webAppDir ?? "apps/control-ui-web",
      gatewayDir: merged.opendogeUi?.gatewayDir ?? "apps/gateway",
      webBasePath: normalizeBasePath(merged.opendogeUi?.webBasePath ?? "/"),
      gatewayBaseUrl: merged.opendogeUi?.gatewayBaseUrl ?? "http://127.0.0.1:3000",
      gatewayWsUrl: merged.opendogeUi?.gatewayWsUrl ?? "ws://127.0.0.1:3000/ws",
    },
  };
}

async function loadNegentropySeamBaseline() {
  const baselineFile = await readJsonIfExists(negentropySeamBaselinePath);
  const baseline = baselineFile?.seam;
  if (!baseline) {
    throw new Error(`Negentropy seam baseline not found: ${negentropySeamBaselinePath}`);
  }
  return baseline;
}

async function loadNegentropyBridgeSeamBaseline() {
  const baselineFile = await readJsonIfExists(negentropyBridgeSeamBaselinePath);
  const baseline = baselineFile?.bridge;
  if (!baseline) {
    throw new Error(
      `Negentropy bridge seam baseline not found: ${negentropyBridgeSeamBaselinePath}`,
    );
  }
  return baseline;
}

async function loadNegentropyExtensionConsumerBaseline() {
  const baselineFile = await readJsonIfExists(negentropyExtensionConsumerBaselinePath);
  const baseline = baselineFile?.extensionConsumer;
  if (!baseline) {
    throw new Error(
      `Negentropy extension consumer baseline not found: ${negentropyExtensionConsumerBaselinePath}`,
    );
  }
  return baseline;
}

async function loadNegentropyDiagnosticsBaseline() {
  const baselineFile = await readJsonIfExists(negentropyDiagnosticsBaselinePath);
  const baseline = baselineFile?.diagnostics;
  if (!baseline) {
    throw new Error(
      `Negentropy diagnostics baseline not found: ${negentropyDiagnosticsBaselinePath}`,
    );
  }
  return baseline;
}

async function loadNegentropyVendorAllowlist() {
  const baselineFile = await readJsonIfExists(negentropyVendorAllowlistPath);
  const allowlist = baselineFile?.vendor?.allowlist;
  if (!allowlist) {
    throw new Error(`Negentropy vendor allowlist not found: ${negentropyVendorAllowlistPath}`);
  }

  return {
    ...allowlist,
    relativeVendorRoot: normalizeManifestRelativePath(
      allowlist.relativeVendorRoot,
      "negentropy vendor allowlist relativeVendorRoot",
    ),
    inventoryMode: String(allowlist.inventoryMode ?? "").trim(),
    purpose: normalizePlainStringList(
      allowlist.purpose ?? [],
      "negentropy vendor allowlist purpose",
    ),
    includePaths: normalizeManifestStringList(
      allowlist.includePaths ?? [],
      "negentropy vendor allowlist includePaths",
    ),
    excludeNames: normalizePlainStringList(
      allowlist.excludeNames ?? [],
      "negentropy vendor allowlist excludeNames",
    ),
  };
}

async function loadNegentropyVendorDriftBaseline() {
  const baselineFile = await readJsonIfExists(negentropyVendorDriftBaselinePath);
  const driftBaseline = baselineFile?.vendor?.driftBaseline;
  if (!driftBaseline) {
    throw new Error(
      `Negentropy vendor drift baseline not found: ${negentropyVendorDriftBaselinePath}`,
    );
  }

  return {
    ...driftBaseline,
    relativeVendorRoot: normalizeManifestRelativePath(
      driftBaseline.relativeVendorRoot,
      "negentropy vendor drift baseline relativeVendorRoot",
    ),
    inventoryMode: String(driftBaseline.inventoryMode ?? "").trim(),
    expectedTopLevelEntries: normalizePlainStringList(
      driftBaseline.expectedTopLevelEntries ?? [],
      "negentropy vendor drift baseline expectedTopLevelEntries",
    ),
    requiredPaths: normalizeManifestStringList(
      driftBaseline.requiredPaths ?? [],
      "negentropy vendor drift baseline requiredPaths",
    ),
    removedFromBroadSnapshot: normalizePlainStringList(
      driftBaseline.removedFromBroadSnapshot ?? [],
      "negentropy vendor drift baseline removedFromBroadSnapshot",
    ),
  };
}

async function ensureExists(targetPath, label) {
  try {
    await fs.access(targetPath);
  } catch {
    throw new Error(`${label} not found: ${targetPath}`);
  }
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function hasRequiredMarkers(rootPath, markers) {
  const missing = [];
  for (const marker of markers) {
    if (!(await pathExists(path.join(rootPath, marker)))) {
      missing.push(marker);
    }
  }
  return missing;
}

async function hasRequiredPaths(rootPath, relativePaths) {
  const missing = [];
  for (const relativePath of relativePaths) {
    if (!(await pathExists(path.join(rootPath, relativePath)))) {
      missing.push(relativePath);
    }
  }
  return missing;
}

async function listTopLevelEntries(rootPath) {
  if (!(await pathExists(rootPath))) {
    return [];
  }

  const entries = await fs.readdir(rootPath, { withFileTypes: true });
  return sortStrings(entries.map((entry) => entry.name));
}

async function listRelativeFiles(rootPath) {
  if (!(await pathExists(rootPath))) {
    return [];
  }

  const result = [];
  async function visit(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const nextPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await visit(nextPath);
        continue;
      }
      result.push(normalizeRelativePath(path.relative(rootPath, nextPath)));
    }
  }

  await visit(rootPath);
  return sortStrings(result);
}

function isFileCoveredByIncludePath(relativeFilePath, includePaths) {
  return includePaths.some((includePath) => {
    if (relativeFilePath === includePath) {
      return true;
    }
    return relativeFilePath.startsWith(`${includePath}/`);
  });
}

function findPresentReviewCandidates(relativeFiles) {
  const candidatePrefixes = [
    "server/gateway/openclaw-decision/__tests__/",
    "server/gateway/openclaw-decision/scripts/",
    "server/gateway/openclaw-decision/observability/",
    "server/gateway/openclaw-decision/policy/",
    "server/gateway/openclaw-decision/resilience/",
    "server/gateway/openclaw-decision/security/",
    "server/gateway/openclaw-decision/translator/",
    "server/gateway/openclaw-orchestration/__tests__/",
    "server/gateway/openclaw-orchestration/actions/",
    "server/gateway/openclaw-orchestration/runtime/",
    "server/gateway/openclaw-orchestration/service/",
  ];
  return sortStrings(
    new Set(
      candidatePrefixes.filter((prefix) =>
        relativeFiles.some((relativeFilePath) => relativeFilePath.startsWith(prefix)),
      ),
    ),
  );
}

function countFilesByIncludePath(relativeFiles, includePaths) {
  return includePaths.map((includePath) => ({
    includePath,
    fileCount: relativeFiles.filter(
      (relativeFilePath) =>
        relativeFilePath === includePath || relativeFilePath.startsWith(`${includePath}/`),
    ).length,
  }));
}

function renderVendorRuntimeBaselineMarkdown(report) {
  const lines = [
    "# Negentropy Vendor Inventory Runtime Baseline",
    "",
    `Generated at: \`${report.generatedAt}\``,
    `Policy path: \`${report.policyPath}\``,
    `Allowlist path: \`${report.allowlistPath}\``,
    `Drift baseline path: \`${report.driftBaselinePath}\``,
    `Vendor root: \`${report.vendorRoot}\``,
    `Mode: \`${report.mode}\``,
    `Pass: \`${report.pass}\``,
    "",
    "## Summary",
    "",
    `- inventory mode: \`${report.inventoryMode}\``,
    `- allowlist version: \`${report.allowlistVersion}\``,
    `- drift baseline version: \`${report.driftBaselineVersion}\``,
    `- total files: \`${report.fileCount}\``,
    `- top-level entries: \`${report.actualTopLevelEntries.join(", ") || "(none)"}\``,
    "",
    "## File Counts By Allowed Root",
    "",
  ];

  for (const entry of report.fileCountsByIncludePath) {
    lines.push(`- \`${entry.includePath}\`: \`${entry.fileCount}\` files`);
  }

  lines.push("", "## Required Paths", "");
  for (const entry of report.requiredPaths) {
    lines.push(`- \`${entry}\``);
  }

  lines.push("", "## Issues", "");
  if (report.issues.length === 0) {
    lines.push("- none");
  } else {
    for (const issue of report.issues) {
      lines.push(`- ${issue}`);
    }
  }

  lines.push("", "## P6-A2 First-Pass Review Candidates", "");
  if (report.reviewCandidates.length === 0) {
    lines.push("- none");
  } else {
    for (const candidate of report.reviewCandidates) {
      lines.push(`- \`${candidate}\``);
    }
  }

  lines.push("", "## Removed-From-Broad-Snapshot Still Present", "");
  if (report.presentRemovedFromBroadSnapshot.length === 0) {
    lines.push("- none");
  } else {
    for (const candidate of report.presentRemovedFromBroadSnapshot) {
      lines.push(`- \`${candidate}\``);
    }
  }

  lines.push("", "## Vendor Metadata", "");
  if (!report.vendorMetadata) {
    lines.push("- missing");
  } else {
    lines.push(`- sourceRoot: \`${report.vendorMetadata.sourceRoot ?? "(missing)"}\``);
    lines.push(`- sourceHead: \`${report.vendorMetadata.sourceHead ?? "(missing)"}\``);
    lines.push(`- syncedAt: \`${report.vendorMetadata.syncedAt ?? "(missing)"}\``);
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function writeVendorRuntimeBaseline(report) {
  const baselineFile = (await readJsonIfExists(negentropyBaselinesPath)) ?? {};
  const next = {
    ...baselineFile,
    vendor: {
      ...(baselineFile.vendor ?? {}),
      inventoryRuntime: report,
    },
  };
  await fs.writeFile(negentropyBaselinesPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

async function checkNegentropyVendorSnapshot(config, { manifestOnly, writeBaseline }) {
  const allowlist = await loadNegentropyVendorAllowlist();
  const driftBaseline = await loadNegentropyVendorDriftBaseline();
  const policyDoc = await readTextIfExists(negentropyVendorSnapshotPolicyPath);
  const issues = [];

  const sourceRoot = config.negentropy.sourceRoot;
  const vendorRoot = config.negentropy.vendorRoot;
  const policyPath = normalizeRelativePath(
    path.relative(repoRoot, negentropyVendorSnapshotPolicyPath),
  );
  const allowlistPath = normalizeRelativePath(
    path.relative(repoRoot, negentropyVendorAllowlistPath),
  );
  const driftBaselinePath = normalizeRelativePath(
    path.relative(repoRoot, negentropyVendorDriftBaselinePath),
  );

  if (!vendorRoot) {
    issues.push("missing negentropy.vendorRoot configuration");
  }
  if (!policyDoc) {
    issues.push(`vendor snapshot policy missing: ${negentropyVendorSnapshotPolicyPath}`);
  } else {
    const requiredPolicyTokens = [
      "sourceRoot",
      "vendorRoot",
      "extensions/negentropy-lab",
      "smallpond-evo",
      "minimal-vendor-snapshot",
      "contract snapshots",
      "fallback metadata",
    ];
    for (const token of requiredPolicyTokens) {
      if (!policyDoc.includes(token)) {
        issues.push(`vendor snapshot policy is missing token: ${token}`);
      }
    }
  }

  if (allowlist.relativeVendorRoot !== "vendor/negentropy-lab") {
    issues.push(
      `vendor allowlist relativeVendorRoot must stay vendor/negentropy-lab (received ${allowlist.relativeVendorRoot})`,
    );
  }
  if (driftBaseline.relativeVendorRoot !== "vendor/negentropy-lab") {
    issues.push(
      `vendor drift baseline relativeVendorRoot must stay vendor/negentropy-lab (received ${driftBaseline.relativeVendorRoot})`,
    );
  }
  if (allowlist.inventoryMode !== driftBaseline.inventoryMode) {
    issues.push(
      `vendor inventory mode mismatch (${allowlist.inventoryMode} != ${driftBaseline.inventoryMode})`,
    );
  }

  const manifestTopLevelEntries = buildTopLevelEntriesFromPaths(allowlist.includePaths);
  for (const issue of listDriftIssues(
    "vendor allowlist top-level entries",
    driftBaseline.expectedTopLevelEntries,
    manifestTopLevelEntries,
  )) {
    issues.push(issue);
  }

  if (manifestOnly) {
    if (issues.length > 0) {
      console.error("Negentropy vendor snapshot manifest check failed:");
      for (const issue of issues) {
        console.error(`- ${issue}`);
      }
      process.exit(1);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "manifest-only",
          policyPath,
          allowlistPath,
          driftBaselinePath,
          inventoryMode: allowlist.inventoryMode,
          allowlistVersion: allowlist.version ?? null,
          driftBaselineVersion: driftBaseline.version ?? null,
          requiredTopLevelEntries: driftBaseline.expectedTopLevelEntries,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!vendorRoot || !(await pathExists(vendorRoot))) {
    issues.push(`vendorRoot does not exist: ${vendorRoot ?? "(missing)"}`);
  }

  const actualTopLevelEntries = vendorRoot ? await listTopLevelEntries(vendorRoot) : [];
  for (const issue of listDriftIssues(
    "vendorRoot top-level entries",
    driftBaseline.expectedTopLevelEntries,
    actualTopLevelEntries,
  )) {
    issues.push(issue);
  }

  const missingRequiredPaths = vendorRoot
    ? await hasRequiredPaths(vendorRoot, driftBaseline.requiredPaths ?? [])
    : [];
  if (missingRequiredPaths.length > 0) {
    issues.push(`vendorRoot is missing required paths: ${missingRequiredPaths.join(", ")}`);
  }

  const relativeFiles = vendorRoot ? await listRelativeFiles(vendorRoot) : [];
  const extraFiles = relativeFiles.filter(
    (relativeFilePath) =>
      relativeFilePath !== vendorMetadataFile &&
      !isFileCoveredByIncludePath(relativeFilePath, allowlist.includePaths),
  );
  if (extraFiles.length > 0) {
    issues.push(`vendorRoot contains files outside includePaths: ${extraFiles.join(", ")}`);
  }

  const presentRemovedFromBroadSnapshot = sortStrings(
    driftBaseline.removedFromBroadSnapshot.filter(
      (entry) => actualTopLevelEntries.includes(entry) || relativeFiles.includes(entry),
    ),
  );
  if (presentRemovedFromBroadSnapshot.length > 0) {
    issues.push(
      `vendorRoot still retains removed-from-broad-snapshot entries: ${presentRemovedFromBroadSnapshot.join(", ")}`,
    );
  }

  const vendorMetadataPath = vendorRoot ? path.join(vendorRoot, vendorMetadataFile) : null;
  const vendorMetadata = vendorMetadataPath ? await readJsonIfExists(vendorMetadataPath) : null;
  if (!vendorMetadata) {
    issues.push(`vendor metadata missing: ${vendorMetadataPath ?? "(missing vendor root)"}`);
  } else {
    if (vendorMetadata.inventoryMode !== allowlist.inventoryMode) {
      issues.push(
        `vendor metadata inventoryMode drifted from allowlist (${vendorMetadata.inventoryMode} != ${allowlist.inventoryMode})`,
      );
    }
    if (vendorMetadata.allowlistVersion !== (allowlist.version ?? null)) {
      issues.push(
        `vendor metadata allowlistVersion drifted from allowlist (${vendorMetadata.allowlistVersion} != ${allowlist.version ?? null})`,
      );
    }
    if (vendorMetadata.driftBaselineVersion !== (driftBaseline.version ?? null)) {
      issues.push(
        `vendor metadata driftBaselineVersion drifted from drift baseline (${vendorMetadata.driftBaselineVersion} != ${driftBaseline.version ?? null})`,
      );
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: "runtime-scan",
    pass: issues.length === 0,
    policyPath,
    allowlistPath,
    driftBaselinePath,
    vendorRoot: vendorRoot ? normalizeRelativePath(path.relative(repoRoot, vendorRoot)) : null,
    inventoryMode: allowlist.inventoryMode,
    allowlistVersion: allowlist.version ?? null,
    driftBaselineVersion: driftBaseline.version ?? null,
    fileCount: relativeFiles.length,
    actualTopLevelEntries,
    requiredPaths: driftBaseline.requiredPaths,
    missingRequiredPaths,
    extraFiles,
    presentRemovedFromBroadSnapshot,
    reviewCandidates: findPresentReviewCandidates(relativeFiles),
    fileCountsByIncludePath: countFilesByIncludePath(relativeFiles, allowlist.includePaths),
    vendorMetadata: vendorMetadata ?? null,
    issues,
  };

  if (writeBaseline) {
    await writeVendorRuntimeBaseline(report);
  }

  if (issues.length > 0) {
    console.error("Negentropy vendor snapshot check failed:");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    console.error(`- policy: ${policyPath}`);
    console.error(`- allowlist: ${allowlistPath}`);
    console.error(`- drift baseline: ${driftBaselinePath}`);
    console.error(`- vendor root: ${report.vendorRoot ?? "(missing)"}`);
    if (writeBaseline) {
      console.error(
        `- runtime baseline written: ${normalizeRelativePath(path.relative(repoRoot, negentropyVendorInventoryRuntimeBaselineMdPath))}`,
      );
    }
    process.exit(1);
  }

  console.log(JSON.stringify(report, null, 2));
}

function getNegentropyPluginEntry(userConfig) {
  return userConfig?.plugins?.entries?.["negentropy-lab"] ?? null;
}

function resolveNegentropyPluginDiagnostics(userConfig) {
  const entry = getNegentropyPluginEntry(userConfig);
  const pluginConfig = entry && typeof entry === "object" ? (entry.config ?? {}) : {};
  const serviceUrl =
    normalizeConfiguredString(pluginConfig?.serviceUrl) ??
    DEFAULT_NEGENTROPY_PLUGIN_DIAGNOSTICS.serviceUrl;
  const explicitWorkflowUrl = normalizeConfiguredString(pluginConfig?.orchestrationApiBaseUrl);
  const derivedWorkflowUrl = deriveWorkflowApiBaseFromDecisionServiceUrl(serviceUrl);

  return {
    configured: Boolean(entry),
    enabled: entry && typeof entry === "object" ? entry.enabled !== false : null,
    mode: normalizeNegentropyMode(pluginConfig?.mode) ?? null,
    serviceUrl: entry ? serviceUrl : null,
    failOpenOrClosed:
      entry && typeof entry === "object"
        ? pluginConfig?.enforceFailClosed === true
          ? "fail-closed"
          : "fail-open"
        : null,
    rollbackSwitchEnabled:
      entry && typeof entry === "object" ? pluginConfig?.enableRollbackSwitch === true : null,
    workflowBridge: {
      workflowEnabled:
        entry && typeof entry === "object" ? pluginConfig?.workflowEnabled !== false : null,
      orchestrationApiBaseUrl:
        entry && typeof entry === "object"
          ? (explicitWorkflowUrl ??
            normalizeConfiguredString(process.env.NEGENTROPY_WORKFLOW_API_URL) ??
            derivedWorkflowUrl ??
            DEFAULT_NEGENTROPY_PLUGIN_DIAGNOSTICS.orchestrationApiBaseUrl)
          : null,
      autoDispatchSubagents:
        entry && typeof entry === "object" ? pluginConfig?.autoDispatchSubagents !== false : null,
    },
  };
}

async function loadOpenClawUserConfigIfExists() {
  try {
    const configPath = openclawUserConfigPath();
    return {
      configPath,
      config: await readJsonIfExists(configPath),
    };
  } catch {
    return {
      configPath: null,
      config: null,
    };
  }
}

function textIncludesAllTokens(text, tokens) {
  const missing = [];
  for (const token of tokens) {
    if (!text.includes(token)) {
      missing.push(token);
    }
  }
  return missing;
}

function openclawUserConfigPath() {
  const home = process.env.USERPROFILE || process.env.HOME;
  if (!home) {
    throw new Error("Cannot resolve user home for ~/.openclaw/openclaw.json");
  }
  return path.join(home, ".openclaw", "openclaw.json");
}

async function runCommand(cmd, args, options = {}) {
  await new Promise((resolve, reject) => {
    let finalCommand = cmd;
    let finalArgs = args;
    if (process.platform === "win32" && path.extname(cmd).toLowerCase() === ".cmd") {
      finalCommand = process.env.ComSpec ?? "cmd.exe";
      finalArgs = ["/d", "/s", "/c", `${quoteForCmd(cmd)} ${args.map(quoteForCmd).join(" ")}`];
    }
    const child = spawn(finalCommand, finalArgs, {
      stdio: "inherit",
      shell: false,
      ...options,
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed: ${cmd} ${args.join(" ")} (exit ${code ?? "null"})`));
    });
  });
}

async function gitHead(targetPath) {
  try {
    let output = "";
    await new Promise((resolve, reject) => {
      const child = spawn("git", ["-C", targetPath, "rev-parse", "HEAD"], {
        stdio: ["ignore", "pipe", "ignore"],
        shell: false,
      });
      child.stdout.on("data", (chunk) => {
        output += chunk.toString();
      });
      child.once("error", reject);
      child.once("exit", (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`git rev-parse failed for ${targetPath}`));
      });
    });
    return output.trim();
  } catch {
    return null;
  }
}

function shouldExcludeNegentropyEntry(entryName, excludeNames) {
  if (excludeNames.has(entryName)) {
    return true;
  }
  if (entryName.startsWith(".tmp")) {
    return true;
  }
  if (entryName.startsWith("failed-suite-results")) {
    return true;
  }
  if (entryName.startsWith("test-results")) {
    return true;
  }
  // Keep Python bytecode out of vendor snapshots even if it exists in the source checkout.
  return entryName.endsWith(".pyc");
}

async function copyRecursive(sourcePath, destinationPath, excludeNames) {
  const stat = await fs.stat(sourcePath);
  if (stat.isDirectory()) {
    await fs.mkdir(destinationPath, { recursive: true });
    const entries = await fs.readdir(sourcePath, { withFileTypes: true });
    for (const entry of entries) {
      if (shouldExcludeNegentropyEntry(entry.name, excludeNames)) {
        continue;
      }
      await copyRecursive(
        path.join(sourcePath, entry.name),
        path.join(destinationPath, entry.name),
        excludeNames,
      );
    }
    return;
  }

  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.copyFile(sourcePath, destinationPath);
}

async function syncNegentropy(config, { dryRun }) {
  const sourceRoot = config.negentropy.sourceRoot;
  const vendorRoot = config.negentropy.vendorRoot;
  const allowlist = await loadNegentropyVendorAllowlist();
  const driftBaseline = await loadNegentropyVendorDriftBaseline();
  if (!sourceRoot || !vendorRoot) {
    throw new Error("negentropy source/vendor paths are not configured");
  }

  const manifestTopLevelEntries = buildTopLevelEntriesFromPaths(allowlist.includePaths);
  const manifestInventoryIssues = listDriftIssues(
    "vendor allowlist top-level entries",
    driftBaseline.expectedTopLevelEntries,
    manifestTopLevelEntries,
  );
  if (manifestInventoryIssues.length > 0) {
    throw new Error(manifestInventoryIssues.join("; "));
  }

  const excludeNames = new Set(allowlist.excludeNames);

  const sourceExists = await pathExists(sourceRoot);
  if (!sourceExists) {
    const payload = {
      action: "sync-negentropy",
      sourceRoot,
      vendorRoot,
      status: "source-missing",
      inventoryMode: allowlist.inventoryMode,
      allowlistVersion: allowlist.version ?? null,
      driftBaselineVersion: driftBaseline.version ?? null,
      hint: "Set custom/stack.local.json -> negentropy.sourceRoot to a real Negentropy-Lab checkout before sync.",
    };
    if (dryRun) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    throw new Error(`Negentropy-Lab source not found: ${sourceRoot}`);
  }

  const selectedEntries = allowlist.includePaths;
  const missingSourceEntries = await hasRequiredPaths(sourceRoot, selectedEntries);
  if (missingSourceEntries.length > 0) {
    throw new Error(
      `Negentropy allowlist paths missing in sourceRoot: ${missingSourceEntries.join(", ")}`,
    );
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          action: "sync-negentropy",
          sourceRoot,
          vendorRoot,
          inventoryMode: allowlist.inventoryMode,
          allowlistVersion: allowlist.version ?? null,
          driftBaselineVersion: driftBaseline.version ?? null,
          entries: selectedEntries,
          topLevelEntries: manifestTopLevelEntries,
        },
        null,
        2,
      ),
    );
    return;
  }

  await fs.rm(vendorRoot, { recursive: true, force: true });
  await fs.mkdir(vendorRoot, { recursive: true });

  for (const entryName of selectedEntries) {
    await copyRecursive(
      path.join(sourceRoot, entryName),
      path.join(vendorRoot, entryName),
      excludeNames,
    );
  }

  const actualTopLevelEntries = await listTopLevelEntries(vendorRoot);
  const inventoryIssues = listDriftIssues(
    "vendor top-level entries",
    driftBaseline.expectedTopLevelEntries,
    actualTopLevelEntries,
  );
  if (inventoryIssues.length > 0) {
    throw new Error(inventoryIssues.join("; "));
  }

  const metadata = {
    sourceRoot,
    syncedAt: new Date().toISOString(),
    sourceHead: await gitHead(sourceRoot),
    inventoryMode: allowlist.inventoryMode,
    allowlistManifestPath: normalizeRelativePath(
      path.relative(repoRoot, negentropyVendorAllowlistPath),
    ),
    allowlistVersion: allowlist.version ?? null,
    driftBaselinePath: normalizeRelativePath(
      path.relative(repoRoot, negentropyVendorDriftBaselinePath),
    ),
    driftBaselineVersion: driftBaseline.version ?? null,
    includePaths: selectedEntries,
    topLevelEntries: actualTopLevelEntries,
    purpose: allowlist.purpose,
    excludeNames: allowlist.excludeNames,
  };
  await fs.writeFile(
    path.join(vendorRoot, vendorMetadataFile),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );

  console.log(`Synced Negentropy-Lab into ${path.relative(repoRoot, vendorRoot)}`);
}

async function applyOpenClawUiRoot(config) {
  const uiRoot = config.opendogeUi.root;
  if (!uiRoot) {
    throw new Error("opendoge-ui root is not configured");
  }

  const webDistPath = path.join(uiRoot, config.opendogeUi.webAppDir, "dist");
  await ensureExists(webDistPath, "opendoge-ui web dist");

  const configPath = openclawUserConfigPath();
  const configDir = path.dirname(configPath);
  await fs.mkdir(configDir, { recursive: true });

  const existing = (await readJsonIfExists(configPath)) ?? {};
  const backupDir = path.join(repoRoot, "custom", "backups");
  await fs.mkdir(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await fs.writeFile(
    path.join(backupDir, `openclaw-config-${timestamp}.json`),
    `${JSON.stringify(existing, null, 2)}\n`,
    "utf8",
  );

  const next = {
    ...existing,
    gateway: {
      ...existing.gateway,
      controlUi: {
        ...existing.gateway?.controlUi,
        root: webDistPath,
        enabled: true,
      },
    },
  };

  if (config.opendogeUi.webBasePath === "/") {
    if (next.gateway?.controlUi) {
      delete next.gateway.controlUi.basePath;
    }
  } else {
    next.gateway.controlUi.basePath = config.opendogeUi.webBasePath.replace(/\/$/, "");
  }

  await fs.writeFile(configPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");

  console.log(
    JSON.stringify(
      {
        configPath,
        applied: {
          controlUiRoot: webDistPath,
          basePath: config.opendogeUi.webBasePath,
        },
      },
      null,
      2,
    ),
  );
}

async function buildOpenDogeWeb(config) {
  const uiRoot = config.opendogeUi.root;
  if (!uiRoot) {
    throw new Error("opendoge-ui root is not configured");
  }
  await ensureExists(uiRoot, "opendoge-ui root");

  const env = {
    ...process.env,
    VITE_PUBLIC_BASE_PATH: config.opendogeUi.webBasePath,
    VITE_GATEWAY_BASE_URL: config.opendogeUi.gatewayBaseUrl,
    VITE_GATEWAY_WS_URL: config.opendogeUi.gatewayWsUrl,
  };

  await runCommand(
    commandRunner(),
    ["--dir", uiRoot, "--filter", "@opendoge/control-ui-web", "build"],
    { env },
  );
}

async function runOpenDogeTest(config, scriptName) {
  const uiRoot = config.opendogeUi.root;
  if (!uiRoot) {
    throw new Error("opendoge-ui root is not configured");
  }
  await ensureExists(uiRoot, "opendoge-ui root");
  await runCommand(commandRunner(), ["--dir", uiRoot, scriptName]);
}

async function collectStatus(config) {
  const seamBaseline = await loadNegentropySeamBaseline();
  const bridgeBaseline = await loadNegentropyBridgeSeamBaseline();
  const consumerBaseline = await loadNegentropyExtensionConsumerBaseline();
  const diagnosticsBaseline = await loadNegentropyDiagnosticsBaseline();
  const vendorAllowlist = await loadNegentropyVendorAllowlist();
  const vendorDriftBaseline = await loadNegentropyVendorDriftBaseline();
  const sourceRoot = config.negentropy.sourceRoot;
  const vendorRoot = config.negentropy.vendorRoot;
  const extensionRoot = defaultNegentropyExtensionRoot;
  const uiRoot = config.opendogeUi.root;
  const webDistPath =
    uiRoot && config.opendogeUi.webAppDir
      ? path.join(uiRoot, config.opendogeUi.webAppDir, "dist")
      : null;

  const sourceExists = sourceRoot ? await pathExists(sourceRoot) : false;
  const vendorExists = vendorRoot ? await pathExists(vendorRoot) : false;
  const extensionExists = await pathExists(extensionRoot);
  const { configPath: openclawConfigPath, config: openclawUserConfig } =
    await loadOpenClawUserConfigIfExists();
  const pluginDiagnostics = resolveNegentropyPluginDiagnostics(openclawUserConfig);
  const consumerEntries = consumerBaseline.extension?.consumers ?? {};
  const decisionConsumer = consumerEntries.decisionContractSnapshot ?? {};
  const workflowConsumer = consumerEntries.workflowContractSnapshot ?? {};
  const diagnosticsConsumer = consumerEntries.hostDiagnosticsSurface ?? {};

  const status = {
    negentropy: {
      sourceRoot,
      sourceExists,
      sourceStatus: sourceExists ? "ready" : "missing",
      sourceHead: sourceExists && sourceRoot ? await gitHead(sourceRoot) : null,
      sourceHint: sourceExists
        ? undefined
        : "Set custom/stack.local.json -> negentropy.sourceRoot to a real Negentropy-Lab checkout.",
      vendorRoot,
      vendorExists,
      vendorMetadataPath: vendorRoot ? path.join(vendorRoot, vendorMetadataFile) : null,
      vendorInventoryMode: vendorAllowlist.inventoryMode ?? null,
      vendorAllowlistVersion: vendorAllowlist.version ?? null,
      vendorDriftBaselineVersion: vendorDriftBaseline.version ?? null,
      vendorTopLevelEntries:
        vendorExists && vendorRoot ? await listTopLevelEntries(vendorRoot) : [],
      extensionRoot,
      extensionExists,
      seamBaselineVersion: seamBaseline.version ?? null,
      bridgeBaselineVersion: bridgeBaseline.version ?? null,
      consumerBaselineVersion: consumerBaseline.version ?? null,
      diagnosticsBaselineVersion: diagnosticsBaseline.version ?? null,
      seamRoles: {
        sourceRoot: seamBaseline.negentropy?.sourceRoot?.role ?? null,
        vendorRoot: seamBaseline.negentropy?.vendorRoot?.role ?? null,
        extensionRoot: seamBaseline.negentropy?.extensionRoot?.role ?? null,
      },
      diagnostics: {
        surface: "host-facing",
        upstreamReachable: {
          sourceRoot: sourceExists,
        },
        pluginConfigured: pluginDiagnostics.configured,
        openclawConfigPath,
        extensionMode: pluginDiagnostics.mode,
        failOpenOrClosed: pluginDiagnostics.failOpenOrClosed,
        rollbackSwitchEnabled: pluginDiagnostics.rollbackSwitchEnabled,
        consumerBaselineVersion: consumerBaseline.version ?? null,
        contractSnapshotVersion: decisionConsumer.version ?? null,
        workflowContractSnapshotVersion: workflowConsumer.version ?? null,
        hostDiagnosticsSurfaceVersion: diagnosticsConsumer.version ?? null,
        minimalVendorSnapshotVersion: {
          allowlistVersion: vendorAllowlist.version ?? null,
          driftBaselineVersion: vendorDriftBaseline.version ?? null,
        },
        discipline: {
          sourceRoot: sourceExists
            ? (seamBaseline.negentropy?.sourceRoot?.role ?? null)
            : "missing",
          vendorRoot: vendorExists
            ? (seamBaseline.negentropy?.vendorRoot?.role ?? null)
            : "missing",
          extensionRoot: extensionExists
            ? (seamBaseline.negentropy?.extensionRoot?.role ?? null)
            : "missing",
        },
        workflowBridge: {
          workflowEnabled: pluginDiagnostics.workflowBridge.workflowEnabled,
          orchestrationApiBaseUrl: pluginDiagnostics.workflowBridge.orchestrationApiBaseUrl,
          autoDispatchSubagents: pluginDiagnostics.workflowBridge.autoDispatchSubagents,
        },
      },
      canSync: Boolean(sourceExists && vendorRoot),
    },
    opendogeUi: {
      root: uiRoot,
      rootExists: uiRoot ? await pathExists(uiRoot) : false,
      webAppDir: config.opendogeUi.webAppDir,
      webDistPath,
      webDistExists: webDistPath ? await pathExists(webDistPath) : false,
      recommendedControlUiRoot: webDistPath,
      recommendedControlUiBasePath: config.opendogeUi.webBasePath,
      gatewayBaseUrl: config.opendogeUi.gatewayBaseUrl,
      gatewayWsUrl: config.opendogeUi.gatewayWsUrl,
    },
  };

  return status;
}

async function printStatus(config) {
  console.log(JSON.stringify(await collectStatus(config), null, 2));
}

async function checkNegentropySeam(config) {
  const baseline = await loadNegentropySeamBaseline();
  const allowlist = await loadNegentropyVendorAllowlist();
  const driftBaseline = await loadNegentropyVendorDriftBaseline();
  const issues = [];

  const sourceRoot = config.negentropy.sourceRoot;
  const vendorRoot = config.negentropy.vendorRoot;
  const extensionRoot = defaultNegentropyExtensionRoot;

  if (!sourceRoot) {
    issues.push(`missing ${baseline.negentropy.sourceRoot.configKey}`);
  }
  if (!vendorRoot) {
    issues.push("missing negentropy.vendorRoot");
  }

  if (sourceRoot && !(await pathExists(sourceRoot))) {
    issues.push(`sourceRoot does not exist: ${sourceRoot}`);
  }
  if (vendorRoot && !(await pathExists(vendorRoot))) {
    issues.push(`vendorRoot does not exist: ${vendorRoot}`);
  }
  if (!(await pathExists(extensionRoot))) {
    issues.push(`extensionRoot does not exist: ${extensionRoot}`);
  }

  if (sourceRoot) {
    if (isSameOrNestedPath(repoRoot, sourceRoot)) {
      issues.push(`sourceRoot must remain external to the OpenClaw repo: ${sourceRoot}`);
    }
    const missingMarkers = await hasRequiredMarkers(
      sourceRoot,
      baseline.negentropy.sourceRoot.requiredMarkers ?? [],
    );
    if (missingMarkers.length > 0) {
      issues.push(`sourceRoot is missing required markers: ${missingMarkers.join(", ")}`);
    }
  }

  if (vendorRoot) {
    const expectedVendorRelativePath = baseline.negentropy.vendorRoot.relativePath;
    const actualVendorRelativePath = normalizeRelativePath(path.relative(repoRoot, vendorRoot));
    if (actualVendorRelativePath !== expectedVendorRelativePath) {
      issues.push(
        `vendorRoot must stay pinned to ${expectedVendorRelativePath} (received ${actualVendorRelativePath})`,
      );
    }

    const missingMarkers = await hasRequiredMarkers(
      vendorRoot,
      baseline.negentropy.vendorRoot.requiredMarkers ?? [],
    );
    if (missingMarkers.length > 0) {
      issues.push(`vendorRoot is missing required markers: ${missingMarkers.join(", ")}`);
    }

    const vendorPolicy = baseline.negentropy.vendorRoot.policy ?? {};
    const allowlistRelativePath = normalizeRelativePath(
      path.relative(repoRoot, negentropyVendorAllowlistPath),
    );
    const driftBaselineRelativePath = normalizeRelativePath(
      path.relative(repoRoot, negentropyVendorDriftBaselinePath),
    );
    if (vendorPolicy.inventoryMode !== allowlist.inventoryMode) {
      issues.push(
        `vendorRoot policy inventoryMode must stay ${allowlist.inventoryMode} (received ${vendorPolicy.inventoryMode})`,
      );
    }
    if (vendorPolicy.allowlistManifestPath !== allowlistRelativePath) {
      issues.push(
        `vendorRoot policy allowlistManifestPath must stay ${allowlistRelativePath} (received ${vendorPolicy.allowlistManifestPath})`,
      );
    }
    if (vendorPolicy.driftBaselinePath !== driftBaselineRelativePath) {
      issues.push(
        `vendorRoot policy driftBaselinePath must stay ${driftBaselineRelativePath} (received ${vendorPolicy.driftBaselinePath})`,
      );
    }
    if (allowlist.relativeVendorRoot !== expectedVendorRelativePath) {
      issues.push(
        `vendor allowlist relativeVendorRoot must stay ${expectedVendorRelativePath} (received ${allowlist.relativeVendorRoot})`,
      );
    }
    if (driftBaseline.relativeVendorRoot !== expectedVendorRelativePath) {
      issues.push(
        `vendor drift baseline relativeVendorRoot must stay ${expectedVendorRelativePath} (received ${driftBaseline.relativeVendorRoot})`,
      );
    }

    const manifestTopLevelEntries = buildTopLevelEntriesFromPaths(allowlist.includePaths);
    for (const issue of listDriftIssues(
      "vendor allowlist top-level entries",
      driftBaseline.expectedTopLevelEntries,
      manifestTopLevelEntries,
    )) {
      issues.push(issue);
    }

    for (const issue of listDriftIssues(
      "vendor policy requiredTopLevelEntries",
      vendorPolicy.requiredTopLevelEntries ?? [],
      driftBaseline.expectedTopLevelEntries,
    )) {
      issues.push(issue);
    }

    const vendorMetadataPath = path.join(vendorRoot, vendorMetadataFile);
    const vendorMetadata = await readJsonIfExists(vendorMetadataPath);
    if (!vendorMetadata) {
      issues.push(`vendor metadata missing: ${vendorMetadataPath}`);
    } else {
      if (
        sourceRoot &&
        normalizeForCompare(vendorMetadata.sourceRoot ?? "") !== normalizeForCompare(sourceRoot)
      ) {
        issues.push(
          `vendor metadata sourceRoot drifted from configured sourceRoot (${vendorMetadata.sourceRoot} != ${sourceRoot})`,
        );
      }
      if (vendorMetadata.inventoryMode !== allowlist.inventoryMode) {
        issues.push(
          `vendor metadata inventoryMode drifted from allowlist (${vendorMetadata.inventoryMode} != ${allowlist.inventoryMode})`,
        );
      }
      if (vendorMetadata.allowlistVersion !== (allowlist.version ?? null)) {
        issues.push(
          `vendor metadata allowlistVersion drifted from allowlist (${vendorMetadata.allowlistVersion} != ${allowlist.version ?? null})`,
        );
      }
      if (vendorMetadata.driftBaselineVersion !== (driftBaseline.version ?? null)) {
        issues.push(
          `vendor metadata driftBaselineVersion drifted from drift baseline (${vendorMetadata.driftBaselineVersion} != ${driftBaseline.version ?? null})`,
        );
      }
      for (const issue of listDriftIssues(
        "vendor metadata includePaths",
        allowlist.includePaths,
        sortStrings(vendorMetadata.includePaths ?? []),
      )) {
        issues.push(issue);
      }
      for (const issue of listDriftIssues(
        "vendor metadata topLevelEntries",
        driftBaseline.expectedTopLevelEntries,
        sortStrings(vendorMetadata.topLevelEntries ?? []),
      )) {
        issues.push(issue);
      }
      for (const issue of listDriftIssues(
        "vendor metadata excludeNames",
        allowlist.excludeNames,
        sortStrings(vendorMetadata.excludeNames ?? []),
      )) {
        issues.push(issue);
      }
    }

    const actualTopLevelEntries = await listTopLevelEntries(vendorRoot);
    for (const issue of listDriftIssues(
      "vendorRoot top-level entries",
      driftBaseline.expectedTopLevelEntries,
      actualTopLevelEntries,
    )) {
      issues.push(issue);
    }

    const missingRequiredPaths = await hasRequiredPaths(
      vendorRoot,
      driftBaseline.requiredPaths ?? [],
    );
    if (missingRequiredPaths.length > 0) {
      issues.push(`vendorRoot is missing required paths: ${missingRequiredPaths.join(", ")}`);
    }

    const forbiddenTopLevelEntries = new Set(
      baseline.negentropy.vendorRoot.policy?.forbiddenTopLevelEntries ?? [],
    );
    for (const entry of actualTopLevelEntries) {
      if (forbiddenTopLevelEntries.has(entry)) {
        issues.push(`vendorRoot top-level inventory must not retain ${entry}`);
      }
    }
  }

  const expectedExtensionRelativePath = baseline.negentropy.extensionRoot.relativePath;
  const actualExtensionRelativePath = normalizeRelativePath(path.relative(repoRoot, extensionRoot));
  if (actualExtensionRelativePath !== expectedExtensionRelativePath) {
    issues.push(
      `extensionRoot must stay pinned to ${expectedExtensionRelativePath} (received ${actualExtensionRelativePath})`,
    );
  }

  const extensionMissingMarkers = await hasRequiredMarkers(
    extensionRoot,
    baseline.negentropy.extensionRoot.requiredMarkers ?? [],
  );
  if (extensionMissingMarkers.length > 0) {
    issues.push(`extensionRoot is missing required markers: ${extensionMissingMarkers.join(", ")}`);
  }

  const seamDoc = await readTextIfExists(negentropySeamDisciplinePath);
  if (!seamDoc) {
    issues.push(`seam discipline doc missing: ${negentropySeamDisciplinePath}`);
  } else {
    const requiredDocTokens = [
      "sourceRoot",
      "vendorRoot",
      "extensions/negentropy-lab",
      "control-plane owner",
      "AuthorityState write-back owner",
      "custom/negentropy-baselines.json",
      "minimal-vendor-snapshot",
    ];
    for (const token of requiredDocTokens) {
      if (!seamDoc.includes(token)) {
        issues.push(`seam discipline doc is missing token: ${token}`);
      }
    }
  }

  if (issues.length > 0) {
    console.error("Negentropy seam discipline check failed:");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        version: baseline.version,
        sourceRoot,
        vendorRoot,
        extensionRoot,
        roles: {
          sourceRoot: baseline.negentropy.sourceRoot.role,
          vendorRoot: baseline.negentropy.vendorRoot.role,
          extensionRoot: baseline.negentropy.extensionRoot.role,
        },
      },
      null,
      2,
    ),
  );
}

async function checkNegentropyBridgeSeam() {
  const baseline = await loadNegentropyBridgeSeamBaseline();
  const consumerBaseline = await loadNegentropyExtensionConsumerBaseline();
  const issues = [];

  const pluginManifestPath = path.join(repoRoot, baseline.extension.pluginManifestPath);
  const pluginEntryPath = path.join(
    repoRoot,
    baseline.extension.pluginEntryPath ?? "extensions/negentropy-lab/index.ts",
  );
  const readmePath = path.join(repoRoot, baseline.extension.readmePath);
  const consumerBaselinePath = path.join(
    repoRoot,
    baseline.extension.consumerBaselinePath ?? "custom/negentropy-baselines.json",
  );
  const gatewayRequestPath = path.join(repoRoot, baseline.extension.gatewayRequestPath);
  const workflowConfigPath = path.join(repoRoot, baseline.extension.workflowConfigPath);
  const workflowBridgePath = path.join(repoRoot, baseline.extension.workflowBridgePath);
  const workflowTypesPath = path.join(
    repoRoot,
    baseline.extension.workflowTypesPath ?? "extensions/negentropy-lab/src/workflow-types.ts",
  );
  const diagnosticsHelperPath = path.join(
    repoRoot,
    baseline.extension.diagnosticsHelperPath ?? "extensions/negentropy-lab/src/diagnostics.ts",
  );
  const snapshotPath = path.join(repoRoot, baseline.extension.decisionContractSnapshotPath);
  const alignmentTestPath = path.join(
    repoRoot,
    baseline.extension.decisionContractAlignmentTestPath,
  );
  const bridgeDocPath = negentropyBridgeSeamDisciplinePath;
  const customReadmePath = path.join(
    repoRoot,
    consumerBaseline.extension?.customReadmePath ?? "custom/README.md",
  );

  const pluginManifest = await readJsonIfExists(pluginManifestPath);
  const pluginEntry = await readTextIfExists(pluginEntryPath);
  const readme = await readTextIfExists(readmePath);
  const consumerBaselineDoc = await readJsonIfExists(consumerBaselinePath);
  const gatewayRequest = await readTextIfExists(gatewayRequestPath);
  const workflowConfig = await readTextIfExists(workflowConfigPath);
  const workflowBridge = await readTextIfExists(workflowBridgePath);
  const workflowTypes = await readTextIfExists(workflowTypesPath);
  const diagnosticsHelper = await readTextIfExists(diagnosticsHelperPath);
  const snapshot = await readTextIfExists(snapshotPath);
  const alignmentTest = await readTextIfExists(alignmentTestPath);
  const bridgeDoc = await readTextIfExists(bridgeDocPath);
  const customReadme = await readTextIfExists(customReadmePath);

  if (!pluginManifest) {
    issues.push(`plugin manifest missing: ${pluginManifestPath}`);
  } else {
    const manifestDescription = String(pluginManifest.description ?? "");
    const missingDescriptionTokens = textIncludesAllTokens(
      manifestDescription,
      baseline.extension.requiredManifestDescriptionTokens ?? [],
    );
    for (const token of missingDescriptionTokens) {
      issues.push(`plugin manifest description is missing token: ${token}`);
    }

    const uiHints = pluginManifest.uiHints ?? {};
    const schemaProperties = pluginManifest.configSchema?.properties ?? {};
    for (const [key, expectations] of Object.entries(
      baseline.extension.bridgeOnlyConfigKeys ?? {},
    )) {
      const schemaType = schemaProperties[key]?.type;
      if (schemaType !== expectations.schemaType) {
        issues.push(`plugin manifest ${key} must stay typed as ${expectations.schemaType}`);
      }

      const helpText = String(uiHints[key]?.help ?? "");
      for (const token of expectations.requiredHelpTokens ?? []) {
        if (!helpText.includes(token)) {
          issues.push(`plugin manifest ${key} help is missing token: ${token}`);
        }
      }

      const placeholderText = String(uiHints[key]?.placeholder ?? "");
      for (const token of expectations.requiredPlaceholderTokens ?? []) {
        if (!placeholderText.includes(token)) {
          issues.push(`plugin manifest ${key} placeholder is missing token: ${token}`);
        }
      }
    }
  }

  if (!pluginEntry) {
    issues.push(`plugin entry missing: ${pluginEntryPath}`);
  } else {
    for (const token of baseline.extension.requiredEntryDescriptionTokens ?? []) {
      if (!pluginEntry.includes(token)) {
        issues.push(`plugin entry is missing token: ${token}`);
      }
    }
  }

  if (!readme) {
    issues.push(`extension README missing: ${readmePath}`);
  } else {
    const missingReadmeTokens = textIncludesAllTokens(
      readme,
      baseline.extension.requiredReadmeTokens ?? [],
    );
    for (const token of missingReadmeTokens) {
      issues.push(`extension README is missing token: ${token}`);
    }
  }

  if (!consumerBaselineDoc) {
    issues.push(`extension consumer baseline missing: ${consumerBaselinePath}`);
  } else {
    if (consumerBaseline.extension?.relativePath !== baseline.extension.relativePath) {
      issues.push(
        `extension consumer baseline relativePath drifted (${consumerBaseline.extension?.relativePath} != ${baseline.extension.relativePath})`,
      );
    }

    for (const token of consumerBaseline.extension?.requiredReadmeTokens ?? []) {
      if (!readme?.includes(token)) {
        issues.push(`extension README is missing consumer token: ${token}`);
      }
    }

    for (const token of consumerBaseline.extension?.requiredBridgeDisciplineTokens ?? []) {
      if (!bridgeDoc?.includes(token)) {
        issues.push(`bridge seam discipline doc is missing consumer token: ${token}`);
      }
    }

    for (const token of consumerBaseline.extension?.requiredCustomReadmeTokens ?? []) {
      if (!customReadme?.includes(token)) {
        issues.push(`custom README is missing consumer token: ${token}`);
      }
    }

    for (const token of consumerBaseline.extension?.requiredDiagnosticsTokens ?? []) {
      if (!diagnosticsHelper?.includes(token)) {
        issues.push(`diagnostics helper is missing consumer token: ${token}`);
      }
    }

    for (const [consumerKey, consumerEntry] of Object.entries(
      consumerBaseline.extension?.consumers ?? {},
    )) {
      const localConsumedFormPath = consumerEntry.localConsumedFormPath;
      const anchorPath = consumerEntry.anchorPath;
      const anchorToken = consumerEntry.anchorToken;
      const canonicalSourcePath = consumerEntry.canonicalSourcePath;

      if (localConsumedFormPath) {
        const localPath = path.join(repoRoot, localConsumedFormPath);
        if (!(await pathExists(localPath))) {
          issues.push(`${consumerKey} local consumed form missing: ${localConsumedFormPath}`);
        }
      }

      if (anchorPath && anchorToken) {
        const anchorText = await readTextIfExists(path.join(repoRoot, anchorPath));
        if (!anchorText) {
          issues.push(`${consumerKey} anchor file missing: ${anchorPath}`);
        } else if (!anchorText.includes(anchorToken)) {
          issues.push(`${consumerKey} anchor token missing from ${anchorPath}: ${anchorToken}`);
        }
      }

      if (
        consumerKey === "decisionContractSnapshot" &&
        canonicalSourcePath !== baseline.vendor.canonicalDecisionContractPath
      ) {
        issues.push(
          `decision contract canonical source drifted (${canonicalSourcePath} != ${baseline.vendor.canonicalDecisionContractPath})`,
        );
      }

      if (
        consumerKey === "workflowContractSnapshot" &&
        canonicalSourcePath !== baseline.vendor.canonicalWorkflowContractPath
      ) {
        issues.push(
          `workflow contract canonical source drifted (${canonicalSourcePath} != ${baseline.vendor.canonicalWorkflowContractPath})`,
        );
      }

      if (Array.isArray(consumerEntry.forbiddenSubstitutes) && localConsumedFormPath) {
        const localText = await readTextIfExists(path.join(repoRoot, localConsumedFormPath));
        if (localText) {
          for (const token of consumerEntry.forbiddenSubstitutes) {
            if (localText.includes(token)) {
              issues.push(`${consumerKey} local consumed form must not reference token: ${token}`);
            }
          }
        }
      }
    }
  }

  if (!gatewayRequest) {
    issues.push(`gateway request bridge file missing: ${gatewayRequestPath}`);
  } else {
    for (const token of baseline.extension.requiredGatewayRequestTokens ?? []) {
      if (!gatewayRequest.includes(token)) {
        issues.push(`gateway request bridge is missing token: ${token}`);
      }
    }
    for (const token of baseline.extension.forbiddenGatewayRequestTokens ?? []) {
      if (gatewayRequest.includes(token)) {
        issues.push(`gateway request bridge must not reference token: ${token}`);
      }
    }
  }

  if (!workflowConfig) {
    issues.push(`workflow config file missing: ${workflowConfigPath}`);
  } else {
    for (const token of baseline.extension.requiredWorkflowConfigTokens ?? []) {
      if (!workflowConfig.includes(token)) {
        issues.push(`workflow config is missing token: ${token}`);
      }
    }
  }

  if (!workflowBridge) {
    issues.push(`workflow bridge file missing: ${workflowBridgePath}`);
  } else {
    for (const token of baseline.extension.requiredWorkflowBridgeTokens ?? []) {
      if (!workflowBridge.includes(token)) {
        issues.push(`workflow bridge is missing token: ${token}`);
      }
    }
    for (const token of baseline.extension.forbiddenWorkflowBridgeTokens ?? []) {
      if (workflowBridge.includes(token)) {
        issues.push(`workflow bridge must not reference token: ${token}`);
      }
    }
  }

  if (!workflowTypes) {
    issues.push(`workflow types file missing: ${workflowTypesPath}`);
  } else {
    for (const token of baseline.extension.requiredWorkflowTypesTokens ?? []) {
      if (!workflowTypes.includes(token)) {
        issues.push(`workflow types file is missing token: ${token}`);
      }
    }
  }

  if (!diagnosticsHelper) {
    issues.push(`diagnostics helper missing: ${diagnosticsHelperPath}`);
  } else {
    for (const token of baseline.extension.requiredDiagnosticsTokens ?? []) {
      if (!diagnosticsHelper.includes(token)) {
        issues.push(`diagnostics helper is missing bridge token: ${token}`);
      }
    }
  }

  if (!snapshot) {
    issues.push(`decision contract snapshot missing: ${snapshotPath}`);
  } else if (!snapshot.includes(baseline.vendor.canonicalDecisionContractPath)) {
    issues.push(
      `decision contract snapshot must keep canonical source path: ${baseline.vendor.canonicalDecisionContractPath}`,
    );
  }

  if (!alignmentTest) {
    issues.push(`decision contract alignment test missing: ${alignmentTestPath}`);
  } else {
    if (!alignmentTest.includes("./decision-contract.snapshot.js")) {
      issues.push("decision contract alignment test must import the local snapshot");
    }
    if (
      !alignmentTest.includes(baseline.vendor.canonicalDecisionContractPath.replace(/\.ts$/, ".js"))
    ) {
      issues.push("decision contract alignment test must import the canonical vendor contract");
    }
  }

  if (!bridgeDoc) {
    issues.push(`bridge seam discipline doc missing: ${bridgeDocPath}`);
  } else {
    const requiredDocTokens = [
      "only official runtime entry",
      "workflowEnabled",
      "orchestrationApiBaseUrl",
      "autoDispatchSubagents",
      "runtime.subagent.run",
      "AuthorityState",
      "ResultEnvelope",
      "smallpond-evo",
      "contract consumer packaging",
    ];
    for (const token of requiredDocTokens) {
      if (!bridgeDoc.includes(token)) {
        issues.push(`bridge seam discipline doc is missing token: ${token}`);
      }
    }
  }

  for (const relativePath of baseline.extension.dependencyBoundaryPaths ?? []) {
    const targetPath = path.join(repoRoot, relativePath);
    const fileText = await readTextIfExists(targetPath);
    if (!fileText) {
      issues.push(`dependency boundary file missing: ${targetPath}`);
      continue;
    }
    for (const token of baseline.extension.forbiddenDependencyTokens ?? []) {
      if (fileText.includes(token)) {
        issues.push(`${relativePath} must not reference token: ${token}`);
      }
    }
  }

  if (issues.length > 0) {
    console.error("Negentropy bridge seam check failed:");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        version: baseline.version,
        consumerBaselineVersion: consumerBaseline.version ?? null,
        extensionRoot: baseline.extension.relativePath,
        bridgeOnlyConfigKeys: Object.keys(baseline.extension.bridgeOnlyConfigKeys ?? {}),
        canonicalDecisionContractPath: baseline.vendor.canonicalDecisionContractPath,
        canonicalWorkflowContractPath: baseline.vendor.canonicalWorkflowContractPath,
      },
      null,
      2,
    ),
  );
}

async function checkNegentropyDiagnostics(config) {
  const baseline = await loadNegentropyDiagnosticsBaseline();
  const status = await collectStatus(config);
  const issues = [];

  const diagnostics = status.negentropy?.diagnostics ?? null;
  const customReadme = await readTextIfExists(
    path.join(repoRoot, baseline.custom?.readmePath ?? "custom/README.md"),
  );
  const extensionReadme = await readTextIfExists(
    path.join(repoRoot, baseline.extension?.readmePath ?? "extensions/negentropy-lab/README.md"),
  );
  const diagnosticsDoc = await readTextIfExists(negentropyDiagnosticsDisciplinePath);
  const diagnosticsHelper = await readTextIfExists(
    path.join(
      repoRoot,
      baseline.extension?.diagnosticsHelperPath ?? "extensions/negentropy-lab/src/diagnostics.ts",
    ),
  );
  const packageJson = await readJsonIfExists(path.join(repoRoot, "package.json"));

  if (!diagnostics) {
    issues.push("custom stack status is missing negentropy.diagnostics");
  } else {
    for (const key of baseline.custom?.requiredStatusKeys ?? []) {
      if (!(key in diagnostics)) {
        issues.push(`custom stack diagnostics is missing key: ${key}`);
      }
    }

    for (const key of baseline.custom?.requiredUpstreamKeys ?? []) {
      if (!(key in (diagnostics.upstreamReachable ?? {}))) {
        issues.push(`custom stack diagnostics upstreamReachable is missing key: ${key}`);
      }
    }

    for (const key of baseline.custom?.requiredWorkflowBridgeKeys ?? []) {
      if (!(key in (diagnostics.workflowBridge ?? {}))) {
        issues.push(`custom stack diagnostics workflowBridge is missing key: ${key}`);
      }
    }

    for (const key of baseline.custom?.requiredDisciplineKeys ?? []) {
      if (!(key in (diagnostics.discipline ?? {}))) {
        issues.push(`custom stack diagnostics discipline is missing key: ${key}`);
      }
    }
  }

  if (status.negentropy?.diagnosticsBaselineVersion !== (baseline.version ?? null)) {
    issues.push(
      `custom stack diagnosticsBaselineVersion drifted (${status.negentropy?.diagnosticsBaselineVersion} != ${baseline.version ?? null})`,
    );
  }

  if (!customReadme) {
    issues.push(`custom README missing: ${baseline.custom?.readmePath ?? "custom/README.md"}`);
  } else {
    for (const token of baseline.custom?.requiredReadmeTokens ?? []) {
      if (!customReadme.includes(token)) {
        issues.push(`custom README is missing token: ${token}`);
      }
    }
  }

  if (!extensionReadme) {
    issues.push(
      `extension README missing: ${baseline.extension?.readmePath ?? "extensions/negentropy-lab/README.md"}`,
    );
  } else {
    for (const token of baseline.extension?.requiredReadmeTokens ?? []) {
      if (!extensionReadme.includes(token)) {
        issues.push(`extension README is missing token: ${token}`);
      }
    }
  }

  if (!diagnosticsDoc) {
    issues.push(`diagnostics discipline doc missing: ${negentropyDiagnosticsDisciplinePath}`);
  } else {
    for (const token of baseline.custom?.requiredDisciplineDocTokens ?? []) {
      if (!diagnosticsDoc.includes(token)) {
        issues.push(`diagnostics discipline doc is missing token: ${token}`);
      }
    }
  }

  if (!diagnosticsHelper) {
    issues.push(
      `diagnostics helper missing: ${baseline.extension?.diagnosticsHelperPath ?? "extensions/negentropy-lab/src/diagnostics.ts"}`,
    );
  } else {
    for (const token of baseline.extension?.requiredStatusTokens ?? []) {
      if (!diagnosticsHelper.includes(token)) {
        issues.push(`diagnostics helper is missing token: ${token}`);
      }
    }
  }

  if (!(await pathExists(path.join(repoRoot, baseline.extension?.diagnosticsTestPath ?? "")))) {
    issues.push(
      `diagnostics alignment test missing: ${baseline.extension?.diagnosticsTestPath ?? "extensions/negentropy-lab/src/diagnostics-surface.test.ts"}`,
    );
  }

  const scripts = packageJson?.scripts ?? {};
  for (const scriptName of baseline.custom?.requiredPackageScripts ?? []) {
    if (!(scriptName in scripts)) {
      issues.push(`package.json scripts is missing ${scriptName}`);
    }
  }

  if (issues.length > 0) {
    console.error("Negentropy diagnostics check failed:");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        version: baseline.version,
        diagnosticsKeys: Object.keys(diagnostics ?? {}),
        workflowBridgeKeys: Object.keys(diagnostics?.workflowBridge ?? {}),
        disciplineKeys: Object.keys(diagnostics?.discipline ?? {}),
      },
      null,
      2,
    ),
  );
}

async function main(argv = process.argv.slice(2)) {
  const [command, ...rest] = argv;
  if (!command) {
    usage();
    process.exit(2);
  }

  const config = await loadConfig();

  switch (command) {
    case "status":
      await printStatus(config);
      return;
    case "check-negentropy-seam":
      await checkNegentropySeam(config);
      return;
    case "check-negentropy-vendor-snapshot":
      await checkNegentropyVendorSnapshot(config, {
        manifestOnly: rest.includes("--manifest-only"),
        writeBaseline: rest.includes("--write-baseline"),
      });
      return;
    case "check-negentropy-bridge-seam":
      await checkNegentropyBridgeSeam();
      return;
    case "check-negentropy-diagnostics":
      await checkNegentropyDiagnostics(config);
      return;
    case "sync-negentropy":
      await syncNegentropy(config, { dryRun: rest.includes("--dry-run") });
      return;
    case "build-opendoge-web":
      await buildOpenDogeWeb(config);
      return;
    case "apply-openclaw-ui-root":
      await applyOpenClawUiRoot(config);
      return;
    case "test-opendoge-quick":
      await runOpenDogeTest(config, "test:integration:quick");
      return;
    case "test-opendoge-full-live":
      await runOpenDogeTest(config, "test:integration:full:live");
      return;
    default:
      usage();
      process.exit(2);
  }
}

main().catch((error) => {
  console.error(`[custom-stack] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
