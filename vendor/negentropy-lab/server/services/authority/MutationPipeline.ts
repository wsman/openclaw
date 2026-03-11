/**
 * @constitution
 * §101 同步公理: authority 变更流水线实现与真理源文档保持同步
 * §102 熵减原则: 保持 authority 流水线逻辑简洁可维护
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename MutationPipeline.ts
 * @version 1.0.0
 * @category authority
 * @last_updated 2026-03-10
 */

import {
  AgentSessionState,
  AuthorityState,
  AuthorityTaskState,
  DepartmentState,
  WorkflowRuntimeState,
} from "../../schema/AuthorityState";
import { BreakerService } from "../governance/BreakerService";
import { EntropyEngine } from "../governance/EntropyEngine";
import { EventStore } from "./EventStore";
import {
  AuthorityEventRecord,
  MutationOperation,
  MutationProposal,
  MutationProposalInput,
  MutationResult,
} from "./types";

function createId(prefix: string): string {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function toStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, string>>((acc, [key, entry]) => {
    acc[key] = String(entry);
    return acc;
  }, {});
}

export class MutationPipeline {
  constructor(
    private readonly state: AuthorityState,
    private readonly eventStore: EventStore,
    private readonly entropyEngine: EntropyEngine,
    private readonly breakerService: BreakerService,
  ) {}

  propose(input: MutationProposalInput): MutationResult {
    const proposal = this.normalize(input);
    const events: AuthorityEventRecord[] = [];

    events.push(
      this.createEvent(proposal, "mutation.proposed", {
        targetPath: proposal.targetPath,
        operation: proposal.operation,
        payload: proposal.payload as Record<string, unknown> | unknown,
        traceId: proposal.traceId,
      }),
    );
    this.state.governance.mutationQueue.push(proposal.mutationId);

    const validationError = this.validate(proposal);
    if (validationError) {
      events.push(this.createEvent(proposal, "mutation.rejected", { reason: validationError }));
      this.finalize(events, proposal.mutationId, false);
      return {
        ok: false,
        mutationId: proposal.mutationId,
        breakerLevel: this.state.governance.breakerLevel,
        snapshotVersion: this.state.audit.totalEvents,
        events,
        error: validationError,
      };
    }

    events.push(this.createEvent(proposal, "mutation.validated", { proposer: proposal.proposer }));
    events.push(
      this.createEvent(proposal, "mutation.simulated", {
        expectedDeltaEntropy: proposal.expectedDeltaEntropy,
        riskLevel: proposal.riskLevel,
      }),
    );

    const applyError = this.apply(proposal);
    if (applyError) {
      events.push(this.createEvent(proposal, "mutation.rejected", { reason: applyError }));
      this.finalize(events, proposal.mutationId, false);
      return {
        ok: false,
        mutationId: proposal.mutationId,
        breakerLevel: this.state.governance.breakerLevel,
        snapshotVersion: this.state.audit.totalEvents,
        events,
        error: applyError,
      };
    }

    events.push(this.createEvent(proposal, "mutation.approved", { reason: proposal.reason }));
    events.push(
      this.createEvent(proposal, "mutation.committed", {
        targetPath: proposal.targetPath,
        operation: proposal.operation,
        payload: proposal.payload as Record<string, unknown> | unknown,
        traceId: proposal.traceId,
      }),
    );

    this.entropyEngine.recalculate();
    const breaker = this.breakerService.evaluate();
    events.push(
      this.createEvent(proposal, "mutation.projected", {
        breakerLevel: breaker.level,
        globalEntropy: this.state.entropy.global,
      }),
    );

    this.state.system.systemTime = Date.now();
    this.state.governance.lastMutationAt = Date.now();
    this.state.lastUpdate = Date.now();
    events.push(
      this.createEvent(proposal, "mutation.audited", {
        integrity: this.state.audit.integrity,
        totalEvents: this.state.audit.totalEvents + events.length,
      }),
    );

    this.finalize(events, proposal.mutationId, true);

    return {
      ok: true,
      mutationId: proposal.mutationId,
      breakerLevel: breaker.level,
      snapshotVersion: this.state.audit.totalEvents,
      events,
    };
  }

