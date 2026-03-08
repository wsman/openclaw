# Negentropy-Lab 运维手册

**版本**: v7.6.0-dev
**更新日期**: 2026-03-07
**维护者**: 科技部

---

## 1. 运维概览

本手册提供 Negentropy-Lab Gateway 系统的日常运维操作指南。

### 1.1 服务架构

```
┌─────────────────────────────────────────────────────────┐
│                    Gateway Layer                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────────────────────┐  │
│  │ HTTP API│  │WebSocket│  │   Monitoring Services   │  │
│  └────┬────┘  └────┬────┘  └─────────────────────────┘  │
│       │            │                                     │
│  ┌────┴────────────┴────┐                               │
│  │   L4 应用逻辑层       │                               │
│  └──────────────────────┘                               │
└─────────────────────────────────────────────────────────┘
```

---

## 2. 日常运维

### 2.1 服务检查清单

| 检查项 | 频率 | 命令 |
|--------|------|------|
| 服务状态 | 每小时 | `npm run launch -- health` |
| 内存使用 | 每15分钟 | `pm2 status` 或 `free -h` |
| 日志错误 | 每小时 | `grep ERROR logs/application.log | tail -20` |
| 连接数 | 每30分钟 | `ss -s` 或 `netstat -an | grep :3000 | wc -l` |

### 2.2 定时任务

```bash
# 日志轮转 (crontab -e)
0 0 * * * /usr/sbin/logrotate /etc/logrotate.d/negentropy

# 数据备份
0 2 * * * /opt/negentropy/scripts/backup.sh

# 性能报告
0 8 * * * cd /opt/negentropy && node scripts/perf-weekly-report.js --lookback-days 7
```

---

## 3. 故障处理

### 3.1 故障响应流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  发现故障   │ ──→ │  初步诊断   │ ──→ │  分级处理   │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                     ┌─────────────┐          │
                     │  记录归档   │ ←────────┤
                     └─────────────┘          │
                                              ▼
                     ┌─────────────┐     ┌─────────────┐
                     │  验证修复   │ ←── │  执行修复   │
                     └─────────────┘     └─────────────┘
```

### 3.2 故障分级

| 级别 | 描述 | 响应时间 | 处理时限 |
|------|------|----------|----------|
| P0 | 服务不可用 | 5分钟 | 1小时 |
| P1 | 核心功能降级 | 15分钟 | 4小时 |
| P2 | 部分功能异常 | 30分钟 | 24小时 |
| P3 | 轻微问题 | 2小时 | 72小时 |

### 3.3 常见故障处理

#### 3.3.1 服务无响应

```bash
# 1. 检查进程状态
pm2 status
ps aux | grep node

# 2. 检查端口占用
netstat -tlnp | grep 3000

# 3. 检查日志
tail -100 logs/error.log

# 4. 重启服务
pm2 restart negentropy-gateway
```

#### 3.3.2 内存泄漏

```bash
# 1. 检查内存使用
node --expose-gc -e "console.log(process.memoryUsage())"

# 2. 生成堆快照
kill -USR2 <pid>

# 3. 分析后重启
pm2 restart negentropy-gateway
```

#### 3.3.3 连接数过高

```bash
# 1. 查看当前连接
ss -s
netstat -an | grep :3000 | wc -l

# 2. 检查异常连接
netstat -an | grep :3000 | grep -v ESTABLISHED

# 3. 查看 launcher 视角健康状态
npm run launch -- health
```

说明：

- 当前仓默认未暴露 `/admin/rate-limit` 运行时管理端点。
- 如需临时限流，请在反向代理/入口层执行，或通过配置变更后重启服务。

---

## 4. 监控告警

### 4.1 Prometheus 告警规则

```yaml
# /etc/prometheus/alerts/negentropy.yml
groups:
  - name: negentropy-gateway
    rules:
      - alert: HighErrorRate
        expr: rate(gateway_errors_total[5m]) > 0.01
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Gateway error rate > 1%"

      - alert: HighLatency
        expr: histogram_quantile(0.95, gateway_request_duration_ms_bucket) > 500
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "P95 latency > 500ms"

      - alert: ServiceDown
        expr: up{job="negentropy-gateway"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Gateway service is down"
```

### 4.2 告警通知配置

```yaml
# alertmanager.yml
global:
  slack_api_url: 'https://hooks.slack.com/services/XXX'

route:
  receiver: 'team-ops'
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h

receivers:
  - name: 'team-ops'
    slack_configs:
      - channel: '#ops-alerts'
        send_resolved: true
```

---

## 5. 备份恢复

### 5.1 备份脚本

```bash
#!/bin/bash
# /opt/negentropy/scripts/backup.sh

BACKUP_DIR="/backup/negentropy"
DATE=$(date +%Y%m%d_%H%M%S)

# 备份配置
tar -czf $BACKUP_DIR/config_$DATE.tar.gz /opt/negentropy/config

# 备份数据
tar -czf $BACKUP_DIR/data_$DATE.tar.gz /opt/negentropy/data

# 备份日志
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz /opt/negentropy/logs

# 清理7天前的备份
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

### 5.2 恢复流程

```bash
# 1. 停止服务
pm2 stop negentropy-gateway

# 2. 恢复数据
tar -xzf /backup/negentropy/data_20260301.tar.gz -C /

# 3. 恢复配置
tar -xzf /backup/negentropy/config_20260301.tar.gz -C /

# 4. 启动服务
pm2 start negentropy-gateway
```

---

## 6. 宪法合规运维

### 6.1 合规检查命令

```bash
# 检查宪法合规状态
npm run check:constitution

# 查看持续治理报告
npm run report:perf:trend

# 检查RPC契约覆盖
npm run check:contract:strict

# 性能周报生成
npm run report:perf:weekly
```

### 6.2 合规指标

| 指标 | 目标 | 检查频率 |
|------|------|----------|
| 代码合规率 | 100% | 每次发布 |
| 测试通过率 | 100% | 每次提交 |
| RPC覆盖率 | ≥97% | 每周 |
| 文档合规率 | 100% | 每次发布 |

---

## 7. 发布值班模板（Phase 6-4）

- 发布签发模板: `docs/templates/release-signoff-template.md`
- 值班交接模板: `docs/templates/oncall-handover-template.md`
- 回滚审计模板: `docs/templates/rollback-audit-template.md`

---

## 8. 联系方式

| 角色 | 联系方式 |
|------|----------|
| 值班运维 | ops@negentropy.lab |
| 技术负责人 | tech-lead@negentropy.lab |
| 紧急联系 | +86-xxx-xxxx-xxxx |

---

*本手册遵循宪法驱动开发(CDD)规范，依据§504-§506监控系统公理维护。*
