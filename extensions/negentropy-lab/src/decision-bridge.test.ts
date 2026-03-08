import { describe, expect, it, vi } from "vitest";
import {
  HTTP_METHOD_REWRITE_REJECT_REASON,
  createDecisionBridge,
  generateTraceId,
  type DecisionResponse,
} from "./decision-bridge.js";

describe("negentropy decision bridge", () => {
  it("generates canonical trace ids", () => {
    const first = generateTraceId();
    const second = generateTraceId();

    expect(first).toMatch(/^dec-/);
    expect(second).toMatch(/^dec-/);
    expect(first).not.toBe(second);
  });

  it("creates canonical request fields and maps auth -> authMeta/scopes", async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        action: "EXECUTE",
        traceId: "dec-trace",
        ts: new Date().toISOString(),
      }),
    } as Response);

    const bridge = createDecisionBridge({ mode: "ENFORCE" }, fetchSpy);
    await bridge.decide({
      transport: "http",
      method: "http.tools.invoke",
      params: { tool: "agents_list" },
      auth: {
        token: "tok",
        deviceToken: "dev-1",
        sessionId: "session-1",
        scopes: ["operator.admin"],
      },
      allowMethodRewrite: false,
    });

    const requestInit = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(requestInit.body)) as Record<string, unknown>;

    expect(body.transport).toBe("http");
    expect(body.method).toBe("http.tools.invoke");
    expect(body.params).toEqual({ tool: "agents_list" });
    expect(body.ts).toEqual(expect.any(String));
    expect((body.authMeta as Record<string, unknown> | undefined)?.deviceId).toBe("dev-1");
    expect((body.authMeta as Record<string, unknown> | undefined)?.sessionId).toBe("session-1");
    expect(body.scopes).toEqual(["operator.admin"]);
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
    expect(result.decision.traceId).toEqual(expect.any(String));
    expect(result.decision.ts).toEqual(expect.any(String));
  });

  it("normalizes rich decision response fields", async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () =>
        ({
          action: "REJECT",
          reason: "blocked",
          errorCode: "POLICY_DENY",
          retryAfterMs: 250,
          policyTags: {
            ruleIds: ["rule-1"],
            category: "auth",
            severity: "high",
            custom: { source: "policy-engine" },
          },
          traceId: "dec-from-service",
          ts: "2026-03-08T00:00:00.000Z",
        }) satisfies DecisionResponse,
    } as Response);

    const bridge = createDecisionBridge({ mode: "ENFORCE" }, fetchSpy);
    const result = await bridge.decide({
      transport: "ws",
      method: "chat.send",
      params: { text: "hello" },
    });

    expect(result.decision.action).toBe("REJECT");
    expect(result.decision.traceId).toBe("dec-from-service");
    expect(result.decision.ts).toBe("2026-03-08T00:00:00.000Z");
    expect(result.decision.retryAfterMs).toBe(250);
    expect(result.decision.policyTags).toEqual({
      ruleIds: ["rule-1"],
      category: "auth",
      severity: "high",
      custom: { source: "policy-engine" },
    });
  });

  it("normalizes legacy policyTags array shape", async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        action: "REJECT",
        reason: "blocked",
        errorCode: "POLICY_DENY",
        policyTags: ["rule-a", "rule-b"],
      }),
    } as Response);

    const bridge = createDecisionBridge({ mode: "ENFORCE" }, fetchSpy);
    const result = await bridge.decide({
      transport: "http",
      method: "http.openresponses.create",
      params: {},
      allowMethodRewrite: false,
    });

    expect(result.decision.policyTags).toEqual({ ruleIds: ["rule-a", "rule-b"] });
  });

  it("rejects cross-method rewrite for HTTP compatibility ingress", async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        action: "REWRITE",
        method: "chat.forwarded",
        params: { text: "rewritten" },
      }),
    } as Response);

    const bridge = createDecisionBridge({ mode: "ENFORCE" }, fetchSpy);
    const result = await bridge.decide({
      transport: "http",
      method: "http.openai.chat.completions",
      params: { messages: [] },
      allowMethodRewrite: false,
    });

    expect(result.decision.action).toBe("REJECT");
    expect(result.decision.errorCode).toBe("INVALID_REQUEST");
    expect(result.rejectReason).toBe(HTTP_METHOD_REWRITE_REJECT_REASON);
    expect(result.shouldExecute).toBe(false);
  });

  it("allows method rewrite for WS gateway requests", async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        action: "REWRITE",
        method: "chat.forwarded",
        params: { text: "rewritten" },
      }),
    } as Response);

    const bridge = createDecisionBridge({ mode: "ENFORCE" }, fetchSpy);
    const result = await bridge.decide({
      transport: "ws",
      method: "chat.send",
      params: { text: "original" },
      allowMethodRewrite: true,
    });

    expect(result.decision.action).toBe("REWRITE");
    expect(result.rewrittenMethod).toBe("chat.forwarded");
    expect(result.rewrittenParams).toEqual({ text: "rewritten" });
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
      allowMethodRewrite: false,
    });

    expect(result.decision.action).toBe("REJECT");
    expect(result.decision.errorCode).toBe("SERVICE_UNAVAILABLE");
    expect(result.shouldExecute).toBe(false);
    expect(result.rejectReason).toContain("fail-closed");
  });
});
