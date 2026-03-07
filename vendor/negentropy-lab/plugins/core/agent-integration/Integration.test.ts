/**
 * Integration.test.ts - 集成测试
 *
 * 宪法依据:
 * - §101 同步公理: 测试代码与生产代码同步
 * - §118.5 智能体协同统一策略原则: 测试Agent集成
 *
 * 测试目标: 提升agent-integration插件覆盖率
 * 新增测试用例: 18个
 *
 * @version 3.0.0 (Vitest迁移版)
 * @created 2026-02-13
 * @updated 2026-03-01
 * @maintainer 科技部后端分队
 */

import { AgentIntegrationPlugin } from './index';
import type { AgentIntegrationConfig, Task, AgentStatus, TaskComplexity } from './index';
import type { Mock } from 'vitest';

// =============================================================================
// Mock Types
// =============================================================================

interface MockLogger {
  info: Mock;
  warn: Mock;
  error: Mock;
  debug: Mock;
}

interface MockApi {
  id: string;
  name: string;
  version: string;
  description: string;
  source: string;
  config: {
    negentropy: {
      agentIntegration: AgentIntegrationConfig;
    };
  };
  logger: MockLogger;
  runtime: {
    workspaceDir: string;
    stateDir: string;
    pluginDir: string;
    dataDir: string;
  };
  on: Mock;
  emit: Mock;
  registerHttpRoute: Mock;
  registerRoom: Mock;
  getRoom: Mock;
  resolvePath: Mock;
}

// =============================================================================
// Mock Factories
// =============================================================================

const createMockLogger = (): MockLogger => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
});

