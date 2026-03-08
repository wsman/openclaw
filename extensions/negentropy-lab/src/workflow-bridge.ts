import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import type { WorkflowClient } from "./workflow-client.js";
import type {
  WorkflowAction,
  WorkflowEventPayload,
  WorkflowReconcileResponse,
  WorkflowRunResponse,
  WorkflowRunView,
  WorkflowTraceResponse,
} from "./workflow-types.js";

export type WorkflowBridge = {
  runWorkflow: (input: {
    workflowId: string;
    source?: string;
    requestedBy?: string;
    sessionKey?: string;
  }) => Promise<WorkflowRunResponse>;
  retryWorkflow: (input: {
    runId: string;
    source?: string;
    requestedBy?: string;
    sessionKey?: string;
  }) => Promise<WorkflowRunResponse>;
  reconcileWorkflow: (input: {
    runId?: string;
    includeTerminal?: boolean;
    source?: string;
    requestedBy?: string;
    sessionKey?: string;
    reason?: string;
  }) => Promise<WorkflowReconcileResponse>;
  cancelWorkflow: (input: { runId: string; emergency?: boolean; reason?: string }) => Promise<WorkflowRunResponse>;
  listRuns: (input?: { workflowId?: string; status?: string; limit?: number }) => Promise<WorkflowRunView[]>;
  getRun: (runId: string) => Promise<WorkflowRunView>;
  getRunTrace: (runId: string) => Promise<WorkflowTraceResponse>;
  postEvent: (payload: WorkflowEventPayload) => Promise<WorkflowRunResponse>;
};

export function createWorkflowBridge(params: {
  client: WorkflowClient;
  runtime: OpenClawPluginApi["runtime"];
  logger?: OpenClawPluginApi["logger"];
  autoDispatchSubagents: boolean;
}): WorkflowBridge {
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const postEventWithRetry = async (payload: WorkflowEventPayload): Promise<WorkflowRunResponse> => {
    let attempt = 0;
    let lastError: unknown;

    while (attempt < 3) {
      attempt += 1;
      try {
        return await params.client.sendEvent(payload);
      } catch (error) {
        lastError = error;
        if (attempt >= 3) {
          break;
        }
        await sleep(150 * attempt);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`workflow event delivery failed: ${String(lastError)}`);
  };

  const executeActions = async (response: WorkflowRunResponse): Promise<void> => {
    if (!params.autoDispatchSubagents || !response.actions?.length) {
      return;
    }

    const queue: WorkflowAction[] = [...response.actions];
    let processed = 0;

    while (queue.length > 0 && processed < 64) {
      processed += 1;
      const action = queue.shift();
      if (!action) {
        continue;
      }

      if (action.type === "spawn_subagent") {
        try {
          const result = await params.runtime.subagent.run({
            sessionKey: action.payload.childSessionKey,
            message: action.payload.prompt,
            extraSystemPrompt: action.payload.extraSystemPrompt,
            lane: action.payload.lane,
            deliver: false,
          });

          const follow = await postEventWithRetry({
            type: "subagent_spawned",
            runId: action.runId,
            stepId: action.stepId,
            childSessionKey: action.payload.childSessionKey,
            childRunId: result.runId,
            dedupeKey: `bridge_spawned:${action.runId}:${action.stepId}:${action.payload.childSessionKey}:${result.runId}`,
            message: "subagent spawned via workflow bridge",
          });

          if (Array.isArray(follow.actions) && follow.actions.length > 0) {
            queue.push(...follow.actions);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          params.logger?.warn?.(
            `[negentropy-lab] workflow spawn action failed run=${action.runId} step=${action.stepId}: ${message}`,
          );

          const follow = await postEventWithRetry({
            type: "subagent_spawn_failed",
            runId: action.runId,
            stepId: action.stepId,
            childSessionKey: action.payload.childSessionKey,
            dedupeKey: `bridge_spawn_failed:${action.runId}:${action.stepId}:${action.payload.childSessionKey}`,
            error: message,
            message: "subagent spawn failed in workflow bridge",
          });

          if (Array.isArray(follow.actions) && follow.actions.length > 0) {
            queue.push(...follow.actions);
          }
        }
        continue;
      }

      if (action.type === "send_session_message") {
        params.logger?.info?.(
          `[negentropy-lab] workflow message run=${action.runId} step=${action.stepId}: ${action.payload.message}`,
        );
        continue;
      }

      if (action.type === "trace") {
        params.logger?.debug?.(
          `[negentropy-lab] workflow trace run=${action.runId} step=${action.stepId}: ${action.payload.message}`,
        );
      }
    }

    if (processed >= 64 && queue.length > 0) {
      params.logger?.warn?.("[negentropy-lab] workflow action queue truncated after 64 actions");
    }
  };

  const postEvent = async (payload: WorkflowEventPayload): Promise<WorkflowRunResponse> => {
    const response = await postEventWithRetry(payload);
    await executeActions(response);
    return response;
  };

  return {
    async runWorkflow(input) {
      const response = await params.client.runWorkflow({
        workflowId: input.workflowId,
        trigger: {
          source: input.source,
          requestedBy: input.requestedBy,
          sessionKey: input.sessionKey,
        },
      });
      await executeActions(response);
      return response;
    },

    async retryWorkflow(input) {
      const response = await params.client.retryWorkflow({
        runId: input.runId,
        trigger: {
          source: input.source,
          requestedBy: input.requestedBy,
          sessionKey: input.sessionKey,
        },
      });
      await executeActions(response);
      return response;
    },

    async reconcileWorkflow(input) {
      return params.client.reconcileWorkflow({
        runId: input.runId,
        includeTerminal: input.includeTerminal,
        reason:
          input.reason ??
          `manual_reconcile:${input.source ?? "workflow-command"}:${input.requestedBy ?? "unknown"}`,
      });
    },

    async cancelWorkflow(input) {
      const response = await params.client.cancelWorkflow({
        runId: input.runId,
        emergency: input.emergency,
        reason: input.reason,
      });
      await executeActions(response);
      return response;
    },

    async listRuns(input = {}) {
      const list = await params.client.listRuns(input);
      return list.runs;
    },

    getRun(runId) {
      return params.client.getRun(runId);
    },

    getRunTrace(runId) {
      return params.client.getRunTrace(runId);
    },

    postEvent,
  };
}
