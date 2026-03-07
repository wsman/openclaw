/**
 * ⚡ 熔断器
 *
 * @constitution
 * §101 同步公理：熔断状态与决策服务同步
 * §102 熵减原则：集中熔断逻辑
 * §109 ToolCallBridge：弹性保护标准化
 *
 * @filename circuit-breaker.ts
 * @version 1.1.0
 * @category gateway/openclaw-decision/resilience
 * @last_updated 2026-03-02
 */

/**
 * 熔断器状态
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * 熔断器配置
 */
export interface CircuitBreakerConfig {
  /** 失败阈值（百分比，触发熔断） */
  failureThreshold: number;
  /** 成功阈值（半开状态恢复） */
  successThreshold: number;
  /** 熔断超时（毫秒） */
  timeout: number;
  /** 统计窗口（毫秒） */
  windowMs?: number;
  /** 是否启用 */
  enabled?: boolean;
  /** 最小请求数（触发熔断计算） */
  minimumRequests?: number;
  /** 打开持续时间（毫秒） */
  openDuration?: number;
  /** 半开状态最大请求数 */
  halfOpenMaxRequests?: number;
}

/**
 * 熔断器统计
 */
export interface CircuitStats {
  /** 当前状态 */
  state: CircuitState;
  /** 失败次数 */
  failures: number;
  /** 成功次数 */
  successes: number;
  /** 失败率 */
  failureRate: number;
  /** 总请求数 */
  totalRequests: number;
  /** 最后失败时间 */
  lastFailureTime?: number;
  /** 最后状态变更时间 */
  lastStateChange?: number;
}

/**
 * 熔断器执行结果
 */
export interface CircuitResult<T> {
  /** 是否成功 */
  success: boolean;
  /** 结果 */
  result?: T;
  /** 错误 */
  error?: Error;
  /** 是否被熔断 */
  blocked: boolean;
  /** 熔断器状态 */
  state: CircuitState;
}

/**
 * 熔断器
 */
