# Memory DuckDB

`extensions/memory-duckdb` is the native OpenClaw `kind: "memory"` side-by-side
owner candidate that absorbs the host-side runtime owner chain from the
OpenDoge memory stacks into one host-side extension package.

It exists to:

- absorb `OpenDoge/plugins/memory` runtime orchestration, canonical JSONL ingest
  ordering, diagnostics aggregation, and shadow replay semantics
- absorb `OpenDoge/plugins/memory-duckdb` as a read facade and SQL contract
  source, not as a second runtime owner
- stay discoverable and valid beside `memory-core` and `memory-lancedb`
  without taking over host surfaces until `plugins.slots.memory =
"memory-duckdb"` selects it

It does not:

- replace `extensions/negentropy-lab`
- replace `vendor/negentropy-lab`
- become a control-plane owner
- depend on `smallpond-evo`
- keep OpenDoge repo paths as runtime dependencies

## Role

- host-side memory runtime owner candidate
- canonical read/write surface after explicit slot selection
- plugin-local DuckDB read facade and diagnostics carrier
- side-by-side rollout target with explicit rollback to the previous memory slot

## Boundary Discipline

- Production code imports only `openclaw/plugin-sdk/*` plus package-local
  modules.
- The extension does not import core `src/**`, other extension `src/**`,
  `vendor/negentropy-lab` runtime-owner files, or `smallpond-evo` internals.
- `extensions/negentropy-lab` remains the only official Negentropy runtime
  bridge.

See `docs/ARCHITECTURE.md`.

## E2-A contract freeze

`E2-A` freezes the package-local `smallpond` read and artifact contract for
this extension without introducing direct OpenClaw-to-`smallpond` runtime
coupling.

The canonical `E2-A` package-local artifacts now live in
`docs/ARCHITECTURE.md` plus `src/capability/smallpond/`.

This package-local subtree freezes:

- the approved artifact inventory and source surfaces
- the `SmallpondReadArtifact`, `SmallpondKnowledgeIngestArtifact`, and
  `SmallpondSkillCandidateArtifact` families
- the approved read facade guard for source-view access
- the canonical artifact-to-knowledge mapping for later `E2-B`

The host stays on stable approved source views only. It does not import a
`smallpond-evo` client, it does not own raw `smallpond` payloads, and it does
not treat raw internal tables or paths as an accepted host seam.

## E2-B materialization

`E2-B` builds on the frozen `E2-A` contract layer and turns approved
`smallpond` artifacts into canonical host-side `MemoryRecord` entries through
the existing single-writer queue, JSONL spool, and canonical repository path.

The package-local `E2-B` execution surfaces are documented in
`docs/ARCHITECTURE.md` and implemented in:

- `src/capability/smallpond/SmallpondClient.ts`
- `src/capability/smallpond/BusinessKnowledgeSyncService.ts`
- `src/capability/smallpond/SmallpondMaterialization.ts`

This first wave keeps the host boundary frozen:

- `SmallpondClient` is an approved-surface adapter only
- startup + manual sync is supported; background polling is intentionally out of
  scope
- manual retry stays on the selected-owner CLI surface via `memory sync-business`
- materialized records freeze `metadata.smallpond` and `metadata.knowledge`
  envelopes instead of adding raw host-owned `smallpond` tables

`memory status` and `memory_duckdb_status` now expose a `businessSync` object so
operators can inspect sync lag, last success, duplicate skips, and failure
counts without introducing a new top-level status API.

## E2-C skill candidate pipeline

`E2-C` keeps skill candidates host-local and canonical without inventing a new
store, a new tool surface, or a new HTTP mutation route.

The package-local `E2-C` execution surfaces are documented in
`docs/ARCHITECTURE.md` and implemented in:

- `src/capability/smallpond/SkillCandidateTypes.ts`
- `src/capability/smallpond/SkillCandidateStateMachine.ts`
- `src/capability/smallpond/SkillCandidateProjector.ts`
- `src/capability/smallpond/SkillCandidateMaterializer.ts`
- `src/capability/smallpond/SkillCandidatePipelineService.ts`

This lane freezes:

- `SkillCandidateLifecycleState`
- host-owned `metadata.skillCandidate`
- startup ordering of `syncBusinessKnowledge("startup")` before
  `syncSkillCandidates("startup")`
- selected-owner CLI only for operator flow

The selected-owner CLI commands are:

- `memory sync-skills`
- `memory skill-candidates list`
- `memory skill-candidates get <candidateId>`
- `memory skill-candidates submit-review <candidateId>`
- `memory skill-candidates approve <candidateId>`
- `memory skill-candidates reject <candidateId>`
- `memory skill-candidates archive <candidateId>`

`memory status` and `memory_duckdb_status` now expose a `skillCandidates`
object beside `businessSync`, including pipeline state, last candidate id, run
counters, and `countsByLifecycle`.

## E2-D control-plane alignment

`E2-D` keeps the host as the owner of classification, emission discipline, and
host-visible alignment diagnostics without adding a new CLI command, a new
plugin-local HTTP mutation route, or a new `openclaw/plugin-sdk/*` seam.

