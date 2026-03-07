# Agent协作行为索引 - Negentropy-Lab Agent Behavior Index

**版本**: v7.1.0 (Gateway生态系统完整版 + 协作模式索引优化)
**最后更新**: 2026-02-12
**状态**: 🟡 Phase 1D架构基线完成，运行实现持续对齐
**宪法依据**: §106 Agent身份公理、§109知识图谱公理、§110协作效率公理、§152单一真理源公理、§190网络韧性公理
**说明**: 本文件为Agent协作行为索引，详细协作模式请参考`t2_protocols`目录下的WF-30到WF-32文档（`WF-30_simple_routing.md`、`WF-31_parallel_collaboration.md`、`WF-32_cascade_review.md`）

---

## 1. 概述

本文件定义了Negentropy-Lab项目中Agent系统的运行时协作行为规范。根据基本法§106 Agent身份公理，每个Agent必须拥有唯一身份标识和明确职责。系统采用三层架构(L1-L2-L3)实现高效的跨部门协作，所有行为必须符合宪法约束。

### 1.1 核心原则
1. **职责分离**: 每个Agent有明确的专业领域和职责边界
2. **分层协作**: 严格遵循L1入口层、L2协调层、L3专业层的三层架构
3. **宪法合规**: 所有协作必须符合宪法约束，特别是§110协作效率公理
4. **状态可观测**: 所有协作状态必须可监控和可审计

### 1.2 运行时断言
```typescript
// 所有Agent必须遵守的运行时断言
assert(agentId !== null && agentId !== undefined, "Agent必须拥有唯一标识");
assert(responsibility !== '', "Agent必须明确定义职责");
assert(layer in ['L1', 'L2', 'L3'], "Agent必须属于三层架构之一");
assert(maxResponseTime > 0, "Agent必须定义最大响应时间");
```

---

## 2. 三层架构运行时行为

### 2.1 L1入口层 - 办公厅主任 Agent
**标识**: `agent:office_director`
**宪法依据**: §101同步公理、§102熵减原则、§109协作流程公理

#### 运行时行为规范
1. **接收行为** (100ms内完成)
   - 接收所有用户消息
   - 验证消息格式和完整性
   - 记录消息时间戳和来源

2. **复杂度评估行为** (2秒内完成)
   - 意图识别和分类
   - 复杂度评估(1-10分)
   - 复杂度计算：`评分 = 意图复杂度 + 部门数量×2 + 宪法影响度×3 + 知识库影响度×2 + 预估处理时间(分钟)`

3. **路由行为** (5秒内完成)
   - 复杂度≤7: 直接路由到对应L3专业Agent
   - 复杂度>7: 转交给L2内阁总理Agent协调
   - 记录路由决策和目标Agent

4. **归档行为** (异步，30秒内完成)
   - 记录完整的对话历史
   - 提取关键知识要点
   - 归档协作结果到知识库

#### 运行时断言
```typescript
assert(receivedMessage.timestamp !== undefined, "必须记录消息时间戳");
assert(complexityScore >= 1 && complexityScore <= 10, "复杂度评分必须在1-10范围内");
assert(routingDecision !== undefined, "必须记录路由决策");
```

### 2.2 L2协调层 - 内阁总理 Agent
**标识**: `agent:prime_minister`
**宪法依据**: §102.3宪法同步公理、§141熵减验证公理、§152单一真理源公理、§190网络韧性公理

#### 运行时行为规范
1. **任务分析行为** (3秒内完成)
   - 接收办公厅主任转交的复杂任务(复杂度>7)
   - 分析任务需求和依赖关系
   - 确定需要参与的L3专业Agent

2. **协调行为** (5秒内完成)
   - 协调多Agent并行处理子任务
   - 分配资源和优先级
   - 建立Agent间通信通道

3. **监督行为** (持续监控)
   - 监督宪法合规性(§152单一真理源、§141熵减验证等)
   - 监控Agent执行进度
   - 检测和处理异常

4. **仲裁行为** (触发时执行，10秒内完成)
   - 仲裁Agent间的意见分歧
   - 基于宪法原则做出决策
   - 记录仲裁理由和结果

5. **整合行为** (5秒内完成)
   - 整合专业意见形成最终方案
   - 验证整合结果的宪法合规性
   - 返回整合结果给办公厅主任

