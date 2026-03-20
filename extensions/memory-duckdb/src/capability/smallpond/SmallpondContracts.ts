import {
  assertSmallpondApprovedSourceView,
  assertSmallpondArtifactType,
  type SmallpondApprovedSourceView,
  type SmallpondArtifactType,
} from "./SmallpondArtifactInventory.js";

type JsonRecord = Record<string, unknown>;

export const SMALLPOND_CONTRACT_SCHEMA_VERSION = "2026-03-20-e2a1";

export const SMALLPOND_IMPORTANCE_LEVELS = ["low", "medium", "high", "critical"] as const;
export type SmallpondImportance = (typeof SMALLPOND_IMPORTANCE_LEVELS)[number];

export const SMALLPOND_SKILL_CANDIDATE_PRIORITIES = ["low", "medium", "high"] as const;
export type SmallpondSkillCandidatePriority = (typeof SMALLPOND_SKILL_CANDIDATE_PRIORITIES)[number];

export const SMALLPOND_SKILL_CANDIDATE_PROMOTION_STATUSES = [
  "candidate",
  "validated",
  "promoted",
  "rejected",
] as const;
export type SmallpondSkillCandidatePromotionStatus =
  (typeof SMALLPOND_SKILL_CANDIDATE_PROMOTION_STATUSES)[number];

export const SMALLPOND_READ_ARTIFACT_REQUIRED_FIELDS = [
  "artifactId",
  "artifactType",
  "title",
  "summary",
  "status",
  "scope",
  "tags",
  "updatedAt",
  "evidenceRefs",
  "sourceView",
] as const;

export const SMALLPOND_KNOWLEDGE_INGEST_REQUIRED_FIELDS = [
  "requestId",
  "artifactId",
  "artifactType",
  "scope",
  "title",
  "summary",
  "content",
  "semanticCategory",
  "importance",
  "confidence",
  "evidenceRefs",
  "sourceTimestamp",
  "schemaVersion",
] as const;

export const SMALLPOND_SKILL_CANDIDATE_REQUIRED_FIELDS = [
  "candidateId",
  "title",
  "trigger",
  "summary",
  "steps",
  "priority",
  "confidence",
  "promotionStatus",
  "sourceRefs",
  "evidenceRefs",
] as const;

export type SmallpondReadArtifact = {
  artifactId: string;
  artifactType: SmallpondArtifactType;
  title: string;
  summary: string;
  status: string;
  scope: Record<string, string>;
  tags: string[];
  updatedAt: string;
  evidenceRefs: string[];
  sourceView: SmallpondApprovedSourceView;
};

export type SmallpondKnowledgeIngestArtifact = {
  requestId: string;
  artifactId: string;
  artifactType: SmallpondArtifactType;
  scope: Record<string, string>;
  title: string;
  summary: string;
  content: Record<string, unknown> | string;
  semanticCategory: string;
  importance: SmallpondImportance;
  confidence: number;
  evidenceRefs: string[];
  sourceTimestamp: string;
  schemaVersion: string;
};

export type SmallpondSkillCandidateArtifact = {
  candidateId: string;
  title: string;
  trigger: string;
  summary: string;
  steps: string[];
  priority: SmallpondSkillCandidatePriority;
  confidence: number;
  promotionStatus: SmallpondSkillCandidatePromotionStatus;
  sourceRefs: string[];
  evidenceRefs: string[];
};

function readRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function readStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be a string array`);
  }
  return value.map((entry, index) => readString(entry, `${label}[${index}]`));
}

function readStringRecord(value: unknown, label: string): Record<string, string> {
  const record = readRecord(value, label);
  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [key, readString(entry, `${label}.${key}`)]),
  );
}

function readNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${label} must be a number`);
  }
  return value;
}

function readEnumValue<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  label: string,
): T {
  const normalized = readString(value, label);
  if (!allowedValues.includes(normalized as T)) {
    throw new Error(`${label} must be one of ${allowedValues.join(", ")}`);
  }
  return normalized as T;
}

function readStringOrRecord(value: unknown, label: string): Record<string, unknown> | string {
  if (typeof value === "string") {
    return readString(value, label);
  }
  return readRecord(value, label);
}

