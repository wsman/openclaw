# Negentropy-Lab

Gateway backend for the Negentropy-Lab system (API-only).

## Frontend Migration Notice

- Frontend has been fully migrated to the external `opendoge-ui` repository
- This repository no longer keeps frontend source/build assets.
- UI apps to use:
  - `opendoge-ui/apps/control-ui-web`
  - `opendoge-ui/apps/control-ui-desk`
  - `opendoge-ui/apps/gateway`

## Gateway Replacement Status Audit

This README now folds in the repository audit that was previously tracked in
`vendor/negentropy-lab/COLYSEUS_GATEWAY_REPLACEMENT_PROGRESS.md`.

Audit date: `2026-03-08`

### Verified in this repository snapshot

- OpenClaw baseline observed by the audit: `2026.3.8`
- Gateway protocol surface observed by the audit: `95` methods and `19` events
- Negentropy vendor baseline observed by the audit: `v7.6.0`
- Decision modes wired for the integration: `OFF`, `SHADOW`, `ENFORCE`
- The three-layer integration model is present and reviewable:
  - maintenance workflow in `skills/negentropy-maintainer/`
  - OpenClaw runtime bridge in `extensions/negentropy-lab/`
  - vendored backend in `vendor/negentropy-lab/`
- The `gateway_request` hook is wired into the host gateway path

### Key integration entrypoints

- Extension entry: `extensions/negentropy-lab/index.ts`
- Decision bridge: `extensions/negentropy-lab/src/decision-bridge.ts`
- Gateway request handler: `extensions/negentropy-lab/src/gateway-request.ts`
- Plugin config schema: `extensions/negentropy-lab/openclaw.plugin.json`
- Host-side policy hook: `src/gateway/plugin-request-policy.ts`
- HTTP decision entrypoints:
  - `src/gateway/openai-http.ts`
  - `src/gateway/openresponses-http.ts`
  - `src/gateway/tools-invoke-http.ts`

### Current status

The code wiring is present and auditable, but this repository snapshot alone is
not enough to claim production cutover readiness.

What the audit can support:

- integration architecture review
- plugin and host wiring review
- protocol surface verification
- maintenance workflow review

What still needs external execution evidence:

- archived E2E integration results
- performance baseline reports
- grayscale rollout reports
- production environment readiness reports
- deployment and rollback verification records

The audit specifically noted that multiple expected files under `reports/` were
not present in the repository snapshot on `2026-03-08`, including decision
bridge integration reports, OpenClaw HTTP acceptance reports, E2E reports, and
later phase 15 readiness artifacts.

### Phase 11-15 audit summary

- Phase 11: gate scripts exist, but no archived execution result was found
- Phase 12: contract verification scripts exist, but no archived acceptance
  result was found
- Phase 13: integration scripts exist, but no archived coordination result was
  found
- Phase 14: E2E and performance scripts exist, but no archived reports were
  found
- Phase 15: grayscale and operations scripts exist, but no archived reports
  were found

### Maintenance workflow

For OpenClaw-side maintenance:

```bash
node scripts/custom-stack.mjs status
node scripts/custom-stack.mjs sync-negentropy --dry-run
node scripts/custom-stack.mjs sync-negentropy
```

For vendor-side validation:

```bash
pnpm --dir vendor/negentropy-lab test
pnpm --dir vendor/negentropy-lab phase14:e2e
pnpm --dir vendor/negentropy-lab phase14:perf
pnpm --dir vendor/negentropy-lab phase15:grayscale
pnpm --dir vendor/negentropy-lab ops:preflight
pnpm --dir vendor/negentropy-lab ops:rollback:verify
```

### Audit verdict

- Suitable as an integration design and wiring reference
- Not sufficient as standalone proof of production cutover
- Production-readiness claims should be backed by archived reports generated in
  the target environment

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

## Phase 14 Validation

```bash
# Cross-repo config consistency (Negentropy-Lab/OpenClaw/opendoge-ui)
npm run check:integration:config

# E2E integration gates (OFF/SHADOW/ENFORCE + HTTP/WS)
npm run phase14:e2e

# Performance baseline (latency/WS success/QPS)
npm run phase14:perf
```

## Build

```bash
npm run build
```

## Production

```bash
npm start
```

## API Endpoints

- `GET /health` - Health check
- `GET /api/status` - Server status
- `GET /api/agents` - List agents
- `GET /api/tasks` - List tasks
- `GET /api/metrics` - System metrics
- `GET /api/config` - Configuration
- `GET /api/alerts` - Alerts
- `GET /api/constitution/compliance` - Constitution compliance

## WebSocket

Connect to `ws://localhost:3000/ws`

### Message Types

- `subscribe` - Subscribe to topics
- `unsubscribe` - Unsubscribe from topics
- `ping` - Heartbeat
