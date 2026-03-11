# Authority Operations Runbook

## Monitoring Commands

```bash
npm run ops:authority:report -- --url http://127.0.0.1:3000/api/authority/monitoring
curl http://127.0.0.1:3000/api/authority/ops
curl http://127.0.0.1:3000/api/authority/cluster/status
curl http://127.0.0.1:3000/api/authority/replication
curl http://127.0.0.1:3000/api/authority/tools
curl http://127.0.0.1:3000/api/authority/tools/mcp/services
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/services/register \
  -H "content-type: application/json" \
  -d '{"serviceId":"remote-http-control-plane","provider":"remote-fixture","transport":"http","endpoint":"http://127.0.0.1:4100","source":"remote-fixture","modules":["remote"],"priority":50}'
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/polling/trigger \
  -H "content-type: application/json" \
  -d '{"serviceId":"local-mcp-core"}'
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/services/local-mcp-core/control \
  -H "content-type: application/json" \
  -d '{"action":"pause","reason":"maintenance_window"}'
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/services/local-mcp-core/policy \
  -H "content-type: application/json" \
  -d '{"slo":{"targetLatencyMs":400,"minSuccessRate":0.95,"maxFailureRate":0.1,"routeBias":1.5},"failback":{"maxRecoveryAttempts":2,"recoveryLockoutMs":60000}}'
curl -X POST http://127.0.0.1:3000/api/authority/cluster/recommend-node \
  -H "content-type: application/json" \
  -d '{"serviceGroup":"daily-brief","preferredRegion":"cn-east-1","requireLeader":true}'
curl -X POST http://127.0.0.1:3000/api/authority/cluster/sync
curl http://127.0.0.1:3000/api/authority/tools/usage
curl -X POST http://127.0.0.1:3000/api/authority/agents/sync-live
npm run ops:authority:cluster:validate -- --base-urls http://127.0.0.1:3311,http://127.0.0.1:3312,http://127.0.0.1:3313 --expected-node-count 3 --preferred-region cn-east-1
```

## Alert Interpretation

Common monitoring alerts:

- `entropy_global_warning`: global entropy is above warning threshold
- `entropy_global_high`: global entropy is above danger threshold
- `breaker_guarded`: breaker entered guarded mode
- `breaker_escalated`: breaker entered recovery or lockdown path
- `replication_snapshot_missing`: no local snapshot exists yet
- `replication_active_log_near_limit`: log rotation threshold is being approached
- `replication_archive_retention_full`: archive retention window is saturated
- `replication_last_error_present`: last replication write or recovery attempt failed
- `agent_degraded_present`: at least one connected agent is degraded
- `agent_unhealthy_present`: at least one connected agent is unhealthy
- `mcp_service_unhealthy`: at least one real MCP transport is degraded
- `mcp_service_recovering`: at least one real MCP transport is recovering through polling
- `mcp_service_constrained`: at least one real MCP transport is paused or isolated
- `mcp_service_in_maintenance`: at least one service is inside a scheduled maintenance window
- `mcp_service_slo_violation`: at least one service violates configured SLO policy
- `mcp_service_recovery_locked`: at least one service is held behind recovery lockout
- `mcp_service_canary_ramp`: at least one service is receiving less than its configured traffic share during recovery or control actions
- `mcp_service_maintenance_conflict`: at least one service still carries overlapping maintenance windows that require review
- `authority_cluster_leader_missing`: cluster mode is enabled but no leader is currently projected
- `authority_cluster_sync_stale`: follower state has fallen behind the leader snapshot window

## Snapshot Procedure

Create a manual snapshot:

```bash
curl -X POST http://127.0.0.1:3000/api/authority/replication/snapshot
```

Verify snapshot health:

```bash
curl http://127.0.0.1:3000/api/authority/replication
curl http://127.0.0.1:3000/api/authority/monitoring
```

## Recovery Procedure

Run a recovery drill:

```bash
npm run ops:authority:recovery:drill -- --base-url http://127.0.0.1:3000
```

Manual recovery:

```bash
curl -X POST http://127.0.0.1:3000/api/authority/replication/recover
```

After recovery, confirm:

- `/api/authority/ops` still returns a payload
- `replication.recovery.recovered = true`
- `replication.lastError` is empty

## Live Scenario Validation

Synchronize live agents:

```bash
curl -X POST http://127.0.0.1:3000/api/authority/agents/sync-live
```

Run live morning brief:

```bash
curl -X POST http://127.0.0.1:3000/api/authority/workflows/morning-brief/live
```

Run live budget conflict:

```bash
curl -X POST http://127.0.0.1:3000/api/authority/governance/scenarios/budget-conflict \
  -H "content-type: application/json" \
  -d '{"title":"Ops budget validation","requestedAmount":1500000}'
```

Run the baseline script:

