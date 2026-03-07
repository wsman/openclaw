/**
 * 📊 健康监控器 - 集成健康检查和熔断器
 * 
 * 宪法依据:
 * - §306 零停机协议: 监控系统健康状态，确保服务连续性
 * - §190 网络韧性公理: 主动监控，预防级联故障
 * - §102 熵减原则: 集成现有组件，避免重复开发
 * 
 * 功能:
 * - 集成HealthChecker和CircuitBreaker
 * - 自动熔断 unhealthy 模型
 * - 统一监控API
 * 
 * @version 1.0.0 (批次4-2)
 * @category Gateway/Resilience
 */

import { HealthChecker, HealthCheckerConfig } from './HealthChecker';
import { CircuitBreaker, CircuitBreakerConfig } from './CircuitBreaker';
import { ModelRegistry } from '../llm/ModelRegistry';
import { ModelAdapter } from '../llm/adapters/ModelAdapter';
import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';
import { HealthStatus } from '../llm/adapters/ModelAdapter';

/**
 * 健康监控配置
 */
export interface HealthMonitorConfig {
  /** 健康检查器配置 */
  healthChecker?: HealthCheckerConfig;
  
  /** 熔断器配置 */
  circuitBreaker?: CircuitBreakerConfig;
  
  /** 是否启用自动熔断 */
  enableAutoTrip?: boolean;
  
  /** 是否启用自动恢复 */
  enableAutoReset?: boolean;
  
  /** 不健康状态阈值（错误率） */
  unhealthyThreshold?: number;
  
  /** 降级状态阈值（错误率） */
  degradedThreshold?: number;
}

/**
 * 监控事件
 */
export interface MonitorEvents {
  /** 熔断触发 */
  'circuit-tripped': (adapterId: string, reason: string) => void;
  
  /** 熔断恢复 */
  'circuit-reset': (adapterId: string) => void;
  
  /** 健康检查完成 */
  'health-check-complete': (results: Map<string, HealthStatus>) => void;
  
  /** 监控警告 */
  'monitor-warning': (message: string, details: any) => void;
}

const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTimeout: 30000,
  halfOpenMaxAttempts: 3,
  monitorHealth: true,
  enableConstitutionalMonitoring: true,
  enableAutoRecovery: true,
  resetTimeout: 60000,
  windowSize: 100,
};

/**
 * 健康监控器
 * 
 * 集成健康检查和熔断器，提供统一的监控能力
 */
export class HealthMonitor extends EventEmitter {
  private config: Required<HealthMonitorConfig>;
  private registry: ModelRegistry;
  private healthChecker: HealthChecker;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private isRunning = false;
  
  constructor(registry: ModelRegistry, config: HealthMonitorConfig = {}) {
    super();
    
    this.registry = registry;
    this.config = {
      healthChecker: config.healthChecker ?? {},
      circuitBreaker: config.circuitBreaker ?? DEFAULT_CIRCUIT_BREAKER_CONFIG,
      enableAutoTrip: config.enableAutoTrip ?? true,
      enableAutoReset: config.enableAutoReset ?? true,
      unhealthyThreshold: config.unhealthyThreshold ?? 0.7,
      degradedThreshold: config.degradedThreshold ?? 0.3
    };
    
    // 初始化健康检查器
    this.healthChecker = new HealthChecker(registry, {
      ...this.config.healthChecker,
      autoStart: false // 由HealthMonitor控制启动
    });
    
    // 注册健康检查事件监听器
    this.healthChecker.on('status-change', this.handleStatusChange.bind(this));
    this.healthChecker.on('check-complete', (results) => {
      this.emit('health-check-complete', results);
    });
    this.healthChecker.on('check-error', (error) => {
      this.logError('健康检查错误', error);
    });
    
    this.logInfo('健康监控器初始化', {
      autoTrip: this.config.enableAutoTrip,
      autoReset: this.config.enableAutoReset,
      unhealthyThreshold: this.config.unhealthyThreshold,
      degradedThreshold: this.config.degradedThreshold
    });
  }
  
