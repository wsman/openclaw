# Negentropy Lab

`negentropy-lab` is an OpenClaw extension that combines gateway request policy
decisions with manual workflow orchestration backed by Negentropy internal APIs.
It now packages that bridge as a contract consumer model with explicit snapshot,
fixture, and diagnostics inputs.

It is the only official runtime entry for the Negentropy stack inside OpenClaw.
It is the OpenClaw runtime bridge layer and host-visible diagnostics carrier.
It is not the control-plane owner, it does not replace `vendor/negentropy-lab`,
and it does not replace the external `sourceRoot`.

It plugs into OpenClaw hook surfaces and can:

- use `gateway_request` to allow, rewrite, or reject a gateway request before
  the built-in handler runs
- expose `/negentropy` control commands for decision mode and workflow runs
- map `subagent_*` and `session_*` lifecycle events into workflow runtime
  events when the workflow bridge is enabled
- optionally auto-dispatch upstream `spawn_subagent` actions through
  `runtime.subagent.run(...)`

Bridge-only seam rules:

- `workflowEnabled` only enables the manual workflow bridge command surface and
  lifecycle event forwarding; it does not enable global autonomous
  orchestration or control-plane ownership.
- `orchestrationApiBaseUrl` only points the extension at the workflow API
  surface; it does not redefine vendor or `sourceRoot` ownership.
- `autoDispatchSubagents` only allows upstream `spawn_subagent` actions to pass
  through `runtime.subagent.run(...)`; it does not let the extension interpret
  `AuthorityState` or become a workflow brain.
- the extension remains seam-only and bridge-only; it does not become the
  write-back owner, control-plane truth source, or capability implementation

Configure it under `plugins.entries.negentropy-lab.config`, for example:

```yaml
plugins:
  entries:
    negentropy-lab:
      enabled: true
      config:
        mode: ENFORCE
        serviceUrl: http://127.0.0.1:3000/internal/openclaw/decision
        timeoutMs: 5000
        bypassMethods:
          - connect
          - ping
          - health.check
        healthPaths:
          - /health
          - /healthz
          - /ready
          - /readyz
        enforceFailClosed: false
        enableRollbackSwitch: false
        workflowEnabled: true
        orchestrationApiBaseUrl: http://127.0.0.1:3000/internal/openclaw/workflows
        workflowTimeoutMs: 5000
        autoDispatchSubagents: true
```

The vendored Negentropy backend still lives in `vendor/negentropy-lab`; the
sync/build workflow remains driven by `scripts/custom-stack.mjs`.

Workflow bridge notes:

- `workflowEnabled` defaults to on; set it to `false` to disable
  `/negentropy workflow ...`
- if `orchestrationApiBaseUrl` is omitted, the extension derives it from
  `serviceUrl` when possible, otherwise falls back to
  `http://127.0.0.1:3000/internal/openclaw/workflows`
- `autoDispatchSubagents` only controls whether workflow actions can spawn
  subagents automatically; it does not enable global autonomous orchestration,
  control-plane ownership, or `AuthorityState` write-back

## Dependency boundaries

This extension is allowed to depend on:

- local contract snapshots such as
  `extensions/negentropy-lab/src/decision-contract.snapshot.ts`
- the minimal vendor snapshot as canonical contract source
- host seam helpers exposed by OpenClaw plugin runtime APIs
- `sourceRoot`-backed live control-plane API routing for focused smoke and
  proof flows

This extension must not depend on:

- vendored runtime-owner API, service, runtime, observability, policy, or
  translator subtrees
- direct `smallpond-evo` client calls or capability-plane internals
- `AuthorityState`, `ResultEnvelope`, or write-back implementation ownership

`smallpond-evo` remains an external capability service consumed through
Negentropy. The extension must not speak to it directly.

## Post-R1 roadmap

`R1` is closed and removed from the active mainline with the fixed conclusion
`archive-first`, not `delete-now`.

The completed follow-on order is now:

1. `E2-A = smallpond read/artifact contract freeze`
2. `N6-A = contract family freeze`
3. `P-next-2 = host materialization + control-plane projection`
4. `P-next-3 = skill candidate + business absorb projection`
5. `P-next-4 = alignment discipline + write-back evidence closeout`
6. `P-next-5 = operator / rollout / diagnostics closeout`