  private normalize(input: MutationProposalInput): MutationProposal {
    return {
      mutationId: input.mutationId || createId("mutation"),
      proposer: input.proposer,
      targetPath: input.targetPath,
      operation: input.operation || "set",
      payload: input.payload,
      requiredCapabilities: input.requiredCapabilities || [],
      riskLevel: input.riskLevel || "low",
      expectedDeltaEntropy: input.expectedDeltaEntropy ?? 0,
      reason: input.reason || "unspecified",
      traceId: input.traceId || createId("trace"),
      timestamp: input.timestamp || Date.now(),
      metadata: input.metadata,
    };
  }

  private validate(proposal: MutationProposal): string | null {
    if (!proposal.proposer?.trim()) {
      return "proposer is required";
    }
    if (!proposal.targetPath?.trim()) {
      return "targetPath is required";
    }

    if (this.state.governance.breakerLevel >= 3 && proposal.riskLevel === "high") {
      return "system is in breaker level 3 lockdown";
    }

    if (proposal.targetPath.startsWith("agents.")) {
      const segments = proposal.targetPath.split(".");
      if (segments.length === 2 && proposal.operation !== "remove") {
        const payload = proposal.payload as Record<string, unknown>;
        if (!payload || typeof payload !== "object") {
          return "agent payload must be an object";
        }
        if (!payload.model || !payload.provider) {
          return "agent payload must include explicit model and provider";
        }
      }
    }

    if (proposal.requiredCapabilities.length > 0 && proposal.proposer !== "system" && proposal.proposer !== "system.bootstrap") {
      const agent = this.state.agents.get(proposal.proposer);
      if (!agent) {
        return `proposer ${proposal.proposer} is not registered`;
      }
      const missing = proposal.requiredCapabilities.filter((capability) => !agent.capabilities.has(capability) && !agent.capabilities.has("*"));
      if (missing.length > 0) {
        return `missing capabilities: ${missing.join(", ")}`;
      }
    }

    return null;
  }

  private apply(proposal: MutationProposal): string | null {
    const [root, ...rest] = proposal.targetPath.split(".");

    switch (root) {
      case "system":
        return this.applySystemMutation(rest, proposal.operation, proposal.payload);
      case "entropy":
        return this.applyEntropyMutation(rest, proposal.operation, proposal.payload);
      case "departments":
        return this.applyDepartmentMutation(rest, proposal.operation, proposal.payload);
      case "agents":
        return this.applyAgentMutation(rest, proposal.operation, proposal.payload);
      case "tasks":
        return this.applyTaskMutation(rest, proposal.operation, proposal.payload);
      case "workflows":
        return this.applyWorkflowMutation(rest, proposal.operation, proposal.payload);
      case "governance":
        return this.applyGovernanceMutation(rest, proposal.operation, proposal.payload);
      case "tools":
        return this.applyToolsMutation(rest, proposal.operation, proposal.payload);
      case "collaboration":
        return this.applyCollaborationMutation(rest, proposal.operation, proposal.payload);
      case "replication":
        return this.applyReplicationMutation(rest, proposal.operation, proposal.payload);
      case "audit":
        return this.applyAuditMutation(rest, proposal.operation, proposal.payload);
      default:
        return `unsupported mutation root: ${root}`;
    }
  }

  private applySystemMutation(path: string[], operation: MutationOperation, payload: unknown): string | null {
    if (path.length !== 1) {
      return "system mutations must target a direct property";
    }
    if (operation === "remove") {
      return "system properties cannot be removed";
    }
    (this.state.system as any)[path[0]] = payload as never;
    return null;
  }

  private applyEntropyMutation(path: string[], operation: MutationOperation, payload: unknown): string | null {
    if (path[0] === "thresholds" && path.length === 2) {
      const key = path[1];
      if (operation === "remove") {
        this.state.entropy.thresholds.delete(key);
      } else {
        this.state.entropy.thresholds.set(key, Number(payload));
      }
      return null;
    }
    if (path.length !== 1 || operation === "remove") {
      return "entropy mutations must target a direct property";
    }
    (this.state.entropy as any)[path[0]] = Number(payload);
    return null;
  }

  private applyDepartmentMutation(path: string[], operation: MutationOperation, payload: unknown): string | null {
    const [departmentId, property, nestedProperty] = path;
    if (!departmentId) {
      return "department id is required";
    }
    if (!property) {
      if (operation === "remove") {
        this.state.departments.delete(departmentId);
      } else {
        this.state.departments.set(departmentId, this.buildDepartmentState(payload, this.state.departments.get(departmentId)));
      }
      return null;
    }
    const department = this.state.departments.get(departmentId);
    if (!department) {
      return `department ${departmentId} not found`;
    }
    if (property === "metadata") {
      if (!nestedProperty) {
        if (operation === "remove") {
          department.metadata.clear();
        } else {
          Object.entries(toStringRecord(payload)).forEach(([key, value]) => department.metadata.set(key, value));
        }
        return null;
      }
      if (operation === "remove") {
        department.metadata.delete(nestedProperty);
      } else {
        department.metadata.set(nestedProperty, String(payload));
      }
      return null;
    }
    if (operation === "remove") {
      return "direct department field removal is not supported";
    }
    (department as any)[property] = payload as never;
    return null;
  }

