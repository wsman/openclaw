# MC-002 监察部工具

**版本**: v7.0.0 (Gateway生态系统完整版)
**模块**: Internal Affairs Bureau (IAB)
**类型**: Tier 1 法定核心工具
**宪法依据**: §136 监察审计公理
**最后更新**: 2026-02-11
**维护者**: Negentropy-Lab架构委员会

---

## 📋 工具概述

监察部工具（IAB）负责系统的运行时审计、元监督和熵值监控，确保系统在运行时保持熵减趋势。这些工具在宪法驱动开发流程中必须强制调用，用于验证系统的熵减状态和质量门控。

### 核心职责
- **文档熵值监测**: 监控文档信息熵变化，防止知识库混乱
- **系统指标记录**: 记录每日系统状态指标，形成审计日志
- **质量门控验证**: 验证系统是否符合质量标准
- **熵减趋势验证**: 确保系统持续向有序状态演进

---

## 🔧 工具列表

### 2.1 monitor_document_entropy

**描述**: 监控文档信息熵，检测知识库的混乱程度。

**宪法依据**: §136 监察审计公理

**调用场景**:
- 知识库更新后自动调用
- 定期质量检查时调用
- CDD流程State D三级验证时调用

**参数说明**:
```typescript
interface MonitorDocumentEntropyParams {
  /**
   * 文档路径列表
   */
  paths: string[];
  
  /**
   * 是否输出详细分析
   * @default false
   */
  verbose?: boolean;
  
  /**
   * 熵值阈值（超过则告警）
   * @default 3.0
   */
  threshold?: number;
}
```

**返回值格式**:
```typescript
interface MonitorDocumentEntropyResult {
  /**
   * 总体状态
   */
  status: 'healthy' | 'warning' | 'critical';
  
  /**
   * 平均文档熵值
   */
  averageEntropy: number;
  
  /**
   * 最高熵值
   */
  maxEntropy: number;
  
  /**
   * 每个文档的详细分析
   */
  details: DocumentEntropyDetail[];
  
  /**
   * 建议措施
   */
  recommendations: string[];
}

interface DocumentEntropyDetail {
  /**
   * 文档路径
   */
  path: string;
  
  /**
   * 熵值
   */
  entropy: number;
  
  /**
   * 状态
   */
  status: 'healthy' | 'warning' | 'critical';
  
  /**
   * 影响因素分析
   */
  factors: {
    /**
     * 文档长度
     */
    length: number;
    
    /**
     * 结构复杂度
     */
    structureComplexity: number;
    
    /**
     * 内容重复度
     */
    contentRedundancy: number;
  };
}
```

**使用示例**:
```python
from engine.mcp_core.tools.iab import monitor_document_entropy

# 监控法典内核的熵值
result = monitor_document_entropy(
    paths=[
        'memory_bank/t0_core/basic_law_index.md',
        'memory_bank/t0_core/procedural_law_index.md',
        'memory_bank/t0_core/technical_law_index.md'
    ],
    verbose=True,
    threshold=3.0
)

if result['status'] == 'critical':
    print(f"⚠️ 警告: 文档熵值过高！平均熵值: {result['averageEntropy']:.2f}")
    print("建议措施:")
    for rec in result['recommendations']:
        print(f"  - {rec}")
```

**故障排除**:
| 错误代码 | 描述 | 解决方案 |
|----------|------|----------|
| `IAB-001` | 文件不存在 | 检查文件路径是否正确 |
| `IAB-002` | 熵值计算失败 | 检查文件编码（必须是UTF-8） |
| `IAB-003` | 超出阈值 | 根据建议措施优化文档结构 |

---

### 2.2 record_daily_metric

**描述**: 记录系统每日指标，形成审计日志和历史数据。

**宪法依据**: §136 监察审计公理

**调用场景**:
- 每日系统状态检查时调用
- 系统发布前调用
- 定期审计时调用

**参数说明**:
```typescript
interface RecordDailyMetricParams {
  /**
   * 指标类型
   */
  metricType: 'system_entropy' | 'cognitive_entropy' | 'constitution_compliance' | 'knowledge_coverage';
  
  /**
   * 指标值
   */
  value: number;
  
  /**
   * 时间戳（默认当前时间）
   */
  timestamp?: string;
  
  /**
   * 附加元数据
   */
  metadata?: Record<string, any>;
}
```

