import { MapSchema } from "@colyseus/schema";
import {
  AgentSessionState,
  AuditState,
  AuthorityState,
  AuthorityTaskState,
  ClusterCoordinationState,
  ClusterNodeProjectionState,
  CollaborationState,
  DepartmentState,
  EntropyState,
  GovernanceState,
  ReplicationState,
  SystemState,
  ToolState,
  WorkflowRuntimeState,
} from "../schema/AuthorityState";

function clearMap<T>(map: MapSchema<T>): void {
  [...map.keys()].forEach((key) => map.delete(key));
}

function assignStringMap(target: MapSchema<string>, source?: Record<string, unknown>): void {
  clearMap(target);
  Object.entries(source || {}).forEach(([key, value]) => target.set(key, String(value)));
}

function assignNumberMap(target: MapSchema<number>, source?: Record<string, unknown>): void {
  clearMap(target);
  Object.entries(source || {}).forEach(([key, value]) => target.set(key, Number(value)));
}

function assignBooleanMap(target: MapSchema<boolean>, source?: Record<string, unknown>): void {
  clearMap(target);
  Object.entries(source || {}).forEach(([key, value]) => target.set(key, Boolean(value)));
}

function hydrateSystemState(target: SystemState, source: any = {}): void {
  target.mode = String(source.mode ?? target.mode);
  target.status = String(source.status ?? target.status);
  target.systemTime = Number(source.systemTime ?? target.systemTime);
  target.version = String(source.version ?? target.version);
}

function hydrateEntropyState(target: EntropyState, source: any = {}): void {
  target.global = Number(source.global ?? target.global);
  target.financial = Number(source.financial ?? target.financial);
  target.biological = Number(source.biological ?? target.biological);
  target.social = Number(source.social ?? target.social);
  target.task = Number(source.task ?? target.task);
  target.system = Number(source.system ?? target.system);
  target.structural = Number(source.structural ?? target.structural);
  target.alignment = Number(source.alignment ?? target.alignment);
  target.breakerLevel = Number(source.breakerLevel ?? target.breakerLevel);
  assignNumberMap(target.thresholds, source.thresholds);
}

function hydrateDepartmentState(target: DepartmentState, source: any = {}): void {
  target.code = String(source.code ?? target.code);
  target.name = String(source.name ?? target.name);
  target.role = String(source.role ?? target.role);
  target.status = String(source.status ?? target.status);
  target.active = Boolean(source.active ?? target.active);
  target.lastHeartbeat = Number(source.lastHeartbeat ?? target.lastHeartbeat);
  assignStringMap(target.metadata, source.metadata);
}

function hydrateAgentSessionState(target: AgentSessionState, source: any = {}): void {
  target.id = String(source.id ?? target.id);
  target.name = String(source.name ?? target.name);
  target.department = String(source.department ?? target.department);
  target.role = String(source.role ?? target.role);
  target.sessionId = String(source.sessionId ?? target.sessionId);
  target.sessionToken = String(source.sessionToken ?? target.sessionToken);
  target.status = String(source.status ?? target.status);
  target.connectionStatus = String(source.connectionStatus ?? target.connectionStatus);
  target.healthStatus = String(source.healthStatus ?? target.healthStatus);
  assignStringMap(target.capabilities, source.capabilities);
  target.model = String(source.model ?? target.model);
  target.provider = String(source.provider ?? target.provider);
  target.trustLevel = Number(source.trustLevel ?? target.trustLevel);
  target.lane = String(source.lane ?? target.lane);
  target.capacity = Number(source.capacity ?? target.capacity);
  target.currentLoad = Number(source.currentLoad ?? target.currentLoad);
  target.pendingTasks = Number(source.pendingTasks ?? target.pendingTasks);
  target.lease = String(source.lease ?? target.lease);
  target.currentTaskId = String(source.currentTaskId ?? target.currentTaskId);
  target.taskProgress = Number(source.taskProgress ?? target.taskProgress);
  target.lastHeartbeat = Number(source.lastHeartbeat ?? target.lastHeartbeat);
  target.leaseExpiresAt = Number(source.leaseExpiresAt ?? target.leaseExpiresAt);
  target.available = Boolean(source.available ?? target.available);
  target.createdAt = Number(source.createdAt ?? target.createdAt);
  assignStringMap(target.metadata, source.metadata);
}

