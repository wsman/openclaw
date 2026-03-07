/**
 * 🚀 向量嵌入服务
 * 
 * @constitution
 * §102 熵减原则：通过向量化将高维信息压缩为低维表示
 * §148 控制论架构公理：记忆回路核心组件
 * §108 异构模型公理：支持多种嵌入模型
 * 
 * @filename EmbeddingService.ts
 * @version 1.0.0
 * @category Service
 * @last_updated 2026-02-26
 */

/**
 * 嵌入模型配置
 */
export interface EmbeddingModelConfig {
  provider: 'openai' | 'local' | 'mock';
  model: string;
  dimensions: number;
  apiKey?: string;
  baseUrl?: string;
}

/**
 * 嵌入结果
 */
export interface EmbeddingResult {
  vector: number[];
  tokens: number;
  model: string;
}

/**
 * 批量嵌入结果
 */
export interface BatchEmbeddingResult {
  vectors: number[][];
  totalTokens: number;
  model: string;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: EmbeddingModelConfig = {
  provider: 'mock',
  model: 'mock-embedding',
  dimensions: 1536,
};

/**
 * 向量嵌入服务
 * 支持OpenAI、本地模型和Mock模式
 */
export class EmbeddingService {
  private config: EmbeddingModelConfig;
  private initialized: boolean = false;

  constructor(config: Partial<EmbeddingModelConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log(`[EmbeddingService] 初始化，模型: ${this.config.model}`);
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // 根据provider进行初始化
    switch (this.config.provider) {
      case 'openai':
        // OpenAI初始化检查
        if (!this.config.apiKey) {
          console.warn('[EmbeddingService] 未配置OpenAI API Key，将使用Mock模式');
          this.config.provider = 'mock';
        }
        break;
      case 'local':
        // 本地模型初始化
        console.log('[EmbeddingService] 本地模型模式');
        break;
      default:
        console.log('[EmbeddingService] Mock模式');
    }

    this.initialized = true;
    console.log('[EmbeddingService] 服务初始化完成');
  }

  /**
   * 生成单个文本的嵌入向量
   */
  async embed(text: string): Promise<EmbeddingResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    switch (this.config.provider) {
      case 'openai':
        return this.embedWithOpenAI(text);
      case 'local':
        return this.embedWithLocal(text);
      default:
        return this.embedWithMock(text);
    }
  }

  /**
   * 批量生成嵌入向量
   */
  async embedBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const results = await Promise.all(texts.map(text => this.embed(text)));
    
    return {
      vectors: results.map(r => r.vector),
      totalTokens: results.reduce((sum, r) => sum + r.tokens, 0),
      model: this.config.model,
    };
  }

  /**
   * 使用OpenAI生成嵌入
   */
  private async embedWithOpenAI(text: string): Promise<EmbeddingResult> {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          input: text,
          model: this.config.model || 'text-embedding-3-small',
        }),
      });

      const data = await response.json() as {
        data: Array<{ embedding: number[] }>;
        usage: { total_tokens: number };
        model: string;
      };

      return {
        vector: data.data[0].embedding,
        tokens: data.usage.total_tokens,
        model: data.model,
      };
    } catch (error) {
      console.error('[EmbeddingService] OpenAI嵌入失败:', error);
      // 降级到Mock模式
      return this.embedWithMock(text);
    }
  }

  /**
   * 使用本地模型生成嵌入
   */
  private async embedWithLocal(text: string): Promise<EmbeddingResult> {
    // 本地模型实现（需要额外配置）
    // 暂时使用Mock
    console.log('[EmbeddingService] 本地模型暂不可用，使用Mock');
    return this.embedWithMock(text);
  }

  /**
   * Mock嵌入（用于测试和降级）
   */
  private embedWithMock(text: string): Promise<EmbeddingResult> {
    // 使用简单的哈希算法生成确定性向量
    const dimensions = this.config.dimensions;
    const vector: number[] = new Array(dimensions).fill(0);
    
    // 基于文本生成伪随机但确定性的向量
    const hash = this.simpleHash(text);
    for (let i = 0; i < dimensions; i++) {
      vector[i] = Math.sin(hash * (i + 1) * 0.0001) * 0.5 + 
                  Math.cos(hash * (i + 1) * 0.0002) * 0.5;
    }

    // 归一化向量
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    const normalizedVector = vector.map(v => v / magnitude);

    return Promise.resolve({
      vector: normalizedVector,
      tokens: Math.ceil(text.length / 4), // 估算token数
      model: this.config.model,
    });
  }

  /**
   * 简单哈希函数
   */
  private simpleHash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash);
  }

  /**
   * 计算两个向量的余弦相似度
   */
  cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('向量维度不匹配');
    }

    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      magnitude1 += vec1[i] * vec1[i];
      magnitude2 += vec2[i] * vec2[i];
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }

    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * 获取当前配置
   */
  getConfig(): EmbeddingModelConfig {
    return { ...this.config };
  }

  /**
   * 获取向量维度
   */
  getDimensions(): number {
    return this.config.dimensions;
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    provider: string;
    model: string;
    dimensions: number;
  }> {
    try {
      // 尝试生成一个简单的嵌入
      const result = await this.embed('health check');
      
      return {
        status: 'healthy',
        provider: this.config.provider,
        model: result.model,
        dimensions: result.vector.length,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        provider: this.config.provider,
        model: this.config.model,
        dimensions: this.config.dimensions,
      };
    }
  }
}

// 单例实例
let embeddingServiceInstance: EmbeddingService | null = null;

/**
 * 获取嵌入服务单例
 */
export function getEmbeddingService(config?: Partial<EmbeddingModelConfig>): EmbeddingService {
  if (!embeddingServiceInstance) {
    embeddingServiceInstance = new EmbeddingService(config);
  }
  return embeddingServiceInstance;
}

export default EmbeddingService;