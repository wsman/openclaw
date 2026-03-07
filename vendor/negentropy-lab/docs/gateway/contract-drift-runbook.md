# Gateway Contract Drift 处置手册

**版本**: v1.0.0  
**更新时间**: 2026-03-02  
**维护者**: 科技部

---

## 1. 目标

将 drift 告警从“计数异常”升级为“可定位到方法级 + 可执行处置”。

---

## 2. 执行命令

```bash
npm run check:contract:strict
npm run check:contract:drift
```

关键报告:

1. `reports/contract-count-report.json`
2. `reports/contract-drift-audit.json`

---

## 3. 严重度分级

| 严重度 | 触发条件 | 处置时限 |
|--------|----------|----------|
| critical | strict 失败 / missing canonical >= 5 / RPC 或 Event 大幅漂移 | 立即阻断发布 |
| high | 存在 canonical 方法缺口 / RPC 或 Event 数量漂移 | 当日修复 |
| medium | 非阻断风险，需持续观察 | 3 天内处置 |
| none | 无漂移 | 保持守护 |

---

## 4. 方法级定位

在 `contract-drift-audit.json` 中重点查看：

1. `issues[].methods`：直接给出缺失方法名列表  
2. `methodLevel.missingCanonicalDomainBreakdown`：按域统计缺口（如 `agent`、`sessions`）  
3. `methodLevel.nonCanonicalRegisteredMethods`：非 canonical 注册方法样本

---

## 5. 标准处置流程

1. 先修复 strict 阻断项（如果存在 `STRICT_GUARD_FAILED`）。  
2. 按 `issues[].methods` 补齐 canonical 方法实现/占位。  
3. 补充或修正对应单元测试/契约测试。  
4. 重新执行：
   - `npm run check:contract:strict`
   - `npm run check:contract:drift`
5. 更新月报与发布审计材料。

---

## 6. 与 CI 的对齐

契约守护链路:

1. PR / Push: `.github/workflows/gateway-dual-gates.yml`
2. Nightly: `.github/workflows/gateway-contract-nightly.yml`
3. Release: `.github/workflows/gateway-contract-release-gate.yml`

以上任一链路失败都应阻断合并/发布。
