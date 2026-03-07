# 术语表 - Negentropy-Lab v7.0.0

**版本**: v7.0.0 (Gateway生态系统完整版)
**最后更新**: 2026-02-12
**状态**: 🟡 Phase 1D架构基线完成，运行实现持续对齐
**宪法依据**: §10.6文档分级公理、§152单一真理源公理
**来源**: MY-DOGE-DEMO GLOSSARY.md v5.5.0 适配整合

本文档定义了 **Negentropy-Lab** 项目中使用的核心概念、术语和缩写，旨在提供统一的术语解释，帮助团队成员和贡献者理解项目。

---

## 🏛️ 项目核心概念

### Negentropy-Lab
**定义**: 基于Gateway生态系统的多Agent智能协作平台，通过用户与AI Agent的实时对话，共同完善知识库内容，实现熵减优化的协作系统。

**核心特点**:
- **四层架构**: Gateway + Agent三层 + LLM集成 + 知识库
- **Agent协作**: 办公厅主任、内阁总理、专业Agent三层架构
- **宪法驱动开发**: 严格遵循CDD流程，文档先行原则
- **熵减优化**: 通过逆熵计算持续提升系统有序度

### Gateway生态系统 (Gateway Ecosystem)
**定义**: 系统的统一入口和通信协议层，提供WebSocket + HTTP双协议支持、认证授权、插件系统和监控能力。

**核心组件**:
- **WebSocket Gateway**: 支持项目RPC消息帧协议的实时通信
- **HTTP REST API**: OpenAI兼容的RESTful接口
- **认证系统**: 令牌认证（生产目标JWT）、权限Scope分级
- **插件系统**: PluginType(9)+PluginKind(6)双模型，零停机热重载
- **监控系统**: Operation Panopticon全景监控

### Agent三层架构 (Three-Layer Agent Architecture)
**定义**: 系统的智能协作核心，分为L1入口层、L2协调层、L3专业层的分层治理架构。

**层级构成**:
- **L1入口层 - 办公厅主任Agent**: 统一用户对话入口、复杂度评估、日常任务路由
- **L2协调层 - 内阁总理Agent**: 战略协调、跨部门资源调配、宪法监督、冲突仲裁
- **L3专业层**: 监察部Agent、科技部Agent、组织部Agent

### 知识库 (Knowledge Base)
**定义**: 系统的单一真理源，采用法典内核和记忆库的分层存储，包含宪法、公理、规范和工作流。

**存储结构**:
- **入口索引** (`.clinerules`): 宪法入口导航文件
- **法典内核** (`memory_bank/t0_core/`): 基本法、程序法、技术法（依据§152单一真理源公理）
- **记忆库** (`memory_bank/`): T0-T3四层级文档体系

---

## 🔧 技术架构术语

### Gateway协议架构 (Gateway Protocol Architecture)
**定义**: 系统采用WebSocket和HTTP双协议架构，根据操作特性选择最佳协议。

**协议分离原则**:
- **WebSocket**: 用于实时通信、消息推送、状态同步
- **HTTP**: 用于资源管理、API调用、认证授权

### WebSocket RPC协议 (WebSocket RPC Protocol)
**定义**: 基于JSON的远程过程调用风格协议，支持请求、响应、事件三种消息类型。

**协议版本**: project-rpc-v1（JSON-RPC风格）
**传输方式**: WebSocket
**消息类型**: request, response, event

### 插件系统 (Plugin System)
**定义**: 基于PluginManager的扩展功能系统，支持PluginType(9)+PluginKind(6)双模型和零停机热重载。

**核心组件**:
- **PluginManager**: 插件生命周期管理
- **PluginRegistry**: 插件注册表和状态监控
- **PluginValidator**: 宪法合规验证器

