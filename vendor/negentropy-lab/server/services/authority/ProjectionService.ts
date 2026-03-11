/**
 * @constitution
 * §101 同步公理: authority 投影实现与真理源文档保持同步
 * §102 熵减原则: 保持 authority 投影逻辑简洁可维护
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename ProjectionService.ts
 * @version 1.0.0
 * @category authority
 * @last_updated 2026-03-10
 */

import { AgentMetrics, AgentRegistry, AgentState as LegacyAgentState } from "../../schema/AgentState";
import { AuthorityState, AgentSessionState, AuthorityTaskState } from "../../schema/AuthorityState";
import { ControlState } from "../../schema/ControlState";
import { TaskItemState, TaskState as LegacyTaskBoardState } from "../../schema/TaskState";
import { AgentProjection, ControlProjection, TaskProjection } from "./types";

function toObjectFromMap(values: Map<string, number>): Record<string, number> {
  return [...values.entries()].reduce<Record<string, number>>((acc, [key, value]) => {
    acc[key] = value;
    return acc;
  }, {});
}

export class ProjectionService {
  constructor(private readonly authorityState: AuthorityState) {}

  getControlRoomProjection(): ControlProjection {
    const pendingTasks = [...this.authorityState.tasks.values()].filter((task) => task.status === "pending").length;
    const activeAgents = [...this.authorityState.agents.values()].filter((agent) => agent.available).length;
    return {
      systemMode: this.authorityState.system.mode,
      systemStatus: this.authorityState.system.status,
      systemHealth: Math.max(0, 1 - this.authorityState.entropy.global),
      globalEntropy: this.authorityState.entropy.global,
      breakerLevel: this.authorityState.governance.breakerLevel,
      activeAgents,
      pendingTasks,
      totalTasks: this.authorityState.tasks.size,
      integrity: this.authorityState.audit.integrity,
    };
  }

  getAgentRoomProjection(): AgentProjection {
    const departments = new Map<string, number>();
    let active = 0;
    let idle = 0;

    this.authorityState.agents.forEach((agent) => {
      departments.set(agent.department, (departments.get(agent.department) || 0) + 1);
      if (agent.available) {
        active += 1;
      }
      if (agent.status === "idle") {
        idle += 1;
      }
    });

    return {
      total: this.authorityState.agents.size,
      active,
      idle,
      departments: toObjectFromMap(departments),
    };
  }

  getTaskRoomProjection(): TaskProjection {
    const byDepartment = new Map<string, number>();
    let pending = 0;
    let running = 0;
    let completed = 0;
    let failed = 0;
    let canceled = 0;

    this.authorityState.tasks.forEach((task) => {
      byDepartment.set(task.department || "UNASSIGNED", (byDepartment.get(task.department || "UNASSIGNED") || 0) + 1);
      switch (task.status) {
        case "pending":
          pending += 1;
          break;
        case "running":
        case "processing":
          running += 1;
          break;
        case "completed":
          completed += 1;
          break;
        case "failed":
        case "timeout":
          failed += 1;
          break;
        case "canceled":
          canceled += 1;
          break;
        default:
          break;
      }
    });

    return {
      total: this.authorityState.tasks.size,
      pending,
      running,
      completed,
      failed,
      canceled,
      byDepartment: toObjectFromMap(byDepartment),
    };
  }

  syncControlState(target: ControlState): void {
    const projection = this.getControlRoomProjection();
    target.systemEntropy = projection.globalEntropy;
    target.systemStatus = projection.systemStatus;
    target.systemHealth = projection.systemHealth;
    target.connectedClients = projection.activeAgents;
    target.lastUpdate = Date.now();
    target.compliance.overallRate = projection.integrity;
    target.compliance.codeCompliance = projection.integrity;
    target.compliance.docCompliance = projection.integrity;
    target.compliance.directoryCompliance = projection.integrity;
    target.compliance.lastCheck = Date.now();
    target.gatewayStatus.status = projection.systemStatus === "active" ? "operational" : projection.systemStatus;
    target.gatewayStatus.uptime = Date.now() - this.authorityState.createdAt;
    target.gatewayStatus.activeConnections = projection.activeAgents;
    target.gatewayStatus.messageQueueSize = projection.pendingTasks;
    target.gatewayStatus.requestRate = projection.totalTasks;
    target.gatewayStatus.errorRate = Math.max(0, 1 - projection.integrity);
  }

