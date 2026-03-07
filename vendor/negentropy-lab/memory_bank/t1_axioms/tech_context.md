# 技术上下文 - Negentropy-Lab Tech Context

**版本**: v7.6.0-dev (Phase 13 批次验收完成)
**最后更新**: 2026-03-03
**状态**: ✅ Phase 13 批次验收完成（Batch 1-5全绿，三仓联调全部通过，OpenClaw symlink阻塞已清零）
**宪法依据**: §104功能分层拓扑公理、§107通信安全公理、§108异构模型策略、§114双存储同构公理、§190网络韧性公理、§306零停机协议、§501-§506监控系统系列公理、§130-§132 MCP微内核公理
**整合内容**: agent_reference_index.md + mcp_reference_index.md

---

## 1. 概述

本文件定义了Negentropy-Lab项目的技术架构和技术栈约束。根据基本法§104功能分层拓扑公理，系统严格遵循T0-T3四层架构体系，确保系统的可扩展性、可维护性和宪法合规性。

### 1.1 核心原则
1. **分层架构**: 严格遵循T0-T3四层架构，层级间单向依赖
2. **单一真理源**: 所有配置和规范集中管理，避免信息分散
3. **熵减优化**: 所有架构变更必须降低或维持系统熵值
4. **韧性设计**: 系统必须具备网络级别的容错和恢复能力

### 1.2 技术栈约束
```typescript
// 技术栈约束断言
assert(architectureLayer in ['T0', 'T1', 'T2', 'T3'], "必须遵循四层架构");
assert(protocol in ['WebSocket', 'HTTP'], "必须使用标准协议");
assert(pluginCompliance === true, "插件必须符合宪法合规");
assert(monitoringEnabled === true, "必须启用监控和审计");
```

### 1.3 2026-03-02 Gateway 分批次开发更新
本次按批次连续开发并完成端到端验收，核心增量如下：
1. **批次1（P0 RPC补齐）**: 新增 `auth.login/logout/validate`、`session.create/get`、`health.check/status`，补齐基础控制平面调用能力。
2. **批次2（性能与协议强化）**: WebSocket服务接入 `permessage-deflate` 配置，新增传输层消息/字节/连接峰值指标，并在 `channels.status` 暴露。
3. **批次3（LLM可靠性）**: 新增模型失败冷却窗口与自动跳过机制，提供 `models.failover.status/reset` 可观测与控制能力，`models.list` 附带 failover 快照。
4. **批次4（UI闭环支撑）**: 新增 `dashboard.metrics` 聚合指标、`gateway.mode.get/set` 与 `gateway.switch`，支持 Direct/Colyseus 切换器。
5. **批次5（发布验收）**: 完成 E2E + 集成 + 契约 + 批次专项回归，形成发布前验收基线。
6. **批次6（P1/P2 RPC缺口补齐）**: 新增 `agent.history`、`agent.config`、`task.history`、`task.dependencies`、`channels.create`、`channels.close`、`channels.list`、`models.register`、`models.deregister`、`models.capabilities`、`config.validate`、`config.history`、`health.metrics`、`system.config`、`system.version`、`system.logs`、`system.metrics`、`usage.stats`、`usage.budget`、`cron.create`、`cron.delete`、`cron.history`、`node.status`、`node.register`、`node.deregister`。
7. **批次7（测试债务治理首轮）**: 补齐测试依赖兼容层与mock映射，保障Gateway主干回归稳定。
8. **批次8（快速收敛）**: 收敛 `BaseAgent/benchmark/constitution` 失败簇，修复路径漂移与环境耦合断言。
9. **批次9（插件路径修复）**: `PluginLoader` 改为基于 `manifestPath` 解析 `entryPoint`，并兼容 `module.exports/exports/default` 导出。
10. **批次10（缓存与遗留治理）**: 修复 `MemoryCache` LRU 与 `RedisCache` 前缀扫描问题；遗留高漂移套件建立治理入口。
11. **批次11（Agent 套件回补）**: 重写 `tests/unit/agents/AgentEngine.test.ts.backup` 与 `tests/unit/agents/BaseAgent.test.ts.backup`（当前仓保留归档副本），对齐当期实现契约并解除默认skip。
12. **批次12（失败恢复验收稳态）**: 修复失败恢复重试事件抖动断言，完成全量回归 `failed=0` 收敛（证据链见 `failed-suite-results-latest.json`）。
13. **Phase 6-1（跨仓 UI 集成验收）**: `opendoge-ui` Desk/Web 接入 `ui.state.*` 与 `dashboard.metrics`，跨端 E2E 全绿。
14. **Phase 6-2/6-3/6-4（运营化收口）**: 契约守护、性能流水线、部署与回滚演练链路全部验收通过。
15. **Phase 7（连续批次执行）**: 完成 OPS-71~74、RPC-71~73、TG-71~73；新增 `check:contract:drift` 与 nightly 漂移留痕，修复测试抖动点后全量矩阵复验通过。
16. **Phase 8（连续批次执行）**: 完成 OPS-81~84、RPC-81~83、TG-81~83；新增 `ops:preflight:prod`、`ops:deploy:smoke`、`report:contract:monthly`、`report:testdebt:skip`、`report:perf:trend`，并完成主仓+跨仓全链路验收。

