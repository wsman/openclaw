/**
 * 🛡️ 防重放攻击保护
 *
 * @constitution
 * §101 同步公理：防重放与签名服务同步
 * §102 熵减原则：集中防重放逻辑
 * §107 通信安全公理：请求防重放保护
 *
 * @filename replay-guard.ts
 * @version 1.0.0
 * @category gateway/openclaw-decision/security
 * @last_updated 2026-03-02
 */

/**
 * 防重放配置
 */
export interface ReplayGuardConfig {
  /** nonce 缓存大小 */
  maxCacheSize?: number;
  /** nonce 有效期（毫秒） */
  nonceTtl?: number;
  /** 是否启用 */
  enabled?: boolean;
}

/**
 * 缓存条目
 */
interface CacheEntry {
  timestamp: number;
  nonce: string;
}

/**
 * 防重放验证结果
 */
export interface ReplayGuardResult {
  /** 是否有效（非重放） */
  valid: boolean;
  /** 错误原因 */
  reason?: string;
}

/**
 * 防重放保护服务
 */
export class ReplayGuard {
  private config: Required<ReplayGuardConfig>;
  private nonceCache: Map<string, CacheEntry> = new Map();
  private cleanupInterval?: ReturnType<typeof setInterval>;

  constructor(config: ReplayGuardConfig = {}) {
    this.config = {
      maxCacheSize: 10000,
      nonceTtl: 300000, // 5分钟
      enabled: true,
      ...config,
    };

    // 定期清理过期 nonce
    this.startCleanup();
  }

  /**
   * 检查是否为重放请求
   */
  check(nonce: string, timestamp: number): ReplayGuardResult {
    if (!this.config.enabled) {
      return { valid: true };
    }

    // 检查时间戳是否在有效期内
    const now = Date.now();
    if (now - timestamp > this.config.nonceTtl) {
      return {
        valid: false,
        reason: 'Timestamp expired',
      };
    }

    // 检查 nonce 是否已使用
    if (this.nonceCache.has(nonce)) {
      return {
        valid: false,
        reason: 'Nonce already used (replay detected)',
      };
    }

    // 记录 nonce
    this.recordNonce(nonce, timestamp);

    return { valid: true };
  }

  /**
   * 记录 nonce
   */
  private recordNonce(nonce: string, timestamp: number): void {
    // 检查缓存大小
    if (this.nonceCache.size >= this.config.maxCacheSize) {
      this.evictOldest();
    }

    this.nonceCache.set(nonce, { nonce, timestamp });
  }

  /**
   * 清理最旧的条目
   */
  private evictOldest(): void {
    let oldest: CacheEntry | null = null;
    let oldestKey: string | null = null;

    for (const [key, entry] of this.nonceCache) {
      if (!oldest || entry.timestamp < oldest.timestamp) {
        oldest = entry;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.nonceCache.delete(oldestKey);
    }
  }

  /**
   * 清理过期条目
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredThreshold = now - this.config.nonceTtl;

    for (const [key, entry] of this.nonceCache) {
      if (entry.timestamp < expiredThreshold) {
        this.nonceCache.delete(key);
      }
    }
  }

  /**
   * 启动定期清理
   */
  private startCleanup(): void {
    // 每分钟清理一次
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * 停止定期清理
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * 获取缓存统计
   */
  getStats(): { size: number; maxSize: number } {
    return {
      size: this.nonceCache.size,
      maxSize: this.config.maxCacheSize,
    };
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.nonceCache.clear();
  }
}

/**
 * 创建防重放保护服务
 */
export function createReplayGuard(config?: ReplayGuardConfig): ReplayGuard {
  return new ReplayGuard(config);
}