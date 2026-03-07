/**
 * 🚀 任务队列可视化服务
 * 
 * 宪法依据:
 * - §101 同步公理: 队列状态实时同步
 * - §102 熵减原则: 增量更新减少传输
 * - §110 协作效率公理: 任务执行效率监控
 * 
 * 功能:
 * 1. 任务队列状态实时追踪
 * 2. 任务优先级可视化
 * 3. 队列健康度监控
 * 4. 任务执行历史
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
 * 任务状态
 */
export type TaskStatus = 
  | 'pending'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * 任务优先级
 */
export type TaskPriority = 'critical' | 'high' | 'normal' | 'low';

/**
 * 任务定义
 */
export interface Task {
  /** 任务ID */
  taskId: string;
  /** 任务名称 */
  name: string;
  /** 任务类型 */
  type: string;
  /** 优先级 */
  priority: TaskPriority;
  /** 状态 */
  status: TaskStatus;
  /** 创建时间 */
  createdAt: number;
  /** 开始时间 */
  startedAt?: number;
  /** 完成时间 */
  completedAt?: number;
  /** 执行时长 */
  durationMs?: number;
  /** 进度 (0-100) */
  progress: number;
  /** 输入参数 */
  input?: any;
  /** 输出结果 */
  output?: any;
  /** 错误信息 */
  error?: string;
  /** 重试次数 */
  retries: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 队列状态
 */
export interface QueueState {
  /** 队列ID */
  queueId: string;
  /** 队列名称 */
  name: string;
  /** 队列类型 */
  type: string;
  /** 待处理任务数 */
  pendingCount: number;
  /** 运行中任务数 */
  runningCount: number;
  /** 已完成任务数 */
  completedCount: number;
  /** 失败任务数 */
  failedCount: number;
  /** 最大并发数 */
  maxConcurrency: number;
  /** 当前吞吐量 (任务/秒) */
  throughput: number;
  /** 平均等待时间 (ms) */
  avgWaitTimeMs: number;
  /** 平均执行时间 (ms) */
  avgExecutionTimeMs: number;
  /** 健康状态 */
  health: 'healthy' | 'degraded' | 'unhealthy';
  /** 更新时间 */
  updatedAt: number;
}

/**
 * 队列健康报告
 */
export interface QueueHealthReport {
  /** 队列ID */
  queueId: string;
  /** 健康状态 */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** 检查时间 */
  checkedAt: number;
  /** 问题列表 */
  issues: Array<{
    severity: 'warning' | 'error';
    message: string;
    metric?: string;
    value?: number;
    threshold?: number;
  }>;
  /** 建议 */
  recommendations: string[];
}

/**
 * 可视化配置
 */
export interface VisualizerConfig {
  /** 最大历史记录数 */
  maxHistorySize: number;
  /** 健康检查间隔 (ms) */
  healthCheckIntervalMs: number;
  /** 吞吐量计算窗口 (秒) */
  throughputWindowSec: number;
  /** 告警阈值 */
  alertThresholds: {
    maxPendingTasks: number;
    maxWaitTimeMs: number;
    maxErrorRate: number;
  };
}

// =============================================================================
// 任务队列可视化服务
// =============================================================================

/**
 * 任务队列可视化服务类
 */
export class TaskQueueVisualizer extends EventEmitter {
  private config: VisualizerConfig;
  private queues: Map<string, QueueState> = new Map();
  private tasks: Map<string, Task> = new Map();
  private taskHistory: Task[] = [];
  private queueTasks: Map<string, Set<string>> = new Map();
  private healthCheckTimer?: NodeJS.Timeout;
  private metrics = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    avgCompletionTimeMs: 0,
    peakConcurrency: 0,
  };

  constructor(config: Partial<VisualizerConfig> = {}) {
    super();
    this.config = {
      maxHistorySize: config.maxHistorySize ?? 1000,
      healthCheckIntervalMs: config.healthCheckIntervalMs ?? 30000,
      throughputWindowSec: config.throughputWindowSec ?? 60,
      alertThresholds: {
        maxPendingTasks: config.alertThresholds?.maxPendingTasks ?? 100,
        maxWaitTimeMs: config.alertThresholds?.maxWaitTimeMs ?? 30000,
        maxErrorRate: config.alertThresholds?.maxErrorRate ?? 0.1,
      },
      ...config,
    };

    this.startHealthCheck();

    logger.info('[TaskQueueVisualizer] 任务队列可视化服务已初始化', {
      config: this.config,
    });
  }

