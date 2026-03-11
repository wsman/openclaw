# MC-006 司法验证工具

**版本**: v7.0.0 (Gateway生态系统完整版)
**模块**: Judiciary
**类型**: Tier 1 法定核心工具
**宪法依据**: §156 三级验证协议、§352-§354 司法验证标准
**最后更新**: 2026-02-11
**维护者**: Negentropy-Lab架构委员会

---

## 📋 工具概述

司法验证工具（Judiciary）负责执行三级验证协议，包括架构同构性验证、接口契约验证、代码熵值测量等关键验证。这些工具在宪法驱动开发流程中必须强制调用，用于验证代码和文档的宪法合规性。

### 核心职责
- **架构同构性验证**: 验证代码与文档架构的一致性
- **接口契约验证**: 验证接口定义与实现的匹配度
- **代码熵值测量**: 测量代码复杂度和熵值
- **签名验证**: 验证代码签名和完整性
- **测试运行**: 执行测试套件并验证通过率

### 验证层级
```
一级验证: judicial_scan_architecture  (架构扫描)
二级验证: judicial_verify_contract     (契约验证)
三级验证: judicial_measure_complexity  (复杂度测量)
四级验证: judicial_verify_structure    (结构验证)
五级验证: judicial_verify_signatures   (签名验证)
六级验证: judicial_run_tests            (测试运行)
```

---

## 🔧 工具列表

### 6.1 judicial_scan_architecture

**描述**: 扫描并验证项目架构的同构性，确保代码结构与文档架构一致。

**宪法依据**: §352 架构同构性验证

**调用场景**:
- CDD流程State D三级验证时强制调用
- 代码重构后调用
- 架构更新后调用

**参数说明**:
```typescript
interface JudicialScanArchitectureParams {
  /**
   * 项目根目录
   */
  projectRoot: string;

  /**
   * 架构文档路径
   * @default 'memory_bank/t0_core/knowledge_graph.md'
   */
  architectureDoc?: string;

  /**
   * 是否输出详细报告
   * @default false
   */
  verbose?: boolean;

  /**
   * 严格模式（必须100%同构）
   * @default false
   */
  strict?: boolean;
}
```

**返回值格式**:
```typescript
interface JudicialScanArchitectureResult {
  /**
   * 验证状态
   */
  status: 'passed' | 'warning' | 'failed';

  /**
   * 同构性百分比
   */
  isomorphismRate: number;

  /**
   * 扫描统计
   */
  statistics: {
    /**
     * 总实体数
     */
    totalEntities: number;

    /**
     * 匹配实体数
     */
    matchedEntities: number;

    /**
     * 缺失实体数
     */
    missingEntities: number;

    /**
     * 多余实体数
     */
    extraEntities: number;
  };

  /**
   * 不匹配详情
   */
  mismatches: ArchitectureMismatch[];

  /**
   * 修复建议
   */
  recommendations: string[];
}

interface ArchitectureMismatch {
  /**
   * 实体类型
   */
  entityType: 'module' | 'component' | 'service' | 'agent' | 'tool';

  /**
   * 实体名称
   */
  name: string;

  /**
   * 不匹配类型
   */
  mismatchType: 'missing' | 'extra' | 'incorrect_location' | 'incorrect_type';

  /**
   * 期望位置/类型
   */
  expected: string;

  /**
   * 实际位置/类型
   */
  actual: string;
}
```

**使用示例**:
```python
from engine.mcp_core.tools.judiciary import judicial_scan_architecture

# 扫描架构同构性
result = judicial_scan_architecture(
    projectRoot='.',  # [示例路径，当前项目根目录]
    architectureDoc='memory_bank/t0_core/knowledge_graph.md',
    verbose=True,
    strict=False
)

if result['status'] == 'passed':
    print(f"✅ 架构同构性验证通过: {result['isomorphismRate']}%")
elif result['status'] == 'warning':
    print(f"⚠️ 架构同构性警告: {result['isomorphismRate']}%")
    print("不匹配项:")
    for mismatch in result['mismatches']:
        print(f"  - {mismatch['entityType']}: {mismatch['name']} ({mismatch['mismatchType']})")
else:
    print(f"❌ 架构同构性验证失败: {result['isomorphismRate']}%")
    print("修复建议:")
    for rec in result['recommendations']:
        print(f"  - {rec}")
```