`P-next-5`, `E3`, `U1`, and `E4` are closed. `E2` and `N6` are complete and
closed. The selected-owner decision closeout remains frozen as
`E3 = selected-owner rollout decision for memory-duckdb`:

1. `E3-A = selected-owner readiness audit`
2. `E3-B = controlled slot selection rehearsal`
3. `E3-C = final adoption decision`

`U1 = upstream compatibility hardening` is also complete and closed. It
hardened the rebased `origin/main` compatibility round without reopening `N6`,
changing bridge ownership, or widening the local consumer seam.

`E4 = operator-controlled selected-owner opt-in` is now complete and closed as
host-only adoption work on the `memory-duckdb` side. It records controlled
selected-owner rehearsal and rollback evidence without reopening `N6`,
changing bridge ownership, or widening the local consumer seam.

For this extension, `E3` is host-only and closed. `N6` stays closed and
mirror-only here before, during, and after `U1` and `E4`.
The extension remains mirror-only and bridge-only. Upstream Negentropy remains
the control-plane truth for gates, proof, diagnostics, and write-back
semantics. `extensions/negentropy-lab` only refreshes read-only consumer
anchors if snapshot versions or anchor tokens change.

There is no required next implementation lane on the current integration track
after `E4`.

Remaining optional follow-ups stay inactive and host-facing only:

- independent gateway alias drift investigation
- live `check:gateway:writeback:proof` enhancement

These optional follow-ups do not reopen `N6`.

See `custom/post-r1-active-roadmap.md` for the frozen cross-package order and
phase rules.

## Contract source and sync

This extension consumes a local decision contract snapshot:

- `extensions/negentropy-lab/src/decision-contract.snapshot.ts`

The snapshot is generated from vendor canonical source:

- `vendor/negentropy-lab/server/gateway/openclaw-decision/contracts/decision-contract.ts`

The workflow bridge talks to the control-plane workflow API surface selected by
`serviceUrl`, `orchestrationApiBaseUrl`, and `sourceRoot`. Vendored runtime API
implementation files are not part of the minimal vendor snapshot.

Sync command:

```bash
node extensions/negentropy-lab/scripts/sync-decision-contract-snapshot.mjs
```

Repo-local sourceRoot resolution still comes from
`custom/stack.local.json -> negentropy.sourceRoot` when a workstation provides
an external Negentropy checkout.

## Contract Consumer Packaging

The consumer baseline for this extension lives in:

- `custom/negentropy-baselines.json`

This contract consumer model freezes seven read-only inputs:

- decision contract snapshot
- workflow contract snapshot
- host diagnostics surface
- host memory summary contract snapshot
- business artifact absorb contract snapshot
- skill candidate absorb contract snapshot
- memory-business projection contract snapshot

Runtime packaging uses read-only snapshot or fixture inputs by default.
vendor runtime-owner implementation files are not part of the consumer model.

Consumer routes and version anchors:

- decision contract snapshot version:
  `extensions/negentropy-lab/src/decision-contract.snapshot.ts`
  via `DECISION_CONTRACT_VERSION = '1.0.0'`
- workflow contract snapshot version:
  `vendor/negentropy-lab/server/gateway/openclaw-orchestration/contracts/workflow-contract.ts`
  via `@version 1.0.0`, consumed locally through
  `extensions/negentropy-lab/src/workflow-types.ts`
- host diagnostics surface version:
  `custom/negentropy-baselines.json`
  via the consolidated `diagnostics` section
- host memory summary contract snapshot version:
  `extensions/negentropy-lab/src/memory-business-contracts.snapshot.ts`
  via `HOST_MEMORY_SUMMARY_CONTRACT_SNAPSHOT_VERSION = '2026-03-19-n6a1'`
- business artifact absorb contract snapshot version:
  `extensions/negentropy-lab/src/memory-business-contracts.snapshot.ts`
  via `BUSINESS_ARTIFACT_ABSORB_CONTRACT_SNAPSHOT_VERSION = '2026-03-20-n6c1'`
- skill candidate absorb contract snapshot version:
  `extensions/negentropy-lab/src/memory-business-contracts.snapshot.ts`
  via `SKILL_CANDIDATE_ABSORB_CONTRACT_SNAPSHOT_VERSION = '2026-03-20-n6c1'`
