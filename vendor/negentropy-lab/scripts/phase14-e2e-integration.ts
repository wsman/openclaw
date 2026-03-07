/**
 * Phase 14 E2E integration runner (Batch 14-2)
 *
 * Scope:
 * - Decision mode verification (OFF / SHADOW / ENFORCE)
 * - HTTP ingress checks (/health, /v1/chat/completions, /v1/responses)
 * - WebSocket RPC checks (connect + key methods)
 *
 * Output:
 * - reports/2026-03-07_e2e-integration-report.md
 * - reports/phase14-e2e-integration.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import WebSocket from 'ws';
import { startGatewayServer, type GatewayServer } from '../server/gateway/server.impl-with-ws';

type DecisionMode = 'OFF' | 'SHADOW' | 'ENFORCE';

interface WsRpcResponse {
  type: 'response';
  id?: string;
  ok?: boolean;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}

interface IntegrationReport {
  generatedAt: string;
  status: 'PASS' | 'FAIL';
  decisionModes: Array<{
    mode: DecisionMode;
    requestAction: string;
    expectedAction: string;
    pass: boolean;
  }>;
  wsChecks: CheckResult[];
  httpChecks: CheckResult[];
}

function ensureReportsDir(root: string): string {
  const reportsDir = path.join(root, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });
  return reportsDir;
}

async function connectWs(baseUrl: string): Promise<WebSocket> {
  const wsUrl = baseUrl.replace('http://', 'ws://') + '/gateway';
  const ws = new WebSocket(wsUrl);
  await once(ws, 'open');
  return ws;
}

function makeRpcClient(ws: WebSocket) {
  let seq = 1;
  const pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  ws.on('message', (data) => {
    let msg: unknown;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    const m = msg as WsRpcResponse;
    if (m.type !== 'response' || !m.id) {
      return;
    }
    const waiter = pending.get(m.id);
    if (!waiter) {
      return;
    }
    pending.delete(m.id);

    if (m.ok === false || m.error) {
      waiter.reject(new Error(m.error?.message || 'RPC call failed'));
      return;
    }
    waiter.resolve(m.result);
  });

  ws.on('close', () => {
    for (const waiter of pending.values()) {
      waiter.reject(new Error('WebSocket closed'));
    }
    pending.clear();
  });

  async function rpc(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = `rpc-${seq++}`;
    const payload = {
      type: 'request',
      id,
      method,
      params,
    };
    const result = new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`RPC timeout: ${method}`));
        }
      }, 15_000);
    });
    ws.send(JSON.stringify(payload));
    return result;
  }

  return { rpc };
}

async function run(): Promise<void> {
  const root = process.cwd();
  const reportsDir = ensureReportsDir(root);
  const port = Number(process.env.PHASE14_E2E_PORT || 4620);
  const baseUrl = `http://127.0.0.1:${port}`;
  let gateway: GatewayServer | null = null;

  const wsChecks: CheckResult[] = [];
  const httpChecks: CheckResult[] = [];
  const decisionModes: IntegrationReport['decisionModes'] = [];

  try {
    gateway = await startGatewayServer(port, {
      bind: 'loopback',
      controlUiEnabled: false,
      openAiChatCompletionsEnabled: true,
      openResponsesEnabled: true,
    });

    const ws = await connectWs(baseUrl);
    const client = makeRpcClient(ws);

    // authenticate as admin to allow decision.config.set
    await client.rpc('connect', {
      token: 'test-admin-token',
      user: 'phase14-e2e',
      client: { name: 'phase14-e2e-runner', version: '1.0.0' },
    });

    wsChecks.push({
      name: 'ws.connect.admin',
      ok: true,
      detail: 'authenticated with admin scope',
    });

    for (const mode of ['OFF', 'SHADOW', 'ENFORCE'] as DecisionMode[]) {
      await client.rpc('decision.config.set', { mode });
      const decision = (await client.rpc('decision.evaluate', {
        method: 'dangerous.execute',
        params: { dryRun: true },
      })) as { action?: string };

      const action = String(decision?.action || 'UNKNOWN');
      const expected = mode === 'ENFORCE' ? 'REJECT' : 'EXECUTE';
      const pass = action === expected;
      decisionModes.push({
        mode,
        requestAction: action,
        expectedAction: expected,
        pass,
      });
    }

    for (const rpcMethod of ['health', 'status', 'decision.health', 'system.info']) {
      try {
        await client.rpc(rpcMethod, {});
        wsChecks.push({ name: `ws.rpc.${rpcMethod}`, ok: true });
      } catch (error) {
        wsChecks.push({
          name: `ws.rpc.${rpcMethod}`,
          ok: false,
          detail: String(error),
        });
      }
    }

    ws.close();

    const httpTargets: Array<{
      name: string;
      run: () => Promise<Response>;
      predicate: (res: Response) => boolean;
    }> = [
      {
        name: 'http.health',
        run: () => fetch(`${baseUrl}/health`),
        predicate: (res) => res.ok,
      },
      {
        name: 'http.websocket.stats',
        run: () => fetch(`${baseUrl}/api/websocket/stats`),
        predicate: (res) => res.ok,
      },
      {
        name: 'http.openai.chat.completions',
        run: () =>
          fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'gpt-3.5-turbo',
              messages: [{ role: 'user', content: 'phase14 e2e' }],
            }),
          }),
        predicate: (res) => res.status < 500,
      },
      {
        name: 'http.openresponses.create',
        run: () =>
          fetch(`${baseUrl}/v1/responses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: 'phase14 e2e' }),
          }),
        predicate: (res) => res.status < 500,
      },
    ];

    for (const target of httpTargets) {
      try {
        const res = await target.run();
        httpChecks.push({
          name: target.name,
          ok: target.predicate(res),
          detail: `status=${res.status}`,
        });
      } catch (error) {
        httpChecks.push({
          name: target.name,
          ok: false,
          detail: String(error),
        });
      }
    }

    const status: IntegrationReport['status'] =
      decisionModes.every((item) => item.pass) &&
      wsChecks.every((item) => item.ok) &&
      httpChecks.every((item) => item.ok)
        ? 'PASS'
        : 'FAIL';

    const report: IntegrationReport = {
      generatedAt: new Date().toISOString(),
      status,
      decisionModes,
      wsChecks,
      httpChecks,
    };

    const jsonPath = path.join(reportsDir, 'phase14-e2e-integration.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

    const mdLines: string[] = [
      '# Phase 14 E2E Integration Report',
      '',
      `- Generated: ${report.generatedAt}`,
      `- Status: **${report.status}**`,
      '',
      '## Decision Modes',
      '',
      '| Mode | Actual | Expected | Pass |',
      '|------|--------|----------|------|',
      ...report.decisionModes.map(
        (row) => `| ${row.mode} | ${row.requestAction} | ${row.expectedAction} | ${row.pass ? 'YES' : 'NO'} |`,
      ),
      '',
      '## WebSocket Checks',
      '',
      '| Check | Pass | Detail |',
      '|------|------|--------|',
      ...report.wsChecks.map((row) => `| ${row.name} | ${row.ok ? 'YES' : 'NO'} | ${row.detail || '-'} |`),
      '',
      '## HTTP Checks',
      '',
      '| Check | Pass | Detail |',
      '|------|------|--------|',
      ...report.httpChecks.map((row) => `| ${row.name} | ${row.ok ? 'YES' : 'NO'} | ${row.detail || '-'} |`),
      '',
      `- JSON artifact: ${path.relative(root, jsonPath).replace(/\\/g, '/')}`,
    ];

    const mdPath = path.join(reportsDir, '2026-03-07_e2e-integration-report.md');
    fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf8');

    console.log(`phase14 e2e report: ${mdPath}`);
    console.log(`phase14 e2e json: ${jsonPath}`);

    if (status !== 'PASS') {
      process.exitCode = 1;
    }
  } finally {
    if (gateway) {
      await gateway.close({ reason: 'phase14 e2e completed' });
    }
  }
}

run().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