**故障排除**:
| 错误代码 | 描述 | 解决方案 |
|----------|------|----------|
| `JUD-001` | 架构文档不存在 | 检查architectureDoc路径 |
| `JUD-002` | 项目根目录无效 | 检查projectRoot路径 |
| `JUD-003` | 同构性过低 | 根据建议调整代码结构 |

---

### 6.2 judicial_verify_contract

**描述**: 验证接口定义与实现的契约一致性。

**宪法依据**: §353 接口契约验证

**调用场景**:
- CDD流程State D三级验证时调用
- 接口变更后调用
- 实现更新后调用

**参数说明**:
```typescript
interface JudicialVerifyContractParams {
  /**
   * 接口定义文件路径
   */
  interfacePath: string;

  /**
   * 实现文件路径
   */
  implementationPath: string;

  /**
   * 检查深度（basic/strict）
   * @default 'basic'
   */
  depth?: 'basic' | 'strict';
}
```

**返回值格式**:
```typescript
interface JudicialVerifyContractResult {
  /**
   * 验证状态
   */
  status: 'passed' | 'warning' | 'failed';

  /**
   * 契约完整性评分
   */
  contractScore: number;

  /**
   * 契约详情
   */
  contracts: ContractVerification[];

  /**
   * 违规项
   */
  violations: ContractViolation[];
}

interface ContractVerification {
  /**
   * 接口名称
   */
  interfaceName: string;

  /**
   * 方法名
   */
  methodName: string;

  /**
   * 验证状态
   */
  verified: boolean;

  /**
   * 返回类型匹配
   */
  returnTypeMatch: boolean;

  /**
   * 参数匹配
   */
  parametersMatch: boolean;
}

interface ContractViolation {
  /**
   * 违规类型
   */
  violationType: 'missing_method' | 'wrong_return_type' | 'wrong_parameters' | 'missing_export';

  /**
   * 接口/方法名称
   */
  target: string;

  /**
   * 期望
   */
  expected: string;

  /**
   * 实际
   */
  actual: string;
}
```

**使用示例**:
```python
from engine.mcp_core.tools.judiciary import judicial_verify_contract

# 验证工具调用桥接器契约（当前仓推荐以 Authority 运行时实现为例）
result = judicial_verify_contract(
    interfacePath='server/types/system/IToolCallBridge.ts',
    implementationPath='server/services/authority/AuthorityToolCallBridge.ts',
    depth='strict'
)

if result['status'] == 'passed':
    print(f"✅ 契约验证通过: {result['contractScore']}%")
else:
    print(f"⚠️ 契约验证警告: {result['contractScore']}%")
    for violation in result['violations']:
        print(f"  - {violation['violationType']}: {violation['target']}")
        print(f"    期望: {violation['expected']}")
        print(f"    实际: {violation['actual']}")
```

---

### 6.3 judicial_measure_complexity

**描述**: 测量代码复杂度和熵值，评估代码质量。

**宪法依据**: §354 代码复杂度测量

**调用场景**:
- CDD流程State D三级验证时调用
- 代码评审前调用
- 重构前后对比

**参数说明**:
```typescript
interface JudicialMeasureComplexityParams {
  /**
   * 文件或目录路径
   */
  paths: string[];

  /**
   * 测量指标类型
   */
  metrics?: ('cyclomatic' | 'cognitive' | 'entropy' | 'lines')[];

  /**
   * 输出详细报告
   * @default false
   */
  verbose?: boolean;
}
```

