# 活跃上下文 - Negentropy-Lab v7.6.0-dev

**版本**: v7.6.0-dev (Phase 13 Final Acceptance 已完成)
**状态**: ✅ Phase 13 Final Acceptance 已完成 | 🔄 Phase 14-15 执行中（计划窗口: 2026-03-05~2026-03-20）
**宪法依据**: §101同步公理、§102熵减原则、§103协作同步公理、§192模型选择器公理、§193模型选择器更新公理、§110协作效率公理、§501插件系统公理、§504监控系统公理
**最后更新**: 2026-03-10

---

## 📋 项目概述

| 维度 | 定义 |
|------|------|
| **项目名称** | Negentropy-Lab (多Agent知识协作系统) |
| **架构版本** | v7.6.0-dev (Phase 13 Final Acceptance 已完成) |
| **核心目标** | 通过用户与AI Agent的实时对话，共同完善知识库内容 |
| **技术栈** | Colyseus + TypeScript + Node.js + 文件系统存储 + WebSocket + HTTP + Python MCP |
| **仓库定位** | Backend/API-only（前端位于外部仓`opendoge-ui`；当前工作环境为 Windows 10，常用路径为`D:\Users\WSMAN\Desktop\OpenDoge\opendoge-ui`，其他环境需改成对应绝对路径） |
| **部署模式** | 容器化部署，支持三服务架构和负载均衡 |

---

## 🤖 核心Agent定义 (三层架构)

| Agent | 职责 | 身份标识 | 调用时机 |
|-------|------|----------|----------|
| **监察部Agent** | 宪法合规检查、公理解释、格式验证 | `agent:supervision_ministry` | 知识库修改、宪法合规检查 |
| **科技部Agent** | 技术实现、代码编写、LLM集成 | `agent:technology_ministry` | 技术问题、代码生成 |
| **组织部Agent** | 系统架构设计、技术选型、图谱维护 | `agent:organization_ministry` | 架构调整、图谱优化 |
| **办公厅主任** (L1) | 统一用户对话入口、复杂度评估、简单任务路由 | `agent:office_director` | 所有用户消息入口 |
| **内阁总理** (L2) | 跨部门复杂任务协调、资源调配、冲突仲裁 | `agent:prime_minister` | 复杂度>7的跨部门任务 |

---

## 🏗️ 架构组件实现追踪

> **说明**: 本章节追踪七层自治架构各组件的实现状态，确保文档与代码一致性。
> **最后更新**: 2026-03-10
> **运行基线**: 运行时入口、职责边界与实现状态以 `memory_bank/t0_core/runtime_architecture_baseline.md` 为准。

### 七层架构实现状态

| 层级 | 组件名称 | 实现状态 | 代码位置 | 备注 |
|------|----------|----------|----------|------|
| **L5** | 接口表现层 | ✅ 已实现 | `server/gateway/websocket/`, `server/gateway/openai-http.ts` | WebSocket RPC + HTTP REST API |
| **L4** | 应用逻辑层 | ✅ 已实现 | `server/services/`, `server/agents/` | TypeScript Node.js服务 |
| **L3** | MCP微内核层 | ✅ 已实现 | `engine/mcp/`, `engine/mcp_core/` | Python MCP微内核服务 |
| **L2.5** | 内部事务局(IAB) | 🟡 功能集成 | `server/services/authority/AuthorityMonitoringService.ts`, `server/gateway/monitoring/core/ConstitutionMonitor.ts`, `EntropyService.ts` | 审计/监控能力分布集成于 authority 与 gateway 监控服务 |
| **L2** | 执行代理层 | ✅ 已实现 | `server/agents/` | 三层架构完整实现 |
| **L1** | 记忆银行层 | ✅ 已实现 | `memory_bank/` | T0-T3四层架构 |
| **L0.8** | ToolCallBridge | 🟡 子系统已落地 | `memory_bank/t2_standards/DS-23_tool_call_bridge.md`, `server/types/system/IToolCallBridge.ts`, `server/services/authority/AuthorityToolCallBridge.ts` | Authority runtime 已接入广播/审计/活跃调用跟踪；统一平台实现仍待收敛 |
| **L0.5** | Legacy兼容层 | 🟡 局部实现 | `server/adapters/OpenClawLogAdapter.ts` | 通用兼容适配器仍待补齐 |
| **L0** | 遗留隔离层 | 📋 架构规划 | 无代码实现 | 隔离区设计完成，实现待开发 |

