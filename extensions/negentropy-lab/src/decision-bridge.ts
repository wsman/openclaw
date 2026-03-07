export type DecisionMode = "OFF" | "SHADOW" | "ENFORCE";
export type DecisionAction = "EXECUTE" | "REWRITE" | "REJECT";

export type DecisionRequest = {
  traceId: string;
  connId?: string;
  transport: "ws" | "http";
  method: string;
  params?: Record<string, unknown>;
  path?: string;
  auth?: {
    token?: string;
    deviceToken?: string;
    scopes?: string[];
  };
  ts: number;
};

export type DecisionResponse = {
  action: DecisionAction;
  method?: string;
  params?: Record<string, unknown>;
  reason?: string;
  policyTags?: string[];
  timeoutMs?: number;
};

export type DecisionBridgeConfig = {
  mode: DecisionMode;
  serviceUrl: string;
  timeoutMs: number;
  signingKey?: string;
  bypassMethods: string[];
  healthPaths: string[];
  enforceFailClosed: boolean;
  enableRollbackSwitch: boolean;
};

export const DEFAULT_BRIDGE_CONFIG: DecisionBridgeConfig = {
  mode: "OFF",
  serviceUrl:
    process.env.NEGENTROPY_DECISION_URL || "http://127.0.0.1:3000/internal/openclaw/decision",
  timeoutMs: 5000,
  bypassMethods: ["connect", "ping", "health.check"],
  healthPaths: ["/health", "/healthz", "/ready", "/readyz"],
  enforceFailClosed: false,
  enableRollbackSwitch: false,
};

export function generateTraceId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `TRC-${timestamp}-${random}`;
}

export class DecisionBridge {
  private config: DecisionBridgeConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(
    config: Partial<DecisionBridgeConfig> = {},
    fetchImpl: typeof fetch = globalThis.fetch,
  ) {
    this.config = { ...DEFAULT_BRIDGE_CONFIG, ...config };
    this.fetchImpl = fetchImpl;
  }

  getMode(): DecisionMode {
    return this.config.mode;
  }

  setMode(mode: DecisionMode): void {
    this.config.mode = mode;
  }

  getConfig(): DecisionBridgeConfig {
    return { ...this.config };
  }

  isFailClosed(): boolean {
    return this.config.enforceFailClosed === true;
  }

  setFailClosed(enabled: boolean): void {
    this.config.enforceFailClosed = enabled;
  }

  isRollbackSwitchEnabled(): boolean {
    return this.config.enableRollbackSwitch === true;
  }

  switchMode(newMode: DecisionMode): boolean {
    if (!this.config.enableRollbackSwitch) {
      return false;
    }
    this.config.mode = newMode;
    return true;
  }

  emergencyRollback(): void {
    this.config.mode = "OFF";
  }

  shouldBypass(params: { method: string; path?: string }): boolean {
    if (this.config.bypassMethods.includes(params.method)) {
      return true;
    }
    const requestPath = params.path;
    if (!requestPath) {
      return false;
    }
    return this.config.healthPaths.some(
      (healthPath) => requestPath === healthPath || requestPath.startsWith(healthPath),
    );
  }

  createRequest(params: {
    method: string;
    params?: Record<string, unknown>;
    path?: string;
    connId?: string;
    transport: "ws" | "http";
    auth?: DecisionRequest["auth"];
  }): DecisionRequest {
    return {
      traceId: generateTraceId(),
      connId: params.connId,
      transport: params.transport,
      method: params.method,
      params: params.params,
      path: params.path,
      auth: params.auth,
      ts: Date.now(),
    };
  }

  private handleDecisionError(req: DecisionRequest, error: Error): DecisionResponse {
    if (this.config.mode === "SHADOW") {
      return {
        action: "EXECUTE",
        reason: `Decision service error (fail-open): ${error.message}`,
      };
    }
    if (this.config.enforceFailClosed) {
      return {
        action: "REJECT",
        reason: `Decision service unavailable (fail-closed): ${error.message}`,
      };
    }
    return {
      action: "EXECUTE",
      reason: `Decision service error (fail-open): ${error.message}`,
    };
  }

  async requestDecision(req: DecisionRequest): Promise<DecisionResponse> {
    if (this.config.mode === "OFF") {
      return { action: "EXECUTE" };
    }
    if (this.shouldBypass({ method: req.method, path: req.path })) {
      return { action: "EXECUTE" };
    }

    try {
      const response = await this.fetchImpl(this.config.serviceUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Decision-Mode": this.config.mode,
          "X-Trace-Id": req.traceId,
          ...(this.config.signingKey ? { "X-Decision-Signing-Key": this.config.signingKey } : {}),
        },
        body: JSON.stringify(req),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (!response.ok) {
        return this.handleDecisionError(
          req,
          new Error(`Decision service returned ${response.status}`),
        );
      }

      const decision = (await response.json()) as DecisionResponse;
      if (this.config.mode === "SHADOW" && decision.action === "REJECT") {
        return {
          action: "EXECUTE",
          reason: `Shadow mode ignored REJECT (${decision.reason ?? "policy"})`,
        };
      }
      return decision;
    } catch (error) {
      return this.handleDecisionError(
        req,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  async decide(params: {
    method: string;
    params?: Record<string, unknown>;
    path?: string;
    connId?: string;
    transport: "ws" | "http";
    auth?: DecisionRequest["auth"];
  }): Promise<{
    request: DecisionRequest;
    decision: DecisionResponse;
    shouldExecute: boolean;
    rewrittenMethod?: string;
    rewrittenParams?: Record<string, unknown>;
    rejectReason?: string;
  }> {
    const request = this.createRequest(params);
    const decision = await this.requestDecision(request);
    return {
      request,
      decision,
      shouldExecute: decision.action !== "REJECT",
      rewrittenMethod: decision.action === "REWRITE" ? decision.method : undefined,
      rewrittenParams: decision.action === "REWRITE" ? decision.params : undefined,
      rejectReason: decision.action === "REJECT" ? decision.reason : undefined,
    };
  }
}

export function createDecisionBridge(
  config: Partial<DecisionBridgeConfig> = {},
  fetchImpl?: typeof fetch,
): DecisionBridge {
  return new DecisionBridge(config, fetchImpl);
}
