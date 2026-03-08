---
name: negentropy-maintainer
description: "Maintain the Negentropy integration stack in OpenClaw. Use when syncing `vendor/negentropy-lab` from the external source repo, updating the `extensions/negentropy-lab` runtime bridge, comparing against latest `origin/main`, or splitting stack-wiring vs extension vs vendor commits without polluting the repo with generated files or local metadata."
---

# Negentropy Maintainer

Use this skill when the task is specifically about the **Negentropy maintenance stack** inside OpenClaw:

- `skills/negentropy-maintainer`
- `extensions/negentropy-lab`
- `vendor/negentropy-lab`

This skill is for five jobs:

- **sync** the vendor snapshot from the external Negentropy-Lab source repo
- **build** and validate the vendored backend without keeping generated artifacts
- **commit** the result in maintainer-quality chunks
- **upgrade** the vendored snapshot while keeping OpenClaw-side wiring intact
- **maintain** the long-term relationship between the external source repo, the vendor snapshot, the OpenClaw bridge, and the maintainer workflow

Open `references/module-map.md` for the Negentropy integration map.
Open `references/change-playbooks.md` for the step-by-step sync / build / commit / upgrade checklists.
Open `references/long-term-maintenance.md` when the task is about ongoing ownership boundaries, cadence, sourceRoot policy, or the long-term maintenance relationship.
Open `references/openclaw-architecture.md` when you need the current code-verified OpenClaw ↔ Negentropy architecture boundary.

## Operating model

Treat the three paths as different layers with different responsibilities:

- `skills/negentropy-maintainer` = **maintenance procedure layer**
  - documents how to sync, compare, validate, split commits, and upgrade
  - never participates in runtime behavior
  - should be updated when the maintenance workflow or ownership boundaries change
- `extensions/negentropy-lab` = **OpenClaw runtime integration layer**
  - contains the Negentropy-specific OpenClaw plugin
  - owns request-policy bridging logic, workflow bridge/config, control-plane commands, lifecycle-event mapping, and plugin-local tests
  - should absorb Negentropy-specific behavior that does not belong in generic OpenClaw core
- `vendor/negentropy-lab` = **external source snapshot layer**
  - mirrors the external Negentropy-Lab repository into this repo
  - is the source of truth for the vendored backend codebase itself
  - is updated by sync, then validated locally, but should not absorb OpenClaw-specific runtime glue

In short:

- **skill tells maintainers what to do**
- **extension makes OpenClaw talk to Negentropy**
- **vendor carries the external Negentropy code**

## Source of truth

- Official upstream baseline: `origin/main` from `https://github.com/openclaw/openclaw.git`
- External source repo: path configured in `custom/stack.local.json`
- Example current local Negentropy checkout on this workstation: `<path-to-negentropy-lab>`
- Vendor destination: `vendor/negentropy-lab`
- Runtime bridge: `extensions/negentropy-lab`
- Sync orchestrator: `scripts/custom-stack.mjs`
- Local stack docs/template: `custom/README.md`, `custom/stack.example.json`
- Long-term maintenance model: `references/long-term-maintenance.md`
- Current architecture audit: `references/openclaw-architecture.md`
- Generic OpenClaw host surfaces that the extension depends on:
  - `src/plugins/types.ts`
  - `src/plugins/hooks.ts`
  - `src/plugin-sdk/core.ts`
  - `src/gateway/plugin-request-policy.ts`
  - `src/gateway/openai-http.ts`
  - `src/gateway/openresponses-http.ts`
  - `src/gateway/tools-invoke-http.ts`
  - `src/gateway/server-methods.ts`
  - `src/agents/subagent-spawn.ts`
  - `src/agents/subagent-registry-completion.ts`
  - `src/gateway/server-methods/sessions.ts`
  - `src/auto-reply/reply/session.ts`

## Guardrails

- Treat the external Negentropy-Lab repo as the source of truth; do not hand-edit the vendored tree unless the task is explicitly about OpenClaw-local vendor fixes.
- Treat `extensions/negentropy-lab` as the default home for Negentropy-specific OpenClaw runtime behavior.
- Treat generic hook plumbing under `src/plugins/**` and `src/gateway/plugin-request-policy.ts` as OpenClaw core, not as vendor code.
- Do not reintroduce Negentropy-specific runtime code into ad-hoc core files when it can live in `extensions/negentropy-lab`.
- Default to the **minimal core intrusion** shape:
  - keep Negentropy-specific runtime behavior in `extensions/negentropy-lab/**`
  - keep OpenClaw core changes limited to generic hook contracts, a shared policy helper, and thin Gateway entrypoint calls
  - keep stack wiring changes limited to `.gitignore`, `custom/**`, `package.json`, and `scripts/custom-stack.mjs`