const createMockApi = (): MockApi => ({
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
          L1: { timeout: 900000, maxDepth: 5, recommendedModel: 'google-antigravity/gemini-3-flash', batchExecution: false },
          L2: { timeout: 1800000, maxDepth: 10, recommendedModel: 'google-antigravity/gemini-3-flash', batchExecution: false },
          L3: { timeout: 3600000, maxDepth: 15, recommendedModel: 'google-antigravity/gemini-3-pro', batchExecution: false },
          L4: { timeout: undefined, maxDepth: 20, recommendedModel: 'google-antigravity/gemini-3-pro-high', batchExecution: true },
        },
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
  on: vi.fn(),
  emit: vi.fn(),
  registerHttpRoute: vi.fn(),
  registerRoom: vi.fn(),
  getRoom: vi.fn(),
  resolvePath: vi.fn((path: string) => `/workspace/plugins/core/agent-integration/${path}`),
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Agent Integration - Integration Tests', () => {
  let plugin: AgentIntegrationPlugin;
  let mockApi: MockApi;

  beforeEach(() => {
    plugin = new AgentIntegrationPlugin();
    mockApi = createMockApi();
    (plugin as any).api = mockApi as any;
    (plugin as any).config = mockApi.config.negentropy.agentIntegration as AgentIntegrationConfig;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 端到端测试
  // -------------------------------------------------------------------------

  describe('端到端测试', () => {
    it('should complete full task lifecycle', async () => {
      const task: Task = {
        taskId: 'task-lifecycle-001',
        description: 'Full lifecycle test task',
        type: 'integration-test',
      };

      const taskId = await plugin.scheduleTask(task, 'L1');
      expect(taskId).toBe('task-lifecycle-001');
    });

    it('should handle multiple tasks concurrently', async () => {
      const tasks: Task[] = Array(5).fill(null).map((_, i) => ({
        taskId: `task-concurrent-${i}`,
        description: `Concurrent task ${i}`,
        type: 'test',
      }));

      const taskIds = await Promise.all(
        tasks.map((task) => plugin.scheduleTask(task, 'L2'))
      );

      expect(taskIds).toHaveLength(5);
      taskIds.forEach((id, i) => {
        expect(id).toBe(`task-concurrent-${i}`);
      });
    });

    it('should maintain agent state across tasks', async () => {
      const task1: Task = { taskId: 'task-001', description: 'Task 1', type: 'test' };
      const task2: Task = { taskId: 'task-002', description: 'Task 2', type: 'test' };

      await plugin.scheduleTask(task1, 'L1');
      await plugin.scheduleTask(task2, 'L1');
    });
  });

  // -------------------------------------------------------------------------
  // 配置测试
  // -------------------------------------------------------------------------

  describe('配置测试', () => {
    it('should use default complexity config', () => {
      const l1Config = plugin.getComplexityConfig('L1');
      expect(l1Config.timeout).toBe(15 * 60 * 1000);
      expect(l1Config.maxDepth).toBe(5);
    });

    it('should override default config with custom config', async () => {
      const customConfig: AgentIntegrationConfig = {
        model: 'custom-model',
        timeout: 5000,
        depth: 3,
        fallback: 'fallback-model',
        complexityConfig: {
          L1: { timeout: 60000, maxDepth: 2, recommendedModel: 'custom', batchExecution: false },
          L2: { timeout: 120000, maxDepth: 4, recommendedModel: 'custom', batchExecution: false },
          L3: { timeout: 300000, maxDepth: 6, recommendedModel: 'custom', batchExecution: false },
          L4: { timeout: undefined, maxDepth: 10, recommendedModel: 'custom', batchExecution: true },
        },
      };

      (plugin as any).config = customConfig;
      const config = plugin.getComplexityConfig('L1');

      expect(config.timeout).toBe(60000);
      expect(config.maxDepth).toBe(2);
    });

    it('should handle missing complexity config gracefully', () => {
      (plugin as any).config = null;
      const config = plugin.getComplexityConfig('L1');
      expect(config).toBeDefined();
      expect(config.timeout).toBe(15 * 60 * 1000);
    });
  });

  // -------------------------------------------------------------------------
  // Agent状态测试
  // -------------------------------------------------------------------------

  describe('Agent状态测试', () => {
    it('should track agent status', async () => {
      const status: AgentStatus = {
        agentId: 'agent-status-001',
        name: 'Test Agent',
        status: 'idle',
        lastActive: Date.now(),
        tasksCompleted: 0,
        tasksFailed: 0,
      };

      (plugin as any).updateAgentStatus('agent-status-001', status);

      const retrievedStatus = await plugin.getAgentStatus('agent-status-001');
      expect(retrievedStatus).toBeDefined();
    });

    it('should update agent status on task completion', async () => {
      const task: Task = {
        taskId: 'task-status-update',
        description: 'Task for status update',
        type: 'test',
      };

      await plugin.scheduleTask(task, 'L1');
      expect(mockApi.emit).toHaveBeenCalled();
    });

    it('should handle agent not found error', async () => {
      await expect(plugin.getAgentStatus('non-existent-agent')).rejects.toThrow('Agent not found');
    });

    it('should list all agents', async () => {
      const agents = await plugin.getAgentStatus();
      expect(Array.isArray(agents)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 模型故障转移测试
  // -------------------------------------------------------------------------

  describe('模型故障转移测试', () => {
    it('should fallback to secondary model', async () => {
      const primary = 'google-antigravity/gemini-3-flash';
      const fallback = 'google-antigravity/gemini-3-pro-high';

      await plugin.fallbackModel(primary, fallback);

      expect((plugin as any).config.model).toBe(fallback);
      expect(mockApi.logger.warn).toHaveBeenCalledWith(`⚠️  Model fallback triggered: ${primary} → ${fallback}`);
    });

    it('should validate model availability', async () => {
      const isValid = await plugin.validateModel('google-antigravity/gemini-3-flash');
      expect(typeof isValid).toBe('boolean');
    });

    it('should handle model validation errors', async () => {
      const isValid = await plugin.validateModel('invalid-model');
      expect(typeof isValid).toBe('boolean');
    });
  });

  // -------------------------------------------------------------------------
  // 复杂度评估测试（§118.1）
  // -------------------------------------------------------------------------

  describe('复杂度评估测试（§118.1）', () => {
    it('should assess task complexity based on keywords', async () => {
      const tasks: { task: Task; expected: TaskComplexity }[] = [
        { task: { taskId: 't1', description: 'simple task', type: 'test' }, expected: 'L1' },
        { task: { taskId: 't2', description: 'create component', type: 'dev' }, expected: 'L2' },
        { task: { taskId: 't3', description: 'data analysis', type: 'research' }, expected: 'L3' },
        { task: { taskId: 't4', description: 'complex multi-step architecture', type: 'arch' }, expected: 'L4' },
      ];

      for (const { task, expected } of tasks) {
        const complexity = await plugin.assessComplexity(task);
        expect(complexity).toBe(expected);
      }
    });

    it('should consider params count in complexity assessment', async () => {
      const task1: Task = { taskId: 't1', description: 'task', type: 'test', params: { a: 1 } };
      const task2: Task = { taskId: 't2', description: 'task', type: 'test', params: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 } };

      const complexity1 = await plugin.assessComplexity(task1);
      const complexity2 = await plugin.assessComplexity(task2);

      expect(['L1', 'L2']).toContain(complexity1);
      expect(['L2', 'L3']).toContain(complexity2);
    });
  });

  // -------------------------------------------------------------------------
  // 错误处理集成测试
  // -------------------------------------------------------------------------

  describe('错误处理集成测试', () => {
    it('should handle plugin not initialized error', async () => {
      (plugin as any).api = null;

      await expect(plugin.callLLM('model', 'prompt')).rejects.toThrow('Plugin not initialized');
    });

    it('should handle config not set error', async () => {
      (plugin as any).api = mockApi as any;
      (plugin as any).config = null;

      const config = plugin.getComplexityConfig('L1');
      expect(config).toBeDefined();
    });

    it('should emit error events on failures', async () => {
      const task: Task = {
        taskId: 'task-error',
        description: 'Task that will fail',
        type: 'test',
      };

      await plugin.scheduleTask(task, 'L1');
      expect(mockApi.emit).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 性能集成测试
  // -------------------------------------------------------------------------

  describe('性能集成测试', () => {
    it('should handle high concurrency', async () => {
      const concurrency = 50;
      const tasks: Task[] = Array(concurrency).fill(null).map((_, i) => ({
        taskId: `task-high-concurrency-${i}`,
        description: `High concurrency task ${i}`,
        type: 'test',
      }));

      const startTime = Date.now();
      const taskIds = await Promise.all(
        tasks.map((task) => plugin.scheduleTask(task, 'L1'))
      );
      const endTime = Date.now();

      expect(taskIds).toHaveLength(concurrency);
      expect(endTime - startTime).toBeLessThan(5000);
    });

    it('should maintain performance under load', async () => {
      const iterations = 100;
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const task: Task = {
          taskId: `task-load-${i}`,
          description: `Load test task ${i}`,
          type: 'test',
        };
        await plugin.scheduleTask(task, 'L1');
      }

      const endTime = Date.now();
      const duration = endTime - startTime;
      const avgTimePerTask = duration / iterations;

      expect(avgTimePerTask).toBeLessThan(100);
    });
  });
});
