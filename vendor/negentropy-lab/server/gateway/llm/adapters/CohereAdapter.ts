/**
 * Cohere 模型适配器
 * 
 * 支持的模型：
 * - Command R+ (command-r-plus)
 * - Command R (command-r)
 * - Command (command)
 * 
 * 宪法依据: §108 异构模型策略公理 - 显式模型参数
 * 
 * @module llm/adapters/CohereAdapter
 * @version 1.0.0
 * @category LLM/Adapters
 */

import axios, { AxiosInstance } from 'axios';
import { BaseAdapter, AdapterConfig } from './BaseAdapter';
import { ChatRequest, ChatResponse, ChatChunk, ModelCapabilities } from './ModelAdapter';

/**
 * Cohere模型配置
 */
interface CohereModelConfig {
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputCost: number;  // per 1k tokens
  outputCost: number; // per 1k tokens
  reasoningQuality: 'basic' | 'intermediate' | 'advanced';
  codingQuality: 'basic' | 'intermediate' | 'advanced';
  creativityQuality: 'basic' | 'intermediate' | 'advanced';
}

/**
 * Cohere支持模型配置
 */
const COHERE_MODELS: Record<string, CohereModelConfig> = {
  'command-r-plus': {
    name: 'Command R+',
    contextWindow: 128000,
    maxOutputTokens: 4000,
    inputCost: 0.003,
    outputCost: 0.015,
    reasoningQuality: 'advanced',
    codingQuality: 'intermediate',
    creativityQuality: 'advanced',
  },
  'command-r': {
    name: 'Command R',
    contextWindow: 128000,
    maxOutputTokens: 4000,
    inputCost: 0.0005,
    outputCost: 0.0015,
    reasoningQuality: 'intermediate',
    codingQuality: 'intermediate',
    creativityQuality: 'intermediate',
  },
  'command': {
    name: 'Command',
    contextWindow: 4096,
    maxOutputTokens: 4096,
    inputCost: 0.0015,
    outputCost: 0.002,
    reasoningQuality: 'intermediate',
    codingQuality: 'basic',
    creativityQuality: 'intermediate',
  },
  'command-light': {
    name: 'Command Light',
    contextWindow: 4096,
    maxOutputTokens: 4096,
    inputCost: 0.0003,
    outputCost: 0.0006,
    reasoningQuality: 'basic',
    codingQuality: 'basic',
    creativityQuality: 'basic',
  },
};

/**
 * Cohere适配器
 */
export class CohereAdapter extends BaseAdapter {
  readonly provider = 'cohere';
  readonly model: string;
  readonly version = '1.0.0';
  
  private httpClient: AxiosInstance;
  private modelConfig: CohereModelConfig;
  
  readonly capabilities: ModelCapabilities;
  
  constructor(model: string = 'command-r', config: AdapterConfig = {}) {
    super(config);
    
    this.model = model;
    this.modelConfig = COHERE_MODELS[model] || COHERE_MODELS['command-r'];
    
    this.capabilities = {
      chat: true,
      streaming: true,
      function_call: true,
      vision: false,
      embedding: false,
      context_window: this.modelConfig.contextWindow,
      max_output_tokens: this.modelConfig.maxOutputTokens,
      supported_languages: ['en', 'fr', 'de', 'es', 'it', 'pt', 'ja', 'zh'],
      cost_per_1k_input_tokens: this.modelConfig.inputCost,
      cost_per_1k_output_tokens: this.modelConfig.outputCost,
      reasoning_quality: this.modelConfig.reasoningQuality,
      coding_quality: this.modelConfig.codingQuality,
      creativity_quality: this.modelConfig.creativityQuality,
    };
    
    // 创建HTTP客户端
    this.httpClient = axios.create({
      baseURL: config.baseUrl || 'https://api.cohere.ai/v1',
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${config.apiKey || process.env.COHERE_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Client-Name': 'OpenDoge',
      },
    });
    
    this.logger.info('Cohere adapter initialized', {
      model: this.model,
      capabilities: this.capabilities,
    });
  }
  