  // =============================================================================
  // 队列管理
  // =============================================================================

  /**
   * 注册队列
   */
  public registerQueue(params: {
    queueId?: string;
    name: string;
    type: string;
    maxConcurrency?: number;
  }): QueueState {
    const queueId = params.queueId || `queue:${randomUUID()}`;
    const now = Date.now();

    const state: QueueState = {
      queueId,
      name: params.name,
      type: params.type,
      pendingCount: 0,
      runningCount: 0,
      completedCount: 0,
      failedCount: 0,
      maxConcurrency: params.maxConcurrency ?? 10,
      throughput: 0,
      avgWaitTimeMs: 0,
      avgExecutionTimeMs: 0,
      health: 'healthy',
      updatedAt: now,
    };

    this.queues.set(queueId, state);
    this.queueTasks.set(queueId, new Set());

    this.emit('queue.registered', state);

    logger.debug(`[TaskQueueVisualizer] 队列已注册: ${queueId}`, {
      name: params.name,
      type: params.type,
    });

    return state;
  }

  /**
   * 注销队列
   */
  public unregisterQueue(queueId: string): boolean {
    if (!this.queues.has(queueId)) {
      return false;
    }

    this.queues.delete(queueId);
    this.queueTasks.delete(queueId);

    this.emit('queue.unregistered', { queueId });
    return true;
  }

  // =============================================================================
  // 任务管理
  // =============================================================================

  /**
   * 添加任务到队列
   */
  public addTask(queueId: string, task: Omit<Task, 'taskId' | 'status' | 'createdAt' | 'progress' | 'retries'>): Task | null {
    const queue = this.queues.get(queueId);
    if (!queue) {
      return null;
    }

    const taskId = `task:${randomUUID()}`;
    const now = Date.now();

    const fullTask: Task = {
      ...task,
      taskId,
      status: 'pending',
      createdAt: now,
      progress: 0,
      retries: 0,
      maxRetries: task.maxRetries ?? 3,
    };

    this.tasks.set(taskId, fullTask);
    this.queueTasks.get(queueId)?.add(taskId);
    queue.pendingCount++;
    queue.updatedAt = now;
    this.metrics.totalTasks++;

    this.emit('task.added', { queueId, task: fullTask });

    logger.debug(`[TaskQueueVisualizer] 任务已添加: ${taskId}`, {
      queueId,
      name: task.name,
      priority: task.priority,
    });

    return fullTask;
  }

  /**
   * 开始执行任务
   */
  public startTask(queueId: string, taskId: string): boolean {
    const queue = this.queues.get(queueId);
    const task = this.tasks.get(taskId);

    if (!queue || !task || task.status !== 'pending') {
      return false;
    }

    const now = Date.now();
    task.status = 'running';
    task.startedAt = now;

    queue.pendingCount--;
    queue.runningCount++;
    queue.updatedAt = now;

    // 更新峰值并发
    if (queue.runningCount > this.metrics.peakConcurrency) {
      this.metrics.peakConcurrency = queue.runningCount;
    }

    this.emit('task.started', { queueId, task });

    return true;
  }

