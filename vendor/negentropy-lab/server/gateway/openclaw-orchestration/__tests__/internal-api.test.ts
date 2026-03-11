import express from 'express';
import type { AddressInfo } from 'net';
import { createWorkflowInternalApiRouter } from '../api/internal-api';
import { createOrchestrationService } from '../service/orchestration-service';

describe('workflow internal API smoke', () => {
  it('runs -> lists -> gets -> logs -> cancels workflows', async () => {
    const service = createOrchestrationService();
    const app = express();
    app.use(express.json());
    app.use('/internal/openclaw', createWorkflowInternalApiRouter(service));

    const server = await new Promise<import('http').Server>((resolve) => {
      const instance = app.listen(0, () => resolve(instance));
    });

    try {
      const port = (server.address() as AddressInfo).port;
      const base = `http://127.0.0.1:${port}/internal/openclaw/workflows`;

      const runRes = await fetch(`${base}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId: 'serial_planner_executor_complete' }),
      });
      expect(runRes.ok).toBe(true);
      const runBody = (await runRes.json()) as { run: { runId: string } };
      const runId = runBody.run.runId;
      expect(runId).toContain('wf_');

      const listRes = await fetch(base);
      expect(listRes.ok).toBe(true);
      const listBody = (await listRes.json()) as { total: number };
      expect(listBody.total).toBeGreaterThan(0);

      const getRes = await fetch(`${base}/${encodeURIComponent(runId)}`);
      expect(getRes.ok).toBe(true);
      const getBody = (await getRes.json()) as { runId: string };
      expect(getBody.runId).toBe(runId);

      const logRes = await fetch(`${base}/${encodeURIComponent(runId)}/log`);
      expect(logRes.ok).toBe(true);
      const logBody = (await logRes.json()) as { runId: string; total: number };
      expect(logBody.runId).toBe(runId);
      expect(logBody.total).toBeGreaterThan(0);

      const cancelRes = await fetch(`${base}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId, emergency: true }),
      });
      expect(cancelRes.ok).toBe(true);
      const cancelBody = (await cancelRes.json()) as { run: { status: string } };
      expect(cancelBody.run.status).toBe('canceled');

      const retryRes = await fetch(`${base}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId }),
      });
      expect(retryRes.ok).toBe(true);
      const retryBody = (await retryRes.json()) as { run: { runId: string; metadata?: { retryOfRunId?: string } } };
      expect(retryBody.run.runId).not.toBe(runId);
      expect(retryBody.run.metadata?.retryOfRunId).toBe(runId);
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
