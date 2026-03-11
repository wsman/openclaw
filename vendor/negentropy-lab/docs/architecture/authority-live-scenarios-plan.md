# Authority Live Scenarios Plan

## Module Boundary Reference

Use [module-map.md](./module-map.md) as the current reference for authority, governance, collaboration, scenarios, persona, interfaces, and integration boundaries while reading this scenario plan.

## Goal

Validate the Authority Core in real operating scenarios by connecting the existing OpenClaw agent engine into the authoritative session registry, then exercising live morning-brief and budget-governance flows.

## Scope

This phase focuses on Option A: real scenario validation.

Included:

- bridge the built-in OpenClaw agent engine into authority sessions
- keep bridged agents synchronized into the authority runtime
- run live morning-brief workflow against synchronized agents
- run live budget-conflict governance scenario against synchronized agents
- provide a lightweight performance baseline script for the new live endpoints

Excluded:

- replacing the existing agent engine implementation
- introducing new distributed coordination protocols
- production multi-node consistency work

## Constitutional Mapping

- `§101`: authority remains the single source of truth; bridged agent state is projected into authority sessions rather than stored separately
- `§102`: reuse existing agent engine, session registry, pilot workflow service, conflict resolver, and collaboration bus
- `§103`: document live-scenario design before implementation
- `§108.1`: every bridged agent session carries explicit model/provider from the agent engine config
- `§130`: department boundaries are derived from mapped agent roles and enforced by the authority registry/tool plane
- `§151`: live workflow outputs and budget decisions remain persisted through the authority mutation path

## Design

Scenario application position:

- `AuthorityLiveScenarioService` is treated as a scenario/application-layer service, not part of the governance core.
- It composes existing authority, governance, collaboration, and persona capabilities into live operating flows.
- Physical file placement remains unchanged during Phase 2; the logical import surface moves to `server/modules/scenarios`.

### 1. Agent Engine Bridge

Add an `AuthorityLiveScenarioService` that accepts a live agent source abstraction backed by the existing `AgentEngine`.

Responsibilities:

- map agent engine records to authority departments and roles
- register or update authority sessions with explicit `model` and `provider`
- derive heartbeat health/load from the engine agent activity window
- disconnect stale bridged sessions that no longer exist in the engine source

### 2. Live Morning Brief

Expose a live morning-brief path that:

1. synchronizes engine agents into authority sessions
2. selects a coordinator and specialist set from the live agent source
3. runs the existing engine collaboration flow for a morning-brief scenario
4. persists workflow outputs into authority state
5. broadcasts the result through the collaboration bus

### 3. Live Budget Conflict Scenario

Expose a live budget-governance path that:

1. synchronizes engine agents into authority sessions
2. creates an authority proposal through `ConflictResolver`
3. executes live collaboration for context synthesis
4. casts structured votes from synchronized agents
5. resolves the proposal and persists the decision
6. broadcasts the decision through the collaboration bus

### 4. Performance Baseline

Provide a baseline script that exercises:

- live agent synchronization
- monitoring endpoint
- live morning brief
- live budget conflict scenario

The script reports p50/p95 latency and success rate for the live authority control plane.

## Acceptance Criteria

### Functional

- the running server can synchronize OpenClaw agents into authority sessions
- synchronized sessions always include explicit `model` and `provider`
- live morning brief returns both authority brief output and agent collaboration context
- live budget conflict returns proposal, votes, and final resolution
- a baseline script can run against a live server and report latency metrics

### Verification

1. `npm run build:server`
2. targeted Authority unit tests
3. Authority end-to-end acceptance including live scenario endpoints
4. Authority ops script tests including performance baseline
5. `npm run test:authority:coverage`
6. `npm run build`