**支持的插件类型**:
1. **HTTP_MIDDLEWARE**: Express中间件
2. **WEBSOCKET_MIDDLEWARE**: WebSocket中间件
3. **EVENT_HANDLER**: 事件处理器
4. **SCHEDULED_TASK**: 定时任务
5. **DATA_TRANSFORMER**: 数据转换
6. **EXTERNAL_INTEGRATION**: 外部集成
7. **MONITORING**: 监控插件
8. **LOGGING**: 日志插件
9. **SECURITY**: 安全插件

### 零停机热重载 (Zero-Downtime Hot Reload)
**定义**: 插件更新无需重启Gateway服务，保持服务连续性的机制。

**协议流程**:
1. 保存插件当前状态
2. 卸载旧插件实例
3. 加载新插件代码
4. 恢复插件状态
5. 重新注册服务

**宪法依据**: §503零停机热重载公理

---

## 🧠 核心算法与指标

### 逆熵审计三阶段流水线 (Three-Stage Inverse Entropy Audit Pipeline)

#### 阶段1: 原始完整性 (Raw Integrity)
**定义**: 评估数据原始质量，计算信噪比(SNR)指标。

**关键指标**:
- **信噪比 (SNR)**: 信号与噪声的功率比，单位dB
- **质量门控**: ≥60dB为合格

#### 阶段2: 主要结构 (Primary Structure)
**定义**: 分析数据结构熵，评估信息组织有序度。

**关键指标**:
- **结构熵 (Structural Entropy)**: 基于香农熵的信息有序度度量
- **质量门控**: ≥50分为合格

#### 阶段3: 高级对齐 (Advanced Alignment)
**定义**: 分析数据与战略目标的语义对齐度。

**关键指标**:
- **余弦相似度 (Cosine Similarity)**: 向量间的方向相似度，范围-1到1
- **质量门控**: ≥80分为合格

### 复合逆熵分数 (Composite Negentropy Score)
**定义**: 三阶段分数的加权平均值，范围0-100。

**计算公式**:
```
复合分数 = (阶段1 × 权重1 + 阶段2 × 权重2 + 阶段3 × 权重3) / 总权重
```

**决策矩阵**:
| 逆熵指数范围 | 评级 | 存储决策 |
|--------------|------|----------|
| 80-100 | ORDERED | 自动存储 |
| 60-79 | INCONCLUSIVE | 人工审核 |
| 0-59 | CHAOTIC | 拒绝存储 |

### 系统熵值 (System Entropy)
**定义**: 四维熵值综合指标，衡量系统有序度。

**熵值维度**:
- **H_sys**: 系统熵（代码结构复杂度）
- **H_cog**: 认知熵（知识组织有序度）
- **H_struct**: 结构熵（文档结构化程度）
- **H_total**: 综合熵值

**目标状态**: ΔH < 0 (系统有序度持续提升)

### Agent复杂度评估 (Agent Complexity Assessment)
**定义**: 评估任务复杂度的算法，用于决定路由策略。

**评估公式**:
```
复杂度 = 意图类型(30%) + 涉及部门(25%) + 宪法影响(20%) + 知识库影响(15%) + 预估处理时间(10%)
```

**路由策略**:
- 复杂度≤7: 直接路由到专业Agent
- 复杂度>7: 转交内阁总理Agent

---

## 🗄️ 数据存储术语

### 法典内核 (Code Kernel)
**定义**: 系统的最高宪法内核，定义核心公理与架构约束，包含基本法、程序法、技术法。

**位置**: `memory_bank/t0_core/`（依据§152单一真理源公理）

**核心文件**:
- **active_context.md**: 活跃上下文，当前系统状态与任务
- **basic_law_index.md**: 基本法索引
- **procedural_law_index.md**: 程序法索引
- **technical_law_index.md**: 技术法索引
- **knowledge_graph.md**: 知识图谱导航

**入口索引**: `.clinerules` 作为快速导航入口，详细内容存储在`memory_bank/t0_core/`

**宪法依据**: §152单一真理源公理

### 记忆库 (Memory Bank)
**定义**: 系统的知识存储体系，采用T0-T3四级分层管理。

