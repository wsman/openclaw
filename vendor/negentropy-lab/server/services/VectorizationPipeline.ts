/**
 * 🚀 向量化流水线服务
 * 
 * @constitution
 * §102 熵减原则：通过流水线处理降低数据处理复杂度
 * §148 控制论架构公理：记忆回路核心组件
 * §101 同步公理：确保数据处理的原子性
 * 
 * @filename VectorizationPipeline.ts
 * @version 1.0.0
 * @category Service
 * @last_updated 2026-02-26
 */

import { QdrantService, getQdrantService } from './QdrantService';
import { EmbeddingService, getEmbeddingService } from './EmbeddingService';

/**
 * 流水线任务
 */
export interface PipelineTask {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  collection: string;
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
}

/**
 * 流水线结果
 */
export interface PipelineResult {
  taskId: string;
  success: boolean;
  vectorId?: string;
  error?: string;
  processingTime: number;
}

/**
 * 流水线统计
 */
export interface PipelineStats {
  totalProcessed: number;
  successful: number;
  failed: number;
  averageProcessingTime: number;
  queueSize: number;
}

/**
 * 流水线配置
 */
export interface PipelineConfig {
  batchSize: number;
  concurrency: number;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: PipelineConfig = {
  batchSize: 100,
  concurrency: 5,
  retryAttempts: 3,
  retryDelay: 1000,
};

/**
 * 向量化流水线服务
 * 负责将文本数据转换为向量并存储到Qdrant
 */
export class VectorizationPipeline {
  private qdrantService: QdrantService;
  private embeddingService: EmbeddingService;
  private config: PipelineConfig;
  private queue: PipelineTask[] = [];
  private processing: boolean = false;
  private stats: PipelineStats = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    averageProcessingTime: 0,
    queueSize: 0,
  };

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.qdrantService = getQdrantService();
    this.embeddingService = getEmbeddingService();
    console.log('[VectorizationPipeline] 初始化完成');
  }

  /**
   * 添加任务到队列
   */
  addTask(task: Omit<PipelineTask, 'createdAt'>): string {
    const fullTask: PipelineTask = {
      ...task,
      createdAt: new Date(),
    };

    // 根据优先级插入队列
    if (task.priority === 'high') {
      this.queue.unshift(fullTask);
    } else {
      this.queue.push(fullTask);
    }

    this.stats.queueSize = this.queue.length;
    console.log(`[VectorizationPipeline] 添加任务: ${task.id}, 队列大小: ${this.queue.length}`);

    return task.id;
  }

  /**
   * 批量添加任务
   */
  addBatchTasks(tasks: Omit<PipelineTask, 'createdAt'>[]): string[] {
    return tasks.map(task => this.addTask(task));
  }

  /**
   * 处理单个任务
   */
  async processTask(task: PipelineTask): Promise<PipelineResult> {
    const startTime = Date.now();

    try {
      // 1. 生成嵌入向量
      const embeddingResult = await this.embeddingService.embed(task.content);

      // 2. 构建向量点
      const vectorPoint = {
        id: task.id,
        vector: embeddingResult.vector,
        payload: {
          content: task.content.substring(0, 1000), // 限制内容长度
          ...task.metadata,
          processedAt: new Date().toISOString(),
          tokens: embeddingResult.tokens,
          model: embeddingResult.model,
        },
      };

      // 3. 存储到Qdrant
      const success = await this.qdrantService.upsertPoints(task.collection, [vectorPoint]);

      const processingTime = Date.now() - startTime;

      if (success) {
        return {
          taskId: task.id,
          success: true,
          vectorId: task.id,
          processingTime,
        };
      } else {
        throw new Error('Qdrant存储失败');
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      return {
        taskId: task.id,
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        processingTime,
      };
    }
  }

  /**
   * 处理队列中的所有任务
   */
  async processQueue(): Promise<PipelineResult[]> {
    if (this.processing) {
      console.log('[VectorizationPipeline] 已有处理任务在进行中');
      return [];
    }

    this.processing = true;
    const results: PipelineResult[] = [];
    const batch: PipelineTask[] = [];

    // 取出一批任务
    while (this.queue.length > 0 && batch.length < this.config.batchSize) {
      batch.push(this.queue.shift()!);
    }

    console.log(`[VectorizationPipeline] 开始处理 ${batch.length} 个任务`);

    // 并发处理
    const chunks: PipelineTask[][] = [];
    for (let i = 0; i < batch.length; i += this.config.concurrency) {
      chunks.push(batch.slice(i, i + this.config.concurrency));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(task => this.processWithRetry(task))
      );
      results.push(...chunkResults);

      // 更新统计
      for (const result of chunkResults) {
        this.stats.totalProcessed++;
        if (result.success) {
          this.stats.successful++;
        } else {
          this.stats.failed++;
        }
        this.stats.averageProcessingTime = 
          (this.stats.averageProcessingTime * (this.stats.totalProcessed - 1) + result.processingTime) 
          / this.stats.totalProcessed;
      }
    }

    this.stats.queueSize = this.queue.length;
    this.processing = false;

    console.log(`[VectorizationPipeline] 处理完成，成功: ${results.filter(r => r.success).length}, 失败: ${results.filter(r => !r.success).length}`);

    return results;
  }

  /**
   * 带重试的任务处理
   */
  private async processWithRetry(task: PipelineTask): Promise<PipelineResult> {
    let lastResult: PipelineResult | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      lastResult = await this.processTask(task);

      if (lastResult.success) {
        return lastResult;
      }

      console.warn(`[VectorizationPipeline] 任务 ${task.id} 第 ${attempt} 次尝试失败: ${lastResult.error}`);

      if (attempt < this.config.retryAttempts) {
        await this.sleep(this.config.retryDelay * attempt);
      }
    }

    return lastResult!;
  }

  /**
   * 语义搜索
   */
  async search(
    collection: string,
    query: string,
    limit: number = 10,
    scoreThreshold: number = 0.7
  ): Promise<Array<{
    id: string;
    score: number;
    content: string;
    metadata: Record<string, unknown>;
  }>> {
    // 1. 生成查询向量
    const embeddingResult = await this.embeddingService.embed(query);

    // 2. 在Qdrant中搜索
    const searchResults = await this.qdrantService.search(
      collection,
      embeddingResult.vector,
      limit,
      scoreThreshold
    );

    // 3. 格式化结果
    return searchResults.map(result => ({
      id: result.id,
      score: result.score,
      content: String(result.payload.content || ''),
      metadata: result.payload,
    }));
  }

  /**
   * 获取统计信息
   */
  getStats(): PipelineStats {
    return { ...this.stats };
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.queue = [];
    this.stats.queueSize = 0;
    console.log('[VectorizationPipeline] 队列已清空');
  }

  /**
   * 初始化流水线
   */
  async initialize(): Promise<void> {
    await this.qdrantService.initialize();
    await this.embeddingService.initialize();
    console.log('[VectorizationPipeline] 流水线初始化完成');
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    queueSize: number;
    stats: PipelineStats;
  }> {
    const qdrantHealth = await this.qdrantService.healthCheck();
    const embeddingHealth = await this.embeddingService.healthCheck();

    return {
      status: qdrantHealth.status === 'healthy' && embeddingHealth.status === 'healthy' 
        ? 'healthy' 
        : 'unhealthy',
      queueSize: this.queue.length,
      stats: this.getStats(),
    };
  }

  /**
   * 辅助方法：延迟
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 单例实例
let pipelineInstance: VectorizationPipeline | null = null;

/**
 * 获取流水线单例
 */
export function getVectorizationPipeline(config?: Partial<PipelineConfig>): VectorizationPipeline {
  if (!pipelineInstance) {
    pipelineInstance = new VectorizationPipeline(config);
  }
  return pipelineInstance;
}

export default VectorizationPipeline;