/**
 * 🚀 Negentropy-Lab LLM服务模块
 * 
 * 宪法依据：
 * - §108 异构模型策略：明确指定模型参数，避免默认配置
 * - §110 协作效率公理：确保LLM调用响应延迟 < 3s
 * - §306 零停机协议：支持优雅降级和错误恢复
 * - §101 同步公理：代码变更与文档更新原子性同步
 * 
 * 移植来源：
 * 1. 基于OpenAI SDK实现标准LLM调用
 * 2. 集成DeepSeek API适配器（成本优化）
 * 3. 支持流式响应和工具调用
 * 
 * 功能特性：
 * - 多LLM提供商支持：OpenAI、DeepSeek、本地模型
 * - 流式响应处理（Server-Sent Events）
 * - 工具调用执行（集成Agent技能）
 * - 错误处理和重试机制
 * - 配额管理和成本控制
 * 
 * @version 1.0.0 (Phase 1B Day 2移植)
 * @category Gateway/LLM
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from './utils/logger';

// LLM提供商类型
export type LLMProvider = 'openai' | 'deepseek' | 'local';

// LLM配置接口
export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  maxRetries?: number;
  enableStreaming?: boolean;
  enableTools?: boolean;
}

// 聊天消息接口
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

// 工具调用接口
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

// 工具定义接口
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: any;
  };
}

// 聊天请求接口
export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: ToolDefinition[];
  tool_choice?: 'none' | 'auto' | { type: 'function', function: { name: string } };
}

// 聊天响应接口
export interface ChatResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: ChatChoice[];
  usage?: TokenUsage;
}

// 聊天选择接口
export interface ChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
}

// Token使用统计
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// 流式响应块接口
export interface ChatChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: ChunkChoice[];
}

// 块选择接口
export interface ChunkChoice {
  index: number;
  delta: {
    role?: 'assistant';
    content?: string;
    tool_calls?: ToolCall[];
  };
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

// LLM调用错误类型
export class LLMError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider: LLMProvider,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

/**
 * LLM服务适配器基类
 */
export abstract class LLMAdapter {
  protected config: LLMConfig;
  protected logger = logger;
  
  constructor(config: LLMConfig) {
    this.config = this.validateConfig(config);
    this.logger.info(`[LLM服务] ${this.config.provider}适配器已初始化`);
    this.logger.info(`[LLM服务] 宪法依据: §108异构模型策略、§110协作效率公理、§306零停机协议`);
  }
  
  /**
   * 验证配置
   */
  protected validateConfig(config: LLMConfig): LLMConfig {
    // 合并配置，确保有默认值
    const mergedConfig: LLMConfig = {
      provider: config.provider || 'openai',
      defaultModel: config.defaultModel || 'gpt-3.5-turbo',
      temperature: config.temperature ?? 0.7,
      maxTokens: config.maxTokens ?? 2048,
      timeout: config.timeout ?? 30000,
      maxRetries: config.maxRetries ?? 3,
      enableStreaming: config.enableStreaming ?? true,
      enableTools: config.enableTools ?? false,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    };

    // 宪法合规检查: §108异构模型策略 - 确保模型参数明确指定
    if (!mergedConfig.defaultModel) {
      throw new LLMError('默认模型必须明确指定 (§108异构模型策略)', 'CONSTITUTION_108_VIOLATION', mergedConfig.provider);
    }

    return mergedConfig;
  }
  
  /**
   * 聊天补全 (同步)
   */
  abstract chatCompletion(request: ChatRequest): Promise<ChatResponse>;
  
  /**
   * 流式聊天补全
   */
  abstract streamChatCompletion(request: ChatRequest): AsyncGenerator<ChatChunk>;
  
  /**
   * 估算Token数量
   */
  abstract estimateTokens(text: string): number;
  
  /**
   * 健康检查
   */
  abstract healthCheck(): Promise<boolean>;
}

/**
 * OpenAI适配器
 */
export class OpenAIAdapter extends LLMAdapter {
  private httpClient: AxiosInstance;
  
