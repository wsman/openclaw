/**
 * 🤖 AgentRoom - Agent生命周期管理房间
 * 
 * @constitution
 * §101 同步公理：代码变更必须触发文档更新
 * §102 熵减原则：所有变更必须降低或维持系统熵值
 * §106 Agent身份公理：每个Agent必须拥有唯一身份标识和明确职责
 * §110 协作效率公理：Agent响应时间必须控制在合理范围内
 * §152 单一真理源公理：Agent状态同步基于唯一数据源
 * 
 * @filename AgentRoom.ts
 * @version 1.0.0
 * @category rooms
 * @last_updated 2026-02-26
 * 
 * 功能：
 * - Agent生命周期管理（spawn/terminate/health）
 * - Agent任务调度和监控
 * - Agent性能指标收集
 * - 多Agent协作状态同步
 */

import { Room, Client } from "colyseus";
import { AgentState, AgentTask, AgentMetrics, AgentRegistry } from "../schema/AgentState";
import { logger } from "../utils/logger";
import { v4 as uuidv4 } from "uuid";

/**
 * AgentRoom配置
 */
interface AgentRoomConfig {
  maxAgents: number;
  healthCheckInterval: number;
  taskTimeout: number;
  maxTasksPerAgent: number;
}

const DEFAULT_CONFIG: AgentRoomConfig = {
  maxAgents: 100,
  healthCheckInterval: 5000,
  taskTimeout: 60000, // 1分钟
  maxTasksPerAgent: 10,
};

/**
 * Agent类型定义
 */
type AgentType = "director" | "ministry" | "cabinet" | "worker" | "specialist";

/**
 * Agent能力定义
 */
interface AgentCapability {
  name: string;
  description: string;
  cost: number; // 计算成本估算
  dependencies?: string[];
}

/**
 * 🤖 AgentRoom - Agent管理房间
 * 负责Agent生命周期和任务调度的核心实现
 */
export class AgentRoom extends Room<AgentRegistry> {
  private config!: AgentRoomConfig;
  private taskQueue: Map<string, AgentTask[]> = new Map(); // agentId -> tasks
  private pendingSpawns: Set<string> = new Set();
  private lastHealthCheck = 0;

  onCreate(options: any) {
    logger.info(`[AgentRoom] 创建Agent管理房间 ${this.roomId}...`);
    
    // 合并配置
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    
    // 初始化状态
    this.setState(new AgentRegistry());
    this.state.roomId = this.roomId;
    this.state.createdAt = Date.now();
    this.state.lastUpdate = Date.now();
    
    // 设置更新循环
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 1000);
    
    // 设置消息处理器
    this.setupMessageHandlers();
    
    // 初始化系统Agent
    this.initializeSystemAgents();
    
