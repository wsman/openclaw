/**
 * 🎼 OpenClaw Orchestration Module - 工作流编排模块
 * 
 * @constitution
 * §101 同步公理: 代码与文档必须原子性同步
 * §102 熵减原则: 标准化模块导出，降低系统熵值
 * §105 数据完整性公理: 模块边界必须清晰定义
 * §152 单一真理源公理: 编排模块统一入口
 * 
 * @filename index.ts
 * @version 1.0.0
 * @category orchestration
 * @last_updated 2026-03-09
 */

export {
  WORKFLOW_CONDITIONS,
  WORKFLOW_STEP_TYPES,
  WORKFLOW_TRIGGER_TYPES,
  validateWorkflowDefinition,
  type WorkflowDefinition,
  type WorkflowJoinPolicy,
  type WorkflowRetryPolicy,
  type WorkflowStep,
  type WorkflowStepCondition,
  type WorkflowStepType,
  type WorkflowTrigger,
} from "./contracts/workflow-contract";

export {
  WORKFLOW_RUN_STATUSES,
  canTransition,
  isTerminalStatus,
  transitionStatus,
  type WorkflowRunStatus,
  type WorkflowStepStatus,
} from "./runtime/state-machine";

export {
  WorkflowRunStore,
  type ChildSessionBinding,
  type WorkflowRunState,
  type WorkflowRunTraceEntry,
  type WorkflowRunTrigger,
  type WorkflowStepRuntimeState,
} from "./runtime/run-store";

export {
  executeStep,
  type StepExecutionContext,
  type StepExecutionResult,
  type WorkflowAction,
} from "./actions/step-actions";

export {
  WorkflowRegistry,
  createDefaultWorkflowRegistry,
} from "./service/workflow-registry";

export {
  OrchestrationService,
  createOrchestrationService,
  type CancelRunRequest,
  type ListRunsRequest,
  type OrchestrationResult,
  type RetryWorkflowRequest,
  type StartWorkflowRequest,
  type WorkflowRuntimeEvent,
  type WorkflowRuntimeEventType,
} from "./service/orchestration-service";

export { createWorkflowInternalApiRouter } from "./api/internal-api";
