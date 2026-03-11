/**
 * @constitution
 * §101 同步公理: 协作总线测试需与真理源文档保持同步
 * §110 协作效率公理: 协作消息验证需保持清晰高效
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename CollaborationBus.test.ts
 * @version 1.0.0
 * @category choreography/test
 * @last_updated 2026-03-10
 */

import { describe, expect, it } from "vitest";
import { AgentSessionState, AuthorityState } from "../../schema/AuthorityState";
import { EventStore } from "../authority/EventStore";
import { MutationPipeline } from "../authority/MutationPipeline";
import { BreakerService } from "../governance/BreakerService";
import { EntropyEngine } from "../governance/EntropyEngine";
import { CollaborationBus } from "./CollaborationBus";

function registerAgent(state: AuthorityState, agentId: string, capabilities: string[] = ["observe:*"]): void {
  const agent = new AgentSessionState();
  agent.id = agentId;
  agent.name = agentId;
  agent.department = "TECHNOLOGY";
  agent.role = "minister";
  agent.model = "zai/glm-4.7";
  agent.provider = "zai";
  agent.available = true;
  agent.connectionStatus = "connected";
  capabilities.forEach((capability) => agent.capabilities.set(capability, "enabled"));
  state.agents.set(agentId, agent);
}

describe("CollaborationBus", () => {
  it("supports topic subscriptions, capability-routed publication, direct messaging, and workflow bridge", () => {
    const state = new AuthorityState();
    const eventStore = new EventStore();
    const pipeline = new MutationPipeline(state, eventStore, new EntropyEngine(state), new BreakerService(state));
    const bus = new CollaborationBus(state, pipeline, eventStore);

    registerAgent(state, "agent:tech", ["observe:*", "commit:technology:*"]);
    registerAgent(state, "agent:office", ["observe:*"]);

    const subscription = bus.subscribe({
      topic: "daily.sync",
      agentId: "agent:tech",
      requiredCapabilities: ["observe:*"],
    });
    expect(subscription.topic).toBe("daily.sync");

    const publication = bus.publish({
      topic: "daily.sync",
      from: "agent:office",
      payload: { summary: "ready" },
      requiredCapabilities: ["observe:*"],
    });
    expect(publication.recipients).toContain("agent:tech");

    const direct = bus.sendDirect({
      from: "agent:tech",
      to: "agent:office",
      payload: { action: "review" },
    });
    expect(direct.kind).toBe("direct");
    expect(direct.to).toBe("agent:office");

    const bridged = bus.bridgeWorkflow("morning-brief", "daily.sync", { headline: "all clear" });
    expect(bridged.envelope.kind).toBe("topic");
    expect(bridged.envelope.from).toBe("workflow:morning-brief");

    const snapshot = bus.getSnapshot();
    expect(snapshot.topics["daily.sync"]).toBeTruthy();
    expect(snapshot.lastMessages["daily.sync"]).toBeTruthy();
    expect(snapshot.lastMessages["direct:agent:office"]).toBeTruthy();
    expect(eventStore.getAll().some((event) => event.type === "collaboration.message.published")).toBe(true);
  });
});