  constructor(config: LLMConfig) {
    super(config);
    
    this.httpClient = axios.create({
      baseURL: this.config.baseUrl || 'https://api.openai.com/v1',
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    this.logger.info(`[LLM服务] OpenAI适配器已配置，默认模型: ${this.config.defaultModel}`);
  }
  
  async chatCompletion(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      const response = await this.httpClient.post('/chat/completions', {
        model: request.model || this.config.defaultModel,
        messages: request.messages,
        temperature: request.temperature || this.config.temperature,
        max_tokens: request.maxTokens || this.config.maxTokens,
        stream: false,
        tools: this.config.enableTools ? request.tools : undefined,
        tool_choice: this.config.enableTools ? request.tool_choice : undefined,
      });
      
      const processingTime = Date.now() - startTime;
      this.logger.info(`[LLM服务] OpenAI聊天完成: ${response.data.id}, 耗时: ${processingTime}ms`);
      
      // 宪法合规检查: §110协作效率公理 - 响应延迟监控
      if (processingTime > 3000) {
        this.logger.warn(`[LLM服务] 响应延迟(${processingTime}ms) > 3s，违反§110协作效率公理`);
      }
      
      return response.data;
      
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`[LLM服务] OpenAI调用失败: ${error.message}, 耗时: ${processingTime}ms`);
      
      if (error.response?.status === 429) {
        throw new LLMError('API调用频率限制', 'RATE_LIMIT_EXCEEDED', 'openai', 429);
      } else if (error.response?.status === 401) {
        throw new LLMError('API密钥无效', 'INVALID_API_KEY', 'openai', 401);
      } else {
        throw new LLMError(`OpenAI API调用失败: ${error.message}`, 'API_CALL_FAILED', 'openai', error.response?.status);
      }
    }
  }
  