**当前本地回归快照（2026-03-03，`npm test -- --run`）**:
- 测试文件：`15 passed`
- 断言分布：`273 passed`
- 失败套件：`0`

### 1.4 仓库边界说明（避免实现误读）
- 本仓库定位为后端/API-only与网关运行时实现。
- 前端位于`/home/wsman/OpenDoge/opendoge-ui`（Linux环境）或`D:\Users\WSMAN\Desktop\OpenDoge\opendoge-ui`（Windows环境）。
- `t2_standards`中涉及前端的DS文档属于跨仓规范，不代表当前仓库已落地对应前端代码。

---

## 2. 四层技术架构

### 2.1 T0核心意识层
**用途**: 常驻内存，系统自我意识
**位置**: `memory_bank/t0_core/`
**宪法依据**: §152单一真理源公理

**核心文件**:
- `active_context.md`: 当前系统状态与任务
- `basic_law_index.md`: 核心公理与架构约束
- `procedural_law_index.md`: 工作流与操作流程
- `technical_law_index.md`: 开发标准与规范
- `knowledge_graph.md`: 系统实体关联导航

**设计约束**:
- 所有宪法文件必须集中存储在此目录
- 文件变更必须触发全体系同步扫描
- 必须保持与.clinerules文件的同步

### 2.2 T1索引与状态层
**用途**: 高频检索，系统状态跟踪
**位置**: `memory_bank/t1_axioms/`
**宪法依据**: §109知识图谱公理、§110协作效率公理

**核心文件**:
- `tech_context.md`: 技术栈约束（本文件，整合Agent与MCP工具链）
- `behavior_context.md`: Agent协作行为规范
- `CONCEPTS.md`: 核心概念定义
- `GLOSSARY.md`: 术语表

**设计约束**:
- 支持高频检索操作
- 状态信息必须实时更新
- 必须与T0层保持一致性

### 2.3 T2执行规范层
**用途**: 按需加载，开发标准与工作流
**位置**: `memory_bank/t2_protocols/`, `memory_bank/t2_standards/`
**宪法依据**: §201 CDD流程、§306零停机协议

**目录结构**:
- `memory_bank/t2_protocols/`: 执行工作流与专题流程文档
- `memory_bank/t2_standards/`: 开发标准实现（DS-01到DS-204）

**设计约束**:
- 按需加载，减少内存占用
- 支持热重载和零停机更新
- 标准必须可验证和可执行

### 2.4 T3分析与归档层
**用途**: 离线存储，文档与归档
**位置**: `memory_bank/t3_documentation/`
**宪法依据**: §141熵减验证公理

**设计约束**:
- 支持历史版本归档
- 支持离线分析和审计
- 必须保持与T0-T2层的数据一致性

---

## 3. Gateway生态系统技术栈

### 3.1 核心架构组件
```
┌─────────────────────────────────────────────────────────┐
│                 Gateway生态系统层                        │
├─────────────────────────────────────────────────────────┤
│  WebSocket网关  │ HTTP API │ 认证系统  │ 插件系统 │ 监控系统 │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                  Agent三层架构层                         │
├─────────────────────────────────────────────────────────┤
│ L1入口层(办公厅主任) │ L2协调层(内阁总理) │ L3专业层(3部门) │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                    LLM集成层                            │
├─────────────────────────────────────────────────────────┤
│ LLMService │ ModelSelectorService │ 成本优化 │ 性能监控 │
└─────────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────┐
│                  知识库管理层                           │
├─────────────────────────────────────────────────────────┤
│ 法典内核 │ 记忆库 │ 工作流系统 │ 版本控制 │ 宪法合规检查 │
└─────────────────────────────────────────────────────────┘
```

### 3.2 通信协议技术栈
**宪法依据**: §107通信安全公理、§108异构模型策略

#### 3.2.1 WebSocket协议（当前实现）
- **入口**: `src/index.ts` (默认开发入口)
- **路径**: `/ws`
- **协议**: 自定义消息类型协议（非JSON-RPC）
- **消息格式**: `{ type: string, payload: any, timestamp: number }`
- **支持消息**: `subscribe`, `unsubscribe`, `ping`, `connected`, `subscribed`, `unsubscribed`, `pong`
- **特性**: 心跳机制、主题订阅、广播功能

#### 3.2.2 Gateway WebSocket（当前实现，已启用）
- **入口**: `server/gateway/index.ts` → `server/gateway/server.impl-with-ws.ts`
- **状态**: 已启用，默认挂载到Gateway HTTP服务器
- **协议**: RPC消息帧（`type/id/method/ok/result/error`）
- **认证**: 当前`websocket-handler`为测试凭据路径（`test-token/test-admin-token/test-pass`）；JWT/统一认证管理器已实现于`server/gateway/auth/`但未接入该路径

