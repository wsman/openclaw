/**
 * @constitution
 * §101 同步公理: authority 会话注册实现与真理源文档保持同步
 * §102 熵减原则: 保持 authority 注册逻辑简洁可维护
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename AuthorityAgentSessionRegistry.ts
 * @version 1.0.0
 * @category authority
 * @last_updated 2026-03-10
 */

import { randomUUID } from "crypto";
import { AgentSessionState, AuthorityState } from "../../schema/AuthorityState";
import { MutationPipeline } from "./MutationPipeline";
import {
  AgentSessionHeartbeatInput,
  AgentSessionRegistrationInput,
  AgentSessionSnapshot,
} from "./types";

export class AuthorityAgentSessionRegistry {
  constructor(
    private readonly state: AuthorityState,
    private readonly mutationPipeline: MutationPipeline,
  ) {}

  registerSession(input: AgentSessionRegistrationInput, proposer = "system"): AgentSessionSnapshot {
    const now = Date.now();
    const existing = this.state.agents.get(input.agentId);
    const sessionId = input.sessionId || existing?.sessionId || `session:${randomUUID()}`;
    const sessionToken = input.sessionToken || existing?.sessionToken || `token:${randomUUID()}`;
    const capabilities = input.capabilities.reduce<Record<string, string>>((acc, capability) => {
      acc[capability] = "enabled";
      return acc;
    }, {});

    const result = this.mutationPipeline.propose({
      proposer,
      targetPath: `agents.${input.agentId}`,
      operation: existing ? "update" : "set",
      payload: {
        id: input.agentId,
        name: input.name,
        department: input.department,
        role: input.role,
        sessionId,
        sessionToken,
        status: "idle",
        connectionStatus: "connected",
        healthStatus: "healthy",
        model: input.model,
        provider: input.provider,
        trustLevel: input.trustLevel ?? existing?.trustLevel ?? 0.8,
        lane: input.lane ?? existing?.lane ?? "default",
        capacity: input.capacity ?? existing?.capacity ?? 1,
        currentLoad: existing?.currentLoad ?? 0,
        pendingTasks: existing?.pendingTasks ?? 0,
        currentTaskId: existing?.currentTaskId ?? "",
        taskProgress: existing?.taskProgress ?? 0,
        lastHeartbeat: now,
        leaseExpiresAt: now + 30000,
        available: true,
        createdAt: existing?.createdAt || now,
        capabilities,
        metadata: {
          ...(existing ? this.toRecord(existing.metadata) : {}),
          ...(input.metadata || {}),
          registrationSource: "authority_session_registry",
        },
      },
      reason: "agent_session_register",
    });

    if (!result.ok) {
      throw new Error(result.error || "agent session register failed");
    }

    return this.getSession(input.agentId)!;
  }

  heartbeat(input: AgentSessionHeartbeatInput, proposer = "system"): AgentSessionSnapshot {
    const agent = this.state.agents.get(input.agentId);
    if (!agent) {
      throw new Error(`agent not found: ${input.agentId}`);
    }

    const now = Date.now();
    const load = Math.max(0, Math.min(1, Number(input.load ?? agent.currentLoad)));
    const pendingTasks = Math.max(0, Number(input.pendingTasks ?? agent.pendingTasks));
    const healthStatus = input.healthStatus || (load >= 0.9 ? "degraded" : agent.healthStatus);
    const availability = healthStatus !== "unhealthy";
    const status = pendingTasks > 0 ? "ready" : "idle";

    const result = this.mutationPipeline.propose({
      proposer,
      targetPath: `agents.${input.agentId}`,
      operation: "update",
      payload: {
        id: agent.id,
        name: agent.name,
        department: agent.department,
        role: agent.role,
        sessionId: input.sessionId || agent.sessionId,
        sessionToken: agent.sessionToken,
        status,
        connectionStatus: "connected",
        healthStatus,
        model: agent.model,
        provider: agent.provider,
        trustLevel: agent.trustLevel,
        lane: agent.lane,
        capacity: agent.capacity,
        currentLoad: load,
        pendingTasks,
        currentTaskId: agent.currentTaskId,
        taskProgress: agent.taskProgress,
        lastHeartbeat: now,
        leaseExpiresAt: now + 30000,
        available: availability,
        createdAt: agent.createdAt,
        capabilities: this.toRecord(agent.capabilities),
        metadata: {
          ...this.toRecord(agent.metadata),
          ...(input.metadata || {}),
        },
      },
      reason: "agent_session_heartbeat",
    });

    if (!result.ok) {
      throw new Error(result.error || "agent heartbeat failed");
    }

    return this.getSession(input.agentId)!;
  }

