import express from 'express';
import type { AddressInfo } from 'net';
import { createInternalApiRouter } from '../api/internal-api';

describe('decision internal API integration', () => {
  it('mounts workflow orchestration routes under the shared /internal/openclaw surface', async () => {
    const app = express();
    app.use(express.json());
    app.use('/internal/openclaw', createInternalApiRouter());

    const server = await new Promise<import('http').Server>((resolve) => {
      const instance = app.listen(0, () => resolve(instance));
    });

    try {
      const port = (server.address() as AddressInfo).port;
      const response = await fetch(`http://127.0.0.1:${port}/internal/openclaw/workflows/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'session_start',
          sessionId: 'session-1',
          sessionKey: 'agent:main',
        }),
      });

      expect(response.ok).toBe(true);
      const body = (await response.json()) as { ignored?: boolean; message?: string };
      expect(body.ignored).toBe(true);
      expect(body.message ?? '').toMatch(/no workflow run matched/i);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  });
});