The package-local `E2-D` execution surfaces are documented in
`docs/ARCHITECTURE.md` and implemented in:

- `src/capability/smallpond/ControlPlaneAlignment.ts`

This lane freezes:

- host-side classification as `host_local_only`, `control_plane_summary`,
  `writeback_candidate`, or `projection_only`
- canonical classification on normalized host records only, using
  `metadata.knowledge.kind`, `metadata.smallpond.artifactType`, and
  `metadata.skillCandidate`
- emission discipline so only normalized summary fields are control-plane
  eligible
- the separation between `metadata.skillCandidate` host summaries and
  source-artifact discovery/business-resync records

`memory status` and `memory_duckdb_status` now expose a
`controlPlaneAlignment` block beside `businessSync` and `skillCandidates`,
including `countsByClassification`, absorb/write-back eligibility counts, and
sample blocked record ids.

## E2-E operator / rollout closeout

`E2-E` does not add a new host API surface. It freezes the existing
selected-owner and read-only operator surfaces as the formal host contract for
this extension.

The frozen operator entrypoints are:

- selected-owner CLI:
  `memory status`, `memory sync-business`, `memory sync-skills`, and
  `memory skill-candidates *`
- read-only plugin surfaces:
  `memory_duckdb_status`, `/plugin/memory-duckdb/status`,
  `/plugin/memory-duckdb/search`, and `/plugin/memory-duckdb/sql`

The frozen host-visible status vocabulary is:

- `businessSync`
- `skillCandidates`
- `controlPlaneAlignment`
- `shadow`
- `native`

Operator interpretation is now fixed:

- selected canonical mode:
  owner service, CLI, tools, and read-only routes are active; spool-backed
  writes and startup/manual sync are allowed
- selected `shadow-read` mode:
  status/search/get/SQL stay available, but canonical writes and sync mutations
  return deterministic read-only or disabled states
- degraded native/read-facade state:
  the plugin stays installed, but SQL/read-facade use must be treated as
  degraded until native readiness is restored
- degraded sync/alignment state:
  the selected owner remains active, but operators must review
  `businessSync`, `skillCandidates`, and `controlPlaneAlignment` before
  treating absorb/projection output as healthy
- discoverable-but-unselected:
  expected side-by-side state, not a fault; generic memory owner CLI, tools,
  routes, and services do not register until the slot explicitly selects this
  plugin

## E3 selected-owner decision closeout

`E3` is complete and closed as host-only decision and evidence work. It does
not redesign runtime selection, change the default slot, or reopen `N6`.

The frozen `E3` outcome is:

- `memory-duckdb` is a recommended selected-owner candidate
- it is not the default owner
- `memory-core` remains the default slot until a later explicit adoption phase

In plain terms, memory-core remains the default slot.

The package-local `E3` and `E4` truth source is `docs/OPERATIONS.md`.

That decision artifact freezes:

- readiness audit criteria
- rehearsal evidence
- final recommendation wording
- blockers vs non-blockers
- conditional blockers for native readiness and `shadow.checkpointStale`

## U1 upstream compatibility hardening

`U1` is complete and closed. It hardened the rebased `origin/main`
compatibility round without changing the architecture judgment for this
extension.

`U1` closed green based on:

- plugin boundary, loader, side-by-side, and runtime-dependency checks
- host status, session, startup, and bridge compatibility checks
- docs and operator wording aligned to the rebased upstream truth
- green `pnpm check`, `pnpm build`, seam checks, and diagnostics coverage

## E4 operator-controlled selected-owner opt-in

`E4` is complete and closed as a host-only adoption and enablement phase. It
does not reopen `N6`, redesign slot logic, or promote `memory-duckdb` to the
default owner.

`E4` closed green based on:

- readiness frozen against the existing selected-owner contract only
- one repo-driven canonical selected-owner rehearsal with explicit
  `plugins.slots.memory = "memory-duckdb"`
- rollback confidence recorded by restoring the slot to `memory-core`
- final adoption wording frozen in `docs/OPERATIONS.md`

The frozen `E4` outcome is:

- `memory-duckdb` is a recommended explicit opt-in selected-owner candidate
- it is not the default owner
- `memory-core` remains the default slot
- no default-slot promotion occurred

There is no required next implementation lane on the current integration track
after `E4`.

Remaining optional follow-ups stay non-blocking:

- independent gateway alias drift investigation
- live `check:gateway:writeback:proof` enhancement

## Source Absorption Map

- `OpenDoge/plugins/memory` is the primary migration source for the host-side
  runtime owner chain.
- `OpenDoge/plugins/memory-duckdb` is a read facade migration source only.
- Migrated capability and contract mapping lives in `docs/ARCHITECTURE.md`.

This extension does not claim a directory-level or module-level 100% merger of
every legacy API/server, repository, monitoring, or support asset that still
exists under `OpenDoge/plugins/memory`.

## Packaging closeout

