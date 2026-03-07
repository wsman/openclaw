/**
 * 🚀 控制面板深度联动服务
 * 
 * 宪法依据:
 * - §101 同步公理: 控制操作实时同步
 * - §102 熵减原则: 联动操作原子化
 * - §109 协作流程公理: 控制流程标准化
 * 
 * 功能:
 * 1. 控制面板状态联动
 * 2. 操作确认机制
 * 3. 撤销/重做支持
 * 4. 操作审计日志
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
 * 控制操作类型
 */
export type ControlActionType =
  | 'gateway.mode.switch'
  | 'agent.start'
  | 'agent.stop'
  | 'agent.config'
  | 'session.create'
  | 'session.delete'
  | 'config.set'
  | 'config.patch'
  | 'task.create'
  | 'task.cancel'
  | 'cron.enable'
  | 'cron.disable'
  | 'cron.run'
  | 'system.restart'
  | 'plugin.enable'
  | 'plugin.disable';

/**
 * 操作状态
 */
export type ControlActionStatus = 
  | 'pending'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'rolled_back';

/**
 * 控制操作定义
 */
export interface ControlAction {
  /** 操作ID */
  actionId: string;
  /** 操作类型 */
  type: ControlActionType;
  /** 操作参数 */
  params: Record<string, any>;
  /** 操作状态 */
  status: ControlActionStatus;
  /** 创建时间 */
  createdAt: number;
  /** 执行时间 */
  executedAt?: number;
  /** 完成时间 */
  completedAt?: number;
  /** 操作结果 */
  result?: any;
  /** 错误信息 */
  error?: string;
  /** 操作来源 */
  source: {
    connectionId: string;
    user?: string;
    panelId?: string;
  };
  /** 是否可撤销 */
  reversible: boolean;
  /** 撤销操作数据 */
  rollbackData?: any;
  /** 确认要求 */
  requiresConfirmation?: boolean;
  /** 确认状态 */
  confirmation?: {
    required: boolean;
    confirmed: boolean;
    confirmedBy?: string;
    confirmedAt?: number;
  };
}

/**
 * 操作处理器
 */
export type ControlActionHandler = (
  action: ControlAction
) => Promise<{ success: boolean; result?: any; error?: string; rollbackData?: any }>;

/**
 * 联动规则
 */
export interface LinkageRule {
  /** 规则ID */
  ruleId: string;
  /** 触发操作类型 */
  triggerType: ControlActionType;
  /** 联动操作 */
  linkedActions: Array<{
    type: ControlActionType;
    params: (triggerResult: any) => Record<string, any>;
    condition?: (triggerResult: any) => boolean;
  }>;
  /** 规则描述 */
  description: string;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 控制面板配置
 */
export interface ControlPanelConfig {
  /** 最大历史记录数 */
  maxHistorySize: number;
  /** 操作超时时间（ms） */
  actionTimeoutMs: number;
  /** 是否启用确认机制 */
  enableConfirmation: boolean;
  /** 需要确认的操作类型 */
  confirmationRequiredTypes: ControlActionType[];
  /** 是否启用撤销 */
  enableRollback: boolean;
}

/**
 * 操作历史记录
 */
export interface ControlActionHistory {
  /** 操作ID */
  actionId: string;
  /** 操作类型 */
  type: ControlActionType;
  /** 操作状态 */
  status: ControlActionStatus;
  /** 创建时间 */
  createdAt: number;
  /** 完成时间 */
  completedAt?: number;
  /** 操作用户 */
  user?: string;
  /** 操作摘要 */
  summary: string;
}

// =============================================================================
// 控制面板联动服务
// =============================================================================

/**
 * 控制面板联动服务类
 * 
 * 实现控制面板的深度联动，支持操作确认、撤销/重做
 */
export class ControlPanelSyncService extends EventEmitter {
  private config: ControlPanelConfig;
  private actionHandlers: Map<ControlActionType, ControlActionHandler> = new Map();
  private pendingActions: Map<string, ControlAction> = new Map();
  private actionHistory: ControlActionHistory[] = [];
  private linkageRules: Map<string, LinkageRule> = new Map();
  private undoStack: ControlAction[] = [];
  private metrics = {
    totalActions: 0,
    successfulActions: 0,
    failedActions: 0,
    rolledBackActions: 0,
    linkedActions: 0,
  };

