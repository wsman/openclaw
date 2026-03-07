# WF-32: 级联审查模式 (Cascade Review)

**工作流ID**: WF-32
**适用场景**: 涉及宪法合规或重大架构变更
**宪法依据**: §105数据完整性公理、§107通信安全公理、§109知识图谱公理
**来源**: behavior_context.md §3.3
**版本**: v7.1.0
**状态**: 🟢 生产就绪

---

## 概述

级联审查模式适用于涉及宪法合规或重大架构变更的任务，通过监察部、组织部、科技部三个专业Agent的级联审查，确保变更符合宪法约束、架构原则和技术可行性。该模式旨在严格审查高风险变更，确保系统稳定性和合规性。

### 前置条件
- 用户请求涉及宪法合规或重大架构变更
- 监察部、组织部、科技部Agent均可用且健康
- 知识库系统正常运行

---

## 运行时流程

```
用户请求 → 办公厅主任(10ms接收) → 监察部Agent(合规审查, 20s) → 
组织部Agent(架构审查, 30s) → 科技部Agent(技术实现, 25s) → 
内阁总理(整合批准, 5s) → 办公厅主任(5ms) → 用户响应
```

### 步骤1: 请求识别（10ms内完成）
**执行者**: 办公厅主任Agent
**宪法依据**: §183任务接收与分发公理

**操作**:
1. 接收用户请求
2. 识别请求类型（宪法合规/架构变更）
3. 判断是否需要级联审查
4. 启动级联审查流程

**识别标准**:
```typescript
interface ReviewTrigger {
  type: 'constitutional_compliance' | 'architecture_change' | 'both';
  severity: 'low' | 'medium' | 'high' | 'critical';
  requiresCascadeReview: boolean;
}

function identifyReviewTrigger(request: UserRequest): ReviewTrigger {
  // 识别请求类型
  if (request.involvesConstitutionalCompliance) {
    return {
      type: 'constitutional_compliance',
      severity: 'high',
      requiresCascadeReview: true
    };
  } else if (request.involvesArchitectureChange) {
    return {
      type: 'architecture_change',
      severity: assessSeverity(request),
      requiresCascadeReview: request.severity !== 'low'
    };
  }
  
  return { type: 'both', severity: 'critical', requiresCascadeReview: true };
}
```

**运行时断言**:
```typescript
assert(trigger.requiresCascadeReview === true, "必须启动级联审查");
assert(trigger.severity !== 'low', "严重程度不能为低");
```

### 步骤2: 监察部审查（20秒内完成）
**执行者**: 监察部Agent
**宪法依据**: §105数据完整性公理

**操作**:
1. 审查请求的宪法合规性
2. 分析法律风险和合规要求
3. 提供宪法引用条款
4. 给出合规性结论

**审查内容**:
```typescript
interface SupervisionReview {
  requestId: string;
  constitutional: boolean;
  complianceStatus: 'compliant' | 'non-compliant' | 'needs-review';
  constitutionalReferences: string[];
  riskAssessment: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
  };
  recommendations: string[];
  processingTime: number;
}

function conductSupervisionReview(request: UserRequest): SupervisionReview {
  // 检查宪法合规性
  const constitutional = checkConstitutionalCompliance(request);
  
  // 分析法律风险
  const riskAssessment = analyzeLegalRisks(request);
  
  // 提供宪法引用
  const references = extractConstitutionalReferences(request);
  
  // 给出合规性结论
  const complianceStatus = determineComplianceStatus(constitutional, riskAssessment);
  
  return {
    requestId: request.id,
    constitutional,
    complianceStatus,
    constitutionalReferences: references,
    riskAssessment,
    recommendations: generateRecommendations(request),
    processingTime: Date.now() - startTime
  };
}
```

**运行时断言**:
```typescript
assert(review.constitutionalReferences.length > 0, "必须引用宪法条款");
assert(review.complianceStatus in ['compliant', 'non-compliant', 'needs-review'], "必须明确合规状态");
assert(review.processingTime < 20000, "监察部审查时间必须小于20秒");
```

### 步骤3: 组织部审查（30秒内完成）
**执行者**: 组织部Agent
**宪法依据**: §109知识图谱公理

**前置条件**: 监察部审查完成，合规性检查通过

**操作**:
1. 分析架构变更的合理性
2. 评估对知识图谱的影响
3. 提供架构原则建议
4. 给出图谱更新方案

