export const SMALLPOND_ARTIFACT_TYPES = [
  "business_fact",
  "governance_decision",
  "evidence_summary",
  "advisory_summary",
  "handoff_summary",
  "judge_summary",
  "tenant_insight",
  "operator_pattern",
  "skill_candidate",
  "release_readiness_note",
] as const;

export type SmallpondArtifactType = (typeof SMALLPOND_ARTIFACT_TYPES)[number];

export const SMALLPOND_KNOWLEDGE_KINDS = [
  "business_fact",
  "governance_decision",
  "evidence_summary",
  "lesson",
  "handoff_summary",
  "judge_summary",
  "tenant_insight",
  "operator_pattern",
  "skill_candidate",
  "release_readiness_note",
] as const;

export type SmallpondKnowledgeKind = (typeof SMALLPOND_KNOWLEDGE_KINDS)[number];

export const SMALLPOND_READ_PATH_KINDS = [
  "fact-view",
  "governance-view",
  "summary-view",
  "candidate-view",
] as const;

export type SmallpondReadPathKind = (typeof SMALLPOND_READ_PATH_KINDS)[number];

export const SMALLPOND_APPROVED_SOURCE_VIEWS = [
  "v_smallpond_business_facts",
  "v_smallpond_governance_decisions",
  "v_smallpond_evidence_summaries",
  "v_smallpond_advisory_summaries",
  "v_smallpond_handoff_summaries",
  "v_smallpond_judge_summaries",
  "v_smallpond_tenant_insights",
  "v_smallpond_operator_patterns",
  "v_smallpond_skill_candidates",
  "v_smallpond_release_readiness_notes",
] as const;

export type SmallpondApprovedSourceView = (typeof SMALLPOND_APPROVED_SOURCE_VIEWS)[number];

export const SMALLPOND_FORBIDDEN_RAW_SOURCES = [
  "business_fact_events_raw",
  "governance_decisions_raw",
  "evidence_fragments_raw",
  "advisory_runs_raw",
  "handoff_packets_raw",
  "judge_sessions_raw",
  "tenant_signal_frames_raw",
  "operator_pattern_runs_raw",
  "skill_gene_pool_raw",
  "release_gate_events_raw",
] as const;

export type SmallpondInventoryEntry = {
  artifactType: SmallpondArtifactType;
  allowedSourceSurface: SmallpondApprovedSourceView;
  allowedReadPathKind: SmallpondReadPathKind;
  hostLocalMaterializable: boolean;
  controlPlaneWriteBackRelevant: boolean;
  forbiddenRawSource: (typeof SMALLPOND_FORBIDDEN_RAW_SOURCES)[number];
};

export const SMALLPOND_ARTIFACT_INVENTORY = [
  {
    artifactType: "business_fact",
    allowedSourceSurface: "v_smallpond_business_facts",
    allowedReadPathKind: "fact-view",
    hostLocalMaterializable: true,
    controlPlaneWriteBackRelevant: true,
    forbiddenRawSource: "business_fact_events_raw",
  },
  {
    artifactType: "governance_decision",
    allowedSourceSurface: "v_smallpond_governance_decisions",
    allowedReadPathKind: "governance-view",
    hostLocalMaterializable: true,
    controlPlaneWriteBackRelevant: true,
    forbiddenRawSource: "governance_decisions_raw",
  },
  {
    artifactType: "evidence_summary",
    allowedSourceSurface: "v_smallpond_evidence_summaries",
    allowedReadPathKind: "summary-view",
    hostLocalMaterializable: true,
    controlPlaneWriteBackRelevant: true,
    forbiddenRawSource: "evidence_fragments_raw",
  },
  {
    artifactType: "advisory_summary",
    allowedSourceSurface: "v_smallpond_advisory_summaries",
    allowedReadPathKind: "summary-view",
    hostLocalMaterializable: true,
    controlPlaneWriteBackRelevant: true,
    forbiddenRawSource: "advisory_runs_raw",
  },
  {
    artifactType: "handoff_summary",
    allowedSourceSurface: "v_smallpond_handoff_summaries",
    allowedReadPathKind: "summary-view",
    hostLocalMaterializable: true,
    controlPlaneWriteBackRelevant: false,
    forbiddenRawSource: "handoff_packets_raw",
  },
  {
    artifactType: "judge_summary",
    allowedSourceSurface: "v_smallpond_judge_summaries",
    allowedReadPathKind: "summary-view",
    hostLocalMaterializable: true,
    controlPlaneWriteBackRelevant: false,
    forbiddenRawSource: "judge_sessions_raw",
  },
  {
    artifactType: "tenant_insight",
    allowedSourceSurface: "v_smallpond_tenant_insights",
    allowedReadPathKind: "summary-view",
    hostLocalMaterializable: true,
    controlPlaneWriteBackRelevant: true,
    forbiddenRawSource: "tenant_signal_frames_raw",
  },
  {
    artifactType: "operator_pattern",
    allowedSourceSurface: "v_smallpond_operator_patterns",
    allowedReadPathKind: "summary-view",
    hostLocalMaterializable: true,
    controlPlaneWriteBackRelevant: true,
    forbiddenRawSource: "operator_pattern_runs_raw",
  },
  {
    artifactType: "skill_candidate",
    allowedSourceSurface: "v_smallpond_skill_candidates",
    allowedReadPathKind: "candidate-view",
    hostLocalMaterializable: true,
    controlPlaneWriteBackRelevant: true,
    forbiddenRawSource: "skill_gene_pool_raw",
  },
  {
    artifactType: "release_readiness_note",
    allowedSourceSurface: "v_smallpond_release_readiness_notes",
    allowedReadPathKind: "summary-view",
    hostLocalMaterializable: true,
    controlPlaneWriteBackRelevant: true,
    forbiddenRawSource: "release_gate_events_raw",
  },
] as const satisfies readonly SmallpondInventoryEntry[];

function assertEnumValue<T extends string>(
  value: string,
  allowedValues: readonly T[],
  label: string,
): T {
  if (!allowedValues.includes(value as T)) {
    throw new Error(`${label} must be one of ${allowedValues.join(", ")}`);
  }
  return value as T;
}

export function assertSmallpondArtifactType(value: string): SmallpondArtifactType {
  return assertEnumValue(value, SMALLPOND_ARTIFACT_TYPES, "Smallpond artifact type");
}

export function assertSmallpondKnowledgeKind(value: string): SmallpondKnowledgeKind {
  return assertEnumValue(value, SMALLPOND_KNOWLEDGE_KINDS, "Smallpond knowledge kind");
}

export function assertSmallpondApprovedSourceView(value: string): SmallpondApprovedSourceView {
  return assertEnumValue(value, SMALLPOND_APPROVED_SOURCE_VIEWS, "Smallpond source view");
}

export function getSmallpondArtifactInventoryEntry(
  artifactType: SmallpondArtifactType,
): SmallpondInventoryEntry {
  const entry = SMALLPOND_ARTIFACT_INVENTORY.find(
    (candidate) => candidate.artifactType === artifactType,
  );
  if (!entry) {
    throw new Error(
      `Smallpond artifact type is not part of the approved inventory: ${artifactType}`,
    );
  }
  return entry;
}

export function getSmallpondInventoryEntryForSourceView(
  sourceView: SmallpondApprovedSourceView,
): SmallpondInventoryEntry {
  const entry = SMALLPOND_ARTIFACT_INVENTORY.find(
    (candidate) => candidate.allowedSourceSurface === sourceView,
  );
  if (!entry) {
    throw new Error(`Smallpond source view is not part of the approved inventory: ${sourceView}`);
  }
  return entry;
}