**返回值格式**:
```typescript
interface JudicialMeasureComplexityResult {
  /**
   * 总体评分
   */
  overallScore: number;

  /**
   * 状态
   */
  status: 'excellent' | 'good' | 'fair' | 'poor';

  /**
   * 指标详情
   */
  metrics: ComplexityMetrics;

  /**
   * 文件详情
   */
  fileDetails: FileComplexity[];

  /**
   * 优化建议
   */
  recommendations: ComplexityRecommendation[];
}

interface ComplexityMetrics {
  /**
   * 圈复杂度
   */
  cyclomaticComplexity: {
    average: number;
    max: number;
    threshold: number;
  };

  /**
   * 认知复杂度
   */
  cognitiveComplexity: {
    average: number;
    max: number;
    threshold: number;
  };

  /**
   * 代码熵值
   */
  entropy: {
    average: number;
    max: number;
    threshold: number;
  };

  /**
   * 代码行数
   */
  linesOfCode: {
    total: number;
    average: number;
    max: number;
  };
}

interface FileComplexity {
  /**
   * 文件路径
   */
  path: string;

  /**
   * 圈复杂度
   */
  cyclomatic: number;

  /**
   * 认知复杂度
   */
  cognitive: number;

  /**
   * 熵值
   */
  entropy: number;

  /**
   * 代码行数
   */
  lines: number;

  /**
   * 评分
   */
  score: number;

  /**
   * 状态
   */
  status: 'excellent' | 'good' | 'fair' | 'poor';
}
```

**使用示例**:
```python
from engine.mcp_core.tools.judiciary import judicial_measure_complexity

# 测量核心服务复杂度
result = judicial_measure_complexity(
    paths=[
        'server/gateway/GatewayServer.ts',
        'server/agents/AgentManager.ts',
        'server/services/LLMService.ts'
    ],
    metrics=['cyclomatic', 'cognitive', 'entropy'],
    verbose=True
)

print(f"总体评分: {result['overallScore']} ({result['status']})")
print(f"平均圈复杂度: {result['metrics']['cyclomaticComplexity']['average']:.2f}")
print(f"平均认知复杂度: {result['metrics']['cognitiveComplexity']['average']:.2f}")
print(f"平均熵值: {result['metrics']['entropy']['average']:.2f}")

# 输出需要优化的文件
for file in result['fileDetails']:
    if file['status'] == 'poor':
        print(f"\n⚠️ 需要优化: {file['path']}")
        print(f"  圈复杂度: {file['cyclomatic']} (阈值: 15)")
        print(f"  认知复杂度: {file['cognitive']} (阈值: 24)")
```

---

### 6.4 judicial_verify_structure

**描述**: 验证文件结构和组织是否符合规范。

**宪法依据**: §352 架构同构性验证

**调用场景**:
- 项目初始化后调用
- 目录结构调整后调用
- 新增模块后调用

**参数说明**:
```typescript
interface JudicialVerifyStructureParams {
  /**
   * 项目根目录
   */
  projectRoot: string;

  /**
   * 结构规范路径
   */
  structureSpec?: string;
}
```

**返回值格式**:
```typescript
interface JudicialVerifyStructureResult {
  /**
   * 验证状态
   */
  status: 'passed' | 'warning' | 'failed';

  /**
   * 结构完整性百分比
   */
  structureIntegrity: number;

  /**
   * 结构问题列表
   */
  issues: StructureIssue[];
}
```

---

### 6.5 judicial_verify_signatures

**描述**: 验证代码签名和完整性。

**宪法依据**: §141 自动化重构安全

**调用场景**:
- 生产发布前调用
- 外部代码集成后调用
- 安全审计时调用

**参数说明**:
```typescript
interface JudicialVerifySignaturesParams {
  /**
   * 文件路径列表
   */
  paths: string[];
}
```

**返回值格式**:
```typescript
interface JudicialVerifySignaturesResult {
  /**
   * 验证状态
   */
  status: 'passed' | 'failed';

  /**
   * 签名详情
   */
  signatures: SignatureVerification[];
}
```

---

### 6.6 judicial_run_tests

**描述**: 运行测试套件并验证通过率。

**宪法依据**: §156 三级验证协议

**调用场景**:
- CDD流程State D三级验证时强制调用
- 代码提交前调用
- 发布前调用

**参数说明**:
```typescript
interface JudicialRunTestsParams {
  /**
   * 测试路径
   */
  testPath?: string;

  /**
   * 测试类型
   */
  testTypes?: ('unit' | 'integration' | 'e2e')[];

  /**
   * 最低通过率阈值
   * @default 0.85
   */
  passThreshold?: number;
}
```

