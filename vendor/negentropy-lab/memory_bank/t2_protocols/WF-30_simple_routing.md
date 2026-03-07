# WF-30: 简单路由协作模式 (Simple Routing)

**工作流ID**: WF-30
**适用场景**: 复杂度≤7的单一领域任务
**宪法依据**: §110协作效率公理、§101同步公理
**来源**: behavior_context.md §3.1
**版本**: v7.1.0
**状态**: 🟢 生产就绪

---

## 概述

简单路由协作模式适用于复杂度≤7的单一领域任务，由办公厅主任Agent直接路由到对应的L3专业Agent处理，无需内阁总理协调。该模式旨在快速响应用户请求，降低协作开销。

### 前置条件
- 用户请求已到达办公厅主任Agent
- 复杂度评估完成，评分≤7
- 目标L3专业Agent可用且健康

---

## 运行时流程

```
用户请求 → 办公厅主任(10ms接收) → 复杂度评估(2s) → 路由决策(5ms) → 
L3专业Agent(25s处理) → 办公厅主任(5ms整合) → 用户响应
```

### 步骤1: 消息接收（100ms内完成）
**执行者**: 办公厅主任Agent
**宪法依据**: §183任务接收与分发公理

**操作**:
1. 接收所有用户消息
2. 验证消息格式和完整性
3. 记录消息时间戳和来源
4. 生成唯一的消息ID

**运行时断言**:
```typescript
assert(message.timestamp !== undefined, "必须记录消息时间戳");
assert(message.id !== undefined, "必须生成唯一消息ID");
```

### 步骤2: 复杂度评估（2秒内完成）
**执行者**: 办公厅主任Agent
**宪法依据**: §183复杂度评估公理

**操作**:
1. 意图识别和分类
2. 计算复杂度评分（1-10分）
3. 确定是否适用简单路由模式

**复杂度计算公式**:
```typescript
评分 = 意图复杂度 + 部门数量×2 + 宪法影响度×3 + 知识库影响度×2 + 预估处理时间(分钟)
```

**判断条件**:
```typescript
if (complexityScore <= 7) {
  // 适用简单路由模式
  mode = 'simple_routing';
} else {
  // 转交给内阁总理协调
  mode = 'parallel_collaboration';
}
```

**运行时断言**:
```typescript
assert(complexityScore >= 1 && complexityScore <= 10, "复杂度评分必须在1-10范围内");
assert(mode === 'simple_routing', "必须确定为简单路由模式");
```

### 步骤3: 路由决策（5秒内完成）
**执行者**: 办公厅主任Agent
**宪法依据**: §183路由决策公理

**操作**:
1. 根据意图分类确定目标L3专业Agent
2. 验证目标Agent可用性
3. 转发任务到目标Agent
4. 记录路由决策和目标Agent

**路由映射表**:
```typescript
const routingMap = {
  '法律合规': 'agent:supervision_ministry',
  '宪法解释': 'agent:supervision_ministry',
  '技术实现': 'agent:technology_ministry',
  '代码生成': 'agent:technology_ministry',
  '架构设计': 'agent:organization_ministry',
  '图谱维护': 'agent:organization_ministry'
};
```

**运行时断言**:
```typescript
assert(targetAgent !== undefined, "必须确定目标Agent");
assert(targetAgent.startsWith('agent:'), "目标AgentID必须以'agent:'开头");
```

### 步骤4: 专业Agent处理（25秒内完成）
**执行者**: L3专业Agent（监察部/科技部/组织部）
**宪法依据**: §106 Agent身份公理

**操作**:
1. 接收任务和上下文
2. 执行专业领域处理
3. 生成专业建议或解决方案
4. 返回处理结果

**各专业Agent职责**:
- **监察部Agent**: 宪法合规检查、法律风险分析
- **科技部Agent**: 技术方案设计、代码实现建议
- **组织部Agent**: 架构原则建议、图谱更新方案

**运行时断言**:
```typescript
assert(result !== undefined, "必须返回处理结果");
assert(processingTime < 25000, "处理时间必须小于25秒");
```

### 步骤5: 结果整合（5秒内完成）
**执行者**: 办公厅主任Agent
**宪法依据**: §183结果整合公理

**操作**:
1. 接收L3专业Agent的处理结果
2. 验证结果完整性
3. 格式化为用户可读的响应
4. 返回给用户

**响应格式**:
```typescript
interface SimpleRoutingResponse {
  collaborationId: string;
  mode: 'simple_routing';
  targetAgent: string;
  result: any;
  processingTime: number;
  complianceCheck: {
    constitutional: boolean;
    technical: boolean;
  };
  references: string[];
}
```