**审查内容**:
```typescript
interface OrganizationReview {
  requestId: string;
  architectureCompliant: boolean;
  architecturePrinciples: string[];
  knowledgeGraphImpact: {
    affectedNodes: string[];
    affectedEdges: string[];
    updateRequired: boolean;
  };
  graphUpdatePlan: GraphUpdatePlan | null;
  recommendations: string[];
  processingTime: number;
}

function conductOrganizationReview(
  request: UserRequest,
  supervisionReview: SupervisionReview
): OrganizationReview {
  // 检查架构合规性
  const architectureCompliant = checkArchitectureCompliance(request);
  
  // 评估知识图谱影响
  const knowledgeGraphImpact = assessKnowledgeGraphImpact(request);
  
  // 提供架构原则
  const architecturePrinciples = extractArchitecturePrinciples(request);
  
  // 生成图谱更新方案
  const graphUpdatePlan = knowledgeGraphImpact.updateRequired 
    ? generateGraphUpdatePlan(knowledgeGraphImpact)
    : null;
  
  return {
    requestId: request.id,
    architectureCompliant,
    architecturePrinciples,
    knowledgeGraphImpact,
    graphUpdatePlan,
    recommendations: generateRecommendations(request),
    processingTime: Date.now() - startTime
  };
}
```

**运行时断言**:
```typescript
assert(review.architecturePrinciples.length > 0, "必须提供架构原则");
assert(review.processingTime < 30000, "组织部审查时间必须小于30秒");
```

### 步骤4: 科技部审查（25秒内完成）
**执行者**: 科技部Agent
**宪法依据**: §108异构模型策略

**前置条件**: 监察部和组织部审查均通过

**操作**:
1. 评估技术可行性
2. 提供技术实现方案
3. 估算开发时间和资源
4. 识别潜在技术风险

**审查内容**:
```typescript
interface TechnologyReview {
  requestId: string;
  technicalFeasible: boolean;
  implementationPlan: {
    steps: string[];
    estimatedDuration: number;
    requiredResources: string[];
  };
  technicalRisks: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
  };
  recommendations: string[];
  processingTime: number;
}

function conductTechnologyReview(
  request: UserRequest,
  supervisionReview: SupervisionReview,
  organizationReview: OrganizationReview
): TechnologyReview {
  // 检查技术可行性
  const technicalFeasible = checkTechnicalFeasibility(request);
  
  // 制定实现计划
  const implementationPlan = createImplementationPlan(request);
  
  // 识别技术风险
  const technicalRisks = identifyTechnicalRisks(request);
  
  return {
    requestId: request.id,
    technicalFeasible,
    implementationPlan,
    technicalRisks,
    recommendations: generateRecommendations(request),
    processingTime: Date.now() - startTime
  };
}
```

**运行时断言**:
```typescript
assert(review.technicalFeasible !== undefined, "必须明确技术可行性");
assert(review.implementationPlan.steps.length > 0, "必须包含实现步骤");
assert(review.processingTime < 25000, "科技部审查时间必须小于25秒");
```

### 步骤5: 内阁总理整合批准（5秒内完成）
**执行者**: 内阁总理Agent
**宪法依据**: §184结果整合公理

**前置条件**: 三步审查全部完成

**操作**:
1. 整合三个部门的审查结果
2. 综合评估变更的风险和收益
3. 做出最终批准或拒绝决策
4. 返回整合结果给办公厅主任

**整合逻辑**:
```typescript
interface CascadeReviewIntegration {
  requestId: string;
  allStepsCompleted: boolean;
  overallDecision: 'approved' | 'rejected' | 'needs-revision';
  approvalCriteria: {
    constitutional: boolean;
    architectureCompliant: boolean;
    technicalFeasible: boolean;
  };
  integratedRecommendations: string[];
  knowledgeGraphUpdateRequired: boolean;
  nextSteps: string[];
  processingTime: number;
}

function integrateCascadeReview(
  supervisionReview: SupervisionReview,
  organizationReview: OrganizationReview,
  technologyReview: TechnologyReview
): CascadeReviewIntegration {
  // 检查所有步骤是否完成
  const allStepsCompleted = 
    supervisionReview.processingTime > 0 &&
    organizationReview.processingTime > 0 &&
    technologyReview.processingTime > 0;
  
  // 评估批准标准
  const approvalCriteria = {
    constitutional: supervisionReview.constitutional,
    architectureCompliant: organizationReview.architectureCompliant,
    technicalFeasible: technologyReview.technicalFeasible
  };
  
  // 做出最终决策
  const overallDecision = makeFinalDecision(approvalCriteria);
  
  // 整合建议
  const integratedRecommendations = [
    ...supervisionReview.recommendations,
    ...organizationReview.recommendations,
    ...technologyReview.recommendations
  ];
  
  // 确定下一步操作
  const nextSteps = determineNextSteps(overallDecision, integratedRecommendations);
  
  return {
    requestId: supervisionReview.requestId,
    allStepsCompleted,
    overallDecision,
    approvalCriteria,
    integratedRecommendations,
    knowledgeGraphUpdateRequired: organizationReview.knowledgeGraphImpact.updateRequired,
    nextSteps,
    processingTime: Date.now() - startTime
  };
}

function makeFinalDecision(criteria: ApprovalCriteria): Decision {
  if (criteria.constitutional && criteria.architectureCompliant && criteria.technicalFeasible) {
    return 'approved';
  } else if (!criteria.constitutional) {
    return 'rejected';
  } else {
    return 'needs-revision';
  }
}
```

