import path from "node:path";
import { fileURLToPath } from "node:url";

interface BaselineOptions {
  baseUrl: string;
  iterations: number;
}

interface ProbeMetric {
  endpoint: string;
  samplesMs: number[];
  success: number;
  failure: number;
}

function readOption(name: string, fallback?: string): string | undefined {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) {
    return direct.slice(name.length + 3);
  }

  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && index + 1 < process.argv.length) {
    return process.argv[index + 1];
  }

  return fallback;
}

function parseOptions(): BaselineOptions {
  return {
    baseUrl: readOption("base-url", "http://127.0.0.1:3000")!,
    iterations: Math.max(1, Number(readOption("iterations", "3"))),
  };
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index];
}

async function timedRequest(url: string, init?: RequestInit): Promise<{ ok: boolean; durationMs: number }> {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, init);
    await response.text();
    return {
      ok: response.ok,
      durationMs: Date.now() - startedAt,
    };
  } catch {
    return {
      ok: false,
      durationMs: Date.now() - startedAt,
    };
  }
}

async function probeMetric(metric: ProbeMetric, requestFactory: () => Promise<{ ok: boolean; durationMs: number }>): Promise<void> {
  const result = await requestFactory();
  metric.samplesMs.push(result.durationMs);
  if (result.ok) {
    metric.success += 1;
  } else {
    metric.failure += 1;
  }
}

export async function runAuthorityPerformanceBaseline(baseUrl: string, iterations = 3): Promise<any> {
  const metrics: ProbeMetric[] = [
    { endpoint: "POST /api/authority/agents/sync-live", samplesMs: [], success: 0, failure: 0 },
    { endpoint: "GET /api/authority/monitoring", samplesMs: [], success: 0, failure: 0 },
    { endpoint: "POST /api/authority/workflows/morning-brief/live", samplesMs: [], success: 0, failure: 0 },
    { endpoint: "POST /api/authority/governance/scenarios/budget-conflict", samplesMs: [], success: 0, failure: 0 },
  ];

  for (let index = 0; index < iterations; index += 1) {
    await probeMetric(metrics[0], () => timedRequest(`${baseUrl}/api/authority/agents/sync-live`, { method: "POST" }));
    await probeMetric(metrics[1], () => timedRequest(`${baseUrl}/api/authority/monitoring`));
    await probeMetric(metrics[2], () =>
      timedRequest(`${baseUrl}/api/authority/workflows/morning-brief/live`, { method: "POST" }),
    );
    await probeMetric(metrics[3], () =>
      timedRequest(`${baseUrl}/api/authority/governance/scenarios/budget-conflict`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: `Baseline budget scenario ${index + 1}`,
          requestedAmount: 750000 + index * 50000,
        }),
      }),
    );
  }

  return {
    checkedAt: new Date().toISOString(),
    baseUrl,
    iterations,
    metrics: metrics.map((metric) => ({
      endpoint: metric.endpoint,
      success: metric.success,
      failure: metric.failure,
      p50Ms: percentile(metric.samplesMs, 0.5),
      p95Ms: percentile(metric.samplesMs, 0.95),
      maxMs: metric.samplesMs.length ? Math.max(...metric.samplesMs) : 0,
    })),
  };
}

async function main(): Promise<void> {
  const options = parseOptions();
  const report = await runAuthorityPerformanceBaseline(options.baseUrl, options.iterations);
  console.log(JSON.stringify(report, null, 2));
  if (report.metrics.some((metric: any) => metric.failure > 0)) {
    process.exitCode = 1;
  }
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  main().catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, null, 2));
    process.exitCode = 1;
  });
}
