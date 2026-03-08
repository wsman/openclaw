import { randomUUID } from "crypto";
import type { WorkflowAction } from "../actions/step-actions";
import { executeStep } from "../actions/step-actions";
import type { WorkflowDefinition, WorkflowStep } from "../contracts/workflow-contract";
import {
  type ChildSessionBinding,
  type WorkflowRunState,
  type WorkflowRunTraceEntry,
  type WorkflowRunTrigger,
  type WorkflowStepRuntimeState,
  WorkflowRunStore,
} from "../runtime/run-store";
import {
  isTerminalStatus,
  transitionStatus,
  type WorkflowRunStatus,
  type WorkflowStepStatus,
} from "../runtime/state-machine";
import { WorkflowRegistry, createDefaultWorkflowRegistry } from "./workflow-registry";

export type StartWorkflowRequest = {
  workflowId: string;
  trigger?: Partial<WorkflowRunTrigger>;
};

export type RetryWorkflowRequest = {
  runId: string;
  trigger?: Partial<WorkflowRunTrigger>;
};

export type ReconcileRunsRequest = {
  runId?: string;
  includeTerminal?: boolean;
  reason?: string;
};

export type ReconcileRunsResult = {
  ok: boolean;
  triggeredAt: string;
  reason: string;
  scanned: number;
  updated: number;
  deletedTerminalRuns: number;
  touchedRunIds: string[];
};

export type WorkflowRuntimeEventType =
  | "subagent_spawning"
  | "subagent_spawned"
  | "subagent_spawn_failed"
  | "subagent_ended"
  | "session_start"
  | "session_end"
  | "trace";

export type WorkflowRuntimeEvent = {
  type: WorkflowRuntimeEventType;
  runId?: string;
  stepId?: string;
  childSessionKey?: string;
  childRunId?: string;
  dedupeKey?: string;
  outcome?: "ok" | "error" | "timeout" | "killed" | "reset" | "deleted";
  error?: string;
  sessionId?: string;
  sessionKey?: string;
  message?: string;
  ts?: string;
  metadata?: Record<string, unknown>;
};

export type CancelRunRequest = {
  runId: string;
  reason?: string;
  emergency?: boolean;
};

export type ListRunsRequest = {
  workflowId?: string;
  status?: WorkflowRunStatus;
  limit?: number;
};

export type OrchestrationResult = {
  run?: WorkflowRunState;
  actions: WorkflowAction[];
  ignored?: boolean;
  message?: string;
};

type OrchestrationRuntimeConfig = {
  staleWaitingMs: number;
  terminalTtlMs: number;
  processedEventTtlMs: number;
  sweepIntervalMs: number;
};

const DEFAULT_RUNTIME_CONFIG: OrchestrationRuntimeConfig = {
  staleWaitingMs: Number(process.env.NEGENTROPY_WORKFLOW_STALE_WAITING_MS ?? 5 * 60_000),
  terminalTtlMs: Number(process.env.NEGENTROPY_WORKFLOW_TERMINAL_TTL_MS ?? 24 * 60 * 60_000),
  processedEventTtlMs: Number(process.env.NEGENTROPY_WORKFLOW_EVENT_TTL_MS ?? 6 * 60 * 60_000),
  sweepIntervalMs: Number(process.env.NEGENTROPY_WORKFLOW_SWEEP_INTERVAL_MS ?? 30_000),
};

function nowIso(): string {
  return new Date().toISOString();
}

function isStepTerminal(status: WorkflowStepStatus): boolean {
  return isTerminalStatus(status);
}

function elapsedMs(ts: string, now: string): number {
  return new Date(now).getTime() - new Date(ts).getTime();
}

function statusFingerprint(run: WorkflowRunState): string {
  const stepFingerprint = Object.values(run.steps)
    .map((step) => `${step.stepId}:${step.status}:${step.attempts}:${step.child?.childSessionKey ?? "-"}`)
    .sort()
    .join("|");
  return `${run.status}::${stepFingerprint}`;
}

function normalizeRuntimeNumber(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 1) {
    return fallback;
  }
  return Math.floor(value);
}

export class OrchestrationService {
  private readonly runtimeConfig: OrchestrationRuntimeConfig;
  private lastSweepAt = 0;

  constructor(
    private readonly registry: WorkflowRegistry = createDefaultWorkflowRegistry(),
    private readonly store: WorkflowRunStore = new WorkflowRunStore(
      process.env.NEGENTROPY_WORKFLOW_RUN_STORE_PATH,
    ),
    runtimeConfig?: Partial<OrchestrationRuntimeConfig>,
  ) {
    this.runtimeConfig = {
      staleWaitingMs: normalizeRuntimeNumber(
        runtimeConfig?.staleWaitingMs ?? DEFAULT_RUNTIME_CONFIG.staleWaitingMs,
        DEFAULT_RUNTIME_CONFIG.staleWaitingMs,
      ),
      terminalTtlMs: normalizeRuntimeNumber(
        runtimeConfig?.terminalTtlMs ?? DEFAULT_RUNTIME_CONFIG.terminalTtlMs,
        DEFAULT_RUNTIME_CONFIG.terminalTtlMs,
      ),
      processedEventTtlMs: normalizeRuntimeNumber(
        runtimeConfig?.processedEventTtlMs ?? DEFAULT_RUNTIME_CONFIG.processedEventTtlMs,
        DEFAULT_RUNTIME_CONFIG.processedEventTtlMs,
      ),
      sweepIntervalMs: normalizeRuntimeNumber(
        runtimeConfig?.sweepIntervalMs ?? DEFAULT_RUNTIME_CONFIG.sweepIntervalMs,
        DEFAULT_RUNTIME_CONFIG.sweepIntervalMs,
      ),
    };

    this.recoverRunsOnBoot();
  }

