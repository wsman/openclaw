import type { MemoryRecord } from "../../types.js";
import {
  createEmptySkillCandidateLifecycleCounts,
  type ProjectedSkillCandidate,
  type SkillCandidateLifecycleCounts,
  type SkillCandidateLifecycleState,
  type SkillCandidateRecordMetadata,
} from "./SkillCandidateTypes.js";
import type { SmallpondKnowledgeKind } from "./SmallpondArtifactInventory.js";
import type { SmallpondSkillCandidatePriority } from "./SmallpondContracts.js";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneMetadata(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function priorityToImportance(priority: SmallpondSkillCandidatePriority): string {
  if (priority === "high") {
    return "high";
  }
  if (priority === "low") {
    return "low";
  }
  return "medium";
}

export function buildSkillCandidateIdentityKey(candidateId: string): string {
  return `skill-candidate:${candidateId}`;
}

export function buildSkillCandidateRevisionKey(input: {
  candidateId: string;
  updatedAt: string;
}): string {
  return `${buildSkillCandidateIdentityKey(input.candidateId)}:${input.updatedAt}`;
}

export function buildSkillCandidateRecordMetadata(
  input: ProjectedSkillCandidate,
  materializedAt: string,
): Record<string, unknown> {
  const metadata = cloneMetadata(input.sourceRecordMetadata);
  metadata.knowledge = {
    kind: "skill_candidate",
    syncKey: buildSkillCandidateRevisionKey({
      candidateId: input.candidateId,
      updatedAt: input.updatedAt,
    }),
    semanticCategory: "skill_candidate",
    importance: priorityToImportance(input.priority),
    confidence: input.confidence,
    materializedAt,
    mappedKinds: [...input.derivedFromKinds],
  };
  metadata.skillCandidate = {
    candidateId: input.candidateId,
    lifecycleState: input.lifecycleState,
    title: input.title,
    trigger: input.trigger,
    steps: [...input.steps],
    priority: input.priority,
    confidence: input.confidence,
    sourceRefs: [...input.sourceRefs],
    evidenceRefs: [...input.evidenceRefs],
    derivedFromKinds: [...input.derivedFromKinds],
    sourcePromotionStatus: input.sourcePromotionStatus,
    updatedAt: input.updatedAt,
  } satisfies SkillCandidateRecordMetadata;
  return metadata;
}

export function updateSkillCandidateRecordMetadata(
  record: MemoryRecord,
  updates: Partial<SkillCandidateRecordMetadata> & {
    lifecycleState: SkillCandidateLifecycleState;
    updatedAt: string;
  },
): Record<string, unknown> {
  const metadata = isRecord(record.metadata) ? cloneMetadata(record.metadata) : {};
  const existing = readSkillCandidateRecordMetadata(record);
  if (!existing) {
    throw new Error(`memory record ${record.id} is not a skill candidate record`);
  }

  metadata.skillCandidate = {
    ...existing,
    ...updates,
    steps: updates.steps ? [...updates.steps] : [...existing.steps],
    sourceRefs: updates.sourceRefs ? [...updates.sourceRefs] : [...existing.sourceRefs],
    evidenceRefs: updates.evidenceRefs ? [...updates.evidenceRefs] : [...existing.evidenceRefs],
    derivedFromKinds: updates.derivedFromKinds
      ? [...updates.derivedFromKinds]
      : [...existing.derivedFromKinds],
  };
  if (isRecord(metadata.knowledge)) {
    metadata.knowledge = {
      ...metadata.knowledge,
      kind: "skill_candidate",
      syncKey: buildSkillCandidateRevisionKey({
        candidateId: existing.candidateId,
        updatedAt: updates.updatedAt,
      }),
      confidence:
        updates.confidence ??
        (typeof metadata.knowledge.confidence === "number"
          ? metadata.knowledge.confidence
          : existing.confidence),
    };
  }
  return metadata;
}

export function buildSkillCandidateRecordText(input: {
  candidateId: string;
  title: string;
  summary: string;
  trigger: string;
  steps: string[];
  priority: SmallpondSkillCandidatePriority;
  confidence: number;
  lifecycleState: SkillCandidateLifecycleState;
  sourcePromotionStatus: string;
}): string {
  return [
    `[skill_candidate] ${input.title}`,
    `candidate=${input.candidateId}`,
    input.summary,
    `trigger=${input.trigger}`,
    `steps=${input.steps.join(" | ")}`,
    `priority=${input.priority}`,
    `confidence=${input.confidence.toFixed(2)}`,
    `lifecycle=${input.lifecycleState}`,
    `sourcePromotionStatus=${input.sourcePromotionStatus}`,
  ]
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}

export function readSkillCandidateRecordMetadata(
  record: MemoryRecord,
): SkillCandidateRecordMetadata | null {
  if (!isRecord(record.metadata) || !isRecord(record.metadata.skillCandidate)) {
    return null;
  }

  const skillCandidate = record.metadata.skillCandidate;
  const candidateId = readString(skillCandidate.candidateId);
  const lifecycleState = readString(
    skillCandidate.lifecycleState,
  ) as SkillCandidateLifecycleState | null;
  const title = readString(skillCandidate.title);
  const trigger = readString(skillCandidate.trigger);
  const priority = readString(skillCandidate.priority) as SmallpondSkillCandidatePriority | null;
  const confidence = readNumber(skillCandidate.confidence);
  const sourcePromotionStatus = readString(skillCandidate.sourcePromotionStatus);
  const updatedAt = readString(skillCandidate.updatedAt);

  if (
    !candidateId ||
    !lifecycleState ||
    !title ||
    !trigger ||
    !priority ||
    confidence == null ||
    !sourcePromotionStatus ||
    !updatedAt
  ) {
    return null;
  }

  return {
    candidateId,
    lifecycleState,
    title,
    trigger,
    steps: asStringArray(skillCandidate.steps),
    priority,
    confidence,
    sourceRefs: asStringArray(skillCandidate.sourceRefs),
    evidenceRefs: asStringArray(skillCandidate.evidenceRefs),
    derivedFromKinds: asStringArray(skillCandidate.derivedFromKinds) as SmallpondKnowledgeKind[],
    sourcePromotionStatus:
      sourcePromotionStatus as SkillCandidateRecordMetadata["sourcePromotionStatus"],
    updatedAt,
  };
}

export function isSkillCandidateRecord(record: MemoryRecord): boolean {
  return readSkillCandidateRecordMetadata(record) !== null;
}

export function countSkillCandidateLifecycleStates(
  records: readonly MemoryRecord[],
): SkillCandidateLifecycleCounts {
  const counts = createEmptySkillCandidateLifecycleCounts();
  for (const record of records) {
    const metadata = readSkillCandidateRecordMetadata(record);
    if (!metadata) {
      continue;
    }
    counts[metadata.lifecycleState] += 1;
  }
  return counts;
}
