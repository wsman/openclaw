import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import childProcess from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(childProcess.exec);

export interface AuthorityClusterRehearshalOptions {
  scenario: "leader-kill" | "follower-restart" | "network-partition" | "full-restart" | "all";
  baseUrls: string[];
  expectedNodeCount: number;
  failoverTimeoutMs: number;
  revalidationRetries: number;
  revalidationDelayMs: number;
  dockerComposePath?: string;
}

export interface RehearshalScenarioResult {
  name: string;
  pass: boolean;
  startTime: string;
  endTime: string;
  durationMs: number;
  initialLeaderNodeId: string;
  finalLeaderNodeId: string;
  failoverOccurred: boolean;
  failoverTimeMs: number;
  details: Record<string, unknown>;
  errors: string[];
}

export interface AuthorityClusterRehearshalReport {
  generatedAt: string;
  status: "PASS" | "FAIL";
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  scenarios: RehearshalScenarioResult[];
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

async function requestJson(url: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status} ${response.statusText}`);
  }
  return body;
}

async function getClusterStatus(baseUrl: string): Promise<{
  clusterId: string;
  localNodeId: string;
  leaderNodeId: string;
  role: string;
  syncStatus: string;
  activeNodeCount: number;
}> {
  const status = await requestJson(`${baseUrl}/api/authority/cluster/status`);
  return {
    clusterId: status.cluster?.clusterId || "",
    localNodeId: status.cluster?.localNodeId || "",
    leaderNodeId: status.cluster?.leaderNodeId || "",
    role: status.cluster?.role || "standalone",
    syncStatus: status.cluster?.syncStatus || "idle",
    activeNodeCount: status.cluster?.activeNodeCount || 0,
  };
}

async function waitForHealthyCluster(
  baseUrls: string[],
  expectedNodeCount: number,
  timeoutMs: number,
  delayMs: number = 1000,
): Promise<{ leaderNodeId: string; nodes: Map<string, any> }> {
  const startTime = Date.now();
  const nodes = new Map<string, any>();

  while (Date.now() - startTime < timeoutMs) {
    nodes.clear();
    let leaderCount = 0;
    let leaderNodeId = "";

    for (const baseUrl of baseUrls) {
      try {
        const status = await getClusterStatus(baseUrl);
        nodes.set(baseUrl, status);
        if (status.role === "leader") {
          leaderCount++;
          leaderNodeId = status.leaderNodeId;
        }
      } catch {
        // Node not ready yet
      }
    }

    if (leaderCount === 1 && nodes.size >= expectedNodeCount) {
      return { leaderNodeId, nodes };
    }

    await sleep(delayMs);
  }

  throw new Error(`Cluster did not become healthy within ${timeoutMs}ms`);
}

async function waitForLeaderChange(
  baseUrls: string[],
  previousLeaderNodeId: string,
  timeoutMs: number,
  delayMs: number = 500,
): Promise<{ newLeaderNodeId: string; failoverTimeMs: number }> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    for (const baseUrl of baseUrls) {
      try {
        const status = await getClusterStatus(baseUrl);
        if (status.role === "leader" && status.leaderNodeId !== previousLeaderNodeId) {
          return {
            newLeaderNodeId: status.leaderNodeId,
            failoverTimeMs: Date.now() - startTime,
          };
        }
      } catch {
        // Node not ready
      }
    }
    await sleep(delayMs);
  }

  throw new Error(`Leader change did not occur within ${timeoutMs}ms`);
}

async function stopDockerContainer(containerName: string): Promise<void> {
  try {
    await exec(`docker stop ${containerName}`);
  } catch (error: any) {
    throw new Error(`Failed to stop container ${containerName}: ${error.message}`);
  }
}

async function startDockerContainer(containerName: string): Promise<void> {
  try {
    await exec(`docker start ${containerName}`);
  } catch (error: any) {
    throw new Error(`Failed to start container ${containerName}: ${error.message}`);
  }
}

async function restartDockerContainer(containerName: string): Promise<void> {
  try {
    await exec(`docker restart ${containerName}`);
  } catch (error: any) {
    throw new Error(`Failed to restart container ${containerName}: ${error.message}`);
  }
}

function getContainerNameForUrl(baseUrl: string, baseUrls: string[]): string {
  const index = baseUrls.indexOf(baseUrl);
  const port = parseInt(baseUrl.split(":").pop() || "3311", 10);
  const nodeLetters = ["a", "b", "c"];
  const nodeIndex = port - 3311;
  if (nodeIndex >= 0 && nodeIndex < nodeLetters.length) {
    return `authority-node-${nodeLetters[nodeIndex]}`;
  }
  throw new Error(`Cannot determine container name for ${baseUrl}`);
}

async function sleepForRevalidation(
  options: AuthorityClusterRehearshalOptions,
  multiplier: number = 1,
  minimumMs: number = 0,
): Promise<void> {
  const durationMs = Math.max(minimumMs, options.revalidationDelayMs * multiplier);
  await sleep(durationMs);
}

async function runLeaderKillScenario(
  options: AuthorityClusterRehearshalOptions,
): Promise<RehearshalScenarioResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let failoverOccurred = false;
  let failoverTimeMs = 0;
  let finalLeaderNodeId = "";
  const details: Record<string, unknown> = {};

  try {
    // Step 1: Get initial cluster state
    const initialState = await waitForHealthyCluster(
      options.baseUrls,
      options.expectedNodeCount,
      options.failoverTimeoutMs,
    );
    const initialLeaderNodeId = initialState.leaderNodeId;
    details.initialState = {
      leaderNodeId: initialLeaderNodeId,
      nodeCount: initialState.nodes.size,
    };

    // Step 2: Find the leader node URL
    let leaderUrl = "";
    for (const [url, status] of initialState.nodes) {
      if (status.role === "leader") {
        leaderUrl = url;
        break;
      }
    }

    if (!leaderUrl) {
      throw new Error("Could not find leader URL");
    }

    // Step 3: Kill the leader container
    const leaderContainer = getContainerNameForUrl(leaderUrl, options.baseUrls);
    details.leaderContainer = leaderContainer;
    await stopDockerContainer(leaderContainer);

    // Step 4: Wait for failover
    const remainingUrls = options.baseUrls.filter((url) => url !== leaderUrl);
    const failoverResult = await waitForLeaderChange(
      remainingUrls,
      initialLeaderNodeId,
      options.failoverTimeoutMs,
    );
    failoverOccurred = true;
    failoverTimeMs = failoverResult.failoverTimeMs;
    finalLeaderNodeId = failoverResult.newLeaderNodeId;
    details.failover = {
      newLeaderNodeId: finalLeaderNodeId,
      failoverTimeMs,
    };

    // Step 5: Restart the killed leader
    await startDockerContainer(leaderContainer);

    // Step 6: Wait for cluster to stabilize
    await sleepForRevalidation(options);
    for (let i = 0; i < options.revalidationRetries; i++) {
      try {
        const finalState = await waitForHealthyCluster(
          options.baseUrls,
          options.expectedNodeCount,
          options.failoverTimeoutMs,
        );
        details.finalState = {
          leaderNodeId: finalState.leaderNodeId,
          nodeCount: finalState.nodes.size,
        };
        break;
      } catch (error: any) {
        if (i === options.revalidationRetries - 1) {
          throw error;
        }
        await sleepForRevalidation(options);
      }
    }
  } catch (error: any) {
    errors.push(error.message);
  }

  const endTime = Date.now();
  return {
    name: "leader-kill",
    pass: errors.length === 0 && failoverOccurred,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    durationMs: endTime - startTime,
    initialLeaderNodeId: (details.initialState as any)?.leaderNodeId || "",
    finalLeaderNodeId,
    failoverOccurred,
    failoverTimeMs,
    details,
    errors,
  };
}

async function runFollowerRestartScenario(
  options: AuthorityClusterRehearshalOptions,
): Promise<RehearshalScenarioResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const details: Record<string, unknown> = {};

  try {
    // Step 1: Get initial cluster state
    const initialState = await waitForHealthyCluster(
      options.baseUrls,
      options.expectedNodeCount,
      options.failoverTimeoutMs,
    );
    const initialLeaderNodeId = initialState.leaderNodeId;
    details.initialState = {
      leaderNodeId: initialLeaderNodeId,
      nodeCount: initialState.nodes.size,
    };

    // Step 2: Find a follower node URL
    let followerUrl = "";
    for (const [url, status] of initialState.nodes) {
      if (status.role === "follower") {
        followerUrl = url;
        break;
      }
    }

    if (!followerUrl) {
      throw new Error("Could not find follower URL");
    }

    // Step 3: Restart the follower container
    const followerContainer = getContainerNameForUrl(followerUrl, options.baseUrls);
    details.followerContainer = followerContainer;
    await restartDockerContainer(followerContainer);

    // Step 4: Wait for cluster to stabilize
    await sleepForRevalidation(options);
    for (let i = 0; i < options.revalidationRetries; i++) {
      try {
        const finalState = await waitForHealthyCluster(
          options.baseUrls,
          options.expectedNodeCount,
          options.failoverTimeoutMs,
        );
        details.finalState = {
          leaderNodeId: finalState.leaderNodeId,
          nodeCount: finalState.nodes.size,
          sameLeader: finalState.leaderNodeId === initialLeaderNodeId,
        };
        // Verify leader didn't change
        if (finalState.leaderNodeId !== initialLeaderNodeId) {
          throw new Error("Leader changed during follower restart");
        }
        break;
      } catch (error: any) {
        if (i === options.revalidationRetries - 1) {
          throw error;
        }
        await sleepForRevalidation(options);
      }
    }
  } catch (error: any) {
    errors.push(error.message);
  }

  const endTime = Date.now();
  return {
    name: "follower-restart",
    pass: errors.length === 0,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    durationMs: endTime - startTime,
    initialLeaderNodeId: (details.initialState as any)?.leaderNodeId || "",
    finalLeaderNodeId: (details.finalState as any)?.leaderNodeId || "",
    failoverOccurred: false,
    failoverTimeMs: 0,
    details,
    errors,
  };
}

async function runFullRestartScenario(
  options: AuthorityClusterRehearshalOptions,
): Promise<RehearshalScenarioResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const details: Record<string, unknown> = {};

  try {
    // Step 1: Get initial cluster state
    const initialState = await waitForHealthyCluster(
      options.baseUrls,
      options.expectedNodeCount,
      options.failoverTimeoutMs,
    );
    const initialLeaderNodeId = initialState.leaderNodeId;
    details.initialState = {
      leaderNodeId: initialLeaderNodeId,
      nodeCount: initialState.nodes.size,
    };

    // Step 2: Stop all nodes in reverse order
    const containers = ["authority-node-c", "authority-node-b", "authority-node-a"];
    for (const container of containers) {
      await stopDockerContainer(container);
      await sleepForRevalidation(options, 1, 50);
    }
    details.stoppedContainers = containers;

    // Step 3: Wait a moment
    await sleepForRevalidation(options, 2, 100);

    // Step 4: Start all nodes in order
    const startContainers = ["authority-node-a", "authority-node-b", "authority-node-c"];
    for (const container of startContainers) {
      await startDockerContainer(container);
      await sleepForRevalidation(options, 1, 50);
    }
    details.startedContainers = startContainers;

    // Step 5: Wait for cluster to stabilize
    await sleepForRevalidation(options, 2);
    for (let i = 0; i < options.revalidationRetries * 2; i++) {
      try {
        const finalState = await waitForHealthyCluster(
          options.baseUrls,
          options.expectedNodeCount,
          options.failoverTimeoutMs * 2,
        );
        details.finalState = {
          leaderNodeId: finalState.leaderNodeId,
          nodeCount: finalState.nodes.size,
        };
        break;
      } catch (error: any) {
        if (i === options.revalidationRetries * 2 - 1) {
          throw error;
        }
        await sleepForRevalidation(options);
      }
    }
  } catch (error: any) {
    errors.push(error.message);
  }

  const endTime = Date.now();
  return {
    name: "full-restart",
    pass: errors.length === 0,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    durationMs: endTime - startTime,
    initialLeaderNodeId: (details.initialState as any)?.leaderNodeId || "",
    finalLeaderNodeId: (details.finalState as any)?.leaderNodeId || "",
    failoverOccurred: (details.initialState as any)?.leaderNodeId !== (details.finalState as any)?.leaderNodeId,
    failoverTimeMs: 0,
    details,
    errors,
  };
}

async function runNetworkPartitionScenario(
  options: AuthorityClusterRehearshalOptions,
): Promise<RehearshalScenarioResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const details: Record<string, unknown> = {};

  try {
    // Step 1: Get initial cluster state
    const initialState = await waitForHealthyCluster(
      options.baseUrls,
      options.expectedNodeCount,
      options.failoverTimeoutMs,
    );
    const initialLeaderNodeId = initialState.leaderNodeId;
    details.initialState = {
      leaderNodeId: initialLeaderNodeId,
      nodeCount: initialState.nodes.size,
    };

    // Step 2: Simulate network partition by stopping Redis
    await stopDockerContainer("authority-redis-staging");
    details.partitionSimulated = true;

    // Step 3: Wait for partition duration
    await sleepForRevalidation(options, 2, 100);

    // Step 4: Restore Redis
    await startDockerContainer("authority-redis-staging");
    details.partitionRestored = true;

    // Step 5: Wait for cluster to stabilize
    await sleepForRevalidation(options, 2);
    for (let i = 0; i < options.revalidationRetries * 2; i++) {
      try {
        const finalState = await waitForHealthyCluster(
          options.baseUrls,
          options.expectedNodeCount,
          options.failoverTimeoutMs * 2,
        );
        details.finalState = {
          leaderNodeId: finalState.leaderNodeId,
          nodeCount: finalState.nodes.size,
        };
        break;
      } catch (error: any) {
        if (i === options.revalidationRetries * 2 - 1) {
          throw error;
        }
        await sleepForRevalidation(options);
      }
    }
  } catch (error: any) {
    errors.push(error.message);
  }

  const endTime = Date.now();
  return {
    name: "network-partition",
    pass: errors.length === 0,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    durationMs: endTime - startTime,
    initialLeaderNodeId: (details.initialState as any)?.leaderNodeId || "",
    finalLeaderNodeId: (details.finalState as any)?.leaderNodeId || "",
    failoverOccurred: false,
    failoverTimeMs: 0,
    details,
    errors,
  };
}

export async function runAuthorityClusterRehearshal(
  options: AuthorityClusterRehearshalOptions,
): Promise<AuthorityClusterRehearshalReport> {
  const scenarios: RehearshalScenarioResult[] = [];

  if (options.scenario === "all" || options.scenario === "leader-kill") {
    scenarios.push(await runLeaderKillScenario(options));
  }

  if (options.scenario === "all" || options.scenario === "follower-restart") {
    scenarios.push(await runFollowerRestartScenario(options));
  }

  if (options.scenario === "all" || options.scenario === "network-partition") {
    scenarios.push(await runNetworkPartitionScenario(options));
  }

  if (options.scenario === "all" || options.scenario === "full-restart") {
    scenarios.push(await runFullRestartScenario(options));
  }

  const passedScenarios = scenarios.filter((s) => s.pass).length;
  const failedScenarios = scenarios.length - passedScenarios;

  return {
    generatedAt: new Date().toISOString(),
    status: failedScenarios === 0 ? "PASS" : "FAIL",
    totalScenarios: scenarios.length,
    passedScenarios,
    failedScenarios,
    scenarios,
  };
}

function parseOptions(): AuthorityClusterRehearshalOptions {
  const baseUrls = (readOption("base-urls", "http://127.0.0.1:3311,http://127.0.0.1:3312,http://127.0.0.1:3313") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    scenario: (readOption("scenario", "all") as any) || "all",
    baseUrls,
    expectedNodeCount: Number(readOption("expected-node-count", "3")),
    failoverTimeoutMs: Number(readOption("failover-timeout-ms", "15000")),
    revalidationRetries: Number(readOption("revalidation-retries", "5")),
    revalidationDelayMs: Number(readOption("revalidation-delay-ms", "2000")),
    dockerComposePath: readOption("docker-compose-path"),
  };
}

async function main(): Promise<void> {
  const options = parseOptions();
  const report = await runAuthorityClusterRehearshal(options);
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const outputPath = path.join(process.cwd(), "reports", `authority-cluster-rehearshal-${ts}.json`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ reportPath: outputPath, ...report }, null, 2));
  if (report.status !== "PASS") {
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
