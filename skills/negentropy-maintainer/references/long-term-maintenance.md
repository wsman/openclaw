# Negentropy Long-Term Maintenance Flow

Use this reference when the task is not a one-off sync, but about the **ongoing maintenance relationship** between the external Negentropy repo, the vendored snapshot, the OpenClaw bridge, and the maintainer skill.

## Stack relationship

Treat the stack as four persistent layers:

1. **External source repo**
   - configured by `custom/stack.local.json -> negentropy.sourceRoot`
   - this is the only upstream source of truth for Negentropy-Lab itself
   - example current local checkout on this workstation: `<path-to-negentropy-lab>`
2. **Vendor snapshot**
   - `vendor/negentropy-lab`
   - controlled mirror of the external source inside OpenClaw
   - used for review, testing, and version pinning inside this repo
3. **OpenClaw runtime bridge**
   - `extensions/negentropy-lab`
   - owns OpenClaw-specific decision bridge, workflow bridge, control-plane command surface, lifecycle-event mapping, normalization, and plugin-local tests
4. **Maintainer procedure layer**
   - `skills/negentropy-maintainer`
   - documents how to sync, validate, compare, split commits, and operate the long-term relationship

## Ownership rules

### Edit the external source repo when changing:
- decision service contracts
- backend behavior in Negentropy-Lab itself
- internal Negentropy API shape
- upstream observability/security/resilience logic
- upstream integration docs that describe Negentropy-owned behavior

### Edit `vendor/negentropy-lab` only when:
- syncing a new external snapshot
- validating the vendored backend locally
- applying a clearly OpenClaw-local vendor hotfix that cannot wait for upstream

### Edit `extensions/negentropy-lab` when changing:
- OpenClaw plugin config exposure
- request-policy bridging behavior
- workflow bridge/config behavior
- OpenClaw-side contract snapshots or normalization
- control-plane commands/status exposure
- workflow lifecycle-event mapping or auto-dispatch behavior
- plugin-local tests

### Edit OpenClaw core only when changing:
- generic plugin contracts
- shared gateway request-policy helper behavior
- thin generic ingress call sites that all plugins can use

### Edit this skill when changing:
- maintainer workflow
- path/layout assumptions
- commit boundaries
- long-term ownership model

## Long-term operating model

### Steady-state maintenance cycle

1. **Check external source health**
   - verify `negentropy.sourceRoot` exists
   - verify the source repo is readable and clean enough to compare
2. **Check official OpenClaw upstream drift**
   - compare against `origin/main` excluding `vendor/negentropy-lab` and this skill
3. **Preview the vendor sync set**
   - run dry-run sync before a real sync
4. **Sync vendor snapshot**
   - mirror the curated subset into `vendor/negentropy-lab`
5. **Build and validate vendor locally**
   - build in the vendor tree
   - remove generated artifacts after validation
6. **Inspect bridge drift**
   - update `extensions/negentropy-lab` if contracts or behavior changed
7. **Inspect generic host drift**
   - touch OpenClaw core only if the extension boundary itself changed
8. **Re-run focused validation**
   - plugin tests
   - workflow bridge/config/command/event tests when workflow surfaces changed
   - gateway request-policy tests
   - any contract/self-check tests
9. **Split changes by concern**
   - wiring
   - generic host-hook
   - extension
   - vendor snapshot
   - skill/docs

## Recommended cadence

### Every maintenance session
- run official upstream refresh review
- run `node scripts/custom-stack.mjs status`
- run `node scripts/custom-stack.mjs sync-negentropy --dry-run` before real sync work

### When the external repo changes materially
- sync vendor snapshot
- build vendor locally
- diff for contract drift
- update extension if required
- rerun focused tests

### Periodically
- check whether vendor docs still assume obsolete bridge paths or stale UI paths
- check whether `extensions/negentropy-lab` is still carrying code that should move back upstream or down into vendor
- check whether OpenClaw core has accumulated Negentropy-specific logic that should move into the extension

## Acceptance gates for a healthy maintenance round

A maintenance round is healthy when all of these are true:

- external `sourceRoot` is known and readable
- vendor sync set looks intentional in dry-run
- vendored backend can build locally
- generated vendor artifacts are cleaned back out
- extension tests pass
- workflow bridge/config/command tests pass when workflow surfaces changed
- gateway request-policy tests pass
- self-check scripts point at the current extension-based architecture
- commit boundaries are still clean

## SourceRoot policy

Do not hardcode local workstation paths into repo-tracked stack wiring.

Instead:
- keep machine-specific source paths in `custom/stack.local.json`
- use `custom/stack.example.json` only as a template
- treat `<path-to-negentropy-lab>` as an example local checkout, not a repo invariant

## Failure handling

### If sourceRoot is missing
- do not fake a sync
- do not edit vendor as if it were the upstream repo
- record the missing source as an environmental blocker
- continue only with OpenClaw-side fixes that are valid without a new vendor sync

### If vendor and extension drift simultaneously
- sync vendor first
- then adapt extension
- only then decide whether generic OpenClaw host-hook changes are necessary

### If OpenClaw upstream also moved
- review upstream first
- resolve overlapping changes in `src/gateway/**`, `custom/**`, `.gitignore`, `package.json`, or `scripts/custom-stack.mjs` before locking the maintenance stack

## Practical rule of thumb

When in doubt, follow this order:

1. external source repo
2. vendor snapshot
3. extension bridge
4. generic host-hook surfaces
5. maintainer skill/docs

That order keeps the stack stable and prevents vendor, bridge, and host responsibilities from collapsing into each other.