`E1-F` closes this extension out with the package-local reference set:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/OPERATIONS.md`

## Retired source gate

`R1-E` remains frozen in `docs/OPERATIONS.md` as an `archive-first`
retired-source conclusion. Any future archive/delete handling stays a separate
operator action outside this minimal-delta package set.

`R1` is now closed and no longer part of the active mainline. Its fixed
conclusion is `archive-first`, not `delete-now`. Future live external-dir
handling is a separate operator action only, as frozen in
`custom/post-r1-active-roadmap.md`.

## Post-R1 roadmap

The closed post-`R1` integration order is now:

1. `E2-A = smallpond read/artifact contract freeze`
2. `N6-A = contract family freeze`
3. `P-next-2 = host materialization + control-plane projection`
4. `P-next-3 = skill candidate + business absorb projection`
5. `P-next-4 = alignment discipline + write-back evidence closeout`
6. `P-next-5 = operator / rollout / diagnostics closeout`
7. `E3 = selected-owner rollout decision for memory-duckdb`
8. `U1 = upstream compatibility hardening`
9. `E4 = operator-controlled selected-owner opt-in`

`E2`, `N6`, `E3`, `U1`, and `E4` are complete and closed. `U1` closed the
final rebased-upstream compatibility round without reopening control-plane
ownership, and `E4` closed the host-only explicit opt-in adoption round without
changing the default slot.

There is no required next implementation lane on the current integration track
after `E4`.

Optional follow-ups remain limited to:

- independent gateway alias drift investigation
- live `check:gateway:writeback:proof` enhancement

See `custom/post-r1-active-roadmap.md` for the frozen execution order and
closeout rules.

## Current Runtime Shape

- canonical writes flow through a single-writer queue into a JSONL spool
- canonical records live in a plugin-local compatibility store
- shadow replay reads only from the spool and advances the persisted checkpoint
  only after parity is `ok` with `mismatchCount = 0`
- `shadow-read` keeps status/search/get/SQL surfaces available but rejects
  writes with a deterministic read-only error
- business knowledge sync stays disabled in `shadow-read`
- `shadow.checkpointStale` flips on when the persisted shadow checkpoint is
  missing after writes or older than the configured checkpoint-age threshold
- DuckDB SQL stays SELECT-only and blocks raw runtime tables
- DuckDB native bindings are optional for selection, but the status surface
  reports availability and build guidance

## Slot Selection

The plugin is safe to install side-by-side without changing the active owner.
It only becomes the active memory owner when the slot is set explicitly:

Set `plugins.slots.memory = "memory-duckdb"` to activate this owner candidate.
After `E3`, `U1`, and `E4`, this remains an explicit opt-in recommendation, not
a default switch.

```json5
{
  plugins: {
    slots: {
      memory: "memory-duckdb",
    },
    entries: {
      "memory-duckdb": {
        enabled: true,
      },
    },
  },
}
```

When not selected, the loader keeps it discoverable but disabled. That
discoverable-but-unselected state is expected during side-by-side rollout, so
it does not register the owner `memory` CLI, tools, routes, or services and
should not be treated as a fault by operators.

For the operator-facing rollout story, see `docs/OPERATIONS.md`.

## Rollback

Rollback is slot-based, not product-line based:

1. change `plugins.slots.memory` back to `memory-core`, `memory-lancedb`, or
   `"none"`
2. restart the gateway
3. confirm the previous owner owns the generic memory surface again

No parallel owner code path is kept alive after rollback.

See `docs/OPERATIONS.md` for the formal rollback runbook, selected-owner
evidence, and recommendation wording.

## Native Dependency Notes

This plugin owns its runtime dependencies locally in
`extensions/memory-duckdb/package.json`.

DuckDB is a native dependency. On hosts where the binding is missing, status and
SQL read-facade calls return explicit diagnostics instead of pretending the
binding is healthy.

Typical developer/operator actions:

```bash
pnpm install
pnpm rebuild duckdb
```

`pnpm-workspace.yaml` and the root package `pnpm.onlyBuiltDependencies` allow
DuckDB build scripts. Windows, macOS, and Linux can differ in how the native
binding is supplied. If the binding stays unavailable, canonical spool-backed
memory surfaces continue to work, while DuckDB SQL/read-facade surfaces remain
degraded with diagnostics.

## Acceptance

Use `docs/OPERATIONS.md` as the package-local acceptance, rollout, rollback,
and selected-owner checklist before treating `memory-duckdb` as ready for slot
selection.

## Do not enable yet when

Keep this plugin installed but unselected when:

- the native DuckDB binding is unavailable and SQL/read-facade access matters
- the selected-owner startup path or generic memory surfaces drift from the
  accepted baseline
- `shadow.checkpointStale` is on and the persisted shadow checkpoint has not
  been repaired or revalidated against `shadow.maxCheckpointAgeSeconds`

Use `docs/OPERATIONS.md` to move the slot back to the previous owner instead of
trying to repair the selected state in place.
The optional live `check:gateway:writeback:proof` gap is not, by itself, an
`U1` blocker.
