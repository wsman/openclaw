# Module Map

## Related Phase Docs

Use these documents together with this map:

- [authoritative-agent-server-transformation-plan.md](./authoritative-agent-server-transformation-plan.md)
- [authority-core-design-phase16.md](./authority-core-design-phase16.md)
- [entropy-governance-spec.md](./entropy-governance-spec.md)
- [phase17-agent-session-tool-plane-design.md](./phase17-agent-session-tool-plane-design.md)
- [phase18-20-governance-collaboration-replication-design.md](./phase18-20-governance-collaboration-replication-design.md)
- [authority-live-scenarios-plan.md](./authority-live-scenarios-plan.md)
- [authority-mcp-tool-plane-plan.md](./authority-mcp-tool-plane-plan.md)
- [authority-mcp-transport-plan.md](./authority-mcp-transport-plan.md)
- [authority-mcp-health-lifecycle-plan.md](./authority-mcp-health-lifecycle-plan.md)
- [authority-mcp-remote-failover-plan.md](./authority-mcp-remote-failover-plan.md)
- [authority-mcp-service-orchestration-plan.md](./authority-mcp-service-orchestration-plan.md)
- [authority-mcp-traffic-canary-orchestration-plan.md](./authority-mcp-traffic-canary-orchestration-plan.md)
- [authority-mcp-distributed-orchestration-plan.md](./authority-mcp-distributed-orchestration-plan.md)
- [authority-mcp-production-validation-plan.md](./authority-mcp-production-validation-plan.md)
- [authority-production-readiness-plan.md](./authority-production-readiness-plan.md)
- [authority-quality-gate.md](./authority-quality-gate.md)
- [phase3-extension-entrypoints-plan.md](./phase3-extension-entrypoints-plan.md)
- [phase3b-convergence-candidates.md](./phase3b-convergence-candidates.md)
- [phase3b-p1-submission-template.md](./phase3b-p1-submission-template.md)

This document is the Phase 1 reference for repository-internal modularization. It defines logical ownership and stable module entrypoints without moving files or changing runtime behavior.

## 1. Target Module Tree

```text
server/
  modules/
    authority/
    governance/
    collaboration/
    scenarios/
    persona/
    interfaces/
    integration/

  runtime/                     # current physical implementation, retained in Phase 1
  schema/
  services/
    authority/
    governance/
    choreography/
  agents/
  api/
  gateway/
  plugins/
  cluster/
  discovery/
  cache/
  monitoring/
  utils/

future/
  applications/
    scenarios/
      morning-brief/
      budget-conflict/
      entropy-drill/
  domains/
    finance/
    biometrics/
    social/
    tasks/
    knowledge/
  adapters/
    external/
      plaid/
      ynab/
      fhir/
      healthkit/
      gmail/
      chain/
```

Logical ownership after the Phase 2 scenario/application extraction:

- `authority`: runtime, state, mutation pipeline, event store, session registry, replication, coordination
- `governance`: entropy, breaker, conflict resolution, monitoring
- `collaboration`: collaboration bus, workflow runtime state, workflow-to-topic bridging
- `scenarios`: morning brief, entropy drill, and live budget-conflict style application orchestration
- `persona`: agent roles, capability mapping, agent engine bridge
- `interfaces`: HTTP, WebSocket, internal API, server bootstrap façades
- `integration`: tool plane, MCP, OpenClaw bridge, plugin runtime, external bridge adapters
- shared infrastructure: cluster, discovery, cache, monitoring, utils; these remain support layers, not top-level business modules

Phase 3A integration sub-surfaces:

- `tool-plane`: tool calls, tool catalog, access control, usage snapshots, active-call state
- `mcp`: MCP transport, service registration, discovery, health, control, and policy
- `plugins`: the stable façade over `server/plugins/*` and `server/gateway/plugins/*`
- `openclaw`: OpenClaw decision, orchestration, compatibility, and bridge-oriented adapters

## 2. Current File Mapping Table

