/**
 * ⏰ CronRoom - 定时任务管理房间
 *
 * @constitution
 * §101 同步公理：代码变更必须触发文档更新
 * §102 熵减原则：定时任务状态集中管理，降低排障复杂度
 * §321-§324 实时通信公理：任务状态通过WebSocket实时同步
 *
 * @filename CronRoom.ts
 * @version 1.0.0
 * @category rooms
 * @last_updated 2026-02-27
 */

import { Room, Client } from "colyseus";
import { v4 as uuidv4 } from "uuid";
import { CronExecutionRecord, CronJobState, CronState } from "../schema/CronState";
import { logger } from "../utils/logger";

interface CronRoomConfig {
  maxJobs: number;
  maxHistory: number;
  tickInterval: number;
}

const DEFAULT_CONFIG: CronRoomConfig = {
  maxJobs: 500,
  maxHistory: 500,
  tickInterval: 1000,
};

export class CronRoom extends Room<CronState> {
  private config!: CronRoomConfig;

  onCreate(options: any) {
    logger.info(`[CronRoom] 创建Cron房间 ${this.roomId}...`);
    this.config = { ...DEFAULT_CONFIG, ...options?.config };

    this.setState(new CronState());
    this.state.roomId = this.roomId;
    this.state.createdAt = Date.now();
    this.state.lastUpdate = Date.now();

    this.setupMessageHandlers();
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), this.config.tickInterval);

    logger.info("[CronRoom] Cron房间创建完成");
  }

  private setupMessageHandlers() {
    this.onMessage("*", (client, type, message) => {
      const typeStr = String(type);

      switch (typeStr) {
        case "get_cron_jobs":
          this.handleGetCronJobs(client);
          break;
        case "add_cron_job":
          this.handleAddCronJob(client, message);
          break;
        case "remove_cron_job":
          this.handleRemoveCronJob(client, message);
          break;
        case "toggle_cron_job":
          this.handleToggleCronJob(client, message);
          break;
        case "get_cron_history":
          this.handleGetCronHistory(client, message);
          break;
        default:
          logger.debug(`[CronRoom] 未处理的消息类型：${typeStr}`);
      }
    });
  }

  private handleGetCronJobs(client: Client) {
    client.send("cron_jobs", {
      jobs: this.serializeJobs(),
      summary: {
        totalJobs: this.state.totalJobs,
        enabledJobs: this.state.enabledJobs,
        totalRuns: this.state.totalRuns,
        totalFailures: this.state.totalFailures,
      },
      timestamp: Date.now(),
    });
  }

  private handleAddCronJob(client: Client, message: any) {
    const { name, schedule, enabled = true, metadata = {} } = message || {};
    if (!name || !schedule) {
      client.send("error", { code: "invalid_request", message: "name和schedule为必填项" });
      return;
    }

    if (this.state.jobs.size >= this.config.maxJobs) {
      client.send("error", { code: "job_limit_reached", message: "已达到最大Cron任务数量" });
      return;
    }

    const now = Date.now();
    const job = new CronJobState();
    job.id = `cron:${uuidv4()}`;
    job.name = String(name);
    job.schedule = String(schedule);
    job.enabled = Boolean(enabled);
    job.createdAt = now;
    job.updatedAt = now;
    job.nextRunAt = this.computeNextRunAt(job.schedule, now);
    Object.entries(metadata).forEach(([k, v]) => {
      job.metadata.set(String(k), String(v));
    });

    this.state.jobs.set(job.id, job);
    this.state.totalJobs = this.state.jobs.size;
    this.state.enabledJobs = this.getEnabledJobCount();
    this.state.lastUpdate = now;

    client.send("cron_job_added", {
      job: this.serializeJob(job),
      timestamp: now,
    });

    this.broadcast("cron_job_changed", {
      action: "added",
      job: this.serializeJob(job),
      timestamp: now,
    }, { except: client });
  }

  private handleRemoveCronJob(client: Client, message: any) {
    const jobId = message?.cronId || message?.jobId;
    if (!jobId || !this.state.jobs.has(jobId)) {
      client.send("error", { code: "job_not_found", message: "找不到指定Cron任务" });
      return;
    }

    this.state.jobs.delete(jobId);
    this.state.totalJobs = this.state.jobs.size;
    this.state.enabledJobs = this.getEnabledJobCount();
    this.state.lastUpdate = Date.now();

    client.send("cron_job_removed", { jobId, timestamp: Date.now() });
    this.broadcast("cron_job_changed", { action: "removed", jobId, timestamp: Date.now() }, { except: client });
  }

  private handleToggleCronJob(client: Client, message: any) {
    const jobId = message?.cronId || message?.jobId;
    const enabled = Boolean(message?.enabled);
    const job = jobId ? this.state.jobs.get(jobId) : undefined;
    if (!job) {
      client.send("error", { code: "job_not_found", message: "找不到指定Cron任务" });
      return;
    }

    job.enabled = enabled;
    job.updatedAt = Date.now();
    job.nextRunAt = enabled ? this.computeNextRunAt(job.schedule, Date.now()) : 0;
    this.state.enabledJobs = this.getEnabledJobCount();
    this.state.lastUpdate = Date.now();

    client.send("cron_job_toggled", {
      jobId,
      enabled,
      nextRunAt: job.nextRunAt,
      timestamp: Date.now(),
    });
  }

  private handleGetCronHistory(client: Client, message: any) {
    const jobId = message?.cronId || message?.jobId;
    const limit = Math.max(1, Math.min(500, Number(message?.limit || 50)));

    const all = this.state.history
      .filter((record) => (jobId ? record.jobId === jobId : true))
      .slice(-limit);

    client.send("cron_history", {
      records: all.map((record) => ({
        id: record.id,
        jobId: record.jobId,
        jobName: record.jobName,
        status: record.status,
        message: record.message,
        durationMs: record.durationMs,
        executedAt: record.executedAt,
      })),
      total: all.length,
      timestamp: Date.now(),
    });
  }

  private update(_deltaTime: number) {
    const now = Date.now();
    this.state.jobs.forEach((job) => {
      if (!job.enabled || job.nextRunAt <= 0) {
        return;
      }

      if (job.nextRunAt <= now) {
        this.executeJob(job);
      }
    });
  }

  private executeJob(job: CronJobState) {
    const started = Date.now();
    job.status = "running";
    job.updatedAt = started;

    try {
      // 当前为最小闭环实现：先完成调度与执行记录，后续可接入真实执行器
      job.runCount += 1;
      job.successCount += 1;
      job.status = "success";
      job.lastRunAt = started;
      job.lastError = "";
      job.nextRunAt = this.computeNextRunAt(job.schedule, started);
      job.updatedAt = Date.now();

      this.state.totalRuns += 1;
      this.state.lastUpdate = Date.now();

      this.pushHistory(job, "success", "执行成功", Date.now() - started);
      this.broadcast("cron_job_executed", {
        jobId: job.id,
        status: "success",
        nextRunAt: job.nextRunAt,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      job.runCount += 1;
      job.failureCount += 1;
      job.status = "failed";
      job.lastRunAt = started;
      job.lastError = error?.message || "unknown error";
      job.nextRunAt = this.computeNextRunAt(job.schedule, started);
      job.updatedAt = Date.now();

      this.state.totalRuns += 1;
      this.state.totalFailures += 1;
      this.state.lastUpdate = Date.now();

      this.pushHistory(job, "failed", job.lastError, Date.now() - started);
      this.broadcast("cron_job_executed", {
        jobId: job.id,
        status: "failed",
        error: job.lastError,
        nextRunAt: job.nextRunAt,
        timestamp: Date.now(),
      });
    }
  }

  private pushHistory(job: CronJobState, status: "success" | "failed", message: string, durationMs: number) {
    const record = new CronExecutionRecord();
    record.id = `cron-exec:${uuidv4()}`;
    record.jobId = job.id;
    record.jobName = job.name;
    record.status = status;
    record.message = message;
    record.durationMs = durationMs;
    record.executedAt = Date.now();
    this.state.history.push(record);

    if (this.state.history.length > this.config.maxHistory) {
      this.state.history.shift();
    }
  }

  private computeNextRunAt(schedule: string, from: number): number {
    const parsed = /^(\d+)\s*(s|m|h)?$/i.exec(schedule.trim());
    if (!parsed) {
      return from + 60_000;
    }

    const amount = Number(parsed[1]);
    const unit = (parsed[2] || "s").toLowerCase();
    if (!Number.isFinite(amount) || amount <= 0) {
      return from + 60_000;
    }

    switch (unit) {
      case "h":
        return from + amount * 3_600_000;
      case "m":
        return from + amount * 60_000;
      case "s":
      default:
        return from + amount * 1_000;
    }
  }

  private getEnabledJobCount(): number {
    let count = 0;
    this.state.jobs.forEach((job) => {
      if (job.enabled) {
        count += 1;
      }
    });
    return count;
  }

  private serializeJobs() {
    const jobs: Array<Record<string, unknown>> = [];
    this.state.jobs.forEach((job) => jobs.push(this.serializeJob(job)));
    return jobs;
  }

  private serializeJob(job: CronJobState) {
    return {
      id: job.id,
      name: job.name,
      schedule: job.schedule,
      enabled: job.enabled,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      lastRunAt: job.lastRunAt,
      nextRunAt: job.nextRunAt,
      runCount: job.runCount,
      successCount: job.successCount,
      failureCount: job.failureCount,
      lastError: job.lastError,
    };
  }

  onJoin(client: Client) {
    logger.info(`[CronRoom] 客户端 ${client.sessionId} 加入Cron房间`);
    client.send("cron_snapshot", {
      jobs: this.serializeJobs(),
      summary: {
        totalJobs: this.state.totalJobs,
        enabledJobs: this.state.enabledJobs,
        totalRuns: this.state.totalRuns,
        totalFailures: this.state.totalFailures,
      },
      timestamp: Date.now(),
    });
  }

  onLeave(client: Client) {
    logger.info(`[CronRoom] 客户端 ${client.sessionId} 离开Cron房间`);
  }
}

export default CronRoom;

