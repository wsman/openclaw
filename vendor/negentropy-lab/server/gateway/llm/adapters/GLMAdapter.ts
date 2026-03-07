/**
 * GLM (智谱AI) 模型适配器
 * 
 * 支持的模型：
 * - GLM-4.7 (zai/glm-4.7)
 * - GLM-4.7-Flash (zai/glm-4.7-flash)
 * 
 * 宪法依据: §108 异构模型策略公理 - 显式模型参数
 * 
 * @module llm/adapters/GLMAdapter
 * @version 1.0.0
 * @category LLM/Adapters
 */

import axios, { AxiosInstance } from 'axios';
import { BaseAdapter, AdapterConfig } from './BaseAdapter';
import { ChatRequest, ChatResponse, ChatChunk, ModelCapabilities } from './ModelAdapter';

/**
 * GLM模型配置
 */
interface GLMModelConfig {
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
 * GLM支持模型配置
 */
const GLM_MODELS: Record<string, GLMModelConfig> = {
  'zai/glm-4.7': {
    name: 'GLM-4.7',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    inputCost: 0.002,
    outputCost: 0.006,
    reasoningQuality: 'advanced',
    codingQuality: 'advanced',
    creativityQuality: 'advanced',
    supportsVision: false,
  },
  'zai/glm-4.7-flash': {
    name: 'GLM-4.7 Flash',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    inputCost: 0.0001,
    outputCost: 0.0005,
    reasoningQuality: 'intermediate',
    codingQuality: 'intermediate',
    creativityQuality: 'intermediate',
    supportsVision: false,
  },
  'glm-4': {
    name: 'GLM-4',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    inputCost: 0.002,
    outputCost: 0.006,
    reasoningQuality: 'advanced',
    codingQuality: 'advanced',
    creativityQuality: 'advanced',
    supportsVision: false,
  },
  'glm-4-flash': {
    name: 'GLM-4 Flash',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    inputCost: 0.0001,
    outputCost: 0.0005,
    reasoningQuality: 'intermediate',
    codingQuality: 'intermediate',
    creativityQuality: 'intermediate',
    supportsVision: false,
  },
};

/**
 * GLM适配器
 */
export class GLMAdapter extends BaseAdapter {
  readonly provider = 'glm';
  readonly model: string;
  readonly version = '1.0.0';
  
  private httpClient: AxiosInstance;
  private modelConfig: GLMModelConfig;
  
  readonly capabilities: ModelCapabilities;
  
  constructor(model: string = 'zai/glm-4.7', config: AdapterConfig = {}) {
    super(config);
    
    this.model = model;
    this.modelConfig = GLM_MODELS[model] || GLM_MODELS['zai/glm-4.7'];
    
    this.capabilities = {
      chat: true,
      streaming: true,
      function_call: true,
      vision: this.modelConfig.supportsVision,
      embedding: false, // GLM embedding需要单独的API
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
    this.httpClient = axios.create({
      baseURL: config.baseUrl || 'https://open.bigmodel.cn/api/paas/v4',
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${config.apiKey || process.env.ZAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    this.logger.info('GLM adapter initialized', {
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
      
      this.logger.error('GLM API call failed', {
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
          'GLM API call failed: ' + error.message,
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
      this.logger.error('GLM stream failed', {
        error: error.message,
      });
      throw new AdapterError(
        'GLM stream failed: ' + error.message,
        'STREAM_FAILED',
        this.provider
      );
    }
  }
  
  /**
   * 执行嵌入（GLM需要单独的API）
   */
  protected async doEmbed(text: string): Promise<number[]> {
    try {
      const response = await this.httpClient.post('/embeddings', {
        model: 'embedding-2',
        input: text,
      });
      
      return response.data.data[0].embedding;
      
    } catch (error: any) {
      throw new AdapterError(
        'GLM embedding failed: ' + error.message,
        'EMBEDDING_FAILED',
        this.provider
      );
    }
  }
  
  /**
   * 获取支持的所有模型
   */
  static getSupportedModels(): string[] {
    return Object.keys(GLM_MODELS);
  }
  
  /**
   * 获取模型配置
   */
  static getModelConfig(model: string): GLMModelConfig | undefined {
    return GLM_MODELS[model];
  }
}

// 导出错误类
import { AdapterError } from './BaseAdapter';
export { AdapterError };
