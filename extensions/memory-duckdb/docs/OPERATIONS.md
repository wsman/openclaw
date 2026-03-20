# Operations

This document absorbs the acceptance, rollout, rollback, selected-owner
decision, and retired-source closeout guidance for `extensions/memory-duckdb`.

## Acceptance Baseline

`extensions/memory-duckdb` remains accepted as a side-by-side `kind: "memory"`
owner candidate only when the frozen baseline below holds.

Acceptance baseline:

- plugin package validity stays green
- discoverable but not selected remains a non-fault side-by-side state
- selected canonical keeps spool-backed writes, search, get, status, and SQL
  aligned
- selected `shadow-read` keeps status/search/get/SQL visible while writes fail
  with a deterministic read-only error
- degraded selected owner states stay explicit and operator-visible
- required rollout evidence records the selected slot before change, selected
  slot after change, runtime mode used, observed readiness signals, degraded or
  failure signals, rollback trigger, rollback action, and post-change or
  post-rollback owner confirmation

The frozen host/operator surface remains:

- `memory status`
- `memory sync-business`
- `memory sync-skills`
- `memory skill-candidates *`
- `memory_duckdb_status`
- `/plugin/memory-duckdb/status`
- `/plugin/memory-duckdb/search`
- `/plugin/memory-duckdb/sql`

The frozen status blocks remain:

- `businessSync`
- `skillCandidates`
- `controlPlaneAlignment`
- `shadow`
- `native`

## Side-by-Side Rollout

`memory-duckdb` remains a recommended explicit opt-in selected-owner candidate.
It is not the default owner, and `memory-core` remains the default slot.
In plain terms, memory-core remains the default slot.

Side-by-side rollout rules:

- discoverable-but-unselected is expected and must not register generic memory
  owner surfaces
- selected canonical is the primary adoption target
- selected `shadow-read` is a secondary sanity state only
- `memory-lancedb` continues to coexist under the same slot discipline
- no shared config switch is committed in-repo

Explicit selection remains:

```json5
{
  plugins: {
    slots: {
      memory: "memory-duckdb",
    },
  },
}
```

## Selected Owner Decision

`E3` and `E4` are complete and closed.

Selected Owner Decision:

- `memory-duckdb` is a recommended explicit opt-in selected-owner candidate
- it is not the default owner
- `memory-core` remains the default slot
- `runtimeMode = "canonical"` is the primary rehearsal target
- `selected shadow-read` is a secondary sanity state only
- blocker, non-blocker, and conditional-blocker interpretation stays frozen

The recorded controlled opt-in rehearsal remains:

- selected slot before change: `memory-core`
- selected slot after change: `memory-duckdb`
- runtime mode used: `canonical`
- rollback action: restore the slot to `memory-core`
- rollback confidence recorded by restoring the slot to `memory-core`

## Rollback

Rollback remains slot-based, not product-line based.

Rollback:

1. change `plugins.slots.memory` back to `memory-core`, `memory-lancedb`, or
   `none`
2. restart or reload the gateway
3. confirm the previous owner reclaimed the generic memory surfaces
4. confirm stale selected-owner diagnostics do not linger

Operator interpretation remains frozen:

- rollback trigger and rollback action must be recorded
- discoverable-but-unselected after rollback is expected
- a clean rollback is part of the recommendation proof for `E3` and `E4`

## Retired Source Disposition

The retired OpenDoge source disposition remains frozen as `archive-first`.

Retired-source closeout:

- `R1-E` is complete and closed
- `R1` is no longer an active mainline checklist item
- current disposition: archive-first
- the live external OpenDoge source dirs are not treated as runtime
  dependencies
- any future archive/delete handling is a separate operator action outside this
  minimal-delta package set

## Closed Status

`U1` is complete and closed.
`E4` is complete and closed.
There is no required next implementation lane on the current integration track.

Remaining optional follow-ups stay non-blocking:

- independent gateway alias drift investigation
- live `check:gateway:writeback:proof` enhancement

These follow-ups do not reopen `N6`, do not change slot logic, and do not
promote `memory-duckdb` to the default owner.