  startWorkflow(request: StartWorkflowRequest): OrchestrationResult {
    this.maybeRunMaintenance("start");

    const definition = this.registry.getWorkflow(request.workflowId);
    if (!definition) {
      return {
        ignored: true,
        actions: [],
        message: `workflow not found: ${request.workflowId}`,
      };
    }

    const runId = `wf_${randomUUID()}`;
    const run = this.store.createRun({
      runId,
      definition,
      trigger: {
        type: "manual",
        source: request.trigger?.source ?? "manual",
        requestedBy: request.trigger?.requestedBy,
        sessionKey: request.trigger?.sessionKey,
      },
      metadata: {
        createdBy: request.trigger?.requestedBy,
      },
    });

    run.status = transitionStatus(run.status, "ready", "run", run.runId);
    run.startedAt = nowIso();
    run.updatedAt = run.startedAt;
    run.metadata.lastWakeReason = "start";
    this.store.updateRun(run);

    this.appendTrace(run.runId, {
      level: "info",
      event: "workflow_started",
      message: `workflow ${definition.id} started manually`,
      data: {
        workflowId: definition.id,
      },
    });

    this.store.touchCheckpoint(run.runId, {
      lastTransitionAt: nowIso(),
    });

    return this.advanceRun(run.runId, definition, "start", true);
  }

  retryWorkflow(request: RetryWorkflowRequest): OrchestrationResult {
    this.maybeRunMaintenance("retry");

    const source = this.store.getRun(request.runId);
    if (!source) {
      return {
        ignored: true,
        actions: [],
        message: `run not found: ${request.runId}`,
      };
    }

    if (!isTerminalStatus(source.status)) {
      return {
        ignored: true,
        actions: [],
        message: `run is not terminal and cannot be retried: ${request.runId}`,
      };
    }

    const definition = this.registry.getWorkflow(source.workflowId);
    if (!definition) {
      return {
        ignored: true,
        actions: [],
        message: `workflow definition missing: ${source.workflowId}`,
      };
    }

    const runId = `wf_${randomUUID()}`;
    const run = this.store.createRun({
      runId,
      definition,
      trigger: {
        type: "manual",
        source: request.trigger?.source ?? `retry:${source.workflowId}`,
        requestedBy: request.trigger?.requestedBy,
        sessionKey: request.trigger?.sessionKey ?? source.trigger.sessionKey,
      },
      metadata: {
        createdBy: request.trigger?.requestedBy,
        retryOfRunId: source.runId,
      },
    });

    run.status = transitionStatus(run.status, "ready", "run", run.runId);
    run.startedAt = nowIso();
    run.updatedAt = run.startedAt;
    run.metadata.lastWakeReason = `retry:${source.runId}`;
    this.store.updateRun(run);

    this.appendTrace(run.runId, {
      level: "info",
      event: "workflow_retried",
      message: `workflow retried from ${source.runId}`,
      data: {
        workflowId: definition.id,
        retryOfRunId: source.runId,
      },
    });

    this.store.touchCheckpoint(run.runId, {
      lastTransitionAt: nowIso(),
    });

    return this.advanceRun(run.runId, definition, "retry", true);
  }

  reconcileRuns(request: ReconcileRunsRequest = {}): ReconcileRunsResult {
    const triggeredAt = nowIso();
    const reason = request.reason?.trim() || "manual_reconcile";

    this.lastSweepAt = Date.now();

    return this.sweepRuns(triggeredAt, reason, {
      runId: request.runId,
      includeTerminal: request.includeTerminal === true,
    });
  }

