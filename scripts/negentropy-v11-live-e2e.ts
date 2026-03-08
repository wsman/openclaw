import assert from "node:assert/strict";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import express from "express";
import type { AddressInfo } from "node:net";
import negentropyPlugin from "../extensions/negentropy-lab/index.ts";
import * as decisionApiModule from "../vendor/negentropy-lab/server/gateway/openclaw-decision/api/internal-api.ts";

const createInternalApiRouter =
  (decisionApiModule as { createInternalApiRouter?: () => import("express").Router }).createInternalApiRouter ??
  (
    decisionApiModule as {
      default?: { createInternalApiRouter?: () => import("express").Router };
    }
  ).default?.createInternalApiRouter;

type HookName =
  | "subagent_spawning"
  | "subagent_spawned"
  | "subagent_ended"
  | "session_start"
  | "session_end"
  | "gateway_request";

type HookHandler = (event: Record<string, unknown>, ctx?: Record<string, unknown>) => Promise<unknown> | unknown;

type CommandHandler = (ctx: {
  args?: string;
  channel: string;
  senderId?: string;
  commandBody?: string;
  isAuthorizedSender?: boolean;
  config?: unknown;
}) => Promise<{ text?: string }> | { text?: string };

type RunView = {
  runId: string;
  workflowId: string;
  status: string;
  metadata?: { retryOfRunId?: string };
  steps: Record<
    string,
    {
      stepId: string;
      type: string;
      status: string;
      attempts: number;
      child?: { childSessionKey: string; childRunId?: string };
    }
  >;
};

function readArg(name: string): string | undefined {
  const prefix = `${name}=`;
  for (const arg of process.argv.slice(2)) {
    if (arg === name) {
      return "1";
    }
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length);
    }
  }
  return undefined;
}

const debugEnabled =
  process.env.NEGENTROPY_LIVE_E2E_DEBUG === "1" || readArg("--debug") === "1";
const debugFilePath = process.env.NEGENTROPY_LIVE_E2E_DEBUG_FILE || readArg("--debug-log");
const stopAfterPhase = readArg("--stop-after");
const outputPath = process.env.NEGENTROPY_LIVE_E2E_OUTPUT || readArg("--output");
const summaryPath = process.env.NEGENTROPY_LIVE_E2E_SUMMARY || readArg("--summary");
const quiet = process.env.NEGENTROPY_LIVE_E2E_QUIET === "1" || readArg("--quiet") === "1";

function debugLog(message: string): void {
  if (!debugEnabled) {
    return;
  }
  const line = `[negentropy-live-e2e] ${message}\n`;
  process.stderr.write(line);
  if (debugFilePath) {
    try {
      appendFileSync(debugFilePath, line, "utf8");
    } catch {
      // Debug logging must never break the live E2E harness.
    }
  }
}

function ensureParentDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

function emitResult(payload: Record<string, unknown>): void {
  const text = `${JSON.stringify(payload, null, 2)}\n`;

  if (!quiet) {
    process.stdout.write(text);
  }

  if (outputPath) {
    ensureParentDir(outputPath);
    writeFileSync(outputPath, text, "utf8");
  }

  if (summaryPath) {
    const status = payload.ok === true ? "PASS" : "FAIL";
    const lines = [
      `[negentropy-v11-live-e2e] status=${status}`,
      `generatedAt=${new Date().toISOString()}`,
      `outputPath=${outputPath ?? "<stdout-only>"}`,
      `workflowBaseUrl=${String(payload.workflowBaseUrl ?? "")}`,
      `error=${String(payload.errorMessage ?? "")}`,
    ];
    ensureParentDir(summaryPath);
    writeFileSync(summaryPath, `${lines.join("\n")}\n`, "utf8");
  }
}

function maybeStop(phase: string): void {
  if (stopAfterPhase === phase) {
    debugLog(`stopped after phase=${phase}`);
    process.stdout.write(`${JSON.stringify({ stoppedAfter: phase }, null, 2)}\n`);
    process.exit(0);
  }
}

function parseRunId(text: string): string {
  const match = text.match(/runId:\s+(wf_[a-zA-Z0-9-]+)/);
  assert(match, `runId missing in output:\n${text}`);
  return match[1];
}

function parseStatus(text: string): string {
  const match = text.match(/status:\s+([a-z_]+)/i);
  assert(match, `status missing in output:\n${text}`);
  return match[1].toLowerCase();
}

