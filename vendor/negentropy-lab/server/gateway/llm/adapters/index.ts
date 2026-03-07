/**
 * LLM适配器索引
 * 
 * 导出所有适配器和公共接口
 * 
 * 宪法依据: §101 同步公理 - 代码与文档同步
 * 
 * @module llm/adapters
 * @version 1.0.0
 * @category LLM/Adapters
 */

// 核心接口和基类
export {
  ModelAdapter,
  ModelCapabilities,
  ChatRequest,
  ChatResponse,
  ChatChunk,
  ChatMessage,
  HealthStatus,
  QuotaUsage,
  TaskRequirements,
  TaskDescription,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
  AdapterConfig,
  Logger,
} from './ModelAdapter';

export {
  BaseAdapter,
  AdapterError,
} from './BaseAdapter';

// P0 适配器（必须）
export { OpenAIAdapter } from './OpenAIAdapter';
export { AnthropicAdapter } from './AnthropicAdapter';
export { GLMAdapter } from './GLMAdapter';
export { DeepSeekAdapter } from './DeepSeekAdapter';

// P1 适配器（重要）
export { MiniMaxAdapter } from './MiniMaxAdapter';
export { GeminiAdapter } from './GeminiAdapter';
export { MistralAdapter } from './MistralAdapter';

// P2 适配器（可选）
export { OllamaAdapter } from './OllamaAdapter';
export { CohereAdapter } from './CohereAdapter';
export { HuggingFaceAdapter } from './HuggingFaceAdapter';

// 适配器工厂
import { OpenAIAdapter } from './OpenAIAdapter';
import { AnthropicAdapter } from './AnthropicAdapter';
import { GLMAdapter } from './GLMAdapter';
import { DeepSeekAdapter } from './DeepSeekAdapter';
import { MiniMaxAdapter } from './MiniMaxAdapter';
import { GeminiAdapter } from './GeminiAdapter';
import { MistralAdapter } from './MistralAdapter';
import { OllamaAdapter } from './OllamaAdapter';
import { CohereAdapter } from './CohereAdapter';
import { HuggingFaceAdapter } from './HuggingFaceAdapter';
import { BaseAdapter, AdapterConfig } from './BaseAdapter';

/**
 * 适配器工厂
 * 
 * 根据提供商和模型名称创建适配器
 */
export class AdapterFactory {
  /**
   * 创建适配器
   */
  static create(provider: string, model: string, config: AdapterConfig = {}): BaseAdapter {
    switch (provider.toLowerCase()) {
      case 'openai':
        return new OpenAIAdapter(model, config);
      case 'anthropic':
        return new AnthropicAdapter(model, config);
      case 'glm':
      case 'zai':
        return new GLMAdapter(model, config);
      case 'deepseek':
        return new DeepSeekAdapter(model, config);
      case 'minimax':
        return new MiniMaxAdapter(model, config);
      case 'gemini':
      case 'google':
        return new GeminiAdapter(model, config);
      case 'mistral':
        return new MistralAdapter(model, config);
      case 'ollama':
        return new OllamaAdapter(model, config);
      case 'cohere':
        return new CohereAdapter(model, config);
      case 'huggingface':
      case 'hf':
        return new HuggingFaceAdapter(model, config);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }
  
  /**
   * 从配置字符串创建适配器
   * 格式: "provider:model"
   * 例如: "openai:gpt-4o", "deepseek:deepseek-chat"
   */
  static fromString(configString: string, adapterConfig: AdapterConfig = {}): BaseAdapter {
    const [provider, model] = configString.split(':');
    
    if (!provider || !model) {
      throw new Error(`Invalid config string: ${configString}. Expected format: "provider:model"`);
    }
    
    return this.create(provider, model, adapterConfig);
  }
  
  /**
   * 获取所有支持的提供商
   */
  static getSupportedProviders(): string[] {
    return [
      'openai',
      'anthropic',
      'glm',
      'deepseek',
      'minimax',
      'gemini',
      'mistral',
      'ollama',
      'cohere',
      'huggingface',
    ];
  }
}

/**
 * 获取所有适配器类
 */
export const ADAPTER_CLASSES = {
  openai: OpenAIAdapter,
  anthropic: AnthropicAdapter,
  glm: GLMAdapter,
  deepseek: DeepSeekAdapter,
  minimax: MiniMaxAdapter,
  gemini: GeminiAdapter,
  mistral: MistralAdapter,
  ollama: OllamaAdapter,
  cohere: CohereAdapter,
  huggingface: HuggingFaceAdapter,
};