  handleEvent(event: WorkflowRuntimeEvent): OrchestrationResult {
    this.maybeRunMaintenance(`event:${event.type}`);

    const resolved = this.resolveRunForEvent(event);
    if (!resolved) {
      return {
        ignored: true,
        actions: [],
        message: "no workflow run matched the incoming event",
      };
    }

    const run = resolved;
    const definition = this.registry.getWorkflow(run.workflowId);
    if (!definition) {
      return {
        ignored: true,
        actions: [],
        message: `workflow definition missing: ${run.workflowId}`,
      };
    }

    const timestamp = event.ts ?? nowIso();
    const dedupeKey = this.resolveEventDedupeKey(event, run.runId);
    if (dedupeKey && this.store.hasProcessedEvent(run.runId, dedupeKey)) {
      this.appendTrace(run.runId, {
        ts: timestamp,
        level: "info",
        event: "duplicate_event_ignored",
        stepId: event.stepId,
        message: `duplicate event ignored (${event.type})`,
        data: {
          dedupeKey,
        },
      });
      return {
        ignored: true,
        run,
        actions: [],
        message: `duplicate event ignored: ${dedupeKey}`,
      };
    }

    const beforeFingerprint = statusFingerprint(run);

    run.eventLog.push({
      id: `${run.runId}:${run.eventLog.length + 1}`,
      ts: timestamp,
      runId: run.runId,
      type: event.type,
      stepId: event.stepId,
      dedupeKey,
      message: event.message,
      payload: {
        ...(event.childSessionKey ? { childSessionKey: event.childSessionKey } : {}),
        ...(event.childRunId ? { childRunId: event.childRunId } : {}),
        ...(event.outcome ? { outcome: event.outcome } : {}),
        ...(event.error ? { error: event.error } : {}),
        ...(event.sessionId ? { sessionId: event.sessionId } : {}),
        ...(event.sessionKey ? { sessionKey: event.sessionKey } : {}),
        ...(event.metadata ? { metadata: event.metadata } : {}),
      },
    });
    if (run.eventLog.length > 1200) {
      run.eventLog.splice(0, run.eventLog.length - 1200);
    }

    if (dedupeKey) {
      run.processedEvents[dedupeKey] = timestamp;
    }

    run.checkpoint = {
      ...run.checkpoint,
      sequence: Math.max(0, Math.floor(run.checkpoint.sequence ?? 0)) + 1,
      lastEventAt: timestamp,
    };

    this.appendTrace(run.runId, {
      ts: timestamp,
      level: event.type === "subagent_spawn_failed" ? "warn" : "info",
      event: event.type,
      stepId: event.stepId,
      message: event.message ?? `received ${event.type}`,
      data: {
        ...(event.childSessionKey ? { childSessionKey: event.childSessionKey } : {}),
        ...(event.childRunId ? { childRunId: event.childRunId } : {}),
        ...(event.outcome ? { outcome: event.outcome } : {}),
        ...(event.error ? { error: event.error } : {}),
      },
    });

    if (event.type === "subagent_spawning") {
      this.handleSubagentSpawningEvent(run, event, timestamp);
    } else if (event.type === "subagent_spawned") {
      this.handleSubagentSpawnedEvent(run, event, timestamp);
    } else if (event.type === "subagent_spawn_failed") {
      this.handleSubagentEndedLikeEvent(run, event, "error", timestamp);
    } else if (event.type === "subagent_ended") {
      this.handleSubagentEndedLikeEvent(run, event, event.outcome ?? "error", timestamp);
    } else if (event.type === "session_start") {
      this.handleSessionStartEvent(run, event, timestamp);
    } else if (event.type === "session_end") {
      this.handleSessionEndEvent(run, event, timestamp);
    }

    run.metadata.lastWakeReason = `event:${event.type}`;
    this.store.updateRun(run);
    const advanced = this.advanceRun(run.runId, definition, `event:${event.type}`, true);

    if (advanced.run && statusFingerprint(advanced.run) !== beforeFingerprint) {
      this.store.touchCheckpoint(run.runId, { lastTransitionAt: timestamp });
    }

    return advanced;
  }

  cancelRun(request: CancelRunRequest): OrchestrationResult {
    this.maybeRunMaintenance("cancel");

    const run = this.store.getRun(request.runId);
    if (!run) {
      return {
        ignored: true,
        actions: [],
        message: `run not found: ${request.runId}`,
      };
    }

    if (!isTerminalStatus(run.status)) {
      run.status = transitionStatus(run.status, "canceled", "run", run.runId);
      run.canceledAt = nowIso();
      run.completedAt = run.canceledAt;
      run.updatedAt = run.canceledAt;
      run.lastError = request.reason ?? (request.emergency ? "emergency stop" : "canceled");
      run.metadata.lastWakeReason = request.emergency ? "emergency_stop" : "cancel";

      for (const step of Object.values(run.steps)) {
        if (!isStepTerminal(step.status)) {
          step.status = transitionStatus(step.status, "canceled", "step", step.stepId);
          step.lastError = run.lastError;
          step.lastUpdatedAt = run.canceledAt;
          this.touchStepMetadata(step, {
            wakeReason: run.metadata.lastWakeReason,
            lastEventAt: run.canceledAt,
          });
        }
        if (step.child?.childSessionKey) {
          this.store.unbindChildSession({ childSessionKey: step.child.childSessionKey });
        }
      }

      this.store.updateRun(run);
      this.store.touchCheckpoint(run.runId, {
        lastTransitionAt: run.canceledAt,
        lastEventAt: run.canceledAt,
      });
      this.appendTrace(run.runId, {
        level: request.emergency ? "warn" : "info",
        event: request.emergency ? "run_emergency_stop" : "run_canceled",
        message: run.lastError,
      });
    }

    return {
      run: this.store.getRun(request.runId),
      actions: [],
    };
  }

  getRun(runId: string): WorkflowRunState | undefined {
    this.maybeRunMaintenance("get");

    const run = this.store.getRun(runId);
    if (!run) {
      return undefined;
    }

    const definition = this.registry.getWorkflow(run.workflowId);
    if (!definition) {
      return run;
    }

    return this.advanceRun(run.runId, definition, "read", false).run;
  }

  listRuns(request: ListRunsRequest = {}): WorkflowRunState[] {
    this.maybeRunMaintenance("list");

    const runs = this.store.listRuns().filter((run) => {
      if (request.workflowId && run.workflowId !== request.workflowId) {
        return false;
      }
      if (request.status && run.status !== request.status) {
        return false;
      }
      return true;
    });

    const limit = request.limit && request.limit > 0 ? request.limit : runs.length;
    return runs.slice(0, limit).map((run) => {
      const definition = this.registry.getWorkflow(run.workflowId);
      if (!definition) {
        return run;
      }
      return this.advanceRun(run.runId, definition, "list", false).run ?? run;
    });
  }

  getRunTrace(runId: string): WorkflowRunTraceEntry[] {
    return this.getRun(runId)?.trace ?? [];
  }

  private resolveRunForEvent(event: WorkflowRuntimeEvent): WorkflowRunState | undefined {
    if (event.runId) {
      const run = this.store.getRun(event.runId);
      if (run) {
        return run;
      }
    }

    const binding = this.store.findChildBinding({
      childSessionKey: event.childSessionKey ?? event.sessionKey,
      childRunId: event.childRunId,
    });

    if (!binding) {
      return undefined;
    }

    return this.store.getRun(binding.runId);
  }

