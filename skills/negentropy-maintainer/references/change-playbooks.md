# Negentropy Maintenance Playbooks

Use the playbook that matches the maintenance task.

## Official upstream refresh playbook

Run this before sync or upgrade work.

1. `git fetch origin`
2. `git status -sb`
3. `git rev-list --left-right --count HEAD...origin/main`
4. `git log --oneline --decorate --reverse HEAD..origin/main`
5. `git diff --name-status --find-renames HEAD...origin/main -- . ':(exclude)vendor/negentropy-lab' ':(exclude)skills/negentropy-maintainer'`
6. `git diff --name-status --find-renames origin/main...HEAD -- . ':(exclude)vendor/negentropy-lab' ':(exclude)skills/negentropy-maintainer'`
7. `git diff --name-status -- . ':(exclude)vendor/negentropy-lab' ':(exclude)skills/negentropy-maintainer'`

Review three buckets:

- upstream-only OpenClaw changes
- local committed OpenClaw changes outside the vendor tree
- local uncommitted OpenClaw changes outside the vendor tree

Escalate immediately if upstream touched:

- `src/gateway/**`
- `src/config/**`
- `.gitignore`
- `package.json`
- `custom/**`
- `scripts/custom-stack.mjs`

Do not rebase blindly while the worktree is dirty.

## Sync playbook

1. Run `node scripts/custom-stack.mjs status`
2. Confirm `sourceRoot` and `vendorRoot`
3. Run `node scripts/custom-stack.mjs sync-negentropy --dry-run`
4. Review the selected entry list
5. Run `node scripts/custom-stack.mjs sync-negentropy`
6. Inspect `git status -sb`

Use this when the external source repo changed and you want a fresh vendor snapshot.

## Build playbook

1. `cd vendor/negentropy-lab`
2. `pnpm install --ignore-workspace`
3. `pnpm build`
4. return to repo root
5. `git clean -fdx -- vendor/negentropy-lab`
6. verify `git status -sb`

Use this after every sync or upgrade. The goal is to validate the vendor tree, not to keep build output.

## Minimal core intrusion playbook

Use this before finalizing any OpenClaw-side Negentropy change.

1. Diff against `origin/main`, still excluding `vendor/negentropy-lab` and `skills/negentropy-maintainer`
2. Classify each changed file into one of:
   - stack wiring
   - generic host-hook
   - shared gateway test maintenance
   - Negentropy extension
   - vendor snapshot
   - skill docs
3. Move Negentropy-specific runtime logic into `extensions/negentropy-lab/**` whenever possible
4. Keep OpenClaw core limited to:
   - `src/plugins/types.ts`
   - `src/plugins/hooks.ts`
   - `src/plugin-sdk/core.ts`
   - `src/gateway/plugin-request-policy.ts`
   - thin Gateway entrypoint calls in:
      - `src/gateway/openai-http.ts`
      - `src/gateway/openresponses-http.ts`
      - `src/gateway/tools-invoke-http.ts`
      - `src/gateway/server-methods.ts`
5. Treat workflow-specific bridge/config/command/event logic as extension-layer work unless the generic hook contract or lifecycle emitter itself changed
6. If workflow lifecycle behavior changed, inspect the generic emitters in:
   - `src/agents/subagent-spawn.ts`
   - `src/agents/subagent-registry-completion.ts`
   - `src/gateway/server-methods/sessions.ts`
   - `src/auto-reply/reply/session.ts`
7. If multiple HTTP entrypoints need the same logic, consolidate it in `src/gateway/plugin-request-policy.ts` before adding more one-off code
8. If shared Gateway tests/mocks changed for non-Negentropy reasons, split them into a separate commit
9. Re-run targeted validation before restacking history

Red flags:

- `.gitignore` changes that widen unrelated vendor exceptions
- new Negentropy-specific config types under `src/config/**`
- new ad-hoc Negentropy code under `src/gateway/**` outside the generic helper/call sites
- bundling `src/gateway/control-ui.http.test.ts` or `src/gateway/test-helpers.mocks.ts` into the extension commit without a direct contract reason