### 状态图例

- ✅ **已实现**: 代码完整，功能可用，测试覆盖
- 🟡 **规范完成/功能集成**: 规范文档完整，或功能已集成到其他服务
- 📋 **架构规划**: 架构设计完成，代码待开发

### 关键差异说明

1. **L2.5 内部事务局(IAB)**: 原设计为独立服务，实际实现中审计功能集成于 `ConstitutionMonitor` 和 `EntropyService`
2. **L0.8 ToolCallBridge**: `DS-23_tool_call_bridge.md` 与 `IToolCallBridge` 契约已存在；Authority 子系统已落地 `AuthorityToolCallBridge` 并接入 `authorityRuntime`，但跨子系统统一实现仍未收敛
3. **L0.5 Legacy兼容层**: 已存在 `OpenClawLogAdapter` 这类局部适配器实现，但 `LegacyCommandAdapter` 等通用兼容适配器仍未开发

---

## ⚙️ 系统状态概览

| 组件 | 状态 | 说明 |
|------|------|------|
| **Gateway生态系统** | 🟡 持续对齐 | WebSocket RPC已启用，HTTP/插件/监控存在简化实现或非默认挂载项 |
| **OpenClaw决策服务** | ✅ 完整实现 | 决策控制器/策略引擎/断路器/灰度发布/回滚演练已完成 |
| **Agent三层架构** | 🟢 就绪 | L1+L2+L3完整 |
| **插件系统** | 🟡 双体系并行 | `server/plugins/` 提供核心/authority 兼容语义，`server/gateway/plugins/` 提供 Gateway 运行时插件管理；热重载监视器仍待实现 |
| **监控系统** | 🟡 组件齐全 | 11个服务/模块代码已存在；默认 npm 主运行态接入 authority 监控路由与开发态 `/colyseus` 面板，Gateway 监控工厂未统一自动装配 |
| **LLM集成** | 🟡 分层存在 | `server/services`含ModelSelectorService；`server/gateway/` 中 HTTP OpenAI/OpenResponses 与流式能力属于独立或简化实现，非默认 npm 主链路 |
| **测试覆盖率** | 🟡 以最新报告为准 | 仓库未维护统一实时覆盖率快照 |
| **全量测试基线** | ✅ 通过 | `npm test -- --run`：`Test Files 15 passed / 273 tests`，全部通过；OpenClaw决策模块核心功能完成，WebSocket+HTTP双端集成验收通过 |
| **契约守护** | 🟢 就绪 | 93 RPC / 19 Events 基线已建立，canonical实现覆盖率 100% (93/93)，`check:contract:drift`漂移审计已启用 |
| **生产运维闭环** | 🟢 已演练 | `ops:preflight:prod`、`ops:deploy:smoke`、live rollback 演练通过 |
| **持续治理工具** | 🟢 已启用 | `report:contract:monthly`、`report:testdebt:skip`、`report:perf:trend` 已纳入治理链路 |

### 运行时入口提醒
- **默认开发入口**: `npm run dev` → `server/index.ts`
- **默认生产入口**: `npm start` → `dist/server/index.js`
- **Legacy入口**: `src/index.ts` → `npm run dev:legacy` / `npm run start:legacy`
- **Gateway模块门面**: `server/gateway/index.ts` 供脚本或调用方显式装配，不是当前 npm 默认主入口
- **质量快照语义**: 质量指标以最近一次脚本输出为准；静态文档中的数字仅表示最近一次人工同步快照

---

## 📖 移植历史 (完整记录)

本章节记录Negentropy-Lab项目的架构移植和宪法同步历史，依据§152单一真理源公理。

### 📋 概述

本文件记录Negentropy-Lab项目的移植历史，包括架构变更、宪法同步和重大重构。

### 📅 移植历史记录

