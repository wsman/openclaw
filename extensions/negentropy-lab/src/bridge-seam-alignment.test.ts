import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NEGENTROPY_BRIDGE_ONLY_CONFIG_KEYS } from "./workflow-config.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(here, "..");
const repoRoot = path.resolve(extensionRoot, "..", "..");

function readText(relativePath: string): string {
  return fs.readFileSync(path.resolve(repoRoot, relativePath), "utf8");
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readText(relativePath)) as T;
}

describe("negentropy bridge seam alignment", () => {
  it("keeps bridge-only config keys stable in the plugin manifest", () => {
    const manifest = readJson<{
      description?: string;
      uiHints?: Record<string, { help?: string; placeholder?: string }>;
      configSchema?: { properties?: Record<string, { type?: string }> };
    }>("extensions/negentropy-lab/openclaw.plugin.json");

    expect(NEGENTROPY_BRIDGE_ONLY_CONFIG_KEYS).toEqual([
      "workflowEnabled",
      "orchestrationApiBaseUrl",
      "autoDispatchSubagents",
    ]);

    expect(manifest.description).toContain("bridge");
    expect(manifest.description).toContain("official");
    expect(manifest.description).toContain("host diagnostics");
    expect(manifest.configSchema?.properties?.workflowEnabled?.type).toBe("boolean");
    expect(manifest.configSchema?.properties?.orchestrationApiBaseUrl?.type).toBe("string");
    expect(manifest.configSchema?.properties?.autoDispatchSubagents?.type).toBe("boolean");
    expect(manifest.uiHints?.workflowEnabled?.help).toContain("Manual workflow bridge only");
    expect(manifest.uiHints?.workflowEnabled?.help).toContain("seam-only");
    expect(manifest.uiHints?.workflowEnabled?.help).toContain("control-plane ownership");
    expect(manifest.uiHints?.orchestrationApiBaseUrl?.placeholder).toContain(
      "/internal/openclaw/workflows",
    );
    expect(manifest.uiHints?.autoDispatchSubagents?.help).toContain("runtime.subagent.run");
    expect(manifest.uiHints?.autoDispatchSubagents?.help).toContain("workflow brain");
  });

  it("documents the bridge-only role with consolidated baselines", () => {
    const readme = readText("extensions/negentropy-lab/README.md");
    const pluginIndex = readText("extensions/negentropy-lab/index.ts");
    const postR1Roadmap = readText("custom/post-r1-active-roadmap.md");
    const customReadme = readText("custom/README.md");
    const discipline = readText("custom/negentropy-discipline.md");

    const readmeTokens = [
      "only official runtime entry",
      "runtime bridge layer",
      "host-visible diagnostics carrier",
      "control-plane owner",
      "vendor/negentropy-lab",
      "sourceRoot",
      "vendor snapshot",
      "contract consumer model",
      "custom/negentropy-baselines.json",
      "decision contract snapshot version",
      "workflow contract snapshot version",
      "host diagnostics surface version",
      "host memory summary contract snapshot version",
      "business artifact absorb contract snapshot version",
      "skill candidate absorb contract snapshot version",
      "memory-business projection contract snapshot version",
      "read-only snapshot or fixture inputs",
      "vendor runtime-owner implementation files are not part of the consumer model",
      "workflowEnabled",
      "orchestrationApiBaseUrl",
      "autoDispatchSubagents",
      "global autonomous orchestration",
      "runtime.subagent.run",
      "AuthorityState",
      "ResultEnvelope",
      "smallpond-evo",
      "external capability service",
      "write-back owner",
      "mirror-only and bridge-only",
    ];
    for (const token of readmeTokens) {
      expect(readme).toContain(token);
    }

    expect(customReadme).toContain("custom/negentropy-baselines.json");
    expect(customReadme).toContain("custom/negentropy-discipline.md");
    expect(customReadme).toContain("custom:negentropy:check-bridge-seam");

    const disciplineTokens = [
      "only official runtime entry",
      "workflowEnabled",
      "orchestrationApiBaseUrl",
      "autoDispatchSubagents",
      "runtime.subagent.run",
      "AuthorityState",
      "ResultEnvelope",
      "smallpond-evo",
      "contract consumer packaging",
      "minimal-vendor-snapshot",
    ];
    for (const token of disciplineTokens) {
      expect(discipline).toContain(token);
    }

    expect(postR1Roadmap).toContain(
      "`U1 = upstream compatibility hardening` is complete and closed",
    );
    expect(postR1Roadmap).toContain(
      "`E4 = operator-controlled selected-owner opt-in` is complete and closed",
    );
    expect(postR1Roadmap).toContain(
      "There is no required next implementation lane on the current integration track",
    );
    expect(pluginIndex).toContain("official");
    expect(pluginIndex).toContain("runtime bridge");
    expect(pluginIndex).toContain("contract consumer");
    expect(pluginIndex).toContain("host-visible diagnostics");
  });

  it("freezes the extension contract consumer baseline inside the consolidated baseline file", () => {
    const baselineFile = readJson<{
      bridge: {
        vendor: {
          canonicalDecisionContractPath: string;
          canonicalWorkflowContractPath: string;
        };
      };
      extensionConsumer: {
        version: string;
        extension: {
          relativePath: string;
          customReadmePath: string;
          bridgeDisciplinePath: string;
          diagnosticsHelperPath: string;
          requiredCustomReadmeTokens: string[];
          requiredBridgeDisciplineTokens: string[];
          requiredDiagnosticsTokens: string[];
          consumers: Record<
            string,
            {
              canonicalSourcePath: string;
              localConsumedFormPath: string;
              anchorPath: string;
              anchorToken: string;
              version: string;
            }
          >;
        };
      };
    }>("custom/negentropy-baselines.json");

    const customReadme = readText(baselineFile.extensionConsumer.extension.customReadmePath);
    const discipline = readText(baselineFile.extensionConsumer.extension.bridgeDisciplinePath);
    const diagnosticsHelper = readText(
      baselineFile.extensionConsumer.extension.diagnosticsHelperPath,
    );

    expect(baselineFile.extensionConsumer.version.length).toBeGreaterThan(0);
    expect(baselineFile.extensionConsumer.extension.relativePath).toBe("extensions/negentropy-lab");

    for (const token of baselineFile.extensionConsumer.extension.requiredCustomReadmeTokens) {
      expect(customReadme).toContain(token);
    }
    for (const token of baselineFile.extensionConsumer.extension.requiredBridgeDisciplineTokens) {
      expect(discipline).toContain(token);
    }
    for (const token of baselineFile.extensionConsumer.extension.requiredDiagnosticsTokens) {
      expect(diagnosticsHelper).toContain(token);
    }

    expect(
      baselineFile.extensionConsumer.extension.consumers.decisionContractSnapshot
        .canonicalSourcePath,
    ).toBe(baselineFile.bridge.vendor.canonicalDecisionContractPath);
    expect(
      baselineFile.extensionConsumer.extension.consumers.workflowContractSnapshot
        .canonicalSourcePath,
    ).toBe(baselineFile.bridge.vendor.canonicalWorkflowContractPath);
    expect(
      baselineFile.extensionConsumer.extension.consumers.hostDiagnosticsSurface.canonicalSourcePath,
    ).toBe("custom/negentropy-baselines.json");
    expect(
      baselineFile.extensionConsumer.extension.consumers.hostMemorySummaryContractSnapshot
        .canonicalSourcePath,
    ).toBe("vendor/negentropy-lab/server/gateway/contracts/host-memory-summary-contract.ts");
    expect(
      baselineFile.extensionConsumer.extension.consumers.businessArtifactAbsorbContractSnapshot
        .canonicalSourcePath,
    ).toBe("vendor/negentropy-lab/server/gateway/contracts/business-artifact-absorb-contract.ts");
    expect(
      baselineFile.extensionConsumer.extension.consumers.skillCandidateAbsorbContractSnapshot
        .canonicalSourcePath,
    ).toBe("vendor/negentropy-lab/server/gateway/contracts/skill-candidate-absorb-contract.ts");
    expect(
      baselineFile.extensionConsumer.extension.consumers.memoryBusinessProjectionContractSnapshot
        .canonicalSourcePath,
    ).toBe("vendor/negentropy-lab/server/gateway/contracts/memory-business-projection-contract.ts");

    for (const consumer of Object.values(baselineFile.extensionConsumer.extension.consumers)) {
      expect(readText(consumer.anchorPath)).toContain(consumer.anchorToken);
      expect(readText(consumer.localConsumedFormPath)).toBeTruthy();
      expect(consumer.version.length).toBeGreaterThan(0);
    }
  });

  it("keeps the contract snapshot and request bridge on the local seam", () => {
    const snapshot = readText("extensions/negentropy-lab/src/decision-contract.snapshot.ts");
    const alignmentTest = readText(
      "extensions/negentropy-lab/src/decision-contract-alignment.test.ts",
    );
    const gatewayRequest = readText("extensions/negentropy-lab/src/gateway-request.ts");

    expect(snapshot).toContain(
      "vendor/negentropy-lab/server/gateway/openclaw-decision/contracts/decision-contract.ts",
    );
    expect(alignmentTest).toContain("./decision-contract.snapshot.js");
    expect(alignmentTest).toContain(
      "../../../vendor/negentropy-lab/server/gateway/openclaw-decision/contracts/decision-contract.js",
    );
    expect(gatewayRequest).toContain('from "./decision-contract.snapshot.js"');
    expect(gatewayRequest).not.toContain("vendor/negentropy-lab");
  });

  it("keeps workflow dispatch on runtime.subagent.run without write-back semantics", () => {
    const workflowConfig = readText("extensions/negentropy-lab/src/workflow-config.ts");
    const workflowBridge = readText("extensions/negentropy-lab/src/workflow-bridge.ts");
    const workflowTypes = readText("extensions/negentropy-lab/src/workflow-types.ts");
    const diagnosticsHelper = readText("extensions/negentropy-lab/src/diagnostics.ts");
    const memoryBusinessSnapshot = readText(
      "extensions/negentropy-lab/src/memory-business-contracts.snapshot.ts",
    );

    expect(workflowConfig).toContain("NEGENTROPY_WORKFLOW_API_URL");
    expect(workflowConfig).toContain("workflowEnabled");
    expect(workflowConfig).toContain("orchestrationApiBaseUrl");
    expect(workflowConfig).toContain("autoDispatchSubagents");
    expect(workflowConfig).toContain("/internal/openclaw/workflows");

    expect(workflowBridge).toContain("params.runtime.subagent.run");
    expect(workflowBridge).toContain("spawn_subagent");
    expect(workflowBridge).not.toContain("AuthorityState");

    expect(workflowTypes).toContain("WorkflowEventPayload");
    expect(workflowTypes).toContain('"spawn_subagent"');
    expect(workflowTypes).toContain('"send_session_message"');
    expect(workflowTypes).toContain('"trace"');

    expect(diagnosticsHelper).toContain("consumerBaselineVersion");
    expect(diagnosticsHelper).toContain("workflowContractSnapshotVersion");
    expect(diagnosticsHelper).toContain("hostDiagnosticsSurfaceVersion");
    expect(diagnosticsHelper).toContain("hostMemorySummaryContractVersion");
    expect(diagnosticsHelper).toContain("businessArtifactAbsorbContractVersion");
    expect(diagnosticsHelper).toContain("skillCandidateAbsorbContractVersion");
    expect(diagnosticsHelper).toContain("memoryBusinessProjectionContractVersion");

    expect(memoryBusinessSnapshot).toContain("HOST_MEMORY_SUMMARY_CONTRACT_SNAPSHOT_VERSION");
    expect(memoryBusinessSnapshot).toContain("BUSINESS_ARTIFACT_ABSORB_CONTRACT_SNAPSHOT_VERSION");
    expect(memoryBusinessSnapshot).toContain("SKILL_CANDIDATE_ABSORB_CONTRACT_SNAPSHOT_VERSION");
    expect(memoryBusinessSnapshot).toContain(
      "MEMORY_BUSINESS_PROJECTION_CONTRACT_SNAPSHOT_VERSION",
    );
    expect(memoryBusinessSnapshot).toContain(
      "MEMORY_BUSINESS_EVIDENCE_LINK_FIELDS_SNAPSHOT_VERSION",
    );
    expect(memoryBusinessSnapshot).toContain(
      "MEMORY_BUSINESS_EVIDENCE_LINK_REQUIRED_FIELDS_SNAPSHOT",
    );
    expect(memoryBusinessSnapshot).toContain(
      "vendor/negentropy-lab/server/gateway/contracts/host-memory-summary-contract.ts",
    );
    expect(memoryBusinessSnapshot).toContain(
      "vendor/negentropy-lab/server/gateway/control-plane-contracts.ts",
    );
    expect(memoryBusinessSnapshot).not.toContain("AuthorityState");
    expect(memoryBusinessSnapshot).not.toContain("ResultEnvelope");
    expect(memoryBusinessSnapshot).not.toContain("smallpond-evo");
  });

  it("keeps extension runtime files free of vendored runtime-owner imports and direct capability coupling", () => {
    const files = [
      "extensions/negentropy-lab/index.ts",
      "extensions/negentropy-lab/src/decision-bridge.ts",
      "extensions/negentropy-lab/src/diagnostics.ts",
      "extensions/negentropy-lab/src/gateway-request.ts",
      "extensions/negentropy-lab/src/memory-business-contracts.snapshot.ts",
      "extensions/negentropy-lab/src/workflow-bridge.ts",
      "extensions/negentropy-lab/src/workflow-client.ts",
      "extensions/negentropy-lab/src/workflow-command.ts",
      "extensions/negentropy-lab/src/workflow-config.ts",
      "extensions/negentropy-lab/src/workflow-events.ts",
    ];

    const forbiddenTokens = [
      "vendor/negentropy-lab/server/gateway/openclaw-decision/api/",
      "vendor/negentropy-lab/server/gateway/openclaw-decision/bridge/",
      "vendor/negentropy-lab/server/gateway/openclaw-decision/config/",
      "vendor/negentropy-lab/server/gateway/openclaw-decision/observability/",
      "vendor/negentropy-lab/server/gateway/openclaw-decision/policy/",
      "vendor/negentropy-lab/server/gateway/openclaw-decision/resilience/",
      "vendor/negentropy-lab/server/gateway/openclaw-decision/scripts/",
      "vendor/negentropy-lab/server/gateway/openclaw-decision/security/",
      "vendor/negentropy-lab/server/gateway/openclaw-decision/translator/",
      "vendor/negentropy-lab/server/gateway/openclaw-orchestration/actions/",
      "vendor/negentropy-lab/server/gateway/openclaw-orchestration/api/",
      "vendor/negentropy-lab/server/gateway/openclaw-orchestration/runtime/",
      "vendor/negentropy-lab/server/gateway/openclaw-orchestration/service/",
      "smallpond-evo",
      "AuthorityState",
      "ResultEnvelope",
    ];

    for (const relativePath of files) {
      const text = readText(relativePath);
      for (const token of forbiddenTokens) {
        expect(text).not.toContain(token);
      }
    }
  });
});
