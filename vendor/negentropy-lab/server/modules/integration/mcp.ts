import {
  AuthorityMcpTransportService,
  HttpMcpCommandRunner,
  SubprocessMcpCommandRunner,
  type AuthorityMcpTransportServiceOptions,
  type McpCommandRunner,
} from "../../services/authority/AuthorityMcpTransportService";
import type {
  AuthorityMcpDiscoveryResult,
  AuthorityMcpFailbackPolicy,
  AuthorityMcpMaintenanceWindow,
  AuthorityMcpOrchestrationPolicy,
  AuthorityMcpServiceConfig,
  AuthorityMcpServiceSnapshot,
  AuthorityMcpSloPolicy,
  AuthorityMcpToolDescriptor,
  AuthorityMcpToolPolicy,
  AuthorityMcpTrafficPolicy,
} from "../../services/authority/types";

export {
  AuthorityMcpTransportService,
  HttpMcpCommandRunner,
  SubprocessMcpCommandRunner,
  type AuthorityMcpTransportServiceOptions,
  type McpCommandRunner,
};

export type {
  AuthorityMcpDiscoveryResult,
  AuthorityMcpFailbackPolicy,
  AuthorityMcpMaintenanceWindow,
  AuthorityMcpOrchestrationPolicy,
  AuthorityMcpServiceConfig,
  AuthorityMcpServiceSnapshot,
  AuthorityMcpSloPolicy,
  AuthorityMcpToolDescriptor,
  AuthorityMcpToolPolicy,
  AuthorityMcpTrafficPolicy,
};

export type McpImplementationSurface = "authority";
export type McpImportUsage = "runtime" | "authority-internal" | "test";
export type McpMigrationPreference = "keep_direct" | "prefer_integration_facade";

export interface NormalizedMcpPolicyRecord {
  slo: AuthorityMcpSloPolicy | null;
  traffic: AuthorityMcpTrafficPolicy | null;
  failback: AuthorityMcpFailbackPolicy | null;
  orchestration: AuthorityMcpOrchestrationPolicy | null;
  toolPolicies: Record<string, AuthorityMcpToolPolicy>;
}

export interface NormalizedMcpServiceDefinition {
  runtime: McpImplementationSurface;
  serviceId: string;
  provider: string;
  transport: AuthorityMcpServiceConfig["transport"];
  source: string;
  command?: string;
  args: string[];
  endpoint?: string;
  auth: {
    type: NonNullable<AuthorityMcpServiceConfig["auth"]>["type"];
    hasToken: boolean;
    headerName?: string;
  };
  enabled: boolean;
  operationalMode: NonNullable<AuthorityMcpServiceConfig["operationalMode"]>;
  modules: string[];
  priority: number;
  healthPolicy: {
    failureThreshold: number | null;
    recoveryIntervalMs: number | null;
    pollingIntervalMs: number | null;
    recoverySuccessThreshold: number | null;
  };
  defaults: {
    allowedDepartments: string[];
    requiredCapabilities: string[];
    tags: string[];
  };
  maintenanceWindows: AuthorityMcpMaintenanceWindow[];
  policy: NormalizedMcpPolicyRecord;
}

export interface NormalizedMcpServiceRecord {
  runtime: McpImplementationSurface;
  serviceId: string;
  provider: string;
  transport: string;
  source: string;
  endpoint: string;
  enabled: boolean;
  operationalMode: AuthorityMcpServiceSnapshot["operationalMode"];
  toolCount: number;
  loadedModules: string[];
  moduleErrors: Record<string, string>;
  health: {
    healthy: boolean;
    status: AuthorityMcpServiceSnapshot["healthStatus"];
    lastCheckedAt: number;
    lastStateChangeAt: number;
    lastLatencyMs: number;
    lastError: string;
    sloStatus: AuthorityMcpServiceSnapshot["sloStatus"];
  };
  usage: {
    requestCount: number;
    successCount: number;
    failureCount: number;
    successStreak: number;
    failureStreak: number;
    lastUsedAt: number;
    lastPollAt: number;
    successRate: number;
    failureRate: number;
    recoveryAttemptCount: number;
    recoveryBlockedUntil: number;
    recoveryLockoutUntil: number;
    lastRecoveryAttemptAt: number;
    stableSince: number;
  };
  traffic: {
    priority: number;
    configuredPercent: number;
    effectivePercent: number;
    lane: AuthorityMcpServiceSnapshot["trafficLane"];
    routeScore: number;
  };
  maintenance: {
    inMaintenance: boolean;
    activeWindowId: string;
    activeAction: AuthorityMcpServiceSnapshot["activeMaintenanceAction"];
    windowCount: number;
    conflictCount: number;
    lastRunAt: number;
  };
  orchestration: {
    group: string;
    template: string;
    preferredNodes: string[];
    excludedNodes: string[];
    regions: string[];
    tags: string[];
  };
}