```bash
npm run ops:authority:baseline -- --base-url http://127.0.0.1:3000 --iterations 3
```

## MCP Tool Plane Validation

Discover the real local MCP Core service:

```bash
curl http://127.0.0.1:3000/api/authority/tools/mcp/services
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/services/register \
  -H "content-type: application/json" \
  -d '{"serviceId":"remote-http-control-plane","provider":"remote-fixture","transport":"http","endpoint":"http://127.0.0.1:4100","source":"remote-fixture","modules":["remote"],"priority":50}'
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/discover \
  -H "content-type: application/json" \
  -d '{"serviceId":"remote-http-control-plane"}'
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/services/local-mcp-core/health-check
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/polling/trigger \
  -H "content-type: application/json" \
  -d '{"serviceId":"remote-http-control-plane"}'
```

Verify discovery, metadata, and usage:

```bash
curl "http://127.0.0.1:3000/api/authority/tools/discovery?agentId=agent:technology_ministry&department=TECHNOLOGY&protocol=mcp"
curl "http://127.0.0.1:3000/api/authority/tools/get_codex_structure/metadata?agentId=agent:technology_ministry&department=TECHNOLOGY"
curl http://127.0.0.1:3000/api/authority/tools/usage
```

Execute a smoke-test call:

```bash
curl -X POST http://127.0.0.1:3000/api/authority/tools/call \
  -H "content-type: application/json" \
  -d '{"toolName":"get_codex_structure","agentId":"agent:technology_ministry","args":{"law_type":"all"}}'
```

Expected results:

- discovery returns authority-registered MCP Core tools permitted for the requested department
- metadata includes an access decision and remaining quota
- usage shows `usageCount` increasing after the smoke-test call
- service inventory reports `local-mcp-core` as healthy after a successful discovery or call
- remote service inventory can include `remote-http-control-plane` after control-plane registration
- monitoring reports `pausedMcpServices`, `isolatedMcpServices`, `recoveringMcpServices`, and `lastMcpPollAt`
- services report `routeScore`, `sloStatus`, `servicesInMaintenance`, and `recoveryLockoutUntil`
- manual-approval tools remain discoverable but reject execution until approved

## MCP Service Lifecycle Controls

Pause a service without disabling discovery metadata:

```bash
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/services/remote-http-control-plane/control \
  -H "content-type: application/json" \
  -d '{"action":"pause","reason":"maintenance_window"}'
```

Resume routing:

```bash
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/services/remote-http-control-plane/control \
  -H "content-type: application/json" \
  -d '{"action":"resume","reason":"maintenance_complete"}'
```

Isolate a service so it stays monitored but will not receive traffic:

```bash
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/services/remote-http-control-plane/control \
  -H "content-type: application/json" \
  -d '{"action":"isolate","reason":"forensic_inspection"}'
```

Disable and re-enable a service:

```bash
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/services/remote-http-control-plane/control \
  -H "content-type: application/json" \
  -d '{"action":"disable","reason":"operator_disable"}'
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/services/remote-http-control-plane/control \
  -H "content-type: application/json" \
  -d '{"action":"enable","reason":"operator_enable"}'
```

Confirm the lifecycle state:

- `/api/authority/tools/mcp/services` returns `operationalMode`, `healthStatus`, and polling metadata
- `/api/authority/monitoring` returns `pausedMcpServices`, `isolatedMcpServices`, `recoveringMcpServices`, and `lastMcpPollAt`
- `/api/authority/ops` recommends `inspect_mcp_service_controls` when constrained services exist

## Maintenance Windows

Schedule a one-time maintenance window:

```bash
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/services/remote-http-control-plane/windows \
  -H "content-type: application/json" \
  -d '{"windowId":"window:ops-maintenance","startAt":"2026-03-10T02:00:00Z","endAt":"2026-03-10T02:30:00Z","action":"pause","autoRecover":true,"reason":"ops_window","priority":1,"conflictPolicy":"merge"}'
```

Remove the maintenance window:

```bash
curl -X DELETE http://127.0.0.1:3000/api/authority/tools/mcp/services/remote-http-control-plane/windows/window:ops-maintenance
```

Expected results:

- the service enters `servicesInMaintenance = true` during the active window
- `operationalMode` changes according to the scheduled action
- auto-recovery restores the pre-window route mode when `autoRecover = true`
- overlapping windows can be merged, deferred, replaced, or rejected through `conflictPolicy`

## SLO And Failback Policy

Apply service policy:

