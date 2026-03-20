import { stableStringify } from "../../ingest/stable-json.js";
import type { MemoryRecord } from "../../types.js";
import type {
  SmallpondApprovedSourceView,
  SmallpondArtifactType,
  SmallpondKnowledgeKind,
} from "./SmallpondArtifactInventory.js";
import type {
  SmallpondImportance,
  SmallpondReadArtifact,
  SmallpondSkillCandidateArtifact,
} from "./SmallpondContracts.js";

export type SmallpondRecordMetadata = {
  smallpond: {
    artifactId: string;
    artifactType: SmallpondArtifactType;
    sourceView: SmallpondApprovedSourceView;
    sourceTimestamp: string;
    schemaVersion: string;
    sourceRefs: string[];
    evidenceRefs: string[];
  };
  knowledge: {
    kind: SmallpondKnowledgeKind;
    syncKey: string;
    semanticCategory: string;
    importance: SmallpondImportance;
    confidence: number;
    materializedAt: string;
    mappedKinds?: SmallpondKnowledgeKind[];
  };
};

export type SmallpondMaterializationInput = {
  readArtifact: SmallpondReadArtifact;
  sourceTimestamp: string;
  schemaVersion: string;
  sourceRefs: string[];
  semanticCategory: string;
  importance: SmallpondImportance;
  confidence: number;
  knowledgeKind: SmallpondKnowledgeKind;
  mappedKnowledgeKinds: SmallpondKnowledgeKind[];
  content: string | Record<string, unknown>;
  skillCandidate?: SmallpondSkillCandidateArtifact;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

export function buildSmallpondSyncKey(input: {
  artifactType: SmallpondArtifactType;
  artifactId: string;
  sourceTimestamp: string;
}): string {
  return `smallpond:${input.artifactType}:${input.artifactId}:${input.sourceTimestamp}`;
}

export function buildSmallpondRecordMetadata(
  input: SmallpondMaterializationInput,
  materializedAt: string,
): SmallpondRecordMetadata {
  return {
    smallpond: {
      artifactId: input.readArtifact.artifactId,
      artifactType: input.readArtifact.artifactType,
      sourceView: input.readArtifact.sourceView,
      sourceTimestamp: input.sourceTimestamp,
      schemaVersion: input.schemaVersion,
      sourceRefs: [...input.sourceRefs],
      evidenceRefs: [...input.readArtifact.evidenceRefs],
    },
    knowledge: {
      kind: input.knowledgeKind,
      syncKey: buildSmallpondSyncKey({
        artifactType: input.readArtifact.artifactType,
        artifactId: input.readArtifact.artifactId,
        sourceTimestamp: input.sourceTimestamp,
      }),
      semanticCategory: input.semanticCategory,
      importance: input.importance,
      confidence: input.confidence,
      materializedAt,
      mappedKinds: [...input.mappedKnowledgeKinds],
    },
  };
}

export function buildSmallpondRecordText(input: SmallpondMaterializationInput): string {
  const lines = [
    `[${input.knowledgeKind}] ${input.readArtifact.title}`,
    `artifact=${input.readArtifact.artifactType}/${input.readArtifact.artifactId}`,
    input.readArtifact.summary,
  ];

  if (typeof input.content === "string") {
    if (input.content.trim().length > 0 && input.content !== input.readArtifact.summary) {
      lines.push(input.content);
    }
  } else if (Object.keys(input.content).length > 0) {
    lines.push(stableStringify(input.content));
  }

  if (input.skillCandidate) {
    lines.push(`candidate=${input.skillCandidate.candidateId}`);
    lines.push(`trigger=${input.skillCandidate.trigger}`);
    if (input.skillCandidate.steps.length > 0) {
      lines.push(`steps=${input.skillCandidate.steps.join(" | ")}`);
    }
    lines.push(`priority=${input.skillCandidate.priority}`);
    lines.push(`confidence=${input.skillCandidate.confidence.toFixed(2)}`);
    lines.push(`sourcePromotionStatus=${input.skillCandidate.promotionStatus}`);
  }

  return lines.filter((entry) => entry.trim().length > 0).join("\n");
}

export function readSmallpondRecordMetadata(record: MemoryRecord): SmallpondRecordMetadata | null {
  if (!isRecord(record.metadata)) {
    return null;
  }
  if (isRecord(record.metadata.skillCandidate)) {
    return null;
  }
  const smallpond = record.metadata.smallpond;
  const knowledge = record.metadata.knowledge;
  if (!isRecord(smallpond) || !isRecord(knowledge)) {
    return null;
  }

  const artifactId = typeof smallpond.artifactId === "string" ? smallpond.artifactId : null;
  const artifactType =
    typeof smallpond.artifactType === "string"
      ? (smallpond.artifactType as SmallpondArtifactType)
      : null;
  const sourceView =
    typeof smallpond.sourceView === "string"
      ? (smallpond.sourceView as SmallpondApprovedSourceView)
      : null;
  const sourceTimestamp =
    typeof smallpond.sourceTimestamp === "string" ? smallpond.sourceTimestamp : null;
  const schemaVersion =
    typeof smallpond.schemaVersion === "string" ? smallpond.schemaVersion : null;
  const kind =
    typeof knowledge.kind === "string" ? (knowledge.kind as SmallpondKnowledgeKind) : null;
  const syncKey = typeof knowledge.syncKey === "string" ? knowledge.syncKey : null;
  const semanticCategory =
    typeof knowledge.semanticCategory === "string" ? knowledge.semanticCategory : null;
  const importance =
    typeof knowledge.importance === "string" ? (knowledge.importance as SmallpondImportance) : null;
  const confidence =
    typeof knowledge.confidence === "number" && Number.isFinite(knowledge.confidence)
      ? knowledge.confidence
      : null;
  const materializedAt =
    typeof knowledge.materializedAt === "string" ? knowledge.materializedAt : null;

  if (
    !artifactId ||
    !artifactType ||
    !sourceView ||
    !sourceTimestamp ||
    !schemaVersion ||
    !kind ||
    !syncKey ||
    !semanticCategory ||
    !importance ||
    confidence == null ||
    !materializedAt
  ) {
    return null;
  }

  return {
    smallpond: {
      artifactId,
      artifactType,
      sourceView,
      sourceTimestamp,
      schemaVersion,
      sourceRefs: asStringArray(smallpond.sourceRefs),
      evidenceRefs: asStringArray(smallpond.evidenceRefs),
    },
    knowledge: {
      kind,
      syncKey,
      semanticCategory,
      importance,
      confidence,
      materializedAt,
      mappedKinds: asStringArray(knowledge.mappedKinds) as SmallpondKnowledgeKind[],
    },
  };
}

export function isSmallpondMaterializedRecord(record: MemoryRecord): boolean {
  return readSmallpondRecordMetadata(record) !== null;
}

export function compareIsoTimestamp(left: string, right: string): number {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);
  if (Number.isNaN(leftMs) || Number.isNaN(rightMs)) {
    return left.localeCompare(right);
  }
  return leftMs - rightMs;
}
