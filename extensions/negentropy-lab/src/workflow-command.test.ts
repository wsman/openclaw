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

  it("runs, retries, traces, and cancels workflows through command facade", async () => {
    const bridge = {
      runWorkflow: vi.fn().mockResolvedValue({ run: baseRun, actions: [] }),
      retryWorkflow: vi.fn().mockResolvedValue({ run: { ...baseRun, runId: "wf-2" }, actions: [] }),
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
      tokens: ["reconcile", "wf-1"],
      ctx: {
        channel: "webchat",
        commandBody: "/negentropy workflow reconcile wf-1",
        config: {} as any,
        isAuthorizedSender: true,
      },
    });
    expect(reconcileResult.text).toContain("Manual workflow reconcile is no longer available");
    expect(reconcileResult.text).toContain("background sweeps");

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

  it("shows supported workflow commands in usage text for invalid workflow commands", async () => {
    const result = await handleWorkflowCommand({
      bridge: {} as any,
      tokens: ["trace"],
      ctx: {
        channel: "webchat",
        commandBody: "/negentropy workflow trace",
        config: {} as any,
        isAuthorizedSender: true,
      },
    });

    expect(result.text).toContain("Missing runId");
    expect(result.text).toContain("/negentropy workflow retry");
    expect(result.text).toContain("/negentropy workflow stop");
    expect(result.text).not.toContain("/negentropy workflow reconcile");
  });
});
