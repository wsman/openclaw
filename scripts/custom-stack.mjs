#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const exampleConfigPath = path.join(repoRoot, "custom", "stack.example.json");
const localConfigPath = path.join(repoRoot, "custom", "stack.local.json");
const vendorMetadataFile = ".openclaw-vendor.json";

const NEGENTROPY_INCLUDE_ROOT_DIRS = new Set([
  ".github",
  "config",
  "docs",
  "engine",
  "memory_bank",
  "monitoring",
  "plugins",
  "scripts",
  "server",
  "src",
  "templates",
  "tests",
]);

const NEGENTROPY_INCLUDE_ROOT_FILES = new Set([
  ".clinerules",
  ".eslintrc.json",
  ".gitignore",
  "CHANGELOG.md",
  "constitution-compliance-report.json",
  "docker-compose.production.yml",
  "docker-compose.v3.yml",
  "Dockerfile.mcp",
  "Dockerfile.node",
  "Dockerfile.production",
  "jest.config.js",
  "LICENSE",
  "package.json",
  "pnpm-lock.yaml",
  "README.md",
  "tsconfig.build.json",
  "tsconfig.json",
  "tsconfig.test.json",
  "vitest.config.mjs"
]);

const NEGENTROPY_EXCLUDE_NAMES = new Set([
  ".cdd",
  ".git",
  ".husky",
  "__pycache__",
  "coverage",
  "data",
  "dist",
  "logs",
  "node_modules",
  "reports",
  "storage"
]);

