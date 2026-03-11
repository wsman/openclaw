/**
 * @constitution
 * §101 同步公理: authority MCP 传输实现与真理源文档保持同步
 * §102 熵减原则: 保持 authority 传输逻辑简洁可维护
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename AuthorityMcpTransportService.ts
 * @version 1.0.0
 * @category authority
 * @last_updated 2026-03-10
 */

import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { AuthorityState } from "../../schema/AuthorityState";
import { AuthorityToolCallBridge } from "./AuthorityToolCallBridge";
import { EventStore } from "./EventStore";
import {
  AuthorityEventType,
  AuthorityMcpDiscoveryResult,
  AuthorityMcpFailbackPolicy,
  AuthorityMcpMaintenanceWindow,
  AuthorityMcpOrchestrationPolicy,
  AuthorityMcpServiceConfig,
  AuthorityMcpServiceSnapshot,
  AuthorityMcpSloPolicy,
  AuthorityMcpTrafficPolicy,
  AuthorityMcpToolDescriptor,
  ToolCatalogEntry,
  ToolRegistrationInput,
} from "./types";

type McpOperation = "discover" | "health" | "call";

interface McpCommandResponse {
  ok: boolean;
  healthy?: boolean;
  toolCount?: number;
  loadedModules?: string[];
  moduleErrors?: Record<string, string>;
  tools?: AuthorityMcpToolDescriptor[];
  result?: unknown;
  toolName?: string;
  error?: string;
}

interface ServiceRuntimeRecord {
  config: AuthorityMcpServiceConfig;
  snapshot: AuthorityMcpServiceSnapshot;
  tools: Set<string>;
  recoveryBlockedUntil: number;
  activeMaintenanceWindowId: string;
  maintenancePreviousEnabled: boolean | null;
  maintenancePreviousMode: AuthorityMcpServiceConfig["operationalMode"] | null;
}

interface MaintenanceConflictResolution {
  mode: "scheduled" | "merge" | "defer" | "replace";
  window: AuthorityMcpMaintenanceWindow;
  conflicts: string[];
}

export interface McpCommandRunner {
  run(
    service: AuthorityMcpServiceConfig,
    operation: McpOperation,
    payload?: Record<string, unknown>,
  ): Promise<McpCommandResponse>;
}

export interface AuthorityMcpTransportServiceOptions {
  configPath?: string;
  runner?: McpCommandRunner;
  requestTimeoutMs?: number;
  enableHealthPolling?: boolean;
  healthPollingIntervalMs?: number;
  recoverySuccessThreshold?: number;
  maintenanceIntervalMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_PRIORITY = 0;
const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_RECOVERY_INTERVAL_MS = 60_000;
const DEFAULT_HEALTH_POLL_INTERVAL_MS = 30_000;
const DEFAULT_RECOVERY_SUCCESS_THRESHOLD = 2;
const DEFAULT_MAINTENANCE_INTERVAL_MS = 1_000;
const DEFAULT_SLO_TARGET_LATENCY_MS = 750;
const DEFAULT_SLO_MIN_SUCCESS_RATE = 0.9;
const DEFAULT_SLO_MAX_FAILURE_RATE = 0.1;
const DEFAULT_SLO_ROUTE_BIAS = 1;
const DEFAULT_TRAFFIC_ALLOCATION_PERCENT = 100;
const DEFAULT_TRAFFIC_CANARY_PERCENT = 5;
const DEFAULT_TRAFFIC_RAMP_STEP_PERCENT = 10;
const DEFAULT_TRAFFIC_RAMP_INTERVAL_MS = 60_000;
const DEFAULT_FAILBACK_MAX_RECOVERY_ATTEMPTS = 3;
const DEFAULT_FAILBACK_LOCKOUT_MS = 15 * 60_000;
const DEFAULT_FAILBACK_MIN_HEALTHY_DURATION_MS = 60_000;
const DEFAULT_MODULES = ["resources"];
const DEFAULT_LOCAL_SERVICE_ID = "local-mcp-core";
const SERVICE_METADATA_PREFIX = "__mcp_service__:";

function createId(prefix: string): string {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0))];
}

function asStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  return unique(value.map((entry) => String(entry)));
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function snapshotSort(a: AuthorityMcpServiceSnapshot, b: AuthorityMcpServiceSnapshot): number {
  return a.serviceId.localeCompare(b.serviceId);
}

function toSnapshotEndpoint(service: AuthorityMcpServiceConfig): string {
  if (service.transport === "http") {
    return String(service.endpoint || "");
  }
  const command = service.command || "";
  const args = service.args || [];
  return [command, ...args].join(" ").trim();
}

function joinUrl(base: string, operation: McpOperation): string {
  return `${base.replace(/\/+$/, "")}/${operation}`;
}

function sanitizeToolDescriptor(raw: AuthorityMcpToolDescriptor): AuthorityMcpToolDescriptor {
  return {
    toolName: String(raw.toolName || ""),
    description: String(raw.description || raw.toolName || ""),
    module: String(raw.module || "unknown"),
    inputSchema: asRecord(raw.inputSchema),
    outputSchema: asRecord(raw.outputSchema),
    tags: asStringArray(raw.tags),
    metadata: asRecord(raw.metadata),
  };
}

function normalizeTimestamp(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) >>> 0;
  }
  return hash >>> 0;
}

export class SubprocessMcpCommandRunner implements McpCommandRunner {
  constructor(private readonly timeoutMs = DEFAULT_TIMEOUT_MS) {}