#### 3.2.3 HTTP REST API
- **端口**: Gateway服务端口
- **协议**: OpenAI风格HTTP端点（当前为简化实现）
- **认证**: 目标为Bearer Token/JWT；当前实现以简化路由为主
- **特性**: 当前返回mock风格响应；完整流式与状态同步能力持续完善

#### 3.2.4 双入口说明
- **简单入口**: `src/index.ts` → 简单WebSocket服务（自定义协议）
- **Gateway入口**: `server/gateway/index.ts` → 完整Gateway生态系统（HTTP + WebSocket RPC + 插件 + 监控）
- **Colyseus入口**: `server/index.ts` → API-only + 房间/Agent集成服务

### 3.3 插件系统技术栈
**宪法依据**: §501插件系统公理、§502插件宪法合规公理、§503零停机热重载公理

#### 3.3.1 插件类型
1. **HTTP_MIDDLEWARE**: Express中间件插件
2. **WEBSOCKET_MIDDLEWARE**: WebSocket消息处理中间件插件
3. **EVENT_HANDLER**: 事件处理器插件
4. **SCHEDULED_TASK**: 定时任务插件
5. **DATA_TRANSFORMER**: 数据转换插件
6. **EXTERNAL_INTEGRATION**: 外部系统集成插件
7. **MONITORING**: 监控插件
8. **LOGGING**: 日志插件
9. **SECURITY**: 安全策略插件

#### 3.3.2 插件管理组件
- **PluginManager**: 插件生命周期管理
- **PluginRegistry**: 插件注册和依赖管理
- **PluginValidator**: 插件宪法合规验证
- **HotReloadWatcher**: 热重载目录监听（当前为待实现占位）

### 3.4 监控系统技术栈
**宪法依据**: §504监控系统公理、§505熵值计算公理、§506成本透视公理

#### 3.4.1 核心组件
- **ConstitutionMonitor**: 宪法合规引擎
- **EntropyService**: 四维熵值计算服务
- **CostTracker**: 令牌成本统计系统
- **PerformanceMonitor**: 性能监控系统

#### 3.4.2 集成状态说明
- 监控核心组件代码已实现于`server/gateway/monitoring/`
- 默认主服务路径中监控服务装配持续完善，能力以已挂载路由与测试为准

#### 3.4.3 监控指标
1. **宪法合规率**: 代码文件宪法引用完整性
2. **系统熵值**: 四维熵值综合指标
3. **Token成本**: LLM API调用成本统计
4. **响应延迟**: API平均响应时间
5. **服务可用性**: 系统正常运行时间

---

## 4. Agent系统技术实现

### 4.1 三层架构概述
**宪法依据**: §183-§186网关与协调层职责、§110协作效率公理

三层Agent架构是基于Negentropy-Lab实验验证的简化协作模型，旨在优化复杂系统的Agent协作效率。

```mermaid
graph TD
    A[用户请求] --> B[L1: 办公厅主任Agent]
    B -->|简单任务<br/>复杂度 ≤ 7| C[L3: 专业Agent<br/>(监察部/科技部/组织部)]
    B -->|复杂任务<br/>7 < 复杂度 ≤ 9| D[L2: 内阁总理Agent]
    D --> E[L3: 专业Agent集群]
    C --> F[响应整合]
    E --> F
    F --> G[用户响应]
    
    style B fill:#e1f5fe
    style D fill:#f3e5f5
    style C fill:#e8f5e8
    style E fill:#e8f5e8
```

#### 4.1.1 L1入口层：办公厅主任Agent
**身份标识**: `agent:office_director`
**核心职责**:
- 统一用户对话入口，所有用户请求的统一接收和分发点
- 意图识别与复杂度评估，根据复杂度决定路由策略
- 智能路由决策，直接路由到专业Agent或转交内阁总理
- 对话历史管理，维护完整的对话历史和知识归档
- 宪法合规检查，确保所有操作符合宪法核心公理
- 网络韧性保障，实施网络防御和错误隔离机制

**复杂度阈值配置**:
```typescript
const COMPLEXITY_THRESHOLDS = {
  directRoute: 7,    // 复杂度 ≤ 7: 直接路由到专业Agent
  primeMinister: 9,  // 7 < 复杂度 ≤ 9: 转交内阁总理协调
  manualReview: 10   // 复杂度 > 9: 人工审核
};
```

#### 4.1.2 L2协调层：内阁总理Agent
**身份标识**: `agent:prime_minister`
**核心职责**:
- 复杂任务协调，处理复杂度超过阈值的跨部门任务
- 专业Agent调度，根据任务需求调度合适的专业Agent
- 冲突解决与仲裁，解决专业Agent间的意见分歧和资源竞争
- 宪法最终审查，执行最终宪法合规性审查
- 战略决策支持，提供系统级战略建议和演进规划
- 资源优化与降级管理，动态分配资源，监控系统健康度

