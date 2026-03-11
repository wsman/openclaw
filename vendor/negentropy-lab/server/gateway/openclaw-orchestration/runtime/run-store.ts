/**
 * 🔄 WorkflowRunStore - 工作流运行存储
 * 
 * @constitution
 * §101 同步公理: 代码与文档必须原子性同步
 * §102 熵减原则: 标准化存储模式，降低系统熵值
 * §105 数据完整性公理: 所有状态变更必须是原子的
 * §152 单一真理源公理: 工作流运行状态统一管理
 * 
 * @filename run-store.ts
 * @version 1.0.0
 * @category orchestration/runtime
 * @last_updated 2026-03-09
 */

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import type {
  WorkflowDefinition,
  WorkflowStep,
  WorkflowStepCondition,
} from "../contracts/workflow-contract";
import type { WorkflowRunStatus, WorkflowStepStatus } from "./state-machine";

const RUN_STORE_VERSION = 2;
const MAX_TRACE_ENTRIES = 800;
const MAX_EVENT_LOG_ENTRIES = 1200;

export type WorkflowRunTrigger = {
  type: "manual";
  source?: string;
  requestedBy?: string;
  sessionKey?: string;
};

export type StepChildBinding = {
  childSessionKey: string;
  childRunId?: string;
  boundAt: string;
};

export type WorkflowStepRuntimeMetadata = {
  retryAt?: string;
  wakeReason?: string;
  lastEventAt?: string;
  orphanedChild?: boolean;
  diagnostics?: Record<string, unknown>;
};

export type WorkflowStepRuntimeState = {
  stepId: string;
  type: WorkflowStep["type"];
  title?: string;
  status: WorkflowStepStatus;
  when: WorkflowStepCondition;
  dependsOn: string[];
  attempts: number;
  maxAttempts: number;
  timeoutMs?: number;
  startedAt?: string;
  waitingSince?: string;
  completedAt?: string;
  lastUpdatedAt: string;
  child?: StepChildBinding;
  output?: Record<string, unknown>;
  lastError?: string;
  metadata?: WorkflowStepRuntimeMetadata;
};

export type WorkflowRunTraceEntry = {
  ts: string;
  level: "info" | "warn" | "error";
  event: string;
  stepId?: string;
  message: string;
  data?: Record<string, unknown>;
};

export type WorkflowEventLogEntry = {
  id: string;
  ts: string;
  runId: string;
  type: string;
  stepId?: string;
  dedupeKey?: string;
  message?: string;
  payload?: Record<string, unknown>;
};

export type WorkflowRunCheckpoint = {
  sequence: number;
  lastEventAt?: string;
  lastTransitionAt?: string;
  lastSweepAt?: string;
  lastReconciledAt?: string;
};

export type WorkflowRunMetadata = {
  createdBy?: string;
  retryOfRunId?: string;
  recoveredAt?: string;
  recoveryCount: number;
  lastWakeReason?: string;
  diagnostics?: Record<string, unknown>;
};

export type WorkflowRunState = {
  runId: string;
  workflowId: string;
  workflowVersion: string;
  trigger: WorkflowRunTrigger;
  status: WorkflowRunStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  canceledAt?: string;
  timeoutMs?: number;
  lastError?: string;
  outputs: Record<string, unknown>;
  steps: Record<string, WorkflowStepRuntimeState>;
  trace: WorkflowRunTraceEntry[];
  eventLog: WorkflowEventLogEntry[];
  checkpoint: WorkflowRunCheckpoint;
  metadata: WorkflowRunMetadata;
  processedEvents: Record<string, string>;
};

export type ChildSessionBinding = {
  runId: string;
  stepId: string;
  childSessionKey: string;
  childRunId?: string;
};

export type RunStoreSnapshot = {
  version: number;
  runs: WorkflowRunState[];
  childBindings: ChildSessionBinding[];
};

function nowIso(): string {
  return new Date().toISOString();
}

function createCheckpoint(): WorkflowRunCheckpoint {
  return { sequence: 0 };
}

function createMetadata(): WorkflowRunMetadata {
  return {
    recoveryCount: 0,
  };
}

function toSnapshot(store: WorkflowRunStore): RunStoreSnapshot {
  return {
    version: RUN_STORE_VERSION,
    runs: store.listRuns(),
    childBindings: store.listChildBindings(),
  };
}

export class WorkflowRunStore {
  private readonly runs = new Map<string, WorkflowRunState>();
  private readonly childBySession = new Map<string, ChildSessionBinding>();
  private readonly childByRunId = new Map<string, ChildSessionBinding>();

  constructor(private readonly filePath?: string) {
    if (filePath) {
      this.loadFromDisk(filePath);
    }
  }

