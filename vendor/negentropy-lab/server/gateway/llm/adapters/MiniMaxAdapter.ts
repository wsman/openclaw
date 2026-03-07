/**
 * MiniMax 模型适配器
 * 
 * 支持的模型：
 * - MiniMax M2.5 (MiniMax-M2.5)
 * 
 * 参考资料: memory/learning/minimax_m25_integration_guide.md
 * 
 * 宪法依据: §108 异构模型策略公理 - 显式模型参数
 * 
 * @module llm/adapters/MiniMaxAdapter
 * @version 1.0.0
 * @category LLM/Adapters
 */

import axios, { AxiosInstance } from 'axios';
import { BaseAdapter, AdapterConfig } from './BaseAdapter';
import { ChatRequest, ChatResponse, ChatChunk, ModelCapabilities } from './ModelAdapter';

/**
 * MiniMax模型配置
 */
interface MiniMaxModelConfig {
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
 * MiniMax支持模型配置
 */
const MINIMAX_MODELS: Record<string, MiniMaxModelConfig> = {
  'MiniMax-M2.5': {
    name: 'MiniMax M2.5',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    inputCost: 0.001,
    outputCost: 0.002,
    reasoningQuality: 'advanced',
    codingQuality: 'advanced',
    creativityQuality: 'advanced',
  },
  'MiniMax-M2.1': {
    name: 'MiniMax M2.1',
    contextWindow: 32000,
    maxOutputTokens: 4096,
    inputCost: 0.0005,
    outputCost: 0.001,
    reasoningQuality: 'intermediate',
    codingQuality: 'intermediate',
    creativityQuality: 'intermediate',
  },
};

/**
 * MiniMax适配器
 * 
 * 支持两种API模式：
 * 1. Anthropic兼容模式 (推荐)
 * 2. OpenAI兼容模式
 */
export class MiniMaxAdapter extends BaseAdapter {
  readonly provider = 'minimax';
  readonly model: string;
  readonly version = '1.0.0';
  
  private httpClient: AxiosInstance;
  private modelConfig: MiniMaxModelConfig;
  private apiMode: 'anthropic' | 'openai';
  
  readonly capabilities: ModelCapabilities;
  
  constructor(
    model: string = 'MiniMax-M2.5',
    config: AdapterConfig & { apiMode?: 'anthropic' | 'openai' } = {}
  ) {
    super(config);
    
    this.model = model;
    this.modelConfig = MINIMAX_MODELS[model] || MINIMAX_MODELS['MiniMax-M2.5'];
    this.apiMode = config.apiMode || 'anthropic';
    
    // 确定API端点
    const baseUrl = config.baseUrl || this.getBaseUrl();
    
    this.capabilities = {
      chat: true,
      streaming: true,
      function_call: true,
      vision: false,
      embedding: false,
      context_window: this.modelConfig.contextWindow,
      max_output_tokens: this.modelConfig.maxOutputTokens,
      supported_languages: ['zh', 'en'],
      cost_per_1k_input_tokens: this.modelConfig.inputCost,
      cost_per_1k_output_tokens: this.modelConfig.outputCost,
      reasoning_quality: this.modelConfig.reasoningQuality,
      coding_quality: this.modelConfig.codingQuality,
      creativity_quality: this.modelConfig.creativityQuality,
    };
    
    // 创建HTTP客户端
    const apiKey = config.apiKey || process.env.MINIMAX_API_KEY;
    const headers: any = {
      'Content-Type': 'application/json',
    };
    
    if (this.apiMode === 'anthropic') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    this.httpClient = axios.create({
      baseURL: baseUrl,
      timeout: this.timeout,
      headers,
    });
    
    this.logger.info('MiniMax adapter initialized', {
      model: this.model,
      apiMode: this.apiMode,
      baseUrl,
      capabilities: this.capabilities,
    });
  }
  
  /**
   * 获取API基础URL
   */
  private getBaseUrl(): string {
    // 国际用户使用 api.minimax.io
    // 中国用户使用 api.minimaxi.com
    const isInternational = process.env.MINIMAX_REGION !== 'china';
    const baseUrl = isInternational ? 'https://api.minimax.io' : 'https://api.minimaxi.com';
    
    if (this.apiMode === 'anthropic') {
      return `${baseUrl}/anthropic`;
    } else {
      return `${baseUrl}/v1`;
    }
  }
  
  /**
   * 提取系统消息（Anthropic模式）
   */
  private extractSystemMessage(messages: any[]): string | undefined {
    const systemMsg = messages.find(m => m.role === 'system');
    return systemMsg?.content as string | undefined;
  }
  
  /**
   * 转换消息（Anthropic模式）
   */
  private transformToAnthropicMessages(messages: any[]): any[] {
    return messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role,
        content: m.content,
      }));
  }
  
  /**
   * 执行聊天请求
   */
  protected async doChat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      let response;
      
      if (this.apiMode === 'anthropic') {
        // Anthropic兼容模式
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
        
        response = await this.httpClient.post('/v1/messages', body);
        
        // 转换为统一格式
        const content = response.data.content[0];
        const text = content.type === 'text' ? content.text : '';
        
        response.data = {
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
        };
        
      } else {
        // OpenAI兼容模式
        response = await this.httpClient.post('/chat/completions', {
          model: request.model || this.model,
          messages: this.transformMessages(request.messages),
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens,
          stream: false,
          tools: this.transformTools(request.tools),
          tool_choice: request.tool_choice,
        });
      }
      
      const latency = Date.now() - startTime;
      
      return {
        id: response.data.id,
        model: response.data.model,
        choices: response.data.choices,
        usage: response.data.usage,
        latency,
      };
      
    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      this.logger.error('MiniMax API call failed', {
        error: error.message,
        status: error.response?.status,
        latency,
        apiMode: this.apiMode,
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
          'MiniMax API call failed: ' + error.message,
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
      if (this.apiMode === 'anthropic') {
        // Anthropic兼容模式
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
        
      } else {
        // OpenAI兼容模式
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
      }
      
    } catch (error: any) {
      this.logger.error('MiniMax stream failed', {
        error: error.message,
        apiMode: this.apiMode,
      });
      throw new AdapterError(
        'MiniMax stream failed: ' + error.message,
        'STREAM_FAILED',
        this.provider
      );
    }
  }
  
  /**
   * 执行嵌入（MiniMax不支持）
   */
  protected async doEmbed(text: string): Promise<number[]> {
    throw new AdapterError(
      'MiniMax does not support embedding',
      'EMBEDDING_NOT_SUPPORTED',
      this.provider
    );
  }
  
  /**
   * 获取支持的所有模型
   */
  static getSupportedModels(): string[] {
    return Object.keys(MINIMAX_MODELS);
  }
  
  /**
   * 获取模型配置
   */
  static getModelConfig(model: string): MiniMaxModelConfig | undefined {
    return MINIMAX_MODELS[model];
  }
}

// 导出错误类
import { AdapterError } from './BaseAdapter';
export { AdapterError };
