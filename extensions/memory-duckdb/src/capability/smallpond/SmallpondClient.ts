import { mapSmallpondReadArtifactToKnowledgeKinds } from "./BusinessArtifactMapper.js";
import {
  SMALLPOND_ARTIFACT_INVENTORY,
  type SmallpondInventoryEntry,
} from "./SmallpondArtifactInventory.js";
import {
  SMALLPOND_CONTRACT_SCHEMA_VERSION,
  normalizeSmallpondKnowledgeIngestArtifact,
  normalizeSmallpondReadArtifact,
  normalizeSmallpondSkillCandidateArtifact,
  type SmallpondImportance,
} from "./SmallpondContracts.js";
import {
  buildSmallpondReadDiagnostics,
  type SmallpondReadDiagnostics,
} from "./SmallpondDiagnostics.js";
import type { SmallpondMaterializationInput } from "./SmallpondMaterialization.js";
import { SmallpondArtifactReadAccess } from "./SmallpondReadAccess.js";

type JsonRecord = Record<string, unknown>;

export type SmallpondClientReadFailure = {
  sourceView: string;
  errorMessage: string;
  diagnostics: SmallpondReadDiagnostics;
};

export type SmallpondClientReadResult = {
  artifacts: SmallpondMaterializationInput[];
  failures: SmallpondClientReadFailure[];
};

