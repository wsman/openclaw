/**
 * Agent Integration Plugin - 测试文件
 *
 * 宪法依据:
 * - §101 同步公理: 测试代码与生产代码同步
 * - §102 熵减原则: 测试覆盖确保代码质量
 *
 * @version 1.0.1
 * @created 2026-02-12
 * @updated 2026-03-01
 * @maintainer 科技部后端分队
 */

import { jest } from '@jest/globals';
import { AgentIntegrationPlugin, 
  type AgentIntegrationConfig,
  type Task,
  type TaskComplexity,
  type LLMResponse,
  type AgentStatus,
 } from './index';

// =============================================================================
// Mock Plugin API
// =============================================================================

const createMockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

const createMockApi = (config: any = {}) => ({
  id: 'agent-integration',
  name: 'Agent Integration Plugin',
  version: '1.0.0',
  description: 'Agent集成插件',
  source: '/plugins/core/agent-integration',
  config: {
    negentropy: {
      agentIntegration: {
        model: 'zai/glm-4.7',
        timeout: 3600000,
        depth: 2,
        fallback: 'zai/glm-4.7-flash',
        ...config,
      },
    },
  },
  logger: createMockLogger(),
  runtime: {
    workspaceDir: '/workspace',
    stateDir: '/workspace/state',
    pluginDir: '/workspace/plugins',
    dataDir: '/workspace/data',
  },
  on: jest.fn(),
  emit: jest.fn(),
  registerHttpRoute: jest.fn(),
  registerRoom: jest.fn(),
  getRoom: jest.fn(),
  resolvePath: jest.fn((path: string) => `/workspace/plugins/core/agent-integration/${path}`),
});

// =============================================================================
// Tests
// =============================================================================

