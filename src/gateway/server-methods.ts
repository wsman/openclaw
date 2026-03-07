import { withPluginRuntimeGatewayRequestScope } from "../plugins/runtime/gateway-request-scope.js";
import { formatControlPlaneActor, resolveControlPlaneActor } from "./control-plane-audit.js";
import { consumeControlPlaneWriteBudget } from "./control-plane-rate-limit.js";
import { ADMIN_SCOPE, authorizeOperatorScopesForMethod } from "./method-scopes.js";
import {
  buildGatewayWsRequestAuth,
  evaluateGatewayRequestPolicy,
} from "./plugin-request-policy.js";
import { ErrorCodes, errorShape } from "./protocol/index.js";
import { isRoleAuthorizedForMethod, parseGatewayRole } from "./role-policy.js";
import { agentHandlers } from "./server-methods/agent.js";
import { agentsHandlers } from "./server-methods/agents.js";
import { browserHandlers } from "./server-methods/browser.js";
import { channelsHandlers } from "./server-methods/channels.js";
import { chatHandlers } from "./server-methods/chat.js";
import { configHandlers } from "./server-methods/config.js";
import { connectHandlers } from "./server-methods/connect.js";
import { cronHandlers } from "./server-methods/cron.js";
import { deviceHandlers } from "./server-methods/devices.js";
import { doctorHandlers } from "./server-methods/doctor.js";
import { execApprovalsHandlers } from "./server-methods/exec-approvals.js";
import { healthHandlers } from "./server-methods/health.js";
import { logsHandlers } from "./server-methods/logs.js";
import { modelsHandlers } from "./server-methods/models.js";
import { nodePendingHandlers } from "./server-methods/nodes-pending.js";
import { nodeHandlers } from "./server-methods/nodes.js";
import { pushHandlers } from "./server-methods/push.js";
import { sendHandlers } from "./server-methods/send.js";
import { sessionsHandlers } from "./server-methods/sessions.js";
import { skillsHandlers } from "./server-methods/skills.js";
import { systemHandlers } from "./server-methods/system.js";
import { talkHandlers } from "./server-methods/talk.js";
import { toolsCatalogHandlers } from "./server-methods/tools-catalog.js";
import { ttsHandlers } from "./server-methods/tts.js";
import type { GatewayRequestHandlers, GatewayRequestOptions } from "./server-methods/types.js";
import { updateHandlers } from "./server-methods/update.js";
import { usageHandlers } from "./server-methods/usage.js";
import { voicewakeHandlers } from "./server-methods/voicewake.js";
import { webHandlers } from "./server-methods/web.js";
import { wizardHandlers } from "./server-methods/wizard.js";

const CONTROL_PLANE_WRITE_METHODS = new Set(["config.apply", "config.patch", "update.run"]);

function authorizeGatewayMethod(method: string, client: GatewayRequestOptions["client"]) {
  if (!client?.connect) {
    return null;
  }
  if (method === "health") {
    return null;
  }
  const roleRaw = client.connect.role ?? "operator";
  const role = parseGatewayRole(roleRaw);
  if (!role) {
    return errorShape(ErrorCodes.INVALID_REQUEST, `unauthorized role: ${roleRaw}`);
  }
  const scopes = client.connect.scopes ?? [];
  if (!isRoleAuthorizedForMethod(role, method)) {
    return errorShape(ErrorCodes.INVALID_REQUEST, `unauthorized role: ${role}`);
  }
  if (role === "node") {
    return null;
  }
  if (scopes.includes(ADMIN_SCOPE)) {
    return null;
  }
  const scopeAuth = authorizeOperatorScopesForMethod(method, scopes);
  if (!scopeAuth.allowed) {
    return errorShape(ErrorCodes.INVALID_REQUEST, `missing scope: ${scopeAuth.missingScope}`);
  }
  return null;
}

function resolveGatewayPolicyErrorCode(errorCode: string | undefined): keyof typeof ErrorCodes {
  if (
    errorCode === ErrorCodes.INVALID_REQUEST ||
    errorCode === ErrorCodes.PERMISSION_DENIED ||
    errorCode === ErrorCodes.UNAVAILABLE
  ) {
    return errorCode;
  }
  return ErrorCodes.PERMISSION_DENIED;
}

