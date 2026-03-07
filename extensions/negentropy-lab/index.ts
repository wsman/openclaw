import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { createDecisionBridge } from "./src/decision-bridge.js";
import {
  createNegentropyGatewayRequestHandler,
  resolveNegentropyPluginConfig,
} from "./src/gateway-request.js";

const plugin = {
  id: "negentropy-lab",
  name: "Negentropy Lab",
  description: "Gateway request policy bridge backed by an external Negentropy decision service.",
  register(api: OpenClawPluginApi) {
    const config = resolveNegentropyPluginConfig(api.pluginConfig);
    const bridge = createDecisionBridge(config);
    api.on(
      "gateway_request",
      createNegentropyGatewayRequestHandler({
        bridge,
        logger: api.logger,
      }),
    );
  },
};

export default plugin;
