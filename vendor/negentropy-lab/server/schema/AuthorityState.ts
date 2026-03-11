import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

export class SystemState extends Schema {
  @type("string") mode: string = "normal";
  @type("string") status: string = "active";
  @type("number") systemTime: number = Date.now();
  @type("string") version: string = "phase16";
}

export class EntropyState extends Schema {
  @type("number") global: number = 0.3;
  @type("number") financial: number = 0.0;
  @type("number") biological: number = 0.0;
  @type("number") social: number = 0.0;
  @type("number") task: number = 0.0;
  @type("number") system: number = 0.0;
  @type("number") structural: number = 0.0;
  @type("number") alignment: number = 0.0;
  @type("number") breakerLevel: number = 0;
  @type({ map: "number" }) thresholds = new MapSchema<number>();
}

export class DepartmentState extends Schema {
  @type("string") code: string = "";
  @type("string") name: string = "";
  @type("string") role: string = "";
  @type("string") status: string = "active";
  @type("boolean") active: boolean = true;
  @type("number") lastHeartbeat: number = Date.now();
  @type({ map: "string" }) metadata = new MapSchema<string>();
}

export class AgentSessionState extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("string") department: string = "";
  @type("string") role: string = "";
  @type("string") sessionId: string = "";
  @type("string") sessionToken: string = "";
  @type("string") status: string = "idle";
  @type("string") connectionStatus: string = "disconnected";
  @type("string") healthStatus: string = "healthy";
  @type({ map: "string" }) capabilities = new MapSchema<string>();
  @type("string") model: string = "simulated";
  @type("string") provider: string = "simulated";
  @type("number") trustLevel: number = 1.0;
  @type("string") lane: string = "default";
  @type("number") capacity: number = 1;
  @type("number") currentLoad: number = 0;
  @type("number") pendingTasks: number = 0;
  @type("string") lease: string = "";
  @type("string") currentTaskId: string = "";
  @type("number") taskProgress: number = 0;
  @type("number") lastHeartbeat: number = Date.now();
  @type("number") leaseExpiresAt: number = 0;
  @type("boolean") available: boolean = true;
  @type("number") createdAt: number = Date.now();
  @type({ map: "string" }) metadata = new MapSchema<string>();
}

export class AuthorityTaskState extends Schema {
  @type("string") id: string = "";
  @type("string") type: string = "generic";
  @type("string") title: string = "";
  @type("string") department: string = "";
  @type("string") status: string = "pending";
  @type("string") priority: string = "normal";
  @type("number") priorityScore: number = 1;
  @type("number") progress: number = 0;
  @type("string") payload: string = "";
  @type("string") result: string = "";
  @type("string") error: string = "";
  @type("string") assignedTo: string = "";
  @type("string") sourceRoom: string = "";
  @type("number") timeoutMs: number = 60000;
  @type("number") createdAt: number = Date.now();
  @type("number") startedAt: number = 0;
  @type("number") updatedAt: number = Date.now();
  @type("number") finishedAt: number = 0;
  @type({ map: "string" }) metadata = new MapSchema<string>();
}

export class WorkflowRuntimeState extends Schema {
  @type("string") id: string = "";
  @type("string") type: string = "orchestration";
  @type("string") status: string = "waiting";
  @type({ map: "string" }) outputs = new MapSchema<string>();
  @type("number") updatedAt: number = Date.now();
}

export class GovernanceState extends Schema {
  @type({ map: "string" }) policies = new MapSchema<string>();
  @type({ array: "string" }) mutationQueue = new ArraySchema<string>();
  @type({ map: "string" }) proposals = new MapSchema<string>();
  @type({ map: "boolean" }) approvals = new MapSchema<boolean>();
  @type({ map: "string" }) sanctions = new MapSchema<string>();
  @type("number") breakerLevel: number = 0;
  @type("number") lastMutationAt: number = 0;
}

