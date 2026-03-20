import type { N6DomainContractDescriptor } from './n6-contract-utils';

export const MEMORY_BUSINESS_PROJECTION_CONTRACT_SCHEMA_VERSION = '2026-03-19-n6a1';

export const MEMORY_BUSINESS_PROJECTION_SURFACE_SECTIONS = {
  runtimeCapability: [
    'runtimeCapability.hostMemorySummary',
    'runtimeCapability.businessArtifacts',
    'runtimeCapability.skillCandidates',
  ],
  projectionSurface: [
    'runtimeCapability.projectionSurface.memoryHost',
    'runtimeCapability.projectionSurface.businessArtifacts',
    'runtimeCapability.projectionSurface.skillCandidates',
  ],
  statusCard: [
    'runtimeCapability.statusCard.memory',
    'runtimeCapability.statusCard.business',
    'runtimeCapability.statusCard.skills',
  ],
  stableDiagnosticsSubset: [
    'runtimeCapability.stableDiagnosticsSubset.hostMemorySummary',
    'runtimeCapability.stableDiagnosticsSubset.businessArtifacts',
    'runtimeCapability.stableDiagnosticsSubset.skillCandidates',
  ],
} as const;

export const MEMORY_BUSINESS_PROJECTION_FORBIDDEN_FIELDS = [
  'rawPayload',
  'rawRuntimeObject',
  'rawShadowWorker',
  'rawSpoolSegments',
  'distillerInternals',
] as const;

export interface MemoryBusinessProjectionContract {
  contractId: 'MemoryBusinessProjectionContract';
  schemaVersion: string;
  owner: 'Negentropy-Lab';
  projectedFrom: 'authority.projection.memory-business';
  families: ['surface-summary'];
  surfaceSections: typeof MEMORY_BUSINESS_PROJECTION_SURFACE_SECTIONS;
  forbiddenFields: string[];
}

export const MEMORY_BUSINESS_PROJECTION_CONTRACT_DESCRIPTOR: N6DomainContractDescriptor = {
  contractId: 'MemoryBusinessProjectionContract',
  schemaVersion: MEMORY_BUSINESS_PROJECTION_CONTRACT_SCHEMA_VERSION,
  owner: 'Negentropy-Lab',
  source: 'Negentropy-Lab',
  families: ['surface-summary'],
  requiredFields: [
    ...MEMORY_BUSINESS_PROJECTION_SURFACE_SECTIONS.runtimeCapability,
    ...MEMORY_BUSINESS_PROJECTION_SURFACE_SECTIONS.projectionSurface,
    ...MEMORY_BUSINESS_PROJECTION_SURFACE_SECTIONS.statusCard,
    ...MEMORY_BUSINESS_PROJECTION_SURFACE_SECTIONS.stableDiagnosticsSubset,
  ],
  forbiddenFields: [...MEMORY_BUSINESS_PROJECTION_FORBIDDEN_FIELDS],
};

export function buildMemoryBusinessProjectionContract(): MemoryBusinessProjectionContract {
  return {
    contractId: 'MemoryBusinessProjectionContract',
    schemaVersion: MEMORY_BUSINESS_PROJECTION_CONTRACT_SCHEMA_VERSION,
    owner: 'Negentropy-Lab',
    projectedFrom: 'authority.projection.memory-business',
    families: ['surface-summary'],
    surfaceSections: MEMORY_BUSINESS_PROJECTION_SURFACE_SECTIONS,
    forbiddenFields: [...MEMORY_BUSINESS_PROJECTION_FORBIDDEN_FIELDS],
  };
}
