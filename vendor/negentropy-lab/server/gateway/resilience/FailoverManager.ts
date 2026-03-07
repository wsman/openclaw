/**
 * 🔄 故障转移管理器 - 自动模型切换和恢复
 * 
 * 宪法依据:
 * - §306 零停机协议: 自动故障转移，确保服务连续性
 * - §108 异构模型策略: 跨提供商故障转移
 * - §102 熵减原则: 复用ModelRegistry和CapabilityMatcher
 * 
 * 功能:
 * - 自动检测模型故障
 * - 智能选择备用模型
 * - 故障历史记录
 * - 自动恢复机制
 * 
 * @version 1.0.0 (批次4-2)
 * @category Gateway/Resilience
 */

import { ModelAdapter, HealthStatus } from '../llm/adapters/ModelAdapter';
import { ModelRegistry } from '../llm/ModelRegistry';
import { CapabilityMatcher, TaskRequirements } from '../llm/CapabilityMatcher';
import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';
import { ChatRequest, ChatResponse } from '../llm/adapters/BaseAdapter';

// 在测试环境中，logger可能不可用，提供fallback
const log = logger || {
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug
};

/**
 * 故障事件
 */
export interface FailureEvent {
  /** 唯一标识 */
  id: string;
  
  /** 失败的适配器 */
  adapterId: string;
  
  /** 提供商 */
  provider: string;
  
  /** 模型 */
  model: string;
  
  /** 错误类型 */
  errorType: string;
  
  /** 错误消息 */
  errorMessage: string;
  
  /** 时间戳 */
  timestamp: Date;
  
  /** 是否已恢复 */
  recovered: boolean;
  
  /** 恢复时间 */
  recoveredAt?: Date;
  
  /** 使用的备用模型 */
  backupAdapterId?: string;
}

/**
 * 故障转移配置
 */
export interface FailoverConfig {
  /** 是否启用自动故障转移 */
  enableAutoFailover?: boolean;
  
  /** 故障检测超时（毫秒） */
  failureDetectionTimeout?: number;
  
  /** 最大重试次数 */
  maxRetryAttempts?: number;
  
  /** 故障历史保留天数 */
  historyRetentionDays?: number;
  
  /** 是否启用跨提供商故障转移 */
  enableCrossProviderFailover?: boolean;
  
  /** 优先使用同提供商的备用模型 */
  preferSameProvider?: boolean;
}

/**
 * 故障转移结果
 */
export interface FailoverResult {
  /** 是否成功 */
  success: boolean;
  
  /** 使用的适配器 */
  adapter?: ModelAdapter;
  
  /** 故障事件ID */
  failureEventId?: string;
  
  /** 错误消息 */
  errorMessage?: string;
  
  /** 降级层级 */
  degradationLayer?: number;
}

/**
 * 故障转移管理器
 * 
 * 自动检测模型故障，智能选择备用模型，实现零停机
 */
export class FailoverManager extends EventEmitter {
  private config: Required<FailoverConfig>;
  private registry: ModelRegistry;
  private matcher: CapabilityMatcher;
  private failureHistory: FailureEvent[] = [];
  private circuitBreakers: Map<string, any> = new Map();
  
  constructor(
    registry: ModelRegistry,
    matcher: CapabilityMatcher,
    config: FailoverConfig = {}
  ) {
    super();
    
    this.registry = registry;
    this.matcher = matcher;
    this.config = {
      enableAutoFailover: config.enableAutoFailover ?? true,
      failureDetectionTimeout: config.failureDetectionTimeout ?? 5000,
      maxRetryAttempts: config.maxRetryAttempts ?? 3,
      historyRetentionDays: config.historyRetentionDays ?? 7,
      enableCrossProviderFailover: config.enableCrossProviderFailover ?? true,
      preferSameProvider: config.preferSameProvider ?? true
    };
    
    log.info('故障转移管理器初始化', {
      autoFailover: this.config.enableAutoFailover,
      crossProvider: this.config.enableCrossProviderFailover
    });
    
    // 定期清理过期故障记录
    setInterval(() => {
      this.cleanExpiredHistory();
    }, 3600000); // 每小时清理一次
  }
  
