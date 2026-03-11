# Authority Production Readiness Plan

## Module Boundary Reference

Use [module-map.md](./module-map.md) as the current reference for current module boundaries when defining production readiness scope and rollout checks.

## Goal

Prepare the Authority Core for production operation without breaking the existing single-source-of-truth mutation model.

## Scope

This round focuses on Option C: production deployment readiness.

Included:

- runtime monitoring and health aggregation
- automatic snapshotting and startup recovery visibility
- event log rotation and storage health inspection
- production deployment and failure-recovery documentation
- end-to-end acceptance updates for the new operations surface

Excluded:

- multi-node leader election
- distributed consensus changes
- new business workflows unrelated to authority operations

## Constitutional Mapping

- `§101`: all operational state remains derived from the Authority runtime and persisted authority artifacts
- `§102`: reuse the existing runtime, mutation pipeline, event store, and replication service instead of creating parallel state systems
- `§103`: document the production design gate before implementation
- `§151`: snapshots, recovery metadata, and event logs remain auditable
- `§300.3`: production readiness must be validated by build, targeted tests, end-to-end tests, and coverage gate

## Design

### 1. Monitoring Plane

Add `AuthorityMonitoringService` as a derived read model over:

- authority state
- entropy engine report
- breaker status
- agent session registry
- tool plane counters
- workflow / governance counts
- replication health and storage statistics

Expose two HTTP read endpoints:

- `GET /api/authority/monitoring`
- `GET /api/authority/ops`

Expose one WebSocket read action:

- `query_monitoring`

The monitoring plane must not mutate authority state except through already-existing runtime services.

### 2. Replication Hardening

Extend `AuthorityReplicationService` with:

- auto snapshot policy driven by time interval and event threshold
- storage metrics for snapshot, active log, and rotated log archives
- log rotation once the active event log exceeds a size threshold
- startup recovery report with explicit success/failure details
- degraded status when storage operations fail

Configuration will be read from environment variables with safe defaults:

- `AUTHORITY_STORAGE_DIR`
- `AUTHORITY_SNAPSHOT_INTERVAL_MS`
- `AUTHORITY_SNAPSHOT_EVENT_THRESHOLD`
- `AUTHORITY_LOG_ROTATE_BYTES`
- `AUTHORITY_LOG_RETENTION`

### 3. Runtime Integration

Update the singleton runtime assembly to:

- construct and expose the monitoring service
- reuse the existing replication service for startup recovery
- dispose background timers/subscriptions during runtime reset

### 4. Operational Assets

Add:

- production deployment guide
- authority operations runbook
- authority operations reporting script
- authority recovery drill script

## Acceptance Criteria

### Functional

- monitoring endpoint returns authority, entropy, breaker, session, tool, workflow, governance, and replication summaries
- replication service auto-creates snapshots without requiring room simulation ticks
- rotated event logs are visible through storage health inspection
- startup recovery reports whether a snapshot was restored and what files were used
- ops scripts can query monitoring and execute a recovery drill against a live server

### Performance

- monitoring endpoint responds from in-memory state and local filesystem metadata only
- auto snapshotting does not block normal mutation flow beyond small synchronous file writes
- log rotation keeps active log bounded by configured threshold

### Verification

Acceptance chain for this phase:

1. `npm run build:server`
2. targeted Authority tests
3. Authority coverage gate
4. Authority end-to-end acceptance test
5. full `npm run build`