  private advanceRun(
    runId: string,
    definition: WorkflowDefinition,
    reason: string,
    allowStepExecution: boolean,
  ): OrchestrationResult {
    const run = this.store.getRun(runId);
    if (!run) {
      return { ignored: true, actions: [], message: `run not found: ${runId}` };
    }

    const actions: WorkflowAction[] = [];
    const stepById = new Map(definition.steps.map((step) => [step.id, step]));
    let didProgress = false;

    if (isTerminalStatus(run.status)) {
      return { run, actions };
    }

    const now = nowIso();
    didProgress = this.refreshRunTimeout(run, now) || didProgress;
    if (isTerminalStatus(run.status)) {
      this.store.updateRun(run);
      return { run: this.store.getRun(runId), actions };
    }

    didProgress = this.refreshTimedOutSteps(run, definition, now, allowStepExecution) || didProgress;
    didProgress = this.refreshWaitingSteps(run, definition, stepById) || didProgress;

    if (allowStepExecution) {
      let loopGuard = 0;
      while (loopGuard < 200) {
        loopGuard += 1;
        let progressedInLoop = false;

        for (const step of definition.steps) {
          const stepState = run.steps[step.id];
          if (!stepState || isStepTerminal(stepState.status)) {
            continue;
          }

          if (stepState.status === "pending" && this.isStepConditionSatisfied(stepState, run)) {
            stepState.status = transitionStatus(stepState.status, "ready", "step", step.id);
            stepState.lastUpdatedAt = nowIso();
            this.touchStepMetadata(stepState, { wakeReason: "dependencies_satisfied" });
            progressedInLoop = true;
          }

          if (stepState.status !== "ready") {
            continue;
          }

          this.executeStep(definition, run, step, stepState, actions);
          progressedInLoop = true;

          if (isTerminalStatus(run.status)) {
            break;
          }
        }

        const refreshedWaiters = this.refreshWaitingSteps(run, definition, stepById);
        progressedInLoop = progressedInLoop || refreshedWaiters;
        didProgress = didProgress || progressedInLoop;

        if (!progressedInLoop || isTerminalStatus(run.status)) {
          break;
        }
      }
    }

    const beforeStatus = run.status;
    this.updateRunStatus(run);
    if (beforeStatus !== run.status) {
      const ts = nowIso();
      run.checkpoint = {
        ...run.checkpoint,
        sequence: Math.max(0, Math.floor(run.checkpoint.sequence ?? 0)) + 1,
        lastTransitionAt: ts,
      };
    }

    run.updatedAt = nowIso();
    this.store.updateRun(run);

    if (didProgress) {
      this.appendTrace(run.runId, {
        level: "info",
        event: "run_advanced",
        message: `run advanced (${reason})`,
        data: {
          status: run.status,
          actionCount: actions.length,
          allowStepExecution,
        },
      });
    }

    return { run: this.store.getRun(runId), actions };
  }

  private executeStep(
    definition: WorkflowDefinition,
    run: WorkflowRunState,
    step: WorkflowStep,
    stepState: WorkflowStepRuntimeState,
    actions: WorkflowAction[],
  ): void {
    stepState.status = transitionStatus(stepState.status, "running", "step", step.id);
    stepState.attempts += 1;
    stepState.startedAt = nowIso();
    stepState.lastUpdatedAt = stepState.startedAt;
    this.touchStepMetadata(stepState, {
      wakeReason: "step_execute",
      lastEventAt: stepState.startedAt,
    });

    const result = executeStep({
      run,
      step,
      stepState,
      now: stepState.startedAt,
      resolveChildSessionKey: ({ runId: currentRunId, stepId, attempt }) =>
        `${currentRunId}:${stepId}:child:${attempt}`,
      collectStepOutputs: (stepIds) => {
        const joined: Record<string, unknown> = {};
        for (const sourceId of stepIds) {
          joined[sourceId] = run.steps[sourceId]?.output ?? null;
        }
        return joined;
      },
    });

    if (result.output) {
      stepState.output = {
        ...(stepState.output ?? {}),
        ...result.output,
      };
      run.outputs[step.id] = stepState.output;
    }

    if (result.action) {
      actions.push(result.action);
    }

    if (result.status === "waiting") {
      stepState.status = transitionStatus(stepState.status, "waiting", "step", step.id);
      stepState.waitingSince = nowIso();

      const childSessionKey = stepState.output?.childSessionKey;
      if (step.type === "spawn_agent" && typeof childSessionKey === "string") {
        stepState.child = {
          childSessionKey,
          boundAt: nowIso(),
        };
        this.store.bindChildSession({
          runId: run.runId,
          stepId: step.id,
          childSessionKey,
        });
      }

      stepState.lastUpdatedAt = nowIso();
      this.touchStepMetadata(stepState, {
        wakeReason: "waiting_for_child",
        lastEventAt: stepState.lastUpdatedAt,
      });
      return;
    }

    if (result.status === "completed") {
      stepState.status = transitionStatus(stepState.status, "completed", "step", step.id);
      stepState.completedAt = nowIso();
      stepState.lastUpdatedAt = stepState.completedAt;
      this.touchStepMetadata(stepState, {
        wakeReason: "step_completed",
        lastEventAt: stepState.completedAt,
      });
    } else if (result.status === "failed") {
      this.markStepFailure(run, stepState, result.error ?? "step execution failed", "failed");
    }

    if (result.runTerminalStatus === "completed") {
      if (!isTerminalStatus(run.status)) {
        run.status = transitionStatus(run.status, "completed", "run", run.runId);
      }
      run.completedAt = nowIso();
      run.outputs.final = {
        stepId: step.id,
        message: stepState.output?.message ?? "workflow completed",
      };
    }

    if (result.runTerminalStatus === "failed") {
      this.markRunFailed(run, stepState.output?.reason ?? "workflow escalated", "failed");
    }

    if (stepState.child?.childSessionKey && isStepTerminal(stepState.status)) {
      this.store.unbindChildSession({ childSessionKey: stepState.child.childSessionKey });
    }
  }

