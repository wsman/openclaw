import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(here, "..");
const repoRoot = path.resolve(extensionRoot, "..", "..");

function readText(relativePath: string): string {
  return fs.readFileSync(path.resolve(repoRoot, relativePath), "utf8");
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readText(relativePath)) as T;
}

describe("memory-duckdb seam discipline", () => {
  it("keeps the manifest and consolidated docs aligned to side-by-side slot ownership", () => {
    const manifest = readJson<{
      kind?: string;
      description?: string;
      configSchema?: { properties?: Record<string, unknown> };
    }>("extensions/memory-duckdb/openclaw.plugin.json");
    const readme = readText("extensions/memory-duckdb/README.md");
    const architecture = readText("extensions/memory-duckdb/docs/ARCHITECTURE.md");
    const operations = readText("extensions/memory-duckdb/docs/OPERATIONS.md");
    const postR1Roadmap = readText("custom/post-r1-active-roadmap.md");
    const combined = [readme, architecture, operations, postR1Roadmap].join("\n");

    expect(manifest.kind).toBe("memory");
    expect(manifest.description).toContain("Side-by-side");
    expect(manifest.description).toContain("slot-selected");
    expect(Object.keys(manifest.configSchema?.properties ?? {})).toEqual(
      expect.arrayContaining([
        "storagePath",
        "duckdbPath",
        "runtimeMode",
        "native",
        "ingest",
        "replay",
        "shadow",
        "diagnostics",
      ]),
    );

    expect(readme).toContain("host-side memory runtime owner candidate");
    expect(readme).toContain("host-side runtime owner chain");
    expect(readme).toContain("extensions/negentropy-lab");
    expect(readme).toContain("vendor/negentropy-lab");
    expect(readme).toContain("smallpond-evo");
    expect(readme).toContain('plugins.slots.memory = "memory-duckdb"');
    expect(readme).toContain("pnpm rebuild duckdb");
    expect(readme).toContain("docs/ARCHITECTURE.md");
    expect(readme).toContain("docs/OPERATIONS.md");
    expect(readme).not.toContain("docs/SMALLPOND_ARTIFACT_INVENTORY.md");
    expect(readme).not.toContain("docs/SELECTED_OWNER_DECISION.md");
    expect(readme).not.toContain("docs/RETIRED_SOURCE_AUDIT.md");

    const architectureTokens = [
      "Seam Discipline",
      "Migration Map",
      "SmallpondReadArtifact",
      "SmallpondKnowledgeIngestArtifact",
      "SmallpondSkillCandidateArtifact",
      "v_smallpond_business_facts",
      "Canonical mapping",
      "advisory_summary",
      "Skill Candidate Model",
      "metadata.skillCandidate",
      "draft",
      "pending_review",
      "approved",
      "startup + manual",
      "metadata.smallpond",
      "metadata.knowledge",
      "syncKey = smallpond:",
      "BusinessKnowledgeSyncService",
      "SmallpondClient",
      "host_local_only",
      "control_plane_summary",
      "writeback_candidate",
      "projection_only",
      "blockedSampleIds",
    ];
    for (const token of architectureTokens) {
      expect(architecture).toContain(token);
    }

    const operationsTokens = [
      "Acceptance Baseline",
      "discoverable but not selected",
      "selected canonical",
      "selected `shadow-read`",
      "degraded selected owner",
      "required rollout evidence",
      "Selected Owner Decision",
      "Rollback",
      "archive-first",
      "R1-E` is complete and closed",
      "U1` is complete and closed",
      "E4` is complete and closed",
      "There is no required next implementation lane on the current integration track",
      "independent gateway alias drift investigation",
      "live `check:gateway:writeback:proof` enhancement",
      "memory-core remains the default slot",
      'runtimeMode = "canonical"',
      "rollback confidence recorded by restoring the slot to `memory-core`",
    ];
    for (const token of operationsTokens) {
      expect(operations).toContain(token);
    }

    const combinedTokens = [
      "SmallpondReadArtifact",
      "SmallpondKnowledgeIngestArtifact",
      "SmallpondSkillCandidateArtifact",
      "BusinessKnowledgeSyncService",
      "SkillCandidateLifecycleState",
      "syncSkillCandidates",
      "memory sync-skills",
      "memory skill-candidates list",
      "memory skill-candidates approve",
      "memory sync-business",
      "memory status",
      "memory_duckdb_status",
      "/plugin/memory-duckdb/status",
      "/plugin/memory-duckdb/search",
      "/plugin/memory-duckdb/sql",
      "businessSync",
      "skillCandidates",
      "controlPlaneAlignment",
      "host_local_only",
      "writeback_candidate",
      "discoverable-but-unselected",
      "selected canonical",
      "selected `shadow-read`",
      "archive-first",
      "not `delete-now`",
      "E2-A = smallpond read/artifact contract freeze",
      "N6-A = contract family freeze",
      "P-next-5",
      "E3 = selected-owner rollout decision",
      "U1 = upstream compatibility hardening",
      "`U1 = upstream compatibility hardening` is complete and closed",
      "E4 = operator-controlled selected-owner opt-in",
      "`E4 = operator-controlled selected-owner opt-in`",
      "recommended explicit opt-in selected-owner candidate",
      "not the default owner",
      "memory-core remains the default slot",
      "There is no required next implementation lane on the current integration track",
      "full module-by-module merger is not yet true",
      "must migrate",
      "nice to migrate",
      "do not migrate",
      "session/archive/maintenance lifecycle capabilities",
      "repository abstraction and storage contracts",
      "rollback confidence",
      "Remaining optional follow-ups",
      "independent gateway alias drift investigation",
      "live `check:gateway:writeback:proof` enhancement",
      "raw `smallpond` payloads",
      "smallpond-evo",
      "vendor/negentropy-lab",
      "extensions/memory-duckdb",
      "extensions/negentropy-lab",
    ];
    for (const token of combinedTokens) {
      expect(combined).toContain(token);
    }

    expect(combined).not.toContain("enableOperatorEvidence");
    expect(JSON.stringify(manifest)).not.toContain("enableOperatorEvidence");
  });

  it("keeps the public seam local and avoids forbidden runtime coupling", () => {
    const apiBarrel = readText("extensions/memory-duckdb/api.ts");
    const packageJson = readJson<{
      dependencies?: Record<string, string>;
    }>("extensions/memory-duckdb/package.json");
    const files = [
      "extensions/memory-duckdb/index.ts",
      "extensions/memory-duckdb/src/runtime/MemoryDuckdbRuntime.ts",
      "extensions/memory-duckdb/src/shadow/ShadowReplayManager.ts",
      "extensions/memory-duckdb/src/capability/smallpond/SmallpondArtifactInventory.ts",
      "extensions/memory-duckdb/src/capability/smallpond/SmallpondContracts.ts",
      "extensions/memory-duckdb/src/capability/smallpond/BusinessArtifactMapper.ts",
      "extensions/memory-duckdb/src/capability/smallpond/SmallpondReadAccess.ts",
      "extensions/memory-duckdb/src/capability/smallpond/SmallpondDiagnostics.ts",
      "extensions/memory-duckdb/src/capability/smallpond/SmallpondClient.ts",
      "extensions/memory-duckdb/src/capability/smallpond/BusinessKnowledgeSyncService.ts",
      "extensions/memory-duckdb/src/capability/smallpond/SmallpondMaterialization.ts",
      "extensions/memory-duckdb/src/capability/smallpond/SkillCandidateTypes.ts",
      "extensions/memory-duckdb/src/capability/smallpond/SkillCandidateStateMachine.ts",
      "extensions/memory-duckdb/src/capability/smallpond/SkillCandidateProjector.ts",
      "extensions/memory-duckdb/src/capability/smallpond/SkillCandidateMaterializer.ts",
      "extensions/memory-duckdb/src/capability/smallpond/SkillCandidatePipelineService.ts",
      "extensions/memory-duckdb/src/capability/smallpond/ControlPlaneAlignment.ts",
    ];

    expect(apiBarrel.trim()).toBe('export * from "openclaw/plugin-sdk/memory-duckdb";');
    expect(packageJson.dependencies?.duckdb).toBeTruthy();
    expect(packageJson.dependencies?.duckdb).not.toContain("workspace:*");

    for (const relativePath of files) {
      const text = readText(relativePath);
      expect(text).not.toContain("vendor/negentropy-lab/");
      expect(text).not.toContain("smallpond-evo");
      expect(text).not.toContain("OpenDoge/plugins/memory/");
      expect(text).not.toContain("OpenDoge/plugins/memory-duckdb/");
    }
  });
});
