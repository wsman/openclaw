import type { MemoryRecord } from "../../types.js";
import { readSkillCandidateRecordMetadata } from "./SkillCandidateMaterializer.js";
import type {
  SmallpondArtifactType,
  SmallpondKnowledgeKind,
} from "./SmallpondArtifactInventory.js";
import { readSmallpondRecordMetadata } from "./SmallpondMaterialization.js";

export const CONTROL_PLANE_ALIGNMENT_CLASSIFICATIONS = [
  "host_local_only",
  "control_plane_summary",
  "writeback_candidate",
  "projection_only",
] as const;

export type ControlPlaneAlignmentClassification =
  (typeof CONTROL_PLANE_ALIGNMENT_CLASSIFICATIONS)[number];

export const MEMORY_CONTROL_PLANE_ALIGNMENT_STATES = ["idle", "ok", "degraded"] as const;

export type MemoryControlPlaneAlignmentState =
  (typeof MEMORY_CONTROL_PLANE_ALIGNMENT_STATES)[number];

export type ControlPlaneAlignmentDecision = {
  recordId: string;
  knowledgeKind: SmallpondKnowledgeKind | null;
  artifactType: SmallpondArtifactType | null;
  classification: ControlPlaneAlignmentClassification;
  absorbEligible: boolean;
  writeBackEligible: boolean;
  projectionEligible: boolean;
  reason: string;
};

export type ControlPlaneAlignmentClassificationCounts = Record<
  ControlPlaneAlignmentClassification,
  number
>;

export type MemoryControlPlaneAlignmentStatus = {
  state: MemoryControlPlaneAlignmentState;
  lastEvaluatedAt: string | null;
  evaluatedRecordCount: number;
  countsByClassification: ControlPlaneAlignmentClassificationCounts;
  absorbEligibleCount: number;
  writeBackEligibleCount: number;
  blockedRecordCount: number;
  blockedSampleIds: string[];
  lastError: string | null;
};

function createEmptyClassificationCounts(): ControlPlaneAlignmentClassificationCounts {
  return {
    host_local_only: 0,
    control_plane_summary: 0,
    writeback_candidate: 0,
    projection_only: 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readKnowledgeKind(record: MemoryRecord): SmallpondKnowledgeKind | null {
  if (!isRecord(record.metadata) || !isRecord(record.metadata.knowledge)) {
    return null;
  }
  return typeof record.metadata.knowledge.kind === "string"
    ? (record.metadata.knowledge.kind as SmallpondKnowledgeKind)
    : null;
}

function createDecision(
  record: MemoryRecord,
  input: Omit<ControlPlaneAlignmentDecision, "recordId">,
): ControlPlaneAlignmentDecision {
  return {
    recordId: record.id,
    ...input,
  };
}

export function classifyControlPlaneAlignment(record: MemoryRecord): ControlPlaneAlignmentDecision {
  const knowledgeKind = readKnowledgeKind(record);
  const skillCandidate = readSkillCandidateRecordMetadata(record);
  if (skillCandidate) {
    return createDecision(record, {
      knowledgeKind: knowledgeKind ?? "skill_candidate",
      artifactType: "skill_candidate",
      classification: "control_plane_summary",
      absorbEligible: true,
      writeBackEligible: false,
      projectionEligible: true,
      reason:
        "metadata.skillCandidate marks the host-owned skill candidate summary surface for control-plane absorb/projection.",
    });
  }

  const smallpond = readSmallpondRecordMetadata(record);
  if (!smallpond || !knowledgeKind) {
    return createDecision(record, {
      knowledgeKind,
      artifactType: smallpond?.smallpond.artifactType ?? null,
      classification: "host_local_only",
      absorbEligible: false,
      writeBackEligible: false,
      projectionEligible: false,
      reason:
        "record does not carry approved host materialization metadata for control-plane emission.",
    });
  }

  const artifactType = smallpond.smallpond.artifactType;
  if (artifactType === "skill_candidate") {
    return createDecision(record, {
      knowledgeKind,
      artifactType,
      classification: "host_local_only",
      absorbEligible: false,
      writeBackEligible: false,
      projectionEligible: false,
      reason:
        "source skill_candidate discovery records stay host-local until they are projected into metadata.skillCandidate.",
    });
  }

  if (
    knowledgeKind === "business_fact" ||
    knowledgeKind === "governance_decision" ||
    knowledgeKind === "evidence_summary" ||
    knowledgeKind === "tenant_insight" ||
    knowledgeKind === "operator_pattern" ||
    knowledgeKind === "release_readiness_note"
  ) {
    return createDecision(record, {
      knowledgeKind,
      artifactType,
      classification: "writeback_candidate",
      absorbEligible: true,
      writeBackEligible: true,
      projectionEligible: true,
      reason:
        "approved host materialization maps this record to a control-plane write-back candidate family.",
    });
  }

  if (
    knowledgeKind === "lesson" ||
    knowledgeKind === "handoff_summary" ||
    knowledgeKind === "judge_summary"
  ) {
    return createDecision(record, {
      knowledgeKind,
      artifactType,
      classification: "projection_only",
      absorbEligible: true,
      writeBackEligible: false,
      projectionEligible: true,
      reason:
        "approved host materialization keeps this record on projection-only summary surfaces without direct write-back eligibility.",
    });
  }

  return createDecision(record, {
    knowledgeKind,
    artifactType,
    classification: "host_local_only",
    absorbEligible: false,
    writeBackEligible: false,
    projectionEligible: false,
    reason:
      "record keeps approved host metadata, but its canonical kind is not part of the frozen control-plane alignment matrix.",
  });
}

export function evaluateControlPlaneAlignment(
  records: readonly MemoryRecord[],
  now: Date,
): {
  decisions: ControlPlaneAlignmentDecision[];
  status: MemoryControlPlaneAlignmentStatus;
} {
  try {
    const decisions = records.map((record) => classifyControlPlaneAlignment(record));
    const countsByClassification = createEmptyClassificationCounts();
    let absorbEligibleCount = 0;
    let writeBackEligibleCount = 0;
    const blockedSampleIds: string[] = [];

    for (const decision of decisions) {
      countsByClassification[decision.classification] += 1;
      if (decision.absorbEligible) {
        absorbEligibleCount += 1;
      } else if (blockedSampleIds.length < 5) {
        blockedSampleIds.push(decision.recordId);
      }
      if (decision.writeBackEligible) {
        writeBackEligibleCount += 1;
      }
    }

    const blockedRecordCount = decisions.length - absorbEligibleCount;

    return {
      decisions,
      status: {
        state: decisions.length === 0 ? "idle" : "ok",
        lastEvaluatedAt: now.toISOString(),
        evaluatedRecordCount: decisions.length,
        countsByClassification,
        absorbEligibleCount,
        writeBackEligibleCount,
        blockedRecordCount,
        blockedSampleIds,
        lastError: null,
      },
    };
  } catch (error) {
    return {
      decisions: [],
      status: {
        state: "degraded",
        lastEvaluatedAt: now.toISOString(),
        evaluatedRecordCount: records.length,
        countsByClassification: createEmptyClassificationCounts(),
        absorbEligibleCount: 0,
        writeBackEligibleCount: 0,
        blockedRecordCount: records.length,
        blockedSampleIds: records.slice(0, 5).map((record) => record.id),
        lastError: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