  private isStepConditionSatisfied(stepState: WorkflowStepRuntimeState, run: WorkflowRunState): boolean {
    if (stepState.dependsOn.length === 0) {
      return true;
    }

    const dependencies = stepState.dependsOn
      .map((dependencyId) => run.steps[dependencyId])
      .filter((step): step is WorkflowStepRuntimeState => Boolean(step));

    if (dependencies.length !== stepState.dependsOn.length) {
      return false;
    }

    const allTerminal = dependencies.every((step) => isStepTerminal(step.status));
    if (!allTerminal) {
      return false;
    }

    if (stepState.when === "always") {
      return true;
    }

    if (stepState.when === "on_failure") {
      return dependencies.some((step) => ["failed", "timed_out", "canceled"].includes(step.status));
    }

    return dependencies.every((step) => step.status === "completed");
  }

  private refreshWaitingSteps(
    run: WorkflowRunState,
    definition: WorkflowDefinition,
    stepById: Map<string, WorkflowStep>,
  ): boolean {
    let changed = false;

    for (const stepState of Object.values(run.steps)) {
      if (stepState.status !== "waiting") {
        continue;
      }

      const definitionStep = stepById.get(stepState.stepId);
      if (!definitionStep) {
        continue;
      }

      if (definitionStep.type === "await_subagent") {
        const source = run.steps[definitionStep.sourceStepId];
        if (!source) {
          continue;
        }

        if (source.status === "completed") {
          stepState.status = transitionStatus(stepState.status, "completed", "step", stepState.stepId);
          stepState.completedAt = nowIso();
          stepState.output = {
            sourceStepId: definitionStep.sourceStepId,
            sourceOutput: source.output ?? null,
          };
          run.outputs[stepState.stepId] = stepState.output;
          stepState.lastUpdatedAt = stepState.completedAt;
          this.touchStepMetadata(stepState, {
            wakeReason: "source_completed",
            lastEventAt: stepState.completedAt,
          });
          changed = true;
        } else if (["failed", "timed_out", "canceled"].includes(source.status)) {
          this.markStepFailure(
            run,
            stepState,
            source.lastError ?? `source step ${definitionStep.sourceStepId} failed`,
            source.status === "timed_out" ? "timed_out" : "failed",
          );
          changed = true;
        }
      }

      if (definitionStep.type === "join_results") {
        const dependencies = stepState.dependsOn.map((id) => run.steps[id]);
        if (dependencies.every((step) => step?.status === "completed")) {
          stepState.status = transitionStatus(stepState.status, "completed", "step", stepState.stepId);
          stepState.completedAt = nowIso();
          stepState.lastUpdatedAt = stepState.completedAt;
          this.touchStepMetadata(stepState, {
            wakeReason: "join_completed",
            lastEventAt: stepState.completedAt,
          });
          changed = true;
        }
      }
    }

    if (changed) {
      this.store.updateRun(run);
    }

    return changed;
  }

  private refreshRunTimeout(run: WorkflowRunState, now: string): boolean {
    if (isTerminalStatus(run.status)) {
      return false;
    }

    if (!run.startedAt || !run.timeoutMs || run.timeoutMs < 1) {
      return false;
    }

    if (elapsedMs(run.startedAt, now) <= run.timeoutMs) {
      return false;
    }

    run.status = transitionStatus(run.status, "timed_out", "run", run.runId);
    run.lastError = `run timed out after ${run.timeoutMs}ms`;
    run.completedAt = now;
    run.updatedAt = now;
    run.metadata.lastWakeReason = "run_timeout";

    for (const stepState of Object.values(run.steps)) {
      if (isStepTerminal(stepState.status)) {
        continue;
      }
      stepState.status = transitionStatus(stepState.status, "timed_out", "step", stepState.stepId);
      stepState.lastError = run.lastError;
      stepState.lastUpdatedAt = now;
      if (stepState.child?.childSessionKey) {
        this.store.unbindChildSession({ childSessionKey: stepState.child.childSessionKey });
      }
      this.touchStepMetadata(stepState, {
        wakeReason: "run_timeout",
        lastEventAt: now,
      });
    }

    this.appendTrace(run.runId, {
      ts: now,
      level: "warn",
      event: "run_timeout",
      message: run.lastError,
    });
    run.checkpoint = {
      ...run.checkpoint,
      sequence: Math.max(0, Math.floor(run.checkpoint.sequence ?? 0)) + 1,
      lastTransitionAt: now,
      lastEventAt: now,
    };

    return true;
  }