- Do not widen `.gitignore` or vendor exceptions for unrelated trees as part of Negentropy maintenance. If a non-Negentropy vendor path needs different ignore handling, treat it as a separate maintenance task.
- If you touch shared Gateway fixture or test files for reasons unrelated to Negentropy behavior, split them into a separate **shared gateway test maintenance** commit instead of bundling them into the bridge/runtime commit.
- Before sync or upgrade work, fetch the latest official `origin/main` and review non-Negentropy upstream changes first.
- Use `node scripts/custom-stack.mjs status` before sync or upgrade work.
- Use `node scripts/custom-stack.mjs sync-negentropy --dry-run` before a real sync so you can review the entry set.
- Never commit these vendored local artifacts:
  - `vendor/negentropy-lab/node_modules`
  - `vendor/negentropy-lab/dist`
  - `vendor/negentropy-lab/pnpm-lock.yaml` generated by local install
  - `vendor/negentropy-lab/.openclaw-vendor.json`
- Keep **stack wiring** changes separate from the **vendor snapshot** commit.
- Keep **extension/runtime bridge** changes separate from the **vendor snapshot** commit.
- If the vendor upgrade changes behavior exposed through OpenClaw, update the extension and any required generic host surfaces in separate commits after the snapshot commit.

## Minimal core intrusion target

When maintaining the Negentropy stack, prefer this end-state:

- **stack wiring layer**
  - `.gitignore`
  - `custom/**`
  - `package.json`
  - `scripts/custom-stack.mjs`
- **generic host-hook layer**
  - `src/plugins/types.ts`
  - `src/plugins/hooks.ts`
  - `src/plugin-sdk/core.ts`
  - `src/gateway/plugin-request-policy.ts`
  - thin request-policy call sites in:
    - `src/gateway/openai-http.ts`
    - `src/gateway/openresponses-http.ts`
    - `src/gateway/tools-invoke-http.ts`
    - `src/gateway/server-methods.ts`
- **extension layer**
  - `extensions/negentropy-lab/**`
- **vendor layer**
  - `vendor/negentropy-lab/**`
- **skill layer**
  - `skills/negentropy-maintainer/**`

Additional rules:

- Prefer consolidating repeated HTTP policy wiring into `src/gateway/plugin-request-policy.ts` before touching more entrypoints.
- Treat these shared Gateway test/fixture files as **not Negentropy-specific by default**:
  - `src/gateway/control-ui.http.test.ts`
  - `src/gateway/server-methods/agent.test.ts`
  - `src/gateway/server-methods/agents-mutate.test.ts`
  - `src/gateway/server-node-events.test.ts`
  - `src/gateway/test-helpers.mocks.ts`
- If those files must change during a Negentropy maintenance task, isolate them in their own commit and describe why they changed.

## Default workflow

### 1. Refresh the official OpenClaw baseline

Start every maintenance session by fetching the latest official upstream and comparing everything except the vendored Negentropy tree and this skill:

```bash
git fetch origin
git status -sb
git rev-list --left-right --count HEAD...origin/main
git log --oneline --decorate --reverse HEAD..origin/main
git diff --name-status --find-renames HEAD...origin/main -- . ':(exclude)vendor/negentropy-lab' ':(exclude)skills/negentropy-maintainer'
git diff --name-status --find-renames origin/main...HEAD -- . ':(exclude)vendor/negentropy-lab' ':(exclude)skills/negentropy-maintainer'
git diff --name-status -- . ':(exclude)vendor/negentropy-lab' ':(exclude)skills/negentropy-maintainer'
```

Use this review to answer:

- what landed upstream since the local branch diverged
- what local OpenClaw-side changes exist outside `vendor/negentropy-lab`
- whether upstream touched `src/gateway/**`, `src/config/**`, `.gitignore`, `package.json`, `custom/**`, or `scripts/custom-stack.mjs`
- whether local uncommitted changes will make a rebase unsafe

Do not blindly rebase while the worktree is dirty. Review first, then decide whether to integrate upstream before or after the vendor maintenance change.

### 2. Inspect Negentropy status and paths

Start here:

```bash
node scripts/custom-stack.mjs status
```

Confirm:

- Negentropy `sourceRoot` exists
- `vendorRoot` points at `vendor/negentropy-lab`
- the source repo HEAD is readable

If paths are wrong, fix `custom/stack.local.json` using `custom/stack.example.json` as the template.

### 3. Preview the sync set

Run:

```bash
node scripts/custom-stack.mjs sync-negentropy --dry-run
```

This script only vendors a curated root set. It includes selected directories and files from the source repo and excludes local/build data such as `node_modules`, `dist`, `coverage`, `logs`, `reports`, and `.git`.

If the dry-run entry list is wrong, fix `scripts/custom-stack.mjs` before syncing.

### 4. Sync the snapshot

Run:

```bash
node scripts/custom-stack.mjs sync-negentropy
```

This rewrites `vendor/negentropy-lab` from the configured source repo and records source metadata in `.openclaw-vendor.json` for local traceability.

### 5. Build and validate the vendored backend

From the vendor tree:

```bash
cd vendor/negentropy-lab
pnpm install --ignore-workspace
pnpm build
```

Then return to the repo root and remove generated local artifacts:

