# Phase 3B Convergence Candidates

## Related Execution Docs

Use these documents together for approved P1 execution and submission:

- [module-map.md](./module-map.md)
- [phase3-extension-entrypoints-plan.md](./phase3-extension-entrypoints-plan.md)
- [phase3b-p1-plugins-pre-execution-checklist.md](./phase3b-p1-plugins-pre-execution-checklist.md)
- [phase3b-p1-tool-plane-pre-execution-checklist.md](./phase3b-p1-tool-plane-pre-execution-checklist.md)
- [phase3b-p1-mcp-pre-execution-checklist.md](./phase3b-p1-mcp-pre-execution-checklist.md)
- [phase3b-p1-submission-template.md](./phase3b-p1-submission-template.md)

## Module Boundary Reference

Use [module-map.md](./module-map.md) as the current reference for repository-wide module ownership and dependency direction while reading this candidate list.

## Status

This document is a candidate assessment only. It is not an approved implementation plan.

## Execution Prep Docs

- [phase3b-p1-plugins-pre-execution-checklist.md](./phase3b-p1-plugins-pre-execution-checklist.md)
- [phase3b-p1-tool-plane-pre-execution-checklist.md](./phase3b-p1-tool-plane-pre-execution-checklist.md)
- [phase3b-p1-mcp-pre-execution-checklist.md](./phase3b-p1-mcp-pre-execution-checklist.md)

## Goal

Evaluate which extension-surface implementations are worth converging after Phase 3A, which should remain split, and which should stay frozen.

## Evaluation Questions

This candidate list answers five questions for each convergence point:

1. which duplication is real and worth reducing
2. which similarly named surfaces should not be forced into one implementation
3. what the expected benefit, risk, and dependency chain looks like
4. whether façade, contract, DTO, adapter, or physical migration is the right first move
5. which candidates should move first and which should remain frozen

## Candidate Overview

| Candidate | Current locations | Converge? | Suggested method | Risk | Priority |
| --- | --- | --- | --- | --- | --- |
| Plugin surface | `server/plugins/*` + `server/gateway/plugins/*` | Yes, but entrypoint/contract first | façade + capability map + terminology alignment | Medium | P1 |
| Tool plane | `server/services/authority/AuthorityToolCallBridge.ts` plus future non-authority callers | Yes, but contract/DTO first | adapter + contract + catalog view | Medium | P1 |
| MCP surface | `server/services/authority/AuthorityMcpTransportService.ts` centered | Yes, but view-model first | façade + DTO + service-registry view | Low | P1 |
| OpenClaw surface | `server/gateway/openclaw-decision/*` + `server/gateway/openclaw-orchestration/*` + adapter bridge | Yes, but keep decision/orchestration separate | sub-facade + compatibility map | Medium | P2 |
| Monitoring ownership | `server/services/authority/AuthorityMonitoringService.ts` with logical governance ownership | No, keep frozen for now | documentation-only alignment | Low | P3 |
| Scenario physical placement | `server/services/governance/AuthorityPilotWorkflowService.ts` + `server/services/governance/AuthorityLiveScenarioService.ts` | No, keep frozen for now | preserve logical extraction only | Low | P3 |

## Candidate Analyses

### 1. Plugins Candidate

**Current state**

- `server/plugins/*` exposes one plugin runtime surface with `PluginManager`, CLI, and plugin interfaces.
- `server/gateway/plugins/*` exposes another plugin runtime with its own `PluginManager`, registry, loader, validator, and examples.

**Observed duplication or coupling**

- both trees define a plugin manager concept
- both trees expose plugin manifest concepts
- new integration-facing code could reasonably choose either tree without a clear policy unless the façade is used

**Why this should not be over-converged**

- the two plugin trees may serve different runtime concerns and compatibility assumptions
- forcing a shared implementation too early would couple runtime behavior before capability semantics are aligned

**Smallest safe convergence move**

- keep `server/modules/integration/plugins` as the single import surface
- add a capability mapping and terminology table before discussing implementation merge
- converge shared vocabulary first: plugin definition, lifecycle stage, registry view, dependency shape

**Acceptance for a future execution slice**

- one normalized plugin capability map exists
- new code imports plugin-facing functionality through `server/modules/integration/plugins`
- a reader can tell when to use the core plugin runtime versus the gateway plugin runtime without reading both implementations

**Explicit non-goals**

- do not merge the two `PluginManager` implementations yet
- do not move plugin files between trees
- do not rewrite plugin loading semantics

### 2. Tool Plane Candidate

**Current state**

- `server/services/authority/AuthorityToolCallBridge.ts` is the active implementation for authoritative tool registration and invocation
- tool metadata and result views already live in `server/services/authority/types.ts`

**Observed duplication or coupling**

- the current tool plane is authoritative and useful, but it is also the likely seed of a broader system-wide tool surface
- future domains and adapters will want a stable tool catalog, usage view, and access decision model without binding directly to the authority implementation class

**Why this should not be over-converged**

- the current authority implementation should not be prematurely declared the only future runtime
- future domain or adapter-specific tool providers may need translation layers rather than direct reuse

**Smallest safe convergence move**

- define tool-plane contracts and DTO views first
- normalize tool catalog, active-call, last-result, and access-decision shapes
- keep authority runtime as the primary implementation behind the façade

**Acceptance for a future execution slice**