#### 运行时断言
```typescript
assert(participatingAgents.length >= 2, "复杂任务必须至少协调2个专业Agent");
assert(complianceCheck.constitutional === true, "协调过程必须符合宪法");
assert(finalResult.references.length > 0, "整合结果必须引用真理源");
```

### 2.3 L3专业层 - 专业部门Agent
**宪法依据**: §106 Agent身份公理、§107通信安全公理、§108异构模型策略

#### 2.3.1 监察部Agent
**标识**: `agent:supervision_ministry`
**专业领域**: 法律合规、宪法解释、风险评估
**宪法依据**: §105数据完整性公理、§107通信安全公理

**运行时行为**:
- 调用时机：涉及宪法合规检查、法律风险分析、公理解释
- 最大响应时间：20秒
- 输出要求：必须提供宪法引用条款和合规性结论

**运行时断言**:
```typescript
assert(output.constitutionalReferences.length > 0, "必须引用宪法条款");
assert(output.complianceStatus in ['compliant', 'non-compliant', 'needs-review'], "必须明确合规状态");
```

#### 2.3.2 科技部Agent
**标识**: `agent:technology_ministry`
**专业领域**: 技术实现、代码编写、LLM集成
**宪法依据**: §108异构模型策略、§110协作效率公理

**运行时行为**:
- 调用时机：技术问题、代码生成需求、技术可行性评估
- 最大响应时间：25秒
- 输出要求：必须提供技术方案和实现建议

**运行时断言**:
```typescript
assert(output.technicalSolution !== undefined, "必须提供技术方案");
assert(output.implementationSteps.length > 0, "必须包含实现步骤");
```

#### 2.3.3 组织部Agent
**标识**: `agent:organization_ministry`
**专业领域**: 系统架构设计、技术选型、图谱维护
**宪法依据**: §109知识图谱公理、§190网络韧性公理

**运行时行为**:
- 调用时机：架构调整、图谱优化、系统扩展
- 最大响应时间：30秒
- 输出要求：必须提供架构原则和图谱更新建议

**运行时断言**:
```typescript
assert(output.architecturePrinciples.length > 0, "必须提供架构原则");
assert(output.knowledgeGraphUpdate !== undefined, "必须包含图谱更新建议");
```

---

## 3. 协作模式索引

本节提供三种核心协作模式的快速索引，详细实现请参考对应的工作流文档。

### 3.1 简单路由模式 (Simple Routing)
- **详细文档**: [WF-30_简单路由协作模式.md](../t2_protocols/WF-30_simple_routing.md)
- **适用场景**: 复杂度≤7的单一领域任务
- **核心流程**: 用户 → 办公厅主任 → L3专业Agent → 用户
- **宪法依据**: §110协作效率公理、§101同步公理
- **性能约束**: 总响应时间<30秒

**关键特性**:
- 快速响应，低协作开销
- 单一专业Agent处理
- 办公厅主任直接路由

**运行时断言**:
```typescript
assert(totalResponseTime < 30000, "简单路由必须在30秒内完成");
assert(participatingAgents.length === 1, "简单路由只能涉及一个专业Agent");
```

### 3.2 并行协作模式 (Parallel Collaboration)
- **详细文档**: [WF-31_并行协作模式.md](../t2_protocols/WF-31_parallel_collaboration.md)
- **适用场景**: 复杂度>7的多领域复杂任务
- **核心流程**: 用户 → 办公厅主任 → 内阁总理 → 多L3专业Agent并行 → 内阁总理整合 → 用户
- **宪法依据**: §141熵减验证公理、§152单一真理源公理、§190网络韧性公理
- **性能约束**: 总响应时间<60秒，熵值必须降低(ΔH < 0)

**关键特性**:
- 内阁总理协调多个专业Agent
- 并行处理提高效率
- 结果整合确保一致性
- 必须引用单一真理源

**运行时断言**:
```typescript
assert(participatingAgents.length >= 2, "并行协作必须至少涉及2个专业Agent");
assert(deltaEntropy < 0, "协作结果必须降低系统熵值");
assert(integratedResult.references.length > 0, "整合结果必须引用真理源");
```

### 3.3 级联审查模式 (Cascade Review)
- **详细文档**: [WF-32_级联审查模式.md](../t2_protocols/WF-32_cascade_review.md)
- **适用场景**: 涉及宪法合规或重大架构变更
- **核心流程**: 用户 → 监察部 → 组织部 → 科技部 → 内阁总理 → 用户
- **宪法依据**: §105数据完整性公理、§107通信安全公理、§109知识图谱公理
- **性能约束**: 总响应时间<90秒，必须更新知识图谱