  unregisterSession(agentId: string, proposer = "system", reason = "manual"): AgentSessionSnapshot | null {
    const agent = this.state.agents.get(agentId);
    if (!agent) {
      return null;
    }

    const now = Date.now();
    const result = this.mutationPipeline.propose({
      proposer,
      targetPath: `agents.${agentId}`,
      operation: "update",
      payload: {
        id: agent.id,
        name: agent.name,
        department: agent.department,
        role: agent.role,
        sessionId: agent.sessionId,
        sessionToken: agent.sessionToken,
        status: "disconnected",
        connectionStatus: "disconnected",
        healthStatus: agent.healthStatus,
        model: agent.model,
        provider: agent.provider,
        trustLevel: agent.trustLevel,
        lane: agent.lane,
        capacity: agent.capacity,
        currentLoad: 0,
        pendingTasks: 0,
        currentTaskId: "",
        taskProgress: 0,
        lastHeartbeat: now,
        leaseExpiresAt: now,
        available: false,
        createdAt: agent.createdAt,
        capabilities: this.toRecord(agent.capabilities),
        metadata: {
          ...this.toRecord(agent.metadata),
          sessionClosedReason: reason,
          sessionClosedAt: String(now),
        },
      },
      reason: "agent_session_unregister",
    });

    if (!result.ok) {
      throw new Error(result.error || "agent unregister failed");
    }

    return this.getSession(agentId);
  }

  cleanupExpiredSessions(proposer = "system"): number {
    const now = Date.now();
    let cleaned = 0;
    this.state.agents.forEach((agent) => {
      if (agent.leaseExpiresAt > 0 && agent.leaseExpiresAt < now && agent.connectionStatus === "connected") {
        this.unregisterSession(agent.id, proposer, "lease_expired");
        cleaned += 1;
      }
    });
    return cleaned;
  }

  getSession(agentId: string): AgentSessionSnapshot | null {
    const agent = this.state.agents.get(agentId);
    return agent ? this.toSnapshot(agent) : null;
  }

  listSessions(): AgentSessionSnapshot[] {
    return [...this.state.agents.values()].map((agent) => this.toSnapshot(agent));
  }

  selectAgent(requiredCapabilities: string[] = [], department?: string): AgentSessionSnapshot | null {
    const candidates = [...this.state.agents.values()]
      .filter((agent) => agent.available && agent.connectionStatus === "connected")
      .filter((agent) => (department ? agent.department === department : true))
      .filter((agent) => requiredCapabilities.every((capability) => agent.capabilities.has(capability) || agent.capabilities.has("*")));

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((left, right) => {
      const leftScore = left.currentLoad - left.trustLevel * 0.2 + left.pendingTasks * 0.05;
      const rightScore = right.currentLoad - right.trustLevel * 0.2 + right.pendingTasks * 0.05;
      return leftScore - rightScore;
    });

    return this.toSnapshot(candidates[0]);
  }

  private toSnapshot(agent: AgentSessionState): AgentSessionSnapshot {
    return {
      agentId: agent.id,
      name: agent.name,
      department: agent.department,
      role: agent.role,
      model: agent.model,
      provider: agent.provider,
      status: agent.status,
      connectionStatus: agent.connectionStatus,
      healthStatus: agent.healthStatus,
      currentLoad: agent.currentLoad,
      pendingTasks: agent.pendingTasks,
      lastHeartbeat: agent.lastHeartbeat,
      leaseExpiresAt: agent.leaseExpiresAt,
      available: agent.available,
      capabilities: [...agent.capabilities.keys()],
    };
  }

  private toRecord(map: Map<string, string>): Record<string, string> {
    return [...map.entries()].reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = value;
      return acc;
    }, {});
  }
}

export default AuthorityAgentSessionRegistry;
