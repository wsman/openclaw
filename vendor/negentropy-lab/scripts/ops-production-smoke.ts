/**
 * 🚀 OPS production 冒烟脚本（本地演练）
 *
 * @constitution
 * §101 同步公理：脚本变更需同步报告口径
 * §102 熵减原则：统一生产冒烟流程，减少手工误差
 * §306 零停机协议：演练启动/关闭链路，确保服务可控
 *
 * @filename ops-production-smoke.ts
 * @version 1.0.0
 * @category operations
 * @last_updated 2026-03-02
 */

import fs from 'node:fs';
import path from 'node:path';
import { startGatewayServer, type GatewayServer } from '../server/gateway/server.impl-with-ws';

interface SmokeEndpointResult {
  endpoint: string;
  ok: boolean;
  status: number | null;
  durationMs: number;
  bodyPreview?: string;
}

interface SmokeReport {
  timestamp: string;
  mode: 'local-production-simulation';
  port: number;
  status: 'PASS' | 'FAIL';
  endpoints: SmokeEndpointResult[];
  startupDurationMs: number;
  shutdownDurationMs: number;
}

const DEFAULT_PORT = Number(process.env.OPS_SMOKE_PORT || '4614');

async function probe(baseUrl: string, endpoint: string): Promise<SmokeEndpointResult> {
  const startedAt = Date.now();
  try {
    const res = await fetch(`${baseUrl}${endpoint}`);
    const text = await res.text();
    return {
      endpoint,
      ok: res.ok,
      status: res.status,
      durationMs: Date.now() - startedAt,
      bodyPreview: text.slice(0, 200),
    };
  } catch (error) {
    return {
      endpoint,
      ok: false,
      status: null,
      durationMs: Date.now() - startedAt,
      bodyPreview: String(error),
    };
  }
}

async function waitForHealth(baseUrl: string, timeoutMs = 20_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await probe(baseUrl, '/health');
    if (result.ok) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('gateway health probe timeout');
}

async function main(): Promise<void> {
  process.env.NODE_ENV = 'production';

  const startupBegin = Date.now();
  let server: GatewayServer | null = null;
  try {
    server = await startGatewayServer(DEFAULT_PORT, {
      bind: 'loopback',
      controlUiEnabled: false,
      openAiChatCompletionsEnabled: true,
      openResponsesEnabled: true,
    });
  } catch (error) {
    console.error(`failed to start gateway: ${String(error)}`);
    process.exit(1);
  }
  const startupDurationMs = Date.now() - startupBegin;

  const baseUrl = `http://127.0.0.1:${DEFAULT_PORT}`;
  await waitForHealth(baseUrl);

  const endpoints: string[] = ['/health', '/api/websocket/stats', '/v1/chat/completions'];
  const results: SmokeEndpointResult[] = [];
  for (const endpoint of endpoints) {
    // /v1/chat/completions requires POST; for smoke we only require route reachability (non-5xx)
    if (endpoint === '/v1/chat/completions') {
      const startedAt = Date.now();
      try {
        const res = await fetch(`${baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'smoke' }],
          }),
        });
        const text = await res.text();
        results.push({
          endpoint,
          ok: res.status < 500,
          status: res.status,
          durationMs: Date.now() - startedAt,
          bodyPreview: text.slice(0, 200),
        });
      } catch (error) {
        results.push({
          endpoint,
          ok: false,
          status: null,
          durationMs: Date.now() - startedAt,
          bodyPreview: String(error),
        });
      }
      continue;
    }
    results.push(await probe(baseUrl, endpoint));
  }

  const shutdownBegin = Date.now();
  await server.close({ reason: 'ops production smoke finished' });
  const shutdownDurationMs = Date.now() - shutdownBegin;

  const report: SmokeReport = {
    timestamp: new Date().toISOString(),
    mode: 'local-production-simulation',
    port: DEFAULT_PORT,
    status: results.every((r) => r.ok) ? 'PASS' : 'FAIL',
    endpoints: results,
    startupDurationMs,
    shutdownDurationMs,
  };

  const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const outputPath = path.join(process.cwd(), 'reports', `production-deploy-smoke-${ts}.json`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log(`ops production smoke report: ${outputPath}`);
  console.log(`status: ${report.status}`);

  if (report.status !== 'PASS') {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