**运行时断言**:
```typescript
assert(response.collaborationId !== undefined, "必须包含协作ID");
assert(response.complianceCheck.constitutional === true, "必须符合宪法");
assert(response.references.length > 0, "必须引用真理源");
```

---

## 宪法约束

### §110 协作效率公理
- **总响应时间**: 必须小于30秒
- **协作开销**: 必须最小化，避免不必要的协调

**运行时断言**:
```typescript
assert(totalResponseTime < 30000, "简单路由必须在30秒内完成");
assert(participatingAgents.length === 1, "简单路由只能涉及一个专业Agent");
```

### §101 同步公理
- **任务状态**: 必须实时同步到知识库
- **原子性**: 操作必须是原子的

**运行时断言**:
```typescript
assert(taskState.synced === true, "任务状态必须实时同步");
assert(operation.atomic === true, "操作必须是原子的");
```

---

## 性能指标

### 关键性能指标 (KPIs)

| 指标 | 目标值 | 监控频率 | 运行时断言 |
|------|--------|----------|------------|
| **总响应时间** | < 30秒 | 实时 | `assert(totalResponseTime < 30000)` |
| **办公厅主任处理时间** | < 5秒 | 实时 | `assert(officeDirectorTime < 5000)` |
| **专业Agent处理时间** | < 25秒 | 实时 | `assert(specialistTime < 25000)` |
| **成功率** | > 98% | 实时 | `assert(successRate > 0.98)` |
| **宪法合规率** | 100% | 每次协作 | `assert(complianceRate === 1.0)` |

### 监控要求
- 实时监控响应时间
- 监控Agent健康状态
- 审计所有路由决策
- 记录性能异常

---

## 错误处理

### 错误类型1: 响应超时
**症状**: 总响应时间超过30秒

**处理步骤**:
1. 记录超时事件到审计日志
2. 返回部分结果（如果可用）
3. 触发降级模式
4. 通知系统管理员

**运行时断言**:
```typescript
assert(fallbackMode === true, "必须触发降级模式");
```

### 错误类型2: Agent故障
**症状**: 目标L3专业Agent不可用

**处理步骤**:
1. 检测Agent健康状态
2. 尝试切换到备用Agent
3. 如果无备用Agent，转交给内阁总理协调
4. 记录故障事件

**运行时断言**:
```typescript
assert(backupAgentChecked === true, "必须检查备用Agent");
```

### 错误类型3: 宪法违规
**症状**: 处理结果不符合宪法约束

**处理步骤**:
1. 拒绝执行违规结果
2. 返回宪法违规详情
3. 建议用户调整请求
4. 记录违规事件到审计日志

**运行时断言**:
```typescript
assert(result === null, "必须拒绝宪法违规结果");
```

---

## 审计要求

**对应宪法条款**: §136 强制审计

### 强制记录字段
- **协作ID**: 唯一标识符
- **消息ID**: 原始消息ID
- **路由决策**: 选择的Agent和理由
- **复杂度评分**: 计算的复杂度分数
- **处理时间**: 各阶段耗时
- **宪法合规性**: 合规检查结果
- **引用来源**: 引用的真理源
- **时间戳**: 各步骤时间戳
- **用户ID**: 发起请求的用户

### 审计频率
- **每次协作**: 记录完整的审计日志
- **实时监控**: 监控性能指标
- **每日汇总**: 生成协作模式统计报告

---

## 集成测试

### 测试场景

1. **正常流程**: 简单路由成功
   - 输入: 复杂度=5的单一领域任务
   - 预期: 在30秒内返回结果，宪法合规

2. **边界情况**: 复杂度刚好等于7
   - 输入: 复杂度=7的单一领域任务
   - 预期: 适用简单路由模式，在30秒内返回结果

3. **错误情况**: Agent故障
   - 输入: 目标Agent不可用
   - 预期: 触发降级模式，切换到备用Agent或转交内阁总理

### 测试频率
- **单元测试**: 每次代码变更时执行
- **集成测试**: 每日执行完整流程测试
- **压力测试**: 每月执行高并发场景测试

---

## 维护指南

1. **路由映射更新**: 定期更新路由映射表，确保覆盖所有意图类型
2. **复杂度阈值调整**: 根据实际情况调整复杂度阈值（当前为7）
3. **性能优化**: 持续优化各阶段处理时间
4. **文档同步**: 更新此文档时，同步更新behavior_context.md第3.1节

---

**遵循逆熵实验室宪法约束: 代码即数学证明，架构即宪法约束。**
