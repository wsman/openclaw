# Authority MCP Health Lifecycle Plan

## Module Boundary Reference

Use [module-map.md](./module-map.md) as the current reference for module ownership and dependency direction, especially for `authority`, `governance`, and `integration`.

## Goal

Extend the authoritative MCP transport with active health polling, automatic failback, and explicit service lifecycle controls without creating a parallel monitoring or routing subsystem.

## Scope

This slice adds:

- active health polling for registered MCP services
- service health state machine with auditable transitions
- automatic failback after recovery validation
- control plane actions for enable, disable, pause, isolate, and resume
- deeper monitoring and ops visibility for MCP lifecycle state

Out of scope for this slice:

- distributed health coordinators
- cross-node lease election for polling ownership
- weighted traffic shifting by percentage
- websocket and gRPC health probes

## Constitutional Mapping

- `§101`: service health, lifecycle mode, and recovery state remain derived from the authority state
- `§102`: the existing `AuthorityMcpTransportService` absorbs lifecycle logic; no parallel watcher service is introduced
- `§103`: design lands before implementation
- `§130`: lifecycle controls do not bypass department policy or capability checks
- `§151`: polling, state transitions, control actions, and failback events remain auditable
- `§306`: lifecycle actions must support zero-downtime switching between healthy backends
- `§320`: implementation proceeds through the Claude Code workflow

## Design

### 1. Service Lifecycle Model

Each MCP service keeps two orthogonal control dimensions:

- `enabled`: persisted hard switch; disabled services do not route traffic
- `operationalMode`: `active | paused | isolated`

Each service also keeps a health state:

- `healthy`
- `degraded`
- `unhealthy`
- `recovering`

`paused` and `isolated` services stay visible in monitoring, but only `active` services are eligible for routing.

### 2. Active Health Polling

`AuthorityMcpTransportService` owns a polling loop with:

- configurable `pollingIntervalMs`
- configurable `timeoutMs`
- configurable `recoverySuccessThreshold`

The loop periodically checks all enabled services and updates the authoritative snapshot in place.

### 3. Failback

Services blocked after repeated failures continue to receive health probes.

Recovery path:

1. service reaches `unhealthy`
2. subsequent successful probes move it to `recovering`
3. after `recoverySuccessThreshold` consecutive successes it returns to `healthy`
4. routing automatically considers it again

### 4. Control Plane

Add:

- `POST /api/authority/tools/mcp/services/:serviceId/control`
- `POST /api/authority/tools/mcp/polling/trigger`

Supported actions:

- `enable`
- `disable`
- `pause`
- `resume`
- `isolate`
- `activate`

### 5. Monitoring Integration

`AuthorityMonitoringService` extends MCP reporting with:

- degraded / unhealthy / recovering counts
- paused / isolated counts
- polling status and last poll time

New ops recommendations:

- `inspect_mcp_service_controls`
- `review_mcp_failback`
- `resume_paused_mcp_service`

## Acceptance Criteria

### Functional

- active polling updates MCP health without requiring manual API calls
- unhealthy services automatically move through `recovering` back to `healthy`
- paused and isolated services remain visible but do not route traffic
- control plane actions persist and affect routing immediately
- monitoring snapshots expose lifecycle counts and polling status

### Verification

1. `npm run build:server`
2. targeted MCP lifecycle tests
3. `npm run test:authority`
4. `npm run test:authority:coverage`
5. `npm run build`
6. `python scripts/measure_entropy.py --url <authority-state>`
