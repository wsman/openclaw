# Negentropy-Lab 权威智能体编排服务器改造方案

**版本**: v0.1
**日期**: 2026-03-09
**状态**: Draft / 可进入 Phase 16 设计审议
**适用范围**: `D:\Users\WSMAN\Desktop\Coding Task\Negentropy-Lab`

---

## 模块边界参考

当前逻辑模块树、文件归属、依赖方向与 Phase 1 模块出口，请统一以 [module-map.md](./module-map.md) 为准。

## 1. 目标定义

将 `Negentropy-Lab` 从“具备 Colyseus + Gateway + MCP + 集群能力的多组件后端”，升级为：

> **一个可容纳智能体编排与协作的权威服务器（Authoritative Agent Collaboration Server）**

该服务器需要同时满足四类目标：

1. **状态权威**：服务器持有全局真理源，客户端、智能体、外部系统都不能绕过权威状态直接改写事实。
2. **协作可扩展**：支持从中心化编排逐步演进到协议化协同（choreography），而不是把所有复杂度塞进一个超级 orchestrator。
3. **治理可验证**：冲突裁决、熵值监控、审计链、权限边界、工具调用必须被记录、验证和回放。
4. **渐进式迁移**：尽量复用现有 `Colyseus Room`、`Gateway`、`MCP`、`Cluster`、`OpenClaw orchestration` 能力，避免推倒重来。

---

## 2. 规划文档提炼出的硬约束

本方案综合了 `OpenDoge/memory_bank/docs` 中四份规划文档，提炼出以下不可偏离的方向。

### 2.1 来自《AI部门数据治理与决策方案》

- 核心范式不是普通 API Server，而是 **Colyseus 权威服务器**。
- 需要 **Schema 驱动的状态树**，而不是散落的局部状态。
- 需要 **房间 + 仿真循环 + 状态补丁广播**。
- 需要 **Node.js 权威核心 + Python 智能体无头客户端桥接**。
- 需要 **全局熵函数**、**冲突裁决机制**、**MCP 工具注册表**、**可观测性**、**append-only 审计链**。

### 2.2 来自《孙子兵法与 AI Agent 协同研究》

- 不能把未来形态设计成“更大的中心化 orchestrator”。
- 智能体之间必须通过 **结构化契约 / Schema / 协议** 通信。
- 需要从 **Orchestration** 向 **Choreography** 演进。
- 需要 **零信任身份机制** 与签名/授权链，避免“谁都能代表谁发指令”。
- MCP 的角色不是工具附属物，而是 **跨智能体、跨数据源互操作标准层**。

### 2.3 来自《多智能体协同的潜在场景》

必须优先让系统能跑通五类代表性协同场景：

1. 晨间简报
2. 熵值熔断
3. 跨部门预算冲突裁决
4. 周度战略会议
5. 行动阶段实时监控

这意味着服务器必须原生支持：

- 标准化消息路由
- 部门工作空间/身份建模
- 熵值实时计算
- 决策权重模型
- 周期调度
- 审计与反馈闭环

### 2.4 来自《Cline 工作流标准化开发流程》

改造过程本身也必须遵守：

- **先文档、后实现**
- **A→B→C→D→E 的工作流状态机**
- **三级验证**：
  - 结构验证
  - 接口/契约验证
  - 行为/测试验证

---

## 3. 当前仓库现状总结

`Negentropy-Lab` 已经不是空白项目，它有很多关键基础设施已经到位。

### 3.1 已有优势

1. **Colyseus 基础完备**
   - 已有 `ChatRoom`、`ControlRoom`、`AgentRoom`、`TaskRoom`、`ConfigRoom`、`CronRoom`、`NodeRoom`。
   - 已有 Schema 状态同步、Room 生命周期、定时更新循环。

2. **Gateway 与集群能力已存在**
   - 已有 LAN 发现、Cluster Node、Task Lease、WebSocket 集群广播。
   - 已具备多节点部署和任务转发雏形。