function hydrateTaskState(target: AuthorityTaskState, source: any = {}): void {
  target.id = String(source.id ?? target.id);
  target.type = String(source.type ?? target.type);
  target.title = String(source.title ?? target.title);
  target.department = String(source.department ?? target.department);
  target.status = String(source.status ?? target.status);
  target.priority = String(source.priority ?? target.priority);
  target.priorityScore = Number(source.priorityScore ?? target.priorityScore);
  target.progress = Number(source.progress ?? target.progress);
  target.payload = String(source.payload ?? target.payload);
  target.result = String(source.result ?? target.result);
  target.error = String(source.error ?? target.error);
  target.assignedTo = String(source.assignedTo ?? target.assignedTo);
  target.sourceRoom = String(source.sourceRoom ?? target.sourceRoom);
  target.timeoutMs = Number(source.timeoutMs ?? target.timeoutMs);
  target.createdAt = Number(source.createdAt ?? target.createdAt);
  target.startedAt = Number(source.startedAt ?? target.startedAt);
  target.updatedAt = Number(source.updatedAt ?? target.updatedAt);
  target.finishedAt = Number(source.finishedAt ?? target.finishedAt);
  assignStringMap(target.metadata, source.metadata);
}

function hydrateWorkflowState(target: WorkflowRuntimeState, source: any = {}): void {
  target.id = String(source.id ?? target.id);
  target.type = String(source.type ?? target.type);
  target.status = String(source.status ?? target.status);
  assignStringMap(target.outputs, source.outputs);
  target.updatedAt = Number(source.updatedAt ?? target.updatedAt);
}

function hydrateGovernanceState(target: GovernanceState, source: any = {}): void {
  assignStringMap(target.policies, source.policies);
  target.mutationQueue.splice(0, target.mutationQueue.length);
  (source.mutationQueue || []).forEach((entry: unknown) => target.mutationQueue.push(String(entry)));
  assignStringMap(target.proposals, source.proposals);
  assignBooleanMap(target.approvals, source.approvals);
  assignStringMap(target.sanctions, source.sanctions);
  target.breakerLevel = Number(source.breakerLevel ?? target.breakerLevel);
  target.lastMutationAt = Number(source.lastMutationAt ?? target.lastMutationAt);
}

function hydrateToolState(target: ToolState, source: any = {}): void {
  assignStringMap(target.registry, source.registry);
  assignStringMap(target.metadata, source.metadata);
  assignStringMap(target.activeCalls, source.activeCalls);
  assignStringMap(target.lastResults, source.lastResults);
  assignNumberMap(target.quotas, source.quotas);
  target.lastUpdate = Number(source.lastUpdate ?? target.lastUpdate);
}

function hydrateCollaborationState(target: CollaborationState, source: any = {}): void {
  assignStringMap(target.topics, source.topics);
  assignStringMap(target.subscriptions, source.subscriptions);
  assignStringMap(target.lastMessages, source.lastMessages);
  target.lastUpdate = Number(source.lastUpdate ?? target.lastUpdate);
}

function hydrateReplicationState(target: ReplicationState, source: any = {}): void {
  target.status = String(source.status ?? target.status);
  target.logPath = String(source.logPath ?? target.logPath);
  target.snapshotPath = String(source.snapshotPath ?? target.snapshotPath);
  target.lastReplicatedEventId = String(source.lastReplicatedEventId ?? target.lastReplicatedEventId);
  target.lastSnapshotAt = Number(source.lastSnapshotAt ?? target.lastSnapshotAt);
  target.lastRecoveredAt = Number(source.lastRecoveredAt ?? target.lastRecoveredAt);
}

