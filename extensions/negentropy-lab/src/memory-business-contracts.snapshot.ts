/**
 * Read-only consumer anchors for the N6-A memory-business contract family.
 *
 * Canonical vendor sources:
 *   vendor/negentropy-lab/server/gateway/contracts/host-memory-summary-contract.ts
 *   vendor/negentropy-lab/server/gateway/contracts/business-artifact-absorb-contract.ts
 *   vendor/negentropy-lab/server/gateway/contracts/skill-candidate-absorb-contract.ts
 *   vendor/negentropy-lab/server/gateway/contracts/memory-business-projection-contract.ts
 *   vendor/negentropy-lab/server/gateway/control-plane-contracts.ts
 */

// Seam anchors:
// HOST_MEMORY_SUMMARY_CONTRACT_SNAPSHOT_VERSION = '2026-03-19-n6a1'
// BUSINESS_ARTIFACT_ABSORB_CONTRACT_SNAPSHOT_VERSION = '2026-03-20-n6c1'
// SKILL_CANDIDATE_ABSORB_CONTRACT_SNAPSHOT_VERSION = '2026-03-20-n6c1'
// MEMORY_BUSINESS_PROJECTION_CONTRACT_SNAPSHOT_VERSION = '2026-03-19-n6a1'
export const HOST_MEMORY_SUMMARY_CONTRACT_SNAPSHOT_VERSION = "2026-03-19-n6a1";
export const BUSINESS_ARTIFACT_ABSORB_CONTRACT_SNAPSHOT_VERSION = "2026-03-20-n6c1";
export const SKILL_CANDIDATE_ABSORB_CONTRACT_SNAPSHOT_VERSION = "2026-03-20-n6c1";
export const MEMORY_BUSINESS_PROJECTION_CONTRACT_SNAPSHOT_VERSION = "2026-03-19-n6a1";
export const MEMORY_BUSINESS_EVIDENCE_LINK_FIELDS_SNAPSHOT_VERSION = "2026-03-20-n6d1";

export const MEMORY_BUSINESS_EVIDENCE_LINK_REQUIRED_FIELDS_SNAPSHOT = [
  "requestId",
  "capabilityCallId",
  "traceId",
  "correlationId",
  "evidenceRefs",
  "signature",
] as const;

export const MEMORY_BUSINESS_CONTRACT_CANONICAL_SOURCES = {
  hostMemorySummary:
    "vendor/negentropy-lab/server/gateway/contracts/host-memory-summary-contract.ts",
  businessArtifactAbsorb:
    "vendor/negentropy-lab/server/gateway/contracts/business-artifact-absorb-contract.ts",
  skillCandidateAbsorb:
    "vendor/negentropy-lab/server/gateway/contracts/skill-candidate-absorb-contract.ts",
  memoryBusinessProjection:
    "vendor/negentropy-lab/server/gateway/contracts/memory-business-projection-contract.ts",
  controlPlaneContracts: "vendor/negentropy-lab/server/gateway/control-plane-contracts.ts",
} as const;
