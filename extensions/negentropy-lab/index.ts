import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import {
  createDecisionBridge,
  type DecisionBridge,
  type DecisionMode,
} from "./src/decision-bridge.js";
import { DECISION_MODES } from "./src/decision-contract.snapshot.js";
import {
  buildHostFacingDiagnostics,
  formatHostFacingDiagnostics,
  loadRepoLocalDiagnosticsContext,
} from "./src/diagnostics.js";
import {
  createNegentropyGatewayRequestHandler,
  resolveNegentropyPluginConfig,
} from "./src/gateway-request.js";
import { createWorkflowBridge } from "./src/workflow-bridge.js";
import { createWorkflowClient } from "./src/workflow-client.js";
import { handleWorkflowCommand } from "./src/workflow-command.js";
import { resolveWorkflowBridgeConfig } from "./src/workflow-config.js";
import {
  mapSessionEndEvent,
  mapSessionStartEvent,
  mapSubagentEndedEvent,
  mapSubagentSpawnedEvent,
  mapSubagentSpawningEvent,
} from "./src/workflow-events.js";

async function formatBridgeStatus(params: {
  bridge: DecisionBridge;
  workflowConfig: ReturnType<typeof resolveWorkflowBridgeConfig>;
  workflowClient: ReturnType<typeof createWorkflowClient>;
}): Promise<string> {
  const repoLocal = await loadRepoLocalDiagnosticsContext();
  const [decisionApi, workflowApi] = await Promise.all([
    params.bridge.probeReachability(),
    params.workflowConfig.enabled
      ? params.workflowClient.probeReachability()
      : Promise.resolve(null),
  ]);

  return formatHostFacingDiagnostics(
    buildHostFacingDiagnostics({
      extensionMode: params.bridge.getMode(),
      failClosed: params.bridge.isFailClosed(),
      rollbackSwitchEnabled: params.bridge.isRollbackSwitchEnabled(),
      workflowBridge: {
        workflowEnabled: params.workflowConfig.enabled,
        orchestrationApiBaseUrl: params.workflowConfig.orchestrationApiBaseUrl,
        autoDispatchSubagents: params.workflowConfig.autoDispatchSubagents,
      },
      decisionApi: {
        reachable: decisionApi.reachable,
        checkedUrl: decisionApi.checkedUrl,
        detail: decisionApi.detail,
      },
      workflowApi: workflowApi && {
        reachable: workflowApi.reachable,
        checkedUrl: workflowApi.checkedUrl,
        detail: workflowApi.detail,
      },
      repoLocal,
    }),
  );
}

