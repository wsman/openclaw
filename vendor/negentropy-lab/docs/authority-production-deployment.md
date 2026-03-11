# Authority Production Deployment Guide

## Purpose

Deploy the Authority Core in production with snapshotting, recovery visibility, and operational monitoring enabled by default.

## Runtime Configuration

Recommended environment variables:

```bash
AUTHORITY_STORAGE_DIR=/var/lib/negentropy/authority
AUTHORITY_SNAPSHOT_INTERVAL_MS=30000
AUTHORITY_SNAPSHOT_EVENT_THRESHOLD=25
AUTHORITY_LOG_ROTATE_BYTES=524288
AUTHORITY_LOG_RETENTION=5
CLUSTER_ID=negentropy-lan
CLUSTER_TOKEN=replace-me
CLUSTER_ENABLED=true
DISCOVERY_ENABLED=false
CLUSTER_ROLE=authority
CLUSTER_REGION=cn-east-1
CLUSTER_CAPABILITIES=gateway,authority,mcp
REDIS_URL=redis://127.0.0.1:6379/0
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
```

## Required Endpoints

The production deployment should expose:

- `GET /health`
- `GET /api/authority/state`
- `GET /api/authority/tools`
- `GET /api/authority/tools/discovery`
- `GET /api/authority/tools/usage`
- `GET /api/authority/tools/mcp/services`
- `GET /api/authority/tools/:toolName/metadata`
- `POST /api/authority/tools/register`
- `POST /api/authority/tools/mcp/services/register`
- `POST /api/authority/tools/mcp/discover`
- `POST /api/authority/tools/mcp/polling/trigger`
- `POST /api/authority/tools/mcp/register`
- `POST /api/authority/tools/mcp/services/:serviceId/health-check`
- `POST /api/authority/tools/mcp/services/:serviceId/control`
- `POST /api/authority/tools/mcp/services/:serviceId/windows`
- `DELETE /api/authority/tools/mcp/services/:serviceId/windows/:windowId`
- `POST /api/authority/tools/mcp/services/:serviceId/policy`
- `POST /api/authority/tools/call`
- `GET /api/authority/monitoring`
- `GET /api/authority/ops`
- `GET /api/authority/cluster/status`
- `POST /api/authority/agents/sync-live`
- `POST /api/authority/cluster/sync`
- `POST /api/authority/cluster/recommend-node`
- `POST /api/authority/workflows/morning-brief/live`
- `POST /api/authority/governance/scenarios/budget-conflict`
- `GET /api/authority/replication`
- `POST /api/authority/replication/snapshot`
- `POST /api/authority/replication/recover`

## Preflight

Run before rollout:

```bash
npm run build:server
npm run test:authority
npm run test:authority:coverage
npm run build
```

For a three-node staging rehearsal:

```bash
npm run ops:authority:staging:up
npm run ops:authority:cluster:validate -- --base-urls http://127.0.0.1:3311,http://127.0.0.1:3312,http://127.0.0.1:3313 --expected-node-count 3 --preferred-region cn-east-1
```

## Startup Sequence

1. Create the authority storage directory with persistent disk backing.
2. Start the server with production environment variables.
3. Verify `GET /health` reports `features.monitoring = true`.
4. Verify `GET /api/authority/monitoring` returns a non-error payload.
5. Discover the real local MCP Core service and verify transport health:

```bash
curl http://127.0.0.1:3000/api/authority/tools/mcp/services
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/services/register \
  -H "content-type: application/json" \
  -d '{"serviceId":"remote-http-control-plane","provider":"remote-fixture","transport":"http","endpoint":"http://127.0.0.1:4100","source":"remote-fixture","modules":["remote"],"priority":50}'
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/discover \
  -H "content-type: application/json" \
  -d '{"serviceId":"local-mcp-core"}'
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/services/local-mcp-core/health-check
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/polling/trigger \
  -H "content-type: application/json" \
  -d '{"serviceId":"local-mcp-core"}'
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/services/remote-http-control-plane/control \
  -H "content-type: application/json" \
  -d '{"action":"pause","reason":"maintenance_window"}'
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/services/remote-http-control-plane/policy \
  -H "content-type: application/json" \
  -d '{"slo":{"targetLatencyMs":400,"minSuccessRate":0.95,"maxFailureRate":0.1,"routeBias":2},"traffic":{"allocationPercent":35,"canaryPercent":10,"rampStepPercent":15,"rampIntervalMs":1000,"lane":"canary"},"failback":{"maxRecoveryAttempts":2,"recoveryLockoutMs":60000},"orchestration":{"serviceGroup":"daily-brief","templateId":"template:daily-brief","preferredNodes":["node-alpha"],"regions":["cn-east-1"]}}'
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/services/remote-http-control-plane/windows \
  -H "content-type: application/json" \
  -d '{"windowId":"window:deploy","startAt":"2026-03-10T02:00:00Z","endAt":"2026-03-10T02:30:00Z","action":"pause","autoRecover":true,"reason":"deploy_window","priority":1,"conflictPolicy":"merge"}'
curl "http://127.0.0.1:3000/api/authority/tools/get_codex_structure/metadata?agentId=agent:technology_ministry&department=TECHNOLOGY"
curl -X POST http://127.0.0.1:3000/api/authority/tools/call \
  -H "content-type: application/json" \
  -d '{"toolName":"get_codex_structure","agentId":"agent:technology_ministry","args":{"law_type":"all"}}'
```

