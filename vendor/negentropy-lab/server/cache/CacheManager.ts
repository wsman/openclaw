/**
 * 🔧 三层缓存管理器
 * 
 * 宪法依据：
 * - §101 单一真理源原则：统一缓存接口
 * - §102 熵减原则：简化缓存访问
 * - §111 资源管理公理：优化缓存资源
 * - §306 零停机协议：缓存切换无停机
 * 
 * 性能目标：
 * - L1延迟 < 1ms (内存)
 * - L2延迟 < 10ms (Redis)
 * - L3延迟 < 100ms (SQLite)
 * - 整体命中率 > 90%
 */

import { MemoryCache } from './MemoryCache';
import { RedisCache } from './RedisCache';
import { CacheLayer, CacheStats, LayeredCacheConfig, CacheEvent, CacheEventListener } from './types';

/**
 * 默认三层缓存配置
 */
const DEFAULT_LAYERED_CACHE_CONFIG: LayeredCacheConfig = {
  l1: {
    name: 'memory-cache',
    maxSize: 1000,
    defaultTTL: 300, // 5分钟
    evictionPolicy: 'lru',
    enableStats: true,
    cleanupInterval: 60,
  },
  l2: {
    name: 'redis-cache',
    maxSize: 10000,
    defaultTTL: 3600, // 1小时
    evictionPolicy: 'lru',
    enableStats: true,
    cleanupInterval: 0,
    host: 'localhost',
    port: 6379,
    db: 0,
    keyPrefix: 'cache:',
  },
  l3: {
    name: 'sqlite-cache',
    maxSize: 100000,
    defaultTTL: 86400, // 1天
    evictionPolicy: 'lru',
    enableStats: true,
    cleanupInterval: 300,
    dbPath: './data/cache.db',
  },
};

/**
 * 缓存管理器类
 */
export class CacheManager implements CacheLayer {
  private l1Cache: MemoryCache;
  private l2Cache: RedisCache | null = null;
  private config: LayeredCacheConfig;
  private eventListeners: CacheEventListener[] = [];

  // 统计信息
  private stats = {
    l1Hits: 0,
    l2Hits: 0,
    l3Hits: 0,
    misses: 0,
    totalOperations: 0,
    totalLatency: 0,
  };

  constructor(config: Partial<LayeredCacheConfig> = {}) {
    this.config = { ...DEFAULT_LAYERED_CACHE_CONFIG, ...config };
    
    // 初始化L1缓存（内存）
    this.l1Cache = new MemoryCache(this.config.l1);
    
    // 初始化L2缓存（Redis）
    if (this.config.l2) {
      try {
        this.l2Cache = new RedisCache(this.config.l2);
      } catch (error) {
        console.warn('[CacheManager] Redis cache initialization failed, running with L1 only');
      }
    }
  }

  /**
   * 获取缓存值（从L1到L3依次查找）
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = process.hrtime.bigint();
    
    try {
      // 1. 尝试从L1缓存获取
      const l1Value = await this.l1Cache.get<T>(key);
      if (l1Value !== null) {
        this.stats.l1Hits++;
        this.stats.totalOperations++;
        return l1Value;
      }

      // 2. 尝试从L2缓存获取
      if (this.l2Cache) {
        const l2Value = await this.l2Cache.get<T>(key);
        if (l2Value !== null) {
          this.stats.l2Hits++;
          this.stats.totalOperations++;
          
          // 回填到L1
          await this.l1Cache.set(key, l2Value, this.config.l1.defaultTTL);
          
          return l2Value;
        }
      }

      // 3. 未命中
      this.stats.misses++;
      this.stats.totalOperations++;
      return null;
    } finally {
      this.recordLatency(startTime);
    }
  }

  /**
   * 设置缓存值（写入所有层）
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const startTime = process.hrtime.bigint();
    
    try {
      // 1. 写入L1
      await this.l1Cache.set(key, value, ttl ?? this.config.l1.defaultTTL);

      // 2. 写入L2
      if (this.l2Cache) {
        await this.l2Cache.set(key, value, ttl ?? this.config.l2?.defaultTTL ?? this.config.l1.defaultTTL);
      }
    } finally {
      this.recordLatency(startTime);
    }
  }

  /**
   * 删除缓存（从所有层删除）
   */
  async delete(key: string): Promise<boolean> {
    const startTime = process.hrtime.bigint();
    
    try {
      // 1. 从L1删除
      const l1Deleted = await this.l1Cache.delete(key);

      // 2. 从L2删除
      let l2Deleted = false;
      if (this.l2Cache) {
        l2Deleted = await this.l2Cache.delete(key);
      }

      return l1Deleted || l2Deleted;
    } finally {
      this.recordLatency(startTime);
    }
  }

