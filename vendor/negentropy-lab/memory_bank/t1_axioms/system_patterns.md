# 系统架构模式 - Negentropy-Lab

**宪法依据**: §104 功能分层拓扑公理、§100 微内核七层自治架构公理
**版本**: v7.0.0
**最后更新**: 2026-03-01

---

## 📋 概述

本文档定义Negentropy-Lab系统的核心架构模式和设计原则。
当前仓库定位为后端/API-only与网关运行时实现；前端代码已迁移至`/home/wsman/OpenDoge/opendoge-ui`（Linux环境）或`D:\Users\WSMAN\Desktop\OpenDoge\opendoge-ui`（Windows环境）。

---

## 🏗️ 双架构体系

### 七层自治架构 (L0-L5物理分层)

```
L5 [接口表现层] → API/CLI/UI (WebSocket RPC + HTTP REST API)
L4 [应用逻辑层] → Business Logic (TypeScript Node.js服务)
L3 [MCP微内核层] → Deterministic Toolchain (Python MCP微内核服务)
L2.5 [内部事务局] → IAB Supervision (运行时审计和元监督)
L2 [执行代理层] → Cline Agent (三层架构: L1+L2+L3)
L1 [记忆银行层] → Single Source of Truth (法典内核 + 记忆库)
L0.5 [Legacy兼容层] → Adapter & DI Container (LegacyCommandAdapter)
L0 [遗留隔离层] → Quarantine Zone (遗留代码隔离区)
L0.8 [ToolCallBridge] → 工具调用桥接器 (智能体工具调用标准化接口)
```

### 四层逻辑架构 (T0-T3逻辑分层)

| 层级 | 名称 | 用途 | 位置 |
|------|------|------|------|
| **T0** | 核心意识层 | 常驻内存，系统自我意识 | `memory_bank/t0_core/` |
| **T1** | 索引与状态层 | 高频检索，系统状态跟踪 | `memory_bank/t1_axioms/` |
| **T2** | 执行规范层 | 按需加载，开发标准与工作流 | `memory_bank/t2_protocols/`, `memory_bank/t2_standards/` |
| **T3** | 分析与归档层 | 离线存储，文档与归档 | `memory_bank/t3_documentation/` |

### 架构映射关系

**数学映射**: $S_{7-layer} \cong S_{4-layer}$

- **L5-L4** → **Gateway生态系统层**
- **L3-L2.5-L2** → **Agent三层架构层**
- **L3** → **LLM集成层**
- **L1** → **知识库管理层**

---

## 🔧 核心设计模式

### 1. 单一真理源模式 (§152)

所有配置和规范的单一来源：
- `memory_bank/t0_core/` - 宪法内核
- `.clinerules` - 项目入口索引

### 2. 依赖注入模式 (§336)

使用InversifyJS实现：
```typescript
container.bind<IAgentBase>(TYPES.Agent).to(ConcreteAgent);
```

### 3. 插件系统模式 (§501)

Gateway运行时PluginType（9种）：
- HTTP_MIDDLEWARE
- WEBSOCKET_MIDDLEWARE
- EVENT_HANDLER
- SCHEDULED_TASK
- DATA_TRANSFORMER
- EXTERNAL_INTEGRATION
- MONITORING
- LOGGING
- SECURITY

核心接口PluginKind（6类）：
- core
- agent
- monitoring
- channel
- gateway
- memory

### 4. 事件驱动模式 (§438)

工具调用事件广播机制：
- TOOL_CALL
- TOOL_RESULT
- TOOL_ERROR
- TOOL_PROGRESS

---

## 📐 架构约束

### 复杂度约束 (§301)

- **操作复杂度**: O(1) 或 O(log N)
- **查询复杂度**: 最坏 O(log N)，平均 O(1)
- **协作复杂度**: O(k)（k为Agent数量）

### 原子性约束 (§302)

- 文件写入必须是原子的
- 状态更新必须是原子的
- 多文件操作必须支持回滚

### 熵减约束 (§102, §141)

$$\Delta H = H_t - H_{t-1} \leq 0$$

所有变更必须降低或维持系统熵值。

---

*遵循宪法约束: 架构即真理，模式即规范。*
