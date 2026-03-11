import { describe, expect, it } from "vitest";

import {
  CORE_PLUGIN_RUNTIME_TYPES,
  GatewayPluginStatus,
  GatewayPluginType,
  PLUGIN_TERMINOLOGY_MAP,
  createPluginImplementationCensus,
  deriveCorePluginCapabilities,
  deriveGatewayPluginCapabilities,
  isCorePluginManifest,
  isGatewayPluginManifest,
  normalizeCorePluginManifest,
  normalizeGatewayLoadedPlugin,
  normalizeGatewayPluginManifest,
  normalizePluginManifest,
  type CorePluginDefinition,
  type GatewayLoadedPlugin,
  type GatewayPluginManifest,
} from "./plugins";

const corePluginDefinition: CorePluginDefinition = {
  id: "core.agent.monitor",
  name: "Core Agent Monitor",
  version: "1.2.3",
  description: "Tracks agent and entropy state",
  kind: "agent",
  main: "index.ts",
  openclawCompat: true,
  negentropy: {
    agentIntegration: {
      model: "zai/glm-4.7",
    },
    entropyMonitor: {
      metrics: ["entropy", "latency"],
      thresholds: {
        entropy: 0.7,
      },
    },
    constitutionalCompliance: {
      requiredClauses: ["§101", "§102"],
    },
  },
  initialize: async () => {},
  activate: async () => {},
};

const gatewayPluginManifest: GatewayPluginManifest = {
  id: "gateway.request.logger",
  name: "Gateway Request Logger",
  version: "2.0.0",
  type: GatewayPluginType.HTTP_MIDDLEWARE,
  description: "Logs inbound HTTP requests",
  author: "Negentropy-Lab",
  license: "MIT",
  constitutionCompliance: {
    article101: true,
    article102: true,
    article108: true,
    article152: true,
    article306: true,
    article110: true,
  },
  dependencies: {
    required: ["shared.audit"],
  },
  entryPoint: "src/index.ts",
  permissions: {
    api: ["request:read"],
  },
  lifecycle: {
    onLoad: async () => {},
  },
};

describe("integration/plugins facade", () => {
  it("exposes the expected terminology alignment points", () => {
    expect(PLUGIN_TERMINOLOGY_MAP.classification.core).toBe("kind");
    expect(PLUGIN_TERMINOLOGY_MAP.classification.gateway).toBe("type");
    expect(PLUGIN_TERMINOLOGY_MAP.entryPoint.core).toBe("main");
    expect(PLUGIN_TERMINOLOGY_MAP.entryPoint.gateway).toBe("entryPoint");
  });

  it("keeps core runtime plugin types exported", () => {
    expect(CORE_PLUGIN_RUNTIME_TYPES).toContain("HTTP_MIDDLEWARE");
  });

  it("detects core and gateway manifests safely", () => {
    expect(isCorePluginManifest(corePluginDefinition)).toBe(true);
    expect(isGatewayPluginManifest(gatewayPluginManifest)).toBe(true);
    expect(isCorePluginManifest(gatewayPluginManifest)).toBe(false);
  });

  it("derives normalized capabilities from a core plugin definition", () => {
    expect(deriveCorePluginCapabilities(corePluginDefinition)).toEqual([
      "agent_integration",
      "constitutional_compliance",
      "monitoring",
      "openclaw_compatibility",
    ]);
  });

  it("derives normalized capabilities from a gateway plugin manifest", () => {
    expect(deriveGatewayPluginCapabilities(gatewayPluginManifest)).toEqual([
      "gateway_runtime",
      "http_middleware",
      "security",
    ]);
  });

  it("normalizes core plugin definitions without forcing runtime merge", () => {
    expect(normalizeCorePluginManifest(corePluginDefinition)).toEqual({
      source: "core",
      id: "core.agent.monitor",
      name: "Core Agent Monitor",
      version: "1.2.3",
      description: "Tracks agent and entropy state",
      author: undefined,
      license: undefined,
      classification: "agent",
      entryPoint: "index.ts",
      openClawCompatible: true,
      hasConfigSchema: false,
      dependenciesDeclared: false,
      lifecycleHooksDeclared: true,
      capabilities: [
        "agent_integration",
        "constitutional_compliance",
        "monitoring",
        "openclaw_compatibility",
      ],
    });
  });

  it("normalizes gateway plugin manifests into the shared view", () => {
    expect(normalizeGatewayPluginManifest(gatewayPluginManifest)).toEqual({
      source: "gateway",
      id: "gateway.request.logger",
      name: "Gateway Request Logger",
      version: "2.0.0",
      description: "Logs inbound HTTP requests",
      author: "Negentropy-Lab",
      license: "MIT",
      classification: GatewayPluginType.HTTP_MIDDLEWARE,
      entryPoint: "src/index.ts",
      openClawCompatible: false,
      hasConfigSchema: false,
      dependenciesDeclared: true,
      lifecycleHooksDeclared: true,
      capabilities: [
        "gateway_runtime",
        "http_middleware",
        "security",
      ],
    });
  });

  it("normalizes gateway loaded plugin records for façade consumers", () => {
    const loadedPlugin: GatewayLoadedPlugin = {
      manifest: gatewayPluginManifest,
      status: GatewayPluginStatus.ACTIVE,
      config: {},
      loadedAt: new Date("2026-03-10T00:00:00.000Z"),
      lastActiveAt: new Date("2026-03-10T00:01:00.000Z"),
      error: {
        message: "none",
        timestamp: new Date("2026-03-10T00:02:00.000Z"),
      },
    };

    const normalized = normalizeGatewayLoadedPlugin(loadedPlugin);

    expect(normalized.source).toBe("gateway");
    expect(normalized.status).toBe(GatewayPluginStatus.ACTIVE);
    expect(normalized.hasRuntimeError).toBe(true);
    expect(normalized.loadedAt?.toISOString()).toBe("2026-03-10T00:00:00.000Z");
  });

  it("routes mixed manifests through the correct normalizer", () => {
    expect(normalizePluginManifest(corePluginDefinition).source).toBe("core");
    expect(normalizePluginManifest(gatewayPluginManifest).source).toBe("gateway");
  });

  it("reports the preferred plugin facade census", () => {
    const census = createPluginImplementationCensus();

    expect(census.preferredFacade).toBe("server/modules/integration/plugins");
    expect(census.implementations).toHaveLength(2);
    expect(census.implementations[0]?.source).toBe("core");
    expect(census.implementations[1]?.source).toBe("gateway");
  });
});