```bash
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/services/remote-http-control-plane/policy \
  -H "content-type: application/json" \
  -d '{"slo":{"targetLatencyMs":400,"minSuccessRate":0.95,"maxFailureRate":0.1,"routeBias":2},"traffic":{"allocationPercent":35,"canaryPercent":10,"rampStepPercent":15,"rampIntervalMs":1000,"lane":"canary"},"failback":{"maxRecoveryAttempts":2,"recoveryLockoutMs":60000,"minHealthyDurationMs":60000},"orchestration":{"serviceGroup":"daily-brief","templateId":"template:daily-brief","preferredNodes":["node-alpha"],"excludedNodes":["node-omega"],"regions":["cn-east-1"],"tags":["briefing","canary"]}}'
```

Expected results:

- `/api/authority/tools/mcp/services` exposes `routeScore` and `sloStatus`
- `/api/authority/tools/mcp/services` also exposes `configuredTrafficPercent`, `effectiveTrafficPercent`, `trafficLane`, and orchestration metadata
- repeated failed recoveries set `recoveryLockoutUntil`
- recovered services re-enter traffic through `canaryPercent` and ramp upward according to `rampStepPercent` and `rampIntervalMs`
- `/api/authority/ops` recommends `review_mcp_slo_policy` or `clear_mcp_recovery_lockout` when necessary
- `/api/authority/ops` recommends `review_mcp_canary_ramp` or `review_mcp_maintenance_conflicts` when traffic or maintenance arbitration needs operator attention

## Cluster Coordination

Inspect cluster leadership and node projections:

```bash
curl http://127.0.0.1:3000/api/authority/cluster/status
```

Request a routing recommendation for an orchestration group:

```bash
curl -X POST http://127.0.0.1:3000/api/authority/cluster/recommend-node \
  -H "content-type: application/json" \
  -d '{"serviceGroup":"daily-brief","preferredRegion":"cn-east-1","requireLeader":true}'
```

Force a leader snapshot publish or follower resync:

```bash
curl -X POST http://127.0.0.1:3000/api/authority/cluster/sync
```

Expected results:

- `/api/authority/cluster/status` exposes `leaderNodeId`, `syncStatus`, and projected node health
- `/api/authority/monitoring` exposes cluster summary fields and alerts for stale sync or missing leadership
- `/api/authority/ops` recommends `review_authority_cluster_sync` or `inspect_authority_cluster_failover` when coordination degrades

For a full staging rehearsal, bring up the compose stack and run:

```bash
npm run ops:authority:staging:up
npm run ops:authority:cluster:validate -- --base-urls http://127.0.0.1:3311,http://127.0.0.1:3312,http://127.0.0.1:3313 --expected-node-count 3 --preferred-region cn-east-1
npm run ops:authority:cluster:monitor -- --base-urls http://127.0.0.1:3311,http://127.0.0.1:3312,http://127.0.0.1:3313 --expected-node-count 3 --max-warnings 0
```

The monitoring calibration script writes `reports/authority-cluster-monitoring-<timestamp>.json` and checks:

- cluster leadership is present and consistent
- node inventory matches `--expected-node-count`
- warning and critical node counts stay inside the selected `--fail-on` threshold and `--max-warnings` budget
- stale sync and leader missing nodes stay within budget
- expected alert wiring is observed after controlled fault injection
- forbidden alerts stay absent during steady-state validation

Use `docs/templates/authority-staging-acceptance-template.md` to capture the staging execution record and attach the generated JSON reports. For field definitions, naming rules, and archival policy, see `reports/README.md`.

### Staging Rehearshal Scenarios

Run fault injection scenarios against the staging cluster:

```bash
# Run all scenarios
npm run ops:authority:cluster:rehearshal -- --base-urls http://127.0.0.1:3311,http://127.0.0.1:3312,http://127.0.0.1:3313

# Run specific scenario
npm run ops:authority:cluster:rehearshal -- --scenario leader-kill --base-urls http://127.0.0.1:3311,http://127.0.0.1:3312,http://127.0.0.1:3313
npm run ops:authority:cluster:rehearshal -- --scenario follower-restart --base-urls http://127.0.0.1:3311,http://127.0.0.1:3312,http://127.0.0.1:3313
npm run ops:authority:cluster:rehearshal -- --scenario network-partition --base-urls http://127.0.0.1:3311,http://127.0.0.1:3312,http://127.0.0.1:3313
npm run ops:authority:cluster:rehearshal -- --scenario full-restart --base-urls http://127.0.0.1:3311,http://127.0.0.1:3312,http://127.0.0.1:3313
```

Available scenarios:

- `leader-kill`: Stop leader container, wait for failover, restart leader
- `follower-restart`: Restart a follower container, verify leader stability
- `network-partition`: Stop Redis backplane, simulate network partition
- `full-restart`: Stop all nodes, restart in sequence, verify cluster recovery
- `all`: Run all scenarios in sequence

Options:

- `--failover-timeout-ms`: Maximum wait time for failover (default: 15000)
- `--revalidation-retries`: Number of cluster health revalidation attempts (default: 5)
- `--revalidation-delay-ms`: Delay between revalidation attempts (default: 2000)

