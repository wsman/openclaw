import { describe, expect, it } from "vitest";
import { AgentSessionState, AuthorityState } from "../../schema/AuthorityState";
import { EventStore } from "../../services/authority/EventStore";
import {
  AuthorityToolCallBridge,
  createAuthorityToolPlaneFacade,
  createToolPlaneImportCensus,
  normalizeToolAccessDecision,
  normalizeToolCatalogEntry,
  normalizeToolDiscoveryEntry,
  normalizeToolUsageSnapshot,
} from "./tool-plane";

function registerConnectedAgent(state: AuthorityState, overrides: Partial<AgentSessionState> = {}): AgentSessionState {
  const agent = new AgentSessionState();
  agent.id = overrides.id || "agent:integration-tool-plane";
  agent.name = overrides.name || "Integration Tool Plane";
  agent.department = overrides.department || "TECHNOLOGY";
  agent.role = overrides.role || "minister";
  agent.model = overrides.model || "zai/glm-4.7";
  agent.provider = overrides.provider || "zai";
  agent.available = overrides.available ?? true;
  agent.status = overrides.status || "ready";
  agent.connectionStatus = overrides.connectionStatus || "connected";
  agent.healthStatus = overrides.healthStatus || "healthy";
  agent.sessionId = overrides.sessionId || "session:integration-tool-plane";
  agent.sessionToken = overrides.sessionToken || "token:integration-tool-plane";
  agent.capacity = overrides.capacity ?? 2;
  agent.currentLoad = overrides.currentLoad ?? 0.1;
  agent.pendingTasks = overrides.pendingTasks ?? 0;
  agent.leaseExpiresAt = overrides.leaseExpiresAt ?? Date.now() + 30_000;
  agent.capabilities.set("observe:*", "enabled");
  agent.capabilities.set("commit:technology:*", "enabled");

  state.agents.set(agent.id, agent);
  return agent;
}

describe("integration/tool-plane facade", () => {
  it("tracks the preferred facade and direct-import census", () => {
    const census = createToolPlaneImportCensus();

    expect(census.preferredFacade).toBe("server/modules/integration/tool-plane");
    expect(census.implementationClass).toBe("AuthorityToolCallBridge");
    expect(census.directImports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "server/runtime/authorityRuntime.ts",
          usage: "runtime",
          migrationPreference: "keep_direct",
        }),
        expect.objectContaining({
          path: "server/services/authority/AuthorityMcpTransportService.ts",
          usage: "authority-internal",
        }),
      ]),
    );
  });

  it("normalizes the current authority tool DTOs without changing source contracts", async () => {
    const state = new AuthorityState();
    const bridge = new AuthorityToolCallBridge(state, new EventStore());
    const agent = registerConnectedAgent(state);

    bridge.registerToolDefinition(
      {
        toolName: "mcp_budget_allocate",
        category: "application",
        source: "authority",
        provider: "authority-runtime",
        allowedDepartments: ["TECHNOLOGY"],
        requiredDepartments: ["TECHNOLOGY"],
        requiredCapabilities: ["commit:technology:*"],
        quotaLimit: 3,
        tags: ["budget", "mcp"],
      },
      async () => ({ ok: true }),
    );

    const catalogEntry = bridge.getToolDefinition("mcp_budget_allocate");
    const discoveryEntry = bridge.discoverTools({
      agentId: agent.id,
      department: "TECHNOLOGY",
      protocol: "mcp",
    })[0];
    const accessDecision = bridge.getAccessDecision("mcp_budget_allocate", agent.id, "TECHNOLOGY");

    await bridge.callToolWithContext({
      toolName: "mcp_budget_allocate",
      args: { amount: 8 },
      agentId: agent.id,
      sessionId: agent.sessionId,
    });

    const usageSnapshot = bridge.getUsageSnapshot()[0];

    expect(catalogEntry).toBeTruthy();
    expect(discoveryEntry).toBeTruthy();
    expect(usageSnapshot).toBeTruthy();

    expect(normalizeToolCatalogEntry(catalogEntry!)).toMatchObject({
      runtime: "authority",
      toolName: "mcp_budget_allocate",
      isMcpBacked: true,
      hasDepartmentScope: true,
      hasCapabilityScope: true,
      approvalMode: "auto",
    });

    expect(normalizeToolAccessDecision(accessDecision)).toEqual({
      runtime: "authority",
      allowed: true,
      reason: "allowed",
      quotaRemaining: 3,
      hasQuotaGuard: true,
    });

    expect(normalizeToolDiscoveryEntry(discoveryEntry!)).toMatchObject({
      runtime: "authority",
      tool: expect.objectContaining({
        toolName: "mcp_budget_allocate",
      }),
      access: expect.objectContaining({
        allowed: true,
      }),
    });

    expect(normalizeToolUsageSnapshot(usageSnapshot!)).toEqual({
      runtime: "authority",
      toolName: "mcp_budget_allocate",
      usageCount: 1,
      activeCalls: 0,
      lastResultAt: usageSnapshot!.lastResultAt,
      quota: {
        key: "tool:mcp_budget_allocate",
        limit: 3,
        remaining: 2,
      },
    });
  });

  it("wraps the authority bridge behind a stable normalized facade", async () => {
    const state = new AuthorityState();
    const bridge = new AuthorityToolCallBridge(state, new EventStore());
    const agent = registerConnectedAgent(state);
    const facade = createAuthorityToolPlaneFacade(bridge);

    facade.registerToolDefinition(
      {
        toolName: "mcp_schedule_review",
        allowedDepartments: ["TECHNOLOGY"],
        requiredCapabilities: ["commit:technology:*"],
        quotaLimit: 2,
        tags: ["workflow"],
      },
      async (args) => ({ accepted: true, args }),
    );

    await expect(
      facade.callToolWithContext({
        toolName: "mcp_schedule_review",
        args: { slot: "morning" },
        agentId: agent.id,
        sessionId: agent.sessionId,
      }),
    ).resolves.toEqual({
      accepted: true,
      args: { slot: "morning" },
    });

    expect(facade.getCatalog()).toEqual([
      expect.objectContaining({
        runtime: "authority",
        toolName: "mcp_schedule_review",
      }),
    ]);
    expect(facade.getAccessDecision("mcp_schedule_review", agent.id, "TECHNOLOGY")).toMatchObject({
      runtime: "authority",
      allowed: true,
      quotaRemaining: 2,
    });
    expect(facade.getUsageSnapshot()).toEqual([
      expect.objectContaining({
        runtime: "authority",
        toolName: "mcp_schedule_review",
        quota: {
          key: "tool:mcp_schedule_review",
          limit: 2,
          remaining: 1,
        },
      }),
    ]);
  });
});
