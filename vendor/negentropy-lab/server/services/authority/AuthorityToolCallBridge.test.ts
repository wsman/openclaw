/**
 * @constitution
 * §101 同步公理: authority ToolCallBridge 测试需与真理源文档保持同步
 * §102 熵减原则: 保持 authority ToolCallBridge 测试验证路径清晰可维护
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename AuthorityToolCallBridge.test.ts
 * @version 1.0.0
 * @category authority/test
 * @last_updated 2026-03-10
 */

import { describe, expect, it, vi } from "vitest";
import { AgentSessionState, AuthorityState } from "../../schema/AuthorityState";
import { ToolCallEventType, ToolCategory } from "../../types/system/IToolCallBridge";
import { EventStore } from "./EventStore";
import { AuthorityToolCallBridge } from "./AuthorityToolCallBridge";

function registerConnectedAgent(state: AuthorityState, overrides: Partial<AgentSessionState> = {}): AgentSessionState {
  const agent = new AgentSessionState();
  agent.id = overrides.id || "agent:test";
  agent.name = overrides.name || "Test Agent";
  agent.department = overrides.department || "TECHNOLOGY";
  agent.role = overrides.role || "minister";
  agent.model = overrides.model || "zai/glm-4.7";
  agent.provider = overrides.provider || "zai";
  agent.available = overrides.available ?? true;
  agent.status = overrides.status || "ready";
  agent.connectionStatus = overrides.connectionStatus || "connected";
  agent.healthStatus = overrides.healthStatus || "healthy";
  agent.sessionId = overrides.sessionId || "session:test";
  agent.sessionToken = overrides.sessionToken || "token:test";
  agent.capacity = overrides.capacity ?? 2;
  agent.currentLoad = overrides.currentLoad ?? 0.2;
  agent.pendingTasks = overrides.pendingTasks ?? 0;
  agent.leaseExpiresAt = overrides.leaseExpiresAt ?? Date.now() + 30_000;
  agent.capabilities.set("observe:*", "enabled");
  agent.capabilities.set("commit:technology:*", "enabled");

  state.agents.set(agent.id, agent);
  return agent;
}

describe("AuthorityToolCallBridge", () => {
  it("registers tools, broadcasts lifecycle events, audits results, and clears active calls", async () => {
    const state = new AuthorityState();
    const eventStore = new EventStore();
    const bridge = new AuthorityToolCallBridge(state, eventStore);
    const onResult = vi.fn();

    bridge.subscribe(ToolCallEventType.TOOL_RESULT, onResult);
    bridge.registerTool("mcp_echo", async (args) => ({ echoed: args.value }));

    const result = await bridge.callTool("mcp_echo", { value: "hello" });

    expect(result).toEqual({ echoed: "hello" });
    expect(state.tools.registry.get("mcp_echo")).toBe(ToolCategory.APPLICATION);
    expect(bridge.getToolDefinition("mcp_echo")).toMatchObject({
      toolName: "mcp_echo",
      source: "builtin",
      protocol: "mcp",
      version: "1.0.0",
      allowedDepartments: ["*"],
    });
    expect(state.tools.lastResults.has("mcp_echo")).toBe(true);
    expect(bridge.getUsageSnapshot()[0]).toMatchObject({
      toolName: "mcp_echo",
      usageCount: 1,
    });
    expect(bridge.getActiveCallCount()).toBe(0);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(eventStore.getAll().map((event) => event.type)).toEqual([
      "tool.registered",
      "tool.call.started",
      "tool.call.completed",
    ]);
  });

  it("enforces department and capability access control", async () => {
    const state = new AuthorityState();
    const bridge = new AuthorityToolCallBridge(state, new EventStore());
    const session = registerConnectedAgent(state);

    bridge.registerToolDefinition(
      {
        toolName: "mcp_deploy",
        allowedDepartments: ["TECHNOLOGY"],
        requiredCapabilities: ["commit:technology:*"],
      },
      async () => ({ deployed: true }),
    );

    await expect(
      bridge.callToolWithContext({
        toolName: "mcp_deploy",
        args: {},
        agentId: session.id,
      }),
    ).resolves.toEqual({ deployed: true });

    await expect(
      bridge.callToolWithContext({
        toolName: "mcp_deploy",
        args: {},
        agentId: "agent:unknown",
      }),
    ).rejects.toThrow("agent not registered");

    const foreignState = new AuthorityState();
    const foreignBridge = new AuthorityToolCallBridge(foreignState, new EventStore());
    const foreignAgent = registerConnectedAgent(foreignState, {
      id: "agent:foreign",
      department: "FOREIGN_AFFAIRS",
    });
    foreignBridge.registerToolDefinition(
      {
        toolName: "mcp_budget",
        allowedDepartments: ["TECHNOLOGY"],
        requiredCapabilities: ["commit:technology:*"],
      },
      async () => ({ approved: false }),
    );

    await expect(
      foreignBridge.callToolWithContext({
        toolName: "mcp_budget",
        args: {},
        agentId: foreignAgent.id,
      }),
    ).rejects.toThrow("tool access denied");
  });

  it("supports MCP discovery metadata and approval policy decisions", async () => {
    const state = new AuthorityState();
    const bridge = new AuthorityToolCallBridge(state, new EventStore());
    const session = registerConnectedAgent(state, {
      id: "agent:ops",
      department: "OFFICE",
    });
    session.capabilities.set("invoke:tool:audit:*", "enabled");

    bridge.registerToolDefinition(
      {
        toolName: "mcp_audit_console",
        source: "mcp-registry",
        provider: "openclaw",
        protocol: "mcp",
        version: "2026.03",
        allowedDepartments: ["OFFICE", "MOS"],
        requiredDepartments: ["OFFICE"],
        requiredCapabilities: ["invoke:tool:audit:*"],
        approvalMode: "manual",
        tags: ["audit", "ops"],
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        examples: [{ args: { scope: "daily" } }],
      },
      async () => ({ ok: true }),
    );

    const discovery = bridge.discoverTools({
      agentId: session.id,
      department: "OFFICE",
      protocol: "mcp",
      tag: "audit",
    });
    expect(discovery).toHaveLength(1);
    expect(discovery[0].tool).toMatchObject({
      toolName: "mcp_audit_console",
      provider: "openclaw",
      approvalMode: "manual",
    });
    expect(discovery[0].access).toMatchObject({
      allowed: false,
      reason: "tool_requires_manual_approval",
    });

    await expect(
      bridge.callToolWithContext({
        toolName: "mcp_audit_console",
        args: { scope: "daily" },
        agentId: session.id,
      }),
    ).rejects.toThrow("tool requires manual approval");
  });
});
