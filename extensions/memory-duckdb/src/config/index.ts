import { homedir } from "node:os";
import path from "node:path";
import type { MemoryDuckdbConfig, MemoryDuckdbRuntimeMode } from "../types.js";

const DEFAULT_STORAGE_PATH = path.join(homedir(), ".openclaw", "memory-duckdb");
const DEFAULT_DUCKDB_PATH = path.join(DEFAULT_STORAGE_PATH, "duckdb", "memory.duckdb");

function assertAllowedKeys(value: Record<string, unknown>, allowed: string[], label: string) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`);
  }
}

function resolveEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_match, envVar) => {
    const resolved = process.env[envVar];
    if (!resolved) {
      throw new Error(`Environment variable ${envVar} is not set`);
    }
    return resolved;
  });
}

function readRuntimeMode(value: unknown): MemoryDuckdbRuntimeMode {
  if (value === undefined) {
    return "canonical";
  }
  if (value === "canonical" || value === "shadow-read") {
    return value;
  }
  throw new Error("runtimeMode must be one of: canonical, shadow-read");
}

function readNestedObject(
  value: unknown,
  label: string,
  allowed: string[],
): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  const cast = value as Record<string, unknown>;
  assertAllowedKeys(cast, allowed, label);
  return cast;
}

function readPositiveInteger(
  value: unknown,
  label: string,
  defaultValue: number,
  minimum: number,
): number {
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a number`);
  }
  const rounded = Math.floor(value);
  if (rounded < minimum) {
    throw new Error(`${label} must be >= ${minimum}`);
  }
  return rounded;
}

const DEFAULT_CONFIG: MemoryDuckdbConfig = {
  storagePath: DEFAULT_STORAGE_PATH,
  duckdbPath: DEFAULT_DUCKDB_PATH,
  runtimeMode: "canonical",
  native: { required: false },
  ingest: { maxActiveBytes: 256 * 1024 },
  replay: { batchSize: 200 },
  shadow: {
    maxCheckpointAgeSeconds: 900,
    requireParityZeroMismatch: true,
  },
  diagnostics: {
    enableHttpRoutes: true,
  },
};

export const memoryDuckdbConfigSchema = {
  parse(value: unknown): MemoryDuckdbConfig {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ...DEFAULT_CONFIG };
    }

    const cfg = value as Record<string, unknown>;
    assertAllowedKeys(
      cfg,
      [
        "storagePath",
        "duckdbPath",
        "runtimeMode",
        "native",
        "ingest",
        "replay",
        "shadow",
        "diagnostics",
      ],
      "memory-duckdb config",
    );

    const native = readNestedObject(cfg.native, "native", ["required"]);
    const ingest = readNestedObject(cfg.ingest, "ingest", ["maxActiveBytes"]);
    const replay = readNestedObject(cfg.replay, "replay", ["batchSize"]);
    const shadow = readNestedObject(cfg.shadow, "shadow", [
      "maxCheckpointAgeSeconds",
      "requireParityZeroMismatch",
    ]);
    const diagnostics = readNestedObject(cfg.diagnostics, "diagnostics", ["enableHttpRoutes"]);

    return {
      storagePath:
        typeof cfg.storagePath === "string"
          ? resolveEnvVars(cfg.storagePath)
          : DEFAULT_STORAGE_PATH,
      duckdbPath:
        typeof cfg.duckdbPath === "string" ? resolveEnvVars(cfg.duckdbPath) : DEFAULT_DUCKDB_PATH,
      runtimeMode: readRuntimeMode(cfg.runtimeMode),
      native: {
        required: native?.required === true,
      },
      ingest: {
        maxActiveBytes: readPositiveInteger(
          ingest?.maxActiveBytes,
          "ingest.maxActiveBytes",
          DEFAULT_CONFIG.ingest.maxActiveBytes,
          1024,
        ),
      },
      replay: {
        batchSize: readPositiveInteger(
          replay?.batchSize,
          "replay.batchSize",
          DEFAULT_CONFIG.replay.batchSize,
          1,
        ),
      },
      shadow: {
        maxCheckpointAgeSeconds: readPositiveInteger(
          shadow?.maxCheckpointAgeSeconds,
          "shadow.maxCheckpointAgeSeconds",
          DEFAULT_CONFIG.shadow.maxCheckpointAgeSeconds,
          1,
        ),
        requireParityZeroMismatch: shadow?.requireParityZeroMismatch !== false,
      },
      diagnostics: {
        enableHttpRoutes: diagnostics?.enableHttpRoutes !== false,
      },
    };
  },
  uiHints: {
    storagePath: {
      label: "Storage Path",
      placeholder: DEFAULT_STORAGE_PATH,
      advanced: true,
    },
    duckdbPath: {
      label: "DuckDB Path",
      placeholder: DEFAULT_DUCKDB_PATH,
      advanced: true,
    },
    runtimeMode: {
      label: "Runtime Mode",
      help: "Use canonical owner mode or the shadow-read read-only mode.",
    },
    "native.required": {
      label: "Require Native DuckDB",
      help: "Fail status checks when DuckDB native bindings are unavailable.",
    },
    "ingest.maxActiveBytes": {
      label: "Max Active Spool Bytes",
      placeholder: String(DEFAULT_CONFIG.ingest.maxActiveBytes),
      advanced: true,
    },
    "replay.batchSize": {
      label: "Replay Batch Size",
      placeholder: String(DEFAULT_CONFIG.replay.batchSize),
      advanced: true,
    },
    "shadow.maxCheckpointAgeSeconds": {
      label: "Max Checkpoint Age",
      placeholder: String(DEFAULT_CONFIG.shadow.maxCheckpointAgeSeconds),
      advanced: true,
    },
    "shadow.requireParityZeroMismatch": {
      label: "Require Zero Mismatch Parity",
    },
    "diagnostics.enableHttpRoutes": {
      label: "Enable HTTP Routes",
    },
  },
};

export function resolveMemoryDuckdbConfigPaths(
  config: MemoryDuckdbConfig,
  resolvePath: (value: string) => string,
): MemoryDuckdbConfig {
  return {
    ...config,
    storagePath: resolvePath(config.storagePath),
    duckdbPath: resolvePath(config.duckdbPath),
  };
}
