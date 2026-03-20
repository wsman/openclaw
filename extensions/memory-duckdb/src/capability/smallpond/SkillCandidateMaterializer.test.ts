import { describe, expect, it } from "vitest";
import type { MemoryRecord } from "../../types.js";
import {
  buildSkillCandidateIdentityKey,
  buildSkillCandidateRecordMetadata,
  buildSkillCandidateRecordText,
  buildSkillCandidateRevisionKey,
  countSkillCandidateLifecycleStates,
  readSkillCandidateRecordMetadata,
} from "./SkillCandidateMaterializer.js";
import type { ProjectedSkillCandidate } from "./SkillCandidateTypes.js";

function buildProjectedCandidate(
  overrides: Partial<ProjectedSkillCandidate> = {},
): ProjectedSkillCandidate {
  return {
    candidateId: "candidate:demo",
    title: "Operationalize Demo Pattern",
    summary: "Use the recovered tenant pattern during rollback drills.",
    trigger: "operator_pattern:artifact:demo",
    steps: ["Review the rollback checklist", "Replay the verified operator pattern"],
    priority: "high",
    confidence: 0.92,
    sourceRefs: ["sp:artifact:demo"],
    evidenceRefs: ["ev:artifact:demo"],
    derivedFromKinds: ["operator_pattern"],
    sourcePromotionStatus: "candidate",
    lifecycleState: "draft",
    updatedAt: "2026-03-20T08:30:00.000Z",
    sourceRecordId: "record:source",
    sourceRecordMetadata: {
      smallpond: {
        artifactId: "artifact:demo",
        artifactType: "operator_pattern",
      },
    },
    ...overrides,
  };
}

describe("SkillCandidateMaterializer", () => {
  it("builds deterministic identity and revision keys", () => {
    expect(buildSkillCandidateIdentityKey("candidate:demo")).toBe("skill-candidate:candidate:demo");
    expect(
      buildSkillCandidateRevisionKey({
        candidateId: "candidate:demo",
        updatedAt: "2026-03-20T08:30:00.000Z",
      }),
    ).toBe("skill-candidate:candidate:demo:2026-03-20T08:30:00.000Z");
  });

  it("writes candidate metadata onto the existing MemoryRecord path", () => {
    const metadata = buildSkillCandidateRecordMetadata(
      buildProjectedCandidate(),
      "2026-03-20T09:00:00.000Z",
    );
    const record: MemoryRecord = {
      id: "record:candidate",
      text: buildSkillCandidateRecordText({
        candidateId: "candidate:demo",
        title: "Operationalize Demo Pattern",
        summary: "Use the recovered tenant pattern during rollback drills.",
        trigger: "operator_pattern:artifact:demo",
        steps: ["Review the rollback checklist", "Replay the verified operator pattern"],
        priority: "high",
        confidence: 0.92,
        lifecycleState: "draft",
        sourcePromotionStatus: "candidate",
      }),
      normalizedText: "",
      tags: [],
      source: "skill-candidate-sync",
      dedupKey: buildSkillCandidateRevisionKey({
        candidateId: "candidate:demo",
        updatedAt: "2026-03-20T08:30:00.000Z",
      }),
      metadata,
      createdAt: "2026-03-20T09:00:00.000Z",
      updatedAt: "2026-03-20T09:00:00.000Z",
      ingestSequence: 1,
    };

    expect(readSkillCandidateRecordMetadata(record)).toEqual({
      candidateId: "candidate:demo",
      lifecycleState: "draft",
      title: "Operationalize Demo Pattern",
      trigger: "operator_pattern:artifact:demo",
      steps: ["Review the rollback checklist", "Replay the verified operator pattern"],
      priority: "high",
      confidence: 0.92,
      sourceRefs: ["sp:artifact:demo"],
      evidenceRefs: ["ev:artifact:demo"],
      derivedFromKinds: ["operator_pattern"],
      sourcePromotionStatus: "candidate",
      updatedAt: "2026-03-20T08:30:00.000Z",
    });
    expect(metadata).toMatchObject({
      knowledge: {
        kind: "skill_candidate",
        syncKey: "skill-candidate:candidate:demo:2026-03-20T08:30:00.000Z",
      },
      skillCandidate: {
        candidateId: "candidate:demo",
        lifecycleState: "draft",
      },
    });
  });

  it("counts lifecycle states from materialized candidate records only", () => {
    const candidateRecord = (
      candidateId: string,
      lifecycleState: "draft" | "approved",
    ): MemoryRecord =>
      ({
        id: candidateId,
        text: "candidate",
        normalizedText: "",
        tags: [],
        source: "skill-candidate-sync",
        dedupKey: candidateId,
        metadata: {
          skillCandidate: {
            candidateId,
            lifecycleState,
            title: candidateId,
            trigger: candidateId,
            steps: [],
            priority: "medium",
            confidence: 0.5,
            sourceRefs: [],
            evidenceRefs: [],
            derivedFromKinds: [],
            sourcePromotionStatus: "candidate",
            updatedAt: "2026-03-20T08:30:00.000Z",
          },
        },
        createdAt: "2026-03-20T09:00:00.000Z",
        updatedAt: "2026-03-20T09:00:00.000Z",
        ingestSequence: 1,
      }) satisfies MemoryRecord;

    expect(
      countSkillCandidateLifecycleStates([
        candidateRecord("candidate:draft", "draft"),
        candidateRecord("candidate:approved", "approved"),
      ]),
    ).toMatchObject({
      draft: 1,
      approved: 1,
      archived: 0,
    });
  });
});
