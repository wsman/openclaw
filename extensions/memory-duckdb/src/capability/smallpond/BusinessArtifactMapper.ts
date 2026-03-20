import {
  getSmallpondArtifactInventoryEntry,
  type SmallpondArtifactType,
  type SmallpondKnowledgeKind,
} from "./SmallpondArtifactInventory.js";
import type { SmallpondReadArtifact } from "./SmallpondContracts.js";

export const SMALLPOND_ARTIFACT_TO_KNOWLEDGE_KINDS = {
  business_fact: ["business_fact"],
  governance_decision: ["governance_decision"],
  evidence_summary: ["evidence_summary"],
  advisory_summary: ["lesson", "operator_pattern"],
  handoff_summary: ["handoff_summary"],
  judge_summary: ["judge_summary"],
  tenant_insight: ["tenant_insight"],
  operator_pattern: ["operator_pattern"],
  skill_candidate: ["skill_candidate"],
  release_readiness_note: ["release_readiness_note"],
} as const satisfies Record<SmallpondArtifactType, readonly SmallpondKnowledgeKind[]>;

export function mapSmallpondArtifactTypeToKnowledgeKinds(
  artifactType: SmallpondArtifactType,
): SmallpondKnowledgeKind[] {
  return [...SMALLPOND_ARTIFACT_TO_KNOWLEDGE_KINDS[artifactType]];
}

export function mapSmallpondReadArtifactToKnowledgeKinds(
  artifact: Pick<SmallpondReadArtifact, "artifactType">,
): SmallpondKnowledgeKind[] {
  return mapSmallpondArtifactTypeToKnowledgeKinds(artifact.artifactType);
}

export function isHostMaterializableArtifactType(artifactType: SmallpondArtifactType): boolean {
  return getSmallpondArtifactInventoryEntry(artifactType).hostLocalMaterializable;
}

export function isControlPlaneWriteBackRelevantArtifactType(
  artifactType: SmallpondArtifactType,
): boolean {
  return getSmallpondArtifactInventoryEntry(artifactType).controlPlaneWriteBackRelevant;
}