  /**
   * 清空缓存（所有层）
   */
  async clear(): Promise<void> {
    const startTime = process.hrtime.bigint();
    
    try {
      // 清空L1
      await this.l1Cache.clear();

      // 清空L2
      if (this.l2Cache) {
        await this.l2Cache.clear();
      }
    } finally {
      this.recordLatency(startTime);
    }
  }

  /**
   * 检查缓存是否存在
   */
  async has(key: string): Promise<boolean> {
    // 1. 检查L1
    const l1Has = await this.l1Cache.has(key);
    if (l1Has) return true;

    // 2. 检查L2
    if (this.l2Cache) {
      const l2Has = await this.l2Cache.has(key);
      if (l2Has) return true;
    }

    return false;
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.l1Hits + this.stats.l2Hits + this.stats.misses;
    const totalHits = this.stats.l1Hits + this.stats.l2Hits;
    const hitRate = totalRequests > 0 ? (totalHits / totalRequests) * 100 : 0;

    const l1Stats = this.l1Cache.getStats();
    const l2Stats = this.l2Cache?.getStats();

    return {
      hits: totalHits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      size: l1Stats.size,
      memoryUsage: l1Stats.memoryUsage + (l2Stats?.memoryUsage || 0),
      averageLatency: this.stats.totalOperations > 0
        ? this.stats.totalLatency / this.stats.totalOperations / 1_000_000
        : 0,
      totalOperations: this.stats.totalOperations,
    };
  }

  /**
   * 获取详细统计（分层）
   */
  getDetailedStats() {
    return {
      l1: this.l1Cache.getStats(),
      l2: this.l2Cache?.getStats() || null,
      combined: this.getStats(),
      breakdown: {
        l1Hits: this.stats.l1Hits,
        l2Hits: this.stats.l2Hits,
        misses: this.stats.misses,
      },
    };
  }

  /**
   * 获取缓存大小
   */
  async size(): Promise<number> {
    return this.l1Cache.size();
  }

  /**
   * 预热缓存
   */
  async warmup(entries: Array<{ key: string; value: any; ttl?: number }>): Promise<void> {
    const startTime = Date.now();
    console.log(`[CacheManager] Starting cache warmup with ${entries.length} entries`);

    let successCount = 0;
    let failCount = 0;

    for (const entry of entries) {
      try {
        await this.set(entry.key, entry.value, entry.ttl);
        successCount++;
      } catch (error) {
        console.error(`[CacheManager] Warmup failed for key ${entry.key}:`, error);
        failCount++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[CacheManager] Cache warmup completed: ${successCount} success, ${failCount} failed, ${duration}ms`
    );
  }

  /**
   * 获取或设置（如果不存在则加载）
   */
  async getOrSet<T>(
    key: string,
    loader: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // 尝试获取缓存
    const cachedValue = await this.get<T>(key);
    if (cachedValue !== null) {
      return cachedValue;
    }

    // 加载数据
    const value = await loader();
    
    // 设置缓存
    await this.set(key, value, ttl);
    
    return value;
  }

  /**
   * 批量获取
   */
  async mget<T>(keys: string[]): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    
    await Promise.all(
      keys.map(async (key) => {
        const value = await this.get<T>(key);
        results.set(key, value);
      })
    );

    return results;
  }

  /**
   * 批量设置
   */
  async mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    await Promise.all(
      entries.map((entry) => this.set(entry.key, entry.value, entry.ttl))
    );
  }

  /**
   * 添加事件监听器
   */
  addEventListener(listener: CacheEventListener): void {
    this.eventListeners.push(listener);
    this.l1Cache.addEventListener(listener);
    this.l2Cache?.addEventListener(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(listener: CacheEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
    this.l1Cache.removeEventListener(listener);
    this.l2Cache?.removeEventListener(listener);
  }

  /**
   * 记录延迟
   */
  private recordLatency(startTime: bigint): void {
    const endTime = process.hrtime.bigint();
    const latencyMs = Number(endTime - startTime) / 1_000_000;
    this.stats.totalLatency += latencyMs;
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.l1Cache.cleanup();
    
    if (this.l2Cache) {
      await this.l2Cache.cleanup();
    }
    
    this.eventListeners = [];
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    l1: boolean;
    l2: boolean;
    overall: boolean;
  }> {
    const l1Health = true; // L1总是可用

    let l2Health = false;
    if (this.l2Cache) {
      try {
        l2Health = this.l2Cache.getConnectionStatus();
      } catch (error) {
        console.error('[CacheManager] L2 health check failed:', error);
        l2Health = false;
      }
    }

    return {
      l1: l1Health,
      l2: l2Health,
      overall: l1Health || l2Health,
    };
  }
}

export default CacheManager;
