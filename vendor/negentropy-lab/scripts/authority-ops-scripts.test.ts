import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetAuthorityRuntime } from "../server/runtime/authorityRuntime";
import { createNegentropyServer, NegentropyServerInstance } from "../server/bootstrap/createNegentropyServer";
import { runAuthorityClusterValidation } from "./authority-cluster-validation";
import { loadAuthorityOpsReport, shouldFailAuthorityOpsReport } from "./authority-ops-report";
import { runAuthorityPerformanceBaseline } from "./authority-performance-baseline";
import { runAuthorityRecoveryDrill } from "./authority-recovery-drill";

const authorityStorageDir = path.resolve(process.cwd(), "storage", "authority");

let server: NegentropyServerInstance | null = null;

beforeEach(() => {
  resetAuthorityRuntime();
  fs.rmSync(authorityStorageDir, { recursive: true, force: true });
});

afterEach(async () => {
  if (server) {
    await server.stop();
    server = null;
  }
  resetAuthorityRuntime();
  fs.rmSync(authorityStorageDir, { recursive: true, force: true });
});

describe("authority ops scripts", () => {
  it("queries monitoring and executes recovery drill against a live authority server", async () => {
    server = await createNegentropyServer({
      port: 0,
      host: "127.0.0.1",
      autoStart: true,
      registerSignalHandlers: false,
      cluster: { enabled: false },
      discovery: { enabled: false },
    });

    const address = server.httpServer.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const baseUrl = `http://127.0.0.1:${port}`;

    const report = await loadAuthorityOpsReport(`${baseUrl}/api/authority/monitoring`);
    expect(report.status).toBeTruthy();
    expect(shouldFailAuthorityOpsReport(report.status, "never")).toBe(false);

    const drill = await runAuthorityRecoveryDrill(baseUrl);
    expect(drill.snapshot.ok).toBe(true);
    expect(drill.recovery.ok).toBe(true);
    expect(drill.recovery.recovery.recovered).toBe(true);

    const baseline = await runAuthorityPerformanceBaseline(baseUrl, 1);
    expect(baseline.metrics.length).toBeGreaterThan(0);
    expect(baseline.metrics.every((metric: any) => metric.failure === 0)).toBe(true);
  });

  it("validates a live single-node authority cluster endpoint set", async () => {
    server = await createNegentropyServer({
      port: 0,
      host: "127.0.0.1",
      autoStart: true,
      registerSignalHandlers: false,
      cluster: {
        enabled: true,
        metadata: {
          region: "cn-east-1",
        },
        capabilities: ["gateway", "authority", "mcp"],
      },
      discovery: { enabled: false },
    });

    const address = server.httpServer.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const baseUrl = `http://127.0.0.1:${port}`;

    const report = await runAuthorityClusterValidation([baseUrl], {
      expectedNodeCount: 1,
      requireLeader: true,
    });

    expect(report.status).toBe("PASS");
    expect(report.leaderCount).toBe(1);
    expect(report.nodes[0].leaderNodeId).toBe(report.nodes[0].localNodeId);
  });
});
