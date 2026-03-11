/**
 * @constitution
 * §101 同步公理: authority 测试需与真理源文档保持同步
 * §102 熵减原则: 保持 authority 测试验证路径清晰可维护
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename AuthorityAgentSessionRegistry.test.ts
 * @version 1.0.0
 * @category authority/test
 * @last_updated 2026-03-10
 */

import { describe, expect, it } from "vitest";
import { AuthorityState } from "../../schema/AuthorityState";
import { EventStore } from "./EventStore";
import { MutationPipeline } from "./MutationPipeline";
import { AuthorityAgentSessionRegistry } from "./AuthorityAgentSessionRegistry";
import { BreakerService } from "../governance/BreakerService";
import { EntropyEngine } from "../governance/EntropyEngine";

describe("AuthorityAgentSessionRegistry", () => {
  function createRegistry() {
    const state = new AuthorityState();
    const eventStore = new EventStore();
    const pipeline = new MutationPipeline(state, eventStore, new EntropyEngine(state), new BreakerService(state));
    return {
      state,
      registry: new AuthorityAgentSessionRegistry(state, pipeline),
    };
  }

  it("registers, heartbeats, selects, and unregisters real agent sessions", () => {
    const { state, registry } = createRegistry();

    const session = registry.registerSession({
      agentId: "agent:tech-1",
      name: "Tech Minister",
      department: "TECHNOLOGY",
      role: "minister",
      model: "zai/glm-4.7",
      provider: "zai",
      capabilities: ["observe:*", "commit:technology:*"],
      capacity: 2,
    });

    expect(session.connectionStatus).toBe("connected");
    expect(state.agents.get("agent:tech-1")?.sessionToken).toBeTruthy();

    const heartbeat = registry.heartbeat({
      agentId: "agent:tech-1",
      load: 0.4,
      pendingTasks: 1,
      healthStatus: "healthy",
    });
    expect(heartbeat.pendingTasks).toBe(1);
    expect(heartbeat.status).toBe("ready");

    const selected = registry.selectAgent(["commit:technology:*"]);
    expect(selected?.agentId).toBe("agent:tech-1");

    const closed = registry.unregisterSession("agent:tech-1", "test", "done");
    expect(closed?.connectionStatus).toBe("disconnected");
    expect(closed?.available).toBe(false);
  });
});
