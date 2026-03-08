# UI Decision State Dictionary

Last updated: 2026-03-07
Owner: Negentropy-Lab + opendoge-ui

## 1. Scope

This document defines the canonical UI state dictionary for decision control across Web and Desk.

Primary sources:

- `OPENDOGE_UI_PATH/apps/control-ui-web/src/api/decisionApi.ts`
- `OPENDOGE_UI_PATH/apps/control-ui-desk/src/api/decisionApi.ts`
- Legacy `control-ui/src/types/protocol.ts` is retired and should not be treated as the canonical mirror.

Contract source:

- `server/gateway/openclaw-decision/contracts/decision-contract.ts`

## 2. Canonical Enums

### 2.1 Decision Mode

| Type | Values |
| --- | --- |
| `DecisionMode` | `OFF`, `SHADOW`, `ENFORCE` |

### 2.2 Decision Action

| Type | Values |
| --- | --- |
| `DecisionAction` | `EXECUTE`, `REWRITE`, `REJECT` |

### 2.3 Circuit Breaker State

| Type | Values |
| --- | --- |
| `CircuitBreakerState` | `CLOSED`, `OPEN`, `HALF_OPEN` |

## 3. Decision Service State Model

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `mode` | `DecisionMode` | yes | Current runtime mode |
| `enabled` | `boolean` | yes | Control plane enabled flag |
| `uptime` | `number` | yes | Service uptime |
| `requestCount` | `number` | yes | Total decision requests |
| `executeCount` | `number` | yes | `EXECUTE` count |
| `rewriteCount` | `number` | yes | `REWRITE` count |
| `rejectCount` | `number` | yes | `REJECT` count |
| `errorCount` | `number` | yes | Decision errors |
| `avgLatencyMs` | `number` | yes | Average latency |
| `lastModeChange` | `string` | yes | ISO timestamp |
| `circuitBreakerStatus` | `CircuitBreakerStatus` | yes | Breaker details |

## 4. UI RPC and Event Keys

### RPC Keys

- `decision.getStatus`
- `decision.setMode`
- `decision.getStats`
- `decision.getHealth`
- `decision.getConfig`
- `decision.setConfig`
- `decision.getAuditLogs`
- `decision.resetCircuitBreaker`

### Event Keys

- `decision.modeChanged`
- `decision.circuitBreakerStateChanged`
- `decision.requestProcessed`
- `decision.errorOccurred`

## 5. Drift Guard

Run:

```bash
npm run check:integration:config
```

Expected:

- mode and action enum set checks are `pass`
- UI protocol and decision contract remain aligned
- If the UI repo is outside the historical Windows default path, export `OPENDOGE_UI_PATH` first.
