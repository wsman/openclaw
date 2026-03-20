import { describe, expect, it } from "vitest";
import type { MemoryRecord } from "../../types.js";
import {
  classifyControlPlaneAlignment,
  evaluateControlPlaneAlignment,
} from "./ControlPlaneAlignment.js";
import type {
  SmallpondArtifactType,
  SmallpondApprovedSourceView,
  SmallpondKnowledgeKind,
} from "./SmallpondArtifactInventory.js";

const SOURCE_VIEWS: Record<SmallpondArtifactType, SmallpondApprovedSourceView> = {
  business_fact: "v_smallpond_business_facts",
  governance_decision: "v_smallpond_governance_decisions",
  evidence_summary: "v_smallpond_evidence_summaries",
  advisory_summary: "v_smallpond_advisory_summaries",
  handoff_summary: "v_smallpond_handoff_summaries",
  judge_summary: "v_smallpond_judge_summaries",
  tenant_insight: "v_smallpond_tenant_insights",
  operator_pattern: "v_smallpond_operator_patterns",
  skill_candidate: "v_smallpond_skill_candidates",
  release_readiness_note: "v_smallpond_release_readiness_notes",
};

function createRecord(
  id: string,
  text: string,
  metadata: Record<string, unknown>,
  updatedAt = "2026-03-20T10:00:00.000Z",
): MemoryRecord {
  return {
    id,
    text,
    normalizedText: text.toLowerCase(),
    tags: [],
    source: "test",
    dedupKey: `dedup:${id}`,
    metadata,
    createdAt: updatedAt,
    updatedAt,
    ingestSequence: 1,
  };
}

function createSmallpondRecord(input: {
  id: string;
  artifactType: SmallpondArtifactType;
  knowledgeKind: SmallpondKnowledgeKind;
  mappedKinds?: SmallpondKnowledgeKind[];
}): MemoryRecord {
  const sourceTimestamp = "2026-03-20T09:00:00.000Z";
  return createRecord(input.id, `[${input.knowledgeKind}] ${input.id}`, {
    smallpond: {
      artifactId: `artifact:${input.id}`,
      artifactType: input.artifactType,
      sourceView: SOURCE_VIEWS[input.artifactType],
      sourceTimestamp,
      schemaVersion: "2026-03-20-e2a",
      sourceRefs: [`sp:${input.id}`],
      evidenceRefs: [`ev:${input.id}`],
    },
    knowledge: {
      kind: input.knowledgeKind,
      syncKey: `smallpond:${input.artifactType}:artifact:${input.id}:${sourceTimestamp}`,
      semanticCategory: input.artifactType,
      importance: "high",
      confidence: 0.9,
      materializedAt: "2026-03-20T10:00:00.000Z",
      mappedKinds: input.mappedKinds ?? [input.knowledgeKind],
    },
  });
}

function createSkillCandidateRecord(id: string): MemoryRecord {
  return createRecord(id, `[skill_candidate] ${id}`, {
    knowledge: {
      kind: "skill_candidate",
      syncKey: `skill-candidate:${id}:2026-03-20T10:00:00.000Z`,
      semanticCategory: "skill_candidate",
      importance: "high",
      confidence: 0.95,
      materializedAt: "2026-03-20T10:00:00.000Z",
      mappedKinds: ["skill_candidate"],
    },
    skillCandidate: {
      candidateId: id,
      lifecycleState: "pending_review",
      title: `Candidate ${id}`,
      trigger: "test-trigger",
      steps: ["step one"],
      priority: "high",
      confidence: 0.95,
      sourceRefs: [`sp:${id}`],
      evidenceRefs: [`ev:${id}`],
      derivedFromKinds: ["skill_candidate"],
      sourcePromotionStatus: "validated",
      updatedAt: "2026-03-20T10:00:00.000Z",
    },
  });
}