export interface NormalizedMcpDiscoveryRecord {
  runtime: McpImplementationSurface;
  timestamp: number;
  services: NormalizedMcpServiceRecord[];
  tools: AuthorityMcpToolDescriptor[];
  syncedTools: string[];
}

export interface NormalizedMcpPollingStatus {
  runtime: McpImplementationSurface;
  active: boolean;
  intervalMs: number;
  inFlight: boolean;
  lastPollAt: number;
  lastPollCompletedAt: number;
}

export interface NormalizedMcpMaintenanceStatus {
  runtime: McpImplementationSurface;
  active: boolean;
  intervalMs: number;
  inFlight: boolean;
  lastRunAt: number;
  lastCompletedAt: number;
}

export interface McpImportCensusEntry {
  path: string;
  usage: McpImportUsage;
  reason: string;
  migrationPreference: McpMigrationPreference;
}

export interface McpImportCensus {
  preferredFacade: string;
  implementationClass: string;
  directImports: McpImportCensusEntry[];
}

export interface McpRegistryFacade {
  implementation: McpImplementationSurface;
  listServices(): NormalizedMcpServiceRecord[];
  registerService(config: AuthorityMcpServiceConfig): Promise<NormalizedMcpServiceRecord>;
  discoverAndSync(serviceId?: string): Promise<NormalizedMcpDiscoveryRecord>;
  controlService(
    serviceId: string,
    action: "enable" | "disable" | "pause" | "resume" | "isolate" | "activate",
    reason?: string,
  ): Promise<NormalizedMcpServiceRecord>;
  scheduleMaintenanceWindow(serviceId: string, window: AuthorityMcpMaintenanceWindow): Promise<NormalizedMcpServiceRecord>;
  removeMaintenanceWindow(serviceId: string, windowId: string): Promise<NormalizedMcpServiceRecord>;
  updateServicePolicy(
    serviceId: string,
    policy: {
      slo?: AuthorityMcpSloPolicy;
      traffic?: AuthorityMcpTrafficPolicy;
      failback?: AuthorityMcpFailbackPolicy;
      orchestration?: AuthorityMcpOrchestrationPolicy;
    },
  ): Promise<NormalizedMcpServiceRecord>;
  getPollingStatus(): NormalizedMcpPollingStatus;
  getMaintenanceStatus(): NormalizedMcpMaintenanceStatus;
}

const MCP_DIRECT_IMPORTS = [
  {
    path: "server/runtime/authorityRuntime.ts",
    usage: "runtime",
    reason: "Authority runtime owns transport construction and keeps the concrete transport wired into startup.",
    migrationPreference: "keep_direct",
  },
  {
    path: "server/services/authority/AuthorityMonitoringService.ts",
    usage: "authority-internal",
    reason: "Authority monitoring consumes transport snapshots as part of the current governance telemetry path.",
    migrationPreference: "keep_direct",
  },
  {
    path: "server/services/authority/AuthorityClusterCoordinationService.ts",
    usage: "authority-internal",
    reason: "Cluster coordination still inspects the transport from inside the authority runtime boundary.",
    migrationPreference: "keep_direct",
  },
  {
    path: "server/services/authority/AuthorityMcpTransportService.test.ts",
    usage: "test",
    reason: "Transport-specific tests still target the concrete service implementation directly.",
    migrationPreference: "keep_direct",
  },
  {
    path: "server/services/authority/AuthorityMonitoringService.test.ts",
    usage: "test",
    reason: "Monitoring tests validate transport-backed operational snapshots without facade indirection.",
    migrationPreference: "keep_direct",
  },
  {
    path: "server/services/governance/AuthorityLiveScenarioService.test.ts",
    usage: "test",
    reason: "Scenario tests still exercise the current authority-owned transport assembly path.",
    migrationPreference: "keep_direct",
  },
] as const satisfies readonly McpImportCensusEntry[];

