/**
 * Mistral AI 模型适配器
 * 
 * 支持的模型：
 * - Mistral Large (mistral-large-latest)
 * - Mistral Medium (mistral-medium-latest)
 * - Mistral Small (mistral-small-latest)
 * - Codestral (codestral-latest)
 * 
 * 宪法依据: §108 异构模型策略公理 - 显式模型参数
 * 
 * @module llm/adapters/MistralAdapter
 * @version 1.0.0
 * @category LLM/Adapters
 */

import axios, { AxiosInstance } from 'axios';
import { BaseAdapter, AdapterConfig } from './BaseAdapter';
import { ChatRequest, ChatResponse, ChatChunk, ModelCapabilities } from './ModelAdapter';

/**
 * Mistral模型配置
 */
interface MistralModelConfig {
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
 * Mistral支持模型配置
 */
const MISTRAL_MODELS: Record<string, MistralModelConfig> = {
  'mistral-large-latest': {
    name: 'Mistral Large',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    inputCost: 0.004,
    outputCost: 0.012,
    reasoningQuality: 'advanced',
    codingQuality: 'advanced',
    creativityQuality: 'advanced',
  },
  'mistral-medium-latest': {
    name: 'Mistral Medium',
    contextWindow: 32000,
    maxOutputTokens: 4096,
    inputCost: 0.0027,
    outputCost: 0.0081,
    reasoningQuality: 'intermediate',
    codingQuality: 'intermediate',
    creativityQuality: 'intermediate',
  },
  'mistral-small-latest': {
    name: 'Mistral Small',
    contextWindow: 32000,
    maxOutputTokens: 4096,
    inputCost: 0.0002,
    outputCost: 0.0006,
    reasoningQuality: 'basic',
    codingQuality: 'basic',
    creativityQuality: 'basic',
  },
  'codestral-latest': {
    name: 'Codestral',
    contextWindow: 32000,
    maxOutputTokens: 4096,
    inputCost: 0.0002,
    outputCost: 0.0006,
    reasoningQuality: 'intermediate',
    codingQuality: 'advanced',
    creativityQuality: 'basic',
  },
  'mistral-nemo': {
    name: 'Mistral Nemo',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    inputCost: 0.00015,
    outputCost: 0.0006,
    reasoningQuality: 'intermediate',
    codingQuality: 'intermediate',
    creativityQuality: 'intermediate',
  },
};

/**
 * Mistral适配器
 */
export class MistralAdapter extends BaseAdapter {
  readonly provider = 'mistral';
  readonly model: string;
  readonly version = '1.0.0';
  
  private httpClient: AxiosInstance;
  private modelConfig: MistralModelConfig;
  
  readonly capabilities: ModelCapabilities;
  
  constructor(model: string = 'mistral-large-latest', config: AdapterConfig = {}) {
    super(config);
    
    this.model = model;
    this.modelConfig = MISTRAL_MODELS[model] || MISTRAL_MODELS['mistral-large-latest'];
    
    this.capabilities = {
      chat: true,
      streaming: true,
      function_call: true,
      vision: false,
      embedding: false,
      context_window: this.modelConfig.contextWindow,
      max_output_tokens: this.modelConfig.maxOutputTokens,
      supported_languages: ['en', 'fr', 'de', 'es', 'it', 'python', 'javascript', 'java', 'cpp'],
      cost_per_1k_input_tokens: this.modelConfig.inputCost,
      cost_per_1k_output_tokens: this.modelConfig.outputCost,
      reasoning_quality: this.modelConfig.reasoningQuality,
      coding_quality: this.modelConfig.codingQuality,
      creativity_quality: this.modelConfig.creativityQuality,
    };
    
    // 创建HTTP客户端
    this.httpClient = axios.create({
      baseURL: config.baseUrl || 'https://api.mistral.ai/v1',
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${config.apiKey || process.env.MISTRAL_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    this.logger.info('Mistral adapter initialized', {
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
      
      this.logger.error('Mistral API call failed', {
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
          'Mistral API call failed: ' + error.message,
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
      this.logger.error('Mistral stream failed', {
        error: error.message,
      });
      throw new AdapterError(
        'Mistral stream failed: ' + error.message,
        'STREAM_FAILED',
        this.provider
      );
    }
  }
  
  /**
   * 执行嵌入（Mistral需要单独的API）
   */
  protected async doEmbed(text: string): Promise<number[]> {
    try {
      const response = await this.httpClient.post('/embeddings', {
        model: 'mistral-embed',
        input: text,
      });
      
      return response.data.data[0].embedding;
      
    } catch (error: any) {
      throw new AdapterError(
        'Mistral embedding failed: ' + error.message,
        'EMBEDDING_FAILED',
        this.provider
      );
    }
  }
  
  /**
   * 获取支持的所有模型
   */
  static getSupportedModels(): string[] {
    return Object.keys(MISTRAL_MODELS);
  }
  
  /**
   * 获取模型配置
   */
  static getModelConfig(model: string): MistralModelConfig | undefined {
    return MISTRAL_MODELS[model];
  }
}

// 导出错误类
import { AdapterError } from './BaseAdapter';
export { AdapterError };
