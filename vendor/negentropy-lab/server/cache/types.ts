/**
 * 🔧 缓存系统类型定义
 * 
 * 宪法依据：
 * - §101 单一真理源原则：统一类型定义
 * - §102 熵减原则：清晰的接口抽象
 * - §111 资源管理公理：缓存资源管理
 */

/**
 * 缓存层接口
 */
export interface CacheLayer {
  /**
   * 获取缓存值
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * 设置缓存值
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * 删除缓存
   */
  delete(key: string): Promise<boolean>;

  /**
   * 清空缓存
   */
  clear(): Promise<void>;

  /**
   * 检查缓存是否存在
   */
  has(key: string): Promise<boolean>;

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats;

  /**
   * 获取缓存大小
   */
  size(): Promise<number>;
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  memoryUsage: number;
  averageLatency: number;
  totalOperations: number;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  /**
   * 缓存名称
   */
  name: string;

  /**
   * 最大条目数
   */
  maxSize: number;

  /**
   * 默认TTL（秒）
   */
  defaultTTL: number;

  /**
   * 淘汰策略
   */
  evictionPolicy: 'lru' | 'lfu' | 'fifo';

  /**
   * 是否启用统计
   */
  enableStats: boolean;

  /**
   * 清理间隔（秒）
   */
  cleanupInterval: number;
}

/**
 * 缓存条目
 */
export interface CacheEntry<T = any> {
  key: string;
  value: T;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
  accessCount: number;
  lastAccessedAt: number;
  size: number;
}

/**
 * 缓存事件
 */
export interface CacheEvent {
  type: 'hit' | 'miss' | 'set' | 'delete' | 'evict' | 'expire';
  key: string;
  timestamp: number;
  value?: any;
  metadata?: Record<string, any>;
}

/**
 * 缓存事件监听器
 */
export type CacheEventListener = (event: CacheEvent) => void;

/**
 * 三层缓存配置
 */
export interface LayeredCacheConfig {
  /**
   * L1缓存配置（内存）
   */
  l1: CacheConfig;

  /**
   * L2缓存配置（Redis）
   */
  l2?: CacheConfig & {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
    reconnectOnError?: boolean;
    maxRetriesPerRequest?: number;
  };

  /**
   * L3缓存配置（SQLite）
   */
  l3?: CacheConfig & {
    dbPath: string;
  };
}

/**
 * 缓存性能指标
 */
export interface CachePerformanceMetrics {
  hitRate: number;
  averageLatency: number;
  throughput: number;
  memoryEfficiency: number;
  evictionRate: number;
}