  createRun(params: {
    runId: string;
    definition: WorkflowDefinition;
    trigger: WorkflowRunTrigger;
    metadata?: Partial<WorkflowRunMetadata>;
  }): WorkflowRunState {
    const timestamp = nowIso();
    const steps: Record<string, WorkflowStepRuntimeState> = {};

    for (const step of params.definition.steps) {
      steps[step.id] = {
        stepId: step.id,
        type: step.type,
        title: step.title,
        status: "pending",
        when: step.when ?? "on_success",
        dependsOn: [...(step.dependsOn ?? [])],
        attempts: 0,
        maxAttempts: step.retry?.maxAttempts ?? 1,
        timeoutMs: step.timeoutMs,
        lastUpdatedAt: timestamp,
        metadata: {},
      };
    }

    const run: WorkflowRunState = {
      runId: params.runId,
      workflowId: params.definition.id,
      workflowVersion: "v1.1",
      trigger: params.trigger,
      status: "pending",
      createdAt: timestamp,
      updatedAt: timestamp,
      timeoutMs: params.definition.timeoutMs,
      outputs: {},
      steps,
      trace: [],
      eventLog: [],
      checkpoint: createCheckpoint(),
      metadata: {
        ...createMetadata(),
        ...(params.metadata ?? {}),
      },
      processedEvents: {},
    };

    this.runs.set(run.runId, run);
    this.persist();
    return this.cloneRun(run);
  }

  getRun(runId: string): WorkflowRunState | undefined {
    const run = this.runs.get(runId);
    return run ? this.cloneRun(run) : undefined;
  }

  listRuns(): WorkflowRunState[] {
    return Array.from(this.runs.values())
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((run) => this.cloneRun(run));
  }

  updateRun(run: WorkflowRunState): WorkflowRunState {
    const normalized = this.normalizeLoadedRun(run);
    this.runs.set(run.runId, normalized);
    this.persist();
    return this.cloneRun(normalized);
  }

  deleteRun(runId: string): void {
    this.runs.delete(runId);
    for (const binding of this.listChildBindings()) {
      if (binding.runId === runId) {
        this.unbindChildSession({ childSessionKey: binding.childSessionKey });
      }
    }
    this.persist();
  }

  appendTrace(runId: string, entry: WorkflowRunTraceEntry): void {
    const run = this.runs.get(runId);
    if (!run) {
      return;
    }
    run.trace.push(entry);
    if (run.trace.length > MAX_TRACE_ENTRIES) {
      run.trace.splice(0, run.trace.length - MAX_TRACE_ENTRIES);
    }
    run.updatedAt = entry.ts;
    this.persist();
  }

  appendEventLog(
    runId: string,
    entry: Omit<WorkflowEventLogEntry, "id" | "ts" | "runId"> & { id?: string; ts?: string },
  ): WorkflowEventLogEntry | undefined {
    const run = this.runs.get(runId);
    if (!run) {
      return undefined;
    }

    const item: WorkflowEventLogEntry = {
      id: entry.id ?? `${runId}:${run.eventLog.length + 1}`,
      ts: entry.ts ?? nowIso(),
      runId,
      type: entry.type,
      stepId: entry.stepId,
      dedupeKey: entry.dedupeKey,
      message: entry.message,
      payload: entry.payload,
    };

    run.eventLog.push(item);
    if (run.eventLog.length > MAX_EVENT_LOG_ENTRIES) {
      run.eventLog.splice(0, run.eventLog.length - MAX_EVENT_LOG_ENTRIES);
    }

    run.updatedAt = item.ts;
    this.persist();
    return { ...item };
  }

  hasProcessedEvent(runId: string, dedupeKey: string): boolean {
    const run = this.runs.get(runId);
    if (!run || !dedupeKey) {
      return false;
    }
    return Boolean(run.processedEvents[dedupeKey]);
  }

  rememberProcessedEvent(runId: string, dedupeKey: string, ts: string): void {
    if (!dedupeKey) {
      return;
    }
    const run = this.runs.get(runId);
    if (!run) {
      return;
    }
    run.processedEvents[dedupeKey] = ts;
    this.persist();
  }

  pruneProcessedEvents(runId: string, olderThanIso: string): void {
    const run = this.runs.get(runId);
    if (!run) {
      return;
    }
    const cutoff = new Date(olderThanIso).getTime();
    for (const [key, ts] of Object.entries(run.processedEvents)) {
      if (new Date(ts).getTime() < cutoff) {
        delete run.processedEvents[key];
      }
    }
    this.persist();
  }

  touchCheckpoint(runId: string, patch: Partial<WorkflowRunCheckpoint>): void {
    const run = this.runs.get(runId);
    if (!run) {
      return;
    }
    run.checkpoint = {
      sequence: Math.max(0, Math.floor(run.checkpoint.sequence ?? 0)) + 1,
      ...run.checkpoint,
      ...patch,
    };
    run.updatedAt = patch.lastTransitionAt ?? patch.lastEventAt ?? patch.lastSweepAt ?? run.updatedAt;
    this.persist();
  }

  markRecovered(runId: string, ts: string): void {
    const run = this.runs.get(runId);
    if (!run) {
      return;
    }
    run.metadata.recoveredAt = ts;
    run.metadata.recoveryCount = (run.metadata.recoveryCount ?? 0) + 1;
    this.persist();
  }

