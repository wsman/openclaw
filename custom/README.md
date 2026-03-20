# Custom Stack Wiring

This folder keeps the repo-local Negentropy integration wiring while preserving
the closed OpenClaw architecture:

- `extensions/negentropy-lab` remains the only official runtime bridge
- `vendor/negentropy-lab` remains a minimal contract mirror
- `smallpond-evo` remains external to OpenClaw

## Tracked Files

The tracked governance surface is intentionally reduced to:

- `custom/README.md`
- `custom/negentropy-baselines.json`
- `custom/negentropy-discipline.md`
- `custom/post-r1-active-roadmap.md`

`custom/negentropy-baselines.json` contains five top-level sections:

- `seam`
- `bridge`
- `diagnostics`
- `extensionConsumer`
- `vendor`

`custom/negentropy-discipline.md` absorbs the old seam, bridge, diagnostics,
and vendor snapshot narrative guidance into one maintainer-facing note.

## Optional Local Config

`scripts/custom-stack.mjs` still supports an untracked local file at
`custom/stack.local.json` when a workstation needs a real external
`negentropy.sourceRoot` or `opendogeUi.root`.

Example local override:

```json
{
  "negentropy": {
    "sourceRoot": "../Negentropy-Lab",
    "vendorRoot": "vendor/negentropy-lab"
  },
  "opendogeUi": {
    "root": "../OpenDoge/opendoge-ui",
    "webAppDir": "apps/control-ui-web",
    "gatewayDir": "apps/gateway",
    "webBasePath": "/",
    "gatewayBaseUrl": "http://127.0.0.1:3000",
    "gatewayWsUrl": "ws://127.0.0.1:3000/ws"
  }
}
```

The example stays in this README so the tracked delta no longer needs a
separate checked-in example file.

## Commands

The operator-facing command names stay unchanged:

- `pnpm custom:stack:status`
- `pnpm custom:negentropy:check-seam`
- `pnpm custom:negentropy:check-bridge-seam`
- `pnpm custom:negentropy:check-diagnostics`
- `pnpm custom:negentropy:check-vendor-snapshot`
- `pnpm custom:negentropy:check-vendor-snapshot:manifest-only`
- `pnpm custom:negentropy:write-vendor-baseline`
- `pnpm custom:negentropy:sync`
- `pnpm custom:negentropy:sync:dry`
- `pnpm custom:opendoge-ui:build-web`
- `pnpm custom:openclaw:apply-ui-root`
- `pnpm custom:opendoge-ui:test:quick`
- `pnpm custom:opendoge-ui:test:full-live`

`pnpm custom:negentropy:write-vendor-baseline` now refreshes the
`vendor.inventoryRuntime` section inside `custom/negentropy-baselines.json`
instead of writing separate runtime-baseline files.

## Integration Discipline

Keep the integration split stable:

- `sourceRoot` remains the external Negentropy truth source
- `vendorRoot` remains a minimal vendor snapshot
- `extensions/negentropy-lab` remains bridge-only and consumer-only
- host-facing diagnostics stay on the OpenClaw side
- runtime packaging stays on read-only snapshot or fixture inputs

Use `custom/negentropy-discipline.md` for the narrative guardrails and
`custom/negentropy-baselines.json` for the machine-readable proof anchors.

## Current Status

`R1`, `E2`, `N6`, `E3`, `U1`, and `E4` are closed.
There is no required next implementation lane on the current integration track.

Remaining optional follow-ups stay inactive and separate from this minimal
delta:

- independent gateway alias drift investigation
- live `check:gateway:writeback:proof` enhancement
