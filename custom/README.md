# Custom Stack Wiring

This folder keeps local integration wiring for a custom OpenClaw stack while preserving the upstream repository layout.

## Goals

- Keep OpenClaw as the upstream-friendly backend root.
- Mirror Negentropy-Lab under `vendor/negentropy-lab` instead of flattening it into core folders.
- Keep `opendoge-ui` in its own repository and reference it through a local config file.

## Files

- `stack.example.json`: generic template checked into the repository.
- `stack.local.json`: local machine override, ignored by git.

## Commands

- `pnpm custom:stack:status`
- `pnpm custom:negentropy:sync`
- `pnpm custom:negentropy:sync:dry`
- `pnpm custom:opendoge-ui:build-web`
- `pnpm custom:openclaw:apply-ui-root`
- `pnpm custom:opendoge-ui:test:quick`
- `pnpm custom:opendoge-ui:test:full-live`

## Source root prerequisites

Negentropy sync requires a real external Negentropy-Lab checkout.

- Configure `custom/stack.local.json -> negentropy.sourceRoot`.
- `pnpm custom:stack:status` reports `negentropy.sourceStatus` and `negentropy.sourceHint`.
- `pnpm custom:negentropy:sync:dry` prints `status: "source-missing"` instead of failing hard when source is absent.

## Recommended layout

- Keep OpenClaw core changes minimal and isolated.
- Vendor Negentropy-Lab into `vendor/negentropy-lab`.
- Keep runtime decision wiring inside `extensions/negentropy-lab` and configure it via
  `plugins.entries.negentropy-lab.config`.
- Keep UI source of truth in the external `opendoge-ui` repo.
- Point `gateway.controlUi.root` at the built `opendoge-ui` web output when you want OpenClaw to serve the unified UI.
- Use `pnpm custom:openclaw:apply-ui-root` to back up and update the local `~/.openclaw/openclaw.json`.
