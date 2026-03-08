import { describe, expect, it, vi } from "vitest";
import { handleWorkflowCommand } from "./workflow-command.js";

describe("workflow command", () => {
  const baseRun = {
    runId: "wf-1",
    workflowId: "serial_planner_executor_complete",
    status: "running",
    trigger: { type: "manual" as const, source: "webchat" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    outputs: {},
    steps: {
      planner: {
        stepId: "planner",
        type: "spawn_agent",
        status: "waiting",
        attempts: 1,
        maxAttempts: 2,
      },
    },
  };

  it("runs, retries, reconciles, traces, and cancels workflows through command facade", async () => {
    const bridge = {
      runWorkflow: vi.fn().mockResolvedValue({ run: baseRun, actions: [] }),
      retryWorkflow: vi.fn().mockResolvedValue({ run: { ...baseRun, runId: "wf-2" }, actions: [] }),
      reconcileWorkflow: vi.fn().mockResolvedValue({
        ok: true,
        triggeredAt: new Date().toISOString(),
        reason: "manual_reconcile",
        scanned: 2,
        updated: 1,
        deletedTerminalRuns: 0,
        touchedRunIds: ["wf-1"],
      }),
      cancelWorkflow: vi
        .fn()
        .mockResolvedValue({ run: { ...baseRun, status: "canceled" }, actions: [] }),
      listRuns: vi.fn().mockResolvedValue([baseRun]),
      getRun: vi.fn().mockResolvedValue(baseRun),
      getRunTrace: vi.fn().mockResolvedValue({
        runId: "wf-1",
        total: 1,
        trace: [
          {
            ts: new Date().toISOString(),
            level: "info",
            event: "workflow_started",
            message: "started",
          },
        ],
      }),
      postEvent: vi.fn(),
    };

    const runResult = await handleWorkflowCommand({
      bridge: bridge as any,
      tokens: ["run", "serial_planner_executor_complete"],
      ctx: {
        channel: "webchat",
        commandBody: "/negentropy workflow run serial_planner_executor_complete",
        config: {} as any,
        isAuthorizedSender: true,
      },
    });

    expect(runResult.text).toContain("Workflow run started");
    expect(bridge.runWorkflow).toHaveBeenCalled();

    const retryResult = await handleWorkflowCommand({
      bridge: bridge as any,
      tokens: ["retry", "wf-1"],
      ctx: {
        channel: "webchat",
        commandBody: "/negentropy workflow retry wf-1",
        config: {} as any,
        isAuthorizedSender: true,
      },
    });
    expect(retryResult.text).toContain("retried from wf-1");
    expect(bridge.retryWorkflow).toHaveBeenCalledWith(expect.objectContaining({ runId: "wf-1" }));

    const reconcileResult = await handleWorkflowCommand({
      bridge: bridge as any,
      tokens: ["reconcile", "wf-1", "--reason", "manual", "recover"],
      ctx: {
        channel: "webchat",
        commandBody: "/negentropy workflow reconcile wf-1 --reason manual recover",
        config: {} as any,
        isAuthorizedSender: true,
      },
    });
    expect(reconcileResult.text).toContain("Workflow reconcile completed");
    expect(bridge.reconcileWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "wf-1", reason: "manual recover" }),
    );

    const traceResult = await handleWorkflowCommand({
      bridge: bridge as any,
      tokens: ["trace", "wf-1", "5"],
      ctx: {
        channel: "webchat",
        commandBody: "/negentropy workflow trace wf-1 5",
        config: {} as any,
        isAuthorizedSender: true,
      },
    });

    expect(traceResult.text).toContain("Trace tail for wf-1");
    expect(bridge.getRunTrace).toHaveBeenCalledWith("wf-1");

    const cancelResult = await handleWorkflowCommand({
      bridge: bridge as any,
      tokens: ["cancel", "wf-1", "--emergency"],
      ctx: {
        channel: "webchat",
        commandBody: "/negentropy workflow cancel wf-1 --emergency",
        config: {} as any,
        isAuthorizedSender: true,
      },
    });

    expect(cancelResult.text).toContain("Workflow run stopped");
    expect(bridge.cancelWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ runId: "wf-1", emergency: true }),
    );
  });
});
