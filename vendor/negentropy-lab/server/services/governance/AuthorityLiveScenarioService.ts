/**
 * @constitution
 * §101 同步公理: governance 场景实现与真理源文档保持同步
 * §141 熵减验证公理: 治理与纠偏流程需保持语义稳定
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename AuthorityLiveScenarioService.ts
 * @version 1.0.0
 * @category governance
 * @last_updated 2026-03-10
 */

import { AuthorityState } from "../../schema/AuthorityState";
import { AgentConfig } from "../../types/system/AgentTypes";
import {
  AgentRequest,
  CollaborationRequest,
  CollaborationResult,
} from "../../gateway/agent-engine";
import { AuthorityAgentSessionRegistry } from "../authority/AuthorityAgentSessionRegistry";
import { EventStore } from "../authority/EventStore";
import { MutationPipeline } from "../authority/MutationPipeline";
import {
  BudgetConflictScenarioInput,
  BudgetConflictScenarioResult,
  LiveAgentSyncResult,
  LiveMorningBriefResult,
  MorningBrief,
} from "../authority/types";
import { CollaborationBus } from "../choreography/CollaborationBus";
import { AuthorityMonitoringService } from "../authority/AuthorityMonitoringService";
import { AuthorityPilotWorkflowService } from "./AuthorityPilotWorkflowService";
import { ConflictResolver } from "./ConflictResolver";

