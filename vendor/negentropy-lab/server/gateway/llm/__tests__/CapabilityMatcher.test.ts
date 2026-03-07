/**
 * 能力匹配引擎测试
 * 
 * 宪法依据: §101 同步公理 - 代码与文档同步
 * 
 * @module llm/__tests__/CapabilityMatcher.test
 * @version 1.0.0
 */

import { CapabilityMatcher, MatcherConfig } from '../CapabilityMatcher';
import { ModelAdapter, ModelCapabilities, AdapterConfig } from '../adapters/ModelAdapter';
import { BaseAdapter } from '../adapters/BaseAdapter';

// Mock适配器
class MockAdapter extends BaseAdapter {
  readonly provider: string;
  readonly model: string;
  readonly version = '1.0.0';
  
  readonly capabilities: ModelCapabilities;
  
  constructor(
    provider: string,
    model: string,
    capabilities: ModelCapabilities
  ) {
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

describe('CapabilityMatcher', () => {
  let matcher: CapabilityMatcher;
  
  beforeEach(() => {
    matcher = new CapabilityMatcher({
      enableLogging: false,
    });
  });
  
  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const config = matcher.getConfig();
      
      expect(config.qualityWeight).toBe(0.4);
      expect(config.costWeight).toBe(0.3);
      expect(config.performanceWeight).toBe(0.3);
    });
    
    it('should normalize weights', () => {
      const customMatcher = new CapabilityMatcher({
        qualityWeight: 0.5,
        costWeight: 0.5,
        performanceWeight: 0.5,
        enableLogging: false,
      });
      
      const config = customMatcher.getConfig();
      
      // 总和应该接近1
      const total = config.qualityWeight + config.costWeight + config.performanceWeight;
      expect(Math.abs(total - 1.0)).toBeLessThan(0.01);
    });
  });
  
  describe('Analyze Requirements', () => {
    it('should analyze code task', () => {
      const task = {
        description: 'Implement a function to sort an array',
        type: 'code' as const,
      };
      
      const requirements = matcher.analyzeRequirements(task);
      
      expect(requirements.qualityType).toBe('coding');
      expect(requirements.estimatedTokens).toBeGreaterThan(0);
    });
    
    it('should analyze creative task', () => {
      const task = {
        description: 'Write a creative story about a robot',
        type: 'creative' as const,
      };
      
      const requirements = matcher.analyzeRequirements(task);
      
      expect(requirements.qualityType).toBe('creativity');
    });
    
    it('should analyze high priority task', () => {
      const task = {
        description: 'Design system architecture',
        priority: 'high' as const,
      };
      
      const requirements = matcher.analyzeRequirements(task);
      
      expect(requirements.minQuality).toBe('advanced');
    });
    
    it('should detect streaming need', () => {
      const task = {
        description: 'Generate a long response with streaming',
      };
      
      const requirements = matcher.analyzeRequirements(task);
      
      expect(requirements.needsStreaming).toBe(true);
    });
    
    it('should detect function call need', () => {
      const task = {
        description: 'Call the getWeather API function',
      };
      
      const requirements = matcher.analyzeRequirements(task);
      
      expect(requirements.needsFunctionCall).toBe(true);
    });
    
    it('should detect vision need', () => {
      const task = {
        description: 'Analyze this image',
        type: 'analysis' as const,
      };
      
      const requirements = matcher.analyzeRequirements(task);
      
      expect(requirements.needsVision).toBe(true);
    });
  });
  
  describe('Match', () => {
    let adapters: ModelAdapter[];
    
    beforeEach(() => {
      // 创建不同能力的适配器
      adapters = [
        new MockAdapter('provider1', 'advanced-model', {
          chat: true,
          streaming: true,
          function_call: true,
          vision: true,
          embedding: false,
          context_window: 128000,
          max_output_tokens: 8192,
          supported_languages: ['en', 'zh'],
          cost_per_1k_input_tokens: 0.002,
          cost_per_1k_output_tokens: 0.004,
          reasoning_quality: 'advanced',
          coding_quality: 'advanced',
          creativity_quality: 'advanced',
        }),
        new MockAdapter('provider2', 'intermediate-model', {
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
        }),
        new MockAdapter('provider3', 'basic-model', {
          chat: true,
          streaming: false,
          function_call: false,
          vision: false,
          embedding: false,
          context_window: 4096,
          max_output_tokens: 2048,
          supported_languages: ['en'],
          cost_per_1k_input_tokens: 0.0005,
          cost_per_1k_output_tokens: 0.001,
          reasoning_quality: 'basic',
          coding_quality: 'basic',
          creativity_quality: 'basic',
        }),
      ];
    });
    
    it('should match adapter with basic requirements', () => {
      const requirements = {
        estimatedTokens: 1000,
        qualityType: 'reasoning' as const,
        minQuality: 'intermediate' as const,
        needsStreaming: false,
        needsFunctionCall: false,
        needsVision: false,
      };
      
      for (const adapter of adapters) {
        const result = matcher.match(adapter, requirements);
        expect(result).toBeDefined();
        expect(result.score).toBeGreaterThanOrEqual(0);
      }
    });
    
    it('should give higher score to better matching adapter', () => {
      const requirements = {
        estimatedTokens: 1000,
        qualityType: 'coding' as const,
        minQuality: 'advanced' as const,
        needsStreaming: true,
        needsFunctionCall: true,
        needsVision: false,
        maxCost: 0.01,
      };
      
      const results = adapters.map(adapter => matcher.match(adapter, requirements));
      const validResults = results.filter(r => r.score > 0);
      
      // 应该有至少一个有效的匹配
      expect(validResults.length).toBeGreaterThan(0);
      
      // 按分数排序
      const sorted = validResults.sort((a, b) => b.score - a.score);
      
      // 最高分应该大于0
      expect(sorted[0].score).toBeGreaterThan(0);
    });
    
    it('should return 0 score for adapter missing required capability', () => {
      const requirements = {
        estimatedTokens: 1000,
        qualityType: 'reasoning' as const,
        minQuality: 'intermediate' as const,
        needsStreaming: false,
        needsFunctionCall: false,
        needsVision: true, // 需要视觉能力
      };
      
      const basicAdapter = adapters[2]; // basic-model没有vision
      const result = matcher.match(basicAdapter, requirements);
      
      expect(result.score).toBe(0);
      expect(result.details.missingCapabilities).toContain('vision');
    });
    
    it('should include matching details', () => {
      const requirements = {
        estimatedTokens: 1000,
        qualityType: 'reasoning' as const,
        minQuality: 'intermediate' as const,
        needsStreaming: true,
        needsFunctionCall: false,
        needsVision: false,
      };
      
      const advancedAdapter = adapters[0];
      const result = matcher.match(advancedAdapter, requirements);
      
      expect(result.details.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.details.costScore).toBeGreaterThanOrEqual(0);
      expect(result.details.performanceScore).toBeGreaterThanOrEqual(0);
      expect(result.details.matchedCapabilities).toContain('streaming');
    });
  });
  
  describe('Select Best', () => {
    let adapters: ModelAdapter[];
    
    beforeEach(() => {
      adapters = [
        new MockAdapter('provider1', 'advanced-expensive', {
          chat: true,
          streaming: true,
          function_call: true,
          vision: false,
          embedding: false,
          context_window: 128000,
          max_output_tokens: 8192,
          supported_languages: ['en'],
          cost_per_1k_input_tokens: 0.01,
          cost_per_1k_output_tokens: 0.02,
          reasoning_quality: 'advanced',
          coding_quality: 'advanced',
          creativity_quality: 'advanced',
        }),
        new MockAdapter('provider2', 'intermediate-affordable', {
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
        }),
        new MockAdapter('provider3', 'basic-cheap', {
          chat: true,
          streaming: true,
          function_call: false,
          vision: false,
          embedding: false,
          context_window: 4096,
          max_output_tokens: 2048,
          supported_languages: ['en'],
          cost_per_1k_input_tokens: 0.0001,
          cost_per_1k_output_tokens: 0.0002,
          reasoning_quality: 'basic',
          coding_quality: 'basic',
          creativity_quality: 'basic',
        }),
      ];
    });
    
    it('should select best adapter for given requirements', () => {
      const requirements = {
        estimatedTokens: 1000,
        qualityType: 'coding' as const,
        minQuality: 'intermediate' as const,
        needsStreaming: true,
        needsFunctionCall: true,
        needsVision: false,
        maxCost: 0.005,
      };
      
      const best = matcher.selectBest(adapters, requirements);
      
      expect(best).toBeDefined();
      if (!best) {
        throw new Error('Expected a best adapter match');
      }
      expect(best.adapter.model).toBeDefined();
      expect(best.score).toBeGreaterThan(0);
    });
    
    it('should return null if no adapter matches', () => {
      const requirements = {
        estimatedTokens: 1000,
        qualityType: 'reasoning' as const,
        minQuality: 'advanced' as const,
        needsStreaming: false,
        needsFunctionCall: false,
        needsVision: true, // 需要视觉能力但没有模型支持
      };
      
      const best = matcher.selectBest(adapters, requirements);
      
      expect(best).toBeNull();
    });
    
    it('should prioritize quality when cost is not limited', () => {
      const requirements = {
        estimatedTokens: 1000,
        qualityType: 'reasoning' as const,
        minQuality: 'intermediate' as const,
        needsStreaming: false,
        needsFunctionCall: false,
        needsVision: false,
      };
      
      const best = matcher.selectBest(adapters, requirements);
      
      // 应该选择高级模型（因为成本不是限制因素）
      expect(best?.adapter.capabilities.reasoning_quality).toBe('advanced');
    });
    
    it('should consider cost when limited', () => {
      const requirements = {
        estimatedTokens: 5000,
        qualityType: 'reasoning' as const,
        minQuality: 'intermediate' as const,
        needsStreaming: false,
        needsFunctionCall: false,
        needsVision: false,
        maxCost: 0.001,
      };
      
      const best = matcher.selectBest(adapters, requirements);
      
      // 应该选择成本较低的模型
      expect(best).toBeDefined();
      expect(best?.score).toBeGreaterThan(0);
    });
  });
  
  describe('Config Update', () => {
    it('should update config', () => {
      matcher.updateConfig({
        qualityWeight: 0.5,
        costWeight: 0.3,
        performanceWeight: 0.2,
      });
      
      const config = matcher.getConfig();
      
      expect(config.qualityWeight).toBe(0.5);
      expect(config.costWeight).toBe(0.3);
      expect(config.performanceWeight).toBe(0.2);
    });
    
    it('should normalize weights on update', () => {
      matcher.updateConfig({
        qualityWeight: 1.0,
        costWeight: 1.0,
        performanceWeight: 1.0,
      });
      
      const config = matcher.getConfig();
      
      const total = config.qualityWeight + config.costWeight + config.performanceWeight;
      expect(Math.abs(total - 1.0)).toBeLessThan(0.01);
    });
  });
});
