# Phase 3A Extension Entrypoints Plan

## Module Boundary Reference

Use [module-map.md](./module-map.md) as the current reference for repository-wide module ownership and dependency direction while applying this plan.

See also: [phase3b-convergence-candidates.md](./phase3b-convergence-candidates.md) for the post-Phase-3A implementation convergence candidate assessment.

## Goal

Define one stable integration import surface for extension-facing code without merging or rewriting the underlying implementations.

## Scope

This phase covers design and façade entrypoints only:

- define the logical integration sub-surfaces
- establish stable import paths for new code
- keep existing implementations, wiring, and runtime composition unchanged
- allow dual plugin implementations to coexist behind one stable module boundary

## Integration Sub-Surfaces

### 1. Tool Plane

Responsibilities:

- authoritative tool-call entrypoints
- tool registration, access control, usage snapshots, and active-call coordination

Primary current implementation:

- `server/services/authority/AuthorityToolCallBridge.ts`
- tool-plane types from `server/services/authority/types.ts`

Stable import path for new code:

- `server/modules/integration/tool-plane`

### 2. MCP

Responsibilities:

- MCP transport execution
- service registration, discovery, policy, health, and control semantics

Primary current implementation:

- `server/services/authority/AuthorityMcpTransportService.ts`
- MCP-related types from `server/services/authority/types.ts`

Stable import path for new code:

- `server/modules/integration/mcp`

### 3. Plugins

Responsibilities:

- plugin runtime surface for new code
- consistent module boundary over the current dual plugin implementations

Primary current implementation:

- `server/plugins/*`
- `server/gateway/plugins/*`

Stable import path for new code:

- `server/modules/integration/plugins`

Current rule:

- both plugin implementations remain valid physical sources
- new code should import through the plugin façade instead of choosing a physical plugin tree ad hoc

### 4. OpenClaw

Responsibilities:

- OpenClaw compatibility, decision bridge, orchestration bridge, and related adapters

Primary current implementation:

- `server/gateway/openclaw-decision/*`
- `server/gateway/openclaw-orchestration/*`
- `server/adapters/OpenClawLogAdapter.ts`

Stable import path for new code:

- `server/modules/integration/openclaw`

## Stable Integration Imports

For new code, prefer:

- `server/modules/integration/tool-plane`
- `server/modules/integration/mcp`
- `server/modules/integration/plugins`
- `server/modules/integration/openclaw`
- `server/modules/integration` when a broader integration surface is acceptable

Avoid for new code:

- direct imports from `server/services/authority/AuthorityToolCallBridge.ts`
- direct imports from `server/services/authority/AuthorityMcpTransportService.ts`
- direct ad hoc choice between `server/plugins/*` and `server/gateway/plugins/*`
- direct ad hoc imports from `server/gateway/openclaw-*/*` when the façade already exports the needed symbol

## Non-Goals

This phase does not:

- merge `server/plugins/*` and `server/gateway/plugins/*`
- rewrite `AuthorityMcpTransportService`
- unify ToolCallBridge implementations across subsystems
- rewrite OpenClaw decision or orchestration implementations
- move runtime, governance, or monitoring services across physical directories
- create future `finance`, `biometrics`, or `social` empty shells
- touch unrelated existing worktree changes in `engine/mcp_core/tools/__init__.py`, `engine/utils/mock_qdrant.py`, or `storage/config/authority-mcp-services.json`

## Acceptance

Phase 3A is complete when:

1. `module-map.md` defines the integration sub-surfaces clearly
2. `server/modules/integration/*` exposes stable sub-entrypoint façades
3. new code has an explicit import preference for integration-facing work
4. runtime behavior remains unchanged
5. `npm run build:server` passes
6. authority and representative integration tests pass