3. **MCP 微内核已存在**
   - `engine/mcp/` 与 `engine/mcp_core/` 已经是可用资产。
   - 这是未来工具层、知识层、执行层统一接入的重要基础。

4. **工作流引擎已存在**
   - `server/gateway/openclaw-orchestration/` 已有运行时、重试、恢复、事件处理。
   - 可作为“编排内核 1.0”继续升级。

5. **审计与签名能力已有局部落地**
   - `openclaw-decision` 已有签名服务与审计日志。
   - 可向全局治理层推广，而不是重复发明。

### 3.2 当前关键不足

当前实现距离“权威智能体协作服务器”仍有结构性缺口：

1. **没有统一的权威根状态**
   - 现在是多个 Room 各管一块状态。
   - 缺少一个统一的 `AuthorityState` / `LifeState` / `SystemState` 根。

2. **Agent 仍偏模拟化**
   - `AgentRoom` 以模拟 provider 初始化系统 Agent。
   - `/api/agents/status` 仍返回静态示例数据。

3. **编排能力仍偏中心化步骤引擎**
   - 现有 workflow step 类型较少，主要还是 `spawn -> await -> join -> complete`。
   - 不足以支撑协议化协同、订阅式事件流、契约网分发、局部自治。

4. **熵值模型过于简化**
   - 当前熵值计算更接近工程健康度指标，而不是面向协作治理的四维/多维熵模型。

5. **治理链条不在状态核心**
   - 冲突提案、沙盒模拟、加权投票、裁决提交尚未成为系统级基础设施。

6. **ToolCallBridge 只有接口，没有系统级实现**
   - 这会导致 MCP 工具调用状态无法成为权威状态的一部分。

7. **安全模型仅局部生效**
   - 服务间签名存在，但尚未推广到 agent-to-agent / workflow-to-tool / node-to-node 授权链。

8. **存储模型缺少“事件源 + 快照 + 投影”分层**
   - 审计日志存在，但全局 mutation/event sourcing 仍未成为一等公民。

---

## 4. 目标架构：Authority Core + Collaboration Mesh

建议将系统升级为以下双层结构：

```text
                ┌─────────────────────────────────────┐
                │         Authority Core              │
                │  Colyseus + State Machine + Policy  │
                │  Mutation Pipeline + Event Store    │
                └─────────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│ Agent Mesh     │   │ Tool / MCP Plane │   │ UI / External API│
│ Sessions       │   │ Registry + Bridge│   │ Gateway + RPC    │
│ Workflow Actors │   │ Execution        │   │ Projections      │
└────────────────┘   └──────────────────┘   └──────────────────┘
```

核心思想：

- **Authority Core** 负责“真相是什么、能不能改、如何广播、如何审计”。
- **Collaboration Mesh** 负责“谁参与、谁接活、怎么协作、怎么调用工具”。
- **UI / API** 不再直连零散状态，而是读取权威状态投影。

---

## 5. 权威核心设计

## 5.1 新增统一根状态 `AuthorityState`

建议新增：

- `server/schema/AuthorityState.ts`
- `server/rooms/AuthorityRoom.ts`

建议状态树：

```text
AuthorityState
├── system
│   ├── mode
│   ├── status
│   ├── time
│   └── version
├── entropy
│   ├── global
│   ├── finance
│   ├── health
│   ├── social
│   ├── task
│   └── thresholds
├── departments
│   ├── treasury
│   ├── internal_affairs
│   ├── foreign_affairs
│   ├── technology
│   ├── supervision
│   └── cabinet
├── agents
│   ├── sessions
│   ├── capabilities
│   ├── presence
│   └── health
├── tasks
│   ├── backlog
│   ├── running
│   ├── blocked
│   └── completed
├── workflows
│   ├── activeRuns
│   ├── waiters
│   └── outputs
├── governance
│   ├── policies
│   ├── mutationQueue
│   ├── proposals
│   ├── approvals
│   └── sanctions
├── tools
│   ├── registry
│   ├── activeCalls
│   └── quotas
└── audit
    ├── eventCursor
    ├── lastDecisionId
    └── integrity
```

