# LS-101 模型选择器接口标准 (Model Selector Interface Standard)

**宪法依据**: §192模型选择器公理、§193模型选择器更新公理、§110协作效率公理
**技术法依据**: LS-101 (模型选择器接口标准)
**版本**: v1.3.0
**状态**: 🟢 活跃
**AI友好度**: ⭐⭐⭐⭐⭐ (5/5星 - 专为AI Agent设计)

---

## 🎯 标准目的

### AI Agent请注意：
**目标**: 为所有LLM请求提供统一的路由接口，智能选择最佳LLM模型。
**要解决的问题**: 不同任务需要不同模型，成本和质量需要平衡，Provider可能故障。

### 核心需求：
1. **统一接口**: 隐藏底层Provider差异
2. **智能路由**: 根据任务类型自动选择最佳模型  
3. **成本感知**: 选择性价比最高的模型
4. **故障转移**: Provider失败时自动重试备用
5. **性能监控**: 实时收集响应时间和成功率

---

## 📋 接口定义 (面向AI的实现指南)

### 1. IModelSelector 接口 (TypeScript)
```typescript
// AI注意：实现这个接口，你的模型选择器就能被系统调用
export interface IModelSelector {
  /**
   * 选择最适合当前任务的模型
   * @param taskRequirements 任务需求描述
   * @returns 选择的模型配置
   */
  selectModel(taskRequirements: TaskRequirements): Promise<ModelSelection>;
  
  /**
   * 获取所有可用Provider的健康状态
   */
  getProviderHealth(): Promise<ProviderHealthStatus[]>;
  
  /**
   * 更新Provider的性能指标
   * @param providerId Provider标识
   * @param metrics 性能指标
   */
  updateProviderMetrics(providerId: string, metrics: PerformanceMetrics): Promise<void>;
  
  /**
   * 手动强制路由到特定Provider（用于测试或特殊情况）
   */
  forceRouteToProvider(providerId: string, reason: string): Promise<void>;
}
```

### 2. TaskRequirements 任务需求定义
```typescript
// AI注意：这些字段告诉模型选择器需要什么类型的模型
export interface TaskRequirements {
  // 任务类型：帮助选择处理策略
  taskType: 'code_generation' | 'legal_analysis' | 'architectural_design' | 
            'knowledge_query' | 'document_summary' | 'general_chat';
  
  // 复杂度：1-10，决定模型质量需求
  complexity: number;
  
  // 响应质量需求：'speed'快速响应，'quality'高质量，'balanced'平衡
  qualityPreference: 'speed' | 'quality' | 'balanced';
  
  // 上下文长度：需要处理的Token数量
  contextLength: number;
  
  // 预算限制：可选，最大花费（单位：美元）
  budgetLimit?: number;
  
  // 特定需求：如"需要代码生成能力"、"需要法律知识"
  specificRequirements?: string[];
}
```

### 3. ModelSelection 模型选择结果
```typescript
// AI注意：这是模型选择器给你的路由指令
export interface ModelSelection {
  // 选择的Provider
  provider: 'openai' | 'anthropic' | 'deepseek' | 'local_llm' | 'fallback';
  
  // 具体模型
  model: 'gpt-4-turbo' | 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3-opus' | 
         'claude-3-sonnet' | 'deepseek-chat' | 'llama-3-70b' | string;
  
  // 选择理由（用于调试和日志）
  reasoning: string;
  
  // 预期成本（每1000个Token）
  estimatedCostPer1kTokens: number;
  
  // 预期性能指标
  expectedResponseTime: number; // 毫秒
  expectedQuality: number; // 1-10分
  
  // 备用选项（如果主选择失败）
  fallbackOptions: ModelSelection[];
}
```

---

## 🔧 实现步骤 (AI可执行)

### 步骤1：评估任务类型 (Task Assessment)
```typescript
// AI示例：如何评估任务类型
function assessTaskRequirements(userMessage: string, context: ChatContext): TaskRequirements {
  return {
    taskType: determineTaskType(userMessage), // 基于关键词分析
    complexity: estimateComplexity(userMessage, context),
    qualityPreference: determineQualityPreference(context),
    contextLength: calculateContextLength(context),
    specificRequirements: extractSpecificRequirements(userMessage)
  };
}
```