After each scenario, recalibrate cluster alerts:

```bash
# Healthy steady-state gate
npm run ops:authority:cluster:monitor -- --base-urls http://127.0.0.1:3311,http://127.0.0.1:3312,http://127.0.0.1:3313 --expected-node-count 3 --max-warnings 0 --forbidden-alerts authority_cluster_sync_stale,authority_cluster_leader_missing

# Fault-path calibration example for leader failover
npm run ops:authority:cluster:monitor -- --base-urls http://127.0.0.1:3311,http://127.0.0.1:3312,http://127.0.0.1:3313 --expected-node-count 3 --fail-on never --require-leader false --max-stale-nodes 3 --max-leader-missing-nodes 3 --expect-alerts authority_cluster_sync_stale,authority_cluster_leader_missing
```

Expected results:

- `leader-kill`: New leader elected within `failover-timeout-ms`, cluster stabilizes after restart
- `follower-restart`: Leader remains unchanged, follower rejoins cluster
- `network-partition`: Cluster recovers after Redis backplane restoration
- `full-restart`: Cluster elects new leader and reaches full node count
- healthy recalibration runs report no cluster leader/sync alerts
- fault-path recalibration runs observe the expected alerts and recovery actions

## Failure Handling

### Snapshot missing

1. create a manual snapshot
2. rerun `ops:authority:report`
3. if snapshot creation fails, inspect storage permissions on `AUTHORITY_STORAGE_DIR`

### Repeated replication errors

1. inspect `/api/authority/replication`
2. inspect free disk space and storage permissions
3. create a manual snapshot after the issue is fixed
4. run a recovery drill to confirm the path is healthy again

### Entropy escalation

1. inspect `/api/authority/governance`
2. inspect `/api/authority/monitoring`
3. drain or rebalance overloaded agents
4. rerun the monitoring report until breaker returns to level `0`

### MCP tool access denied

1. inspect `/api/authority/tools/<toolName>/metadata?agentId=<agentId>&department=<department>`
2. confirm the agent session is connected and has the required capabilities
3. confirm the tool allows the agent department and is not in `approvalMode = denied`
4. if `approvalMode = manual`, approve the request through governance before retrying execution

### MCP quota exhausted

1. inspect `/api/authority/tools/usage`
2. confirm the tool `quotaLimit`, `usageCount`, and `activeCalls`
3. wait for active calls to drain or raise the quota through an audited authority mutation
4. rerun the smoke-test call and confirm `quotaRemaining` recovers

### MCP transport degraded

1. inspect `/api/authority/tools/mcp/services`
2. rerun `POST /api/authority/tools/mcp/services/local-mcp-core/health-check`
3. trigger `POST /api/authority/tools/mcp/polling/trigger` for the affected service to verify active polling health
4. rerun `POST /api/authority/tools/mcp/discover` to refresh authoritative registrations
5. if a remote backend was registered, verify `POST /api/authority/tools/mcp/services/register` payload and remote `/health`
6. if the service must stay online for monitoring but off the routing path, apply `POST /api/authority/tools/mcp/services/<serviceId>/control` with `pause` or `isolate`
7. if transport remains degraded, keep serving the existing mock-registered tools and inspect Python/MCP Core dependencies

### MCP recovery lockout

1. inspect `/api/authority/tools/mcp/services` and confirm `recoveryLockoutUntil`
2. inspect the configured `failback.maxRecoveryAttempts` and `failback.recoveryLockoutMs`
3. wait for lockout expiry or adjust policy through `POST /api/authority/tools/mcp/services/<serviceId>/policy`
4. rerun `POST /api/authority/tools/mcp/polling/trigger` after lockout expiry

### Authority cluster sync stale

1. inspect `GET /api/authority/cluster/status` and confirm `syncStatus`, `lastSyncAt`, and `leaderNodeId`
2. trigger `POST /api/authority/cluster/sync` to force a leader snapshot publish or follower catch-up
3. inspect `GET /api/authority/monitoring` and `GET /api/authority/ops` for `authority_cluster_sync_stale`
4. if the alert persists, inspect backplane connectivity and leader node health before re-enabling traffic-sensitive workloads

### Authority cluster leader missing

1. inspect `GET /api/authority/cluster/status` and confirm `activeNodeCount`, `degradedNodeCount`, and `offlineNodeCount`
2. inspect `GET /api/authority/ops` for `inspect_authority_cluster_failover`
3. verify cluster lease or backplane connectivity and restart the failed node only after follower nodes are healthy
4. rerun `POST /api/authority/cluster/recommend-node` to confirm routing recommendations return a healthy leader or fallback node
5. rerun `npm run ops:authority:cluster:validate -- --base-urls <urls>` before reopening the staging traffic path
