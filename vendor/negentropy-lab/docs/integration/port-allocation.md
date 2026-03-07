# Integration Port Allocation

Last updated: 2026-03-03

## 1. Default Port Baseline

| Service | Default Port | Source |
| --- | --- | --- |
| Negentropy-Lab gateway/decision service | `3000` | `scripts/launcher.ts`, `config/launcher.config.ts` |
| OpenClaw gateway | `18789` | `scripts/launcher.ts`, `config/launcher.config.ts` |

## 2. Allocation Strategy

The launcher resolves ports in this order:

1. Read requested ports from merged config.
2. Check availability for each service.
3. If occupied and `autoResolvePorts=true`, scan forward with `+1 ... +portScanRange`.
4. Persist resolved ports to runtime state (`storage/runtime/launcher-state.json`).

Defaults:

- `autoResolvePorts=true`
- `portScanRange=50`

## 3. Conflict Rules

- `negentropy.port` and `openclaw.port` must not resolve to the same value.
- If any requested port cannot be allocated in scan range, preflight fails.
- When decision mode is not `OFF`, launcher injects runtime `NEGENTROPY_DECISION_URL` for OpenClaw if not explicitly provided.

## 4. Recommended Envs

| Key | Example |
| --- | --- |
| `LAUNCHER_NEGENTROPY_PORT` | `3000` |
| `LAUNCHER_OPENCLAW_PORT` | `18789` |
| `LAUNCHER_PORT_SCAN_RANGE` | `50` |
| `LAUNCHER_AUTO_RESOLVE_PORTS` | `true` |

## 5. Quick Checks

```bash
npm run launch -- preflight
npx tsx scripts/check-integration-config.ts
```

Expected baseline output:

- negentropy: `3000`
- openclaw: `18789`
- no port collision
