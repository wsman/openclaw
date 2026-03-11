# Phase 3B P1 Submission Template

## Module Boundary Reference

Use these documents together when preparing commits or a PR for the approved P1 convergence slices:

- [module-map.md](./module-map.md)
- [phase3-extension-entrypoints-plan.md](./phase3-extension-entrypoints-plan.md)
- [phase3b-convergence-candidates.md](./phase3b-convergence-candidates.md)
- [phase3b-p1-plugins-pre-execution-checklist.md](./phase3b-p1-plugins-pre-execution-checklist.md)
- [phase3b-p1-tool-plane-pre-execution-checklist.md](./phase3b-p1-tool-plane-pre-execution-checklist.md)
- [phase3b-p1-mcp-pre-execution-checklist.md](./phase3b-p1-mcp-pre-execution-checklist.md)

This document turns the approved Phase 3B P1 outcome into a reviewable submission plan. It is intentionally commit-oriented and assumes the current implementation baseline is already accepted:

- `plugins` normalized integration surface
- `tool-plane` normalized integration surface
- `mcp` normalized integration surface

## Recommended Split: 5 Commits

This is the preferred split because it keeps review scope narrow and rollback clean.

### Commit 1

**Title**

`docs(architecture): establish module map and phase 3 planning baseline`

**Include**

- new architecture baseline docs:
  - `docs/architecture/module-map.md`
  - `docs/architecture/phase3-extension-entrypoints-plan.md`
  - `docs/architecture/phase3b-convergence-candidates.md`
  - `docs/architecture/phase3b-p1-plugins-pre-execution-checklist.md`
  - `docs/architecture/phase3b-p1-tool-plane-pre-execution-checklist.md`
  - `docs/architecture/phase3b-p1-mcp-pre-execution-checklist.md`
  - `docs/architecture/phase3b-p1-submission-template.md`
- cross-reference updates in existing architecture docs:
  - `docs/architecture/authoritative-agent-server-transformation-plan.md`
  - `docs/architecture/authority-core-design-phase16.md`
  - `docs/architecture/authority-live-scenarios-plan.md`
  - `docs/architecture/authority-mcp-distributed-orchestration-plan.md`
  - `docs/architecture/authority-mcp-health-lifecycle-plan.md`
  - `docs/architecture/authority-mcp-production-validation-plan.md`
  - `docs/architecture/authority-mcp-remote-failover-plan.md`
  - `docs/architecture/authority-mcp-service-orchestration-plan.md`
  - `docs/architecture/authority-mcp-tool-plane-plan.md`
  - `docs/architecture/authority-mcp-traffic-canary-orchestration-plan.md`
  - `docs/architecture/authority-mcp-transport-plan.md`
  - `docs/architecture/authority-production-readiness-plan.md`
  - `docs/architecture/authority-quality-gate.md`
  - `docs/architecture/entropy-governance-spec.md`
  - `docs/architecture/phase17-agent-session-tool-plane-design.md`
  - `docs/architecture/phase18-20-governance-collaboration-replication-design.md`

**Purpose**

- freeze the architecture baseline before any runtime-facing convergence work
- keep all Phase 1 / 2 / 3A / 3B planning assets reviewable as one logical package

### Commit 2

**Title**

`refactor(modules): add stable scenario and integration facades`

**Include**

- `server/modules/authority/index.ts`
- `server/modules/collaboration/index.ts`
- `server/modules/governance/index.ts`
- `server/modules/interfaces/index.ts`
- `server/modules/persona/index.ts`
- `server/modules/scenarios/index.ts`
- `server/modules/integration/index.ts`
- `server/modules/integration/openclaw.ts`

**Purpose**

- freeze the stable module entrypoint surface
- separate logical entrypoint creation from later normalization work

**Note**

- if you want perfectly historical commit purity, this commit is where the first versions of `server/modules/integration/plugins.ts`, `server/modules/integration/tool-plane.ts`, and `server/modules/integration/mcp.ts` would have lived
- if the current working tree already contains their normalized forms, do not force a brittle split unless you are willing to use `git add -p`
- the safer path is to keep those three files with their dedicated feature commits below

### Commit 3

**Title**

`feat(integration): normalize plugin integration surface`

**Include**

- `server/modules/integration/plugins.ts`
- `server/modules/integration/plugins.test.ts`

**Purpose**

- keep the two plugin implementations separate
- converge only the view layer: terminology, capability mapping, manifest normalization, census

### Commit 4

**Title**

`feat(integration): normalize tool plane integration surface`

**Include**

- `server/modules/integration/tool-plane.ts`
- `server/modules/integration/tool-plane.test.ts`

**Purpose**

- introduce a normalized tool catalog / access / usage surface
- keep `AuthorityToolCallBridge` as the concrete runtime implementation

### Commit 5

**Title**

`feat(integration): normalize mcp integration surface`

**Include**

- `server/modules/integration/mcp.ts`
- `server/modules/integration/mcp.test.ts`

**Purpose**

- introduce a normalized service-registry / discovery / polling / maintenance surface
- keep `AuthorityMcpTransportService` as the concrete runtime implementation

## Alternative Split: 3 Commits

Use this only if you want a smaller review stack and are willing to trade away some rollback precision.

### Commit 1

`docs(architecture): add phase 3 convergence baseline and execution checklists`

