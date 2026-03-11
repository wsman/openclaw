import { describe, expect, it, vi } from "vitest";
import plugin from "./index.js";

type RegisteredCommand = {
  name: string;
  handler: (ctx: { args?: string; channel: string }) => Promise<{ text?: string }> | { text?: string };
};

describe("negentropy extension plugin", () => {
  it("registers gateway_request hook and control command", async () => {
    let registeredCommand: RegisteredCommand | undefined;
    const on = vi.fn();

    const api: any = {
      id: "negentropy-lab",
      name: "negentropy-lab",
      source: "test",
      config: {},
      runtime: {},
      logger: { info() {}, warn() {}, error() {}, debug() {} },
      pluginConfig: {
        mode: "ENFORCE",
        enableRollbackSwitch: true,
      },
      registerTool() {},
      registerHook() {},
      registerHttpRoute() {},
      registerChannel() {},
      registerGatewayMethod() {},
      registerCli() {},
      registerService() {},
      registerProvider() {},
      registerContextEngine() {},
      resolvePath(input: string) {
        return input;
      },
      registerCommand(command: any) {
        registeredCommand = {
          name: command.name,
          handler: command.handler as RegisteredCommand["handler"],
        };
      },
      on,
    };

    plugin.register(api);

    expect(on).toHaveBeenCalledWith("gateway_request", expect.any(Function));
    expect(on).toHaveBeenCalledWith("subagent_spawning", expect.any(Function));
    expect(on).toHaveBeenCalledWith("subagent_spawned", expect.any(Function));
    expect(on).toHaveBeenCalledWith("subagent_ended", expect.any(Function));
    expect(on).toHaveBeenCalledWith("session_start", expect.any(Function));
    expect(on).toHaveBeenCalledWith("session_end", expect.any(Function));
    expect(registeredCommand?.name).toBe("negentropy");

    const command = registeredCommand as RegisteredCommand;
    const status = await command.handler({ args: "status", channel: "webchat" });
    expect(status.text).toContain("mode: ENFORCE");

    const modeChange = await command.handler({
      args: "mode SHADOW",
      channel: "webchat",
    });
    expect(modeChange.text).toContain("ENFORCE -> SHADOW");

    const rollback = await command.handler({
      args: "rollback",
      channel: "webchat",
    });
    expect(rollback.text).toContain("forced to OFF");
  });

  it("reports invalid command arguments", async () => {
    let registeredCommand: RegisteredCommand | undefined;

    const api: any = {
      id: "negentropy-lab",
      name: "negentropy-lab",
      source: "test",
      config: {},
      runtime: {},
      logger: { info() {}, warn() {}, error() {}, debug() {} },
      pluginConfig: {
        mode: "OFF",
      },
      registerTool() {},
      registerHook() {},
      registerHttpRoute() {},
      registerChannel() {},
      registerGatewayMethod() {},
      registerCli() {},
      registerService() {},
      registerProvider() {},
      registerContextEngine() {},
      resolvePath(input: string) {
        return input;
      },
      registerCommand(command: any) {
        registeredCommand = {
          name: command.name,
          handler: command.handler as RegisteredCommand["handler"],
        };
      },
      on() {},
    };

    plugin.register(api);

    const command = registeredCommand as RegisteredCommand;
    const invalidMode = await command.handler({
      args: "mode nope",
      channel: "webchat",
    });
    expect(invalidMode.text).toContain("Invalid mode");
    expect(invalidMode.text).toContain("/negentropy workflow retry");
    expect(invalidMode.text).toContain("/negentropy workflow stop");
    expect(invalidMode.text).not.toContain("/negentropy workflow reconcile");

    const rollback = await command.handler({
      args: "rollback",
      channel: "webchat",
    });
    expect(rollback.text).toContain("disabled");
  });
});
