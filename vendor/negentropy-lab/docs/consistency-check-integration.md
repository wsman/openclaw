# Consistency Check Integration Guide

## 1. Purpose

`scripts/consistency-check.js` validates whether key claims in `.clinerules` and `memory_bank` are consistent with current code implementation.

Constitution references:
- §101 Sync Axiom
- §102.3 Constitutional Sync Axiom
- §141 Entropy Reduction Validation Axiom
- §152 Single Source of Truth Axiom

## 2. Rule Configuration

Rule source: `config/consistency-rules.json`

Main dimensions:
1. Seven-layer architecture mapping
2. Agent three-tier architecture implementation
3. Gateway ecosystem component declaration
4. MCP tool-library documentation completeness
5. Plugin type/interface consistency

## 3. Local Usage

```bash
# Strict mode (non-zero exit code on failed required checks)
npm run check:consistency

# Strict mode + explicit timeout threshold
node scripts/consistency-check.js --strict --timeout-ms 120000

# Generate JSON only
node scripts/consistency-check.js --json-only

# Custom output path
node scripts/consistency-check.js --output reports/custom-consistency.json --html reports/custom-consistency.html

# Custom rule file
node scripts/consistency-check.js --rules config/consistency-rules.json
```

Default outputs:
- JSON: `reports/consistency-check-report.json`
- HTML: `reports/consistency-check-report.html`

## 4. CI Integration

Add to your CI pipeline after build/test:

```bash
npm run check:constitution
npm run check:consistency
```

Repository-ready workflow:
- `.github/workflows/constitution-consistency.yml`

Local Git quality gates:
- `.husky/pre-commit` (runs `git diff --cached --check`; `docs-only` changes skip repository-wide governance checks)
- `.husky/pre-push` (runs `check:constitution` + `check:consistency -- --timeout-ms 120000`)
- Troubleshooting checklist: `docs/architecture/husky-precommit-troubleshooting-checklist.md`
- Observation checklist: `docs/architecture/husky-gate-observation-checklist.md`

Recommended policy:
- `pre-commit` stays fast and staged-aware; repository-wide governance checks must pass at `pre-push` and before merge in CI.

## 5. Rule Tuning

You can tune thresholds and required paths in `config/consistency-rules.json`:
- `thresholds.pass`: strict pass line (default 90)
- `weights`: weighted contribution of each dimension
- `required` flags in seven-layer mapping for optional legacy layers

## 6. Report Reading

Report fields:
- `consistency_score`: weighted total score
- `check_dimensions.*.failed_checks`: required checks that failed
- `recommendations`: actionable remediation list
- `duration_ms`: total execution time
- `timeout_ms`: active timeout threshold
- `timeout_exceeded`: whether execution exceeded timeout threshold

Status mapping:
- `PASS`: score >= pass threshold
- `WARN`: score >= warn threshold and < pass
- `FAIL`: score < warn threshold
