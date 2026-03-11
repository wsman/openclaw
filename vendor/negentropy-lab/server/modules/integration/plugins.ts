import {
  PLUGIN_TYPES as CORE_PLUGIN_RUNTIME_TYPES,
  type PluginDefinition as CorePluginDefinition,
  type PluginKind as CorePluginKind,
  type PluginManifest as CorePluginManifest,
} from "../../plugins/types/plugin-interfaces";
import {
  PluginStatus as GatewayPluginStatus,
  PluginType as GatewayPluginType,
  type LoadedPlugin as GatewayLoadedPlugin,
  type PluginManifest as GatewayPluginManifest,
  type PluginManagerOptions as GatewayPluginManagerOptions,
} from "../../gateway/plugins/types";

export {
  PluginCLI,
  type PluginCLIConfig,
  PluginManager as CorePluginManager,
  type PluginManagerConfig as CorePluginManagerConfig,
  createPluginCLI,
  createPluginManager,
} from "../../plugins";

export {
  PluginManager as GatewayPluginManager,
  PluginManagerError,
  PluginNotFoundError,
  PluginValidationError,
  PluginDependencyError,
  PluginLifecycleError,
} from "../../gateway/plugins";

export * as CorePlugins from "../../plugins";
export * as GatewayPlugins from "../../gateway/plugins";

export { CORE_PLUGIN_RUNTIME_TYPES, GatewayPluginStatus, GatewayPluginType };

export type {
  CorePluginDefinition,
  CorePluginKind,
  CorePluginManifest,
  GatewayLoadedPlugin,
  GatewayPluginManagerOptions,
  GatewayPluginManifest,
};

export type PluginImplementationSurface = "core" | "gateway";

export type NormalizedPluginCapability =
  | "agent_integration"
  | "channel_runtime"
  | "constitutional_compliance"
  | "core_runtime"
  | "data_transformation"
  | "event_handling"
  | "external_integration"
  | "gateway_runtime"
  | "http_middleware"
  | "logging"
  | "memory_runtime"
  | "monitoring"
  | "openclaw_compatibility"
  | "scheduled_tasks"
  | "security"
  | "websocket_middleware";

export interface NormalizedPluginManifest {
  source: PluginImplementationSurface;
  id: string;
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  license?: string;
  classification?: string;
  entryPoint?: string;
  openClawCompatible: boolean;
  hasConfigSchema: boolean;
  dependenciesDeclared: boolean;
  lifecycleHooksDeclared: boolean;
  capabilities: NormalizedPluginCapability[];
}

export interface NormalizedLoadedPluginRecord extends NormalizedPluginManifest {
  status: string;
  loadedAt?: Date;
  lastActiveAt?: Date;
  hasRuntimeError: boolean;
}

export interface PluginTerminologyEntry {
  normalized: string;
  core?: string;
  gateway?: string;
  notes: string;
}

export const PLUGIN_TERMINOLOGY_MAP = {
  manager: {
    normalized: "plugin manager",
    core: "PluginManager",
    gateway: "PluginManager",
    notes: "Same top-level term, but backed by separate runtime implementations.",
  },
  manifest: {
    normalized: "plugin manifest",
    core: "PluginManifest",
    gateway: "PluginManifest",
    notes: "Both trees expose a manifest concept with different field sets.",
  },
  classification: {
    normalized: "plugin classification",
    core: "kind",
    gateway: "type",
    notes: "Core uses domain-oriented kinds, gateway uses runtime-oriented types.",
  },
  entryPoint: {
    normalized: "entry point",
    core: "main",
    gateway: "entryPoint",
    notes: "Both describe the executable plugin entry, but with different field names.",
  },
  configSchema: {
    normalized: "configuration schema",
    core: "configSchema",
    gateway: "configSchema",
    notes: "Both systems already expose configuration schema concepts.",
  },
  dependencies: {
    normalized: "dependency declaration",
    gateway: "dependencies",
    notes: "Gateway manifests declare dependency structure explicitly; core manifests do not today.",
  },
  lifecycle: {
    normalized: "lifecycle hooks",
    core: "initialize/activate/deactivate/cleanup",
    gateway: "lifecycle",
    notes: "Core lifecycle is definition-driven, gateway lifecycle is manifest-driven.",
  },
  compatibility: {
    normalized: "OpenClaw compatibility",
    core: "openclawCompat",
    notes: "Core manifests declare compatibility explicitly; gateway plugins imply compatibility by runtime context.",
  },
} as const satisfies Record<string, PluginTerminologyEntry>;

const CORE_KIND_CAPABILITIES: Record<CorePluginKind, NormalizedPluginCapability[]> = {
  core: ["core_runtime"],
  agent: ["agent_integration"],
  monitoring: ["monitoring"],
  channel: ["channel_runtime", "websocket_middleware"],
  gateway: ["gateway_runtime", "http_middleware"],
  memory: ["memory_runtime", "data_transformation"],
};