### 设计原则

- `ControlRoom`、`AgentRoom`、`TaskRoom` 不再各自成为事实源。
- 它们转为 **投影 Room / 领域视图 Room**。
- 只有 `AuthorityRoom` 能最终提交 mutation。

## 5.2 引入 Mutation Pipeline

建议新增：

- `server/services/authority/MutationPipeline.ts`
- `server/services/authority/PolicyEngine.ts`
- `server/services/authority/ProjectionService.ts`
- `server/services/authority/EventStore.ts`

统一变更生命周期：

```text
Proposal -> Validate -> Simulate -> Vote/Policy -> Commit -> Patch Broadcast -> Audit
```

### 每个 mutation 至少包含

- `mutationId`
- `proposer`
- `targetPath`
- `payload`
- `reason`
- `requiredCapabilities`
- `riskLevel`
- `expectedDeltaEntropy`
- `traceId`

### 好处

- 所有智能体都通过同一条入口改状态。
- 未来无论是 Workflow、Cron、MCP 工具、人工审批，最终都走同一提交链。
- 审计、回滚、重放都变得简单。

## 5.3 从“写状态”升级为“事件源 + 快照 + 投影”

建议存储三层化：

1. **热状态**
   - Redis / Colyseus in-memory
   - 存活中的 Room State、Presence、Lease、Waiter

2. **事件层**
   - PostgreSQL
   - 存 `mutation_events`、`workflow_events`、`tool_call_events`、`agent_presence_events`

3. **投影层**
   - Postgres 物化视图 / Redis projection / 文件快照
   - 供 API、Dashboard、搜索、回放使用

4. **语义记忆层**
   - Chroma / Qdrant
   - 存长期知识摘要、决策经验、相似案例检索

---

## 6. 协作网格设计

## 6.1 Agent 从“模拟对象”升级为“真实会话实体”

建议把 `AgentRoom` 改造成：

- Agent Presence Registry
- Capability Registry
- Session Binding Registry
- Heartbeat / Health Registry

每个 Agent Session 需要具备：

- `agentId`
- `sessionKey`
- `department`
- `role`
- `capabilities`
- `model/provider`
- `trustLevel`
- `lane`
- `currentLoad`
- `lease`
- `lastHeartbeat`

### 连接类型

支持四类客户端统一接入：

1. Python headless agents
2. OpenClaw / 外部决策会话
3. MCP worker / tool worker
4. Browser / control UI observer

## 6.2 从 Orchestration 进化为 Orchestration + Choreography

现有 `openclaw-orchestration` 不应废弃，而应升级为两层：

### Layer A: Workflow Orchestration

用于：

- 明确的、多步骤、需要可回放的长流程
- 晨间简报
- 周度战略会议
- 预算冲突裁决

### Layer B: Protocol Choreography

用于：

- agent-to-agent 事件订阅
- capability-based dispatch
- topic routing
- contract-net / 招标式任务分发
- 工具调用广播

建议新增：

- `server/services/choreography/CollaborationBus.ts`
- `server/services/choreography/CapabilityRouter.ts`
- `server/services/choreography/ProposalBroker.ts`
- `server/services/choreography/SessionEnvelope.ts`

### 新的标准消息信封

```ts
type AgentEnvelope = {
  envelopeId: string;
  traceId: string;
  from: string;
  to?: string;
  topic: string;
  kind: "request" | "response" | "proposal" | "decision" | "event" | "tool";
  schemaVersion: string;
  signature?: string;
  payload: Record<string, unknown>;
  timestamp: number;
};
```

这样可以将“自然语言闲聊”降级为负载，而不是协议本身。