function hydrateClusterNodeProjectionState(target: ClusterNodeProjectionState, source: any = {}): void {
  target.nodeId = String(source.nodeId ?? target.nodeId);
  target.role = String(source.role ?? target.role);
  target.status = String(source.status ?? target.status);
  target.host = String(source.host ?? target.host);
  target.coordinationRole = String(source.coordinationRole ?? target.coordinationRole);
  target.healthScore = Number(source.healthScore ?? target.healthScore);
  target.load = Number(source.load ?? target.load);
  target.syncLagMs = Number(source.syncLagMs ?? target.syncLagMs);
  target.lastSeen = Number(source.lastSeen ?? target.lastSeen);
  target.lastCursor = String(source.lastCursor ?? target.lastCursor);
  assignStringMap(target.metadata, source.metadata);
}

function hydrateClusterCoordinationState(target: ClusterCoordinationState, source: any = {}): void {
  target.enabled = Boolean(source.enabled ?? target.enabled);
  target.clusterId = String(source.clusterId ?? target.clusterId);
  target.coordinationMode = String(source.coordinationMode ?? target.coordinationMode);
  target.localNodeId = String(source.localNodeId ?? target.localNodeId);
  target.leaderNodeId = String(source.leaderNodeId ?? target.leaderNodeId);
  target.role = String(source.role ?? target.role);
  target.syncStatus = String(source.syncStatus ?? target.syncStatus);
  target.leaderLeaseExpiresAt = Number(source.leaderLeaseExpiresAt ?? target.leaderLeaseExpiresAt);
  target.lastLeaseRenewedAt = Number(source.lastLeaseRenewedAt ?? target.lastLeaseRenewedAt);
  target.lastSyncAt = Number(source.lastSyncAt ?? target.lastSyncAt);
  target.lastSyncCursor = String(source.lastSyncCursor ?? target.lastSyncCursor);
  target.lastSyncSource = String(source.lastSyncSource ?? target.lastSyncSource);
  target.lastPublishedAt = Number(source.lastPublishedAt ?? target.lastPublishedAt);
  target.lastFailoverAt = Number(source.lastFailoverAt ?? target.lastFailoverAt);
  target.lastRecommendationAt = Number(source.lastRecommendationAt ?? target.lastRecommendationAt);
  target.activeNodeCount = Number(source.activeNodeCount ?? target.activeNodeCount);
  target.degradedNodeCount = Number(source.degradedNodeCount ?? target.degradedNodeCount);
  target.offlineNodeCount = Number(source.offlineNodeCount ?? target.offlineNodeCount);

  clearMap(target.nodes);
  Object.entries(source.nodes || {}).forEach(([key, value]) => {
    const entry = new ClusterNodeProjectionState();
    hydrateClusterNodeProjectionState(entry, value);
    target.nodes.set(key, entry);
  });
}

function hydrateAuditState(target: AuditState, source: any = {}): void {
  target.eventCursor = String(source.eventCursor ?? target.eventCursor);
  target.lastDecisionId = String(source.lastDecisionId ?? target.lastDecisionId);
  target.lastMutationId = String(source.lastMutationId ?? target.lastMutationId);
  target.integrity = Number(source.integrity ?? target.integrity);
  target.totalEvents = Number(source.totalEvents ?? target.totalEvents);
}

function stringMapToRecord(map: MapSchema<string>): Record<string, string> {
  return [...map.entries()].reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
}