- one tool-plane contract package or typed export surface exists
- new code can depend on a normalized tool-plane catalog view without importing the authority implementation directly
- adapter-facing code can translate into the tool-plane DTOs before entering the authority path

**Explicit non-goals**

- do not rewrite `AuthorityToolCallBridge`
- do not introduce a second parallel tool runtime
- do not turn authority-specific behavior into fake platform abstractions too early

### 3. MCP Surface Candidate

**Current state**

- `server/services/authority/AuthorityMcpTransportService.ts` owns transport execution, discovery, health, control, and related orchestration state
- Phase 3A already established `server/modules/integration/mcp` as the stable façade

**Observed duplication or coupling**

- MCP already covers several concerns that future domain adapters may also want to consume: service registration, health, maintenance, traffic policy, and discovery
- these views are useful beyond the current transport implementation

**Why this should not be over-converged**

- transport execution details are still authority-centered and should stay stable before deeper extraction
- a large rewrite would risk breaking the current operational plane for little immediate architectural gain

**Smallest safe convergence move**

- define one service-registry view and one normalized MCP service DTO set
- keep the transport core untouched
- allow future adapters or scenarios to read the normalized registry view through the façade

**Acceptance for a future execution slice**

- one documented MCP service view exists for registration, discovery, health, policy, and control
- new code can consume MCP state through normalized DTOs rather than concrete transport internals
- no behavior changes are required in current authority transport flows

**Explicit non-goals**

- do not rewrite `AuthorityMcpTransportService`
- do not split transport behavior into new runtime services yet
- do not broaden MCP scope into unrelated external adapter work in the same slice

### 4. OpenClaw Candidate

**Current state**

- OpenClaw decision lives under `server/gateway/openclaw-decision/*`
- OpenClaw orchestration lives under `server/gateway/openclaw-orchestration/*`
- bridge-adjacent adapter functionality also exists in `server/adapters/OpenClawLogAdapter.ts`

**Observed duplication or coupling**

- the OpenClaw surface is conceptually one integration family but physically split across decision, orchestration, and adapter areas
- new code could easily import across these areas ad hoc without a consistent policy

**Why this should not be over-converged**

- decision and orchestration are semantically different planes
- merging them into one implementation would erase useful boundaries and raise regression risk

**Smallest safe convergence move**

- keep separate sub-facade exports under `server/modules/integration/openclaw`
- add a compatibility map documenting which responsibilities belong to decision, orchestration, or adapters
- only converge shared terminology and entrypoint guidance

**Acceptance for a future execution slice**

- one OpenClaw compatibility matrix exists
- new code reaches OpenClaw through the integration façade first
- decision and orchestration remain independently testable and independently evolvable

**Explicit non-goals**

- do not merge decision and orchestration implementations
- do not collapse internal APIs into one runtime
- do not rewrite bridge semantics in the same slice

### 5. Monitoring Ownership Candidate

**Current state**

- `AuthorityMonitoringService` is physically under `server/services/authority`
- its logical ownership has already been documented closer to governance concerns

**Observed duplication or coupling**

- the mismatch is mostly directory semantics, not proven implementation duplication

**Why this should remain frozen**

- moving it now would create directory churn without reducing material risk or complexity
- the logical ownership is already clear enough for current architecture work

**Smallest safe convergence move**

- no code move
- keep documenting it as governance-aligned while physically stable

**Acceptance for a future execution slice**

- only consider movement if a larger governance implementation consolidation is already justified

**Explicit non-goals**

- no physical relocation in the near term
- no monitoring framework rewrite

### 6. Scenario Physical Placement Candidate

**Current state**

- `AuthorityPilotWorkflowService` and `AuthorityLiveScenarioService` still live physically under `server/services/governance`
- their logical ownership has already been raised into the scenario/application layer

**Observed duplication or coupling**

- the remaining tension is physical placement, not current behavioral ambiguity

**Why this should remain frozen**

- Phase 2 already solved the architecture problem by lifting ownership and import policy
- a physical move now adds churn without improving boundaries enough to justify the risk

**Smallest safe convergence move**

- keep importing through `server/modules/scenarios`
- leave the physical files in place until a larger application-layer reorganization is genuinely needed

**Acceptance for a future execution slice**

- only revisit if multiple scenario/application services accumulate and a dedicated physical tree becomes operationally useful

**Explicit non-goals**

- no file migration in the near term
- no runtime rewiring around scenario placement

## Recommended Sequencing

### P1 - Best first candidates

- Plugins: normalize vocabulary and capability mapping
- Tool plane: define contracts and DTO views
- MCP surface: define normalized service-registry view

### P2 - Prepare but do not merge

- OpenClaw: add a responsibility and compatibility matrix before any implementation discussion

### P3 - Keep frozen

- Monitoring physical ownership
- Scenario service physical placement

## Cross-Candidate Non-Goals

Do not combine with the following in the same slice:

- merging `server/plugins/*` and `server/gateway/plugins/*`
- rewriting `AuthorityMcpTransportService`
- elevating `AuthorityToolCallBridge` into a forced platform-wide singleton implementation
- moving `AuthorityMonitoringService`
- moving scenario services into new physical directories
- creating `finance`, `biometrics`, or `social` empty shells
- touching unrelated existing worktree changes in `engine/mcp_core/tools/__init__.py`, `engine/utils/mock_qdrant.py`, or `storage/config/authority-mcp-services.json`
