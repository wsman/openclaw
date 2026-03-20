# Post-R1 Active Roadmap Freeze

This repo-local note freezes the mainline state after `R1` closeout.

## Official `R1` conclusion

`R1-E` is complete and closed with `finalDisposition = archive-first`.
`R1-F1` through `R1-F3` are complete, and `R1-F` is complete and closed.

That conclusion is intentionally narrow:

- the repo now has frozen `archive-first` retirement capability
- the repo now has frozen retirement pointers and delete-deferral rules
- this does not mean the live retired external OpenDoge memory source dirs have
  already been physically archived or deleted

The official `R1` result is `archive-first`, not `delete-now`.

Any future live retired-source handling is a separate operator action only and
is no longer packaged as part of this minimal-delta support surface.

`R1` is therefore removed from the active mainline and stays as a completed
background capability.

## Current roadmap state

The completed mainline state is now:

- `E1` is complete and closed
- `E2-A = smallpond read/artifact contract freeze`
- `E2-B = business knowledge solidification pipeline`
- `E2-C = skill candidate pipeline`
- `E2-D = control-plane alignment`
- `E2-E = operator / rollout / diagnostics closeout`
- `E2` is complete and closed
- `N6-A = contract family freeze`
- `N6-B = host memory summary absorb + projection`
- `N6-C = smallpond business artifact absorb + projection`
- `N6-D = write-back discipline + evidence link alignment`
- `N6-E = diagnostics / gates / downstream closeout`
- `N6` is complete and closed
- `P-next-4 = alignment discipline + write-back evidence closeout`
- `P-next-5 = operator / rollout / diagnostics closeout`
- `E3 = selected-owner rollout decision for memory-duckdb`
- `U1 = upstream compatibility hardening`
- `E4 = operator-controlled selected-owner opt-in`

`P-next-5`, `E3`, `U1`, and `E4` are closed and removed from the active focus
list. `E2` is complete and closed. `N6` is complete and closed.

## E3 closeout state

`E3` is complete and closed:

1. `E3-A = selected-owner readiness audit`
2. `E3-B = controlled slot selection rehearsal`
3. `E3-C = final adoption decision`

This closeout remains host-only and decision-only:

- `extensions/memory-duckdb` froze recommendation readiness using the
  existing selected-owner CLI, read-only plugin surfaces, rollout docs, and
  rollback docs
- `memory-duckdb` is confirmed as a recommended selected-owner candidate, not as
  the new default owner
- `plugins.slots.memory` remains explicit opt-in for `memory-duckdb`
- `memory-core` remains the default slot owner
- bridge/control-plane ownership still flows through `extensions/negentropy-lab`
  as bridge carrier and upstream `Negentropy-Lab` as control-plane truth
- `vendor/negentropy-lab` remains minimal snapshot only
- `extensions/negentropy-lab` remains bridge-only and mirror-consumer only
- no new `N6` work is opened during `E3`

## U1 closeout state

`U1 = upstream compatibility hardening` is complete and closed.

This closeout keeps the architecture judgment unchanged:

- `extensions/memory-duckdb` remains the host-side memory extension
- `extensions/negentropy-lab` remains bridge-only and consumer-only
- `vendor/negentropy-lab` remains the minimal snapshot and contract mirror
- `smallpond-evo` remains the external capability-plane implementation

`U1` closed green based on:

- plugin boundary, loader, side-by-side, and runtime-dependency checks
- host status, session, startup, and bridge compatibility checks
- docs and operator wording aligned to the rebased `origin/main` truth
- green `pnpm check`, `pnpm build`, seam checks, and diagnostics or consumer
  guards

The extra failing test `agent accepts channel aliases (imsg/teams)` is tracked
as a separate non-`U1` issue. It does not block `U1` closeout.

## E4 closeout state

`E4 = operator-controlled selected-owner opt-in` is complete and closed.

This closeout stays host-only and adoption-only:

1. `E4-A = selected-owner readiness freeze`
2. `E4-B = controlled opt-in rehearsal`
3. `E4-C = rollback confidence closeout`
4. `E4-D = final adoption decision`

`E4` closed on the existing selected-owner contract only:

- explicit `plugins.slots.memory = "memory-duckdb"` remains the only opt-in
  activation path
- `runtimeMode = "canonical"` is the primary selected-owner rehearsal target
- selected `shadow-read` remains secondary sanity evidence only
- rollback remains slot-based to `memory-core`, `memory-lancedb`, or `none`
- `memory-core` remains the default slot owner
- no new `N6` work is opened during `E4`

There is no required next implementation lane on the current integration track
after `E4`.

## OpenDoge memory remaining-gap checklist

Use this checklist when answering whether `OpenDoge/plugins/memory` is fully
merged into `extensions/memory-duckdb`.

Already absorbed into the current OpenClaw host-side owner chain:

- runtime owner entry, plugin manifest, and selected-owner host surfaces
- canonical ingest, JSONL spool, checkpoint, and shadow replay discipline
- DuckDB read facade and guarded SQL read contract
- host-side `smallpond` business sync, skill-candidate pipeline, and
  control-plane alignment

Actionable remaining gaps:

| Legacy capability/domain | Current status | Current OpenClaw replacement or rationale | Blocks `core owner chain absorbed` claim | Blocks `100% full merger` claim | Recommended action |
| --- | --- | --- | --- | --- | --- |
| independent API/server packaging | intentionally omitted | OpenClaw extensions use `registerTool`, `registerCli`, `registerService`, and `registerHttpRoute` instead of carrying a parallel Express server stack | no | yes | do not migrate |
| repository backend family and session storage surfaces | partially replaced | `memory-duckdb` carries canonical spool-backed owner behavior and a DuckDB read facade, but not the full sqlite/postgres/session repository family from `plugins/memory` | no | yes | required before retirement claim |
| monitoring/ops/release drill assets | partially replaced | host-visible diagnostics, status blocks, and closeout docs replace the core operator story, but not the full dashboards/alerts/drill asset set | no | yes | optional later migration |
| vector/embedding/Qdrant retrieval stack | intentionally omitted | the current extension stays on host-local canonical retrieval and DuckDB-aligned owner semantics rather than a Qdrant-centric retrieval service | no | yes | do not migrate |
| richer reflection/governance pipeline | partially replaced | lightweight reflection/governance summaries exist for host status, but not the legacy candidate/promotion pipeline as a full subsystem | no | yes | optional later migration |
| migration/import utilities for legacy storage | still missing | the current extension does not ship the old sqlite/postgres import and migration helpers from `plugins/memory` | no | yes | required before retirement claim |

Formal closeout:

- core host-side owner chain is absorbed
- full module-by-module merger is not yet true
- old `plugins/memory` remains worth keeping as archive/reference until any
  retirement-only gaps are explicitly closed or waived

## OpenDoge memory migration priority matrix

Use this matrix when deciding whether a remaining legacy gap should still move
into `extensions/memory-duckdb`.

| Priority | Domain | Why it belongs here | Direction |
| --- | --- | --- | --- |
| must migrate | session/archive/maintenance lifecycle capabilities | these directly affect long-running operator maintenance, cleanup confidence, and eventual retirement confidence for the current extension | migrate only the pieces required by the current owner lifecycle |
| must migrate | repository abstraction and storage contracts | the extension benefits from clearer storage contracts, but not from restoring the full legacy backend platform shape | migrate abstraction and contract only; do not restore the full sqlite/postgres/duckdb implementation family |
| nice to migrate | monitoring contract, status vocabulary, and dashboard schema | these improve operator visibility and diagnostics quality, but the current owner chain does not depend on the old backend monitoring topology | migrate metrics vocabulary and operator-facing contracts only |
| nice to migrate | docs, baselines, and support-asset consolidation | this reduces maintenance and review cost rather than adding new runtime behavior | continue reducing and consolidating support assets instead of adding more |
| do not migrate | independent API/server packaging | OpenClaw extensions should stay on plugin-owned tools, CLI, services, and HTTP routes rather than a parallel Express server stack | keep the current plugin-native surface |
| do not migrate | legacy multi-backend implementation family | restoring the old sqlite/postgres/duckdb implementation family would turn `memory-duckdb` back into a compatibility platform instead of a focused owner candidate | explicitly avoid restoring the old full-family implementations |
| do not migrate | vector/embedding/Qdrant retrieval stack | the current DuckDB owner-chain contract does not depend on the old Qdrant-centric retrieval service shape | keep omitted unless architecture is intentionally reopened |
| do not migrate | `plugins/memory-duckdb` parallel product identity residue | the remaining durable value already lives in the read facade and SQL guard, so the old product identity is mostly historical residue | keep as archive/reference only |

