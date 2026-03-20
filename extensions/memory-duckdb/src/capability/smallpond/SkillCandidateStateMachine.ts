import type {
  SkillCandidateLifecycleState,
  SkillCandidateTransitionAction,
} from "./SkillCandidateTypes.js";
import type { SmallpondSkillCandidatePromotionStatus } from "./SmallpondContracts.js";

const SOURCE_PROMOTION_TO_LIFECYCLE: Record<
  SmallpondSkillCandidatePromotionStatus,
  SkillCandidateLifecycleState
> = {
  candidate: "draft",
  validated: "pending_review",
  promoted: "materialized",
  rejected: "rejected",
};

const OPERATOR_TRANSITIONS: Record<
  SkillCandidateLifecycleState,
  Partial<Record<SkillCandidateTransitionAction, SkillCandidateLifecycleState>>
> = {
  draft: {
    "submit-review": "pending_review",
    archive: "archived",
  },
  pending_review: {
    approve: "approved",
    reject: "rejected",
    archive: "archived",
  },
  approved: {
    archive: "archived",
  },
  rejected: {
    archive: "archived",
  },
  materialized: {
    archive: "archived",
  },
  archived: {},
};

export function mapSourcePromotionStatusToLifecycleState(
  status: SmallpondSkillCandidatePromotionStatus,
): SkillCandidateLifecycleState {
  return SOURCE_PROMOTION_TO_LIFECYCLE[status];
}

export function canTransitionSkillCandidate(
  current: SkillCandidateLifecycleState,
  action: SkillCandidateTransitionAction,
): boolean {
  return Boolean(OPERATOR_TRANSITIONS[current][action]);
}

export function transitionSkillCandidateLifecycle(
  current: SkillCandidateLifecycleState,
  action: SkillCandidateTransitionAction,
): SkillCandidateLifecycleState {
  const next = OPERATOR_TRANSITIONS[current][action];
  if (!next) {
    throw new Error(`skill candidate action ${action} is not allowed from lifecycle ${current}`);
  }
  return next;
}
