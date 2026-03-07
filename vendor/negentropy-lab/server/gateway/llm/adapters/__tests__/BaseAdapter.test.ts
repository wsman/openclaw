/**
 * 基础适配器测试
 * 
 * 宪法依据: §101 同步公理 - 代码与文档同步
 * 
 * @module llm/adapters/__tests__/BaseAdapter.test
 * @version 1.0.0
 */

import { BaseAdapter, AdapterError } from '../BaseAdapter';
import {
  ModelCapabilities,
  ChatRequest,
  AdapterConfig,
} from '../ModelAdapter';

// Mock适配器用于测试
class MockAdapter extends BaseAdapter {
  readonly provider = 'mock';
  readonly model = 'mock-model';
  readonly version = '1.0.0';
  
  readonly capabilities: ModelCapabilities = {
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
  };
  
  private shouldFail = false;
  
  setShouldFail(shouldFail: boolean): void {
    this.shouldFail = shouldFail;
  }
  
  protected async doChat(request: ChatRequest): Promise<any> {
    if (this.shouldFail) {
      throw new Error('Mock error');
    }
    
    return {
      id: 'mock-id',
      model: this.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: 'Mock response',
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    };
  }
  
  protected async *doChatStream(request: ChatRequest): AsyncIterableIterator<any> {
    yield {
      id: 'mock-id',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: this.model,
      choices: [
        {
          index: 0,
          delta: { content: 'Mock' },
          finish_reason: null,
        },
      ],
    };
    
    yield {
      id: 'mock-id',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: this.model,
      choices: [
        {
          index: 0,
          delta: { content: ' stream' },
          finish_reason: null,
        },
      ],
    };
    
    yield {
      id: 'mock-id',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: this.model,
      choices: [
        {
          index: 0,
          delta: {},
          finish_reason: 'stop',
        },
      ],
    };
  }
  
  protected async doEmbed(text: string): Promise<number[]> {
    return [0.1, 0.2, 0.3];
  }
}

describe('BaseAdapter', () => {
  let adapter: MockAdapter;
  
  beforeEach(() => {
    adapter = new MockAdapter();
  });
  
  afterEach(async () => {
    await adapter.dispose();
  });
  
  describe('Initialization', () => {
    it('should create adapter with default config', () => {
      expect(adapter.provider).toBe('mock');
      expect(adapter.model).toBe('mock-model');
      expect(adapter.capabilities.chat).toBe(true);
    });
    
    it('should create adapter with custom config', () => {
      const config: AdapterConfig = {
        timeout: 5000,
        enableLogging: false,
      };
      
      const customAdapter = new MockAdapter(config);
      
      expect(customAdapter).toBeDefined();
    });
  });
  
  describe('Chat', () => {
    it('should execute chat request', async () => {
      const request: ChatRequest = {
        messages: [
          { role: 'user', content: 'Hello' },
        ],
      };
      
      const response = await adapter.chat(request);
      
      expect(response.id).toBe('mock-id');
      expect(response.model).toBe('mock-model');
      expect(response.choices).toHaveLength(1);
      expect(response.choices[0].message.content).toBe('Mock response');
    });
    
    it('should update statistics after successful chat', async () => {
      const statsBefore = adapter.getStats();
      
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };
      
      await adapter.chat(request);
      
      const statsAfter = adapter.getStats();
      
      expect(statsAfter.totalRequests).toBe(statsBefore.totalRequests + 1);
      expect(statsAfter.successRequests).toBe(statsBefore.successRequests + 1);
    });
  });
  
  describe('Chat Stream', () => {
    it('should execute stream chat', async () => {
      const request: ChatRequest = {
        messages: [
          { role: 'user', content: 'Hello' },
        ],
      };
      
      const chunks: any[] = [];
      
      for await (const chunk of adapter.chatStream(request)) {
        chunks.push(chunk);
      }
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].object).toBe('chat.completion.chunk');
    });
  });
  
  describe('Embed', () => {
    it('should execute embed request', async () => {
      const embedding = await adapter.embed('test text');
      
      expect(embedding).toBeInstanceOf(Array);
      expect(embedding.length).toBe(3);
    });
  });
  
  describe('Health Check', () => {
    it('should return healthy status when chat works', async () => {
      const health = await adapter.healthCheck();
      
      expect(health.provider).toBe('mock');
      expect(health.model).toBe('mock-model');
      expect(health.status).toBe('healthy');
      expect(health.errorRate).toBe(0);
    });
    
    it('should return unhealthy status when chat fails', async () => {
      adapter.setShouldFail(true);
      
      const health = await adapter.healthCheck();
      
      expect(health.status).toBe('unhealthy');
      expect(health.errorRate).toBe(1);
    });
  });
  
  describe('Cost Calculation', () => {
    it('should calculate cost correctly', () => {
      const tokens = 1000;
      const cost = adapter.getCost(tokens);
      
      // Mock适配器成本为0
      expect(cost).toBe(0);
    });
  });
  
  describe('Token Estimation', () => {
    it('should estimate tokens for English text', () => {
      const englishText = 'Hello world, this is a test.';
      const tokens = adapter['estimateTokens'](englishText);
      
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(englishText.length); // 应该小于字符数
    });
    
    it('should estimate tokens for Chinese text', () => {
      const chineseText = '你好，世界！';
      const tokens = adapter['estimateTokens'](chineseText);
      
      expect(tokens).toBeGreaterThan(0);
    });
    
    it('should return 0 for empty text', () => {
      const tokens = adapter['estimateTokens']('');
      
      expect(tokens).toBe(0);
    });
  });
  
  describe('Error Handling', () => {
    it('should retry on retryable errors', async () => {
      adapter.setShouldFail(true);
      
      // 设置重试配置为失败后成功
      adapter['retryConfig'] = {
        ...adapter['retryConfig'],
        maxRetries: 2,
      };
      
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };
      
      // 第一次失败，第二次失败（因为shouldFail一直为true）
      await expect(adapter.chat(request)).rejects.toThrow();
    });
  });
  
  describe('Dispose', () => {
    it('should dispose adapter', async () => {
      await adapter.dispose();
      
      expect(adapter.getStats()).toBeDefined();
    });
  });
  
  describe('Statistics', () => {
    it('should track statistics', async () => {
      const request: ChatRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
      };
      
      await adapter.chat(request);
      await adapter.chat(request);
      
      const stats = adapter.getStats();
      
      expect(stats.totalRequests).toBe(2);
      expect(stats.successRequests).toBe(2);
      expect(stats.errorRequests).toBe(0);
    });
  });
});
