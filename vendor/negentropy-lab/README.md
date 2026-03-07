# Negentropy-Lab

Gateway backend for the Negentropy-Lab system (API-only).

## Frontend Migration Notice

- Frontend has been fully migrated to: `/home/wsman/OpenDoge/opendoge-ui`
- This repository no longer keeps frontend source/build assets.
- UI apps to use:
  - `opendoge-ui/apps/control-ui-web`
  - `opendoge-ui/apps/control-ui-desk`
  - `opendoge-ui/apps/gateway`

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