  /**
   * 启动监控
   */
  start(): void {
    if (this.isRunning) {
      this.logWarning('健康监控器已在运行');
      return;
    }
    
    this.isRunning = true;
    this.logInfo('启动健康监控');
    
    // 启动健康检查器
    this.healthChecker.start();
  }
  
  /**
   * 停止监控
   */
  stop(): void {
    if (!this.isRunning) {
      this.logWarning('健康监控器未在运行');
      return;
    }
    
    this.isRunning = false;
    this.logInfo('停止健康监控');
    
    // 停止健康检查器
    this.healthChecker.stop();
  }
  
  /**
   * 处理状态变化
   */
  private handleStatusChange(
    adapterId: string,
    oldStatus: HealthStatus | null,
    newStatus: HealthStatus
  ): void {
    this.logInfo(`状态变化: ${adapterId}`, {
      old: oldStatus?.status,
      new: newStatus.status
    });
    
    // 自动熔断不健康的模型
    if (this.config.enableAutoTrip && newStatus.status === 'unhealthy') {
      this.tripCircuit(adapterId, '健康检查失败: unhealthy');
    }
    
    // 自动恢复健康的模型
    if (this.config.enableAutoReset && newStatus.status === 'healthy') {
      this.resetCircuit(adapterId);
    }
  }
  
  /**
   * 获取或创建熔断器
   */
  private getCircuitBreaker(adapterId: string): CircuitBreaker {
    let cb = this.circuitBreakers.get(adapterId);
    
    if (!cb) {
      cb = new CircuitBreaker({
        ...this.config.circuitBreaker
      });
      this.circuitBreakers.set(adapterId, cb);
      this.logDebug(`创建熔断器: ${adapterId}`);
    }
    
    return cb;
  }
  
  /**
   * 触发熔断
   */
  async tripCircuit(adapterId: string, reason?: string): Promise<void> {
    const cb = this.circuitBreakers.get(adapterId);
    
    if (!cb) {
      this.logWarning(`熔断器不存在: ${adapterId}`);
      return;
    }
    
    await cb.manualTrip(reason ?? '自动熔断');
    this.emit('circuit-tripped', adapterId, reason ?? '自动熔断');
    this.logWarning(`熔断触发: ${adapterId}`, { reason });
  }
  
  /**
   * 恢复熔断
   */
  async resetCircuit(adapterId: string): Promise<void> {
    const cb = this.circuitBreakers.get(adapterId);
    
    if (!cb) {
      this.logWarning(`熔断器不存在: ${adapterId}`);
      return;
    }
    
    await cb.manualReset();
    this.emit('circuit-reset', adapterId);
    this.logInfo(`熔断恢复: ${adapterId}`);
  }
  
  /**
   * 检查请求是否允许通过
   */
  async allowRequest(adapter: ModelAdapter, operation?: string): Promise<{
    allowed: boolean;
    reason?: string;
    waitTimeMs?: number;
  }> {
    const adapterId = `${adapter.provider}:${adapter.model}`;
    const cb = this.getCircuitBreaker(adapterId);
    const result = await cb.allowRequest(operation);
    
    return {
      allowed: result.allowed,
      reason: result.reason,
      waitTimeMs: result.waitTimeMs
    };
  }
  
  /**
   * 记录请求成功
   */
  recordSuccess(adapter: ModelAdapter): void {
    const adapterId = `${adapter.provider}:${adapter.model}`;
    const cb = this.circuitBreakers.get(adapterId);
    
    if (cb) {
      cb.recordSuccess();
    }
  }
  
  /**
   * 记录请求失败
   */
  recordFailure(adapter: ModelAdapter, errorType: string): void {
    const adapterId = `${adapter.provider}:${adapter.model}`;
    const cb = this.circuitBreakers.get(adapterId);
    
    if (cb) {
      cb.recordFailure(errorType);
    }
  }
  