## 6.3 将五个试点场景变成一等工作流

建议把规划文档中的 5 个场景直接落为系统能力：

1. **Morning Brief Workflow**
   - `CronRoom` 触发
   - 各部门 Agent 并行产出报告
   - Cabinet 合成
   - Director 审核/发布

2. **Entropy Circuit Breaker Workflow**
   - `EntropyEngine` 持续计算
   - 超阈值触发 `PolicyEngine`
   - 自动切换系统 mode
   - 限流或冻结高风险 mutation

3. **Budget Arbitration Workflow**
   - Treasury / Internal Affairs 提案
   - 沙盒模拟
   - 加权投票
   - Commit 与执行监督

4. **Weekly Cabinet Workflow**
   - 聚合周报
   - OKR 调整
   - 行政令生成
   - 下发到任务队列

5. **Live Execution Monitoring Workflow**
   - Task 执行前做 entropy estimate
   - 执行中持续更新状态
   - 异常时触发降级、取消或重路由

---

## 7. 熵值与治理模型

## 7.1 将当前 EntropyService 升级为多维熵引擎

当前熵值服务可以保留，但应从“工程健康估计”扩展为：

```text
H_global = w_fin * H_fin
         + w_bio * H_bio
         + w_soc * H_soc
         + w_task * H_task
         + w_sys * H_sys
```

建议新增：

- `server/services/governance/EntropyEngine.ts`
- `server/services/governance/EntropyProjection.ts`

### 维度定义

- `H_fin`: 预算偏离、现金流波动、资源消耗
- `H_bio`: 对应未来健康域，当前可先留接口
- `H_soc`: 社交/协作负载、消息噪声
- `H_task`: backlog、阻塞、返工、超时
- `H_sys`: 节点健康、错误率、延迟、复杂度

### 输出要求

- 当前值
- 变化趋势
- 预测值
- 触发建议
- breaker level

## 7.2 冲突裁决必须成为内建能力

建议新增统一提案模型：

```ts
type ConflictProposal = {
  proposalId: string;
  domain: string;
  options: ProposalOption[];
  votes: DepartmentVote[];
  weightedScore: number;
  expectedEntropyDelta: number;
  status: "draft" | "simulating" | "voting" | "approved" | "rejected" | "committed";
};
```

并引入：

- 沙盒模拟器
- 加权打分
- 裁决解释器
- 执行监督器

这会让“预算冲突裁决”从一次性逻辑变成系统级能力。

---

## 8. 工具层与知识层设计

## 8.1 落地 ToolCallBridge

当前 `IToolCallBridge` 只有接口，建议补齐实现：

- `server/system/ToolCallBridge.ts`
- `server/system/ToolCallRegistry.ts`
- `server/system/ToolCallProjection.ts`

要求：

- 所有 MCP 工具调用都产生权威事件
- 工具调用状态进入 `AuthorityState.tools.activeCalls`
- 支持订阅、超时、并发限制、重试、审计

## 8.2 MCP 不再只是外挂，而是系统“工具平面”

建议明确 MCP 的三种职责：

1. **Resource MCP**：读上下文、读知识、读文件、读系统指标
2. **Action MCP**：执行可审计动作
3. **Governance MCP**：结构验证、契约验证、测试验证、审计查询

这意味着：

- 工具注册表不应只在 Python 侧维护
- Node 权威核心也必须持有工具元数据和执行状态投影

## 8.3 记忆/知识接入方式

建议构建统一的 Context Projection：

- 给 UI：状态投影
- 给 Agent：观测掩码后的上下文切片
- 给 LLM：最小足够序列化
- 给 RAG：检索索引片段

建议新增：

- `server/services/context/ObservationMaskingService.ts`
- `server/services/context/AuthoritySerializer.ts`
- `server/services/context/DecisionContextBuilder.ts`

---

## 9. 安全与零信任设计

## 9.1 从服务签名扩展到智能体签名

