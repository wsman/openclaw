import net from 'net';
import { afterEach, describe, expect, it } from 'vitest';
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

async function waitFor(assertion: () => Promise<boolean>, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await assertion()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('condition not met before timeout');
}

describe('cluster e2e', () => {
  const instances: NegentropyServerInstance[] = [];

  afterEach(async () => {
    await Promise.all(instances.splice(0).map((instance) => instance.stop()));
  });

  it('forms a two-node cluster and routes tasks to the matching node', async () => {
    const namespace = `cluster-e2e-${Date.now()}`;
    const [portA, portB] = await Promise.all([getFreePort(), getFreePort()]);

    const nodeA = await createNegentropyServer({
      port: portA,
      host: '127.0.0.1',
      registerSignalHandlers: false,
      discovery: { enabled: false },
      cluster: {
        enabled: true,
        backplane: new MemoryClusterBackplane(namespace),
        heartbeatIntervalMs: 100,
        nodeTtlMs: 400,
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
        heartbeatIntervalMs: 100,
        nodeTtlMs: 400,
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
    });

    const dispatchResponse = await fetch(`http://127.0.0.1:${portA}/api/cluster/tasks/dispatch`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        type: 'echo',
        payload: { message: 'hello cluster' },
        requiredCapabilities: ['llm'],
      }),
    });

    const dispatchPayload = await dispatchResponse.json() as {
      ok: boolean;
      executedBy: string;
      result: { payload: { message: string }; nodeId: string };
    };

    expect(dispatchPayload.ok).toBe(true);
    expect(dispatchPayload.executedBy).toBe(`gateway-${portB}`);
    expect(dispatchPayload.result.payload.message).toBe('hello cluster');

    await nodeB.stop();
    instances.splice(instances.indexOf(nodeB), 1);

    await waitFor(async () => {
      const response = await fetch(`http://127.0.0.1:${portA}/api/cluster/topology`);
      const payload = await response.json() as {
        topology: {
          nodes: Array<{ nodeId: string; status: string }>;
        };
      };
      const remoteNode = payload.topology.nodes.find((node) => node.nodeId === `gateway-${portB}`);
      return Boolean(remoteNode && remoteNode.status === 'offline');
    });

    const localFallbackResponse = await fetch(`http://127.0.0.1:${portA}/api/cluster/tasks/dispatch`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        type: 'echo',
        payload: { message: 'fallback' },
      }),
    });

    const localFallbackPayload = await localFallbackResponse.json() as {
      ok: boolean;
      executedBy: string;
    };

    expect(localFallbackPayload.ok).toBe(true);
    expect(localFallbackPayload.executedBy).toBe(`gateway-${portA}`);
  });
});
