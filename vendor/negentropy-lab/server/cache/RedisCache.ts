/**
 * 🔧 Redis缓存层（L2）
 * 
 * 宪法依据：
 * - §111 资源管理公理：分布式缓存共享
 * - §306 零停机协议：Redis高可用
 * 
 * 性能目标：
 * - 延迟 < 10ms
 * - 容量 10000条
 * - TTL 1小时
 */

import Redis from 'ioredis';
import { CacheLayer, CacheConfig, CacheStats, CacheEvent, CacheEventListener } from './types';

/**
 * Redis缓存配置
 */
export interface RedisCacheConfig extends CacheConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  reconnectOnError?: boolean;
  maxRetriesPerRequest?: number;
}

/**
 * 默认Redis缓存配置
 */
const DEFAULT_REDIS_CACHE_CONFIG: RedisCacheConfig = {
  name: 'redis-cache',
  maxSize: 10000,
  defaultTTL: 3600, // 1小时
  evictionPolicy: 'lru',
  enableStats: true,
  cleanupInterval: 0, // Redis自动清理
  host: 'localhost',
  port: 6379,
  db: 0,
  keyPrefix: 'cache:',
  reconnectOnError: true,
  maxRetriesPerRequest: 3,
};

/**
 * Redis缓存类
 */
export class RedisCache implements CacheLayer {
  private client: Redis;
  private config: RedisCacheConfig;
  private stats = {
    hits: 0,
    misses: 0,
    totalOperations: 0,
    totalLatency: 0,
  };
  private eventListeners: CacheEventListener[] = [];
  private isConnected = false;

  constructor(config: Partial<RedisCacheConfig> = {}) {
    this.config = { ...DEFAULT_REDIS_CACHE_CONFIG, ...config };
    this.client = this.createRedisClient();
    this.setupEventHandlers();
  }

  /**
   * 创建Redis客户端
   */
  private createRedisClient(): Redis {
    const reconnectOnError = this.config.reconnectOnError
      ? (() => true)
      : undefined;

    return new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db,
      keyPrefix: this.config.keyPrefix,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('[RedisCache] Max retry attempts reached');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
      maxRetriesPerRequest: this.config.maxRetriesPerRequest,
      reconnectOnError,
    });
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.isConnected = true;
      console.log('[RedisCache] Connected to Redis server');
    });

    this.client.on('disconnect', () => {
      this.isConnected = false;
      console.warn('[RedisCache] Disconnected from Redis server');
    });

    this.client.on('error', (error) => {
      console.error('[RedisCache] Redis error:', error);
      this.emitEvent({
        type: 'miss',
        key: '__error__',
        timestamp: Date.now(),
        metadata: { error: error.message },
      });
    });
  }

  /**
   * 获取缓存值
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = process.hrtime.bigint();
    
    try {
      const data = await this.client.get(key);
      
      if (!data) {
        this.recordMiss();
        return null;
      }

      // 反序列化
      const value = JSON.parse(data) as T;
      this.recordHit();
      return value;
    } catch (error: any) {
      console.error(`[RedisCache] Get error for key ${key}:`, error);
      this.recordMiss();
      return null;
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
      // 序列化
      const data = JSON.stringify(value);
      const ttlSeconds = ttl ?? this.config.defaultTTL;

      if (ttlSeconds > 0) {
        await this.client.setex(key, ttlSeconds, data);
      } else {
        await this.client.set(key, data);
      }

      this.emitEvent({ type: 'set', key, timestamp: Date.now(), value });
    } catch (error: any) {
      console.error(`[RedisCache] Set error for key ${key}:`, error);
      throw new Error(`Failed to set cache: ${error.message}`);
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
      const result = await this.client.del(key);
      const existed = result > 0;
      
      if (existed) {
        this.emitEvent({ type: 'delete', key, timestamp: Date.now() });
      }
      
      return existed;
    } catch (error: any) {
      console.error(`[RedisCache] Delete error for key ${key}:`, error);
      return false;
    } finally {
      this.recordLatency(startTime);
    }
  }

  /**
   * 清空缓存
   */
  async clear(): Promise<void> {
    const startTime = process.hrtime.bigint();
    
    try {
      // keyPrefix由ioredis自动处理，这里使用通配避免重复前缀导致漏删
      const pattern = '*';
      let cursor = '0';
      let deletedCount = 0;

      do {
        const result = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = result[0];
        const keys = result[1];

        if (keys.length > 0) {
          await this.client.del(...keys);
          deletedCount += keys.length;
        }
      } while (cursor !== '0');

      this.emitEvent({
        type: 'delete',
        key: '__all__',
        timestamp: Date.now(),
        metadata: { clearedSize: deletedCount },
      });
    } catch (error: any) {
      console.error('[RedisCache] Clear error:', error);
      throw new Error(`Failed to clear cache: ${error.message}`);
    } finally {
      this.recordLatency(startTime);
    }
  }

  /**
   * 检查缓存是否存在
   */
  async has(key: string): Promise<boolean> {
    const startTime = process.hrtime.bigint();
    
    try {
      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error: any) {
      console.error(`[RedisCache] Has error for key ${key}:`, error);
      return false;
    } finally {
      this.recordLatency(startTime);
    }
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
      size: 0, // Redis不提供实时大小
      memoryUsage: 0, // 需要INFO命令
      averageLatency: this.stats.totalOperations > 0
        ? this.stats.totalLatency / this.stats.totalOperations / 1_000_000
        : 0,
      totalOperations: this.stats.totalOperations,
    };
  }

  /**
   * 获取缓存大小（异步）
   */
  async size(): Promise<number> {
    try {
      // keyPrefix由ioredis自动处理，这里使用通配避免重复前缀导致统计偏差
      const pattern = '*';
      let cursor = '0';
      let count = 0;

      do {
        const result = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = result[0];
        count += result[1].length;
      } while (cursor !== '0');

      return count;
    } catch (error: any) {
      console.error('[RedisCache] Size error:', error);
      return 0;
    }
  }

  /**
   * 获取Redis内存使用量
   */
  async getMemoryUsage(): Promise<number> {
    try {
      const info = await this.client.info('memory');
      const usedMemory = info.match(/used_memory:(\d+)/);
      return usedMemory ? parseInt(usedMemory[1], 10) : 0;
    } catch (error: any) {
      console.error('[RedisCache] Memory usage error:', error);
      return 0;
    }
  }

  /**
   * 检查连接状态
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
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
        console.error('[RedisCache] Event listener error:', error);
      }
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.eventListeners = [];
    
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }
}

export default RedisCache;
