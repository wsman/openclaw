/**
 * 🔧 内存缓存层（L1）
 * 
 * 宪法依据：
 * - §111 资源管理公理：高效内存使用
 * - §112 资源预警：内存阈值监控
 * 
 * 性能目标：
 * - 延迟 < 1ms
 * - 容量 1000条
 * - TTL 5分钟
 */

import { CacheLayer, CacheConfig, CacheEntry, CacheStats, CacheEvent, CacheEventListener } from './types';

/**
 * 默认内存缓存配置
 */
const DEFAULT_MEMORY_CACHE_CONFIG: CacheConfig = {
  name: 'memory-cache',
  maxSize: 1000,
  defaultTTL: 300, // 5分钟
  evictionPolicy: 'lru',
  enableStats: true,
  cleanupInterval: 60, // 60秒清理一次
};

/**
 * 内存缓存类（LRU策略）
 */
export class MemoryCache implements CacheLayer {
  private cache = new Map<string, CacheEntry>();
  private config: CacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    totalOperations: 0,
    totalLatency: 0,
  };
  private cleanupTimer: NodeJS.Timeout | null = null;
  private eventListeners: CacheEventListener[] = [];

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_MEMORY_CACHE_CONFIG, ...config };
    this.startCleanupTimer();
  }

  /**
   * 获取缓存值
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = process.hrtime.bigint();
    
    try {
      const entry = this.cache.get(key);
      
      if (!entry) {
        this.recordMiss();
        return null;
      }

      // 检查是否过期
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        this.cache.delete(key);
        this.emitEvent({ type: 'expire', key, timestamp: Date.now() });
        this.recordMiss();
        return null;
      }

      // 更新访问信息（LRU）
      entry.accessCount++;
      entry.lastAccessedAt = Date.now();
      entry.updatedAt = Date.now();
      // LRU: 通过Map重插入将最近访问项移动到末尾
      this.cache.delete(key);
      this.cache.set(key, entry);

      this.recordHit();
      return entry.value as T;
    } finally {
      this.recordLatency(startTime);
    }
  }

  /**
   * 设置缓存值
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const startTime = process.hrtime.bigint();
    
    try {
      // 检查容量，必要时淘汰
      if (this.cache.size >= this.config.maxSize && !this.cache.has(key)) {
        this.evict();
      }

      const now = Date.now();
      const ttlMs = (ttl ?? this.config.defaultTTL) * 1000;
      
      const entry: CacheEntry<T> = {
        key,
        value,
        createdAt: this.cache.has(key) ? this.cache.get(key)!.createdAt : now,
        updatedAt: now,
        expiresAt: ttlMs > 0 ? now + ttlMs : null,
        accessCount: this.cache.has(key) ? this.cache.get(key)!.accessCount : 0,
        lastAccessedAt: now,
        size: this.calculateSize(value),
      };

      // LRU: 更新已有key时也移动到末尾
      if (this.cache.has(key)) {
        this.cache.delete(key);
      }
      this.cache.set(key, entry);
      this.emitEvent({ type: 'set', key, timestamp: now, value });
    } finally {
      this.recordLatency(startTime);
    }
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<boolean> {
    const startTime = process.hrtime.bigint();
    
    try {
      const existed = this.cache.delete(key);
      
      if (existed) {
        this.emitEvent({ type: 'delete', key, timestamp: Date.now() });
      }
      
      return existed;
    } finally {
      this.recordLatency(startTime);
    }
  }

  /**
   * 清空缓存
   */
  async clear(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    
    this.emitEvent({
      type: 'delete',
      key: '__all__',
      timestamp: Date.now(),
      metadata: { clearedSize: size },
    });
  }

  /**
   * 检查缓存是否存在
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // 检查是否过期
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: Math.round(hitRate * 100) / 100,
      size: this.cache.size,
      memoryUsage: this.calculateMemoryUsage(),
      averageLatency: this.stats.totalOperations > 0
        ? this.stats.totalLatency / this.stats.totalOperations / 1_000_000
        : 0,
      totalOperations: this.stats.totalOperations,
    };
  }

  /**
   * 获取缓存大小
   */
  async size(): Promise<number> {
    return this.cache.size;
  }

  /**
   * 添加事件监听器
   */
  addEventListener(listener: CacheEventListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(listener: CacheEventListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * 淘汰缓存条目
   */
  private evict(): void {
    if (this.config.evictionPolicy === 'lru') {
      this.evictLRU();
    } else if (this.config.evictionPolicy === 'lfu') {
      this.evictLFU();
    } else {
      this.evictFIFO();
    }
  }

  /**
   * LRU淘汰
   */
  private evictLRU(): void {
    const oldestKey = this.cache.keys().next().value as string | undefined;
    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.emitEvent({ type: 'evict', key: oldestKey, timestamp: Date.now() });
    }
  }

  /**
   * LFU淘汰
   */
  private evictLFU(): void {
    let leastKey: string | null = null;
    let leastCount = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < leastCount) {
        leastCount = entry.accessCount;
        leastKey = key;
      }
    }

    if (leastKey) {
      this.cache.delete(leastKey);
      this.emitEvent({ type: 'evict', key: leastKey, timestamp: Date.now() });
    }
  }

  /**
   * FIFO淘汰
   */
  private evictFIFO(): void {
    let firstKey: string | null = null;
    let firstTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < firstTime) {
        firstTime = entry.createdAt;
        firstKey = key;
      }
    }

    if (firstKey) {
      this.cache.delete(firstKey);
      this.emitEvent({ type: 'evict', key: firstKey, timestamp: Date.now() });
    }
  }

  /**
   * 启动定时清理
   */
  private startCleanupTimer(): void {
    if (this.config.cleanupInterval > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpired();
      }, this.config.cleanupInterval * 1000);
    }
  }

  /**
   * 清理过期条目
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.cache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      console.log(`[MemoryCache] Cleaned up ${expiredCount} expired entries`);
    }
  }

  /**
   * 计算值大小（估算）
   */
  private calculateSize(value: any): number {
    if (typeof value === 'string') {
      return value.length * 2; // UTF-16编码
    } else if (Buffer.isBuffer(value)) {
      return value.length;
    } else {
      return JSON.stringify(value).length * 2;
    }
  }

  /**
   * 计算内存使用量
   */
  private calculateMemoryUsage(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size + 200; // 200字节是条目元数据估算
    }
    return totalSize;
  }

  /**
   * 记录命中
   */
  private recordHit(): void {
    this.stats.hits++;
    this.stats.totalOperations++;
  }

  /**
   * 记录未命中
   */
  private recordMiss(): void {
    this.stats.misses++;
    this.stats.totalOperations++;
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
   * 发送事件
   */
  private emitEvent(event: CacheEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[MemoryCache] Event listener error:', error);
      }
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.cache.clear();
    this.eventListeners = [];
  }
}

export default MemoryCache;