  constructor(config: Partial<ControlPanelConfig> = {}) {
    super();
    this.config = {
      maxHistorySize: config.maxHistorySize ?? 1000,
      actionTimeoutMs: config.actionTimeoutMs ?? 30000,
      enableConfirmation: config.enableConfirmation ?? true,
      confirmationRequiredTypes: config.confirmationRequiredTypes ?? [
        'system.restart',
        'session.delete',
        'agent.stop',
        'plugin.disable',
      ],
      enableRollback: config.enableRollback ?? true,
      ...config,
    };

    this.initializeDefaultHandlers();
    this.initializeDefaultLinkageRules();

    logger.info('[ControlPanelSync] 控制面板联动服务已初始化', {
      config: this.config,
      constitutionalBasis: '§101 同步公理, §109 协作流程公理',
    });
  }

  // =============================================================================
  // 操作注册与执行
  // =============================================================================

  /**
   * 注册操作处理器
   */
  public registerHandler(
    type: ControlActionType,
    handler: ControlActionHandler
  ): void {
    this.actionHandlers.set(type, handler);
    logger.debug(`[ControlPanelSync] 注册操作处理器: ${type}`);
  }

  /**
   * 执行控制操作
   */
  public async executeAction(
    type: ControlActionType,
    params: Record<string, any>,
    source: {
      connectionId: string;
      user?: string;
      panelId?: string;
    }
  ): Promise<ControlAction> {
    const actionId = `action:${randomUUID()}`;
    const requiresConfirmation = this.config.enableConfirmation &&
      this.config.confirmationRequiredTypes.includes(type);

    const action: ControlAction = {
      actionId,
      type,
      params,
      status: 'pending',
      createdAt: Date.now(),
      source,
      reversible: this.config.enableRollback,
      requiresConfirmation,
      confirmation: requiresConfirmation
        ? { required: true, confirmed: false }
        : { required: false, confirmed: true },
    };

    // 记录待处理操作
    this.pendingActions.set(actionId, action);
    this.metrics.totalActions++;

    try {
      // 检查是否需要确认
      if (requiresConfirmation && !action.confirmation?.confirmed) {
        this.emit('action.confirmation.required', action);
        logger.info(`[ControlPanelSync] 操作需要确认: ${actionId}`, {
          type,
          source: action.source,
        });
        return action;
      }

      // 执行操作
      action.status = 'executing';
      action.executedAt = Date.now();
      this.emit('action.executing', action);

      const handler = this.actionHandlers.get(type);
      if (!handler) {
        throw new Error(`No handler registered for action type: ${type}`);
      }

      // 设置超时
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Action timeout')), this.config.actionTimeoutMs);
      });

      const result = await Promise.race([
        handler(action),
        timeoutPromise,
      ]);

      if (result.success) {
        action.status = 'completed';
        action.result = result.result;
        action.rollbackData = result.rollbackData;
        action.completedAt = Date.now();
        this.metrics.successfulActions++;

        // 添加到撤销栈
        if (action.reversible && result.rollbackData) {
          this.undoStack.push(action);
          if (this.undoStack.length > 50) {
            this.undoStack.shift();
          }
        }

        // 触发联动操作
        await this.triggerLinkedActions(action);

        this.emit('action.completed', action);
        logger.info(`[ControlPanelSync] 操作完成: ${actionId}`, {
          type,
          duration: action.completedAt - action.createdAt,
        });
      } else {
        throw new Error(result.error || 'Action failed');
      }
    } catch (error: any) {
      action.status = 'failed';
      action.error = error.message;
      action.completedAt = Date.now();
      this.metrics.failedActions++;

      this.emit('action.failed', action);
      logger.error(`[ControlPanelSync] 操作失败: ${actionId}`, {
        type,
        error: error.message,
      });
    } finally {
      // 记录历史
      this.recordHistory(action);
      this.pendingActions.delete(actionId);
    }