**协调策略配置**:
```typescript
enum CoordinationStrategy {
  STRATEGIC = 'strategic',      // 战略策略：选择分数最高的Agent
  CONSENSUS = 'consensus',      // 共识策略：确保所有专业领域都有代表
  HIERARCHICAL = 'hierarchical', // 层级策略：优先选择宪法合规率高的Agent
  ADAPTIVE = 'adaptive'         // 自适应策略：综合考虑多个因素
}
```

#### 4.1.3 L3专业层：各部委专业Agent

**监察部 Agent** (`agent:supervision_ministry`):
- 宪法解释、合规检查、法律风险分析、公理推理、安全审计
- 宪法依据: §100-§199基本法核心公理
- 调用时机: 涉及知识库结构修改、公理引用、宪法合规检查

**科技部 Agent** (`agent:technology_ministry`):
- 技术实现、代码生成、技术分析、质量评估、性能优化
- 宪法依据: §300-§399技术法实现标准
- 调用时机: 技术问题、代码生成需求、技术可行性评估

**组织部 Agent** (`agent:organization_ministry`):
- 架构设计、图谱分析、架构治理、系统扩展、同构验证
- 宪法依据: §114双存储同构公理、§141熵减验证公理
- 调用时机: 架构调整、图谱优化、系统扩展、技术选型讨论

### 4.2 Agent接口规范
**详细接口规范请参考以下标准文档**:

- **DS-100**: Agent接口规范 ([memory_bank/t2_standards/DS-100_agent_interface.md](../t2_standards/DS-100_agent_interface.md))
- **DS-101**: 内阁总理Agent接口规范 ([memory_bank/t2_standards/DS-101_prime_minister_agent_interface.md](../t2_standards/DS-101_prime_minister_agent_interface.md))
- **DS-102**: 办公厅主任Agent接口规范 ([memory_bank/t2_standards/DS-102_director_general_agent_interface.md](../t2_standards/DS-102_director_general_agent_interface.md))
- **DS-103**: 智能路由算法标准实现 ([memory_bank/t2_standards/DS-103_intelligent_routing.md](../t2_standards/DS-103_intelligent_routing.md))

**核心接口概览**:
- L1办公厅主任: `GatewayLayerAgent` - 分析用户消息、路由决策、历史管理、宪法合规
- L2内阁总理: `CoordinationLayerAgent` - 协调计划执行、专业Agent管理、宪法监督、降级管理
- L3专业Agent: `SpecialistLayerAgent` - 专业任务执行、领域知识管理、领域合规验证

### 4.3 Agent命名与术语规范

#### 4.3.1 中英文对照表

| 官方中文 | 英文官方 | 身份标识 | 宪法条款 | 层级 |
|----------|----------|----------|----------|------|
| **办公厅主任** | Office Director Agent | `agent:office_director` | §183-§186 | L1 |
| **内阁总理** | Prime Minister Agent | `agent:prime_minister` | §184-§185 | L2 |
| **监察部** | Supervision Ministry Agent | `agent:supervision_ministry` | §100-§199 | L3 |
| **科技部** | Technology Ministry Agent | `agent:technology_ministry` | §300-§399 | L3 |
| **组织部** | Organization Ministry Agent | `agent:organization_ministry` | §114, §141 | L3 |

#### 4.3.2 文件命名规范
- **类型定义文件**: `{Role}AgentTypes.ts` (示例: `OfficeDirectorAgentTypes.ts`)
- **实现文件**: `{Role}Agent.ts` (示例: `OfficeDirectorAgent.ts`)
- **配置接口**: `{Role}AgentConfig.ts` (示例: `OfficeDirectorAgentConfig.ts`)

#### 4.3.3 代码命名规范
- **类名**: 使用PascalCase，包含"Agent"后缀 (示例: `class OfficeDirectorAgent`)
- **变量名**: 使用camelCase (示例: `const officeDirector = new OfficeDirectorAgent()`)
- **常量名**: 使用UPPER_SNAKE_CASE (示例: `const AGENT_ROLES = { OFFICE_DIRECTOR: 'office_director' }`)

#### 4.3.4 身份标识规范
所有Agent必须使用以下格式的身份标识：`agent:{role_name}`

**有效示例**:
- `agent:office_director`
- `agent:prime_minister`
- `agent:supervision_ministry`
- `agent:technology_ministry`
- `agent:organization_ministry`

### 4.4 熵减验证
**综合熵值变化**: $\Delta H = H_{传统} - H_{三层} = +0.11 > 0$ ✅

| 熵维度 | 传统架构熵值 | 三层架构熵值 | 熵减 $\Delta H$ | 优化说明 |
|--------|--------------|--------------|-----------------|----------|
| **认知负载熵** | 0.35 | 0.15 | **+0.20** | 架构简化，认知复杂度降低 |
| **协作效率熵** | 0.25 | 0.10 | **+0.15** | 协作流程优化，开销减少 |
| **架构一致性熵** | 0.22 | 0.11 | **+0.11** | 架构定义更清晰一致 |