#### 2026-03-05~2026-03-20: Phase 14-15 执行阶段 (计划窗口)
- **版本**: v7.6.0-dev (Phase 13 Final Acceptance 已完成)
- **当前状态**: 🔄 执行阶段（已进入计划窗口）
- **计划内容**:
  1. Phase 14: 生产环境就绪验证
  2. Phase 15: 部署集成/监控告警/灰度发布演练/运维就绪验证
- **前置条件**: Phase 13 验收已通过
- **最新实际验收**: `reports/2026-03-03_phase13-final-acceptance.md`
- **注意**: `reports/2026-03-15_phase14-final-acceptance.md` 与 `reports/2026-03-20_phase15-final-acceptance.md` 均生成于 2026-03-04，属于 rehearsal/排期文件，不能等同于 2026-03-15 / 2026-03-20 已发生的真实生产验收

#### 2026-03-03: Phase 13 批次验收完成
- **版本**: v7.6.0-dev (Phase 13 Final Acceptance)
- **主要变更**:
  1. Batch 1: 集成配置检查 37/37 通过
  2. Batch 2: 三仓联调全绿（OpenClaw 失败面清零）
  3. Batch 3: SHADOW/回滚闭环通过，48轮压缩soak
  4. Batch 4: contract/constitution/consistency 门禁全绿
  5. Batch 5: preflight + deploy smoke + rollback verify 全绿
- **关键修复**:
  - OpenClaw: control-ui.http.test.ts, agent.test.ts, agents-mutate.test.ts, server-node-events.test.ts
  - UI Desk: core-e2e.test.ts, e2e.test.ts 超时稳定性
  - ws-soak.sh 脚本路径修复
- **最终验收**:
  - Negentropy-Lab: 15 files / 273 tests passed
  - OpenClaw: 114 files / 1118 passed / 3 skipped
  - UI Web: 1 file / 2 tests passed
  - UI Desk: 11 files / 169 tests passed
- **详细报告**: `reports/2026-03-03_phase13-batch-execution-final-acceptance.md`

#### 2026-03-03: 统一启动器开发完成
- **版本**: v7.5.0-dev (Unified Launcher)
- **主要变更**:
  1. 双服务编排内核（Negentropy → OpenClaw 启动，OpenClaw → Negentropy 停止）
  2. 端口冲突自动切换与运行时落盘
  3. PID/状态持久化（storage/runtime/）
  4. 统一日志聚合（支持 all|negentropy|openclaw 过滤）
  5. CLI 扩展（--openclaw-path、--decision、--log-filter 等）
  6. 配置层升级（preset/env/校验，兼容旧字段）
- **测试验收**: CI Smoke 11/11 通过，全量 vitest 141 套件 / 273 测试通过
- **详细报告**: `reports/2026-03-03_unified-launcher-acceptance.md`

#### 2026-03-03: OpenClaw HTTP 决策桥接集成完成
- **版本**: v7.5.0-dev (OpenClaw HTTP Integration)
- **主要变更**:
  1. OpenClaw决策模块集成于 `server/gateway/openclaw-decision/`
  2. 接入 3 个 HTTP 入口:
     - `http.openai.chat.completions` (OpenAI Chat Completions)
     - `http.openresponses.create` (OpenResponses API)
     - `http.tools.invoke` (Tools Invoke)
  3. 行为实现: REJECT → 403; REWRITE → 参数改写; 非法重写 → 400
- **测试验收**: 3 个测试文件 / 24 个测试用例全部通过
- **详细报告**: `reports/2026-03-03_openclaw-integration-status.md`

#### 2026-03-02: OpenClaw Decision模块开发完成
- **版本**: v7.5.0-dev (OpenClaw Decision)
- **主要变更**:
  1. 决策合同定义 (v1): DecisionRequest/DecisionResponse/DecisionMode
  2. 策略引擎实现: PolicyEngine + 6条默认规则
  3. 安全与弹性: CircuitBreaker断路器 + FallbackAdapter回退适配器
  4. OpenClaw桥接: 帧映射器 + 握手映射器 + OpenClawBridge
  5. 灰度发布: 4阶段灰度(canary/beta/staging/production)
  6. 回滚演练脚本: rollback-drill.ts
- **测试验收**: 238 tests passed
- **详细报告**: `reports/2026-03-02_openclaw-decision-development-report.md`