现有 `openclaw-decision` 的签名能力可复用，但需要推广到：

- agent-to-server
- agent-to-agent
- workflow-to-tool
- node-to-node internal dispatch

建议新增：

- `server/services/security/AgentIdentityService.ts`
- `server/services/security/DelegationTokenService.ts`
- `server/services/security/CapabilityGrantService.ts`

### 核心规则

1. 每个 agent session 都有唯一身份
2. 高风险 mutation 必须携带 capability grant
3. 跨节点转发必须保留原始 trace / signature / delegation chain
4. 所有决策都可追溯到“谁提议、谁批准、谁执行”

## 9.2 权限模型

建议将权限拆成：

- `observe:*`
- `propose:*`
- `commit:*`
- `invoke:tool:*`
- `govern:*`
- `dispatch:*`

这样系统可以同时支持：

- UI 观察者
- 部门 Agent
- 内阁协调 Agent
- 办公厅主任 / 管理者
- 外部桥接系统

---

## 10. 对现有模块的具体改造建议

## 10.1 保留并升级的模块

- `server/bootstrap/createNegentropyServer.ts`
  - 保留为统一装配入口
  - 新增 `AuthorityRoom` 注册
  - 注入新的治理/投影/安全服务

- `server/cluster/*`
  - 保留为多节点基础设施
  - 升级为支持 authority event replication 与 cross-node proposal routing

- `server/gateway/openclaw-orchestration/*`
  - 保留为工作流层
  - 扩展 trigger type、step type、事件订阅与 choreography hook

- `engine/mcp_core/*`
  - 保留为工具平面基础
  - 统一纳入 ToolCallBridge 与权威审计链

## 10.2 需要从“事实源”降级为“投影层”的模块

- `ControlRoom`
- `AgentRoom`
- `TaskRoom`
- `ConfigRoom`

这些 Room 不应再分别持有最终真相，而应：

- 读取 `AuthorityState`
- 输出领域投影
- 提交 mutation 请求
- 接收 patch / decision / audit 更新

## 10.3 需要新增的核心模块

建议最小新增目录：

```text
server/
├── rooms/
│   └── AuthorityRoom.ts
├── schema/
│   └── AuthorityState.ts
├── services/
│   ├── authority/
│   │   ├── MutationPipeline.ts
│   │   ├── EventStore.ts
│   │   ├── ProjectionService.ts
│   │   └── PolicyEngine.ts
│   ├── choreography/
│   │   ├── CollaborationBus.ts
│   │   ├── CapabilityRouter.ts
│   │   └── ProposalBroker.ts
│   ├── context/
│   │   ├── ObservationMaskingService.ts
│   │   ├── AuthoritySerializer.ts
│   │   └── DecisionContextBuilder.ts
│   ├── governance/
│   │   ├── EntropyEngine.ts
│   │   ├── ConflictResolver.ts
│   │   └── BreakerService.ts
│   └── security/
│       ├── AgentIdentityService.ts
│       ├── DelegationTokenService.ts
│       └── CapabilityGrantService.ts
└── system/
    ├── ToolCallBridge.ts
    └── ToolCallRegistry.ts
```

---

## 11. 分阶段迁移路线

## Phase 16：建立 Authority Core 骨架

目标：先建立单一权威根，不马上大改业务流。

### 交付

- `AuthorityState`
- `AuthorityRoom`
- `MutationPipeline` 最小闭环
- `EventStore` 最小实现
- `ControlRoom / AgentRoom / TaskRoom` 接入 root projection

### 验收

- 所有状态变更可追踪到 mutationId
- UI/房间可从 root 投影得到一致结果
- 没有模块绕过权威状态直接改事实

## Phase 17：Agent Runtime 与 Tool Plane 落地

目标：让智能体从“模拟对象”变成“真实会话实体”。

### 交付

- Agent session registry
- heartbeat/lease/health
- ToolCallBridge 实现
- MCP registry 投影
- capability-based dispatch