  run(service: AuthorityMcpServiceConfig, operation: McpOperation, payload: Record<string, unknown> = {}): Promise<McpCommandResponse> {
    if (!service.command) {
      return Promise.reject(new Error(`mcp subprocess service missing command: ${service.serviceId}`));
    }

    return new Promise<McpCommandResponse>((resolve, reject) => {
      const child = spawn(service.command as string, [...(service.args || []), operation], {
        cwd: process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1",
        },
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const finalizeReject = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        reject(error);
      };

      const finalizeResolve = (result: McpCommandResponse) => {
        if (settled) {
          return;
        }
        settled = true;
        resolve(result);
      };

      const timer = setTimeout(() => {
        child.kill();
        finalizeReject(new Error(`mcp bridge timeout after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      child.stdout.on("data", (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk) => {
        stderr += chunk.toString();
      });

      child.on("error", (error) => {
        clearTimeout(timer);
        finalizeReject(error instanceof Error ? error : new Error(String(error)));
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        const trimmedStdout = stdout.trim();
        const trimmedStderr = stderr.trim();

        if (!trimmedStdout) {
          if (code && code !== 0) {
            finalizeReject(new Error(trimmedStderr || `mcp bridge exited with code ${code}`));
            return;
          }
          finalizeReject(new Error("empty mcp bridge response"));
          return;
        }

        let parsed: McpCommandResponse;
        try {
          parsed = JSON.parse(trimmedStdout) as McpCommandResponse;
        } catch {
          finalizeReject(new Error("invalid mcp bridge json"));
          return;
        }

        if (code && code !== 0) {
          finalizeReject(new Error(parsed.error || trimmedStderr || `mcp bridge exited with code ${code}`));
          return;
        }

        if (parsed.ok === false) {
          finalizeReject(new Error(parsed.error || "mcp bridge returned error"));
          return;
        }

        finalizeResolve(parsed);
      });

      try {
        child.stdin.write(JSON.stringify(payload));
        child.stdin.end();
      } catch (error) {
        clearTimeout(timer);
        child.kill();
        finalizeReject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }
}

export class HttpMcpCommandRunner implements McpCommandRunner {
  constructor(private readonly timeoutMs = DEFAULT_TIMEOUT_MS) {}

  async run(
    service: AuthorityMcpServiceConfig,
    operation: McpOperation,
    payload: Record<string, unknown> = {},
  ): Promise<McpCommandResponse> {
    if (!service.endpoint) {
      throw new Error(`mcp http service missing endpoint: ${service.serviceId}`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };

    if (service.auth?.type === "bearer" && service.auth.token) {
      headers.authorization = `Bearer ${service.auth.token}`;
    } else if (service.auth?.type === "api-key" && service.auth.token) {
      headers[service.auth.headerName || "x-api-key"] = service.auth.token;
    }

    try {
      const response = await fetch(joinUrl(service.endpoint, operation), {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const raw = await response.text();
      let parsed: McpCommandResponse;
      try {
        parsed = JSON.parse(raw) as McpCommandResponse;
      } catch {
        throw new Error("invalid mcp bridge json");
      }

      if (!response.ok || parsed.ok === false) {
        throw new Error(parsed.error || `mcp http bridge returned ${response.status}`);
      }

      return parsed;
    } catch (error: any) {
      if (error?.name === "AbortError") {
        throw new Error(`mcp http bridge timeout after ${this.timeoutMs}ms`);
      }
      throw error instanceof Error ? error : new Error(String(error));
    } finally {
      clearTimeout(timer);
    }
  }
}

export class AuthorityMcpTransportService {
  private readonly configPath: string;
  private readonly runnerOverride?: McpCommandRunner;
  private readonly subprocessRunner: SubprocessMcpCommandRunner;
  private readonly httpRunner: HttpMcpCommandRunner;
  private readonly services = new Map<string, ServiceRuntimeRecord>();
  private readonly healthPollingEnabled: boolean;
  private readonly healthPollingIntervalMs: number;
  private readonly recoverySuccessThreshold: number;
  private readonly maintenanceIntervalMs: number;
  private pollTimer: NodeJS.Timeout | null = null;
  private maintenanceTimer: NodeJS.Timeout | null = null;
  private pollInFlight = false;
  private lastPollAt = 0;
  private lastPollCompletedAt = 0;
  private maintenanceInFlight = false;
  private lastMaintenanceRunAt = 0;
  private lastMaintenanceCompletedAt = 0;

  constructor(
    private readonly state: AuthorityState,
    private readonly eventStore: EventStore,
    private readonly toolCallBridge: AuthorityToolCallBridge,
    options: AuthorityMcpTransportServiceOptions = {},
  ) {
    this.configPath = options.configPath || path.resolve(process.cwd(), "storage", "config", "authority-mcp-services.json");
    this.runnerOverride = options.runner;
    this.subprocessRunner = new SubprocessMcpCommandRunner(options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS);
    this.httpRunner = new HttpMcpCommandRunner(options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS);
    this.healthPollingEnabled = options.enableHealthPolling !== false;
    this.healthPollingIntervalMs = Math.max(1_000, options.healthPollingIntervalMs ?? DEFAULT_HEALTH_POLL_INTERVAL_MS);
    this.recoverySuccessThreshold = Math.max(1, options.recoverySuccessThreshold ?? DEFAULT_RECOVERY_SUCCESS_THRESHOLD);
    this.maintenanceIntervalMs = Math.max(100, options.maintenanceIntervalMs ?? DEFAULT_MAINTENANCE_INTERVAL_MS);

    this.loadConfiguredServices().forEach((service) => {
      this.services.set(service.serviceId, {
        config: service,
        snapshot: this.buildSnapshot(service),
        tools: new Set<string>(),
        recoveryBlockedUntil: 0,
        activeMaintenanceWindowId: "",
        maintenancePreviousEnabled: null,
        maintenancePreviousMode: null,
      });
      this.refreshDerivedState(service.serviceId);
      this.persistServiceSnapshot(service.serviceId);
    });

    if (this.healthPollingEnabled) {
      this.startHealthPolling();
    }
    this.startMaintenanceScheduler();
  }

  listServices(): AuthorityMcpServiceSnapshot[] {
    [...this.services.keys()].forEach((serviceId) => this.refreshDerivedState(serviceId));
    return [...this.services.values()]
      .map((entry) => ({ ...entry.snapshot }))
      .sort(snapshotSort);
  }

  getPollingStatus(): {
    active: boolean;
    intervalMs: number;
    inFlight: boolean;
    lastPollAt: number;
    lastPollCompletedAt: number;
  } {
    return {
      active: Boolean(this.pollTimer),
      intervalMs: this.healthPollingIntervalMs,
      inFlight: this.pollInFlight,
      lastPollAt: this.lastPollAt,
      lastPollCompletedAt: this.lastPollCompletedAt,
    };
  }

  getMaintenanceStatus(): {
    active: boolean;
    intervalMs: number;
    inFlight: boolean;
    lastRunAt: number;
    lastCompletedAt: number;
  } {
    return {
      active: Boolean(this.maintenanceTimer),
      intervalMs: this.maintenanceIntervalMs,
      inFlight: this.maintenanceInFlight,
      lastRunAt: this.lastMaintenanceRunAt,
      lastCompletedAt: this.lastMaintenanceCompletedAt,
    };
  }

  async scheduleMaintenanceWindow(
    serviceId: string,
    window: AuthorityMcpMaintenanceWindow,
  ): Promise<AuthorityMcpServiceSnapshot> {
    const record = this.getServiceRecord(serviceId);
    const normalizedWindow = this.normalizeMaintenanceWindow(window);
    const windows = (record.config.maintenanceWindows || []).filter((entry) => entry.windowId !== normalizedWindow.windowId);
    const resolution = this.resolveMaintenanceWindowConflicts(windows, normalizedWindow);
    record.config.maintenanceWindows = [...resolution.windows].sort((left, right) => left.startAt - right.startAt);
    this.refreshDerivedState(serviceId);
    await this.persistConfig();
    this.persistServiceSnapshot(serviceId);
    if (resolution.result.conflicts.length > 0) {
      this.audit("mcp.service.window.conflict.resolved", {
        serviceId,
        windowId: resolution.result.window.windowId,
        mode: resolution.result.mode,
        conflicts: resolution.result.conflicts,
        startAt: resolution.result.window.startAt,
        endAt: resolution.result.window.endAt,
      });
    }
    this.audit("mcp.service.window.scheduled", {
      serviceId,
      windowId: resolution.result.window.windowId,
      action: resolution.result.window.action,
      startAt: resolution.result.window.startAt,
      endAt: resolution.result.window.endAt,
      recurrence: resolution.result.window.recurrence || "none",
      autoRecover: resolution.result.window.autoRecover !== false,
      priority: resolution.result.window.priority ?? 0,
      conflictPolicy: resolution.result.window.conflictPolicy || "merge",
    });
    return { ...record.snapshot };
  }

  async removeMaintenanceWindow(serviceId: string, windowId: string): Promise<AuthorityMcpServiceSnapshot> {
    const record = this.getServiceRecord(serviceId);
    record.config.maintenanceWindows = (record.config.maintenanceWindows || []).filter((entry) => entry.windowId !== windowId);
    if (record.activeMaintenanceWindowId === windowId) {
      await this.releaseMaintenanceWindow(record, `window_removed:${windowId}`, true);
    }
    this.refreshDerivedState(serviceId);
    await this.persistConfig();
    this.persistServiceSnapshot(serviceId);
    this.audit("mcp.service.window.removed", {
      serviceId,
      windowId,
    });
    return { ...record.snapshot };
  }

  async updateServicePolicy(
    serviceId: string,
    policy: {
      slo?: AuthorityMcpSloPolicy;
      traffic?: AuthorityMcpTrafficPolicy;
      failback?: AuthorityMcpFailbackPolicy;
      orchestration?: AuthorityMcpOrchestrationPolicy;
    },
  ): Promise<AuthorityMcpServiceSnapshot> {
    const record = this.getServiceRecord(serviceId);
    if (policy.slo) {
      record.config.slo = this.normalizeSloPolicy(policy.slo);
    }
    if (policy.traffic) {
      record.config.traffic = this.normalizeTrafficPolicy(policy.traffic);
    }
    if (policy.failback) {
      record.config.failback = this.normalizeFailbackPolicy(policy.failback);
    }
    if (policy.orchestration) {
      record.config.orchestration = this.normalizeOrchestrationPolicy(policy.orchestration);
      this.audit("mcp.service.orchestration.updated", {
        serviceId,
        orchestration: record.config.orchestration,
      });
    }
    this.refreshDerivedState(serviceId);
    await this.persistConfig();
    this.persistServiceSnapshot(serviceId);
    this.audit("mcp.service.policy.updated", {
      serviceId,
      slo: record.config.slo || {},
      traffic: record.config.traffic || {},
      failback: record.config.failback || {},
      orchestration: record.config.orchestration || {},
    });
    return { ...record.snapshot };
  }

  async triggerHealthPoll(serviceId?: string): Promise<AuthorityMcpServiceSnapshot[]> {
    if (serviceId) {
      return this.checkHealth(serviceId, { strict: false, source: "polling" });
    }
    return this.runHealthSweep({ source: "polling", strict: false });
  }

  async controlService(
    serviceId: string,
    action: "enable" | "disable" | "pause" | "resume" | "isolate" | "activate",
    reason?: string,
  ): Promise<AuthorityMcpServiceSnapshot> {
    const record = this.getServiceRecord(serviceId);
    const previousMode = record.config.operationalMode ?? "active";
    const previousEnabled = record.config.enabled;
    const previousStatus = record.snapshot.healthStatus;

    if (action === "enable") {
      record.config.enabled = true;
    } else if (action === "disable") {
      record.config.enabled = false;
    } else if (action === "pause") {
      record.config.operationalMode = "paused";
    } else if (action === "isolate") {
      record.config.operationalMode = "isolated";
    } else {
      record.config.operationalMode = "active";
    }

    if (action === "enable" && !record.config.operationalMode) {
      record.config.operationalMode = "active";
    }

    record.snapshot.enabled = record.config.enabled;
    record.snapshot.operationalMode = record.config.operationalMode ?? "active";
    let nextStatus = record.snapshot.healthStatus;
    if (action === "disable") {
      record.snapshot.healthy = false;
      record.snapshot.successStreak = 0;
      record.snapshot.lastError = reason || "service disabled";
      nextStatus = "unhealthy";
    } else if (action === "enable" && !previousEnabled) {
      record.snapshot.healthy = false;
      record.snapshot.lastError = "";
      nextStatus = "degraded";
    }
    this.transitionHealthState(
      record,
      previousStatus,
      nextStatus,
      reason || `service_control:${action}`,
    );

    this.refreshDerivedState(serviceId);
    await this.persistConfig();
    this.persistServiceSnapshot(serviceId);
    this.audit("mcp.service.controlled", {
      serviceId,
      action,
      reason: reason || "",
      previousEnabled,
      nextEnabled: record.config.enabled,
      previousMode,
      nextMode: record.config.operationalMode ?? "active",
    });

    return { ...record.snapshot };
  }

  dispose(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.maintenanceTimer) {
      clearInterval(this.maintenanceTimer);
      this.maintenanceTimer = null;
    }
  }

  async registerService(rawConfig: AuthorityMcpServiceConfig): Promise<AuthorityMcpServiceSnapshot> {
    const config = this.normalizeServiceConfig(rawConfig);
    const existing = this.services.get(config.serviceId);
    const snapshot = existing?.snapshot || this.buildSnapshot(config);
    const tools = existing?.tools || new Set<string>();

    this.services.set(config.serviceId, {
      config,
      snapshot: {
        ...snapshot,
        provider: config.provider,
        transport: config.transport,
        source: config.source,
        endpoint: toSnapshotEndpoint(config),
        enabled: config.enabled,
        operationalMode: config.operationalMode ?? "active",
        priority: config.priority ?? DEFAULT_PRIORITY,
      },
      tools,
      recoveryBlockedUntil: existing?.recoveryBlockedUntil || 0,
      activeMaintenanceWindowId: existing?.activeMaintenanceWindowId || "",
      maintenancePreviousEnabled: existing?.maintenancePreviousEnabled ?? null,
      maintenancePreviousMode: existing?.maintenancePreviousMode ?? null,
    });

    this.refreshDerivedState(config.serviceId);
    await this.persistConfig();
    this.persistServiceSnapshot(config.serviceId);
    this.audit("mcp.service.registered", {
      serviceId: config.serviceId,
      provider: config.provider,
      transport: config.transport,
      endpoint: config.endpoint || "",
      source: config.source,
    });

    return { ...this.getServiceRecord(config.serviceId).snapshot };
  }

  async discoverAndSync(serviceId?: string): Promise<AuthorityMcpDiscoveryResult> {
    const services = this.getConfiguredServices(serviceId).filter((service) => service.enabled);
    if (services.length === 0) {
      if (serviceId) {
        throw new Error(`mcp service not configured: ${serviceId}`);
      }
      return {
        services: [],
        tools: [],
        syncedTools: [],
        timestamp: Date.now(),
      };
    }

    const discoveredTools: AuthorityMcpToolDescriptor[] = [];
    const syncedTools = new Set<string>();
    const snapshots: AuthorityMcpServiceSnapshot[] = [];

    for (const service of services) {
      try {
        const startedAt = Date.now();
        const response = await this.getRunner(service).run(service, "discover", {
          modules: service.modules,
          serviceId: service.serviceId,
          provider: service.provider,
        });
        const latency = Date.now() - startedAt;
        const normalizedTools = (response.tools || []).map((tool) => sanitizeToolDescriptor(tool));
        this.updateServiceHealth(service.serviceId, response, latency);

        normalizedTools.forEach((tool) => {
          if (!tool.toolName) {
            return;
          }
          this.syncToolRegistration(service, tool);
          discoveredTools.push(tool);
          syncedTools.add(tool.toolName);
          this.getServiceRecord(service.serviceId).tools.add(tool.toolName);
          this.audit("mcp.tool.synced", {
            serviceId: service.serviceId,
            toolName: tool.toolName,
            provider: service.provider,
            transport: service.transport,
          });
        });

        this.persistServiceSnapshot(service.serviceId);
        snapshots.push({ ...this.getServiceRecord(service.serviceId).snapshot });
        this.audit("mcp.service.discovered", {
          serviceId: service.serviceId,
          provider: service.provider,
          toolCount: normalizedTools.length,
          healthy: Boolean(response.healthy),
        });
      } catch (error: any) {
        this.recordServiceFailure(service.serviceId, error);
        if (serviceId || services.length === 1) {
          throw error;
        }
        snapshots.push({ ...this.getServiceRecord(service.serviceId).snapshot });
      }
    }

    return {
      services: snapshots.sort(snapshotSort),
      tools: discoveredTools,
      syncedTools: [...syncedTools],
      timestamp: Date.now(),
    };
  }

  async checkHealth(
    serviceId?: string,
    options: { strict?: boolean; source?: "manual" | "polling" } = {},
  ): Promise<AuthorityMcpServiceSnapshot[]> {
    return this.runHealthSweep({
      serviceId,
      strict: options.strict ?? true,
      source: options.source ?? "manual",
    });
  }

  private async runHealthSweep(options: {
    serviceId?: string;
    strict: boolean;
    source: "manual" | "polling";
  }): Promise<AuthorityMcpServiceSnapshot[]> {
    const { serviceId, strict, source } = options;
    const services = this.getConfiguredServices(serviceId);
    if (services.length === 0) {
      throw new Error(`mcp service not configured: ${serviceId || "all"}`);
    }

    const snapshots: AuthorityMcpServiceSnapshot[] = [];
    for (const service of services) {
      try {
        const startedAt = Date.now();
        const response = await this.getRunner(service).run(service, "health", {
          modules: service.modules,
          serviceId: service.serviceId,
        });
        this.updateServiceHealth(service.serviceId, response, Date.now() - startedAt);
        this.audit(source === "polling" ? "mcp.service.polled" : "mcp.service.health.checked", {
          serviceId: service.serviceId,
          healthy: Boolean(response.healthy),
          toolCount: Number(response.toolCount || 0),
          source,
        });
      } catch (error: any) {
        this.recordServiceFailure(service.serviceId, error);
        if (strict && (serviceId || services.length === 1)) {
          throw error;
        }
      }
      snapshots.push({ ...this.getServiceRecord(service.serviceId).snapshot });
    }

    return snapshots.sort(snapshotSort);
  }

  async invokeTool(serviceId: string, toolName: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const service = this.getServiceConfig(serviceId);
    const record = service ? this.getServiceRecord(serviceId) : null;
    if (!service || !record || !this.effectiveEnabled(record) || this.effectiveOperationalMode(record) !== "active") {
      throw new Error(`mcp service not configured: ${serviceId}`);
    }
    if (record.snapshot.recoveryLockoutUntil > Date.now()) {
      throw new Error(`mcp service recovery locked: ${serviceId}`);
    }
    record.snapshot.requestCount += 1;
    record.snapshot.lastUsedAt = Date.now();
    this.refreshDerivedState(serviceId);
    this.persistServiceSnapshot(serviceId);

    try {
      const startedAt = Date.now();
      const response = await this.getRunner(service).run(service, "call", {
        modules: service.modules,
        serviceId: service.serviceId,
        toolName,
        args: asRecord(args),
      });
      record.recoveryBlockedUntil = 0;
      record.snapshot.successCount += 1;
      this.updateServiceHealth(serviceId, response, Date.now() - startedAt);
      this.persistServiceSnapshot(serviceId);

      return {
        serviceId,
        toolName,
        provider: service.provider,
        transport: service.transport,
        endpoint: record.snapshot.endpoint,
        result: response.result,
      };
    } catch (error: any) {
      this.recordServiceFailure(serviceId, error);
      throw error;
    }
  }

  async invokeToolWithFailover(toolName: string, args: unknown): Promise<Record<string, unknown>> {
    const definition = this.toolCallBridge.getToolDefinition(toolName);
    if (!definition) {
      throw new Error(`tool not registered: ${toolName}`);
    }

    const normalizedArgs = asRecord(args);
    const candidates = this.resolveCandidates(definition, normalizedArgs);
    if (candidates.length === 0) {
      throw new Error(`mcp tool has no configured backends: ${toolName}`);
    }

    const attemptedServices: string[] = [];
    const failures: string[] = [];

    for (const candidate of candidates) {
      attemptedServices.push(candidate.config.serviceId);
      try {
        const result = await this.invokeTool(candidate.config.serviceId, toolName, normalizedArgs);
        if (attemptedServices.length > 1) {
          this.audit("mcp.service.failover", {
            toolName,
            selectedServiceId: candidate.config.serviceId,
            attemptedServices,
            failedServices: failures,
          });
        }
        return {
          ...result,
          attemptedServices,
        };
      } catch {
        failures.push(candidate.config.serviceId);
      }
    }

    throw new Error(`mcp tool invocation failed across all services: ${toolName}`);
  }

  private getConfiguredServices(serviceId?: string): AuthorityMcpServiceConfig[] {
    if (serviceId) {
      const config = this.getServiceConfig(serviceId);
      return config ? [config] : [];
    }
    return [...this.services.values()].map((entry) => entry.config);
  }

  private getServiceConfig(serviceId: string): AuthorityMcpServiceConfig | null {
    return this.services.get(serviceId)?.config || null;
  }

  private getServiceRecord(serviceId: string): ServiceRuntimeRecord {
    const record = this.services.get(serviceId);
    if (!record) {
      throw new Error(`mcp service not configured: ${serviceId}`);
    }
    return record;
  }

  private loadConfiguredServices(): AuthorityMcpServiceConfig[] {
    const services: AuthorityMcpServiceConfig[] = [];
    if (fs.existsSync(this.configPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(this.configPath, "utf-8")) as { services?: AuthorityMcpServiceConfig[] };
        (raw.services || []).forEach((service) => services.push(this.normalizeServiceConfig(service)));
      } catch {
        return [];
      }
    }

    const builtin = this.getBuiltinLocalService();
    if (builtin && !services.some((service) => service.serviceId === builtin.serviceId)) {
      services.unshift(builtin);
    }

    return services;
  }

  private getBuiltinLocalService(): AuthorityMcpServiceConfig | null {
    const bridgePath = path.resolve(process.cwd(), "scripts", "authority_mcp_bridge.py");
    const engineRoot = path.resolve(process.cwd(), "engine", "mcp_core");
    if (!fs.existsSync(bridgePath) || !fs.existsSync(engineRoot)) {
      return null;
    }

    return this.normalizeServiceConfig({
      serviceId: DEFAULT_LOCAL_SERVICE_ID,
      provider: "negentropy",
      transport: "stdio-subprocess",
      command: "python",
      args: ["scripts/authority_mcp_bridge.py"],
      enabled: true,
      source: "engine/mcp_core",
      modules: DEFAULT_MODULES,
      defaultAllowedDepartments: ["OFFICE", "TECHNOLOGY", "MOS", "CABINET", "FOREIGN_AFFAIRS"],
      defaultRequiredCapabilities: ["observe:*"],
      tags: ["mcp", "local", "authority-transport", "read-only"],
    });
  }

  private normalizeServiceConfig(raw: AuthorityMcpServiceConfig): AuthorityMcpServiceConfig {
    const transport = raw.transport || (raw.endpoint ? "http" : "stdio-subprocess");
    const normalized: AuthorityMcpServiceConfig = {
      serviceId: String(raw.serviceId || "").trim(),
      provider: String(raw.provider || "mcp"),
      transport,
      command: raw.command ? String(raw.command) : undefined,
      args: raw.args ? raw.args.map((arg) => String(arg)) : undefined,
      endpoint: raw.endpoint ? String(raw.endpoint) : undefined,
      auth: raw.auth
        ? {
            type: raw.auth.type || "none",
            token: raw.auth.token ? String(raw.auth.token) : undefined,
            headerName: raw.auth.headerName ? String(raw.auth.headerName) : undefined,
          }
        : undefined,
      enabled: raw.enabled !== false,
      source: String(raw.source || "manual"),
      modules: asStringArray(raw.modules, DEFAULT_MODULES),
      operationalMode:
        raw.operationalMode === "paused" || raw.operationalMode === "isolated" ? raw.operationalMode : "active",
      priority: Number.isFinite(Number(raw.priority)) ? Number(raw.priority) : DEFAULT_PRIORITY,
      failureThreshold: Number.isFinite(Number(raw.failureThreshold))
        ? Math.max(1, Number(raw.failureThreshold))
        : DEFAULT_FAILURE_THRESHOLD,
      recoveryIntervalMs: Number.isFinite(Number(raw.recoveryIntervalMs))
        ? Math.max(1_000, Number(raw.recoveryIntervalMs))
        : DEFAULT_RECOVERY_INTERVAL_MS,
      pollingIntervalMs: Number.isFinite(Number(raw.pollingIntervalMs))
        ? Math.max(1_000, Number(raw.pollingIntervalMs))
        : this.healthPollingIntervalMs,
      recoverySuccessThreshold: Number.isFinite(Number(raw.recoverySuccessThreshold))
        ? Math.max(1, Number(raw.recoverySuccessThreshold))
        : this.recoverySuccessThreshold,
      maintenanceWindows: Array.isArray(raw.maintenanceWindows)
        ? raw.maintenanceWindows.map((window) => this.normalizeMaintenanceWindow(window))
        : [],
      slo: this.normalizeSloPolicy(raw.slo),
      traffic: this.normalizeTrafficPolicy(raw.traffic),
      failback: this.normalizeFailbackPolicy(raw.failback),
      orchestration: this.normalizeOrchestrationPolicy(raw.orchestration),
      defaultAllowedDepartments: asStringArray(raw.defaultAllowedDepartments, ["*"]),
      defaultRequiredCapabilities: asStringArray(raw.defaultRequiredCapabilities),
      tags: asStringArray(raw.tags, ["mcp"]),
      toolPolicies: raw.toolPolicies || {},
    };

    if (!normalized.serviceId) {
      throw new Error("mcp serviceId is required");
    }
    if (normalized.transport === "stdio-subprocess" && !normalized.command) {
      throw new Error(`mcp subprocess service requires command: ${normalized.serviceId}`);
    }
    if (normalized.transport === "http" && !normalized.endpoint) {
      throw new Error(`mcp http service requires endpoint: ${normalized.serviceId}`);
    }

    return normalized;
  }

  private normalizeMaintenanceWindow(raw: AuthorityMcpMaintenanceWindow): AuthorityMcpMaintenanceWindow {
    const startAt = normalizeTimestamp(raw.startAt);
    const endAt = normalizeTimestamp(raw.endAt);
    if (!startAt || !endAt || endAt <= startAt) {
      throw new Error(`invalid maintenance window: ${raw.windowId || "unknown"}`);
    }
    return {
      windowId: String(raw.windowId || createId("window")),
      startAt,
      endAt,
      recurrence:
        raw.recurrence === "daily" || raw.recurrence === "weekly" || raw.recurrence === "monthly"
          ? raw.recurrence
          : "none",
      action: raw.action === "disable" || raw.action === "isolate" ? raw.action : "pause",
      autoRecover: raw.autoRecover !== false,
      reason: typeof raw.reason === "string" ? raw.reason : "",
      enabled: raw.enabled !== false,
      priority: Number.isFinite(Number(raw.priority)) ? Number(raw.priority) : 0,
      conflictPolicy:
        raw.conflictPolicy === "defer" ||
        raw.conflictPolicy === "replace" ||
        raw.conflictPolicy === "reject"
          ? raw.conflictPolicy
          : "merge",
    };
  }

  private normalizeSloPolicy(raw?: AuthorityMcpSloPolicy): AuthorityMcpSloPolicy {
    return {
      targetLatencyMs: Number.isFinite(Number(raw?.targetLatencyMs))
        ? Math.max(1, Number(raw?.targetLatencyMs))
        : DEFAULT_SLO_TARGET_LATENCY_MS,
      minSuccessRate: Number.isFinite(Number(raw?.minSuccessRate))
        ? clamp(Number(raw?.minSuccessRate), 0, 1)
        : DEFAULT_SLO_MIN_SUCCESS_RATE,
      maxFailureRate: Number.isFinite(Number(raw?.maxFailureRate))
        ? clamp(Number(raw?.maxFailureRate), 0, 1)
        : DEFAULT_SLO_MAX_FAILURE_RATE,
      routeBias: Number.isFinite(Number(raw?.routeBias))
        ? clamp(Number(raw?.routeBias), 0.1, 10)
        : DEFAULT_SLO_ROUTE_BIAS,
    };
  }

  private normalizeTrafficPolicy(raw?: AuthorityMcpTrafficPolicy): AuthorityMcpTrafficPolicy {
    const allocationPercent = Number.isFinite(Number(raw?.allocationPercent))
      ? clamp(Number(raw?.allocationPercent), 1, 100)
      : DEFAULT_TRAFFIC_ALLOCATION_PERCENT;
    const canaryPercent = Number.isFinite(Number(raw?.canaryPercent))
      ? clamp(Number(raw?.canaryPercent), 1, allocationPercent)
      : Math.min(DEFAULT_TRAFFIC_CANARY_PERCENT, allocationPercent);
    return {
      allocationPercent,
      canaryPercent,
      rampStepPercent: Number.isFinite(Number(raw?.rampStepPercent))
        ? clamp(Number(raw?.rampStepPercent), 1, 100)
        : DEFAULT_TRAFFIC_RAMP_STEP_PERCENT,
      rampIntervalMs: Number.isFinite(Number(raw?.rampIntervalMs))
        ? Math.max(1_000, Number(raw?.rampIntervalMs))
        : DEFAULT_TRAFFIC_RAMP_INTERVAL_MS,
      lane:
        raw?.lane === "canary" || raw?.lane === "background"
          ? raw.lane
          : "primary",
    };
  }

  private normalizeFailbackPolicy(raw?: AuthorityMcpFailbackPolicy): AuthorityMcpFailbackPolicy {
    return {
      maxRecoveryAttempts: Number.isFinite(Number(raw?.maxRecoveryAttempts))
        ? Math.max(1, Number(raw?.maxRecoveryAttempts))
        : DEFAULT_FAILBACK_MAX_RECOVERY_ATTEMPTS,
      recoveryLockoutMs: Number.isFinite(Number(raw?.recoveryLockoutMs))
        ? Math.max(1_000, Number(raw?.recoveryLockoutMs))
        : DEFAULT_FAILBACK_LOCKOUT_MS,
      minHealthyDurationMs: Number.isFinite(Number(raw?.minHealthyDurationMs))
        ? Math.max(1_000, Number(raw?.minHealthyDurationMs))
        : DEFAULT_FAILBACK_MIN_HEALTHY_DURATION_MS,
    };
  }

  private normalizeOrchestrationPolicy(raw?: AuthorityMcpOrchestrationPolicy): AuthorityMcpOrchestrationPolicy {
    return {
      serviceGroup: raw?.serviceGroup ? String(raw.serviceGroup).trim() : "",
      templateId: raw?.templateId ? String(raw.templateId).trim() : "",
      preferredNodes: asStringArray(raw?.preferredNodes),
      excludedNodes: asStringArray(raw?.excludedNodes),
      regions: asStringArray(raw?.regions),
      tags: asStringArray(raw?.tags),
    };
  }

  private effectiveEnabled(record: ServiceRuntimeRecord): boolean {
    return record.snapshot.enabled;
  }

  private effectiveOperationalMode(record: ServiceRuntimeRecord): AuthorityMcpServiceSnapshot["operationalMode"] {
    return record.snapshot.operationalMode;
  }

  private computeEffectiveTrafficPercent(record: ServiceRuntimeRecord, now = Date.now()): number {
    if (!this.effectiveEnabled(record) || this.effectiveOperationalMode(record) !== "active") {
      return 0;
    }
    if (record.snapshot.recoveryLockoutUntil > now) {
      return 0;
    }
    const traffic = this.normalizeTrafficPolicy(record.config.traffic);
    const allocationPercent = traffic.allocationPercent ?? DEFAULT_TRAFFIC_ALLOCATION_PERCENT;
    const canaryPercent = Math.min(allocationPercent, traffic.canaryPercent ?? DEFAULT_TRAFFIC_CANARY_PERCENT);
    if (record.snapshot.healthStatus === "unhealthy") {
      return 0;
    }
    if (record.snapshot.healthStatus === "recovering") {
      return canaryPercent;
    }
    if (!record.snapshot.healthy) {
      return Math.min(canaryPercent, allocationPercent);
    }
    if (!record.snapshot.lastRecoveryAttemptAt || record.snapshot.stableSince <= 0) {
      return allocationPercent;
    }
    const stableDuration = Math.max(0, now - record.snapshot.stableSince);
    const rampIntervalMs = traffic.rampIntervalMs ?? DEFAULT_TRAFFIC_RAMP_INTERVAL_MS;
    const rampStepPercent = traffic.rampStepPercent ?? DEFAULT_TRAFFIC_RAMP_STEP_PERCENT;
    const rampSteps = Math.floor(stableDuration / rampIntervalMs);
    return clamp(canaryPercent + rampSteps * rampStepPercent, canaryPercent, allocationPercent);
  }

  private refreshDerivedState(serviceId: string): void {
    const record = this.getServiceRecord(serviceId);
    const now = Date.now();
    const totalCalls = record.snapshot.successCount + record.snapshot.failureCount;
    const successRate = totalCalls > 0 ? record.snapshot.successCount / totalCalls : 1;
    const failureRate = totalCalls > 0 ? record.snapshot.failureCount / totalCalls : 0;
    const slo = this.normalizeSloPolicy(record.config.slo);
    const traffic = this.normalizeTrafficPolicy(record.config.traffic);
    const orchestration = this.normalizeOrchestrationPolicy(record.config.orchestration);
    const targetLatencyMs = slo.targetLatencyMs || DEFAULT_SLO_TARGET_LATENCY_MS;
    const lastLatencyMs = record.snapshot.lastLatencyMs > 0 ? record.snapshot.lastLatencyMs : targetLatencyMs;
    const latencyRatio = lastLatencyMs / targetLatencyMs;
    const violated =
      (record.snapshot.lastLatencyMs > 0 && lastLatencyMs > targetLatencyMs) ||
      successRate < (slo.minSuccessRate ?? DEFAULT_SLO_MIN_SUCCESS_RATE) ||
      failureRate > (slo.maxFailureRate ?? DEFAULT_SLO_MAX_FAILURE_RATE);
    const atRisk =
      !violated &&
      ((record.snapshot.lastLatencyMs > 0 && latencyRatio >= 0.85) ||
        successRate < Math.min(1, (slo.minSuccessRate ?? DEFAULT_SLO_MIN_SUCCESS_RATE) + 0.05) ||
        failureRate >= Math.max(0, (slo.maxFailureRate ?? DEFAULT_SLO_MAX_FAILURE_RATE) * 0.75));

    record.snapshot.successRate = Number(successRate.toFixed(4));
    record.snapshot.failureRate = Number(failureRate.toFixed(4));
    record.snapshot.sloStatus = violated ? "violated" : atRisk ? "at-risk" : "healthy";
    record.snapshot.maintenanceWindowCount = (record.config.maintenanceWindows || []).length;
    record.snapshot.maintenanceConflictCount = this.countMaintenanceConflicts(record.config.maintenanceWindows || []);
    record.snapshot.servicesInMaintenance = Boolean(record.activeMaintenanceWindowId);
    record.snapshot.activeMaintenanceWindowId = record.activeMaintenanceWindowId;
    record.snapshot.activeMaintenanceAction = record.activeMaintenanceWindowId
      ? ((record.config.maintenanceWindows || []).find((window) => window.windowId === record.activeMaintenanceWindowId)?.action || "")
      : "";
    record.snapshot.lastMaintenanceRunAt = this.lastMaintenanceCompletedAt || this.lastMaintenanceRunAt;
    record.snapshot.recoveryBlockedUntil = record.recoveryBlockedUntil;
    record.snapshot.configuredTrafficPercent = traffic.allocationPercent ?? DEFAULT_TRAFFIC_ALLOCATION_PERCENT;
    record.snapshot.effectiveTrafficPercent = this.computeEffectiveTrafficPercent(record, now);
    record.snapshot.trafficLane = traffic.lane ?? "primary";
    record.snapshot.orchestrationGroup = orchestration.serviceGroup || "";
    record.snapshot.orchestrationTemplate = orchestration.templateId || "";
    record.snapshot.preferredNodes = orchestration.preferredNodes || [];
    record.snapshot.excludedNodes = orchestration.excludedNodes || [];
    record.snapshot.orchestrationRegions = orchestration.regions || [];
    record.snapshot.orchestrationTags = orchestration.tags || [];
    record.snapshot.routeScore = Number(this.computeRouteScore(record).toFixed(4));
  }

  private computeRouteScore(record: ServiceRuntimeRecord): number {
    if (!this.effectiveEnabled(record) || this.effectiveOperationalMode(record) !== "active") {
      return 0;
    }
    const now = Date.now();
    if (record.snapshot.recoveryLockoutUntil > now) {
      return 0;
    }
    const slo = this.normalizeSloPolicy(record.config.slo);
    const healthWeight = Math.max(0, 3 - this.healthRank(record.snapshot.healthStatus)) / 3;
    const latencyBase = slo.targetLatencyMs || DEFAULT_SLO_TARGET_LATENCY_MS;
    const observedLatency = record.snapshot.lastLatencyMs > 0 ? record.snapshot.lastLatencyMs : latencyBase;
    const latencyScore = clamp(latencyBase / Math.max(1, observedLatency), 0.1, 1.5);
    const priorityScore = Math.max(0, record.config.priority ?? DEFAULT_PRIORITY);
    const bias = slo.routeBias ?? DEFAULT_SLO_ROUTE_BIAS;
    const trafficScore = this.computeEffectiveTrafficPercent(record, now) / 100;
    const stabilityBonus = record.snapshot.stableSince > 0 && now - record.snapshot.stableSince >= (record.config.failback?.minHealthyDurationMs ?? DEFAULT_FAILBACK_MIN_HEALTHY_DURATION_MS)
      ? 5
      : 0;
    return (
      bias * 20 +
      record.snapshot.successRate * 40 +
      latencyScore * 20 +
      healthWeight * 10 +
      trafficScore * 10 +
      priorityScore * 2 +
      stabilityBonus -
      record.snapshot.failureRate * 25
    );
  }

  private buildSnapshot(
    service: AuthorityMcpServiceConfig,
    patch: Partial<AuthorityMcpServiceSnapshot> = {},
  ): AuthorityMcpServiceSnapshot {
    return {
      serviceId: service.serviceId,
      provider: service.provider,
      transport: service.transport,
      source: service.source,
      endpoint: toSnapshotEndpoint(service),
      enabled: service.enabled,
      healthy: false,
      healthStatus: service.enabled ? "degraded" : "unhealthy",
      operationalMode: service.operationalMode ?? "active",
      toolCount: 0,
      loadedModules: [...service.modules],
      moduleErrors: {},
      priority: service.priority ?? DEFAULT_PRIORITY,
      requestCount: 0,
      successCount: 0,
      failureCount: 0,
      successStreak: 0,
      failureStreak: 0,
      lastUsedAt: 0,
      lastPollAt: 0,
      lastCheckedAt: 0,
      lastStateChangeAt: Date.now(),
      recoveryBlockedUntil: 0,
      recoveryAttemptCount: 0,
      recoveryLockoutUntil: 0,
      lastRecoveryAttemptAt: 0,
      stableSince: 0,
      successRate: 1,
      failureRate: 0,
      routeScore: 0,
      sloStatus: "healthy",
      configuredTrafficPercent: this.normalizeTrafficPolicy(service.traffic).allocationPercent ?? DEFAULT_TRAFFIC_ALLOCATION_PERCENT,
      effectiveTrafficPercent: 0,
      trafficLane: this.normalizeTrafficPolicy(service.traffic).lane ?? "primary",
      servicesInMaintenance: false,
      activeMaintenanceWindowId: "",
      activeMaintenanceAction: "",
      maintenanceWindowCount: (service.maintenanceWindows || []).length,
      maintenanceConflictCount: 0,
      lastMaintenanceRunAt: 0,
      orchestrationGroup: this.normalizeOrchestrationPolicy(service.orchestration).serviceGroup || "",
      orchestrationTemplate: this.normalizeOrchestrationPolicy(service.orchestration).templateId || "",
      preferredNodes: [...(this.normalizeOrchestrationPolicy(service.orchestration).preferredNodes || [])],
      excludedNodes: [...(this.normalizeOrchestrationPolicy(service.orchestration).excludedNodes || [])],
      orchestrationRegions: [...(this.normalizeOrchestrationPolicy(service.orchestration).regions || [])],
      orchestrationTags: [...(this.normalizeOrchestrationPolicy(service.orchestration).tags || [])],
      lastLatencyMs: 0,
      lastError: "",
      ...patch,
    };
  }

  private updateServiceHealth(serviceId: string, response: McpCommandResponse, latencyMs: number): void {
    const record = this.getServiceRecord(serviceId);
    const now = Date.now();
    const previousStatus = record.snapshot.healthStatus;
    const failback = this.normalizeFailbackPolicy(record.config.failback);
    const wasRecovering =
      previousStatus === "unhealthy" ||
      previousStatus === "recovering" ||
      record.recoveryBlockedUntil > now;

    if (response.healthy === false) {
      record.snapshot.toolCount = Number(response.toolCount || record.snapshot.toolCount || 0);
      record.snapshot.loadedModules = asStringArray(response.loadedModules, record.config.modules);
      record.snapshot.moduleErrors = (response.moduleErrors || {}) as Record<string, string>;
      record.snapshot.lastCheckedAt = now;
      record.snapshot.lastPollAt = now;
      record.snapshot.lastLatencyMs = latencyMs;
      record.snapshot.lastError = "health check returned unhealthy";
      this.recordServiceFailure(serviceId, new Error("health check returned unhealthy"));
      return;
    }

    if (record.snapshot.recoveryLockoutUntil > now) {
      record.snapshot.toolCount = Number(response.toolCount || record.snapshot.toolCount || 0);
      record.snapshot.loadedModules = asStringArray(response.loadedModules, record.config.modules);
      record.snapshot.moduleErrors = (response.moduleErrors || {}) as Record<string, string>;
      record.snapshot.lastCheckedAt = now;
      record.snapshot.lastPollAt = now;
      record.snapshot.lastLatencyMs = latencyMs;
      record.snapshot.lastError = "recovery lockout active";
      record.snapshot.healthy = false;
      this.transitionHealthState(record, previousStatus, "unhealthy", "recovery_lockout_active");
      this.refreshDerivedState(serviceId);
      this.persistServiceSnapshot(serviceId);
      return;
    }

    if (previousStatus === "unhealthy") {
      record.snapshot.recoveryAttemptCount += 1;
      record.snapshot.lastRecoveryAttemptAt = now;
      if (record.snapshot.recoveryAttemptCount > (failback.maxRecoveryAttempts ?? DEFAULT_FAILBACK_MAX_RECOVERY_ATTEMPTS)) {
        record.snapshot.recoveryLockoutUntil = now + (failback.recoveryLockoutMs ?? DEFAULT_FAILBACK_LOCKOUT_MS);
        record.snapshot.lastError = "recovery attempts exceeded";
        this.audit("mcp.service.recovery.locked", {
          serviceId,
          recoveryAttemptCount: record.snapshot.recoveryAttemptCount,
          recoveryLockoutUntil: record.snapshot.recoveryLockoutUntil,
        });
        this.transitionHealthState(record, previousStatus, "unhealthy", "recovery_lockout_triggered");
        this.refreshDerivedState(serviceId);
        this.persistServiceSnapshot(serviceId);
        return;
      }
    }

    record.snapshot.successStreak += 1;
    record.snapshot.failureStreak = 0;
    record.snapshot.healthy = !wasRecovering || record.snapshot.successStreak >= (record.config.recoverySuccessThreshold ?? this.recoverySuccessThreshold);
    record.snapshot.healthStatus = record.snapshot.healthy ? "healthy" : "recovering";
    record.snapshot.toolCount = Number(response.toolCount || 0);
    record.snapshot.loadedModules = asStringArray(response.loadedModules, record.config.modules);
    record.snapshot.moduleErrors = (response.moduleErrors || {}) as Record<string, string>;
    record.snapshot.lastCheckedAt = now;
    record.snapshot.lastPollAt = now;
    record.snapshot.lastLatencyMs = latencyMs;
    record.snapshot.lastError = "";
    if (record.snapshot.healthy) {
      record.recoveryBlockedUntil = 0;
      record.snapshot.recoveryBlockedUntil = 0;
      if (record.snapshot.stableSince === 0) {
        record.snapshot.stableSince = now;
      } else if (now - record.snapshot.stableSince >= (failback.minHealthyDurationMs ?? DEFAULT_FAILBACK_MIN_HEALTHY_DURATION_MS)) {
        record.snapshot.recoveryAttemptCount = 0;
        record.snapshot.recoveryLockoutUntil = 0;
        record.snapshot.lastRecoveryAttemptAt = 0;
      }
    } else {
      record.snapshot.stableSince = 0;
    }
    this.transitionHealthState(
      record,
      previousStatus,
      record.snapshot.healthy ? "healthy" : "recovering",
      "health_probe_success",
    );
    this.refreshDerivedState(serviceId);
    this.persistServiceSnapshot(serviceId);
  }

  private recordServiceFailure(serviceId: string, error: unknown): void {
    const record = this.getServiceRecord(serviceId);
    const message = error instanceof Error ? error.message : String(error);
    const previousStatus = record.snapshot.healthStatus;
    const failback = this.normalizeFailbackPolicy(record.config.failback);
    record.snapshot.successStreak = 0;
    record.snapshot.failureStreak += 1;
    if (record.snapshot.failureStreak >= (record.config.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD)) {
      record.recoveryBlockedUntil = Date.now() + (record.config.recoveryIntervalMs ?? DEFAULT_RECOVERY_INTERVAL_MS);
    }
    record.snapshot.failureCount += 1;
    record.snapshot.healthy = false;
    record.snapshot.lastCheckedAt = Date.now();
    record.snapshot.lastPollAt = record.snapshot.lastCheckedAt;
    record.snapshot.lastError = message;
    record.snapshot.recoveryBlockedUntil = record.recoveryBlockedUntil;
    record.snapshot.stableSince = 0;
    if (previousStatus === "recovering" && record.snapshot.recoveryAttemptCount >= (failback.maxRecoveryAttempts ?? DEFAULT_FAILBACK_MAX_RECOVERY_ATTEMPTS)) {
      record.snapshot.recoveryLockoutUntil = Date.now() + (failback.recoveryLockoutMs ?? DEFAULT_FAILBACK_LOCKOUT_MS);
      this.audit("mcp.service.recovery.locked", {
        serviceId,
        recoveryAttemptCount: record.snapshot.recoveryAttemptCount,
        recoveryLockoutUntil: record.snapshot.recoveryLockoutUntil,
      });
    }
    const nextStatus =
      record.snapshot.failureStreak >= (record.config.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD)
        ? "unhealthy"
        : "degraded";
    this.transitionHealthState(record, previousStatus, nextStatus, message);
    this.refreshDerivedState(serviceId);
    this.persistServiceSnapshot(serviceId);
  }

  private syncToolRegistration(service: AuthorityMcpServiceConfig, descriptor: AuthorityMcpToolDescriptor): void {
    const existing = this.toolCallBridge.getToolDefinition(descriptor.toolName);
    if (existing && existing.protocol !== "mcp") {
      return;
    }

    const definition = this.buildToolRegistration(service, descriptor, existing || undefined);
    this.toolCallBridge.registerToolDefinition(definition, async (args: unknown) =>
      this.invokeToolWithFailover(descriptor.toolName, args),
    );
  }

  private buildToolRegistration(
    service: AuthorityMcpServiceConfig,
    descriptor: AuthorityMcpToolDescriptor,
    existing?: ToolCatalogEntry,
  ): ToolRegistrationInput {
    const policy = service.toolPolicies?.[descriptor.toolName];
    const existingMetadata = asRecord(existing?.metadata);
    const previousBindings = this.parseBindings(existingMetadata.mcpServiceBindings);
    const serviceSnapshot = this.getServiceRecord(service.serviceId).snapshot;
    const nextBinding = {
      serviceId: service.serviceId,
      provider: service.provider,
      transport: service.transport,
      endpoint: toSnapshotEndpoint(service),
      priority: service.priority ?? DEFAULT_PRIORITY,
      healthy: serviceSnapshot.healthy,
      lastCheckedAt: serviceSnapshot.lastCheckedAt,
    };
    const mergedBindings = [
      ...previousBindings.filter((binding) => binding.serviceId !== service.serviceId),
      nextBinding,
    ].sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.serviceId.localeCompare(b.serviceId);
    });

    return {
      toolName: descriptor.toolName,
      source: existing?.source || service.source,
      category: existing?.category || "application",
      protocol: "mcp",
      version: existing?.version || "1.0.0",
      provider: existing?.provider || service.provider,
      allowedDepartments:
        existing?.allowedDepartments ||
        policy?.allowedDepartments ||
        service.defaultAllowedDepartments ||
        ["*"],
      requiredDepartments:
        existing?.requiredDepartments ||
        policy?.requiredDepartments ||
        [],
      requiredCapabilities:
        existing?.requiredCapabilities ||
        policy?.requiredCapabilities ||
        service.defaultRequiredCapabilities ||
        [],
      approvalMode:
        existing?.approvalMode ||
        policy?.approvalMode ||
        "auto",
      quotaKey: existing?.quotaKey || `tool:${descriptor.toolName}`,
      quotaLimit:
        this.state.tools.quotas.get(existing?.quotaKey || `tool:${descriptor.toolName}`) ||
        policy?.quotaLimit,
      tags: unique([
        ...(existing?.tags || []),
        ...(descriptor.tags || []),
        ...(service.tags || []),
        "mcp",
        service.transport,
      ]),
      inputSchema: descriptor.inputSchema,
      outputSchema: descriptor.outputSchema,
      examples: existing?.examples || [],
      metadata: {
        ...existingMetadata,
        ...descriptor.metadata,
        description: descriptor.description,
        mcpModule: descriptor.module,
        mcpServiceId: mergedBindings[0]?.serviceId || service.serviceId,
        mcpServiceBindings: mergedBindings,
        transport: service.transport,
        provider: service.provider,
        lastDiscoveredAt: Date.now(),
      },
    };
  }

  private parseBindings(value: unknown): Array<{
    serviceId: string;
    provider: string;
    transport: string;
    endpoint: string;
    priority: number;
    healthy?: boolean;
    lastCheckedAt?: number;
  }> {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((entry) => asRecord(entry))
      .filter((entry) => typeof entry.serviceId === "string")
      .map((entry) => ({
        serviceId: String(entry.serviceId),
        provider: String(entry.provider || "mcp"),
        transport: String(entry.transport || "unknown"),
        endpoint: String(entry.endpoint || ""),
        priority: Number.isFinite(Number(entry.priority)) ? Number(entry.priority) : DEFAULT_PRIORITY,
        healthy: Boolean(entry.healthy),
        lastCheckedAt: Number(entry.lastCheckedAt || 0),
      }));
  }

  private resolveCandidates(definition: ToolCatalogEntry, args: Record<string, unknown>): ServiceRuntimeRecord[] {
    const bindings = this.parseBindings(asRecord(definition.metadata).mcpServiceBindings);
    const boundServices = bindings
      .map((binding) => this.services.get(binding.serviceId))
      .filter(Boolean) as ServiceRuntimeRecord[];
    const fallback = this.servicesForTool(definition.toolName);
    const candidates = [...new Map([...boundServices, ...fallback].map((entry) => [entry.config.serviceId, entry])).values()];
    const now = Date.now();

    candidates.forEach((candidate) => this.refreshDerivedState(candidate.config.serviceId));

    const ordered = candidates.sort((left, right) => {
      const leftActive = this.effectiveOperationalMode(left) === "active";
      const rightActive = this.effectiveOperationalMode(right) === "active";
      const leftBlocked = left.recoveryBlockedUntil > now || left.snapshot.recoveryLockoutUntil > now;
      const rightBlocked = right.recoveryBlockedUntil > now || right.snapshot.recoveryLockoutUntil > now;
      if (this.effectiveEnabled(left) !== this.effectiveEnabled(right)) {
        return this.effectiveEnabled(left) ? -1 : 1;
      }
      if (leftActive !== rightActive) {
        return leftActive ? -1 : 1;
      }
      if (leftBlocked !== rightBlocked) {
        return leftBlocked ? 1 : -1;
      }
      if (left.snapshot.sloStatus !== right.snapshot.sloStatus) {
        const rank = (status: AuthorityMcpServiceSnapshot["sloStatus"]) =>
          status === "healthy" ? 0 : status === "at-risk" ? 1 : 2;
        return rank(left.snapshot.sloStatus) - rank(right.snapshot.sloStatus);
      }
      if (left.snapshot.routeScore !== right.snapshot.routeScore) {
        return right.snapshot.routeScore - left.snapshot.routeScore;
      }
      if (left.snapshot.healthStatus !== right.snapshot.healthStatus) {
        return this.healthRank(left.snapshot.healthStatus) - this.healthRank(right.snapshot.healthStatus);
      }
      if (left.snapshot.healthy !== right.snapshot.healthy) {
        return left.snapshot.healthy ? -1 : 1;
      }
      if ((left.config.priority ?? DEFAULT_PRIORITY) !== (right.config.priority ?? DEFAULT_PRIORITY)) {
        return (right.config.priority ?? DEFAULT_PRIORITY) - (left.config.priority ?? DEFAULT_PRIORITY);
      }
      const leftLatency = left.snapshot.lastCheckedAt > 0 ? left.snapshot.lastLatencyMs : Number.MAX_SAFE_INTEGER;
      const rightLatency = right.snapshot.lastCheckedAt > 0 ? right.snapshot.lastLatencyMs : Number.MAX_SAFE_INTEGER;
      if (leftLatency !== rightLatency) {
        return leftLatency - rightLatency;
      }
      if (left.snapshot.failureCount !== right.snapshot.failureCount) {
        return left.snapshot.failureCount - right.snapshot.failureCount;
      }
      return left.config.serviceId.localeCompare(right.config.serviceId);
    }).filter((record) =>
      this.effectiveEnabled(record) &&
      this.effectiveOperationalMode(record) === "active" &&
      record.snapshot.recoveryLockoutUntil <= now &&
      record.recoveryBlockedUntil <= now &&
      record.snapshot.healthStatus !== "unhealthy",
    );

    return this.applyTrafficAllocation(ordered, definition.toolName, args);
  }

  private applyTrafficAllocation(
    candidates: ServiceRuntimeRecord[],
    toolName: string,
    args: Record<string, unknown>,
  ): ServiceRuntimeRecord[] {
    if (candidates.length <= 1) {
      return candidates;
    }

    const now = Date.now();
    const weighted = candidates.map((record) => ({
      record,
      weight: this.computeEffectiveTrafficPercent(record, now),
    })).filter((entry) => entry.weight > 0);

    if (weighted.length <= 1) {
      return weighted.length === 1
        ? [weighted[0].record, ...candidates.filter((entry) => entry.config.serviceId !== weighted[0].record.config.serviceId)]
        : candidates;
    }

    const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    const bucketInput = `${toolName}:${stableSerialize(args)}`;
    const bucket = hashString(bucketInput) % Math.max(1, Math.round(totalWeight));
    let cursor = 0;
    let selected = weighted[0].record;
    for (const entry of weighted) {
      cursor += entry.weight;
      if (bucket < cursor) {
        selected = entry.record;
        break;
      }
    }

    if (selected.config.serviceId !== candidates[0].config.serviceId) {
      this.audit("mcp.service.traffic.routed", {
        toolName,
        selectedServiceId: selected.config.serviceId,
        primaryCandidateServiceId: candidates[0].config.serviceId,
        bucket,
        weights: weighted.map((entry) => ({
          serviceId: entry.record.config.serviceId,
          weight: entry.weight,
        })),
      });
    }

    return [
      selected,
      ...candidates.filter((entry) => entry.config.serviceId !== selected.config.serviceId),
    ];
  }

  private countMaintenanceConflicts(windows: AuthorityMcpMaintenanceWindow[]): number {
    let conflicts = 0;
    for (let leftIndex = 0; leftIndex < windows.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < windows.length; rightIndex += 1) {
        if (this.maintenanceWindowsOverlap(windows[leftIndex], windows[rightIndex])) {
          conflicts += 1;
        }
      }
    }
    return conflicts;
  }

  private maintenanceWindowsOverlap(left: AuthorityMcpMaintenanceWindow, right: AuthorityMcpMaintenanceWindow): boolean {
    return left.startAt < right.endAt && right.startAt < left.endAt;
  }

  private resolveMaintenanceWindowConflicts(
    windows: AuthorityMcpMaintenanceWindow[],
    incoming: AuthorityMcpMaintenanceWindow,
  ): { windows: AuthorityMcpMaintenanceWindow[]; result: MaintenanceConflictResolution } {
    const conflicts = windows.filter((entry) => this.maintenanceWindowsOverlap(entry, incoming));
    if (conflicts.length === 0) {
      return {
        windows: [...windows, incoming],
        result: {
          mode: "scheduled",
          window: incoming,
          conflicts: [],
        },
      };
    }

    const conflictIds = conflicts.map((entry) => entry.windowId);
    const policy = incoming.conflictPolicy || "merge";
    if (policy === "reject") {
      throw new Error(`maintenance window conflict rejected: ${incoming.windowId} -> ${conflictIds.join(",")}`);
    }

    if (policy === "replace") {
      const blocking = conflicts.filter((entry) => (entry.priority ?? 0) > (incoming.priority ?? 0));
      if (blocking.length > 0) {
        throw new Error(
          `maintenance window conflict blocked by higher priority window(s): ${blocking.map((entry) => entry.windowId).join(",")}`,
        );
      }
      return {
        windows: [...windows.filter((entry) => !conflictIds.includes(entry.windowId)), incoming],
        result: {
          mode: "replace",
          window: incoming,
          conflicts: conflictIds,
        },
      };
    }

    if (policy === "defer") {
      const duration = incoming.endAt - incoming.startAt;
      const deferredStart = Math.max(...conflicts.map((entry) => entry.endAt)) + 1;
      const deferredWindow = this.normalizeMaintenanceWindow({
        ...incoming,
        startAt: deferredStart,
        endAt: deferredStart + duration,
      });
      const deferred = this.resolveMaintenanceWindowConflicts(windows, deferredWindow);
      return {
        windows: deferred.windows,
        result: {
          mode: "defer",
          window: deferred.result.window,
          conflicts: conflictIds,
        },
      };
    }

    const mergedWindow = this.mergeMaintenanceWindows([...conflicts, incoming]);
    return {
      windows: [...windows.filter((entry) => !conflictIds.includes(entry.windowId)), mergedWindow],
      result: {
        mode: "merge",
        window: mergedWindow,
        conflicts: conflictIds,
      },
    };
  }

  private mergeMaintenanceWindows(windows: AuthorityMcpMaintenanceWindow[]): AuthorityMcpMaintenanceWindow {
    const preferred = [...windows].sort((left, right) => {
      const priorityDelta = (right.priority ?? 0) - (left.priority ?? 0);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
      return this.maintenanceActionRank(right.action) - this.maintenanceActionRank(left.action);
    })[0];
    return {
      windowId: preferred.windowId,
      startAt: Math.min(...windows.map((entry) => entry.startAt)),
      endAt: Math.max(...windows.map((entry) => entry.endAt)),
      recurrence: windows.every((entry) => (entry.recurrence || "none") === (preferred.recurrence || "none"))
        ? (preferred.recurrence || "none")
        : "none",
      action: preferred.action,
      autoRecover: windows.every((entry) => entry.autoRecover !== false),
      reason: unique(windows.map((entry) => entry.reason || "").filter(Boolean)).join(" | "),
      enabled: windows.every((entry) => entry.enabled !== false),
      priority: Math.max(...windows.map((entry) => entry.priority ?? 0)),
      conflictPolicy: preferred.conflictPolicy || "merge",
    };
  }

  private maintenanceActionRank(action: AuthorityMcpMaintenanceWindow["action"]): number {
    switch (action) {
      case "disable":
        return 3;
      case "isolate":
        return 2;
      default:
        return 1;
    }
  }

  private healthRank(status: AuthorityMcpServiceSnapshot["healthStatus"]): number {
    switch (status) {
      case "healthy":
        return 0;
      case "recovering":
        return 1;
      case "degraded":
        return 2;
      default:
        return 3;
    }
  }

  private shouldPollService(record: ServiceRuntimeRecord, now: number): boolean {
    if (!record.config.enabled) {
      return false;
    }
    const interval = record.config.pollingIntervalMs ?? this.healthPollingIntervalMs;
    return now - record.snapshot.lastPollAt >= interval;
  }

  private startHealthPolling(): void {
    if (this.pollTimer) {
      return;
    }
    this.pollTimer = setInterval(() => {
      void this.pollServices();
    }, this.healthPollingIntervalMs);
    this.pollTimer.unref?.();
  }

  private async pollServices(): Promise<void> {
    if (this.pollInFlight) {
      return;
    }
    this.pollInFlight = true;
    this.lastPollAt = Date.now();
    try {
      const now = Date.now();
      const dueServices = [...this.services.values()]
        .filter((record) => this.shouldPollService(record, now))
        .map((record) => record.config.serviceId);
      for (const serviceId of dueServices) {
        await this.checkHealth(serviceId, { strict: false, source: "polling" });
      }
    } finally {
      this.lastPollCompletedAt = Date.now();
      this.pollInFlight = false;
    }
  }

  private startMaintenanceScheduler(): void {
    if (this.maintenanceTimer) {
      return;
    }
    this.maintenanceTimer = setInterval(() => {
      void this.runMaintenanceSweep();
    }, this.maintenanceIntervalMs);
    this.maintenanceTimer.unref?.();
  }

  private async runMaintenanceSweep(): Promise<void> {
    if (this.maintenanceInFlight) {
      return;
    }
    this.maintenanceInFlight = true;
    this.lastMaintenanceRunAt = Date.now();
    try {
      const now = Date.now();
      for (const record of this.services.values()) {
        const activeWindow = this.resolveActiveMaintenanceWindow(record.config.maintenanceWindows || [], now);
        if (activeWindow && record.activeMaintenanceWindowId !== activeWindow.windowId) {
          await this.applyMaintenanceWindow(record, activeWindow);
        } else if (!activeWindow && record.activeMaintenanceWindowId) {
          const previousWindow = (record.config.maintenanceWindows || []).find(
            (window) => window.windowId === record.activeMaintenanceWindowId,
          );
          await this.releaseMaintenanceWindow(
            record,
            "maintenance_window_complete",
            previousWindow?.autoRecover !== false,
          );
        } else {
          record.snapshot.lastMaintenanceRunAt = now;
          this.refreshDerivedState(record.config.serviceId);
          this.persistServiceSnapshot(record.config.serviceId);
        }
      }
    } finally {
      this.lastMaintenanceCompletedAt = Date.now();
      this.maintenanceInFlight = false;
    }
  }

  private resolveActiveMaintenanceWindow(
    windows: AuthorityMcpMaintenanceWindow[],
    now: number,
  ): AuthorityMcpMaintenanceWindow | null {
    return windows
      .filter((window) => window.enabled !== false)
      .sort((left, right) => left.startAt - right.startAt)
      .find((window) => this.resolveWindowOccurrence(window, now) !== null) || null;
  }

  private resolveWindowOccurrence(
    window: AuthorityMcpMaintenanceWindow,
    now: number,
  ): { startAt: number; endAt: number } | null {
    const duration = window.endAt - window.startAt;
    const recurrence = window.recurrence || "none";
    if (recurrence === "none") {
      return now >= window.startAt && now <= window.endAt ? { startAt: window.startAt, endAt: window.endAt } : null;
    }

    const baseStart = new Date(window.startAt);
    const candidateStarts: number[] = [];

    if (recurrence === "daily") {
      const reference = new Date(now);
      for (const shift of [0, -1]) {
        const candidate = new Date(reference);
        candidate.setDate(reference.getDate() + shift);
        candidate.setHours(
          baseStart.getHours(),
          baseStart.getMinutes(),
          baseStart.getSeconds(),
          baseStart.getMilliseconds(),
        );
        candidateStarts.push(candidate.getTime());
      }
    } else if (recurrence === "weekly") {
      const reference = new Date(now);
      const deltaDays = reference.getDay() - baseStart.getDay();
      for (const shift of [0, -7]) {
        const candidate = new Date(reference);
        candidate.setDate(reference.getDate() - deltaDays + shift);
        candidate.setHours(
          baseStart.getHours(),
          baseStart.getMinutes(),
          baseStart.getSeconds(),
          baseStart.getMilliseconds(),
        );
        candidateStarts.push(candidate.getTime());
      }
    } else if (recurrence === "monthly") {
      const buildMonthly = (offsetMonths: number) => {
        const reference = new Date(now);
        const candidate = new Date(
          reference.getFullYear(),
          reference.getMonth() + offsetMonths,
          1,
          baseStart.getHours(),
          baseStart.getMinutes(),
          baseStart.getSeconds(),
          baseStart.getMilliseconds(),
        );
        const lastDay = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
        candidate.setDate(Math.min(baseStart.getDate(), lastDay));
        return candidate.getTime();
      };
      candidateStarts.push(buildMonthly(0), buildMonthly(-1));
    }

    for (const startAt of candidateStarts) {
      const endAt = startAt + duration;
      if (now >= startAt && now <= endAt) {
        return { startAt, endAt };
      }
    }
    return null;
  }

  private async applyMaintenanceWindow(
    record: ServiceRuntimeRecord,
    window: AuthorityMcpMaintenanceWindow,
  ): Promise<void> {
    record.activeMaintenanceWindowId = window.windowId;
    record.maintenancePreviousEnabled = record.snapshot.enabled;
    record.maintenancePreviousMode = record.snapshot.operationalMode;

    if (window.action === "disable") {
      record.snapshot.enabled = false;
      record.snapshot.healthy = false;
      record.snapshot.lastError = window.reason || "maintenance window active";
      this.transitionHealthState(record, record.snapshot.healthStatus, "unhealthy", `maintenance:${window.windowId}`);
    } else {
      record.snapshot.operationalMode = window.action === "isolate" ? "isolated" : "paused";
    }

    record.snapshot.lastMaintenanceRunAt = Date.now();
    this.refreshDerivedState(record.config.serviceId);
    this.persistServiceSnapshot(record.config.serviceId);
    this.audit("mcp.service.window.executed", {
      serviceId: record.config.serviceId,
      windowId: window.windowId,
      action: window.action,
      phase: "enter",
      reason: window.reason || "",
    });
  }

  private async releaseMaintenanceWindow(record: ServiceRuntimeRecord, reason: string, restore = true): Promise<void> {
    const windowId = record.activeMaintenanceWindowId;
    const previousStatus = record.snapshot.healthStatus;
    record.activeMaintenanceWindowId = "";
    if (restore) {
      record.snapshot.enabled = record.maintenancePreviousEnabled ?? record.config.enabled;
      record.snapshot.operationalMode = record.maintenancePreviousMode ?? (record.config.operationalMode ?? "active");
    }
    record.maintenancePreviousEnabled = null;
    record.maintenancePreviousMode = null;
    if (restore && record.snapshot.enabled && previousStatus === "unhealthy") {
      record.snapshot.lastError = "";
      this.transitionHealthState(record, previousStatus, "degraded", reason);
    }
    record.snapshot.lastMaintenanceRunAt = Date.now();
    this.refreshDerivedState(record.config.serviceId);
    this.persistServiceSnapshot(record.config.serviceId);
    this.audit("mcp.service.window.executed", {
      serviceId: record.config.serviceId,
      windowId,
      phase: "exit",
      restored: restore,
      reason,
    });
  }

  private transitionHealthState(
    record: ServiceRuntimeRecord,
    previous: AuthorityMcpServiceSnapshot["healthStatus"],
    next: AuthorityMcpServiceSnapshot["healthStatus"],
    reason: string,
  ): void {
    record.snapshot.healthStatus = next;
    record.snapshot.recoveryBlockedUntil = record.recoveryBlockedUntil;
    if (previous !== next) {
      record.snapshot.lastStateChangeAt = Date.now();
      this.audit("mcp.service.state.changed", {
        serviceId: record.config.serviceId,
        previousStatus: previous,
        nextStatus: next,
        reason,
      });
    }
  }

  private servicesForTool(toolName: string): ServiceRuntimeRecord[] {
    return [...this.services.values()].filter((entry) => entry.tools.has(toolName));
  }

  private persistServiceSnapshot(serviceId: string): void {
    const record = this.getServiceRecord(serviceId);
    this.state.tools.metadata.set(
      `${SERVICE_METADATA_PREFIX}${serviceId}`,
      JSON.stringify({
        kind: "mcp_service",
        config: {
          serviceId: record.config.serviceId,
          provider: record.config.provider,
          transport: record.config.transport,
          endpoint: record.config.endpoint || "",
          source: record.config.source,
          enabled: record.config.enabled,
          operationalMode: record.config.operationalMode ?? "active",
          priority: record.config.priority ?? DEFAULT_PRIORITY,
          pollingIntervalMs: record.config.pollingIntervalMs ?? this.healthPollingIntervalMs,
          recoverySuccessThreshold: record.config.recoverySuccessThreshold ?? this.recoverySuccessThreshold,
          maintenanceWindows: record.config.maintenanceWindows || [],
          slo: record.config.slo || this.normalizeSloPolicy(),
          traffic: record.config.traffic || this.normalizeTrafficPolicy(),
          failback: record.config.failback || this.normalizeFailbackPolicy(),
          orchestration: record.config.orchestration || this.normalizeOrchestrationPolicy(),
          modules: record.config.modules,
        },
        snapshot: record.snapshot,
        tools: [...record.tools],
        recoveryBlockedUntil: record.recoveryBlockedUntil,
      }),
    );
    this.state.tools.lastUpdate = Date.now();
    this.state.lastUpdate = Date.now();
  }

  private getRunner(service: AuthorityMcpServiceConfig): McpCommandRunner {
    if (this.runnerOverride) {
      return this.runnerOverride;
    }
    return service.transport === "http" ? this.httpRunner : this.subprocessRunner;
  }

  private async persistConfig(): Promise<void> {
    await fsPromises.mkdir(path.dirname(this.configPath), { recursive: true });
    const services = [...this.services.values()]
      .map((entry) => entry.config)
      .sort((left, right) => left.serviceId.localeCompare(right.serviceId));
    await fsPromises.writeFile(this.configPath, JSON.stringify({ services }, null, 2), "utf-8");
  }

  private audit(type: AuthorityEventType, payload: Record<string, unknown>): void {
    this.eventStore.append({
      eventId: createId("event"),
      mutationId: createId("mcp-audit"),
      type,
      timestamp: Date.now(),
      payload,
    });
    this.state.audit.totalEvents = this.eventStore.count();
    this.state.audit.eventCursor = `mcp:${type}:${Date.now()}`;
  }
}

export default AuthorityMcpTransportService;
