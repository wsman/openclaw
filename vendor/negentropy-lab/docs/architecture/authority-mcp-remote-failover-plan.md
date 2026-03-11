# Authority MCP Remote Service And Failover Plan

## Module Boundary Reference

Use [module-map.md](./module-map.md) as the current reference for `integration` and `authority` ownership so remote services do not bypass the authority mutation path.

## Goal

Extend the authority MCP transport so remote MCP services can register as authoritative execution backends, participate in tool discovery, and provide healthy failover targets without introducing a parallel tool runtime.

## Scope

This slice focuses on the first remote-capable authority transport increment:

- authoritative registration for remote MCP services
- HTTP-based MCP bridge transport for remote services
- tool-to-service multi-binding inside the authority registry
- health-aware service selection and failover
- audit coverage for registration, routing, and failover

Excluded for this slice:

- websocket and gRPC remote transports
- distributed service discovery outside the authority config file
- cross-region replication of MCP traffic
- weighted caching or speculative prewarm

## Constitutional Mapping

- `§101`: remote service metadata and tool-to-service bindings remain stored under authority state
- `§102`: extend `AuthorityMcpTransportService` rather than creating a parallel remote routing subsystem
- `§103`: design lands before implementation
- `§130`: department and capability checks remain authoritative and execute before remote routing
- `§131`: service selection cannot bypass tool policy or department boundaries
- `§151`: registration, discovery, health checks, route selection, and failover remain auditable
- `§306`: transport failure must degrade cleanly and fail over without stopping the authority server
- `§320`: implementation remains inside the Claude Code workflow

## Design

### 1. Remote Service Registration

Extend `AuthorityMcpServiceConfig` to support:

- `transport = stdio-subprocess | http`
- `endpoint`
- `auth.type = none | bearer | api-key`
- `auth.token`
- `auth.headerName`
- `priority`
- `failureThreshold`
- `recoveryIntervalMs`

Remote services are written into `storage/config/authority-mcp-services.json` and mirrored into authority metadata snapshots.

### 2. HTTP Transport

Introduce `HttpMcpCommandRunner` with a simple JSON contract:

- `POST <endpoint>/discover`
- `POST <endpoint>/health`
- `POST <endpoint>/call`

The request body remains the same authority bridge payload used by the subprocess runner.

### 3. Tool Multi-Binding

When the same tool is discovered from multiple services, the authority tool definition keeps a merged binding list in metadata:

- `mcpServiceBindings[]`
- `serviceId`
- `transport`
- `priority`
- `endpoint`

Authority tool policy remains tool-level. Service bindings are execution backends, not parallel policy owners.

### 4. Load Balancing And Failover

Tool execution resolves candidate services from the authoritative tool metadata, then sorts them by:

1. enabled state
2. healthy state
3. configured priority
4. lower latency
5. lower failure count

Execution tries the best candidate first and automatically fails over to the next candidate when the current backend errors.

### 5. Service Runtime Snapshots

Extend `AuthorityMcpServiceSnapshot` with:

- `endpoint`
- `priority`
- `requestCount`
- `successCount`
- `failureCount`
- `lastUsedAt`

These values remain read-only derived authority state and feed monitoring and ops projections.

### 6. Control Plane

Add:

- `POST /api/authority/tools/mcp/services/register`

Reuse:

- `GET /api/authority/tools/mcp/services`
- `POST /api/authority/tools/mcp/discover`
- `POST /api/authority/tools/mcp/services/:serviceId/health-check`

## Acceptance Criteria

### Functional

- remote HTTP MCP services can register into the authority config and snapshot plane
- discovered tools can bind to more than one MCP service
- route selection prefers healthy higher-priority services
- failed primary backends automatically fall through to a healthy backup backend
- registration and failover are visible in authority audit history

### Verification

1. `npm run build:server`
2. targeted remote registration and failover tests
3. `npm run test:authority`
4. `npm run test:authority:coverage`
5. `npm run build`
6. `python scripts/measure_entropy.py --url <authority-state>`
