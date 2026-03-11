import { describe, expect, it } from 'vitest';
import { MemoryClusterBackplane } from '../backplane/MemoryClusterBackplane';

describe('MemoryClusterBackplane', () => {
  it('shares node state across instances in the same namespace', async () => {
    const namespace = `cluster-${Date.now()}`;
    const backplaneA = new MemoryClusterBackplane(namespace);
    const backplaneB = new MemoryClusterBackplane(namespace);

    await backplaneA.upsertNode({
      nodeId: 'node-a',
      clusterId: namespace,
      name: 'Node A',
      role: 'gateway',
      host: '127.0.0.1',
      httpPort: 3001,
      wsPort: 3001,
      rpcPort: 3001,
      version: '1.0.0',
      status: 'active',
      capabilities: ['gateway', 'echo'],
      load: 0.2,
      lastSeen: Date.now(),
      discoveredVia: 'self',
    }, 1_000);

    const nodes = await backplaneB.listNodes();
    expect(nodes).toHaveLength(1);
    expect(nodes[0].nodeId).toBe('node-a');
  });

  it('enforces lease ownership', async () => {
    const namespace = `lease-${Date.now()}`;
    const backplane = new MemoryClusterBackplane(namespace);

    const firstLease = await backplane.tryAcquireTaskLease('task-1', 'node-a', 1_000);
    const secondLease = await backplane.tryAcquireTaskLease('task-1', 'node-b', 1_000);

    expect(firstLease?.ownerNodeId).toBe('node-a');
    expect(secondLease).toBeNull();

    const renewedLease = await backplane.renewTaskLease('task-1', 'node-a', 2_000);
    expect(renewedLease?.ownerNodeId).toBe('node-a');

    const released = await backplane.releaseTaskLease('task-1', 'node-a');
    expect(released).toBe(true);
    expect(await backplane.getTaskLease('task-1')).toBeNull();
  });
});