**返回值格式**:
```typescript
interface RecordDailyMetricResult {
  /**
   * 记录是否成功
   */
  success: boolean;
  
  /**
   * 记录ID
   */
  recordId: string;
  
  /**
   * 存储位置
   */
  location: string;
  
  /**
   * 历史趋势分析（可选）
   */
  trendAnalysis?: {
    /**
     * 相比上次的变化
     */
    delta: number;
    
    /**
     * 趋势方向
     */
    direction: 'improving' | 'stable' | 'degrading';
    
    /**
     * 7天平均值
     */
    avg7Days: number;
  };
}
```

**使用示例**:
```python
from engine.mcp_core.tools.iab import record_daily_metric

# 记录系统熵值指标
result = record_daily_metric(
    metricType='system_entropy',
    value=2.5,
    metadata={
        'source': 'EntropyService',
        'calculation_method': 'four_dimensional_model'
    }
)

if result['success']:
    print(f"✅ 指标记录成功: {result['recordId']}")
    if 'trendAnalysis' in result:
        trend = result['trendAnalysis']
        print(f"趋势: {trend['direction']}, 变化: {trend['delta']:+.2f}")
```

**故障排除**:
| 错误代码 | 描述 | 解决方案 |
|----------|------|----------|
| `IAB-010` | 存储失败 | 检查存储服务是否可用 |
| `IAB-011` | 无效指标类型 | 使用有效的metricType |
| `IAB-012` | 值超出范围 | 检查指标值是否在合理范围内 |

---

## 📊 数学基础

### 熵值计算公式

**信息熵** (Shannon Entropy):
$$
H(X) = -\sum_{i=1}^{n} P(x_i) \log_2 P(x_i)
$$

**文档熵值** (Document Entropy):
$$
H_{doc} = \alpha \cdot H_{structure} + \beta \cdot H_{content} + \gamma \cdot H_{redundancy}
$$

其中：
- $H_{structure}$: 结构复杂度（标题层级、引用关系）
- $H_{content}$: 内容复杂度（术语密度、句子长度）
- $H_{redundancy}$: 内容重复度
- $\alpha + \beta + \gamma = 1$（权重系数）

**系统熵值** (System Entropy):
$$
H_{sys} = \frac{1}{N} \sum_{i=1}^{N} H_{doc_i}
$$

### 熵减验证

**熵减趋势**:
$$
\Delta H = H_{t} - H_{t-1} \leq 0

**熵减目标**:
$$
\lim_{t \to \infty} H_t \to \min(H)

---

## 🎯 质量门控阈值

| 指标 | 健康值 | 警告值 | 临界值 |
|------|--------|--------|--------|
| **文档平均熵值** | $< 2.0$ | $2.0 \leq H < 3.0$ | $\geq 3.0$ |
| **单个文档熵值** | $< 3.0$ | $3.0 \leq H < 4.0$ | $\geq 4.0$ |
| **系统熵值变化** | $\Delta H \leq -0.1$ | $-0.1 < \Delta H \leq 0$ | $\Delta H > 0$ |
| **知识覆盖率** | $> 95\%$ | $90\% \leq C \leq 95\%$ | $< 90\%$ |

---

## 🔗 相关标准

- **ME-101**: 系统熵值计算标准
- **ME-102**: 认知熵值计算标准
- **KB-101**: Markdown处理
- **DS-004**: 知识漂移检测
- **DS-006**: 三阶段逆熵审计

---

## 📝 使用指南

### 集成到CDD流程

**State A: 基准摄入**
```python
# 1. 同步向量知识库
sync_memory_bank()

# 2. 记录初始熵值
record_daily_metric('system_entropy', initial_entropy)
```

**State D: 三级验证**
```python
# 1. 监控文档熵值
entropy_result = monitor_document_entropy(paths)

# 2. 验证熵减趋势
if entropy_result['status'] == 'critical':
    raise Exception("熵值过高，需要优化文档结构")

# 3. 记录验证结果
record_daily_metric('constitution_compliance', compliance_rate)
```

**State E: 收敛纠错**
```python
# 记录最终系统指标
record_daily_metric('system_entropy', final_entropy)
record_daily_metric('knowledge_coverage', coverage)
```

### 最佳实践

1. **定期监控**: 建议每24小时执行一次系统指标记录
2. **阈值调整**: 根据项目实际情况调整熵值阈值
3. **趋势分析**: 关注熵值变化趋势，而非绝对值
4. **文档优化**: 定期对高熵值文档进行结构化优化
5. **审计日志**: 保留至少90天的历史指标数据

---

**文档版本**: v7.0.0  
**最后更新**: 2026-02-11  
**维护者**: Negentropy-Lab架构委员会  
**状态**: 🟢 生产就绪（遵循宪法级约束）

*遵循宪法约束: 监控即正义，审计即透明，熵减即目标。*