  private refreshTimedOutSteps(
    run: WorkflowRunState,
    definition: WorkflowDefinition,
    now: string,
    allowRetryRequeue: boolean,
  ): boolean {
    let changed = false;

    for (const stepState of Object.values(run.steps)) {
      if (!["running", "waiting"].includes(stepState.status)) {
        continue;
      }

      const timeoutMs = stepState.timeoutMs ?? definition.timeoutMs;
      if (!timeoutMs) {
        continue;
      }

      const since = stepState.waitingSince ?? stepState.startedAt;
      if (!since) {
        continue;
      }

      if (elapsedMs(since, now) <= timeoutMs) {
        continue;
      }

      if (allowRetryRequeue && stepState.attempts < stepState.maxAttempts) {
        stepState.status = transitionStatus(stepState.status, "ready", "step", stepState.stepId);
        stepState.lastError = `step timeout after ${timeoutMs}ms`;
        stepState.lastUpdatedAt = now;
        this.touchStepMetadata(stepState, {
          wakeReason: "step_timeout_retry",
          lastEventAt: now,
          retryAt: now,
        });
        if (stepState.child?.childSessionKey) {
          this.store.unbindChildSession({ childSessionKey: stepState.child.childSessionKey });
        }
        stepState.child = undefined;
      } else {
        this.markStepFailure(run, stepState, `step timed out after ${timeoutMs}ms`, "timed_out");
      }

      changed = true;
    }

    if (changed) {
      this.store.updateRun(run);
    }

    return changed;
  }

  private handleSubagentSpawningEvent(
    run: WorkflowRunState,
    event: WorkflowRuntimeEvent,
    timestamp: string,
  ): void {
    const binding = this.resolveChildBinding(run, event);
    if (!binding) {
      return;
    }

    const stepState = run.steps[binding.stepId];
    if (!stepState || stepState.type !== "spawn_agent") {
      return;
    }

    stepState.child = {
      childSessionKey: binding.childSessionKey,
      childRunId: binding.childRunId,
      boundAt: stepState.child?.boundAt ?? timestamp,
    };
    this.store.bindChildSession({
      runId: run.runId,
      stepId: binding.stepId,
      childSessionKey: binding.childSessionKey,
      childRunId: binding.childRunId,
    });
    this.touchStepMetadata(stepState, {
      wakeReason: "subagent_spawning",
      lastEventAt: timestamp,
    });
    stepState.lastUpdatedAt = timestamp;
  }

  private handleSubagentSpawnedEvent(
    run: WorkflowRunState,
    event: WorkflowRuntimeEvent,
    timestamp: string,
  ): void {
    const binding = this.resolveChildBinding(run, event);
    if (!binding) {
      return;
    }

    const stepState = run.steps[binding.stepId];
    if (!stepState) {
      return;
    }

    if (event.childRunId && binding.childSessionKey) {
      this.store.updateChildRunId({
        childSessionKey: binding.childSessionKey,
        childRunId: event.childRunId,
      });
      stepState.child = {
        childSessionKey: binding.childSessionKey,
        childRunId: event.childRunId,
        boundAt: stepState.child?.boundAt ?? timestamp,
      };
      stepState.lastUpdatedAt = timestamp;
      this.touchStepMetadata(stepState, {
        wakeReason: "subagent_spawned",
        lastEventAt: timestamp,
      });
    }
  }

  private handleSubagentEndedLikeEvent(
    run: WorkflowRunState,
    event: WorkflowRuntimeEvent,
    outcome: "ok" | "error" | "timeout" | "killed" | "reset" | "deleted",
    timestamp: string,
  ): void {
    const binding = this.resolveChildBinding(run, event);
    if (!binding) {
      return;
    }

    const stepState = run.steps[binding.stepId];
    if (!stepState || stepState.type !== "spawn_agent") {
      return;
    }

    if (outcome === "ok") {
      stepState.status = transitionStatus(stepState.status, "completed", "step", stepState.stepId);
      stepState.completedAt = timestamp;
      stepState.lastUpdatedAt = timestamp;
      stepState.lastError = undefined;
      stepState.output = {
        ...(stepState.output ?? {}),
        outcome,
        childSessionKey: binding.childSessionKey,
        childRunId: binding.childRunId,
      };
      run.outputs[stepState.stepId] = stepState.output;
      this.store.unbindChildSession({ childSessionKey: binding.childSessionKey });
      this.touchStepMetadata(stepState, {
        wakeReason: "subagent_ended_ok",
        lastEventAt: timestamp,
        orphanedChild: false,
      });
      return;
    }

    const errorMessage = event.error ?? `child agent ended with outcome=${outcome}`;
    if (stepState.attempts < stepState.maxAttempts) {
      stepState.status = transitionStatus(stepState.status, "ready", "step", stepState.stepId);
      stepState.lastError = errorMessage;
      stepState.lastUpdatedAt = timestamp;
      stepState.child = undefined;
      this.store.unbindChildSession({ childSessionKey: binding.childSessionKey });
      this.touchStepMetadata(stepState, {
        wakeReason: "subagent_ended_retry",
        lastEventAt: timestamp,
        retryAt: timestamp,
      });
      return;
    }

    this.markStepFailure(run, stepState, errorMessage, outcome === "timeout" ? "timed_out" : "failed");
    this.store.unbindChildSession({ childSessionKey: binding.childSessionKey });
  }

  private handleSessionStartEvent(run: WorkflowRunState, event: WorkflowRuntimeEvent, timestamp: string): void {
    const binding = this.store.findChildBinding({
      childSessionKey: event.sessionKey ?? event.childSessionKey,
      childRunId: event.childRunId,
    });
    if (!binding || binding.runId !== run.runId) {
      return;
    }

    const stepState = run.steps[binding.stepId];
    if (!stepState) {
      return;
    }

    this.touchStepMetadata(stepState, {
      wakeReason: "session_start",
      lastEventAt: timestamp,
    });
    stepState.lastUpdatedAt = timestamp;
  }

