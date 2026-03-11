import { describe, expect, it } from 'vitest';
import { ClusterNode } from '../ClusterNode';
import { MemoryClusterBackplane } from '../backplane/MemoryClusterBackplane';
import { ClusterWebSocketEvent } from './types';
import { WebSocketClusterBroadcaster, IWebSocketHandler } from './WebSocketClusterBroadcaster';

class CountingMemoryClusterBackplane extends MemoryClusterBackplane {
  publishCalls: Array<{ channel: string; payload: unknown; sourceNodeId?: string }> = [];

  override async publish<T = unknown>(channel: string, payload: T, sourceNodeId?: string): Promise<void> {
    this.publishCalls.push({ channel, payload, sourceNodeId });
    await super.publish(channel, payload, sourceNodeId);
  }
}

function createMockHandler() {
  const received: Array<{ event: string; payload: unknown; scope?: string; skipCluster?: boolean }> = [];

  const handler: IWebSocketHandler = {
    sendEvent: () => {},
    broadcastEvent: (event, payload, scope, skipCluster) => {
      received.push({ event, payload, scope, skipCluster });
    },
    getConnections: () => new Map(),
  };

  return { handler, received };
}

function createClusterNode(nodeId: string, clusterId: string, backplane?: MemoryClusterBackplane) {
  return new ClusterNode({
    nodeId,
    clusterId,
    name: nodeId,
    host: '127.0.0.1',
    httpPort: 3000,
    capabilities: ['gateway', 'cluster'],
    backplane,
    discoverer: null,
  });
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe('WebSocketClusterBroadcaster', () => {
  it('flushes single events after batch delay and avoids loopback rebroadcast', async () => {
    const namespace = `ws-fanout-${Date.now()}`;
    const backplane = new CountingMemoryClusterBackplane(namespace);
    const nodeA = createClusterNode('node-a', namespace, backplane);
    const nodeB = createClusterNode('node-b', namespace, backplane);

    const broadcasterA = new WebSocketClusterBroadcaster({ batchDelayMs: 20, maxBatchSize: 10 });
    const broadcasterB = new WebSocketClusterBroadcaster({ batchDelayMs: 20, maxBatchSize: 10 });

    const mockA = createMockHandler();
    const mockB = createMockHandler();

    await broadcasterA.initialize(nodeA, mockA.handler);
    await broadcasterB.initialize(nodeB, mockB.handler);

    await broadcasterA.broadcastToCluster('custom.event', { ok: true }, 'read');
    await wait(80);

    expect(mockB.received).toHaveLength(1);
    expect(mockB.received[0]).toMatchObject({
      event: 'custom.event',
      payload: { ok: true },
      scope: 'read',
      skipCluster: true,
    });

    expect(mockA.received).toHaveLength(0);
    expect(broadcasterA.getStats().batchesProcessed).toBe(1);
    expect(broadcasterA.getStats().publishOperations).toBe(1);
    expect(broadcasterA.getStats().batchQueueSize).toBe(0);
    expect(backplane.publishCalls.filter((call) => call.channel.includes('cluster:ws:broadcast:batch'))).toHaveLength(1);

    await broadcasterA.shutdown();
    await broadcasterB.shutdown();
  });

  it('reorders out-of-order events by timestamp before local delivery', async () => {
    const namespace = `ws-order-${Date.now()}`;
    const backplane = new CountingMemoryClusterBackplane(namespace);
    const nodeB = createClusterNode('node-b', namespace, backplane);
    const broadcasterB = new WebSocketClusterBroadcaster({
      batchDelayMs: 10,
      maxBatchSize: 10,
      orderingWindowMs: 15,
    });
    const mockB = createMockHandler();

    await broadcasterB.initialize(nodeB, mockB.handler);

    const baseTimestamp = Date.now();
    const events: ClusterWebSocketEvent[] = [
      {
        eventId: 'node-a:2',
        sourceNodeId: 'node-a',
        timestamp: baseTimestamp + 2,
        sequence: 2,
        eventType: 'ordered',
        payload: { step: 2 },
        ttl: 60_000,
      },
      {
        eventId: 'node-a:1',
        sourceNodeId: 'node-a',
        timestamp: baseTimestamp + 1,
        sequence: 1,
        eventType: 'ordered',
        payload: { step: 1 },
        ttl: 60_000,
      },
    ];

    await backplane.publish('cluster:ws:broadcast:batch', events, 'node-a');
    await wait(80);

    expect(mockB.received.map((item) => item.payload)).toEqual([
      { step: 1 },
      { step: 2 },
    ]);
    expect(broadcasterB.getStats().eventsOrdered).toBeGreaterThanOrEqual(2);

    await broadcasterB.shutdown();
  });

  it('routes least-loaded traffic to a single node and batches global publish operations', async () => {
    const namespace = `ws-route-${Date.now()}`;
    const backplane = new CountingMemoryClusterBackplane(namespace);
    const nodeA = createClusterNode('node-a', namespace, backplane);
    const nodeB = createClusterNode('node-b', namespace, backplane);
    const nodeC = createClusterNode('node-c', namespace, backplane);

    nodeA.acceptPeer({ ...nodeB.getLocalNode(), load: 0.8 });
    nodeA.acceptPeer({ ...nodeC.getLocalNode(), load: 0.2 });

    const broadcasterA = new WebSocketClusterBroadcaster({ batchDelayMs: 20, maxBatchSize: 10 });
    const broadcasterB = new WebSocketClusterBroadcaster({ batchDelayMs: 20, maxBatchSize: 10 });
    const broadcasterC = new WebSocketClusterBroadcaster({ batchDelayMs: 20, maxBatchSize: 10 });

    const mockA = createMockHandler();
    const mockB = createMockHandler();
    const mockC = createMockHandler();

    await broadcasterA.initialize(nodeA, mockA.handler);
    await broadcasterB.initialize(nodeB, mockB.handler);
    await broadcasterC.initialize(nodeC, mockC.handler);

    await broadcasterA.broadcastToCluster('balanced.event', { route: 'least-loaded' }, undefined, {
      routing: { strategy: 'least-loaded' },
    });

    await broadcasterA.broadcastToCluster('batch.1', { index: 1 });
    await broadcasterA.broadcastToCluster('batch.2', { index: 2 });
    await broadcasterA.broadcastToCluster('batch.3', { index: 3 });

    await wait(100);

    expect(mockC.received.some((item) => item.event === 'balanced.event')).toBe(true);
    expect(mockB.received.some((item) => item.event === 'balanced.event')).toBe(false);

    const batchPublishCalls = backplane.publishCalls.filter((call) => call.channel.includes('cluster:ws:broadcast:batch'));
    expect(batchPublishCalls).toHaveLength(2);
    expect(batchPublishCalls.some((call) => call.channel.endsWith('node:node-c'))).toBe(true);
    expect(batchPublishCalls.some((call) => call.channel === 'cluster:ws:broadcast:batch')).toBe(true);

    const stats = broadcasterA.getStats();
    expect(stats.publishOperations).toBe(2);
    expect(stats.targetedEvents).toBeGreaterThanOrEqual(1);
    expect(stats.loadBalancedEvents).toBeGreaterThanOrEqual(1);
    expect(stats.routingByStrategy['least-loaded']).toBe(1);
    expect(stats.routingByStrategy.broadcast).toBe(3);

    await broadcasterA.shutdown();
    await broadcasterB.shutdown();
    await broadcasterC.shutdown();
  });
});