export class ToolState extends Schema {
  @type({ map: "string" }) registry = new MapSchema<string>();
  @type({ map: "string" }) metadata = new MapSchema<string>();
  @type({ map: "string" }) activeCalls = new MapSchema<string>();
  @type({ map: "string" }) lastResults = new MapSchema<string>();
  @type({ map: "number" }) quotas = new MapSchema<number>();
  @type("number") lastUpdate: number = Date.now();
}

export class CollaborationState extends Schema {
  @type({ map: "string" }) topics = new MapSchema<string>();
  @type({ map: "string" }) subscriptions = new MapSchema<string>();
  @type({ map: "string" }) lastMessages = new MapSchema<string>();
  @type("number") lastUpdate: number = Date.now();
}

export class ReplicationState extends Schema {
  @type("string") status: string = "idle";
  @type("string") logPath: string = "";
  @type("string") snapshotPath: string = "";
  @type("string") lastReplicatedEventId: string = "";
  @type("number") lastSnapshotAt: number = 0;
  @type("number") lastRecoveredAt: number = 0;
}

export class ClusterNodeProjectionState extends Schema {
  @type("string") nodeId: string = "";
  @type("string") role: string = "";
  @type("string") status: string = "offline";
  @type("string") host: string = "";
  @type("string") coordinationRole: string = "standalone";
  @type("number") healthScore: number = 0;
  @type("number") load: number = 1;
  @type("number") syncLagMs: number = 0;
  @type("number") lastSeen: number = 0;
  @type("string") lastCursor: string = "";
  @type({ map: "string" }) metadata = new MapSchema<string>();
}

export class ClusterCoordinationState extends Schema {
  @type("boolean") enabled: boolean = false;
  @type("string") clusterId: string = "";
  @type("string") coordinationMode: string = "standalone";
  @type("string") localNodeId: string = "";
  @type("string") leaderNodeId: string = "";
  @type("string") role: string = "standalone";
  @type("string") syncStatus: string = "idle";
  @type("number") leaderLeaseExpiresAt: number = 0;
  @type("number") lastLeaseRenewedAt: number = 0;
  @type("number") lastSyncAt: number = 0;
  @type("string") lastSyncCursor: string = "";
  @type("string") lastSyncSource: string = "";
  @type("number") lastPublishedAt: number = 0;
  @type("number") lastFailoverAt: number = 0;
  @type("number") lastRecommendationAt: number = 0;
  @type("number") activeNodeCount: number = 0;
  @type("number") degradedNodeCount: number = 0;
  @type("number") offlineNodeCount: number = 0;
  @type({ map: ClusterNodeProjectionState }) nodes = new MapSchema<ClusterNodeProjectionState>();
}

export class AuditState extends Schema {
  @type("string") eventCursor: string = "";
  @type("string") lastDecisionId: string = "";
  @type("string") lastMutationId: string = "";
  @type("number") integrity: number = 1.0;
  @type("number") totalEvents: number = 0;
}

export class AuthorityState extends Schema {
  @type(SystemState) system = new SystemState();
  @type(EntropyState) entropy = new EntropyState();
  @type({ map: DepartmentState }) departments = new MapSchema<DepartmentState>();
  @type({ map: AgentSessionState }) agents = new MapSchema<AgentSessionState>();
  @type({ map: AuthorityTaskState }) tasks = new MapSchema<AuthorityTaskState>();
  @type({ map: WorkflowRuntimeState }) workflows = new MapSchema<WorkflowRuntimeState>();
  @type(GovernanceState) governance = new GovernanceState();
  @type(ToolState) tools = new ToolState();
  @type(CollaborationState) collaboration = new CollaborationState();
  @type(ReplicationState) replication = new ReplicationState();
  @type(ClusterCoordinationState) cluster = new ClusterCoordinationState();
  @type(AuditState) audit = new AuditState();
  @type("string") roomId: string = "";
  @type("number") createdAt: number = Date.now();
  @type("number") lastUpdate: number = Date.now();
}