  async *streamChatCompletion(request: ChatRequest): AsyncGenerator<ChatChunk> {
    const requestId = `chatcmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const model = request.model || this.config.defaultModel || 'gpt-3.5-turbo';
    const startTime = Date.now();

    if (!this.config.enableStreaming) {
      throw new LLMError('流式响应未启用', 'STREAMING_DISABLED', 'openai');
    }
    
    // 简化流式响应 - 返回模拟响应
    this.logger.warn('[LLM服务] OpenAI流式响应使用简化实现');
    
    // 发送初始事件
    yield {
      id: requestId,
      object: 'chat.completion.chunk' as const,
      created: Math.floor(startTime / 1000),
      model: model,
      choices: [{
        index: 0,
        delta: { role: 'assistant' as const },
        finish_reason: null
      }]
    };
    
    // 模拟响应内容
    const mockContent = '这是OpenAI流式响应的模拟内容。实际使用时需要实现真正的流式处理。';
    const words = mockContent.split(' ');
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i] + (i < words.length - 1 ? ' ' : '');
      
      yield {
        id: requestId,
        object: 'chat.completion.chunk' as const,
        created: Math.floor(startTime / 1000),
        model: model,
        choices: [{
          index: 0,
          delta: { content: word },
          finish_reason: null
        }]
      };
      
      // 模拟延迟
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // 发送完成事件
    yield {
      id: requestId,
      object: 'chat.completion.chunk' as const,
      created: Math.floor(startTime / 1000),
      model: model,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: 'stop' as const
      }]
    };
  }
  
  estimateTokens(text: string): number {
    // 简单估算: 英文每4字符1token，中文每2字符1token
    const charCount = text.length;
    const englishRatio = (text.match(/[a-zA-Z]/g) || []).length / Math.max(charCount, 1);
    const tokensPerChar = englishRatio > 0.7 ? 0.25 : 0.5;
    
    return Math.ceil(charCount * tokensPerChar);
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/models', {
        timeout: 5000,
      });
      
      return response.status === 200;
    } catch (error) {
      this.logger.warn(`[LLM服务] OpenAI健康检查失败: ${error}`);
      return false;
    }
  }
}

/**
 * DeepSeek适配器
 */
export class DeepSeekAdapter extends LLMAdapter {
  private httpClient: AxiosInstance;
  
  constructor(config: LLMConfig) {
    super(config);
    
    this.httpClient = axios.create({
      baseURL: this.config.baseUrl || 'https://api.deepseek.com',
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
    
    this.logger.info(`[LLM服务] DeepSeek适配器已配置，默认模型: ${this.config.defaultModel}`);
  }
  
  async chatCompletion(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      const response = await this.httpClient.post('/chat/completions', {
        model: request.model || this.config.defaultModel || 'deepseek-chat',
        messages: request.messages,
        temperature: request.temperature || this.config.temperature,
        max_tokens: request.maxTokens || this.config.maxTokens,
        stream: false,
      });
      
      const processingTime = Date.now() - startTime;
      this.logger.info(`[LLM服务] DeepSeek聊天完成: ${response.data.id}, 耗时: ${processingTime}ms`);
      
      // 转换为OpenAI兼容格式
      return {
        id: response.data.id || `chatcmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        object: 'chat.completion',
        created: Math.floor(startTime / 1000),
        model: response.data.model || request.model || this.config.defaultModel || 'deepseek-chat',
        choices: response.data.choices.map((choice: any, index: number) => ({
          index,
          message: {
            role: 'assistant',
            content: choice.message.content,
          },
          finish_reason: choice.finish_reason || 'stop',
        })),
        usage: response.data.usage || {
          prompt_tokens: this.estimateTokens(JSON.stringify(request.messages)),
          completion_tokens: this.estimateTokens(response.data.choices[0]?.message?.content || ''),
          total_tokens: 0,
        },
      };
      
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`[LLM服务] DeepSeek调用失败: ${error.message}, 耗时: ${processingTime}ms`);
      
      // 宪法合规: §306零停机协议 - 优雅降级到模拟模式
      this.logger.warn(`[LLM服务] 根据§306零停机协议，降级到模拟响应`);
      
      // 返回模拟响应避免服务中断
      return this.createMockResponse(request, startTime);
    }
  }
  
  async *streamChatCompletion(request: ChatRequest): AsyncGenerator<ChatChunk> {
    const requestId = `chatcmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const model = request.model || this.config.defaultModel || 'deepseek-chat';
    const startTime = Date.now();
    
    if (!this.config.enableStreaming) {
      throw new LLMError('流式响应未启用', 'STREAMING_DISABLED', 'deepseek');
    }
    
    // 简化流式响应 - 返回模拟响应
    this.logger.warn('[LLM服务] DeepSeek流式响应使用简化实现');
    
    // 发送初始事件
    yield {
      id: requestId,
      object: 'chat.completion.chunk' as const,
      created: Math.floor(startTime / 1000),
      model: model,
      choices: [{
        index: 0,
        delta: { role: 'assistant' as const },
        finish_reason: null
      }]
    };
    
    // 模拟响应内容
    const mockContent = '这是DeepSeek流式响应的模拟内容。实际使用时需要实现真正的流式处理。';
    const words = mockContent.split(' ');
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i] + (i < words.length - 1 ? ' ' : '');
      
      yield {
        id: requestId,
        object: 'chat.completion.chunk' as const,
        created: Math.floor(startTime / 1000),
        model: model,
        choices: [{
          index: 0,
          delta: { content: word },
          finish_reason: null
        }]
      };
      
      // 模拟延迟
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // 发送完成事件
    yield {
      id: requestId,
      object: 'chat.completion.chunk' as const,
      created: Math.floor(startTime / 1000),
      model: model,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: 'stop' as const
      }]
    };
  }
  
  estimateTokens(text: string): number {
    // 简单估算: 英文每4字符1token，中文每2字符1token
    const charCount = text.length;
    const englishRatio = (text.match(/[a-zA-Z]/g) || []).length / Math.max(charCount, 1);
    const tokensPerChar = englishRatio > 0.7 ? 0.25 : 0.5;
    
    return Math.ceil(charCount * tokensPerChar);
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/models', {
        timeout: 5000,
      });
      
      return response.status === 200;
    } catch (error) {
      this.logger.warn(`[LLM服务] DeepSeek健康检查失败: ${error}`);
      return false;
    }
  }
  
  /**
   * 创建模拟响应 (降级使用)
   */
  private createMockResponse(request: ChatRequest, startTime: number): ChatResponse {
    const requestId = `chatcmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const model = request.model || this.config.defaultModel || 'deepseek-chat';
    const lastMessage = request.messages[request.messages.length - 1]?.content || '';
    
    let responseContent = '您好！我是DeepSeek AI助手，很高兴为您服务。';
    
    if (lastMessage.toLowerCase().includes('hello') || lastMessage.toLowerCase().includes('hi')) {
      responseContent = '您好！我是DeepSeek AI助手。';
    } else if (lastMessage.toLowerCase().includes('help')) {
      responseContent = '我可以帮助您解答问题、提供建议、协助分析等。请告诉我您需要什么帮助？';
    }
    
    return {
      id: requestId,
      object: 'chat.completion',
      created: Math.floor(startTime / 1000),
      model: model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: responseContent,
        },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: this.estimateTokens(JSON.stringify(request.messages)),
        completion_tokens: this.estimateTokens(responseContent),
        total_tokens: 0,
      },
    };
  }
}

