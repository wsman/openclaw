# Negentropy Lab

`negentropy-lab` is an OpenClaw extension that combines gateway request policy
decisions with manual workflow orchestration backed by Negentropy internal APIs.

It plugs into OpenClaw hook surfaces and can:

- use `gateway_request` to allow, rewrite, or reject a gateway request before
  the built-in handler runs
- expose `/negentropy` control commands for decision mode and workflow runs
- map `subagent_*` and `session_*` lifecycle events into workflow runtime
  events when the workflow bridge is enabled
- optionally auto-dispatch vendor `spawn_subagent` actions through
  `runtime.subagent.run(...)`

Configure it under `plugins.entries.negentropy-lab.config`, for example:

```yaml
plugins:
  entries:
    negentropy-lab:
      enabled: true
      config:
        mode: ENFORCE
        serviceUrl: http://127.0.0.1:3000/internal/openclaw/decision
        timeoutMs: 5000
        bypassMethods:
          - connect
          - ping
          - health.check
        healthPaths:
          - /health
          - /healthz
          - /ready
          - /readyz
        enforceFailClosed: false
        enableRollbackSwitch: false
        workflowEnabled: true
        orchestrationApiBaseUrl: http://127.0.0.1:3000/internal/openclaw/workflows
        workflowTimeoutMs: 5000
        autoDispatchSubagents: true
```

The vendored Negentropy backend still lives in `vendor/negentropy-lab`; the
sync/build workflow remains driven by `scripts/custom-stack.mjs`.

Workflow bridge notes:

- `workflowEnabled` defaults to on; set it to `false` to disable
  `/negentropy workflow ...`
- if `orchestrationApiBaseUrl` is omitted, the extension derives it from
  `serviceUrl` when possible, otherwise falls back to
  `http://127.0.0.1:3000/internal/openclaw/workflows`
- `autoDispatchSubagents` only controls whether workflow actions can spawn
  subagents automatically; it does not enable global autonomous orchestration

## Contract source and sync

This extension consumes a local decision contract snapshot:

- `extensions/negentropy-lab/src/decision-contract.snapshot.ts`

The snapshot is generated from vendor canonical source:

- `vendor/negentropy-lab/server/gateway/openclaw-decision/contracts/decision-contract.ts`

The workflow bridge talks to the vendored orchestration API surface:

- `vendor/negentropy-lab/server/gateway/openclaw-decision/api/internal-api.ts`
- `vendor/negentropy-lab/server/gateway/openclaw-orchestration/api/internal-api.ts`

Sync command:

```bash
node extensions/negentropy-lab/scripts/sync-decision-contract-snapshot.mjs
```

## Control commands

The extension registers `/negentropy` command handlers:

- `/negentropy status`
- `/negentropy mode <OFF|SHADOW|ENFORCE>`
- `/negentropy fail-closed <on|off>`
- `/negentropy rollback`
- `/negentropy workflow status [runId]`
- `/negentropy workflow list`
- `/negentropy workflow trace <runId> [limit]`
- `/negentropy workflow run <name>`
- `/negentropy workflow retry <runId>`
- `/negentropy workflow reconcile [runId] [--include-terminal] [--reason <text>]`
- `/negentropy workflow cancel <runId> [--emergency]`
- `/negentropy workflow emergency-stop <runId>`
- `/negentropy workflow stop <runId>`

When `workflowEnabled=false`, workflow subcommands return a disabled-by-config
message instead of calling the workflow backend.