**关键特性**:
- 三步审查确保合规性
- 监察部：宪法合规审查
- 组织部：架构原则审查
- 科技部：技术可行性审查
- 强制更新知识图谱

**运行时断言**:
```typescript
assert(reviewSteps.length === 3, "级联审查必须包含3个步骤");
assert(allReviewStepsCompleted, "所有审查步骤必须完成");
assert(knowledgeGraphUpdated === true, "必须更新知识图谱");
```

### 3.4 协作模式选择策略

根据任务复杂度和类型选择合适的协作模式：

```typescript
function selectCollaborationMode(request: UserRequest): CollaborationMode {
  const complexity = calculateComplexity(request);
  
  if (request.involvesConstitutionalCompliance || request.involvesArchitectureChange) {
    return 'cascade_review'; // 级联审查模式
  } else if (complexity <= 7) {
    return 'simple_routing'; // 简单路由模式
  } else {
    return 'parallel_collaboration'; // 并行协作模式
  }
}
```

---

## 4. 运行时约束与断言

### 4.1 响应时间约束 (§110)
| Agent类型 | 最大响应时间 | 超时处理 | 运行时断言 |
|-----------|--------------|----------|------------|
| **办公厅主任** | 10秒 | 自动降级到简单模式 | `assert(responseTime < 10000)` |
| **内阁总理** | 30秒 | 部分结果返回，继续异步处理 | `assert(responseTime < 30000)` |
| **监察部Agent** | 20秒 | 标记为待审查状态 | `assert(responseTime < 20000)` |
| **科技部Agent** | 25秒 | 返回技术框架建议 | `assert(responseTime < 25000)` |
| **组织部Agent** | 30秒 | 返回架构原则建议 | `assert(responseTime < 30000)` |

### 4.2 错误处理约束 (§190网络韧性公理)
1. **熔断机制**: 单个Agent故障不应影响整个系统
2. **降级策略**: 复杂模式失败时自动降级到简单模式
3. **重试机制**: 可重试的操作最多重试3次
4. **优雅失败**: 提供部分结果而非完全失败

**运行时断言**:
```typescript
assert(circuitBreakerOpen === false, "熔断器不应打开");
assert(fallbackMode !== undefined, "必须定义降级策略");
assert(retryCount <= 3, "最多重试3次");
```

### 4.3 状态同步约束 (§101同步公理)
1. **实时状态同步**: 所有Agent状态必须实时同步到知识库
2. **原子性操作**: Agent操作必须是原子的，要么完全成功要么完全失败
3. **版本一致性**: 协作过程中涉及的知识库版本必须一致
4. **审计日志**: 所有协作操作必须记录完整的审计日志

**运行时断言**:
```typescript
assert(agentState.knowledgeBaseVersion === latestVersion, "知识库版本必须一致");
assert(operation.atomic === true, "操作必须是原子的");
assert(auditLogEntry.exists, "必须记录审计日志");
```

---

## 5. 技术实现接口

### 5.1 Agent配置接口
```typescript
interface AgentConfig {
  id: string;           // 唯一标识，格式: agent:type_name
  name: string;         // 可读名称
  type: string;         // Agent类型: 'L1' | 'L2' | 'L3'
  description: string;  // 职责描述
  llm_provider: string; // LLM提供商
  llm_model: string;    // LLM模型
  max_response_time: number; // 最大响应时间(ms)
  system_prompt: string; // 系统提示词
  collaboration_rules: {
    can_initiate_collaboration: boolean;
    can_coordinate_others: boolean;
    expertise_domains: string[];
    required_preconditions: string[];
  };
}
```

**运行时断言**:
```typescript
assert(config.id.startsWith('agent:'), "Agent ID必须以'agent:'开头");
assert(config.type in ['L1', 'L2', 'L3'], "Agent类型必须是L1/L2/L3之一");
assert(config.max_response_time > 0, "最大响应时间必须大于0");
```

### 5.2 协作请求接口
```typescript
interface CollaborationRequest {
  coordinatorRequest: AgentRequest;   // 协调者请求
  specialistRequests: AgentRequest[]; // 专业Agent请求
}

interface AgentRequest {
  agentId: string;      // Agent标识
  agentName: string;    // Agent名称
  query: string;        // 查询内容
  context?: string;     // 上下文信息
  config?: {
    temperature?: number;
    maxTokens?: number;
  };
}
```

