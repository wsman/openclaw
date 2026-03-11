# Phase 3B P1 Tool Plane Pre-Execution Checklist

## Module Boundary Reference

Use [module-map.md](./module-map.md) and [phase3b-convergence-candidates.md](./phase3b-convergence-candidates.md) as the current architectural baseline for this checklist.

## 1. Target Boundary

### What this slice should solve

- prepare a normalized tool-plane contract surface for future extension work
- reduce direct dependence on `AuthorityToolCallBridge` as a concrete class for new integration-facing code
- make tool-plane execution preconditions explicit before any convergence work begins

### What this slice should not solve

- rewriting `AuthorityToolCallBridge`
- introducing a second parallel tool runtime
- turning the current authority implementation into a forced platform-wide singleton abstraction
- merging tool-plane changes with domain-pack or external-adapter work

### Why this is `P1`

- the tool plane is already a real authority-owned capability surface
- future finance, biometrics, social, and adapter work will likely depend on a stable tool catalog and access model
- this is an ideal place to converge contracts first while preserving runtime behavior

## 2. Current Implementation Inventory

### Main physical surfaces

- `server/services/authority/AuthorityToolCallBridge.ts`
- `server/services/authority/types.ts`
- `server/runtime/authorityRuntime.ts`
- `server/bootstrap/createNegentropyServer.ts`

### Current façade entrypoint

- `server/modules/integration/tool-plane.ts`

### Current test coverage and smoke signals

- `server/services/authority/AuthorityToolCallBridge.test.ts`
- `server/bootstrap/createNegentropyServer.authority.test.ts`
- `vitest.authority.config.mjs` includes both the bridge test and authority bootstrap acceptance coverage

### Current runtime and wiring picture

- authority runtime wires the bridge in `server/runtime/authorityRuntime.ts`
- HTTP tool endpoints are exposed from `server/bootstrap/createNegentropyServer.ts`
- current authority-facing routes include:
  - `/api/authority/tools/register`
  - `/api/authority/tools/call`
  - `/api/authority/tools/mcp/register`

## 3. Convergence Preconditions

Before any execution slice begins, confirm:

- stable façade exists: yes, `server/modules/integration/tool-plane.ts`
- existing tool metadata DTOs exist: partially, in `server/services/authority/types.ts`
- normalized tool-plane contract independent of the authority class exists: not yet
- import census exists for tool-plane call sites: not yet, required
- representative authority acceptance coverage exists: yes
- explicit non-goals are documented: yes, from the Phase 3B candidate list

Required preconditions to mark as done before implementation work:

1. create an import census for direct `AuthorityToolCallBridge` imports
2. identify which exported types in `server/services/authority/types.ts` already behave like tool-plane DTOs
3. define a minimum normalized tool catalog / access decision / usage snapshot view
4. decide whether the first execution slice needs adapter wrappers or type-only convergence

## 4. Minimal Implementation Plan

Only the following implementation shapes are allowed in the first execution slice:

- façade tightening
- contract extraction
- DTO normalization
- adapter wrapping around the existing authority implementation

Recommended smallest plan:

1. define a normalized tool-plane contract surface
2. map current authority types into that contract
3. expose the normalized contract through `server/modules/integration/tool-plane`
4. keep `AuthorityToolCallBridge` as the concrete runtime implementation behind the façade
5. migrate only newly touched call sites if needed

## 5. Risks And Rollback Points

### Main risks

- breaking the authority audit chain for tool registration or invocation
- breaking endpoint compatibility for `/api/authority/tools/*`
- introducing ambiguous overlap between tool catalog DTOs and authority-specific state types
- leaking future platform ambitions into the current authority runtime too early

### Zero-behavior validation focus

- tool registration behavior remains unchanged
- tool call authorization behavior remains unchanged
- audit events and last-result projections remain unchanged
- authority bootstrap acceptance continues to pass

### Rollback point

- rollback should stop at `server/modules/integration/tool-plane.ts`
- if normalized contracts or adapters cause confusion, revert them while preserving the existing authority runtime path
- the existing bridge class remains the source of truth throughout the first execution slice

## 6. Go / No-Go Gate

### Go only if

- the import census is complete
- the minimum normalized tool-plane DTO set is agreed
- adapter or contract work can be done without changing bridge behavior
- authority acceptance coverage remains part of the validation plan
- non-goals remain intact

### Minimum verification for a future execution slice

- `npm run build:server`
- `npx vitest run --config vitest.authority.config.mjs server/services/authority/AuthorityToolCallBridge.test.ts server/bootstrap/createNegentropyServer.authority.test.ts`

### No-Go conditions

- the slice introduces a second tool runtime
- the slice rewrites bridge behavior instead of wrapping or typing it
- the slice attempts platform-wide abstraction without a stable DTO set
