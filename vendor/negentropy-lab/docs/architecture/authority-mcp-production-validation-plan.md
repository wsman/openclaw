# Authority MCP Production Validation Plan

## Module Boundary Reference

Use [module-map.md](./module-map.md) as the current reference for current module boundaries when validating authority cluster, MCP transport, and integration behavior.

## Goal

Validate the authority cluster and MCP transport stack in a real multi-process staging environment before production rollout, with emphasis on leader election, follower sync freshness, failover timing, snapshot recovery, and operational observability.

## Scope

This slice covers:

- a `2-3` authority node staging topology running as separate OS processes
- Redis-backed authority cluster coordination and lease management
- staged verification of leader election, state sync, routing recommendation, failover, and snapshot hydrate
- staging deployment assets, validation scripts, and operations documentation
- monitoring and alert calibration for authority cluster health

This slice does not cover:

- Redis Sentinel / Redis Cluster high availability for the backplane itself
- cross-datacenter authority replication
- multi-writer authority mutation acceptance
- Kubernetes operator or service mesh integration

## Constitutional Mapping

- `§101`: distributed validation still treats `AuthorityState` as the single source of truth
- `§102`: implementation extends existing bootstrap, cluster, and operations assets instead of introducing a parallel deployment stack
- `§103`: design lands before staging scripts and rollout assets
- `§151`: staging validation, failover events, and snapshot recovery remain auditable
- `§306`: deployment verification preserves zero-downtime failover expectations for the authority control plane
- `§320`: execution proceeds through the Claude Code workflow

## Topology

### Authority Nodes

Staging runs three independent authority nodes:

- `authority-node-a` on `3311`
- `authority-node-b` on `3312`
- `authority-node-c` on `3313`

Each node:

- runs `dist/server/index.js` in its own process
- keeps its own authority storage path
- connects to the same logical Redis backplane
- participates in lease-based leader election through `AuthorityClusterCoordinationService`

### Redis Backplane

The staging slice validates the current `RedisClusterBackplane` implementation against one logical Redis endpoint with persistence enabled. This is sufficient for multi-node authority validation because the runtime currently consumes a single Redis connection target. Redis HA remains a later rollout concern.

## Validation Scenarios

### 1. Multi-Node Startup And Leadership

Verify:

- all nodes report `cluster.enabled = true`
- exactly one node reports `role = leader`
- all nodes converge on the same `leaderNodeId`
- `/api/authority/cluster/status` exposes consistent cluster identity

Acceptance targets:

- leader election converges in `< 5s`
- cluster health endpoints return success on every node

### 2. Snapshot Sync And Consistency

Verify:

- followers report non-error cluster status
- manual sync through `/api/authority/cluster/sync` succeeds
- monitoring snapshots expose cluster coordination state without `authority_cluster_sync_stale`
- routing recommendations remain stable during steady state

Acceptance targets:

- follower sync freshness remains `< 1s` behind the leader in steady state
- no stale sync alert during healthy operation

### 3. Leader Failover

Verify:

- stopping the elected leader causes a follower takeover
- surviving nodes converge on a new `leaderNodeId`
- `/api/authority/cluster/recommend-node` returns the new leader for leader-required routing
- monitoring surfaces failover metadata without blocking the control plane

Acceptance targets:

- failover convergence completes in `< 10s`
- control-plane endpoints remain available from surviving nodes

### 4. Snapshot Hydrate Recovery

Verify:

- manual snapshot creation succeeds before restart
- restarted followers hydrate from authoritative state
- recovered nodes rejoin the cluster without corrupting the leader projection

Acceptance targets:

- snapshot recovery completes in `< 30s`
- recovered node re-enters with non-stale cluster status

### 5. Node Recommendation

Verify:

- `/api/authority/cluster/recommend-node` returns a healthy eligible node
- leader-required recommendations prefer the current leader
- orchestration-group recommendations stay deterministic across nodes

Acceptance targets:

- recommendation response time remains `< 50ms` in steady state
- recommendation correctness is `100%` for leader-required requests

### 6. Fault Injection

Verify:

- leader termination
- Redis disconnect / reconnect rehearsal
- follower restart after stale sync window
- MCP transport degradation while cluster coordination remains healthy

Acceptance targets:

- cluster recovers or degrades visibly without silent data loss
- post-incident operations reports provide actionable recommendations

## Assets

### Deployment

- `docker-compose.authority-staging.yml`
- environment-driven server bootstrap for cluster/discovery toggles

### Validation

- `scripts/authority-cluster-validation.ts`
- `scripts/authority-cluster-monitoring.ts`
- `scripts/authority-cluster-rehearshal.ts`
- authority cluster script tests and bootstrap env tests

### Documentation

- `docs/authority-production-deployment.md`
- `docs/authority-operations-runbook.md`
- `docs/templates/authority-staging-acceptance-template.md`
- `reports/README.md`

## Acceptance Chain

1. `npm run build:server`
2. `npm run test:authority`
3. `npm run test:authority:coverage`
4. `npm run build`
5. staging validation via `npm run ops:authority:cluster:validate`
6. cluster alert calibration via `npm run ops:authority:cluster:monitor`
7. staging fault rehearsal via `npm run ops:authority:cluster:rehearshal`
8. entropy verification via `python scripts/measure_entropy.py --url <authority-state>`

The documentation handoff for this slice is:

- design gate: `docs/architecture/authority-mcp-production-validation-plan.md`
- operations execution: `docs/authority-operations-runbook.md`
- staging sign-off: `docs/templates/authority-staging-acceptance-template.md`
- report schema + archival policy: `reports/README.md`

## Rollback

If staging validation fails:

1. stop the failing authority node or bring down the staging compose stack
2. preserve per-node authority storage and Redis persistence for diagnosis
3. rerun validation against a single-node authority deployment if cluster coordination must be isolated
4. revert to the previously accepted authority transport baseline before retrying multi-node rollout
