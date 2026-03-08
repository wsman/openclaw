import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";

export type WorkflowBridgeConfig = {
  enabled: boolean;
  orchestrationApiBaseUrl: string;
  timeoutMs: number;
  autoDispatchSubagents: boolean;
};

type WorkflowConfigInput = {
  workflowEnabled?: boolean;
  orchestrationApiBaseUrl?: string;
  workflowTimeoutMs?: number;
  autoDispatchSubagents?: boolean;
  serviceUrl?: string;
};

const DEFAULT_BASE_URL =
  process.env.NEGENTROPY_WORKFLOW_API_URL ||
  "http://127.0.0.1:3000/internal/openclaw/workflows";

function normalizeUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.replace(/\/+$/, "") : undefined;
}

function deriveWorkflowApiBaseFromDecisionServiceUrl(serviceUrl: string | undefined): string | undefined {
  if (!serviceUrl) {
    return undefined;
  }

  if (serviceUrl.endsWith("/decision")) {
    return `${serviceUrl.slice(0, -"/decision".length)}/workflows`;
  }

  if (serviceUrl.endsWith("/internal/openclaw")) {
    return `${serviceUrl}/workflows`;
  }

  return undefined;
}

export function resolveWorkflowBridgeConfig(
  rawConfig: OpenClawPluginApi["pluginConfig"] | unknown,
): WorkflowBridgeConfig {
  const config = (rawConfig ?? {}) as WorkflowConfigInput;

  const explicitBase = normalizeUrl(config.orchestrationApiBaseUrl);
  const decisionServiceUrl = normalizeUrl(config.serviceUrl);
  const derivedBase = deriveWorkflowApiBaseFromDecisionServiceUrl(decisionServiceUrl);

  const orchestrationApiBaseUrl =
    explicitBase ??
    normalizeUrl(process.env.NEGENTROPY_WORKFLOW_API_URL) ??
    derivedBase ??
    DEFAULT_BASE_URL;

  return {
    enabled: config.workflowEnabled !== false,
    orchestrationApiBaseUrl,
    timeoutMs:
      typeof config.workflowTimeoutMs === "number" &&
      Number.isFinite(config.workflowTimeoutMs) &&
      config.workflowTimeoutMs > 0
        ? Math.floor(config.workflowTimeoutMs)
        : 5000,
    autoDispatchSubagents: config.autoDispatchSubagents !== false,
  };
}
