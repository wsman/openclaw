# Negentropy-Lab

Gateway backend for the Negentropy-Lab system (API-only), now upgraded with LAN cluster networking.

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

## Cluster Development

```bash
npm run dev
```

Legacy single-process entry remains available via:

```bash
npm run dev:legacy
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

## LAN Cluster

Each server node can now self-organize inside a LAN through:

- mDNS service discovery
- optional seed peer bootstrap
- internal cluster join/heartbeat APIs
- shared coordination through memory or Redis backplane
- distributed task routing with task leases and failover

### Recommended environment variables

```bash
NODE_ID=gateway-a
NODE_NAME=gateway-a
CLUSTER_ID=negentropy-lan
LAN_IP=192.168.1.10
PORT=4514
CLUSTER_TOKEN=change-me
REDIS_URL=redis://192.168.1.20:6379
```

If `REDIS_URL` is omitted, the cluster still forms through LAN discovery and peer join, but coordination is best-effort in memory.

### Multi-node startup example

Node A:

```bash
NODE_ID=gateway-a NODE_NAME=gateway-a LAN_IP=192.168.1.10 PORT=4514 npm run dev
```

Node B:

```bash
NODE_ID=gateway-b NODE_NAME=gateway-b LAN_IP=192.168.1.11 PORT=4515 npm run dev
```

If multicast is restricted, you can also provide seed peers through the cluster bootstrap options used by the server factory.

WebSocket cluster routing and acceptance details are documented in:

- `docs/gateway/cluster-websocket-routing-runbook.md`

## API Endpoints

- `GET /health` - Health check
- `GET /api/status` - Server status
- `GET /api/agents` - List agents
- `GET /api/tasks` - List tasks
- `GET /api/metrics` - System metrics
- `GET /api/config` - Configuration
- `GET /api/alerts` - Alerts
- `GET /api/constitution/compliance` - Constitution compliance
- `GET /api/cluster/topology` - Cluster topology snapshot
- `GET /api/cluster/nodes` - Current cluster nodes
- `POST /api/cluster/tasks/dispatch` - Dispatch a distributed task
- `GET /api/cluster/leases/:taskId` - Query task lease state

## Internal Cluster Endpoints

- `POST /internal/cluster/join` - Peer handshake
- `POST /internal/cluster/heartbeat` - Peer heartbeat update
- `GET /internal/cluster/topology` - Internal topology snapshot
- `POST /internal/cluster/tasks/execute` - Execute a forwarded task

## WebSocket

Connect to `ws://localhost:3000/gateway`

### Message Types

- `subscribe` - Subscribe to topics
- `unsubscribe` - Unsubscribe from topics
- `ping` - Heartbeat
