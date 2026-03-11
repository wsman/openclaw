# Phase 3B P1 Plugins Pre-Execution Checklist

## Module Boundary Reference

Use [module-map.md](./module-map.md) and [phase3b-convergence-candidates.md](./phase3b-convergence-candidates.md) as the current architectural baseline for this checklist.

## 1. Target Boundary

### What this slice should solve

- prepare the plugin surface for a future convergence slice without merging implementations
- make the preconditions for plugin-surface execution explicit
- reduce ambiguity around which plugin-facing imports new code should prefer

### What this slice should not solve

- merging `server/plugins/*` and `server/gateway/plugins/*`
- rewriting plugin loading, validation, or lifecycle behavior
- moving plugin files across trees
- turning one `PluginManager` implementation into the mandatory runtime for the whole repo

### Why this is `P1`

- plugins are the clearest example of dual implementation surfaces in the repo
- this area is high-value but easy to over-merge incorrectly
- a pre-execution checklist reduces the chance of forcing together systems that still have distinct runtime semantics

## 2. Current Implementation Inventory

### Main physical surfaces

- `server/plugins/index.ts`
- `server/plugins/core/PluginManager.ts`
- `server/plugins/types/plugin-interfaces.ts`
- `server/plugins/cli/PluginCLI.ts`
- `server/gateway/plugins/index.ts`
- `server/gateway/plugins/types.ts`
- `server/gateway/plugins/registry.ts`
- `server/gateway/plugins/loader.ts`
- `server/gateway/plugins/validator.ts`

### Current façade entrypoint

- `server/modules/integration/plugins.ts`

### Current test coverage and smoke signals

- plugin-core tests exist under `plugins/core/agent-integration/*.test.ts`
- plugin integration smoke exists at `scripts/run-plugin-integration-tests.js`
- gateway plugin examples and manifests exist under `server/gateway/plugins/examples/*`
- plugin checks are not currently part of the main authority gate and should be treated as representative rather than universal coverage

### Current runtime and wiring picture

- core plugin runtime exposes `createPluginManager(...)` and `createPluginCLI(...)` from `server/plugins/index.ts`
- gateway plugin runtime exposes a separate `PluginManager` and related errors from `server/gateway/plugins/index.ts`
- current plugin usage is not centralized under one runtime assembly point; a future execution slice needs an explicit import census before implementation convergence

## 3. Convergence Preconditions

Before any execution slice begins, confirm:

- stable façade exists: yes, `server/modules/integration/plugins.ts`
- unified plugin terminology exists: not yet
- normalized manifest or registry DTO exists across both trees: not yet
- import census exists for plugin-facing call sites: not yet, required
- representative smoke path exists: partially, but should be formalized before execution
- explicit non-goals are documented: yes, from the Phase 3B candidate list

Required preconditions to mark as done before implementation work:

1. create an import census covering direct imports from `server/plugins/*` and `server/gateway/plugins/*`
2. compare `PluginManifest` and related runtime concepts across both trees
3. define a terminology table for manager, manifest, registry, lifecycle, dependency, and capability concepts
4. decide which representative tests become the minimum plugin gate for the execution slice

## 4. Minimal Implementation Plan

Only the following implementation shapes are allowed in the first execution slice:

- façade tightening
- terminology alignment
- capability classification mapping
- normalized manifest/registry DTO definition
- adapter wrappers that translate each existing runtime into the normalized DTOs

The first execution slice should not attempt direct implementation merge.

Recommended smallest plan:

1. produce an import census
2. define a normalized plugin capability map
3. define a minimal shared manifest/registry view DTO
4. add adapters from core plugin runtime and gateway plugin runtime into the normalized view
5. keep both runtime implementations untouched behind the façade

## 5. Risks And Rollback Points

### Main risks

- breaking plugin examples or manifests that assume gateway-plugin-specific shapes
- breaking CLI flows that assume the core plugin runtime contract
- creating a false “single plugin system” abstraction before lifecycle semantics match
- widening scope into implementation merge too early

### Zero-behavior validation focus

- no runtime behavior changes in either plugin tree
- no change to existing plugin load order or lifecycle order
- no change to current CLI wiring
- no change to current gateway plugin manager behavior

### Rollback point

- rollback should stop at `server/modules/integration/plugins.ts`
- if the normalized DTO or adapter layer proves unstable, keep the façade but revert the new adapter/view work
- physical implementations remain the source of truth until a later approved convergence slice

## 6. Go / No-Go Gate

### Go only if

- the import census is complete
- the normalized plugin terminology table is reviewed
- the minimal DTO or capability map is agreed without forcing implementation merge
- representative plugin smoke coverage is selected and documented
- non-goals remain intact

### Minimum verification for a future execution slice

- `npm run build:server`
- selected representative plugin tests from `plugins/core/agent-integration/*.test.ts`
- representative plugin smoke from `scripts/run-plugin-integration-tests.js` or an equivalent maintained path
- any touched authority or gateway tests still pass

### No-Go conditions

- the slice starts merging runtime implementations
- the slice expands into full plugin lifecycle rewrite
- the slice cannot produce a reliable import census