**性能优化证明**:
1. **协作开销减少**: $C_{三层} = 0.4 \times C_{传统}$ (减少60%)
2. **响应时间优化**: $T_{三层} = 0.6 \times T_{传统}$ (提升40%)
3. **内存占用优化**: $M_{三层} = 0.5 \times M_{传统}$ (减少50%)

### 4.5 LLM集成策略
**宪法依据**: §108异构模型策略、§108.1模型参数强制指定子原则

**模型选择**:
- **Director**: `google-antigravity/gemini-3-pro-high` (Tier 0)
- **执行Agents**: `google-antigravity/gemini-3-flash` (Tier 1/2)
- **外交部**: `minimax/MiniMax-M2.1` (Tier 1)
- **监督部**: `google-antigravity/gemini-2.5-flash-thinking` (Tier 2)

**参数强制指定**:
- 所有sessions_spawn操作必须显式指定model参数
- 禁止依赖系统默认配置
- 引用DS-45模型选择器接口标准（并结合DS-24 ModernModelSelector实现）

---

## 5. 数据存储与持久化

### 5.1 双存储同构模式 (§114)
**宪法依据**: §114双存储同构公理、§125数据完整性公理

#### 5.1.1 内存存储
- **用途**: 高频访问的活跃数据
- **特性**: 快速访问，实时同步
- **实现**: Redis/内存数据库
- **数据**: 会话状态、Agent状态、实时监控数据

#### 5.1.2 持久存储
- **用途**: 持久化的重要数据
- **特性**: 数据安全，版本控制
- **实现**: PostgreSQL/文件系统
- **数据**: 知识库文件、配置信息、历史记录

#### 5.1.3 同步机制
- 内存变更自动同步到持久存储
- 持久存储变更触发内存刷新
- 原子性保证数据一致性
- 冲突检测和自动解决

### 5.2 知识库存储架构
**详细标准请参考**: DS-19双存储双射映射、DS-20自动化架构同步、DS-21双存储同构验证

```
┌─────────────────────────────────────────────────────────┐
│                   知识库存储架构                         │
├─────────────────────────────────────────────────────────┤
│ 内存缓存层  │ 文件系统层 │ 版本控制层 │ 备份恢复层 │
└─────────────────────────────────────────────────────────┘
```

#### 5.2.1 分层存储
1. **内存缓存层**: 热点数据缓存，快速访问
2. **文件系统层**: 结构化文件存储，小写下划线命名
3. **版本控制层**: Git版本控制，变更历史追踪
4. **备份恢复层**: 定期备份，灾难恢复

#### 5.2.2 文件组织
- **宪法文件**: `memory_bank/t0_core/` (小写下划线格式)
- **公理文件**: `memory_bank/t1_axioms/`
- **协议文件**: `memory_bank/t2_protocols/`
- **标准文件**: `memory_bank/t2_standards/`
- **归档文件**: `memory_bank/t3_documentation/`

---

## 6. 部署与运维

### 6.1 容器化部署
**宪法依据**: §306零停机协议、§381安全公理

#### 6.1.1 三服务架构
1. **Gateway服务**: WebSocket + HTTP + 认证 + 插件
2. **Agent服务**: Agent引擎 + LLM集成 + 协作系统
3. **监控服务**: 宪法合规监控 + 熵值计算 + 成本追踪

#### 6.1.2 Docker配置
- **基础镜像**: Node.js 18+ Alpine
- **多阶段构建**: 优化镜像大小
- **健康检查**: 服务健康状态监控
- **资源限制**: CPU/内存限制，避免资源耗尽

### 6.2 服务发现与负载均衡
**宪法依据**: §190网络韧性公理

#### 6.2.1 服务注册
- **注册中心**: 服务实例自动注册
- **健康检查**: 定期健康状态检查
- **心跳机制**: 服务存活状态监控

#### 6.2.2 负载均衡
- **轮询调度**: 简单轮询负载均衡
- **权重调度**: 基于权重的智能调度
- **故障转移**: 自动故障检测和转移

### 6.3 监控与告警
#### 6.3.1 监控层级
1. **基础设施监控**: CPU/内存/磁盘/网络
2. **应用监控**: 服务响应时间/错误率/吞吐量
3. **业务监控**: 宪法合规率/系统熵值/协作成功率
4. **安全监控**: 认证失败/权限违规/异常访问

#### 6.3.2 告警策略
- **级别分类**: 信息/警告/错误/紧急
- **通知渠道**: 邮件/Slack/Webhook
- **静默规则**: 维护窗口静默配置
- **升级策略**: 未处理告警自动升级

---

## 7. 安全架构

### 7.1 认证与授权
**宪法依据**: §107通信安全公理、§381安全公理

#### 7.1.1 认证机制
- **Token认证**: JWT Token，有效期控制
- **密码认证**: 加密存储，盐值哈希
- **双因素认证**: 可选双因素认证
- **会话管理**: 会话超时，自动续期

