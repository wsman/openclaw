/**
 * @constitution
 * §101 同步公理: governance 场景测试需与真理源文档保持同步
 * §141 熵减验证公理: 治理测试需验证纠偏行为稳定
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename AuthorityLiveScenarioService.test.ts
 * @version 1.0.0
 * @category governance/test
 * @last_updated 2026-03-10
 */

import { describe, expect, it } from "vitest";
import { AuthorityState } from "../../schema/AuthorityState";
import { AuthorityAgentSessionRegistry } from "../authority/AuthorityAgentSessionRegistry";
import { AuthorityMcpTransportService } from "../authority/AuthorityMcpTransportService";
import { AuthorityMonitoringService } from "../authority/AuthorityMonitoringService";
import { AuthorityToolCallBridge } from "../authority/AuthorityToolCallBridge";
import { EventStore } from "../authority/EventStore";
import { MutationPipeline } from "../authority/MutationPipeline";
import { CollaborationBus } from "../choreography/CollaborationBus";
import { AuthorityPilotWorkflowService } from "./AuthorityPilotWorkflowService";
import { AuthorityLiveScenarioService, AuthorityLiveAgentSource } from "./AuthorityLiveScenarioService";
import { BreakerService } from "./BreakerService";
import { ConflictResolver } from "./ConflictResolver";
import { EntropyEngine } from "./EntropyEngine";

function createMockSource(): AuthorityLiveAgentSource {
  const agents = [
    {
      id: "agent:office_director",
      name: "Office Director",
      type: "office_director",
      description: "director",
      llm_provider: "deepseek",
      llm_model: "deepseek-chat",
      max_response_time: 1000,
      max_token_limit: 8192,
      temperature: 0.2,
      system_prompt: "prompt",
      collaboration_rules: {
        can_initiate_collaboration: true,
        can_coordinate_others: true,
        expertise_domains: ["coordination"],
        required_preconditions: [],
      },
      status: "active",
      last_active: Date.now(),
      version: "1.0.0",
      created_at: Date.now(),
      updated_at: Date.now(),
      created_by: "system",
      agentId: "agent:office_director",
    },
    {
      id: "agent:technology_ministry",
      name: "Technology Ministry",
      type: "technology_ministry",
      description: "technology",
      llm_provider: "deepseek",
      llm_model: "deepseek-chat",
      max_response_time: 1000,
      max_token_limit: 8192,
      temperature: 0.4,
      system_prompt: "prompt",
      collaboration_rules: {
        can_initiate_collaboration: false,
        can_coordinate_others: false,
        expertise_domains: ["programming"],
        required_preconditions: [],
      },
      status: "active",
      last_active: Date.now(),
      version: "1.0.0",
      created_at: Date.now(),
      updated_at: Date.now(),
      created_by: "system",
      agentId: "agent:technology_ministry",
    },
    {
      id: "agent:supervision_ministry",
      name: "Supervision Ministry",
      type: "supervision_ministry",
      description: "supervision",
      llm_provider: "deepseek",
      llm_model: "deepseek-chat",
      max_response_time: 1000,
      max_token_limit: 8192,
      temperature: 0.3,
      system_prompt: "prompt",
      collaboration_rules: {
        can_initiate_collaboration: false,
        can_coordinate_others: false,
        expertise_domains: ["audit"],
        required_preconditions: [],
      },
      status: "active",
      last_active: Date.now(),
      version: "1.0.0",
      created_at: Date.now(),
      updated_at: Date.now(),
      created_by: "system",
      agentId: "agent:supervision_ministry",
    },
  ] as any[];

  return {
    getAllAgents() {
      return agents as any;
    },
    async executeCollaboration(request) {
      return {
        collaborationId: "collab:test",
        coordinator: {
          agentId: request.coordinatorRequest.agentId,
          name: request.coordinatorRequest.agentName,
          expertise: ["coordination"],
          capacity: 1,
          currentLoad: 0.2,
          healthStatus: "healthy",
          lastHeartbeat: Date.now(),
          version: "1.0.0",
        },
        participants: request.specialistRequests.map((entry) => ({
          agentId: entry.agentId,
          name: entry.agentName,
          expertise: ["specialist"],
          capacity: 1,
          currentLoad: 0.2,
          healthStatus: "healthy",
          lastHeartbeat: Date.now(),
          version: "1.0.0",
        })),
        result: {
          summary: "collaboration complete",
        },
        processingTime: 5,
        complianceCheck: {
          constitutional: true,
          technical: true,
          operational: true,
        },
      };
    },
  };
}