**文档分级**:
- **T0**: 核心意识层（常驻内存）
- **T1**: 索引与状态层（高频检索）
- **T2**: 执行规范层（按需加载）
- **T3**: 分析与归档层（离线存储）

### 知识图谱 (Knowledge Graph)
**定义**: 系统实体间关系的可视化表示，支持神经网络导航。

**核心功能**:
- 实体关联导航
- 领域簇组织
- 关系类型定义
- 可视化展示

---

## 🔄 实时通信术语

### WebSocket (WebSocket)
**定义**: 全双工通信协议，用于实时数据传输和消息推送。

**核心概念**:
- **连接**: 客户端与服务器之间的持久连接
- **消息**: JSON格式的事件消息
- **心跳**: 保持连接的定期心跳包
- **重连**: 断线后的自动重连机制

### WebSocket RPC (WebSocket RPC)
**定义**: 基于JSON的远程过程调用风格协议，支持请求、响应、事件三种消息类型。

**消息格式**:
- **Request**: `{ type: "request", id, method, params }`
- **Response**: `{ type: "response", id, ok, result?, error? }`
- **Event**: `{ type: "event", event, payload }`

### 房间系统 (Room System)
**定义**: 以Colyseus Room为主的多用户会话管理系统，并与Gateway WebSocket会话语义并存。

**核心概念**:
- **房间**: 独立的会话环境
- **状态**: 可同步的房间状态对象
- **消息**: 房间内广播的消息
- **客户端**: 连接到房间的客户端实例

---

## 🚀 LLM集成术语

### LLMService (LLM服务)
**定义**: 多Agent LLM集成服务，支持同步流式请求和多Provider管理。

**核心功能**:
- 多Provider支持
- 流式响应
- 成本优化
- 错误重试

### ModelSelectorService (模型选择器服务)
**定义**: 智能模型选择器，基于任务复杂度和成本优化选择最优LLM模型。

**选择标准**:
- 能力匹配
- 健康状态
- 成本效率
- 性能指标

**宪法依据**: §192模型选择器公理、§193模型选择器更新公理

### 成本透视 (Cost Transparency)
**定义**: 实时追踪LLM调用成本和性能的监控系统。

**核心指标**:
- Token成本统计
- 模型使用分布
- 成本优化建议
- 性能基准对比

---

## 📊 监控系统术语

### Operation Panopticon (全景监控)
**定义**: 系统的实时监控平台，提供宪法合规、熵值、成本、性能的全景监控。

**核心组件**:
- **ConstitutionMonitor**: 宪法合规引擎
- **EntropyService**: 熵值计算服务
- **CostTracker**: 成本透视系统

### 宪法合规率 (Constitutional Compliance Rate)
**定义**: 代码文件宪法引用完整性的百分比。

**目标值**: >90%
**监控频率**: 每10分钟

### 宪法合规检查 (Constitutional Compliance Check)
**定义**: 自动化检查代码文件是否符合宪法约束的过程。

**检查方法**:
- AST扫描
- Regex匹配
- 引用完整性验证

---

## 📝 宪法驱动开发术语

### CDD (Constitution-Driven Development)
**定义**: 宪法驱动开发，以文档先行为核心原则的开发方法论。

**五状态工作流**:
1. **State A**: 基准摄入
2. **State B**: 文档规划
3. **State C**: 受控执行
4. **State D**: 三级验证
5. **State E**: 收敛纠错

### 文档先行原则 (Documentation-First Principle)
**定义**: 所有变更必须先修改文档并获批准，然后才能执行代码实现。

**核心原则**:
- 代码变更必须触发文档更新
- 禁止直接修改代码而不更新文档
- 遵循§101同步公理

### 三级司法验证 (Three-Tier Judicial Verification)
**定义**: 系统变更必须通过的三级验证流程。

**验证层级**:
1. **Tier 1**: 结构验证（文件系统结构）
2. **Tier 2**: 契约验证（接口契约）
3. **Tier 3**: 行为验证（运行时行为）