#### 2026-03-02: Phase 10 RC稳定态完成 (OPS/GRT/UIX/TST)
- **版本**: v7.5.0-dev (Phase 10 RC 稳定态)
- **主要变更**:
  1. OPS-101~104：发布前门禁脚本固化、生产冒烟与签发清单、回滚演练复核、运维交接与值班升级
  2. GRT-101~104：Browser控制主链路收敛、高频路径时延与恢复优化、契约月报自动化、漂移守护与发布前校验
  3. UIX-101~104：Web端Browser控制对齐、Desk端Browser控制对齐、BFF路由与契约桥接、跨仓联调回归
  4. TST-101~104：skip豁免到期治理、性能专线隔离策略、周报与趋势审计稳态、主干门禁巡检
  5. 全部验收通过：1229 passed / 5 skipped / 0 failed

#### 2026-03-02: Phase 9 连续批次执行完成
- **版本**: v7.5.0-dev (Phase 9)
- **主要变更**:
  1. 契约守护深化：93 RPC / 19 Events 基线建立
  2. 漂移审计三链路：PR/nightly/release 漂移守护接入
  3. 测试治理闭环：skip治理、性能趋势审计纳入持续治理

#### 2026-03-02: Phase 8 连续批次执行完成 (OPS/RPC/TG)
- **版本**: v7.5.0-dev (Phase 8)
- **主要变更**:
  1. OPS-81~84：完成 production 预检、部署烟雾、live 回滚演练与 runbook v2 固化
  2. RPC-81~83：完成 PR/nightly/release 契约三链路、drift 分级与方法级定位、月度审计模板
  3. TG-81~83：完成 skip 分层治理、性能阈值分级与趋势审计归档
  4. 主仓与跨仓（opendoge-ui）全链路验收通过

#### 2026-02-12: t0_core文件夹整理 (索引整理)
- **版本**: v7.0.0 (索引整理)
- **主要变更**:
  1. 更新.clinerules索引引用，修正文件位置标注
  2. 修正incubation_state.md和agent_reference_index.md的位置标注
  3. 创建t0_core/transplant_history.md作为索引文件
  4. 保持文件位置不变，仅更新索引（选项B方案）

#### 2026-02-12: Phase 1完整完成 (Gateway生态系统架构)
- **版本**: v7.0.0 (Phase 1完整完成版)
- **宪法依据**: §101同步公理、§102熵减原则、§501插件系统公理、§504监控系统公理
- **主要变更**:
  1. Gateway生态系统完整构建 (WebSocket + HTTP + 认证 + 插件 + 监控)
  2. Agent三层架构完善 (L1办公厅主任 + L2内阁总理 + L3专业Agent)
  3. 插件系统基础能力落地（后续演进为 PluginType(9)+PluginKind(6) 双模型）
  4. Operation Panopticon监控系统完成
  5. LLM集成系统完整，支持多Provider和模型选择器
- **熵减验证**: ΔH_sys = -0.15 (系统有序度提升15%)

#### 2026-02-12: Memory Bank结构改造 (宪法驱动开发)
- **版本**: v7.0.0 (内存银行结构化)
- **宪法依据**: §104功能分层拓扑公理、§152单一真理源公理
- **主要变更**:
  1. 创建四层架构memory_bank结构 (T0-T3)
  2. 建立单一.clinerules宪法入口索引
  3. 创建自动化迁移脚本和宪法合规检查脚本
  4. 为所有代码文件添加@constitution注解格式

#### 2026-02-12: Memory Bank结构标准化
- **版本**: v7.0.1 (结构标准化)
- **主要变更**:
  1. 移除冗余目录 (01_active_state, 02_system_axioms, 03_protocols)
  2. 从MY-DOGE-MACRO引入标准文件
  3. 添加 t0_core/project_readme.md
  4. 添加 t1_axioms/behavior_context.md 和 tech_context.md

#### 2026-02-10: Phase 1A: WebSocket网关核心移植
- **版本**: v6.5.0 (WebSocket网关核心)
- **文件统计**: 7个文件，2,359行TypeScript代码
- **核心功能**: WebSocket RPC协议、HTTP+WebSocket双协议、认证系统