  private handleSessionEndEvent(run: WorkflowRunState, event: WorkflowRuntimeEvent, timestamp: string): void {
    const binding = this.store.findChildBinding({
      childSessionKey: event.sessionKey ?? event.childSessionKey,
      childRunId: event.childRunId,
    });

    if (!binding || binding.runId !== run.runId) {
      return;
    }

    const stepState = run.steps[binding.stepId];
    if (!stepState || stepState.type !== "spawn_agent") {
      return;
    }

    this.touchStepMetadata(stepState, {
      wakeReason: "session_end",
      lastEventAt: timestamp,
      diagnostics: {
        ...(stepState.metadata?.diagnostics ?? {}),
        sessionEndFallback: true,
      },
    });

    if (stepState.status === "waiting" || stepState.status === "running") {
      this.handleSubagentEndedLikeEvent(
        run,
        {
          ...event,
          childSessionKey: binding.childSessionKey,
          childRunId: binding.childRunId,
          error: event.error ?? "session_end observed before subagent_ended",
        },
        event.outcome ?? "error",
        timestamp,
      );
    }
  }

  private resolveChildBinding(
    run: WorkflowRunState,
    event: WorkflowRuntimeEvent,
  ): ChildSessionBinding | undefined {
    if (event.stepId && (event.childSessionKey ?? event.sessionKey)) {
      const childSessionKey = event.childSessionKey ?? event.sessionKey;
      if (!childSessionKey) {
        return undefined;
      }
      return {
        runId: run.runId,
        stepId: event.stepId,
        childSessionKey,
        childRunId: event.childRunId,
      };
    }

    return this.store.findChildBinding({
      childSessionKey: event.childSessionKey ?? event.sessionKey,
      childRunId: event.childRunId,
    });
  }

  private markStepFailure(
    run: WorkflowRunState,
    stepState: WorkflowStepRuntimeState,
    error: string,
    status: "failed" | "timed_out",
  ): void {
    stepState.status = transitionStatus(stepState.status, status, "step", stepState.stepId);
    stepState.lastError = error;
    stepState.lastUpdatedAt = nowIso();
    this.touchStepMetadata(stepState, {
      wakeReason: status === "timed_out" ? "step_timeout_terminal" : "step_failed",
      lastEventAt: stepState.lastUpdatedAt,
    });
    if (status === "timed_out") {
      this.markRunFailed(run, error, "timed_out");
      return;
    }
    this.markRunFailed(run, error, "failed", false);
  }

  private markRunFailed(
    run: WorkflowRunState,
    error: string,
    status: "failed" | "timed_out",
    forceTerminal = true,
  ): void {
    run.lastError = error;
    if (!forceTerminal) {
      return;
    }
    if (!isTerminalStatus(run.status)) {
      run.status = transitionStatus(run.status, status, "run", run.runId);
      run.completedAt = nowIso();
      run.updatedAt = run.completedAt;
      run.metadata.lastWakeReason = status === "timed_out" ? "run_failed_timeout" : "run_failed";
    }
  }

  private updateRunStatus(run: WorkflowRunState): void {
    if (isTerminalStatus(run.status)) {
      return;
    }

    const stepStates = Object.values(run.steps);
    const hasWaiting = stepStates.some((step) => step.status === "waiting");
    const hasRunning = stepStates.some((step) => step.status === "running");
    const hasReady = stepStates.some((step) => step.status === "ready");
    const hasPending = stepStates.some((step) => step.status === "pending");
    const hasFailed = stepStates.some((step) => step.status === "failed");
    const hasTimedOut = stepStates.some((step) => step.status === "timed_out");

    if (hasWaiting) {
      run.status = transitionStatus(run.status, "waiting", "run", run.runId);
      return;
    }

    if (hasRunning) {
      run.status = transitionStatus(run.status, "running", "run", run.runId);
      return;
    }

    if (hasReady || hasPending) {
      run.status = transitionStatus(run.status, "ready", "run", run.runId);
      return;
    }

    if (hasTimedOut) {
      run.status = transitionStatus(run.status, "timed_out", "run", run.runId);
      run.completedAt = nowIso();
      run.metadata.lastWakeReason = "timed_out";
      return;
    }

    if (hasFailed) {
      run.status = transitionStatus(run.status, "failed", "run", run.runId);
      run.completedAt = nowIso();
      run.metadata.lastWakeReason = "failed";
      return;
    }

    run.status = transitionStatus(run.status, "completed", "run", run.runId);
    run.completedAt = nowIso();
    run.metadata.lastWakeReason = "completed";
  }

  private appendTrace(
    runId: string,
    entry: Omit<WorkflowRunTraceEntry, "ts"> & { ts?: string },
  ): void {
    this.store.appendTrace(runId, {
      ts: entry.ts ?? nowIso(),
      level: entry.level,
      event: entry.event,
      stepId: entry.stepId,
      message: entry.message,
      data: entry.data,
    });
  }

  private touchStepMetadata(
    step: WorkflowStepRuntimeState,
    patch: {
      retryAt?: string;
      wakeReason?: string;
      lastEventAt?: string;
      orphanedChild?: boolean;
      diagnostics?: Record<string, unknown>;
    },
  ): void {
    step.metadata = {
      ...(step.metadata ?? {}),
      ...patch,
      diagnostics: {
        ...(step.metadata?.diagnostics ?? {}),
        ...(patch.diagnostics ?? {}),
      },
    };
  }

  private resolveEventDedupeKey(event: WorkflowRuntimeEvent, runId: string): string {
    if (event.dedupeKey?.trim()) {
      return event.dedupeKey.trim();
    }

    const parts = [
      event.type,
      runId,
      event.stepId ?? "na",
      event.childSessionKey ?? event.sessionKey ?? "na",
      event.childRunId ?? "na",
      event.sessionId ?? "na",
      event.outcome ?? "na",
      event.ts ?? "na",
    ];

    return parts.join(":");
  }

