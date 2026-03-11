# Authority Staging Acceptance Report

**Template Version**: `1.0.0`
**Last Updated**: `2026-03-10`

---

Use `reports/README.md` as the canonical reference for report field definitions, naming conventions, retention guidance, and operator workflow.

---

## Execution Metadata

| Field | Value |
|-------|-------|
| **Execution Date** | `YYYY-MM-DD` |
| **Execution Time** | `HH:MM:SS - HH:MM:SS (UTC+8)` |
| **Executor** | `[Name/ID]` |
| **Environment** | `[Docker version, OS, machine specs]` |
| **Negentropy-Lab Version** | `[git commit hash or version]` |

---

## 1. Pre-flight Checks

### 1.1 Environment Verification

- [ ] Docker installed and running: `[docker --version output]`
- [ ] Required ports available: `3311`, `3312`, `3313`, `6379`
- [ ] Sufficient disk space available: `>1GB`
- [ ] Network connectivity verified for staging backplane

### 1.2 Codebase Status

```bash
git log -1 --oneline
# [output]

git status --short
# [output]
```

---

## 2. Staging Cluster Startup

### 2.1 Stack Launch

```bash
npm run ops:authority:staging:up
# [output]
```

| Field | Value |
|-------|-------|
| **Status** | `[SUCCESS / FAILED]` |
| **Startup Time** | `[seconds]` |
| **Notes** | `[observations]` |

---

## 3. Cluster Validation

### 3.1 Command Execution

```bash
npm run ops:authority:cluster:validate \
  --base-urls http://127.0.0.1:3311,http://127.0.0.1:3312,http://127.0.0.1:3313 \
  --expected-node-count 3 \
  --preferred-region cn-east-1
```

### 3.2 Results

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| **Overall Status** | `PASS` | `[PASS/FAIL]` | `[ ]` |
| **Leader Node** | `Single leader` | `[node-id]` | `[ ]` |
| **Active Nodes** | `3` | `[count]` | `[ ]` |
| **Cluster ID** | `Consistent` | `[cluster-id]` | `[ ]` |
| **Recommendations** | `Valid` | `[recommended-node-id]` | `[ ]` |
| **Sync Status** | `Not stale` | `[status]` | `[ ]` |

**Report Path**: `reports/authority-cluster-validation-[timestamp].json`

---

## 4. Monitoring Calibration

### 4.1 Command Execution

```bash
npm run ops:authority:cluster:monitor \
  --base-urls http://127.0.0.1:3311,http://127.0.0.1:3312,http://127.0.0.1:3313 \
  --expected-node-count 3 \
  --max-warnings 0 \
  --forbidden-alerts entropy_global_high,breaker_escalated
```

### 4.2 Results

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| **Overall Status** | `PASS` | `[PASS/FAIL]` | `[ ]` |
| **Node Count** | `3` | `[actualNodeCount]` | `[ ]` |
| **Warning Count** | `≤ 0` | `[actualWarnings]` | `[ ]` |
| **Leader Present** | `Yes` | `[Yes/No]` | `[ ]` |
| **Forbidden Alerts** | `None` | `[list or None]` | `[ ]` |

**Report Path**: `reports/authority-cluster-monitoring-[timestamp].json`

---

## 5. Fault Injection Rehearshal (Optional)

### 5.1 Command Execution

```bash
npm run ops:authority:cluster:rehearshal \
  --base-urls http://127.0.0.1:3311,http://127.0.0.1:3312,http://127.0.0.1:3313 \
  --scenario all
```

### 5.2 Scenario Results

| Scenario | Status | Failover Time (ms) | Notes |
|----------|--------|--------------------|-------|
| **Leader Kill** | `[PASS/FAIL]` | `[ms]` | `[notes]` |
| **Follower Restart** | `[PASS/FAIL]` | `N/A` | `[notes]` |
| **Network Partition** | `[PASS/FAIL]` | `N/A` | `[notes]` |
| **Full Restart** | `[PASS/FAIL]` | `N/A` | `[notes]` |

**Report Path**: `reports/authority-cluster-rehearshal-[timestamp].json`

---

## 6. Cleanup

### 6.1 Stack Shutdown

```bash
npm run ops:authority:staging:down
# [output]
```

| Field | Value |
|-------|-------|
| **Status** | `[SUCCESS / FAILED]` |
| **Notes** | `[observations]` |

---

## 7. Issues Found

| ID | Severity | Description | Impact | Recommended Action |
|----|----------|-------------|--------|-------------------|
| `1` | `[Critical/High/Medium/Low]` | | | |

---

## 8. Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| **Executor** | | | |
| **Reviewer** | | | |

---

## 9. Attachments

- [ ] `reports/authority-cluster-validation-*.json`
- [ ] `reports/authority-cluster-monitoring-*.json`
- [ ] `reports/authority-cluster-rehearshal-*.json` *(if applicable)*
- [ ] `reports/README.md` reviewed for field interpretation and archival rules
- [ ] Docker logs *(if issues found)*

---

## 10. Summary Decision

| Decision | Value |
|----------|-------|
| **Phase I-5 Status** | `[APPROVED / CONDITIONAL / REJECTED]` |
| **Production Readiness** | `[Ready / Needs Follow-up]` |
| **Follow-up Owner** | `[Name/Team]` |
| **Next Action** | `[deploy / rerun / fix / observe]` |