describe("ControlPlaneAlignment", () => {
  it("classifies the frozen host matrix from canonical metadata", () => {
    const cases = [
      {
        record: createSmallpondRecord({
          id: "business-fact",
          artifactType: "business_fact",
          knowledgeKind: "business_fact",
        }),
        classification: "writeback_candidate",
      },
      {
        record: createSmallpondRecord({
          id: "governance",
          artifactType: "governance_decision",
          knowledgeKind: "governance_decision",
        }),
        classification: "writeback_candidate",
      },
      {
        record: createSmallpondRecord({
          id: "evidence",
          artifactType: "evidence_summary",
          knowledgeKind: "evidence_summary",
        }),
        classification: "writeback_candidate",
      },
      {
        record: createSmallpondRecord({
          id: "tenant",
          artifactType: "tenant_insight",
          knowledgeKind: "tenant_insight",
        }),
        classification: "writeback_candidate",
      },
      {
        record: createSmallpondRecord({
          id: "pattern",
          artifactType: "operator_pattern",
          knowledgeKind: "operator_pattern",
        }),
        classification: "writeback_candidate",
      },
      {
        record: createSmallpondRecord({
          id: "release",
          artifactType: "release_readiness_note",
          knowledgeKind: "release_readiness_note",
        }),
        classification: "writeback_candidate",
      },
      {
        record: createSkillCandidateRecord("candidate:demo"),
        classification: "control_plane_summary",
      },
      {
        record: createSmallpondRecord({
          id: "advisory-lesson",
          artifactType: "advisory_summary",
          knowledgeKind: "lesson",
          mappedKinds: ["lesson", "operator_pattern"],
        }),
        classification: "projection_only",
      },
      {
        record: createSmallpondRecord({
          id: "handoff",
          artifactType: "handoff_summary",
          knowledgeKind: "handoff_summary",
        }),
        classification: "projection_only",
      },
      {
        record: createSmallpondRecord({
          id: "judge",
          artifactType: "judge_summary",
          knowledgeKind: "judge_summary",
        }),
        classification: "projection_only",
      },
    ] as const;

    for (const testCase of cases) {
      const decision = classifyControlPlaneAlignment(testCase.record);
      expect(decision.classification).toBe(testCase.classification);
      expect(decision.recordId).toBe(testCase.record.id);
      expect(decision.reason.length).toBeGreaterThan(0);
      if (testCase.classification === "writeback_candidate") {
        expect(decision.absorbEligible).toBe(true);
        expect(decision.writeBackEligible).toBe(true);
        expect(decision.projectionEligible).toBe(true);
      } else if (testCase.classification === "control_plane_summary") {
        expect(decision.absorbEligible).toBe(true);
        expect(decision.writeBackEligible).toBe(false);
        expect(decision.projectionEligible).toBe(true);
      } else {
        expect(decision.absorbEligible).toBe(true);
        expect(decision.writeBackEligible).toBe(false);
        expect(decision.projectionEligible).toBe(true);
      }
    }
  });

  it("keeps raw-only and source-only candidate discovery records host-local", () => {
    const sourceCandidate = createSmallpondRecord({
      id: "source-skill",
      artifactType: "skill_candidate",
      knowledgeKind: "skill_candidate",
    });
    const rawRecord = createRecord("raw-only", "Manual private note", {
      private: { owner: "host" },
    });

    expect(classifyControlPlaneAlignment(sourceCandidate)).toMatchObject({
      classification: "host_local_only",
      absorbEligible: false,
      writeBackEligible: false,
      projectionEligible: false,
    });
    expect(classifyControlPlaneAlignment(sourceCandidate).reason).toContain(
      "metadata.skillCandidate",
    );
    expect(classifyControlPlaneAlignment(rawRecord)).toMatchObject({
      classification: "host_local_only",
      knowledgeKind: null,
      artifactType: null,
      absorbEligible: false,
      writeBackEligible: false,
      projectionEligible: false,
    });
  });

  it("summarizes alignment status from canonical repository contents", () => {
    const records = [
      createSmallpondRecord({
        id: "business-fact",
        artifactType: "business_fact",
        knowledgeKind: "business_fact",
      }),
      createSmallpondRecord({
        id: "advisory-lesson",
        artifactType: "advisory_summary",
        knowledgeKind: "lesson",
        mappedKinds: ["lesson", "operator_pattern"],
      }),
      createSkillCandidateRecord("candidate:demo"),
      createSmallpondRecord({
        id: "source-skill",
        artifactType: "skill_candidate",
        knowledgeKind: "skill_candidate",
      }),
      createRecord("raw-only", "Manual private note", {
        private: { owner: "host" },
      }),
    ];

    const result = evaluateControlPlaneAlignment(records, new Date("2026-03-20T12:00:00.000Z"));

    expect(result.status).toMatchObject({
      state: "ok",
      lastEvaluatedAt: "2026-03-20T12:00:00.000Z",
      evaluatedRecordCount: 5,
      absorbEligibleCount: 3,
      writeBackEligibleCount: 1,
      blockedRecordCount: 2,
      blockedSampleIds: ["source-skill", "raw-only"],
      lastError: null,
    });
    expect(result.status.countsByClassification).toEqual({
      host_local_only: 2,
      control_plane_summary: 1,
      writeback_candidate: 1,
      projection_only: 1,
    });
  });
});