function cloneMaintenanceWindow(window: AuthorityMcpMaintenanceWindow): AuthorityMcpMaintenanceWindow {
  return {
    ...window,
  };
}

function cloneToolDescriptor(tool: AuthorityMcpToolDescriptor): AuthorityMcpToolDescriptor {
  return {
    ...tool,
    inputSchema: { ...tool.inputSchema },
    outputSchema: { ...tool.outputSchema },
    tags: [...tool.tags],
    metadata: { ...tool.metadata },
  };
}

export function normalizeAuthorityMcpServiceConfig(config: AuthorityMcpServiceConfig): NormalizedMcpServiceDefinition {
  return {
    runtime: "authority",
    serviceId: config.serviceId,
    provider: config.provider,
    transport: config.transport,
    source: config.source,
    command: config.command,
    args: [...(config.args || [])],
    endpoint: config.endpoint,
    auth: {
      type: config.auth?.type || "none",
      hasToken: Boolean(config.auth?.token),
      headerName: config.auth?.headerName,
    },
    enabled: config.enabled,
    operationalMode: config.operationalMode || "active",
    modules: [...config.modules],
    priority: config.priority ?? 0,
    healthPolicy: {
      failureThreshold: config.failureThreshold ?? null,
      recoveryIntervalMs: config.recoveryIntervalMs ?? null,
      pollingIntervalMs: config.pollingIntervalMs ?? null,
      recoverySuccessThreshold: config.recoverySuccessThreshold ?? null,
    },
    defaults: {
      allowedDepartments: [...(config.defaultAllowedDepartments || [])],
      requiredCapabilities: [...(config.defaultRequiredCapabilities || [])],
      tags: [...(config.tags || [])],
    },
    maintenanceWindows: (config.maintenanceWindows || []).map((window) => cloneMaintenanceWindow(window)),
    policy: {
      slo: config.slo ? { ...config.slo } : null,
      traffic: config.traffic ? { ...config.traffic } : null,
      failback: config.failback ? { ...config.failback } : null,
      orchestration: config.orchestration
        ? {
            ...config.orchestration,
            preferredNodes: [...(config.orchestration.preferredNodes || [])],
            excludedNodes: [...(config.orchestration.excludedNodes || [])],
            regions: [...(config.orchestration.regions || [])],
            tags: [...(config.orchestration.tags || [])],
          }
        : null,
      toolPolicies: { ...(config.toolPolicies || {}) },
    },
  };
}

export function normalizeAuthorityMcpServiceSnapshot(snapshot: AuthorityMcpServiceSnapshot): NormalizedMcpServiceRecord {
  return {
    runtime: "authority",
    serviceId: snapshot.serviceId,
    provider: snapshot.provider,
    transport: snapshot.transport,
    source: snapshot.source,
    endpoint: snapshot.endpoint,
    enabled: snapshot.enabled,
    operationalMode: snapshot.operationalMode,
    toolCount: snapshot.toolCount,
    loadedModules: [...snapshot.loadedModules],
    moduleErrors: { ...snapshot.moduleErrors },
    health: {
      healthy: snapshot.healthy,
      status: snapshot.healthStatus,
      lastCheckedAt: snapshot.lastCheckedAt,
      lastStateChangeAt: snapshot.lastStateChangeAt,
      lastLatencyMs: snapshot.lastLatencyMs,
      lastError: snapshot.lastError,
      sloStatus: snapshot.sloStatus,
    },
    usage: {
      requestCount: snapshot.requestCount,
      successCount: snapshot.successCount,
      failureCount: snapshot.failureCount,
      successStreak: snapshot.successStreak,
      failureStreak: snapshot.failureStreak,
      lastUsedAt: snapshot.lastUsedAt,
      lastPollAt: snapshot.lastPollAt,
      successRate: snapshot.successRate,
      failureRate: snapshot.failureRate,
      recoveryAttemptCount: snapshot.recoveryAttemptCount,
      recoveryBlockedUntil: snapshot.recoveryBlockedUntil,
      recoveryLockoutUntil: snapshot.recoveryLockoutUntil,
      lastRecoveryAttemptAt: snapshot.lastRecoveryAttemptAt,
      stableSince: snapshot.stableSince,
    },
    traffic: {
      priority: snapshot.priority,
      configuredPercent: snapshot.configuredTrafficPercent,
      effectivePercent: snapshot.effectiveTrafficPercent,
      lane: snapshot.trafficLane,
      routeScore: snapshot.routeScore,
    },
    maintenance: {
      inMaintenance: snapshot.servicesInMaintenance,
      activeWindowId: snapshot.activeMaintenanceWindowId,
      activeAction: snapshot.activeMaintenanceAction,
      windowCount: snapshot.maintenanceWindowCount,
      conflictCount: snapshot.maintenanceConflictCount,
      lastRunAt: snapshot.lastMaintenanceRunAt,
    },
    orchestration: {
      group: snapshot.orchestrationGroup,
      template: snapshot.orchestrationTemplate,
      preferredNodes: [...snapshot.preferredNodes],
      excludedNodes: [...snapshot.excludedNodes],
      regions: [...snapshot.orchestrationRegions],
      tags: [...snapshot.orchestrationTags],
    },
  };
}

