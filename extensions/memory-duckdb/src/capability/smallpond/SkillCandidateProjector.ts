import type { MemoryRecord } from "../../types.js";
import { isSkillCandidateRecord } from "./SkillCandidateMaterializer.js";
import { mapSourcePromotionStatusToLifecycleState } from "./SkillCandidateStateMachine.js";
import type { ProjectedSkillCandidate } from "./SkillCandidateTypes.js";
import { readSmallpondRecordMetadata } from "./SmallpondMaterialization.js";

type JsonRecord = Record<string, unknown>;

type ParsedRecordText = {
  title: string;
  summary: string;
  fields: Record<string, string>;
  jsonPayload: JsonRecord | null;
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeLines(text: string): string[] {
  return text
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function parseMaterializedRecordText(text: string): ParsedRecordText {
  const lines = normalizeLines(text);
  const header = lines[0] ?? "[skill_candidate] untitled";
  const headerMatch = header.match(/^\[(?<kind>[^\]]+)\]\s+(?<title>.+)$/u);
  const title = headerMatch?.groups?.title?.trim() ?? header;
  const fields: Record<string, string> = {};
  let summary = title;
  let jsonPayload: JsonRecord | null = null;

  for (const line of lines.slice(1)) {
    if (line.startsWith("{") && line.endsWith("}")) {
      try {
        const parsed = JSON.parse(line) as unknown;
        if (isRecord(parsed)) {
          jsonPayload = parsed;
        }
      } catch {
        // Ignore non-JSON diagnostic lines.
      }
      continue;
    }

    const fieldMatch = line.match(/^(?<key>[a-zA-Z][\w-]*)=(?<value>.*)$/u);
    if (fieldMatch?.groups?.key) {
      fields[fieldMatch.groups.key] = fieldMatch.groups.value?.trim() ?? "";
      continue;
    }

    if (summary === title) {
      summary = line;
    }
  }

  return {
    title,
    summary,
    fields,
    jsonPayload,
  };
}

function importanceToPriority(value: unknown): "low" | "medium" | "high" {
  if (value === "critical" || value === "high") {
    return "high";
  }
  if (value === "low") {
    return "low";
  }
  return "medium";
}

function splitSteps(value: string | undefined, fallback: string): string[] {
  if (!value || value.trim().length === 0) {
    return [fallback];
  }
  return value
    .split("|")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function readJsonString(payload: JsonRecord | null, key: string): string | null {
  const value = payload?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readJsonSteps(payload: JsonRecord | null, fallback: string): string[] {
  if (!Array.isArray(payload?.steps)) {
    return [fallback];
  }
  return payload.steps
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
}

function projectSmallpondSkillSource(record: MemoryRecord): ProjectedSkillCandidate | null {
  const sourceMetadata = readSmallpondRecordMetadata(record);
  if (
    !sourceMetadata ||
    sourceMetadata.smallpond.artifactType !== "skill_candidate" ||
    sourceMetadata.knowledge.kind !== "skill_candidate"
  ) {
    return null;
  }

  const parsed = parseMaterializedRecordText(record.text);
  const promotionStatus =
    parsed.fields.sourcePromotionStatus ??
    readJsonString(parsed.jsonPayload, "promotionStatus") ??
    "candidate";

  return {
    candidateId: parsed.fields.candidate ?? sourceMetadata.smallpond.artifactId,
    title: parsed.title,
    summary: parsed.summary,
    trigger: parsed.fields.trigger ?? readJsonString(parsed.jsonPayload, "trigger") ?? parsed.title,
    steps:
      splitSteps(parsed.fields.steps, parsed.summary).length > 0
        ? splitSteps(parsed.fields.steps, parsed.summary)
        : readJsonSteps(parsed.jsonPayload, parsed.summary),
    priority:
      parsed.fields.priority === "low" ||
      parsed.fields.priority === "medium" ||
      parsed.fields.priority === "high"
        ? parsed.fields.priority
        : importanceToPriority(sourceMetadata.knowledge.importance),
    confidence: sourceMetadata.knowledge.confidence,
    sourceRefs: [...sourceMetadata.smallpond.sourceRefs],
    evidenceRefs: [...sourceMetadata.smallpond.evidenceRefs],
    derivedFromKinds: [sourceMetadata.knowledge.kind],
    sourcePromotionStatus:
      promotionStatus === "validated" ||
      promotionStatus === "promoted" ||
      promotionStatus === "rejected"
        ? promotionStatus
        : "candidate",
    lifecycleState: mapSourcePromotionStatusToLifecycleState(
      promotionStatus === "validated" ||
        promotionStatus === "promoted" ||
        promotionStatus === "rejected"
        ? promotionStatus
        : "candidate",
    ),
    updatedAt: record.updatedAt,
    sourceRecordId: record.id,
    sourceRecordMetadata: isRecord(record.metadata) ? record.metadata : {},
  };
}

function projectOperatorPattern(record: MemoryRecord): ProjectedSkillCandidate | null {
  const sourceMetadata = readSmallpondRecordMetadata(record);
  if (
    !sourceMetadata ||
    sourceMetadata.knowledge.kind !== "operator_pattern" ||
    sourceMetadata.smallpond.artifactType !== "operator_pattern"
  ) {
    return null;
  }

  const parsed = parseMaterializedRecordText(record.text);
  const artifactId = sourceMetadata.smallpond.artifactId;

  return {
    candidateId: `operator-pattern:${artifactId}`,
    title: `Operationalize ${parsed.title}`,
    summary: parsed.summary,
    trigger: `operator_pattern:${artifactId}`,
    steps: [parsed.summary],
    priority: importanceToPriority(sourceMetadata.knowledge.importance),
    confidence: sourceMetadata.knowledge.confidence,
    sourceRefs: [...sourceMetadata.smallpond.sourceRefs],
    evidenceRefs: [...sourceMetadata.smallpond.evidenceRefs],
    derivedFromKinds: [sourceMetadata.knowledge.kind],
    sourcePromotionStatus: "candidate",
    lifecycleState: "draft",
    updatedAt: record.updatedAt,
    sourceRecordId: record.id,
    sourceRecordMetadata: isRecord(record.metadata) ? record.metadata : {},
  };
}

function projectAdvisoryLesson(record: MemoryRecord): ProjectedSkillCandidate | null {
  const sourceMetadata = readSmallpondRecordMetadata(record);
  if (
    !sourceMetadata ||
    sourceMetadata.knowledge.kind !== "lesson" ||
    sourceMetadata.smallpond.artifactType !== "advisory_summary"
  ) {
    return null;
  }

  const parsed = parseMaterializedRecordText(record.text);
  const artifactId = sourceMetadata.smallpond.artifactId;

  return {
    candidateId: `advisory-lesson:${artifactId}`,
    title: `Practice ${parsed.title}`,
    summary: parsed.summary,
    trigger: `advisory_summary:${artifactId}`,
    steps: [parsed.summary],
    priority: importanceToPriority(sourceMetadata.knowledge.importance),
    confidence: sourceMetadata.knowledge.confidence,
    sourceRefs: [...sourceMetadata.smallpond.sourceRefs],
    evidenceRefs: [...sourceMetadata.smallpond.evidenceRefs],
    derivedFromKinds: [sourceMetadata.knowledge.kind],
    sourcePromotionStatus: "candidate",
    lifecycleState: "draft",
    updatedAt: record.updatedAt,
    sourceRecordId: record.id,
    sourceRecordMetadata: isRecord(record.metadata) ? record.metadata : {},
  };
}

export function projectSkillCandidates(
  records: readonly MemoryRecord[],
): ProjectedSkillCandidate[] {
  const projected: ProjectedSkillCandidate[] = [];

  for (const record of records) {
    if (isSkillCandidateRecord(record)) {
      continue;
    }

    const candidate =
      projectSmallpondSkillSource(record) ??
      projectOperatorPattern(record) ??
      projectAdvisoryLesson(record);

    if (candidate) {
      projected.push(candidate);
    }
  }

  return projected;
}
