# Agent 参考索引

**宪法依据**: §109 协作流程公理、§110 协作效率公理、§152 单一真理源公理

本文件提供 Agent 架构与实现文档的统一入口。

## 架构与规范

- `memory_bank/t1_axioms/agent_collaboration_patterns.md`
- `memory_bank/t1_axioms/behavior_context.md`
- `memory_bank/t1_axioms/system_patterns.md`

## 运行时实现

### 核心引擎与路由
- `server/gateway/agent-engine.ts` - Agent引擎核心
- `server/services/IntelligentRouter.ts` - 智能路由服务

### L1 层 - 入口层
- `server/agents/OfficeDirectorAgent.ts` - 办公厅主任（统一入口）

### L2 层 - 协调层
- `server/agents/PrimeMinisterAgent.ts` - 内阁总理（跨部门协调）

### L3 层 - 专业层
- `server/agents/SupervisionMinistryAgent.ts` - 监察部Agent（宪法合规）
- `server/agents/TechnologyMinistryAgent.ts` - 科技部Agent（技术实现）
- `server/agents/OrganizationMinistryAgent.ts` - 组织部Agent（架构设计）

### 基础设施
- `server/agents/BaseAgent.ts` - Agent基类
- `server/agents/SuperAgentCoordinationProtocol.ts` - Agent协调协议

**最后更新**: 2026-03-05
