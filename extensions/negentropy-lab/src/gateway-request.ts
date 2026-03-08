import type {
  OpenClawPluginApi,
  PluginHookGatewayRequestEvent,
  PluginHookGatewayRequestResult,
} from "openclaw/plugin-sdk/core";
import { DECISION_MODES } from "./decision-contract.snapshot.js";
import {
  DEFAULT_BRIDGE_CONFIG,
  HTTP_METHOD_REWRITE_REJECT_REASON,
  type DecisionBridge,
  type DecisionBridgeConfig,
  type DecisionMode,
} from "./decision-bridge.js";

export type NegentropyPluginConfig = {
  mode?: DecisionMode;
  serviceUrl?: string;
  timeoutMs?: number;
  signingKey?: string;
  bypassMethods?: string[];
  healthPaths?: string[];
  enforceFailClosed?: boolean;
  enableRollbackSwitch?: boolean;
};

const UNAVAILABLE_DECISION_CODES = new Set([
  "SERVICE_UNAVAILABLE",
  "REQUEST_TIMEOUT",
  "POLICY_TIMEOUT",
]);

const INVALID_REQUEST_DECISION_CODES = new Set([
  "INVALID_REQUEST",
  "PARAM_INVALID",
  "PARAM_MISSING",
  "INVALID_PARAMS",
  "METHOD_UNKNOWN",
  "METHOD_DISABLED",
  "METHOD_RESTRICTED",
]);

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const normalized = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
  return normalized.length > 0 ? normalized : fallback;
}

function mapDecisionErrorCodeToGatewayErrorCode(errorCode: unknown):
  | "INVALID_REQUEST"
  | "PERMISSION_DENIED"
  | "UNAVAILABLE" {
  const normalized = normalizeString(errorCode);
  if (!normalized) {
    return "PERMISSION_DENIED";
  }
  if (normalized === "INVALID_REQUEST" || INVALID_REQUEST_DECISION_CODES.has(normalized)) {
    return "INVALID_REQUEST";
  }
  if (normalized === "UNAVAILABLE" || UNAVAILABLE_DECISION_CODES.has(normalized)) {
    return "UNAVAILABLE";
  }
  return "PERMISSION_DENIED";
}

export function resolveNegentropyPluginConfig(
  rawConfig: OpenClawPluginApi["pluginConfig"] | unknown,
): DecisionBridgeConfig {
  const config = (rawConfig ?? {}) as NegentropyPluginConfig;
  return {
    mode:
      DECISION_MODES.includes(config.mode as DecisionMode)
        ? (config.mode as DecisionMode)
        : DEFAULT_BRIDGE_CONFIG.mode,
    serviceUrl:
      typeof config.serviceUrl === "string" && config.serviceUrl.trim()
        ? config.serviceUrl.trim()
        : DEFAULT_BRIDGE_CONFIG.serviceUrl,
    timeoutMs:
      typeof config.timeoutMs === "number" &&
      Number.isFinite(config.timeoutMs) &&
      config.timeoutMs > 0
        ? Math.floor(config.timeoutMs)
        : DEFAULT_BRIDGE_CONFIG.timeoutMs,
    signingKey:
      typeof config.signingKey === "string" && config.signingKey.trim()
        ? config.signingKey.trim()
        : undefined,
    bypassMethods: normalizeStringList(config.bypassMethods, DEFAULT_BRIDGE_CONFIG.bypassMethods),
    healthPaths: normalizeStringList(config.healthPaths, DEFAULT_BRIDGE_CONFIG.healthPaths),
    enforceFailClosed: config.enforceFailClosed === true,
    enableRollbackSwitch: config.enableRollbackSwitch === true,
  };
}

export function createNegentropyGatewayRequestHandler(params: {
  bridge: DecisionBridge;
  logger?: OpenClawPluginApi["logger"];
}) {
  return async (
    event: PluginHookGatewayRequestEvent,
  ): Promise<PluginHookGatewayRequestResult | void> => {
    if (params.bridge.getMode() === "OFF") {
      return;
    }
    if (params.bridge.shouldBypass({ method: event.method, path: event.path })) {
      return;
    }

    const result = await params.bridge.decide({
      transport: event.transport,
      method: event.method,
      params: event.params,
      path: event.path,
      connId: event.connId,
      auth: event.auth,
      allowMethodRewrite: event.transport === "ws",
    });

    params.logger?.debug?.(
      `[negentropy-lab] ${event.transport} ${event.method} -> ${result.decision.action} trace=${result.request.traceId}`,
    );

    if (!result.shouldExecute) {
      const policyTags = result.decision.policyTags;
      const decisionErrorCode = normalizeString(result.decision.errorCode);
      return {
        block: true,
        reason: result.rejectReason || "Request rejected by decision service",
        traceId: result.request.traceId,
        errorCode: mapDecisionErrorCodeToGatewayErrorCode(decisionErrorCode),
        ...(result.decision.retryAfterMs !== undefined
          ? {
              retryable: true,
              retryAfterMs: result.decision.retryAfterMs,
            }
          : {}),
        details:
          policyTags || decisionErrorCode
            ? {
                ...(policyTags ? { policyTags } : {}),
                ...(decisionErrorCode ? { decisionErrorCode } : {}),
              }
            : undefined,
      };
    }

    if (result.decision.action === "REWRITE") {
      if (
        event.transport === "http" &&
        result.rewrittenMethod &&
        result.rewrittenMethod !== event.method
      ) {
        return {
          block: true,
          reason: HTTP_METHOD_REWRITE_REJECT_REASON,
          traceId: result.request.traceId,
          errorCode: "INVALID_REQUEST",
          details: {
            decisionErrorCode: result.decision.errorCode,
            ...(result.decision.policyTags ? { policyTags: result.decision.policyTags } : {}),
          },
        };
      }

      return {
        ...(event.transport === "ws" && result.rewrittenMethod && result.rewrittenMethod !== event.method
          ? { method: result.rewrittenMethod }
          : {}),
        params: result.rewrittenParams,
        reason: result.decision.reason,
        traceId: result.request.traceId,
        details:
          result.decision.policyTags &&
          Object.keys(result.decision.policyTags).length > 0
            ? { policyTags: result.decision.policyTags }
            : undefined,
      };
    }

    return;
  };
}
