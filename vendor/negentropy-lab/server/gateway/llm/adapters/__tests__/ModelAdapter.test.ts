/**
 * 模型适配器接口测试
 * 
 * 宪法依据: §101 同步公理 - 代码与文档同步
 * 
 * @module llm/adapters/__tests__/ModelAdapter.test
 * @version 1.0.0
 */

import {
  ModelCapabilities,
  ChatRequest,
  ChatResponse,
  TaskRequirements,
  DEFAULT_RETRY_CONFIG,
} from '../ModelAdapter';

describe('ModelAdapter Interfaces', () => {
  describe('ModelCapabilities', () => {
    it('should accept valid capabilities', () => {
      const capabilities: ModelCapabilities = {
        chat: true,
        streaming: true,
        function_call: true,
        vision: false,
        embedding: false,
        context_window: 128000,
        max_output_tokens: 4096,
        supported_languages: ['en', 'zh'],
        cost_per_1k_input_tokens: 0.001,
        cost_per_1k_output_tokens: 0.002,
        reasoning_quality: 'advanced',
        coding_quality: 'advanced',
        creativity_quality: 'advanced',
      };
      
      expect(capabilities.chat).toBe(true);
      expect(capabilities.streaming).toBe(true);
      expect(capabilities.context_window).toBe(128000);
    });
    
    it('should support all quality levels', () => {
      const qualityLevels = ['basic', 'intermediate', 'advanced'] as const;
      
      for (const level of qualityLevels) {
        const capabilities: ModelCapabilities = {
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
          reasoning_quality: level,
          coding_quality: level,
          creativity_quality: level,
        };
        
        expect(capabilities.reasoning_quality).toBe(level);
        expect(capabilities.coding_quality).toBe(level);
        expect(capabilities.creativity_quality).toBe(level);
      }
    });
  });
  
  describe('ChatRequest', () => {
    it('should accept minimal request', () => {
      const request: ChatRequest = {
        messages: [
          { role: 'user', content: 'Hello' },
        ],
      };
      
      expect(request.messages).toHaveLength(1);
      expect(request.messages[0].role).toBe('user');
      expect(request.messages[0].content).toBe('Hello');
    });
    
    it('should accept full request with all options', () => {
      const request: ChatRequest = {
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Hello' },
        ],
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 2048,
        stream: true,
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get current weather',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string' },
                },
              },
            },
          },
        ],
      };
      
      expect(request.model).toBe('gpt-4');
      expect(request.temperature).toBe(0.7);
      expect(request.maxTokens).toBe(2048);
      expect(request.stream).toBe(true);
      expect(request.tools).toHaveLength(1);
    });
  });
  
  describe('TaskRequirements', () => {
    it('should accept basic requirements', () => {
      const requirements: TaskRequirements = {
        estimatedTokens: 1000,
        qualityType: 'reasoning',
        minQuality: 'intermediate',
        needsStreaming: false,
        needsFunctionCall: false,
        needsVision: false,
      };
      
      expect(requirements.estimatedTokens).toBe(1000);
      expect(requirements.qualityType).toBe('reasoning');
      expect(requirements.minQuality).toBe('intermediate');
    });
    
    it('should accept requirements with cost limit', () => {
      const requirements: TaskRequirements = {
        estimatedTokens: 2000,
        qualityType: 'coding',
        minQuality: 'advanced',
        maxCost: 0.01,
        needsStreaming: true,
        needsFunctionCall: false,
        needsVision: false,
      };
      
      expect(requirements.maxCost).toBe(0.01);
      expect(requirements.needsStreaming).toBe(true);
    });
  });
  
  describe('DEFAULT_RETRY_CONFIG', () => {
    it('should have retry configuration', () => {
      expect(DEFAULT_RETRY_CONFIG).toBeDefined();
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBeGreaterThan(0);
      expect(DEFAULT_RETRY_CONFIG.delayMs).toBeGreaterThan(0);
      expect(DEFAULT_RETRY_CONFIG.backoffFactor).toBeGreaterThan(1);
      expect(DEFAULT_RETRY_CONFIG.retryableErrors).toBeInstanceOf(Array);
    });
    
    it('should include common retryable errors', () => {
      const { retryableErrors } = DEFAULT_RETRY_CONFIG;
      
      expect(retryableErrors).toContain('RATE_LIMIT_EXCEEDED');
      expect(retryableErrors).toContain('TEMPORARY_FAILURE');
      expect(retryableErrors).toContain('TIMEOUT');
    });
  });
});
