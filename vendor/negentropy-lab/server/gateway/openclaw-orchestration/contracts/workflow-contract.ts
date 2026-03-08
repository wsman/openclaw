export const WORKFLOW_TRIGGER_TYPES = ["manual"] as const;
export type WorkflowTriggerType = (typeof WORKFLOW_TRIGGER_TYPES)[number];

export const WORKFLOW_STEP_TYPES = [
  "spawn_agent",
  "await_subagent",
  "join_results",
  "send_session_message",
  "complete",
  "escalate",
] as const;
export type WorkflowStepType = (typeof WORKFLOW_STEP_TYPES)[number];

export const WORKFLOW_CONDITIONS = ["on_success", "on_failure", "always"] as const;
export type WorkflowStepCondition = (typeof WORKFLOW_CONDITIONS)[number];

export type WorkflowRetryPolicy = {
  maxAttempts: number;
  backoffMs?: number;
};

export type WorkflowJoinPolicy = {
  mode: "all" | "any";
  fromStepIds?: string[];
};

export type WorkflowStepBase = {
  id: string;
  type: WorkflowStepType;
  title?: string;
  dependsOn?: string[];
  when?: WorkflowStepCondition;
  retry?: WorkflowRetryPolicy;
  timeoutMs?: number;
};

export type WorkflowSpawnAgentStep = WorkflowStepBase & {
  type: "spawn_agent";
  agentId: string;
  prompt: string;
  extraSystemPrompt?: string;
  lane?: string;
};

export type WorkflowAwaitSubagentStep = WorkflowStepBase & {
  type: "await_subagent";
  sourceStepId: string;
};

export type WorkflowJoinResultsStep = WorkflowStepBase & {
  type: "join_results";
  join?: WorkflowJoinPolicy;
  outputKey?: string;
};

export type WorkflowSendSessionMessageStep = WorkflowStepBase & {
  type: "send_session_message";
  message: string;
  targetSessionKey?: string;
};

export type WorkflowCompleteStep = WorkflowStepBase & {
  type: "complete";
  resultKey?: string;
  message?: string;
};

export type WorkflowEscalateStep = WorkflowStepBase & {
  type: "escalate";
  reason: string;
  severity?: "low" | "medium" | "high" | "critical";
};

export type WorkflowStep =
  | WorkflowSpawnAgentStep
  | WorkflowAwaitSubagentStep
  | WorkflowJoinResultsStep
  | WorkflowSendSessionMessageStep
  | WorkflowCompleteStep
  | WorkflowEscalateStep;

export type WorkflowTrigger = {
  type: WorkflowTriggerType;
  source?: string;
};

export type WorkflowDefinition = {
  id: string;
  title: string;
  description?: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  timeoutMs?: number;
};

export type WorkflowValidationResult =
  | { ok: true }
  | {
      ok: false;
      errors: string[];
    };

function normalizeStepCondition(step: WorkflowStep): WorkflowStepCondition {
  return step.when ?? "on_success";
}

function hasUniqueIds(values: string[]): boolean {
  return new Set(values).size === values.length;
}

export function validateWorkflowDefinition(definition: WorkflowDefinition): WorkflowValidationResult {
  const errors: string[] = [];

  if (!definition.id?.trim()) {
    errors.push("workflow.id is required");
  }
  if (!definition.title?.trim()) {
    errors.push("workflow.title is required");
  }
  if (!WORKFLOW_TRIGGER_TYPES.includes(definition.trigger?.type)) {
    errors.push(`workflow.trigger.type must be one of: ${WORKFLOW_TRIGGER_TYPES.join(", ")}`);
  }
  if (!Array.isArray(definition.steps) || definition.steps.length === 0) {
    errors.push("workflow.steps must contain at least one step");
  }

  const stepIds = definition.steps.map((step) => step.id);
  if (!hasUniqueIds(stepIds)) {
    errors.push("workflow.steps contains duplicate step ids");
  }

  const stepIdSet = new Set(stepIds);

  for (const step of definition.steps) {
    if (!step.id?.trim()) {
      errors.push("step.id is required");
      continue;
    }

    if (!WORKFLOW_STEP_TYPES.includes(step.type)) {
      errors.push(`step ${step.id}: unsupported step type ${String(step.type)}`);
      continue;
    }

    if (step.when && !WORKFLOW_CONDITIONS.includes(step.when)) {
      errors.push(`step ${step.id}: when must be one of ${WORKFLOW_CONDITIONS.join(", ")}`);
    }

    if (step.dependsOn) {
      for (const dependency of step.dependsOn) {
        if (!stepIdSet.has(dependency)) {
          errors.push(`step ${step.id}: dependsOn references unknown step ${dependency}`);
        }
      }
    }

    if (step.retry) {
      if (!Number.isFinite(step.retry.maxAttempts) || step.retry.maxAttempts < 1) {
        errors.push(`step ${step.id}: retry.maxAttempts must be >= 1`);
      }
      if (
        step.retry.backoffMs !== undefined &&
        (!Number.isFinite(step.retry.backoffMs) || step.retry.backoffMs < 0)
      ) {
        errors.push(`step ${step.id}: retry.backoffMs must be >= 0`);
      }
    }

    if (step.timeoutMs !== undefined && (!Number.isFinite(step.timeoutMs) || step.timeoutMs < 1)) {
      errors.push(`step ${step.id}: timeoutMs must be >= 1`);
    }

    if (step.type === "spawn_agent") {
      if (!step.agentId?.trim()) {
        errors.push(`step ${step.id}: spawn_agent.agentId is required`);
      }
      if (!step.prompt?.trim()) {
        errors.push(`step ${step.id}: spawn_agent.prompt is required`);
      }
    }

    if (step.type === "await_subagent") {
      if (!step.sourceStepId?.trim()) {
        errors.push(`step ${step.id}: await_subagent.sourceStepId is required`);
      } else if (!stepIdSet.has(step.sourceStepId)) {
        errors.push(`step ${step.id}: await_subagent.sourceStepId references unknown step`);
      }
    }

    if (step.type === "join_results" && step.join?.fromStepIds) {
      for (const source of step.join.fromStepIds) {
        if (!stepIdSet.has(source)) {
          errors.push(`step ${step.id}: join.fromStepIds references unknown step ${source}`);
        }
      }
    }

    if (step.type === "send_session_message" && !step.message?.trim()) {
      errors.push(`step ${step.id}: send_session_message.message is required`);
    }

    if (step.type === "escalate" && !step.reason?.trim()) {
      errors.push(`step ${step.id}: escalate.reason is required`);
    }

    const normalizedCondition = normalizeStepCondition(step);
    if (step.type === "complete" && normalizedCondition === "on_failure") {
      errors.push(`step ${step.id}: complete step cannot use when=on_failure`);
    }
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}