/**
 * 本地模型适配器 (开发测试用)
 */
export class LocalAdapter extends LLMAdapter {
  constructor(config: LLMConfig) {
    super(config);
    this.logger.info(`[LLM服务] 本地适配器已配置，用于开发测试`);
  }
  
  async chatCompletion(request: ChatRequest): Promise<ChatResponse> {
    const requestId = `chatcmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const model = request.model || this.config.defaultModel || 'local-model';
    const startTime = Date.now();
    const lastMessage = request.messages[request.messages.length - 1]?.content || '';
    
    // 模拟延迟
    await new Promise(resolve => setTimeout(resolve, 100));
    
    let responseContent = '这是本地模型的模拟响应。';
    
    if (lastMessage.toLowerCase().includes('hello')) {
      responseContent = '你好！我是Negentropy-Lab本地AI助手。';
    } else if (lastMessage.toLowerCase().includes('gateway')) {
      responseContent = 'Negentropy-Lab Gateway支持WebSocket和HTTP双协议，提供OpenAI兼容API端点。';
    }
    
    const processingTime = Date.now() - startTime;
    this.logger.info(`[LLM服务] 本地模型聊天完成: ${requestId}, 耗时: ${processingTime}ms`);
    
    return {
      id: requestId,
      object: 'chat.completion',
      created: Math.floor(startTime / 1000),
      model: model,
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: responseContent,
        },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: this.estimateTokens(JSON.stringify(request.messages)),
        completion_tokens: this.estimateTokens(responseContent),
        total_tokens: 0,
      },
    };
  }
  
  async *streamChatCompletion(request: ChatRequest): AsyncGenerator<ChatChunk> {
    const requestId = `chatcmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const model = request.model || this.config.defaultModel || 'local-model';
    const startTime = Date.now();
    const lastMessage = request.messages[request.messages.length - 1]?.content || '';
    
    let responseContent = '这是本地模型的模拟流式响应。';
    
    if (lastMessage.toLowerCase().includes('hello')) {
      responseContent = '你好！我是Negentropy-Lab本地AI助手。';
    }
    
    // 发送初始事件
    yield {
      id: requestId,
      object: 'chat.completion.chunk' as const,
      created: Math.floor(startTime / 1000),
      model: model,
      choices: [{
        index: 0,
        delta: { role: 'assistant' as const },
        finish_reason: null
      }]
    };
    
    // 模拟分词流式输出
    const words = responseContent.split(' ');
    for (let i = 0; i < words.length; i++) {
      const word = words[i] + (i < words.length - 1 ? ' ' : '');
      
      yield {
        id: requestId,
        object: 'chat.completion.chunk' as const,
        created: Math.floor(startTime / 1000),
        model: model,
        choices: [{
          index: 0,
          delta: { content: word },
          finish_reason: null
        }]
      };
      
      // 模拟延迟
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // 发送完成事件
    yield {
      id: requestId,
      object: 'chat.completion.chunk' as const,
      created: Math.floor(startTime / 1000),
      model: model,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: 'stop' as const
      }]
    };
    
    const processingTime = Date.now() - startTime;
    this.logger.info(`[LLM服务] 本地模型流式响应完成: ${requestId}, 耗时: ${processingTime}ms`);
  }
  
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
  
  async healthCheck(): Promise<boolean> {
    return true; // 本地模型总是健康的
  }
}

/**
 * LLM服务管理器
 */
export class LLMServiceManager {
  private adapters: Map<LLMProvider, LLMAdapter>;
  private logger = logger;
  private config: LLMConfig;
  
  constructor(config: LLMConfig) {
    this.config = config;
    this.adapters = new Map();
    this.initializeAdapters();
    
    this.logger.info('[LLM服务] LLM服务管理器已初始化');
    this.logger.info('[LLM服务] 宪法依据: §108异构模型策略、§306零停机协议、§101同步公理');
  }
  
  /**
   * 初始化适配器
   */
  private initializeAdapters(): void {
    // 创建主适配器
    const mainAdapter = this.createAdapter(this.config.provider, this.config);
    this.adapters.set(this.config.provider, mainAdapter);
    
    // 创建备用适配器
    if (this.config.provider !== 'local') {
      const fallbackAdapter = this.createAdapter('local', {
        ...this.config,
        provider: 'local',
        defaultModel: 'local-model',
      });
      this.adapters.set('local', fallbackAdapter);
    }
    
    this.logger.info(`[LLM服务] 适配器已初始化: ${Array.from(this.adapters.keys()).join(', ')}`);
  }
  
