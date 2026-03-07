# Negentropy-Lab 重构文档

## 重构日期
2026-03-07

## 重构目标
在严格保持功能不变的前提下，合并优化代码库，消除重复实现，降低系统熵值。

## 宪法依据
- §101 同步公理：代码变更必须触发文档更新
- §102 熵减原则：所有变更必须降低或维持系统熵值
- §152 单一真理源公理：统一配置和接口

---

## 已完成的重构

### 阶段1：统一入口

**问题**：存在两套独立的后端入口（`src/index.ts` 和 `server/index.ts`），构建和开发不一致。

**解决方案**：
- 修改 `tsconfig.build.json`，将 `include` 改为 `["server/**/*"]`
- 更新 `package.json` 脚本，统一使用 `server/index.ts`
- `src/` 保留为兼容壳

**影响文件**：
- `tsconfig.build.json`
- `package.json`

---

### 阶段2：合并Agent体系

**问题**：
- `server/api/agent.ts` (~260行) 和 `server/gateway/agent-engine.ts` (~1200行) 重复定义 AgentConfig
- 多处 Agent 管理逻辑分散

**解决方案**：
创建统一 Agent 模块 `server/modules/agent/`：
- `types.ts` - 统一类型定义（AgentConfig, AgentInfo, AgentRequest 等）
- `AgentService.ts` - 核心服务实现
- `index.ts` - 模块导出

`server/gateway/agent-engine.ts` 改为适配器模式，委托给 AgentService。

**新增文件**：
- `server/modules/agent/types.ts`
- `server/modules/agent/AgentService.ts`
- `server/modules/agent/index.ts`

**修改文件**：
- `server/gateway/agent-engine.ts` → 适配器层

---

### 阶段3：合并Auth模块

**问题**：存在3套认证实现：
- `server/middleware/auth.ts`
- `server/gateway/auth.ts`
- `server/gateway/auth/index.ts`

**解决方案**：
- 保留 `server/gateway/auth/index.ts` 作为主入口（最完整）
- `server/middleware/auth.ts` 改为兼容层，提供中间件函数
- 旧 `server/gateway/auth.ts` 已归档

**修改文件**：
- `server/middleware/auth.ts` → 兼容层

**归档文件**：
- `server/gateway/auth.ts` → `archive/auth.ts`

---

### 阶段4：清理Gateway重复实现

**问题**：Gateway 存在两个实现版本：
- `server.impl.ts` (旧版本)
- `server.impl-with-ws.ts` (当前版本)

**解决方案**：
- 保留 `server.impl-with-ws.ts` 作为主实现
- 旧文件移动到 `archive/` 目录
- 更新 `gateway/index.ts` 导出

**归档文件**：
- `server/gateway/server.impl.ts` → `archive/server.impl.ts`
- `server/gateway/llm-service.ts.backup` → `archive/llm-service.ts.backup`
- `server/gateway/auth.ts` → `archive/auth.ts`

**修改文件**：
- `server/gateway/index.ts`

---

## 目录结构变化

### 新增目录
```
server/modules/agent/    # 统一Agent模块
├── types.ts             # 类型定义
├── AgentService.ts      # 核心服务
└── index.ts             # 模块导出
```

### 归档目录
```
server/gateway/archive/  # 已归档的旧实现
├── server.impl.ts
├── llm-service.ts.backup
└── auth.ts
```

---

## 未完成项（可选）

### 阶段5：抽取房间公共基类
- 创建 `BaseControlRoom.ts`
- 合并 AgentRoom, NodeRoom, CronRoom, ConfigRoom, TaskRoom

**状态**：跳过（需要更多测试验证）

---

## 向后兼容性

所有原有接口保持不变：
- `server/api/agent.ts` 继续工作
- `server/middleware/auth.ts` 中间件函数可用
- `server/gateway/agent-engine.ts` API 兼容
- 外部导入路径无需修改

---

## 测试建议

1. 运行完整测试套件
2. 验证 Agent API 端点：`/api/agents/*`
3. 验证认证中间件
4. 验证 Gateway WebSocket 连接

---

## 宪法合规声明

本重构遵循：
- ✅ §101 同步公理 - 文档已更新
- ✅ §102 熵减原则 - 消除重复代码
- ✅ §152 单一真理源公理 - 统一类型定义
- ✅ §306 零停机协议 - 保持向后兼容
