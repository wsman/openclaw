/**
 * @constitution
 * §101 同步公理: authority 复制实现与真理源文档保持同步
 * §102 熵减原则: 保持 authority 复制逻辑简洁可维护
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename AuthorityReplicationService.ts
 * @version 1.0.0
 * @category authority
 * @last_updated 2026-03-10
 */

import fs from "node:fs";
import path from "node:path";
import { AuthorityState } from "../../schema/AuthorityState";
import { authorityStateToPlain, hydrateAuthorityState } from "../../runtime/authorityStateSnapshot";
import { EventStore } from "./EventStore";
import { MutationPipeline } from "./MutationPipeline";
import {
  AuthorityEventRecord,
  AuthorityRecoveryStatus,
  AuthorityReplicationStatus,
  AuthorityReplicationStorageStats,
  MutationProposalInput,
  MutationResult,
} from "./types";

function createId(prefix: string): string {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function getPositiveNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function safeStat(filePath: string): fs.Stats | null {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

export interface AuthorityReplicationOptions {
  storageDir?: string;
  snapshotIntervalMs?: number;
  snapshotEventThreshold?: number;
  maxLogBytes?: number;
  maxArchiveFiles?: number;
}

export class AuthorityReplicationService {
  readonly storageDir: string;
  readonly logPath: string;
  readonly snapshotPath: string;
  readonly snapshotIntervalMs: number;
  readonly snapshotEventThreshold: number;
  readonly maxLogBytes: number;
  readonly maxArchiveFiles: number;

  private readonly subscriptionId: string;
  private maintenanceTimer: NodeJS.Timeout | null = null;
  private isCreatingSnapshot = false;
  private lastSnapshotEventCount = 0;
  private lastAutoSnapshotAt = 0;
  private lastRotatedAt = 0;
  private lastError = "";
  private lastRecovery: AuthorityRecoveryStatus;

  constructor(
    private readonly state: AuthorityState,
    private readonly eventStore: EventStore,
    private readonly mutationPipeline: MutationPipeline,
    options: AuthorityReplicationOptions = {},
  ) {
    this.storageDir =
      options.storageDir ||
      process.env.AUTHORITY_STORAGE_DIR ||
      path.resolve(process.cwd(), "storage", "authority");
    this.logPath = path.join(this.storageDir, "events.jsonl");
    this.snapshotPath = path.join(this.storageDir, "snapshot.json");
    this.snapshotIntervalMs = getPositiveNumber(
      options.snapshotIntervalMs ?? process.env.AUTHORITY_SNAPSHOT_INTERVAL_MS,
      30_000,
    );
    this.snapshotEventThreshold = getPositiveNumber(
      options.snapshotEventThreshold ?? process.env.AUTHORITY_SNAPSHOT_EVENT_THRESHOLD,
      25,
    );
    this.maxLogBytes = getPositiveNumber(options.maxLogBytes ?? process.env.AUTHORITY_LOG_ROTATE_BYTES, 512 * 1024);
    this.maxArchiveFiles = Math.max(
      1,
      Math.floor(getPositiveNumber(options.maxArchiveFiles ?? process.env.AUTHORITY_LOG_RETENTION, 5)),
    );

    fs.mkdirSync(this.storageDir, { recursive: true });
    if (!fs.existsSync(this.logPath)) {
      fs.writeFileSync(this.logPath, "", "utf8");
    }

    this.state.replication.logPath = this.logPath;
    this.state.replication.snapshotPath = this.snapshotPath;
    this.state.replication.status = "ready";
    this.lastRecovery = {
      attemptedAt: 0,
      recovered: false,
      mode: "startup",
      snapshotPath: this.snapshotPath,
      eventCount: 0,
      replayedLogCount: 0,
    };

    this.subscriptionId = this.eventStore.subscribe((event) => this.persistEvent(event));
    this.startMaintenanceLoop();
  }

  dispose(): void {
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = null;
    }
    this.eventStore.unsubscribe(this.subscriptionId);
  }

  maintain(): void {
    if (this.isCreatingSnapshot || this.eventStore.count() === 0) {
      return;
    }

    const dueAt = this.state.replication.lastSnapshotAt || this.state.createdAt;
    if (Date.now() - dueAt < this.snapshotIntervalMs) {
      return;
    }

    try {
      this.snapshot("auto_interval");
    } catch (error: any) {
      this.markError(error);
    }
  }

  persistEvent(event: AuthorityEventRecord): void {
    try {
      fs.appendFileSync(this.logPath, `${JSON.stringify(event)}\n`, "utf8");
      this.state.replication.lastReplicatedEventId = event.eventId;
      this.state.replication.status = "streaming";
      this.lastError = "";

      this.rotateLogIfNeeded();

      if (!this.isCreatingSnapshot && this.shouldAutoSnapshot()) {
        this.snapshot("auto_event_threshold");
      }
    } catch (error: any) {
      this.markError(error);
    }
  }

  snapshot(reason = "manual"): { snapshotPath: string; eventCount: number; createdAt: number; reason: string } {
    const createdAt = Date.now();
    const snapshotEventCount = this.eventStore.count();

    this.isCreatingSnapshot = true;
    try {
      const snapshot = {
        createdAt,
        reason,
        authority: authorityStateToPlain(this.state),
      };
      fs.writeFileSync(this.snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");

      this.state.replication.lastSnapshotAt = createdAt;
      this.state.replication.status = "snapshotted";

      this.eventStore.append({
        eventId: createId("event"),
        mutationId: createId("replication"),
        type: "replication.snapshot.created",
        timestamp: createdAt,
        payload: {
          snapshotPath: this.snapshotPath,
          eventCount: snapshotEventCount,
          reason,
        },
      });

      this.lastSnapshotEventCount = this.eventStore.count();
      if (reason.startsWith("auto_")) {
        this.lastAutoSnapshotAt = createdAt;
      }
      this.lastError = "";

      return {
        snapshotPath: this.snapshotPath,
        eventCount: this.eventStore.count(),
        createdAt,
        reason,
      };
    } catch (error: any) {
      this.markError(error);
      throw error;
    } finally {
      this.isCreatingSnapshot = false;
    }
  }

  recover(mode: "startup" | "manual" = "manual"): AuthorityRecoveryStatus {
    const attemptedAt = Date.now();
    const report: AuthorityRecoveryStatus = {
      attemptedAt,
      recovered: false,
      mode,
      snapshotPath: this.snapshotPath,
      eventCount: this.eventStore.count(),
      replayedLogCount: 0,
    };

    if (!fs.existsSync(this.snapshotPath)) {
      report.error = "snapshot missing";
      this.lastRecovery = report;
      this.state.replication.status = this.eventStore.count() > 0 ? "degraded" : "ready";
      return report;
    }

    try {
      this.state.replication.status = "recovering";
      const snapshot = JSON.parse(fs.readFileSync(this.snapshotPath, "utf8")) as { authority?: Record<string, unknown> };
      hydrateAuthorityState(this.state, snapshot.authority || {});

      const events = this.readEventLogs();
      this.eventStore.replace(events);
      this.state.audit.totalEvents = events.length;
      this.state.audit.eventCursor = events.at(-1)?.eventId || this.state.audit.eventCursor;
      this.state.replication.lastReplicatedEventId =
        events.at(-1)?.eventId || this.state.replication.lastReplicatedEventId;
      this.state.replication.lastRecoveredAt = attemptedAt;
      this.state.replication.status = "recovered";
      this.lastSnapshotEventCount = this.eventStore.count();

      this.eventStore.append({
        eventId: createId("event"),
        mutationId: createId("replication"),
        type: "replication.recovered",
        timestamp: attemptedAt,
        payload: {
          snapshotPath: this.snapshotPath,
          eventCount: this.eventStore.count(),
          mode,
        },
      });

      this.lastError = "";
      this.lastRecovery = {
        attemptedAt,
        recovered: true,
        mode,
        snapshotPath: this.snapshotPath,
        eventCount: this.eventStore.count(),
        replayedLogCount: events.length,
      };
      return this.lastRecovery;
    } catch (error: any) {
      this.markError(error);
      this.lastRecovery = {
        ...report,
        error: error?.message || "unknown recovery error",
      };
      return this.lastRecovery;
    }
  }

  routeProposal(input: MutationProposalInput): MutationResult {
    return this.mutationPipeline.propose({
      ...input,
      traceId: input.traceId || createId("route"),
    });
  }

  getRecoveryReport(): AuthorityRecoveryStatus {
    return { ...this.lastRecovery };
  }

  getStorageStats(): AuthorityReplicationStorageStats {
    const files = this.getStorageFiles();
    const snapshotBytes = files
      .filter((entry) => entry.kind === "snapshot")
      .reduce((total, entry) => total + entry.sizeBytes, 0);
    const activeLogBytes = files
      .filter((entry) => entry.kind === "active-log")
      .reduce((total, entry) => total + entry.sizeBytes, 0);
    const archiveLogBytes = files
      .filter((entry) => entry.kind === "archive-log")
      .reduce((total, entry) => total + entry.sizeBytes, 0);
    const archiveCount = files.filter((entry) => entry.kind === "archive-log").length;
    const warnings: string[] = [];

    if (!fs.existsSync(this.snapshotPath)) {
      warnings.push("snapshot_missing");
    }
    if (activeLogBytes >= this.maxLogBytes) {
      warnings.push("active_log_near_limit");
    }
    if (archiveCount >= this.maxArchiveFiles) {
      warnings.push("archive_retention_full");
    }
    if (this.lastError) {
      warnings.push("last_error_present");
    }

    return {
      storageDir: this.storageDir,
      snapshotBytes,
      activeLogBytes,
      archiveLogBytes,
      archiveCount,
      totalBytes: snapshotBytes + activeLogBytes + archiveLogBytes,
      maxLogBytes: this.maxLogBytes,
      maxArchiveFiles: this.maxArchiveFiles,
      healthy: warnings.length === 0,
      warnings,
      files,
    };
  }

  getStatus(): AuthorityReplicationStatus {
    return {
      status: this.state.replication.status,
      logPath: this.logPath,
      snapshotPath: this.snapshotPath,
      lastReplicatedEventId: this.state.replication.lastReplicatedEventId,
      lastSnapshotAt: this.state.replication.lastSnapshotAt,
      lastRecoveredAt: this.state.replication.lastRecoveredAt,
      eventCount: this.eventStore.count(),
      autoSnapshotIntervalMs: this.snapshotIntervalMs,
      autoSnapshotEventThreshold: this.snapshotEventThreshold,
      lastAutoSnapshotAt: this.lastAutoSnapshotAt,
      lastRotatedAt: this.lastRotatedAt,
      lastError: this.lastError,
      storage: this.getStorageStats(),
      recovery: this.getRecoveryReport(),
    };
  }

  private shouldAutoSnapshot(): boolean {
    if (this.snapshotEventThreshold <= 0) {
      return false;
    }
    return this.eventStore.count() - this.lastSnapshotEventCount >= this.snapshotEventThreshold;
  }

  private rotateLogIfNeeded(): void {
    const stat = safeStat(this.logPath);
    if (!stat || stat.size < this.maxLogBytes) {
      return;
    }

    const archivePath = path.join(this.storageDir, `events-${Date.now()}.jsonl`);
    fs.renameSync(this.logPath, archivePath);
    fs.writeFileSync(this.logPath, "", "utf8");
    this.lastRotatedAt = Date.now();
    this.pruneArchives();
  }

  private pruneArchives(): void {
    const archives = this.getArchivePaths();
    if (archives.length <= this.maxArchiveFiles) {
      return;
    }

    archives
      .slice(0, archives.length - this.maxArchiveFiles)
      .forEach((archivePath) => fs.rmSync(archivePath, { force: true }));
  }

  private readEventLogs(): AuthorityEventRecord[] {
    return this.getEventLogPaths()
      .flatMap((logPath) =>
        fs
          .readFileSync(logPath, "utf8")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => JSON.parse(line) as AuthorityEventRecord),
      );
  }

  private getEventLogPaths(): string[] {
    const archives = this.getArchivePaths();
    const files = [...archives];
    if (fs.existsSync(this.logPath)) {
      files.push(this.logPath);
    }
    return files;
  }

  private getArchivePaths(): string[] {
    if (!fs.existsSync(this.storageDir)) {
      return [];
    }

    return fs
      .readdirSync(this.storageDir)
      .filter((fileName) => /^events-\d+\.jsonl$/.test(fileName))
      .sort()
      .map((fileName) => path.join(this.storageDir, fileName));
  }

  private getStorageFiles(): AuthorityReplicationStorageStats["files"] {
    const files: AuthorityReplicationStorageStats["files"] = [];

    const snapshotStat = safeStat(this.snapshotPath);
    if (snapshotStat) {
      files.push({
        path: this.snapshotPath,
        sizeBytes: snapshotStat.size,
        updatedAt: snapshotStat.mtimeMs,
        kind: "snapshot",
      });
    }

    const activeLogStat = safeStat(this.logPath);
    if (activeLogStat) {
      files.push({
        path: this.logPath,
        sizeBytes: activeLogStat.size,
        updatedAt: activeLogStat.mtimeMs,
        kind: "active-log",
      });
    }

    this.getArchivePaths().forEach((archivePath) => {
      const archiveStat = safeStat(archivePath);
      if (!archiveStat) {
        return;
      }
      files.push({
        path: archivePath,
        sizeBytes: archiveStat.size,
        updatedAt: archiveStat.mtimeMs,
        kind: "archive-log",
      });
    });

    return files.sort((left, right) => left.updatedAt - right.updatedAt);
  }

  private markError(error: unknown): void {
    this.lastError = error instanceof Error ? error.message : String(error);
    this.state.replication.status = "degraded";
  }

  private startMaintenanceLoop(): void {
    const intervalMs = Math.max(1_000, Math.min(this.snapshotIntervalMs, 5_000));
    this.maintenanceTimer = setInterval(() => this.maintain(), intervalMs);
    this.maintenanceTimer.unref?.();
  }
}