### 步骤2：应用选择算法 (Selection Algorithm)
```typescript
// AI示例：简单的成本效益算法
function selectModelByCostBenefit(req: TaskRequirements): ModelSelection {
  const candidates = getAllAvailableModels();
  
  // 过滤：移除不满足需求的模型
  const filtered = candidates.filter(model => 
    model.supportsTaskType(req.taskType) &&
    model.maxContextLength >= req.contextLength &&
    model.isHealthy
  );
  
  // 评分：成本、质量、速度的综合评分
  const scored = filtered.map(model => ({
    model,
    score: calculateModelScore(model, req)
  }));
  
  // 选择：最高分模型
  const best = scored.sort((a, b) => b.score - a.score)[0];
  
  return {
    provider: best.model.provider,
    model: best.model.name,
    reasoning: `选择原因：成本效益比最佳 (得分: ${best.score})`,
    estimatedCostPer1kTokens: best.model.cost,
    expectedResponseTime: best.model.avgResponseTime,
    expectedQuality: best.model.qualityScore,
    fallbackOptions: scored.slice(1, 3).map(s => s.model)
  };
}
```

### 步骤3：实现健康检查 (Health Checks)
```typescript
// AI示例：Provider健康监控
async function monitorProviderHealth(): Promise<void> {
  for (const provider of allProviders) {
    try {
      const health = await provider.checkHealth();
      if (!health.isHealthy) {
        console.warn(`Provider ${provider.id} 不健康: ${health.reason}`);
        // 自动降级或标记为不可用
      }
    } catch (error) {
      console.error(`Provider ${provider.id} 健康检查失败:`, error);
    }
  }
}
```

---

## 🚀 快速开始示例 (AI可以直接使用的代码)

### 示例1：为Agent请求选择模型
```typescript
// AI注意：在你的Agent服务中这样使用模型选择器
class LegalExpertAgent {
  constructor(private modelSelector: IModelSelector) {}
  
  async analyzeLegalClause(clause: string, context: string) {
    // 1. 评估任务需求
    const requirements: TaskRequirements = {
      taskType: 'legal_analysis',
      complexity: 8, // 法律分析通常复杂
      qualityPreference: 'quality', // 法律问题需要高质量
      contextLength: context.length / 4, // 估算Token数量
      specificRequirements: ['legal_knowledge', 'precision', 'citation']
    };
    
    // 2. 选择模型
    const selection = await this.modelSelector.selectModel(requirements);
    console.log(`选择了模型: ${selection.model}, 原因: ${selection.reasoning}`);
    
    // 3. 使用选择的模型
    return await callLLM(selection.provider, selection.model, {
      prompt: `作为监察部Agent，分析以下法律条款：${clause}`,
      context: context,
      maxTokens: 2000
    });
  }
}
```

### 示例2：成本敏感型任务
```typescript
// AI注意：简单任务使用低成本模型
class SummaryAgent {
  async summarizeText(text: string) {
    const requirements: TaskRequirements = {
      taskType: 'document_summary',
      complexity: 3, // 摘要任务相对简单
      qualityPreference: 'speed', // 快速响应
      contextLength: text.length / 4,
      budgetLimit: 0.01 // 最大花费1美分
    };
    
    // 模型选择器会自动选择低成本模型
    const selection = await this.modelSelector.selectModel(requirements);
    // 通常会选择 gpt-3.5-turbo 或 deepseek-chat
  }
}
```

---

## ⚠️ 常见错误与解决方案 (AI故障排除指南)

### 错误1：所有Provider都不可用
**现象**: `selectModel()` 抛出 "No available providers" 错误
**解决方案**:
```typescript
// 1. 检查本地模型
if (localLLMAvailable()) {
  return {
    provider: 'local_llm',
    model: 'llama-3-70b',
    reasoning: '使用本地模型作为降级方案',
    // ... 其他字段
  };
}

// 2. 返回优雅降级响应
throw new ErrorWithDegradation(
  'LLM服务暂时不可用，请稍后重试',
  { 
    fallbackResponse: '我当前无法访问AI模型，但您可以尝试...'
  }
);
```

### 错误2：成本超出预算
**现象**: 选择的模型成本超过 `budgetLimit`
**解决方案**:
```typescript
// 在评分算法中添加成本限制
function calculateModelScore(model: Model, req: TaskRequirements): number {
  let score = model.qualityScore * 0.6 + 
              (1 / model.avgResponseTime) * 0.2 + 
              (1 / model.cost) * 0.2;
  
  // 惩罚超出预算的模型
  if (req.budgetLimit && model.cost > req.budgetLimit * 1.5) {
    score *= 0.3; // 大幅降低分数
  }
  
  return score;
}
```

### 错误3：响应时间过长
**现象**: 模型响应超过 `expectedResponseTime`
**解决方案**:
```typescript
// 实现超时和重试机制
async function callLLMWithRetry(selection: ModelSelection, prompt: string, options: CallOptions) {
  const timeout = selection.expectedResponseTime * 1.5; // 1.5倍容忍度
  
  try {
    return await Promise.race([
      callLLM(selection.provider, selection.model, prompt, options),
      timeoutPromise(timeout, `模型响应超时: ${selection.model}`)
    ]);
  } catch (error) {
    // 记录性能问题
    await modelSelector.updateProviderMetrics(selection.provider, {
      lastFailure: Date.now(),
      failureReason: error.message
    });
    
    // 尝试备用模型
    if (selection.fallbackOptions.length > 0) {
      const fallback = selection.fallbackOptions[0];
      console.log(`切换到备用模型: ${fallback.model}`);
      return callLLMWithRetry(fallback, prompt, options);
    }
    
    throw error;
  }
}
```

