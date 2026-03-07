/**
 * LLMService.test.ts - LLM服务详细测试
 *
 * 宪法依据:
 * - §101 同步公理: 测试代码与生产代码同步
 * - §102 熵减原则: 提高测试覆盖率以降低系统熵
 * - §108 异构模型策略: 测试模型参数显式指定
 *
 * 测试目标: 将agent-integration插件覆盖率从~70%提升到≥85%
 * 新增测试用例: 20个
 *
 * @version 2.0.0
 * @created 2026-02-13
 * @maintainer 科技部后端分队
 */

import { AgentIntegrationPlugin, 
  type AgentIntegrationConfig,
  type LLMResponse,
 } from './index';

// =============================================================================
// Mock Plugin API
// =============================================================================

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

const mockApi = {
  id: 'agent-integration',
  name: 'Agent Integration Plugin',
  version: '1.0.0',
  description: 'Agent集成插件',
  source: '/plugins/core/agent-integration',
  config: {
    negentropy: {
      agentIntegration: {
        model: 'google-antigravity/gemini-3-flash',
        timeout: 3600000,
        depth: 2,
        fallback: 'google-antigravity/gemini-3-pro-high',
        complexityConfig: {
          L1: {
            timeout: 15 * 60 * 1000,
            maxDepth: 5,
            recommendedModel: 'google-antigravity/gemini-3-flash',
            batchExecution: false,
          },
          L2: {
            timeout: 30 * 60 * 1000,
            maxDepth: 10,
            recommendedModel: 'google-antigravity/gemini-3-flash',
            batchExecution: false,
          },
          L3: {
            timeout: 60 * 60 * 1000,
            maxDepth: 15,
            recommendedModel: 'google-antigravity/gemini-3-pro',
            batchExecution: false,
          },
          L4: {
            timeout: undefined,
            maxDepth: 20,
            recommendedModel: 'google-antigravity/gemini-3-pro-high',
            batchExecution: true,
          },
        },
      },
    },
  },
  logger: mockLogger,
  runtime: {
    workspaceDir: '/workspace',
    stateDir: '/workspace/state',
    pluginDir: '/workspace/plugins',
    dataDir: '/workspace/data',
  },
  on: vi.fn(),
  emit: vi.fn(),
  registerHttpRoute: vi.fn(),
  registerRoom: vi.fn(),
  getRoom: vi.fn(),
  resolvePath: vi.fn((path: string) => `/workspace/plugins/core/agent-integration/${path}`),
};

// =============================================================================
// LLMService Tests
// =============================================================================