  /**
   * 处理模型故障
   */
  async handleFailure(
    primaryAdapter: ModelAdapter,
    error: Error,
    request: ChatRequest
  ): Promise<ChatResponse> {
    const adapterId = `${primaryAdapter.provider}:${primaryAdapter.model}`;
    const errorType = this.classifyError(error);
    
    log.warn(`模型故障: ${adapterId}`, {
      errorType,
      errorMessage: error.message
    });
    
    // 记录故障事件
    const failureEvent = this.recordFailure(primaryAdapter, error);
    
    // 判断是否需要故障转移
    if (!this.shouldFailover(error)) {
      log.warn(`不满足故障转移条件: ${adapterId}`);
      throw error;
    }
    
    // 选择备用模型
    const backup = await this.selectBackup(primaryAdapter, request);
    
    if (!backup) {
      log.error(`无可用备用模型: ${adapterId}`);
      throw new Error(`模型故障且无可用备用模型: ${error.message}`);
    }
    
    log.info(`切换到备用模型: ${backup.provider}:${backup.model}`);
    
    // 更新故障事件
    failureEvent.backupAdapterId = `${backup.provider}:${backup.model}`;
    
    try {
      // 使用备用模型执行请求
      const response = await backup.chat(request);
      
      log.info(`故障转移成功: ${adapterId} -> ${backup.provider}:${backup.model}`);
      this.emit('failover-success', {
        primary: adapterId,
        backup: `${backup.provider}:${backup.model}`,
        failureEventId: failureEvent.id
      });
      
      return response;
      
    } catch (backupError: any) {
      log.error(`备用模型也失败: ${backup.provider}:${backup.model}`, backupError);
      throw new Error(`主模型和备用模型均失败: ${error.message}, ${backupError.message}`);
    }
  }
  
  /**
   * 选择备用模型
   */
  private async selectBackup(
    failedAdapter: ModelAdapter,
    request: ChatRequest
  ): Promise<ModelAdapter | null> {
    const failedProvider = failedAdapter.provider;
    const failedModel = failedAdapter.model;
    
    // 获取所有可用模型
    const allAdapters = this.registry.list();
    
    // 排除失败的模型
    const candidates = allAdapters.filter(
      a => `${a.provider}:${a.model}` !== `${failedProvider}:${failedModel}`
    );
    
    if (candidates.length === 0) {
      log.warn('无可用备用模型');
      return null;
    }
    
    // 优先选择同提供商的备用模型
    if (this.config.preferSameProvider) {
      const sameProviderCandidates = candidates.filter(a => a.provider === failedProvider);
      
      if (sameProviderCandidates.length > 0) {
        log.debug(`找到 ${sameProviderCandidates.length} 个同提供商备用模型`);
        
        // 按优先级排序
        sameProviderCandidates.sort((a, b) => {
          const regA = this.registry.listRegistrations().get(`${a.provider}:${a.model}`);
          const regB = this.registry.listRegistrations().get(`${b.provider}:${b.model}`);
          return (regA?.priority ?? 100) - (regB?.priority ?? 100);
        });
        
        return sameProviderCandidates[0];
      }
    }
    
    // 跨提供商故障转移
    if (this.config.enableCrossProviderFailover) {
      log.debug(`使用跨提供商故障转移`);
      
      // 分析任务需求
      const taskRequirements = this.analyzeRequirements(request);
      
      // 使用CapabilityMatcher选择最优模型
      const bestMatch = this.matcher.selectBest(candidates, taskRequirements);
      
      if (bestMatch) {
        return bestMatch.adapter;
      }
    }
    
    // 默认：按优先级选择第一个
    candidates.sort((a, b) => {
      const regA = this.registry.listRegistrations().get(`${a.provider}:${a.model}`);
      const regB = this.registry.listRegistrations().get(`${b.provider}:${b.model}`);
      return (regA?.priority ?? 100) - (regB?.priority ?? 100);
    });
    
    return candidates[0];
  }
  
  /**
   * 分析任务需求
   */
  private analyzeRequirements(request: ChatRequest): TaskRequirements {
    // 简化实现，从请求中提取需求
    const messages = request.messages || [];
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage?.content || '';
    
    return {
      estimatedTokens: Math.ceil(content.length * 0.5),
      qualityType: 'reasoning',
      minQuality: 'intermediate',
      needsStreaming: request.stream ?? false,
      needsFunctionCall: false,
      needsVision: false
    };
  }
  
