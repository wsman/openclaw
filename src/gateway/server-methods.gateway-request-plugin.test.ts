import { afterEach, describe, expect, it, vi } from "vitest";
import {
  initializeGlobalHookRunner,
  resetGlobalHookRunner,
} from "../plugins/hook-runner-global.js";
import { createMockPluginRegistry } from "../plugins/hooks.test-helpers.js";
import { handleGatewayRequest } from "./server-methods.js";
import type { GatewayRequestHandler } from "./server-methods/types.js";

const noWebchat = () => false;

function buildContext() {
  return {
    logGateway: {
      warn: vi.fn(),
    },
  } as unknown as Parameters<typeof handleGatewayRequest>[0]["context"];
}

function buildClient() {
  return {
    connect: {
      role: "operator",
      scopes: ["operator.admin"],
      client: {
        id: "openclaw-control-ui",
        version: "1.0.0",
        platform: "darwin",
        mode: "ui",
      },
      minProtocol: 1,
      maxProtocol: 1,
    },
    connId: "conn-plugin-policy",
    clientIp: "127.0.0.1",
  } as Parameters<typeof handleGatewayRequest>[0]["client"];
}

describe("gateway_request plugin hook integration", () => {
  afterEach(() => {
    resetGlobalHookRunner();
  });

  it("rejects a gateway request before the selected handler runs", async () => {
    const handler: GatewayRequestHandler = vi.fn((opts) => {
      opts.respond(true, { ok: true });
    });
    initializeGlobalHookRunner(
      createMockPluginRegistry([
        {
          hookName: "gateway_request",
          handler: async () => ({
            block: true,
            reason: "blocked by plugin",
            traceId: "trace-blocked",
            errorCode: "PERMISSION_DENIED",
          }),
        },
      ]),
    );

    const respond = vi.fn();
    await handleGatewayRequest({
      req: {
        type: "req",
        id: "req-1",
        method: "chat.send",
        params: { text: "hello" },
      },
      respond,
      client: buildClient(),
      isWebchatConnect: noWebchat,
      context: buildContext(),
      extraHandlers: {
        "chat.send": handler,
      },
    });

    expect(handler).not.toHaveBeenCalled();
    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: "PERMISSION_DENIED",
        message: "blocked by plugin",
        details: expect.objectContaining({ traceId: "trace-blocked" }),
      }),
    );
  });

  it("rewrites the target method and params before dispatch", async () => {
    const originalHandlerMock = vi.fn<GatewayRequestHandler>((opts) => {
      opts.respond(true, { route: "original", params: opts.params });
    });
    const rewrittenHandlerMock = vi.fn<GatewayRequestHandler>((opts) => {
      opts.respond(true, { route: "rewritten", params: opts.params });
    });
    const originalHandler: GatewayRequestHandler = originalHandlerMock;
    const rewrittenHandler: GatewayRequestHandler = rewrittenHandlerMock;
    initializeGlobalHookRunner(
      createMockPluginRegistry([
        {
          hookName: "gateway_request",
          handler: async () => ({
            method: "chat.forwarded",
            params: { text: "rewritten", via: "plugin" },
            traceId: "trace-rewrite",
          }),
        },
      ]),
    );

    const respond = vi.fn();
    await handleGatewayRequest({
      req: {
        type: "req",
        id: "req-2",
        method: "chat.send",
        params: { text: "original" },
      },
      respond,
      client: buildClient(),
      isWebchatConnect: noWebchat,
      context: buildContext(),
      extraHandlers: {
        "chat.send": originalHandler,
        "chat.forwarded": rewrittenHandler,
      },
    });

    expect(originalHandlerMock).not.toHaveBeenCalled();
    expect(rewrittenHandlerMock).toHaveBeenCalledTimes(1);
    expect(rewrittenHandlerMock.mock.calls[0]?.[0]?.params).toEqual({
      text: "rewritten",
      via: "plugin",
    });
    expect(rewrittenHandlerMock.mock.calls[0]?.[0]?.req.method).toBe("chat.forwarded");
    expect(respond).toHaveBeenCalledWith(true, {
      route: "rewritten",
      params: { text: "rewritten", via: "plugin" },
    });
  });
});