const GATEWAY_TYPE_CAPABILITIES: Record<GatewayPluginType, NormalizedPluginCapability[]> = {
  [GatewayPluginType.HTTP_MIDDLEWARE]: ["http_middleware", "gateway_runtime"],
  [GatewayPluginType.WEBSOCKET_MIDDLEWARE]: ["websocket_middleware", "gateway_runtime"],
  [GatewayPluginType.EVENT_HANDLER]: ["event_handling"],
  [GatewayPluginType.SCHEDULED_TASK]: ["scheduled_tasks"],
  [GatewayPluginType.DATA_TRANSFORMER]: ["data_transformation"],
  [GatewayPluginType.EXTERNAL_INTEGRATION]: ["external_integration"],
  [GatewayPluginType.MONITORING]: ["monitoring"],
  [GatewayPluginType.LOGGING]: ["logging"],
  [GatewayPluginType.SECURITY]: ["security"],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function uniqueCapabilities(capabilities: NormalizedPluginCapability[]): NormalizedPluginCapability[] {
  return Array.from(new Set(capabilities)).sort();
}

function hasOwnFunction(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === "function";
}

function hasLifecycleHookRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value);
}

export function isGatewayPluginManifest(value: unknown): value is GatewayPluginManifest {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.type === "string"
    && typeof value.entryPoint === "string";
}

export function isCorePluginManifest(value: unknown): value is CorePluginManifest | CorePluginDefinition {
  if (!isRecord(value) || typeof value.id !== "string" || isGatewayPluginManifest(value)) {
    return false;
  }

  return "main" in value
    || "kind" in value
    || "openclawCompat" in value
    || "negentropy" in value
    || "initialize" in value
    || "activate" in value
    || "deactivate" in value
    || "cleanup" in value;
}

export function getPluginTerminologyEntries(): PluginTerminologyEntry[] {
  return Object.values(PLUGIN_TERMINOLOGY_MAP);
}

export function deriveCorePluginCapabilities(
  manifest: CorePluginManifest | CorePluginDefinition,
): NormalizedPluginCapability[] {
  const capabilities: NormalizedPluginCapability[] = [];

  if (manifest.kind) {
    capabilities.push(...CORE_KIND_CAPABILITIES[manifest.kind]);
  }

  if (manifest.openclawCompat) {
    capabilities.push("openclaw_compatibility");
  }

  if (manifest.negentropy?.agentIntegration) {
    capabilities.push("agent_integration");
  }

  if (manifest.negentropy?.entropyMonitor) {
    capabilities.push("monitoring");
  }

  if (manifest.negentropy?.constitutionalCompliance) {
    capabilities.push("constitutional_compliance");
  }

  return uniqueCapabilities(capabilities);
}

export function deriveGatewayPluginCapabilities(
  manifest: GatewayPluginManifest,
): NormalizedPluginCapability[] {
  const capabilities = [...GATEWAY_TYPE_CAPABILITIES[manifest.type]];

  if (manifest.permissions) {
    capabilities.push("security");
  }

  return uniqueCapabilities(capabilities);
}

export function normalizeCorePluginManifest(
  manifest: CorePluginManifest | CorePluginDefinition,
): NormalizedPluginManifest {
  const definitionRecord = manifest as unknown as Record<string, unknown>;
  const lifecycleHooksDeclared = hasOwnFunction(definitionRecord, "initialize")
    || hasOwnFunction(definitionRecord, "activate")
    || hasOwnFunction(definitionRecord, "deactivate")
    || hasOwnFunction(definitionRecord, "cleanup");

  return {
    source: "core",
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    classification: manifest.kind,
    entryPoint: manifest.main,
    openClawCompatible: Boolean(manifest.openclawCompat),
    hasConfigSchema: Boolean(manifest.configSchema),
    dependenciesDeclared: false,
    lifecycleHooksDeclared,
    capabilities: deriveCorePluginCapabilities(manifest),
  };
}

export function normalizeGatewayPluginManifest(
  manifest: GatewayPluginManifest,
): NormalizedPluginManifest {
  const lifecycleHooksDeclared = hasLifecycleHookRecord(manifest.lifecycle)
    && Object.values(manifest.lifecycle).some((hook) => typeof hook === "function");

  return {
    source: "gateway",
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    license: manifest.license,
    classification: manifest.type,
    entryPoint: manifest.entryPoint,
    openClawCompatible: false,
    hasConfigSchema: Boolean(manifest.configSchema),
    dependenciesDeclared: Boolean(manifest.dependencies),
    lifecycleHooksDeclared,
    capabilities: deriveGatewayPluginCapabilities(manifest),
  };
}

export function normalizePluginManifest(
  manifest: CorePluginManifest | CorePluginDefinition | GatewayPluginManifest,
): NormalizedPluginManifest {
  if (isGatewayPluginManifest(manifest)) {
    return normalizeGatewayPluginManifest(manifest);
  }

  return normalizeCorePluginManifest(manifest);
}

export function normalizeGatewayLoadedPlugin(
  plugin: GatewayLoadedPlugin,
): NormalizedLoadedPluginRecord {
  const normalizedManifest = normalizeGatewayPluginManifest(plugin.manifest);

  return {
    ...normalizedManifest,
    status: plugin.status,
    loadedAt: plugin.loadedAt,
    lastActiveAt: plugin.lastActiveAt,
    hasRuntimeError: Boolean(plugin.error),
  };
}

export function createPluginImplementationCensus() {
  return {
    preferredFacade: "server/modules/integration/plugins",
    implementations: [
      {
        source: "core" as const,
        manager: "CorePluginManager",
        manifestType: "CorePluginManifest",
        runtimeNotes: "CLI-oriented and core plugin runtime exports remain implementation-specific.",
      },
      {
        source: "gateway" as const,
        manager: "GatewayPluginManager",
        manifestType: "GatewayPluginManifest",
        runtimeNotes: "Gateway plugin runtime remains independently responsible for loader, registry, and validator concerns.",
      },
    ],
  };
}