```bash
git clean -fdx -- vendor/negentropy-lab
```

Re-check that the working tree only shows intended source changes.

### 6. Review OpenClaw-side integration seams

After any sync or upgrade, inspect whether the vendor change affects:

- `extensions/negentropy-lab/**`
- plugin-local tests under `extensions/negentropy-lab/src/*.test.ts`
- generic plugin hook surfaces in `src/plugins/**`
- lifecycle hook emitters in `src/agents/subagent-spawn.ts`, `src/agents/subagent-registry-completion.ts`, `src/gateway/server-methods/sessions.ts`, or `src/auto-reply/reply/session.ts`
- `src/gateway/plugin-request-policy.ts`
- OpenAI-compatible HTTP handling
- `.gitignore`
- `package.json` custom scripts
- `custom/README.md` or `custom/stack.example.json`

If the vendor interface changed, update the extension first. Only update OpenClaw core when the change truly belongs to the generic plugin/request-hook framework.

### 7. Compare against official upstream again before committing

Before finalizing, repeat the exclusion-based compare so the review stays focused on the Negentropy work and its OpenClaw integration seams:

```bash
git log --oneline --decorate --reverse HEAD..origin/main
git diff --name-status --find-renames HEAD...origin/main -- . ':(exclude)vendor/negentropy-lab' ':(exclude)skills/negentropy-maintainer'
git diff --name-status --find-renames origin/main...HEAD -- . ':(exclude)vendor/negentropy-lab' ':(exclude)skills/negentropy-maintainer'
```

If upstream and local work overlap in `src/gateway/**`, `src/config/**`, `.gitignore`, `package.json`, or `scripts/custom-stack.mjs`, resolve that overlap before the final commit stack is locked in.

### 8. Commit in maintainer-quality chunks

Preferred order:

1. stack wiring / ignore / script changes
2. generic OpenClaw host-hook updates
3. `extensions/negentropy-lab` updates
4. vendor snapshot
5. skill/docs follow-up

Use:

```bash
scripts/committer "<message>" <paths...>
```

Recommended commit split:

- wiring commit:
  - `.gitignore`
  - `package.json`
  - `custom/**`
  - `scripts/custom-stack.mjs`
- core host-hook commit:
  - `src/plugins/**`
  - `src/plugin-sdk/core.ts`
  - `src/gateway/plugin-request-policy.ts`
  - related generic gateway files/tests
- extension commit:
  - `extensions/negentropy-lab/**`
- vendor snapshot commit:
  - `vendor/negentropy-lab`

### 9. Upgrade carefully

For upgrades from a newer external Negentropy-Lab source:

1. check the external source HEAD with `node scripts/custom-stack.mjs status`
2. fetch and compare against official `origin/main`, excluding `vendor/negentropy-lab` and `skills/negentropy-maintainer`
3. dry-run the sync set
4. perform the sync
5. build inside `vendor/negentropy-lab`
6. clean generated artifacts
7. diff the vendor snapshot and identify API/behavior drift
8. update `extensions/negentropy-lab` and any required generic host-hook files if required
9. keep the vendor snapshot commit isolated

If you also need to rebase onto newer `origin/main`, upgrade the vendor first, stabilize the OpenClaw integration second, and clean up commit history last.

## Validation checklist

- `git fetch origin`
- `git log --oneline --decorate --reverse HEAD..origin/main`
- `git diff --name-status --find-renames HEAD...origin/main -- . ':(exclude)vendor/negentropy-lab' ':(exclude)skills/negentropy-maintainer'`
- `git diff --name-status --find-renames origin/main...HEAD -- . ':(exclude)vendor/negentropy-lab' ':(exclude)skills/negentropy-maintainer'`
- `node scripts/custom-stack.mjs status`
- `node scripts/custom-stack.mjs sync-negentropy --dry-run`
- `pnpm build` inside `vendor/negentropy-lab`
- `git status -sb` confirms no vendored local artifacts remain
- if extension or host-hook code changed: targeted gateway/plugin tests and `pnpm build` at repo root
- if workflow bridge/config/command/event wiring changed: targeted `extensions/negentropy-lab` workflow tests and, when doing end-to-end verification, `pnpm negentropy:v11:live-smoke`

## When to widen the review

Widen beyond the vendor tree when:

- official upstream changed adjacent OpenClaw integration files outside `vendor/negentropy-lab`
- new Negentropy config fields need plugin config exposure in `extensions/negentropy-lab`
- bridge HTTP behavior changes in `extensions/negentropy-lab/**`, `src/gateway/openai-http.ts`, `src/gateway/openresponses-http.ts`, or `src/gateway/tools-invoke-http.ts`
- decision service contracts change
- generic `gateway_request` hook semantics change
- workflow orchestration contracts, command surface, or `/internal/openclaw/workflows` APIs change
- subagent/session lifecycle hook emitters or `runtime.subagent.run` integration change
- stack wiring or ignore rules change
- the user wants the local commit stack cleaned up for push or rebase
