# Negentropy Lab

`negentropy-lab` is an OpenClaw extension that applies gateway request policy
decisions from an external Negentropy service.

It plugs into the new `gateway_request` extension hook and can:

- allow a request unchanged
- rewrite the target gateway method + params
- reject a request before the built-in handler runs

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
```

The vendored Negentropy backend still lives in `vendor/negentropy-lab`; the
sync/build workflow remains driven by `scripts/custom-stack.mjs`.