  private applyAgentMutation(path: string[], operation: MutationOperation, payload: unknown): string | null {
    const [agentId, property, nestedProperty] = path;
    if (!agentId) {
      return "agent id is required";
    }
    if (!property) {
      if (operation === "remove") {
        this.state.agents.delete(agentId);
      } else {
        this.state.agents.set(agentId, this.buildAgentState(payload, this.state.agents.get(agentId)));
      }
      return null;
    }
    const agent = this.state.agents.get(agentId);
    if (!agent) {
      return `agent ${agentId} not found`;
    }
    if (property === "capabilities") {
      if (!nestedProperty) {
        if (operation === "remove") {
          agent.capabilities.clear();
        } else {
          agent.capabilities.clear();
          Object.entries(toStringRecord(payload)).forEach(([key, value]) => agent.capabilities.set(key, value));
        }
        return null;
      }
      if (operation === "remove") {
        agent.capabilities.delete(nestedProperty);
      } else {
        agent.capabilities.set(nestedProperty, String(payload));
      }
      return null;
    }
    if (property === "metadata") {
      if (!nestedProperty) {
        if (operation === "remove") {
          agent.metadata.clear();
        } else {
          Object.entries(toStringRecord(payload)).forEach(([key, value]) => agent.metadata.set(key, value));
        }
        return null;
      }
      if (operation === "remove") {
        agent.metadata.delete(nestedProperty);
      } else {
        agent.metadata.set(nestedProperty, String(payload));
      }
      return null;
    }
    if (operation === "remove") {
      return "direct agent field removal is not supported";
    }
    (agent as any)[property] = payload as never;
    return null;
  }

  private applyTaskMutation(path: string[], operation: MutationOperation, payload: unknown): string | null {
    const [taskId, property, nestedProperty] = path;
    if (!taskId) {
      return "task id is required";
    }
    if (!property) {
      if (operation === "remove") {
        this.state.tasks.delete(taskId);
      } else {
        this.state.tasks.set(taskId, this.buildTaskState(payload, this.state.tasks.get(taskId)));
      }
      return null;
    }
    const task = this.state.tasks.get(taskId);
    if (!task) {
      return `task ${taskId} not found`;
    }
    if (property === "metadata") {
      if (!nestedProperty) {
        if (operation === "remove") {
          task.metadata.clear();
        } else {
          Object.entries(toStringRecord(payload)).forEach(([key, value]) => task.metadata.set(key, value));
        }
        return null;
      }
      if (operation === "remove") {
        task.metadata.delete(nestedProperty);
      } else {
        task.metadata.set(nestedProperty, String(payload));
      }
      return null;
    }
    if (operation === "remove") {
      return "direct task field removal is not supported";
    }
    (task as any)[property] = payload as never;
    task.updatedAt = Date.now();
    return null;
  }

  private applyWorkflowMutation(path: string[], operation: MutationOperation, payload: unknown): string | null {
    const [workflowId, property, nestedProperty] = path;
    if (!workflowId) {
      return "workflow id is required";
    }
    if (!property) {
      if (operation === "remove") {
        this.state.workflows.delete(workflowId);
      } else {
        this.state.workflows.set(workflowId, this.buildWorkflowState(payload, this.state.workflows.get(workflowId)));
      }
      return null;
    }
    const workflow = this.state.workflows.get(workflowId);
    if (!workflow) {
      return `workflow ${workflowId} not found`;
    }
    if (property === "outputs") {
      if (!nestedProperty) {
        if (operation === "remove") {
          workflow.outputs.clear();
        } else {
          Object.entries(toStringRecord(payload)).forEach(([key, value]) => workflow.outputs.set(key, value));
        }
      } else if (operation === "remove") {
        workflow.outputs.delete(nestedProperty);
      } else {
        workflow.outputs.set(nestedProperty, String(payload));
      }
      workflow.updatedAt = Date.now();
      return null;
    }
    if (operation === "remove") {
      return "direct workflow field removal is not supported";
    }
    (workflow as any)[property] = payload as never;
    workflow.updatedAt = Date.now();
    return null;
  }

