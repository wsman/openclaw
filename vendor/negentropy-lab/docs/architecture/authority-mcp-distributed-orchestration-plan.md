# Authority MCP Distributed Orchestration Plan

## Module Boundary Reference

Use [module-map.md](./module-map.md) as the current reference for module ownership and dependency direction, especially for `authority`, `interfaces`, `integration`, and shared cluster infrastructure boundaries.

## Goal

Extend the existing authority transport and cluster substrate with lease-based leader coordination, cross-node authority snapshot sync, node-aware orchestration routing, and zero-downtime node failover while preserving the authority state as the single source of truth.

## Scope

This slice adds:

- lease-based leader election on top of the existing cluster backplane
- authoritative snapshot publication from the elected leader to follower nodes
- follower catch-up by hydrating the in-memory authority state from leader snapshots
- node-level orchestration metrics derived from existing authority monitoring and MCP routing state
- node recommendation and failover logic for distributed authority orchestration
- authority control-plane endpoints for cluster status, manual sync, and routing recommendations

Out of scope for this slice:

- Raft / Paxos log replication
- multi-writer authority mutation acceptance
- cross-datacenter quorum management
- external service mesh or Kubernetes operator integration

## Constitutional Mapping

- `§101`: distributed coordination metadata and synced authority snapshots remain rooted in `AuthorityState`
- `§102`: implementation extends the current `ClusterNode`, backplane, authority runtime, and monitoring services instead of introducing a parallel distributed subsystem
- `§103`: design lands before code
- `§130`: node routing never bypasses department and capability checks already enforced by the authority transport
- `§151`: leadership changes, snapshot sync, routing recommendations, and failover actions remain auditable
- `§306`: follower catch-up and node failover preserve zero-downtime control-plane continuity
- `§320`: implementation proceeds through the Claude Code workflow

## Design

### 1. Lease-Based Coordination

`AuthorityClusterCoordinationService` uses the existing `TaskLeaseManager` to manage a fixed lease key:

- `authority:cluster:leader`

Behavior:

1. each node periodically attempts to acquire or renew the leader lease
2. the lease holder becomes the authoritative publisher
3. when the lease expires or the leader goes offline, another node acquires the lease
4. leadership changes are projected into `AuthorityState.cluster`

This provides deterministic single-writer coordination without introducing a new consensus engine.

### 2. Cross-Node Snapshot Sync

The elected leader periodically publishes:

- authority snapshot payload
- event cursor
- generated timestamp
- local authority health summary

Followers:

- subscribe to the authority snapshot channel on the existing cluster backplane
- hydrate the local `AuthorityState` from the leader snapshot
- preserve node-local runtime fields such as local room identity and storage path details
- record sync lag, source node, and last successful cursor in `AuthorityState.cluster`

### 3. Node Metrics And Routing

Each node publishes lightweight heartbeat metrics derived from:

- `AuthorityMonitoringService`
- local MCP service health
- orchestration group coverage from the MCP transport
- current entropy / breaker status

Node recommendation uses:

- online / active status
- leader preference for write-sensitive orchestration
- sync freshness
- health score
- node load
- service-group affinity
- preferred region match

### 4. Failover And Recovery

When the leader lease moves:

1. the new leader marks the transition in `AuthorityState.cluster`
2. followers stop publishing authoritative snapshots
3. the new leader immediately publishes a fresh snapshot and heartbeat
4. routing recommendations prefer healthy, recently synced nodes

### 5. Control Plane

Add authority cluster endpoints:

- `GET /api/authority/cluster/status`
- `POST /api/authority/cluster/sync`
- `POST /api/authority/cluster/recommend-node`

The existing cluster API remains the transport substrate; the new authority endpoints expose authority-specific coordination state.

## Acceptance Criteria

### Functional

- two authority nodes elect a single leader through the existing backplane lease primitive
- the follower hydrates from the leader snapshot and records sync freshness
- authority cluster status exposes leader, followers, node metrics, and failover timestamps
- node recommendation prefers the healthiest eligible node for a requested orchestration group
- leader shutdown causes follower takeover without stopping authority control-plane operations

### Verification

1. `npm run build:server`
2. targeted distributed authority coordination tests
3. `npm run test:authority`
4. `npm run test:authority:coverage`
5. `npm run build`
6. `python scripts/measure_entropy.py --url <authority-state>`