## Commit playbook

Split commits by concern:

- **stack wiring**:
  - `.gitignore`
  - `custom/**`
  - `package.json`
  - `scripts/custom-stack.mjs`
- **generic OpenClaw host-hook surfaces**:
  - `src/plugins/**`
  - `src/plugin-sdk/core.ts`
  - `src/gateway/plugin-request-policy.ts`
  - related gateway/test files
- **shared gateway test maintenance**:
  - `src/gateway/control-ui.http.test.ts`
  - `src/gateway/server-methods/agent.test.ts`
  - `src/gateway/server-methods/agents-mutate.test.ts`
  - `src/gateway/server-node-events.test.ts`
  - `src/gateway/test-helpers.mocks.ts`
- **Negentropy extension**:
  - `extensions/negentropy-lab/**`
- **vendor snapshot**:
  - `vendor/negentropy-lab`
- **skill docs**:
  - `skills/negentropy-maintainer/**`

Rules:

- never mix stack wiring and vendor snapshot in one commit
- never include `node_modules`, `dist`, generated lockfiles, or `.openclaw-vendor.json`
- if the user wants a polished history, keep the vendor snapshot as the last code commit
- preferred polished stack is:
  1. stack wiring
  2. generic host-hook
  3. shared gateway test maintenance
  4. Negentropy extension
  5. vendor snapshot
  6. skill docs

## Upgrade playbook

Use this when the external Negentropy-Lab repo moved forward and OpenClaw must catch up.

1. Run the official upstream refresh playbook
2. Read the current source HEAD with `node scripts/custom-stack.mjs status`
3. Dry-run the sync list
4. Sync the new snapshot
5. Build inside `vendor/negentropy-lab`
6. Clean generated artifacts
7. Diff the vendor tree and inspect for contract drift
8. Update OpenClaw bridge/config/tests if needed
9. Re-run validation
10. Compare against `origin/main` again, still excluding `vendor/negentropy-lab` and `skills/negentropy-maintainer`
11. Apply the minimal core intrusion playbook
12. Commit wiring, host-hook, shared test maintenance, extension, vendor snapshot, and skill docs separately as needed

Negentropy drift usually shows up in:

- `extensions/negentropy-lab/**`
- generic `gateway_request` hook behavior
- workflow bridge/config/command/event files under `extensions/negentropy-lab/src/workflow-*`
- vendor `openclaw-orchestration` APIs and workflow definitions
- OpenAI-compatible HTTP handlers
- gateway tests

## Troubleshooting playbook

### Sync copied the wrong things

Check `scripts/custom-stack.mjs` include/exclude lists before retrying.

### Vendor build passes but repo gets polluted

Clean with:

```bash
git clean -fdx -- vendor/negentropy-lab
```

Then verify ignored artifacts are gone.

### Upgrade changed OpenClaw behavior

Inspect:

- `extensions/negentropy-lab/**`
- `src/agents/subagent-spawn.ts`
- `src/agents/subagent-registry-completion.ts`
- `src/gateway/server-methods/sessions.ts`
- `src/auto-reply/reply/session.ts`
- `src/plugins/**`
- `src/gateway/plugin-request-policy.ts`
- `src/gateway/openai-http.ts`
- `src/gateway/openresponses-http.ts`
- `src/gateway/tools-invoke-http.ts`
- related gateway tests

### History is messy after upgrade

Restack only after sync/build/integration work is stable. Keep the vendor snapshot commit isolated.

### Upstream changed unrelated OpenClaw files

If the exclusion-based compare shows upstream changes outside `vendor/negentropy-lab`, review them before finalizing the upgrade. Pay special attention to gateway health/readiness, config semantics, ignore rules, and stack scripts because those can subtly break the Negentropy integration.
