/**
 * 🏥 健康检查器 - 模型健康状态监控
 * 
 * 宪法依据:
 * - §306 零停机协议: 持续监控模型健康状态
 * - §190 网络韧性公理: 主动检测服务异常
 * - §102 熵减原则: 复用ModelRegistry的healthCheck方法
 * 
 * 功能:
 * - 定期健康检查（默认30秒间隔）
 * - 状态变化广播
 * - 健康状态缓存
 * 
 * @version 1.0.0 (批次4-2)
 * @category Gateway/Resilience
 */

import { ModelAdapter, HealthStatus } from '../llm/adapters/ModelAdapter';
import { ModelRegistry } from '../llm/ModelRegistry';
import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';

/**
 * 健康检查配置
 */
export interface HealthCheckerConfig {
  /** 检查间隔（毫秒，默认30秒） */
  checkInterval?: number;
  
  /** 超时时间（毫秒，默认5秒） */
  timeout?: number;
  
  /** 是否启用自动启动 */
  autoStart?: boolean;
  
  /** 是否启用状态广播 */
  enableBroadcast?: boolean;
  
  /** 最大并发检查数 */
  maxConcurrency?: number;
}

/**
 * 状态变化回调
 */
export type StatusCallback = (
  adapterId: string,
  oldStatus: HealthStatus | null,
  newStatus: HealthStatus
) => void;

/**
 * 健康检查事件
 */
export interface HealthCheckEvents {
  /** 状态变化 */
  'status-change': StatusCallback;
  /** 健康检查完成 */
  'check-complete': (results: Map<string, HealthStatus>) => void;
  /** 健康检查错误 */
  'check-error': (error: Error) => void;
}

/**
 * 健康检查统计信息
 */
export interface HealthCheckerStats {
  /** 总检查次数 */
  totalChecks: number;
  
  /** 成功检查次数 */
  successfulChecks: number;
  
  /** 失败检查次数 */
  failedChecks: number;
  
  /** 最后检查时间 */
  lastCheckTime?: Date;
  
  /** 健康模型数量 */
  healthyCount: number;
  
  /** 降级模型数量 */
  degradedCount: number;
  
  /** 不健康模型数量 */
  unhealthyCount: number;
}

/**
 * 健康检查器
 * 
 * 定期执行模型健康检查，并在状态变化时广播通知
 */
export class HealthChecker extends EventEmitter {
  private config: Required<HealthCheckerConfig>;
  private registry: ModelRegistry;
  private checkTimer?: NodeJS.Timeout;
  private healthCache: Map<string, HealthStatus> = new Map();
  private statusHistory: Map<string, Array<{status: HealthStatus, timestamp: number}>> = new Map();
  private stats: HealthCheckerStats = {
    totalChecks: 0,
    successfulChecks: 0,
    failedChecks: 0,
    healthyCount: 0,
    degradedCount: 0,
    unhealthyCount: 0
  };
  private isRunning = false;
  
  constructor(registry: ModelRegistry, config: HealthCheckerConfig = {}) {
    super();
    
    this.registry = registry;
    this.config = {
      checkInterval: config.checkInterval ?? 30000, // 30秒
      timeout: config.timeout ?? 5000, // 5秒
      autoStart: config.autoStart ?? false,
      enableBroadcast: config.enableBroadcast ?? true,
      maxConcurrency: config.maxConcurrency ?? 10
    };
    
    this.logInfo('健康检查器初始化', {
      checkInterval: this.config.checkInterval,
      timeout: this.config.timeout,
      autoStart: this.config.autoStart
    });
    
    if (this.config.autoStart) {
      this.start();
    }
  }
  
  /**
   * 启动健康检查循环
   */
  start(): void {
    if (this.isRunning) {
      this.logWarning('健康检查器已在运行');
      return;
    }
    
    this.isRunning = true;
    this.logInfo('启动健康检查循环');
    
    // 立即执行一次检查
    this.checkAll().catch(error => {
      this.logError('初始健康检查失败', error);
    });
    
    // 设置定时检查
    this.checkTimer = setInterval(() => {
      this.checkAll().catch(error => {
        this.logError('定期健康检查失败', error);
        this.emit('check-error', error);
      });
    }, this.config.checkInterval);
  }
  
