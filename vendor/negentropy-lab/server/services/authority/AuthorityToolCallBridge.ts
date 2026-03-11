/**
 * @constitution
 * §101 同步公理: authority ToolCallBridge 实现与真理源文档保持同步
 * §102 熵减原则: 保持 authority ToolCallBridge 逻辑简洁可维护
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename AuthorityToolCallBridge.ts
 * @version 1.0.0
 * @category authority
 * @last_updated 2026-03-10
 */

import { AuthorityState } from "../../schema/AuthorityState";
import { EventStore } from "./EventStore";
import {
  ToolCallContext,
  ToolDiscoveryEntry,
  ToolDiscoveryQuery,
  ToolAccessDecision,
  ToolCatalogEntry,
  ToolRegistrationInput,
  ToolUsageSnapshot,
} from "./types";
import {
  IToolCallBridge,
  NCPMessage,
  ToolCallBridgeConfig,
  ToolCallEventType,
  ToolCallPayload,
  ToolCategory,
  ToolErrorPayload,
  ToolProgressPayload,
  ToolResultPayload,
  ToolStartPayload,
} from "../../types/system/IToolCallBridge";

function createId(prefix: string): string {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

export class AuthorityToolCallBridge implements IToolCallBridge {
  private readonly handlers = new Map<string, (args: any) => Promise<any>>();
  private readonly subscriptions = new Map<string, { eventType: ToolCallEventType; callback: (message: NCPMessage) => void }>();
  private maxConcurrent: number;
  private readonly defaultTimeout: number;
  private readonly enableBroadcast: boolean;

  constructor(
    private readonly state: AuthorityState,
    private readonly eventStore: EventStore,
    config: ToolCallBridgeConfig = {},
  ) {
    this.maxConcurrent = config.maxConcurrent ?? 10;
    this.defaultTimeout = config.defaultTimeout ?? 30000;
    this.enableBroadcast = config.enableBroadcast !== false;
  }

  broadcastToolStart(payload: ToolStartPayload): string {
    this.state.tools.registry.set(payload.toolName, payload.category);
    this.state.tools.activeCalls.set(
      payload.toolId,
      JSON.stringify({
        toolName: payload.toolName,
        timestamp: payload.timestamp,
        sessionId: payload.sessionId,
        agentId: payload.agentId,
        args: payload.args,
      }),
    );
    this.state.tools.lastUpdate = Date.now();
    this.audit("tool.call.started", {
      toolName: payload.toolName,
      toolId: payload.toolId,
      sessionId: payload.sessionId,
      agentId: payload.agentId,
      category: payload.category,
    });
    return this.broadcast(ToolCallEventType.TOOL_CALL, payload);
  }

  broadcastToolResult(payload: ToolResultPayload): string {
    this.state.tools.activeCalls.delete(payload.toolId);
    this.state.tools.lastResults.set(
      payload.toolName,
      JSON.stringify({
        timestamp: payload.timestamp,
        duration: payload.duration,
        result: payload.result,
        agentId: payload.agentId,
      }),
    );
    this.state.tools.lastUpdate = Date.now();
    this.audit("tool.call.completed", {
      toolName: payload.toolName,
      toolId: payload.toolId,
      duration: payload.duration,
      agentId: payload.agentId,
    });
    return this.broadcast(ToolCallEventType.TOOL_RESULT, payload);
  }

  broadcastToolError(payload: ToolErrorPayload): string {
    this.state.tools.activeCalls.delete(payload.toolId);
    this.state.tools.lastResults.set(
      payload.toolName,
      JSON.stringify({
        timestamp: payload.timestamp,
        duration: payload.duration,
        error: payload.error,
        errorCode: payload.errorCode,
        agentId: payload.agentId,
      }),
    );
    this.state.tools.lastUpdate = Date.now();
    this.audit("tool.call.failed", {
      toolName: payload.toolName,
      toolId: payload.toolId,
      error: payload.error,
      errorCode: payload.errorCode,
      agentId: payload.agentId,
    });
    return this.broadcast(ToolCallEventType.TOOL_ERROR, payload);
  }

  broadcastToolProgress(payload: ToolProgressPayload): string {
    this.state.tools.lastUpdate = Date.now();
    return this.broadcast(ToolCallEventType.TOOL_PROGRESS, payload);
  }

  registerTool(tool: string, handler: (args: any) => Promise<any>): void {
    this.registerToolDefinition({ toolName: tool }, handler);
  }

  registerToolDefinition(definition: ToolRegistrationInput, handler: (args: any) => Promise<any>): void {
    const category = definition.category || this.inferToolCategory(definition.toolName);
    const entry: ToolCatalogEntry = {
      toolName: definition.toolName,
      category,
      source: definition.source || "builtin",
      protocol: definition.protocol || (definition.toolName.startsWith("mcp_") ? "mcp" : "builtin"),
      version: definition.version || "1.0.0",
      provider: definition.provider || definition.source || "builtin",
      allowedDepartments: definition.allowedDepartments || ["*"],
      requiredDepartments: definition.requiredDepartments || [],
      requiredCapabilities: definition.requiredCapabilities || [],
      approvalMode: definition.approvalMode || "auto",
      quotaKey: definition.quotaKey || `tool:${definition.toolName}`,
      tags: definition.tags || [],
      inputSchema: definition.inputSchema || {},
      outputSchema: definition.outputSchema || {},
      examples: definition.examples || [],
      metadata: definition.metadata || {},
    };

    this.handlers.set(definition.toolName, handler);
    this.state.tools.registry.set(definition.toolName, category);
    this.state.tools.metadata.set(definition.toolName, JSON.stringify(entry));
    this.state.tools.quotas.set(entry.quotaKey, Math.max(1, Math.floor(definition.quotaLimit ?? this.state.tools.quotas.get(entry.quotaKey) ?? this.maxConcurrent)));
    this.state.tools.lastUpdate = Date.now();
    this.audit("tool.registered", entry as unknown as Record<string, unknown>);
  }

  getToolCatalog(): ToolCatalogEntry[] {
    return [...this.state.tools.registry.keys()].map((toolName) => this.getToolDefinition(toolName)).filter(Boolean) as ToolCatalogEntry[];
  }

  discoverTools(query: ToolDiscoveryQuery = {}): ToolDiscoveryEntry[] {
    return this.getToolCatalog()
      .filter((tool) => (query.protocol ? tool.protocol === query.protocol : true))
      .filter((tool) => (query.tag ? tool.tags.includes(query.tag) : true))
      .filter((tool) => (query.department ? this.matchesDepartment(tool, query.department) : true))
      .filter((tool) =>
        query.capability ? tool.requiredCapabilities.length === 0 || tool.requiredCapabilities.includes(query.capability) : true,
      )
      .map((tool) => ({
        tool,
        access: this.getAccessDecision(tool.toolName, query.agentId, query.department),
      }));
  }

  getToolDefinition(toolName: string): ToolCatalogEntry | null {
    const metadata = this.state.tools.metadata.get(toolName);
    const category = this.state.tools.registry.get(toolName);
    if (!metadata || !category) {
      return null;
    }

    const parsed = JSON.parse(metadata) as ToolCatalogEntry;
    return {
      ...parsed,
      category,
      protocol: parsed.protocol || (toolName.startsWith("mcp_") ? "mcp" : "builtin"),
      version: parsed.version || "1.0.0",
      provider: parsed.provider || parsed.source || "builtin",
      requiredDepartments: parsed.requiredDepartments || [],
      approvalMode: parsed.approvalMode || "auto",
      tags: parsed.tags || [],
      inputSchema: parsed.inputSchema || {},
      outputSchema: parsed.outputSchema || {},
      examples: parsed.examples || [],
      metadata: parsed.metadata || {},
    };
  }

  getAccessDecision(toolName: string, agentId?: string, fallbackDepartment?: string): ToolAccessDecision {
    const definition = this.getToolDefinition(toolName);
    if (!definition) {
      return {
        allowed: false,
        reason: "tool_not_registered",
        quotaRemaining: null,
      };
    }

    if (definition.approvalMode === "denied") {
      return {
        allowed: false,
        reason: "tool_denied_by_policy",
        quotaRemaining: this.getQuotaRemaining(definition, agentId),
      };
    }

    if (definition.approvalMode === "manual") {
      return {
        allowed: false,
        reason: "tool_requires_manual_approval",
        quotaRemaining: this.getQuotaRemaining(definition, agentId),
      };
    }

    if (!agentId || agentId === "system") {
      return {
        allowed: true,
        reason: "system_access",
        quotaRemaining: this.getQuotaRemaining(definition, agentId),
      };
    }

    const agent = this.state.agents.get(agentId);
    if (!agent) {
      return {
        allowed: false,
        reason: "agent_not_registered",
        quotaRemaining: this.getQuotaRemaining(definition, agentId),
      };
    }
    if (!agent.available || agent.connectionStatus !== "connected") {
      return {
        allowed: false,
        reason: "agent_unavailable",
        quotaRemaining: this.getQuotaRemaining(definition, agentId),
      };
    }

    const department = fallbackDepartment || agent.department;
    if (!this.matchesDepartment(definition, department)) {
      return {
        allowed: false,
        reason: `department_denied:${department}`,
        quotaRemaining: this.getQuotaRemaining(definition, agentId),
      };
    }

    const missing = definition.requiredCapabilities.filter(
      (capability) => !agent.capabilities.has(capability) && !agent.capabilities.has("*"),
    );
    if (missing.length > 0) {
      return {
        allowed: false,
        reason: `missing_capabilities:${missing.join(",")}`,
        quotaRemaining: this.getQuotaRemaining(definition, agentId),
      };
    }

    return {
      allowed: true,
      reason: "allowed",
      quotaRemaining: this.getQuotaRemaining(definition, agentId),
    };
  }

  getUsageSnapshot(): ToolUsageSnapshot[] {
    return this.getToolCatalog().map((tool) => {
      const metadata = this.parseToolMetadata(tool.toolName);
      const quotaLimit = this.state.tools.quotas.get(tool.quotaKey) ?? this.maxConcurrent;
      const activeCalls = [...this.state.tools.activeCalls.values()]
        .map((entry) => JSON.parse(entry) as { toolName?: string })
        .filter((entry) => entry.toolName === tool.toolName).length;
      return {
        toolName: tool.toolName,
        quotaKey: tool.quotaKey,
        quotaLimit,
        usageCount: Number(metadata?.metadata?.usageCount || 0),
        activeCalls,
        lastResultAt: Number(metadata?.metadata?.lastResultAt || 0),
      };
    });
  }

  async callTool(tool: string, args: any): Promise<any> {
    return this.executeTool({ toolName: tool, args, agentId: "system" });
  }

  async callToolWithContext(context: ToolCallContext): Promise<any> {
    return this.executeTool(context);
  }

  subscribe(eventType: ToolCallEventType, callback: (message: NCPMessage) => void): string {
    const subscriptionId = createId("tool-sub");
    this.subscriptions.set(subscriptionId, { eventType, callback });
    return subscriptionId;
  }

  unsubscribe(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
  }

  inferToolCategory(toolName: string): ToolCategory {
    if (toolName.startsWith("mcp_") || toolName.startsWith("http_")) {
      return ToolCategory.APPLICATION;
    }
    if (toolName.startsWith("memory_") || toolName.startsWith("context_")) {
      return ToolCategory.CONTEXT;
    }
    return ToolCategory.BUILTIN;
  }

  getActiveCallCount(): number {
    return this.state.tools.activeCalls.size;
  }

  setMaxConcurrent(maxConcurrent: number): void {
    this.maxConcurrent = Math.max(1, Math.floor(maxConcurrent));
  }

  private async executeTool(context: ToolCallContext): Promise<any> {
    if (this.getActiveCallCount() >= this.maxConcurrent) {
      throw new Error(`tool concurrency limit exceeded: ${this.maxConcurrent}`);
    }

    const handler = this.handlers.get(context.toolName);
    if (!handler) {
      throw new Error(`tool not registered: ${context.toolName}`);
    }

    const definition = this.getToolDefinition(context.toolName);
    if (!definition) {
      throw new Error(`tool metadata missing: ${context.toolName}`);
    }

    this.validateAccess(context.agentId, definition);
    this.validateQuota(context.agentId, definition);

    const startedAt = Date.now();
    const toolId = createId("tool");
    const category = definition.category as ToolCategory;

    this.broadcastToolStart({
      toolName: context.toolName,
      toolId,
      timestamp: startedAt,
      category,
      args: context.args,
      sessionId: context.sessionId,
      agentId: context.agentId,
    });

    try {
      const result = await this.withTimeout(handler(context.args), this.defaultTimeout);
      this.broadcastToolResult({
        toolName: context.toolName,
        toolId,
        timestamp: Date.now(),
        category,
        result,
        duration: Date.now() - startedAt,
        sessionId: context.sessionId,
        agentId: context.agentId,
      });
      this.recordUsage(definition.toolName, {
        usageCountDelta: 1,
        lastResultAt: Date.now(),
        lastAgentId: context.agentId,
        lastStatus: "completed",
      });
      return result;
    } catch (error: any) {
      this.broadcastToolError({
        toolName: context.toolName,
        toolId,
        timestamp: Date.now(),
        category,
        error: error?.message || "unknown tool error",
        errorCode: error?.code || "TOOL_CALL_FAILED",
        stackTrace: error?.stack,
        duration: Date.now() - startedAt,
        sessionId: context.sessionId,
        agentId: context.agentId,
      });
      this.recordUsage(definition.toolName, {
        usageCountDelta: 1,
        lastResultAt: Date.now(),
        lastAgentId: context.agentId,
        lastStatus: "failed",
      });
      throw error;
    }
  }

  private validateAccess(agentId: string, definition: ToolCatalogEntry): void {
    const decision = this.getAccessDecision(definition.toolName, agentId);
    if (!decision.allowed) {
      if (decision.reason.startsWith("department_denied:")) {
        throw new Error(`tool access denied for department: ${decision.reason.split(":")[1]}`);
      }
      if (decision.reason.startsWith("missing_capabilities:")) {
        throw new Error(`missing capabilities: ${decision.reason.replace("missing_capabilities:", "").replaceAll(",", ", ")}`);
      }
      if (decision.reason === "tool_requires_manual_approval") {
        throw new Error("tool requires manual approval");
      }
      if (decision.reason === "tool_denied_by_policy") {
        throw new Error("tool access denied by policy");
      }
      if (decision.reason === "agent_not_registered") {
        throw new Error(`agent not registered: ${agentId}`);
      }
      if (decision.reason === "agent_unavailable") {
        throw new Error(`agent unavailable: ${agentId}`);
      }
      if (decision.reason === "tool_not_registered") {
        throw new Error(`tool not registered: ${definition.toolName}`);
      }
      if (agentId !== "system") {
        const agent = this.state.agents.get(agentId);
        if (!agent) {
          throw new Error(`agent not registered: ${agentId}`);
        }
        if (!agent.available || agent.connectionStatus !== "connected") {
          throw new Error(`agent unavailable: ${agentId}`);
        }
      }
    }
  }

  private validateQuota(agentId: string, definition: ToolCatalogEntry): void {
    const quotaLimit = this.state.tools.quotas.get(definition.quotaKey) ?? this.maxConcurrent;
    const activeForKey = [...this.state.tools.activeCalls.values()]
      .map((entry) => JSON.parse(entry) as { toolName?: string; agentId?: string })
      .filter((entry) => entry.toolName === definition.toolName && (!agentId || entry.agentId === agentId)).length;

    if (activeForKey >= quotaLimit) {
      throw new Error(`tool quota exceeded for ${definition.quotaKey}`);
    }
  }

  private broadcast(type: ToolCallEventType, payload: ToolCallPayload): string {
    const broadcastId = createId("broadcast");
    if (!this.enableBroadcast) {
      return broadcastId;
    }

    const message: NCPMessage = {
      type,
      payload,
      broadcastId,
      timestamp: Date.now(),
    };

    this.subscriptions.forEach((subscription) => {
      if (subscription.eventType === type) {
        subscription.callback(message);
      }
    });

    return broadcastId;
  }

  private audit(type: "tool.registered" | "tool.call.started" | "tool.call.completed" | "tool.call.failed", payload: Record<string, unknown>) {
    this.eventStore.append({
      eventId: createId("event"),
      mutationId: createId("tool-audit"),
      type,
      timestamp: Date.now(),
      payload,
    });
    this.state.audit.totalEvents = this.eventStore.count();
    this.state.audit.eventCursor = `tool:${type}:${Date.now()}`;
  }

  private parseToolMetadata(toolName: string): ToolCatalogEntry | null {
    const metadata = this.state.tools.metadata.get(toolName);
    if (!metadata) {
      return null;
    }
    return JSON.parse(metadata) as ToolCatalogEntry;
  }

  private recordUsage(toolName: string, patch: Record<string, unknown>): void {
    const definition = this.parseToolMetadata(toolName);
    if (!definition) {
      return;
    }
    const currentMetadata = definition.metadata || {};
    const usageCount = Number(currentMetadata.usageCount || 0) + Number(patch.usageCountDelta || 0);
    const next: ToolCatalogEntry = {
      ...definition,
      metadata: {
        ...currentMetadata,
        ...patch,
        usageCount,
      },
    };
    this.state.tools.metadata.set(toolName, JSON.stringify(next));
    this.state.tools.lastUpdate = Date.now();
  }

  private matchesDepartment(definition: ToolCatalogEntry, department: string): boolean {
    const allowed =
      definition.allowedDepartments.length === 0 ||
      definition.allowedDepartments.includes("*") ||
      definition.allowedDepartments.includes(department);
    const required =
      definition.requiredDepartments.length === 0 || definition.requiredDepartments.includes(department);
    return allowed && required;
  }

  private getQuotaRemaining(definition: ToolCatalogEntry, agentId?: string): number | null {
    const quotaLimit = this.state.tools.quotas.get(definition.quotaKey) ?? this.maxConcurrent;
    const activeForKey = [...this.state.tools.activeCalls.values()]
      .map((entry) => JSON.parse(entry) as { toolName?: string; agentId?: string })
      .filter((entry) => entry.toolName === definition.toolName && (!agentId || entry.agentId === agentId)).length;
    return Math.max(0, quotaLimit - activeForKey);
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`tool call timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }
}

export default AuthorityToolCallBridge;