**运行时断言**:
```typescript
assert(request.coordinatorRequest !== undefined, "必须包含协调者请求");
assert(request.specialistRequests.length >= 1, "必须包含至少一个专业Agent请求");
```

### 5.3 协作结果接口
```typescript
interface CollaborationResult {
  collaborationId: string;      // 协作唯一ID
  coordinator: AgentInfo;       // 协调者信息
  participants: AgentInfo[];    // 参与者信息
  result: any;                  // 协作结果
  processingTime: number;       // 处理时间(ms)
  complianceCheck: {
    constitutional: boolean;    // 宪法合规性
    technical: boolean;         // 技术合规性
    operational: boolean;       // 操作合规性
  };
  entropyChange: number;        // 熵值变化ΔH
}
```

**运行时断言**:
```typescript
assert(result.collaborationId !== undefined, "必须包含协作ID");
assert(result.complianceCheck.constitutional === true, "必须符合宪法");
assert(result.entropyChange <= 0, "必须降低或维持熵值");
```

---

## 6. 监控与度量指标

### 6.1 关键性能指标(KPI)
| 指标 | 定义 | 目标值 | 监控频率 | 运行时断言 |
|------|------|--------|----------|------------|
| **协作成功率** | 成功完成的协作比例 | > 95% | 实时 | `assert(successRate > 0.95)` |
| **平均响应时间** | 从请求到响应的平均时间 | < 3秒 | 实时 | `assert(avgResponseTime < 3000)` |
| **宪法合规率** | 符合宪法约束的协作比例 | 100% | 每10分钟 | `assert(complianceRate === 1.0)` |
| **Agent健康度** | 在线且可用的Agent比例 | > 98% | 每5分钟 | `assert(healthRate > 0.98)` |
| **系统熵值变化** | 协作前后系统熵值变化 | ΔH ≤ 0 | 每次协作 | `assert(deltaH <= 0)` |

### 6.2 异常检测
1. **响应超时**: 超过最大响应时间阈值
2. **宪法违规**: 协作违反宪法约束
3. **Agent故障**: Agent健康状态异常
4. **协作死锁**: 协作进入无限等待状态
5. **资源耗尽**: 系统资源使用超过阈值

**运行时断言**:
```typescript
assert(!detected('response_timeout'), "不应检测到响应超时");
assert(!detected('constitutional_violation'), "不应检测到宪法违规");
assert(!detected('agent_failure'), "不应检测到Agent故障");
```

### 6.3 恢复策略
1. **自动重试**: 对于暂时性错误自动重试
2. **故障转移**: 切换到备用Agent或降级模式
3. **人工干预**: 严重故障时通知系统管理员
4. **状态恢复**: 从检查点恢复协作状态

**运行时断言**:
```typescript
assert(retryCount >= 1 || recoveryStrategy === 'manual', "必须尝试自动恢复");
assert(backupAgentAvailable === true, "必须有备用Agent可用");
```

---

## 7. Tier 3 验证目标

### 7.1 响应时间验证
```typescript
// Tier 3 checks (pytest):
test_response_time_office_director(): assert responseTime < 10000
test_response_time_prime_minister(): assert responseTime < 30000
test_response_time_supervision_ministry(): assert responseTime < 20000
test_response_time_technology_ministry(): assert responseTime < 25000
test_response_time_organization_ministry(): assert responseTime < 30000
```

### 7.2 宪法合规验证
```typescript
// Tier 3 checks (pytest):
test_constitutional_compliance_simple_routing(): assert complianceCheck.constitutional === true
test_constitutional_compliance_parallel_collaboration(): assert complianceCheck.constitutional === true
test_constitutional_compliance_cascade_review(): assert complianceCheck.constitutional === true
test_entropy_reduction(): assert deltaH < 0
test_single_truth_source(): assert references.length > 0
```

### 7.3 Agent健康度验证
```typescript
// Tier 3 checks (pytest):
test_agent_online_status(): assert agentStatus === 'online'
test_agent_capability_match(): assert capabilityMatch === true
test_agent_response_capability(): assert canRespond === true
test_all_agents_healthy(): assert healthRate > 0.98
```

