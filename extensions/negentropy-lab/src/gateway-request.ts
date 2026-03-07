import type {
  OpenClawPluginApi,
  PluginHookGatewayRequestEvent,
  PluginHookGatewayRequestResult,
} from "openclaw/plugin-sdk/core";
import {
  DEFAULT_BRIDGE_CONFIG,
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

function normalizeStringList(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const normalized = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
  return normalized.length > 0 ? normalized : fallback;
}

export function resolveNegentropyPluginConfig(
  rawConfig: OpenClawPluginApi["pluginConfig"] | unknown,
): DecisionBridgeConfig {
  const config = (rawConfig ?? {}) as NegentropyPluginConfig;
  return {
    mode:
      config.mode === "SHADOW" || config.mode === "ENFORCE" || config.mode === "OFF"
        ? config.mode
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
    });
    params.logger?.debug?.(
      `[negentropy-lab] ${event.transport} ${event.method} -> ${result.decision.action} trace=${result.request.traceId}`,
    );

    if (!result.shouldExecute) {
      return {
        block: true,
        reason: result.rejectReason || "Request rejected by decision service",
        traceId: result.request.traceId,
        errorCode: "PERMISSION_DENIED",
        details:
          result.decision.policyTags && result.decision.policyTags.length > 0
            ? { policyTags: result.decision.policyTags }
            : undefined,
      };
    }

    if (result.decision.action === "REWRITE") {
      return {
        method: result.rewrittenMethod,
        params: result.rewrittenParams,
        reason: result.decision.reason,
        traceId: result.request.traceId,
        details:
          result.decision.policyTags && result.decision.policyTags.length > 0
            ? { policyTags: result.decision.policyTags }
            : undefined,
      };
    }

    return;
  };
}
