import { AgentSessionState, AuthorityState, DepartmentState } from "../schema/AuthorityState";
import { authorityStateToPlain } from "./authorityStateSnapshot";
import { EventStore } from "../services/authority/EventStore";
import { AuthorityAgentSessionRegistry } from "../services/authority/AuthorityAgentSessionRegistry";
import { AuthorityClusterCoordinationService } from "../services/authority/AuthorityClusterCoordinationService";
import { AuthorityMcpTransportService } from "../services/authority/AuthorityMcpTransportService";
import { AuthorityMonitoringService } from "../services/authority/AuthorityMonitoringService";
import { AuthorityReplicationService } from "../services/authority/AuthorityReplicationService";
import { MutationPipeline } from "../services/authority/MutationPipeline";
import { ProjectionService } from "../services/authority/ProjectionService";
import { AuthorityToolCallBridge } from "../services/authority/AuthorityToolCallBridge";
import { CollaborationBus } from "../services/choreography/CollaborationBus";
import { AuthorityPilotWorkflowService } from "../services/governance/AuthorityPilotWorkflowService";
import { BreakerService } from "../services/governance/BreakerService";
import { ConflictResolver } from "../services/governance/ConflictResolver";
import { AuthorityLiveScenarioService } from "../services/governance/AuthorityLiveScenarioService";
import { EntropyEngine } from "../services/governance/EntropyEngine";

export interface AuthorityRuntime {
  state: AuthorityState;
  eventStore: EventStore;
  entropyEngine: EntropyEngine;
  breakerService: BreakerService;
  mutationPipeline: MutationPipeline;
  projectionService: ProjectionService;
  agentSessionRegistry: AuthorityAgentSessionRegistry;
  toolCallBridge: AuthorityToolCallBridge;
  mcpTransportService: AuthorityMcpTransportService;
  clusterCoordinationService: AuthorityClusterCoordinationService;
  monitoringService: AuthorityMonitoringService;
  conflictResolver: ConflictResolver;
  pilotWorkflowService: AuthorityPilotWorkflowService;
  liveScenarioService: AuthorityLiveScenarioService;
  collaborationBus: CollaborationBus;
  replicationService: AuthorityReplicationService;
}

const DEFAULT_DEPARTMENTS = [
  { key: "OFFICE", code: "OFFICE", name: "办公厅主任", role: "director" },
  { key: "TECHNOLOGY", code: "TECHNOLOGY", name: "科技部", role: "minister" },
  { key: "FOREIGN_AFFAIRS", code: "FOREIGN_AFFAIRS", name: "外交部", role: "minister" },
  { key: "MOS", code: "MOS", name: "监督部", role: "minister" },
  { key: "CABINET", code: "CABINET", name: "内阁", role: "cabinet" },
];

const DEFAULT_AGENTS = [
  {
    id: "agent:office_director",
    name: "办公厅主任",
    department: "OFFICE",
    role: "director",
    model: "zai/glm-5",
    provider: "zai",
    trustLevel: 1.0,
    capabilities: {
      "observe:*": "enabled",
      "propose:*": "enabled",
      "commit:*": "enabled",
      "govern:*": "enabled",
      "dispatch:*": "enabled",
      "invoke:tool:*": "enabled",
    },
  },
  {
    id: "agent:technology_ministry",
    name: "科技部",
    department: "TECHNOLOGY",
    role: "minister",
    model: "minimax/MiniMax-M2.5",
    provider: "minimax",
    trustLevel: 0.9,
    capabilities: {
      "observe:*": "enabled",
      "propose:*": "enabled",
      "invoke:tool:*": "enabled",
      "commit:technology:*": "enabled",
    },
  },
  {
    id: "agent:supervision_ministry",
    name: "监督部",
    department: "MOS",
    role: "minister",
    model: "zai/glm-4.7-flash",
    provider: "zai",
    trustLevel: 0.95,
    capabilities: {
      "observe:*": "enabled",
      "propose:*": "enabled",
      "govern:*": "enabled",
      "invoke:tool:audit:*": "enabled",
    },
  },
  {
    id: "agent:prime_minister",
    name: "内阁总理",
    department: "CABINET",
    role: "prime_minister",
    model: "zai/glm-5",
    provider: "zai",
    trustLevel: 1.0,
    capabilities: {
      "observe:*": "enabled",
      "propose:*": "enabled",
      "dispatch:*": "enabled",
      "govern:*": "enabled",
    },
  },
];

let runtime: AuthorityRuntime | null = null;

function seedThresholds(state: AuthorityState): void {
  const defaults: Record<string, number> = {
    global_warning: 0.7,
    global_danger: 0.85,
    global_critical: 0.9,
    system_critical: 0.7,
    financial_critical: 0.8,
  };
  Object.entries(defaults).forEach(([key, value]) => state.entropy.thresholds.set(key, value));
}

function seedDepartments(state: AuthorityState): void {
  DEFAULT_DEPARTMENTS.forEach((definition) => {
    const department = new DepartmentState();
    department.code = definition.code;
    department.name = definition.name;
    department.role = definition.role;
    department.status = "active";
    department.active = true;
    department.lastHeartbeat = Date.now();
    state.departments.set(definition.key, department);
  });
}

function seedPolicies(state: AuthorityState): void {
  state.governance.policies.set("authority.write_mode", "single-source-of-truth");
  state.governance.policies.set("phase16.projection_mode", "legacy-room-read-only");
  state.governance.policies.set("agent.model.explicit_required", "true");
  state.tools.quotas.set("default", 10);
}

