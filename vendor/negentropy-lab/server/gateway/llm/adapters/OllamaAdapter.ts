/**
 * Ollama 本地模型适配器
 * 
 * 支持的模型：
 * - 所有通过Ollama运行的本地模型（如 llama3, mistral, codellama等）
 * 
 * 宪法依据: §108 异构模型策略公理 - 显式模型参数
 * 
 * @module llm/adapters/OllamaAdapter
 * @version 1.0.0
 * @category LLM/Adapters
 */

import axios, { AxiosInstance } from 'axios';
import { BaseAdapter, AdapterConfig } from './BaseAdapter';
import { ChatRequest, ChatResponse, ChatChunk, ModelCapabilities } from './ModelAdapter';

/**
 * Ollama模型配置
 */
interface OllamaModelConfig {
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputCost: number;  // per 1k tokens (免费，为0)
  outputCost: number; // per 1k tokens (免费，为0)
  reasoningQuality: 'basic' | 'intermediate' | 'advanced';
  codingQuality: 'basic' | 'intermediate' | 'advanced';
  creativityQuality: 'basic' | 'intermediate' | 'advanced';
  supportsVision: boolean;
}

/**
 * 常用Ollama模型配置
 * 注意：实际能力取决于本地运行的模型，这里提供默认配置
 */
const OLLAMA_MODELS: Record<string, OllamaModelConfig> = {
  'llama3': {
    name: 'Llama 3',
    contextWindow: 8192,
    maxOutputTokens: 4096,
    inputCost: 0,
    outputCost: 0,
    reasoningQuality: 'advanced',
    codingQuality: 'intermediate',
    creativityQuality: 'intermediate',
    supportsVision: false,
  },
  'llama3:70b': {
    name: 'Llama 3 70B',
    contextWindow: 8192,
    maxOutputTokens: 4096,
    inputCost: 0,
    outputCost: 0,
    reasoningQuality: 'advanced',
    codingQuality: 'advanced',
    creativityQuality: 'advanced',
    supportsVision: false,
  },
  'mistral': {
    name: 'Mistral',
    contextWindow: 8192,
    maxOutputTokens: 4096,
    inputCost: 0,
    outputCost: 0,
    reasoningQuality: 'intermediate',
    codingQuality: 'intermediate',
    creativityQuality: 'intermediate',
    supportsVision: false,
  },
  'codellama': {
    name: 'Code Llama',
    contextWindow: 8192,
    maxOutputTokens: 4096,
    inputCost: 0,
    outputCost: 0,
    reasoningQuality: 'intermediate',
    codingQuality: 'advanced',
    creativityQuality: 'basic',
    supportsVision: false,
  },
  'deepseek-coder:6.7b': {
    name: 'DeepSeek Coder 6.7B',
    contextWindow: 16384,
    maxOutputTokens: 4096,
    inputCost: 0,
    outputCost: 0,
    reasoningQuality: 'intermediate',
    codingQuality: 'advanced',
    creativityQuality: 'basic',
    supportsVision: false,
  },
};

/**
 * Ollama适配器
 */
export class OllamaAdapter extends BaseAdapter {
  readonly provider = 'ollama';
  readonly model: string;
  readonly version = '1.0.0';
  
  private httpClient: AxiosInstance;
  private modelConfig: OllamaModelConfig;
  private baseUrl: string;
  
  readonly capabilities: ModelCapabilities;
  
  constructor(model: string = 'llama3', config: AdapterConfig & { baseUrl?: string } = {}) {
    super(config);
    
    this.model = model;
    this.modelConfig = OLLAMA_MODELS[model] || OLLAMA_MODELS['llama3'];
    this.baseUrl = config.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    
    this.capabilities = {
      chat: true,
      streaming: true,
      function_call: false, // Ollama原生不支持函数调用
      vision: this.modelConfig.supportsVision,
      embedding: false,
      context_window: this.modelConfig.contextWindow,
      max_output_tokens: this.modelConfig.maxOutputTokens,
      supported_languages: ['en', 'zh', 'python', 'javascript', 'java', 'cpp'],
      cost_per_1k_input_tokens: 0, // 本地免费
      cost_per_1k_output_tokens: 0, // 本地免费
      reasoning_quality: this.modelConfig.reasoningQuality,
      coding_quality: this.modelConfig.codingQuality,
      creativity_quality: this.modelConfig.creativityQuality,
    };
    
    // 创建HTTP客户端
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    this.logger.info('Ollama adapter initialized', {
      model: this.model,
      baseUrl: this.baseUrl,
      capabilities: this.capabilities,
    });
  }
  
  /**
   * 转换消息为Ollama格式
   */
  private transformToOllamaMessages(messages: any[]): { messages: any[], systemPrompt: string } {
    const ollamaMessages: any[] = [];
    let systemPrompt = '';
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt = msg.content || '';
        continue;
      }
      