  private applyGovernanceMutation(path: string[], operation: MutationOperation, payload: unknown): string | null {
    const [bucket, key] = path;
    if (!bucket) {
      return "governance bucket is required";
    }
    const governance = this.state.governance as any;
    const target = governance[bucket];
    if (bucket === "breakerLevel" || bucket === "lastMutationAt") {
      if (operation === "remove") {
        return "governance scalar fields cannot be removed";
      }
      governance[bucket] = Number(payload);
      return null;
    }
    if (!target) {
      return `unsupported governance bucket: ${bucket}`;
    }
    if (!key) {
      return "governance map mutations require a key";
    }
    if (operation === "remove") {
      target.delete(key);
    } else {
      target.set(key, bucket === "approvals" ? Boolean(payload) : String(payload));
    }
    return null;
  }

  private applyToolsMutation(path: string[], operation: MutationOperation, payload: unknown): string | null {
    const [bucket, key] = path;
    if (!bucket) {
      return "tools bucket is required";
    }
    const tools = this.state.tools as any;
    const target = tools[bucket];
    if (!target) {
      return `unsupported tools bucket: ${bucket}`;
    }
    if (!key) {
      return "tools map mutations require a key";
    }
    if (operation === "remove") {
      target.delete(key);
    } else {
      target.set(key, bucket === "quotas" ? Number(payload) : String(payload));
    }
    this.state.tools.lastUpdate = Date.now();
    return null;
  }

  private applyCollaborationMutation(path: string[], operation: MutationOperation, payload: unknown): string | null {
    const [bucket, key] = path;
    if (!bucket) {
      return "collaboration bucket is required";
    }
    if (bucket === "lastUpdate") {
      if (operation === "remove") {
        return "collaboration.lastUpdate cannot be removed";
      }
      this.state.collaboration.lastUpdate = Number(payload);
      return null;
    }

    const collaboration = this.state.collaboration as any;
    const target = collaboration[bucket];
    if (!target) {
      return `unsupported collaboration bucket: ${bucket}`;
    }
    if (!key) {
      return "collaboration map mutations require a key";
    }
    if (operation === "remove") {
      target.delete(key);
    } else {
      target.set(key, String(payload));
    }
    this.state.collaboration.lastUpdate = Date.now();
    return null;
  }

  private applyReplicationMutation(path: string[], operation: MutationOperation, payload: unknown): string | null {
    if (path.length !== 1 || operation === "remove") {
      return "replication mutations must target a direct property";
    }
    (this.state.replication as any)[path[0]] = typeof payload === "number" ? Number(payload) : String(payload);
    return null;
  }

  private applyAuditMutation(path: string[], operation: MutationOperation, payload: unknown): string | null {
    if (path.length !== 1 || operation === "remove") {
      return "audit mutations must target a direct property";
    }
    (this.state.audit as any)[path[0]] = payload as never;
    return null;
  }

  private buildDepartmentState(payload: unknown, existing?: DepartmentState): DepartmentState {
    const department = existing || new DepartmentState();
    const input = (payload || {}) as Record<string, unknown>;
    department.code = String(input.code ?? department.code);
    department.name = String(input.name ?? department.name);
    department.role = String(input.role ?? department.role);
    department.status = String(input.status ?? department.status);
    department.active = input.active === undefined ? department.active : Boolean(input.active);
    department.lastHeartbeat = Number(input.lastHeartbeat ?? Date.now());
    Object.entries(toStringRecord(input.metadata)).forEach(([key, value]) => department.metadata.set(key, value));
    return department;
  }

