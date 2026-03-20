# Negentropy Discipline

This document is the consolidated maintainer note for the repo-local
Negentropy integration.

## Seam

Keep these roles distinct:

- `sourceRoot` is the external source of truth
- `vendorRoot` is the minimal-vendor-snapshot layer
- `extensions/negentropy-lab` is the only official runtime bridge inside
  OpenClaw

OpenClaw host seams must not turn the bridge into the control-plane owner, an
`AuthorityState` write-back owner, or a `smallpond-evo` capability client.
`custom/negentropy-baselines.json` is the machine-readable companion for these
same seam rules.

## Vendor Snapshot

`vendor/negentropy-lab` remains minimal:

- contract snapshots
- compatibility fixtures
- fallback metadata

The tracked vendor truth is limited to metadata plus server-side contract files.
The bridge must not depend on vendor runtime-owner implementation trees.

## Bridge

Bridge-only seam rules remain frozen:

- `extensions/negentropy-lab` remains the only official runtime entry
- `workflowEnabled` enables manual workflow bridge behavior only
- `orchestrationApiBaseUrl` points to the workflow API seam only
- `autoDispatchSubagents` only allows `runtime.subagent.run`
- the extension stays seam-only and must not become a workflow brain

The bridge must not consume `AuthorityState`, `ResultEnvelope`, raw capability
emitter payload, or `smallpond` capability internals.

## Diagnostics

The host-facing diagnostics surface stays host-facing only.

Required diagnostics concepts remain:

- `upstreamReachable`
- `extensionMode`
- `failOpenOrClosed`
- `contractSnapshotVersion`
- `minimalVendorSnapshotVersion`
- `sourceRoot`, `vendorRoot`, and extension discipline

Diagnostics are for host visibility, not control-plane ownership. They must not
recreate write-back owner semantics, raw capability emitter payload views, or
raw capability payload views.

## Extension Consumer

The contract consumer packaging stays explicit and read-only.

The frozen consumer anchors remain:

- decision contract snapshot
- workflow contract snapshot
- host diagnostics surface version
- host memory summary contract snapshot
- business artifact absorb contract snapshot
- skill candidate absorb contract snapshot
- memory-business projection contract snapshot

This keeps `extensions/negentropy-lab` on packaged snapshot truth instead of
vendor runtime-owner code. `P6-B2 complete` remains the consumer packaging
closeout point.
