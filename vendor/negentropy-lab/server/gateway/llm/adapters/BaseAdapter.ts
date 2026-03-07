/**
 * 基础适配器实现
 * 
 * 提供通用的错误处理、重试、日志等功能
 * 宪法依据: §102 熵减原则 - 复用 BaseAdapter 避免代码重复
 * 
 * @module llm/adapters/BaseAdapter
 * @version 1.0.0
 * @category LLM/Adapters
 */

import {
  ModelAdapter,
  ModelCapabilities,
  ChatRequest,
  ChatResponse,
  ChatChunk,
  ChatMessage,
  HealthStatus,
  QuotaUsage,
  AdapterConfig,
  Logger,
  DEFAULT_RETRY_CONFIG,
  RetryConfig,
  TokenUsage,
  ToolDefinition,
} from './ModelAdapter';

/**
 * 简单日志实现
 */
class SimpleLogger implements Logger {
  private prefix: string;
  
  constructor(prefix: string) {
    this.prefix = prefix;
  }
  
  private formatMessage(message: string, meta?: any): string {
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${this.prefix}] ${message}${metaStr}`;
  }
  
  info(message: string, meta?: any): void {
    console.log(this.formatMessage(message, meta));
  }
  
  warn(message: string, meta?: any): void {
    console.warn(this.formatMessage(message, meta));
  }
  
  error(message: string, meta?: any): void {
    console.error(this.formatMessage(message, meta));
  }
  
  debug(message: string, meta?: any): void {
    if (process.env.DEBUG === 'true') {
      console.debug(this.formatMessage(message, meta));
    }
  }
}

/**
 * 基础适配器错误类
 */
export class AdapterError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

/**
 * 基础适配器抽象类
 * 
 * 提供通用功能实现，子类只需实现特定于提供商的逻辑
 */
export abstract class BaseAdapter implements ModelAdapter {
  // ===== 抽象属性 =====
  /** 提供商名称（子类必须实现） */
  abstract readonly provider: string;
  
  /** 模型名称（子类必须实现） */
  abstract readonly model: string;
  
  /** 版本号（子类必须实现） */
  abstract readonly version: string;
  
  /** 模型能力声明（子类必须实现） */
  abstract readonly capabilities: ModelCapabilities;
  
  // ===== 通用属性 =====
  /** HTTP客户端 */
  protected client: any;
  
  /** 日志记录器 */
  protected logger: Logger;
  
  /** 重试配置 */
  protected retryConfig: RetryConfig;
  
  /** 超时配置 */
  protected timeout: number;
  
  /** 配置 */
  protected config: AdapterConfig;
  
  /** 统计信息 */
  protected stats: {
    totalRequests: number;
    successRequests: number;
    errorRequests: number;
    totalTokens: number;
    totalCost: number;
  } = {
    totalRequests: 0,
    successRequests: 0,
    errorRequests: 0,
    totalTokens: 0,
    totalCost: 0,
  };
  
  // ===== 构造函数 =====
  constructor(config: AdapterConfig = {}) {
    this.config = config;
    this.retryConfig = config.retry || DEFAULT_RETRY_CONFIG;
    this.timeout = config.timeout || 30000;
    this.logger = new SimpleLogger('adapter'); // 延迟初始化
    
    this.logger.info('Adapter initialized');
  }
  
  // ===== 抽象方法（子类必须实现） =====
  
  /**
   * 执行聊天请求（子类实现）
   * @param request 聊天请求
   * @returns 聊天响应
   */
  protected abstract doChat(request: ChatRequest): Promise<ChatResponse>;
  
  /**
   * 执行流式聊天（子类实现）
   * @param request 聊天请求
   * @returns 异步迭代器
   */
  protected abstract doChatStream(request: ChatRequest): AsyncIterableIterator<ChatChunk>;
  
  /**
   * 执行嵌入（子类实现）
   * @param text 输入文本
   * @returns 嵌入向量
   */
  protected abstract doEmbed(text: string): Promise<number[]>;
  
  // ===== 公共接口实现 =====
  
  /**
   * 聊天接口（带重试）
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.stats.totalRequests++;
    
    try {
      const response = await this.withRetry(async () => {
        return await this.doChat(request);
      });
      
      this.stats.successRequests++;
      
      // 更新统计信息
      if (response.usage) {
        this.stats.totalTokens += response.usage.total_tokens;
        this.stats.totalCost += this.getCost(response.usage.total_tokens);
      }
      
      this.logger.info('Chat completed', {
        model: this.model,
        latency: response.latency,
        tokens: response.usage?.total_tokens,
      });
      
      return response;
      
    } catch (error: any) {
      this.stats.errorRequests++;
      
      this.logger.error('Chat failed', {
        error: error.message,
        code: error.code,
      });
      
      throw error;
    }
  }
  
  /**
   * 流式聊天
   */
  async *chatStream(request: ChatRequest): AsyncIterableIterator<ChatChunk> {
    this.stats.totalRequests++;
    
    try {
      yield* this.doChatStream(request);
      this.stats.successRequests++;
      
      this.logger.info('Stream chat completed', {
        model: this.model,
      });
      
    } catch (error: any) {
      this.stats.errorRequests++;
      
      this.logger.error('Stream chat failed', {
        error: error.message,
        code: error.code,
      });
      
      throw error;
    }
  }
  
  /**
   * 文本嵌入
   */
  async embed(text: string): Promise<number[]> {
    return await this.doEmbed(text);
  }
  
  /**
   * 初始化适配器
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing adapter');
    // 子类可以覆盖此方法实现特定的初始化逻辑
  }
  
  /**
   * 健康检查
   */
  async healthCheck(): Promise<HealthStatus> {
    try {
      const startTime = Date.now();
      
      await this.doChat({
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 1,
      });
      
      const latency = Date.now() - startTime;
      
      return {
        provider: this.provider,
        model: this.model,
        status: latency < 1000 ? 'healthy' : 'degraded',
        latency,
        lastCheck: new Date(),
        errorRate: this.stats.totalRequests > 0
          ? this.stats.errorRequests / this.stats.totalRequests
          : 0,
      };
      
    } catch (error: any) {
      return {
        provider: this.provider,
        model: this.model,
        status: 'unhealthy',
        latency: 0,
        lastCheck: new Date(),
        errorRate: 1,
      };
    }
  }
  
  /**
   * 释放资源
   */
  async dispose(): Promise<void> {
    this.logger.info('Disposing adapter', {
      stats: this.stats,
    });
    // 子类可以覆盖此方法释放特定资源
  }
  
  /**
   * 获取配额使用情况
   */
  async getQuotaUsage(): Promise<QuotaUsage> {
    // 子类可以覆盖此方法查询实际的配额信息
    return {
      used: this.stats.totalTokens,
      total: Number.MAX_SAFE_INTEGER,
      resetTime: new Date(Date.now() + 86400000), // 24小时后
    };
  }
  
  /**
   * 计算成本
   */
  getCost(tokens: number): number {
    // 简单计算：假设输入和输出各占一半
    const inputTokens = tokens / 2;
    const outputTokens = tokens / 2;
    
    const inputCost = (inputTokens / 1000) * this.capabilities.cost_per_1k_input_tokens;
    const outputCost = (outputTokens / 1000) * this.capabilities.cost_per_1k_output_tokens;
    
    return inputCost + outputCost;
  }
  
  /**
   * 获取统计信息
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }
  
  // ===== 通用辅助方法 =====
  
  /**
   * 带重试的执行
   */
  protected async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        
        // 检查是否可重试
        if (!this.isRetryableError(error)) {
          throw error;
        }
        
        // 最后一次尝试失败，不再重试
        if (attempt === this.retryConfig.maxRetries - 1) {
          throw error;
        }
        
        // 计算延迟时间（指数退避）
        const delay = this.retryConfig.delayMs * Math.pow(this.retryConfig.backoffFactor, attempt);
        
        this.logger.warn('Retrying request', {
          attempt: attempt + 1,
          maxRetries: this.retryConfig.maxRetries,
          delay,
          error: error.message,
        });
        
        await this.sleep(delay);
      }
    }
    
    throw lastError ?? new Error('Retry failed without a captured error');
  }
  
  /**
   * 判断错误是否可重试
   */
  protected isRetryableError(error: any): boolean {
    if (error instanceof AdapterError) {
      return this.retryConfig.retryableErrors.includes(error.code);
    }
    
    // 网络错误通常可重试
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      return true;
    }
    
    return false;
  }
  
  /**
   * 休眠指定时间
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 估算Token数量
   * 
   * 简单估算方法：英文每4字符1token，中文每2字符1token
   */
  protected estimateTokens(text: string): number {
    if (!text) return 0;
    
    const charCount = text.length;
    const englishCount = (text.match(/[a-zA-Z]/g) || []).length;
    const englishRatio = englishCount / Math.max(charCount, 1);
    
    // 英文约4字符=1token，中文约2字符=1token
    const tokensPerChar = englishRatio > 0.7 ? 0.25 : 0.5;
    
    return Math.ceil(charCount * tokensPerChar);
  }
  
  /**
   * 转换Token使用统计
   */
  protected transformUsage(usage: any): TokenUsage {
    return {
      prompt_tokens: usage.prompt_tokens || 0,
      completion_tokens: usage.completion_tokens || 0,
      total_tokens: usage.total_tokens || 0,
    };
  }
  
  /**
   * 转换聊天消息
   */
  protected transformMessages(messages: ChatMessage[]): any[] {
    return messages.map(msg => {
      const transformed: any = {
        role: msg.role,
        content: msg.content,
      };
      
      if (msg.name) {
        transformed.name = msg.name;
      }
      
      if (msg.tool_calls) {
        transformed.tool_calls = msg.tool_calls;
      }
      
      if (msg.tool_call_id) {
        transformed.tool_call_id = msg.tool_call_id;
      }
      
      return transformed;
    });
  }
  
  /**
   * 转换工具定义
   */
  protected transformTools(tools?: ToolDefinition[]): any[] | undefined {
    if (!tools || tools.length === 0) {
      return undefined;
    }
    
    return tools.map(tool => ({
      type: tool.type,
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      },
    }));
  }
}

/**
 * 导入接口类型（为了方便子类使用）
 */
export type {
  ModelAdapter,
  ModelCapabilities,
  ChatRequest,
  ChatResponse,
  ChatChunk,
  ChatMessage,
  HealthStatus,
  QuotaUsage,
  AdapterConfig,
  Logger,
  RetryConfig,
} from './ModelAdapter';
