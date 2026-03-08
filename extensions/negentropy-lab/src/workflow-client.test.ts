import { describe, expect, it, vi } from "vitest";
import { createWorkflowClient } from "./workflow-client.js";

describe("workflow client", () => {
  it("calls workflow endpoints with the expected paths", async () => {
    const fetchSpy = vi
      .fn<typeof fetch>()
      .mockResolvedValue({ ok: true, text: async () => JSON.stringify({ run: { runId: "wf-1" }, actions: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ run: { runId: "wf-1" }, actions: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ run: { runId: "wf-2" }, actions: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ run: { runId: "wf-1" }, actions: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ total: 1, runs: [] }) } as Response)
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ runId: "wf-1" }) } as Response)
      .mockResolvedValueOnce({ ok: true, text: async () => JSON.stringify({ runId: "wf-1", trace: [], total: 0 }) } as Response);

    const client = createWorkflowClient(
      { baseUrl: "http://127.0.0.1:3000/internal/openclaw/workflows", timeoutMs: 5000 },
      fetchSpy,
    );

    await client.runWorkflow({ workflowId: "serial" });
    await client.retryWorkflow({ runId: "wf-1" });
    await client.sendEvent({ type: "session_start", sessionId: "session-1", sessionKey: "agent:main" });
    await client.listRuns({ workflowId: "serial", status: "running", limit: 3 });
    await client.getRun("wf-1");
    await client.getRunTrace("wf-1");

    expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual([
      "http://127.0.0.1:3000/internal/openclaw/workflows/run",
      "http://127.0.0.1:3000/internal/openclaw/workflows/retry",
      "http://127.0.0.1:3000/internal/openclaw/workflows/event",
      "http://127.0.0.1:3000/internal/openclaw/workflows?workflowId=serial&status=running&limit=3",
      "http://127.0.0.1:3000/internal/openclaw/workflows/wf-1",
      "http://127.0.0.1:3000/internal/openclaw/workflows/wf-1/log",
    ]);
  });

  it("surfaces API error messages and rejects empty success payloads", async () => {
    const failingFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ message: "run not found" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => "",
      } as Response);

    const client = createWorkflowClient(
      { baseUrl: "http://127.0.0.1:3000/internal/openclaw/workflows", timeoutMs: 5000 },
      failingFetch,
    );

    await expect(client.getRun("missing")).rejects.toThrow("run not found");
    await expect(client.listRuns()).rejects.toThrow("Workflow API returned empty payload.");
  });
});
