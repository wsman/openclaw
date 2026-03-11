# Phase 3B P1 MCP Pre-Execution Checklist

## Module Boundary Reference

Use [module-map.md](./module-map.md) and [phase3b-convergence-candidates.md](./phase3b-convergence-candidates.md) as the current architectural baseline for this checklist.

## 1. Target Boundary

### What this slice should solve

- prepare a normalized MCP service-registry and operations view for future convergence work
- reduce direct integration dependence on the concrete `AuthorityMcpTransportService` implementation
- make MCP execution preconditions explicit without touching transport behavior

### What this slice should not solve

- rewriting `AuthorityMcpTransportService`
- splitting transport behavior into new runtime services
- merging this slice with broader OpenClaw or plugin convergence work
- changing current authority transport control flow

### Why this is `P1`

- MCP already carries service registration, discovery, health, control, maintenance, and policy concepts that are useful beyond one class
- the current transport is mature enough to support view-model convergence without code-path churn
- MCP is tightly related to the tool plane and should be prepared as a normalized surface before any deeper integration work

## 2. Current Implementation Inventory

### Main physical surfaces

- `server/services/authority/AuthorityMcpTransportService.ts`
- `server/services/authority/types.ts`
- `server/runtime/authorityRuntime.ts`
- `server/bootstrap/createNegentropyServer.ts`
- supporting architecture docs under `docs/architecture/authority-mcp-*.md`

### Current façade entrypoint

- `server/modules/integration/mcp.ts`

### Current test coverage and smoke signals

- `server/services/authority/AuthorityMcpTransportService.test.ts`
- `server/bootstrap/createNegentropyServer.authority.test.ts`
- `scripts/authority-ops-scripts.test.ts`
- `vitest.authority.config.mjs` includes the transport service and bootstrap acceptance chain

### Current runtime and wiring picture

- authority runtime wires transport in `server/runtime/authorityRuntime.ts`
- the transport is created with the existing `AuthorityToolCallBridge`
- current HTTP surface in `server/bootstrap/createNegentropyServer.ts` includes:
  - `/api/authority/tools/mcp/services`
  - `/api/authority/tools/mcp/services/register`
  - `/api/authority/tools/mcp/discover`
  - `/api/authority/tools/mcp/polling/trigger`
  - `/api/authority/tools/mcp/services/:serviceId/health-check`
  - `/api/authority/tools/mcp/services/:serviceId/control`
  - `/api/authority/tools/mcp/services/:serviceId/windows`
  - `/api/authority/tools/mcp/services/:serviceId/policy`

## 3. Convergence Preconditions

Before any execution slice begins, confirm:

- stable façade exists: yes, `server/modules/integration/mcp.ts`
- MCP-related types already exist: yes, partially in `server/services/authority/types.ts`
- normalized service-registry view independent of the transport class exists: not yet
- import census exists for direct `AuthorityMcpTransportService` usage: not yet, required
- representative operational tests exist: yes
- explicit non-goals are documented: yes, from the Phase 3B candidate list

Required preconditions to mark as done before implementation work:

1. create an import census for direct `AuthorityMcpTransportService` imports
2. define a normalized MCP service view covering registration, discovery, health, control, maintenance, and policy
3. map existing transport DTOs and snapshots into the normalized view
4. identify which ops and bootstrap tests become the minimum gate for any MCP convergence slice

## 4. Minimal Implementation Plan

Only the following implementation shapes are allowed in the first execution slice:

- façade tightening
- DTO normalization
- service-registry view extraction
- adapter wrapping around the current transport implementation

Recommended smallest plan:

1. define a normalized MCP service-registry DTO set
2. expose that view through `server/modules/integration/mcp`
3. keep `AuthorityMcpTransportService` as the concrete runtime implementation
4. migrate only newly touched integration-facing code to the normalized view
5. leave transport execution semantics untouched

## 5. Risks And Rollback Points

### Main risks

- breaking MCP service registration or discovery behavior
- breaking health, control, or maintenance endpoints
- drifting away from the authority tool-plane coupling that the current runtime depends on
- creating view-model duplication without clear contract ownership

### Zero-behavior validation focus

- service registration remains unchanged
- discovery and health-check behavior remain unchanged
- service control, windows, and policy flows remain unchanged
- authority ops scripts continue to pass

### Rollback point

- rollback should stop at `server/modules/integration/mcp.ts`
- if the normalized registry view proves unstable, revert the new DTO or adapter layer while retaining the existing transport class and endpoints
- the transport implementation remains the source of truth throughout the first execution slice

## 6. Go / No-Go Gate

### Go only if

- the import census is complete
- the normalized MCP service view is agreed
- the planned work does not alter transport execution semantics
- authority bootstrap and ops tests remain part of the gate
- non-goals remain intact

### Minimum verification for a future execution slice

- `npm run build:server`
- `npx vitest run --config vitest.authority.config.mjs server/services/authority/AuthorityMcpTransportService.test.ts server/bootstrap/createNegentropyServer.authority.test.ts scripts/authority-ops-scripts.test.ts`

### No-Go conditions

- the slice begins rewriting transport internals
- the slice couples MCP convergence to unrelated OpenClaw or plugin implementation changes
- the slice cannot define a stable service-registry view first
