/**
 * Anthropic (Claude) 模型适配器
 * 
 * 支持的模型：
 * - Claude 3.5 Sonnet (claude-3-5-sonnet-20241022)
 * - Claude 3.5 Haiku (claude-3-5-haiku-20241022)
 * - Claude 3 Opus (claude-3-opus-20240229)
 * 
 * 宪法依据: §108 异构模型策略公理 - 显式模型参数
 * 
 * @module llm/adapters/AnthropicAdapter
 * @version 1.0.0
 * @category LLM/Adapters
 */

import axios, { AxiosInstance } from 'axios';
import { BaseAdapter, AdapterConfig } from './BaseAdapter';
import { ChatRequest, ChatResponse, ChatChunk, ModelCapabilities } from './ModelAdapter';

/**
 * Anthropic模型配置
 */
interface AnthropicModelConfig {
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputCost: number;  // per 1k tokens
  outputCost: number; // per 1k tokens
  reasoningQuality: 'basic' | 'intermediate' | 'advanced';
  codingQuality: 'basic' | 'intermediate' | 'advanced';
  creativityQuality: 'basic' | 'intermediate' | 'advanced';
  supportsVision: boolean;
}

/**
 * Anthropic支持模型配置
 */
const ANTHROPIC_MODELS: Record<string, AnthropicModelConfig> = {
  'claude-3-5-sonnet-20241022': {
    name: 'Claude 3.5 Sonnet',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    inputCost: 0.003,
    outputCost: 0.015,
    reasoningQuality: 'advanced',
    codingQuality: 'advanced',
    creativityQuality: 'advanced',
    supportsVision: true,
  },
  'claude-3-5-haiku-20241022': {
    name: 'Claude 3.5 Haiku',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    inputCost: 0.0008,
    outputCost: 0.004,
    reasoningQuality: 'intermediate',
    codingQuality: 'intermediate',
    creativityQuality: 'intermediate',
    supportsVision: true,
  },
  'claude-3-opus-20240229': {
    name: 'Claude 3 Opus',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    inputCost: 0.015,
    outputCost: 0.075,
    reasoningQuality: 'advanced',
    codingQuality: 'advanced',
    creativityQuality: 'advanced',
    supportsVision: true,
  },
  'claude-3-sonnet-20240229': {
    name: 'Claude 3 Sonnet',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    inputCost: 0.003,
    outputCost: 0.015,
    reasoningQuality: 'intermediate',
    codingQuality: 'intermediate',
    creativityQuality: 'intermediate',
    supportsVision: true,
  },
  'claude-3-haiku-20240307': {
    name: 'Claude 3 Haiku',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    inputCost: 0.00025,
    outputCost: 0.00125,
    reasoningQuality: 'basic',
    codingQuality: 'basic',
    creativityQuality: 'basic',
    supportsVision: true,
  },
};

/**
 * Anthropic适配器
 */
export class AnthropicAdapter extends BaseAdapter {
  readonly provider = 'anthropic';
  readonly model: string;
  readonly version = '1.0.0';
  
  private httpClient: AxiosInstance;
  private modelConfig: AnthropicModelConfig;
  
  readonly capabilities: ModelCapabilities;
  
  constructor(model: string = 'claude-3-5-sonnet-20241022', config: AdapterConfig = {}) {
    super(config);
    
    this.model = model;
    this.modelConfig = ANTHROPIC_MODELS[model] || ANTHROPIC_MODELS['claude-3-5-sonnet-20241022'];
    
    this.capabilities = {
      chat: true,
      streaming: true,
      function_call: true,
      vision: this.modelConfig.supportsVision,
      embedding: false, // Anthropic不支持embedding
      context_window: this.modelConfig.contextWindow,
      max_output_tokens: this.modelConfig.maxOutputTokens,
      supported_languages: ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'ru'],
      cost_per_1k_input_tokens: this.modelConfig.inputCost,
      cost_per_1k_output_tokens: this.modelConfig.outputCost,
      reasoning_quality: this.modelConfig.reasoningQuality,
      coding_quality: this.modelConfig.codingQuality,
      creativity_quality: this.modelConfig.creativityQuality,
    };
    
    // 创建HTTP客户端
    this.httpClient = axios.create({
      baseURL: config.baseUrl || 'https://api.anthropic.com',
      timeout: this.timeout,
      headers: {
        'x-api-key': config.apiKey || process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
    });
    
    this.logger.info('Anthropic adapter initialized', {
      model: this.model,
      capabilities: this.capabilities,
    });
  }
  
  /**
   * 转换消息为Anthropic格式
   */
  private transformToAnthropicMessages(messages: any[]): any[] {
    const anthropicMessages: any[] = [];
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        // Anthropic使用单独的system字段
        continue;
      }
      
      const anthropicMsg: any = {
        role: msg.role,
        content: msg.content,
      };
      
