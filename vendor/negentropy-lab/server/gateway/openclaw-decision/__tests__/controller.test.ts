/**
 * DecisionController 单元测试
 *
 * 宪法依据:
 * - §101 同步公理: 测试与实现同步
 * - §102 熵减原则: 集中测试逻辑
 * - §109 ToolCallBridge: 标准化决策测试
 */

import {
  DecisionController,
  getDecisionController,
  resetDecisionController,
  createDecisionController,
  DEFAULT_CONTROLLER_CONFIG,
} from '../controller';
import { generateTraceId } from '../contracts/decision-contract';

describe('DecisionController', () => {
  let controller: DecisionController;

  beforeEach(() => {
    resetDecisionController();
    controller = createDecisionController({
      serviceConfig: {
        mode: 'OFF',
        rules: [],
      },
    });
  });

  afterEach(() => {
    resetDecisionController();
  });

  describe('初始化', () => {
    it('应该使用默认配置创建控制器', () => {
      const defaultController = createDecisionController(DEFAULT_CONTROLLER_CONFIG);
      expect(defaultController).toBeDefined();
    });

    it('应该使用自定义配置创建控制器', () => {
      const customController = createDecisionController({
        serviceConfig: {
          mode: 'SHADOW',
          rules: [],
        },
        enableAuditLog: false,
        timeout: 10000,
      });

      expect(customController.getMode()).toBe('SHADOW');
    });
  });

  describe('getMode/setMode', () => {
    it('应该返回当前模式', () => {
      expect(controller.getMode()).toBe('OFF');
    });

    it('应该能够切换模式', () => {
      controller.setMode('SHADOW');
      expect(controller.getMode()).toBe('SHADOW');

      controller.setMode('ENFORCE');
      expect(controller.getMode()).toBe('ENFORCE');

      controller.setMode('OFF');
      expect(controller.getMode()).toBe('OFF');
    });
  });

  describe('healthCheck', () => {
    it('应该返回健康状态', async () => {
      const health = await controller.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.mode).toBe('OFF');
      expect(health.timestamp).toBeDefined();
    });
  });

  describe('handleDecision', () => {
    it('在 OFF 模式下应该放行所有请求', async () => {
      controller.setMode('OFF');

      const request = {
        traceId: generateTraceId(),
        transport: 'ws' as const,
        method: 'test.method',
        params: {},
        ts: new Date().toISOString(),
      };

      const decision = await controller.handleDecision(request);
      expect(decision.action).toBe('EXECUTE');
    });

    it('应该拒绝无效请求', async () => {
      const decision = await controller.handleDecision({} as any);
      expect(decision.action).toBe('REJECT');
    });

    it('应该拒绝缺少 method 的请求', async () => {
      const decision = await controller.handleDecision({
        traceId: generateTraceId(),
        transport: 'ws' as const,
        params: {},
        ts: new Date().toISOString(),
      } as any);

      expect(decision.action).toBe('REJECT');
    });
  });

  describe('getRouter', () => {
    it('应该返回 Express Router', () => {
      const router = controller.getRouter();
      expect(router).toBeDefined();
    });
  });

  describe('单例管理', () => {
    it('getDecisionController 应该返回单例', () => {
      resetDecisionController();
      const instance1 = getDecisionController();
      const instance2 = getDecisionController();

      expect(instance1).toBe(instance2);
    });

    it('resetDecisionController 应该重置单例', () => {
      const instance1 = getDecisionController();
      instance1.setMode('SHADOW');

      resetDecisionController();

      const instance2 = getDecisionController();
      expect(instance2.getMode()).toBe('OFF');
    });

    it('createDecisionController 应该创建新实例', () => {
      const instance1 = createDecisionController(DEFAULT_CONTROLLER_CONFIG);
      const instance2 = createDecisionController(DEFAULT_CONTROLLER_CONFIG);

      expect(instance1).not.toBe(instance2);
    });
  });
});