---

## 🔑 安全与合规术语

### JWT认证 (JWT Authentication)
**定义**: 基于JSON Web Token的认证机制。

**核心概念**:
- **Token**: 用户身份凭证
- **Secret**: 签名密钥
- **Expiration**: 过期时间
- **Scope**: 权限范围

### 权限Scope分级 (Permission Scope Grading)
**定义**: 三级权限体系：普通用户、管理员、访客。

**权限矩阵**:
| 角色 | 读取 | 写入 | 管理 | 监控 |
|------|------|------|------|------|
| 普通用户 | ✅ | ⚠️ | ❌ | ❌ |
| 管理员 | ✅ | ✅ | ✅ | ✅ |
| 访客 | ✅ | ❌ | ❌ | ❌ |

### 宪法级约束 (Constitutional Constraints)
**定义**: 项目必须遵循的核心技术原则，类似宪法级别的强制规定。

**核心约束**:
- §101: 用户主权公理
- §102: 熵减原则
- §152: 单一真理源公理
- §501: 插件系统公理
- §504: 监控系统公理

---

## 📚 开发与协作术语

### Agent协作流程 (Agent Collaboration Workflow)
**定义**: 用户与多个Agent协作完成任务的标准化流程。

**典型流程**:
1. 用户请求
2. 办公厅主任接收并评估复杂度
3. 路由到对应Agent或内阁总理
4. Agent协作处理
5. 结果返回用户
6. 知识库更新（如需要）

### 宪法合规检查脚本 (Constitutional Compliance Check Script)
**定义**: 自动化检查代码文件宪法合规性的脚本。

**执行命令**:
```bash
npm run check:constitution
```

**检查内容**:
- 宪法引用完整性
- 版本一致性
- 文档同步状态
- 架构同构性

### 熵减验证 (Entropy Reduction Verification)
**定义**: 验证系统变更是否降低熵值的过程。

**验证方法**:
- 计算ΔH = H_new - H_old
- 目标ΔH < 0（熵值降低）
- 符合§141熵减验证公理

---

## 🆘 故障排除术语

### Gateway连接失败 (Gateway Connection Failure)
**定义**: 客户端无法连接到Gateway服务。

**排查步骤**:
1. 检查Gateway服务是否启动
2. 验证网络连接
3. 检查防火墙设置
4. 查看Gateway日志

### 插件加载失败 (Plugin Loading Failure)
**定义**: 插件无法正常加载或启动。

**排查步骤**:
1. 检查插件manifest.json
2. 验证宪法合规性
3. 检查依赖项安装
4. 查看插件日志

### 宪法合规检查失败 (Constitutional Compliance Check Failed)
**定义**: 代码文件未通过宪法合规检查。

**解决方法**:
1. 查看具体违规条款
2. 更新代码或文档
3. 重新运行检查
4. 确认修复成功

---

## 📖 扩展阅读

### 相关文档
- [核心概念体系](./CONCEPTS.md) - 数学公理和核心概念定义
- [架构文档](./system_patterns.md) - 四层架构详细设计
- [基本法索引](../t0_core/basic_law_index.md) - 核心公理与架构约束
- [程序法索引](../t0_core/procedural_law_index.md) - 协作流程与操作规范
- [技术法索引](../t0_core/technical_law_index.md) - 技术标准与实现规范

### 外部资源
- [WebSocket协议](https://websockets.spec.whatwg.org/) - WebSocket规范
- [JSON-RPC 2.0规范](https://www.jsonrpc.org/specification) - RPC风格参考规范
- [Colyseus框架](https://docs.colyseus.io/) - 实时游戏服务器框架
- [JWT规范](https://jwt.io/) - JSON Web Token

---

**文档版本**: v7.0.0  
**最后更新**: 2026-03-01  
**维护者**: Negentropy-Lab开发团队  
**状态**: 🟡 运行对齐中（遵循宪法级约束）
