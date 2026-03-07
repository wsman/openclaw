import { describe, expect, it, vi } from "vitest";
import { createDecisionBridge, generateTraceId, type DecisionResponse } from "./decision-bridge.js";

describe("negentropy decision bridge", () => {
  it("generates unique trace ids", () => {
    const first = generateTraceId();
    const second = generateTraceId();

    expect(first).toMatch(/^TRC-/);
    expect(second).toMatch(/^TRC-/);
    expect(first).not.toBe(second);
  });

  it("short-circuits in OFF mode", async () => {
    const fetchSpy = vi.fn<typeof fetch>();
    const bridge = createDecisionBridge({ mode: "OFF" }, fetchSpy);

    const result = await bridge.decide({
      transport: "ws",
      method: "chat.send",
      params: { text: "hello" },
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.decision.action).toBe("EXECUTE");
    expect(result.shouldExecute).toBe(true);
  });

  it("returns rewrites from the decision service", async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () =>
        ({
          action: "REWRITE",
          method: "chat.forwarded",
          params: { text: "rewritten" },
        }) satisfies DecisionResponse,
    } as Response);
    const bridge = createDecisionBridge({ mode: "ENFORCE" }, fetchSpy);

    const result = await bridge.decide({
      transport: "ws",
      method: "chat.send",
      params: { text: "original" },
    });

    expect(result.decision.action).toBe("REWRITE");
    expect(result.rewrittenMethod).toBe("chat.forwarded");
    expect(result.rewrittenParams).toEqual({ text: "rewritten" });
    expect(result.shouldExecute).toBe(true);
  });

  it("ignores REJECT in SHADOW mode", async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () =>
        ({
          action: "REJECT",
          reason: "blocked",
        }) satisfies DecisionResponse,
    } as Response);
    const bridge = createDecisionBridge({ mode: "SHADOW" }, fetchSpy);

    const result = await bridge.decide({
      transport: "http",
      method: "http.openresponses.create",
      params: {},
    });

    expect(result.decision.action).toBe("EXECUTE");
    expect(result.shouldExecute).toBe(true);
  });

  it("fails closed in ENFORCE mode when configured", async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));
    const bridge = createDecisionBridge(
      {
        mode: "ENFORCE",
        enforceFailClosed: true,
      },
      fetchSpy,
    );

    const result = await bridge.decide({
      transport: "http",
      method: "http.tools.invoke",
      params: {},
    });

    expect(result.decision.action).toBe("REJECT");
    expect(result.shouldExecute).toBe(false);
    expect(result.rejectReason).toContain("fail-closed");
  });
});
