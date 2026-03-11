import { Room, Client } from "colyseus";
import { v4 as uuidv4 } from "uuid";
import { TaskItemState, TaskState } from "../schema/TaskState";
import { AuthorityTaskState } from "../schema/AuthorityState";
import { getAuthorityRuntime } from "../runtime/authorityRuntime";
import { MutationProposalInput } from "../services/authority/types";
import { logger } from "../utils/logger";

interface TaskRoomConfig {
  defaultTimeoutMs: number;
  maxTasks: number;
  tickInterval: number;
}

const DEFAULT_CONFIG: TaskRoomConfig = {
  defaultTimeoutMs: 60_000,
  maxTasks: 2000,
  tickInterval: 1000,
};

export class TaskRoom extends Room<TaskState> {
  private config!: TaskRoomConfig;

  onCreate(options: any) {
    logger.info(`[TaskRoom] Creating task room ${this.roomId}...`);
    this.config = { ...DEFAULT_CONFIG, ...(options?.config || {}) };

    this.setState(new TaskState());
    this.state.roomId = this.roomId;
    this.state.createdAt = Date.now();
    this.state.lastUpdate = Date.now();

    this.setupMessageHandlers();
    this.syncFromAuthority();
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), this.config.tickInterval);
    logger.info("[TaskRoom] Task room ready");
  }

  private setupMessageHandlers() {
    this.onMessage("*", (client, type, message) => {
      switch (String(type)) {
        case "get_tasks":
          this.handleGetTasks(client, message);
          break;
        case "create_task":
          this.handleCreateTask(client, message);
          break;
        case "get_task":
          this.handleGetTask(client, message);
          break;
        case "cancel_task":
          this.handleCancelTask(client, message);
          break;
        case "update_task_progress":
          this.handleUpdateTaskProgress(client, message);
          break;
        case "complete_task":
          this.handleCompleteTask(client, message);
          break;
        case "fail_task":
          this.handleFailTask(client, message);
          break;
        default:
          logger.debug(`[TaskRoom] Unhandled message type: ${String(type)}`);
      }
    });
  }

  private handleGetTasks(client: Client, message: any) {
    this.syncFromAuthority();
    const statusFilter = message?.status ? String(message.status) : "";
    const limit = Math.max(1, Math.min(500, Number(message?.limit || 100)));
    const tasks = this.serializeTasks()
      .filter((task) => (statusFilter ? task.status === statusFilter : true))
      .slice(-limit);

    client.send("tasks_list", {
      tasks,
      summary: this.serializeSummary(),
      timestamp: Date.now(),
    });
  }

  private handleCreateTask(client: Client, message: any) {
    const { type = "generic", title = "", payload = {}, priority = "normal", timeoutMs, assignedTo, department } = message || {};
    if (!title) {
      client.send("error", { code: "invalid_request", message: "title is required" });
      return;
    }

    const runtime = getAuthorityRuntime();
    if (runtime.state.tasks.size >= this.config.maxTasks) {
      client.send("error", { code: "task_limit_reached", message: "Task limit reached" });
      return;
    }

    const taskId = `task:${uuidv4()}`;
    const now = Date.now();
    const assignedAgent = assignedTo ? runtime.state.agents.get(String(assignedTo)) : undefined;
    const resolvedDepartment = String(department || assignedAgent?.department || "UNASSIGNED");
    const targetAgentId = assignedTo ? String(assignedTo) : "";

    try {
      this.commitAuthorityMutation({
        proposer: `session:${client.sessionId}`,
        targetPath: `tasks.${taskId}`,
        operation: "set",
        payload: {
          id: taskId,
          type: String(type),
          title: String(title),
          department: resolvedDepartment,
          status: "pending",
          priority: String(priority),
          priorityScore: this.priorityToScore(String(priority)),
          progress: 0,
          payload: JSON.stringify(payload ?? {}),
          assignedTo: targetAgentId,
          sourceRoom: this.roomId,
          timeoutMs: Number(timeoutMs || this.config.defaultTimeoutMs),
          createdAt: now,
          updatedAt: now,
        },
        reason: "task_room_create",
      });

      if (targetAgentId) {
        this.syncAgentStateForTask(taskId, targetAgentId, "pending", 0, `session:${client.sessionId}`, now);
      }

      this.syncFromAuthority();
      const task = this.state.tasks.get(taskId);

      client.send("task_created", {
        task: task ? this.serializeTask(task) : null,
        timestamp: now,
      });
      this.broadcast(
        "task_changed",
        {
          action: "created",
          task: task ? this.serializeTask(task) : { id: taskId },
          timestamp: now,
        },
        { except: client },
      );
    } catch (error: any) {
      client.send("error", { code: "task_create_failed", message: error.message });
    }
  }

  private handleGetTask(client: Client, message: any) {
    this.syncFromAuthority();
    const taskId = message?.taskId ? String(message.taskId) : "";
    const task = taskId ? this.state.tasks.get(taskId) : undefined;
    if (!task) {
      client.send("error", { code: "task_not_found", message: "Task not found" });
      return;
    }

    client.send("task_detail", {
      task: this.serializeTask(task),
      timestamp: Date.now(),
    });
  }

  private handleCancelTask(client: Client, message: any) {
    const task = this.getAuthorityTaskOrError(client, message?.taskId);
    if (!task) {
      return;
    }

    if (this.isTerminalTaskStatus(task.status)) {
      client.send("error", { code: "invalid_task_state", message: `Task already ${task.status}` });
      return;
    }

    const now = Date.now();

    try {
      this.commitAuthorityMutation({
        proposer: `session:${client.sessionId}`,
        targetPath: `tasks.${task.id}`,
        operation: "update",
        payload: this.toAuthorityTaskPayload(task, {
          status: "canceled",
          updatedAt: now,
          finishedAt: now,
        }),
        reason: "task_room_cancel",
      });

      if (task.assignedTo) {
        this.syncAgentStateForTask(task.id, task.assignedTo, "canceled", task.progress, `session:${client.sessionId}`, now);
      }

      this.syncFromAuthority();
      const updated = this.state.tasks.get(task.id);

      client.send("task_canceled", { taskId: task.id, timestamp: now });
      this.broadcast(
        "task_changed",
        {
          action: "canceled",
          task: updated ? this.serializeTask(updated) : { id: task.id },
          timestamp: now,
        },
        { except: client },
      );
    } catch (error: any) {
      client.send("error", { code: "task_cancel_failed", message: error.message });
    }
  }

  private handleUpdateTaskProgress(client: Client, message: any) {
    const task = this.getAuthorityTaskOrError(client, message?.taskId);
    if (!task) {
      return;
    }

    if (this.isTerminalTaskStatus(task.status)) {
      client.send("error", { code: "invalid_task_state", message: `Task already ${task.status}` });
      return;
    }

    const nextProgress = Math.max(0, Math.min(100, Number(message?.progress ?? task.progress)));
    const nextAssignedTo = message?.assignedTo ? String(message.assignedTo) : task.assignedTo;
    const runtime = getAuthorityRuntime();
    const nextDepartment = nextAssignedTo
      ? runtime.state.agents.get(nextAssignedTo)?.department || task.department
      : task.department;
    const nextStatus = task.status === "pending" ? "running" : task.status;
    const now = Date.now();

    try {
      this.commitAuthorityMutation({
        proposer: `session:${client.sessionId}`,
        targetPath: `tasks.${task.id}`,
        operation: "update",
        payload: this.toAuthorityTaskPayload(task, {
          status: nextStatus,
          progress: nextProgress,
          assignedTo: nextAssignedTo,
          department: nextDepartment,
          startedAt: task.startedAt || now,
          updatedAt: now,
        }),
        reason: "task_room_progress_update",
      });

      if (nextAssignedTo) {
        this.syncAgentStateForTask(task.id, nextAssignedTo, nextStatus, nextProgress, `session:${client.sessionId}`, now);
      }

      this.syncFromAuthority();

      client.send("task_progress_updated", {
        taskId: task.id,
        progress: nextProgress,
        status: nextStatus,
        timestamp: now,
      });
    } catch (error: any) {
      client.send("error", { code: "task_progress_failed", message: error.message });
    }
  }

  private handleCompleteTask(client: Client, message: any) {
    const task = this.getAuthorityTaskOrError(client, message?.taskId);
    if (!task) {
      return;
    }

    const now = Date.now();

    try {
      this.commitAuthorityMutation({
        proposer: `session:${client.sessionId}`,
        targetPath: `tasks.${task.id}`,
        operation: "update",
        payload: this.toAuthorityTaskPayload(task, {
          status: "completed",
          progress: 100,
          result: JSON.stringify(message?.result ?? {}),
          error: "",
          updatedAt: now,
          startedAt: task.startedAt || now,
          finishedAt: now,
        }),
        reason: "task_room_complete",
      });

      if (task.assignedTo) {
        this.syncAgentStateForTask(task.id, task.assignedTo, "completed", 100, `session:${client.sessionId}`, now);
      }

      this.syncFromAuthority();
      const updated = this.state.tasks.get(task.id);

      client.send("task_completed", {
        taskId: task.id,
        timestamp: now,
      });
      this.broadcast(
        "task_changed",
        {
          action: "completed",
          task: updated ? this.serializeTask(updated) : { id: task.id },
          timestamp: now,
        },
        { except: client },
      );
    } catch (error: any) {
      client.send("error", { code: "task_complete_failed", message: error.message });
    }
  }

  private handleFailTask(client: Client, message: any) {
    const task = this.getAuthorityTaskOrError(client, message?.taskId);
    if (!task) {
      return;
    }

    const now = Date.now();

    try {
      this.commitAuthorityMutation({
        proposer: `session:${client.sessionId}`,
        targetPath: `tasks.${task.id}`,
        operation: "update",
        payload: this.toAuthorityTaskPayload(task, {
          status: "failed",
          error: String(message?.error || "unknown error"),
          updatedAt: now,
          startedAt: task.startedAt || now,
          finishedAt: now,
        }),
        reason: "task_room_fail",
      });

      if (task.assignedTo) {
        this.syncAgentStateForTask(task.id, task.assignedTo, "failed", task.progress, `session:${client.sessionId}`, now);
      }

      this.syncFromAuthority();

      client.send("task_failed", {
        taskId: task.id,
        error: String(message?.error || "unknown error"),
        timestamp: now,
      });
    } catch (error: any) {
      client.send("error", { code: "task_fail_failed", message: error.message });
    }
  }

  private update(_deltaTime: number) {
    const runtime = getAuthorityRuntime();
    const now = Date.now();
    const timedOutTasks = [...runtime.state.tasks.values()].filter((task) => {
      if (task.status !== "running" && task.status !== "pending" && task.status !== "processing") {
        return false;
      }

      const start = task.startedAt || task.createdAt;
      return task.timeoutMs > 0 && now - start > task.timeoutMs;
    });

    timedOutTasks.forEach((task) => {
      this.commitAuthorityMutation({
        proposer: "system",
        targetPath: `tasks.${task.id}`,
        operation: "update",
        payload: this.toAuthorityTaskPayload(task, {
          status: "timeout",
          error: "task timeout",
          updatedAt: now,
          finishedAt: now,
        }),
        reason: "task_room_timeout",
        riskLevel: "medium",
      });

      if (task.assignedTo) {
        this.syncAgentStateForTask(task.id, task.assignedTo, "timeout", task.progress, "system", now);
      }
    });

    this.syncFromAuthority();
  }

  private syncFromAuthority() {
    const runtime = getAuthorityRuntime();
    runtime.projectionService.syncTaskBoard(this.state);
    this.state.lastUpdate = Date.now();
  }

  private commitAuthorityMutation(proposal: MutationProposalInput) {
    const result = getAuthorityRuntime().mutationPipeline.propose(proposal);
    if (!result.ok) {
      throw new Error(result.error || "authority mutation rejected");
    }
    return result;
  }

  private getAuthorityTaskOrError(client: Client, taskIdInput: any): AuthorityTaskState | null {
    const taskId = taskIdInput ? String(taskIdInput) : "";
    if (!taskId) {
      client.send("error", { code: "invalid_request", message: "taskId is required" });
      return null;
    }

    const task = getAuthorityRuntime().state.tasks.get(taskId);
    if (!task) {
      client.send("error", { code: "task_not_found", message: "Task not found" });
      return null;
    }

    return task;
  }

  private syncAgentStateForTask(
    taskId: string,
    agentId: string,
    taskStatus: string,
    progress: number,
    proposer: string,
    now: number,
  ) {
    const runtime = getAuthorityRuntime();
    const agent = runtime.state.agents.get(agentId);
    if (!agent) {
      return;
    }

    if (taskStatus === "running" || taskStatus === "processing") {
      const activeCount = [...runtime.state.tasks.values()].filter(
        (task) =>
          task.assignedTo === agentId &&
          task.status !== "completed" &&
          task.status !== "failed" &&
          task.status !== "canceled" &&
          task.status !== "timeout",
      ).length;

      this.commitAuthorityMutation({
        proposer,
        targetPath: `agents.${agentId}.status`,
        operation: "update",
        payload: "processing",
        reason: "task_room_agent_sync",
      });
      this.commitAuthorityMutation({
        proposer,
        targetPath: `agents.${agentId}.currentTaskId`,
        operation: "update",
        payload: taskId,
        reason: "task_room_agent_sync",
      });
      this.commitAuthorityMutation({
        proposer,
        targetPath: `agents.${agentId}.taskProgress`,
        operation: "update",
        payload: progress,
        reason: "task_room_agent_sync",
      });
      this.commitAuthorityMutation({
        proposer,
        targetPath: `agents.${agentId}.currentLoad`,
        operation: "update",
        payload: Math.min(1, Math.max(1, activeCount) / 10),
        reason: "task_room_agent_sync",
      });
    } else {
      const remainingTasks = [...runtime.state.tasks.values()].filter(
        (task) =>
          task.assignedTo === agentId &&
          task.id !== taskId &&
          task.status !== "completed" &&
          task.status !== "failed" &&
          task.status !== "canceled" &&
          task.status !== "timeout",
      ).length;

      this.commitAuthorityMutation({
        proposer,
        targetPath: `agents.${agentId}.status`,
        operation: "update",
        payload: remainingTasks > 0 ? "ready" : "idle",
        reason: "task_room_agent_sync",
      });
      this.commitAuthorityMutation({
        proposer,
        targetPath: `agents.${agentId}.currentTaskId`,
        operation: "update",
        payload: "",
        reason: "task_room_agent_sync",
      });
      this.commitAuthorityMutation({
        proposer,
        targetPath: `agents.${agentId}.taskProgress`,
        operation: "update",
        payload: this.isTerminalTaskStatus(taskStatus) ? 0 : progress,
        reason: "task_room_agent_sync",
      });
      this.commitAuthorityMutation({
        proposer,
        targetPath: `agents.${agentId}.currentLoad`,
        operation: "update",
        payload: Math.min(1, remainingTasks / 10),
        reason: "task_room_agent_sync",
      });
    }

    this.commitAuthorityMutation({
      proposer,
      targetPath: `agents.${agentId}.lastHeartbeat`,
      operation: "update",
      payload: now,
      reason: "task_room_agent_sync",
    });
  }

  private isTerminalTaskStatus(status: string) {
    return status === "completed" || status === "failed" || status === "canceled" || status === "timeout";
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

  private serializeTasks() {
    const tasks: Array<Record<string, unknown>> = [];
    this.state.tasks.forEach((task) => tasks.push(this.serializeTask(task)));
    return tasks;
  }

  private serializeTask(task: TaskItemState) {
    return {
      id: task.id,
      type: task.type,
      title: task.title,
      status: task.status,
      priority: task.priority,
      progress: task.progress,
      payload: task.payload,
      result: task.result,
      error: task.error,
      assignedTo: task.assignedTo,
      timeoutMs: task.timeoutMs,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      updatedAt: task.updatedAt,
      finishedAt: task.finishedAt,
    };
  }

  private serializeSummary() {
    return {
      totalTasks: this.state.totalTasks,
      pendingTasks: this.state.pendingTasks,
      runningTasks: this.state.runningTasks,
      completedTasks: this.state.completedTasks,
      failedTasks: this.state.failedTasks,
      canceledTasks: this.state.canceledTasks,
    };
  }
}

export default TaskRoom;
