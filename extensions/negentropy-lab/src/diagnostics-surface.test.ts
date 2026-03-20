import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildHostFacingDiagnostics,
  formatHostFacingDiagnostics,
  type ReachabilityDiagnostic,
} from "./diagnostics.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(here, "..");
const repoRoot = path.resolve(extensionRoot, "..", "..");

function readText(relativePath: string): string {
  return fs.readFileSync(path.resolve(repoRoot, relativePath), "utf8");
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readText(relativePath)) as T;
}

describe("negentropy diagnostics surface", () => {
  it("formats host-facing diagnostics without control-plane internals", () => {
    const baselineFile = readJson<{
      diagnostics: {
        version: string;
        extension: {
          requiredTopLevelKeys: string[];
          requiredStatusTokens: string[];
          forbiddenStatusTokens: string[];
        };
      };
    }>("custom/negentropy-baselines.json");
    const baseline = baselineFile.diagnostics;

    const reachable: ReachabilityDiagnostic = {
      reachable: true,
      checkedUrl: "http://127.0.0.1:3000/internal/openclaw/status",
      detail: "HTTP 200",
    };

    const diagnostics = buildHostFacingDiagnostics({
      extensionMode: "ENFORCE",
      failClosed: false,
      rollbackSwitchEnabled: true,
      workflowBridge: {
        workflowEnabled: true,
        orchestrationApiBaseUrl: "http://127.0.0.1:3000/internal/openclaw/workflows",
        autoDispatchSubagents: true,
      },
      decisionApi: reachable,
      workflowApi: {
        reachable: false,
        checkedUrl: "http://127.0.0.1:3000/internal/openclaw/workflows?limit=1",
        detail: "HTTP 503",
      },
      repoLocal: {
        diagnosticsBaselineVersion: baseline.version,
        consumerBaselineVersion: "2026-03-21-m1",
        contractSnapshotVersion: "1.0.0",
        workflowContractSnapshotVersion: "1.0.0",
        hostDiagnosticsSurfaceVersion: "2026-03-21-m1",
        hostMemorySummaryContractVersion: "2026-03-19-n6a1",
        businessArtifactAbsorbContractVersion: "2026-03-20-n6c1",
        skillCandidateAbsorbContractVersion: "2026-03-20-n6c1",
        memoryBusinessProjectionContractVersion: "2026-03-19-n6a1",
        minimalVendorSnapshotVersion: {
          allowlistVersion: "2026-03-21-m1",
          driftBaselineVersion: "2026-03-21-m1",
        },
        discipline: {
          sourceRoot: "external-source-truth",
          vendorRoot: "minimal-vendor-snapshot",
          extensionRoot: "runtime-bridge",
        },
        sourceRoot: {
          path: "D:/external/Negentropy-Lab",
          reachable: true,
        },
      },
    });

    expect(Object.keys(diagnostics)).toEqual(
      expect.arrayContaining(baseline.extension.requiredTopLevelKeys),
    );

    const text = formatHostFacingDiagnostics(diagnostics);
    for (const token of baseline.extension.requiredStatusTokens) {
      expect(text).toContain(token);
    }
    for (const token of baseline.extension.forbiddenStatusTokens) {
      expect(text).not.toContain(token);
    }
  });

  it("documents the diagnostics surface in the extension README", () => {
    const baselineFile = readJson<{
      diagnostics: {
        extension: {
          requiredReadmeTokens: string[];
        };
      };
    }>("custom/negentropy-baselines.json");
    const readme = readText("extensions/negentropy-lab/README.md");

    for (const token of baselineFile.diagnostics.extension.requiredReadmeTokens) {
      expect(readme).toContain(token);
    }
  });
});
