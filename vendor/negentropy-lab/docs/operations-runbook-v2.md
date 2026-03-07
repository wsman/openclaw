# Negentropy-Lab 运维手册 v2（Production 执行版）

**版本**: v7.5.0-dev  
**更新日期**: 2026-03-02  
**维护者**: 办公厅主任 / 科技部

---

## 1. 适用范围

本手册用于 Gateway 在 production 场景的发布、冒烟、回滚、交接与审计执行，作为 `docs/operations-runbook.md` 的执行增强版。

---

## 2. 发布前门禁

### 2.1 必检命令

```bash
npm run check:contract:strict
npm run check:contract:drift
npm run check:constitution
npm run check:consistency -- --strict --timeout-ms 120000
npm test -- --run
```

### 2.2 production 预检

```bash
npm run ops:preflight:prod
```

通过标准:

1. `status=PASS`
2. `contract_guard/constitution/consistency` 均为 PASS
3. 报告归档到 `reports/deploy-preflight-production-*.json`

---

## 3. 部署后冒烟（OPS-82）

```bash
npm run ops:deploy:smoke
```

通过标准:

1. 报告 `status=PASS`
2. 关键端点可达:
   - `/health`
   - `/api/websocket/stats`
   - `/v1/chat/completions`
3. 报告归档到 `reports/production-deploy-smoke-*.json`

---

## 4. 回滚演练与故障回退（OPS-83）

### 4.1 离线回滚验证

```bash
npm run ops:rollback:verify
```

### 4.2 live 回滚验证

```bash
bash ./scripts/rollback-verify.sh --live --health-url http://<target-host>:<port>/health
```

通过标准:

1. `contract_guard` PASS
2. `constitution` PASS
3. `http_health` PASS（live 场景）
4. 记录 RTO 并纳入发布复盘

---

## 5. 值班交接与签发

每次发布必须填写以下模板并归档到发布记录:

1. `docs/templates/release-signoff-template.md`
2. `docs/templates/oncall-handover-template.md`
3. `docs/templates/rollback-audit-template.md`

---

## 6. 告警响应SLA（OPS-92）

| 等级 | 触发条件 | 首次响应SLA | 缓解SLA | 升级路径 |
|------|----------|-------------|---------|----------|
| P0 | 服务不可用 / 健康探针失败 / 错误率持续超阈值 | 5分钟内 | 30分钟内给出缓解动作，60分钟内恢复 | 值班工程师 → 技术负责人 → 业务负责人 |
| P1 | 核心能力降级 / 延迟严重抬升 / 熔断持续开启 | 10分钟内 | 2小时内恢复 | 值班工程师 → 模块Owner |
| P2 | 局部异常 / 趋势恶化预警 | 30分钟内 | 24小时内闭环 | 值班工程师 → 对应功能团队 |

执行要求:

1. 每次告警处置必须记录时间戳、责任人、动作、结论。  
2. 超过缓解SLA必须触发升级链路并在交接材料中标注。  
3. 月度运维评审必须抽样复核告警处置记录。  

---

## 7. 审计归档规范

发布批次归档至少包含:

1. production 预检报告
2. 部署烟雾报告
3. 回滚验证报告（含 live）
4. 发布签发、交接、回滚模板实例

推荐命名:

1. `reports/production-config-check.md`
2. `reports/production-deploy-report.md`
3. `reports/handover-checklist.md`

---

## 8. 宪法条款映射

- §101 同步公理: 发布与文档同步更新  
- §102 熵减原则: 通过门禁与回滚演练降低不确定性  
- §306 零停机协议: 强制健康检查与可恢复链路  
- §504 监控系统公理: 发布证据与审计可追溯