  /**
   * 转换消息为Cohere格式
   */
  private transformToCohereMessages(messages: any[]): any {
    const chat_history: any[] = [];
    let message = '';
    let systemPrompt = '';
    
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      
      if (msg.role === 'system') {
        systemPrompt = msg.content || '';
        continue;
      }
      
      if (i === messages.length - 1 && msg.role === 'user') {
        // 最后一条用户消息作为message
        message = msg.content || '';
      } else {
        // 其他消息作为chat_history
        chat_history.push({
          role: msg.role === 'assistant' ? 'CHATBOT' : 'USER',
          message: msg.content,
        });
      }
    }
    
    return { message, chat_history, systemPrompt };
  }
  
  /**
   * 执行聊天请求
   */
  protected async doChat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      const { message, chat_history, systemPrompt } = this.transformToCohereMessages(request.messages);
      
      const body: any = {
        model: request.model || this.model,
        message,
        chat_history,
        preamble: systemPrompt,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens || this.capabilities.max_output_tokens,
        stream: false,
      };
      
      const response = await this.httpClient.post('/chat', body);
      
      const latency = Date.now() - startTime;
      
      return {
        id: response.data.generation_id || `cohere-${Date.now()}`,
        model: this.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: response.data.text || '',
          },
          finish_reason: response.data.finish_reason === 'COMPLETE' ? 'stop' : 'length',
        }],
        usage: {
          prompt_tokens: response.data.meta?.billed_units?.input_tokens || 0,
          completion_tokens: response.data.meta?.billed_units?.output_tokens || 0,
          total_tokens: (response.data.meta?.billed_units?.input_tokens || 0) + (response.data.meta?.billed_units?.output_tokens || 0),
        },
        latency,
      };
      
    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      this.logger.error('Cohere API call failed', {
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
          'Cohere API call failed: ' + error.message,
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
      const { message, chat_history, systemPrompt } = this.transformToCohereMessages(request.messages);
      
      const body: any = {
        model: request.model || this.model,
        message,
        chat_history,
        preamble: systemPrompt,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens || this.capabilities.max_output_tokens,
        stream: true,
      };
      
      const response = await this.httpClient.post('/chat', body, {
        responseType: 'stream',
      });
      
      const stream = response.data;
      let buffer = '';
      let generationId = '';
      
      for await (const chunk of stream) {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim() === '') {
            continue;
          }
          
          try {
            const data = JSON.parse(line);
            
            if (data.is_finished) {
              generationId = data.generation_id;
              // 发送完成事件
              yield {
                id: generationId || `cohere-${Date.now()}`,
                object: 'chat.completion.chunk',
                created: Math.floor(startTime / 1000),
                model: this.model,
                choices: [{
                  index: 0,
                  delta: {},
                  finish_reason: data.finish_reason === 'COMPLETE' ? 'stop' : 'length',
                }],
              };
            } else if (data.text) {
              if (!generationId && data.generation_id) {
                generationId = data.generation_id;
              }
              
              yield {
                id: generationId || `cohere-${Date.now()}`,
                object: 'chat.completion.chunk',
                created: Math.floor(startTime / 1000),
                model: this.model,
                choices: [{
                  index: 0,
                  delta: {
                    content: data.text,
                  },
                  finish_reason: null,
                }],
              };
            }
            
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
      
    } catch (error: any) {
      this.logger.error('Cohere stream failed', {
        error: error.message,
      });
      throw new AdapterError(
        'Cohere stream failed: ' + error.message,
        'STREAM_FAILED',
        this.provider
      );
    }
  }
  
  /**
   * 执行嵌入（Cohere需要单独的API）
   */
  protected async doEmbed(text: string): Promise<number[]> {
    try {
      const response = await this.httpClient.post('/embed', {
        model: 'embed-english-v3.0',
        texts: [text],
        input_type: 'search_document',
      });
      
      return response.data.embeddings[0] || [];
      
    } catch (error: any) {
      throw new AdapterError(
        'Cohere embedding failed: ' + error.message,
        'EMBEDDING_FAILED',
        this.provider
      );
    }
  }
  
  /**
   * 获取支持的所有模型
   */
  static getSupportedModels(): string[] {
    return Object.keys(COHERE_MODELS);
  }
  
  /**
   * 获取模型配置
   */
  static getModelConfig(model: string): CohereModelConfig | undefined {
    return COHERE_MODELS[model];
  }
}

// 导出错误类
import { AdapterError } from './BaseAdapter';
export { AdapterError };