#### 2026-02-10: Phase 0: 基础架构移植
- **版本**: v6.0.0 (基础架构)
- **核心交付物**: Python MCP引擎、熵计算服务、Docker编排体系

### 📊 移植路线图

| 阶段 | 状态 | 核心交付物 |
|------|------|-----------|
| **Phase 0** | ✅ 完成 | 三服务基础架构建立 |
| **Phase 1** | ✅ 完成 | Gateway生态系统 + Agent三层架构 |
| **Memory Bank标准化** | ✅ 完成 | T0-T3四层架构标准化 |
| **Phase 2** | 🕒 待开始 | 完整插件系统与通道集成 |

### 🔧 自动化工具

```bash
# 宪法合规检查
node scripts/constitution-check.js

# 宪法注解添加
node scripts/add_constitution_annotations.js

# 宪法文件迁移
node scripts/migrate_constitution_files.js

# 契约计数校验
node scripts/contract-count-check.js

# 契约漂移审计
node scripts/contract-drift-audit.js --enforce

# 契约月度审计汇总
node scripts/contract-monthly-summary.js --month 2026-03

# skip 治理台账
node scripts/skip-test-governance.js

# 性能趋势审计
node scripts/perf-trend-audit.js

# 性能测试运行 (Phase 5-3新增)
./scripts/run-performance-tests.sh          # 运行所有性能测试
./scripts/run-performance-tests.sh --quick  # 快速模式

# WebSocket长稳测试
./scripts/ws-soak.sh

# WebSocket性能基线
./scripts/ws-perf-baseline.sh
```

### 🏛️ 宪法承诺

本移植历史文件严格遵循以下宪法原则:

1. **§101同步公理**: 每次移植变更都有对应的文档更新记录
2. **§102熵减原则**: 移植过程优先复用现有组件，减少技术债务
3. **§141熵减验证公理**: 每次移植都必须验证ΔH ≤ 0
4. **§152单一真理源公理**: 所有移植历史统一记录
5. **§102.3宪法同步公理**: 版本变更自动触发全体系同步检查

---

## 🧠 系统核心功能

### LLM集成系统
- **LLMService**: 存在两条实现路径（`server/services/LLMService.ts` 与 `server/gateway/llm-service.ts`）
- **ModelSelectorService**: 位于`server/services/ModelSelectorService.ts`，Gateway WebSocket当前以`models.select`+failover能力为主
- **流式响应**: Gateway WebSocket支持文本分块流式；HTTP OpenAI/OpenResponses 主要位于`server/gateway/`独立或简化实现，默认 npm 主链路不直接暴露 `/v1/*`
- **成本优化**: CostTracker已实现，成本优化效果以验收报告与线上观测为准

### 插件系统
- **Gateway运行时插件体系**: `server/gateway/plugins/`，提供 PluginType(9种) 运行时分类：HTTP_MIDDLEWARE、WEBSOCKET_MIDDLEWARE、EVENT_HANDLER、SCHEDULED_TASK、DATA_TRANSFORMER、EXTERNAL_INTEGRATION、MONITORING、LOGGING、SECURITY
- **核心/authority兼容插件体系**: `server/plugins/`，提供 PluginKind(6类) 语义：core、agent、monitoring、channel、gateway、memory
- **零停机热重载**: 生命周期接口已实现，目录监听热重载监视器待实现
- **宪法合规**: 所有插件加载前通过宪法合规验证

### 监控系统 - Operation Panopticon（11个服务/模块证据）
- **核心监控**:
  - ConstitutionMonitor: 宪法合规引擎，10分钟扫描，合规率监控
  - EntropyService: 熵值计算服务，四维熵值模型，30秒计算周期
  - CostTracker: 成本透视系统，令牌成本统计，多模型差异化定价
- **Phase 5-1 UI深度集成**:
  - UIStateSyncService: UI状态同步服务，实时状态推送
  - ControlPanelSyncService: 控制面板同步服务，操作联动
  - AgentExecutionVisualizer: Agent执行可视化，实时执行状态追踪
- **Phase 5-2 功能增强**:
  - StreamingOptimizer: 流式响应优化，批处理与背压控制
  - TaskQueueVisualizer: 任务队列可视化，队列健康度监控
  - TaskSchedulerEnhanced: 增强版任务调度，Cron/间隔/依赖链任务
  - PerformanceMetricsEnhanced: 性能指标增强，响应时间分布与资源使用率
