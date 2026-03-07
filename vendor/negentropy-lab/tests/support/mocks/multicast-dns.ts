/**
 * multicast-dns mock for Vitest.
 * Provides a minimal evented API used by MDNSDiscoverer.
 */

import { EventEmitter } from 'events';

class MockMdns extends EventEmitter {
  query(_payload: unknown): void {}
  respond(_payload: unknown): void {}
  destroy(): void {
    this.removeAllListeners();
  }
}

export default function mdns(): MockMdns {
  return new MockMdns();
}