- memory-business projection contract snapshot version:
  `extensions/negentropy-lab/src/memory-business-contracts.snapshot.ts`
  via `MEMORY_BUSINESS_PROJECTION_CONTRACT_SNAPSHOT_VERSION = '2026-03-19-n6a1'`

This keeps the extension on packaged contracts and diagnostics rather than on
vendored runtime-owner API, service, runtime, observability, or policy trees.
`custom/negentropy-discipline.md` is the maintainer-facing narrative companion
for the same contract consumer model.

The current `N6-C` mirror keeps canonical host artifact types end-to-end for
business artifact absorb, and it keeps host-aligned `steps`, `priority`, and
`confidence` fields on the skill candidate absorb snapshot instead of falling
back to a coarse legacy `signals` shape.

The closed `P-next-4` D-only mirror keeps write-back ownership and
memory/business evidence-link discipline anchored in vendor contract truth. The
bridge stays read-only and consumes the frozen
`MEMORY_BUSINESS_EVIDENCE_LINK_REQUIRED_FIELDS` list from
`vendor/negentropy-lab/server/gateway/control-plane-contracts.ts` through the
local `extensions/negentropy-lab/src/memory-business-contracts.snapshot.ts`
anchor. Downstream sibling surfaces stay on approved summary fields only; they
do not expose raw `links` objects, raw runtime payloads, or write-back
implementation ownership.

With `P-next-5`, `E3`, and `U1` closed, this extension stays on the same
bridge-only role. No new `N6` runtime, absorb, projection, diagnostics, or
vendor expansion work opens in OpenClaw during this closeout.

The closed `N6-E` mirror already froze the upstream operator docs, focused
gates, and downstream proof for
`runtimeCapability.hostMemorySummary`, `runtimeCapability.businessArtifacts`,
`runtimeCapability.skillCandidates`, `runtimeCapability.projectionSurface.*`,
`runtimeCapability.statusCard.*`, and
`runtimeCapability.stableDiagnosticsSubset.*`.

Canonical vendor sources for the `N6-A` contract family:

- `vendor/negentropy-lab/server/gateway/contracts/host-memory-summary-contract.ts`
- `vendor/negentropy-lab/server/gateway/contracts/business-artifact-absorb-contract.ts`
- `vendor/negentropy-lab/server/gateway/contracts/skill-candidate-absorb-contract.ts`
- `vendor/negentropy-lab/server/gateway/contracts/memory-business-projection-contract.ts`
- `vendor/negentropy-lab/server/gateway/control-plane-contracts.ts`

These are mirrored as contract snapshots only. They do not turn the extension
into a write-back owner, a replacement or a control-brain expansion.

## Control commands

The extension registers `/negentropy` command handlers:

- `/negentropy status`
- `/negentropy mode <OFF|SHADOW|ENFORCE>`
- `/negentropy fail-closed <on|off>`
- `/negentropy rollback`
- `/negentropy workflow status [runId]`
- `/negentropy workflow list`
- `/negentropy workflow trace <runId> [limit]`
- `/negentropy workflow run <name>`
- `/negentropy workflow retry <runId>`
- `/negentropy workflow cancel <runId> [--emergency]`
- `/negentropy workflow emergency-stop <runId>`
- `/negentropy workflow stop <runId>`

Workflow recovery now runs automatically during service startup recovery and background sweeps; there is no manual reconcile command.

When `workflowEnabled=false`, workflow subcommands return a disabled-by-config
message instead of calling the workflow backend.

## Host-Facing Diagnostics

`/negentropy status` is a host-facing diagnostics surface only.

It reports:

- `upstreamReachable` for the external `sourceRoot`, decision API, and workflow
  API seam
- `extensionMode`
- `failOpenOrClosed` and rollback switch state
- `contractSnapshotVersion`
- `minimalVendorSnapshotVersion`
- `sourceRoot`, `vendorRoot`, and extension discipline status

It must not expose:

- `AuthorityState` internals
- raw capability emitter payload
- write-back object models
- smallpond capability internals

This keeps diagnostics useful for the OpenClaw host without turning the
extension into a control-plane summary owner.
