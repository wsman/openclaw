/**
 * 🚀 Agent执行可视化服务
 * 
 * 宪法依据:
 * - §101 同步公理: 执行状态实时推送
 * - §102 熵减原则: 增量更新减少传输
 * - §109 协作流程公理: Agent执行流程可视化
 * - §110 协作效率公理: 执行效率实时监控
 * 
 * 功能:
 * 1. Agent执行状态跟踪
 * 2. 执行进度可视化
 * 3. 协作流程图生成
 * 4. 执行历史回放
 * 
 * @version 1.0.0
 * @created 2026-03-01
 * @maintainer 科技部
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { randomUUID } from 'crypto';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 执行阶段
 */
export type ExecutionPhase =
  | 'initialized'
  | 'routing'
  | 'processing'
  | 'collaborating'
  | 'integrating'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * 执行状态
 */
export interface ExecutionState {
  /** 执行ID */
  executionId: string;
  /** Agent ID */
  agentId: string;
  /** Agent名称 */
  agentName: string;
  /** 当前阶段 */
  phase: ExecutionPhase;
  /** 进度百分比 (0-100) */
  progress: number;
  /** 开始时间 */
  startedAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 结束时间 */
  endedAt?: number;
  /** 输入查询 */
  query: string;
  /** 中间结果 */
  intermediateResults: IntermediateResult[];
  /** 最终结果 */
  finalResult?: any;
  /** 错误信息 */
  error?: string;
  /** 执行指标 */
  metrics: ExecutionMetrics;
  /** 协作参与者 */
  collaborators?: CollaboratorInfo[];
  /** 执行路径 */
  executionPath: ExecutionStep[];
}

/**
 * 中间结果
 */
export interface IntermediateResult {
  /** 步骤ID */
  stepId: string;
  /** 步骤名称 */
  name: string;
  /** 结果数据 */
  data: any;
  /** 时间戳 */
  timestamp: number;
  /** 处理时间（ms） */
  durationMs: number;
}

/**
 * 执行指标
 */
export interface ExecutionMetrics {
  /** 总处理时间 */
  totalDurationMs: number;
  /** LLM调用次数 */
  llmCalls: number;
  /** 输入token数 */
  inputTokens: number;
  /** 输出token数 */
  outputTokens: number;
  /** 协作轮次 */
  collaborationRounds: number;
  /** 等待时间 */
  waitTimeMs: number;
  /** 处理时间 */
  processingTimeMs: number;
}

/**
 * 协作者信息
 */
export interface CollaboratorInfo {
  /** Agent ID */
  agentId: string;
  /** Agent名称 */
  agentName: string;
  /** 角色 */
  role: 'coordinator' | 'specialist';
  /** 贡献 */
  contribution?: string;
  /** 处理时间 */
  durationMs?: number;
}

/**
 * 执行步骤
 */
export interface ExecutionStep {
  /** 步骤ID */
  stepId: string;
  /** 步骤类型 */
  type: 'start' | 'route' | 'process' | 'collaborate' | 'integrate' | 'complete' | 'error';
  /** Agent ID */
  agentId: string;
  /** Agent名称 */
  agentName: string;
  /** 时间戳 */
  timestamp: number;
  /** 描述 */
  description: string;
  /** 输入 */
  input?: any;
  /** 输出 */
  output?: any;
  /** 持续时间 */
  durationMs?: number;
}

/**
 * 可视化事件
 */
export interface VisualizationEvent {
  /** 事件类型 */
  type: 'execution.start' | 'execution.progress' | 'execution.step' | 'execution.complete' | 'execution.error';
  /** 执行ID */
  executionId: string;
  /** 时间戳 */
  timestamp: number;
  /** 事件数据 */
  data: any;
}

/**
 * 可视化配置
 */
export interface VisualizerConfig {
  /** 最大活动执行数 */
  maxActiveExecutions: number;
  /** 历史保留数量 */
  historyRetention: number;
  /** 进度更新间隔（ms） */
  progressUpdateIntervalMs: number;
  /** 是否启用详细日志 */
  enableDetailedLogging: boolean;
}

