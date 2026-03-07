/**
 * OpenClaw核心
 * 
 * @module openclaw/core
 */

import { logger } from '../utils/logger.js';

// Agent状态
export interface AgentState {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'running' | 'error' | 'offline';
  capabilities: string[];
  metrics: AgentMetrics;
  lastHeartbeat: number;
  createdAt: number;
}

// Agent指标
export interface AgentMetrics {
  cpuUsage: number;
  memoryUsed: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksRunning: number;
  uptimeSeconds: number;
  avgResponseTimeMs: number;
}

// 任务状态
export interface TaskState {
  id: string;
  name: string;
  type: string;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: 'L1' | 'L2' | 'L3' | 'L4';
  agentId: string | null;
  progress: number;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  result: any | null;
  error: string | null;
}

/**
 * OpenClaw核心
 */
export class OpenClawCore {
  private agents: Map<string, AgentState> = new Map();
  private tasks: Map<string, TaskState> = new Map();

  constructor() {
    logger.info('OpenClaw core initialized');
  }

  // ============ Agent管理 ============

  /**
   * 注册Agent
   */
  registerAgent(params: {
    name: string;
    type: string;
    capabilities: string[];
  }): AgentState {
    const agent: AgentState = {
      id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: params.name,
      type: params.type,
      status: 'idle',
      capabilities: params.capabilities,
      metrics: {
        cpuUsage: 0,
        memoryUsed: 0,
        tasksCompleted: 0,
        tasksFailed: 0,
        tasksRunning: 0,
        uptimeSeconds: 0,
        avgResponseTimeMs: 0,
      },
      lastHeartbeat: Date.now(),
      createdAt: Date.now(),
    };

    this.agents.set(agent.id, agent);
    logger.info(`Agent registered: ${agent.id}`);
    return agent;
  }

  /**
   * 获取所有Agent
   */
  getAgents(): AgentState[] {
    return Array.from(this.agents.values());
  }

  /**
   * 获取Agent
   */
  getAgent(id: string): AgentState | undefined {
    return this.agents.get(id);
  }

  /**
   * 更新Agent状态
   */
  updateAgentStatus(id: string, status: AgentState['status']): boolean {
    const agent = this.agents.get(id);
    if (agent) {
      agent.status = status;
      agent.lastHeartbeat = Date.now();
      return true;
    }
    return false;
  }

  // ============ 任务管理 ============

  /**
   * 创建任务
   */
  createTask(params: {
    name: string;
    type: string;
    priority?: 'L1' | 'L2' | 'L3' | 'L4';
    agentId?: string;
  }): TaskState {
    const task: TaskState = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: params.name,
      type: params.type,
      status: 'pending',
      priority: params.priority || 'L3',
      agentId: params.agentId || null,
      progress: 0,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
      result: null,
      error: null,
    };

    this.tasks.set(task.id, task);
    logger.info(`Task created: ${task.id}`);
    return task;
  }

  /**
   * 获取所有任务
   */
  getTasks(): TaskState[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取任务
   */
  getTask(id: string): TaskState | undefined {
    return this.tasks.get(id);
  }

  /**
   * 更新任务进度
   */
  updateTaskProgress(id: string, progress: number): boolean {
    const task = this.tasks.get(id);
    if (task) {
      task.progress = progress;
      if (progress >= 100) {
        task.status = 'completed';
        task.completedAt = Date.now();
      }
      return true;
    }
    return false;
  }

  /**
   * 取消任务
   */
  cancelTask(id: string): boolean {
    const task = this.tasks.get(id);
    if (task && (task.status === 'pending' || task.status === 'running')) {
      task.status = 'cancelled';
      task.completedAt = Date.now();
      return true;
    }
    return false;
  }

  // ============ 统计 ============

  /**
   * 获取统计
   */
  getStats(): {
    totalAgents: number;
    runningAgents: number;
    totalTasks: number;
    runningTasks: number;
    completedTasks: number;
  } {
    return {
      totalAgents: this.agents.size,
      runningAgents: Array.from(this.agents.values()).filter((a) => a.status === 'running').length,
      totalTasks: this.tasks.size,
      runningTasks: Array.from(this.tasks.values()).filter((t) => t.status === 'running').length,
      completedTasks: Array.from(this.tasks.values()).filter((t) => t.status === 'completed').length,
    };
  }
}

// 全局实例
export const openclawCore = new OpenClawCore();
