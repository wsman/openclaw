import {
  DECISION_ACTIONS,
  DECISION_ERROR_CODES,
  DECISION_MODES,
  type AuthMeta,
  type DecisionAction,
  type DecisionMode,
  type DecisionRequest as CanonicalDecisionRequest,
  type DecisionResponse as CanonicalDecisionResponse,
  type PolicyTags,
  type TransportType,
} from "./decision-contract.snapshot.js";

export type { DecisionAction, DecisionMode, PolicyTags, TransportType };

export type DecisionBridgeAuth = {
  token?: string;
  deviceToken?: string;
  scopes?: string[];
  userId?: string;
  sessionId?: string;
  deviceId?: string;
  authType?: AuthMeta["authType"];
  roles?: string[];
  rawHeaders?: Record<string, string>;
};

export type DecisionRequest = Omit<CanonicalDecisionRequest, "authMeta" | "scopes"> & {
  auth?: DecisionBridgeAuth;
  authMeta?: AuthMeta;
  scopes?: string[];
};

export type DecisionResponse = CanonicalDecisionResponse & {
  policyTags?: PolicyTags;
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

export const HTTP_METHOD_REWRITE_REJECT_REASON =
  "HTTP compatibility ingress only supports params rewrite; cross-method rewrite is not allowed.";

const POLICY_TAG_SEVERITIES = new Set(["low", "medium", "high", "critical"]);

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value
    .map((entry) => normalizeString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function normalizeDecisionMode(value: unknown): DecisionMode | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return DECISION_MODES.includes(value as DecisionMode) ? (value as DecisionMode) : undefined;
}

function normalizeDecisionAction(value: unknown): DecisionAction {
  if (typeof value !== "string") {
    return "EXECUTE";
  }
  return DECISION_ACTIONS.includes(value as DecisionAction) ? (value as DecisionAction) : "EXECUTE";
}

function mapAuthToAuthMeta(auth: DecisionBridgeAuth | undefined): {
  authMeta?: AuthMeta;
  scopes?: string[];
} {
  if (!auth) {
    return {};
  }

  const scopes = normalizeStringArray(auth.scopes);
  const rawHeaders = normalizeRecord(auth.rawHeaders) as Record<string, string> | undefined;

  const authMeta: AuthMeta = {
    ...(normalizeString(auth.userId) ? { userId: normalizeString(auth.userId) } : {}),
    ...(normalizeString(auth.sessionId) ? { sessionId: normalizeString(auth.sessionId) } : {}),
    ...(normalizeString(auth.deviceId ?? auth.deviceToken)
      ? { deviceId: normalizeString(auth.deviceId ?? auth.deviceToken) }
      : {}),
    ...(normalizeString(auth.authType) ? { authType: auth.authType } : {}),
    ...(normalizeStringArray(auth.roles) ? { roles: normalizeStringArray(auth.roles) } : {}),
    ...(rawHeaders ? { rawHeaders } : {}),
  };

  if (!authMeta.authType) {
    if (normalizeString(auth.token)) {
      authMeta.authType = "jwt";
    } else if (normalizeString(auth.deviceToken)) {
      authMeta.authType = "session";
    } else {
      authMeta.authType = "anonymous";
    }
  }

  return {
    ...(Object.keys(authMeta).length > 0 ? { authMeta } : {}),
    ...(scopes ? { scopes } : {}),
  };
}

function normalizePolicyTags(value: unknown): PolicyTags | undefined {
  if (Array.isArray(value)) {
    const ruleIds = normalizeStringArray(value);
    return ruleIds ? { ruleIds } : undefined;
  }

  const single = normalizeString(value);
  if (single) {
    return { ruleIds: [single] };
  }

  const record = normalizeRecord(value);
  if (!record) {
    return undefined;
  }

  const fromRuleIds = (() => {
    const raw = record.ruleIds;
    if (Array.isArray(raw)) {
      return normalizeStringArray(raw);
    }
    const one = normalizeString(raw);
    return one ? [one] : undefined;
  })();

  const category = normalizeString(record.category);
  const severityRaw = normalizeString(record.severity);
  const severity =
    severityRaw && POLICY_TAG_SEVERITIES.has(severityRaw)
      ? (severityRaw as PolicyTags["severity"])
      : undefined;

  const customBase = normalizeRecord(record.custom);
  const extraEntries = Object.entries(record).filter(
    ([key]) => key !== "ruleIds" && key !== "category" && key !== "severity" && key !== "custom",
  );
  const extra = extraEntries.length > 0 ? Object.fromEntries(extraEntries) : undefined;
  const custom = customBase || extra ? { ...(customBase ?? {}), ...(extra ?? {}) } : undefined;

  const normalized: PolicyTags = {
    ...(fromRuleIds ? { ruleIds: fromRuleIds } : {}),
    ...(category ? { category } : {}),
    ...(severity ? { severity } : {}),
    ...(custom ? { custom } : {}),
  };

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeRetryAfterMs(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.floor(value);
}

function normalizeErrorCode(value: unknown): string | undefined {
  const normalized = normalizeString(value);
  if (!normalized) {
    return undefined;
  }
  if (Object.values(DECISION_ERROR_CODES).includes(normalized as (typeof DECISION_ERROR_CODES)[keyof typeof DECISION_ERROR_CODES])) {
    return normalized;
  }
  return normalized;
}

function normalizeDecisionResponse(
  raw: unknown,
  request: DecisionRequest,
): DecisionResponse {
  const record = normalizeRecord(raw) ?? {};
  const action = normalizeDecisionAction(record.action);
  const traceId = normalizeString(record.traceId) ?? request.traceId;
  const ts = normalizeString(record.ts) ?? new Date().toISOString();
  const reason = normalizeString(record.reason);
  const retryAfterMs = normalizeRetryAfterMs(record.retryAfterMs);
  const errorCode = normalizeErrorCode(record.errorCode);
  const errorDetail = normalizeRecord(record.errorDetail);
  const policyTags = normalizePolicyTags(record.policyTags);
  const params = normalizeRecord(record.params);
  const method = normalizeString(record.method);

  if (action === "REWRITE") {
    return {
      action,
      traceId,
      ts,
      method: method ?? request.method,
      params: params ?? request.params,
      ...(reason ? { reason } : {}),
      ...(policyTags ? { policyTags } : {}),
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    };
  }

  if (action === "REJECT") {
    return {
      action,
      traceId,
      ts,
      ...(reason ? { reason } : {}),
      ...(errorCode ? { errorCode } : { errorCode: DECISION_ERROR_CODES.POLICY_DENY }),
      ...(errorDetail ? { errorDetail } : {}),
      ...(policyTags ? { policyTags } : {}),
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
    };
  }

  return {
    action: "EXECUTE",
    traceId,
    ts,
    ...(reason ? { reason } : {}),
    ...(policyTags ? { policyTags } : {}),
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
  };
}

function toCanonicalRequest(request: DecisionRequest): CanonicalDecisionRequest {
  const params = normalizeRecord(request.params) ?? {};
  const explicitAuthMeta = normalizeRecord(request.authMeta) as AuthMeta | undefined;
  const authMapped = mapAuthToAuthMeta(request.auth);
  const scopes = normalizeStringArray(request.scopes) ?? authMapped.scopes;

  const canonical: CanonicalDecisionRequest = {
    traceId: request.traceId,
    transport: request.transport,
    method: request.method,
    params,
    ts: request.ts,
    ...(normalizeString(request.connId) ? { connId: normalizeString(request.connId) } : {}),
    ...(normalizeString(request.path) ? { path: normalizeString(request.path) } : {}),
    ...(normalizeString(request.sourceIp) ? { sourceIp: normalizeString(request.sourceIp) } : {}),
    ...(normalizeRecord(request.headers)
      ? { headers: normalizeRecord(request.headers) as Record<string, string> }
      : {}),
    ...(normalizeString(request.httpMethod) ? { httpMethod: normalizeString(request.httpMethod) } : {}),
    ...(explicitAuthMeta ? { authMeta: explicitAuthMeta } : authMapped.authMeta ? { authMeta: authMapped.authMeta } : {}),
    ...(scopes ? { scopes } : {}),
  };

  return canonical;
}

export function generateTraceId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `dec-${timestamp}-${random}`;
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
    this.config.mode = normalizeDecisionMode(mode) ?? DEFAULT_BRIDGE_CONFIG.mode;
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
    transport: TransportType;
    auth?: DecisionBridgeAuth;
    authMeta?: AuthMeta;
    sourceIp?: string;
    headers?: Record<string, string>;
    httpMethod?: string;
  }): DecisionRequest {
    return {
      traceId: generateTraceId(),
      connId: params.connId,
      transport: params.transport,
      method: params.method,
      params: normalizeRecord(params.params) ?? {},
      path: params.path,
      auth: params.auth,
      authMeta: params.authMeta,
      sourceIp: params.sourceIp,
      headers: params.headers,
      httpMethod: params.httpMethod,
      ts: new Date().toISOString(),
    };
  }

  private handleDecisionError(req: DecisionRequest, error: Error): DecisionResponse {
    const ts = new Date().toISOString();
    if (this.config.mode === "SHADOW") {
      return {
        action: "EXECUTE",
        traceId: req.traceId,
        ts,
        reason: `Decision service error (fail-open): ${error.message}`,
      };
    }
    if (this.config.enforceFailClosed) {
      return {
        action: "REJECT",
        traceId: req.traceId,
        ts,
        reason: `Decision service unavailable (fail-closed): ${error.message}`,
        errorCode: DECISION_ERROR_CODES.SERVICE_UNAVAILABLE,
      };
    }
    return {
      action: "EXECUTE",
      traceId: req.traceId,
      ts,
      reason: `Decision service error (fail-open): ${error.message}`,
    };
  }

  async requestDecision(req: DecisionRequest): Promise<DecisionResponse> {
    if (this.config.mode === "OFF") {
      return {
        action: "EXECUTE",
        traceId: req.traceId,
        ts: new Date().toISOString(),
      };
    }
    if (this.shouldBypass({ method: req.method, path: req.path })) {
      return {
        action: "EXECUTE",
        traceId: req.traceId,
        ts: new Date().toISOString(),
      };
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
        body: JSON.stringify(toCanonicalRequest(req)),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      if (!response.ok) {
        return this.handleDecisionError(req, new Error(`Decision service returned ${response.status}`));
      }

      const decision = normalizeDecisionResponse(await response.json(), req);
      if (this.config.mode === "SHADOW" && decision.action === "REJECT") {
        return {
          action: "EXECUTE",
          traceId: decision.traceId,
          ts: decision.ts,
          reason: `Shadow mode ignored REJECT (${decision.reason ?? "policy"})`,
          ...(decision.policyTags ? { policyTags: decision.policyTags } : {}),
        };
      }
      return decision;
    } catch (error) {
      return this.handleDecisionError(req, error instanceof Error ? error : new Error(String(error)));
    }
  }

  async decide(params: {
    method: string;
    params?: Record<string, unknown>;
    path?: string;
    connId?: string;
    transport: TransportType;
    auth?: DecisionBridgeAuth;
    authMeta?: AuthMeta;
    allowMethodRewrite?: boolean;
  }): Promise<{
    request: DecisionRequest;
    decision: DecisionResponse;
    shouldExecute: boolean;
    rewrittenMethod?: string;
    rewrittenParams?: Record<string, unknown>;
    rejectReason?: string;
  }> {
    const request = this.createRequest(params);
    let decision = await this.requestDecision(request);

    const allowMethodRewrite = params.allowMethodRewrite ?? params.transport === "ws";
    if (!allowMethodRewrite && decision.action === "REWRITE") {
      const rewrittenMethod = normalizeString(decision.method) ?? request.method;
      if (rewrittenMethod !== request.method) {
        decision = {
          action: "REJECT",
          traceId: decision.traceId,
          ts: decision.ts,
          reason: HTTP_METHOD_REWRITE_REJECT_REASON,
          errorCode: "INVALID_REQUEST",
          ...(decision.policyTags ? { policyTags: decision.policyTags } : {}),
        };
      }
    }

    return {
      request,
      decision,
      shouldExecute: decision.action !== "REJECT",
      rewrittenMethod:
        decision.action === "REWRITE" ? normalizeString(decision.method) ?? request.method : undefined,
      rewrittenParams:
        decision.action === "REWRITE"
          ? normalizeRecord(decision.params) ?? normalizeRecord(request.params) ?? {}
          : undefined,
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