function seedAgents(state: AuthorityState): void {
  DEFAULT_AGENTS.forEach((definition) => {
    const agent = new AgentSessionState();
    agent.id = definition.id;
    agent.name = definition.name;
    agent.department = definition.department;
    agent.role = definition.role;
    agent.model = definition.model;
    agent.provider = definition.provider;
    agent.trustLevel = definition.trustLevel;
    agent.available = true;
    agent.status = "idle";
    agent.connectionStatus = "connected";
    agent.healthStatus = "healthy";
    agent.sessionId = `seed:${definition.id}`;
    agent.sessionToken = `seed-token:${definition.id}`;
    agent.capacity = 2;
    agent.pendingTasks = 0;
    agent.leaseExpiresAt = Date.now() + 30000;
    Object.entries(definition.capabilities).forEach(([key, value]) => agent.capabilities.set(key, value));
    state.agents.set(agent.id, agent);
  });
}

function createRuntime(): AuthorityRuntime {
  const state = new AuthorityState();
  state.createdAt = Date.now();
  state.lastUpdate = state.createdAt;
  state.system.version = "phase20";
  seedThresholds(state);
  seedDepartments(state);
  seedPolicies(state);
  seedAgents(state);

  const eventStore = new EventStore();
  const entropyEngine = new EntropyEngine(state);
  const breakerService = new BreakerService(state);
  const projectionService = new ProjectionService(state);
  const mutationPipeline = new MutationPipeline(state, eventStore, entropyEngine, breakerService);
  const agentSessionRegistry = new AuthorityAgentSessionRegistry(state, mutationPipeline);
  const toolCallBridge = new AuthorityToolCallBridge(state, eventStore);
  const mcpTransportService = new AuthorityMcpTransportService(state, eventStore, toolCallBridge);
  const clusterCoordinationService = new AuthorityClusterCoordinationService(
    state,
    eventStore,
    mcpTransportService,
  );
  const conflictResolver = new ConflictResolver(state, mutationPipeline, eventStore);
  const pilotWorkflowService = new AuthorityPilotWorkflowService(
    state,
    mutationPipeline,
    eventStore,
    entropyEngine,
    breakerService,
  );
  const collaborationBus = new CollaborationBus(state, mutationPipeline, eventStore);
  const replicationService = new AuthorityReplicationService(state, eventStore, mutationPipeline);
  const monitoringService = new AuthorityMonitoringService(
    state,
    eventStore,
    entropyEngine,
    agentSessionRegistry,
    replicationService,
    mcpTransportService,
  );
  monitoringService.setClusterCoordinationService(clusterCoordinationService);
  const liveScenarioService = new AuthorityLiveScenarioService(
    state,
    mutationPipeline,
    eventStore,
    agentSessionRegistry,
    pilotWorkflowService,
    conflictResolver,
    collaborationBus,
    monitoringService,
  );

  replicationService.recover("startup");

  toolCallBridge.registerToolDefinition(
    {
      toolName: "mcp_authority_snapshot",
      source: "authority",
      allowedDepartments: ["*"],
      requiredCapabilities: ["observe:*"],
      quotaKey: "tool:mcp_authority_snapshot",
      metadata: {
        description: "Return authority snapshot",
      },
    },
    async () => getAuthoritySnapshot(),
  );
  toolCallBridge.registerToolDefinition(
    {
      toolName: "context_entropy_report",
      source: "authority",
      allowedDepartments: ["OFFICE", "MOS", "CABINET"],
      requiredCapabilities: ["observe:*"],
      quotaKey: "tool:context_entropy_report",
      metadata: {
        description: "Return current entropy dimensions",
      },
    },
    async () => ({
      global: state.entropy.global,
      system: state.entropy.system,
      financial: state.entropy.financial,
      social: state.entropy.social,
      task: state.entropy.task,
    }),
  );

  entropyEngine.recalculate();
  breakerService.evaluate(entropyEngine.getReport().forecastGlobal);

  return {
    state,
    eventStore,
    entropyEngine,
    breakerService,
    mutationPipeline,
    projectionService,
    agentSessionRegistry,
    toolCallBridge,
    mcpTransportService,
    clusterCoordinationService,
    monitoringService,
    conflictResolver,
    pilotWorkflowService,
    liveScenarioService,
    collaborationBus,
    replicationService,
  };
}

export function initializeAuthorityRuntime(force = false): AuthorityRuntime {
  if (!runtime || force) {
    runtime = createRuntime();
  }
  return runtime;
}

export function getAuthorityRuntime(): AuthorityRuntime {
  return runtime || initializeAuthorityRuntime();
}

export function peekAuthorityRuntime(): AuthorityRuntime | null {
  return runtime;
}

export function resetAuthorityRuntime(): void {
  runtime?.clusterCoordinationService.dispose();
  runtime?.mcpTransportService.dispose();
  runtime?.replicationService.dispose();
  runtime = null;
}

export function bindAuthorityRoom(roomId: string): AuthorityRuntime {
  const current = getAuthorityRuntime();
  current.state.roomId = roomId;
  current.state.lastUpdate = Date.now();
  return current;
}

export function getAuthoritySnapshot(): Record<string, unknown> {
  return authorityStateToPlain(getAuthorityRuntime().state) as Record<string, unknown>;
}