function enforceControlPlaneWriteBudget(params: {
  method: string;
  client: GatewayRequestOptions["client"];
  context: GatewayRequestOptions["context"];
  respond: GatewayRequestOptions["respond"];
}): boolean {
  if (!CONTROL_PLANE_WRITE_METHODS.has(params.method)) {
    return true;
  }
  const budget = consumeControlPlaneWriteBudget({ client: params.client });
  if (budget.allowed) {
    return true;
  }
  const actor = resolveControlPlaneActor(params.client);
  params.context.logGateway.warn(
    `control-plane write rate-limited method=${params.method} ${formatControlPlaneActor(actor)} retryAfterMs=${budget.retryAfterMs} key=${budget.key}`,
  );
  params.respond(
    false,
    undefined,
    errorShape(
      ErrorCodes.UNAVAILABLE,
      `rate limit exceeded for ${params.method}; retry after ${Math.ceil(budget.retryAfterMs / 1000)}s`,
      {
        retryable: true,
        retryAfterMs: budget.retryAfterMs,
        details: {
          method: params.method,
          limit: "3 per 60s",
        },
      },
    ),
  );
  return false;
}

export const coreGatewayHandlers: GatewayRequestHandlers = {
  ...connectHandlers,
  ...logsHandlers,
  ...voicewakeHandlers,
  ...healthHandlers,
  ...channelsHandlers,
  ...chatHandlers,
  ...cronHandlers,
  ...deviceHandlers,
  ...doctorHandlers,
  ...execApprovalsHandlers,
  ...webHandlers,
  ...modelsHandlers,
  ...configHandlers,
  ...wizardHandlers,
  ...talkHandlers,
  ...toolsCatalogHandlers,
  ...ttsHandlers,
  ...skillsHandlers,
  ...sessionsHandlers,
  ...systemHandlers,
  ...updateHandlers,
  ...nodeHandlers,
  ...nodePendingHandlers,
  ...pushHandlers,
  ...sendHandlers,
  ...usageHandlers,
  ...agentHandlers,
  ...agentsHandlers,
  ...browserHandlers,
};

export async function handleGatewayRequest(
  opts: GatewayRequestOptions & { extraHandlers?: GatewayRequestHandlers },
): Promise<void> {
  const { req, respond, client, isWebchatConnect, context } = opts;
  const authError = authorizeGatewayMethod(req.method, client);
  if (authError) {
    respond(false, undefined, authError);
    return;
  }

  const policyDecision = await evaluateGatewayRequestPolicy({
    transport: "ws",
    method: req.method,
    params: ((req.params ?? {}) as Record<string, unknown>) ?? {},
    connId: client?.connId,
    auth: buildGatewayWsRequestAuth(client),
  });
  if (!policyDecision.allowed) {
    const details =
      policyDecision.traceId !== undefined && policyDecision.details !== undefined
        ? {
            traceId: policyDecision.traceId,
            plugin: policyDecision.details,
          }
        : policyDecision.traceId !== undefined
          ? { traceId: policyDecision.traceId }
          : policyDecision.details;
    respond(
      false,
      undefined,
      errorShape(
        resolveGatewayPolicyErrorCode(policyDecision.errorCode),
        policyDecision.reason || "Request rejected by plugin policy",
        {
          ...(policyDecision.retryable !== undefined
            ? { retryable: policyDecision.retryable }
            : {}),
          ...(policyDecision.retryAfterMs !== undefined
            ? { retryAfterMs: policyDecision.retryAfterMs }
            : {}),
          ...(details !== undefined ? { details } : {}),
        },
      ),
    );
    return;
  }

  const resolvedMethod = policyDecision.method;
  const resolvedParams = policyDecision.params;
  if (resolvedMethod !== req.method) {
    const rewrittenAuthError = authorizeGatewayMethod(resolvedMethod, client);
    if (rewrittenAuthError) {
      respond(false, undefined, rewrittenAuthError);
      return;
    }
  }

  if (
    !enforceControlPlaneWriteBudget({
      method: resolvedMethod,
      client,
      context,
      respond,
    })
  ) {
    return;
  }

  const handler = opts.extraHandlers?.[resolvedMethod] ?? coreGatewayHandlers[resolvedMethod];
  if (!handler) {
    respond(
      false,
      undefined,
      errorShape(ErrorCodes.INVALID_REQUEST, `unknown method: ${resolvedMethod}`),
    );
    return;
  }

  const invokeHandler = (
    selectedHandler: typeof handler,
    method: string,
    params: Record<string, unknown>,
  ) =>
    withPluginRuntimeGatewayRequestScope({ context, isWebchatConnect }, () =>
      selectedHandler({
        req:
          method === req.method && params === req.params
            ? req
            : {
                ...req,
                method,
                params,
              },
        params,
        client,
        isWebchatConnect,
        respond,
        context,
      }),
    );

  await invokeHandler(handler, resolvedMethod, resolvedParams);
}