function usage() {
  process.stderr.write(
    [
      "Usage: node scripts/custom-stack.mjs <command>",
      "",
      "Commands:",
      "  status",
      "  sync-negentropy [--dry-run]",
      "  build-opendoge-web",
      "  apply-openclaw-ui-root",
      "  test-opendoge-quick",
      "  test-opendoge-full-live"
    ].join("\n") + "\n"
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

function mergeConfig(baseConfig, overrideConfig) {
  return {
    ...baseConfig,
    ...overrideConfig,
    negentropy: {
      ...(baseConfig.negentropy ?? {}),
      ...(overrideConfig.negentropy ?? {})
    },
    opendogeUi: {
      ...(baseConfig.opendogeUi ?? {}),
      ...(overrideConfig.opendogeUi ?? {})
    }
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

async function loadConfig() {
  const baseConfig = (await readJsonIfExists(exampleConfigPath)) ?? {};
  const localConfig = (await readJsonIfExists(localConfigPath)) ?? {};
  const merged = mergeConfig(baseConfig, localConfig);

  return {
    negentropy: {
      sourceRoot: resolveRepoPath(merged.negentropy?.sourceRoot),
      vendorRoot: resolveRepoPath(merged.negentropy?.vendorRoot ?? "vendor/negentropy-lab")
    },
    opendogeUi: {
      root: resolveRepoPath(merged.opendogeUi?.root),
      webAppDir: merged.opendogeUi?.webAppDir ?? "apps/control-ui-web",
      gatewayDir: merged.opendogeUi?.gatewayDir ?? "apps/gateway",
      webBasePath: normalizeBasePath(merged.opendogeUi?.webBasePath ?? "/"),
      gatewayBaseUrl: merged.opendogeUi?.gatewayBaseUrl ?? "http://127.0.0.1:3000",
      gatewayWsUrl: merged.opendogeUi?.gatewayWsUrl ?? "ws://127.0.0.1:3000/ws"
    }
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
      ...options
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
        shell: false
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

function shouldCopyNegentropyRootEntry(entryName) {
  if (shouldExcludeNegentropyEntry(entryName)) {
    return false;
  }
  return NEGENTROPY_INCLUDE_ROOT_DIRS.has(entryName) || NEGENTROPY_INCLUDE_ROOT_FILES.has(entryName);
}

function shouldExcludeNegentropyEntry(entryName) {
  if (NEGENTROPY_EXCLUDE_NAMES.has(entryName)) {
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

async function copyRecursive(sourcePath, destinationPath) {
  const stat = await fs.stat(sourcePath);
  if (stat.isDirectory()) {
    await fs.mkdir(destinationPath, { recursive: true });
    const entries = await fs.readdir(sourcePath, { withFileTypes: true });
    for (const entry of entries) {
      if (shouldExcludeNegentropyEntry(entry.name)) {
        continue;
      }
      await copyRecursive(path.join(sourcePath, entry.name), path.join(destinationPath, entry.name));
    }
    return;
  }

  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.copyFile(sourcePath, destinationPath);
}

async function syncNegentropy(config, { dryRun }) {
  const sourceRoot = config.negentropy.sourceRoot;
  const vendorRoot = config.negentropy.vendorRoot;
  if (!sourceRoot || !vendorRoot) {
    throw new Error("negentropy source/vendor paths are not configured");
  }

  const sourceExists = await pathExists(sourceRoot);
  if (!sourceExists) {
    const payload = {
      action: "sync-negentropy",
      sourceRoot,
      vendorRoot,
      status: "source-missing",
      hint:
        "Set custom/stack.local.json -> negentropy.sourceRoot to a real Negentropy-Lab checkout before sync.",
    };
    if (dryRun) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    throw new Error(`Negentropy-Lab source not found: ${sourceRoot}`);
  }

  const entries = await fs.readdir(sourceRoot, { withFileTypes: true });
  const selectedEntries = entries
    .filter((entry) => shouldCopyNegentropyRootEntry(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          action: "sync-negentropy",
          sourceRoot,
          vendorRoot,
          entries: selectedEntries
        },
        null,
        2
      )
    );
    return;
  }

  await fs.rm(vendorRoot, { recursive: true, force: true });
  await fs.mkdir(vendorRoot, { recursive: true });

  for (const entryName of selectedEntries) {
    await copyRecursive(path.join(sourceRoot, entryName), path.join(vendorRoot, entryName));
  }

  const metadata = {
    sourceRoot,
    syncedAt: new Date().toISOString(),
    sourceHead: await gitHead(sourceRoot),
    includeRootDirs: [...NEGENTROPY_INCLUDE_ROOT_DIRS],
    includeRootFiles: [...NEGENTROPY_INCLUDE_ROOT_FILES],
    excludeNames: [...NEGENTROPY_EXCLUDE_NAMES]
  };
  await fs.writeFile(path.join(vendorRoot, vendorMetadataFile), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

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
    "utf8"
  );

  const next = {
    ...existing,
    gateway: {
      ...(existing.gateway ?? {}),
      controlUi: {
        ...((existing.gateway && existing.gateway.controlUi) || {}),
        root: webDistPath,
        enabled: true
      }
    }
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
          basePath: config.opendogeUi.webBasePath
        }
      },
      null,
      2
    )
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
    VITE_GATEWAY_WS_URL: config.opendogeUi.gatewayWsUrl
  };

  await runCommand(commandRunner(), ["--dir", uiRoot, "--filter", "@opendoge/control-ui-web", "build"], { env });
}

async function runOpenDogeTest(config, scriptName) {
  const uiRoot = config.opendogeUi.root;
  if (!uiRoot) {
    throw new Error("opendoge-ui root is not configured");
  }
  await ensureExists(uiRoot, "opendoge-ui root");
  await runCommand(commandRunner(), ["--dir", uiRoot, scriptName]);
}

async function printStatus(config) {
  const sourceRoot = config.negentropy.sourceRoot;
  const vendorRoot = config.negentropy.vendorRoot;
  const uiRoot = config.opendogeUi.root;
  const webDistPath =
    uiRoot && config.opendogeUi.webAppDir
      ? path.join(uiRoot, config.opendogeUi.webAppDir, "dist")
      : null;

  const sourceExists = sourceRoot ? await pathExists(sourceRoot) : false;
  const vendorExists = vendorRoot ? await pathExists(vendorRoot) : false;

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
      canSync: Boolean(sourceExists && vendorRoot)
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
      gatewayWsUrl: config.opendogeUi.gatewayWsUrl
    }
  };

  console.log(JSON.stringify(status, null, 2));
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
