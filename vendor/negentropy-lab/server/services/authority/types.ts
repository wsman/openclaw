/**
 * @constitution
 * §101 同步公理: authority 类型定义与真理源文档保持同步
 * §102 熵减原则: 保持 authority 契约定义简洁可维护
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename types.ts
 * @version 1.0.0
 * @category authority/types
 * @last_updated 2026-03-10
 */

export type MutationOperation = "set" | "add" | "update" | "remove";
export type MutationRiskLevel = "low" | "medium" | "high";

export interface MutationProposal {
  mutationId: string;
  proposer: string;
  targetPath: string;
  operation: MutationOperation;
  payload: unknown;
  requiredCapabilities: string[];
  riskLevel: MutationRiskLevel;
  expectedDeltaEntropy: number;
  reason: string;
  traceId: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface MutationProposalInput {
  mutationId?: string;
  proposer: string;
  targetPath: string;
  operation?: MutationOperation;
  payload?: unknown;
  requiredCapabilities?: string[];
  riskLevel?: MutationRiskLevel;
  expectedDeltaEntropy?: number;
  reason?: string;
  traceId?: string;
  timestamp?: number;
  metadata?: Record<string, unknown>;
}

export type AuthorityEventType =
  | "mutation.proposed"
  | "mutation.validated"
  | "mutation.simulated"
  | "mutation.approved"
  | "mutation.committed"
  | "mutation.projected"
  | "mutation.audited"
  | "mutation.rejected"
  | "tool.registered"
  | "mcp.service.discovered"
  | "mcp.service.health.checked"
  | "mcp.service.polled"
  | "mcp.service.registered"
  | "mcp.service.controlled"
  | "mcp.service.state.changed"
  | "mcp.service.failover"
  | "mcp.service.window.scheduled"
  | "mcp.service.window.executed"
  | "mcp.service.window.removed"
  | "mcp.service.window.conflict.resolved"
  | "mcp.service.policy.updated"
  | "mcp.service.recovery.locked"
  | "mcp.service.traffic.routed"
  | "mcp.service.orchestration.updated"
  | "authority.cluster.leader.elected"
  | "authority.cluster.synced"
  | "authority.cluster.heartbeat"
  | "authority.cluster.failover"
  | "authority.cluster.recommendation"
  | "mcp.tool.synced"
  | "tool.call.started"
  | "tool.call.completed"
  | "tool.call.failed"
  | "governance.proposal.created"
  | "governance.vote.recorded"
  | "governance.proposal.resolved"
  | "workflow.pilot.executed"
  | "collaboration.subscription.created"
  | "collaboration.subscription.removed"
  | "collaboration.message.published"
  | "collaboration.message.direct"
  | "replication.event.persisted"
  | "replication.snapshot.created"
  | "replication.recovered";

export interface AuthorityEventRecord {
  eventId: string;
  mutationId: string;
  type: AuthorityEventType;
  timestamp: number;
  payload: Record<string, unknown>;
}

export interface MutationResult {
  ok: boolean;
  mutationId: string;
  breakerLevel: number;
  snapshotVersion: number;
  events: AuthorityEventRecord[];
  error?: string;
}

export interface ControlProjection {
  systemMode: string;
  systemStatus: string;
  systemHealth: number;
  globalEntropy: number;
  breakerLevel: number;
  activeAgents: number;
  pendingTasks: number;
  totalTasks: number;
  integrity: number;
}

export interface AgentProjection {
  total: number;
  active: number;
  idle: number;
  departments: Record<string, number>;
}

export interface TaskProjection {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  canceled: number;
  byDepartment: Record<string, number>;
}

export interface AgentSessionRegistrationInput {
  agentId: string;
  name: string;
  department: string;
  role: string;
  model: string;
  provider: string;
  capabilities: string[];
  trustLevel?: number;
  lane?: string;
  sessionId?: string;
  sessionToken?: string;
  capacity?: number;
  metadata?: Record<string, string>;
}

export interface AgentSessionHeartbeatInput {
  agentId: string;
  load?: number;
  pendingTasks?: number;
  healthStatus?: "healthy" | "degraded" | "unhealthy";
  sessionId?: string;
  metadata?: Record<string, string>;
}

export interface AgentSessionSnapshot {
  agentId: string;
  name: string;
  department: string;
  role: string;
  model: string;
  provider: string;
  status: string;
  connectionStatus: string;
  healthStatus: string;
  currentLoad: number;
  pendingTasks: number;
  lastHeartbeat: number;
  leaseExpiresAt: number;
  available: boolean;
  capabilities: string[];
}

export interface ToolRegistrationInput {
  toolName: string;
  source?: string;
  category?: string;
  protocol?: "builtin" | "mcp";
  version?: string;
  provider?: string;
  allowedDepartments?: string[];
  requiredDepartments?: string[];
  requiredCapabilities?: string[];
  approvalMode?: "auto" | "manual" | "denied";
  quotaKey?: string;
  quotaLimit?: number;
  tags?: string[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  examples?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
}

export interface ToolCatalogEntry {
  toolName: string;
  category: string;
  source: string;
  protocol: "builtin" | "mcp";
  version: string;
  provider: string;
  allowedDepartments: string[];
  requiredDepartments: string[];
  requiredCapabilities: string[];
  approvalMode: "auto" | "manual" | "denied";
  quotaKey: string;
  tags: string[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  examples: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
}

export interface ToolAccessDecision {
  allowed: boolean;
  reason: string;
  quotaRemaining: number | null;
}

export interface ToolDiscoveryQuery {
  agentId?: string;
  department?: string;
  capability?: string;
  protocol?: "builtin" | "mcp";
  tag?: string;
}

export interface ToolDiscoveryEntry {
  tool: ToolCatalogEntry;
  access: ToolAccessDecision;
}

export interface ToolUsageSnapshot {
  toolName: string;
  quotaKey: string;
  quotaLimit: number;
  usageCount: number;
  activeCalls: number;
  lastResultAt: number;
}

export interface AuthorityMcpToolPolicy {
  allowedDepartments?: string[];
  requiredDepartments?: string[];
  requiredCapabilities?: string[];
  approvalMode?: "auto" | "manual" | "denied";
  quotaLimit?: number;
  tags?: string[];
}

export interface AuthorityMcpMaintenanceWindow {
  windowId: string;
  startAt: number;
  endAt: number;
  recurrence?: "none" | "daily" | "weekly" | "monthly";
  action: "pause" | "disable" | "isolate";
  autoRecover?: boolean;
  reason?: string;
  enabled?: boolean;
  priority?: number;
  conflictPolicy?: "merge" | "defer" | "replace" | "reject";
}

export interface AuthorityMcpSloPolicy {
  targetLatencyMs?: number;
  minSuccessRate?: number;
  maxFailureRate?: number;
  routeBias?: number;
}

export interface AuthorityMcpTrafficPolicy {
  allocationPercent?: number;
  canaryPercent?: number;
  rampStepPercent?: number;
  rampIntervalMs?: number;
  lane?: "primary" | "canary" | "background";
}

export interface AuthorityMcpFailbackPolicy {
  maxRecoveryAttempts?: number;
  recoveryLockoutMs?: number;
  minHealthyDurationMs?: number;
}

export interface AuthorityMcpOrchestrationPolicy {
  serviceGroup?: string;
  templateId?: string;
  preferredNodes?: string[];
  excludedNodes?: string[];
  regions?: string[];
  tags?: string[];
}

export interface AuthorityMcpServiceConfig {
  serviceId: string;
  provider: string;
  transport: "stdio-subprocess" | "http";
  command?: string;
  args?: string[];
  endpoint?: string;
  auth?: {
    type: "none" | "bearer" | "api-key";
    token?: string;
    headerName?: string;
  };
  enabled: boolean;
  source: string;
  modules: string[];
  operationalMode?: "active" | "paused" | "isolated";
  priority?: number;
  failureThreshold?: number;
  recoveryIntervalMs?: number;
  pollingIntervalMs?: number;
  recoverySuccessThreshold?: number;
  maintenanceWindows?: AuthorityMcpMaintenanceWindow[];
  slo?: AuthorityMcpSloPolicy;
  traffic?: AuthorityMcpTrafficPolicy;
  failback?: AuthorityMcpFailbackPolicy;
  orchestration?: AuthorityMcpOrchestrationPolicy;
  defaultAllowedDepartments?: string[];
  defaultRequiredCapabilities?: string[];
  tags?: string[];
  toolPolicies?: Record<string, AuthorityMcpToolPolicy>;
}

export interface AuthorityMcpToolDescriptor {
  toolName: string;
  description: string;
  module: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface AuthorityMcpServiceSnapshot {
  serviceId: string;
  provider: string;
  transport: string;
  source: string;
  endpoint: string;
  enabled: boolean;
  healthy: boolean;
  healthStatus: "healthy" | "degraded" | "unhealthy" | "recovering";
  operationalMode: "active" | "paused" | "isolated";
  toolCount: number;
  loadedModules: string[];
  moduleErrors: Record<string, string>;
  priority: number;
  requestCount: number;
  successCount: number;
  failureCount: number;
  successStreak: number;
  failureStreak: number;
  lastUsedAt: number;
  lastPollAt: number;
  lastCheckedAt: number;
  lastStateChangeAt: number;
  recoveryBlockedUntil: number;
  recoveryAttemptCount: number;
  recoveryLockoutUntil: number;
  lastRecoveryAttemptAt: number;
  stableSince: number;
  successRate: number;
  failureRate: number;
  routeScore: number;
  sloStatus: "healthy" | "at-risk" | "violated";
  configuredTrafficPercent: number;
  effectiveTrafficPercent: number;
  trafficLane: "primary" | "canary" | "background";
  servicesInMaintenance: boolean;
  activeMaintenanceWindowId: string;
  activeMaintenanceAction: "" | "pause" | "disable" | "isolate";
  maintenanceWindowCount: number;
  maintenanceConflictCount: number;
  lastMaintenanceRunAt: number;
  orchestrationGroup: string;
  orchestrationTemplate: string;
  preferredNodes: string[];
  excludedNodes: string[];
  orchestrationRegions: string[];
  orchestrationTags: string[];
  lastLatencyMs: number;
  lastError: string;
}

export interface AuthorityMcpDiscoveryResult {
  services: AuthorityMcpServiceSnapshot[];
  tools: AuthorityMcpToolDescriptor[];
  syncedTools: string[];
  timestamp: number;
}

export interface AuthorityClusterNodeSnapshot {
  nodeId: string;
  role: string;
  status: string;
  host: string;
  coordinationRole: "leader" | "follower" | "standalone";
  healthScore: number;
  load: number;
  syncLagMs: number;
  lastSeen: number;
  lastCursor: string;
  serviceGroups: string[];
  metadata: Record<string, string>;
}

export interface AuthorityClusterCoordinationSnapshot {
  enabled: boolean;
  clusterId: string;
  coordinationMode: "standalone" | "memory" | "redis";
  localNodeId: string;
  leaderNodeId: string;
  role: "leader" | "follower" | "standalone";
  syncStatus: "idle" | "leader" | "follower" | "catching_up" | "stale";
  leaderLeaseExpiresAt: number;
  lastLeaseRenewedAt: number;
  lastSyncAt: number;
  lastSyncCursor: string;
  lastSyncSource: string;
  lastPublishedAt: number;
  lastFailoverAt: number;
  lastRecommendationAt: number;
  activeNodeCount: number;
  degradedNodeCount: number;
  offlineNodeCount: number;
  nodes: AuthorityClusterNodeSnapshot[];
}

export interface ToolCallContext {
  toolName: string;
  args: unknown;
  agentId: string;
  sessionId?: string;
}

export interface GovernanceProposalInput {
  proposalId?: string;
  title: string;
  department?: string;
  proposer: string;
  type?: string;
  options: string[];
  rationale?: string;
  metadata?: Record<string, unknown>;
}

export interface GovernanceVoteInput {
  proposalId: string;
  voterAgentId: string;
  option: string;
  rationale?: string;
}

export interface GovernanceProposalRecord {
  proposalId: string;
  title: string;
  department: string;
  proposer: string;
  type: string;
  status: "open" | "resolved";
  options: string[];
  votes: Array<{
    voterAgentId: string;
    option: string;
    rationale?: string;
    timestamp: number;
  }>;
  winner?: string;
  rationale?: string;
  createdAt: number;
  resolvedAt?: number;
  metadata: Record<string, unknown>;
}

export interface EntropyReport {
  global: number;
  financial: number;
  biological: number;
  social: number;
  task: number;
  system: number;
  structural: number;
  alignment: number;
  breakerLevel: number;
  thresholds: Record<string, number>;
  forecastGlobal: number;
  trend: "rising" | "falling" | "stable";
}

export interface AuthorityStorageFileStat {
  path: string;
  sizeBytes: number;
  updatedAt: number;
  kind: "snapshot" | "active-log" | "archive-log";
}

export interface AuthorityReplicationStorageStats {
  storageDir: string;
  snapshotBytes: number;
  activeLogBytes: number;
  archiveLogBytes: number;
  archiveCount: number;
  totalBytes: number;
  maxLogBytes: number;
  maxArchiveFiles: number;
  healthy: boolean;
  warnings: string[];
  files: AuthorityStorageFileStat[];
}

export interface AuthorityRecoveryStatus {
  attemptedAt: number;
  recovered: boolean;
  mode: "startup" | "manual";
  snapshotPath: string;
  eventCount: number;
  replayedLogCount: number;
  error?: string;
}

export interface AuthorityReplicationStatus {
  status: string;
  logPath: string;
  snapshotPath: string;
  lastReplicatedEventId: string;
  lastSnapshotAt: number;
  lastRecoveredAt: number;
  eventCount: number;
  autoSnapshotIntervalMs: number;
  autoSnapshotEventThreshold: number;
  lastAutoSnapshotAt: number;
  lastRotatedAt: number;
  lastError: string;
  storage: AuthorityReplicationStorageStats;
  recovery: AuthorityRecoveryStatus;
}

export interface AuthorityMonitoringSnapshot {
  status: "healthy" | "warning" | "critical";
  healthScore: number;
  generatedAt: number;
  alerts: string[];
  authority: {
    version: string;
    roomId: string;
    uptimeMs: number;
    lastUpdate: number;
    eventCount: number;
  };
  entropy: EntropyReport;
  breaker: {
    level: number;
    mode: string;
    status: string;
  };
  sessions: {
    total: number;
    connected: number;
    available: number;
    degraded: number;
    unhealthy: number;
    overloaded: number;
    busy: number;
  };
  tools: {
    registered: number;
    activeCalls: number;
    quotas: number;
    mcpServices: number;
    healthyMcpServices: number;
    degradedMcpServices: number;
    unhealthyMcpServices: number;
    recoveringMcpServices: number;
    servicesInMaintenance: number;
    sloViolatedMcpServices: number;
    recoveryLockedMcpServices: number;
    canaryMcpServices: number;
    maintenanceConflictMcpServices: number;
    orchestratedServiceGroups: number;
    pausedMcpServices: number;
    isolatedMcpServices: number;
    mcpPollingActive: boolean;
    lastMcpPollAt: number;
    lastMaintenanceRunAt: number;
    lastUpdate: number;
  };
  workflows: {
    total: number;
    active: number;
    blocked: number;
  };
  governance: {
    proposals: number;
    approvals: number;
    sanctions: number;
    mutationQueueDepth: number;
  };
  collaboration: {
    topics: number;
    subscriptions: number;
    lastMessages: number;
  };
  cluster: {
    enabled: boolean;
    coordinationMode: "standalone" | "memory" | "redis";
    localNodeId: string;
    leaderNodeId: string;
    role: "leader" | "follower" | "standalone";
    syncStatus: "idle" | "leader" | "follower" | "catching_up" | "stale";
    activeNodes: number;
    degradedNodes: number;
    offlineNodes: number;
    lastSyncAt: number;
    lastFailoverAt: number;
  };
  replication: AuthorityReplicationStatus;
}

export interface LiveAgentSyncResult {
  source: string;
  syncedAgents: number;
  disconnectedAgents: number;
  totalAuthoritySessions: number;
  sessions: AgentSessionSnapshot[];
  timestamp: number;
}

export interface LiveMorningBriefResult {
  brief: MorningBrief;
  collaboration?: Record<string, unknown>;
  participants: string[];
  publication: {
    envelopeId: string;
    topic?: string;
    recipients: string[];
  };
  monitoringStatus: string;
}

export interface BudgetConflictScenarioInput {
  title?: string;
  proposer?: string;
  department?: string;
  requestedAmount?: number;
  options?: string[];
  rationale?: string;
  topic?: string;
}

export interface BudgetConflictScenarioResult {
  proposal: GovernanceProposalRecord;
  resolvedProposal: GovernanceProposalRecord;
  collaboration?: Record<string, unknown>;
  voters: string[];
  requestedAmount: number;
  recommendedDecision: string;
  publication: {
    envelopeId: string;
    topic?: string;
    recipients: string[];
  };
}

export interface MorningBrief {
  generatedAt: number;
  breakerLevel: number;
  globalEntropy: number;
  forecastGlobal: number;
  activeAgents: number;
  pendingTasks: number;
  openProposals: number;
  recommendations: string[];
}

export interface EntropyDrillResult {
  triggeredAt: number;
  breakerLevel: number;
  mode: string;
  status: string;
  forecastGlobal: number;
  actions: string[];
}

export interface AgentEnvelope {
  envelopeId: string;
  traceId: string;
  kind: "topic" | "direct" | "workflow";
  from: string;
  to?: string;
  topic?: string;
  requiredCapabilities: string[];
  payload: unknown;
  timestamp: number;
}

export interface TopicSubscriptionInput {
  topic: string;
  agentId: string;
  requiredCapabilities?: string[];
}

export interface TopicPublicationInput {
  topic: string;
  from: string;
  payload: unknown;
  requiredCapabilities?: string[];
  traceId?: string;
}

export interface DirectMessageInput {
  from: string;
  to: string;
  payload: unknown;
  traceId?: string;
}
