# Negentropy Integration Map

This reference maps the files that matter when maintaining the three-part Negentropy stack:

- `skills/negentropy-maintainer`
- `extensions/negentropy-lab`
- `vendor/negentropy-lab`

## Core maintenance files

- `origin/main` - official OpenClaw baseline to compare against before sync/upgrade
- `custom/README.md` - local stack wiring guidance
- `custom/stack.example.json` - template for `sourceRoot` and `vendorRoot`
- `scripts/custom-stack.mjs` - sync/status/build helper entry point
- `.gitignore` - vendor allowlist and local metadata exclusions
- `package.json` - custom Negentropy sync commands

## Vendor source and destination

- **External source repo**: configured by `negentropy.sourceRoot`
- **Example current local source checkout**: `<path-to-negentropy-lab>`
- **Vendored destination**: `vendor/negentropy-lab`
- **OpenClaw runtime bridge**: `extensions/negentropy-lab`
- **Local metadata file**: `vendor/negentropy-lab/.openclaw-vendor.json` (ignored; do not commit)
- **Long-term relationship reference**: `references/long-term-maintenance.md`

## What `scripts/custom-stack.mjs` syncs

### Included root directories

- `.github`
- `config`
- `docs`
- `engine`
- `memory_bank`
- `monitoring`
- `plugins`
- `scripts`
- `server`
- `src`
- `templates`
- `tests`

### Included root files

- `.clinerules`
- `.eslintrc.json`
- `.gitignore`
- `CHANGELOG.md`
- `constitution-compliance-report.json`
- `docker-compose.production.yml`
- `docker-compose.v3.yml`
- `Dockerfile.mcp`
- `Dockerfile.node`
- `Dockerfile.production`
- `jest.config.js`
- `LICENSE`
- `package.json`
- `pnpm-lock.yaml`
- `README.md`
- `tsconfig.build.json`
- `tsconfig.json`
- `tsconfig.test.json`
- `vitest.config.mjs`

### Excluded names

- `.cdd`
- `.git`
- `.husky`
- `coverage`
- `data`
- `dist`
- `logs`
- `node_modules`
- `reports`
- `storage`

## Negentropy stack relationship

- `skills/negentropy-maintainer` = maintainer workflow and review policy
- `extensions/negentropy-lab` = plugin that adapts OpenClaw runtime requests to Negentropy decisions
- `vendor/negentropy-lab` = vendored external backend/source snapshot

The normal change flow is:

1. compare against latest `origin/main`
2. sync or inspect `vendor/negentropy-lab`
3. update `extensions/negentropy-lab` if vendor contracts drift
4. touch generic OpenClaw host-hook files only when the extension boundary itself changes
5. update `skills/negentropy-maintainer` when the maintenance model changes

## OpenClaw-side integration surfaces

These are the first places to inspect after a vendor sync or upgrade:

- `extensions/negentropy-lab/index.ts`
- `extensions/negentropy-lab/openclaw.plugin.json`
- `extensions/negentropy-lab/src/decision-contract.snapshot.ts`
- `extensions/negentropy-lab/scripts/sync-decision-contract-snapshot.mjs`
- `extensions/negentropy-lab/src/decision-bridge.ts`
- `extensions/negentropy-lab/src/gateway-request.ts`
- `src/plugins/types.ts`
- `src/plugins/hooks.ts`
- `src/plugin-sdk/core.ts`
- `src/gateway/plugin-request-policy.ts`
- `src/gateway/openai-http.ts`
- `src/gateway/openresponses-http.ts`
- `src/gateway/tools-invoke-http.ts`
- `src/gateway/server-methods.ts`
- related tests under `src/gateway/*.test.ts`

## Minimal core intrusion surfaces

The preferred OpenClaw shape keeps core changes narrow and generic:

- **generic host-hook contracts**
  - `src/plugins/types.ts`
  - `src/plugins/hooks.ts`
  - `src/plugin-sdk/core.ts`
- **shared Gateway policy helper**
  - `src/gateway/plugin-request-policy.ts`
- **thin Gateway entrypoint integrations**
  - `src/gateway/openai-http.ts`
  - `src/gateway/openresponses-http.ts`
  - `src/gateway/tools-invoke-http.ts`
  - `src/gateway/server-methods.ts`

The goal is:

- Negentropy-specific runtime behavior stays in `extensions/negentropy-lab/**`
- vendored upstream code stays in `vendor/negentropy-lab/**`
- OpenClaw core only provides the generic plugin boundary

If a change goes beyond these surfaces, ask whether it is truly generic OpenClaw host work or whether it should move into the extension.

## Shared Gateway test maintenance surfaces

These files are commonly touched while adapting tests or mocks, but they are not Negentropy-specific by default:

- `src/gateway/control-ui.http.test.ts`
- `src/gateway/server-methods/agent.test.ts`
- `src/gateway/server-methods/agents-mutate.test.ts`
- `src/gateway/server-node-events.test.ts`
- `src/gateway/test-helpers.mocks.ts`

If they change during Negentropy work, keep them in a separate **shared gateway test maintenance** commit unless the diff is directly testing the `gateway_request` contract.

## Official upstream comparison surfaces

Before sync or upgrade work, compare local changes against `origin/main`, excluding `vendor/negentropy-lab` and `skills/negentropy-maintainer`.

The highest-signal files to review in that compare are:

- `src/gateway/**`
- `src/config/**`
- `.gitignore`
- `package.json`
- `custom/**`
- `scripts/custom-stack.mjs`

## Command entry points

- `node scripts/custom-stack.mjs status`
- `node scripts/custom-stack.mjs sync-negentropy --dry-run`
- `node scripts/custom-stack.mjs sync-negentropy`
- `pnpm custom:stack:status`
- `pnpm custom:negentropy:sync:dry`
- `pnpm custom:negentropy:sync`

## Build and cleanup surfaces

Inside `vendor/negentropy-lab`, local install/build can create:

- `node_modules/`
- `dist/`
- `pnpm-lock.yaml`

These are local validation artifacts and should not remain in the repo after verification.

## Commit boundaries

### Stack wiring commit

- `.gitignore`
- `custom/**`
- `package.json`
- `scripts/custom-stack.mjs`

### OpenClaw bridge commit

- `extensions/negentropy-lab/**`
- adjacent gateway/plugin/test files

### Generic host-hook commit

- `src/plugins/**`
- `src/plugin-sdk/core.ts`
- `src/gateway/plugin-request-policy.ts`
- related generic gateway/test files

### Shared gateway test maintenance commit

- `src/gateway/control-ui.http.test.ts`
- `src/gateway/server-methods/agent.test.ts`
- `src/gateway/server-methods/agents-mutate.test.ts`
- `src/gateway/server-node-events.test.ts`
- `src/gateway/test-helpers.mocks.ts`

### Vendor snapshot commit

- `vendor/negentropy-lab`

### Skill commit

- `skills/negentropy-maintainer/**`
