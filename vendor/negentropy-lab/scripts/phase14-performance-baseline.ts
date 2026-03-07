/**
 * Phase 14 performance baseline runner (Batch 14-5)
 *
 * Metrics:
 * - HTTP decision-latency baseline (P50/P95)
 * - WebSocket connection success rate
 * - Throughput baseline (QPS over fixed window)
 *
 * Output:
 * - reports/2026-03-15_performance-baseline.md
 * - reports/phase14-performance-baseline.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import WebSocket from 'ws';
import { startGatewayServer, type GatewayServer } from '../server/gateway/server.impl-with-ws';

interface BaselineReport {
  generatedAt: string;
  status: 'PASS' | 'FAIL';
  thresholds: {
    latencyP95MsMax: number;
    wsSuccessRateMin: number;
  };
  latency: {
    sampleCount: number;
    p50Ms: number;
    p95Ms: number;
    avgMs: number;
  };
  websocket: {
    attempts: number;
    success: number;
    successRate: number;
  };
  throughput: {
    requests: number;
    succeeded: number;
    durationMs: number;
    qps: number;
  };
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function measureMs(start: bigint): number {
  return Number(process.hrtime.bigint() - start) / 1_000_000;
}

async function runWsConnect(baseUrl: string): Promise<boolean> {
  const ws = new WebSocket(baseUrl.replace('http://', 'ws://') + '/gateway');
  try {
    await once(ws, 'open');
    ws.send(
      JSON.stringify({
        type: 'request',
        id: 'connect-1',
        method: 'connect',
        params: {
          token: 'test-token',
          user: 'phase14-perf',
        },
      }),
    );

    const gotResponse = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 5000);
      ws.on('message', (data) => {
        try {
          const payload = JSON.parse(data.toString()) as { type?: string; id?: string; ok?: boolean };
          if (payload.type === 'response' && payload.id === 'connect-1') {
            clearTimeout(timer);
            resolve(payload.ok !== false);
          }
        } catch {
          // ignore parse errors and continue waiting
        }
      });
    });
    ws.close();
    return gotResponse;
  } catch {
    try {
      ws.close();
    } catch {
      // noop
    }
    return false;
  }
}

async function fetchWithRetry(url: string, init: RequestInit, retries: number): Promise<Response> {
  let lastError: unknown;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await fetch(url, init);
    } catch (error) {
      lastError = error;
      if (i < retries) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('fetch failed');
}

async function run(): Promise<void> {
  const root = process.cwd();
  const reportsDir = path.join(root, 'reports');
  fs.mkdirSync(reportsDir, { recursive: true });

  const port = Number(process.env.PHASE14_PERF_PORT || 4621);
  const baseUrl = `http://127.0.0.1:${port}`;
  const thresholds = {
    latencyP95MsMax: 100,
    wsSuccessRateMin: 0.999,
  };

  let gateway: GatewayServer | null = null;
  try {
    gateway = await startGatewayServer(port, {
      bind: 'loopback',
      controlUiEnabled: false,
      openAiChatCompletionsEnabled: true,
      openResponsesEnabled: true,
    });

    // Warm up
    await fetch(`${baseUrl}/health`);

    // 1) Latency baseline
    const latencySamples: number[] = [];
    for (let i = 0; i < 40; i += 1) {
      const t0 = process.hrtime.bigint();
      const res = await fetchWithRetry(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: `latency-${i}` }],
        }),
      }, 1);
      if (!res.ok) {
        throw new Error(`latency sample failed with status=${res.status}`);
      }
      latencySamples.push(measureMs(t0));
    }
    latencySamples.sort((a, b) => a - b);
    const p50Ms = Number(percentile(latencySamples, 50).toFixed(2));
    const p95Ms = Number(percentile(latencySamples, 95).toFixed(2));
    const avgMs = Number((latencySamples.reduce((sum, n) => sum + n, 0) / latencySamples.length).toFixed(2));

    // 2) WebSocket connection success rate baseline
    const wsAttempts = 50;
    let wsSuccess = 0;
    for (let i = 0; i < wsAttempts; i += 1) {
      if (await runWsConnect(baseUrl)) {
        wsSuccess += 1;
      }
    }
    const wsSuccessRate = Number((wsSuccess / wsAttempts).toFixed(4));

    // 3) Throughput baseline
    const throughputRequests = 150;
    const throughputConcurrency = 20;
    let throughputSucceeded = 0;
    const tStart = process.hrtime.bigint();
    for (let i = 0; i < throughputRequests; i += throughputConcurrency) {
      const current = Math.min(throughputConcurrency, throughputRequests - i);
      const batch = Array.from({ length: current }).map((_, offset) =>
        fetchWithRetry(`${baseUrl}/health?probe=${i + offset}`, { method: 'GET' }, 2)
          .then((res) => {
            if (res.ok) {
              throughputSucceeded += 1;
            }
          })
          .catch(() => {
            // keep the benchmark running and report success ratio
          }),
      );
      await Promise.all(batch);
    }
    const throughputDurationMs = measureMs(tStart);
    const qps = Number(((throughputSucceeded * 1000) / throughputDurationMs).toFixed(2));

    const status: BaselineReport['status'] =
      p95Ms < thresholds.latencyP95MsMax && wsSuccessRate >= thresholds.wsSuccessRateMin ? 'PASS' : 'FAIL';

    const report: BaselineReport = {
      generatedAt: new Date().toISOString(),
      status,
      thresholds,
      latency: {
        sampleCount: latencySamples.length,
        p50Ms,
        p95Ms,
        avgMs,
      },
      websocket: {
        attempts: wsAttempts,
        success: wsSuccess,
        successRate: wsSuccessRate,
      },
      throughput: {
        requests: throughputRequests,
        succeeded: throughputSucceeded,
        durationMs: Number(throughputDurationMs.toFixed(2)),
        qps,
      },
    };

    const jsonPath = path.join(reportsDir, 'phase14-performance-baseline.json');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');

    const mdLines: string[] = [
      '# Phase 14 Performance Baseline',
      '',
      `- Generated: ${report.generatedAt}`,
      `- Status: **${report.status}**`,
      '',
      '## Latency',
      '',
      `- Samples: ${report.latency.sampleCount}`,
      `- P50: ${report.latency.p50Ms} ms`,
      `- P95: ${report.latency.p95Ms} ms`,
      `- AVG: ${report.latency.avgMs} ms`,
      '',
      '## WebSocket Success',
      '',
      `- Attempts: ${report.websocket.attempts}`,
      `- Success: ${report.websocket.success}`,
      `- Success Rate: ${(report.websocket.successRate * 100).toFixed(2)}%`,
      '',
      '## Throughput',
      '',
      `- Requests: ${report.throughput.requests}`,
      `- Succeeded: ${report.throughput.succeeded}`,
      `- Duration: ${report.throughput.durationMs} ms`,
      `- QPS: ${report.throughput.qps}`,
      '',
      '## Thresholds',
      '',
      `- P95 latency < ${report.thresholds.latencyP95MsMax}ms`,
      `- WS success rate >= ${(report.thresholds.wsSuccessRateMin * 100).toFixed(2)}%`,
      '',
      `- JSON artifact: ${path.relative(root, jsonPath).replace(/\\/g, '/')}`,
    ];

    const mdPath = path.join(reportsDir, '2026-03-15_performance-baseline.md');
    fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf8');

    console.log(`phase14 performance report: ${mdPath}`);
    console.log(`phase14 performance json: ${jsonPath}`);

    if (status !== 'PASS') {
      process.exitCode = 1;
    }
  } finally {
    if (gateway) {
      await gateway.close({ reason: 'phase14 perf completed' });
    }
  }
}

run().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
