/**
 * HuggingFace Inference API 适配器
 * 
 * 支持的模型：
 * - HuggingFace Hub上的所有文本生成模型
 * - 常用模型：meta-llama/Llama-3.1-70B-Instruct, mistralai/Mistral-Nemo等
 * 
 * 宪法依据: §108 异构模型策略公理 - 显式模型参数
 * 
 * @module llm/adapters/HuggingFaceAdapter
 * @version 1.0.0
 * @category LLM/Adapters
 */

import axios, { AxiosInstance } from 'axios';
import { BaseAdapter, AdapterConfig } from './BaseAdapter';
import { ChatRequest, ChatResponse, ChatChunk, ModelCapabilities } from './ModelAdapter';

/**
 * HuggingFace模型配置
 */
interface HFModelConfig {
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  inputCost: number;  // per 1k tokens (Serverless按token计费)
  outputCost: number; // per 1k tokens
  reasoningQuality: 'basic' | 'intermediate' | 'advanced';
  codingQuality: 'basic' | 'intermediate' | 'advanced';
  creativityQuality: 'basic' | 'intermediate' | 'advanced';
}

/**
 * 常用HuggingFace模型配置
 * 注意：HuggingFace支持数千个模型，这里只列出常用模型
 */
const HF_MODELS: Record<string, HFModelConfig> = {
  'meta-llama/Llama-3.1-70B-Instruct': {
    name: 'Llama 3.1 70B Instruct',
    contextWindow: 131072,
    maxOutputTokens: 4096,
    inputCost: 0.0007,
    outputCost: 0.0007,
    reasoningQuality: 'advanced',
    codingQuality: 'advanced',
    creativityQuality: 'advanced',
  },
  'meta-llama/Llama-3.1-8B-Instruct': {
    name: 'Llama 3.1 8B Instruct',
    contextWindow: 131072,
    maxOutputTokens: 4096,
    inputCost: 0.00008,
    outputCost: 0.00008,
    reasoningQuality: 'intermediate',
    codingQuality: 'intermediate',
    creativityQuality: 'intermediate',
  },
  'mistralai/Mistral-Nemo-Instruct-2407': {
    name: 'Mistral Nemo',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    inputCost: 0.00015,
    outputCost: 0.00015,
    reasoningQuality: 'intermediate',
    codingQuality: 'intermediate',
    creativityQuality: 'intermediate',
  },
  'Qwen/Qwen2.5-72B-Instruct': {
    name: 'Qwen 2.5 72B',
    contextWindow: 32768,
    maxOutputTokens: 8192,
    inputCost: 0.0007,
    outputCost: 0.0007,
    reasoningQuality: 'advanced',
    codingQuality: 'advanced',
    creativityQuality: 'advanced',
  },
  'NousResearch/Hermes-3-Llama-3.1-70B': {
    name: 'Hermes 3 Llama 3.1 70B',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    inputCost: 0.0007,
    outputCost: 0.0007,
    reasoningQuality: 'advanced',
    codingQuality: 'advanced',
    creativityQuality: 'advanced',
  },
};

/**
 * HuggingFace适配器
 */
export class HuggingFaceAdapter extends BaseAdapter {
  readonly provider = 'huggingface';
  readonly model: string;
  readonly version = '1.0.0';
  
  private httpClient: AxiosInstance;
  private modelConfig: HFModelConfig;
  
  readonly capabilities: ModelCapabilities;
  