  /**
   * 停止健康检查循环
   */
  stop(): void {
    if (!this.isRunning) {
      this.logWarning('健康检查器未在运行');
      return;
    }
    
    this.isRunning = false;
    
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
    
    this.logInfo('健康检查器已停止');
  }
  
  /**
   * 检查单个模型健康状态
   */
  async checkHealth(adapter: ModelAdapter): Promise<HealthStatus> {
    const adapterId = `${adapter.provider}:${adapter.model}`;
    const startTime = Date.now();
    
    this.logDebug(`开始健康检查: ${adapterId}`);
    
    try {
      // 设置超时
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.config.timeout);
      });
      
      // 执行健康检查
      const health = await Promise.race([
        adapter.healthCheck(),
        timeoutPromise
      ]);
      
      const latency = Math.max(1, Date.now() - startTime);
      const enrichedHealth: HealthStatus = {
        ...health,
        latency
      };
      
      // 更新缓存
      const oldStatus = this.healthCache.get(adapterId) ?? null;
      this.healthCache.set(adapterId, enrichedHealth);
      
      // 更新历史记录（保留最近20条）
      const history = this.statusHistory.get(adapterId) ?? [];
      history.push({ status: enrichedHealth, timestamp: Date.now() });
      if (history.length > 20) {
        history.shift();
      }
      this.statusHistory.set(adapterId, history);
      
      // 状态变化广播
      if (oldStatus && oldStatus.status !== enrichedHealth.status && this.config.enableBroadcast) {
        this.emit('status-change', adapterId, oldStatus, enrichedHealth);
        this.logInfo(`状态变化: ${adapterId} ${oldStatus.status} -> ${enrichedHealth.status}`);
      }
      
      this.logDebug(`健康检查完成: ${adapterId}, 状态=${enrichedHealth.status}, 延迟=${latency}ms`);
      
      return enrichedHealth;
      
    } catch (error: any) {
      const latency = Math.max(1, Date.now() - startTime);
      const errorHealth: HealthStatus = {
        provider: adapter.provider,
        model: adapter.model,
        status: 'unhealthy',
        latency,
        lastCheck: new Date(),
        errorRate: 1
      };
      
      // 更新缓存
      const oldStatus = this.healthCache.get(adapterId) ?? null;
      this.healthCache.set(adapterId, errorHealth);
      
      // 更新历史记录
      const history = this.statusHistory.get(adapterId) ?? [];
      history.push({ status: errorHealth, timestamp: Date.now() });
      if (history.length > 20) {
        history.shift();
      }
      this.statusHistory.set(adapterId, history);
      
      // 状态变化广播
      if (oldStatus && oldStatus.status !== 'unhealthy' && this.config.enableBroadcast) {
        this.emit('status-change', adapterId, oldStatus, errorHealth);
        this.logWarning(`状态变化: ${adapterId} ${oldStatus?.status ?? 'unknown'} -> unhealthy`, error);
      }

      this.stats.failedChecks++;
      this.emit('check-error', error instanceof Error ? error : new Error(String(error)));
      
      this.logError(`健康检查失败: ${adapterId}`, error);
      
      return errorHealth;
    }
  }
  
  /**
   * 批量检查所有模型
   */
  async checkAll(): Promise<Map<string, HealthStatus>> {
    const startTime = Date.now();
    this.stats.totalChecks++;
    
    this.logInfo('开始批量健康检查');
    
    const adapters = this.registry.list();
    const results = new Map<string, HealthStatus>();
    
    // 分批处理以控制并发
    const batchSize = this.config.maxConcurrency;
    for (let i = 0; i < adapters.length; i += batchSize) {
      const batch = adapters.slice(i, i + batchSize);
      const batchPromises = batch.map(async adapter => {
        const adapterId = `${adapter.provider}:${adapter.model}`;
        try {
          const health = await this.checkHealth(adapter);
          results.set(adapterId, health);
        } catch (error) {
          this.logError(`批量检查失败: ${adapterId}`, error);
        }
      });
      
      await Promise.all(batchPromises);
    }
    
    // 更新统计信息
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;
    
    for (const health of results.values()) {
      if (health.status === 'healthy') healthyCount++;
      else if (health.status === 'degraded') degradedCount++;
      else unhealthyCount++;
    }
    
    this.stats.successfulChecks++;
    this.stats.lastCheckTime = new Date();
    this.stats.healthyCount = healthyCount;
    this.stats.degradedCount = degradedCount;
    this.stats.unhealthyCount = unhealthyCount;
    
    const elapsed = Date.now() - startTime;
    this.logInfo(`批量健康检查完成: ${results.size}个模型, ${elapsed}ms`, {
      healthy: healthyCount,
      degraded: degradedCount,
      unhealthy: unhealthyCount
    });
    
    // 广播完成事件
    this.emit('check-complete', results);
    
    return results;
  }
  
  /**
   * 订阅状态变化
   */
  onStatusChange(callback: StatusCallback): void {
    this.on('status-change', callback);
  }
  
  /**
   * 取消订阅状态变化
   */
  offStatusChange(callback: StatusCallback): void {
    this.off('status-change', callback);
  }
  
  /**
   * 广播状态更新
   * @deprecated 状态变化自动通过EventEmitter广播，此方法保留用于兼容性
   */
  private broadcastStatus(status: Map<string, HealthStatus>): void {
    if (!this.config.enableBroadcast) {
      return;
    }
    
    for (const [adapterId, newStatus] of status) {
      const oldStatus = this.healthCache.get(adapterId) ?? null;
      if (oldStatus && oldStatus.status !== newStatus.status) {
        this.emit('status-change', adapterId, oldStatus, newStatus);
      }
    }
  }
  
  /**
   * 获取缓存的健康状态
   */
  getCachedStatus(adapterId: string): HealthStatus | null {
    return this.healthCache.get(adapterId) ?? null;
  }
  
  /**
   * 获取所有缓存的健康状态
   */
  getAllCachedStatus(): Map<string, HealthStatus> {
    return new Map(this.healthCache);
  }
  
  /**
   * 获取状态历史
   */
  getStatusHistory(adapterId: string, limit = 10): Array<{status: HealthStatus, timestamp: number}> {
    const history = this.statusHistory.get(adapterId) ?? [];
    return history.slice(-limit);
  }
  
  /**
   * 获取统计信息
   */
  getStats(): HealthCheckerStats {
    return { ...this.stats };
  }
  
  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      healthyCount: 0,
      degradedCount: 0,
      unhealthyCount: 0
    };
    this.logInfo('统计信息已重置');
  }
  
  /**
   * 清除缓存
   */
  clearCache(): void {
    this.healthCache.clear();
    this.statusHistory.clear();
    this.logInfo('健康状态缓存已清除');
  }
  
  /**
   * 获取配置
   */
  getConfig(): Readonly<Required<HealthCheckerConfig>> {
    return this.config;
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<HealthCheckerConfig>): void {
    const oldInterval = this.config.checkInterval;
    
    Object.assign(this.config, config);
    
    this.logInfo('配置已更新', {
      oldInterval,
      newInterval: this.config.checkInterval
    });
    
    // 如果检查间隔发生变化，重启检查器
    if (this.isRunning && oldInterval !== this.config.checkInterval) {
      this.stop();
      this.start();
    }
  }
  
  /**
   * 销毁健康检查器
   */
  async destroy(): Promise<void> {
    this.stop();
    this.clearCache();
    this.removeAllListeners();
    this.logInfo('健康检查器已销毁');
  }
  
  // ==================== 日志方法 ====================
  
  private logDebug(message: string, details?: any): void {
    logger.debug(`[HealthChecker] ${message}`, details || '');
  }
  
  private logInfo(message: string, details?: any): void {
    logger.info(`[HealthChecker] ${message}`, details || '');
  }
  
  private logWarning(message: string, details?: any): void {
    logger.warn(`[HealthChecker] ${message}`, details || '');
  }
  
  private logError(message: string, error?: any): void {
    logger.error(`[HealthChecker] ${message}`, error || '');
  }
}

/**
 * 创建默认健康检查器配置
 */
export function createDefaultHealthCheckerConfig(): HealthCheckerConfig {
  return {
    checkInterval: 30000,    // 30秒
    timeout: 5000,           // 5秒
    autoStart: false,
    enableBroadcast: true,
    maxConcurrency: 10
  };
}

export default {
  HealthChecker,
  createDefaultHealthCheckerConfig
};
