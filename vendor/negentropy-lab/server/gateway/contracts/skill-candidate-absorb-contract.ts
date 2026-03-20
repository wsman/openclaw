import { readRecord, readString, readStringArray, assertNoForbiddenFields, type N6DomainContractDescriptor } from './n6-contract-utils';

export const SKILL_CANDIDATE_ABSORB_CONTRACT_SCHEMA_VERSION = '2026-03-20-n6c1';

export const SKILL_CANDIDATE_ABSORB_ALLOWED_PRIORITIES = [
  'low',
  'medium',
  'high',
] as const;

export const SKILL_CANDIDATE_ABSORB_REQUIRED_FIELDS = [
  'candidateId',
  'title',
  'summary',
  'trigger',
  'steps',
  'priority',
  'confidence',
  'sourceRefs',
  'evidenceRefs',
  'promotionStatus',
  'schemaVersion',
] as const;

export const SKILL_CANDIDATE_ABSORB_FORBIDDEN_FIELDS = [
  'rawPayload',
  'distillerInternals',
  'genePayload',
  'authorityWriteBack',
] as const;

export interface SkillCandidateAbsorbContract {
  candidateId: string;
  title: string;
  summary: string;
  trigger: string;
  steps: string[];
  priority: (typeof SKILL_CANDIDATE_ABSORB_ALLOWED_PRIORITIES)[number];
  confidence: number;
  sourceRefs: string[];
  evidenceRefs: string[];
  promotionStatus: string;
  schemaVersion: string;
}

export const SKILL_CANDIDATE_ABSORB_CONTRACT_DESCRIPTOR: N6DomainContractDescriptor = {
  contractId: 'SkillCandidateAbsorbContract',
  schemaVersion: SKILL_CANDIDATE_ABSORB_CONTRACT_SCHEMA_VERSION,
  owner: 'Negentropy-Lab',
  source: 'smallpond-evo',
  families: ['capability-result', 'evidence-link'],
  requiredFields: [...SKILL_CANDIDATE_ABSORB_REQUIRED_FIELDS],
  forbiddenFields: [...SKILL_CANDIDATE_ABSORB_FORBIDDEN_FIELDS],
};

function normalizeSignals(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new Error('skill candidate.signals must be a string array');
  }

  return value.map((entry, index) => {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      return entry;
    }
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const record = entry as Record<string, unknown>;
      const preferred =
        record.signal ??
        record.kind ??
        record.name ??
        record.label;
      return readString(preferred, `skill candidate.signals[${index}]`);
    }
    throw new Error(`skill candidate.signals[${index}] must be a string-like entry`);
  });
}

function normalizePriority(value: unknown): SkillCandidateAbsorbContract['priority'] {
  const priority = readString(value ?? 'medium', 'skill candidate.priority');
  if (!SKILL_CANDIDATE_ABSORB_ALLOWED_PRIORITIES.includes(priority as SkillCandidateAbsorbContract['priority'])) {
    throw new Error(
      `skill candidate.priority must be one of ${SKILL_CANDIDATE_ABSORB_ALLOWED_PRIORITIES.join(', ')}`,
    );
  }
  return priority as SkillCandidateAbsorbContract['priority'];
}

export function normalizeSkillCandidateAbsorbContract(payload: unknown): SkillCandidateAbsorbContract {
  const record = readRecord(payload, 'skill candidate');
  assertNoForbiddenFields(record, SKILL_CANDIDATE_ABSORB_FORBIDDEN_FIELDS, 'skill candidate');

  const sourceRefs = Array.isArray(record.sourceRefs) ? readStringArray(record.sourceRefs, 'skill candidate.sourceRefs') : [];

  if (record.source_hash) {
    sourceRefs.push(readString(record.source_hash, 'skill candidate.source_hash'));
  }

  return {
    candidateId: readString(
      record.candidateId ?? record.gene_id,
      'skill candidate.candidateId',
    ),
    title: readString(record.title ?? record.name, 'skill candidate.title'),
    summary: readString(record.summary ?? record.description, 'skill candidate.summary'),
    trigger: readString(record.trigger ?? record.activation_trigger, 'skill candidate.trigger'),
    steps: Array.isArray(record.steps)
      ? readStringArray(record.steps, 'skill candidate.steps')
      : normalizeSignals(record.signals),
    priority: normalizePriority(record.priority),
    confidence:
      typeof record.confidence === 'number' && Number.isFinite(record.confidence)
        ? record.confidence
        : 0.5,
    sourceRefs,
    evidenceRefs: readStringArray(record.evidenceRefs ?? [], 'skill candidate.evidenceRefs'),
    promotionStatus: readString(record.promotionStatus ?? record.status, 'skill candidate.promotionStatus'),
    schemaVersion: readString(record.schemaVersion ?? record.schema_version, 'skill candidate.schemaVersion'),
  };
}