---

## 📊 性能指标与监控 (AI运维指南)

### 关键监控指标
```typescript
// AI注意：定期收集这些指标，优化选择策略
export interface PerformanceMetrics {
  // 成功率统计
  totalRequests: number;
  successfulRequests: number;
  failureRate: number;
  
  // 响应时间统计
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  
  // 成本统计
  totalCost: number;
  averageCostPerRequest: number;
  
  // 质量评估（需要人工反馈或自动评估）
  qualityScores: number[]; // 1-10分
  averageQualityScore: number;
}

// 示例监控函数
async function collectAndReportMetrics(): Promise<void> {
  const metrics = await calculateMetrics(lastHourRequests);
  
  // 更新模型选择器的知识
  await modelSelector.updateProviderMetrics('openai', metrics.openai);
  await modelSelector.updateProviderMetrics('anthropic', metrics.anthropic);
  
  // 如果某个Provider表现持续不佳，降低其权重
  if (metrics.openai.failureRate > 0.1) {
    console.warn('OpenAI失败率过高，考虑降低权重');
  }
}
```

### 模型性能比较表 (供AI参考)
| Provider | 模型 | 适合任务 | 平均响应时间 | 每1K Token成本 | 质量评分 |
|----------|------|----------|--------------|----------------|----------|
| OpenAI | GPT-4 Turbo | 复杂分析、高质量需求 | 2-3秒 | $0.01 | 9.5/10 |
| OpenAI | GPT-3.5 Turbo | 简单任务、快速响应 | 1-2秒 | $0.001 | 7.5/10 |
| Anthropic | Claude 3 Opus | 深度推理、长文档 | 3-5秒 | $0.015 | 9.8/10 |
| DeepSeek | DeepSeek Chat | 性价比、编程任务 | 2-3秒 | $0.0001 | 8.0/10 |
| Local | Llama 3 70B | 隐私要求、离线使用 | 5-10秒 | $0.00001 | 8.5/10 |

---

## 🔄 版本更新与维护 (AI协作指南)

### 版本变更记录
- **v1.0.0** (2026-02-01): 基础模型选择器接口
- **v1.1.0** (2026-02-02): 添加成本感知算法
- **v1.2.0** (2026-02-03): 增强故障转移机制
- **v1.3.0** (2026-02-04): **AI友好化重构**，添加详细示例和故障排除

### 未来改进计划 (AI可参与)
1. **机器学习优化**：基于历史数据训练选择算法
2. **实时适应**：根据网络状况动态调整选择
3. **多目标优化**：同时优化成本、速度、质量多个目标
4. **预测性选择**：预测任务难度，提前准备资源

---

## 🤝 与其他标准的关系

### 与LS-102的关系
- **LS-101** 定义接口，**LS-102** 实现健康监控
- 实现LS-101时必须实现 `getProviderHealth()` 方法
- LS-102的健康数据用于LS-101的选择决策

### 与AS-301的关系
- **AS-301** (LLM API调用规范) 使用LS-101的选择结果
- LS-101返回的 `ModelSelection` 直接用于AS-301的API调用

### 与§192宪法公理的关系
- **§192模型选择器公理** 要求必须使用动态模型选择
- 本标准是实现§192的具体技术规范
- 所有Agent必须通过本标准的接口访问LLM

---

## 📝 验证清单 (AI自检清单)

在实现模型选择器时，请AI Agent验证以下项目：

✅ **接口完整性**：
- [ ] 实现了完整的 `IModelSelector` 接口
- [ ] `selectModel()` 方法能正确处理所有任务类型
- [ ] `getProviderHealth()` 返回准确的健康状态

✅ **算法正确性**：
- [ ] 选择算法考虑了成本、质量、速度的平衡
- [ ] 复杂任务选择高质量模型，简单任务选择低成本模型
- [ ] 有合理的备用选项和故障转移逻辑

✅ **性能监控**：
- [ ] 收集并报告关键性能指标
- [ ] 根据性能数据动态调整选择策略
- [ ] 有适当的告警机制

✅ **AI友好性**：
- [ ] 代码示例可直接复制使用
- [ ] 错误信息有明确的解决方案
- [ ] 监控指标易于理解和操作

---

**宪法依据**: §192模型选择器公理、§110协作效率公理  
**维护责任**: 科技部Agent + 组织部Agent  
**最后更新**: 2026-02-04  
**状态**: **AI友好化标准就绪，可直接用于Agent开发**
