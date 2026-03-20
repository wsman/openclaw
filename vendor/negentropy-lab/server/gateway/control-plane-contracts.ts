/**
 * Control-plane boundary contracts and write-back discipline constants.
 *
 * @constitution
 * Section 101: keep cross-repo contract constants synchronized with runtime usage.
 * Section 102: centralize control-plane boundary definitions to reduce drift.
 * Section 152: keep write-back targets and envelope fields aligned with one source of truth.
 */

export const CONTROL_PLANE_CONTRACT_VERSION = '2026-03-17-phase0';

export const RESULT_ENVELOPE_REQUIRED_FIELDS = [
  'requestId',
  'capabilityCallId',
  'traceId',
  'status',
  'result',
  'diagnostics',
  'unsupported',
  'degradedMode',
  'sideEffects',
  'evidenceRefs',
  'signature',
] as const;

export const CONTROL_PLANE_WRITE_BACK_TARGETS = [
  'AuthorityState',
  'EventStore',
  'Projection',
] as const;

export const MEMORY_BUSINESS_EVIDENCE_LINK_REQUIRED_FIELDS = [
  'requestId',
  'capabilityCallId',
  'traceId',
  'correlationId',
  'evidenceRefs',
  'signature',
] as const;

export const CROSS_REPO_CONTRACT_FAMILIES = [
  {
    id: 'surface-summary',
    label: 'Surface Summary Contract',
    owner: 'Negentropy-Lab',
    purpose: 'Control-plane summary fields consumed by web, desk, dashboard, and host surfaces.',
  },
  {
    id: 'capability-invocation',
    label: 'Capability Invocation Contract',
    owner: 'Negentropy-Lab',
    purpose: 'Requests emitted toward capability-plane execution with stable owner and diagnostics boundaries.',
  },
  {
    id: 'capability-result',
    label: 'Capability Result Contract',
    owner: 'smallpond-evo',
    purpose: 'Runtime capability results returned as ResultEnvelope-compatible payloads.',
  },
  {
    id: 'evidence-link',
    label: 'Evidence Link Contract',
    owner: 'smallpond-evo',
    purpose: 'Evidence refs and signatures that the control plane can absorb into authoritative write-back.',
  },
] as const;

export type ResultEnvelopeField = (typeof RESULT_ENVELOPE_REQUIRED_FIELDS)[number];
export type ControlPlaneWriteBackTarget = (typeof CONTROL_PLANE_WRITE_BACK_TARGETS)[number];
export type MemoryBusinessEvidenceLinkField =
  (typeof MEMORY_BUSINESS_EVIDENCE_LINK_REQUIRED_FIELDS)[number];
export type CrossRepoContractFamily = (typeof CROSS_REPO_CONTRACT_FAMILIES)[number]['id'];

export interface ResultEnvelopeBaseline {
  minimumFields: ResultEnvelopeField[];
  diagnosticsField: 'diagnostics';
  writeBackPath: 'ResultEnvelope -> Authority absorb -> EventStore / Projection';
  evidenceFields: Array<'evidenceRefs' | 'signature'>;
}

export interface CrossRepoContractFamilyDescriptor {
  id: CrossRepoContractFamily;
  label: (typeof CROSS_REPO_CONTRACT_FAMILIES)[number]['label'];
  owner: (typeof CROSS_REPO_CONTRACT_FAMILIES)[number]['owner'];
  purpose: string;
}

export interface ControlPlaneContractBoundary {
  version: string;
  role: 'control-plane';
  repositoryShape: 'backend/API-only';
  owner: 'Negentropy-Lab';
  executionHost: 'OpenClaw';
  capabilityPlane: 'smallpond-evo';
  writeBackOwner: 'Negentropy-Lab';
  authorityWriteBackTargets: ControlPlaneWriteBackTarget[];
  contractFamilies: CrossRepoContractFamilyDescriptor[];
  resultEnvelope: ResultEnvelopeBaseline;
  unsupportedResponsibilities: string[];
}

export function buildControlPlaneContractBoundary(): ControlPlaneContractBoundary {
  return {
    version: CONTROL_PLANE_CONTRACT_VERSION,
    role: 'control-plane',
    repositoryShape: 'backend/API-only',
    owner: 'Negentropy-Lab',
    executionHost: 'OpenClaw',
    capabilityPlane: 'smallpond-evo',
    writeBackOwner: 'Negentropy-Lab',
    authorityWriteBackTargets: [...CONTROL_PLANE_WRITE_BACK_TARGETS],
    contractFamilies: CROSS_REPO_CONTRACT_FAMILIES.map((family) => ({ ...family })),
    resultEnvelope: {
      minimumFields: [...RESULT_ENVELOPE_REQUIRED_FIELDS],
      diagnosticsField: 'diagnostics',
      writeBackPath: 'ResultEnvelope -> Authority absorb -> EventStore / Projection',
      evidenceFields: ['evidenceRefs', 'signature'],
    },
    unsupportedResponsibilities: [
      'Direct retrieval / embedding / sandbox / DB governance ownership inside smallpond-evo internals',
      'OpenClaw host-core replacement or extension-seam ownership',
      'Capability-plane results written directly into AuthorityState / EventStore / Projection without control-plane absorption',
    ],
  };
}
