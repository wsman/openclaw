import type { WorkflowBridge } from "./workflow-bridge.js";
import type { WorkflowRunView } from "./workflow-types.js";

type WorkflowCommandContext = {
  senderId?: string;
  channel: string;
  commandBody?: string;
  config?: unknown;
  isAuthorizedSender?: boolean;
};

function formatRunSummary(run: WorkflowRunView): string {
  const stepLines = Object.values(run.steps)
    .map((step) => {
      const child = step.child?.childSessionKey
        ? ` child=${step.child.childSessionKey}${step.child.childRunId ? `/${step.child.childRunId}` : ""}`
        : "";
      const error = step.lastError ? ` error=${step.lastError}` : "";
      const orphan = step.metadata?.orphanedChild ? " orphanedChild=true" : "";
      const wake = step.metadata?.wakeReason ? ` wake=${step.metadata.wakeReason}` : "";
      return `  - ${step.stepId}: ${step.status} attempts=${step.attempts}/${step.maxAttempts}${child}${wake}${orphan}${error}`;
    })
    .join("\n");

  return [
    `runId: ${run.runId}`,
    `workflowId: ${run.workflowId}`,
    `status: ${run.status}`,
    `trigger: ${run.trigger.type}${run.trigger.source ? ` (${run.trigger.source})` : ""}`,
    `updatedAt: ${run.updatedAt}`,
    `checkpoint.seq: ${run.checkpoint?.sequence ?? 0}`,
    `recoveryCount: ${run.metadata?.recoveryCount ?? 0}`,
    `lastWakeReason: ${run.metadata?.lastWakeReason ?? "none"}`,
    `lastError: ${run.lastError ?? "none"}`,
    "steps:",
    stepLines || "  (none)",
  ].join("\n");
}

function formatList(runs: WorkflowRunView[]): string {
  if (runs.length === 0) {
    return "No workflow runs found.";
  }
  return [
    `Workflow runs (${runs.length}):`,
    ...runs.map((run) => `- ${run.runId} | ${run.workflowId} | ${run.status} | ${run.updatedAt}`),
  ].join("\n");
}