**运行时断言**:
```typescript
assert(integration.allStepsCompleted === true, "所有审查步骤必须完成");
assert(integration.overallDecision !== undefined, "必须做出最终决策");
assert(integration.nextSteps.length > 0, "必须提供下一步操作");
```

### 步骤6: 知识图谱更新（如需要）
**执行者**: 组织部Agent
**宪法依据**: §109知识图谱公理

**触发条件**: `knowledgeGraphUpdateRequired === true`

**操作**:
1. 执行图谱更新方案
2. 验证更新结果的完整性
3. 记录更新历史
4. 通知相关Agent

**更新代码示例**:
```typescript
async function updateKnowledgeGraph(
  graphUpdatePlan: GraphUpdatePlan
): Promise<UpdateResult> {
  // 更新节点
  for (const node of graphUpdatePlan.nodesToUpdate) {
    await updateNode(node);
  }
  
  // 更新边
  for (const edge of graphUpdatePlan.edgesToUpdate) {
    await updateEdge(edge);
  }
  
  // 验证更新
  const validation = validateGraphUpdate(graphUpdatePlan);
  
  if (!validation.success) {
    throw new Error(`Graph update failed: ${validation.error}`);
  }
  
  return {
    success: true,
    updatedNodes: graphUpdatePlan.nodesToUpdate.length,
    updatedEdges: graphUpdatePlan.edgesToUpdate.length,
    timestamp: Date.now()
  };
}
```

**运行时断言**:
```typescript
assert(knowledgeGraphUpdated === true, "必须更新知识图谱");
assert(updateResult.success === true, "图谱更新必须成功");
```

### 步骤7: 返回审查结果（5ms内完成）
**执行者**: 办公厅主任Agent
**宪法依据**: §183结果返回公理

**操作**:
1. 接收内阁总理的整合结果
2. 格式化为用户可读的响应
3. 返回给用户

**响应格式**:
```typescript
interface CascadeReviewResponse {
  collaborationId: string;
  mode: 'cascade_review';
  requestId: string;
  overallDecision: 'approved' | 'rejected' | 'needs-revision';
  reviewSteps: {
    supervision: SupervisionReview;
    organization: OrganizationReview;
    technology: TechnologyReview;
  };
  integration: CascadeReviewIntegration;
  knowledgeGraphUpdated: boolean;
  processingTime: number;
  references: string[];
}

function formatCascadeReviewResponse(
  integration: CascadeReviewIntegration,
  reviews: {
    supervision: SupervisionReview;
    organization: OrganizationReview;
    technology: TechnologyReview;
  }
): CascadeReviewResponse {
  return {
    collaborationId: generateCollaborationId(),
    mode: 'cascade_review',
    requestId: integration.requestId,
    overallDecision: integration.overallDecision,
    reviewSteps: reviews,
    integration,
    knowledgeGraphUpdated: integration.knowledgeGraphUpdateRequired ? true : false,
    processingTime: calculateTotalProcessingTime(reviews, integration),
    references: extractAllReferences(reviews)
  };
}
```

**运行时断言**:
```typescript
assert(response.collaborationId !== undefined, "必须包含协作ID");
assert(response.overallDecision !== undefined, "必须包含最终决策");
assert(response.references.length > 0, "必须引用真理源");
```

---

## 宪法约束

### §105 数据完整性公理
- **原子性操作**: 审查过程必须是原子的
- **数据一致性**: 审查结果必须保持一致性

**运行时断言**:
```typescript
assert(operation.atomic === true, "操作必须是原子的");
assert(dataConsistencyVerified === true, "必须验证数据一致性");
```

### §107 通信安全公理
- **敏感信息加密**: 敏感信息必须加密传输
- **安全通信**: Agent间通信必须使用安全协议

**运行时断言**:
```typescript
assert(communicationEncrypted === true, "通信必须加密");
assert(secureProtocolUsed === true, "必须使用安全协议");
```

### §109 知识图谱公理
- **图谱更新**: 变更必须更新知识图谱
- **版本一致性**: 图谱版本必须保持一致

**运行时断言**:
```typescript
assert(knowledgeGraphUpdated === true, "必须更新知识图谱");
assert(graphVersionConsistent === true, "图谱版本必须一致");
```