### 验收

- Agent 可真实注册、掉线、恢复
- 工具调用有完整事件链
- 任务分派基于 capability 而不是硬编码

## Phase 18：治理与协同升级

目标：把“协作”变成系统级治理能力。

### 交付

- 新 EntropyEngine
- ConflictResolver
- BreakerService
- Proposal / Vote / Decision 模型
- 晨间简报与熵值熔断两个试点工作流

### 验收

- 熵值超阈值时自动触发策略
- 冲突提案可模拟、可投票、可裁决
- 两个试点工作流可端到端跑通

## Phase 19：从编排走向协同

目标：在保留工作流引擎的同时，引入协议化协同。

### 交付

- CollaborationBus
- AgentEnvelope 标准
- topic subscription
- direct agent messaging
- workflow ↔ choreography bridge

### 验收

- 部分场景无需中央 orchestrator 逐步推进
- agent 可基于 topic 与 capability 自主协同
- 所有协作仍受 authority core 约束

## Phase 20：多节点权威复制与生产就绪

目标：把单节点权威升级为可复制的权威集群。

### 交付

- authority event replication
- cross-node proposal routing
- snapshot / replay / recovery
- 灰度、回滚、压测、故障演练

### 验收

- 单节点故障不丢失权威事件
- 工作流可恢复
- 审计链不断裂

---

## 12. 与现有文件的直接映射关系

### 推荐优先处理文件

- `server/bootstrap/createNegentropyServer.ts`
- `server/rooms/AgentRoom.ts`
- `server/rooms/TaskRoom.ts`
- `server/rooms/ControlRoom.ts`
- `server/cluster/ClusterTaskDispatcher.ts`
- `server/cluster/TaskLeaseManager.ts`
- `server/gateway/openclaw-orchestration/contracts/workflow-contract.ts`
- `server/gateway/openclaw-orchestration/service/orchestration-service.ts`
- `server/types/system/IToolCallBridge.ts`
- `server/gateway/monitoring/core/EntropyService.ts`

### 改造原则

1. 先加 `AuthorityRoom`，再改旧 Room
2. 先改“写入路径”，再改“读取路径”
3. 先让现有 API 兼容 root projection，再逐步淘汰旧事实源
4. 先打通两个试点场景，再扩到全部部门/域

---

## 13. 验收标准

当以下条件成立时，才算真正成为“文档中规划的权威服务器”：

### 13.1 架构验收

- 存在单一权威根状态
- 所有 mutation 统一入管道
- 所有房间/接口读取投影而非私有真相

### 13.2 协作验收

- agent 能真实注册、发现、路由、协作
- workflow 与 choreography 可以共存
- 至少 5 个试点场景中的 3 个稳定运行

### 13.3 治理验收

- 熵值模型具备多维权重
- 冲突裁决具备提案/模拟/决策/执行监督
- 审计链支持 trace 查询与回放

### 13.4 安全验收

- 关键操作具备签名/授权链
- 能区分观察、提案、提交、执行权限
- 跨节点转发保留 trace 与 delegation 信息

### 13.5 开发流程验收

- 结构检查通过
- 契约检查通过
- 行为测试通过
- 文档与实现同步更新

---

## 14. 结论

`Negentropy-Lab` 现在最有价值的，不是“缺少能力”，而是**能力很多，但缺少一个统一的权威状态核心来组织这些能力**。

因此这次改造不应被理解为“再加一个大 orchestrator”，而应理解为：

> **把现有 Colyseus、Cluster、MCP、Workflow、Audit、Gateway 这些分散能力，收束到一个可验证、可投影、可治理的 Authority Core 之下。**

这条路线既符合规划文档中的权威服务器范式，也吸收了“从编排到协同”的演进方向，能让 `Negentropy-Lab` 从一个“功能很多的后端”，进化为一个真正的 **智能体协作操作系统内核**。
