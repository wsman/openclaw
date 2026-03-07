# 契约守护运行手册

**版本**: v1.0.0  
**创建时间**: 2026-03-01  
**维护者**: 科技部

---

## 1. 概述

### 1.1 目的

本手册定义了 Negentropy-Lab Gateway 契约守护的操作流程，确保 `93 RPC / 19 Events` canonical 基线得到持续守护。

### 1.2 宪法依据

- **§101 同步公理**: 契约与实现必须同步
- **§102 熵减原则**: 契约守护降低系统熵值
- **§152 单一真理源公理**: 93 RPC / 19 Events 作为 canonical 基线

---

## 2. 契约基线

### 2.1 RPC 方法基线 (目标: 93)

| 类别 | 方法数 | 说明 |
|------|--------|------|
| 认证 | 5 | login, logout, authenticate, refresh, validate |
| 会话 | 8 | create, join, leave, close, list, get, update, delete |
| Agent | 12 | 任务创建、执行、查询、取消等 |
| 任务 | 10 | 任务生命周期管理 |
| 通道 | 8 | WebSocket 通道管理 |
| 模型 | 6 | LLM 模型配置 |
| 配置 | 10 | 系统配置管理 |
| 流式 | 8 | SSE/WebSocket 流式处理 |
| 状态 | 6 | 系统状态查询 |
| 健康 | 4 | 健康检查 |
| 系统 | 8 | 系统管理 |
| Browser | 8 | 浏览器控制 |

### 2.2 Events 基线 (目标: 19)

| 类别 | 事件 | 说明 |
|------|------|------|
| Presence | 4 | presence_state, presence_change, presence_join, presence_leave |
| Cron | 3 | cron_tick, cron_start, cron_stop |
| Node | 3 | node_add, node_remove, node_update |
| Agent | 3 | agent_task_start, agent_task_complete, agent_task_error |
| System | 3 | system_start, system_stop, system_error |
| Room | 2 | room_join, room_leave |
| Message | 1 | message |

---

## 3. 操作流程

### 3.1 日常检查

```bash
# 运行契约计数检查
node scripts/contract-count-check.js

# 输出报告位置
# reports/contract-count-report.json
```

### 3.2 CI 集成

契约检查已集成到 CI Pipeline：

```yaml
# .github/workflows/ci.yml
- name: Contract Count Check
  run: node scripts/contract-count-check.js
```

### 3.3 破坏性变更处理

当契约检查失败时：

1. **检查变更内容**: 确认是否为预期变更
2. **更新基线**: 如果是合法变更，更新 `CONTRACT_BASELINE` 配置
3. **通知相关方**: 发布契约变更通知
4. **更新文档**: 同步更新本手册

---

## 4. 事件别名映射

### 4.1 查询接口

```typescript
import { 
  resolveEventName, 
  getEventMetadata, 
  isValidEvent 
} from './server/gateway/protocol/event-alias-mapping';

// 解析事件名称
const primaryName = resolveEventName('presence_join'); // -> 'presence_change'

// 获取事件元数据
const metadata = getEventMetadata('presence_state');

// 检查事件有效性
const isValid = isValidEvent('unknown_event'); // -> false
```

### 4.2 别名映射规则

| 别名 | 主事件 | 类别 |
|------|--------|------|
| presence_join | presence_change | presence |
| presence_leave | presence_change | presence |

---

## 5. 故障排查

### 5.1 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| RPC 计数不足 | 方法未实现 | 检查 Gateway 路由配置 |
| Event 计数不足 | 事件未注册 | 检查事件发射器配置 |
| 别名解析失败 | 别名未映射 | 更新 EVENT_ALIASES 配置 |

### 5.2 调试模式

```bash
# 启用调试模式
DEBUG=true node scripts/contract-count-check.js
```

---

## 6. 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-03-02 | v1.1.0 | 新增 drift 分级处置手册引用（`docs/gateway/contract-drift-runbook.md`） |
| 2026-03-01 | v1.0.0 | 初始版本 |

---

**文件状态**: 🟢 活跃  
**下次更新**: 契约基线变更时  
**相关文档**: `docs/gateway/contract-drift-runbook.md`
