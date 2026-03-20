import { describe, expect, it } from "vitest";
import type { MemoryRecord } from "../../types.js";
import { projectSkillCandidates } from "./SkillCandidateProjector.js";

function buildSourceRecord(
  overrides: Partial<MemoryRecord> & {
    smallpondArtifactType: string;
    knowledgeKind: string;
  },
): MemoryRecord {
  return {
    id: overrides.id ?? `record:${overrides.smallpondArtifactType}`,
    text:
      overrides.text ??
      `[${overrides.knowledgeKind}] Demo Title\nartifact=${overrides.smallpondArtifactType}/artifact:demo\nDemo summary`,
    normalizedText: "",
    tags: [],
    source: "smallpond-sync",
    dedupKey: overrides.dedupKey ?? "dedup",
    metadata: {
      smallpond: {
        artifactId: "artifact:demo",
        artifactType: overrides.smallpondArtifactType,
        sourceView: "v_smallpond_operator_patterns",
        sourceTimestamp: "2026-03-20T08:00:00.000Z",
        schemaVersion: "2026-03-20-e2a1",
        sourceRefs: ["sp:artifact:demo"],
        evidenceRefs: ["ev:artifact:demo"],
      },
      knowledge: {
        kind: overrides.knowledgeKind,
        syncKey: "smallpond:demo",
        semanticCategory: overrides.smallpondArtifactType,
        importance: "high",
        confidence: 0.9,
        materializedAt: "2026-03-20T08:05:00.000Z",
        mappedKinds: [overrides.knowledgeKind],
      },
      ...(overrides.metadata ?? {}),
    },
    createdAt: "2026-03-20T08:05:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-03-20T08:05:00.000Z",
    ingestSequence: 1,
  };
}

describe("SkillCandidateProjector", () => {
  it("projects only the three approved source families", () => {
    const projected = projectSkillCandidates([
      buildSourceRecord({
        smallpondArtifactType: "skill_candidate",
        knowledgeKind: "skill_candidate",
        text: [
          "[skill_candidate] Summarize Advisory Drift",
          "artifact=skill_candidate/artifact:demo",
          "Candidate summary",
          "candidate=candidate:demo",
          "trigger=repeat advisory",
          "steps=Capture the drift | Draft a response",
          "priority=high",
          "sourcePromotionStatus=validated",
        ].join("\n"),
      }),
      buildSourceRecord({
        id: "record:operator-pattern",
        smallpondArtifactType: "operator_pattern",
        knowledgeKind: "operator_pattern",
        text: "[operator_pattern] Tenant Recovery\nartifact=operator_pattern/artifact:demo\nUse the verified rollback playbook.",
      }),
      buildSourceRecord({
        id: "record:lesson",
        smallpondArtifactType: "advisory_summary",
        knowledgeKind: "lesson",
        text: "[lesson] Advisory Lesson\nartifact=advisory_summary/artifact:demo\nTurn the advisory summary into a repeatable checklist.",
      }),
      buildSourceRecord({
        id: "record:ignored",
        smallpondArtifactType: "business_fact",
        knowledgeKind: "business_fact",
      }),
      {
        ...buildSourceRecord({
          id: "record:already-candidate",
          smallpondArtifactType: "operator_pattern",
          knowledgeKind: "skill_candidate",
        }),
        metadata: {
          skillCandidate: {
            candidateId: "candidate:existing",
            lifecycleState: "approved",
            title: "existing",
            trigger: "existing",
            steps: [],
            priority: "medium",
            confidence: 0.5,
            sourceRefs: [],
            evidenceRefs: [],
            derivedFromKinds: [],
            sourcePromotionStatus: "candidate",
            updatedAt: "2026-03-20T08:05:00.000Z",
          },
        },
      } satisfies MemoryRecord,
    ]);

    expect(projected.map((candidate) => candidate.candidateId)).toEqual([
      "candidate:demo",
      "operator-pattern:artifact:demo",
      "advisory-lesson:artifact:demo",
    ]);
    expect(projected[0]).toMatchObject({
      lifecycleState: "pending_review",
      trigger: "repeat advisory",
      steps: ["Capture the drift", "Draft a response"],
      sourcePromotionStatus: "validated",
    });
    expect(projected[1]).toMatchObject({
      title: "Operationalize Tenant Recovery",
      lifecycleState: "draft",
      sourcePromotionStatus: "candidate",
    });
    expect(projected[2]).toMatchObject({
      title: "Practice Advisory Lesson",
      lifecycleState: "draft",
    });
  });
});
