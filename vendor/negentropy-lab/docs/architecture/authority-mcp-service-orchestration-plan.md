# Authority MCP Service Orchestration Plan

## Module Boundary Reference

Use [module-map.md](./module-map.md) as the current reference for `integration`, `authority`, and `governance` boundaries while evolving service orchestration.

## Goal

Extend the authoritative MCP transport with scheduled maintenance orchestration, weighted routing driven by SLO signals, and stricter failback guardrails while preserving the existing single authority transport plane.

## Scope

This slice adds:

- service maintenance windows with scheduled pause / isolate / disable actions
- automatic maintenance recovery without stopping the authority server
- weighted candidate scoring based on latency, success rate, failure rate, and configured route bias
- service-level SLO policy storage and evaluation
- finer failback guardrails including recovery attempt ceilings and lockout windows
- control-plane endpoints for maintenance windows and policy updates
- monitoring visibility for maintenance state, SLO violations, and recovery lockout

Out of scope for this slice:

- distributed multi-node scheduler election
- percentage-based traffic shaping across nodes
- external calendar integrations
- websocket / gRPC transport orchestration

## Constitutional Mapping

- `§101`: maintenance windows, SLO policy, and failback guardrails remain stored and derived through the authority transport state
- `§102`: orchestration extends `AuthorityMcpTransportService`; no parallel scheduler or router is introduced
- `§103`: design lands before implementation
- `§130`: service orchestration never bypasses department / capability enforcement on tool calls
- `§151`: maintenance execution, policy mutation, routing decisions, and failback lockouts remain auditable
- `§306`: maintenance actions and failback keep the authority server online and route to healthy backends
- `§320`: implementation proceeds through the Claude Code workflow

## Design

### 1. Maintenance Windows

Each service may define `maintenanceWindows[]` entries:

- `windowId`
- `startAt`
- `endAt`
- `recurrence: none | daily | weekly | monthly`
- `action: pause | isolate | disable`
- `autoRecover`
- `reason`

`AuthorityMcpTransportService` owns a lightweight maintenance scheduler that evaluates windows on a one-second cadence. Entering a window applies the requested service control action. Leaving a window restores the pre-window state when `autoRecover = true`.

### 2. Weighted Routing and SLO Policy

Each service may define:

- `slo.targetLatencyMs`
- `slo.minSuccessRate`
- `slo.maxFailureRate`
- `slo.routeBias`

The transport computes derived metrics from the authoritative runtime snapshot:

- success rate
- failure rate
- weighted route score
- `sloStatus: healthy | at-risk | violated`

Candidate selection continues to enforce health and operational mode gates first, then orders eligible services by weighted route score.

### 3. Fine-Grained Failback Guardrails

Each service may define:

- `failback.maxRecoveryAttempts`
- `failback.recoveryLockoutMs`
- `failback.minHealthyDurationMs`

Guardrail behavior:

1. a service that repeatedly fails recovery increments `recoveryAttemptCount`
2. exceeding the limit moves the service into recovery lockout
3. during lockout, health probes still run but routing remains blocked
4. successful healthy time clears recovery counters after the minimum stability window

### 4. Control Plane

Add:

- `POST /api/authority/tools/mcp/services/:serviceId/windows`
- `DELETE /api/authority/tools/mcp/services/:serviceId/windows/:windowId`
- `POST /api/authority/tools/mcp/services/:serviceId/policy`

Existing `GET /api/authority/tools/mcp/services` expands with maintenance, SLO, and failback fields.

### 5. Monitoring Integration

`AuthorityMonitoringService` extends MCP reporting with:

- `servicesInMaintenance`
- `sloViolatedMcpServices`
- `recoveryLockedMcpServices`
- `lastMaintenanceRunAt`

New alerts / recommendations:

- `mcp_service_in_maintenance`
- `mcp_service_slo_violation`
- `mcp_service_recovery_locked`
- `review_mcp_slo_policy`
- `review_mcp_maintenance_windows`

## Acceptance Criteria

### Functional

- maintenance windows automatically execute and recover service mode on schedule
- weighted routing prefers better SLO-performing healthy services
- repeated recovery failures trigger lockout and keep the service off the route path
- monitoring exposes maintenance, SLO, and failback guardrail state
- control-plane endpoints persist maintenance windows and service policy

### Verification

1. `npm run build:server`
2. targeted transport orchestration tests
3. `npm run test:authority`
4. `npm run test:authority:coverage`
5. `npm run build`
6. `python scripts/measure_entropy.py --url <authority-state>`