Priority meaning:

- `must migrate` means the gap still matters before a credible full-retirement
  claim for `OpenDoge/plugins/memory`
- `nice to migrate` means the gap is useful to improve maintainability or
  operator quality, but it does not block the current owner chain
- `do not migrate` means the old structure should stay retired or archived
  instead of being recreated inside the extension

## Optional follow-ups

These are optional and inactive. They are not active roadmap phases:

- independent gateway alias drift investigation
- live `check:gateway:writeback:proof` enhancement

These optional follow-ups stay host/operator-facing only. They do not reopen
`N6`, do not change the default slot, and do not change runtime selection
logic.

## Phase freeze rules

### `E2-A`

`E2-A` defines the host-side read/artifact contract between external
`smallpond-evo` outputs and `extensions/memory-duckdb`.

It must:

- document and test what host-visible read/artifact forms can be absorbed
- stay on host-side contract and artifact vocabulary only
- keep `extensions/memory-duckdb` as a host-side memory owner candidate

It must not:

- introduce direct OpenClaw-to-smallpond runtime coupling
- consume raw smallpond payloads as host-owned truth
- turn `extensions/memory-duckdb` into a capability implementation owner

### `N6-A`

`N6-A` defines the contract family between `extensions/memory-duckdb`
host-visible outputs and `extensions/negentropy-lab` bridge/control-plane
consumption.

It must:

- freeze the host-to-control-plane contract family before later absorb /
  projection / write-back work
- keep `extensions/negentropy-lab` as the only official Negentropy runtime
  bridge
- leave absorb / projection / write-back semantics on the Negentropy side

It must not:

- promote `extensions/negentropy-lab` into a write-back owner replacement
- promote `extensions/negentropy-lab` into a control-brain expansion
- reclassify `vendor/negentropy-lab` as anything other than a minimal snapshot

## Architectural order and defaults

The order is fixed:

1. the host layer defines what can be read and absorbed
2. the control plane defines how it is absorbed, projected, and written back

Persistent defaults:

- `vendor/negentropy-lab` remains minimal snapshot only
- `smallpond-evo` remains an external capability service only
- `extensions/memory-duckdb` remains a host-side memory owner candidate only
- `extensions/negentropy-lab` remains the only official Negentropy runtime
  bridge

## Acceptance meaning

This freeze is satisfied only if all of the following remain true:

- `R1` stays closed with repo-local `archive-first` retirement capability frozen
- `R1` is not reopened unless the task is specifically a live retired-source
  operator action
- `E2` stays closed and does not reopen host-side materialization or alignment
  decisions
- `N6` stays closed and does not reopen control-plane ownership, absorb,
  projection, or proof decisions
- `E3` remains documentation-plus-proof for the selected-owner recommendation
  and does not change runtime slot-selection logic
- `U1` remains the final compatibility-hardening closeout and does not change
  the frozen ownership model
- `E4` remains host-only explicit opt-in adoption and does not change the
  default slot or reopen `N6`
- there is no required next implementation lane on the current integration track
  after `E4`; later work is optional follow-up only
