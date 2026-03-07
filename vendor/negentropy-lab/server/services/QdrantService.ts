/**
 * 🚀 Qdrant向量数据库服务
 * 
 * @constitution
 * §102 熵减原则：通过向量化存储降低信息检索复杂度
 * §101 同步公理：确保向量数据与源数据同步
 * §148 控制论架构公理：记忆回路核心组件
 * 
 * @filename QdrantService.ts
 * @version 1.0.0
 * @category Service
 * @last_updated 2026-02-26
 */

import { QdrantClient } from '@qdrant/js-client-rest';
import path from 'path';
import fs from 'fs';

/**
 * 向量点结构
 */
export interface VectorPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

/**
 * 搜索结果
 */
export interface SearchResult {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

/**
 * 集合配置
 */
export interface CollectionConfig {
  name: string;
  vectorSize: number;
  distance: 'Cosine' | 'Euclid' | 'Dot';
}

/**
 * Qdrant服务配置
 */
export interface QdrantServiceConfig {
  url?: string;
  apiKey?: string;
  storagePath?: string;
  timeout?: number;
}

/**
 * 默认集合配置
 */
const DEFAULT_COLLECTIONS: CollectionConfig[] = [
  { name: 'openclaw_logs', vectorSize: 1536, distance: 'Cosine' },
  { name: 'knowledge_facts', vectorSize: 1536, distance: 'Cosine' },
  { name: 'entropy_patterns', vectorSize: 512, distance: 'Cosine' },
];

/**
 * Qdrant向量数据库服务
 * 支持本地存储模式和远程服务器模式
 */
export class QdrantService {
  private client: QdrantClient;
  private storagePath: string;
  private isLocalMode: boolean;
  private initialized: boolean = false;

  constructor(config: QdrantServiceConfig = {}) {
    this.storagePath = config.storagePath || path.join(process.cwd(), 'storage', 'qdrant_local');
    this.isLocalMode = !config.url;

    // 确保存储目录存在
    if (this.isLocalMode) {
      this.ensureStorageDirectory();
    }

    // 初始化Qdrant客户端
    this.client = new QdrantClient({
      url: config.url || 'http://localhost:6333',
      apiKey: config.apiKey,
      timeout: config.timeout || 30000,
    });

    console.log(`[QdrantService] 初始化完成，模式: ${this.isLocalMode ? '本地' : '远程'}`);
  }

  /**
   * 确保存储目录存在
   */
  private ensureStorageDirectory(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
      console.log(`[QdrantService] 创建存储目录: ${this.storagePath}`);
    }
  }

  /**
   * 初始化服务（创建默认集合）
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // 检查连接
      await this.client.getCollections();
      
      // 创建默认集合
      for (const config of DEFAULT_COLLECTIONS) {
        await this.ensureCollection(config);
      }

      this.initialized = true;
      console.log('[QdrantService] 服务初始化完成');
    } catch (error) {
      console.error('[QdrantService] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 确保集合存在
   */
  async ensureCollection(config: CollectionConfig): Promise<boolean> {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(c => c.name === config.name);

      if (!exists) {
        await this.client.createCollection(config.name, {
          vectors: {
            size: config.vectorSize,
            distance: config.distance,
          },
        });
        console.log(`[QdrantService] 创建集合: ${config.name}`);
      }

      return true;
    } catch (error) {
      console.error(`[QdrantService] 确保集合失败 (${config.name}):`, error);
      return false;
    }
  }

  /**
   * 插入向量点
   */
  async upsertPoints(collectionName: string, points: VectorPoint[]): Promise<boolean> {
    try {
      await this.client.upsert(collectionName, {
        wait: true,
        points: points.map(p => ({
          id: p.id,
          vector: p.vector,
          payload: p.payload,
        })),
      });

      console.log(`[QdrantService] 插入 ${points.length} 个点到 ${collectionName}`);
      return true;
    } catch (error) {
      console.error(`[QdrantService] 插入失败 (${collectionName}):`, error);
      return false;
    }
  }

  /**
   * 搜索相似向量
   */
  async search(
    collectionName: string,
    vector: number[],
    limit: number = 10,
    scoreThreshold: number = 0.7
  ): Promise<SearchResult[]> {
    try {
      const results = await this.client.search(collectionName, {
        vector,
        limit,
        score_threshold: scoreThreshold,
      });

      return results.map(r => ({
        id: String(r.id),
        score: r.score,
        payload: r.payload as Record<string, unknown>,
      }));
    } catch (error) {
      console.error(`[QdrantService] 搜索失败 (${collectionName}):`, error);
      return [];
    }
  }

  /**
   * 删除向量点
   */
  async deletePoints(collectionName: string, ids: string[]): Promise<boolean> {
    try {
      await this.client.delete(collectionName, {
        wait: true,
        points: ids,
      });

      console.log(`[QdrantService] 删除 ${ids.length} 个点从 ${collectionName}`);
      return true;
    } catch (error) {
      console.error(`[QdrantService] 删除失败 (${collectionName}):`, error);
      return false;
    }
  }

  /**
   * 获取集合统计信息
   */
  async getCollectionInfo(collectionName: string): Promise<{
    pointsCount: number;
    status: string;
  } | null> {
    try {
      const info = await this.client.getCollection(collectionName);
      return {
        pointsCount: info.points_count || 0,
        status: info.status || 'unknown',
      };
    } catch (error) {
      console.error(`[QdrantService] 获取集合信息失败 (${collectionName}):`, error);
      return null;
    }
  }

  /**
   * 获取所有集合名称
   */
  async listCollections(): Promise<string[]> {
    try {
      const collections = await this.client.getCollections();
      return collections.collections.map(c => c.name);
    } catch (error) {
      console.error('[QdrantService] 获取集合列表失败:', error);
      return [];
    }
  }

  /**
   * 检查服务健康状态
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    collections: number;
    totalPoints: number;
  }> {
    try {
      const collections = await this.client.getCollections();
      let totalPoints = 0;

      for (const col of collections.collections) {
        const info = await this.getCollectionInfo(col.name);
        if (info) {
          totalPoints += info.pointsCount;
        }
      }

      return {
        status: 'healthy',
        collections: collections.collections.length,
        totalPoints,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        collections: 0,
        totalPoints: 0,
      };
    }
  }

  /**
   * 获取客户端实例（用于高级操作）
   */
  getClient(): QdrantClient {
    return this.client;
  }

  /**
   * 关闭服务
   */
  async close(): Promise<void> {
    console.log('[QdrantService] 服务已关闭');
  }
}

// 单例实例
let qdrantServiceInstance: QdrantService | null = null;

/**
 * 获取Qdrant服务单例
 */
export function getQdrantService(config?: QdrantServiceConfig): QdrantService {
  if (!qdrantServiceInstance) {
    qdrantServiceInstance = new QdrantService(config);
  }
  return qdrantServiceInstance;
}

export default QdrantService;