function createId(prefix: string): string {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

export interface AuthorityLiveAgentSource {
  getAllAgents(): AgentConfig[];
  executeCollaboration(request: CollaborationRequest): Promise<CollaborationResult>;
}

const LIVE_SYNC_SOURCE = "openclaw_agent_engine";

export class AuthorityLiveScenarioService {
  constructor(
    private readonly state: AuthorityState,
    private readonly mutationPipeline: MutationPipeline,
    private readonly eventStore: EventStore,
    private readonly agentSessionRegistry: AuthorityAgentSessionRegistry,
    private readonly pilotWorkflowService: AuthorityPilotWorkflowService,
    private readonly conflictResolver: ConflictResolver,
    private readonly collaborationBus: CollaborationBus,
    private readonly monitoringService: AuthorityMonitoringService,
  ) {}

  syncFromAgentSource(source: AuthorityLiveAgentSource, proposer = "system"): LiveAgentSyncResult {
    const agents = source.getAllAgents();
    const activeAgentIds = new Set<string>();
    let syncedAgents = 0;

    agents.forEach((agent) => {
      if (!this.isSyncEligible(agent)) {
        return;
      }

      activeAgentIds.add(agent.id);
      const mapped = this.mapAgent(agent);

      this.agentSessionRegistry.registerSession(
        {
          agentId: agent.id,
          name: agent.name,
          department: mapped.department,
          role: mapped.role,
          model: agent.llm_model,
          provider: agent.llm_provider,
          capabilities: mapped.capabilities,
          trustLevel: mapped.trustLevel,
          lane: mapped.lane,
          sessionId: `${LIVE_SYNC_SOURCE}:${agent.id}`,
          sessionToken: `${LIVE_SYNC_SOURCE}:token:${agent.id}`,
          capacity: mapped.capacity,
          metadata: {
            syncSource: LIVE_SYNC_SOURCE,
            engineType: agent.type,
            engineStatus: agent.status,
            agentVersion: agent.version,
            lastActive: String(agent.last_active),
          },
        },
        proposer,
      );

      const heartbeat = this.deriveHeartbeat(agent);
      this.agentSessionRegistry.heartbeat(
        {
          agentId: agent.id,
          sessionId: `${LIVE_SYNC_SOURCE}:${agent.id}`,
          load: heartbeat.load,
          pendingTasks: heartbeat.pendingTasks,
          healthStatus: heartbeat.healthStatus,
          metadata: {
            syncSource: LIVE_SYNC_SOURCE,
            lastActive: String(agent.last_active),
            syncAt: String(Date.now()),
          },
        },
        proposer,
      );

      syncedAgents += 1;
    });

    let disconnectedAgents = 0;
    this.state.agents.forEach((agent) => {
      if (agent.metadata.get("syncSource") !== LIVE_SYNC_SOURCE) {
        return;
      }
      if (!activeAgentIds.has(agent.id)) {
        this.agentSessionRegistry.unregisterSession(agent.id, proposer, "live_source_missing");
        disconnectedAgents += 1;
      }
    });

    return {
      source: LIVE_SYNC_SOURCE,
      syncedAgents,
      disconnectedAgents,
      totalAuthoritySessions: this.state.agents.size,
      sessions: this.agentSessionRegistry.listSessions(),
      timestamp: Date.now(),
    };
  }

  async runLiveMorningBrief(source: AuthorityLiveAgentSource, proposer = "system"): Promise<LiveMorningBriefResult> {
    this.syncFromAgentSource(source, proposer);
    const collaboration = await this.executeMorningBriefCollaboration(source);
    this.syncFromAgentSource(source, proposer);

    const brief = this.pilotWorkflowService.runMorningBrief(proposer);
    const collaborationRecord = collaboration as any;
    const payload = {
      brief,
      collaboration,
      monitoring: this.monitoringService.getSnapshot(),
      generatedAt: Date.now(),
    };

    this.persistWorkflow("morning-brief-live", proposer, {
      brief: JSON.stringify(brief),
      collaboration: JSON.stringify(collaboration),
      monitoring: JSON.stringify(payload.monitoring),
    });

    const publication = this.collaborationBus.bridgeWorkflow("morning-brief-live", "daily.sync", payload, proposer);
    this.appendAudit("workflow.pilot.executed", {
      workflowId: "morning-brief-live",
      generatedAt: payload.generatedAt,
      participants: collaborationRecord?.participants?.length || 0,
    });

    return {
      brief,
      collaboration: collaboration || undefined,
      participants: collaborationRecord?.participants?.map((entry: any) => String(entry.agentId)) || [],
      publication: {
        envelopeId: publication.envelope.envelopeId,
        topic: publication.envelope.topic,
        recipients: publication.recipients,
      },
      monitoringStatus: payload.monitoring.status,
    };
  }

  async runBudgetConflictScenario(
    source: AuthorityLiveAgentSource,
    input: BudgetConflictScenarioInput = {},
    proposer = "system",
  ): Promise<BudgetConflictScenarioResult> {
    this.syncFromAgentSource(source, proposer);
    const scenarioAgents = this.selectScenarioAgents(source.getAllAgents());
    const coordinator = scenarioAgents.coordinator;
    if (!coordinator) {
      throw new Error("no coordinator available for budget conflict scenario");
    }

    const requestedAmount = Number(input.requestedAmount ?? 1_000_000);
    const options = input.options?.length ? input.options : ["approve", "reallocate", "defer"];
    const creationProposer = input.proposer || coordinator.id;

    const proposal = this.conflictResolver.createProposal({
      title: input.title || "Authority live budget conflict",
      proposer: creationProposer,
      department: input.department || "CABINET",
      type: "budget_conflict_live",
      options,
      rationale: input.rationale || `Evaluate budget request ${requestedAmount}`,
      metadata: {
        requestedAmount,
        source: LIVE_SYNC_SOURCE,
      },
    });

    const collaboration = await this.executeBudgetCollaboration(source, proposal.title, requestedAmount, scenarioAgents);
    this.syncFromAgentSource(source, proposer);

    const voters = scenarioAgents.voters
      .filter((agent) => this.state.agents.has(agent.id))
      .map((agent) => agent.id);

    voters.forEach((voterAgentId) => {
      const option = this.chooseBudgetVote(voterAgentId, options, requestedAmount);
      this.conflictResolver.vote({
        proposalId: proposal.proposalId,
        voterAgentId,
        option,
        rationale: `live_budget_vote:${option}`,
      });
    });

    const resolvedProposal = this.conflictResolver.resolve(proposal.proposalId, coordinator.id);
    const payload = {
      proposal,
      resolvedProposal,
      collaboration,
      voters,
      requestedAmount,
      monitoring: this.monitoringService.getSnapshot(),
      decidedAt: Date.now(),
    };

    this.persistWorkflow("budget-conflict-live", proposer, {
      proposal: JSON.stringify(proposal),
      resolvedProposal: JSON.stringify(resolvedProposal),
      collaboration: JSON.stringify(collaboration),
      voters: JSON.stringify(voters),
      requestedAmount: String(requestedAmount),
    });

    const publication = this.collaborationBus.bridgeWorkflow(
      "budget-conflict-live",
      input.topic || "governance.budget",
      payload,
      proposer,
    );

    this.appendAudit("workflow.pilot.executed", {
      workflowId: "budget-conflict-live",
      proposalId: proposal.proposalId,
      winner: resolvedProposal.winner,
      voters: voters.length,
    });

    return {
      proposal,
      resolvedProposal,
      collaboration: collaboration || undefined,
      voters,
      requestedAmount,
      recommendedDecision: resolvedProposal.winner || options[0],
      publication: {
        envelopeId: publication.envelope.envelopeId,
        topic: publication.envelope.topic,
        recipients: publication.recipients,
      },
    };
  }

  private async executeMorningBriefCollaboration(
    source: AuthorityLiveAgentSource,
  ): Promise<Record<string, unknown> | null> {
    const selected = this.selectScenarioAgents(source.getAllAgents());
    if (!selected.coordinator) {
      return null;
    }

    const monitoring = this.monitoringService.getSnapshot();
    const request: CollaborationRequest = {
      coordinatorRequest: this.createAgentRequest(
        selected.coordinator,
        "Generate authority morning brief",
        JSON.stringify({
          monitoring,
          entropy: monitoring.entropy,
          sessions: monitoring.sessions,
        }),
      ),
      specialistRequests: selected.specialists.map((agent) =>
        this.createAgentRequest(
          agent,
          "Provide morning brief specialist input",
          JSON.stringify({
            expertise: agent.collaboration_rules.expertise_domains,
            monitoringStatus: monitoring.status,
          }),
        ),
      ),
    };

    return (await source.executeCollaboration(request)) as unknown as Record<string, unknown>;
  }

  private async executeBudgetCollaboration(
    source: AuthorityLiveAgentSource,
    title: string,
    requestedAmount: number,
    selected: ReturnType<AuthorityLiveScenarioService["selectScenarioAgents"]>,
  ): Promise<Record<string, unknown> | null> {
    if (!selected.coordinator) {
      return null;
    }

    const request: CollaborationRequest = {
      coordinatorRequest: this.createAgentRequest(
        selected.coordinator,
        title,
        JSON.stringify({
          requestedAmount,
          entropy: this.monitoringService.getSnapshot().entropy,
        }),
      ),
      specialistRequests: selected.specialists.map((agent) =>
        this.createAgentRequest(
          agent,
          "Provide budget conflict recommendation",
          JSON.stringify({
            requestedAmount,
            expertise: agent.collaboration_rules.expertise_domains,
          }),
        ),
      ),
    };

    return (await source.executeCollaboration(request)) as unknown as Record<string, unknown>;
  }

  private createAgentRequest(agent: AgentConfig, query: string, context: string): AgentRequest {
    return {
      agentId: agent.id,
      agentName: agent.name,
      query,
      context,
      config: {
        temperature: agent.temperature,
        maxTokens: agent.max_token_limit,
      },
    };
  }

  private chooseBudgetVote(agentId: string, options: string[], requestedAmount: number): string {
    const session = this.state.agents.get(agentId);
    const department = session?.department || "OFFICE";
    const warningThreshold = this.state.entropy.thresholds.get("global_warning") ?? 0.7;
    const entropyHigh = this.state.entropy.global >= warningThreshold;

    if (department === "MOS" && entropyHigh && options.includes("defer")) {
      return "defer";
    }
    if ((department === "OFFICE" || department === "CABINET") && options.includes("reallocate")) {
      return "reallocate";
    }
    if (department === "TECHNOLOGY" && requestedAmount <= 1_500_000 && options.includes("approve")) {
      return "approve";
    }
    if (requestedAmount > 1_500_000 && options.includes("reallocate")) {
      return "reallocate";
    }
    if (options.includes("approve")) {
      return "approve";
    }
    return options[0];
  }

  private selectScenarioAgents(agents: AgentConfig[]): {
    coordinator: AgentConfig | null;
    specialists: AgentConfig[];
    voters: AgentConfig[];
  } {
    const eligible = agents.filter((agent) => this.isSyncEligible(agent));
    const coordinator =
      eligible.find((agent) => agent.type === "office_director") ||
      eligible.find((agent) => agent.type === "prime_minister") ||
      eligible.find((agent) => agent.collaboration_rules.can_coordinate_others) ||
      eligible[0] ||
      null;

    const specialists = eligible
      .filter((agent) => agent.id !== coordinator?.id)
      .sort((left, right) => {
        const leftPriority = left.type === "technology_ministry" || left.type === "supervision_ministry" ? -1 : 0;
        const rightPriority = right.type === "technology_ministry" || right.type === "supervision_ministry" ? -1 : 0;
        return leftPriority - rightPriority;
      })
      .slice(0, 3);

    return {
      coordinator,
      specialists,
      voters: [coordinator, ...specialists].filter(Boolean) as AgentConfig[],
    };
  }

  private isSyncEligible(agent: AgentConfig): boolean {
    return agent.status === "active" || agent.status === "testing" || agent.status === "maintenance";
  }

  private mapAgent(agent: AgentConfig): {
    department: string;
    role: string;
    trustLevel: number;
    capabilities: string[];
    lane: string;
    capacity: number;
  } {
    const expertiseCapabilities = agent.collaboration_rules.expertise_domains.map((domain) => `expertise:${domain}`);
    const base = ["observe:*", "propose:*", ...expertiseCapabilities];

    switch (agent.type) {
      case "office_director":
        return {
          department: "OFFICE",
          role: "director",
          trustLevel: 1,
          capabilities: [...base, "commit:*", "govern:*", "dispatch:*", "invoke:tool:*"],
          lane: "office",
          capacity: 3,
        };
      case "technology_ministry":
        return {
          department: "TECHNOLOGY",
          role: "minister",
          trustLevel: 0.9,
          capabilities: [...base, "commit:technology:*", "invoke:tool:*"],
          lane: "technology",
          capacity: 2,
        };
      case "supervision_ministry":
        return {
          department: "MOS",
          role: "minister",
          trustLevel: 0.95,
          capabilities: [...base, "govern:*", "invoke:tool:audit:*"],
          lane: "supervision",
          capacity: 2,
        };
      case "prime_minister":
        return {
          department: "CABINET",
          role: "prime_minister",
          trustLevel: 1,
          capabilities: [...base, "dispatch:*", "govern:*"],
          lane: "cabinet",
          capacity: 3,
        };
      case "organization_ministry":
        return {
          department: "CABINET",
          role: "minister",
          trustLevel: 0.88,
          capabilities: [...base, "dispatch:*", "commit:architecture:*"],
          lane: "cabinet",
          capacity: 2,
        };
      case "secretary":
        return {
          department: "OFFICE",
          role: "secretary",
          trustLevel: 0.82,
          capabilities: [...base, "dispatch:report:*", "observe:*"],
          lane: "office",
          capacity: 1,
        };
      default:
        return {
          department: "OFFICE",
          role: "worker",
          trustLevel: 0.8,
          capabilities: base,
          lane: "default",
          capacity: 1,
        };
    }
  }

  private deriveHeartbeat(agent: AgentConfig): {
    healthStatus: "healthy" | "degraded" | "unhealthy";
    load: number;
    pendingTasks: number;
  } {
    const ageMs = Date.now() - Number(agent.last_active || 0);
    if (ageMs < 5 * 60 * 1000) {
      return {
        healthStatus: "healthy",
        load: agent.collaboration_rules.can_coordinate_others ? 0.35 : 0.2,
        pendingTasks: agent.collaboration_rules.can_coordinate_others ? 1 : 0,
      };
    }
    if (ageMs < 60 * 60 * 1000) {
      return {
        healthStatus: "degraded",
        load: 0.65,
        pendingTasks: 1,
      };
    }
    return {
      healthStatus: "unhealthy",
      load: 0.95,
      pendingTasks: 0,
    };
  }

  private persistWorkflow(workflowId: string, proposer: string, outputs: Record<string, string>): void {
    const existing = this.state.workflows.get(workflowId);
    const currentOutputs = existing ? Object.fromEntries(existing.outputs.entries()) : {};
    const result = this.mutationPipeline.propose({
      proposer,
      targetPath: `workflows.${workflowId}`,
      operation: existing ? "update" : "set",
      payload: {
        id: workflowId,
        type: "live_scenario",
        status: "completed",
        outputs: {
          ...currentOutputs,
          ...outputs,
        },
        updatedAt: Date.now(),
      },
      reason: "live_scenario_execute",
    });
    if (!result.ok) {
      throw new Error(result.error || `failed to persist workflow ${workflowId}`);
    }
  }

  private appendAudit(type: "workflow.pilot.executed", payload: Record<string, unknown>): void {
    this.eventStore.append({
      eventId: createId("event"),
      mutationId: createId("live-scenario"),
      type,
      timestamp: Date.now(),
      payload,
    });
  }
}

export default AuthorityLiveScenarioService;
