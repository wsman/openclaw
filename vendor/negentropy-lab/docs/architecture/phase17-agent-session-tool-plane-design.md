# Phase 17 Agent Session Registry & Tool Plane Design

## 模块边界参考

当前 authority、persona、integration 与 interfaces 的模块边界，请统一参照 [module-map.md](./module-map.md)。

## 宪法依据
- §101 单一真理源：所有真实 Agent 会话、MCP 工具注册、工具调用审计统一收敛到 AuthorityState
- §102 熵减原则：沿用 Phase 16 mutation pipeline，避免新增旁路状态
- §108.1 模型参数强制指定：所有真实会话注册必须显式指定 `model` 与 `provider`
- §130 / §131 部门规范与工具约束：工具访问由部门 + capability 双重校验
- §151 持久化：工具调用事件进入权威事件存储，支持追溯
- §320 Claude Code 工具法：Phase 17 仅登记允许进入权威工具平面的工具元数据，不放松既有边界

## 目标
1. 建立真实 Agent Session Registry，支持注册、心跳、租约续约、掉线清理、能力选择
2. 建立 MCP Registry 投影，统一维护工具元数据、部门权限、能力要求、配额键
3. 建立 Tool Call 审计链，将工具注册/调用/结果/失败写入权威事件存储

## 设计决策
### 1. Agent Session Registry
- 在 `AgentSessionState` 增加：`sessionId`、`sessionToken`、`connectionStatus`、`healthStatus`、`capacity`、`pendingTasks`、`leaseExpiresAt`
- 通过 `AuthorityAgentSessionRegistry` 封装注册/心跳/注销/清理/选择逻辑
- 写路径仍通过 `MutationPipeline.propose()`，避免绕过 Phase 16 审计链

### 2. MCP Tool Registry
- `ToolState.registry` 存储工具分类
- 新增 `ToolState.metadata` 存储 JSON 元数据：`source`、`allowedDepartments`、`requiredCapabilities`、`quotaKey`
- 新增 `ToolState.lastResults` 保存最近一次工具结果摘要，供控制面和试点工作流消费

### 3. Tool Call Chain
- `AuthorityToolCallBridge` 扩展为：
  - 注册工具定义
  - 以 Agent 上下文调用工具
  - 校验部门权限 / capability / 配额
  - 写入 `EventStore`：`tool.registered`、`tool.call.started`、`tool.call.completed`、`tool.call.failed`
- 结果摘要回写 `AuthorityState.tools.lastResults`

## HTTP / Room 接口
### Authority HTTP
- `GET /api/authority/agents/sessions`
- `POST /api/authority/agents/register`
- `POST /api/authority/agents/:agentId/heartbeat`
- `DELETE /api/authority/agents/:agentId`
- `POST /api/authority/agents/select`
- `GET /api/authority/tools`
- `POST /api/authority/tools/register`
- `POST /api/authority/tools/call`

### Authority Room
- `register_agent` / `heartbeat` 改为调用 Session Registry
- 新增 `unregister_agent`
- 新增 `register_tool` / `query_tools` / `call_tool`

## 验收口径
- 注册后的 Agent 会话必须具备显式 `model/provider`
- 租约过期会话应被清理为 `disconnected`
- 不具备部门权限或 capability 的工具调用必须拒绝
- 工具调用事件必须可在事件存储中追踪
- `measure_entropy.py` 校验结果 `ΔH_sys <= 0`