  private buildAgentState(payload: unknown, existing?: AgentSessionState): AgentSessionState {
    const agent = existing || new AgentSessionState();
    const input = (payload || {}) as Record<string, unknown>;
    agent.id = String(input.id ?? agent.id);
    agent.name = String(input.name ?? agent.name);
    agent.department = String(input.department ?? agent.department);
    agent.role = String(input.role ?? agent.role);
    agent.sessionId = String(input.sessionId ?? agent.sessionId);
    agent.sessionToken = String(input.sessionToken ?? agent.sessionToken);
    agent.status = String(input.status ?? agent.status);
    agent.connectionStatus = String(input.connectionStatus ?? agent.connectionStatus);
    agent.healthStatus = String(input.healthStatus ?? agent.healthStatus);
    agent.model = String(input.model ?? agent.model);
    agent.provider = String(input.provider ?? agent.provider);
    agent.trustLevel = Number(input.trustLevel ?? agent.trustLevel);
    agent.lane = String(input.lane ?? agent.lane);
    agent.capacity = Number(input.capacity ?? agent.capacity);
    agent.currentLoad = Number(input.currentLoad ?? agent.currentLoad);
    agent.pendingTasks = Number(input.pendingTasks ?? agent.pendingTasks);
    agent.lease = String(input.lease ?? agent.lease);
    agent.currentTaskId = String(input.currentTaskId ?? agent.currentTaskId);
    agent.taskProgress = Number(input.taskProgress ?? agent.taskProgress);
    agent.lastHeartbeat = Number(input.lastHeartbeat ?? Date.now());
    agent.leaseExpiresAt = Number(input.leaseExpiresAt ?? agent.leaseExpiresAt);
    agent.available = input.available === undefined ? agent.available : Boolean(input.available);
    agent.createdAt = Number(input.createdAt ?? (agent.createdAt || Date.now()));
    if (input.capabilities) {
      agent.capabilities.clear();
      Object.entries(toStringRecord(input.capabilities)).forEach(([key, value]) => agent.capabilities.set(key, value));
    }
    Object.entries(toStringRecord(input.metadata)).forEach(([key, value]) => agent.metadata.set(key, value));
    return agent;
  }

  private buildTaskState(payload: unknown, existing?: AuthorityTaskState): AuthorityTaskState {
    const task = existing || new AuthorityTaskState();
    const input = (payload || {}) as Record<string, unknown>;
    task.id = String(input.id ?? task.id);
    task.type = String(input.type ?? task.type);
    task.title = String(input.title ?? task.title);
    task.department = String(input.department ?? task.department);
    task.status = String(input.status ?? task.status);
    task.priority = String(input.priority ?? task.priority);
    task.priorityScore = Number(input.priorityScore ?? task.priorityScore);
    task.progress = Number(input.progress ?? task.progress);
    task.payload = String(input.payload ?? task.payload);
    task.result = String(input.result ?? task.result);
    task.error = String(input.error ?? task.error);
    task.assignedTo = String(input.assignedTo ?? task.assignedTo);
    task.sourceRoom = String(input.sourceRoom ?? task.sourceRoom);
    task.timeoutMs = Number(input.timeoutMs ?? task.timeoutMs);
    task.createdAt = Number(input.createdAt ?? (task.createdAt || Date.now()));
    task.startedAt = Number(input.startedAt ?? task.startedAt);
    task.updatedAt = Number(input.updatedAt ?? Date.now());
    task.finishedAt = Number(input.finishedAt ?? task.finishedAt);
    if (input.metadata) {
      task.metadata.clear();
      Object.entries(toStringRecord(input.metadata)).forEach(([key, value]) => task.metadata.set(key, value));
    }
    return task;
  }

  private buildWorkflowState(payload: unknown, existing?: WorkflowRuntimeState): WorkflowRuntimeState {
    const workflow = existing || new WorkflowRuntimeState();
    const input = (payload || {}) as Record<string, unknown>;
    workflow.id = String(input.id ?? workflow.id);
    workflow.type = String(input.type ?? workflow.type);
    workflow.status = String(input.status ?? workflow.status);
    workflow.updatedAt = Number(input.updatedAt ?? Date.now());
    if (input.outputs) {
      workflow.outputs.clear();
      Object.entries(toStringRecord(input.outputs)).forEach(([key, value]) => workflow.outputs.set(key, value));
    }
    return workflow;
  }

  private createEvent(
    proposal: MutationProposal,
    type: AuthorityEventRecord["type"],
    payload: Record<string, unknown>,
  ): AuthorityEventRecord {
    return {
      eventId: createId("event"),
      mutationId: proposal.mutationId,
      type,
      timestamp: Date.now(),
      payload,
    };
  }

  private finalize(events: AuthorityEventRecord[], mutationId: string, success: boolean): void {
    this.eventStore.appendMany(events);
    this.state.audit.totalEvents = this.eventStore.count();
    this.state.audit.eventCursor = events.length > 0 ? events[events.length - 1].eventId : this.state.audit.eventCursor;
    this.state.audit.lastMutationId = mutationId;
    this.state.audit.integrity = success ? 1 : Math.max(0.7, this.state.audit.integrity - 0.05);
  }
}
