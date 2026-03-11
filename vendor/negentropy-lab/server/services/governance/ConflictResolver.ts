/**
 * @constitution
 * §101 同步公理: governance 冲突消解实现与真理源文档保持同步
 * §141 熵减验证公理: 治理冲突消解逻辑需保持语义稳定
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename ConflictResolver.ts
 * @version 1.0.0
 * @category governance
 * @last_updated 2026-03-10
 */

import { AuthorityState } from "../../schema/AuthorityState";
import { EventStore } from "../authority/EventStore";
import { MutationPipeline } from "../authority/MutationPipeline";
import {
  AuthorityEventRecord,
  GovernanceProposalInput,
  GovernanceProposalRecord,
  GovernanceVoteInput,
} from "../authority/types";

function createId(prefix: string): string {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

export class ConflictResolver {
  constructor(
    private readonly state: AuthorityState,
    private readonly mutationPipeline: MutationPipeline,
    private readonly eventStore: EventStore,
  ) {}

  createProposal(input: GovernanceProposalInput): GovernanceProposalRecord {
    if (!input.title?.trim()) {
      throw new Error("proposal title is required");
    }
    if (!input.proposer?.trim()) {
      throw new Error("proposal proposer is required");
    }
    if (!Array.isArray(input.options) || input.options.length < 2) {
      throw new Error("proposal requires at least two options");
    }

    const proposalId = input.proposalId || createId("proposal");
    const proposal: GovernanceProposalRecord = {
      proposalId,
      title: input.title,
      department: input.department || "CABINET",
      proposer: input.proposer,
      type: input.type || "budget_conflict",
      status: "open",
      options: [...new Set(input.options.map((entry) => String(entry)))],
      votes: [],
      rationale: input.rationale,
      createdAt: Date.now(),
      metadata: input.metadata || {},
    };

    const result = this.mutationPipeline.propose({
      proposer: input.proposer,
      targetPath: `governance.proposals.${proposalId}`,
      operation: "set",
      payload: JSON.stringify(proposal),
      reason: "governance_proposal_create",
    });
    if (!result.ok) {
      throw new Error(result.error || "failed to create proposal");
    }

    this.appendAudit("governance.proposal.created", {
      proposalId,
      proposer: input.proposer,
      department: proposal.department,
      type: proposal.type,
    });

    return proposal;
  }

  vote(input: GovernanceVoteInput): GovernanceProposalRecord {
    const proposal = this.requireProposal(input.proposalId);
    if (proposal.status !== "open") {
      throw new Error(`proposal is not open: ${input.proposalId}`);
    }
    if (!proposal.options.includes(input.option)) {
      throw new Error(`invalid vote option: ${input.option}`);
    }
    if (!this.state.agents.has(input.voterAgentId)) {
      throw new Error(`agent not registered: ${input.voterAgentId}`);
    }

    proposal.votes = proposal.votes.filter((vote) => vote.voterAgentId !== input.voterAgentId);
    proposal.votes.push({
      voterAgentId: input.voterAgentId,
      option: input.option,
      rationale: input.rationale,
      timestamp: Date.now(),
    });

    const result = this.mutationPipeline.propose({
      proposer: input.voterAgentId,
      targetPath: `governance.proposals.${proposal.proposalId}`,
      operation: "update",
      payload: JSON.stringify(proposal),
      reason: "governance_vote_record",
    });
    if (!result.ok) {
      throw new Error(result.error || "failed to record vote");
    }

    this.appendAudit("governance.vote.recorded", {
      proposalId: proposal.proposalId,
      voterAgentId: input.voterAgentId,
      option: input.option,
    });

    return proposal;
  }

  resolve(proposalId: string, decider = "system"): GovernanceProposalRecord {
    const proposal = this.requireProposal(proposalId);
    if (proposal.status !== "open") {
      return proposal;
    }

    const tally = proposal.options.reduce<Record<string, number>>((acc, option) => {
      acc[option] = 0;
      return acc;
    }, {});
    proposal.votes.forEach((vote) => {
      tally[vote.option] = (tally[vote.option] || 0) + 1;
    });
    const winner =
      Object.entries(tally).sort((left, right) => {
        if (right[1] === left[1]) {
          return left[0].localeCompare(right[0]);
        }
        return right[1] - left[1];
      })[0]?.[0] || proposal.options[0];

    proposal.status = "resolved";
    proposal.winner = winner;
    proposal.resolvedAt = Date.now();

    const proposalResult = this.mutationPipeline.propose({
      proposer: decider,
      targetPath: `governance.proposals.${proposalId}`,
      operation: "update",
      payload: JSON.stringify(proposal),
      reason: "governance_proposal_resolve",
    });
    if (!proposalResult.ok) {
      throw new Error(proposalResult.error || "failed to resolve proposal");
    }

    const approvalResult = this.mutationPipeline.propose({
      proposer: decider,
      targetPath: `governance.approvals.${proposalId}`,
      operation: "set",
      payload: winner !== undefined,
      reason: "governance_approval_record",
    });
    if (!approvalResult.ok) {
      throw new Error(approvalResult.error || "failed to record proposal approval");
    }

    const auditResult = this.mutationPipeline.propose({
      proposer: decider,
      targetPath: "audit.lastDecisionId",
      operation: "set",
      payload: proposalId,
      reason: "governance_decision_cursor_update",
    });
    if (!auditResult.ok) {
      throw new Error(auditResult.error || "failed to update decision cursor");
    }

    this.appendAudit("governance.proposal.resolved", {
      proposalId,
      winner,
      votes: proposal.votes.length,
      decider,
    });

    return proposal;
  }

  simulate(input: GovernanceProposalInput): { predictedWinner: string; estimatedEntropyDelta: number } {
    const optionCount = Array.isArray(input.options) ? input.options.length : 0;
    return {
      predictedWinner: input.options?.[0] || "unknown",
      estimatedEntropyDelta: Number((Math.max(0.01, 0.08 - optionCount * 0.01)).toFixed(3)),
    };
  }

  list(): GovernanceProposalRecord[] {
    return [...this.state.governance.proposals.values()]
      .map((entry) => JSON.parse(entry) as GovernanceProposalRecord)
      .sort((left, right) => right.createdAt - left.createdAt);
  }

  get(proposalId: string): GovernanceProposalRecord | null {
    const raw = this.state.governance.proposals.get(proposalId);
    return raw ? (JSON.parse(raw) as GovernanceProposalRecord) : null;
  }

  private requireProposal(proposalId: string): GovernanceProposalRecord {
    const proposal = this.get(proposalId);
    if (!proposal) {
      throw new Error(`proposal not found: ${proposalId}`);
    }
    return proposal;
  }

  private appendAudit(type: AuthorityEventRecord["type"], payload: Record<string, unknown>): void {
    this.eventStore.append({
      eventId: createId("event"),
      mutationId: createId("governance"),
      type,
      timestamp: Date.now(),
      payload,
    });
  }
}
