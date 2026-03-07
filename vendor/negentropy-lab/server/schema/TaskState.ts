/**
 * 📋 TaskState - 任务房间状态 Schema
 *
 * @constitution
 * §101 同步公理：任务状态必须实时同步
 * §102 熵减原则：任务流程必须可追踪并减少信息熵
 * §110 协作效率公理：任务反馈必须及时
 *
 * @filename TaskState.ts
 * @version 1.0.0
 * @category schema
 * @last_updated 2026-02-27
 */

import { MapSchema, Schema, type } from "@colyseus/schema";

/**
 * 单个任务状态
 */
export class TaskItemState extends Schema {
  @type("string") id: string = "";
  @type("string") type: string = "generic";
  @type("string") title: string = "";
  @type("string") status: string = "pending"; // pending | running | completed | failed | canceled | timeout
  @type("string") priority: string = "normal"; // low | normal | high | critical
  @type("number") progress: number = 0;
  @type("string") payload: string = "";
  @type("string") result: string = "";
  @type("string") error: string = "";
  @type("string") assignedTo: string = "";
  @type("number") timeoutMs: number = 60000;
  @type("number") createdAt: number = 0;
  @type("number") startedAt: number = 0;
  @type("number") updatedAt: number = 0;
  @type("number") finishedAt: number = 0;
  @type({ map: "string" }) metadata = new MapSchema<string>();
}

/**
 * 任务房间主状态
 */
export class TaskState extends Schema {
  @type("string") roomId: string = "";
  @type("number") createdAt: number = 0;
  @type("number") lastUpdate: number = 0;
  @type({ map: TaskItemState }) tasks = new MapSchema<TaskItemState>();
  @type("number") totalTasks: number = 0;
  @type("number") pendingTasks: number = 0;
  @type("number") runningTasks: number = 0;
  @type("number") completedTasks: number = 0;
  @type("number") failedTasks: number = 0;
  @type("number") canceledTasks: number = 0;
}

