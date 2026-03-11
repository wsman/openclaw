/**
 * @constitution
 * §101 同步公理: governance 冲突消解测试需与真理源文档保持同步
 * §141 熵减验证公理: 治理测试需验证冲突消解稳定
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename ConflictResolver.test.ts
 * @version 1.0.0
 * @category governance/test
 * @last_updated 2026-03-10
 */

import { describe, expect, it } from "vitest";
import { AgentSessionState, AuthorityState } from "../../schema/AuthorityState";
import { EventStore } from "../authority/EventStore";
import { MutationPipeline } from "../authority/MutationPipeline";
import { BreakerService } from "./BreakerService";
import { ConflictResolver } from "./ConflictResolver";
import { EntropyEngine } from "./EntropyEngine";

function registerAgent(state: AuthorityState, agentId: string, department = "TECHNOLOGY"): void {
  const agent = new AgentSessionState();
  agent.id = agentId;
  agent.name = agentId;
  agent.department = department;
  agent.role = "minister";
  agent.model = "zai/glm-4.7";
  agent.provider = "zai";
  agent.available = true;
  agent.connectionStatus = "connected";
  agent.capabilities.set("observe:*", "enabled");
  state.agents.set(agentId, agent);
}

describe("ConflictResolver", () => {
  it("creates proposals, records votes, and resolves decisions", () => {
    const state = new AuthorityState();
    const eventStore = new EventStore();
    const pipeline = new MutationPipeline(state, eventStore, new EntropyEngine(state), new BreakerService(state));
    const resolver = new ConflictResolver(state, pipeline, eventStore);

    registerAgent(state, "agent:tech");
    registerAgent(state, "agent:office", "OFFICE");

    const proposal = resolver.createProposal({
      title: "Resolve budget conflict",
      proposer: "system",
      options: ["approve", "defer"],
      department: "CABINET",
    });
    expect(proposal.status).toBe("open");

    resolver.vote({
      proposalId: proposal.proposalId,
      voterAgentId: "agent:tech",
      option: "approve",
    });
    const afterVote = resolver.vote({
      proposalId: proposal.proposalId,
      voterAgentId: "agent:office",
      option: "approve",
    });
    expect(afterVote.votes).toHaveLength(2);

    const resolved = resolver.resolve(proposal.proposalId, "system");
    expect(resolved.status).toBe("resolved");
    expect(resolved.winner).toBe("approve");
    expect(state.governance.approvals.get(proposal.proposalId)).toBe(true);
    expect(state.audit.lastDecisionId).toBe(proposal.proposalId);
    expect(eventStore.getAll().some((event) => event.type === "governance.proposal.resolved")).toBe(true);
  });
});