// =============================================================================
// Agent执行可视化服务
// =============================================================================

/**
 * Agent执行可视化服务类
 * 
 * 实现Agent执行过程的实时可视化
 */
export class AgentExecutionVisualizer extends EventEmitter {
  private config: VisualizerConfig;
  private activeExecutions: Map<string, ExecutionState> = new Map();
  private executionHistory: ExecutionState[] = [];
  private stepCounter: number = 0;
  private metrics = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    avgExecutionTimeMs: 0,
    totalTokensUsed: 0,
    totalCollaborations: 0,
  };

  constructor(config: Partial<VisualizerConfig> = {}) {
    super();
    this.config = {
      maxActiveExecutions: config.maxActiveExecutions ?? 100,
      historyRetention: config.historyRetention ?? 500,
      progressUpdateIntervalMs: config.progressUpdateIntervalMs ?? 100,
      enableDetailedLogging: config.enableDetailedLogging ?? false,
      ...config,
    };

    logger.info('[AgentVisualizer] Agent执行可视化服务已初始化', {
      config: this.config,
      constitutionalBasis: '§109 协作流程公理, §110 协作效率公理',
    });
  }

  // =============================================================================
  // 执行生命周期管理
  // =============================================================================

  /**
   * 开始执行
   */
  public startExecution(params: {
    agentId: string;
    agentName: string;
    query: string;
    metadata?: any;
  }): ExecutionState {
    const executionId = `exec:${randomUUID()}`;
    const now = Date.now();

    const state: ExecutionState = {
      executionId,
      agentId: params.agentId,
      agentName: params.agentName,
      phase: 'initialized',
      progress: 0,
      startedAt: now,
      updatedAt: now,
      query: params.query,
      intermediateResults: [],
      metrics: {
        totalDurationMs: 0,
        llmCalls: 0,
        inputTokens: 0,
        outputTokens: 0,
        collaborationRounds: 0,
        waitTimeMs: 0,
        processingTimeMs: 0,
      },
      executionPath: [
        {
          stepId: this.generateStepId(),
          type: 'start',
          agentId: params.agentId,
          agentName: params.agentName,
          timestamp: now,
          description: `执行开始: ${params.query.substring(0, 50)}...`,
          input: { query: params.query },
        },
      ],
    };

    // 检查活动执行数量限制
    if (this.activeExecutions.size >= this.config.maxActiveExecutions) {
      this.evictOldestExecution();
    }

    this.activeExecutions.set(executionId, state);
    this.metrics.totalExecutions++;

    this.emitVisualizationEvent('execution.start', state, {
      agentId: params.agentId,
      agentName: params.agentName,
      query: params.query,
    });

    logger.debug(`[AgentVisualizer] 执行开始: ${executionId}`, {
      agentId: params.agentId,
      query: params.query.substring(0, 50),
    });

    return state;
  }

  /**
   * 更新执行进度
   */
  public updateProgress(
    executionId: string,
    update: {
      phase?: ExecutionPhase;
      progress?: number;
      intermediateResult?: Omit<IntermediateResult, 'stepId' | 'timestamp' | 'durationMs'>;
      metrics?: Partial<ExecutionMetrics>;
    }
  ): ExecutionState | null {
    const state = this.activeExecutions.get(executionId);
    if (!state) {
      return null;
    }

    const now = Date.now();
    state.updatedAt = now;

    if (update.phase) {
      state.phase = update.phase;
    }

    if (update.progress !== undefined) {
      state.progress = Math.min(100, Math.max(0, update.progress));
    }

    if (update.intermediateResult) {
      const result: IntermediateResult = {
        stepId: this.generateStepId(),
        name: update.intermediateResult.name,
        data: update.intermediateResult.data,
        timestamp: now,
        durationMs: now - state.startedAt,
      };
      state.intermediateResults.push(result);
    }

    if (update.metrics) {
      state.metrics = { ...state.metrics, ...update.metrics };
    }

    this.emitVisualizationEvent('execution.progress', state, {
      phase: state.phase,
      progress: state.progress,
    });

    return state;
  }

  /**
   * 添加执行步骤
   */
  public addExecutionStep(
    executionId: string,
    step: Omit<ExecutionStep, 'stepId' | 'timestamp'>
  ): ExecutionState | null {
    const state = this.activeExecutions.get(executionId);
    if (!state) {
      return null;
    }

    const fullStep: ExecutionStep = {
      ...step,
      stepId: this.generateStepId(),
      timestamp: Date.now(),
    };

    state.executionPath.push(fullStep);
    state.updatedAt = Date.now();

    this.emitVisualizationEvent('execution.step', state, fullStep);

    if (this.config.enableDetailedLogging) {
      logger.debug(`[AgentVisualizer] 步骤添加: ${executionId}`, {
        stepType: step.type,
        agentName: step.agentName,
        description: step.description,
      });
    }

    return state;
  }

  /**
   * 完成执行
   */
  public completeExecution(
    executionId: string,
    result: {
      finalResult?: any;
      metrics?: Partial<ExecutionMetrics>;
    }
  ): ExecutionState | null {
    const state = this.activeExecutions.get(executionId);
    if (!state) {
      return null;
    }

    const now = Date.now();
    state.phase = 'completed';
    state.progress = 100;
    state.endedAt = now;
    state.updatedAt = now;
    state.finalResult = result.finalResult;

    if (result.metrics) {
      state.metrics = { ...state.metrics, ...result.metrics };
    }

    state.metrics.totalDurationMs = now - state.startedAt;

    // 添加完成步骤
    state.executionPath.push({
      stepId: this.generateStepId(),
      type: 'complete',
      agentId: state.agentId,
      agentName: state.agentName,
      timestamp: now,
      description: '执行完成',
      output: result.finalResult,
      durationMs: state.metrics.totalDurationMs,
    });

    // 更新指标
    this.metrics.successfulExecutions++;
    this.updateAverageExecutionTime(state.metrics.totalDurationMs);
    this.metrics.totalTokensUsed += state.metrics.inputTokens + state.metrics.outputTokens;

    // 移动到历史记录
    this.moveToHistory(state);
    this.activeExecutions.delete(executionId);

    this.emitVisualizationEvent('execution.complete', state, {
      finalResult: result.finalResult,
      durationMs: state.metrics.totalDurationMs,
    });

    logger.info(`[AgentVisualizer] 执行完成: ${executionId}`, {
      agentId: state.agentId,
      durationMs: state.metrics.totalDurationMs,
      steps: state.executionPath.length,
    });

    return state;
  }

  /**
   * 执行失败
   */
  public failExecution(
    executionId: string,
    error: string
  ): ExecutionState | null {
    const state = this.activeExecutions.get(executionId);
    if (!state) {
      return null;
    }

    const now = Date.now();
    state.phase = 'failed';
    state.endedAt = now;
    state.updatedAt = now;
    state.error = error;
    state.metrics.totalDurationMs = now - state.startedAt;

    // 添加错误步骤
    state.executionPath.push({
      stepId: this.generateStepId(),
      type: 'error',
      agentId: state.agentId,
      agentName: state.agentName,
      timestamp: now,
      description: `执行失败: ${error}`,
      durationMs: state.metrics.totalDurationMs,
    });

    // 更新指标
    this.metrics.failedExecutions++;

    // 移动到历史记录
    this.moveToHistory(state);
    this.activeExecutions.delete(executionId);

    this.emitVisualizationEvent('execution.error', state, { error });

    logger.error(`[AgentVisualizer] 执行失败: ${executionId}`, {
      error,
      durationMs: state.metrics.totalDurationMs,
    });

    return state;
  }

  /**
   * 取消执行
   */
  public cancelExecution(executionId: string): boolean {
    const state = this.activeExecutions.get(executionId);
    if (!state) {
      return false;
    }

    const now = Date.now();
    state.phase = 'cancelled';
    state.endedAt = now;
    state.updatedAt = now;
    state.metrics.totalDurationMs = now - state.startedAt;

    // 移动到历史记录
    this.moveToHistory(state);
    this.activeExecutions.delete(executionId);

    this.emitVisualizationEvent('execution.error', state, { error: 'Cancelled by user' });

    logger.info(`[AgentVisualizer] 执行取消: ${executionId}`);
    return true;
  }

  // =============================================================================
  // 协作可视化
  // =============================================================================

  /**
   * 开始协作
   */
  public startCollaboration(
    executionId: string,
    collaborators: CollaboratorInfo[]
  ): ExecutionState | null {
    const state = this.activeExecutions.get(executionId);
    if (!state) {
      return null;
    }

    state.phase = 'collaborating';
    state.collaborators = collaborators;
    state.metrics.collaborationRounds++;
    this.metrics.totalCollaborations++;

    this.addExecutionStep(executionId, {
      type: 'collaborate',
      agentId: state.agentId,
      agentName: state.agentName,
      description: `开始协作: ${collaborators.map((c) => c.agentName).join(', ')}`,
      input: { collaborators },
    });

    return state;
  }

  /**
   * 更新协作者贡献
   */
  public updateCollaboratorContribution(
    executionId: string,
    agentId: string,
    contribution: string,
    durationMs: number
  ): ExecutionState | null {
    const state = this.activeExecutions.get(executionId);
    if (!state || !state.collaborators) {
      return null;
    }

    const collaborator = state.collaborators.find((c) => c.agentId === agentId);
    if (collaborator) {
      collaborator.contribution = contribution;
      collaborator.durationMs = durationMs;
    }

    return state;
  }

  /**
   * 生成协作流程图
   */
  public generateCollaborationDiagram(executionId: string): any {
    const state = this.activeExecutions.get(executionId) ||
      this.executionHistory.find((h) => h.executionId === executionId);

    if (!state) {
      return null;
    }

    const nodes: Array<{ id: string; label: string; type: string }> = [];
    const edges: Array<{ from: string; to: string; label?: string }> = [];

    // 构建节点
    nodes.push({
      id: 'start',
      label: '开始',
      type: 'start',
    });

    // 添加Agent节点
    const agentNodes = new Set<string>();
    for (const step of state.executionPath) {
      if (!agentNodes.has(step.agentId)) {
        agentNodes.add(step.agentId);
        nodes.push({
          id: step.agentId,
          label: step.agentName,
          type: step.agentId === state.agentId ? 'primary' : 'collaborator',
        });
      }
    }

    nodes.push({
      id: 'end',
      label: state.phase === 'completed' ? '完成' : '失败',
      type: 'end',
    });

    // 构建边
    let previousNode = 'start';
    for (const step of state.executionPath) {
      edges.push({
        from: previousNode,
        to: step.agentId,
        label: step.description,
      });
      previousNode = step.agentId;
    }

    edges.push({
      from: previousNode,
      to: 'end',
      label: state.finalResult ? '结果' : state.error,
    });

    return {
      executionId,
      nodes,
      edges,
      metrics: state.metrics,
      timeline: state.executionPath.map((step) => ({
        stepId: step.stepId,
        agentName: step.agentName,
        description: step.description,
        timestamp: step.timestamp,
        durationMs: step.durationMs,
      })),
    };
  }

  // =============================================================================
  // 查询与历史
  // =============================================================================

  /**
   * 获取执行状态
   */
  public getExecution(executionId: string): ExecutionState | null {
    return this.activeExecutions.get(executionId) ||
      this.executionHistory.find((h) => h.executionId === executionId) || null;
  }

  /**
   * 获取活动执行
   */
  public getActiveExecutions(): ExecutionState[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * 获取执行历史
   */
  public getHistory(options: {
    agentId?: string;
    phase?: ExecutionPhase;
    limit?: number;
    since?: number;
  } = {}): ExecutionState[] {
    let history = [...this.executionHistory];

    if (options.agentId) {
      history = history.filter((h) => h.agentId === options.agentId);
    }

    if (options.phase) {
      history = history.filter((h) => h.phase === options.phase);
    }

    if (options.since) {
      history = history.filter((h) => h.startedAt >= options.since!);
    }

    const limit = options.limit ?? 50;
    return history.slice(-limit);
  }

  /**
   * 获取执行时间线
   */
  public getExecutionTimeline(executionId: string): ExecutionStep[] | null {
    const state = this.getExecution(executionId);
    return state ? state.executionPath : null;
  }

  // =============================================================================
  // 指标与诊断
  // =============================================================================

  /**
   * 获取服务指标
   */
  public getMetrics() {
    return {
      ...this.metrics,
      activeExecutions: this.activeExecutions.size,
      historySize: this.executionHistory.length,
      successRate: this.metrics.totalExecutions > 0
        ? (this.metrics.successfulExecutions / this.metrics.totalExecutions * 100).toFixed(2)
        : '0.00',
    };
  }

  /**
   * 获取执行统计
   */
  public getExecutionStats() {
    const phases: Record<ExecutionPhase, number> = {
      initialized: 0,
      routing: 0,
      processing: 0,
      collaborating: 0,
      integrating: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const state of this.activeExecutions.values()) {
      phases[state.phase]++;
    }

    return {
      active: this.activeExecutions.size,
      byPhase: phases,
      recentHistory: this.executionHistory.slice(-10).map((h) => ({
        executionId: h.executionId,
        agentName: h.agentName,
        phase: h.phase,
        durationMs: h.metrics.totalDurationMs,
      })),
    };
  }

  /**
   * 获取诊断信息
   */
  public getDiagnostics() {
    return {
      config: this.config,
      metrics: this.getMetrics(),
      stats: this.getExecutionStats(),
      stepCounter: this.stepCounter,
    };
  }

  // =============================================================================
  // 工具方法
  // =============================================================================

  /**
   * 生成步骤ID
   */
  private generateStepId(): string {
    return `step:${++this.stepCounter}`;
  }

  /**
   * 发送可视化事件
   */
  private emitVisualizationEvent(
    type: VisualizationEvent['type'],
    state: ExecutionState,
    data: any
  ): void {
    const event: VisualizationEvent = {
      type,
      executionId: state.executionId,
      timestamp: Date.now(),
      data,
    };

    this.emit('visualization', event);
  }

  /**
   * 更新平均执行时间
   */
  private updateAverageExecutionTime(durationMs: number): void {
    const count = this.metrics.successfulExecutions;
    this.metrics.avgExecutionTimeMs =
      (this.metrics.avgExecutionTimeMs * (count - 1) + durationMs) / count;
  }

  /**
   * 移动到历史记录
   */
  private moveToHistory(state: ExecutionState): void {
    this.executionHistory.push(state);

    if (this.executionHistory.length > this.config.historyRetention) {
      this.executionHistory.shift();
    }
  }

  /**
   * 清理最旧的执行
   */
  private evictOldestExecution(): void {
    let oldest: ExecutionState | null = null;
    let oldestKey: string | null = null;

    for (const [key, state] of this.activeExecutions.entries()) {
      if (!oldest || state.startedAt < oldest.startedAt) {
        oldest = state;
        oldestKey = key;
      }
    }

    if (oldest && oldestKey) {
      this.failExecution(oldestKey, 'Evicted due to capacity limit');
      logger.warn(`[AgentVisualizer] 清理最旧执行: ${oldestKey}`);
    }
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    this.activeExecutions.clear();
    this.executionHistory.length = 0;
    this.removeAllListeners();

    logger.info('[AgentVisualizer] Agent执行可视化服务已清理');
  }
}

// =============================================================================
// 导出
// =============================================================================

export default AgentExecutionVisualizer;