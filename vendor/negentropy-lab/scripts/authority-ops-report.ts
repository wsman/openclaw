import path from "node:path";
import { fileURLToPath } from "node:url";

interface CliOptions {
  url: string;
  failOn: "never" | "warning" | "critical";
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

function parseOptions(): CliOptions {
  const failOn = (readOption("fail-on", "critical") || "critical") as CliOptions["failOn"];
  return {
    url: readOption("url", "http://127.0.0.1:3000/api/authority/monitoring")!,
    failOn: ["never", "warning", "critical"].includes(failOn) ? failOn : "critical",
  };
}

export async function loadAuthorityOpsReport(url: string): Promise<any> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`monitoring request failed: ${response.status} ${response.statusText}`);
  }

  const snapshot = await response.json();
  return {
    checkedAt: new Date().toISOString(),
    url,
    status: snapshot.status,
    healthScore: snapshot.healthScore,
    alerts: snapshot.alerts,
    breaker: snapshot.breaker,
    replication: {
      status: snapshot.replication?.status,
      lastError: snapshot.replication?.lastError,
      warnings: snapshot.replication?.storage?.warnings || [],
    },
    sessions: snapshot.sessions,
  };
}

export function shouldFailAuthorityOpsReport(
  status: string,
  failOn: CliOptions["failOn"],
): boolean {
  return failOn === "warning"
    ? status === "warning" || status === "critical"
    : failOn === "critical"
      ? status === "critical"
      : false;
}

async function main(): Promise<void> {
  const options = parseOptions();
  const result = await loadAuthorityOpsReport(options.url);

  console.log(JSON.stringify(result, null, 2));

  if (shouldFailAuthorityOpsReport(result.status, options.failOn)) {
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
