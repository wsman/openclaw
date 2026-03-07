/**
 * OpenClawBridge 单元测试
 *
 * 宪法依据:
 * - §101 同步公理: 测试与实现同步
 * - §102 熵减原则: 集中测试逻辑
 * - §109 ToolCallBridge: 标准化桥接测试
 */

import {
  OpenClawBridge,
  getOpenClawBridge,
  resetOpenClawBridge,
  createOpenClawBridge,
} from '../bridge/openclaw-bridge';

describe('OpenClawBridge', () => {
  let bridge: OpenClawBridge;

  beforeEach(() => {
    bridge = createOpenClawBridge({ decisionEnabled: false });
  });

  afterEach(() => {
    bridge.handleDisconnect('test-conn');
    resetOpenClawBridge();
  });

  describe('初始化', () => {
    it('应该使用默认配置创建桥接器', () => {
      const defaultBridge = createOpenClawBridge();
      const config = defaultBridge.getConfig();

      expect(config.decisionEnabled).toBe(false);
      expect(config.sessionTimeout).toBe(300000);
      expect(config.nonceLength).toBe(32);
    });

    it('应该使用自定义配置创建桥接器', () => {
      const customBridge = createOpenClawBridge({
        decisionEnabled: true,
        sessionTimeout: 60000,
        nonceLength: 16,
      });
      const config = customBridge.getConfig();

      expect(config.decisionEnabled).toBe(true);
      expect(config.sessionTimeout).toBe(60000);
      expect(config.nonceLength).toBe(16);
    });
  });

  describe('handleConnection', () => {
    it('应该创建新会话并返回挑战', () => {
      const event = bridge.handleConnection('conn-1');

      expect(event.event).toBe('connect.challenge');
      expect(event.payload.nonce).toBeDefined();
      expect(event.payload.nonce.length).toBe(32);
    });

    it('应该为不同连接创建不同的 nonce', () => {
      const event1 = bridge.handleConnection('conn-1');
      const event2 = bridge.handleConnection('conn-2');

      expect(event1.payload.nonce).not.toBe(event2.payload.nonce);
    });
  });

  describe('handleHello', () => {
    it('应该在 nonce 匹配时认证成功', () => {
      const connectEvent = bridge.handleConnection('conn-1');
      const helloEvent = bridge.handleHello('conn-1', {
        nonce: connectEvent.payload.nonce,
      });

      expect(helloEvent.event).toBe('hello-ok');
      expect(helloEvent.payload.authenticated).toBe(true);
    });

    it('应该在 nonce 不匹配时认证失败', () => {
      bridge.handleConnection('conn-1');
      const helloEvent = bridge.handleHello('conn-1', { nonce: 'wrong-nonce' });

      expect(helloEvent.event).toBe('hello-error');
      expect(helloEvent.payload.reason).toBe('Invalid nonce');
    });

    it('应该在会话不存在时返回错误', () => {
      const helloEvent = bridge.handleHello('unknown-conn', { nonce: 'any' });

      expect(helloEvent.event).toBe('hello-error');
      expect(helloEvent.payload.reason).toBe('Session not found');
    });
  });

  describe('handleRequest', () => {
    it('应该通过未认证会话的请求', async () => {
      bridge.handleConnection('conn-1');

      const response = await bridge.handleRequest('conn-1', {
        id: 'req-1',
        method: 'test.method',
        params: { foo: 'bar' },
      });

      expect(response.id).toBe('req-1');
      expect(response.result).toBeDefined();
      expect(response.result._passed).toBe(true);
    });

    it('应该在会话不存在时返回错误', async () => {
      const response = await bridge.handleRequest('unknown-conn', {
        id: 'req-1',
        method: 'test.method',
        params: {},
      });

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32000);
    });
  });

  describe('handleDisconnect', () => {
    it('应该删除会话', () => {
      bridge.handleConnection('conn-1');
      bridge.handleDisconnect('conn-1');

      const session = bridge.getSession('conn-1');
      expect(session).toBeUndefined();
    });
  });

  describe('getSession', () => {
    it('应该返回存在的会话', () => {
      bridge.handleConnection('conn-1');
      const session = bridge.getSession('conn-1');

      expect(session).toBeDefined();
      expect(session?.connId).toBe('conn-1');
      expect(session?.authenticated).toBe(false);
    });

    it('应该对不存在的会话返回 undefined', () => {
      const session = bridge.getSession('unknown');
      expect(session).toBeUndefined();
    });
  });

  describe('getAllSessions', () => {
    it('应该返回所有会话', () => {
      bridge.handleConnection('conn-1');
      bridge.handleConnection('conn-2');
      bridge.handleConnection('conn-3');

      const sessions = bridge.getAllSessions();
      expect(sessions.length).toBe(3);
    });

    it('应该在断开连接后返回正确的会话数', () => {
      bridge.handleConnection('conn-1');
      bridge.handleConnection('conn-2');
      bridge.handleDisconnect('conn-1');

      const sessions = bridge.getAllSessions();
      expect(sessions.length).toBe(1);
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('应该清理过期会话', async () => {
      // 创建一个短超时的桥接器
      const shortTimeoutBridge = createOpenClawBridge({
        sessionTimeout: 100, // 100ms
      });

      shortTimeoutBridge.handleConnection('conn-1');

      // 等待超时
      await new Promise((resolve) => setTimeout(resolve, 150));

      const cleaned = shortTimeoutBridge.cleanupExpiredSessions();
      expect(cleaned).toBe(1);

      const session = shortTimeoutBridge.getSession('conn-1');
      expect(session).toBeUndefined();
    });
  });

  describe('setDecisionEnabled', () => {
    it('应该更新决策启用状态', () => {
      bridge.setDecisionEnabled(true);
      const config = bridge.getConfig();

      expect(config.decisionEnabled).toBe(true);
    });
  });

  describe('单例管理', () => {
    it('getOpenClawBridge 应该返回单例', () => {
      resetOpenClawBridge();
      const instance1 = getOpenClawBridge();
      const instance2 = getOpenClawBridge();

      expect(instance1).toBe(instance2);
    });

    it('resetOpenClawBridge 应该重置单例', () => {
      const instance1 = getOpenClawBridge();
      instance1.setDecisionEnabled(true);

      resetOpenClawBridge();

      const instance2 = getOpenClawBridge();
      expect(instance2.getConfig().decisionEnabled).toBe(false);
    });

    it('createOpenClawBridge 应该创建新实例', () => {
      const instance1 = createOpenClawBridge();
      const instance2 = createOpenClawBridge();

      expect(instance1).not.toBe(instance2);
    });
  });
});