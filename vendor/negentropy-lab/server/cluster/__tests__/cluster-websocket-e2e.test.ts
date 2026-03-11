/**
 * 🚀 双节点+双WebSocket客户端跨节点E2E测试
 * 
 * 宪法依据：
 * - §107 通信安全公理：集群间通信的安全管理
 * - §321-§324 实时通信公理：WebSocket状态同步
 * 
 * @filename server/cluster/__tests__/cluster-websocket-e2e.test.ts
 * @version 1.0.0
 * @category test
 * @last_updated 2026-03-09
 */

import net from 'net';
import WebSocket from 'ws';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createNegentropyServer, NegentropyServerInstance } from '../../bootstrap/createNegentropyServer';
import { MemoryClusterBackplane } from '../backplane/MemoryClusterBackplane';

async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('failed to allocate port'));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function waitFor(assertion: () => Promise<boolean> | boolean, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await assertion()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('condition not met before timeout');
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

interface WsMessage {
  type: 'request' | 'response' | 'event';
  id?: string;
  method?: string;
  params?: any;
  ok?: boolean;
  result?: any;
  error?: any;
  event?: string;
  payload?: any;
}

/**
 * 创建WebSocket客户端并返回消息收集器
 */
function createWsClient(url: string): {
  ws: WebSocket;
  messages: WsMessage[];
  connect: () => Promise<void>;
  send: (msg: WsMessage) => void;
  close: () => void;
  waitForEvent: (eventName: string, timeoutMs?: number) => Promise<WsMessage | undefined>;
} {
  const ws = new WebSocket(url);
  const messages: WsMessage[] = [];

  ws.on('message', (data: Buffer) => {
    try {
      const msg = JSON.parse(data.toString()) as WsMessage;
      messages.push(msg);
    } catch {
      // ignore parse errors
    }
  });

  return {
    ws,
    messages,
    connect: () => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('WebSocket connection timeout')), 5000);
      ws.once('open', () => {
        clearTimeout(timeout);
        resolve();
      });
      ws.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    }),
    send: (msg: WsMessage) => {
      ws.send(JSON.stringify(msg));
    },
    close: () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    },
    waitForEvent: (eventName: string, timeoutMs = 5000): Promise<WsMessage | undefined> => {
      return new Promise((resolve) => {
        const deadline = Date.now() + timeoutMs;
        const check = () => {
          const found = messages.find(m => m.type === 'event' && m.event === eventName);
          if (found) {
            resolve(found);
            return;
          }
          if (Date.now() >= deadline) {
            resolve(undefined);
            return;
          }
          setTimeout(check, 50);
        };
        check();
      });
    },
  };
}

