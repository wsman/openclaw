# Phase 18-20 Governance, Collaboration & Replication Design

## Module Boundary Reference

Use [module-map.md](./module-map.md) as the current reference for `authority`, `governance`, `collaboration`, `scenarios`, and `integration` boundaries while applying this design.

## Scope

This document defines the minimum authoritative implementation for:

- `Phase 18`: governance upgrade
- `Phase 19`: choreography / collaboration upgrade
- `Phase 20`: event replication, snapshot, replay, recovery

The design follows the existing Authority Core and keeps all new write paths under the authority runtime.

## Constitutional Constraints

- `§101` single source of truth: all governance, collaboration, and replication metadata remain rooted in `AuthorityState`
- `§102` entropy reduction: reuse `MutationPipeline`, `EventStore`, and `AuthorityRoom` control plane instead of parallel state stores
- `§103` doc-first: this file is the implementation gate for Phase 18-20
- `§108.1` explicit model parameters: collaboration routing never creates implicit agents
- `§130` department boundary: tool calls, subscriptions, and governance votes are resolved against registered authority sessions
- `§151` persistence: event replication and snapshot recovery preserve the authority audit chain

## Phase 18

### Deliverables

- `ConflictResolver`
- upgraded `EntropyEngine` with trend / forecast / adaptive thresholds
- scenario applications:
  - `morning-brief`
  - `entropy-drill`

### Design

- Governance proposals are stored in `AuthorityState.governance.proposals` as serialized JSON envelopes.
- Proposal approval outcome is mirrored into `AuthorityState.governance.approvals`.
- Final decision cursor is written to `AuthorityState.audit.lastDecisionId`.
- Scenario application outputs are written into `AuthorityState.workflows`.
- The pilot workflow services are implemented as scenario/application-layer consumers of governance and collaboration capabilities rather than governance-core services.

### Acceptance

- proposals can be created, voted, and resolved
- entropy report includes dimensions, thresholds, and forecast
- morning brief and entropy drill both run end-to-end through the authority runtime

## Phase 19

### Deliverables

- `CollaborationBus`
- `AgentEnvelope` standard
- topic subscription
- direct agent messaging
- workflow-to-collaboration bridge

### Design

- Collaboration metadata is stored in two new authority buckets:
  - `collaboration.topics`
  - `collaboration.subscriptions`
- The latest message per topic or direct lane is stored in `collaboration.lastMessages`.
- Every published or direct collaboration message is appended to `EventStore`.
- Capability-aware fan-out is derived from the registered authority agent sessions.

### Acceptance

- agents can subscribe to topics and receive routed envelopes
- direct agent messaging works without bypassing authority registration
- workflow events can be bridged into collaboration topics

## Phase 20

### Deliverables

- `AuthorityReplicationService`
- event log persistence
- snapshot persistence
- replay / recovery
- proposal routing endpoint for single-node and future cross-node forwarding

### Design

- Authority events are appended to `storage/authority/events.jsonl`.
- Authority snapshots are written to `storage/authority/snapshot.json`.
- Runtime recovery first hydrates the snapshot, then restores the in-memory event log from disk.
- Proposal routing is exposed as an authority endpoint and delegates to `MutationPipeline`, preserving a future upgrade path to remote forwarding.

### Acceptance

- authority events survive process restart through persisted log files
- authority snapshot can be recovered into a fresh runtime
- routed proposals preserve the audit chain

## Implementation Order

1. extend authority schema with collaboration and replication projections
2. add governance services and scenario applications
3. add collaboration bus and endpoints
4. add replication service, snapshot / recovery endpoints, and runtime integration
5. validate with targeted tests, build, and end-to-end flow
