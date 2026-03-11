# Authority MCP Transport Plan

## Module Boundary Reference

Use [module-map.md](./module-map.md) as the current reference for `integration` and `authority` ownership while extending executable MCP transport.

## Goal

Upgrade the authority tool plane from metadata-only MCP registration to a real executable MCP transport path backed by the existing `engine/mcp_core` assets.

## Scope

This phase focuses on the first production-capable MCP transport slice:

- discover a local MCP Core service from authoritative configuration and local repo assets
- synchronize discovered tools into the authority registry
- route authority-approved tool calls into the real MCP Core runtime
- capture health and latency snapshots for the MCP service
- preserve fallback compatibility with the existing in-process mock registrations

Excluded for this slice:

- distributed MCP service discovery across multiple hosts
- persistent long-lived stdio multiplexing
- multi-provider load balancing
- remote network failover between authority leaders

## Constitutional Mapping

- `§101`: MCP service metadata and discovered tool metadata remain projected into `AuthorityState.tools.*`
- `§102`: extend the existing authority tool bridge instead of introducing a parallel tool runtime
- `§103`: land this design gate before implementation
- `§108.1`: authority-routed MCP tool calls stay bound to explicit authority sessions and model metadata
- `§130`: department filtering remains enforced before any MCP transport invocation
- `§131`: department-specific tool restrictions remain authoritative, not delegated to the MCP worker
- `§151`: discovery, health checks, sync runs, and tool calls remain auditable
- `§306`: transport failure must degrade cleanly and preserve rollback to existing mock handlers
- `§320`: implementation continues under the Claude Code workflow

## Design

### 1. Transport Shape

Introduce `AuthorityMcpTransportService` as the only MCP transport adapter owned by the authority runtime.

Initial transport mode:

- `stdio-subprocess`
- command-driven bridge script
- JSON request/response over stdin/stdout

The adapter treats `engine/mcp_core` as the real MCP asset source and executes discovery/call operations through a dedicated Python bridge script.

### 2. Service Discovery

Discovery resolves services from:

1. authoritative config file: `storage/config/authority-mcp-services.json`
2. built-in local fallback: detect `engine/mcp_core/server.py` and register `local-mcp-core`

Each service snapshot includes:

- `serviceId`
- `provider`
- `transport`
- `command`
- `args`
- `enabled`
- `source`
- `toolCount`
- `healthy`
- `lastCheckedAt`
- `lastLatencyMs`
- `lastError`

Service snapshots are serialized into `AuthorityState.tools.metadata` under reserved keys so the authority state remains the single truth source.

### 3. Tool Synchronization

For every discovered MCP tool:

1. normalize metadata from the bridge response
2. derive `protocol = mcp`
3. stamp transport metadata:
   - `transport = stdio-subprocess`
   - `serviceId`
   - `origin = engine/mcp_core`
4. register the tool through `AuthorityToolCallBridge.registerToolDefinition(...)`
5. install a real handler that delegates back into `AuthorityMcpTransportService.invokeTool(...)`

Existing mock/in-process tools remain valid. If a synced MCP tool conflicts with an existing name, the authority registry keeps the latest authoritative registration while preserving audit history.

### 4. Invocation Path

The execution path remains:

1. authority session validation
2. department/capability policy validation
3. quota validation
4. transport invocation
5. audit and usage updates

The new transport step converts:

- authority call context → JSON bridge request
- bridge response → authority tool result

Transport failures return normalized authority errors and never bypass policy enforcement.

### 5. Health Monitoring

The transport service exposes:

- service inventory snapshot
- on-demand discovery sync
- on-demand health check

Health is derived from bridge command success, latency, and last error. These snapshots are queryable from the authority HTTP control plane and feed monitoring/ops views as read-only derived state.

### 6. Control Plane

Add:

- `GET /api/authority/tools/mcp/services`
- `POST /api/authority/tools/mcp/discover`
- `POST /api/authority/tools/mcp/services/:serviceId/health-check`

The existing endpoints continue to serve the authoritative tool plane:

- `GET /api/authority/tools`
- `GET /api/authority/tools/discovery`
- `GET /api/authority/tools/:toolName/metadata`
- `POST /api/authority/tools/call`

## Acceptance Criteria

### Functional

- authority can auto-register a built-in local MCP Core service when repo assets exist
- discovery sync registers real MCP Core tools into the authority registry
- authority tool calls route through the subprocess bridge and return real results
- service health snapshots are queryable and auditable
- transport failure leaves existing mock tooling available as rollback path

### Verification

1. `npm run build:server`
2. targeted MCP transport service tests
3. authority end-to-end acceptance for MCP service discovery and routed call
4. `npm run test:authority`
5. `npm run test:authority:coverage`
6. `npm run build`
7. `python scripts/measure_entropy.py --url <authority-state>`
