/**
 * 📋 TaskRoom - 任务管理房间
 *
 * @constitution
 * §101 同步公理：任务状态必须实时同步
 * §102 熵减原则：任务生命周期结构化，减少状态混乱
 * §110 协作效率公理：任务进度与结果必须可观测
 *
 * @filename TaskRoom.ts
 * @version 1.0.0
 * @category rooms
 * @last_updated 2026-02-27
 */

import { Room, Client } from "colyseus";
import { v4 as uuidv4 } from "uuid";
import { TaskItemState, TaskState } from "../schema/TaskState";
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
    logger.info(`[TaskRoom] 创建任务房间 ${this.roomId}...`);
    this.config = { ...DEFAULT_CONFIG, ...options?.config };

    this.setState(new TaskState());
    this.state.roomId = this.roomId;
    this.state.createdAt = Date.now();
    this.state.lastUpdate = Date.now();

    this.setupMessageHandlers();
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), this.config.tickInterval);
    logger.info("[TaskRoom] 任务房间创建完成");
  }

  private setupMessageHandlers() {
    this.onMessage("*", (client, type, message) => {
      const typeStr = String(type);
      switch (typeStr) {
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
          logger.debug(`[TaskRoom] 未处理的消息类型：${typeStr}`);
      }
    });
  }

  private handleGetTasks(client: Client, message: any) {
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
    const { type = "generic", title = "", payload = {}, priority = "normal", timeoutMs } = message || {};
    if (!title) {
      client.send("error", { code: "invalid_request", message: "title为必填项" });
      return;
    }

    if (this.state.tasks.size >= this.config.maxTasks) {
      client.send("error", { code: "task_limit_reached", message: "已达到最大任务数量" });
      return;
    }

    const now = Date.now();
    const task = new TaskItemState();
    task.id = `task:${uuidv4()}`;
    task.type = String(type);
    task.title = String(title);
    task.status = "pending";
    task.priority = String(priority);
    task.progress = 0;
    task.payload = JSON.stringify(payload ?? {});
    task.timeoutMs = Number(timeoutMs || this.config.defaultTimeoutMs);
    task.createdAt = now;
    task.updatedAt = now;

    this.state.tasks.set(task.id, task);
    this.updateSummary();

    client.send("task_created", {
      task: this.serializeTask(task),
      timestamp: now,
    });
    this.broadcast("task_changed", {
      action: "created",
      task: this.serializeTask(task),
      timestamp: now,
    }, { except: client });
  }

  private handleGetTask(client: Client, message: any) {
    const taskId = message?.taskId ? String(message.taskId) : "";
    const task = taskId ? this.state.tasks.get(taskId) : undefined;
    if (!task) {
      client.send("error", { code: "task_not_found", message: "找不到指定任务" });
      return;
    }

    client.send("task_detail", {
      task: this.serializeTask(task),
      timestamp: Date.now(),
    });
  }

  private handleCancelTask(client: Client, message: any) {
    const task = this.getTaskOrError(client, message?.taskId);
    if (!task) {
      return;
    }

    if (task.status === "completed" || task.status === "failed" || task.status === "canceled") {
      client.send("error", { code: "invalid_task_state", message: `任务状态为${task.status}，无法取消` });
      return;
    }

    task.status = "canceled";
    task.updatedAt = Date.now();
    task.finishedAt = Date.now();
    task.progress = task.progress >= 100 ? 100 : task.progress;
    this.updateSummary();

    client.send("task_canceled", { taskId: task.id, timestamp: Date.now() });
    this.broadcast("task_changed", {
      action: "canceled",
      task: this.serializeTask(task),
      timestamp: Date.now(),
    }, { except: client });
  }

  private handleUpdateTaskProgress(client: Client, message: any) {
    const task = this.getTaskOrError(client, message?.taskId);
    if (!task) {
      return;
    }

    if (task.status === "completed" || task.status === "failed" || task.status === "canceled") {
      client.send("error", { code: "invalid_task_state", message: `任务状态为${task.status}，无法更新进度` });
      return;
    }

    const nextProgress = Math.max(0, Math.min(100, Number(message?.progress ?? task.progress)));
    task.progress = nextProgress;
    task.updatedAt = Date.now();

    if (task.status === "pending") {
      task.status = "running";
      task.startedAt = Date.now();
    }

    if (message?.assignedTo) {
      task.assignedTo = String(message.assignedTo);
    }

    this.updateSummary();
    client.send("task_progress_updated", {
      taskId: task.id,
      progress: task.progress,
      status: task.status,
      timestamp: Date.now(),
    });
  }

  private handleCompleteTask(client: Client, message: any) {
    const task = this.getTaskOrError(client, message?.taskId);
    if (!task) {
      return;
    }

    task.status = "completed";
    task.progress = 100;
    task.result = JSON.stringify(message?.result ?? {});
    task.updatedAt = Date.now();
    task.finishedAt = Date.now();
    if (task.startedAt === 0) {
      task.startedAt = task.updatedAt;
    }
    this.updateSummary();

    client.send("task_completed", {
      taskId: task.id,
      timestamp: Date.now(),
    });
    this.broadcast("task_changed", {
      action: "completed",
      task: this.serializeTask(task),
      timestamp: Date.now(),
    }, { except: client });
  }

  private handleFailTask(client: Client, message: any) {
    const task = this.getTaskOrError(client, message?.taskId);
    if (!task) {
      return;
    }

    task.status = "failed";
    task.error = String(message?.error || "unknown error");
    task.updatedAt = Date.now();
    task.finishedAt = Date.now();
    if (task.startedAt === 0) {
      task.startedAt = task.updatedAt;
    }
    this.updateSummary();

    client.send("task_failed", {
      taskId: task.id,
      error: task.error,
      timestamp: Date.now(),
    });
  }

  private update(_deltaTime: number) {
    const now = Date.now();
    this.state.tasks.forEach((task) => {
      if (task.status !== "running" && task.status !== "pending") {
        return;
      }

      const start = task.startedAt || task.createdAt;
      if (task.timeoutMs > 0 && now - start > task.timeoutMs) {
        task.status = "timeout";
        task.error = "task timeout";
        task.updatedAt = now;
        task.finishedAt = now;
      }
    });
    this.updateSummary();
  }

  private getTaskOrError(client: Client, taskIdInput: any): TaskItemState | null {
    const taskId = taskIdInput ? String(taskIdInput) : "";
    if (!taskId) {
      client.send("error", { code: "invalid_request", message: "taskId为必填项" });
      return null;
    }
    const task = this.state.tasks.get(taskId);
    if (!task) {
      client.send("error", { code: "task_not_found", message: "找不到指定任务" });
      return null;
    }
    return task;
  }

  private updateSummary() {
    let pending = 0;
    let running = 0;
    let completed = 0;
    let failed = 0;
    let canceled = 0;

    this.state.tasks.forEach((task) => {
      switch (task.status) {
        case "pending":
          pending += 1;
          break;
        case "running":
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

    this.state.totalTasks = this.state.tasks.size;
    this.state.pendingTasks = pending;
    this.state.runningTasks = running;
    this.state.completedTasks = completed;
    this.state.failedTasks = failed;
    this.state.canceledTasks = canceled;
    this.state.lastUpdate = Date.now();
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

  onJoin(client: Client) {
    logger.info(`[TaskRoom] 客户端 ${client.sessionId} 加入任务房间`);
    client.send("task_snapshot", {
      tasks: this.serializeTasks(),
      summary: this.serializeSummary(),
      timestamp: Date.now(),
    });
  }

  onLeave(client: Client) {
    logger.info(`[TaskRoom] 客户端 ${client.sessionId} 离开任务房间`);
  }
}

export default TaskRoom;

