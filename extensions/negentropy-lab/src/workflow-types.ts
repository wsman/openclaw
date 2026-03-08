export type WorkflowRunStatus =
  | "pending"
  | "ready"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "canceled"
  | "timed_out";

export type WorkflowAction =
  | {
      type: "spawn_subagent";
      runId: string;
      stepId: string;
      payload: {
        childSessionKey: string;
        agentId: string;
        prompt: string;
        extraSystemPrompt?: string;
        lane?: string;
      };
    }
  | {
      type: "send_session_message";
      runId: string;
      stepId: string;
      payload: {
        message: string;
        targetSessionKey?: string;
      };
    }
  | {
      type: "trace";
      runId: string;
      stepId: string;
      payload: {
        message: string;
      };
    };

export type WorkflowRunStep = {
  stepId: string;
  type: string;
  status: WorkflowRunStatus;
  attempts: number;
  maxAttempts: number;
  timeoutMs?: number;
  startedAt?: string;
  waitingSince?: string;
  completedAt?: string;
  lastError?: string;
  metadata?: {
    retryAt?: string;
    wakeReason?: string;
    lastEventAt?: string;
    orphanedChild?: boolean;
    diagnostics?: Record<string, unknown>;
  };
  child?: {
    childSessionKey: string;
    childRunId?: string;
    boundAt: string;
  };
};

export type WorkflowRunView = {
  runId: string;
  workflowId: string;
  status: WorkflowRunStatus;
  trigger: {
    type: "manual";
    source?: string;
    requestedBy?: string;
    sessionKey?: string;
  };
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  canceledAt?: string;
  lastError?: string;
  outputs: Record<string, unknown>;
  steps: Record<string, WorkflowRunStep>;
  eventLog?: Array<{
    id: string;
    ts: string;
    type: string;
    stepId?: string;
    dedupeKey?: string;
    message?: string;
  }>;
  checkpoint?: {
    sequence: number;
    lastEventAt?: string;
    lastTransitionAt?: string;
    lastSweepAt?: string;
    lastReconciledAt?: string;
  };
  metadata?: {
    createdBy?: string;
    retryOfRunId?: string;
    recoveredAt?: string;
    recoveryCount?: number;
    lastWakeReason?: string;
  };
  trace?: Array<{
    ts: string;
    level: "info" | "warn" | "error";
    event: string;
    stepId?: string;
    message: string;
  }>;
};

export type WorkflowRunResponse = {
  run?: WorkflowRunView;
  actions: WorkflowAction[];
  ignored?: boolean;
  message?: string;
};

export type WorkflowListResponse = {
  runs: WorkflowRunView[];
  total: number;
};

export type WorkflowTraceResponse = {
  runId: string;
  trace: Array<{
    ts: string;
    level: "info" | "warn" | "error";
    event: string;
    stepId?: string;
    message: string;
    data?: Record<string, unknown>;
  }>;
  total: number;
};

export type WorkflowReconcileResponse = {
  ok: boolean;
  triggeredAt: string;
  reason: string;
  scanned: number;
  updated: number;
  deletedTerminalRuns: number;
  touchedRunIds: string[];
};

export type WorkflowEventPayload = {
  type:
    | "subagent_spawning"
    | "subagent_spawned"
    | "subagent_spawn_failed"
    | "subagent_ended"
    | "session_start"
    | "session_end"
    | "trace";
  runId?: string;
  stepId?: string;
  childSessionKey?: string;
  childRunId?: string;
  outcome?: "ok" | "error" | "timeout" | "killed" | "reset" | "deleted";
  error?: string;
  message?: string;
  sessionId?: string;
  sessionKey?: string;
  ts?: string;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
};