  constructor(model: string = 'meta-llama/Llama-3.1-8B-Instruct', config: AdapterConfig = {}) {
    super(config);
    
    this.model = model;
    this.modelConfig = HF_MODELS[model] || {
      name: model,
      contextWindow: 4096,
      maxOutputTokens: 2048,
      inputCost: 0.0001,
      outputCost: 0.0001,
      reasoningQuality: 'intermediate',
      codingQuality: 'intermediate',
      creativityQuality: 'intermediate',
    };
    
    this.capabilities = {
      chat: true,
      streaming: true,
      function_call: false, // HF Inference API不支持函数调用
      vision: false,
      embedding: false,
      context_window: this.modelConfig.contextWindow,
      max_output_tokens: this.modelConfig.maxOutputTokens,
      supported_languages: ['en', 'zh', 'python', 'javascript', 'java', 'cpp'],
      cost_per_1k_input_tokens: this.modelConfig.inputCost,
      cost_per_1k_output_tokens: this.modelConfig.outputCost,
      reasoning_quality: this.modelConfig.reasoningQuality,
      coding_quality: this.modelConfig.codingQuality,
      creativity_quality: this.modelConfig.creativityQuality,
    };
    
    // 创建HTTP客户端
    this.httpClient = axios.create({
      baseURL: config.baseUrl || 'https://api-inference.huggingface.co/models',
      timeout: this.timeout,
      headers: {
        'Authorization': `Bearer ${config.apiKey || process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    this.logger.info('HuggingFace adapter initialized', {
      model: this.model,
      capabilities: this.capabilities,
    });
  }
  
  /**
   * 转换消息为HuggingFace格式
   */
  private transformToHFPrompt(messages: any[]): string {
    let prompt = '';
    let systemPrompt = '';
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt = msg.content || '';
        continue;
      }
      
      if (msg.role === 'user') {
        prompt += `<|user|>\n${msg.content}\n`;
      } else if (msg.role === 'assistant') {
        prompt += `<|assistant|>\n${msg.content}\n`;
      }
    }
    
    // 添加系统提示
    if (systemPrompt) {
      prompt = `<|system|>\n${systemPrompt}\n` + prompt;
    }
    
    // 添加assistant开始标记
    prompt += `<|assistant|>\n`;
    
    return prompt;
  }
  
  /**
   * 执行聊天请求
   */
  protected async doChat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    try {
      const prompt = this.transformToHFPrompt(request.messages);
      
      const body: any = {
        inputs: prompt,
        parameters: {
          temperature: request.temperature ?? 0.7,
          max_new_tokens: request.maxTokens || this.capabilities.max_output_tokens,
          return_full_text: false,
        },
      };
      
      const response = await this.httpClient.post(`/${this.model}`, body);
      
      const latency = Date.now() - startTime;
      
      // HuggingFace返回格式
      const content = Array.isArray(response.data) ? response.data[0]?.generated_text : response.data.generated_text;
      
      return {
        id: `hf-${Date.now()}`,
        model: this.model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: content || '',
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: this.estimateTokens(prompt),
          completion_tokens: this.estimateTokens(content || ''),
          total_tokens: this.estimateTokens(prompt) + this.estimateTokens(content || ''),
        },
        latency,
      };
      
    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      this.logger.error('HuggingFace API call failed', {
        error: error.message,
        status: error.response?.status,
        latency,
      });
      
      // 转换错误
      if (error.response?.status === 503) {
        throw new AdapterError(
          'Model is loading. Please try again later.',
          'MODEL_LOADING',
          this.provider,
          503
        );
      } else if (error.response?.status === 401) {
        throw new AdapterError(
          'Invalid API key',
          'INVALID_API_KEY',
          this.provider,
          401
        );
      } else if (error.response?.status === 429) {
        throw new AdapterError(
          'Rate limit exceeded. Consider upgrading to Pro subscription.',
          'RATE_LIMIT_EXCEEDED',
          this.provider,
          429
        );
      } else {
        throw new AdapterError(
          'HuggingFace API call failed: ' + error.message,
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
      const prompt = this.transformToHFPrompt(request.messages);
      
      const body: any = {
        inputs: prompt,
        parameters: {
          temperature: request.temperature ?? 0.7,
          max_new_tokens: request.maxTokens || this.capabilities.max_output_tokens,
          return_full_text: false,
        },
        stream: true,
      };
      
      const response = await this.httpClient.post(`/${this.model}`, body, {
        responseType: 'stream',
      });
      
      const stream = response.data;
      let buffer = '';
      
      for await (const chunk of stream) {
        buffer += chunk.toString();
        
        // HuggingFace流式响应是纯文本
        const content = buffer;
        buffer = '';
        
        if (content) {
          yield {
            id: `hf-${Date.now()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(startTime / 1000),
            model: this.model,
            choices: [{
              index: 0,
              delta: {
                content,
              },
              finish_reason: null,
            }],
          };
        }
      }
      
      // 发送完成事件
      yield {
        id: `hf-${Date.now()}`,
        object: 'chat.completion.chunk',
        created: Math.floor(startTime / 1000),
        model: this.model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop',
        }],
      };
      
    } catch (error: any) {
      this.logger.error('HuggingFace stream failed', {
        error: error.message,
      });
      throw new AdapterError(
        'HuggingFace stream failed: ' + error.message,
        'STREAM_FAILED',
        this.provider
      );
    }
  }
  
  /**
   * 执行嵌入（HuggingFace需要单独的模型）
   */
  protected async doEmbed(text: string): Promise<number[]> {
    try {
      const response = await this.httpClient.post('/sentence-transformers/all-MiniLM-L6-v2/feature-extraction', {
        inputs: text,
      });
      
      return Array.isArray(response.data) ? response.data[0] : response.data;
      
    } catch (error: any) {
      throw new AdapterError(
        'HuggingFace embedding failed: ' + error.message,
        'EMBEDDING_FAILED',
        this.provider
      );
    }
  }
  
  /**
   * 获取支持的所有模型
   */
  static getSupportedModels(): string[] {
    return Object.keys(HF_MODELS);
  }
  
  /**
   * 获取模型配置
   */
  static getModelConfig(model: string): HFModelConfig | undefined {
    return HF_MODELS[model];
  }
  
  /**
   * 检查模型是否可用
   */
  async checkModelAvailability(model?: string): Promise<boolean> {
    try {
      const targetModel = model || this.model;
      const response = await this.httpClient.get(`/${targetModel}`, {
        timeout: 5000,
      });
      return response.status === 200;
    } catch (error: any) {
      return false;
    }
  }
}

// 导出错误类
import { AdapterError } from './BaseAdapter';
export { AdapterError };