---

## 性能指标

### 关键性能指标 (KPIs)

| 指标 | 目标值 | 监控频率 | 运行时断言 |
|------|--------|----------|------------|
| **总响应时间** | < 90秒 | 实时 | `assert(totalResponseTime < 90000)` |
| **监察部审查时间** | < 20秒 | 实时 | `assert(supervisionTime < 20000)` |
| **组织部审查时间** | < 30秒 | 实时 | `assert(organizationTime < 30000)` |
| **科技部审查时间** | < 25秒 | 实时 | `assert(technologyTime < 25000)` |
| **审查成功率** | > 95% | 实时 | `assert(successRate > 0.95)` |
| **宪法合规率** | 100% | 每次审查 | `assert(complianceRate === 1.0)` |

### 监控要求
- 实时监控各步骤执行时间
- 监控Agent健康状态
- 监控知识图谱更新状态
- 审计所有审查决策

---

## 错误处理

### 错误类型1: 宪法违规
**症状**: 监察部审查发现宪法违规

**处理步骤**:
1. 拒绝执行变更请求
2. 返回宪法违规详情
3. 提供合规建议
4. 记录违规事件到审计日志

**运行时断言**:
```typescript
assert(result.overallDecision === 'rejected', "必须拒绝宪法违规请求");
assert(result.references.length > 0, "必须提供宪法引用");
```

### 错误类型2: 架构不合规
**症状**: 组织部审查发现架构不合规

**处理步骤**:
1. 标记为需要修改
2. 返回架构不合规详情
3. 提供架构调整建议
4. 等待用户修改后重新提交

**运行时断言**:
```typescript
assert(result.overallDecision === 'needs-revision', "必须标记为需要修改");
assert(result.nextSteps.length > 0, "必须提供下一步操作");
```

### 错误类型3: 技术不可行
**症状**: 科技部审查发现技术不可行

**处理步骤**:
1. 分析技术障碍
2. 提供替代技术方案
3. 评估替代方案的可行性
4. 返回技术可行性评估

**运行时断言**:
```typescript
assert(alternativeSolutionsProvided === true, "必须提供替代技术方案");
assert(assessmentComplete === true, "必须完成可行性评估");
```

### 错误类型4: Agent故障
**症状**: 某个专业Agent故障

**处理步骤**:
1. 检测故障Agent
2. 尝试切换到备用Agent
3. 如果无备用Agent，推迟审查并通知用户
4. 记录故障事件

**运行时断言**:
```typescript
assert(backupAgentChecked === true, "必须检查备用Agent");
assert(userNotified === true, "必须通知用户");
```

---

## 审计要求

**对应宪法条款**: §136 强制审计

### 强制记录字段
- **协作ID**: 唯一标识符
- **请求ID**: 原始请求ID
- **触发类型**: 审查触发类型（宪法合规/架构变更）
- **各步骤审查结果**: 监察部、组织部、科技部的审查结果
- **最终决策**: 批准/拒绝/需要修改
- **知识图谱更新**: 是否更新及更新详情
- **宪法合规性**: 合规检查结果
- **引用来源**: 引用的真理源列表
- **处理时间**: 各步骤耗时
- **时间戳**: 各步骤时间戳
- **用户ID**: 发起请求的用户

### 审计频率
- **每次审查**: 记录完整的审计日志
- **实时监控**: 监控各步骤执行状态
- **每日汇总**: 生成审查模式统计报告

---

## 集成测试

### 测试场景

1. **正常流程**: 级联审查批准
   - 输入: 涉及宪法合规的变更请求
   - 预期: 三步审查通过，批准变更，更新知识图谱

2. **边界情况**: 需要修改的变更
   - 输入: 架构需要调整的变更请求
   - 预期: 监察部通过，组织部标记为需要修改，提供调整建议

3. **错误情况**: 宪法违规
   - 输入: 违反宪法的变更请求
   - 预期: 监察部拒绝，返回违规详情和宪法引用

4. **复杂情况**: 技术不可行
   - 输入: 技术上不可实现的变更请求
   - 预期: 科技部识别技术障碍，提供替代方案

### 测试频率
- **单元测试**: 每次代码变更时执行
- **集成测试**: 每日执行完整流程测试
- **压力测试**: 每月执行高并发场景测试

---

## 维护指南

1. **审查标准更新**: 定期更新各步骤的审查标准
2. **知识图谱优化**: 持续优化图谱更新策略
3. **技术评估改进**: 改进技术可行性评估方法
4. **文档同步**: 更新此文档时，同步更新behavior_context.md第3.3节

---

**遵循逆熵实验室宪法约束: 代码即数学证明，架构即宪法约束。**
