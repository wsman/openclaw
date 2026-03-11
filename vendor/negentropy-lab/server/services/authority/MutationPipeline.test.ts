/**
 * @constitution
 * §101 同步公理: authority 变更流水线测试需与真理源文档保持同步
 * §102 熵减原则: 保持 authority 测试验证路径清晰可维护
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename MutationPipeline.test.ts
 * @version 1.0.0
 * @category authority/test
 * @last_updated 2026-03-10
 */

import { describe, expect, it } from "vitest";
import { AgentSessionState, AuthorityState } from "../../schema/AuthorityState";
import { EventStore } from "./EventStore";
import { MutationPipeline } from "./MutationPipeline";
import { BreakerService } from "../governance/BreakerService";
import { EntropyEngine } from "../governance/EntropyEngine";

describe("MutationPipeline", () => {
  function createPipeline() {
    const state = new AuthorityState();
    const eventStore = new EventStore();
    const entropyEngine = new EntropyEngine(state);
    const breakerService = new BreakerService(state);
    return {
      state,
      eventStore,
      pipeline: new MutationPipeline(state, eventStore, entropyEngine, breakerService),
    };
  }

  it("rejects top-level agent mutations without explicit model/provider", () => {
    const { pipeline } = createPipeline();
    const result = pipeline.propose({
      proposer: "system",
      targetPath: "agents.agent:test",
      operation: "set",
      payload: {
        id: "agent:test",
        name: "Test Agent",
        department: "TECHNOLOGY",
        role: "minister",
      },
      reason: "test",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("explicit model and provider");
  });

  it("commits task mutations and records audit events", () => {
    const { state, eventStore, pipeline } = createPipeline();
    const result = pipeline.propose({
      proposer: "system",
      targetPath: "tasks.task:test",
      operation: "set",
      payload: {
        id: "task:test",
        type: "briefing",
        title: "Morning Briefing",
        department: "OFFICE",
        status: "pending",
        priority: "high",
        priorityScore: 3,
        payload: "{}",
        timeoutMs: 60000,
      },
      reason: "test_task_create",
    });

    expect(result.ok).toBe(true);
    expect(state.tasks.has("task:test")).toBe(true);
    expect(eventStore.count()).toBe(result.events.length);
    expect(state.audit.totalEvents).toBe(result.events.length);
    expect(state.entropy.global).toBeGreaterThanOrEqual(0);
  });

  it("applies authority mutations across governance, tools, collaboration, replication, and workflow buckets", () => {
    const { state, pipeline } = createPipeline();

    const proposalAgent = new AgentSessionState();
    proposalAgent.id = "agent:governor";
    proposalAgent.name = "Governor";
    proposalAgent.department = "OFFICE";
    proposalAgent.role = "director";
    proposalAgent.model = "zai/glm-5";
    proposalAgent.provider = "zai";
    proposalAgent.available = true;
    proposalAgent.connectionStatus = "connected";
    proposalAgent.capabilities.set("*", "enabled");
    state.agents.set(proposalAgent.id, proposalAgent);

    expect(
      pipeline.propose({
        proposer: "agent:governor",
        targetPath: "governance.approvals.proposal:test",
        operation: "set",
        payload: true,
        requiredCapabilities: ["govern:*"],
        reason: "approve_conflict",
      }).ok,
    ).toBe(true);

    expect(
      pipeline.propose({
        proposer: "agent:governor",
        targetPath: "tools.quotas.tool:mcp_test",
        operation: "set",
        payload: 3,
        reason: "set_tool_quota",
      }).ok,
    ).toBe(true);

    expect(
      pipeline.propose({
        proposer: "agent:governor",
        targetPath: "collaboration.topics.daily_sync",
        operation: "set",
        payload: "{\"topic\":\"daily.sync\"}",
        reason: "set_collaboration_topic",
      }).ok,
    ).toBe(true);

    expect(
      pipeline.propose({
        proposer: "agent:governor",
        targetPath: "replication.status",
        operation: "set",
        payload: "streaming",
        reason: "set_replication_status",
      }).ok,
    ).toBe(true);

    expect(
      pipeline.propose({
        proposer: "agent:governor",
        targetPath: "workflows.briefing",
        operation: "set",
        payload: {
          id: "briefing",
          type: "pilot",
          status: "completed",
          outputs: { summary: "ok" },
          updatedAt: Date.now(),
        },
        reason: "set_workflow",
      }).ok,
    ).toBe(true);

    expect(state.governance.approvals.get("proposal:test")).toBe(true);
    expect(state.tools.quotas.get("tool:mcp_test")).toBe(3);
    expect(state.collaboration.topics.get("daily_sync")).toContain("daily.sync");
    expect(state.replication.status).toBe("streaming");
    expect(state.workflows.get("briefing")?.outputs.get("summary")).toBe("ok");
  });

  it("rejects high-risk mutations during breaker lockdown and missing proposer capabilities", () => {
    const { state, pipeline } = createPipeline();

    state.governance.breakerLevel = 3;
    const lockdownResult = pipeline.propose({
      proposer: "system",
      targetPath: "system.mode",
      operation: "set",
      payload: "lockdown",
      riskLevel: "high",
      reason: "dangerous_change",
    });
    expect(lockdownResult.ok).toBe(false);
    expect(lockdownResult.error).toContain("lockdown");

    state.governance.breakerLevel = 0;
    const limitedAgent = new AgentSessionState();
    limitedAgent.id = "agent:limited";
    limitedAgent.name = "Limited";
    limitedAgent.department = "OFFICE";
    limitedAgent.role = "worker";
    limitedAgent.model = "zai/glm-4.7";
    limitedAgent.provider = "zai";
    limitedAgent.available = true;
    limitedAgent.connectionStatus = "connected";
    limitedAgent.capabilities.set("observe:*", "enabled");
    state.agents.set(limitedAgent.id, limitedAgent);

    const capabilityResult = pipeline.propose({
      proposer: "agent:limited",
      targetPath: "system.mode",
      operation: "set",
      payload: "guarded",
      requiredCapabilities: ["govern:*"],
      reason: "missing_capability",
    });
    expect(capabilityResult.ok).toBe(false);
    expect(capabilityResult.error).toContain("missing capabilities");
  });
});
