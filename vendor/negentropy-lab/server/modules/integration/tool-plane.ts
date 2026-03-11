import { AuthorityToolCallBridge } from "../../services/authority/AuthorityToolCallBridge";
import type {
  ToolAccessDecision,
  ToolCallContext,
  ToolCatalogEntry,
  ToolDiscoveryEntry,
  ToolDiscoveryQuery,
  ToolRegistrationInput,
  ToolUsageSnapshot,
} from "../../services/authority/types";

export { AuthorityToolCallBridge };

export type {
  ToolAccessDecision,
  ToolCallContext,
  ToolCatalogEntry,
  ToolDiscoveryEntry,
  ToolDiscoveryQuery,
  ToolRegistrationInput,
  ToolUsageSnapshot,
};

export type ToolPlaneImplementationSurface = "authority";
export type ToolPlaneImportUsage = "runtime" | "authority-internal" | "test";
export type ToolPlaneMigrationPreference = "keep_direct" | "prefer_integration_facade";

export interface NormalizedToolCatalogRecord {
  runtime: ToolPlaneImplementationSurface;
  toolName: string;
  category: string;
  protocol: ToolCatalogEntry["protocol"];
  source: string;
  provider: string;
  version: string;
  approvalMode: ToolCatalogEntry["approvalMode"];
  allowedDepartments: string[];
  requiredDepartments: string[];
  requiredCapabilities: string[];
  quotaKey: string;
  tags: string[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  examples: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
  isMcpBacked: boolean;
  hasDepartmentScope: boolean;
  hasCapabilityScope: boolean;
}

export interface NormalizedToolAccessRecord {
  runtime: ToolPlaneImplementationSurface;
  allowed: boolean;
  reason: string;
  quotaRemaining: number | null;
  hasQuotaGuard: boolean;
}

export interface NormalizedToolDiscoveryRecord {
  runtime: ToolPlaneImplementationSurface;
  tool: NormalizedToolCatalogRecord;
  access: NormalizedToolAccessRecord;
}

export interface NormalizedToolUsageRecord {
  runtime: ToolPlaneImplementationSurface;
  toolName: string;
  usageCount: number;
  activeCalls: number;
  lastResultAt: number;
  quota: {
    key: string;
    limit: number;
    remaining: number | null;
  };
}

export interface ToolPlaneImportCensusEntry {
  path: string;
  usage: ToolPlaneImportUsage;
  reason: string;
  migrationPreference: ToolPlaneMigrationPreference;
}

export interface ToolPlaneImportCensus {
  preferredFacade: string;
  implementationClass: string;
  directImports: ToolPlaneImportCensusEntry[];
}

export interface ToolPlaneFacade {
  implementation: ToolPlaneImplementationSurface;
  getCatalog(): NormalizedToolCatalogRecord[];
  discover(query?: ToolDiscoveryQuery): NormalizedToolDiscoveryRecord[];
  getToolDefinition(toolName: string): NormalizedToolCatalogRecord | null;
  getAccessDecision(toolName: string, agentId?: string, fallbackDepartment?: string): NormalizedToolAccessRecord;
  getUsageSnapshot(): NormalizedToolUsageRecord[];
  registerTool(toolName: string, handler: (args: unknown) => Promise<unknown>): void;
  registerToolDefinition(definition: ToolRegistrationInput, handler: (args: unknown) => Promise<unknown>): void;
  callTool(toolName: string, args: unknown): Promise<unknown>;
  callToolWithContext(context: ToolCallContext): Promise<unknown>;
}

const TOOL_PLANE_DIRECT_IMPORTS = [
  {
    path: "server/runtime/authorityRuntime.ts",
    usage: "runtime",
    reason: "Authority runtime wires the concrete bridge into the current kernel startup path.",
    migrationPreference: "keep_direct",
  },
  {
    path: "server/services/authority/AuthorityMcpTransportService.ts",
    usage: "authority-internal",
    reason: "The MCP transport currently depends on the concrete bridge for tool registration and failover.",
    migrationPreference: "keep_direct",
  },
  {
    path: "server/services/authority/AuthorityToolCallBridge.test.ts",
    usage: "test",
    reason: "Bridge-specific tests still validate the concrete authority implementation directly.",
    migrationPreference: "keep_direct",
  },
  {
    path: "server/services/authority/AuthorityMcpTransportService.test.ts",
    usage: "test",
    reason: "Transport tests exercise the bridge and transport pairing as a concrete authority integration.",
    migrationPreference: "keep_direct",
  },
  {
    path: "server/services/authority/AuthorityMonitoringService.test.ts",
    usage: "test",
    reason: "Monitoring tests validate current authority service composition without facade indirection.",
    migrationPreference: "keep_direct",
  },
  {
    path: "server/services/governance/AuthorityLiveScenarioService.test.ts",
    usage: "test",
    reason: "Scenario tests still verify concrete runtime assembly from authority-owned services.",
    migrationPreference: "keep_direct",
  },
] as const satisfies readonly ToolPlaneImportCensusEntry[];

export function normalizeToolCatalogEntry(entry: ToolCatalogEntry): NormalizedToolCatalogRecord {
  const allowedDepartments = [...entry.allowedDepartments];
  const requiredDepartments = [...entry.requiredDepartments];
  const requiredCapabilities = [...entry.requiredCapabilities];

  return {
    runtime: "authority",
    toolName: entry.toolName,
    category: entry.category,
    protocol: entry.protocol,
    source: entry.source,
    provider: entry.provider,
    version: entry.version,
    approvalMode: entry.approvalMode,
    allowedDepartments,
    requiredDepartments,
    requiredCapabilities,
    quotaKey: entry.quotaKey,
    tags: [...entry.tags],
    inputSchema: { ...entry.inputSchema },
    outputSchema: { ...entry.outputSchema },
    examples: [...entry.examples],
    metadata: { ...entry.metadata },
    isMcpBacked: entry.protocol === "mcp",
    hasDepartmentScope: !(allowedDepartments.length === 1 && allowedDepartments[0] === "*") || requiredDepartments.length > 0,
    hasCapabilityScope: requiredCapabilities.length > 0,
  };
}

export function normalizeToolAccessDecision(decision: ToolAccessDecision): NormalizedToolAccessRecord {
  return {
    runtime: "authority",
    allowed: decision.allowed,
    reason: decision.reason,
    quotaRemaining: decision.quotaRemaining,
    hasQuotaGuard: decision.quotaRemaining !== null,
  };
}

export function normalizeToolDiscoveryEntry(entry: ToolDiscoveryEntry): NormalizedToolDiscoveryRecord {
  return {
    runtime: "authority",
    tool: normalizeToolCatalogEntry(entry.tool),
    access: normalizeToolAccessDecision(entry.access),
  };
}

export function normalizeToolUsageSnapshot(snapshot: ToolUsageSnapshot): NormalizedToolUsageRecord {
  const remaining = snapshot.quotaLimit > 0 ? Math.max(snapshot.quotaLimit - snapshot.usageCount, 0) : null;

  return {
    runtime: "authority",
    toolName: snapshot.toolName,
    usageCount: snapshot.usageCount,
    activeCalls: snapshot.activeCalls,
    lastResultAt: snapshot.lastResultAt,
    quota: {
      key: snapshot.quotaKey,
      limit: snapshot.quotaLimit,
      remaining,
    },
  };
}

export function createToolPlaneImportCensus(): ToolPlaneImportCensus {
  return {
    preferredFacade: "server/modules/integration/tool-plane",
    implementationClass: "AuthorityToolCallBridge",
    directImports: [...TOOL_PLANE_DIRECT_IMPORTS],
  };
}

export function createAuthorityToolPlaneFacade(bridge: AuthorityToolCallBridge): ToolPlaneFacade {
  return {
    implementation: "authority",
    getCatalog: () => bridge.getToolCatalog().map((entry) => normalizeToolCatalogEntry(entry)),
    discover: (query = {}) => bridge.discoverTools(query).map((entry) => normalizeToolDiscoveryEntry(entry)),
    getToolDefinition: (toolName) => {
      const definition = bridge.getToolDefinition(toolName);
      return definition ? normalizeToolCatalogEntry(definition) : null;
    },
    getAccessDecision: (toolName, agentId, fallbackDepartment) =>
      normalizeToolAccessDecision(bridge.getAccessDecision(toolName, agentId, fallbackDepartment)),
    getUsageSnapshot: () => bridge.getUsageSnapshot().map((snapshot) => normalizeToolUsageSnapshot(snapshot)),
    registerTool: (toolName, handler) => bridge.registerTool(toolName, async (args) => handler(args)),
    registerToolDefinition: (definition, handler) => bridge.registerToolDefinition(definition, async (args) => handler(args)),
    callTool: (toolName, args) => bridge.callTool(toolName, args),
    callToolWithContext: (context) => bridge.callToolWithContext(context),
  };
}