export function normalizeAuthorityMcpDiscoveryResult(result: AuthorityMcpDiscoveryResult): NormalizedMcpDiscoveryRecord {
  return {
    runtime: "authority",
    timestamp: result.timestamp,
    services: result.services.map((snapshot) => normalizeAuthorityMcpServiceSnapshot(snapshot)),
    tools: result.tools.map((tool) => cloneToolDescriptor(tool)),
    syncedTools: [...result.syncedTools],
  };
}

export function normalizeAuthorityMcpPollingStatus(status: ReturnType<AuthorityMcpTransportService["getPollingStatus"]>): NormalizedMcpPollingStatus {
  return {
    runtime: "authority",
    active: status.active,
    intervalMs: status.intervalMs,
    inFlight: status.inFlight,
    lastPollAt: status.lastPollAt,
    lastPollCompletedAt: status.lastPollCompletedAt,
  };
}

export function normalizeAuthorityMcpMaintenanceStatus(
  status: ReturnType<AuthorityMcpTransportService["getMaintenanceStatus"]>,
): NormalizedMcpMaintenanceStatus {
  return {
    runtime: "authority",
    active: status.active,
    intervalMs: status.intervalMs,
    inFlight: status.inFlight,
    lastRunAt: status.lastRunAt,
    lastCompletedAt: status.lastCompletedAt,
  };
}

export function createMcpImportCensus(): McpImportCensus {
  return {
    preferredFacade: "server/modules/integration/mcp",
    implementationClass: "AuthorityMcpTransportService",
    directImports: [...MCP_DIRECT_IMPORTS],
  };
}

export function createAuthorityMcpRegistryFacade(service: AuthorityMcpTransportService): McpRegistryFacade {
  return {
    implementation: "authority",
    listServices: () => service.listServices().map((snapshot) => normalizeAuthorityMcpServiceSnapshot(snapshot)),
    registerService: async (config) => normalizeAuthorityMcpServiceSnapshot(await service.registerService(config)),
    discoverAndSync: async (serviceId) => normalizeAuthorityMcpDiscoveryResult(await service.discoverAndSync(serviceId)),
    controlService: async (serviceId, action, reason) =>
      normalizeAuthorityMcpServiceSnapshot(await service.controlService(serviceId, action, reason)),
    scheduleMaintenanceWindow: async (serviceId, window) =>
      normalizeAuthorityMcpServiceSnapshot(await service.scheduleMaintenanceWindow(serviceId, window)),
    removeMaintenanceWindow: async (serviceId, windowId) =>
      normalizeAuthorityMcpServiceSnapshot(await service.removeMaintenanceWindow(serviceId, windowId)),
    updateServicePolicy: async (serviceId, policy) =>
      normalizeAuthorityMcpServiceSnapshot(await service.updateServicePolicy(serviceId, policy)),
    getPollingStatus: () => normalizeAuthorityMcpPollingStatus(service.getPollingStatus()),
    getMaintenanceStatus: () => normalizeAuthorityMcpMaintenanceStatus(service.getMaintenanceStatus()),
  };
}