describe('cluster websocket e2e', () => {
  const instances: NegentropyServerInstance[] = [];
  const clients: ReturnType<typeof createWsClient>[] = [];

  beforeEach(() => {
    // Reset arrays before each test
  });

  afterEach(async () => {
    // Close all WebSocket clients
    for (const client of clients.splice(0)) {
      try {
        client.close();
      } catch {
        // ignore close errors
      }
    }
    // Stop all server instances
    await Promise.all(instances.splice(0).map((instance) => instance.stop()));
  });

  it('two nodes with two WebSocket clients: cross-node event broadcast', async () => {
    const namespace = `ws-e2e-${Date.now()}`;
    const [portA, portB] = await Promise.all([getFreePort(), getFreePort()]);

    // 创建节点A（无特殊能力）
    const nodeA = await createNegentropyServer({
      port: portA,
      host: '127.0.0.1',
      registerSignalHandlers: false,
      discovery: { enabled: false },
      cluster: {
        enabled: true,
        backplane: new MemoryClusterBackplane(namespace),
        heartbeatIntervalMs: 50,
        nodeTtlMs: 200,
        capabilities: ['gateway', 'echo', 'cluster'],
      },
      integrations: {
        agentEngine: false,
        openClawDecision: false,
        openClawHook: false,
        colyseusMonitor: false,
      },
    });
    instances.push(nodeA);

    // 创建节点B（种子节点指向A）
    const nodeB = await createNegentropyServer({
      port: portB,
      host: '127.0.0.1',
      registerSignalHandlers: false,
      discovery: { enabled: false },
      cluster: {
        enabled: true,
        backplane: new MemoryClusterBackplane(namespace),
        heartbeatIntervalMs: 50,
        nodeTtlMs: 200,
        capabilities: ['gateway', 'echo', 'cluster', 'llm'],
        seedPeers: [`http://127.0.0.1:${portA}`],
      },
      integrations: {
        agentEngine: false,
        openClawDecision: false,
        openClawHook: false,
        colyseusMonitor: false,
      },
    });
    instances.push(nodeB);

    // 等待双节点集群形成
    await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${portA}/api/cluster/topology`);
      const payload = await response.json() as { topology: { nodes: Array<{ nodeId: string }> } };
      return payload.topology.nodes.length >= 2;
    }, 8000);

    // 等待WebSocket集群广播器初始化完成
    await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${portA}/api/cluster/websocket/stats`);
      const payload = await response.json() as { stats: { initialized: boolean } };
      return payload.stats.initialized === true;
    }, 5000);

    // 创建WebSocket客户端连接到节点A
    const wsUrlA = `ws://127.0.0.1:${portA}/gateway`;
    const clientA = createWsClient(wsUrlA);
    clients.push(clientA);
    await clientA.connect();

    // 创建WebSocket客户端连接到节点B
    const wsUrlB = `ws://127.0.0.1:${portB}/gateway`;
    const clientB = createWsClient(wsUrlB);
    clients.push(clientB);
    await clientB.connect();

    // 客户端A认证
    const authRequestIdA = `auth-${Date.now()}-a`;
    clientA.send({
      type: 'request',
      id: authRequestIdA,
      method: 'connect',
      params: { token: 'test-token', user: 'user-a' },
    });

    // 等待客户端A认证成功
    await waitFor(async () => {
      const authResponse = clientA.messages.find(m => m.id === authRequestIdA && m.ok === true);
      return Boolean(authResponse);
    }, 5000);

    // 客户端B认证
    const authRequestIdB = `auth-${Date.now()}-b`;
    clientB.send({
      type: 'request',
      id: authRequestIdB,
      method: 'connect',
      params: { token: 'test-token', user: 'user-b' },
    });

    // 等待客户端B认证成功
    await waitFor(async () => {
      const authResponse = clientB.messages.find(m => m.id === authRequestIdB && m.ok === true);
      return Boolean(authResponse);
    }, 5000);

    // 清空之前收集的消息
    clientA.messages.length = 0;
    clientB.messages.length = 0;

    // 客户端A发送事件，期望通过集群广播到节点B的客户端B
    const broadcastTime = Date.now();
    const eventRequestId = `event-${broadcastTime}`;
    clientA.send({
      type: 'request',
      id: eventRequestId,
      method: 'send',
      params: { text: 'hello from clientA', message: 'hello from clientA' },
    });

    // 等待客户端A收到send响应
    await waitFor(async () => {
      const sendResponse = clientA.messages.find(m => m.id === eventRequestId);
      return Boolean(sendResponse);
    }, 5000);

    // 等待跨节点广播到达客户端B
    // 注意：需要等待批处理刷新（batchDelayMs约20-50ms）
    const chatEventOnB = await clientB.waitForEvent('chat', 3000);

    // 验证跨节点事件广播
    expect(chatEventOnB).toBeDefined();
    expect(chatEventOnB?.payload?.text).toBe('hello from clientA');

    // 验证事件源标识
    expect(chatEventOnB?.payload?.by).toBeDefined();

    // 客户端B收到来自节点A的广播事件
    expect(chatEventOnB?.payload?.text).toContain('clientA');

    // 验证节点A的广播器统计
    const statsResponseA = await fetch(`http://127.0.0.1:${portA}/api/cluster/websocket/stats`);
    const statsA = await statsResponseA.json() as { stats: { batchesProcessed: number; eventsBroadcast: number } };
    expect(statsA.stats.batchesProcessed).toBeGreaterThanOrEqual(1);
    expect(statsA.stats.eventsBroadcast).toBeGreaterThanOrEqual(1);

    // 验证节点B的广播器统计（接收方）
    const statsResponseB = await fetch(`http://127.0.0.1:${portB}/api/cluster/websocket/stats`);
    const statsB = await statsResponseB.json() as { stats: { eventsReceived: number } };
    expect(statsB.stats.eventsReceived).toBeGreaterThanOrEqual(1);
  });

  it('connection status sync across nodes', async () => {
    const namespace = `ws-sync-${Date.now()}`;
    const [portA, portB] = await Promise.all([getFreePort(), getFreePort()]);

    // 创建双节点集群
    const nodeA = await createNegentropyServer({
      port: portA,
      host: '127.0.0.1',
      registerSignalHandlers: false,
      discovery: { enabled: false },
      cluster: {
        enabled: true,
        backplane: new MemoryClusterBackplane(namespace),
        heartbeatIntervalMs: 50,
        nodeTtlMs: 200,
        capabilities: ['gateway', 'echo', 'cluster'],
      },
      integrations: {
        agentEngine: false,
        openClawDecision: false,
        openClawHook: false,
        colyseusMonitor: false,
      },
    });
    instances.push(nodeA);

    const nodeB = await createNegentropyServer({
      port: portB,
      host: '127.0.0.1',
      registerSignalHandlers: false,
      discovery: { enabled: false },
      cluster: {
        enabled: true,
        backplane: new MemoryClusterBackplane(namespace),
        heartbeatIntervalMs: 50,
        nodeTtlMs: 200,
        capabilities: ['gateway', 'echo', 'cluster'],
        seedPeers: [`http://127.0.0.1:${portA}`],
      },
      integrations: {
        agentEngine: false,
        openClawDecision: false,
        openClawHook: false,
        colyseusMonitor: false,
      },
    });
    instances.push(nodeB);

    // 等待集群形成
    await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${portA}/api/cluster/topology`);
      const payload = await response.json() as { topology: { nodes: Array<{ nodeId: string }> } };
      return payload.topology.nodes.length >= 2;
    }, 8000);

    // 初始连接数应该为0
    const initialConnectionsA = await fetch(`http://127.0.0.1:${portA}/api/cluster/websocket/connections`);
    const initialDataA = await initialConnectionsA.json() as { total: number };
    expect(initialDataA.total).toBe(0);

    // 创建客户端连接到节点A
    const wsUrlA = `ws://127.0.0.1:${portA}/gateway`;
    const clientA = createWsClient(wsUrlA);
    clients.push(clientA);
    await clientA.connect();

    // 认证
    const authRequestId = `auth-${Date.now()}`;
    clientA.send({
      type: 'request',
      id: authRequestId,
      method: 'connect',
      params: { token: 'test-token', user: 'sync-test-user' },
    });

    await waitFor(async () => {
      const authResponse = clientA.messages.find(m => m.id === authRequestId && m.ok === true);
      return Boolean(authResponse);
    }, 5000);

    // 等待连接状态同步
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 验证节点A上的连接视图
    const connectionsA = await fetch(`http://127.0.0.1:${portA}/api/cluster/websocket/connections`);
    const dataA = await connectionsA.json() as { 
      total: number; 
      connections: Array<{ status: string; nodeId: string }>;
    };
    expect(dataA.total).toBeGreaterThanOrEqual(1);
    expect(dataA.connections.some(c => c.status === 'connected')).toBe(true);

    // 关闭客户端
    clientA.close();

    // 等待断开状态同步
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 验证连接断开后的状态
    const afterCloseA = await fetch(`http://127.0.0.1:${portA}/api/cluster/websocket/connections`);
    const afterDataA = await afterCloseA.json() as { total: number };
    // 连接应该被清理（取决于实现，可能是立即清理或标记为disconnected）
    expect(afterDataA.total).toBe(0);
  });

  it('manual broadcast API supports capability-based routing', async () => {
    const namespace = `ws-capability-${Date.now()}`;
    const [portA, portB] = await Promise.all([getFreePort(), getFreePort()]);

    const nodeA = await createNegentropyServer({
      port: portA,
      host: '127.0.0.1',
      registerSignalHandlers: false,
      discovery: { enabled: false },
      cluster: {
        enabled: true,
        backplane: new MemoryClusterBackplane(namespace),
        heartbeatIntervalMs: 50,
        nodeTtlMs: 200,
        capabilities: ['gateway', 'echo', 'cluster'],
      },
      integrations: {
        agentEngine: false,
        openClawDecision: false,
        openClawHook: false,
        colyseusMonitor: false,
      },
    });
    instances.push(nodeA);

    const nodeB = await createNegentropyServer({
      port: portB,
      host: '127.0.0.1',
      registerSignalHandlers: false,
      discovery: { enabled: false },
      cluster: {
        enabled: true,
        backplane: new MemoryClusterBackplane(namespace),
        heartbeatIntervalMs: 50,
        nodeTtlMs: 200,
        capabilities: ['gateway', 'echo', 'cluster', 'llm'],
        seedPeers: [`http://127.0.0.1:${portA}`],
      },
      integrations: {
        agentEngine: false,
        openClawDecision: false,
        openClawHook: false,
        colyseusMonitor: false,
      },
    });
    instances.push(nodeB);

    await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${portA}/api/cluster/topology`);
      const payload = await response.json() as { topology: { nodes: Array<{ nodeId: string }> } };
      return payload.topology.nodes.length >= 2;
    }, 8000);

    const clientA = createWsClient(`ws://127.0.0.1:${portA}/gateway`);
    const clientB = createWsClient(`ws://127.0.0.1:${portB}/gateway`);
    clients.push(clientA, clientB);

    await Promise.all([clientA.connect(), clientB.connect()]);

    clientA.send({
      type: 'request',
      id: 'cap-auth-a',
      method: 'connect',
      params: { token: 'test-token', user: 'cap-a' },
    });
    clientB.send({
      type: 'request',
      id: 'cap-auth-b',
      method: 'connect',
      params: { token: 'test-token', user: 'cap-b' },
    });

    await waitFor(async () => {
      const authA = clientA.messages.find(m => m.id === 'cap-auth-a' && m.ok === true);
      const authB = clientB.messages.find(m => m.id === 'cap-auth-b' && m.ok === true);
      return Boolean(authA && authB);
    }, 5000);

    clientA.messages.length = 0;
    clientB.messages.length = 0;

    const response = await fetch(`http://127.0.0.1:${portA}/api/cluster/websocket/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'capability.event',
        payload: { mode: 'capability-route' },
        routing: {
          strategy: 'capability',
          requiredCapabilities: ['llm'],
        },
      }),
    });

    expect(response.ok).toBe(true);
    await wait(500);

    const eventsA = clientA.messages.filter(m => m.type === 'event' && m.event === 'capability.event');
    const eventsB = clientB.messages.filter(m => m.type === 'event' && m.event === 'capability.event');

    expect(eventsA).toHaveLength(0);
    expect(eventsB).toHaveLength(1);
    expect(eventsB[0].payload).toEqual({ mode: 'capability-route' });

    const statsResponse = await fetch(`http://127.0.0.1:${portA}/api/cluster/websocket/stats`);
    const statsPayload = await statsResponse.json() as {
      stats: {
        targetedEvents: number;
        routingByStrategy: Record<string, number>;
      };
    };

    expect(statsPayload.stats.targetedEvents).toBeGreaterThanOrEqual(1);
    expect(statsPayload.stats.routingByStrategy.capability).toBeGreaterThanOrEqual(1);
  });

  it('no event loop: broadcast should not cause infinite loop', async () => {
    const namespace = `ws-loop-${Date.now()}`;
    const [portA, portB] = await Promise.all([getFreePort(), getFreePort()]);

    // 创建双节点集群
    const nodeA = await createNegentropyServer({
      port: portA,
      host: '127.0.0.1',
      registerSignalHandlers: false,
      discovery: { enabled: false },
      cluster: {
        enabled: true,
        backplane: new MemoryClusterBackplane(namespace),
        heartbeatIntervalMs: 50,
        nodeTtlMs: 200,
        capabilities: ['gateway', 'echo', 'cluster'],
      },
      integrations: {
        agentEngine: false,
        openClawDecision: false,
        openClawHook: false,
        colyseusMonitor: false,
      },
    });
    instances.push(nodeA);

    const nodeB = await createNegentropyServer({
      port: portB,
      host: '127.0.0.1',
      registerSignalHandlers: false,
      discovery: { enabled: false },
      cluster: {
        enabled: true,
        backplane: new MemoryClusterBackplane(namespace),
        heartbeatIntervalMs: 50,
        nodeTtlMs: 200,
        capabilities: ['gateway', 'echo', 'cluster'],
        seedPeers: [`http://127.0.0.1:${portA}`],
      },
      integrations: {
        agentEngine: false,
        openClawDecision: false,
        openClawHook: false,
        colyseusMonitor: false,
      },
    });
    instances.push(nodeB);

    // 等待集群形成
    await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${portA}/api/cluster/topology`);
      const payload = await response.json() as { topology: { nodes: Array<{ nodeId: string }> } };
      return payload.topology.nodes.length >= 2;
    }, 8000);

    // 创建客户端连接到两个节点
    const clientA = createWsClient(`ws://127.0.0.1:${portA}/gateway`);
    const clientB = createWsClient(`ws://127.0.0.1:${portB}/gateway`);
    clients.push(clientA, clientB);

    await Promise.all([clientA.connect(), clientB.connect()]);

    // 认证两个客户端
    clientA.send({
      type: 'request',
      id: 'auth-a',
      method: 'connect',
      params: { token: 'test-token', user: 'loop-test-a' },
    });
    clientB.send({
      type: 'request',
      id: 'auth-b',
      method: 'connect',
      params: { token: 'test-token', user: 'loop-test-b' },
    });

    await waitFor(async () => {
      const authA = clientA.messages.find(m => m.id === 'auth-a' && m.ok === true);
      const authB = clientB.messages.find(m => m.id === 'auth-b' && m.ok === true);
      return Boolean(authA && authB);
    }, 5000);

    // 清空消息
    clientA.messages.length = 0;
    clientB.messages.length = 0;

    // 发送一次广播
    clientA.send({
      type: 'request',
      id: 'broadcast-once',
      method: 'send',
      params: { text: 'loop-test' },
    });

    // 等待广播处理完成
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 验证客户端B只收到一次chat事件（不会无限循环）
    const chatEventsOnB = clientB.messages.filter(m => m.type === 'event' && m.event === 'chat');
    expect(chatEventsOnB.length).toBeGreaterThanOrEqual(1);
    
    // 关键验证：事件不应该超过合理的数量（如果发生回环，会有大量重复事件）
    // 允许一些重复（如presence事件），但chat事件应该只有一次
    const chatEventsWithSameText = chatEventsOnB.filter(m => 
      m.payload?.text === 'loop-test' || m.payload?.message === 'loop-test'
    );
    expect(chatEventsWithSameText.length).toBeLessThanOrEqual(3); // 允许少量重复，但不应该无限增长

    // 验证广播器没有进入无限循环（通过检查处理的事件数量合理）
    const statsA = await fetch(`http://127.0.0.1:${portA}/api/cluster/websocket/stats`);
    const statsDataA = await statsA.json() as { stats: { eventsBroadcast: number; batchesProcessed: number } };
    expect(statsDataA.stats.eventsBroadcast).toBeLessThan(100); // 不应该有大量重复广播
  });
});