type SmallpondClientOptions = {
  readAccess: SmallpondArtifactReadAccess;
  inventory?: readonly SmallpondInventoryEntry[];
  now?: () => Date;
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readStringWithFallback(
  value: unknown,
  fallback: string,
  normalize?: (value: string) => string,
): string {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (candidate.length > 0) {
    return normalize ? normalize(candidate) : candidate;
  }
  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .flatMap((entry) => {
      if (typeof entry === "string") {
        return [entry.trim()];
      }
      if (isRecord(entry)) {
        const preferred = entry.value ?? entry.id ?? entry.label ?? entry.name ?? entry.ref ?? "";
        return typeof preferred === "string" ? [preferred.trim()] : [];
      }
      return [];
    })
    .filter((entry) => entry.length > 0);
}

function toStringRecord(
  value: unknown,
  fallbackKey: string,
  fallbackValue: string,
): Record<string, string> {
  if (!isRecord(value)) {
    return { [fallbackKey]: fallbackValue };
  }
  const entries = Object.entries(value)
    .filter(([, entry]) => typeof entry === "string" && entry.trim().length > 0)
    .map(([key, entry]) => [key, String(entry).trim()] as const);
  if (entries.length === 0) {
    return { [fallbackKey]: fallbackValue };
  }
  return Object.fromEntries(entries);
}

function toNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeImportance(value: unknown, fallback: SmallpondImportance): SmallpondImportance {
  if (value === "low" || value === "medium" || value === "high" || value === "critical") {
    return value;
  }
  return fallback;
}

function priorityToImportance(value: unknown): SmallpondImportance {
  if (value === "high") {
    return "high";
  }
  if (value === "low") {
    return "low";
  }
  return "medium";
}

function normalizeSteps(value: unknown, fallbackSummary: string): string[] {
  const direct = toStringArray(value);
  if (direct.length > 0) {
    return direct;
  }
  return [fallbackSummary];
}

function normalizeSourceRefs(record: JsonRecord, sourceView: string, artifactId: string): string[] {
  const refs = toStringArray(record.sourceRefs);
  if (refs.length > 0) {
    return refs;
  }
  return [`${sourceView}:${artifactId}`];
}

export class SmallpondClient {
  readonly #readAccess: SmallpondArtifactReadAccess;
  readonly #inventory: readonly SmallpondInventoryEntry[];
  readonly #now: () => Date;

  constructor(options: SmallpondClientOptions) {
    this.#readAccess = options.readAccess;
    this.#inventory = options.inventory ?? SMALLPOND_ARTIFACT_INVENTORY;
    this.#now = options.now ?? (() => new Date());
  }

  async readMaterializationInputs(): Promise<SmallpondClientReadResult> {
    const artifacts: SmallpondMaterializationInput[] = [];
    const failures: SmallpondClientReadFailure[] = [];

    for (const entry of this.#inventory) {
      const sql = `SELECT * FROM ${entry.allowedSourceSurface}`;
      try {
        const rows = await this.#readAccess.read(sql);
        for (const row of rows) {
          try {
            artifacts.push(this.#normalizeRow(entry, row));
          } catch (error) {
            failures.push(this.#buildFailure(entry.allowedSourceSurface, error));
          }
        }
      } catch (error) {
        failures.push(this.#buildFailure(entry.allowedSourceSurface, error));
      }
    }

    return { artifacts, failures };
  }

  #normalizeRow(
    entry: SmallpondInventoryEntry,
    row: Record<string, unknown>,
  ): SmallpondMaterializationInput {
    const artifactId = readStringWithFallback(
      row.artifactId ?? row.candidateId ?? row.id,
      `${entry.artifactType}:${this.#now().getTime()}`,
    );
    const title = readStringWithFallback(row.title ?? row.name, artifactId);
    const summary = readStringWithFallback(row.summary ?? row.description ?? row.content, title);
    const updatedAt = readStringWithFallback(
      row.updatedAt ?? row.sourceTimestamp,
      this.#now().toISOString(),
    );
    const evidenceRefs = toStringArray(row.evidenceRefs);
    const scope = toStringRecord(row.scope, "sourceView", entry.allowedSourceSurface);
    const readArtifact = normalizeSmallpondReadArtifact({
      artifactId,
      artifactType: entry.artifactType,
      title,
      summary,
      status: readStringWithFallback(row.status ?? row.promotionStatus, "ready"),
      scope,
      tags: toStringArray(row.tags),
      updatedAt,
      evidenceRefs,
      sourceView: entry.allowedSourceSurface,
    });
    const mappedKnowledgeKinds = mapSmallpondReadArtifactToKnowledgeKinds(readArtifact);
    const knowledgeKind = mappedKnowledgeKinds[0] ?? "business_fact";

    if (entry.artifactType === "skill_candidate") {
      const sourceRefs = normalizeSourceRefs(row, entry.allowedSourceSurface, artifactId);
      const skillCandidate = normalizeSmallpondSkillCandidateArtifact({
        candidateId: readStringWithFallback(row.candidateId, artifactId),
        title,
        trigger: readStringWithFallback(row.trigger ?? row.activationTrigger, "smallpond-skill"),
        summary,
        steps: normalizeSteps(row.steps, summary),
        priority: readStringWithFallback(row.priority, "medium"),
        confidence: toNumber(row.confidence, 0.7),
        promotionStatus: readStringWithFallback(row.promotionStatus ?? row.status, "candidate"),
        sourceRefs,
        evidenceRefs,
      });

      return {
        readArtifact,
        sourceTimestamp: updatedAt,
        schemaVersion: readStringWithFallback(row.schemaVersion, SMALLPOND_CONTRACT_SCHEMA_VERSION),
        sourceRefs,
        semanticCategory: readStringWithFallback(row.semanticCategory, "skill_candidate"),
        importance: priorityToImportance(skillCandidate.priority),
        confidence: skillCandidate.confidence,
        knowledgeKind,
        mappedKnowledgeKinds,
        content: {
          trigger: skillCandidate.trigger,
          steps: [...skillCandidate.steps],
          promotionStatus: skillCandidate.promotionStatus,
        },
        skillCandidate,
      };
    }

    const knowledgeIngest = normalizeSmallpondKnowledgeIngestArtifact({
      requestId: readStringWithFallback(
        row.requestId,
        `smallpond:${entry.artifactType}:${artifactId}`,
      ),
      artifactId,
      artifactType: entry.artifactType,
      scope,
      title,
      summary,
      content: isRecord(row.content) || typeof row.content === "string" ? row.content : summary,
      semanticCategory: readStringWithFallback(row.semanticCategory, entry.artifactType),
      importance: normalizeImportance(row.importance, "medium"),
      confidence: toNumber(row.confidence, 0.7),
      evidenceRefs,
      sourceTimestamp: updatedAt,
      schemaVersion: readStringWithFallback(row.schemaVersion, SMALLPOND_CONTRACT_SCHEMA_VERSION),
    });

    return {
      readArtifact,
      sourceTimestamp: knowledgeIngest.sourceTimestamp,
      schemaVersion: knowledgeIngest.schemaVersion,
      sourceRefs: normalizeSourceRefs(row, entry.allowedSourceSurface, artifactId),
      semanticCategory: knowledgeIngest.semanticCategory,
      importance: knowledgeIngest.importance,
      confidence: knowledgeIngest.confidence,
      knowledgeKind,
      mappedKnowledgeKinds,
      content: knowledgeIngest.content,
    };
  }

  #buildFailure(sourceView: string, error: unknown): SmallpondClientReadFailure {
    const diagnostics = buildSmallpondReadDiagnostics({ sourceView, error });
    return {
      sourceView,
      errorMessage: error instanceof Error ? error.message : String(error),
      diagnostics,
    };
  }
}