  private recoverRunsOnBoot(): void {
    const recoveredAt = nowIso();

    for (const run of this.store.listRuns()) {
      if (isTerminalStatus(run.status)) {
        continue;
      }

      let changed = false;
      run.metadata.lastWakeReason = "startup_recovery";

      for (const step of Object.values(run.steps)) {
        if (step.type !== "spawn_agent") {
          continue;
        }

        if (step.status === "waiting" && step.child?.childSessionKey) {
          this.store.bindChildSession({
            runId: run.runId,
            stepId: step.stepId,
            childSessionKey: step.child.childSessionKey,
            childRunId: step.child.childRunId,
          });
          this.touchStepMetadata(step, {
            wakeReason: "startup_recovery_binding",
            lastEventAt: recoveredAt,
          });
          changed = true;
          continue;
        }

        if (step.status === "waiting" && !step.child?.childSessionKey) {
          this.touchStepMetadata(step, {
            orphanedChild: true,
            wakeReason: "startup_recovery_orphan_detected",
            lastEventAt: recoveredAt,
            diagnostics: {
              missingChildBinding: true,
            },
          });
          changed = true;
        }
      }

      this.store.updateRun(run);
      this.store.markRecovered(run.runId, recoveredAt);
      this.store.touchCheckpoint(run.runId, {
        lastReconciledAt: recoveredAt,
        lastSweepAt: recoveredAt,
      });

      if (changed) {
        this.appendTrace(run.runId, {
          ts: recoveredAt,
          level: "warn",
          event: "run_recovered",
          message: "workflow run recovered on service startup",
        });
      }
    }
  }

  private maybeRunMaintenance(reason: string): void {
    const now = Date.now();
    if (now - this.lastSweepAt < this.runtimeConfig.sweepIntervalMs) {
      return;
    }
    this.lastSweepAt = now;
    this.sweepRuns(nowIso(), reason, { includeTerminal: true });
  }

  private sweepRuns(
    now: string,
    reason: string,
    options: { runId?: string; includeTerminal?: boolean },
  ): ReconcileRunsResult {
    const processedEventCutoff = new Date(new Date(now).getTime() - this.runtimeConfig.processedEventTtlMs).toISOString();
    const terminalCutoff = new Date(new Date(now).getTime() - this.runtimeConfig.terminalTtlMs).getTime();
    const includeTerminal = options.includeTerminal === true;

    let scanned = 0;
    let updated = 0;
    let deletedTerminalRuns = 0;
    const touchedRunIds = new Set<string>();

    for (const run of this.store.listRuns()) {
      if (options.runId && run.runId !== options.runId) {
        continue;
      }

      scanned += 1;
      this.store.pruneProcessedEvents(run.runId, processedEventCutoff);
      this.store.touchCheckpoint(run.runId, { lastSweepAt: now });

      if (isTerminalStatus(run.status)) {
        if (includeTerminal) {
          const completedAt = run.completedAt ?? run.updatedAt;
          if (new Date(completedAt).getTime() < terminalCutoff) {
            this.store.deleteRun(run.runId);
            deletedTerminalRuns += 1;
            touchedRunIds.add(run.runId);
          }
        }
        continue;
      }

      let changed = false;
      for (const step of Object.values(run.steps)) {
        if (step.type !== "spawn_agent" || step.status !== "waiting") {
          continue;
        }

        const since = step.waitingSince ?? step.startedAt ?? run.updatedAt;
        if (!since) {
          continue;
        }

        const stale = elapsedMs(since, now) > this.runtimeConfig.staleWaitingMs;
        if (!stale) {
          continue;
        }

        const binding = step.child?.childSessionKey
          ? this.store.findChildBinding({ childSessionKey: step.child.childSessionKey })
          : undefined;

        if (binding) {
          continue;
        }

        this.touchStepMetadata(step, {
          orphanedChild: true,
          wakeReason: "sweep_orphan_detected",
          lastEventAt: now,
          diagnostics: {
            ...(step.metadata?.diagnostics ?? {}),
            staleSince: since,
            sweepTrigger: reason,
            staleWaitingMs: this.runtimeConfig.staleWaitingMs,
          },
        });

        step.lastError = "orphan child session detected during sweep";
        if (step.attempts < step.maxAttempts) {
          step.status = transitionStatus(step.status, "ready", "step", step.stepId);
          step.lastUpdatedAt = now;
          step.child = undefined;
        } else {
          this.markStepFailure(run, step, step.lastError, "failed");
        }

        changed = true;
      }

      if (changed) {
        run.metadata.lastWakeReason = "sweep";
        run.updatedAt = now;
        this.store.updateRun(run);
        this.store.touchCheckpoint(run.runId, {
          lastReconciledAt: now,
          lastTransitionAt: now,
        });
        this.appendTrace(run.runId, {
          ts: now,
          level: "warn",
          event: "run_swept",
          message: `maintenance sweep updated run (${reason})`,
        });
        updated += 1;
        touchedRunIds.add(run.runId);
      }
    }

    return {
      ok: true,
      triggeredAt: now,
      reason,
      scanned,
      updated,
      deletedTerminalRuns,
      touchedRunIds: Array.from(touchedRunIds).sort(),
    };
  }
}

export function createOrchestrationService(options?: {
  registry?: WorkflowRegistry;
  store?: WorkflowRunStore;
  runtimeConfig?: Partial<OrchestrationRuntimeConfig>;
}): OrchestrationService {
  return new OrchestrationService(options?.registry, options?.store, options?.runtimeConfig);
}