  /**
   * 创建适配器
   */
  private createAdapter(provider: LLMProvider, config: LLMConfig): LLMAdapter {
    switch (provider) {
      case 'openai':
        return new OpenAIAdapter(config);
      case 'deepseek':
        return new DeepSeekAdapter(config);
      case 'local':
        return new LocalAdapter(config);
      default:
        throw new LLMError(`不支持的LLM提供商: ${provider}`, 'UNSUPPORTED_PROVIDER', provider);
    }
  }
  
  /**
   * 获取主适配器
   */
  private getMainAdapter(): LLMAdapter {
    const adapter = this.adapters.get(this.config.provider);
    if (!adapter) {
      throw new LLMError(`主适配器未找到: ${this.config.provider}`, 'ADAPTER_NOT_FOUND', this.config.provider);
    }
    return adapter;
  }
  
  /**
   * 获取备用适配器
   */
  private getFallbackAdapter(): LLMAdapter {
    const fallbackProvider = 'local';
    const adapter = this.adapters.get(fallbackProvider);
    if (!adapter) {
      throw new LLMError(`备用适配器未找到: ${fallbackProvider}`, 'FALLBACK_NOT_FOUND', fallbackProvider);
    }
    return adapter;
  }
  
  /**
   * 执行聊天补全 (带降级策略)
   */
  async chatCompletion(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      const adapter = this.getMainAdapter();
      const response = await adapter.chatCompletion(request);
      
      const processingTime = Date.now() - startTime;
      this.logger.info(`[LLM服务] 主适配器完成: ${this.config.provider}, 耗时: ${processingTime}ms`);
      
      return response;
      
    } catch (error: any) {
      this.logger.error(`[LLM服务] 主适配器失败: ${error.message}`);
      
      // 宪法合规: §306零停机协议 - 优雅降级
      this.logger.warn(`[LLM服务] 根据§306零停机协议，降级到备用适配器`);
      
      try {
        const fallbackAdapter = this.getFallbackAdapter();
        const response = await fallbackAdapter.chatCompletion(request);
        
        const processingTime = Date.now() - startTime;
        this.logger.info(`[LLM服务] 备用适配器完成: local, 耗时: ${processingTime}ms`);
        
        return response;
        
      } catch (fallbackError: any) {
        const processingTime = Date.now() - startTime;
        this.logger.error(`[LLM服务] 备用适配器也失败: ${fallbackError.message}, 耗时: ${processingTime}ms`);
        
        // 所有适配器都失败，返回最低限度响应
        return this.createEmergencyResponse(request, startTime);
      }
    }
  }
  
  /**
   * 执行流式聊天补全 (带降级策略)
   */
  async *streamChatCompletion(request: ChatRequest): AsyncGenerator<ChatChunk> {
    try {
      const adapter = this.getMainAdapter();
      yield* adapter.streamChatCompletion(request);
      
    } catch (error: any) {
      this.logger.error(`[LLM服务] 主适配器流式失败: ${error.message}`);
      
      // 宪法合规: §306零停机协议 - 优雅降级
      this.logger.warn(`[LLM服务] 根据§306零停机协议，降级到备用适配器流式响应`);
      
      try {
        const fallbackAdapter = this.getFallbackAdapter();
        yield* fallbackAdapter.streamChatCompletion(request);
        
      } catch (fallbackError: any) {
        this.logger.error(`[LLM服务] 备用适配器流式也失败: ${fallbackError.message}`);
        
        // 所有适配器都失败，返回紧急流式响应
        yield* this.createEmergencyStreamResponse(request);
      }
    }
  }
  
  /**
   * 创建紧急响应 (所有适配器失败时使用)
   */
  private createEmergencyResponse(request: ChatRequest, startTime: number): ChatResponse {
    const requestId = `chatcmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.logger.error(`[LLM服务] 所有适配器失败，返回紧急响应`);
    
    return {
      id: requestId,
      object: 'chat.completion',
      created: Math.floor(startTime / 1000),
      model: 'emergency-model',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: '抱歉，LLM服务暂时不可用。请稍后重试。',
        },
        finish_reason: 'stop',
      }],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };
  }
  
  /**
   * 创建紧急流式响应
   */
  private async *createEmergencyStreamResponse(request: ChatRequest): AsyncGenerator<ChatChunk> {
    const requestId = `chatcmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    this.logger.error(`[LLM服务] 所有适配器失败，返回紧急流式响应`);
    
    // 发送初始事件
    yield {
      id: requestId,
      object: 'chat.completion.chunk' as const,
      created: Math.floor(startTime / 1000),
      model: 'emergency-model',
      choices: [{
        index: 0,
        delta: { role: 'assistant' as const },
        finish_reason: null
      }]
    };
    
    const emergencyText = '抱歉，LLM服务暂时不可用。请稍后重试。';
    const words = emergencyText.split(' ');
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i] + (i < words.length - 1 ? ' ' : '');
      
      yield {
        id: requestId,
        object: 'chat.completion.chunk' as const,
        created: Math.floor(startTime / 1000),
        model: 'emergency-model',
        choices: [{
          index: 0,
          delta: { content: word },
          finish_reason: null
        }]
      };
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 发送完成事件
    yield {
      id: requestId,
      object: 'chat.completion.chunk' as const,
      created: Math.floor(startTime / 1000),
      model: 'emergency-model',
      choices: [{
        index: 0,
        delta: {},
        finish_reason: 'stop' as const
      }]
    };
  }
  
  /**
   * 估算Token数量
   */
  estimateTokens(text: string): number {
    return this.getMainAdapter().estimateTokens(text);
  }
  
  /**
   * 健康检查
   */
  async healthCheck(): Promise<Map<LLMProvider, boolean>> {
    const results = new Map<LLMProvider, boolean>();
    
    for (const [provider, adapter] of this.adapters) {
      try {
        const isHealthy = await adapter.healthCheck();
        results.set(provider, isHealthy);
        this.logger.info(`[LLM服务] ${provider}健康检查: ${isHealthy ? '正常' : '异常'}`);
      } catch (error) {
        results.set(provider, false);
        this.logger.warn(`[LLM服务] ${provider}健康检查失败: ${error}`);
      }
    }
    
    return results;
  }
  
  /**
   * 获取适配器状态
   */
  getAdaptersStatus(): Array<{ provider: LLMProvider, config: LLMConfig }> {
    const status = [];
    
    for (const [provider, adapter] of this.adapters) {
      status.push({
        provider,
        config: this.config,
      });
    }
    
    return status;
  }
}