export function normalizeSmallpondReadArtifact(payload: unknown): SmallpondReadArtifact {
  const record = readRecord(payload, "smallpond read artifact");
  return {
    artifactId: readString(record.artifactId, "smallpond read artifact.artifactId"),
    artifactType: assertSmallpondArtifactType(
      readString(record.artifactType, "smallpond read artifact.artifactType"),
    ),
    title: readString(record.title, "smallpond read artifact.title"),
    summary: readString(record.summary, "smallpond read artifact.summary"),
    status: readString(record.status, "smallpond read artifact.status"),
    scope: readStringRecord(record.scope, "smallpond read artifact.scope"),
    tags: readStringArray(record.tags, "smallpond read artifact.tags"),
    updatedAt: readString(record.updatedAt, "smallpond read artifact.updatedAt"),
    evidenceRefs: readStringArray(record.evidenceRefs, "smallpond read artifact.evidenceRefs"),
    sourceView: assertSmallpondApprovedSourceView(
      readString(record.sourceView, "smallpond read artifact.sourceView"),
    ),
  };
}

export function normalizeSmallpondKnowledgeIngestArtifact(
  payload: unknown,
): SmallpondKnowledgeIngestArtifact {
  const record = readRecord(payload, "smallpond knowledge ingest artifact");
  return {
    requestId: readString(record.requestId, "smallpond knowledge ingest artifact.requestId"),
    artifactId: readString(record.artifactId, "smallpond knowledge ingest artifact.artifactId"),
    artifactType: assertSmallpondArtifactType(
      readString(record.artifactType, "smallpond knowledge ingest artifact.artifactType"),
    ),
    scope: readStringRecord(record.scope, "smallpond knowledge ingest artifact.scope"),
    title: readString(record.title, "smallpond knowledge ingest artifact.title"),
    summary: readString(record.summary, "smallpond knowledge ingest artifact.summary"),
    content: readStringOrRecord(record.content, "smallpond knowledge ingest artifact.content"),
    semanticCategory: readString(
      record.semanticCategory,
      "smallpond knowledge ingest artifact.semanticCategory",
    ),
    importance: readEnumValue(
      record.importance,
      SMALLPOND_IMPORTANCE_LEVELS,
      "smallpond knowledge ingest artifact.importance",
    ),
    confidence: readNumber(record.confidence, "smallpond knowledge ingest artifact.confidence"),
    evidenceRefs: readStringArray(
      record.evidenceRefs,
      "smallpond knowledge ingest artifact.evidenceRefs",
    ),
    sourceTimestamp: readString(
      record.sourceTimestamp,
      "smallpond knowledge ingest artifact.sourceTimestamp",
    ),
    schemaVersion: readString(
      record.schemaVersion,
      "smallpond knowledge ingest artifact.schemaVersion",
    ),
  };
}

export function normalizeSmallpondSkillCandidateArtifact(
  payload: unknown,
): SmallpondSkillCandidateArtifact {
  const record = readRecord(payload, "smallpond skill candidate artifact");
  return {
    candidateId: readString(record.candidateId, "smallpond skill candidate artifact.candidateId"),
    title: readString(record.title, "smallpond skill candidate artifact.title"),
    trigger: readString(record.trigger, "smallpond skill candidate artifact.trigger"),
    summary: readString(record.summary, "smallpond skill candidate artifact.summary"),
    steps: readStringArray(record.steps, "smallpond skill candidate artifact.steps"),
    priority: readEnumValue(
      record.priority,
      SMALLPOND_SKILL_CANDIDATE_PRIORITIES,
      "smallpond skill candidate artifact.priority",
    ),
    confidence: readNumber(record.confidence, "smallpond skill candidate artifact.confidence"),
    promotionStatus: readEnumValue(
      record.promotionStatus,
      SMALLPOND_SKILL_CANDIDATE_PROMOTION_STATUSES,
      "smallpond skill candidate artifact.promotionStatus",
    ),
    sourceRefs: readStringArray(record.sourceRefs, "smallpond skill candidate artifact.sourceRefs"),
    evidenceRefs: readStringArray(
      record.evidenceRefs,
      "smallpond skill candidate artifact.evidenceRefs",
    ),
  };
}
