# Browser RPC Contract (P3)

Version: `2026-03-01`  
Source of truth:
- `server/gateway/browser/contracts.ts`
- `server/gateway/websocket-handler.ts`

## Methods

### `browser.navigate`
- Params:
  - `url` (required, http/https)
  - `sessionId` (optional)
  - `timeoutMs` (optional, `1..60000`)
  - `simulateDelayMs` (optional, `0..60000`)
- Returns:
  - `ok`, `action`, `sessionId`, `url`, `title`, `status`, `timingMs`, `engine`, `timestamp`

### `browser.click`
- Params:
  - `sessionId` (required)
  - `selector` (required)
  - `button` (optional, `left|right|middle`, default `left`)
  - `clickCount` (optional, `1..3`, default `1`)
  - `timeoutMs` (optional, `1..60000`)
  - `simulateDelayMs` (optional, `0..60000`)
- Returns:
  - `ok`, `action`, `sessionId`, `selector`, `button`, `clickCount`, `totalClicks`, `engine`, `timestamp`

### `browser.type`
- Params:
  - `sessionId` (required)
  - `selector` (required)
  - `text` (required when `clear=false`, max `10000`)
  - `clear` (optional, default `false`)
  - `timeoutMs` (optional, `1..60000`)
  - `simulateDelayMs` (optional, `0..60000`)
- Returns:
  - `ok`, `action`, `sessionId`, `selector`, `clear`, `textLength`, `valueLength`, `preview`, `engine`, `timestamp`

### `browser.screenshot`
- Params:
  - `sessionId` (required)
  - `format` (optional, `png|jpeg|webp`, default `png`)
  - `fullPage` (optional, default `false`)
  - `quality` (optional, `0..100`, only for `jpeg|webp`)
  - `timeoutMs` (optional, `1..60000`)
  - `simulateDelayMs` (optional, `0..60000`)
- Returns:
  - `ok`, `action`, `sessionId`, `format`, `fullPage`, `quality`, `mimeType`, `data`, `bytes`, `engine`, `timestamp`

### `browser.request` (compat)
- Params:
  - `action` or `op`: `navigate|click|type|screenshot`
  - plus forwarded method params
- Returns:
  - when accepted: `accepted=true`, `action`, `method`, `result`, `timestamp`
  - when unsupported: `accepted=false`, `action`, `supportedActions`, `request`, `timestamp`

## Error Mapping

- `-32602`: parameter/schema validation error
- `-32008`: timeout
- `-32040`: browser session not found
- `-32042`: selector not found
- `-32060`: browser engine unavailable
- `-32050`: generic browser execution failure

## Runtime Notes

- Engine selection:
  - `browserEngine=playwright`: force Playwright
  - `browserEngine=auto`: prefer Playwright, fallback to mock if runtime is unavailable
  - `browserEngine=mock`: force mock engine
- Lifecycle:
  - sessions are released on connection close/error and server shutdown
  - max session count is bounded by `browserMaxSessions`
  - session TTL is controlled by `browserSessionTtlMs`