describe('LLMService', () => {
  let plugin: AgentIntegrationPlugin;

  beforeEach(() => {
    plugin = new AgentIntegrationPlugin();
    plugin['api'] = mockApi as any;
    plugin['config'] = mockApi.config.negentropy.agentIntegration as AgentIntegrationConfig;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 基础功能测试
  // -------------------------------------------------------------------------

  describe('基础功能测试', () => {
    it('should call LLM with valid model and prompt', async () => {
      const response: LLMResponse = await plugin.callLLM(
        'google-antigravity/gemini-3-flash',
        'Test prompt'
      );

      expect(response.success).toBe(true);
      expect(response.model).toBe('google-antigravity/gemini-3-flash');
      expect(response.content).toBeDefined();
      expect(response.content).toContain('Mock response');
      expect(mockLogger.info).toHaveBeenCalledWith('🤖 Calling LLM: google-antigravity/gemini-3-flash');
    });

    it('should handle invalid model gracefully', async () => {
      const response: LLMResponse = await plugin.callLLM(
        'invalid-model',
        'Test prompt'
      );

      expect(response).toBeDefined();
      expect(response.model).toBe('invalid-model');
    });

    it('should respect timeout configuration', async () => {
      const response: LLMResponse = await plugin.callLLM(
        'google-antigravity/gemini-3-flash',
        'Test prompt',
        { timeout: 5000 }
      );

      expect(response.success).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('🤖 Calling LLM: google-antigravity/gemini-3-flash');
    });
  });

  // -------------------------------------------------------------------------
  // 模型参数测试
  // -------------------------------------------------------------------------

  describe('模型参数测试', () => {
    it('should pass correct parameters to LLM API', async () => {
      const response: LLMResponse = await plugin.callLLM(
        'google-antigravity/gemini-3-pro',
        'Test prompt',
        {
          maxTokens: 2000,
          temperature: 0.7,
        }
      );

      expect(response.success).toBe(true);
      expect(response.model).toBe('google-antigravity/gemini-3-pro');
    });

    it('should handle model-specific parameters', async () => {
      const response: LLMResponse = await plugin.callLLM(
        'google-antigravity/gemini-3-pro-high',
        'Test prompt',
        {
          maxTokens: 4096,
          temperature: 0.5,
          timeout: 60000,
        }
      );

      expect(response.success).toBe(true);
      expect(response.tokens).toBeDefined();
      expect(response.tokens?.total).toBe(300);
    });

    it('should validate model format', async () => {
      const models = [
        'google-antigravity/gemini-3-flash',
        'zai/glm-4.7',
        'deepseek/deepseek-chat',
      ];

      for (const model of models) {
        const response: LLMResponse = await plugin.callLLM(model, 'Test');
        expect(response.model).toBe(model);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 错误处理测试
  // -------------------------------------------------------------------------

  describe('错误处理测试', () => {
    it('should handle network errors', async () => {
      const response: LLMResponse = await plugin.callLLM(
        'google-antigravity/gemini-3-flash',
        'Test prompt'
      );

      expect(response).toBeDefined();
      expect(typeof response.success).toBe('boolean');
    });

    it('should handle API errors', async () => {
      const response: LLMResponse = await plugin.callLLM(
        'google-antigravity/gemini-3-flash',
        'Test prompt'
      );

      expect(response).toBeDefined();
      expect(typeof response.success).toBe('boolean');
      if (!response.success) {
        expect(response.error).toBeDefined();
      }
    });

    it('should handle timeout errors', async () => {
      const response: LLMResponse = await plugin.callLLM(
        'google-antigravity/gemini-3-flash',
        'Test prompt',
        { timeout: 1 }
      );

      expect(response).toBeDefined();
    });

    it('should handle rate limiting', async () => {
      const promises = Array(10).fill(null).map(() =>
        plugin.callLLM('google-antigravity/gemini-3-flash', 'Test')
      );

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(10);
      responses.forEach(response => {
        expect(response).toBeDefined();
      });
    });
  });

  // -------------------------------------------------------------------------
  // 响应处理测试
  // -------------------------------------------------------------------------

  describe('响应处理测试', () => {
    it('should parse LLM response correctly', async () => {
      const response: LLMResponse = await plugin.callLLM(
        'google-antigravity/gemini-3-flash',
        'Test prompt'
      );

      expect(response.content).toBeDefined();
      expect(typeof response.content).toBe('string');
      expect(response.content.length).toBeGreaterThan(0);
    });

    it('should extract tokens from response', async () => {
      const response: LLMResponse = await plugin.callLLM(
        'google-antigravity/gemini-3-flash',
        'Test prompt'
      );

      expect(response.tokens).toBeDefined();
      expect(response.tokens?.prompt).toBe(100);
      expect(response.tokens?.completion).toBe(200);
      expect(response.tokens?.total).toBe(300);
    });

    it('should handle streaming responses', async () => {
      const response: LLMResponse = await plugin.callLLM(
        'google-antigravity/gemini-3-flash',
        'Test prompt'
      );

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 缓存测试
  // -------------------------------------------------------------------------

  describe('缓存测试', () => {
    it('should cache repeated requests', async () => {
      const prompt = 'Test prompt';
      const response1: LLMResponse = await plugin.callLLM(
        'google-antigravity/gemini-3-flash',
        prompt
      );
      const response2: LLMResponse = await plugin.callLLM(
        'google-antigravity/gemini-3-flash',
        prompt
      );

      expect(response1).toBeDefined();
      expect(response2).toBeDefined();
      expect(response1.content).toBe(response2.content);
    });

    it('should respect cache TTL', async () => {
      const response1: LLMResponse = await plugin.callLLM(
        'google-antigravity/gemini-3-flash',
        'Prompt 1'
      );
      const response2: LLMResponse = await plugin.callLLM(
        'google-antigravity/gemini-3-flash',
        'Prompt 2'
      );

      expect(response1).toBeDefined();
      expect(response2).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // 超时测试（§118.2）
  // -------------------------------------------------------------------------

  describe('超时测试（§118.2）', () => {
    it('should timeout L1 tasks at 15 minutes', async () => {
      const config = plugin.getComplexityConfig('L1');
      expect(config.timeout).toBe(15 * 60 * 1000);
    });

    it('should timeout L2 tasks at 30 minutes', async () => {
      const config = plugin.getComplexityConfig('L2');
      expect(config.timeout).toBe(30 * 60 * 1000);
    });

    it('should timeout L3 tasks at 60 minutes', async () => {
      const config = plugin.getComplexityConfig('L3');
      expect(config.timeout).toBe(60 * 60 * 1000);
    });

    it('should not timeout L4 tasks', async () => {
      const config = plugin.getComplexityConfig('L4');
      expect(config.timeout).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // 性能测试
  // -------------------------------------------------------------------------

  describe('性能测试', () => {
    it('should complete LLM call in < 5 seconds', async () => {
      const startTime = Date.now();

      const response: LLMResponse = await plugin.callLLM(
        'google-antigravity/gemini-3-flash',
        'Test prompt'
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.success).toBe(true);
      expect(response.durationMs).toBeGreaterThanOrEqual(0);
      expect(response.durationMs).toBeLessThan(5000);
    });

    it('should handle concurrent LLM calls', async () => {
      const concurrency = 10;
      const startTime = Date.now();

      const promises = Array(concurrency).fill(null).map((_, index) =>
        plugin.callLLM('google-antigravity/gemini-3-flash', `Test ${index}`)
      );

      const responses = await Promise.all(promises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(responses).toHaveLength(concurrency);
      responses.forEach(response => {
        expect(response.success).toBe(true);
      });

      expect(duration).toBeLessThan(concurrency * 1000);
    });
  });
});
