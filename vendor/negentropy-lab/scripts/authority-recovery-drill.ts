import path from "node:path";
import { fileURLToPath } from "node:url";

interface DrillOptions {
  baseUrl: string;
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

function parseOptions(): DrillOptions {
  return {
    baseUrl: readOption("base-url", "http://127.0.0.1:3000")!,
  };
}

async function requestJson(url: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status} ${response.statusText} ${JSON.stringify(body)}`);
  }
  return body;
}

export async function runAuthorityRecoveryDrill(baseUrl: string): Promise<any> {
  const snapshot = await requestJson(`${baseUrl}/api/authority/replication/snapshot`, {
    method: "POST",
  });
  const before = await requestJson(`${baseUrl}/api/authority/monitoring`);
  const recovery = await requestJson(`${baseUrl}/api/authority/replication/recover`, {
    method: "POST",
  });
  const after = await requestJson(`${baseUrl}/api/authority/ops`);

  return {
    drilledAt: new Date().toISOString(),
    baseUrl,
    snapshot,
    before: {
      status: before.status,
      healthScore: before.healthScore,
      alerts: before.alerts,
    },
    recovery,
    after: {
      status: after.status,
      healthScore: after.healthScore,
      alerts: after.alerts,
      recommendedActions: after.recommendedActions,
    },
  };
}

async function main(): Promise<void> {
  const options = parseOptions();
  const report = await runAuthorityRecoveryDrill(options.baseUrl);

  console.log(JSON.stringify(report, null, 2));

  if (!recovery.ok || !recovery.recovery?.recovered) {
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