      if (msg.tool_calls) {
        anthropicMsg.content = anthropicMsg.tool_calls; // Anthropic使用不同的格式
      }
      
      anthropicMessages.push(anthropicMsg);
    }
    
    return anthropicMessages;
  }
  
  /**
   * 提取系统消息
   */
  private extractSystemMessage(messages: any[]): string | undefined {
    const systemMsg = messages.find(m => m.role === 'system');
    return systemMsg?.content as string | undefined;
  }
  
  /**
   * 执行聊天请求
   */
  protected async doChat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      const system = this.extractSystemMessage(request.messages);
      const messages = this.transformToAnthropicMessages(request.messages);
      
      const body: any = {
        model: request.model || this.model,
        messages,
        max_tokens: request.maxTokens || this.capabilities.max_output_tokens,
        stream: false,
      };
      
      if (system) {
        body.system = system;
      }
      
      if (request.temperature !== undefined) {
        body.temperature = request.temperature;
      }
      
      if (request.tools && request.tools.length > 0) {
        body.tools = this.transformTools(request.tools);
      }
      
      const response = await this.httpClient.post('/v1/messages', body);
      
      const latency = Date.now() - startTime;
      
      // 转换为统一格式
      const content = response.data.content[0];
      const text = content.type === 'text' ? content.text : '';
      
      return {
        id: response.data.id,
        model: response.data.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: text,
          },
          finish_reason: response.data.stop_reason,
        }],
        usage: {
          prompt_tokens: response.data.usage.input_tokens,
          completion_tokens: response.data.usage.output_tokens,
          total_tokens: response.data.usage.input_tokens + response.data.usage.output_tokens,
        },
        latency,
      };
      
    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      this.logger.error('Anthropic API call failed', {
        error: error.message,
        status: error.response?.status,
        latency,
      });
      
      // 转换错误
      if (error.response?.status === 429) {
        throw new AdapterError(
          'Rate limit exceeded',
          'RATE_LIMIT_EXCEEDED',
          this.provider,
          429
        );
      } else if (error.response?.status === 401) {
        throw new AdapterError(
          'Invalid API key',
          'INVALID_API_KEY',
          this.provider,
          401
        );
      } else {
        throw new AdapterError(
          'Anthropic API call failed: ' + error.message,
          'API_CALL_FAILED',
          this.provider,
          error.response?.status
        );
      }
    }
  }
  
  /**
   * 执行流式聊天
   */
  protected async *doChatStream(request: ChatRequest): AsyncIterableIterator<ChatChunk> {
    const startTime = Date.now();
    
    try {
      const system = this.extractSystemMessage(request.messages);
      const messages = this.transformToAnthropicMessages(request.messages);
      
      const body: any = {
        model: request.model || this.model,
        messages,
        max_tokens: request.maxTokens || this.capabilities.max_output_tokens,
        stream: true,
      };
      
      if (system) {
        body.system = system;
      }
      
      if (request.temperature !== undefined) {
        body.temperature = request.temperature;
      }
      
      const response = await this.httpClient.post('/v1/messages', body, {
        responseType: 'stream',
      });
      
      const stream = response.data;
      let buffer = '';
      
      for await (const chunk of stream) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim() === '' || line === 'data: [DONE]') {
            continue;
          }
          
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'content_block_delta') {
                const content = data.delta?.text;
                if (content) {
                  yield {
                    id: data.message_id,
                    object: 'chat.completion.chunk',
                    created: Math.floor(startTime / 1000),
                    model: request.model || this.model,
                    choices: [{
                      index: 0,
                      delta: {
                        content,
                      },
                      finish_reason: null,
                    }],
                  };
                }
              } else if (data.type === 'message_stop') {
                yield {
                  id: data.message_id,
                  object: 'chat.completion.chunk',
                  created: Math.floor(startTime / 1000),
                  model: request.model || this.model,
                  choices: [{
                    index: 0,
                    delta: {},
                    finish_reason: 'stop',
                  }],
                };
              }
              
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
      
    } catch (error: any) {
      this.logger.error('Anthropic stream failed', {
        error: error.message,
      });
      throw new AdapterError(
        'Anthropic stream failed: ' + error.message,
        'STREAM_FAILED',
        this.provider
      );
    }
  }
  
  /**
   * 执行嵌入（Anthropic不支持）
   */
  protected async doEmbed(text: string): Promise<number[]> {
    throw new AdapterError(
      'Anthropic does not support embedding',
      'EMBEDDING_NOT_SUPPORTED',
      this.provider
    );
  }
  
  /**
   * 获取支持的所有模型
   */
  static getSupportedModels(): string[] {
    return Object.keys(ANTHROPIC_MODELS);
  }
  
  /**
   * 获取模型配置
   */
  static getModelConfig(model: string): AnthropicModelConfig | undefined {
    return ANTHROPIC_MODELS[model];
  }
}

// 导出错误类
import { AdapterError } from './BaseAdapter';
export { AdapterError };
