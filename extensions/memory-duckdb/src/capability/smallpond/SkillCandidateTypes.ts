import type { SmallpondKnowledgeKind } from "./SmallpondArtifactInventory.js";
import type {
  SmallpondSkillCandidatePriority,
  SmallpondSkillCandidatePromotionStatus,
} from "./SmallpondContracts.js";

export const SKILL_CANDIDATE_LIFECYCLE_STATES = [
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "materialized",
  "archived",
] as const;

export type SkillCandidateLifecycleState = (typeof SKILL_CANDIDATE_LIFECYCLE_STATES)[number];

export const SKILL_CANDIDATE_TRANSITION_ACTIONS = [
  "submit-review",
  "approve",
  "reject",
  "archive",
] as const;

export type SkillCandidateTransitionAction = (typeof SKILL_CANDIDATE_TRANSITION_ACTIONS)[number];

export const MEMORY_SKILL_CANDIDATE_PIPELINE_STATES = [
  "idle",
  "syncing",
  "ok",
  "degraded",
  "disabled",
] as const;

export type MemorySkillCandidatePipelineState =
  (typeof MEMORY_SKILL_CANDIDATE_PIPELINE_STATES)[number];

export type SkillCandidateLifecycleCounts = Record<SkillCandidateLifecycleState, number>;

export type SkillCandidateRecordMetadata = {
  candidateId: string;
  lifecycleState: SkillCandidateLifecycleState;
  title: string;
  trigger: string;
  steps: string[];
  priority: SmallpondSkillCandidatePriority;
  confidence: number;
  sourceRefs: string[];
  evidenceRefs: string[];
  derivedFromKinds: SmallpondKnowledgeKind[];
  sourcePromotionStatus: SmallpondSkillCandidatePromotionStatus;
  updatedAt: string;
};

export type ProjectedSkillCandidate = {
  candidateId: string;
  title: string;
  summary: string;
  trigger: string;
  steps: string[];
  priority: SmallpondSkillCandidatePriority;
  confidence: number;
  sourceRefs: string[];
  evidenceRefs: string[];
  derivedFromKinds: SmallpondKnowledgeKind[];
  sourcePromotionStatus: SmallpondSkillCandidatePromotionStatus;
  lifecycleState: SkillCandidateLifecycleState;
  updatedAt: string;
  sourceRecordId: string;
  sourceRecordMetadata: Record<string, unknown>;
};

export type SkillCandidateMaterializeAction = "created" | "updated" | "duplicate" | "stale";

export type SkillCandidateMaterializeResult = {
  action: SkillCandidateMaterializeAction;
  candidateId: string;
  updatedAt: string;
  recordId?: string;
};

export type MemorySkillCandidateSyncTrigger = "startup" | "manual";

export type MemorySkillCandidatePipelineStatus = {
  state: MemorySkillCandidatePipelineState;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastCandidateId: string | null;
  generatedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  countsByLifecycle: SkillCandidateLifecycleCounts;
  lastError: string | null;
};

export type MemorySkillCandidateSyncResult = {
  trigger: MemorySkillCandidateSyncTrigger;
  state: MemorySkillCandidatePipelineState;
  generatedCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  lastCandidateId: string | null;
  lastError: string | null;
};

export function createEmptySkillCandidateLifecycleCounts(): SkillCandidateLifecycleCounts {
  return {
    draft: 0,
    pending_review: 0,
    approved: 0,
    rejected: 0,
    materialized: 0,
    archived: 0,
  };
}