function parseBooleanSwitch(token: string | undefined): boolean | undefined {
  const normalized = token?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (["on", "true", "1", "enable", "enabled", "yes"].includes(normalized)) {
    return true;
  }
  if (["off", "false", "0", "disable", "disabled", "no"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function normalizeMode(token: string | undefined): DecisionMode | undefined {
  const normalized = token?.trim().toUpperCase();
  if (!normalized) {
    return undefined;
  }
  return DECISION_MODES.includes(normalized as DecisionMode)
    ? (normalized as DecisionMode)
    : undefined;
}

function usageText(): string {
  return [
    "Usage:",
    "- /negentropy status",
    "- /negentropy mode <OFF|SHADOW|ENFORCE>",
    "- /negentropy fail-closed <on|off>",
    "- /negentropy rollback",
    "- /negentropy workflow status [runId]",
    "- /negentropy workflow list",
    "- /negentropy workflow trace <runId> [limit]",
    "- /negentropy workflow run <name>",
    "- /negentropy workflow retry <runId>",
    "- /negentropy workflow reconcile [runId] [--include-terminal] [--reason <text>]",
    "- /negentropy workflow cancel <runId> [--emergency]",
    "- /negentropy workflow emergency-stop <runId>",
    "- /negentropy workflow stop <runId>",
  ].join("\n");
}

const plugin = {
  id: "negentropy-lab",
  name: "Negentropy Lab",
  description:
    "Only official OpenClaw runtime bridge and contract consumer for Negentropy ingress, workflow seam, and host-visible diagnostics.",
  register(api: OpenClawPluginApi) {
    const decisionConfig = resolveNegentropyPluginConfig(api.pluginConfig);
    const decisionBridge = createDecisionBridge(decisionConfig);

    const workflowConfig = resolveWorkflowBridgeConfig(api.pluginConfig);
    const workflowClient = createWorkflowClient({
      baseUrl: workflowConfig.orchestrationApiBaseUrl,
      timeoutMs: workflowConfig.timeoutMs,
    });
    const workflowBridge = createWorkflowBridge({
      client: workflowClient,
      runtime: api.runtime,
      logger: api.logger,
      autoDispatchSubagents: workflowConfig.autoDispatchSubagents,
    });

    api.on(
      "gateway_request",
      createNegentropyGatewayRequestHandler({
        bridge: decisionBridge,
        logger: api.logger,
      }),
    );

    if (workflowConfig.enabled) {
      api.on("subagent_spawning", async (event, ctx) => {
        await workflowBridge.postEvent(mapSubagentSpawningEvent(event, ctx));
      });

      api.on("subagent_spawned", async (event, ctx) => {
        await workflowBridge.postEvent(mapSubagentSpawnedEvent(event, ctx));
      });

      api.on("subagent_ended", async (event, ctx) => {
        await workflowBridge.postEvent(mapSubagentEndedEvent(event, ctx));
      });

      api.on("session_start", async (event, ctx) => {
        await workflowBridge.postEvent(mapSessionStartEvent(event, ctx));
      });

      api.on("session_end", async (event, ctx) => {
        await workflowBridge.postEvent(mapSessionEndEvent(event, ctx));
      });
    }

    api.registerCommand({
      name: "negentropy",
      description: "Inspect and control Negentropy decision policy and workflow orchestration.",
      acceptsArgs: true,
      handler: async (ctx) => {
        const tokens = (ctx.args ?? "status")
          .trim()
          .split(/\s+/)
          .filter((token) => token.length > 0);
        const action = (tokens[0] ?? "status").toLowerCase();

        if (action === "status") {
          return {
            text: await formatBridgeStatus({
              bridge: decisionBridge,
              workflowConfig,
              workflowClient,
            }),
          };
        }

        if (action === "mode") {
          const mode = normalizeMode(tokens[1]);
          if (!mode) {
            return { text: `Invalid mode.\n${usageText()}` };
          }

          const previous = decisionBridge.getMode();
          if (decisionBridge.isRollbackSwitchEnabled()) {
            decisionBridge.switchMode(mode);
          } else {
            decisionBridge.setMode(mode);
          }

          return {
            text: `Negentropy mode updated: ${previous} -> ${decisionBridge.getMode()}`,
          };
        }

        if (action === "fail-closed") {
          const enabled = parseBooleanSwitch(tokens[1]);
          if (enabled === undefined) {
            return { text: `Invalid fail-closed value.\n${usageText()}` };
          }
          decisionBridge.setFailClosed(enabled);
          return {
            text: `Negentropy fail-closed is now ${decisionBridge.isFailClosed() ? "on" : "off"}.`,
          };
        }

        if (action === "rollback") {
          if (!decisionBridge.isRollbackSwitchEnabled()) {
            return {
              text: "Rollback switch is disabled by config (enableRollbackSwitch=false). No rollback executed.",
            };
          }
          decisionBridge.emergencyRollback();
          return {
            text: "Emergency rollback executed. Negentropy mode forced to OFF.",
          };
        }

        if (action === "workflow") {
          if (!workflowConfig.enabled) {
            return {
              text: "Workflow bridge is disabled by config (workflowEnabled=false).",
            };
          }
          return handleWorkflowCommand({
            bridge: workflowBridge,
            tokens: tokens.slice(1),
            ctx,
          });
        }

        return { text: usageText() };
      },
    });
  },
};

export default plugin;