  /**
   * 更新任务进度
   */
  public updateTaskProgress(taskId: string, progress: number): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'running') {
      return false;
    }

    task.progress = Math.min(100, Math.max(0, progress));
    this.emit('task.progress', { taskId, progress: task.progress });

    return true;
  }

  /**
   * 完成任务
   */
  public completeTask(queueId: string, taskId: string, output?: any): boolean {
    const queue = this.queues.get(queueId);
    const task = this.tasks.get(taskId);

    if (!queue || !task || task.status !== 'running') {
      return false;
    }

    const now = Date.now();
    task.status = 'completed';
    task.completedAt = now;
    task.durationMs = now - (task.startedAt || task.createdAt);
    task.progress = 100;
    task.output = output;

    queue.runningCount--;
    queue.completedCount++;
    queue.updatedAt = now;

    this.metrics.completedTasks++;
    this.updateAvgCompletionTime(task.durationMs);

    this.emit('task.completed', { queueId, task });
    this.moveToHistory(task);

    return true;
  }

  /**
   * 任务失败
   */
  public failTask(queueId: string, taskId: string, error: string): boolean {
    const queue = this.queues.get(queueId);
    const task = this.tasks.get(taskId);

    if (!queue || !task) {
      return false;
    }

    const now = Date.now();
    task.error = error;
    task.completedAt = now;

    if (task.status === 'running') {
      queue.runningCount--;
    } else if (task.status === 'pending') {
      queue.pendingCount--;
    }

    // 检查是否需要重试
    if (task.retries < task.maxRetries) {
      task.retries++;
      task.status = 'pending';
      queue.pendingCount++;
      this.emit('task.retry', { queueId, task, error });
    } else {
      task.status = 'failed';
      queue.failedCount++;
      this.metrics.failedTasks++;
      this.emit('task.failed', { queueId, task, error });
      this.moveToHistory(task);
    }

    queue.updatedAt = now;
    return true;
  }

  /**
   * 取消任务
   */
  public cancelTask(queueId: string, taskId: string): boolean {
    const queue = this.queues.get(queueId);
    const task = this.tasks.get(taskId);

    if (!queue || !task) {
      return false;
    }

    const now = Date.now();
    const previousStatus = task.status;
    task.status = 'cancelled';
    task.completedAt = now;

    if (previousStatus === 'running') {
      queue.runningCount--;
    } else if (previousStatus === 'pending') {
      queue.pendingCount--;
    }

    queue.updatedAt = now;
    this.emit('task.cancelled', { queueId, task });
    this.moveToHistory(task);

    return true;
  }

  // =============================================================================
  // 查询与可视化
  // =============================================================================

  /**
   * 获取队列状态
   */
  public getQueueState(queueId: string): QueueState | null {
    return this.queues.get(queueId) || null;
  }

  /**
   * 获取所有队列状态
   */
  public getAllQueues(): QueueState[] {
    return Array.from(this.queues.values());
  }

  /**
   * 获取任务详情
   */
  public getTask(taskId: string): Task | null {
    return this.tasks.get(taskId) || null;
  }

  /**
   * 获取队列中的任务
   */
  public getQueueTasks(queueId: string, options: {
    status?: TaskStatus;
    priority?: TaskPriority;
    limit?: number;
  } = {}): Task[] {
    const taskIds = this.queueTasks.get(queueId);
    if (!taskIds) {
      return [];
    }

    let tasks = Array.from(taskIds)
      .map((id) => this.tasks.get(id))
      .filter((t): t is Task => t !== undefined);

    if (options.status) {
      tasks = tasks.filter((t) => t.status === options.status);
    }

    if (options.priority) {
      tasks = tasks.filter((t) => t.priority === options.priority);
    }

    // 按优先级排序
    const priorityOrder: Record<TaskPriority, number> = {
      critical: 0,
      high: 1,
      normal: 2,
      low: 3,
    };
    tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return tasks.slice(0, options.limit ?? 100);
  }

  /**
   * 获取任务历史
   */
  public getTaskHistory(options: {
    queueId?: string;
    status?: TaskStatus;
    limit?: number;
    since?: number;
  } = {}): Task[] {
    let history = [...this.taskHistory];

    if (options.queueId) {
      const queueTaskIds = this.queueTasks.get(options.queueId);
      if (queueTaskIds) {
        history = history.filter((t) => queueTaskIds.has(t.taskId));
      }
    }

    if (options.status) {
      history = history.filter((t) => t.status === options.status);
    }

    if (options.since) {
      history = history.filter((t) => t.createdAt >= options.since!);
    }

    return history.slice(-(options.limit ?? 100));
  }

  /**
   * 获取队列可视化数据
   */
  public getQueueVisualization(queueId: string): any {
    const queue = this.queues.get(queueId);
    if (!queue) {
      return null;
    }

    const tasks = this.getQueueTasks(queueId);

    return {
      queue,
      tasks: {
        pending: tasks.filter((t) => t.status === 'pending'),
        running: tasks.filter((t) => t.status === 'running'),
        recent: this.taskHistory.slice(-10).filter((t) =>
          this.queueTasks.get(queueId)?.has(t.taskId)
        ),
      },
      metrics: {
        avgWaitTimeMs: queue.avgWaitTimeMs,
        avgExecutionTimeMs: queue.avgExecutionTimeMs,
        throughput: queue.throughput,
        errorRate: queue.completedCount + queue.failedCount > 0
          ? queue.failedCount / (queue.completedCount + queue.failedCount)
          : 0,
      },
    };
  }

  // =============================================================================
  // 健康检查
  // =============================================================================

  /**
   * 执行健康检查
   */
  public checkQueueHealth(queueId: string): QueueHealthReport | null {
    const queue = this.queues.get(queueId);
    if (!queue) {
      return null;
    }

    const issues: QueueHealthReport['issues'] = [];
    const recommendations: string[] = [];
    const now = Date.now();

    // 检查待处理任务数量
    if (queue.pendingCount > this.config.alertThresholds.maxPendingTasks) {
      issues.push({
        severity: 'warning',
        message: `待处理任务数量过高: ${queue.pendingCount}`,
        metric: 'pendingCount',
        value: queue.pendingCount,
        threshold: this.config.alertThresholds.maxPendingTasks,
      });
      recommendations.push('考虑增加worker数量或提高并发限制');
    }

    // 检查平均等待时间
    if (queue.avgWaitTimeMs > this.config.alertThresholds.maxWaitTimeMs) {
      issues.push({
        severity: 'warning',
        message: `平均等待时间过长: ${queue.avgWaitTimeMs}ms`,
        metric: 'avgWaitTimeMs',
        value: queue.avgWaitTimeMs,
        threshold: this.config.alertThresholds.maxWaitTimeMs,
      });
      recommendations.push('检查worker处理能力或优化任务执行');
    }

    // 检查错误率
    const totalProcessed = queue.completedCount + queue.failedCount;
    const errorRate = totalProcessed > 0 ? queue.failedCount / totalProcessed : 0;
    if (errorRate > this.config.alertThresholds.maxErrorRate) {
      issues.push({
        severity: 'error',
        message: `错误率过高: ${(errorRate * 100).toFixed(2)}%`,
        metric: 'errorRate',
        value: errorRate,
        threshold: this.config.alertThresholds.maxErrorRate,
      });
      recommendations.push('检查任务失败原因并修复');
    }

    // 确定健康状态
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (issues.some((i) => i.severity === 'error')) {
      status = 'unhealthy';
    } else if (issues.length > 0) {
      status = 'degraded';
    }

    queue.health = status;

    return {
      queueId,
      status,
      checkedAt: now,
      issues,
      recommendations,
    };
  }

  /**
   * 启动定时健康检查
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      for (const queueId of this.queues.keys()) {
        const report = this.checkQueueHealth(queueId);
        if (report && report.status !== 'healthy') {
          this.emit('queue.health.warning', report);
        }
      }
    }, this.config.healthCheckIntervalMs);
  }

  // =============================================================================
  // 工具方法
  // =============================================================================

  /**
   * 移动到历史记录
   */
  private moveToHistory(task: Task): void {
    this.tasks.delete(task.taskId);

    // 从队列任务集合中移除
    for (const taskIds of this.queueTasks.values()) {
      taskIds.delete(task.taskId);
    }

    this.taskHistory.push(task);

    if (this.taskHistory.length > this.config.maxHistorySize) {
      this.taskHistory.shift();
    }
  }

  /**
   * 更新平均完成时间
   */
  private updateAvgCompletionTime(durationMs: number): void {
    const count = this.metrics.completedTasks;
    this.metrics.avgCompletionTimeMs =
      (this.metrics.avgCompletionTimeMs * (count - 1) + durationMs) / count;
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
      activeQueues: this.queues.size,
      activeTasks: this.tasks.size,
      historySize: this.taskHistory.length,
    };
  }

  /**
   * 获取诊断信息
   */
  public getDiagnostics() {
    return {
      config: this.config,
      metrics: this.getMetrics(),
      queues: this.getAllQueues().map((q) => ({
        queueId: q.queueId,
        name: q.name,
        health: q.health,
        pending: q.pendingCount,
        running: q.runningCount,
      })),
    };
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.queues.clear();
    this.tasks.clear();
    this.taskHistory.length = 0;
    this.queueTasks.clear();
    this.removeAllListeners();

    logger.info('[TaskQueueVisualizer] 任务队列可视化服务已清理');
  }
}

// =============================================================================
// 导出
// =============================================================================

export default TaskQueueVisualizer;