async function main(): Promise<Record<string, unknown>> {
  debugLog("boot");
  assert(createInternalApiRouter, "createInternalApiRouter export missing");

  const app = express();
  app.use(express.json());
  app.use("/internal/openclaw", createInternalApiRouter());

  const server = await new Promise<import("http").Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  debugLog("server listening");

  const port = (server.address() as AddressInfo).port;
  const workflowBaseUrl = `http://127.0.0.1:${port}/internal/openclaw/workflows`;

  const hooks = new Map<HookName, HookHandler[]>();
  let commandHandler: CommandHandler | undefined;
  let childCounter = 0;

  const emitHook = async (name: HookName, event: Record<string, unknown>, ctx: Record<string, unknown> = {}) => {
    const handlers = hooks.get(name) ?? [];
    for (const handler of handlers) {
      await handler(event, ctx);
    }
  };

  const runtime = {
    subagent: {
      run: async (_input: {
        sessionKey: string;
        message: string;
        extraSystemPrompt?: string;
        lane?: string;
        deliver?: boolean;
      }) => {
        childCounter += 1;
        return { runId: `child-run-${childCounter}` };
      },
    },
  };

  const logger = {
    info: (_: string) => undefined,
    warn: (_: string) => undefined,
    error: (_: string) => undefined,
    debug: (_: string) => undefined,
  };

  const api: any = {
    id: "negentropy-lab",
    name: "negentropy-lab",
    source: "live-e2e",
    config: {},
    runtime,
    logger,
    pluginConfig: {
      mode: "OFF",
      serviceUrl: `http://127.0.0.1:${port}/internal/openclaw/decision`,
      workflowEnabled: true,
      orchestrationApiBaseUrl: workflowBaseUrl,
      workflowTimeoutMs: 5000,
      autoDispatchSubagents: true,
      enableRollbackSwitch: true,
    },
    registerTool() {},
    registerHook() {},
    registerHttpRoute() {},
    registerChannel() {},
    registerGatewayMethod() {},
    registerCli() {},
    registerService() {},
    registerProvider() {},
    registerContextEngine() {},
    resolvePath(input: string) {
      return input;
    },
    registerCommand(command: { name: string; handler: CommandHandler }) {
      if (command.name === "negentropy") {
        commandHandler = command.handler;
      }
    },
    on(name: HookName, handler: HookHandler) {
      const list = hooks.get(name) ?? [];
      list.push(handler);
      hooks.set(name, list);
    },
  };

  negentropyPlugin.register(api);
  assert(commandHandler, "negentropy command handler not registered");
  debugLog("plugin registered");

  const runCommand = async (args: string): Promise<string> => {
    const result = await commandHandler!({
      args,
      channel: "webchat",
      senderId: "live-e2e",
      commandBody: `/negentropy ${args}`,
      isAuthorizedSender: true,
      config: {},
    });
    return result.text ?? "";
  };

  const fetchRun = async (runId: string): Promise<RunView> => {
    const response = await fetch(`${workflowBaseUrl}/${encodeURIComponent(runId)}`);
    assert(response.ok, `failed to fetch run ${runId}`);
    return (await response.json()) as RunView;
  };

  const waitUntilStatus = async (runId: string, expected: string[], timeoutMs = 15_000) => {
    const startedAt = Date.now();
    let last = "";
    while (Date.now() - startedAt < timeoutMs) {
      const text = await runCommand(`workflow status ${runId}`);
      last = text;
      const status = parseStatus(text);
      if (expected.includes(status)) {
        return { status, text };
      }
      await sleep(120);
    }
    throw new Error(`timeout waiting ${expected.join(",")} for ${runId}; last=\n${last}`);
  };

  const driveRun = async (params: {
    runId: string;
    outcomeForStep?: (stepId: string, attempt: number) => "ok" | "error" | "timeout";
    pauseOnFirstWaiting?: boolean;
    useSessionEndFallbackOnce?: boolean;
    timeoutMs?: number;
  }): Promise<RunView> => {
    const processed = new Set<string>();
    let paused = false;
    let fallbackUsed = false;
    const startedAt = Date.now();
    const timeoutMs = params.timeoutMs ?? 20_000;

    while (Date.now() - startedAt < timeoutMs) {
      const run = await fetchRun(params.runId);
      if (["completed", "failed", "canceled", "timed_out"].includes(run.status)) {
        return run;
      }

      for (const step of Object.values(run.steps)) {
        if (step.type !== "spawn_agent" || step.status !== "waiting" || !step.child?.childSessionKey) {
          continue;
        }

        const token = `${step.stepId}:${step.attempts}:${step.child.childSessionKey}`;
        if (processed.has(token)) {
          continue;
        }
        processed.add(token);

        const ctx = {
          runId: run.runId,
          childSessionKey: step.child.childSessionKey,
          requesterSessionKey: "agent:main",
        };

        await emitHook(
          "subagent_spawning",
          {
            childSessionKey: step.child.childSessionKey,
            agentId: step.stepId,
            mode: "run",
            threadRequested: false,
            label: step.stepId,
          },
          ctx,
        );

        await emitHook(
          "subagent_spawned",
          {
            childSessionKey: step.child.childSessionKey,
            runId: step.child.childRunId ?? `child-hook-${step.stepId}-${step.attempts}`,
            agentId: step.stepId,
            mode: "run",
            threadRequested: false,
            label: step.stepId,
          },
          ctx,
        );

        if (params.pauseOnFirstWaiting && !paused) {
          paused = true;
          continue;
        }

        if (params.useSessionEndFallbackOnce && !fallbackUsed) {
          fallbackUsed = true;
          await emitHook(
            "session_end",
            {
              sessionId: `fallback-${step.stepId}`,
              sessionKey: step.child.childSessionKey,
              messageCount: 1,
              durationMs: 100,
            },
            {
              agentId: step.stepId,
              sessionId: `fallback-${step.stepId}`,
              sessionKey: step.child.childSessionKey,
            },
          );
          continue;
        }

        const outcome = params.outcomeForStep?.(step.stepId, step.attempts) ?? "ok";
        await emitHook(
          "subagent_ended",
          {
            targetSessionKey: step.child.childSessionKey,
            runId: step.child.childRunId ?? `child-hook-${step.stepId}-${step.attempts}`,
            targetKind: "subagent",
            reason: outcome === "ok" ? "completed" : `simulated-${outcome}`,
            outcome,
            ...(outcome === "ok" ? {} : { error: `simulated ${outcome}` }),
          },
          ctx,
        );
      }

      await sleep(120);
    }

    throw new Error(`driveRun timeout for ${params.runId}`);
  };

  await emitHook(
    "session_start",
    {
      sessionId: "main-session",
      sessionKey: "agent:main",
      resumedFrom: "none",
    },
    {
      agentId: "main",
      sessionId: "main-session",
      sessionKey: "agent:main",
    },
  );
  debugLog("session_start emitted");
  maybeStop("session_start");

  debugLog("run serial");
  const serialStart = await runCommand("workflow run serial_planner_executor_complete");
  const serialRunId = parseRunId(serialStart);
  const serialRun = await driveRun({ runId: serialRunId });
  assert.equal(serialRun.status, "completed");
  maybeStop("serial");

  debugLog("run parallel");
  const parallelStart = await runCommand("workflow run parallel_research_implementation_review");
  const parallelRunId = parseRunId(parallelStart);
  const parallelRun = await driveRun({ runId: parallelRunId });
  assert.equal(parallelRun.status, "completed");
  maybeStop("parallel");

  debugLog("run failure");
  const failureStart = await runCommand("workflow run failure_retry_escalate");
  const failureRunId = parseRunId(failureStart);
  const failureRun = await driveRun({
    runId: failureRunId,
    outcomeForStep: () => "error",
  });
  assert.equal(failureRun.status, "failed");
  maybeStop("failure");

  debugLog("run retry");
  const retryText = await runCommand(`workflow retry ${failureRunId}`);
  const retryRunId = parseRunId(retryText);
  const retryRun = await driveRun({
    runId: retryRunId,
    outcomeForStep: () => "ok",
  });
  assert.equal(retryRun.status, "completed");
  assert.equal(retryRun.metadata?.retryOfRunId, failureRunId);
  maybeStop("retry");

  debugLog("run fallback");
  const fallbackStart = await runCommand("workflow run serial_planner_executor_complete");
  const fallbackRunId = parseRunId(fallbackStart);
  const fallbackRun = await driveRun({
    runId: fallbackRunId,
    useSessionEndFallbackOnce: true,
  });
  assert.equal(fallbackRun.status, "completed");
  maybeStop("fallback");

  debugLog("run cancel");
  const cancelStart = await runCommand("workflow run serial_planner_executor_complete");
  const cancelRunId = parseRunId(cancelStart);
  await driveRun({ runId: cancelRunId, pauseOnFirstWaiting: true, timeoutMs: 1500 }).catch(() => undefined);
  const cancelText = await runCommand(`workflow cancel ${cancelRunId} --emergency`);
  assert.match(cancelText, /Workflow run stopped/i);
  const cancelTerminal = await waitUntilStatus(cancelRunId, ["canceled"]);
  assert.equal(cancelTerminal.status, "canceled");
  maybeStop("cancel");

  debugLog("run emergency");
  const emergencyStart = await runCommand("workflow run parallel_research_implementation_review");
  const emergencyRunId = parseRunId(emergencyStart);
  await driveRun({ runId: emergencyRunId, pauseOnFirstWaiting: true, timeoutMs: 1500 }).catch(() => undefined);
  const emergencyText = await runCommand(`workflow emergency-stop ${emergencyRunId}`);
  assert.match(emergencyText, /Workflow run stopped/i);
  const emergencyTerminal = await waitUntilStatus(emergencyRunId, ["canceled"]);
  assert.equal(emergencyTerminal.status, "canceled");
  maybeStop("emergency");

  debugLog("run timeout");
  const timeoutStart = await runCommand("workflow run serial_planner_executor_complete");
  const timeoutRunId = parseRunId(timeoutStart);
  const timeoutRun = await driveRun({
    runId: timeoutRunId,
    outcomeForStep: () => "timeout",
  });
  assert.equal(timeoutRun.status, "timed_out");
  maybeStop("timeout");

  debugLog("run list/status/trace");
  const listText = await runCommand("workflow list");
  assert.match(listText, /Workflow runs \(/);

  const statusText = await runCommand(`workflow status ${serialRunId}`);
  assert.match(statusText, /workflowId: serial_planner_executor_complete/);

  const traceText = await runCommand(`workflow trace ${serialRunId} 50`);
  assert.match(traceText, /Trace tail/);

  const reconcileText = await runCommand(`workflow reconcile ${serialRunId} --reason live_smoke_manual_reconcile`);
  assert.match(reconcileText, /Workflow reconcile completed/i);
  maybeStop("trace");

  const orphanResponse = await fetch(`${workflowBaseUrl}/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "subagent_ended",
      childSessionKey: "orphan-child-session",
      childRunId: "orphan-child-run",
      dedupeKey: "orphan-event",
      outcome: "error",
      error: "orphaned child",
    }),
  });
  assert.equal(orphanResponse.ok, true);
  const orphanBody = (await orphanResponse.json()) as { ignored?: boolean; message?: string };
  assert.equal(orphanBody.ignored, true);
  assert.match(orphanBody.message ?? "", /no workflow run matched/i);
  maybeStop("orphan");

  const gatewayDecisionSmoke = await fetch(`http://127.0.0.1:${port}/internal/openclaw/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "tools.invoke",
      params: { tool: "status" },
      transport: "ws",
    }),
  });
  assert.equal(gatewayDecisionSmoke.ok, true);
  debugLog("decision smoke ok");
  maybeStop("decision_smoke");

  await emitHook(
    "session_end",
    {
      sessionId: "main-session",
      sessionKey: "agent:main",
      messageCount: 99,
      durationMs: 9999,
    },
    {
      agentId: "main",
      sessionId: "main-session",
      sessionKey: "agent:main",
    },
  );
  debugLog("session_end emitted");
  maybeStop("session_end");

  const closeableServer = server as import("http").Server & {
    closeIdleConnections?: () => void;
    closeAllConnections?: () => void;
  };

  await new Promise<void>((resolve, reject) => {
    closeableServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
    closeableServer.closeIdleConnections?.();
    closeableServer.closeAllConnections?.();
  });
  debugLog("server closed");
  maybeStop("server_closed");

  const unavailableText = await runCommand("workflow list");
  assert.match(unavailableText, /Workflow command failed/i);
  debugLog("post-close unavailable check ok");
  maybeStop("post_close");

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    workflowBaseUrl,
    outputPath: outputPath ?? null,
    summaryPath: summaryPath ?? null,
    runs: {
      serialRunId,
      parallelRunId,
      failureRunId,
      retryRunId,
      fallbackRunId,
      cancelRunId,
      emergencyRunId,
      timeoutRunId,
    },
    statuses: {
      serial: serialRun.status,
      parallel: parallelRun.status,
      failure: failureRun.status,
      retry: retryRun.status,
      fallback: fallbackRun.status,
      cancel: cancelTerminal.status,
      emergencyStop: emergencyTerminal.status,
      timeout: timeoutRun.status,
    },
    checks: {
      list: true,
      status: true,
      trace: true,
      reconcile: true,
      cancel: true,
      emergencyStop: true,
      retry: true,
      orphanIgnored: true,
      decisionChainSmoke: true,
      apiUnavailableHandled: true,
    },
  };
}

void (async () => {
  try {
    const report = await main();
    emitResult(report);
    process.exitCode = 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack ?? message : message;

    const failurePayload = {
      ok: false,
      generatedAt: new Date().toISOString(),
      workflowBaseUrl: "",
      outputPath: outputPath ?? null,
      summaryPath: summaryPath ?? null,
      errorMessage: message,
      errorStack: stack,
    };

    emitResult(failurePayload);
    process.stderr.write(`${stack}\n`);
    process.exitCode = 1;
  }
})();
