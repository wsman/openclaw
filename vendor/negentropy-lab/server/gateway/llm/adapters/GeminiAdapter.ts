/**
 * Google Gemini 模型适配器
 * 
 * 支持的模型：
 * - Gemini Pro (gemini-pro)
 * - Gemini Pro Vision (gemini-pro-vision)
 * - Gemini Flash (gemini-1.5-flash)
 * 
 * 宪法依据: §108 异构模型策略公理 - 显式模型参数
 * 
 * @module llm/adapters/GeminiAdapter
 * @version 1.0.0
 * @category LLM/Adapters
 */

import axios, { AxiosInstance } from 'axios';
import { BaseAdapter, AdapterConfig } from './BaseAdapter';
import { ChatRequest, ChatResponse, ChatChunk, ModelCapabilities } from './ModelAdapter';

/**
 * Gemini模型配置
 */
interface GeminiModelConfig {
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
 * Gemini支持模型配置
 */
const GEMINI_MODELS: Record<string, GeminiModelConfig> = {
  'gemini-2.5-pro': {
    name: 'Gemini 2.5 Pro',
    contextWindow: 2000000,
    maxOutputTokens: 8192,
    inputCost: 0.00125,
    outputCost: 0.005,
    reasoningQuality: 'advanced',
    codingQuality: 'advanced',
    creativityQuality: 'advanced',
    supportsVision: true,
  },
  'gemini-2.5-flash': {
    name: 'Gemini 2.5 Flash',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    inputCost: 0.000075,
    outputCost: 0.0003,
    reasoningQuality: 'intermediate',
    codingQuality: 'intermediate',
    creativityQuality: 'intermediate',
    supportsVision: true,
  },
  'gemini-1.5-pro': {
    name: 'Gemini 1.5 Pro',
    contextWindow: 2800000,
    maxOutputTokens: 8192,
    inputCost: 0.0025,
    outputCost: 0.01,
    reasoningQuality: 'advanced',
    codingQuality: 'advanced',
    creativityQuality: 'advanced',
    supportsVision: true,
  },
  'gemini-1.5-flash': {
    name: 'Gemini 1.5 Flash',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    inputCost: 0.000075,
    outputCost: 0.0003,
    reasoningQuality: 'intermediate',
    codingQuality: 'intermediate',
    creativityQuality: 'intermediate',
    supportsVision: true,
  },
};

/**
 * Gemini适配器
 */
export class GeminiAdapter extends BaseAdapter {
  readonly provider = 'gemini';
  readonly model: string;
  readonly version = '1.0.0';
  
  private httpClient: AxiosInstance;
  private modelConfig: GeminiModelConfig;
  private apiKey: string;
  
  readonly capabilities: ModelCapabilities;
  
  constructor(model: string = 'gemini-2.5-flash', config: AdapterConfig = {}) {
    super(config);
    
    this.model = model;
    this.modelConfig = GEMINI_MODELS[model] || GEMINI_MODELS['gemini-2.5-flash'];
    this.apiKey = config.apiKey || process.env.GOOGLE_API_KEY || '';
    
    this.capabilities = {
      chat: true,
      streaming: true,
      function_call: true,
      vision: this.modelConfig.supportsVision,
      embedding: false,
      context_window: this.modelConfig.contextWindow,
      max_output_tokens: this.modelConfig.maxOutputTokens,
      supported_languages: ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'python', 'javascript', 'java', 'cpp'],
      cost_per_1k_input_tokens: this.modelConfig.inputCost,
      cost_per_1k_output_tokens: this.modelConfig.outputCost,
      reasoning_quality: this.modelConfig.reasoningQuality,
      coding_quality: this.modelConfig.codingQuality,
      creativity_quality: this.modelConfig.creativityQuality,
    };
    
    // 创建HTTP客户端
    this.httpClient = axios.create({
      baseURL: config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta',
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    this.logger.info('Gemini adapter initialized', {
      model: this.model,
      capabilities: this.capabilities,
    });
  }
  
  /**
   * 转换消息为Gemini格式
   */
  private transformToGeminiMessages(messages: any[]): any[] {
    const geminiMessages: any[] = [];
    let systemPrompt = '';
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt = msg.content || '';
        continue;
      }
      
      const geminiMsg: any = {
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      };
      
      geminiMessages.push(geminiMsg);
    }
    