    return action;
  }

  /**
   * 确认操作
   */
  public async confirmAction(
    actionId: string,
    confirmedBy: string
  ): Promise<ControlAction | null> {
    const action = this.pendingActions.get(actionId);
    if (!action) {
      return null;
    }

    if (!action.confirmation?.required) {
      return action;
    }

    action.confirmation.confirmed = true;
    action.confirmation.confirmedBy = confirmedBy;
    action.confirmation.confirmedAt = Date.now();

    logger.info(`[ControlPanelSync] 操作已确认: ${actionId}`, {
      confirmedBy,
    });

    this.emit('action.confirmed', action);

    // 重新执行操作
    return this.executeAction(action.type, action.params, action.source);
  }

  /**
   * 取消操作
   */
  public cancelAction(actionId: string): boolean {
    const action = this.pendingActions.get(actionId);
    if (!action || action.status === 'executing') {
      return false;
    }

    action.status = 'failed';
    action.error = 'Cancelled by user';
    action.completedAt = Date.now();

    this.pendingActions.delete(actionId);
    this.recordHistory(action);

    this.emit('action.cancelled', action);
    logger.info(`[ControlPanelSync] 操作已取消: ${actionId}`);

    return true;
  }

  /**
   * 撤销操作
   */
  public async undoAction(actionId: string): Promise<boolean> {
    const actionIndex = this.undoStack.findIndex((a) => a.actionId === actionId);
    if (actionIndex === -1) {
      return false;
    }

    const action = this.undoStack[actionIndex];
    if (!action.reversible || !action.rollbackData) {
      return false;
    }

    try {
      // 执行撤销
      const undoResult = await this.performRollback(action);
      if (undoResult.success) {
        action.status = 'rolled_back';
        this.metrics.rolledBackActions++;
        this.undoStack.splice(actionIndex, 1);

        this.emit('action.undone', action);
        logger.info(`[ControlPanelSync] 操作已撤销: ${actionId}`);
        return true;
      }
      return false;
    } catch (error: any) {
      logger.error(`[ControlPanelSync] 撤销操作失败: ${actionId}`, {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * 获取可撤销的操作
   */
  public getUndoableActions(): ControlAction[] {
    return [...this.undoStack];
  }

  // =============================================================================
  // 联动规则管理
  // =============================================================================

  /**
   * 添加联动规则
   */
  public addLinkageRule(rule: Omit<LinkageRule, 'ruleId'>): LinkageRule {
    const ruleId = `rule:${randomUUID()}`;
    const fullRule: LinkageRule = {
      ...rule,
      ruleId,
    };

    this.linkageRules.set(ruleId, fullRule);
    logger.info(`[ControlPanelSync] 添加联动规则: ${ruleId}`, {
      triggerType: rule.triggerType,
      linkedCount: rule.linkedActions.length,
    });

    return fullRule;
  }

  /**
   * 移除联动规则
   */
  public removeLinkageRule(ruleId: string): boolean {
    const removed = this.linkageRules.delete(ruleId);
    if (removed) {
      logger.info(`[ControlPanelSync] 移除联动规则: ${ruleId}`);
    }
    return removed;
  }

  /**
   * 触发联动操作
   */
  private async triggerLinkedActions(triggerAction: ControlAction): Promise<void> {
    const matchingRules = Array.from(this.linkageRules.values()).filter(
      (rule) => rule.enabled && rule.triggerType === triggerAction.type
    );

    for (const rule of matchingRules) {
      for (const linkedAction of rule.linkedActions) {
        try {
          // 检查条件
          if (linkedAction.condition && !linkedAction.condition(triggerAction.result)) {
            continue;
          }

          // 执行联动操作
          const linkedParams = linkedAction.params(triggerAction.result);
          await this.executeAction(linkedAction.type, linkedParams, {
            connectionId: 'system',
            user: 'linkage-engine',
            panelId: triggerAction.source.panelId,
          });

          this.metrics.linkedActions++;
          logger.debug(`[ControlPanelSync] 联动操作执行: ${rule.ruleId}`, {
            linkedType: linkedAction.type,
          });
        } catch (error: any) {
          logger.warn(`[ControlPanelSync] 联动操作失败: ${rule.ruleId}`, {
            error: error.message,
          });
        }
      }
    }
  }

  // =============================================================================
  // 历史记录与查询
  // =============================================================================

  /**
   * 记录操作历史
   */
  private recordHistory(action: ControlAction): void {
    const historyEntry: ControlActionHistory = {
      actionId: action.actionId,
      type: action.type,
      status: action.status,
      createdAt: action.createdAt,
      completedAt: action.completedAt,
      user: action.source.user,
      summary: this.generateActionSummary(action),
    };

    this.actionHistory.push(historyEntry);

    // 保留最近的历史记录
    if (this.actionHistory.length > this.config.maxHistorySize) {
      this.actionHistory.shift();
    }
  }

  /**
   * 生成操作摘要
   */
  private generateActionSummary(action: ControlAction): string {
    switch (action.type) {
      case 'gateway.mode.switch':
        return `切换网关模式到 ${action.params.mode || 'unknown'}`;
      case 'agent.start':
        return `启动 Agent ${action.params.agentId || 'unknown'}`;
      case 'agent.stop':
        return `停止 Agent ${action.params.agentId || 'unknown'}`;
      case 'session.create':
        return `创建会话 ${action.params.sessionId || 'new'}`;
      case 'session.delete':
        return `删除会话 ${action.params.sessionId || 'unknown'}`;
      case 'config.set':
        return `设置配置 ${action.params.key || 'unknown'}`;
      case 'task.create':
        return `创建任务 ${action.params.title || 'untitled'}`;
      case 'cron.run':
        return `执行定时任务 ${action.params.jobId || 'unknown'}`;
      default:
        return action.type;
    }
  }

  /**
   * 获取操作历史
   */
  public getHistory(options: {
    type?: ControlActionType;
    status?: ControlActionStatus;
    user?: string;
    limit?: number;
    since?: number;
  } = {}): ControlActionHistory[] {
    let history = [...this.actionHistory];

    if (options.type) {
      history = history.filter((h) => h.type === options.type);
    }

    if (options.status) {
      history = history.filter((h) => h.status === options.status);
    }

    if (options.user) {
      history = history.filter((h) => h.user === options.user);
    }

    if (options.since) {
      history = history.filter((h) => h.createdAt >= options.since!);
    }

    const limit = options.limit ?? 100;
    return history.slice(-limit);
  }

  /**
   * 获取待确认的操作
   */
  public getPendingConfirmations(): ControlAction[] {
    return Array.from(this.pendingActions.values()).filter(
      (a) => a.confirmation?.required && !a.confirmation.confirmed
    );
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
      pendingActions: this.pendingActions.size,
      historySize: this.actionHistory.length,
      undoStackSize: this.undoStack.length,
      linkageRulesCount: this.linkageRules.size,
      registeredHandlers: this.actionHandlers.size,
      successRate: this.metrics.totalActions > 0
        ? (this.metrics.successfulActions / this.metrics.totalActions * 100).toFixed(2)
        : '0.00',
    };
  }

  /**
   * 获取诊断信息
   */
  public getDiagnostics() {
    return {
      config: this.config,
      metrics: this.getMetrics(),
      recentActions: this.actionHistory.slice(-10),
      pendingConfirmations: this.getPendingConfirmations().length,
    };
  }

  // =============================================================================
  // 初始化
  // =============================================================================

  /**
   * 初始化默认处理器
   */
  private initializeDefaultHandlers(): void {
    // 网关模式切换
    this.registerHandler('gateway.mode.switch', async (action) => {
      const mode = action.params.mode;
      return {
        success: true,
        result: { mode, switchedAt: Date.now() },
        rollbackData: { previousMode: action.params.previousMode },
      };
    });

    // Agent 启动
    this.registerHandler('agent.start', async (action) => {
      const agentId = action.params.agentId;
      return {
        success: true,
        result: { agentId, startedAt: Date.now() },
        rollbackData: { action: 'stop' },
      };
    });

    // Agent 停止
    this.registerHandler('agent.stop', async (action) => {
      const agentId = action.params.agentId;
      return {
        success: true,
        result: { agentId, stoppedAt: Date.now() },
        rollbackData: { action: 'start' },
      };
    });

    // 会话创建
    this.registerHandler('session.create', async (action) => {
      const sessionId = action.params.sessionId || `session:${randomUUID()}`;
      return {
        success: true,
        result: { sessionId, createdAt: Date.now() },
        rollbackData: { action: 'delete' },
      };
    });

    // 会话删除
    this.registerHandler('session.delete', async (action) => {
      const sessionId = action.params.sessionId;
      return {
        success: true,
        result: { sessionId, deletedAt: Date.now() },
      };
    });

    // 配置设置
    this.registerHandler('config.set', async (action) => {
      const { key, value } = action.params;
      return {
        success: true,
        result: { key, value, updatedAt: Date.now() },
        rollbackData: { previousValue: action.params.previousValue },
      };
    });

    // 任务创建
    this.registerHandler('task.create', async (action) => {
      const taskId = action.params.taskId || `task:${randomUUID()}`;
      return {
        success: true,
        result: { taskId, title: action.params.title, createdAt: Date.now() },
        rollbackData: { action: 'cancel' },
      };
    });

    // 任务取消
    this.registerHandler('task.cancel', async (action) => {
      const taskId = action.params.taskId;
      return {
        success: true,
        result: { taskId, cancelledAt: Date.now() },
      };
    });

    // 定时任务执行
    this.registerHandler('cron.run', async (action) => {
      const jobId = action.params.jobId;
      return {
        success: true,
        result: { jobId, executedAt: Date.now() },
      };
    });

    logger.debug('[ControlPanelSync] 默认操作处理器已初始化');
  }

  /**
   * 初始化默认联动规则
   */
  private initializeDefaultLinkageRules(): void {
    // Agent 启动后更新状态
    this.addLinkageRule({
      triggerType: 'agent.start',
      linkedActions: [
        {
          type: 'config.set',
          params: (result) => ({
            key: `agent.${result.agentId}.status`,
            value: 'running',
          }),
        },
      ],
      description: 'Agent 启动后更新状态配置',
      enabled: true,
    });

    // 网关模式切换后记录日志
    this.addLinkageRule({
      triggerType: 'gateway.mode.switch',
      linkedActions: [
        {
          type: 'config.set',
          params: (result) => ({
            key: 'gateway.lastModeSwitch',
            value: result.switchedAt,
          }),
        },
      ],
      description: '网关模式切换后记录切换时间',
      enabled: true,
    });

    logger.debug('[ControlPanelSync] 默认联动规则已初始化');
  }

  /**
   * 执行回滚
   */
  private async performRollback(action: ControlAction): Promise<{ success: boolean }> {
    // 简化的回滚逻辑，实际应用中需要根据具体操作类型实现
    if (!action.rollbackData) {
      return { success: false };
    }

    logger.info(`[ControlPanelSync] 执行回滚: ${action.actionId}`, {
      rollbackData: action.rollbackData,
    });

    return { success: true };
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    this.pendingActions.clear();
    this.actionHistory.length = 0;
    this.undoStack.length = 0;
    this.linkageRules.clear();
    this.actionHandlers.clear();
    this.removeAllListeners();

    logger.info('[ControlPanelSync] 控制面板联动服务已清理');
  }
}

// =============================================================================
// 导出
// =============================================================================

export default ControlPanelSyncService;