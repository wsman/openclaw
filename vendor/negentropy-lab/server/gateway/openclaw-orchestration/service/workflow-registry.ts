/**
 * 📚 WorkflowRegistry - 工作流注册表
 * 
 * @constitution
 * §101 同步公理: 代码与文档必须原子性同步
 * §102 熵减原则: 标准化工作流定义，降低系统熵值
 * §105 数据完整性公理: 工作流注册必须经过验证
 * §152 单一真理源公理: 工作流定义统一管理
 * 
 * @filename workflow-registry.ts
 * @version 1.0.0
 * @category orchestration/service
 * @last_updated 2026-03-09
 */

import {
  type WorkflowDefinition,
  validateWorkflowDefinition,
} from "../contracts/workflow-contract";

const MVP_WORKFLOWS: WorkflowDefinition[] = [
  {
    id: "serial_planner_executor_complete",
    title: "Serial: planner -> executor -> complete",
    description: "MVP serial workflow for manual orchestration.",
    trigger: { type: "manual", source: "openclaw-command" },
    steps: [
      {
        id: "planner",
        type: "spawn_agent",
        agentId: "planner",
        prompt: "Plan the task and return a concise execution plan.",
        retry: { maxAttempts: 2, backoffMs: 200 },
        timeoutMs: 60_000,
      },
      {
        id: "planner_await",
        type: "await_subagent",
        sourceStepId: "planner",
        dependsOn: ["planner"],
        when: "always",
      },
      {
        id: "executor",
        type: "spawn_agent",
        agentId: "executor",
        prompt: "Execute the approved plan and summarize implementation details.",
        dependsOn: ["planner_await"],
        retry: { maxAttempts: 2, backoffMs: 200 },
        timeoutMs: 90_000,
      },
      {
        id: "executor_await",
        type: "await_subagent",
        sourceStepId: "executor",
        dependsOn: ["executor"],
        when: "always",
      },
      {
        id: "complete",
        type: "complete",
        dependsOn: ["executor_await"],
        resultKey: "serial_summary",
        message: "Serial workflow finished.",
      },
    ],
  },
  {
    id: "parallel_research_implementation_review",
    title: "Parallel: research + implementation + review -> summarize",
    description: "MVP parallel workflow with fan-out/fan-in join.",
    trigger: { type: "manual", source: "openclaw-command" },
    steps: [
      {
        id: "research",
        type: "spawn_agent",
        agentId: "researcher",
        prompt: "Collect constraints, references, and risk notes.",
        retry: { maxAttempts: 2, backoffMs: 200 },
        timeoutMs: 60_000,
      },
      {
        id: "implementation",
        type: "spawn_agent",
        agentId: "implementer",
        prompt: "Draft implementation approach and code-level plan.",
        retry: { maxAttempts: 2, backoffMs: 200 },
        timeoutMs: 90_000,
      },
      {
        id: "review",
        type: "spawn_agent",
        agentId: "reviewer",
        prompt: "Review expected quality gates and validation checks.",
        retry: { maxAttempts: 2, backoffMs: 200 },
        timeoutMs: 60_000,
      },
      {
        id: "research_await",
        type: "await_subagent",
        sourceStepId: "research",
        dependsOn: ["research"],
        when: "always",
      },
      {
        id: "implementation_await",
        type: "await_subagent",
        sourceStepId: "implementation",
        dependsOn: ["implementation"],
        when: "always",
      },
      {
        id: "review_await",
        type: "await_subagent",
        sourceStepId: "review",
        dependsOn: ["review"],
        when: "always",
      },
      {
        id: "summarize",
        type: "join_results",
        dependsOn: ["research_await", "implementation_await", "review_await"],
        join: {
          mode: "all",
          fromStepIds: ["research", "implementation", "review"],
        },
        outputKey: "parallel_summary",
      },
      {
        id: "complete",
        type: "complete",
        dependsOn: ["summarize"],
        resultKey: "parallel_summary",
        message: "Parallel workflow finished.",
      },
    ],
  },
  {
    id: "failure_retry_escalate",
    title: "Failure path: worker -> retry -> escalate",
    description: "MVP failure workflow with retries and explicit escalation.",
    trigger: { type: "manual", source: "openclaw-command" },
    steps: [
      {
        id: "worker",
        type: "spawn_agent",
        agentId: "worker",
        prompt: "Attempt the assigned task and report completion.",
        retry: { maxAttempts: 3, backoffMs: 200 },
        timeoutMs: 45_000,
      },
      {
        id: "worker_await",
        type: "await_subagent",
        sourceStepId: "worker",
        dependsOn: ["worker"],
        when: "always",
      },
      {
        id: "notify_success",
        type: "send_session_message",
        dependsOn: ["worker_await"],
        when: "on_success",
        message: "Worker finished successfully.",
      },
      {
        id: "complete",
        type: "complete",
        dependsOn: ["notify_success"],
        when: "on_success",
        resultKey: "worker_result",
      },
      {
        id: "escalate",
        type: "escalate",
        dependsOn: ["worker_await"],
        when: "on_failure",
        reason: "Worker exhausted retries or timed out.",
        severity: "high",
      },
    ],
  },
];

export class WorkflowRegistry {
  private readonly workflows = new Map<string, WorkflowDefinition>();

  constructor(workflows: WorkflowDefinition[] = MVP_WORKFLOWS) {
    for (const workflow of workflows) {
      const validation = validateWorkflowDefinition(workflow);
      if (!validation.ok) {
        throw new Error(
          `Invalid workflow definition \"${workflow.id}\": ${('errors' in validation ? validation.errors : []).join("; ")}`,
        );
      }
      this.workflows.set(workflow.id, workflow);
    }
  }

  getWorkflow(id: string): WorkflowDefinition | undefined {
    return this.workflows.get(id);
  }

  listWorkflows(): WorkflowDefinition[] {
    return Array.from(this.workflows.values());
  }
}

export function createDefaultWorkflowRegistry(): WorkflowRegistry {
  return new WorkflowRegistry();
}