| Logical module | Responsibilities | Current physical paths | Notes |
| --- | --- | --- | --- |
| `authority` | authority runtime, authoritative state, event-sourced mutation path, session registry, replication, coordination | `server/runtime/authorityRuntime.ts`, `server/runtime/authorityStateSnapshot.ts`, `server/schema/AuthorityState.ts`, `server/services/authority/EventStore.ts`, `server/services/authority/MutationPipeline.ts`, `server/services/authority/ProjectionService.ts`, `server/services/authority/AuthorityAgentSessionRegistry.ts`, `server/services/authority/AuthorityReplicationService.ts`, `server/services/authority/AuthorityClusterCoordinationService.ts`, `server/services/authority/types.ts` | Most stable kernel; should remain lowest business layer |
| `governance` | entropy evaluation, breaker decisions, conflict resolution, monitoring snapshots | `server/services/governance/EntropyEngine.ts`, `server/services/governance/BreakerService.ts`, `server/services/governance/ConflictResolver.ts`, `server/services/authority/AuthorityMonitoringService.ts` | `AuthorityMonitoringService` stays physically in `services/authority` during Phase 1 but is governed logically here |
| `collaboration` | topic bus, workflow state projection, workflow-to-collaboration bridging | `server/services/choreography/CollaborationBus.ts`, `server/schema/AuthorityState.ts` (`workflows`, `collaboration`) | Collaboration owns the bus and workflow projection, but not scenario application ownership |
| `scenarios` | pilot workflow applications, live scenario orchestration, scenario-facing outputs | `server/services/governance/AuthorityPilotWorkflowService.ts`, `server/services/governance/AuthorityLiveScenarioService.ts`, `server/schema/AuthorityState.ts` (`workflows`) | Files stay physically under `services/governance` in Phase 2, but are now owned logically as scenario/application services and should be imported through a scenario façade |
| `persona` | agent role definitions, trust/capability mapping, agent registry state, engine bridge | `server/agents/*`, `server/gateway/agent-engine.ts`, `server/schema/AgentState.ts`, `server/types/system/AgentTypes.ts`, `server/utils/OfficialAgentTerminology.ts` | Department/persona semantics live here; they do not own domain state |
| `interfaces` | server bootstrap, HTTP routers, WebSocket routers, internal API façades | `server/bootstrap/createNegentropyServer.ts`, `server/api/agent.ts`, `server/api/cluster.ts`, `server/api/cluster-ws.ts`, `server/api/discovery.ts`, `server/api/openclaw.ts`, `server/gateway/server.impl-with-ws.ts`, `server/gateway/websocket/*`, `server/gateway/openclaw-decision/api/internal-api.ts`, `server/gateway/openclaw-orchestration/api/internal-api.ts` | Interface files remain thin entrypoints; no business moves in Phase 1 |
| `integration` | tool call bridge, MCP transport, OpenClaw bridges, plugin systems, external adapters | `server/services/authority/AuthorityToolCallBridge.ts`, `server/services/authority/AuthorityMcpTransportService.ts`, `server/gateway/openclaw-decision/*`, `server/gateway/openclaw-orchestration/*`, `server/plugins/*`, `server/gateway/plugins/*`, `server/adapters/OpenClawLogAdapter.ts` | In Phase 3A the implementation stays split physically, but the stable import surface is `server/modules/integration/*` with `tool-plane`, `mcp`, `plugins`, and `openclaw` sub-entrypoints |
| shared infrastructure | cluster runtime, discovery, cache, general monitoring, utility helpers | `server/cluster/*`, `server/discovery/*`, `server/cache/*`, `server/monitoring/*`, `server/utils/*` | Support layer available to lower and upper modules as needed |
| future `domains` | finance, biometrics, social, tasks, knowledge | not created in Phase 1 | Reserve contracts and state hooks before large implementations |
| future `external adapters` | vendor APIs mapped into normalized domain DTOs | not created in Phase 1 | No external source may write `AuthorityState` directly |

## 3. Module Boundaries And Dependency Direction

Dependency direction for new code:

```text
interfaces
  -> authority
  -> governance
  -> collaboration
  -> scenarios
  -> persona
  -> integration

scenarios
  -> authority
  -> governance
  -> collaboration
  -> persona

collaboration
  -> authority
  -> persona

governance
  -> authority

persona
  -> authority contracts/state
  -> shared infrastructure

integration
  -> authority
  -> persona
  -> collaboration (only when bridging orchestrated workflows)

authority
  -> shared infrastructure

shared infrastructure
  -> no business-layer ownership
```

Boundary rules:

- `authority` is the single business-layer source of truth and owns authoritative mutation, replay, and persistence boundaries.
- `governance` evaluates and decides; it does not own transport concerns or Express/WebSocket entrypoints.
- `collaboration` owns collaboration routing and workflow/topic bridging; it must not become the owner of concrete scenario applications.
- `scenarios` compose governance, collaboration, persona, and authority services into concrete application flows such as `morning-brief`, `entropy-drill`, and `budget-conflict`.
- `persona` represents roles and capability semantics; it must not become the owner of finance, biometrics, social, or other future domain data.
- `interfaces` accept input and return output; they should call façades/services instead of implementing policy or writing state directly.
- `integration` normalizes external systems into stable internal contracts; adapters must not bypass the authority mutation path.
- `integration` exposes four stable entrypoint families for new code: `tool-plane`, `mcp`, `plugins`, and `openclaw`.

Phase 1 adoption rule:

- Existing imports may remain unchanged.
- New code should prefer `server/modules/*` entrypoints instead of reaching directly into scattered service paths.
- New scenario code should prefer `server/modules/scenarios` rather than `server/services/governance/*`.
- New integration-facing code should prefer `server/modules/integration/tool-plane`, `server/modules/integration/mcp`, `server/modules/integration/plugins`, or `server/modules/integration/openclaw`.

## 4. Disallowed Cross-Layer Access Examples

| Disallowed access in new code | Why it is disallowed | Preferred path |
| --- | --- | --- |
| `server/api/*` importing `server/schema/AuthorityState.ts` to mutate state directly | interface layer must not own state mutation or bypass audit | call `server/modules/authority` and go through runtime or mutation services |
| `server/api/*` importing `server/services/governance/EntropyEngine.ts` directly | interface layer should depend on stable façade, not scattered internals | import from `server/modules/governance` |
| `server/agents/*` importing `server/services/authority/EventStore.ts` directly | persona logic must not append audit events on its own | use collaboration or authority façade APIs that route through `MutationPipeline` |
| `server/services/governance/*` importing Express or WebSocket router files from `server/api/*` or `server/gateway/*` | governance must stay transport-agnostic | accept typed inputs and return structured outputs through service contracts |
| `server/adapters/*` or future Plaid/FHIR/Gmail adapters mutating `AuthorityState` directly | vendor contracts must not leak into the runtime core | normalize into DTOs, then call integration/domain services, then mutate via authority pipeline |
| new scenario code importing `server/services/governance/AuthorityLiveScenarioService.ts` directly | scenario/application flows should converge on one scenario module boundary | import from `server/modules/scenarios` |
| new extension-facing code importing `server/services/authority/AuthorityMcpTransportService.ts` directly | new integration work should converge on stable extension entrypoints instead of concrete service files | import from `server/modules/integration/mcp` |
| new extension-facing code importing `server/services/authority/AuthorityToolCallBridge.ts` directly | tool-plane access should converge on one stable integration boundary | import from `server/modules/integration/tool-plane` |
| new code choosing between `server/gateway/openclaw-decision/*` and `server/gateway/openclaw-orchestration/*` ad hoc | OpenClaw entrypoints should converge on one compatibility surface before future consolidation | import from `server/modules/integration/openclaw` |
| new code choosing between `server/plugins/*` and `server/gateway/plugins/*` ad hoc | plugin surface remains duplicated physically in Phase 3A | import from `server/modules/integration/plugins` and defer physical consolidation to Phase 3B |

## 5. Phase 1/2/3 Incremental Refactor Roadmap

### Phase 1 - Logical Module Map And Stable Entry Points

Scope:

- add this `module-map.md` document
- add six module entrypoints under `server/modules/*`
- keep existing file locations unchanged
- keep runtime behavior and test behavior unchanged
- require new code to prefer module entrypoints when practical

Completion criteria:

1. `docs/architecture/module-map.md` exists and is the architecture reference for modular boundaries
2. the six module entrypoints exist and expose stable names
3. runtime entrypoints and existing tests behave the same
4. new code can depend on `server/modules/*` instead of scattered implementation paths

### Phase 2 - Extract Scenario Applications

Scope:

- move the logical ownership of `AuthorityPilotWorkflowService` and `AuthorityLiveScenarioService` from governance to scenario/application space
- define scenario application boundaries for `morning-brief`, `budget-conflict`, and `entropy-drill`
- expose a stable scenario import surface at `server/modules/scenarios`
- keep governance focused on rules, evaluation, conflict, and monitoring

Expected result:

- `governance` becomes policy and decision logic
- `collaboration` remains the workflow/topic bridge
- `scenarios` and future `applications/scenarios/*` become the concrete orchestration surfaces

### Phase 3A - Extension Entry Point Design

Scope:

- define stable extension-facing entrypoints under `server/modules/integration/*`
- document the `tool-plane`, `mcp`, `plugins`, and `openclaw` sub-surfaces
- keep all existing implementations and runtime wiring unchanged
- avoid broad import rewrites; only new or newly touched code should prefer the new fa莽ades

Expected result:

- future extension work has one stable import surface without forcing immediate implementation consolidation

### Future Phase 3B - Extension Surface Consolidation

Scope:

- consolidate plugin surface ownership while preserving compatibility
- revisit MCP, tool-plane, and OpenClaw implementation seams only after the entrypoint surface is stable
- add lightweight future contracts such as `IBudgetAllocator`, `IFinancialSignalProvider`, `IBiometricSignalProvider`, `ISocialGraphProvider`, and `ITaskPrioritizer`

Expected result:

- future finance, biometrics, social, and external adapter work can plug in without changing authority or governance core boundaries