function numberMapToRecord(map: MapSchema<number>): Record<string, number> {
  return [...map.entries()].reduce<Record<string, number>>((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
}

function booleanMapToRecord(map: MapSchema<boolean>): Record<string, boolean> {
  return [...map.entries()].reduce<Record<string, boolean>>((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
}

function decodeCollaborationKey(key: string): string {
  return key.replaceAll("__dot__", ".");
}

export function authorityStateToPlain(state: AuthorityState): Record<string, unknown> {
  return {
    system: {
      mode: state.system.mode,
      status: state.system.status,
      systemTime: state.system.systemTime,
      version: state.system.version,
    },
    entropy: {
      global: state.entropy.global,
      financial: state.entropy.financial,
      biological: state.entropy.biological,
      social: state.entropy.social,
      task: state.entropy.task,
      system: state.entropy.system,
      structural: state.entropy.structural,
      alignment: state.entropy.alignment,
      breakerLevel: state.entropy.breakerLevel,
      thresholds: numberMapToRecord(state.entropy.thresholds),
    },
    departments: [...state.departments.entries()].reduce<Record<string, unknown>>((acc, [key, value]) => {
      acc[key] = {
        code: value.code,
        name: value.name,
        role: value.role,
        status: value.status,
        active: value.active,
        lastHeartbeat: value.lastHeartbeat,
        metadata: stringMapToRecord(value.metadata),
      };
      return acc;
    }, {}),
    agents: [...state.agents.entries()].reduce<Record<string, unknown>>((acc, [key, value]) => {
      acc[key] = {
        id: value.id,
        name: value.name,
        department: value.department,
        role: value.role,
        sessionId: value.sessionId,
        sessionToken: value.sessionToken,
        status: value.status,
        connectionStatus: value.connectionStatus,
        healthStatus: value.healthStatus,
        capabilities: stringMapToRecord(value.capabilities),
        model: value.model,
        provider: value.provider,
        trustLevel: value.trustLevel,
        lane: value.lane,
        capacity: value.capacity,
        currentLoad: value.currentLoad,
        pendingTasks: value.pendingTasks,
        lease: value.lease,
        currentTaskId: value.currentTaskId,
        taskProgress: value.taskProgress,
        lastHeartbeat: value.lastHeartbeat,
        leaseExpiresAt: value.leaseExpiresAt,
        available: value.available,
        createdAt: value.createdAt,
        metadata: stringMapToRecord(value.metadata),
      };
      return acc;
    }, {}),
    tasks: [...state.tasks.entries()].reduce<Record<string, unknown>>((acc, [key, value]) => {
      acc[key] = {
        id: value.id,
        type: value.type,
        title: value.title,
        department: value.department,
        status: value.status,
        priority: value.priority,
        priorityScore: value.priorityScore,
        progress: value.progress,
        payload: value.payload,
        result: value.result,
        error: value.error,
        assignedTo: value.assignedTo,
        sourceRoom: value.sourceRoom,
        timeoutMs: value.timeoutMs,
        createdAt: value.createdAt,
        startedAt: value.startedAt,
        updatedAt: value.updatedAt,
        finishedAt: value.finishedAt,
        metadata: stringMapToRecord(value.metadata),
      };
      return acc;
    }, {}),
    workflows: [...state.workflows.entries()].reduce<Record<string, unknown>>((acc, [key, value]) => {
      acc[key] = {
        id: value.id,
        type: value.type,
        status: value.status,
        outputs: stringMapToRecord(value.outputs),
        updatedAt: value.updatedAt,
      };
      return acc;
    }, {}),
    governance: {
      policies: stringMapToRecord(state.governance.policies),
      mutationQueue: [...state.governance.mutationQueue],
      proposals: stringMapToRecord(state.governance.proposals),
      approvals: booleanMapToRecord(state.governance.approvals),
      sanctions: stringMapToRecord(state.governance.sanctions),
      breakerLevel: state.governance.breakerLevel,
      lastMutationAt: state.governance.lastMutationAt,
    },
    tools: {
      registry: stringMapToRecord(state.tools.registry),
      metadata: stringMapToRecord(state.tools.metadata),
      activeCalls: stringMapToRecord(state.tools.activeCalls),
      lastResults: stringMapToRecord(state.tools.lastResults),
      quotas: numberMapToRecord(state.tools.quotas),
      lastUpdate: state.tools.lastUpdate,
    },
    collaboration: {
      topics: [...state.collaboration.topics.entries()].reduce<Record<string, string>>((acc, [key, value]) => {
        acc[decodeCollaborationKey(key)] = value;
        return acc;
      }, {}),
      subscriptions: stringMapToRecord(state.collaboration.subscriptions),
      lastMessages: [...state.collaboration.lastMessages.entries()].reduce<Record<string, string>>((acc, [key, value]) => {
        acc[decodeCollaborationKey(key)] = value;
        return acc;
      }, {}),
      lastUpdate: state.collaboration.lastUpdate,
    },
    replication: {
      status: state.replication.status,
      logPath: state.replication.logPath,
      snapshotPath: state.replication.snapshotPath,
      lastReplicatedEventId: state.replication.lastReplicatedEventId,
      lastSnapshotAt: state.replication.lastSnapshotAt,
      lastRecoveredAt: state.replication.lastRecoveredAt,
    },
    cluster: {
      enabled: state.cluster.enabled,
      clusterId: state.cluster.clusterId,
      coordinationMode: state.cluster.coordinationMode,
      localNodeId: state.cluster.localNodeId,
      leaderNodeId: state.cluster.leaderNodeId,
      role: state.cluster.role,
      syncStatus: state.cluster.syncStatus,
      leaderLeaseExpiresAt: state.cluster.leaderLeaseExpiresAt,
      lastLeaseRenewedAt: state.cluster.lastLeaseRenewedAt,
      lastSyncAt: state.cluster.lastSyncAt,
      lastSyncCursor: state.cluster.lastSyncCursor,
      lastSyncSource: state.cluster.lastSyncSource,
      lastPublishedAt: state.cluster.lastPublishedAt,
      lastFailoverAt: state.cluster.lastFailoverAt,
      lastRecommendationAt: state.cluster.lastRecommendationAt,
      activeNodeCount: state.cluster.activeNodeCount,
      degradedNodeCount: state.cluster.degradedNodeCount,
      offlineNodeCount: state.cluster.offlineNodeCount,
      nodes: [...state.cluster.nodes.entries()].reduce<Record<string, unknown>>((acc, [key, value]) => {
        acc[key] = {
          nodeId: value.nodeId,
          role: value.role,
          status: value.status,
          host: value.host,
          coordinationRole: value.coordinationRole,
          healthScore: value.healthScore,
          load: value.load,
          syncLagMs: value.syncLagMs,
          lastSeen: value.lastSeen,
          lastCursor: value.lastCursor,
          metadata: stringMapToRecord(value.metadata),
        };
        return acc;
      }, {}),
    },
    audit: {
      eventCursor: state.audit.eventCursor,
      lastDecisionId: state.audit.lastDecisionId,
      lastMutationId: state.audit.lastMutationId,
      integrity: state.audit.integrity,
      totalEvents: state.audit.totalEvents,
    },
    roomId: state.roomId,
    createdAt: state.createdAt,
    lastUpdate: state.lastUpdate,
  };
}

export function hydrateAuthorityState(target: AuthorityState, source: any = {}): AuthorityState {
  hydrateSystemState(target.system, source.system);
  hydrateEntropyState(target.entropy, source.entropy);

  clearMap(target.departments);
  Object.entries(source.departments || {}).forEach(([key, value]) => {
    const entry = new DepartmentState();
    hydrateDepartmentState(entry, value);
    target.departments.set(key, entry);
  });

  clearMap(target.agents);
  Object.entries(source.agents || {}).forEach(([key, value]) => {
    const entry = new AgentSessionState();
    hydrateAgentSessionState(entry, value);
    target.agents.set(key, entry);
  });

  clearMap(target.tasks);
  Object.entries(source.tasks || {}).forEach(([key, value]) => {
    const entry = new AuthorityTaskState();
    hydrateTaskState(entry, value);
    target.tasks.set(key, entry);
  });

  clearMap(target.workflows);
  Object.entries(source.workflows || {}).forEach(([key, value]) => {
    const entry = new WorkflowRuntimeState();
    hydrateWorkflowState(entry, value);
    target.workflows.set(key, entry);
  });

  hydrateGovernanceState(target.governance, source.governance);
  hydrateToolState(target.tools, source.tools);
  hydrateCollaborationState(target.collaboration, source.collaboration);
  hydrateReplicationState(target.replication, source.replication);
  hydrateClusterCoordinationState(target.cluster, source.cluster);
  hydrateAuditState(target.audit, source.audit);
  target.roomId = String(source.roomId ?? target.roomId);
  target.createdAt = Number(source.createdAt ?? target.createdAt);
  target.lastUpdate = Number(source.lastUpdate ?? target.lastUpdate);

  return target;
}