export class CircuitBreaker {
  private config: {
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
    windowMs: number;
    enabled: boolean;
    minimumRequests: number;
    openDuration: number;
    halfOpenMaxRequests: number;
  };
  private state: CircuitState = 'closed';
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime?: number;
  private lastStateChange?: number;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 50,
      successThreshold: config.successThreshold ?? config.halfOpenMaxRequests ?? 3,
      timeout: config.timeout ?? 30000,
      windowMs: config.windowMs ?? 60000,
      enabled: config.enabled ?? true,
      minimumRequests: config.minimumRequests ?? 5,
      openDuration: config.openDuration ?? config.timeout ?? 30000,
      halfOpenMaxRequests: config.halfOpenMaxRequests ?? 3,
    };
    this.lastStateChange = Date.now();
  }

  /**
   * 检查是否允许执行
   */
  canExecute(): boolean {
    if (!this.config.enabled) return true;
    
    if (this.state === 'closed') return true;
    
    if (this.state === 'open') {
      // 检查是否应该转为 half-open
      if (this.shouldAttemptReset()) {
        this.transitionTo('half-open');
        return true;
      }
      return false;
    }
    
    // half-open 状态允许有限请求
    return this.successes < this.config.halfOpenMaxRequests;
  }

  /**
   * 记录失败
   */
  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      this.transitionTo('open');
    } else if (this.state === 'closed') {
      this.checkThreshold();
    }
  }

  /**
   * 记录成功
   */
  recordSuccess(): void {
    this.successes++;

    if (this.state === 'half-open') {
      if (this.successes >= this.getHalfOpenSuccessThreshold()) {
        this.transitionTo('closed');
      }
    }
  }

  /**
   * half-open 恢复成功阈值，受 halfOpenMaxRequests 上限约束
   */
  private getHalfOpenSuccessThreshold(): number {
    return Math.min(this.config.successThreshold, this.config.halfOpenMaxRequests);
  }

  /**
   * 检查是否应该触发熔断
   */
  private checkThreshold(): void {
    const total = this.failures + this.successes;
    if (total < this.config.minimumRequests) return;

    const failureRate = (this.failures / total) * 100;
    if (failureRate >= this.config.failureThreshold) {
      this.transitionTo('open');
    }
  }

  /**
   * 执行操作（带熔断保护）
   */
  async execute<T>(fn: () => Promise<T>): Promise<CircuitResult<T>> {
    if (!this.config.enabled) {
      try {
        const result = await fn();
        return { success: true, result, blocked: false, state: this.state };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          blocked: false,
          state: this.state,
        };
      }
    }

    if (!this.canExecute()) {
      return {
        success: false,
        error: new Error('Circuit breaker is open'),
        blocked: true,
        state: this.state,
      };
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return { success: true, result, blocked: false, state: this.state };
    } catch (error) {
      this.recordFailure();
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        blocked: false,
        state: this.state,
      };
    }
  }

  /**
   * 是否应该尝试重置
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    return Date.now() - this.lastFailureTime >= this.config.openDuration;
  }

  /**
   * 状态转换
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = Date.now();

    if (newState === 'closed') {
      this.failures = 0;
      this.successes = 0;
    } else if (newState === 'half-open') {
      this.successes = 0;
    }

    console.log(`[CircuitBreaker] State changed: ${oldState} -> ${newState}`);
  }

  /**
   * 获取当前状态
   */
  getState(): CircuitState {
    // 检查是否应该转为 half-open
    if (this.state === 'open' && this.shouldAttemptReset()) {
      this.transitionTo('half-open');
    }
    return this.state;
  }

  /**
   * 获取统计信息
   */
  getStats(): CircuitStats {
    const total = this.failures + this.successes;
    return {
      state: this.getState(),
      failures: this.failures,
      successes: this.successes,
      failureRate: total > 0 ? (this.failures / total) * 100 : 0,
      totalRequests: total,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
    };
  }

  /**
   * 当前失败率（百分比）
   */
  get failureRate(): number {
    const total = this.failures + this.successes;
    return total > 0 ? (this.failures / total) * 100 : 0;
  }

  /**
   * 手动重置
   */
  reset(): void {
    this.transitionTo('closed');
  }

  /**
   * 手动熔断
   */
  trip(): void {
    this.transitionTo('open');
  }
}

// ============================================================================
// 熔断器管理器（单例）
// ============================================================================

/**
 * 熔断器管理器
 */
export class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();
  private defaultConfig: Partial<CircuitBreakerConfig>;

  constructor(defaultConfig: Partial<CircuitBreakerConfig> = {}) {
    this.defaultConfig = defaultConfig;
  }

  /**
   * 获取或创建熔断器
   */
  getBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker({ ...this.defaultConfig, ...config }));
    }
    return this.breakers.get(name)!;
  }

  /**
   * 获取所有熔断器状态
   */
  getAllStats(): Record<string, CircuitStats> {
    const stats: Record<string, CircuitStats> = {};
    for (const [name, breaker] of this.breakers) {
      stats[name] = breaker.getStats();
    }
    return stats;
  }

  /**
   * 重置所有熔断器
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * 清除所有熔断器
   */
  clear(): void {
    this.breakers.clear();
  }
}

// 单例实例
let managerInstance: CircuitBreakerManager | null = null;

/**
 * 获取熔断器管理器单例
 */
export function getCircuitBreakerManager(config?: Partial<CircuitBreakerConfig>): CircuitBreakerManager {
  if (!managerInstance) {
    managerInstance = new CircuitBreakerManager(config);
  }
  return managerInstance;
}

/**
 * 重置熔断器管理器
 */
export function resetCircuitBreakerManager(): void {
  if (managerInstance) {
    managerInstance.clear();
  }
  managerInstance = null;
}

/**
 * 创建熔断器
 */
export function createCircuitBreaker(config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
  return new CircuitBreaker(config);
}
