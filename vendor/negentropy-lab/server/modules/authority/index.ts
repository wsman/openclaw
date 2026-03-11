export {
  getAuthorityRuntime,
  initializeAuthorityRuntime,
  type AuthorityRuntime,
} from "../../runtime/authorityRuntime";

export {
  authorityStateToPlain,
  hydrateAuthorityState,
} from "../../runtime/authorityStateSnapshot";

export {
  AuthorityState,
  WorkflowRuntimeState,
  GovernanceState,
  ToolState,
  CollaborationState,
  ReplicationState,
} from "../../schema/AuthorityState";

export { EventStore } from "../../services/authority/EventStore";
export { MutationPipeline } from "../../services/authority/MutationPipeline";
export { ProjectionService } from "../../services/authority/ProjectionService";
export { AuthorityAgentSessionRegistry } from "../../services/authority/AuthorityAgentSessionRegistry";
export { AuthorityReplicationService } from "../../services/authority/AuthorityReplicationService";
export { AuthorityClusterCoordinationService } from "../../services/authority/AuthorityClusterCoordinationService";

export type {
  AgentSessionHeartbeatInput,
  AgentSessionRegistrationInput,
  AgentSessionSnapshot,
  AuthorityClusterCoordinationSnapshot,
  AuthorityClusterNodeSnapshot,
  AuthorityEventRecord,
  AuthorityRecoveryStatus,
  AuthorityReplicationStatus,
  ControlProjection,
  MutationProposal,
  MutationProposalInput,
  MutationResult,
} from "../../services/authority/types";
