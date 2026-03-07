/**
 * ⏰ CronState - Cron房间状态 Schema
 *
 * @constitution
 * §101 同步公理：代码变更必须触发文档更新
 * §102 熵减原则：所有变更必须降低或维持系统熵值
 * §321-§324 实时通信公理：WebSocket状态同步
 *
 * @filename CronState.ts
 * @version 1.0.0
 * @category schema
 * @last_updated 2026-02-27
 */

import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

/**
 * Cron任务状态
 */
export class CronJobState extends Schema {
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("string") schedule: string = "";
  @type("boolean") enabled: boolean = true;
  @type("string") status: string = "idle"; // idle | running | success | failed
  @type("number") createdAt: number = 0;
  @type("number") updatedAt: number = 0;
  @type("number") lastRunAt: number = 0;
  @type("number") nextRunAt: number = 0;
  @type("number") runCount: number = 0;
  @type("number") successCount: number = 0;
  @type("number") failureCount: number = 0;
  @type("string") lastError: string = "";
  @type({ map: "string" }) metadata = new MapSchema<string>();
}

/**
 * Cron执行记录
 */
export class CronExecutionRecord extends Schema {
  @type("string") id: string = "";
  @type("string") jobId: string = "";
  @type("string") jobName: string = "";
  @type("string") status: string = "success"; // success | failed
  @type("string") message: string = "";
  @type("number") durationMs: number = 0;
  @type("number") executedAt: number = 0;
}

/**
 * Cron主状态
 */
export class CronState extends Schema {
  @type("string") roomId: string = "";
  @type("number") createdAt: number = 0;
  @type("number") lastUpdate: number = 0;
  @type({ map: CronJobState }) jobs = new MapSchema<CronJobState>();
  @type({ array: CronExecutionRecord }) history = new ArraySchema<CronExecutionRecord>();
  @type("number") totalJobs: number = 0;
  @type("number") enabledJobs: number = 0;
  @type("number") totalRuns: number = 0;
  @type("number") totalFailures: number = 0;
}

