import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AuthorityState } from "../../schema/AuthorityState";
import { AuthorityToolCallBridge } from "../../services/authority/AuthorityToolCallBridge";
import {
  AuthorityMcpTransportService,
  type McpCommandRunner,
} from "../../services/authority/AuthorityMcpTransportService";
import { EventStore } from "../../services/authority/EventStore";
import type { AuthorityMcpServiceConfig, AuthorityMcpServiceSnapshot } from "../../services/authority/types";
import {
  createAuthorityMcpRegistryFacade,
  createMcpImportCensus,
  normalizeAuthorityMcpDiscoveryResult,
  normalizeAuthorityMcpMaintenanceStatus,
  normalizeAuthorityMcpPollingStatus,
  normalizeAuthorityMcpServiceConfig,
  normalizeAuthorityMcpServiceSnapshot,
} from "./mcp";

describe("integration/mcp facade", () => {
  it("tracks the preferred MCP facade and direct-import census", () => {
    const census = createMcpImportCensus();

    expect(census.preferredFacade).toBe("server/modules/integration/mcp");
    expect(census.implementationClass).toBe("AuthorityMcpTransportService");
    expect(census.directImports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "server/runtime/authorityRuntime.ts",
          usage: "runtime",
        }),
        expect.objectContaining({
          path: "server/services/authority/AuthorityMonitoringService.ts",
          usage: "authority-internal",
        }),
      ]),
    );
  });

  it("normalizes config, snapshot, discovery, and status DTOs", () => {
    const config: AuthorityMcpServiceConfig = {
      serviceId: "finance-ledger",
      provider: "plaid",
      transport: "http",
      endpoint: "https://mcp.example.test",
      auth: {
        type: "bearer",
        token: "secret-token",
      },
      enabled: true,
      source: "authority-config",
      modules: ["finance", "ledger"],
      operationalMode: "active",
      priority: 3,
      failureThreshold: 5,
      recoveryIntervalMs: 45_000,
      pollingIntervalMs: 15_000,
      recoverySuccessThreshold: 2,
      maintenanceWindows: [
        {
          windowId: "ledger-nightly",
          startAt: 1_700_000_000_000,
          endAt: 1_700_000_360_000,
          action: "pause",
        },
      ],
      slo: {
        targetLatencyMs: 350,
      },
      traffic: {
        allocationPercent: 25,
        lane: "canary",
      },
      failback: {
        maxRecoveryAttempts: 4,
      },
      orchestration: {
        serviceGroup: "finance",
        preferredNodes: ["node-a"],
        regions: ["ap-southeast-1"],
      },
      defaultAllowedDepartments: ["FINANCE"],
      defaultRequiredCapabilities: ["observe:*"],
      tags: ["finance", "critical"],
      toolPolicies: {
        finance_reconcile: {
          approvalMode: "manual",
        },
      },
    };

    const snapshot: AuthorityMcpServiceSnapshot = {
      serviceId: "finance-ledger",
      provider: "plaid",
      transport: "http",
      source: "authority-config",
      endpoint: "https://mcp.example.test",
      enabled: true,
      healthy: true,
      healthStatus: "healthy",
      operationalMode: "active",
      toolCount: 2,
      loadedModules: ["finance", "ledger"],
      moduleErrors: {},
      priority: 3,
      requestCount: 12,
      successCount: 11,
      failureCount: 1,
      successStreak: 4,
      failureStreak: 0,
      lastUsedAt: 1_700_000_100_000,
      lastPollAt: 1_700_000_110_000,
      lastCheckedAt: 1_700_000_120_000,
      lastStateChangeAt: 1_700_000_130_000,
      recoveryBlockedUntil: 0,
      recoveryAttemptCount: 1,
      recoveryLockoutUntil: 0,
      lastRecoveryAttemptAt: 1_700_000_140_000,
      stableSince: 1_700_000_150_000,
      successRate: 0.916,
      failureRate: 0.084,
      routeScore: 0.92,
      sloStatus: "healthy",
      configuredTrafficPercent: 25,
      effectiveTrafficPercent: 25,
      trafficLane: "canary",
      servicesInMaintenance: false,
      activeMaintenanceWindowId: "",
      activeMaintenanceAction: "",
      maintenanceWindowCount: 1,
      maintenanceConflictCount: 0,
      lastMaintenanceRunAt: 1_700_000_160_000,
      orchestrationGroup: "finance",
      orchestrationTemplate: "tiered",
      preferredNodes: ["node-a"],
      excludedNodes: [],
      orchestrationRegions: ["ap-southeast-1"],
      orchestrationTags: ["finance"],
      lastLatencyMs: 210,
      lastError: "",
    };

    const normalizedConfig = normalizeAuthorityMcpServiceConfig(config);
    const normalizedSnapshot = normalizeAuthorityMcpServiceSnapshot(snapshot);
    const normalizedDiscovery = normalizeAuthorityMcpDiscoveryResult({
      services: [snapshot],
      tools: [
        {
          toolName: "finance_reconcile",
          description: "Reconcile finance transactions",
          module: "finance",
          inputSchema: { type: "object" },
          outputSchema: { type: "object" },
          tags: ["finance"],
          metadata: {
            source: "plaid",
          },
        },
      ],
      syncedTools: ["finance_reconcile"],
      timestamp: 1_700_000_170_000,
    });

    expect(normalizedConfig).toMatchObject({
      runtime: "authority",
      serviceId: "finance-ledger",
      auth: {
        type: "bearer",
        hasToken: true,
      },
      defaults: {
        allowedDepartments: ["FINANCE"],
        tags: ["finance", "critical"],
      },
      policy: {
        traffic: {
          allocationPercent: 25,
        },
      },
    });

    expect(normalizedSnapshot).toMatchObject({
      runtime: "authority",
      serviceId: "finance-ledger",
      health: {
        healthy: true,
        status: "healthy",
      },
      traffic: {
        configuredPercent: 25,
        lane: "canary",
      },
      orchestration: {
        group: "finance",
      },
    });

    expect(normalizedDiscovery).toMatchObject({
      runtime: "authority",
      syncedTools: ["finance_reconcile"],
      services: [
        expect.objectContaining({
          serviceId: "finance-ledger",
        }),
      ],
    });

    expect(
      normalizeAuthorityMcpPollingStatus({
        active: false,
        intervalMs: 30_000,
        inFlight: false,
        lastPollAt: 12,
        lastPollCompletedAt: 15,
      }),
    ).toEqual({
      runtime: "authority",
      active: false,
      intervalMs: 30_000,
      inFlight: false,
      lastPollAt: 12,
      lastPollCompletedAt: 15,
    });

    expect(
      normalizeAuthorityMcpMaintenanceStatus({
        active: true,
        intervalMs: 5_000,
        inFlight: false,
        lastRunAt: 20,
        lastCompletedAt: 21,
      }),
    ).toEqual({
      runtime: "authority",
      active: true,
      intervalMs: 5_000,
      inFlight: false,
      lastRunAt: 20,
      lastCompletedAt: 21,
    });
  });

  it("wraps the authority MCP transport behind a stable registry facade", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "integration-mcp-facade-"));

    try {
      const configPath = path.join(tempDir, "authority-mcp-services.json");
      const runner: McpCommandRunner = {
        async run(service, operation, payload = {}) {
          if (operation === "discover") {
            return {
              ok: true,
              healthy: true,
              toolCount: 1,
              loadedModules: service.modules,
              moduleErrors: {},
              tools: [
                {
                  toolName: "finance_reconcile",
                  description: "Reconcile finance state",
                  module: service.modules[0] || "finance",
                  inputSchema: { type: "object" },
                  outputSchema: { type: "object" },
                  tags: ["finance", "mcp"],
                  metadata: {
                    payloadKeys: Object.keys(payload),
                  },
                },
              ],
            };
          }

          if (operation === "health") {
            return {
              ok: true,
              healthy: true,
              toolCount: 1,
              loadedModules: service.modules,
              moduleErrors: {},
            };
          }

          return {
            ok: true,
            healthy: true,
            toolCount: 1,
            loadedModules: service.modules,
            moduleErrors: {},
            result: {
              serviceId: service.serviceId,
              payloadKeys: Object.keys(payload),
            },
          };
        },
      };

      const state = new AuthorityState();
      const eventStore = new EventStore();
      const bridge = new AuthorityToolCallBridge(state, eventStore);
      const transport = new AuthorityMcpTransportService(state, eventStore, bridge, {
        configPath,
        runner,
        enableHealthPolling: false,
        maintenanceIntervalMs: 60_000,
      });
      const facade = createAuthorityMcpRegistryFacade(transport);

      const registered = await facade.registerService({
        serviceId: "finance-ledger",
        provider: "plaid",
        transport: "http",
        endpoint: "https://mcp.example.test",
        enabled: true,
        source: "authority-config",
        modules: ["finance"],
      });

      expect(registered).toMatchObject({
        runtime: "authority",
        serviceId: "finance-ledger",
        operationalMode: "active",
      });

      const policyUpdated = await facade.updateServicePolicy("finance-ledger", {
        traffic: {
          allocationPercent: 40,
          lane: "canary",
        },
        orchestration: {
          serviceGroup: "finance",
          preferredNodes: ["node-a"],
        },
      });

      expect(policyUpdated.traffic).toMatchObject({
        configuredPercent: 40,
        lane: "canary",
      });
      expect(policyUpdated.orchestration).toMatchObject({
        group: "finance",
        preferredNodes: ["node-a"],
      });

      const scheduled = await facade.scheduleMaintenanceWindow("finance-ledger", {
        windowId: "finance-nightly",
        startAt: Date.now() + 60_000,
        endAt: Date.now() + 120_000,
        action: "pause",
      });

      expect(scheduled.maintenance.windowCount).toBe(1);

      const controlled = await facade.controlService("finance-ledger", "pause", "maintenance prep");
      expect(controlled.operationalMode).toBe("paused");

      const discovered = await facade.discoverAndSync("finance-ledger");
      expect(discovered).toMatchObject({
        runtime: "authority",
        syncedTools: ["finance_reconcile"],
      });
      expect(discovered.services[0]?.toolCount).toBe(1);

      expect(facade.listServices()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            runtime: "authority",
            serviceId: "finance-ledger",
          }),
        ]),
      );
      expect(facade.getPollingStatus()).toMatchObject({
        runtime: "authority",
        active: false,
      });
      expect(facade.getMaintenanceStatus()).toMatchObject({
        runtime: "authority",
        active: true,
      });

      transport.dispose();
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
