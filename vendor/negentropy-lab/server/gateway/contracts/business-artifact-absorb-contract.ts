import { readNumber, readRecord, readString, readStringArray, readStringRecord, assertNoForbiddenFields, type N6DomainContractDescriptor } from './n6-contract-utils';

export const BUSINESS_ARTIFACT_ABSORB_CONTRACT_SCHEMA_VERSION = '2026-03-20-n6c1';

export const BUSINESS_ARTIFACT_ABSORB_ALLOWED_TYPES = [
  'business_fact',
  'governance_decision',
  'evidence_summary',
  'advisory_summary',
  'handoff_summary',
  'judge_summary',
  'tenant_insight',
  'operator_pattern',
  'release_readiness_note',
] as const;

export const BUSINESS_ARTIFACT_ABSORB_IMPORTANCE_LEVELS = [
  'low',
  'medium',
  'high',
  'critical',
] as const;

export const BUSINESS_ARTIFACT_ABSORB_REQUIRED_FIELDS = [
  'artifactId',
  'artifactType',
  'schemaVersion',
  'producer',
  'scope',
  'title',
  'summary',
  'status',
  'content',
  'semanticCategory',
  'importance',
  'confidence',
  'sourceTimestamp',
  'sourceRefs',
  'evidenceRefs',
  'signature',
] as const;

export const BUSINESS_ARTIFACT_ABSORB_FORBIDDEN_FIELDS = [
  'rawPayload',
  'emitterPayload',
  'resultEnvelope',
  'authorityWriteBack',
  'eventStoreRecord',
] as const;

export type BusinessArtifactType = (typeof BUSINESS_ARTIFACT_ABSORB_ALLOWED_TYPES)[number];
export type BusinessArtifactImportance = (typeof BUSINESS_ARTIFACT_ABSORB_IMPORTANCE_LEVELS)[number];

export interface BusinessArtifactAbsorbContract {
  artifactId: string;
  artifactType: BusinessArtifactType;
  schemaVersion: string;
  producer: string;
  scope: Record<string, string>;
  title: string;
  summary: string;
  status: string;
  content: Record<string, unknown> | string;
  semanticCategory: string;
  importance: BusinessArtifactImportance;
  confidence: number;
  sourceTimestamp: string;
  sourceRefs: string[];
  evidenceRefs: string[];
  signature: string;
}

export const BUSINESS_ARTIFACT_ABSORB_CONTRACT_DESCRIPTOR: N6DomainContractDescriptor = {
  contractId: 'BusinessArtifactAbsorbContract',
  schemaVersion: BUSINESS_ARTIFACT_ABSORB_CONTRACT_SCHEMA_VERSION,
  owner: 'Negentropy-Lab',
  source: 'smallpond-evo',
  families: ['capability-result', 'evidence-link'],
  requiredFields: [...BUSINESS_ARTIFACT_ABSORB_REQUIRED_FIELDS],
  forbiddenFields: [...BUSINESS_ARTIFACT_ABSORB_FORBIDDEN_FIELDS],
};

function normalizeArtifactType(value: unknown): BusinessArtifactType {
  const artifactType = readString(value, 'business artifact.artifactType');
  if (!BUSINESS_ARTIFACT_ABSORB_ALLOWED_TYPES.includes(artifactType as BusinessArtifactType)) {
    throw new Error(`business artifact.artifactType must be one of ${BUSINESS_ARTIFACT_ABSORB_ALLOWED_TYPES.join(', ')}`);
  }
  return artifactType as BusinessArtifactType;
}

function normalizeImportance(value: unknown): BusinessArtifactImportance {
  const importance = readString(value, 'business artifact.importance');
  if (!BUSINESS_ARTIFACT_ABSORB_IMPORTANCE_LEVELS.includes(importance as BusinessArtifactImportance)) {
    throw new Error(`business artifact.importance must be one of ${BUSINESS_ARTIFACT_ABSORB_IMPORTANCE_LEVELS.join(', ')}`);
  }
  return importance as BusinessArtifactImportance;
}

function normalizeContent(value: unknown): Record<string, unknown> | string {
  if (typeof value === 'string') {
    return value;
  }
  return readRecord(value, 'business artifact.content');
}

export function normalizeBusinessArtifactAbsorbContract(payload: unknown): BusinessArtifactAbsorbContract {
  const record = readRecord(payload, 'business artifact');
  assertNoForbiddenFields(record, BUSINESS_ARTIFACT_ABSORB_FORBIDDEN_FIELDS, 'business artifact');

  return {
    artifactId: readString(record.artifactId, 'business artifact.artifactId'),
    artifactType: normalizeArtifactType(record.artifactType),
    schemaVersion: readString(record.schemaVersion, 'business artifact.schemaVersion'),
    producer: readString(record.producer, 'business artifact.producer'),
    scope: readStringRecord(record.scope, 'business artifact.scope'),
    title: readString(record.title, 'business artifact.title'),
    summary: readString(record.summary, 'business artifact.summary'),
    status: readString(record.status, 'business artifact.status'),
    content: normalizeContent(record.content),
    semanticCategory: readString(record.semanticCategory, 'business artifact.semanticCategory'),
    importance: normalizeImportance(record.importance),
    confidence: readNumber(record.confidence, 'business artifact.confidence'),
    sourceTimestamp: readString(record.sourceTimestamp, 'business artifact.sourceTimestamp'),
    sourceRefs: readStringArray(record.sourceRefs, 'business artifact.sourceRefs'),
    evidenceRefs: readStringArray(record.evidenceRefs, 'business artifact.evidenceRefs'),
    signature: readString(record.signature, 'business artifact.signature'),
  };
}
