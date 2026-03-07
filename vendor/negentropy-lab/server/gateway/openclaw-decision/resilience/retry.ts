/**
 * 🔄 重试机制
 *
 * @constitution
 * §101 同步公理：重试策略与决策服务同步
 * §102 熵减原则：集中重试逻辑
 * §109 ToolCallBridge：弹性保护标准化
 *
 * @filename retry.ts
 * @version 1.0.0
 * @category gateway/openclaw-decision/resilience
 * @last_updated 2026-03-02
 */

/**
 * 重试配置
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 初始延迟（毫秒） */
  initialDelay: number;
  /** 最大延迟（毫秒） */
  maxDelay: number;
  /** 退避倍数 */
  backoffMultiplier: number;
  /** 是否启用抖动 */
  jitter?: boolean;
  /** 可重试的错误判断 */
  isRetryable?: (error: Error) => boolean;
}

/**
 * 重试结果
 */
export interface RetryResult<T> {
  /** 是否成功 */
  success: boolean;
  /** 结果 */
  result?: T;
  /** 错误 */
  error?: Error;
  /** 重试次数 */
  attempts: number;
  /** 总耗时（毫秒） */
  totalMs: number;
}

/**
 * 重试执行器
 */
export class RetryExecutor {
  private config: Required<RetryConfig>;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: 3,
      initialDelay: 100,
      maxDelay: 5000,
      backoffMultiplier: 2,
      jitter: true,
      isRetryable: () => true,
      ...config,
    };
  }

  /**
   * 执行带重试的操作
   */
  async execute<T>(fn: () => Promise<T>): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let lastError: Error | undefined;
    let attempts = 0;

    for (let i = 0; i <= this.config.maxRetries; i++) {
      attempts++;

      try {
        const result = await fn();
        return {
          success: true,
          result,
          attempts,
          totalMs: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 检查是否可重试
        if (!this.config.isRetryable(lastError)) {
          return {
            success: false,
            error: lastError,
            attempts,
            totalMs: Date.now() - startTime,
          };
        }

        // 最后一次尝试不再等待
        if (i < this.config.maxRetries) {
          const delay = this.calculateDelay(i);
          await this.sleep(delay);
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts,
      totalMs: Date.now() - startTime,
    };
  }

  /**
   * 计算延迟时间
   */
  private calculateDelay(attempt: number): number {
    let delay = this.config.initialDelay * Math.pow(this.config.backoffMultiplier, attempt);
    delay = Math.min(delay, this.config.maxDelay);

    if (this.config.jitter) {
      // 添加 0-25% 的抖动
      const jitter = delay * 0.25 * Math.random();
      delay = delay + jitter;
    }

    return Math.floor(delay);
  }

  /**
   * 睡眠
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取配置
   */
  getConfig(): Required<RetryConfig> {
    return { ...this.config };
  }
}

/**
 * 创建重试执行器
 */
export function createRetryExecutor(config?: Partial<RetryConfig>): RetryExecutor {
  return new RetryExecutor(config);
}

/**
 * 快捷重试函数
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<T> {
  const executor = new RetryExecutor(config);
  const result = await executor.execute(fn);

  if (result.success) {
    return result.result!;
  }

  throw result.error;
}