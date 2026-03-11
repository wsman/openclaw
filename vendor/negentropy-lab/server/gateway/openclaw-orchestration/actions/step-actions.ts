/**
 * @constitution
 * §101 同步公理: 编排动作实现与真理源文档保持同步
 * §102 熵减原则: 保持工作流动作实现简洁可维护
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename step-actions.ts
 * @version 1.0.0
 * @category orchestration/actions
 * @last_updated 2026-03-10
 */

import type {
  WorkflowCompleteStep,
  WorkflowEscalateStep,
  WorkflowJoinResultsStep,
  WorkflowSendSessionMessageStep,
  WorkflowSpawnAgentStep,
  WorkflowStep,
} from "../contracts/workflow-contract";
import type { WorkflowRunState, WorkflowStepRuntimeState } from "../runtime/run-store";
import type { WorkflowStepStatus } from "../runtime/state-machine";

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

export type StepExecutionResult = {
  status: WorkflowStepStatus;
  output?: Record<string, unknown>;
  error?: string;
  action?: WorkflowAction;
  runTerminalStatus?: "completed" | "failed";
};

export type StepExecutionContext = {
  run: WorkflowRunState;
  step: WorkflowStep;
  stepState: WorkflowStepRuntimeState;
  now: string;
  resolveChildSessionKey: (input: { runId: string; stepId: string; attempt: number }) => string;
  collectStepOutputs: (stepIds: string[]) => Record<string, unknown>;
};

function executeSpawnAgentStep(
  context: StepExecutionContext,
  step: WorkflowSpawnAgentStep,
): StepExecutionResult {
  const childSessionKey = context.resolveChildSessionKey({
    runId: context.run.runId,
    stepId: step.id,
    attempt: context.stepState.attempts,
  });

  return {
    status: "waiting",
    output: {
      childSessionKey,
      agentId: step.agentId,
      prompt: step.prompt,
    },
    action: {
      type: "spawn_subagent",
      runId: context.run.runId,
      stepId: step.id,
      payload: {
        childSessionKey,
        agentId: step.agentId,
        prompt: step.prompt,
        extraSystemPrompt: step.extraSystemPrompt,
        lane: step.lane,
      },
    },
  };
}

function executeJoinResultsStep(
  context: StepExecutionContext,
  step: WorkflowJoinResultsStep,
): StepExecutionResult {
  const fromStepIds = step.join?.fromStepIds ?? step.dependsOn ?? [];
  const merged = context.collectStepOutputs(fromStepIds);
  const outputKey = step.outputKey ?? step.id;

  return {
    status: "completed",
    output: {
      outputKey,
      joined: merged,
    },
  };
}

function executeSendSessionMessageStep(
  context: StepExecutionContext,
  step: WorkflowSendSessionMessageStep,
): StepExecutionResult {
  return {
    status: "completed",
    output: {
      message: step.message,
      targetSessionKey: step.targetSessionKey,
    },
    action: {
      type: "send_session_message",
      runId: context.run.runId,
      stepId: step.id,
      payload: {
        message: step.message,
        targetSessionKey: step.targetSessionKey,
      },
    },
  };
}

function executeCompleteStep(step: WorkflowCompleteStep): StepExecutionResult {
  return {
    status: "completed",
    output: {
      message: step.message ?? "workflow completed",
      resultKey: step.resultKey ?? "result",
    },
    runTerminalStatus: "completed",
  };
}

function executeEscalateStep(step: WorkflowEscalateStep): StepExecutionResult {
  return {
    status: "completed",
    output: {
      reason: step.reason,
      severity: step.severity ?? "high",
    },
    runTerminalStatus: "failed",
  };
}

export function executeStep(context: StepExecutionContext): StepExecutionResult {
  const step = context.step;

  switch (step.type) {
    case "spawn_agent":
      return executeSpawnAgentStep(context, step);
    case "await_subagent":
      return {
        status: "waiting",
        output: {
          sourceStepId: step.sourceStepId,
        },
      };
    case "join_results":
      return executeJoinResultsStep(context, step);
    case "send_session_message":
      return executeSendSessionMessageStep(context, step);
    case "complete":
      return executeCompleteStep(step);
    case "escalate":
      return executeEscalateStep(step);
    default:
      return {
        status: "failed",
        error: `Unsupported step type ${(step as WorkflowStep).type}`,
      };
  }
}
