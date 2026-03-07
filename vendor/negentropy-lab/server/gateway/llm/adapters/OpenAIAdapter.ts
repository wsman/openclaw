/**
 * OpenAI 模型适配器
 * 
 * 支持的模型：
 * - GPT-4 (gpt-4)
 * - GPT-4 Turbo (gpt-4-turbo-preview)
 * - GPT-4o (gpt-4o)
 * - GPT-3.5 Turbo (gpt-3.5-turbo)
 * 
 * 宪法依据: §108 异构模型策略公理 - 显式模型参数
 * 
 * @module llm/adapters/OpenAIAdapter
 * @version 1.0.0
 * @category LLM/Adapters
 */

import axios, { AxiosInstance } from 'axios';
import { BaseAdapter, AdapterConfig } from './BaseAdapter';
import { ChatRequest, ChatResponse, ChatChunk, ModelCapabilities } from './ModelAdapter';

/**
 * OpenAI模型配置
 */
interface OpenAIModelConfig {
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputCost: number;  // per 1k tokens
  outputCost: number; // per 1k tokens
  reasoningQuality: 'basic' | 'intermediate' | 'advanced';
  codingQuality: 'basic' | 'intermediate' | 'advanced';
  creativityQuality: 'basic' | 'intermediate' | 'advanced';
  supportsVision: boolean;
  supportsFunctionCalls: boolean;
}

/**
 * OpenAI支持模型配置
 */
const OPENAI_MODELS: Record<string, OpenAIModelConfig> = {
  'gpt-4': {
    name: 'GPT-4',
    contextWindow: 8192,
    maxOutputTokens: 4096,
    inputCost: 0.03,
    outputCost: 0.06,
    reasoningQuality: 'advanced',
    codingQuality: 'advanced',
    creativityQuality: 'advanced',
    supportsVision: false,
    supportsFunctionCalls: true,
  },
  'gpt-4-turbo-preview': {
    name: 'GPT-4 Turbo',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    inputCost: 0.01,
    outputCost: 0.03,
    reasoningQuality: 'advanced',
    codingQuality: 'advanced',
    creativityQuality: 'advanced',
    supportsVision: false,
    supportsFunctionCalls: true,
  },
  'gpt-4o': {
    name: 'GPT-4o',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    inputCost: 0.005,
    outputCost: 0.015,
    reasoningQuality: 'advanced',
    codingQuality: 'advanced',
    creativityQuality: 'advanced',
    supportsVision: true,
    supportsFunctionCalls: true,
  },
  'gpt-3.5-turbo': {
    name: 'GPT-3.5 Turbo',
    contextWindow: 16385,
    maxOutputTokens: 4096,
    inputCost: 0.0005,
    outputCost: 0.0015,
    reasoningQuality: 'intermediate',
    codingQuality: 'intermediate',
    creativityQuality: 'intermediate',
    supportsVision: false,
    supportsFunctionCalls: true,
  },
};

/**
 * OpenAI适配器
 */
export class OpenAIAdapter extends BaseAdapter {
  readonly provider = 'openai';
  readonly model: string;
  readonly version = '1.0.0';
  
  private httpClient: AxiosInstance;
  private modelConfig: OpenAIModelConfig;
  
  readonly capabilities: ModelCapabilities;
  
  constructor(model: string = 'gpt-4o', config: AdapterConfig = {}) {
    super(config);
    
    this.model = model;
    this.modelConfig = OPENAI_MODELS[model] || OPENAI_MODELS['gpt-4o'];
    
    this.capabilities = {
      chat: true,
      streaming: true,
      function_call: this.modelConfig.supportsFunctionCalls,
      vision: this.modelConfig.supportsVision,
      embedding: false, // OpenAI embedding需要单独的适配器
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
      baseURL: config.baseUrl || 'https://api.openai.com/v1',
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${config.apiKey || process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    this.logger.info('OpenAI adapter initialized', {
      model: this.model,
      capabilities: this.capabilities,
    });
  }
  
  /**
   * 执行聊天请求
   */
  protected async doChat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      const response = await this.httpClient.post('/chat/completions', {
        model: request.model || this.model,
        messages: this.transformMessages(request.messages),
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        stream: false,
        tools: this.transformTools(request.tools),
        tool_choice: request.tool_choice,
      });
      
      const latency = Date.now() - startTime;
      
      return {
        id: response.data.id,
        model: response.data.model,
        choices: response.data.choices.map((choice: any) => ({
          index: choice.index,
          message: {
            role: choice.message.role,
            content: choice.message.content,
            tool_calls: choice.message.tool_calls,
          },
          finish_reason: choice.finish_reason,
        })),
        usage: this.transformUsage(response.data.usage),
        latency,
      };
      
    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      this.logger.error('OpenAI API call failed', {
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
      } else if (error.response?.status === 400) {
        throw new AdapterError(
          'Bad request: ' + (error.response.data.error?.message || 'Unknown error'),
          'BAD_REQUEST',
          this.provider,
          400
        );
      } else {
        throw new AdapterError(
          'OpenAI API call failed: ' + error.message,
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
      const response = await this.httpClient.post('/chat/completions', {
        model: request.model || this.model,
        messages: this.transformMessages(request.messages),
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
        stream: true,
        tools: this.transformTools(request.tools),
        tool_choice: request.tool_choice,
      }, {
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
              
              yield {
                id: data.id,
                object: 'chat.completion.chunk',
                created: data.created,
                model: data.model,
                choices: data.choices.map((choice: any) => ({
                  index: choice.index,
                  delta: {
                    role: choice.delta.role,
                    content: choice.delta.content,
                    tool_calls: choice.delta.tool_calls,
                  },
                  finish_reason: choice.finish_reason,
                })),
              };
              
            } catch (e) {
              // 忽略解析错误
            }
          }
        }
      }
      
    } catch (error: any) {
      this.logger.error('OpenAI stream failed', {
        error: error.message,
      });
      throw new AdapterError(
        'OpenAI stream failed: ' + error.message,
        'STREAM_FAILED',
        this.provider
      );
    }
  }
  
  /**
   * 执行嵌入（OpenAI需要单独的API）
   */
  protected async doEmbed(text: string): Promise<number[]> {
    try {
      const response = await this.httpClient.post('/embeddings', {
        model: 'text-embedding-ada-002',
        input: text,
      });
      
      return response.data.data[0].embedding;
      
    } catch (error: any) {
      throw new AdapterError(
        'OpenAI embedding failed: ' + error.message,
        'EMBEDDING_FAILED',
        this.provider
      );
    }
  }
  
  /**
   * 获取支持的所有模型
   */
  static getSupportedModels(): string[] {
    return Object.keys(OPENAI_MODELS);
  }
  
  /**
   * 获取模型配置
   */
  static getModelConfig(model: string): OpenAIModelConfig | undefined {
    return OPENAI_MODELS[model];
  }
}

// 导出错误类
import { AdapterError } from './BaseAdapter';
export { AdapterError };
