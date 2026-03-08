# OpenClaw Decision Env Mapping

Last updated: 2026-03-07
Owner: Negentropy-Lab + OpenClaw

## 1. Scope

This document defines the canonical env mapping used by the OpenClaw decision bridge integration.

Source files:

- OpenClaw external repo `src/gateway/negentropy/decision-bridge.ts` (rooted at `OPENCLAW_PROJECT_PATH`)
- `scripts/launcher.ts`
- `config/launcher.config.ts`

## 2. OpenClaw-side Decision Keys

| Key | Required | Description | Default |
| --- | --- | --- | --- |
| `NEGENTROPY_DECISION_URL` | no | HTTP endpoint for decision service | `http://localhost:3000/internal/openclaw/decision` |
| `DECISION_MODE` | no | Runtime mode injected by launcher | `OFF` |
| `OPENCLAW_GATEWAY_PORT` | no | OpenClaw gateway bind port injected by launcher | `18789` |

## 3. OpenClaw Path and Launcher Keys

| Key | Required | Description | Notes |
| --- | --- | --- | --- |
| `LAUNCHER_OPENCLAW_PATH` | no | Explicit OpenClaw project path | Highest-priority path input in launcher config |
| `OPENCLAW_PROJECT_PATH` | no | Compatibility alias for OpenClaw path | Used as fallback |
| `LAUNCHER_OPENCLAW_PORT` | no | Requested OpenClaw port | Can be auto-resolved on conflict |

## 4. Launcher-to-OpenClaw Injection Rules

1. If decision mode is not `OFF` and `NEGENTROPY_DECISION_URL` is not explicitly set, launcher injects:
   - `http://127.0.0.1:<negentropyResolvedPort>/internal/openclaw/decision`
2. Launcher always injects:
   - `OPENCLAW_GATEWAY_PORT=<openclawResolvedPort>`
   - `DECISION_MODE=<OFF|SHADOW|ENFORCE>`
3. OpenClaw decision bridge reads `NEGENTROPY_DECISION_URL` first, then its hardcoded default.

## 5. Validation

Run:

```bash
npm run check:integration:config
```

Expected:

- `env.openclaw.NEGENTROPY_DECISION_URL` is `pass`
- launcher-openclaw path and port keys are present and consistent
- On Linux or custom layouts, export `OPENCLAW_PROJECT_PATH` and `OPENDOGE_UI_PATH` before running the check, otherwise the checker falls back to historical Windows defaults.
