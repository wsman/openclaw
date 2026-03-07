/**
 * 🤖 AgentState - Agent状态 Schema
 * 
 * @constitution
 * §101 同步公理：代码变更必须触发文档更新
 * §102 熵减原则：所有变更必须降低或维持系统熵值
 * §106 Agent身份公理：每个Agent必须拥有唯一身份标识和明确职责
 * §110 协作效率公理：Agent响应时间必须控制在合理范围内
 * 
 * @filename AgentState.ts
 * @version 1.0.0
 * @category schema
 * @last_updated 2026-02-26
 */

import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

/**
 * Agent任务 Schema
 */
export class AgentTask extends Schema {
  @type("string") id: string = "";
  @type("string") agentId: string = "";
  @type("string") type: string = "";
  @type("string") data: string = ""; // JSON序列化的任务数据
  @type("string") priority: string = "normal"; // "low" | "normal" | "high" | "critical"
  @type("string") status: string = "pending"; // "pending" | "processing" | "completed" | "failed" | "timeout"
  @type("number") createdAt: number = 0;
  @type("number") startedAt: number = 0;
  @type("number") updatedAt: number = 0;
  @type("number") completedAt: number = 0;
  @type("number") timeout: number = 60000; // ms
  @type("string") result: string = ""; // JSON序列化的结果
  @type("string") error: string = "";
  @type({ map: "string" }) metadata = new MapSchema<string>();
}

/**
 * Agent性能指标 Schema
 */
export class AgentMetrics extends Schema {
  @type("number") tasksCompleted: number = 0;
  @type("number") tasksFailed: number = 0;
  @type("number") averageResponseTime: number = 0; // ms
  @type("number") successRate: number = 1.0; // 0.0 - 1.0
  @type("number") lastTaskTime: number = 0;
  @type("number") totalProcessingTime: number = 0;
  @type("number") averageQueueLength: number = 0;
  @type("number") peakQueueLength: number = 0;
}

/**
 * Agent状态 Schema
 */
export class AgentState extends Schema {
  // === 基本身份 ===
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("string") type: string = "worker"; // "director" | "ministry" | "cabinet" | "worker" | "specialist"
  
  // === 状态信息 ===
  @type("string") status: string = "idle"; // "idle" | "ready" | "processing" | "thinking" | "speaking" | "error" | "terminated"
  @type("boolean") available: boolean = true;
  @type("number") lastActive: number = 0;
  
  // === LLM配置 ===
  @type("string") llmProvider: string = "simulated";
  @type("string") llmModel: string = "simulated";
  @type("boolean") llmEnabled: boolean = false;
  @type("string") apiKeyHash: string = "";
  
  // === 任务管理 ===
  @type("string") currentTaskId: string = "";
  @type("number") taskProgress: number = 0; // 0-100
  @type("number") createdAt: number = 0;
  @type("number") terminatedAt: number = 0;
  @type("string") terminationReason: string = "";
  
  // === 能力与指标 ===
  @type({ map: "string" }) capabilities = new MapSchema<string>();
  @type(AgentMetrics) metrics: AgentMetrics = new AgentMetrics();
  
  // === 元数据 ===
  @type({ map: "string" }) metadata = new MapSchema<string>();
  @type({ array: "string" }) tags = new ArraySchema<string>();
}

/**
 * Agent注册表 Schema
 */
export class AgentRegistry extends Schema {
  // === 房间信息 ===
  @type("string") roomId: string = "";
  @type("number") createdAt: number = 0;
  @type("number") lastUpdate: number = 0;
  
  // === Agent集合 ===
  @type({ map: AgentState }) agents = new MapSchema<AgentState>();
  
  // === 统计信息 ===
  @type("number") totalAgents: number = 0;
  @type("number") activeAgents: number = 0;
  @type("number") totalTasks: number = 0;
  @type("number") pendingTasks: number = 0;
  @type("number") completedTasks: number = 0;
  @type("number") failedTasks: number = 0;
  
  // === 系统状态 ===
  @type("string") systemStatus: string = "healthy"; // "healthy" | "warning" | "critical"
  @type("number") systemLoad: number = 0; // 0.0 - 1.0
  
  /**
   * 获取可用Agent数量
   */
  getAvailableAgentCount(): number {
    let count = 0;
    this.agents.forEach((agent: AgentState) => {
      if (agent.available && agent.status !== "terminated") {
        count++;
      }
    });
    return count;
  }
  
  /**
   * 获取指定类型的Agent
   */
  getAgentsByType(type: string): AgentState[] {
    const result: AgentState[] = [];
    this.agents.forEach((agent: AgentState) => {
      if (agent.type === type) {
        result.push(agent);
      }
    });
    return result;
  }
  
  /**
   * 获取具有指定能力的Agent
   */
  getAgentsWithCapability(capability: string): AgentState[] {
    const result: AgentState[] = [];
    this.agents.forEach((agent: AgentState) => {
      if (agent.capabilities.has(capability) && agent.available) {
        result.push(agent);
      }
    });
    return result;
  }
  
  /**
   * 计算系统负载
   */
  calculateSystemLoad(): number {
    if (this.activeAgents === 0) return 0;
    
    let busyAgents = 0;
    this.agents.forEach((agent: AgentState) => {
      if (agent.status === "processing" || agent.status === "thinking") {
        busyAgents++;
      }
    });
    
    this.systemLoad = busyAgents / this.activeAgents;
    return this.systemLoad;
  }
  
  /**
   * 更新系统状态
   */
  updateSystemStatus(): void {
    this.calculateSystemLoad();
    
    if (this.systemLoad < 0.7) {
      this.systemStatus = "healthy";
    } else if (this.systemLoad < 0.9) {
      this.systemStatus = "warning";
    } else {
      this.systemStatus = "critical";
    }
  }
}