    // 如果有系统提示，添加到第一条用户消息
    if (systemPrompt && geminiMessages.length > 0 && geminiMessages[0].role === 'user') {
      geminiMessages[0].parts.unshift({ text: `System: ${systemPrompt}\n\n` });
    }
    
    return geminiMessages;
  }
  
  /**
   * 转换工具为Gemini格式
   */
  private transformToGeminiTools(tools?: any[]): any {
    if (!tools || tools.length === 0) {
      return undefined;
    }
    
    const functionDeclarations = tools.map((tool: any) => ({
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
    }));
    
    return {
      function_declarations: functionDeclarations,
    };
  }
  
  /**
   * 执行聊天请求
   */
  protected async doChat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      const contents = this.transformToGeminiMessages(request.messages);
      const tools = this.transformToGeminiTools(request.tools);
      
      const body: any = {
        contents,
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens || this.capabilities.max_output_tokens,
        },
      };
      
      if (tools) {
        body.tools = [tools];
      }
      
      const response = await this.httpClient.post(
        `/models/${this.model}:generateContent?key=${this.apiKey}`,
        body
      );
      
      const latency = Date.now() - startTime;
      
      // 转换为统一格式
      const candidate = response.data.candidates?.[0];
      const content = candidate?.content?.parts?.[0]?.text || '';
      
      return {
        id: `gemini-${Date.now()}`,
        model: this.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          finish_reason: candidate?.finishReason === 'STOP' ? 'stop' : 'length',
        }],
        usage: {
          prompt_tokens: response.data.usageMetadata?.promptTokenCount || 0,
          completion_tokens: response.data.usageMetadata?.candidatesTokenCount || 0,
          total_tokens: response.data.usageMetadata?.totalTokenCount || 0,
        },
        latency,
      };
      
    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      this.logger.error('Gemini API call failed', {
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
          'Gemini API call failed: ' + error.message,
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
      const contents = this.transformToGeminiMessages(request.messages);
      const tools = this.transformToGeminiTools(request.tools);
      
      const body: any = {
        contents,
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens || this.capabilities.max_output_tokens,
        },
      };
      
      if (tools) {
        body.tools = [tools];
      }
      
      const response = await this.httpClient.post(
        `/models/${this.model}:streamGenerateContent?key=${this.apiKey}`,
        body,
        {
          responseType: 'stream',
        }
      );
      
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
            const candidate = data.candidates?.[0];
            const content = candidate?.content?.parts?.[0]?.text;
            
            if (content) {
              yield {
                id: `gemini-${Date.now()}`,
                object: 'chat.completion.chunk',
                created: Math.floor(startTime / 1000),
                model: this.model,
                choices: [{
                  index: 0,
                  delta: {
                    content,
                  },
                  finish_reason: candidate?.finishReason === 'STOP' ? 'stop' : null,
                }],
              };
            }
            
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
      
    } catch (error: any) {
      this.logger.error('Gemini stream failed', {
        error: error.message,
      });
      throw new AdapterError(
        'Gemini stream failed: ' + error.message,
        'STREAM_FAILED',
        this.provider
      );
    }
  }
  
  /**
   * 执行嵌入（Gemini需要单独的API）
   */
  protected async doEmbed(text: string): Promise<number[]> {
    try {
      const response = await this.httpClient.post(
        `/models/embedding-001:embedContent?key=${this.apiKey}`,
        {
          content: {
            parts: [{ text }],
          },
        }
      );
      
      return response.data.embedding.values || [];
      
    } catch (error: any) {
      throw new AdapterError(
        'Gemini embedding failed: ' + error.message,
        'EMBEDDING_FAILED',
        this.provider
      );
    }
  }
  
  /**
   * 获取支持的所有模型
   */
  static getSupportedModels(): string[] {
    return Object.keys(GEMINI_MODELS);
  }
  
  /**
   * 获取模型配置
   */
  static getModelConfig(model: string): GeminiModelConfig | undefined {
    return GEMINI_MODELS[model];
  }
}

// 导出错误类
import { AdapterError } from './BaseAdapter';
export { AdapterError };
