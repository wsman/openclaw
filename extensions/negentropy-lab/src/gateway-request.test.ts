import { describe, expect, it, vi } from "vitest";
import { createDecisionBridge } from "./decision-bridge.js";
import {
  createNegentropyGatewayRequestHandler,
  resolveNegentropyPluginConfig,
} from "./gateway-request.js";

describe("negentropy gateway request hook", () => {
  it("normalizes plugin config with defaults", () => {
    const config = resolveNegentropyPluginConfig({
      mode: "ENFORCE",
      timeoutMs: 2500,
      bypassMethods: ["chat.send"],
    });

    expect(config.mode).toBe("ENFORCE");
    expect(config.timeoutMs).toBe(2500);
    expect(config.bypassMethods).toEqual(["chat.send"]);
    expect(config.healthPaths.length).toBeGreaterThan(0);
  });

  it("maps decision rejects into gateway_request blocks", async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        action: "REJECT",
        reason: "blocked by policy",
      }),
    } as Response);
    const handler = createNegentropyGatewayRequestHandler({
      bridge: createDecisionBridge({ mode: "ENFORCE" }, fetchSpy),
      logger: {
        info() {},
        warn() {},
        error() {},
        debug() {},
      },
    });

    const result = await handler({
      transport: "ws",
      method: "chat.send",
      params: { text: "hello" },
    });

    expect(result).toEqual(
      expect.objectContaining({
        block: true,
        reason: "blocked by policy",
        errorCode: "PERMISSION_DENIED",
        traceId: expect.any(String),
      }),
    );
  });

  it("maps decision rewrites into method/params overrides", async () => {
    const fetchSpy = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        action: "REWRITE",
        method: "chat.forwarded",
        params: { text: "rewritten" },
      }),
    } as Response);
    const handler = createNegentropyGatewayRequestHandler({
      bridge: createDecisionBridge({ mode: "ENFORCE" }, fetchSpy),
    });

    const result = await handler({
      transport: "http",
      method: "http.openresponses.create",
      params: { input: "original" },
      path: "/v1/responses",
    });

    expect(result).toEqual(
      expect.objectContaining({
        method: "chat.forwarded",
        params: { text: "rewritten" },
        traceId: expect.any(String),
      }),
    );
  });
});
