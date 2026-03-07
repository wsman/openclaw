/**
 * DeepSeek 模型适配器
 * 
 * 支持的模型：
 * - DeepSeek V3 (deepseek-chat)
 * - DeepSeek Coder V2 (deepseek-coder)
 * 
 * 宪法依据: §108 异构模型策略公理 - 显式模型参数
 * 
 * @module llm/adapters/DeepSeekAdapter
 * @version 1.0.0
 * @category LLM/Adapters
 */

import axios, { AxiosInstance } from 'axios';
import { BaseAdapter, AdapterConfig } from './BaseAdapter';
import { ChatRequest, ChatResponse, ChatChunk, ModelCapabilities } from './ModelAdapter';

/**
 * DeepSeek模型配置
 */
interface DeepSeekModelConfig {
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
 * DeepSeek支持模型配置
 */
const DEEPSEEK_MODELS: Record<string, DeepSeekModelConfig> = {
  'deepseek-chat': {
    name: 'DeepSeek V3',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    inputCost: 0.00014,
    outputCost: 0.00028,
    reasoningQuality: 'advanced',
    codingQuality: 'advanced',
    creativityQuality: 'advanced',
  },
  'deepseek-coder': {
    name: 'DeepSeek Coder V2',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    inputCost: 0.00014,
    outputCost: 0.00028,
    reasoningQuality: 'intermediate',
    codingQuality: 'advanced',
    creativityQuality: 'basic',
  },
};

/**
 * DeepSeek适配器
 */
export class DeepSeekAdapter extends BaseAdapter {
  readonly provider = 'deepseek';
  readonly model: string;
  readonly version = '1.0.0';
  
  private httpClient: AxiosInstance;
  private modelConfig: DeepSeekModelConfig;
  
  readonly capabilities: ModelCapabilities;
  
  constructor(model: string = 'deepseek-chat', config: AdapterConfig = {}) {
    super(config);
    
    this.model = model;
    this.modelConfig = DEEPSEEK_MODELS[model] || DEEPSEEK_MODELS['deepseek-chat'];
    
    this.capabilities = {
      chat: true,
      streaming: true,
      function_call: true,
      vision: false,
      embedding: false,
      context_window: this.modelConfig.contextWindow,
      max_output_tokens: this.modelConfig.maxOutputTokens,
      supported_languages: ['zh', 'en', 'python', 'javascript', 'java', 'cpp'],
      cost_per_1k_input_tokens: this.modelConfig.inputCost,
      cost_per_1k_output_tokens: this.modelConfig.outputCost,
      reasoning_quality: this.modelConfig.reasoningQuality,
      coding_quality: this.modelConfig.codingQuality,
      creativity_quality: this.modelConfig.creativityQuality,
    };
    
    // 创建HTTP客户端
    this.httpClient = axios.create({
      baseURL: config.baseUrl || 'https://api.deepseek.com',
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${config.apiKey || process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    this.logger.info('DeepSeek adapter initialized', {
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
      
      this.logger.error('DeepSeek API call failed', {
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
          'DeepSeek API call failed: ' + error.message,
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
      this.logger.error('DeepSeek stream failed', {
        error: error.message,
      });
      throw new AdapterError(
        'DeepSeek stream failed: ' + error.message,
        'STREAM_FAILED',
        this.provider
      );
    }
  }
  
  /**
   * 执行嵌入（DeepSeek不支持）
   */
  protected async doEmbed(text: string): Promise<number[]> {
    throw new AdapterError(
      'DeepSeek does not support embedding',
      'EMBEDDING_NOT_SUPPORTED',
      this.provider
    );
  }
  
  /**
   * 获取支持的所有模型
   */
  static getSupportedModels(): string[] {
    return Object.keys(DEEPSEEK_MODELS);
  }
  
  /**
   * 获取模型配置
   */
  static getModelConfig(model: string): DeepSeekModelConfig | undefined {
    return DEEPSEEK_MODELS[model];
  }
}

// 导出错误类
import { AdapterError } from './BaseAdapter';
export { AdapterError };