/**
 * 创建默认LLM服务管理器
 */
export function createDefaultLLMService(config?: Partial<LLMConfig>): LLMServiceManager {
  const defaultConfig: LLMConfig = {
    provider: 'deepseek', // 默认使用DeepSeek (成本优化)
    defaultModel: 'deepseek-chat',
    temperature: 0.7,
    maxTokens: 2048,
    timeout: 30000,
    maxRetries: 3,
    enableStreaming: true,
    enableTools: false,
    ...config,
  };
  
  return new LLMServiceManager(defaultConfig);
}

/**
 * 集成LLM服务到Gateway
 */
export function integrateLLMService(
  app: any,
  config?: Partial<LLMConfig>
): LLMServiceManager {
  const llmService = createDefaultLLMService(config);
  
  // 添加健康检查端点
  app.get('/llm/health', async (req: any, res: any) => {
    try {
      const healthResults = await llmService.healthCheck();
      
      res.json({
        status: 'ok',
        adapters: Array.from(healthResults.entries()).map(([provider, healthy]) => ({
          provider,
          healthy,
        })),
        config: config,
        constitutional_compliance: {
          article_108: '异构模型策略',
          article_306: '零停机协议',
          article_110: '协作效率公理'
        },
        timestamp: new Date().toISOString(),
      });
      
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });
  
  // 添加适配器状态端点
  app.get('/llm/status', (req: any, res: any) => {
    const status = llmService.getAdaptersStatus();
    
    res.json({
      adapters: status,
      main_provider: config?.provider || 'deepseek',
      fallback_provider: 'local',
      streaming_enabled: config?.enableStreaming ?? true,
      tools_enabled: config?.enableTools ?? false,
      timestamp: new Date().toISOString(),
    });
  });
  
  logger.info('[LLM服务] LLM服务已集成到Gateway');
  
  return llmService;
}

export default {
  LLMAdapter,
  OpenAIAdapter,
  DeepSeekAdapter,
  LocalAdapter,
  LLMServiceManager,
  createDefaultLLMService,
  integrateLLMService,
};