      ollamaMessages.push({
        role: msg.role,
        content: msg.content,
      });
    }
    
    return { messages: ollamaMessages, systemPrompt };
  }
  
  /**
   * 执行聊天请求
   */
  protected async doChat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      const transformed = this.transformToOllamaMessages(request.messages);
      const messages = transformed.messages;
      const systemPrompt = transformed.systemPrompt;
      
      const body: any = {
        model: request.model || this.model,
        messages,
        stream: false,
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens || this.capabilities.max_output_tokens,
        },
      };
      
      if (systemPrompt) {
        body.system = systemPrompt;
      }
      
      const response = await this.httpClient.post('/api/chat', body);
      
      const latency = Date.now() - startTime;
      
      return {
        id: `ollama-${Date.now()}`,
        model: this.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: response.data.message?.content || '',
          },
          finish_reason: response.data.done ? 'stop' : 'length',
        }],
        usage: {
          prompt_tokens: response.data.prompt_eval_count || 0,
          completion_tokens: response.data.eval_count || 0,
          total_tokens: (response.data.prompt_eval_count || 0) + (response.data.eval_count || 0),
        },
        latency,
      };
      
    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      this.logger.error('Ollama API call failed', {
        error: error.message,
        status: error.response?.status,
        latency,
      });
      
      // Ollama本地错误处理
      if (error.code === 'ECONNREFUSED') {
        throw new AdapterError(
          'Ollama server not running. Make sure Ollama is installed and running.',
          'SERVER_NOT_RUNNING',
          this.provider
        );
      }
      
      throw new AdapterError(
        'Ollama API call failed: ' + error.message,
        'API_CALL_FAILED',
        this.provider,
        error.response?.status
      );
    }
  }
  
  /**
   * 执行流式聊天
   */
  protected async *doChatStream(request: ChatRequest): AsyncIterableIterator<ChatChunk> {
    const startTime = Date.now();
    
    try {
      const transformed = this.transformToOllamaMessages(request.messages);
      const messages = transformed.messages;
      const systemPrompt = transformed.systemPrompt;
      
      const body: any = {
        model: request.model || this.model,
        messages,
        stream: true,
        options: {
          temperature: request.temperature ?? 0.7,
          num_predict: request.maxTokens || this.capabilities.max_output_tokens,
        },
      };
      
      if (systemPrompt) {
        body.system = systemPrompt;
      }
      
      const response = await this.httpClient.post('/api/chat', body, {
        responseType: 'stream',
      });
      
      const stream = response.data;
      let buffer = '';
      
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
            const content = data.message?.content;
            
            if (content) {
              yield {
                id: `ollama-${Date.now()}`,
                object: 'chat.completion.chunk',
                created: Math.floor(startTime / 1000),
                model: this.model,
                choices: [{
                  index: 0,
                  delta: {
                    content,
                  },
                  finish_reason: data.done ? 'stop' : null,
                }],
              };
            }
            
            if (data.done) {
              // 发送完成事件
              yield {
                id: `ollama-${Date.now()}`,
                object: 'chat.completion.chunk',
                created: Math.floor(startTime / 1000),
                model: this.model,
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
      
    } catch (error: any) {
      this.logger.error('Ollama stream failed', {
        error: error.message,
      });
      
      if (error.code === 'ECONNREFUSED') {
        throw new AdapterError(
          'Ollama server not running',
          'SERVER_NOT_RUNNING',
          this.provider
        );
      }
      
      throw new AdapterError(
        'Ollama stream failed: ' + error.message,
        'STREAM_FAILED',
        this.provider
      );
    }
  }
  
  /**
   * 执行嵌入（Ollama需要单独的API）
   */
  protected async doEmbed(text: string): Promise<number[]> {
    try {
      const response = await this.httpClient.post('/api/embeddings', {
        model: this.model,
        input: text,
      });
      
      return response.data.embedding || [];
      
    } catch (error: any) {
      throw new AdapterError(
        'Ollama embedding failed: ' + error.message,
        'EMBEDDING_FAILED',
        this.provider
      );
    }
  }
  
  /**
   * 健康检查 - 检查Ollama服务器是否运行
   */
  async healthCheck(): Promise<import('./ModelAdapter').HealthStatus> {
    const startTime = Date.now();
    
    try {
      const response = await this.httpClient.get('/api/tags', {
        timeout: 5000,
      });
      
      const latency = Date.now() - startTime;
      
      return {
        provider: this.provider,
        model: this.model,
        status: latency < 1000 ? 'healthy' : 'degraded',
        latency,
        lastCheck: new Date(),
        errorRate: 0,
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
   * 获取本地可用的模型列表
   */
  async getLocalModels(): Promise<string[]> {
    try {
      const response = await this.httpClient.get('/api/tags');
      const models = response.data.models || [];
      return models.map((m: any) => m.name);
    } catch (error: any) {
      this.logger.error('Failed to get local models', { error: error.message });
      return [];
    }
  }
  
  /**
   * 获取支持的所有模型配置
   */
  static getSupportedModels(): string[] {
    return Object.keys(OLLAMA_MODELS);
  }
  
  /**
   * 获取模型配置
   */
  static getModelConfig(model: string): OllamaModelConfig | undefined {
    return OLLAMA_MODELS[model];
  }
}

// 导出错误类
import { AdapterError } from './BaseAdapter';
export { AdapterError };