6. Verify cluster coordination is attached and leader routing is visible:

```bash
curl http://127.0.0.1:3000/api/authority/cluster/status
curl -X POST http://127.0.0.1:3000/api/authority/cluster/recommend-node \
  -H "content-type: application/json" \
  -d '{"serviceGroup":"daily-brief","preferredRegion":"cn-east-1","requireLeader":true}'
curl -X POST http://127.0.0.1:3000/api/authority/cluster/sync
```

7. Trigger a manual snapshot after initial warm-up:

```bash
curl -X POST http://127.0.0.1:3000/api/authority/replication/snapshot
```

8. In staging, validate multi-node leader convergence and follower sync:

```bash
npm run ops:authority:cluster:validate -- --base-urls http://127.0.0.1:3311,http://127.0.0.1:3312,http://127.0.0.1:3313 --expected-node-count 3 --preferred-region cn-east-1
npm run ops:authority:cluster:monitor -- --base-urls http://127.0.0.1:3311,http://127.0.0.1:3312,http://127.0.0.1:3313 --expected-node-count 3 --max-warnings 0
```

## Post-Deploy Checks

Use the monitoring script:

```bash
npm run ops:authority:report -- --url http://127.0.0.1:3000/api/authority/monitoring
```

Run a recovery drill in staging or a controlled production window:

```bash
npm run ops:authority:recovery:drill -- --base-url http://127.0.0.1:3000
```

For multi-node staging, recalibrate cluster alerts after each rehearsal or failover drill:

```bash
npm run ops:authority:cluster:monitor -- --base-urls http://127.0.0.1:3311,http://127.0.0.1:3312,http://127.0.0.1:3313 --expected-node-count 3 --max-warnings 0 --forbidden-alerts authority_cluster_sync_stale,authority_cluster_leader_missing
```

Record the full staging outcome in `docs/templates/authority-staging-acceptance-template.md` before promoting the slice beyond staging.

Run a live baseline:

```bash
npm run ops:authority:baseline -- --base-url http://127.0.0.1:3000 --iterations 3
```

Validate the MCP tool plane after rollout:

```bash
curl http://127.0.0.1:3000/api/authority/tools
curl http://127.0.0.1:3000/api/authority/tools/mcp/services
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/services/register \
  -H "content-type: application/json" \
  -d '{"serviceId":"remote-http-control-plane","provider":"remote-fixture","transport":"http","endpoint":"http://127.0.0.1:4100","source":"remote-fixture","modules":["remote"],"priority":50}'
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/discover \
  -H "content-type: application/json" \
  -d '{"serviceId":"remote-http-control-plane"}'
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/polling/trigger \
  -H "content-type: application/json" \
  -d '{"serviceId":"remote-http-control-plane"}'
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/services/remote-http-control-plane/control \
  -H "content-type: application/json" \
  -d '{"action":"resume","reason":"post_deploy_validation"}'
curl -X POST http://127.0.0.1:3000/api/authority/tools/mcp/services/remote-http-control-plane/policy \
  -H "content-type: application/json" \
  -d '{"slo":{"targetLatencyMs":400,"minSuccessRate":0.95,"maxFailureRate":0.1,"routeBias":2},"traffic":{"allocationPercent":70,"canaryPercent":15,"rampStepPercent":10,"rampIntervalMs":60000,"lane":"primary"},"orchestration":{"serviceGroup":"ops","templateId":"template:ops-primary","preferredNodes":["node-a","node-b"]}}'
curl "http://127.0.0.1:3000/api/authority/tools/discovery?department=TECHNOLOGY&protocol=mcp"
curl http://127.0.0.1:3000/api/authority/tools/usage
```

## Operational Expectations

- active event log remains bounded by `AUTHORITY_LOG_ROTATE_BYTES`
- snapshot creation occurs automatically by time or event threshold
- rotated logs remain inside the configured retention window
- recovery metadata remains queryable through `/api/authority/replication` and `/api/authority/ops`
- MCP tool metadata remains discoverable only through the authority tool plane
- real MCP Core transport health remains queryable through `/api/authority/tools/mcp/services`
- MCP service polling state remains queryable through `/api/authority/tools/mcp/services` and `/api/authority/monitoring`
- paused or isolated services can be controlled without restarting the authority server
- maintenance windows can be scheduled and removed without restarting the authority server
- service route scoring, effective traffic percentage, orchestration metadata, and failback lockout remain visible through `/api/authority/tools/mcp/services`
- canary ramp state and maintenance conflict counts remain visible through `/api/authority/monitoring`
- authority cluster leadership, sync status, and node inventory remain visible through `/api/authority/cluster/status`
- node recommendation and manual cluster sync remain available without restarting the authority server
- stale cluster sync or leader gaps surface through `/api/authority/monitoring` and `/api/authority/ops`
- tool usage and quota state remain queryable through `/api/authority/tools` and `/api/authority/tools/usage`
- staging rehearsal can be launched through `docker-compose.authority-staging.yml` and validated through `npm run ops:authority:cluster:validate`