### 7.4 系统熵值变化验证
```typescript
// Tier 3 checks (pytest):
test_system_entropy_before_collaboration(): record H_before
test_system_entropy_after_collaboration(): record H_after
test_entropy_reduction(): assert H_after <= H_before
test_composite_negentropy_score(): assert score >= 80
```

---

## 8. 运行时错误处理策略

| 场景 | 行为 | 运行时断言 |
|------|------|------------|
| **响应超时** | 返回部分结果，触发降级模式 | `assert(fallbackMode === true)` |
| **Agent故障** | 切换到备用Agent，记录错误 | `assert(backupAgentActivated === true)` |
| **宪法违规** | 拒绝执行，返回违规详情 | `assert(result === null)` |
| **协作死锁** | 超时中断，返回失败状态 | `assert(status === 'deadlock_detected')` |
| **知识库冲突** | 使用最新版本，记录冲突 | `assert(conflictVersion !== undefined)` |

---

## 9. 参考实现

### 9.1 现有Agent实现
- **办公厅主任**: `server/agents/OfficeDirectorAgent.ts`
- **内阁总理**: `server/agents/PrimeMinisterAgent.ts`
- **监察部Agent**: `server/agents/SupervisionMinistryAgent.ts`
- **科技部Agent**: `server/agents/TechnologyMinistryAgent.ts`
- **组织部Agent**: `server/agents/OrganizationMinistryAgent.ts`

### 9.2 协作引擎
- **Agent引擎**: `server/gateway/agent-engine.ts`
- **协作协议**: `server/agents/SuperAgentCoordinationProtocol.ts`

### 9.3 监控系统
- **宪法监控**: `server/gateway/monitoring/core/ConstitutionMonitor.ts`
- **熵值计算**: `server/gateway/monitoring/core/EntropyService.ts`
- **成本追踪**: `server/gateway/monitoring/core/CostTracker.ts`

---

## 10. 扩展性与演进

### 10.1 新Agent集成
1. **宪法合规检查**: 新Agent必须通过宪法合规验证
2. **职责定义**: 明确定义Agent的专业领域和职责边界
3. **协作规则配置**: 配置协作权限和参与规则
4. **系统集成**: 集成到Agent引擎和监控系统

### 10.2 模式演进
1. **模式识别**: 分析历史协作数据识别新模式
2. **模式验证**: 新模式的宪法合规性验证
3. **模式实现**: 实现新模式到协作引擎
4. **模式部署**: 部署新模式并监控效果

### 10.3 性能优化
1. **缓存策略**: 缓存常见协作结果
2. **预加载机制**: 预测性预加载相关资源
3. **并发优化**: 优化并行协作的并发控制
4. **资源调度**: 智能调度系统资源

---

**宪法依据**: §106 Agent身份公理、§109知识图谱公理、§110协作效率公理、§152单一真理源公理、§190网络韧性公理

**维护责任**: 组织部Agent负责本文件的维护和更新，监察部Agent负责宪法合规审查。

**版本历史**:
- v7.1.0 (2026-02-12): 协作模式索引优化，将详细协作模式提取为独立工作流文档(WF-30到WF-32)
- v7.0.0 (2026-02-12): 从agent_collaboration_patterns.md整合，完全重构为Negentropy-Lab运行时行为规范
- v1.0.0 (2026-02-01): 初始版本（金融数据分析行为规范）

## 附录：协作模式工作流索引

### WF-30系列：Agent协作模式
- **WF-30**: [简单路由协作模式](../t2_protocols/WF-30_simple_routing.md) - 复杂度≤7的单一领域任务
- **WF-31**: [并行协作模式](../t2_protocols/WF-31_parallel_collaboration.md) - 复杂度>7的多领域复杂任务
- **WF-32**: [级联审查模式](../t2_protocols/WF-32_cascade_review.md) - 涉及宪法合规或重大架构变更

### 其他相关工作流
- **WF-60**: [危机处理流程](../t2_protocols/WF-60_crisis_handling.md)
- **WF-61**: [版本发布流程](../t2_protocols/WF-61_version_release.md)
- **WF-62**: [房间绑定信息读取流程](../t2_protocols/WF-62_room_binding_info.md)
- **WF-63**: [安全操作流程](../t2_protocols/WF-63_security_operations.md)
- **WF-64**: [MCP运维流程](../t2_protocols/WF-64_mcp_operations.md)