    logger.info(`[AgentRoom] Agent管理房间创建完成`);
  }

  /**
   * 设置消息处理器
   */
  private setupMessageHandlers() {
    this.onMessage("*", (client, type, message) => {
      const typeStr = String(type);
      
      switch (typeStr) {
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
          logger.debug(`[AgentRoom] 未处理的消息类型：${typeStr}`);
      }
    });
  }

  /**
   * 初始化系统Agent
   */
  private initializeSystemAgents() {
    const systemAgents = [
      {
        id: "agent:office_director",
        name: "办公厅主任",
        type: "director" as AgentType,
        capabilities: ["complexity_analysis", "agent_coordination", "task_decomposition", "result_integration"],
        llmProvider: "simulated",
        llmModel: "simulated",
      },
      {
        id: "agent:tech_ministry",
        name: "科技部",
        type: "ministry" as AgentType,
        capabilities: ["system_development", "architecture_optimization", "technical_innovation"],
        llmProvider: "simulated",
        llmModel: "simulated",
      },
      {
        id: "agent:monitor_ministry",
        name: "监督部",
        type: "ministry" as AgentType,
        capabilities: ["compliance_monitoring", "entropy_audit", "system_integrity"],
        llmProvider: "simulated",
        llmModel: "simulated",
      },
      {
        id: "agent:cabinet",
        name: "内阁",
        type: "cabinet" as AgentType,
        capabilities: ["policy_coordination", "inter_departmental_sync", "resource_allocation"],
        llmProvider: "simulated",
        llmModel: "simulated",
      },
    ];
    
    systemAgents.forEach(agentConfig => {
      this.spawnAgent(
        agentConfig.id,
        agentConfig.name,
        agentConfig.type,
        agentConfig.capabilities,
        agentConfig.llmProvider,
        agentConfig.llmModel
      );
    });
    
    logger.info(`[AgentRoom] 初始化了 ${systemAgents.length} 个系统Agent`);
  }

  /**
   * 处理Agent创建请求
   */
  private handleSpawnAgent(client: Client, message: any) {
    const { name, type, capabilities = [], llmProvider = "simulated", llmModel = "simulated" } = message;
    
    if (!name || !type) {
      client.send("error", { code: "invalid_request", message: "缺少必要参数" });
      return;
    }
    
    // 检查Agent数量限制
    if (this.state.agents.size >= this.config.maxAgents) {
      client.send("error", { code: "agent_limit_reached", message: "已达最大Agent数量" });
      return;
    }
    
    const agentId = `agent:${uuidv4()}`;
    
    try {
      const agent = this.spawnAgent(agentId, name, type, capabilities, llmProvider, llmModel);
      
      client.send("agent_spawned", {
        agentId,
        name,
        type,
        timestamp: Date.now()
      });
      
      // 广播Agent创建通知
      this.broadcast("agent_event", {
        event: "spawned",
        agentId,
        name,
        type,
        timestamp: Date.now()
      }, { except: client });
      
    } catch (error: any) {
      client.send("error", { code: "spawn_failed", message: error.message });
    }
  }

  /**
   * 创建Agent
   */
  private spawnAgent(
    agentId: string,
    name: string,
    type: AgentType,
    capabilities: string[],
    llmProvider: string,
    llmModel: string
  ): AgentState {
    if (this.state.agents.has(agentId)) {
      throw new Error(`Agent ${agentId} 已存在`);
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
    
    // 设置能力
    capabilities.forEach(cap => {
      agent.capabilities.set(cap, "enabled");
    });
    
    // 初始化指标
    agent.metrics = new AgentMetrics();
    agent.metrics.tasksCompleted = 0;
    agent.metrics.averageResponseTime = 0;
    agent.metrics.successRate = 1.0;
    agent.metrics.lastTaskTime = 0;
    
    // 添加到注册表
    this.state.agents.set(agentId, agent);
    this.state.totalAgents++;
    this.state.activeAgents++;
    
    // 初始化任务队列
    this.taskQueue.set(agentId, []);
    
    logger.info(`[AgentRoom] Agent创建成功: ${name} (${agentId})`);
    
    return agent;
  }

  /**
   * 处理Agent终止请求
   */
  private handleTerminateAgent(client: Client, message: any) {
    const { agentId, reason = "manual" } = message;
    
    const agent = this.state.agents.get(agentId);
    if (!agent) {
      client.send("error", { code: "agent_not_found", message: `Agent ${agentId} 不存在` });
      return;
    }
    
    // 检查是否有进行中的任务
    const tasks = this.taskQueue.get(agentId) || [];
    const activeTasks = tasks.filter(t => t.status === "processing" || t.status === "pending");
    
    if (activeTasks.length > 0) {
      client.send("error", { 
        code: "agent_busy", 
        message: `Agent有 ${activeTasks.length} 个活跃任务，请先完成或取消` 
      });
      return;
    }
    
    // 终止Agent
    this.terminateAgent(agentId, reason);
    
    client.send("agent_terminated", {
      agentId,
      reason,
      timestamp: Date.now()
    });
    
    // 广播终止通知
    this.broadcast("agent_event", {
      event: "terminated",
      agentId,
      reason,
      timestamp: Date.now()
    }, { except: client });
  }

  /**
   * 终止Agent
   */
  private terminateAgent(agentId: string, reason: string) {
    const agent = this.state.agents.get(agentId);
    if (!agent) return;
    
    agent.status = "terminated";
    agent.available = false;
    agent.terminatedAt = Date.now();
    agent.terminationReason = reason;
    
    // 从活跃计数中移除
    this.state.activeAgents--;
    
    // 清理任务队列
    this.taskQueue.delete(agentId);
    
    logger.info(`[AgentRoom] Agent终止: ${agent.name} (${agentId}), 原因: ${reason}`);
  }

  /**
   * 处理任务分配请求
   */
  private handleAssignTask(client: Client, message: any) {
    const { agentId, taskType, taskData, priority = "normal" } = message;
    
    const agent = this.state.agents.get(agentId);
    if (!agent) {
      client.send("error", { code: "agent_not_found", message: `Agent ${agentId} 不存在` });
      return;
    }
    
    if (!agent.available) {
      client.send("error", { code: "agent_unavailable", message: `Agent ${agent.name} 当前不可用` });
      return;
    }
    
    // 检查任务队列限制
    const tasks = this.taskQueue.get(agentId) || [];
    if (tasks.length >= this.config.maxTasksPerAgent) {
      client.send("error", { code: "task_queue_full", message: "Agent任务队列已满" });
      return;
    }
    
    // 创建任务
    const task = new AgentTask();
    task.id = `task:${uuidv4()}`;
    task.agentId = agentId;
    task.type = taskType;
    task.data = JSON.stringify(taskData);
    task.priority = priority;
    task.status = "pending";
    task.createdAt = Date.now();
    task.timeout = this.config.taskTimeout;
    
    // 添加到队列
    tasks.push(task);
    this.taskQueue.set(agentId, tasks);
    
    // 更新Agent状态
    if (agent.status === "idle") {
      agent.status = "ready";
    }
    
    // 更新统计
    this.state.totalTasks++;
    this.state.pendingTasks++;
    
    client.send("task_assigned", {
      taskId: task.id,
      agentId,
      timestamp: Date.now()
    });
    
    logger.info(`[AgentRoom] 任务分配: ${task.id} -> ${agent.name}`);
  }

  /**
   * 处理任务状态更新
   */
  private handleUpdateTaskStatus(client: Client, message: any) {
    const { taskId, status, result, error } = message;
    
    // 查找任务所属的Agent
    let targetAgentId: string | null = null;
    let targetTask: AgentTask | null = null;
    
    for (const [agentId, tasks] of this.taskQueue) {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        targetAgentId = agentId;
        targetTask = task;
        break;
      }
    }
    
    if (!targetAgentId || !targetTask) {
      client.send("error", { code: "task_not_found", message: `任务 ${taskId} 不存在` });
      return;
    }
    
    const agent = this.state.agents.get(targetAgentId);
    
    // 更新任务状态
    targetTask.status = status;
    targetTask.updatedAt = Date.now();
    
    if (status === "completed") {
      targetTask.completedAt = Date.now();
      targetTask.result = JSON.stringify(result);
      this.state.pendingTasks--;
      this.state.completedTasks++;
      
      if (agent) {
        agent.metrics.tasksCompleted++;
        agent.status = "idle";
        agent.lastActive = Date.now();
      }
      
    } else if (status === "failed") {
      targetTask.error = error || "Unknown error";
      this.state.pendingTasks--;
      this.state.failedTasks++;
      
      if (agent) {
        agent.status = "idle";
      }
    } else if (status === "processing") {
      targetTask.startedAt = Date.now();
      
      if (agent) {
        agent.status = "processing";
        agent.currentTaskId = taskId;
      }
    }
    
    // 广播任务状态更新
    this.broadcast("task_status_updated", {
      taskId,
      agentId: targetAgentId,
      status,
      timestamp: Date.now()
    });
    
    logger.debug(`[AgentRoom] 任务状态更新: ${taskId} -> ${status}`);
  }

  /**
   * 处理Agent状态请求
   */
  private handleAgentStatusRequest(client: Client, message: any) {
    const { agentId } = message;
    
    if (agentId) {
      const agent = this.state.agents.get(agentId);
      if (!agent) {
        client.send("error", { code: "agent_not_found", message: `Agent ${agentId} 不存在` });
        return;
      }
      
      const tasks = this.taskQueue.get(agentId) || [];
      
      client.send("agent_status", {
        agent,
        tasks,
        timestamp: Date.now()
      });
    } else {
      // 返回所有Agent状态
      const allAgents = Array.from(this.state.agents.values()) as AgentState[];
      client.send("all_agents_status", {
        agents: allAgents,
        stats: {
          total: this.state.totalAgents,
          active: this.state.activeAgents,
          idle: allAgents.filter((a: AgentState) => a.status === "idle").length,
          processing: allAgents.filter((a: AgentState) => a.status === "processing").length,
        },
        timestamp: Date.now()
      });
    }
  }

  /**
   * 处理Agent查询
   */
  private handleQueryAgents(client: Client, message: any) {
    const { type, capability, status, available } = message;
    
    let agents = Array.from(this.state.agents.values()) as AgentState[];
    
    // 应用过滤条件
    if (type) {
      agents = agents.filter((a: AgentState) => a.type === type);
    }
    if (capability) {
      agents = agents.filter((a: AgentState) => a.capabilities.has(capability));
    }
    if (status) {
      agents = agents.filter((a: AgentState) => a.status === status);
    }
    if (available !== undefined) {
      agents = agents.filter((a: AgentState) => a.available === available);
    }
    
    client.send("query_result", {
      agents,
      count: agents.length,
      timestamp: Date.now()
    });
  }

  /**
   * 处理能力设置
   */
  private handleSetCapabilities(client: Client, message: any) {
    const { agentId, capabilities } = message;
    
    const agent = this.state.agents.get(agentId);
    if (!agent) {
      client.send("error", { code: "agent_not_found", message: `Agent ${agentId} 不存在` });
      return;
    }
    
    // 清空现有能力
    agent.capabilities.clear();
    
    // 设置新能力
    capabilities.forEach((cap: string) => {
      agent.capabilities.set(cap, "enabled");
    });
    
    client.send("capabilities_updated", {
      agentId,
      capabilities,
      timestamp: Date.now()
    });
    
    logger.info(`[AgentRoom] Agent能力更新: ${agent.name} -> ${capabilities.join(", ")}`);
  }

  /**
   * 主更新循环
   */
  private update(deltaTime: number) {
    const now = Date.now();
    
    // 定期健康检查
    if (now - this.lastHealthCheck > this.config.healthCheckInterval) {
      this.performHealthCheck();
      this.lastHealthCheck = now;
    }
    
    // 检查任务超时
    this.checkTaskTimeouts();
    
    // 更新状态
    this.state.lastUpdate = now;
  }

  /**
   * 执行健康检查
   */
  private performHealthCheck() {
    const now = Date.now();
    const staleThreshold = 60000; // 1分钟无响应视为不健康
    
    this.state.agents.forEach(agent => {
      if (!agent.available) return;
      
      const timeSinceLastActive = now - agent.lastActive;
      
      if (timeSinceLastActive > staleThreshold && agent.status !== "idle") {
        // Agent可能卡住
        logger.warn(`[AgentRoom] Agent ${agent.name} 可能卡住，最后活动: ${timeSinceLastActive}ms前`);
        
        // 广播告警
        this.broadcast("agent_health_alert", {
          agentId: agent.id,
          agentName: agent.name,
          issue: "stale",
          lastActive: agent.lastActive,
          timestamp: now
        });
      }
    });
  }

  /**
   * 检查任务超时
   */
  private checkTaskTimeouts() {
    const now = Date.now();
    
    this.taskQueue.forEach((tasks, agentId) => {
      tasks.forEach(task => {
        if (task.status === "processing" || task.status === "pending") {
          const taskAge = now - task.createdAt;
          
          if (taskAge > task.timeout) {
            task.status = "timeout";
            task.error = "Task timeout";
            task.updatedAt = now;
            
            this.state.pendingTasks--;
            this.state.failedTasks++;
            
            const agent = this.state.agents.get(agentId);
            if (agent && agent.status === "processing") {
              agent.status = "idle";
            }
            
            logger.warn(`[AgentRoom] 任务超时: ${task.id}`);
            
            this.broadcast("task_timeout", {
              taskId: task.id,
              agentId,
              timeout: task.timeout,
              timestamp: now
            });
          }
        }
      });
    });
  }

  onJoin(client: Client, options: any) {
    logger.info(`[AgentRoom] 客户端 ${client.sessionId} 加入Agent管理房间`);
    
    // 发送当前状态
    client.send("agent_registry_state", {
      agents: Array.from(this.state.agents.values()),
      stats: {
        total: this.state.totalAgents,
        active: this.state.activeAgents,
        pendingTasks: this.state.pendingTasks,
        completedTasks: this.state.completedTasks,
        failedTasks: this.state.failedTasks,
      },
      timestamp: Date.now()
    });
  }

  onLeave(client: Client, consented: boolean) {
    logger.info(`[AgentRoom] 客户端 ${client.sessionId} 离开Agent管理房间`);
  }

  onDispose() {
    logger.info(`[AgentRoom] 销毁Agent管理房间 ${this.roomId}`);
    
    // 清理所有任务队列
    this.taskQueue.clear();
  }
}

export default AgentRoom;