  /**
   * 记录故障事件
   */
  recordFailure(adapter: ModelAdapter, error: Error): FailureEvent {
    const adapterId = `${adapter.provider}:${adapter.model}`;
    
    const event: FailureEvent = {
      id: `fail_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      adapterId,
      provider: adapter.provider,
      model: adapter.model,
      errorType: this.classifyError(error),
      errorMessage: error.message,
      timestamp: new Date(),
      recovered: false
    };
    
    this.failureHistory.push(event);
    
    log.info(`记录故障事件: ${event.id}`, {
      adapterId,
      errorType: event.errorType
    });
    
    this.emit('failure-recorded', event);
    
    return event;
  }
  
  /**
   * 分类错误类型
   */
  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    }
    
    if (message.includes('network') || message.includes('connection')) {
      return 'network';
    }
    
    if (message.includes('rate limit') || message.includes('quota')) {
      return 'rate_limit';
    }
    
    if (message.includes('auth') || message.includes('token') || message.includes('unauthorized')) {
      return 'auth';
    }
    
    if (message.includes('invalid') || message.includes('validation')) {
      return 'validation';
    }
    
    return 'unknown';
  }
  
  /**
   * 判断是否需要故障转移
   */
  shouldFailover(error: Error): boolean {
    if (!this.config.enableAutoFailover) {
      return false;
    }
    
    const errorType = this.classifyError(error);
    
    // 这些错误类型通常需要故障转移
    const failoverErrors = ['timeout', 'network', 'rate_limit'];
    
    return failoverErrors.includes(errorType);
  }
  
  /**
   * 标记故障已恢复
   */
  markRecovered(adapterId: string): void {
    const event = this.failureHistory.find(e => 
      e.adapterId === adapterId && !e.recovered
    );
    
    if (event) {
      event.recovered = true;
      event.recoveredAt = new Date();
      
      log.info(`故障已恢复: ${event.id}`, { adapterId });
      this.emit('failure-recovered', event);
    }
  }
  
  /**
   * 查询故障历史
   */
  getFailureHistory(
    provider?: string,
    model?: string,
    limit: number = 100
  ): FailureEvent[] {
    let history = [...this.failureHistory];
    
    // 按提供商筛选
    if (provider) {
      history = history.filter(e => e.provider === provider);
    }
    
    // 按模型筛选
    if (model) {
      history = history.filter(e => e.model === model);
    }
    
    // 按时间倒序排序
    history.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // 限制数量
    return history.slice(0, limit);
  }
  
  /**
   * 获取故障统计
   */
  getFailureStats(): {
    total: number;
    byProvider: Record<string, number>;
    byModel: Record<string, number>;
    byErrorType: Record<string, number>;
    recovered: number;
    unrecovered: number;
  } {
    const stats = {
      total: this.failureHistory.length,
      byProvider: {} as Record<string, number>,
      byModel: {} as Record<string, number>,
      byErrorType: {} as Record<string, number>,
      recovered: 0,
      unrecovered: 0
    };
    
    for (const event of this.failureHistory) {
      stats.byProvider[event.provider] = (stats.byProvider[event.provider] || 0) + 1;
      stats.byModel[event.model] = (stats.byModel[event.model] || 0) + 1;
      stats.byErrorType[event.errorType] = (stats.byErrorType[event.errorType] || 0) + 1;
      
      if (event.recovered) {
        stats.recovered++;
      } else {
        stats.unrecovered++;
      }
    }
    
    return stats;
  }
  
  /**
   * 清理过期故障记录
   */
  private cleanExpiredHistory(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.historyRetentionDays);
    
    const beforeCount = this.failureHistory.length;
    this.failureHistory = this.failureHistory.filter(e => e.timestamp >= cutoffDate);
    const afterCount = this.failureHistory.length;
    
    if (beforeCount !== afterCount) {
      log.info(`清理过期故障记录: ${beforeCount - afterCount}条`);
    }
  }
  
  /**
   * 清空故障历史
   */
  clearHistory(): void {
    this.failureHistory = [];
    log.info('故障历史已清空');
  }
  
  /**
   * 获取配置
   */
  getConfig(): Readonly<Required<FailoverConfig>> {
    return this.config;
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<FailoverConfig>): void {
    Object.assign(this.config, config);
    log.info('配置已更新');
  }
}

/**
 * 创建默认故障转移配置
 */
export function createDefaultFailoverConfig(): FailoverConfig {
  return {
    enableAutoFailover: true,
    failureDetectionTimeout: 5000,
    maxRetryAttempts: 3,
    historyRetentionDays: 7,
    enableCrossProviderFailover: true,
    preferSameProvider: true
  };
}

export default {
  FailoverManager,
  createDefaultFailoverConfig
};
