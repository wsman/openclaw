# Operations Runbook v3 - 紧急回滚操作手册

**版本**: v3.0.0  
**日期**: 2026-03-03  
**适用范围**: Negentropy-Lab + OpenClaw 双服务系统

---

## 1. 紧急回滚概述

### 1.1 回滚场景
- 决策服务异常导致大量请求被拒绝
- OpenClaw Gateway 响应超时率超过阈值
- 端口冲突无法自动解决
- 宪法合规检查发现严重违规

### 1.2 回滚模式
| 模式 | 说明 | 影响 |
|------|------|------|
| ENFORCE → SHADOW | 保留决策日志，放行所有请求 | 低风险，推荐首选 |
| ENFORCE → OFF | 完全关闭决策服务 | 无决策日志，最低延迟 |
| 紧急停止 | 停止所有服务 | 最高风险，需手动恢复 |

---

## 2. 快速回滚命令

### 2.1 ENFORCE → OFF（最快回滚）

```bash
# 方法 1：通过 CLI 回滚
npm run launch -- stop

# 方法 2：通过决策服务 API 回滚
curl -X POST http://localhost:3000/internal/openclaw/decision/emergency-rollback \
  -H "Content-Type: application/json" \
  -d '{"targetMode": "OFF", "reason": "emergency rollback"}'

# 方法 3：直接修改运行时配置
echo '{"mode": "OFF"}' > storage/runtime/launcher-config.json
```

### 2.2 ENFORCE → SHADOW（安全回滚）

```bash
# 方法 1：通过 CLI
npm run launch -- start --decision=SHADOW --no-openclaw

# 方法 2：通过决策服务 API
curl -X POST http://localhost:3000/internal/openclaw/decision/mode \
  -H "Content-Type: application/json" \
  -d '{"mode": "SHADOW"}'
```

---

## 3. 回滚验证清单

### 3.1 验证步骤

```bash
# 1. 检查服务状态
npm run launch -- status

# 2. 健康检查
npm run launch -- health

# 3. 验证决策模式
curl http://localhost:3000/internal/openclaw/decision/mode

# 4. 检查日志无错误
tail -f logs/negentropy.log | grep -i error

# 5. 验证 OpenClaw Gateway 正常
curl http://localhost:18789/health
```

### 3.2 验收标准
- [ ] 决策模式已切换到 OFF/SHADOW
- [ ] 服务健康检查返回 200
- [ ] 无错误日志输出
- [ ] OpenClaw Gateway 正常响应
- [ ] 客户端请求正常放行

---

## 4. 回滚预演记录

### 4.1 预演环境
- **日期**: 2026-03-03
- **环境**: 开发环境
- **初始模式**: ENFORCE

### 4.2 预演步骤

```bash
# 1. 启动服务（ENFORCE 模式）
npm run launch -- start --decision=ENFORCE

# 2. 确认模式
curl http://localhost:3000/internal/openclaw/decision/mode
# 预期: {"mode": "ENFORCE"}

# 3. 执行紧急回滚
npm run launch -- stop

# 4. 验证服务已停止
npm run launch -- status
# 预期: {"negentropy": {"status": "stopped"}, "openclaw": {"status": "stopped"}}

# 5. 以 OFF 模式重启
npm run launch -- start --decision=OFF

# 6. 验证回滚成功
curl http://localhost:3000/internal/openclaw/decision/mode
# 预期: {"mode": "OFF"}
```

### 4.3 预演结果
- [x] ENFORCE → OFF 回滚成功
- [x] 服务状态正确更新
- [x] 无残留进程
- [x] 端口正确释放

---

## 5. 故障排查

### 5.1 回滚失败

**症状**: 回滚命令执行后服务仍运行

**排查步骤**:
```bash
# 1. 检查 PID 文件
cat storage/runtime/launcher-pids.json

# 2. 手动终止进程
kill -9 <PID>

# 3. 检查端口占用
netstat -ano | findstr :3000
netstat -ano | findstr :18789

# 4. 强制清理端口
npm run launch -- clean-ports
```

### 5.2 端口冲突

**症状**: 启动失败，提示端口被占用

**排查步骤**:
```bash
# 1. 查看端口占用
netstat -ano | findstr :3000

# 2. 终止占用进程
taskkill /PID <PID> /F

# 3. 使用自动端口切换
npm run launch -- start --auto-port
```

---

## 6. 联系人

| 角色 | 联系方式 |
|------|----------|
| On-Call | oncall@negentropy-lab.dev |
| 紧急联系 | +86-xxx-xxxx-xxxx |

---

## 7. 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| v3.0.0 | 2026-03-03 | 添加 ENFORCE → OFF 紧急回滚预演 |
| v2.0.0 | 2026-02-28 | 更新双服务架构 |
| v1.0.0 | 2026-02-15 | 初始版本 |