describe("AuthorityLiveScenarioService", () => {
  it("syncs live agents, runs morning brief, and resolves budget conflict", async () => {
    const state = new AuthorityState();
    const eventStore = new EventStore();
    const entropyEngine = new EntropyEngine(state);
    const breakerService = new BreakerService(state);
    const pipeline = new MutationPipeline(state, eventStore, entropyEngine, breakerService);
    const registry = new AuthorityAgentSessionRegistry(state, pipeline);
    const toolBridge = new AuthorityToolCallBridge(state, eventStore);
    const mcpTransportService = new AuthorityMcpTransportService(state, eventStore, toolBridge);
    const conflictResolver = new ConflictResolver(state, pipeline, eventStore);
    const collaborationBus = new CollaborationBus(state, pipeline, eventStore);
    const pilotWorkflowService = new AuthorityPilotWorkflowService(
      state,
      pipeline,
      eventStore,
      entropyEngine,
      breakerService,
    );
    const monitoringService = new AuthorityMonitoringService(
      state,
      eventStore,
      entropyEngine,
      registry,
      {
        getStatus: () => ({
          status: "ready",
          logPath: "log",
          snapshotPath: "snapshot",
          lastReplicatedEventId: "",
          lastSnapshotAt: 0,
          lastRecoveredAt: 0,
          eventCount: eventStore.count(),
          autoSnapshotIntervalMs: 1000,
          autoSnapshotEventThreshold: 10,
          lastAutoSnapshotAt: 0,
          lastRotatedAt: 0,
          lastError: "",
          storage: {
            storageDir: "storage",
            snapshotBytes: 0,
            activeLogBytes: 0,
            archiveLogBytes: 0,
            archiveCount: 0,
            totalBytes: 0,
            maxLogBytes: 100,
            maxArchiveFiles: 1,
            healthy: true,
            warnings: [],
            files: [],
          },
          recovery: {
            attemptedAt: 0,
            recovered: false,
            mode: "startup",
            snapshotPath: "snapshot",
            eventCount: 0,
            replayedLogCount: 0,
          },
        }),
      } as any,
      mcpTransportService,
    );
    const service = new AuthorityLiveScenarioService(
      state,
      pipeline,
      eventStore,
      registry,
      pilotWorkflowService,
      conflictResolver,
      collaborationBus,
      monitoringService,
    );
    const source = createMockSource();

    const sync = service.syncFromAgentSource(source);
    expect(sync.syncedAgents).toBe(3);
    expect(state.agents.get("agent:technology_ministry")?.model).toBe("deepseek-chat");
    expect(state.agents.get("agent:technology_ministry")?.provider).toBe("deepseek");

    const morningBrief = await service.runLiveMorningBrief(source);
    expect(morningBrief.brief.activeAgents).toBeGreaterThan(0);
    expect(morningBrief.participants).toContain("agent:technology_ministry");
    expect(state.workflows.get("morning-brief-live")).toBeTruthy();

    const budget = await service.runBudgetConflictScenario(source, {
      requestedAmount: 2_000_000,
      options: ["approve", "reallocate", "defer"],
    });
    expect(budget.resolvedProposal.status).toBe("resolved");
    expect(budget.voters.length).toBeGreaterThan(0);
    expect(state.governance.approvals.has(budget.proposal.proposalId)).toBe(true);
    expect(state.workflows.get("budget-conflict-live")).toBeTruthy();
  });
});
