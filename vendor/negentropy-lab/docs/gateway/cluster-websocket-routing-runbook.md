# Cluster WebSocket Routing Runbook

## Overview

`Negentropy-Lab` now supports LAN cluster WebSocket fanout with:

- cross-node event broadcast
- connection state synchronization
- ordered event delivery within a short reorder window
- burst batching to reduce backplane publish operations
- routing strategies for targeted delivery

Gateway WebSocket clients connect through:

```bash
ws://<host>:<port>/gateway
```

## Routing Strategies

Use `POST /api/cluster/websocket/broadcast` with optional `routing`:

### 1. Broadcast

```bash
curl -X POST http://127.0.0.1:3000/api/cluster/websocket/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "event": "system.notice",
    "payload": { "message": "fanout to all nodes" }
  }'
```

### 2. Capability Routing

Only nodes with matching capabilities deliver the event locally.

```bash
curl -X POST http://127.0.0.1:3000/api/cluster/websocket/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "event": "llm.notice",
    "payload": { "message": "only llm nodes receive this" },
    "routing": {
      "strategy": "capability",
      "requiredCapabilities": ["llm"]
    }
  }'
```

### 3. Least-Loaded Routing

Choose one active node with the lowest current cluster load.

```bash
curl -X POST http://127.0.0.1:3000/api/cluster/websocket/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "event": "worker.notice",
    "payload": { "message": "go to the least-loaded node" },
    "routing": {
      "strategy": "least-loaded"
    }
  }'
```

### 4. Sticky Hash Routing

Route same key to the same node whenever topology stays stable.

```bash
curl -X POST http://127.0.0.1:3000/api/cluster/websocket/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "event": "tenant.notice",
    "payload": { "tenantId": "tenant-42" },
    "routing": {
      "strategy": "sticky-hash",
      "hashKey": "tenant-42"
    }
  }'
```

## Validation

### Stats

```bash
curl http://127.0.0.1:3000/api/cluster/websocket/stats
```

Important fields:

- `eventsBroadcasted`
- `eventsDelivered`
- `eventsOrdered`
- `publishOperations`
- `targetedEvents`
- `loadBalancedEvents`
- `routingByStrategy`

### Global Connection View

```bash
curl http://127.0.0.1:3000/api/cluster/websocket/connections
```

## Regression Commands

```bash
npx tsc -p tsconfig.json --noEmit
npx vitest run server/cluster/websocket/WebSocketClusterBroadcaster.test.ts
npx vitest run server/cluster/__tests__/cluster-websocket-e2e.test.ts
npm run test:cluster
npm run test:cluster:e2e
npm run build
```