function usageText(): string {
  return [
    "Usage:",
    "- /negentropy workflow status [runId]",
    "- /negentropy workflow list",
    "- /negentropy workflow trace <runId> [limit]",
    "- /negentropy workflow run <name>",
    "- /negentropy workflow retry <runId>",
    "- /negentropy workflow reconcile [runId] [--include-terminal] [--reason <text>]",
    "- /negentropy workflow cancel <runId> [--emergency]",
    "- /negentropy workflow emergency-stop <runId>",
  ].join("\n");
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function formatTrace(params: {
  runId: string;
  trace: Array<{
    ts: string;
    level: "info" | "warn" | "error";
    event: string;
    stepId?: string;
    message: string;
  }>;
  limit: number;
}): string {
  if (params.trace.length === 0) {
    return `No trace entries for run ${params.runId}.`;
  }

  const lines = params.trace
    .slice(Math.max(0, params.trace.length - params.limit))
    .map(
      (entry) =>
        `- ${entry.ts} [${entry.level}] ${entry.event}${entry.stepId ? ` (${entry.stepId})` : ""}: ${entry.message}`,
    );

  return [`Trace tail for ${params.runId} (last ${lines.length}):`, ...lines].join("\n");
}

export async function handleWorkflowCommand(params: {
  bridge: WorkflowBridge;
  tokens: string[];
  ctx: WorkflowCommandContext;
}): Promise<{ text: string }> {
  const [action = "status", ...rest] = params.tokens;

  try {
    if (action === "status") {
    const runId = rest[0];
    if (runId) {
      const run = await params.bridge.getRun(runId);
      return { text: formatRunSummary(run) };
    }

    const runs = await params.bridge.listRuns({ limit: 10 });
    if (runs.length === 0) {
      return { text: "No workflow runs available." };
    }
    const latest = runs[0];
    return { text: `Latest workflow run:\n${formatRunSummary(latest)}` };
  }

  if (action === "list") {
    const runs = await params.bridge.listRuns({ limit: 20 });
    return { text: formatList(runs) };
  }

  if (action === "trace") {
    const runId = rest[0];
    if (!runId) {
      return { text: `Missing runId.\n${usageText()}` };
    }

    const limit = parsePositiveInt(rest[1], 30);
    const trace = await params.bridge.getRunTrace(runId);
    return {
      text: formatTrace({ runId, trace: trace.trace, limit }),
    };
  }

  if (action === "run") {
    const workflowId = rest[0];
    if (!workflowId) {
      return { text: `Missing workflow name.\n${usageText()}` };
    }

    const response = await params.bridge.runWorkflow({
      workflowId,
      source: params.ctx.channel,
      requestedBy: params.ctx.senderId,
    });

    if (!response.run) {
      return {
        text: response.message ?? "Workflow run request did not return a run record.",
      };
    }

    return {
      text: `Workflow run started.\n${formatRunSummary(response.run)}`,
    };
  }

  if (action === "retry") {
    const runId = rest[0];
    if (!runId) {
      return { text: `Missing runId.\n${usageText()}` };
    }

    const response = await params.bridge.retryWorkflow({
      runId,
      source: params.ctx.channel,
      requestedBy: params.ctx.senderId,
    });

    if (!response.run) {
      return { text: response.message ?? `Failed to retry run ${runId}.` };
    }

    return {
      text: `Workflow run retried from ${runId}.\n${formatRunSummary(response.run)}`,
    };
  }

  if (action === "reconcile") {
    const includeTerminal = rest.includes("--include-terminal");
    const reasonFlagIndex = rest.findIndex((token) => token === "--reason");
    const reason =
      reasonFlagIndex >= 0
        ? rest
            .slice(reasonFlagIndex + 1)
            .filter((token) => !token.startsWith("--"))
            .join(" ")
            .trim() || undefined
        : undefined;

    const positional = rest.filter((token, index) => {
      if (token.startsWith("--")) {
        return false;
      }
      if (reasonFlagIndex >= 0 && index > reasonFlagIndex) {
        return false;
      }
      return true;
    });
    const runId = positional.length > 0 ? positional[0] : undefined;

    const summary = await params.bridge.reconcileWorkflow({
      runId,
      includeTerminal,
      reason,
      source: params.ctx.channel,
      requestedBy: params.ctx.senderId,
    });

    const touchedTail = summary.touchedRunIds.slice(0, 8).join(", ");
    return {
      text: [
        `Workflow reconcile completed (${summary.reason}).`,
        `triggeredAt: ${summary.triggeredAt}`,
        `scanned: ${summary.scanned}`,
        `updated: ${summary.updated}`,
        `deletedTerminalRuns: ${summary.deletedTerminalRuns}`,
        `touchedRunIds: ${summary.touchedRunIds.length}${touchedTail ? ` (${touchedTail}${summary.touchedRunIds.length > 8 ? ", ..." : ""})` : ""}`,
      ].join("\n"),
    };
  }

    if (action === "cancel" || action === "emergency-stop" || action === "stop") {
      const runId = rest[0];
      if (!runId) {
        return { text: `Missing runId.\n${usageText()}` };
      }

      const emergency = action !== "cancel" || rest.includes("--emergency");
      const response = await params.bridge.cancelWorkflow({
        runId,
        emergency,
        reason: emergency ? "emergency stop requested from command" : "manual cancel requested",
      });

      if (!response.run) {
        return { text: response.message ?? `Failed to cancel run ${runId}.` };
      }

      return {
        text: `Workflow run ${emergency ? "stopped" : "canceled"}.\n${formatRunSummary(response.run)}`,
      };
    }

    return { text: usageText() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      text: `Workflow command failed: ${message}`,
    };
  }
}