#### 7.1.2 权限体系
- **三级权限**: 只读/写入/管理
- **角色管理**: 预定义角色，自定义角色
- **资源授权**: 细粒度资源访问控制
- **审计日志**: 完整的权限操作审计

### 7.2 数据安全
#### 7.2.1 传输安全
- **TLS加密**: HTTPS/WSS强制加密
- **消息加密**: 敏感消息端到端加密
- **密钥管理**: 安全的密钥存储和轮换

#### 7.2.2 存储安全
- **数据加密**: 敏感数据存储加密
- **访问控制**: 文件系统访问权限控制
- **备份加密**: 备份数据加密存储

### 7.3 审计与合规
#### 7.3.1 审计日志
- **操作审计**: 所有关键操作记录
- **安全审计**: 安全相关事件记录
- **性能审计**: 性能指标记录
- **宪法审计**: 宪法合规检查记录

#### 7.3.2 合规检查
- **实时检查**: 实时宪法合规监控
- **定期扫描**: 定期全系统安全扫描
- **漏洞管理**: 漏洞发现和修复跟踪
- **合规报告**: 自动生成合规报告

---

## 8. API接口定义

### 8.1 WebSocket RPC接口
**协议规范**:
```typescript
interface WsRpcMessage {
  type: "request" | "response" | "event";
  id?: string;
  method?: string;
  params?: any;
  ok?: boolean;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  event?: string;
  payload?: any;
}
```

### 8.2 HTTP REST API接口
**OpenAI兼容端点**:
```typescript
// 聊天补全
POST /v1/chat/completions
{
  "model": "gemini-3-flash",
  "messages": [...],
  "stream": true
}

// 模型列表
GET /v1/models
```

### 8.3 插件系统接口
**插件注册接口**:
```typescript
interface PluginRegistration {
  id: string;
  name: string;
  type: PluginType;
  version: string;
  constitutionCompliance: boolean;
  dependencies: string[];
}

enum PluginType {
  HTTP_MIDDLEWARE,
  WEBSOCKET_MIDDLEWARE,
  EVENT_HANDLER,
  SCHEDULED_TASK,
  DATA_TRANSFORMER,
  EXTERNAL_INTEGRATION,
  MONITORING,
  LOGGING,
  SECURITY
}
```

### 8.4 监控系统接口
**宪法监控接口**:
```typescript
interface ConstitutionMonitor {
  checkCompliance(filePath: string): ComplianceResult;
  scanProject(): ComplianceReport;
  getMetrics(): ComplianceMetrics;
}
```

**熵值计算接口**:
```typescript
interface EntropyService {
  calculateEntropy(): EntropyScore;
  getTrend(): EntropyTrend;
  checkThreshold(threshold: number): boolean;
}

interface EntropyScore {
  H_struct: number;  // 结构熵
  H_align: number;   // 同步熵
  H_know: number;    // 知识熵
  H_resource: number; // 资源熵
  H_sys: number;     // 系统总熵
}
```

---

## 9. 技术标准与约束

### 9.1 开发标准
**宪法依据**: §201 CDD流程、§306零停机协议

**CDD开发流程**:
```
需求接收 → 宪法合规分析 → 技术方案设计 → 
资产库搜索 → 开发实施 → CDD验证 → 文档更新 → 
零停机部署 → 监控反馈
```

**零停机部署约束**:
- 后端修改 → 临时端口/独立进程测试 → 验证 → 热重载主服务
- 前端必须集成Service Worker或本地状态管理
- 禁止直接修改运行中的主服务实例

### 9.2 LLM集成规范
**模型选择标准**:
- Director: Tier 0模型（gemini-3-pro-high）
- 执行Agents: Tier 1/2模型（gemini-3-flash等）
- 特殊场景: 根据DS-45模型选择器接口标准与DS-24 ModernModelSelector实现选择

**参数约束**:
- 所有sessions_spawn必须显式指定model参数
- 温度参数根据任务类型调整（0.0-1.0）
- MaxTokens根据复杂度动态调整

### 9.3 性能约束
**响应时间约束**:
- 办公厅主任: < 10秒
- 内阁总理: < 30秒
- 监察部Agent: < 20秒
- 科技部Agent: < 25秒
- 组织部Agent: < 30秒

**资源使用约束**:
- CPU使用率 < 80%
- 内存使用率 < 85%
- 响应延迟 < 3秒（P99）

### 9.4 安全约束
**加密要求**:
- 所有传输必须使用TLS 1.3+
- 敏感数据必须加密存储
- 密钥必须定期轮换

**访问控制**:
- 最小权限原则
- 定期审计访问日志
- 异常访问实时告警

---

## 10. MCP工具链

### 10.1 MCP工具链概述
**宪法依据**: §130 MCP微内核神圣公理、§131 MCP绝对冷启动原则、§132 MCP架构原则
**版本**: v7.0.0
**工具总数**: 5

