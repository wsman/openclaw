/**
 * 模型注册表测试
 * 
 * 宪法依据: §101 同步公理 - 代码与文档同步
 * 
 * @module llm/__tests__/ModelRegistry.test
 * @version 1.0.0
 */

import { ModelRegistry, RegistryConfig } from '../ModelRegistry';
import { ModelAdapter, ModelCapabilities, AdapterConfig } from '../adapters/ModelAdapter';
import { BaseAdapter } from '../adapters/BaseAdapter';

// Mock适配器
class MockAdapter extends BaseAdapter {
  readonly provider: string;
  readonly model: string;
  readonly version = '1.0.0';
  
  readonly capabilities: ModelCapabilities;
  
  constructor(provider: string, model: string, capabilities: ModelCapabilities) {
    super({});
    this.provider = provider;
    this.model = model;
    this.capabilities = capabilities;
  }
  
  protected async doChat(request: any): Promise<any> {
    return {
      id: `${this.provider}-${this.model}`,
      model: this.model,
      choices: [{ message: { role: 'assistant', content: 'Response' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    };
  }
  
  protected async *doChatStream(request: any): AsyncIterableIterator<any> {
    yield {
      id: 'stream-id',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: this.model,
      choices: [{ delta: { content: 'test' }, finish_reason: 'stop' }],
    };
  }
  
  protected async doEmbed(text: string): Promise<number[]> {
    return [0.1, 0.2, 0.3];
  }
}

describe('ModelRegistry', () => {
  let registry: ModelRegistry;
  
  beforeEach(() => {
    registry = new ModelRegistry({
      autoInitialize: false,
      healthCheckInterval: 1000,
    });
  });
  
  afterEach(async () => {
    await registry.dispose();
  });
  
  describe('Registration', () => {
    it('should register adapter', async () => {
      const adapter = new MockAdapter('test', 'test-model', {
        chat: true,
        streaming: true,
        function_call: false,
        vision: false,
        embedding: false,
        context_window: 4096,
        max_output_tokens: 2048,
        supported_languages: ['en'],
        cost_per_1k_input_tokens: 0.001,
        cost_per_1k_output_tokens: 0.002,
        reasoning_quality: 'intermediate',
        coding_quality: 'intermediate',
        creativity_quality: 'intermediate',
      });
      
      await registry.register(adapter);
      
      const list = registry.list();
      expect(list).toHaveLength(1);
      expect(list[0].provider).toBe('test');
    });
    
    it('should not register duplicate adapter', async () => {
      const adapter = new MockAdapter('test', 'test-model', {
        chat: true,
        streaming: true,
        function_call: false,
        vision: false,
        embedding: false,
        context_window: 4096,
        max_output_tokens: 2048,
        supported_languages: ['en'],
        cost_per_1k_input_tokens: 0.001,
        cost_per_1k_output_tokens: 0.002,
        reasoning_quality: 'intermediate',
        coding_quality: 'intermediate',
        creativity_quality: 'intermediate',
      });
      
      await registry.register(adapter);
      await registry.register(adapter);
      
      const list = registry.list();
      expect(list).toHaveLength(1);
    });
  });
  
  describe('Unregistration', () => {
    it('should unregister adapter', async () => {
      const adapter = new MockAdapter('test', 'test-model', {
        chat: true,
        streaming: true,
        function_call: false,
        vision: false,
        embedding: false,
        context_window: 4096,
        max_output_tokens: 2048,
        supported_languages: ['en'],
        cost_per_1k_input_tokens: 0.001,
        cost_per_1k_output_tokens: 0.002,
        reasoning_quality: 'intermediate',
        coding_quality: 'intermediate',
        creativity_quality: 'intermediate',
      });
      
      await registry.register(adapter);
      await registry.unregister('test', 'test-model');
      
      const list = registry.list();
      expect(list).toHaveLength(0);
    });
  });
  
  describe('Query', () => {
    beforeEach(async () => {
      // 注册多个适配器
      await registry.register(new MockAdapter('provider1', 'model1', {
        chat: true,
        streaming: true,
        function_call: true,
        vision: false,
        embedding: false,
        context_window: 8192,
        max_output_tokens: 4096,
        supported_languages: ['en', 'zh'],
        cost_per_1k_input_tokens: 0.001,
        cost_per_1k_output_tokens: 0.002,
        reasoning_quality: 'advanced',
        coding_quality: 'advanced',
        creativity_quality: 'advanced',
      }));
      
      await registry.register(new MockAdapter('provider2', 'model2', {
        chat: true,
        streaming: false,
        function_call: false,
        vision: true,
        embedding: false,
        context_window: 4096,
        max_output_tokens: 2048,
        supported_languages: ['en'],
        cost_per_1k_input_tokens: 0.0005,
        cost_per_1k_output_tokens: 0.001,
        reasoning_quality: 'intermediate',
        coding_quality: 'intermediate',
        creativity_quality: 'intermediate',
      }));
      
      await registry.register(new MockAdapter('provider1', 'model3', {
        chat: true,
        streaming: true,
        function_call: true,
        vision: false,
        embedding: false,
        context_window: 128000,
        max_output_tokens: 8192,
        supported_languages: ['en', 'zh', 'ja'],
        cost_per_1k_input_tokens: 0.002,
        cost_per_1k_output_tokens: 0.004,
        reasoning_quality: 'advanced',
        coding_quality: 'advanced',
        creativity_quality: 'advanced',
      }), { enabled: true });
    });
    
    it('should find by provider', () => {
      const providers = registry.findByProvider('provider1');
      expect(providers).toHaveLength(2); // model1 and model3
    });
    
    it('should find by capability', () => {
      const streaming = registry.findStreaming();
      expect(streaming).toHaveLength(2); // model1 and model3
      
      const functionCalling = registry.findFunctionCalling();
      expect(functionCalling).toHaveLength(2); // model1 and model3
      
      const vision = registry.findVision();
      expect(vision).toHaveLength(1); // model2
    });
    
    it('should find by max cost', () => {
      const models = registry.findByMaxCost(0.002);
      expect(models.length).toBeGreaterThan(0);
    });
    
    it('should find by quality', () => {
      const advanced = registry.findByQuality('reasoning', 'advanced');
      expect(advanced.length).toBeGreaterThan(0);
    });
    
    it('should find by min context window', () => {
      const models = registry.findByMinContextWindow(10000);
      expect(models).toHaveLength(1);
    });
  });
  
  describe('Best Match', () => {
    beforeEach(async () => {
      await registry.register(new MockAdapter('provider1', 'model1', {
        chat: true,
        streaming: true,
        function_call: true,
        vision: false,
        embedding: false,
        context_window: 8192,
        max_output_tokens: 4096,
        supported_languages: ['en'],
        cost_per_1k_input_tokens: 0.002,
        cost_per_1k_output_tokens: 0.004,
        reasoning_quality: 'advanced',
        coding_quality: 'advanced',
        creativity_quality: 'advanced',
      }));
      
      await registry.register(new MockAdapter('provider2', 'model2', {
        chat: true,
        streaming: true,
        function_call: true,
        vision: false,
        embedding: false,
        context_window: 4096,
        max_output_tokens: 2048,
        supported_languages: ['en'],
        cost_per_1k_input_tokens: 0.0005,
        cost_per_1k_output_tokens: 0.001,
        reasoning_quality: 'intermediate',
        coding_quality: 'intermediate',
        creativity_quality: 'intermediate',
      }));
    });
    
    it('should find best match for requirements', () => {
      const requirements = {
        estimatedTokens: 1000,
        qualityType: 'reasoning' as const,
        minQuality: 'intermediate' as const,
        needsStreaming: true,
        needsFunctionCall: false,
        needsVision: false,
      };
      
      const best = registry.findBestMatch(requirements);
      
      expect(best).toBeDefined();
      expect(best?.provider).toBeDefined();
      expect(best?.model).toBeDefined();
    });
    
    it('should return null if no models match', () => {
      const requirements = {
        estimatedTokens: 1000,
        qualityType: 'reasoning' as const,
        minQuality: 'advanced' as const,
        needsStreaming: false,
        needsFunctionCall: false,
        needsVision: true, // 需要视觉能力但没有模型支持
      };
      
      const best = registry.findBestMatch(requirements);
      
      expect(best).toBeNull();
    });
  });
  
  describe('Statistics', () => {
    beforeEach(async () => {
      await registry.register(new MockAdapter('provider1', 'model1', {
        chat: true,
        streaming: true,
        function_call: true,
        vision: false,
        embedding: false,
        context_window: 8192,
        max_output_tokens: 4096,
        supported_languages: ['en'],
        cost_per_1k_input_tokens: 0.001,
        cost_per_1k_output_tokens: 0.002,
        reasoning_quality: 'intermediate',
        coding_quality: 'intermediate',
        creativity_quality: 'intermediate',
      }));
    });
    
    it('should get statistics', () => {
      const stats = registry.getStats();
      
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.enabled).toBeGreaterThan(0);
      expect(stats.byProvider).toBeDefined();
      expect(stats.byCapability).toBeDefined();
    });
  });
  
  describe('Health Check', () => {
    beforeEach(async () => {
      await registry.register(new MockAdapter('provider1', 'model1', {
        chat: true,
        streaming: true,
        function_call: false,
        vision: false,
        embedding: false,
        context_window: 4096,
        max_output_tokens: 2048,
        supported_languages: ['en'],
        cost_per_1k_input_tokens: 0,
        cost_per_1k_output_tokens: 0,
        reasoning_quality: 'intermediate',
        coding_quality: 'intermediate',
        creativity_quality: 'intermediate',
      }));
    });
    
    it('should health check all models', async () => {
      const results = await registry.healthCheckAll();
      
      expect(results.size).toBeGreaterThan(0);
      for (const health of results.values()) {
        expect(health.status).toBe('healthy');
      }
    });
  });
});