### Commit 2

`refactor(modules): add stable scenario and integration entrypoints`

### Commit 3

`feat(integration): add normalized plugin, tool-plane and mcp facades`

## Recommended Staging Commands

These are examples, not mandatory commands. Adjust if your working tree contains extra local edits.

### Commit 1 staging

```bash
git add docs/architecture/module-map.md
git add docs/architecture/phase3-extension-entrypoints-plan.md
git add docs/architecture/phase3b-convergence-candidates.md
git add docs/architecture/phase3b-p1-plugins-pre-execution-checklist.md
git add docs/architecture/phase3b-p1-tool-plane-pre-execution-checklist.md
git add docs/architecture/phase3b-p1-mcp-pre-execution-checklist.md
git add docs/architecture/phase3b-p1-submission-template.md
git add docs/architecture/authoritative-agent-server-transformation-plan.md
git add docs/architecture/authority-core-design-phase16.md
git add docs/architecture/authority-live-scenarios-plan.md
git add docs/architecture/authority-mcp-distributed-orchestration-plan.md
git add docs/architecture/authority-mcp-health-lifecycle-plan.md
git add docs/architecture/authority-mcp-production-validation-plan.md
git add docs/architecture/authority-mcp-remote-failover-plan.md
git add docs/architecture/authority-mcp-service-orchestration-plan.md
git add docs/architecture/authority-mcp-tool-plane-plan.md
git add docs/architecture/authority-mcp-traffic-canary-orchestration-plan.md
git add docs/architecture/authority-mcp-transport-plan.md
git add docs/architecture/authority-production-readiness-plan.md
git add docs/architecture/authority-quality-gate.md
git add docs/architecture/entropy-governance-spec.md
git add docs/architecture/phase17-agent-session-tool-plane-design.md
git add docs/architecture/phase18-20-governance-collaboration-replication-design.md
```

### Commit 2 staging

```bash
git add server/modules/authority/index.ts
git add server/modules/collaboration/index.ts
git add server/modules/governance/index.ts
git add server/modules/interfaces/index.ts
git add server/modules/persona/index.ts
git add server/modules/scenarios/index.ts
git add server/modules/integration/index.ts
git add server/modules/integration/openclaw.ts
```

### Commit 3 staging

```bash
git add server/modules/integration/plugins.ts
git add server/modules/integration/plugins.test.ts
```

### Commit 4 staging

```bash
git add server/modules/integration/tool-plane.ts
git add server/modules/integration/tool-plane.test.ts
```

### Commit 5 staging

```bash
git add server/modules/integration/mcp.ts
git add server/modules/integration/mcp.test.ts
```

## PR Description Template

### Title

`refactor: stabilize integration access surfaces for plugins, tool-plane, and mcp`

### Summary

- freezes the approved Phase 1 / 2 / 3A / 3B architecture baseline
- keeps runtime behavior unchanged
- adds normalized integration surfaces for `plugins`, `tool-plane`, and `mcp`
- keeps authority-owned implementations as the current runtime source of truth

### What Changed

- added and linked the architecture baseline docs
- established stable module entrypoints in `server/modules/*`
- normalized plugin manifest and capability views behind `server/modules/integration/plugins`
- normalized tool catalog, access, usage, and census views behind `server/modules/integration/tool-plane`
- normalized MCP registry, discovery, polling, maintenance, and census views behind `server/modules/integration/mcp`
- added representative tests for each normalized integration surface

### Explicit Non-Goals

- did not merge `server/plugins/*` with `server/gateway/plugins/*`
- did not rewrite `AuthorityToolCallBridge`
- did not rewrite `AuthorityMcpTransportService`
- did not change runtime wiring or HTTP route assembly
- did not move `AuthorityMonitoringService` or scenario service physical locations
- did not run a full-repo import rewrite
- did not address unrelated existing worktree changes:
  - `engine/mcp_core/tools/__init__.py`
  - `engine/utils/mock_qdrant.py`
  - `storage/config/authority-mcp-services.json`

### Validation

```bash
npx vitest run server/modules/integration/plugins.test.ts server/modules/integration/tool-plane.test.ts server/modules/integration/mcp.test.ts server/services/authority/AuthorityToolCallBridge.test.ts server/services/authority/AuthorityMcpTransportService.test.ts server/bootstrap/createNegentropyServer.authority.test.ts scripts/authority-ops-scripts.test.ts
npm run test:authority
npm run test:gateway:mainline
npx vitest run server/gateway/openclaw-decision/__tests__/controller.test.ts server/gateway/openclaw-orchestration/__tests__/orchestration-service.test.ts
npx jest plugins/core/agent-integration/index.test.ts plugins/core/agent-integration/AgentStateManager.test.ts
npm run build
```

### Rollback

- rollback commit-by-commit in reverse order if needed
- commits `3` to `5` are intentionally designed to be independently reversible
- if a regression is isolated to one surface, revert only that surface commit and keep the baseline docs plus stable entrypoints

## Known Review Notes

- `npm run test:gateway:mainline` is still worth running, but in this environment it may effectively exercise a narrower subset than its glob suggests
- because of that, keep the explicit OpenClaw representative tests in the validation block
- local Python `requests` dependency warnings and `ts-jest` `isolatedModules` deprecation warnings are non-blocking for this submission
