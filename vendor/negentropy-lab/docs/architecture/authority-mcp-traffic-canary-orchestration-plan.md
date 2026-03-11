# Authority MCP Traffic Canary and Orchestration Plan

## Module Boundary Reference

Use [module-map.md](./module-map.md) as the current reference for `integration` ownership and the dependency direction between interfaces, authority, and transport orchestration.

## Goal

Extend the authoritative MCP transport with deterministic percentage routing, safer canary recovery, finer maintenance conflict arbitration, and lightweight orchestration metadata that prepares the transport plane for future multi-node scheduling.

## Scope

This slice adds:

- percentage-based traffic allocation across multiple MCP backends for the same tool
- recovery canary ramping that gradually restores traffic after a backend stabilizes
- maintenance window conflict arbitration with merge / defer / replace / reject policies
- lightweight orchestration metadata for service groups, templates, and node affinity hints
- control-plane policy updates that persist traffic and orchestration state in the authority layer
- monitoring visibility for canary routing, maintenance conflicts, and orchestration coverage

Out of scope for this slice:

- distributed leader election
- cross-node execution fanout
- shadow traffic replay
- external service mesh integration

## Constitutional Mapping

- `§101`: traffic policy, maintenance arbitration, and orchestration metadata remain stored in the authority transport state as the single source of truth
- `§102`: the slice extends `AuthorityMcpTransportService`; no parallel router, mesh controller, or scheduler is introduced
- `§103`: design lands before implementation
- `§130`: routing and orchestration metadata never bypass department or capability enforcement
- `§151`: routing choices, maintenance arbitration, and orchestration mutations remain auditable
- `§306`: percentage routing and canary recovery preserve zero-downtime backend switching
- `§320`: implementation proceeds through the Claude Code workflow

## Design

### 1. Traffic Allocation and Canary Recovery

Each service may define a `traffic` policy:

- `allocationPercent`: target share of traffic inside the candidate pool
- `canaryPercent`: initial share when a recovered service re-enters routing
- `rampStepPercent`: traffic increment applied after each ramp interval
- `rampIntervalMs`: duration required before the next ramp step
- `lane`: metadata label such as `primary`, `canary`, or `background`

Candidate ordering still starts from the existing health / SLO / priority checks. After eligibility is known, the transport computes a deterministic request bucket from the tool name and normalized arguments, then maps that bucket to weighted service shares.

Recovery behavior:

1. a service that is still `recovering` only receives `canaryPercent`
2. once the service becomes `healthy`, traffic ramps from `canaryPercent` toward `allocationPercent`
3. after the ramp interval and stability guardrails are satisfied, the service returns to full allocation
4. failover still retries the remaining eligible candidates in score order

### 2. Maintenance Conflict Arbitration

Each maintenance window may define:

- `priority`
- `conflictPolicy: merge | defer | replace | reject`

When a newly scheduled window overlaps an existing one for the same service:

- `merge`: combine intervals and keep the most severe action / highest priority semantics
- `defer`: shift the new window to the first safe slot after conflicting windows
- `replace`: remove lower-priority conflicting windows and install the new one
- `reject`: fail the mutation with a clear error

The service snapshot exposes conflict counts so operators can see when overlapping windows require review.

### 3. Orchestration Pre-Abstractions

Each service may define an `orchestration` policy:

- `serviceGroup`
- `templateId`
- `preferredNodes[]`
- `excludedNodes[]`
- `regions[]`
- `tags[]`

These fields are metadata-only in this slice. They do not introduce cross-node execution, but they become part of authoritative service state and control-plane responses so future distributed orchestration can build on a stable contract.

### 4. Control Plane

Extend existing MCP policy APIs:

- `POST /api/authority/tools/mcp/services/:serviceId/policy`
  - now accepts `traffic` and `orchestration`
- `POST /api/authority/tools/mcp/services/:serviceId/windows`
  - now accepts `priority` and `conflictPolicy`

`GET /api/authority/tools/mcp/services` expands with:

- configured and effective traffic percentage
- traffic lane
- maintenance conflict count
- orchestration group / template / node affinity metadata

### 5. Monitoring Integration

`AuthorityMonitoringService` extends MCP reporting with:

- `canaryMcpServices`
- `maintenanceConflictMcpServices`
- `orchestratedServiceGroups`

New alerts and recommended actions:

- `mcp_service_canary_ramp`
- `mcp_service_maintenance_conflict`
- `review_mcp_canary_ramp`
- `review_mcp_maintenance_conflicts`

## Acceptance Criteria

### Functional

- weighted routing honors configured traffic percentages across eligible backends
- recovered services re-enter traffic through a bounded canary percentage before ramping upward
- overlapping maintenance windows resolve according to the declared conflict policy
- orchestration metadata survives registration, policy mutation, and service listing
- monitoring surfaces canary and maintenance conflict state

### Verification

1. `npm run build:server`
2. targeted traffic, conflict, and orchestration tests
3. `npm run test:authority`
4. `npm run test:authority:coverage`
5. `npm run build`
6. `python scripts/measure_entropy.py --url <authority-state>`
