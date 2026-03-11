# Authority MCP Tool Plane Plan

## Module Boundary Reference

Use [module-map.md](./module-map.md) as the current reference for `integration`, `authority`, and persona-facing tool access boundaries.

## Goal

Extend the Authority Core so MCP tools become first-class authoritative resources with discoverable metadata, department-aware access policy, auditable invocation chains, and quota governance.

## Scope

This phase focuses on Option B: MCP tool authoritative registration.

Included:

- authoritative MCP tool metadata registration
- department and capability based access policy
- discovery and metadata query APIs
- quota visibility and usage accounting
- invocation audit chain enrichment for MCP tools

Excluded:

- remote MCP transport implementation changes
- distributed tool scheduling across multiple authority leaders
- replacing the existing tool bridge lifecycle contract

## Constitutional Mapping

- `§101`: tool metadata and policy live under authority state as the single truth source
- `§102`: extend the existing `AuthorityToolCallBridge` and tool state instead of adding parallel registries
- `§103`: design gate lands before implementation
- `§130`: department boundary rules are enforced before tool execution
- `§131`: department specific tool restrictions are expressed through authoritative access policy
- `§151`: registration, discovery, invocation, and quota consumption remain auditable
- `§320`: implementation continues under Claude Code workflow with explicit authority checks

## Design

### 1. MCP Metadata Model

Extend tool registration inputs and catalog entries with:

- `version`
- `provider`
- `protocol = mcp | builtin`
- `approvalMode = auto | manual | denied`
- `inputSchema`
- `outputSchema`
- `tags`
- `examples`
- `requiredDepartments`

The serialized authority metadata remains in `AuthorityState.tools.metadata`.

### 2. Policy and Discovery

Add authoritative discovery methods for:

- full catalog listing
- department filtered discovery
- capability filtered discovery
- direct metadata lookup

Discovery outputs include an `access` view:

- `allowed`
- `reason`
- `quotaRemaining`

### 3. Invocation Governance

Tool execution must:

1. resolve authoritative metadata
2. evaluate department and capability policy
3. evaluate approval mode
4. evaluate quota
5. emit enriched audit events
6. update usage counters in authority state

### 4. HTTP Control Plane

Expose:

- `POST /api/authority/tools/mcp/register`
- `GET /api/authority/tools/discovery`
- `GET /api/authority/tools/:toolName/metadata`
- `GET /api/authority/tools/usage`

The existing `/api/authority/tools` and `/api/authority/tools/call` remain backward compatible.

## Acceptance Criteria

### Functional

- MCP tools can register with full metadata and policy fields
- discovery can filter by department, capability, protocol, and tag
- metadata lookup returns access decision for a given agent
- denied or approval-gated tools do not execute
- tool usage counters and audit events update after calls

### Verification

1. `npm run build:server`
2. Authority tool bridge targeted tests
3. Authority end-to-end acceptance for MCP registration and discovery
4. Authority coverage gate
5. `npm run build`
