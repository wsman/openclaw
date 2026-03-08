# OpenClaw-Negentropy Contract Dictionary

Last updated: 2026-03-07
Owners: Negentropy-Lab + OpenClaw + opendoge-ui

## 1. Single Source of Truth

- Canonical contract file: `server/gateway/openclaw-decision/contracts/decision-contract.ts`
- Bridge implementation: OpenClaw external repo `src/gateway/negentropy/decision-bridge.ts` (rooted at `OPENCLAW_PROJECT_PATH`)
- UI protocol mirrors:
  - `apps/control-ui-web/src/api/decisionApi.ts` (rooted at `OPENDOGE_UI_PATH`)
  - `apps/control-ui-desk/src/api/decisionApi.ts` (rooted at `OPENDOGE_UI_PATH`)
- Legacy note: retired `control-ui/src/types/protocol.ts` is no longer authoritative.

## 2. Decision Enums

| Domain | Values | Source |
| --- | --- | --- |
| `DecisionMode` | `OFF`, `SHADOW`, `ENFORCE` | Negentropy contract + OpenClaw bridge + UI protocol |
| `DecisionAction` | `EXECUTE`, `REWRITE`, `REJECT` | Negentropy contract + OpenClaw bridge + UI protocol |
| `TransportType` | `ws`, `http` | Negentropy contract |

## 3. Core Request/Response Fields

### Request (`DecisionRequest`)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `traceId` | `string` | yes | end-to-end trace key |
| `transport` | `ws \| http` | yes | gateway transport |
| `method` | `string` | yes | gateway method id |
| `params` | `Record<string, unknown>` | yes | request params |
| `ts` | `string` (ISO) | yes | request timestamp |
| `connId` | `string` | no | websocket connection id |
| `authMeta` / `auth` | object | no | auth metadata |
| `scopes` | `string[]` | no | permission scopes |

### Response (`DecisionResponse`)

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `action` | `DecisionAction` | yes | execute/rewrite/reject |
| `traceId` | `string` | yes | mirrors request trace |
| `ts` | `string` (ISO) | yes | decision timestamp |
| `method` / `rewrittenMethod` | `string` | rewrite only | must remain same ingress method for HTTP bridges |
| `params` / `rewrittenParams` | `Record<string, unknown>` | rewrite only | rewritten payload |
| `reason` | `string` | optional | human-readable reason |
| `errorCode` | `string` | reject only | canonical error code |
| `policyTags` | object/string[] | optional | policy hit metadata |

## 4. HTTP Ingress Decision Method IDs

| Ingress | Method ID | File |
| --- | --- | --- |
| OpenAI Chat Completions | `http.openai.chat.completions` | `OPENCLAW_PROJECT_PATH/src/gateway/openai-http.ts` |
| OpenResponses Create | `http.openresponses.create` | `OPENCLAW_PROJECT_PATH/src/gateway/openresponses-http.ts` |
| Tools Invoke | `http.tools.invoke` | `OPENCLAW_PROJECT_PATH/src/gateway/tools-invoke-http.ts` |

## 5. Canonical Decision Error Codes

`POLICY_DENY`, `POLICY_TIMEOUT`, `POLICY_RATE_LIMITED`, `AUTH_REQUIRED`, `AUTH_INVALID`, `AUTH_EXPIRED`, `AUTH_INSUFFICIENT_SCOPE`, `METHOD_UNKNOWN`, `METHOD_DISABLED`, `METHOD_RESTRICTED`, `PARAM_INVALID`, `PARAM_MISSING`, `INVALID_PARAMS`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`, `REQUEST_TIMEOUT`.

## 6. UI RPC/Event Dictionary

### RPC Methods

- `decision.getStatus`
- `decision.setMode`
- `decision.getStats`
- `decision.getHealth`
- `decision.getConfig`
- `decision.setConfig`
- `decision.getAuditLogs`
- `decision.resetCircuitBreaker`

### Events

- `decision.modeChanged`
- `decision.circuitBreakerStateChanged`
- `decision.requestProcessed`
- `decision.errorOccurred`

## 7. Drift Guard

Run:

```bash
npm run check:integration:config
```

The script writes a machine report to `reports/*_integration-config-check.json` and exits non-zero on contract drift.
Outside the historical Windows environment, export `OPENCLAW_PROJECT_PATH` and `OPENDOGE_UI_PATH` first so the checker can locate the external repos.