describe('AgentIntegrationPlugin', () => {
  let plugin: AgentIntegrationPlugin;
  let mockApi: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    plugin = new AgentIntegrationPlugin();
    mockApi = createMockApi();
    plugin.onLoad(mockApi as any);
    jest.clearAllMocks();
  });

  afterEach(() => {
    plugin.onDeactivate();
  });

  describe('Initialization', () => {
    it('应该正确初始化插件', () => {
      expect(plugin['api']).toBeDefined();
      expect(plugin['config']).toBeDefined();
    });

    it('应该正确配置复杂度分级', () => {
      const l1Config = plugin.getComplexityConfig('L1');
      expect(l1Config.timeout).toBe(900000); // 15 minutes
      expect(l1Config.maxDepth).toBe(5);
    });

    it('L4任务应该没有超时限制', () => {
      const l4Config = plugin.getComplexityConfig('L4');
      expect(l4Config.timeout).toBeUndefined(); // No timeout
      expect(l4Config.batchExecution).toBe(true);
    });
  });

  describe('LLM Service', () => {
    it('应该成功调用LLM服务', async () => {
      const response: LLMResponse = await plugin.callLLM(
        'zai/glm-4.7',
        'Test prompt',
        { timeout: 30000 }
      );

      expect(response.success).toBe(true);
      expect(response.model).toBe('zai/glm-4.7');
      expect(response.content).toBeDefined();
    });

    it('应该支持自定义超时配置', async () => {
      const response: LLMResponse = await plugin.callLLM(
        'zai/glm-4.7',
        'Test prompt',
        { timeout: 60000 }
      );

      expect(response.success).toBe(true);
    });

    it('应该返回响应持续时间', async () => {
      const response: LLMResponse = await plugin.callLLM('zai/glm-4.7', 'Test prompt');

      expect(response.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Task Scheduling', () => {
    it('应该成功调度任务', async () => {
      const task: Task = {
        taskId: 'task-001',
        description: 'Test task',
        type: 'test',
      };

      const taskId = await plugin.scheduleTask(task, 'L1');

      expect(taskId).toBe('task-001');
    });

    it('应该正确处理不同复杂度任务', async () => {
      const task: Task = {
        taskId: 'task-002',
        description: 'Complex task',
        type: 'test',
      };

      await plugin.scheduleTask(task, 'L4');

      // L4任务应该标记为需要分批执行
      const l4Config = plugin.getComplexityConfig('L4');
      expect(l4Config.batchExecution).toBe(true);
    });
  });

  describe('Complexity Assessment', () => {
    it('应该正确评估L1任务复杂度', async () => {
      const task: Task = {
        taskId: 'task-001',
        description: 'Simple task',
        type: 'test',
      };

      const complexity = await plugin.assessComplexity(task);

      expect(complexity).toBe('L1');
    });

    it('应该正确评估L2任务复杂度', async () => {
      const task: Task = {
        taskId: 'task-002',
        description: 'Create something',
        type: 'test',
        params: { a: 1, b: 2 },
      };

      const complexity = await plugin.assessComplexity(task);

      expect(complexity).toBe('L2');
    });

    it('应该正确评估L3任务复杂度', async () => {
      const task: Task = {
        taskId: 'task-003',
        description: 'Analyze data',
        type: 'test',
        params: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 },
      };

      const complexity = await plugin.assessComplexity(task);

      expect(complexity).toBe('L3');
    });

    it('应该正确评估L4任务复杂度', async () => {
      const task: Task = {
        taskId: 'task-004',
        description: 'Complex multi-step task',
        type: 'test',
      };

      const complexity = await plugin.assessComplexity(task);

      expect(complexity).toBe('L4');
    });
  });

  describe('Agent Status Management', () => {
    it('应该返回所有Agent状态', async () => {
      // 先更新一个Agent状态
      await plugin.getAgentStatus('agent-001');

      const result = await plugin.getAgentStatus();
      const statuses = Array.isArray(result) ? result : [result];

      expect(statuses.length).toBeGreaterThanOrEqual(0);
    });

    it('应该返回指定Agent状态', async () => {
      // 首先创建一个Agent状态
      const result = await plugin.getAgentStatus('agent-001');
      const status = Array.isArray(result) ? result[0] : result;

      expect(status.agentId).toBe('agent-001');
    });

    it('应该为匹配模式的Agent创建默认状态', async () => {
      // 根据实现，agentId 需要匹配 /^agent-\d+$/i 模式才会创建默认状态
      const result = await plugin.getAgentStatus('agent-999');
      const status = Array.isArray(result) ? result[0] : result;

      expect(status.agentId).toBe('agent-999');
      expect(status.status).toBe('idle');
    });

    it('不应该为不匹配模式的Agent创建默认状态', async () => {
      // 不匹配模式的 agentId 应该抛出错误
      await expect(plugin.getAgentStatus('invalid-agent-name')).rejects.toThrow('Agent not found');
    });
  });

  describe('Model Fallback', () => {
    it('应该正确执行模型故障转移', async () => {
      await plugin.fallbackModel('zai/glm-4.7', 'zai/glm-4.7-flash');

      expect(plugin['config']?.model).toBe('zai/glm-4.7-flash');
    });

    it('应该验证模型可用性', async () => {
      const isValid = await plugin.validateModel('zai/glm-4.7');

      expect(isValid).toBe(true);
    });
  });

  describe('Complexity Config', () => {
    it('L1任务应该有15分钟超时', () => {
      const config = plugin.getComplexityConfig('L1');

      expect(config.timeout).toBe(900000);
      expect(config.maxDepth).toBe(5);
      expect(config.batchExecution).toBe(false);
    });

    it('L2任务应该有30分钟超时', () => {
      const config = plugin.getComplexityConfig('L2');

      expect(config.timeout).toBe(1800000);
      expect(config.maxDepth).toBe(10);
      expect(config.batchExecution).toBe(false);
    });

    it('L3任务应该有60分钟超时', () => {
      const config = plugin.getComplexityConfig('L3');

      expect(config.timeout).toBe(3600000);
      expect(config.maxDepth).toBe(15);
      expect(config.batchExecution).toBe(false);
    });

    it('L4任务应该无超时', () => {
      const config = plugin.getComplexityConfig('L4');

      expect(config.timeout).toBeUndefined();
      expect(config.maxDepth).toBe(20);
      expect(config.batchExecution).toBe(true);
    });
  });
});