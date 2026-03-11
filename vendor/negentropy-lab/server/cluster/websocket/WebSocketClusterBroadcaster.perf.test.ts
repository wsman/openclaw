import { describe, expect, it } from 'vitest';
import { ClusterNode } from '../ClusterNode';
import { MemoryClusterBackplane } from '../backplane/MemoryClusterBackplane';
import { IWebSocketHandler, WebSocketClusterBroadcaster } from './WebSocketClusterBroadcaster';

class CountingMemoryClusterBackplane extends MemoryClusterBackplane {
  publishCount = 0;

  override async publish<T = unknown>(channel: string, payload: T, sourceNodeId?: string): Promise<void> {
    if (channel.includes('cluster:ws:broadcast:batch')) {
      this.publishCount += 1;
    }
    await super.publish(channel, payload, sourceNodeId);
  }
}

function createHandler() {
  const received: Array<{ event: string; payload: unknown }> = [];
  const handler: IWebSocketHandler = {
    sendEvent: () => {},
    broadcastEvent: (event, payload) => {
      received.push({ event, payload });
    },
    getConnections: () => new Map(),
  };

  return { handler, received };
}

function createNode(nodeId: string, clusterId: string, backplane: MemoryClusterBackplane) {
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

describe('WebSocketClusterBroadcaster performance', () => {
  it('keeps publish operations low under burst load', async () => {
    const namespace = `ws-burst-${Date.now()}`;
    const backplane = new CountingMemoryClusterBackplane(namespace);
    const nodeA = createNode('node-a', namespace, backplane);
    const nodeB = createNode('node-b', namespace, backplane);

    const broadcasterA = new WebSocketClusterBroadcaster({
      batchDelayMs: 5,
      maxBatchSize: 20,
      orderingWindowMs: 0,
    });
    const broadcasterB = new WebSocketClusterBroadcaster({
      batchDelayMs: 5,
      maxBatchSize: 20,
      orderingWindowMs: 0,
    });

    const mockA = createHandler();
    const mockB = createHandler();

    await broadcasterA.initialize(nodeA, mockA.handler);
    await broadcasterB.initialize(nodeB, mockB.handler);

    await Promise.all(
      Array.from({ length: 50 }, (_, index) =>
        broadcasterA.broadcastToCluster('burst.event', { index })),
    );

    await new Promise((resolve) => setTimeout(resolve, 120));

    expect(mockB.received.filter((item) => item.event === 'burst.event')).toHaveLength(50);
    expect(backplane.publishCount).toBeLessThanOrEqual(3);
    expect(broadcasterA.getStats().publishOperations).toBeLessThanOrEqual(3);

    await broadcasterA.shutdown();
    await broadcasterB.shutdown();
  });
});
