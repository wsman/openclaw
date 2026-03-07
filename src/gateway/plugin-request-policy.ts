import type { IncomingMessage } from "node:http";
import { getGlobalHookRunner } from "../plugins/hook-runner-global.js";
import type {
  PluginHookGatewayRequestAuth,
  PluginHookGatewayRequestEvent,
} from "../plugins/types.js";
import { getBearerToken, getHeader } from "./http-utils.js";
import type { GatewayClient } from "./server-methods/types.js";

export type GatewayRequestPolicyDecision = {
  allowed: boolean;
  method: string;
  params: Record<string, unknown>;
  reason?: string;
  traceId?: string;
  errorCode?: string;
  retryable?: boolean;
  retryAfterMs?: number;
  details?: unknown;
};

function normalizeGatewayParams(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function parseScopeHeader(req: IncomingMessage): string[] | undefined {
  const raw = getHeader(req, "x-openclaw-scopes");
  if (!raw) {
    return undefined;
  }
  const scopes = raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return scopes.length > 0 ? scopes : undefined;
}

export function buildGatewayHttpRequestAuth(
  req: IncomingMessage,
): PluginHookGatewayRequestAuth | undefined {
  const token = getBearerToken(req);
  const deviceToken = getHeader(req, "x-openclaw-device-token")?.trim() || undefined;
  const scopes = parseScopeHeader(req);
  if (!token && !deviceToken && !scopes) {
    return undefined;
  }
  return { token, deviceToken, scopes };
}

export function buildGatewayWsRequestAuth(
  client: GatewayClient | null,
): PluginHookGatewayRequestAuth | undefined {
  const token = client?.connect?.auth?.token;
  const deviceToken = client?.connect?.auth?.deviceToken;
  const scopes = client?.connect?.scopes;
  if (!token && !deviceToken && !scopes) {
    return undefined;
  }
  return {
    ...(token ? { token } : {}),
    ...(deviceToken ? { deviceToken } : {}),
    ...(Array.isArray(scopes) ? { scopes } : {}),
  };
}

export async function evaluateGatewayHttpRequestPolicy(params: {
  req: IncomingMessage;
  path: string;
  method: string;
  requestParams: Record<string, unknown>;
}): Promise<GatewayRequestPolicyDecision> {
  return evaluateGatewayRequestPolicy({
    transport: "http",
    path: params.path,
    method: params.method,
    params: params.requestParams,
    connId: params.req.socket?.remoteAddress || undefined,
    auth: buildGatewayHttpRequestAuth(params.req),
  });
}

export async function evaluateGatewayRequestPolicy(
  event: PluginHookGatewayRequestEvent,
): Promise<GatewayRequestPolicyDecision> {
  const normalizedEvent: PluginHookGatewayRequestEvent = {
    ...event,
    method: event.method.trim(),
    params: normalizeGatewayParams(event.params),
  };
  const hookRunner = getGlobalHookRunner();
  if (!hookRunner?.hasHooks("gateway_request")) {
    return {
      allowed: true,
      method: normalizedEvent.method,
      params: normalizedEvent.params,
    };
  }

  const result = await hookRunner.runGatewayRequest(normalizedEvent, {});
  const resolvedMethod =
    typeof result?.method === "string" && result.method.trim()
      ? result.method.trim()
      : normalizedEvent.method;
  const resolvedParams =
    result?.params && typeof result.params === "object" && !Array.isArray(result.params)
      ? (result.params as Record<string, unknown>)
      : normalizedEvent.params;

  return {
    allowed: result?.block !== true,
    method: resolvedMethod,
    params: resolvedParams,
    reason: result?.reason,
    traceId: result?.traceId,
    errorCode: result?.errorCode,
    retryable: result?.retryable,
    retryAfterMs: result?.retryAfterMs,
    details: result?.details,
  };
}
