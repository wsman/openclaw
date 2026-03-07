# WebSocket Pipeline 运营化手册

**版本**: v1.0.0  
**创建时间**: 2026-03-01  
**维护者**: 科技部

---

## 1. 概述

### 1.1 目的

本手册定义了 WebSocket 长稳测试和性能基线的运营化流程，确保持续可追踪和告警能力。

### 1.2 宪法依据

- **§102 熵减原则**: 自动化测试降低系统熵值
- **§504 监控系统公理**: 系统必须实时监控状态

---

## 2. 长稳测试 (Soak Test)

### 2.1 执行方式

```bash
# 快速验证 (5分钟)
./scripts/ws-soak.sh --iterations 2 --interval-sec 60

# 标准24小时测试
./scripts/ws-soak.sh --iterations 48 --interval-sec 1800

# 自定义配置
./scripts/ws-soak.sh --iterations 10 --interval-sec 300
```

### 2.2 报告输出

- 日志文件: `reports/ws-soak-YYYYMMDD-HHMMSS.log`
- JSON报告: `reports/ws-soak-YYYYMMDD-HHMMSS.json`

### 2.3 日跑策略

建议每日凌晨执行一次快速验证：

```cron
# crontab -e
0 3 * * * cd /home/wsman/桌面/Coding\ Task/Negentropy-Lab && ./scripts/ws-soak.sh --iterations 3 --interval-sec 300
```

---

## 3. 性能基线 (Performance Baseline)

### 3.1 执行方式

```bash
# 执行性能基线测试
./scripts/ws-perf-baseline.sh
```

### 3.2 报告输出

- 日志文件: `reports/ws-perf-baseline-YYYYMMDD-HHMMSS.log`
- JSON报告: `reports/ws-perf-baseline-YYYYMMDD-HHMMSS.json`

### 3.3 基线比对

比对当前基线与历史基线：

```bash
# 查看最近7天的基线
ls -la reports/ws-perf-baseline-*.json | head -7

# 对比两个基线
diff <(jq '.' reports/ws-perf-baseline-OLD.json) <(jq '.' reports/ws-perf-baseline-NEW.json)
```

### 3.4 阈值告警

当性能下降超过 20% 时触发告警：

```bash
# 示例告警脚本
#!/bin/bash
CURRENT=$(jq '.duration_sec' reports/ws-perf-baseline-LATEST.json)
BASELINE=$(jq '.duration_sec' reports/ws-perf-baseline-BASELINE.json)

if [[ $CURRENT -gt $((BASELINE * 120 / 100)) ]]; then
  echo "⚠️ 性能下降超过20%! 当前: ${CURRENT}s, 基线: ${BASELINE}s"
  exit 1
fi
```

---

## 4. Dual Gates 策略

### 4.1 主干门禁

针对核心 RPC 的回归测试：

- 触发条件: 每次 PR
- 执行内容: 核心单元测试 + 集成测试
- 通过标准: 100% 通过

### 4.2 扩展门禁

针对性能和稳定性测试：

- 触发条件: 每日定时 / 手动触发
- 执行内容: 性能测试 + 长稳测试
- 通过标准: 无失败，性能在基线范围内

---

## 5. 故障排查

### 5.1 常见问题

| 问题 | 可能原因 | 解决方案 |
|------|----------|----------|
| Soak 中途失败 | 内存泄漏/连接超时 | 检查日志定位具体测试 |
| 性能下降 | 代码变更/环境问题 | 对比历史基线分析 |
| 连接超时 | 网络问题/服务未启动 | 检查服务状态和网络 |

### 5.2 日志分析

```bash
# 查看最近的 soak 失败
grep -r "result=FAIL" reports/ws-soak-*.log

# 查看性能趋势
for f in reports/ws-perf-baseline-*.json; do
  echo "$(basename $f): $(jq '.duration_sec' $f)s"
done
```

---

## 6. 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-03-01 | v1.0.0 | 初始版本 |

---

**文件状态**: 🟢 活跃  
**下次更新**: 运营化策略调整时