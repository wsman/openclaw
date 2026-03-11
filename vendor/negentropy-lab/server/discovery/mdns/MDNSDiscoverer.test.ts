import { describe, expect, it } from 'vitest';
import { MDNSDiscoverer } from './MDNSDiscoverer';

describe('MDNSDiscoverer', () => {
  it('parses cluster metadata from discovered services', async () => {
    const discoverer = new MDNSDiscoverer({
      id: 'node-self',
      name: 'gateway-node',
      clusterId: 'cluster-test',
      port: 3000,
    });

    await discoverer.start();

    const mdns = (discoverer as any).mdns;
    mdns.emit('response', {
      answers: [
        {
          name: 'gateway-node-node-2',
          type: 'SRV',
          data: {
            port: 4514,
            weight: 0,
            priority: 10,
            target: '192.168.1.50',
          },
        },
        {
          name: 'gateway-node-node-2',
          type: 'TXT',
          data: [
            Buffer.from('id=node-2'),
            Buffer.from('clusterId=cluster-test'),
            Buffer.from('host=192.168.1.50'),
            Buffer.from('httpPort=4514'),
            Buffer.from('wsPort=4514'),
            Buffer.from('rpcPort=4515'),
            Buffer.from('capabilities=gateway,llm'),
            Buffer.from(`timestamp=${Date.now()}`),
          ],
        },
      ],
    });

    const [service] = discoverer.getServices();
    expect(service.id).toBe('node-2');
    expect(service.clusterId).toBe('cluster-test');
    expect(service.host).toBe('192.168.1.50');
    expect(service.httpPort).toBe(4514);
    expect(service.wsPort).toBe(4514);
    expect(service.rpcPort).toBe(4515);
    expect(service.capabilities).toContain('llm');

    discoverer.stop();
  });

  it('stores manual services from heartbeats', () => {
    const discoverer = new MDNSDiscoverer();
    discoverer.upsertManualService({
      id: 'node-manual',
      name: 'manual-node',
      type: 'manual',
      host: '127.0.0.1',
      port: 9999,
      protocol: 'tcp',
      status: 'active',
      capabilities: ['gateway'],
    });

    const [service] = discoverer.getServices();
    expect(service.id).toBe('node-manual');
    expect(service.status).toBe('active');
  });
});

