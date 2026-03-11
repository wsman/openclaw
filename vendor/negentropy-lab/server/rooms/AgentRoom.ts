import { Room, Client } from "colyseus";
import { v4 as uuidv4 } from "uuid";
import { AgentMetrics, AgentRegistry, AgentState, AgentTask } from "../schema/AgentState";
import { AuthorityTaskState } from "../schema/AuthorityState";
import { getAuthorityRuntime } from "../runtime/authorityRuntime";
import { MutationProposalInput } from "../services/authority/types";
import { logger } from "../utils/logger";

interface AgentRoomConfig {
  maxAgents: number;
  healthCheckInterval: number;
  taskTimeout: number;
  maxTasksPerAgent: number;
}

const DEFAULT_CONFIG: AgentRoomConfig = {
  maxAgents: 100,
  healthCheckInterval: 5000,
  taskTimeout: 60000,
  maxTasksPerAgent: 10,
};

type AgentType = "director" | "ministry" | "cabinet" | "worker" | "specialist";

export class AgentRoom extends Room<AgentRegistry> {
  private config!: AgentRoomConfig;
  private taskQueue = new Map<string, AgentTask[]>();
  private lastHealthCheck = 0;

  onCreate(options: any) {
    logger.info(`[AgentRoom] Creating agent room ${this.roomId}...`);

    this.config = { ...DEFAULT_CONFIG, ...(options?.config || {}) };

    this.setState(new AgentRegistry());
    this.state.roomId = this.roomId;
    this.state.createdAt = Date.now();
    this.state.lastUpdate = Date.now();

    this.setupMessageHandlers();
    this.initializeSystemAgents();
    this.syncFromAuthority();
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 1000);