MCP微内核提供了一组确定性的原子工具，分为三级治理体系（遵循§132 MCP架构原则）。

### 10.2 工具分类索引

**详细MCP工具文档请参考以下标准**:

- **DS-200**: MCP概览与宪法基础 ([memory_bank/t2_standards/DS-200_mcp_overview.md](../t2_standards/DS-200_mcp_overview.md))
- **DS-201**: 监察部工具 ([memory_bank/t2_standards/DS-201_iab_tools.md](../t2_standards/DS-201_iab_tools.md))
- **DS-202**: 创世协议工具 ([memory_bank/t2_standards/DS-202_genesis_protocol.md](../t2_standards/DS-202_genesis_protocol.md))
- **DS-203**: 司法验证工具 ([memory_bank/t2_standards/DS-203_judicial_verification.md](../t2_standards/DS-203_judicial_verification.md))
- **DS-204**: MCP服务器配置与运维 ([memory_bank/t2_standards/DS-204_mcp_server_ops.md](../t2_standards/DS-204_mcp_server_ops.md))

**MCP工具库详细文档**: `memory_bank/t2_standards/DS-200_mcp_overview.md` 到 `memory_bank/t2_standards/DS-204_mcp_server_ops.md`

### 10.3 工具分类总览

#### Tier 1 核心工具（宪法驱动开发强制调用）
| 工具名称 | 模块 | 职责 | 宪法依据 |
| :--- | :--- | :--- | :--- |
| `judicial_verify_structure` | Judiciary | 架构同构性验证 | §352 |
| `archive_task_outcome` | Historian | 任务归档 | §201 |
| `detect_knowledge_drift` | Judiciary | 知识漂移检测 | §355 |

#### Tier 2 辅助工具（按需调用的增强工具）
| 工具名称 | 模块 | 职责 | 宪法依据 |
| :--- | :--- | :--- | :--- |
| `consult_oracle` | Oracle | 趋势预测 | §127 |
| `digest_legacy_code` | Archaeologist | 遗留代码分析 | §151 |
| `scaffold_negentropy_project` | Genesis | 项目脚手架 | §142 |
| `auto_update_architecture` | ArchitectureSync | 自动化架构同步 | §320.1 |

#### Tier 3 管理工具（基础设施运维）
| 工具名称 | 模块 | 职责 | 宪法依据 |
| :--- | :--- | :--- | :--- |
| `list_projects` | Genesis | 项目列表 | §365 |
| `create_project` | Genesis | 创建项目 | §365 |
| `delete_project` | Genesis | 删除项目 | §365 |

### 10.4 按功能领域分类

| 领域 | 工具数量 | 关键工具 |
|------|----------|----------|
| 监察审计 | 2 | `monitor_document_entropy`, `record_daily_metric` |
| 知识管理 | 4 | `store_project_knowledge`, `search_knowledge_base`, `get_project_stats`, `detect_knowledge_drift` |
| 项目管理 | 3 | `list_projects`, `create_project`, `delete_project` |
| 创世协议 | 2 | `scaffold_negentropy_project`, `sync_memory_bank` |
| 司法验证 | 6 | `judicial_scan_architecture`, `judicial_verify_contract`, `judicial_measure_complexity`, `judicial_verify_structure`, `judicial_verify_signatures`, `judicial_run_tests` |
| 史官考古 | 2 | `archive_task_outcome`, `digest_legacy_code` |
| 预言资源 | 4 | `consult_oracle`, `get_context_resources`, `get_standard_documentation`, `search_standards` |

### 10.5 工具调用规范

#### 宪法合规性要求
所有MCP工具的使用必须遵循以下宪法约束：

1. **版本同步**: MCP核心版本必须与宪法版本保持同步 (当前: v7.0.0)
2. **工具治理**: 遵循Tier 1-3治理层级，确保正确调用顺序
3. **协议完整性**: 确保JSON-RPC协议完整性，严禁污染stdout管道
4. **冷启动原则**: 任何核心变更必须通过冷启动生效，禁止热重载

#### 交叉引用
- **开发标准**: 所有MCP工具实现遵循 [DS-07 MCP服务标准实现](../t2_standards/DS-07_mcp_service.md)
- **依赖注入**: MCP核心组件通过依赖注入管理
- **编码安全**: 遵循 [DS-09 UTF-8输出配置标准实现](../t2_standards/DS-09_utf8_output_config.md)
- **架构同步**: 自动化架构同步工具遵循 [DS-20 自动化架构同步标准实现](../t2_standards/DS-20_automated_architecture_sync.md)

---

## 11. 扩展性与演进

### 11.1 水平扩展
#### 11.1.1 无状态服务
- Gateway服务无状态设计
- 会话状态外部存储
- 负载均衡友好

#### 11.1.2 数据分片
- 按用户/租户数据分片
- 动态分片策略
- 分片迁移和重平衡

### 11.2 垂直扩展
#### 11.2.1 资源优化
- 内存使用优化
- CPU密集型任务异步处理
- I/O操作批处理和缓存