  /**
   * 获取健康状态
   */
  getHealthStatus(adapterId: string): HealthStatus | null {
    return this.healthChecker.getCachedStatus(adapterId);
  }
  
  /**
   * 获取所有健康状态
   */
  getAllHealthStatus(): Map<string, HealthStatus> {
    return this.healthChecker.getAllCachedStatus();
  }
  
  /**
   * 获取熔断器状态
   */
  getCircuitStatus(adapterId: string): any {
    const cb = this.circuitBreakers.get(adapterId);
    return cb ? cb.getStatus() : null;
  }
  
  /**
   * 获取所有熔断器状态
   */
  getAllCircuitStatus(): Map<string, any> {
    const statusMap = new Map<string, any>();
    
    for (const [adapterId, cb] of this.circuitBreakers) {
      statusMap.set(adapterId, cb.getStatus());
    }
    
    return statusMap;
  }
  
  /**
   * 获取健康检查器统计信息
   */
  getHealthCheckerStats(): any {
    return this.healthChecker.getStats();
  }
  
  /**
   * 获取监控摘要
   */
  getSummary(): {
    isRunning: boolean;
    adapters: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    circuitsOpen: number;
    circuitsHalfOpen: number;
    circuitsClosed: number;
  } {
    const healthStatus = this.healthChecker.getAllCachedStatus();
    
    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;
    
    for (const status of healthStatus.values()) {
      if (status.status === 'healthy') healthy++;
      else if (status.status === 'degraded') degraded++;
      else unhealthy++;
    }
    
    let circuitsOpen = 0;
    let circuitsHalfOpen = 0;
    let circuitsClosed = 0;
    
    for (const cb of this.circuitBreakers.values()) {
      const status = cb.getStatus();
      if (status.currentState === 'OPEN') circuitsOpen++;
      else if (status.currentState === 'HALF_OPEN') circuitsHalfOpen++;
      else circuitsClosed++;
    }
    
    return {
      isRunning: this.isRunning,
      adapters: healthStatus.size,
      healthy,
      degraded,
      unhealthy,
      circuitsOpen,
      circuitsHalfOpen,
      circuitsClosed
    };
  }
  
  /**
   * 获取配置
   */
  getConfig(): Readonly<Required<HealthMonitorConfig>> {
    return this.config;
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<HealthMonitorConfig>): void {
    Object.assign(this.config, config);
    this.logInfo('配置已更新');
  }
  
  /**
   * 销毁监控器
   */
  async destroy(): Promise<void> {
    this.stop();
    
    // 销毁健康检查器
    await this.healthChecker.destroy();
    
    // 清理熔断器
    for (const [adapterId, cb] of this.circuitBreakers) {
      cb.reset();
    }
    this.circuitBreakers.clear();
    
    this.removeAllListeners();
    this.logInfo('健康监控器已销毁');
  }
  
  // ==================== 日志方法 ====================
  
  private logDebug(message: string, details?: any): void {
    logger.debug(`[HealthMonitor] ${message}`, details || '');
  }
  
  private logInfo(message: string, details?: any): void {
    logger.info(`[HealthMonitor] ${message}`, details || '');
  }
  
  private logWarning(message: string, details?: any): void {
    logger.warn(`[HealthMonitor] ${message}`, details || '');
  }
  
  private logError(message: string, error?: any): void {
    logger.error(`[HealthMonitor] ${message}`, error || '');
  }
}

/**
 * 创建默认健康监控配置
 */
export function createDefaultHealthMonitorConfig(): HealthMonitorConfig {
  return {
    healthChecker: {
      checkInterval: 30000,
      timeout: 5000,
      autoStart: false,
      enableBroadcast: true,
      maxConcurrency: 10
    },
    circuitBreaker: {
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
    },
    enableAutoTrip: true,
    enableAutoReset: true,
    unhealthyThreshold: 0.7,
    degradedThreshold: 0.3
  };
}

export default {
  HealthMonitor,
  createDefaultHealthMonitorConfig
};