  bindChildSession(binding: ChildSessionBinding): void {
    this.childBySession.set(binding.childSessionKey, { ...binding });
    if (binding.childRunId) {
      this.childByRunId.set(binding.childRunId, { ...binding });
    }
    this.persist();
  }

  updateChildRunId(params: { childSessionKey: string; childRunId: string }): ChildSessionBinding | undefined {
    const binding = this.childBySession.get(params.childSessionKey);
    if (!binding) {
      return undefined;
    }

    const next: ChildSessionBinding = {
      ...binding,
      childRunId: params.childRunId,
    };

    this.childBySession.set(next.childSessionKey, next);
    this.childByRunId.set(params.childRunId, next);
    this.persist();
    return { ...next };
  }

  findChildBinding(input: { childSessionKey?: string; childRunId?: string }): ChildSessionBinding | undefined {
    if (input.childSessionKey) {
      const binding = this.childBySession.get(input.childSessionKey);
      if (binding) {
        return { ...binding };
      }
    }
    if (input.childRunId) {
      const binding = this.childByRunId.get(input.childRunId);
      if (binding) {
        return { ...binding };
      }
    }
    return undefined;
  }

  unbindChildSession(input: { childSessionKey?: string; childRunId?: string }): void {
    const binding = this.findChildBinding(input);
    if (!binding) {
      return;
    }

    this.childBySession.delete(binding.childSessionKey);
    if (binding.childRunId) {
      this.childByRunId.delete(binding.childRunId);
    }
    this.persist();
  }

  listChildBindings(): ChildSessionBinding[] {
    return Array.from(this.childBySession.values()).map((binding) => ({ ...binding }));
  }

  private persist(): void {
    if (!this.filePath) {
      return;
    }

    const snapshot = JSON.stringify(toSnapshot(this), null, 2);
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, snapshot, "utf-8");
  }

  private loadFromDisk(filePath: string): void {
    try {
      const raw = readFileSync(filePath, "utf-8");
      const snapshot = JSON.parse(raw) as Partial<RunStoreSnapshot>;
      if (!Array.isArray(snapshot.runs)) {
        return;
      }

      for (const run of snapshot.runs) {
        const normalized = this.normalizeLoadedRun(run);
        this.runs.set(normalized.runId, normalized);
      }

      if (Array.isArray(snapshot.childBindings)) {
        for (const binding of snapshot.childBindings) {
          if (!binding?.childSessionKey || !binding?.runId || !binding?.stepId) {
            continue;
          }
          const normalized: ChildSessionBinding = {
            runId: binding.runId,
            stepId: binding.stepId,
            childSessionKey: binding.childSessionKey,
            childRunId: binding.childRunId,
          };
          this.childBySession.set(normalized.childSessionKey, normalized);
          if (normalized.childRunId) {
            this.childByRunId.set(normalized.childRunId, normalized);
          }
        }
      }
    } catch {
      // Best-effort persistence. Runtime continues with in-memory store when snapshot is invalid.
    }
  }

  private normalizeLoadedRun(run: WorkflowRunState): WorkflowRunState {
    const normalized = this.cloneRun(run);
    normalized.eventLog = Array.isArray(normalized.eventLog) ? normalized.eventLog : [];
    normalized.trace = Array.isArray(normalized.trace) ? normalized.trace : [];
    normalized.outputs = normalized.outputs && typeof normalized.outputs === "object" ? normalized.outputs : {};
    normalized.processedEvents =
      normalized.processedEvents && typeof normalized.processedEvents === "object"
        ? normalized.processedEvents
        : {};

    normalized.checkpoint = {
      ...createCheckpoint(),
      ...(normalized.checkpoint ?? {}),
      sequence:
        typeof normalized.checkpoint?.sequence === "number" && Number.isFinite(normalized.checkpoint.sequence)
          ? Math.max(0, Math.floor(normalized.checkpoint.sequence))
          : 0,
    };

    normalized.metadata = {
      ...createMetadata(),
      ...(normalized.metadata ?? {}),
      recoveryCount:
        typeof normalized.metadata?.recoveryCount === "number" && Number.isFinite(normalized.metadata.recoveryCount)
          ? Math.max(0, Math.floor(normalized.metadata.recoveryCount))
          : 0,
    };

    normalized.steps = Object.fromEntries(
      Object.entries(normalized.steps ?? {}).map(([stepId, step]) => {
        const fixed: WorkflowStepRuntimeState = {
          ...step,
          stepId,
          dependsOn: Array.isArray(step.dependsOn) ? step.dependsOn : [],
          metadata: {
            ...(step.metadata ?? {}),
          },
        };
        return [stepId, fixed];
      }),
    );

    return normalized;
  }

  private cloneRun(run: WorkflowRunState): WorkflowRunState {
    return JSON.parse(JSON.stringify(run)) as WorkflowRunState;
  }
}