  syncAgentRegistry(target: AgentRegistry): void {
    target.agents.clear();
    this.authorityState.agents.forEach((agent) => {
      target.agents.set(agent.id, this.toLegacyAgentState(agent));
    });

    const projection = this.getAgentRoomProjection();
    target.totalAgents = projection.total;
    target.activeAgents = projection.active;
    target.totalTasks = this.authorityState.tasks.size;
    target.pendingTasks = [...this.authorityState.tasks.values()].filter((task) => task.status === "pending").length;
    target.completedTasks = [...this.authorityState.tasks.values()].filter((task) => task.status === "completed").length;
    target.failedTasks = [...this.authorityState.tasks.values()].filter(
      (task) => task.status === "failed" || task.status === "timeout",
    ).length;
    target.updateSystemStatus();
    target.lastUpdate = Date.now();
  }

  syncTaskBoard(target: LegacyTaskBoardState): void {
    target.tasks.clear();
    this.authorityState.tasks.forEach((task) => {
      target.tasks.set(task.id, this.toLegacyTaskState(task));
    });

    const projection = this.getTaskRoomProjection();
    target.totalTasks = projection.total;
    target.pendingTasks = projection.pending;
    target.runningTasks = projection.running;
    target.completedTasks = projection.completed;
    target.failedTasks = projection.failed;
    target.canceledTasks = projection.canceled;
    target.lastUpdate = Date.now();
  }

  private toLegacyAgentState(agent: AgentSessionState): LegacyAgentState {
    const legacy = new LegacyAgentState();
    legacy.id = agent.id;
    legacy.name = agent.name;
    legacy.type = this.mapAuthorityRoleToLegacyType(agent.role);
    legacy.status = agent.status;
    legacy.available = agent.available;
    legacy.lastActive = agent.lastHeartbeat;
    legacy.llmProvider = agent.provider;
    legacy.llmModel = agent.model;
    legacy.llmEnabled = agent.provider !== "simulated";
    legacy.currentTaskId = agent.currentTaskId;
    legacy.taskProgress = agent.taskProgress;
    legacy.createdAt = agent.createdAt;
    legacy.terminatedAt = Number(agent.metadata.get("terminatedAt") || 0);
    legacy.terminationReason = agent.metadata.get("terminationReason") || "";
    legacy.metrics = new AgentMetrics();
    legacy.metrics.averageQueueLength = 0;
    legacy.metrics.peakQueueLength = 0;
    legacy.metrics.tasksCompleted = [...this.authorityState.tasks.values()].filter(
      (task) => task.assignedTo === agent.id && task.status === "completed",
    ).length;
    legacy.metrics.tasksFailed = [...this.authorityState.tasks.values()].filter(
      (task) => task.assignedTo === agent.id && (task.status === "failed" || task.status === "timeout"),
    ).length;
    legacy.metrics.successRate =
      legacy.metrics.tasksCompleted + legacy.metrics.tasksFailed === 0
        ? 1
        : legacy.metrics.tasksCompleted / (legacy.metrics.tasksCompleted + legacy.metrics.tasksFailed);
    agent.capabilities.forEach((value, key) => {
      legacy.capabilities.set(key, value);
    });
    agent.metadata.forEach((value, key) => {
      legacy.metadata.set(key, value);
    });
    return legacy;
  }

  private toLegacyTaskState(task: AuthorityTaskState): TaskItemState {
    const legacy = new TaskItemState();
    legacy.id = task.id;
    legacy.type = task.type;
    legacy.title = task.title;
    legacy.status = task.status;
    legacy.priority = task.priority;
    legacy.progress = task.progress;
    legacy.payload = task.payload;
    legacy.result = task.result;
    legacy.error = task.error;
    legacy.assignedTo = task.assignedTo;
    legacy.timeoutMs = task.timeoutMs;
    legacy.createdAt = task.createdAt;
    legacy.startedAt = task.startedAt;
    legacy.updatedAt = task.updatedAt;
    legacy.finishedAt = task.finishedAt;
    task.metadata.forEach((value, key) => {
      legacy.metadata.set(key, value);
    });
    return legacy;
  }

  private mapAuthorityRoleToLegacyType(role: string): string {
    switch (role) {
      case "director":
        return "director";
      case "cabinet":
      case "prime_minister":
        return "cabinet";
      case "minister":
        return "ministry";
      case "specialist":
        return "specialist";
      default:
        return "worker";
    }
  }
}