**返回值格式**:
```typescript
interface JudicialRunTestsResult {
  /**
   * 测试状态
   */
  status: 'passed' | 'failed';

  /**
   * 通过率
   */
  passRate: number;

  /**
   * 测试统计
   */
  statistics: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };

  /**
   * 失败测试详情
   */
  failures: TestFailure[];
}
```

**使用示例**:
```python
from engine.mcp_core.tools.judiciary import judicial_run_tests

# 运行所有测试
result = judicial_run_tests(
    testPath='tests/',
    testTypes=['unit', 'integration', 'e2e'],
    passThreshold=0.85
)

if result['status'] == 'passed':
    print(f"✅ 测试通过: {result['passRate']*100:.1f}%")
    print(f"总计: {result['statistics']['total']} | 通过: {result['statistics']['passed']} | 失败: {result['statistics']['failed']}")
    print(f"耗时: {result['statistics']['duration']:.2f}s")
else:
    print(f"❌ 测试失败: {result['passRate']*100:.1f}%")
    for failure in result['failures']:
        print(f"\n失败: {failure['testName']}")
        print(f"  错误: {failure['error']}")
```

---

## 📊 验证标准

### 架构同构性标准
| 指标 | 优秀 | 良好 | 警告 | 失败 |
|------|------|------|------|------|
| **同构性百分比** | > 95% | 90-95% | 80-90% | < 80% |
| **缺失实体** | 0 | ≤ 1 | 2-3 | > 3 |
| **多余实体** | 0 | ≤ 1 | 2-3 | > 3 |

### 代码复杂度标准
| 指标 | 优秀 | 良好 | 警告 | 失败 |
|------|------|------|------|------|
| **圈复杂度** | < 10 | 10-15 | 15-20 | > 20 |
| **认知复杂度** | < 15 | 15-24 | 24-35 | > 35 |
| **代码熵值** | < 2.0 | 2.0-3.0 | 3.0-4.0 | > 4.0 |
| **代码行数** | < 300 | 300-500 | 500-800 | > 800 |

### 测试标准
| 指标 | 目标值 | 警告阈值 | 失败阈值 |
|------|--------|----------|----------|
| **单元测试通过率** | > 95% | 85-95% | < 85% |
| **集成测试通过率** | > 90% | 80-90% | < 80% |
| **端到端测试通过率** | > 85% | 70-85% | < 70% |

---

## 🔗 相关标准

- **DS-001**: UTF-8输出配置标准实现
- **DS-005**: 自动化重构安全标准实现
- **DS-006**: 三阶段逆熵审计标准实现
- **DS-024**: 自动化架构同步标准实现

---

## 📝 使用指南

### 集成到CDD流程

**State D: 三级验证**
```python
# 一级验证: 架构扫描
arch_result = judicial_scan_architecture(
    projectRoot='/path/to/project',
    strict=False
)
if arch_result['status'] == 'failed':
    raise Exception("架构验证失败")

# 二级验证: 契约验证
contract_result = judicial_verify_contract(
    interfacePath='types/IInterface.ts',
    implementationPath='services/Implementation.ts'
)
if contract_result['status'] == 'failed':
    raise Exception("契约验证失败")

# 三级验证: 复杂度测量
complexity_result = judicial_measure_complexity(
    paths=['src/'],
    metrics=['cyclomatic', 'cognitive', 'entropy']
)
if complexity_result['status'] == 'poor':
    raise Exception("代码复杂度过高")

# 四级验证: 结构验证
structure_result = judicial_verify_structure(
    projectRoot='/path/to/project'
)
if structure_result['status'] == 'failed':
    raise Exception("结构验证失败")

# 五级验证: 签名验证
signature_result = judicial_verify_signatures(
    paths=['src/']
)
if signature_result['status'] == 'failed':
    raise Exception("签名验证失败")

# 六级验证: 测试运行
test_result = judicial_run_tests(
    testPath='tests/',
    passThreshold=0.85
)
if test_result['status'] == 'failed':
    raise Exception("测试未通过")
```

---

**文档版本**: v7.0.0
**最后更新**: 2026-02-11
**维护者**: Negentropy-Lab架构委员会
**状态**: 🟢 生产就绪（遵循宪法级约束）

*遵循宪法约束: 验证即正义，合规即目标，质量即信任。*