#### 11.2.2 性能调优
- 数据库查询优化
- 网络通信优化
- 缓存策略优化

### 11.3 架构演进
#### 11.3.1 演进原则
- 向后兼容性优先
- 渐进式迁移策略
- 宪法合规性验证

#### 11.3.2 演进流程
1. **需求分析**: 分析演进需求和影响
2. **宪法审查**: 监察部Agent进行宪法合规审查
3. **架构设计**: 组织部Agent设计演进方案
4. **技术实现**: 科技部Agent实现演进方案
5. **验证测试**: 三级验证协议执行
6. **部署上线**: 零停机部署和监控

---

## 12. 参考实现

### 12.1 核心实现文件
- **Gateway入口**: `server/gateway/index.ts`
- **Agent引擎**: `server/gateway/agent-engine.ts`
- **插件系统**: `server/gateway/plugins/`
- **监控系统**: `server/gateway/monitoring/core/`

### 12.2 配置管理
- **环境配置**: `server/config/`
- **依赖注入**: `server/config/inversify.config.ts`
- **类型定义**: `server/config/inversify.types.ts`

### 12.3 基础设施
- **服务发现**: `server/discovery/`
- **认证系统**: `server/gateway/auth/`
- **韧性模块**: `server/gateway/resilience/`

---

## 附录：技术标准索引

### Agent相关标准（DS-100到DS-103）
- **DS-100**: Agent接口规范 - [memory_bank/t2_standards/DS-100_agent_interface.md](../t2_standards/DS-100_agent_interface.md)
- **DS-101**: 内阁总理Agent接口规范 - [memory_bank/t2_standards/DS-101_prime_minister_agent_interface.md](../t2_standards/DS-101_prime_minister_agent_interface.md)
- **DS-102**: 办公厅主任Agent接口规范 - [memory_bank/t2_standards/DS-102_director_general_agent_interface.md](../t2_standards/DS-102_director_general_agent_interface.md)
- **DS-103**: 智能路由算法标准实现 - [memory_bank/t2_standards/DS-103_intelligent_routing.md](../t2_standards/DS-103_intelligent_routing.md)

### MCP相关标准（DS-200到DS-204）
- **DS-200**: MCP概览与宪法基础 - [memory_bank/t2_standards/DS-200_mcp_overview.md](../t2_standards/DS-200_mcp_overview.md)
- **DS-201**: 监察部工具 - [memory_bank/t2_standards/DS-201_iab_tools.md](../t2_standards/DS-201_iab_tools.md)
- **DS-202**: 创世协议工具 - [memory_bank/t2_standards/DS-202_genesis_protocol.md](../t2_standards/DS-202_genesis_protocol.md)
- **DS-203**: 司法验证工具 - [memory_bank/t2_standards/DS-203_judicial_verification.md](../t2_standards/DS-203_judicial_verification.md)
- **DS-204**: MCP服务器配置与运维 - [memory_bank/t2_standards/DS-204_mcp_server_ops.md](../t2_standards/DS-204_mcp_server_ops.md)

### 核心开发标准（DS-01到DS-26）
- **DS-01**: 前端架构重构标准 - [memory_bank/t2_standards/DS-01_frontend_architecture_refactoring.md](../t2_standards/DS-01_frontend_architecture_refactoring.md)
- **DS-02**: Colyseus集成标准 - [memory_bank/t2_standards/DS-02_colyseus_integration.md](../t2_standards/DS-02_colyseus_integration.md)
- **DS-07**: MCP服务标准实现 - [memory_bank/t2_standards/DS-07_mcp_service.md](../t2_standards/DS-07_mcp_service.md)
- **DS-20**: 自动化架构同步标准实现 - [memory_bank/t2_standards/DS-20_automated_architecture_sync.md](../t2_standards/DS-20_automated_architecture_sync.md)
- **DS-23**: 工具调用桥接器标准实现 - [memory_bank/t2_standards/DS-23_tool_call_bridge.md](../t2_standards/DS-23_tool_call_bridge.md)
- **DS-24**: ModernModelSelector标准实现 - [memory_bank/t2_standards/DS-24_modern_model_selector.md](../t2_standards/DS-24_modern_model_selector.md)

---

**宪法依据**: §104功能分层拓扑公理、§107通信安全公理、§108异构模型策略、§114双存储同构公理、§190网络韧性公理、§306零停机协议、§501-§506监控系统系列公理、§130-§132 MCP微内核公理

**维护责任**: 科技部Agent负责本文件的维护和更新，组织部Agent负责架构审查，监察部Agent负责宪法合规审查。

**版本历史**:
- v7.1.0 (2026-02-12): 整合agent_reference_index.md和mcp_reference_index.md，精简为技术栈统一入口
- v7.0.0 (2026-02-12): 从system_patterns.md整合，完全重构为Negentropy-Lab技术栈规范
- v1.0.0 (2026-02-01): 初始版本（金融数据分析接口定义）
