# Integration Env Precedence

Last updated: 2026-03-07

## 1. Precedence Rules

### 1.1 Launcher runtime config (Negentropy-Lab)

Priority (high -> low):

1. CLI args (`scripts/launcher-cli.ts`)
2. ENV (`config/launcher.config.ts`)
3. Config file (`--configFile`, if provided)
4. Preset (`dev`, `staging`, `production`, `minimal`)
5. Built-in defaults (`scripts/launcher.ts`)

### 1.2 OpenClaw decision bridge URL

Priority:

1. `NEGENTROPY_DECISION_URL` (process env)
2. Default `http://localhost:3000/internal/openclaw/decision`

Source: OpenClaw external repo `src/gateway/negentropy/decision-bridge.ts` (rooted at `OPENCLAW_PROJECT_PATH`)

### 1.3 UI decision API base URL (Web + Desk)

Priority:

1. Runtime injected global `__NEGENTROPY_DECISION_URL__`
2. Build/runtime env `VITE_NEGENTROPY_DECISION_URL`
3. Default `http://localhost:3000`

Sources:

- `OPENDOGE_UI_PATH/apps/control-ui-web/src/api/decisionApi.ts`
- `OPENDOGE_UI_PATH/apps/control-ui-desk/src/api/decisionApi.ts`

## 2. Canonical Env Keys

### 2.1 Launcher-facing

| Key | Purpose |
| --- | --- |
| `LAUNCHER_MODE` | `dev` / `staging` / `production` |
| `LAUNCHER_DECISION_MODE` | `OFF` / `SHADOW` / `ENFORCE` |
| `LAUNCHER_PORT` | legacy main port (maps to negentropy) |
| `LAUNCHER_NEGENTROPY_PORT` | explicit Negentropy port |
| `LAUNCHER_OPENCLAW_PORT` | explicit OpenClaw port |
| `LAUNCHER_OPENCLAW_PATH` | OpenClaw repo path |
| `OPENCLAW_PROJECT_PATH` | OpenClaw repo path (compat alias) |
| `OPENDOGE_UI_PATH` | opendoge-ui repo path |
| `LAUNCHER_PORT_SCAN_RANGE` | fallback scan range |
| `LAUNCHER_AUTO_RESOLVE_PORTS` | enable/disable auto fallback |

### 2.2 Decision bridge / UI-facing

| Key | Owner | Purpose |
| --- | --- | --- |
| `NEGENTROPY_DECISION_URL` | OpenClaw bridge | decision service URL |
| `VITE_NEGENTROPY_DECISION_URL` | UI (web/desk) | decision API base URL |
| `__NEGENTROPY_DECISION_URL__` | UI runtime global | runtime override |

### 2.3 Optional OpenDoge gateway-side upstream keys

| Key | Purpose |
| --- | --- |
| `OPENDOGE_NEGENTROPY_PROXY` | enable/disable proxy |
| `OPENDOGE_NEGENTROPY_WS_URL` | upstream WS URL |
| `OPENDOGE_NEGENTROPY_TOKEN` | upstream token |
| `OPENDOGE_NEGENTROPY_PASSWORD` | upstream password |

## 3. Baseline Recommendation

- Keep one deployment source of truth for env injection (launcher + CI).
- Do not set both `LAUNCHER_PORT` and `LAUNCHER_NEGENTROPY_PORT` with conflicting values.
- For production, always set `NEGENTROPY_DECISION_URL` explicitly when decision mode is not `OFF`.

## 4. Validation

```bash
npm run check:integration:config
```

Note:

- In Linux or other non-Windows environments, set `OPENCLAW_PROJECT_PATH` and `OPENDOGE_UI_PATH` explicitly before running the check.
- If these env vars are absent, the current checker falls back to historical Windows default paths and will report missing files.
