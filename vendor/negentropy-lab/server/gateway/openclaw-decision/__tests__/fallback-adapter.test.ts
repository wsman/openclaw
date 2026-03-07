/**
 * FallbackAdapter 单元测试
 *
 * 宪法依据:
 * - §101 同步公理: 测试与实现同步
 * - §102 熵减原则: 集中测试逻辑
 * - §109 ToolCallBridge: 弹性保护测试
 */

import {
  FallbackAdapter,
  getFallbackAdapter,
  resetFallbackAdapter,
  createFallbackAdapter,
} from '../resilience/fallback-adapter';
import { generateTraceId } from '../contracts/decision-contract';

describe('FallbackAdapter', () => {
  let adapter: FallbackAdapter;

  beforeEach(() => {
    adapter = createFallbackAdapter({ enabled: true });
  });

  afterEach(() => {
    adapter.reset();
  });

  describe('初始化', () => {
    it('应该使用默认配置创建适配器', () => {
      const defaultAdapter = createFallbackAdapter();
      expect(defaultAdapter.shouldFallback()).toBe(false);
    });

    it('应该使用自定义配置创建适配器', () => {
      const customAdapter = createFallbackAdapter({
        enabled: true,
        fallbackReason: 'Custom reason',
      });
      expect(customAdapter.shouldFallback()).toBe(true);
    });
  });

  describe('shouldFallback', () => {
    it('启用时应返回 true', () => {
      adapter.setEnabled(true);
      expect(adapter.shouldFallback()).toBe(true);
    });

    it('禁用时应返回 false', () => {
      adapter.setEnabled(false);
      expect(adapter.shouldFallback()).toBe(false);
    });
  });

  describe('executeFallback', () => {
    it('应该返回 EXECUTE 动作', () => {
      const request = {
        traceId: generateTraceId(),
        transport: 'ws' as const,
        method: 'test.method',
        params: {},
        ts: new Date().toISOString(),
      };

      const response = adapter.executeFallback(request);

      expect(response.action).toBe('EXECUTE');
      expect(response.traceId).toBe(request.traceId);
      expect(response.reason).toBeDefined();
    });

    it('应该增加回退计数', () => {
      const request = {
        traceId: generateTraceId(),
        transport: 'ws' as const,
        method: 'test.method',
        params: {},
        ts: new Date().toISOString(),
      };

      adapter.executeFallback(request);
      adapter.executeFallback(request);

      const stats = adapter.getStats();
      expect(stats.fallbackCount).toBe(2);
    });

    it('应该更新最后回退时间', () => {
      const request = {
        traceId: generateTraceId(),
        transport: 'ws' as const,
        method: 'test.method',
        params: {},
        ts: new Date().toISOString(),
      };

      adapter.executeFallback(request);

      const stats = adapter.getStats();
      expect(stats.lastFallbackTime).toBeDefined();
      expect(stats.lastFallbackTime).toBeGreaterThan(0);
    });
  });

  describe('getStats', () => {
    it('应该返回正确的统计信息', () => {
      adapter.setEnabled(true);
      const stats = adapter.getStats();

      expect(stats.enabled).toBe(true);
      expect(stats.fallbackCount).toBe(0);
      expect(stats.lastFallbackTime).toBeUndefined();
    });
  });

  describe('reset', () => {
    it('应该重置所有统计', () => {
      const request = {
        traceId: generateTraceId(),
        transport: 'ws' as const,
        method: 'test.method',
        params: {},
        ts: new Date().toISOString(),
      };

      adapter.executeFallback(request);
      adapter.reset();

      const stats = adapter.getStats();
      expect(stats.fallbackCount).toBe(0);
      expect(stats.lastFallbackTime).toBeUndefined();
    });
  });

  describe('setEnabled', () => {
    it('应该更新启用状态', () => {
      adapter.setEnabled(false);
      expect(adapter.shouldFallback()).toBe(false);

      adapter.setEnabled(true);
      expect(adapter.shouldFallback()).toBe(true);
    });
  });

  describe('单例管理', () => {
    it('getFallbackAdapter 应该返回单例', () => {
      resetFallbackAdapter();
      const instance1 = getFallbackAdapter();
      const instance2 = getFallbackAdapter();

      expect(instance1).toBe(instance2);
    });

    it('resetFallbackAdapter 应该重置单例', () => {
      const instance1 = getFallbackAdapter();
      instance1.setEnabled(true);

      resetFallbackAdapter();

      const instance2 = getFallbackAdapter();
      expect(instance2.shouldFallback()).toBe(false);
    });

    it('createFallbackAdapter 应该创建新实例', () => {
      const instance1 = createFallbackAdapter();
      const instance2 = createFallbackAdapter();

      expect(instance1).not.toBe(instance2);
    });
  });
});