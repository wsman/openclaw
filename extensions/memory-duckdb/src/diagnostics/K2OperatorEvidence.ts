export const K2_B3_EVIDENCE_FIELDS = [
  "recovery_class",
  "detection_signals",
  "authoritative_truth",
  "must_not_advance",
  "safe_actions",
  "required_evidence",
  "last_verified_at",
  "drill_status",
] as const;

export type OperatorEvidenceField = (typeof K2_B3_EVIDENCE_FIELDS)[number];

export const K2_B3_RECOVERY_CLASSES = [
  "shadow_apply_failed",
  "shadow_replay_busy",
  "shadow_checkpoint_invalid",
  "shadow_parity_mismatch",
  "native_binding_unavailable",
  "spool_checkpoint_divergence",
] as const;

export type RecoveryClass = (typeof K2_B3_RECOVERY_CLASSES)[number];

export const K2_B3_DRILL_SCENARIOS = [
  "replay_lag",
  "parity_mismatch",
  "corrupt_checkpoint",
  "failed_shadow_apply",
  "missing_native_binding",
] as const;

export type DrillScenario = (typeof K2_B3_DRILL_SCENARIOS)[number];

export type DrillStatus =
  | "covered:replay_lag"
  | "covered:parity_mismatch"
  | "covered:corrupt_checkpoint"
  | "covered:failed_shadow_apply"
  | "covered:missing_native_binding"
  | "manual-only"
  | "pending";

export type OperatorEvidencePackEntry = {
  recovery_class: RecoveryClass;
  detection_signals: string[];
  authoritative_truth: string[];
  must_not_advance: string[];
  safe_actions: string[];
  required_evidence: string[];
  last_verified_at: string;
  drill_status: DrillStatus;
};
