export const WORKFLOW_RUN_STATUSES = [
  "pending",
  "ready",
  "running",
  "waiting",
  "completed",
  "failed",
  "canceled",
  "timed_out",
] as const;

export type WorkflowRunStatus = (typeof WORKFLOW_RUN_STATUSES)[number];
export type WorkflowStepStatus = WorkflowRunStatus;

const TERMINAL_STATUSES = new Set<WorkflowRunStatus>([
  "completed",
  "failed",
  "canceled",
  "timed_out",
]);

const TRANSITIONS: Record<WorkflowRunStatus, Set<WorkflowRunStatus>> = {
  pending: new Set(["ready", "canceled"]),
  ready: new Set(["running", "waiting", "canceled", "timed_out", "failed", "completed"]),
  running: new Set(["waiting", "completed", "failed", "canceled", "timed_out", "ready"]),
  waiting: new Set(["running", "completed", "failed", "canceled", "timed_out", "ready"]),
  completed: new Set(),
  failed: new Set(),
  canceled: new Set(),
  timed_out: new Set(),
};

export function isTerminalStatus(status: WorkflowRunStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function canTransition(from: WorkflowRunStatus, to: WorkflowRunStatus): boolean {
  if (from === to) {
    return true;
  }
  return TRANSITIONS[from].has(to);
}

export function assertTransition(
  from: WorkflowRunStatus,
  to: WorkflowRunStatus,
  scope: "run" | "step",
  id: string,
): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid ${scope} transition for ${id}: ${from} -> ${to}`);
  }
}

export function transitionStatus(
  from: WorkflowRunStatus,
  to: WorkflowRunStatus,
  scope: "run" | "step",
  id: string,
): WorkflowRunStatus {
  assertTransition(from, to, scope, id);
  return to;
}