    logger.info("[AgentRoom] Agent room ready");
  }

  private setupMessageHandlers() {
    this.onMessage("*", (client, type, message) => {
      switch (String(type)) {
        case "spawn_agent":
          this.handleSpawnAgent(client, message);
          break;
        case "terminate_agent":
          this.handleTerminateAgent(client, message);
          break;
        case "assign_task":
          this.handleAssignTask(client, message);
          break;
        case "update_task_status":
          this.handleUpdateTaskStatus(client, message);
          break;
        case "request_agent_status":
          this.handleAgentStatusRequest(client, message);
          break;
        case "query_agents":
          this.handleQueryAgents(client, message);
          break;
        case "set_agent_capabilities":
          this.handleSetCapabilities(client, message);
          break;
        default:
          logger.debug(`[AgentRoom] Unhandled message type: ${String(type)}`);
      }
    });
  }

  private initializeSystemAgents() {
    const runtime = getAuthorityRuntime();
    if (runtime.state.agents.size > 0) {
      logger.info("[AgentRoom] Using Authority Core seeded agents");
      return;
    }

    const systemAgents = [
      {
        id: "agent:office_director",
        name: "Office Director",
        type: "director" as AgentType,
        capabilities: ["complexity_analysis", "agent_coordination", "task_decomposition", "result_integration"],
        llmProvider: "simulated",
        llmModel: "simulated",
      },
      {
        id: "agent:tech_ministry",
        name: "Technology Ministry",
        type: "ministry" as AgentType,
        capabilities: ["system_development", "architecture_optimization", "technical_innovation"],
        llmProvider: "simulated",
        llmModel: "simulated",
      },
      {
        id: "agent:monitor_ministry",
        name: "Supervision Ministry",
        type: "ministry" as AgentType,
        capabilities: ["compliance_monitoring", "entropy_audit", "system_integrity"],
        llmProvider: "simulated",
        llmModel: "simulated",
      },
      {
        id: "agent:cabinet",
        name: "Cabinet",
        type: "cabinet" as AgentType,
        capabilities: ["policy_coordination", "inter_departmental_sync", "resource_allocation"],
        llmProvider: "simulated",
        llmModel: "simulated",
      },
    ];

    systemAgents.forEach((agent) => {
      this.spawnAgent(
        agent.id,
        agent.name,
        agent.type,
        agent.capabilities,
        agent.llmProvider,
        agent.llmModel,
      );
    });
  }

  private handleSpawnAgent(client: Client, message: any) {
    const {
      name,
      type,
      capabilities = [],
      llmProvider,
      llmModel,
      department,
      role,
      trustLevel = 0.7,
      lane = "default",
    } = message || {};

    if (!name || !type) {
      client.send("error", { code: "invalid_request", message: "Missing required parameters" });
      return;
    }

    if (!llmProvider || !llmModel) {
      client.send("error", {
        code: "missing_model_params",
        message: "llmProvider and llmModel must be explicitly specified",
      });
      return;
    }

    if (this.state.agents.size >= this.config.maxAgents) {
      client.send("error", { code: "agent_limit_reached", message: "Agent limit reached" });
      return;
    }

    const agentId = `agent:${uuidv4()}`;

    try {
      this.commitAuthorityMutation({
        proposer: `session:${client.sessionId}`,
        targetPath: `agents.${agentId}`,
        operation: "set",
        payload: {
          id: agentId,
          name: String(name),
          department: String(department || this.deriveDepartment(type, name)),
          role: String(role || this.deriveRole(type)),
          status: "idle",
          model: String(llmModel),
          provider: String(llmProvider),
          trustLevel: Number(trustLevel),
          lane: String(lane),
          capabilities: this.toCapabilityMap(capabilities),
          available: true,
          createdAt: Date.now(),
          lastHeartbeat: Date.now(),
        },
        reason: "agent_spawn_request",
      });

      this.syncFromAuthority();

      client.send("agent_spawned", {
        agentId,
        name,
        type,
        timestamp: Date.now(),
      });

      this.broadcast(
        "agent_event",
        {
          event: "spawned",
          agentId,
          name,
          type,
          timestamp: Date.now(),
        },
        { except: client },
      );
    } catch (error: any) {
      client.send("error", { code: "spawn_failed", message: error.message });
    }
  }

  private spawnAgent(
    agentId: string,
    name: string,
    type: AgentType,
    capabilities: string[],
    llmProvider: string,
    llmModel: string,
  ): AgentState {
    if (this.state.agents.has(agentId)) {
      throw new Error(`Agent ${agentId} already exists`);
    }

    const agent = new AgentState();
    agent.id = agentId;
    agent.name = name;
    agent.type = type;
    agent.status = "idle";
    agent.available = true;
    agent.llmProvider = llmProvider;
    agent.llmModel = llmModel;
    agent.llmEnabled = llmProvider !== "simulated";
    agent.lastActive = Date.now();
    agent.createdAt = Date.now();

    capabilities.forEach((capability) => {
      agent.capabilities.set(capability, "enabled");
    });

    agent.metrics = new AgentMetrics();
    agent.metrics.tasksCompleted = 0;
    agent.metrics.averageResponseTime = 0;
    agent.metrics.successRate = 1.0;
    agent.metrics.lastTaskTime = 0;

    this.state.agents.set(agentId, agent);
    this.state.totalAgents += 1;
    this.state.activeAgents += 1;
    this.taskQueue.set(agentId, []);

    return agent;
  }

  private handleTerminateAgent(client: Client, message: any) {
    const { agentId, reason = "manual" } = message || {};
    const runtime = getAuthorityRuntime();
    const agent = runtime.state.agents.get(String(agentId || ""));

    if (!agent) {
      client.send("error", { code: "agent_not_found", message: "Agent not found" });
      return;
    }

    const activeTasks = this.getActiveAuthorityTasks(agent.id);
    if (activeTasks.length > 0) {
      client.send("error", {
        code: "agent_busy",
        message: `Agent still has ${activeTasks.length} active tasks`,
      });
      return;
    }

    const now = Date.now();

    try {
      this.commitAuthorityMutation({
        proposer: `session:${client.sessionId}`,
        targetPath: `agents.${agent.id}.status`,
        operation: "update",
        payload: "terminated",
        reason: "agent_terminate_request",
      });
      this.commitAuthorityMutation({
        proposer: `session:${client.sessionId}`,
        targetPath: `agents.${agent.id}.available`,
        operation: "update",
        payload: false,
        reason: "agent_terminate_request",
      });
      this.commitAuthorityMutation({
        proposer: `session:${client.sessionId}`,
        targetPath: `agents.${agent.id}.currentTaskId`,
        operation: "update",
        payload: "",
        reason: "agent_terminate_request",
      });
      this.commitAuthorityMutation({
        proposer: `session:${client.sessionId}`,
        targetPath: `agents.${agent.id}.taskProgress`,
        operation: "update",
        payload: 0,
        reason: "agent_terminate_request",
      });
      this.commitAuthorityMutation({
        proposer: `session:${client.sessionId}`,
        targetPath: `agents.${agent.id}.currentLoad`,
        operation: "update",
        payload: 0,
        reason: "agent_terminate_request",
      });
      this.commitAuthorityMutation({
        proposer: `session:${client.sessionId}`,
        targetPath: `agents.${agent.id}.metadata.terminatedAt`,
        operation: "update",
        payload: String(now),
        reason: "agent_terminate_request",
      });
      this.commitAuthorityMutation({
        proposer: `session:${client.sessionId}`,
        targetPath: `agents.${agent.id}.metadata.terminationReason`,
        operation: "update",
        payload: String(reason),
        reason: "agent_terminate_request",
      });

      this.syncFromAuthority();

      client.send("agent_terminated", {
        agentId: agent.id,
        reason,
        timestamp: now,
      });

      this.broadcast(
        "agent_event",
        {
          event: "terminated",
          agentId: agent.id,
          reason,
          timestamp: now,
        },
        { except: client },
      );
    } catch (error: any) {
      client.send("error", { code: "terminate_failed", message: error.message });
    }
  }

  private handleAssignTask(client: Client, message: any) {
    const { agentId, taskType, taskData, priority = "normal", timeoutMs } = message || {};
    const runtime = getAuthorityRuntime();
    const targetId = String(agentId || "");
    const agent = runtime.state.agents.get(targetId);

    if (!agent) {
      client.send("error", { code: "agent_not_found", message: "Agent not found" });
      return;
    }

    if (!agent.available || agent.status === "terminated") {
      client.send("error", { code: "agent_unavailable", message: "Agent is unavailable" });
      return;
    }

    const activeTasks = this.getActiveAuthorityTasks(targetId);
    if (activeTasks.length >= this.config.maxTasksPerAgent) {
      client.send("error", { code: "task_queue_full", message: "Agent task queue is full" });
      return;
    }

    const taskId = `task:${uuidv4()}`;
    const now = Date.now();
    const resolvedPriority = String(priority);

    try {
      this.commitAuthorityMutation({
        proposer: `session:${client.sessionId}`,
        targetPath: `tasks.${taskId}`,
        operation: "set",
        payload: {
          id: taskId,
          type: String(taskType || "generic"),
          title: String(message?.title || taskType || taskId),
          department: agent.department || "UNASSIGNED",
          status: "pending",
          priority: resolvedPriority,
          priorityScore: this.priorityToScore(resolvedPriority),
          progress: 0,
          payload: JSON.stringify(taskData ?? {}),
          assignedTo: targetId,
          sourceRoom: this.roomId,
          timeoutMs: Number(timeoutMs || this.config.taskTimeout),
          createdAt: now,
          updatedAt: now,
        },
        reason: "agent_task_assignment",
      });

      if (agent.status === "idle") {
        this.commitAuthorityMutation({
          proposer: `session:${client.sessionId}`,
          targetPath: `agents.${targetId}.status`,
          operation: "update",
          payload: "ready",
          reason: "agent_task_assignment",
        });
      }

      this.commitAuthorityMutation({
        proposer: `session:${client.sessionId}`,
        targetPath: `agents.${targetId}.currentLoad`,
        operation: "update",
        payload: Math.min(1, (activeTasks.length + 1) / this.config.maxTasksPerAgent),
        reason: "agent_task_assignment",
      });
      this.commitAuthorityMutation({
        proposer: `session:${client.sessionId}`,
        targetPath: `agents.${targetId}.lastHeartbeat`,
        operation: "update",
        payload: now,
        reason: "agent_task_assignment",
      });

      this.syncFromAuthority();

      client.send("task_assigned", {
        taskId,
        agentId: targetId,
        timestamp: now,
      });

      this.broadcast(
        "agent_event",
        {
          event: "task_assigned",
          taskId,
          agentId: targetId,
          timestamp: now,
        },
        { except: client },
      );
    } catch (error: any) {
      client.send("error", { code: "task_assignment_failed", message: error.message });
    }
  }

  private handleUpdateTaskStatus(client: Client, message: any) {
    const { taskId, status, result, error } = message || {};
    const runtime = getAuthorityRuntime();
    const task = runtime.state.tasks.get(String(taskId || ""));

    if (!task) {
      client.send("error", { code: "task_not_found", message: "Task not found" });
      return;
    }

    const now = Date.now();
    const nextStatus = String(status || task.status);
    const normalizedStatus = nextStatus === "running" ? "processing" : nextStatus;
    const nextProgress =
      normalizedStatus === "completed"
        ? 100
        : Math.max(0, Math.min(100, Number(message?.progress ?? task.progress)));

    try {
      this.commitAuthorityMutation({
        proposer: `session:${client.sessionId}`,
        targetPath: `tasks.${task.id}`,
        operation: "update",
        payload: this.toAuthorityTaskPayload(task, {
          status: normalizedStatus,
          progress: nextProgress,
          result: normalizedStatus === "completed" ? JSON.stringify(result ?? {}) : task.result,
          error:
            normalizedStatus === "failed" || normalizedStatus === "timeout"
              ? String(error || task.error || "Unknown error")
              : normalizedStatus === "completed"
                ? ""
                : task.error,
          startedAt: normalizedStatus === "processing" ? (task.startedAt || now) : task.startedAt,
          updatedAt: now,
          finishedAt: this.isTerminalTaskStatus(normalizedStatus) ? now : task.finishedAt,
        }),
        reason: "agent_task_status_update",
      });

      if (task.assignedTo && runtime.state.agents.has(task.assignedTo)) {
        if (normalizedStatus === "processing") {
          this.commitAuthorityMutation({
            proposer: `session:${client.sessionId}`,
            targetPath: `agents.${task.assignedTo}.status`,
            operation: "update",
            payload: "processing",
            reason: "agent_task_status_update",
          });
          this.commitAuthorityMutation({
            proposer: `session:${client.sessionId}`,
            targetPath: `agents.${task.assignedTo}.currentTaskId`,
            operation: "update",
            payload: task.id,
            reason: "agent_task_status_update",
          });
          this.commitAuthorityMutation({
            proposer: `session:${client.sessionId}`,
            targetPath: `agents.${task.assignedTo}.taskProgress`,
            operation: "update",
            payload: nextProgress,
            reason: "agent_task_status_update",
          });
        } else {
          const remainingTasks = this.getActiveAuthorityTasks(task.assignedTo, task.id).length;
          this.commitAuthorityMutation({
            proposer: `session:${client.sessionId}`,
            targetPath: `agents.${task.assignedTo}.status`,
            operation: "update",
            payload: remainingTasks > 0 ? "ready" : "idle",
            reason: "agent_task_status_update",
          });
          this.commitAuthorityMutation({
            proposer: `session:${client.sessionId}`,
            targetPath: `agents.${task.assignedTo}.currentTaskId`,
            operation: "update",
            payload: "",
            reason: "agent_task_status_update",
          });
          this.commitAuthorityMutation({
            proposer: `session:${client.sessionId}`,
            targetPath: `agents.${task.assignedTo}.taskProgress`,
            operation: "update",
            payload: normalizedStatus === "completed" ? 100 : 0,
            reason: "agent_task_status_update",
          });
          this.commitAuthorityMutation({
            proposer: `session:${client.sessionId}`,
            targetPath: `agents.${task.assignedTo}.currentLoad`,
            operation: "update",
            payload: Math.min(1, remainingTasks / this.config.maxTasksPerAgent),
            reason: "agent_task_status_update",
          });
        }

        this.commitAuthorityMutation({
          proposer: `session:${client.sessionId}`,
          targetPath: `agents.${task.assignedTo}.lastHeartbeat`,
          operation: "update",
          payload: now,
          reason: "agent_task_status_update",
        });
      }

      this.syncFromAuthority();

      this.broadcast("task_status_updated", {
        taskId: task.id,
        agentId: task.assignedTo,
        status: normalizedStatus,
        timestamp: now,
      });
    } catch (mutationError: any) {
      client.send("error", { code: "task_update_failed", message: mutationError.message });
    }
  }

  private handleAgentStatusRequest(client: Client, message: any) {
    this.syncFromAuthority();
    const agentId = message?.agentId ? String(message.agentId) : "";

    if (agentId) {
      const agent = this.state.agents.get(agentId);
      if (!agent) {
        client.send("error", { code: "agent_not_found", message: "Agent not found" });
        return;
      }

      client.send("agent_status", {
        agent,
        tasks: this.taskQueue.get(agentId) || [],
        timestamp: Date.now(),
      });
      return;
    }

    const allAgents = Array.from(this.state.agents.values()) as AgentState[];
    client.send("all_agents_status", {
      agents: allAgents,
      stats: {
        total: this.state.totalAgents,
        active: this.state.activeAgents,
        idle: allAgents.filter((agent) => agent.status === "idle").length,
        processing: allAgents.filter((agent) => agent.status === "processing").length,
      },
      timestamp: Date.now(),
    });
  }

  private handleQueryAgents(client: Client, message: any) {
    this.syncFromAuthority();
    const { type, capability, status, available } = message || {};

    let agents = Array.from(this.state.agents.values()) as AgentState[];

    if (type) {
      agents = agents.filter((agent) => agent.type === type);
    }
    if (capability) {
      agents = agents.filter((agent) => agent.capabilities.has(capability));
    }
    if (status) {
      agents = agents.filter((agent) => agent.status === status);
    }
    if (available !== undefined) {
      agents = agents.filter((agent) => agent.available === Boolean(available));
    }

    client.send("query_result", {
      agents,
      count: agents.length,
      timestamp: Date.now(),
    });
  }

  private handleSetCapabilities(client: Client, message: any) {
    const agentId = message?.agentId ? String(message.agentId) : "";
    const capabilityList = Array.isArray(message?.capabilities) ? message.capabilities : [];
    const runtime = getAuthorityRuntime();
    const agent = runtime.state.agents.get(agentId);

    if (!agent) {
      client.send("error", { code: "agent_not_found", message: "Agent not found" });
      return;
    }

    try {
      this.commitAuthorityMutation({
        proposer: `session:${client.sessionId}`,
        targetPath: `agents.${agentId}.capabilities`,
        operation: "update",
        payload: this.toCapabilityMap(capabilityList),
        reason: "agent_capabilities_update",
      });
      this.commitAuthorityMutation({
        proposer: `session:${client.sessionId}`,
        targetPath: `agents.${agentId}.lastHeartbeat`,
        operation: "update",
        payload: Date.now(),
        reason: "agent_capabilities_update",
      });

      this.syncFromAuthority();

      client.send("capabilities_updated", {
        agentId,
        capabilities: capabilityList,
        timestamp: Date.now(),
      });

      logger.info(`[AgentRoom] Capabilities updated for ${agent.name}`);
    } catch (mutationError: any) {
      client.send("error", { code: "capabilities_update_failed", message: mutationError.message });
    }
  }

  private update(_deltaTime: number) {
    const now = Date.now();

    this.syncFromAuthority();

    if (now - this.lastHealthCheck > this.config.healthCheckInterval) {
      this.performHealthCheck();
      this.lastHealthCheck = now;
    }

    this.checkTaskTimeouts();
    this.state.lastUpdate = now;
  }

  private performHealthCheck() {
    const now = Date.now();
    const staleThreshold = 60000;

    this.state.agents.forEach((agent) => {
      if (!agent.available) {
        return;
      }

      const timeSinceLastActive = now - agent.lastActive;
      if (timeSinceLastActive > staleThreshold && agent.status !== "idle") {
        logger.warn(`[AgentRoom] Agent ${agent.name} may be stale`);
        this.broadcast("agent_health_alert", {
          agentId: agent.id,
          agentName: agent.name,
          issue: "stale",
          lastActive: agent.lastActive,
          timestamp: now,
        });
      }
    });
  }

  private checkTaskTimeouts() {
    const runtime = getAuthorityRuntime();
    const now = Date.now();
    const timedOutTasks = [...runtime.state.tasks.values()].filter((task) => {
      if (task.status !== "pending" && task.status !== "running" && task.status !== "processing") {
        return false;
      }
      const start = task.startedAt || task.createdAt;
      return task.timeoutMs > 0 && now - start > task.timeoutMs;
    });

    if (timedOutTasks.length === 0) {
      return;
    }

    timedOutTasks.forEach((task) => {
      this.commitAuthorityMutation({
        proposer: "system",
        targetPath: `tasks.${task.id}`,
        operation: "update",
        payload: this.toAuthorityTaskPayload(task, {
          status: "timeout",
          error: "Task timeout",
          updatedAt: now,
          finishedAt: now,
        }),
        reason: "agent_room_timeout",
        riskLevel: "medium",
      });

      if (task.assignedTo && runtime.state.agents.has(task.assignedTo)) {
        this.commitAuthorityMutation({
          proposer: "system",
          targetPath: `agents.${task.assignedTo}.status`,
          operation: "update",
          payload: "idle",
          reason: "agent_room_timeout",
        });
        this.commitAuthorityMutation({
          proposer: "system",
          targetPath: `agents.${task.assignedTo}.currentTaskId`,
          operation: "update",
          payload: "",
          reason: "agent_room_timeout",
        });
        this.commitAuthorityMutation({
          proposer: "system",
          targetPath: `agents.${task.assignedTo}.taskProgress`,
          operation: "update",
          payload: 0,
          reason: "agent_room_timeout",
        });
        this.commitAuthorityMutation({
          proposer: "system",
          targetPath: `agents.${task.assignedTo}.currentLoad`,
          operation: "update",
          payload: Math.min(1, this.getActiveAuthorityTasks(task.assignedTo, task.id).length / this.config.maxTasksPerAgent),
          reason: "agent_room_timeout",
        });
      }

      this.broadcast("task_timeout", {
        taskId: task.id,
        agentId: task.assignedTo,
        timeout: task.timeoutMs,
        timestamp: now,
      });
    });

    this.syncFromAuthority();
  }

  onJoin(client: Client) {
    logger.info(`[AgentRoom] Client ${client.sessionId} joined`);
    this.syncFromAuthority();

    client.send("agent_registry_state", {
      agents: Array.from(this.state.agents.values()),
      stats: {
        total: this.state.totalAgents,
        active: this.state.activeAgents,
        pendingTasks: this.state.pendingTasks,
        completedTasks: this.state.completedTasks,
        failedTasks: this.state.failedTasks,
      },
      timestamp: Date.now(),
    });
  }

  onLeave(client: Client) {
    logger.info(`[AgentRoom] Client ${client.sessionId} left`);
  }

  onDispose() {
    logger.info(`[AgentRoom] Disposing room ${this.roomId}`);
    this.taskQueue.clear();
  }

  private commitAuthorityMutation(proposal: MutationProposalInput) {
    const result = getAuthorityRuntime().mutationPipeline.propose(proposal);
    if (!result.ok) {
      throw new Error(result.error || "authority mutation rejected");
    }
    return result;
  }

  private syncFromAuthority() {
    const runtime = getAuthorityRuntime();
    runtime.projectionService.syncAgentRegistry(this.state);

    const nextQueue = new Map<string, AgentTask[]>();
    this.state.agents.forEach((_agent, agentId) => {
      nextQueue.set(agentId, []);
    });

    runtime.state.tasks.forEach((task) => {
      if (!task.assignedTo) {
        return;
      }

      const queue = nextQueue.get(task.assignedTo) || [];
      const legacyTask = new AgentTask();
      legacyTask.id = task.id;
      legacyTask.agentId = task.assignedTo;
      legacyTask.type = task.type;
      legacyTask.data = task.payload;
      legacyTask.priority = task.priority;
      legacyTask.status = this.toLegacyTaskStatus(task.status);
      legacyTask.createdAt = task.createdAt;
      legacyTask.startedAt = task.startedAt;
      legacyTask.updatedAt = task.updatedAt;
      legacyTask.completedAt = task.finishedAt;
      legacyTask.timeout = task.timeoutMs;
      legacyTask.result = task.result;
      legacyTask.error = task.error;
      task.metadata.forEach((value, key) => {
        legacyTask.metadata.set(key, value);
      });
      queue.push(legacyTask);
      nextQueue.set(task.assignedTo, queue);
    });

    this.taskQueue.clear();
    nextQueue.forEach((tasks, agentId) => {
      tasks.sort((left, right) => left.createdAt - right.createdAt);
      this.taskQueue.set(agentId, tasks);
    });
    this.state.lastUpdate = Date.now();
  }

  private toLegacyTaskStatus(status: string): string {
    return status === "running" ? "processing" : status;
  }

  private deriveDepartment(type: string, name: string): string {
    const normalizedType = String(type || "").toLowerCase();
    const normalizedName = String(name || "").toLowerCase();

    if (normalizedType === "director") {
      return "OFFICE";
    }
    if (normalizedType === "cabinet") {
      return "CABINET";
    }
    if (
      normalizedName.includes("monitor") ||
      normalizedName.includes("supervision") ||
      normalizedName.includes("audit") ||
      String(name).includes("监督")
    ) {
      return "MOS";
    }
    if (normalizedName.includes("foreign") || String(name).includes("外交")) {
      return "FOREIGN_AFFAIRS";
    }
    if (
      normalizedType === "ministry" ||
      normalizedName.includes("tech") ||
      normalizedName.includes("technology") ||
      String(name).includes("科技")
    ) {
      return "TECHNOLOGY";
    }
    return "OFFICE";
  }

  private deriveRole(type: string): string {
    switch (String(type || "").toLowerCase()) {
      case "director":
        return "director";
      case "cabinet":
        return "prime_minister";
      case "ministry":
        return "minister";
      case "specialist":
        return "specialist";
      default:
        return "worker";
    }
  }

  private priorityToScore(priority: string): number {
    switch (String(priority || "").toLowerCase()) {
      case "critical":
        return 4;
      case "high":
        return 3;
      case "low":
        return 1;
      default:
        return 2;
    }
  }

  private toCapabilityMap(capabilities: string[]): Record<string, string> {
    return capabilities.reduce<Record<string, string>>((acc, capability) => {
      acc[String(capability)] = "enabled";
      return acc;
    }, {});
  }

  private getActiveAuthorityTasks(agentId: string, excludeTaskId?: string) {
    const runtime = getAuthorityRuntime();
    return [...runtime.state.tasks.values()].filter(
      (task) =>
        task.assignedTo === agentId &&
        task.id !== excludeTaskId &&
        task.status !== "completed" &&
        task.status !== "failed" &&
        task.status !== "canceled" &&
        task.status !== "timeout",
    );
  }

  private isTerminalTaskStatus(status: string): boolean {
    return status === "completed" || status === "failed" || status === "timeout" || status === "canceled";
  }

  private toAuthorityTaskPayload(task: AuthorityTaskState, overrides: Record<string, unknown> = {}) {
    return {
      id: task.id,
      type: task.type,
      title: task.title,
      department: task.department,
      status: task.status,
      priority: task.priority,
      priorityScore: task.priorityScore,
      progress: task.progress,
      payload: task.payload,
      result: task.result,
      error: task.error,
      assignedTo: task.assignedTo,
      sourceRoom: task.sourceRoom,
      timeoutMs: task.timeoutMs,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      updatedAt: task.updatedAt,
      finishedAt: task.finishedAt,
      ...overrides,
    };
  }
}

export default AgentRoom;
