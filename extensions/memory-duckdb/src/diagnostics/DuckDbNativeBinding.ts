import { createRequire } from "node:module";

const requireDuckDb = createRequire(import.meta.url);

export type DuckDbNativeBindingFailureKind =
  | "none"
  | "missing-package"
  | "missing-binding"
  | "load-failed";

export type DuckDbNativeBindingStatus = {
  bindingAvailable: boolean;
  packageVersion: string | null;
  nodeVersion: string;
  platform: NodeJS.Platform;
  arch: string;
  failureKind: DuckDbNativeBindingFailureKind;
  likelyNeedsLocalBuild: boolean;
  errorMessage: string | null;
};

export type DuckDbNativeBindingProbeOptions = {
  loadModule?: (specifier: string) => unknown;
  nodeVersion?: string;
  platform?: NodeJS.Platform;
  arch?: string;
};

function classifyFailure(message: string | null): DuckDbNativeBindingFailureKind {
  if (!message) {
    return "none";
  }
  if (/Cannot find module ['\"]duckdb['\"]/i.test(message)) {
    return "missing-package";
  }
  if (/duckdb\.node/i.test(message) || /binding/i.test(message)) {
    return "missing-binding";
  }
  return "load-failed";
}

export function getDuckDbNativeBindingStatus(
  options: DuckDbNativeBindingProbeOptions = {},
): DuckDbNativeBindingStatus {
  const loadModule = options.loadModule ?? ((specifier: string) => requireDuckDb(specifier));

  let packageVersion: string | null = null;
  try {
    const pkg = loadModule("duckdb/package.json") as { version?: unknown };
    if (typeof pkg.version === "string" && pkg.version.trim()) {
      packageVersion = pkg.version;
    }
  } catch {
    packageVersion = null;
  }

  let errorMessage: string | null = null;
  try {
    loadModule("duckdb");
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  const failureKind = classifyFailure(errorMessage);
  return {
    bindingAvailable: errorMessage == null,
    packageVersion,
    nodeVersion: options.nodeVersion ?? process.version,
    platform: options.platform ?? process.platform,
    arch: options.arch ?? process.arch,
    failureKind,
    likelyNeedsLocalBuild: failureKind === "missing-binding",
    errorMessage,
  };
}