- **默认运行态说明**: `server/index.ts` 主链路当前主要接入 `AuthorityMonitoringService` 相关路由与开发态 `/colyseus` 面板；`server/gateway/monitoring/index.ts` 的监控工厂未在 npm 主链路统一自动装配

---

## 💬 Gateway聊天系统

### 消息类型
- **公开消息**: 群组讨论，全员可见
- **私聊消息**: 点对点通信，加密传输
- **Agent动作**: Agent执行知识库操作
- **系统通知**: 知识库更新、状态变更通知

### 协议支持
- **WebSocket RPC（JSON-RPC风格）**: 完整协议支持
- **HTTP REST API**: OpenAI兼容/Tools Invoke 路由存在于独立 Gateway 与集成桥接路径中，是否开放取决于所选运行时
- **双协议同步**: 完整语义以独立 Gateway 运行时为主，不等同于默认 npm 主链路全部启用

---

## 📚 知识库管理

### 核心文件
- **入口索引** (`.clinerules`): 宪法入口导航文件
- **法典内核** (`memory_bank/t0_core/`): basic_law_index.md、procedural_law_index.md、technical_law_index.md
- **记忆库** (`memory_bank/`): T0-T3四层架构结构

### 修改流程
1. 请求 → 2. 审核 → 3. 执行 → 4. 记录 → 5. 通知

---

## 📊 关键监控指标

| 指标 | 目标值 | 当前状态 |
|------|--------|----------|
| **宪法合规率** | > 90% | 100.00% ✅（2026-03-10 最近一次脚本快照；代码/文档/目录三项全通过） |
| **系统熵值** | ΔH < 0 | ΔH = -0.15 🟢 |
| **响应延迟** | < 3秒 | 以最新压测与监控数据为准 |
| **服务可用性** | > 99.9% | 以部署环境监控为准 |
| **Token成本** | 优化30%+ | 以CostTracker与验收报告为准 |

---

## 🚀 启动协议

1. 加载活跃上下文
2. 加载基本法索引
3. 加载知识图谱
4. 运行监控系统
5. 初始化Gateway服务
6. 加载插件系统
7. 启动Agent管理系统
8. 建立客户端连接
9. 启动实时监控仪表板

---

## 📝 后续规划

### 立即行动
1. 持续执行契约/一致性/宪法三重门禁
2. 持续输出契约月报与 drift 审计证据链
3. 持续推进 skip 收敛与性能趋势治理

### 中期规划 (Phase 2)
1. 100% Gateway替代
2. ~~通道管理器开发（Slack、Discord、Telegram）~~ ✅ 已完成（见 `server/gateway/channels/`）
3. 服务发现机制
4. 企业级安全增强

### 长期发展
1. 多实例部署和高可用
2. 移动端支持
3. 智能协作网络
4. 宪法驱动开发生态

---

## 🌍 MY-DOGE-DEMO 集成

- ✅ **源项目分析完成**: MY-DOGE-DEMO v6.8.0 (七层架构)
- ✅ **核心文档提取**: 5份关键文档
- ✅ **七层架构整合**: technical_law_index.md新增§100-§109
- ✅ **MCP工具文档**: 创建3个Tier 1工具详细文档

详细报告参见 `reports/2026-03-03_clinerules-memorybank-verification-v2.md`

---

## 🏛️ 宪法合规保障

### CDD实施
- **§101同步公理**: 代码变更与文档更新原子性同步
- **§102熵减原则**: 系统结构清晰，减少技术债务
- **§152单一真理源**: 统一配置管理
- **§501插件系统公理**: 扩展功能通过插件系统
- **§504监控系统公理**: 实时监控宪法合规状态

### 宪法审计
1. 自动化检查：`npm run check:constitution`
2. 实时监控：Operation Panopticon
3. 定期审计：监察部Agent
4. 违规处理：24小时内修正

---

**宪法依据**: §102.3宪法同步公理、§25数据完整性公理、§90网络韧性公理、§192模型选择器公理、§501插件系统公理、§504监控系统公理
