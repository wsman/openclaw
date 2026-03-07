# MC-005 创世协议工具

**版本**: v7.0.0 (Gateway生态系统完整版)
**模块**: Genesis
**类型**: Tier 1 法定核心工具
**宪法依据**: §142 创世协议公理、§365 项目管理公理
**最后更新**: 2026-02-11
**维护者**: Negentropy-Lab架构委员会

---

## 📋 工具概述

创世协议工具（Genesis）负责项目的创建、初始化和知识库同步。这些工具在宪法驱动开发流程中必须强制调用，用于确保新项目符合Negentropy-Lab架构规范。

### 核心职责
- **项目创世**: 创建符合架构规范的新Negentropy-Lab项目
- **知识库同步**: 同步文件系统与向量知识库，防止知识漂移
- **项目注册**: 在Memory Bank中注册新项目
- **脚手架生成**: 生成标准项目结构和配置文件

### 创世协议约束
根据§142创世协议公理，所有新项目必须满足：
1. 符合四层架构（T0-T3）或七层架构（L0-L5）规范
2. 包含完整的宪法入口与法典内核（`.clinerules` + `memory_bank/t0_core/`）
3. 实现宪法合规检查机制
4. 支持MCP工具链集成

---

## 🔧 工具列表

### 5.1 scaffold_negentropy_project

**描述**: 创建符合Negentropy-Lab架构规范的新项目脚手架。

**宪法依据**: §142 创世协议公理

**调用场景**:
- 创建新Negentropy-Lab项目时强制调用
- 项目初始化时调用
- 子项目创建时调用

**参数说明**:
```typescript
interface ScaffoldNegentropyProjectParams {
  /**
   * 项目名称
   */
  projectName: string;
  
  /**
   * 项目根目录
   */
  rootDirectory: string;
  
  /**
   * 架构类型
   * @default 'four-layer'
   */
  architectureType?: 'four-layer' | 'seven-layer' | 'custom';
  
  /**
   * 项目类型
   * @default 'multi-agent'
   */
  projectType?: 'multi-agent' | 'single-agent' | 'tool' | 'library';
  
  /**
   * 技术栈配置
   */
  techStack?: {
    /**
     * 前端框架
     */
    frontend?: 'react' | 'vue' | 'angular' | 'svelte';
    
    /**
     * 后端框架
     */
    backend?: 'typescript' | 'python' | 'rust' | 'go';
    
    /**
     * 实时通信
     */
    realtime?: 'colyseus' | 'socket.io' | 'ws';
    
    /**
     * 是否包含MCP支持
     * @default true
     */
    mcpSupport?: boolean;
  };
  
  /**
   * 是否包含监控系统
   * @default true
   */
  includeMonitoring?: boolean;
  
  /**
   * 是否包含插件系统
   * @default true
   */
  includePlugins?: boolean;
  
  /**
   * 宪法版本
   * @default 'v7.0.0'
   */
  constitutionVersion?: string;
}
```

**返回值格式**:
```typescript
interface ScaffoldNegentropyProjectResult {
  /**
   * 创建是否成功
   */
  success: boolean;
  
  /**
   * 项目ID
   */
  projectId: string;
  
  /**
   * 项目路径
   */
  projectPath: string;
  
  /**
   * 创建的文件列表
   */
  createdFiles: string[];
  
  /**
   * 项目配置
   */
  configuration: ProjectConfiguration;
  
  /**
   * 下一步操作建议
   */
  nextSteps: string[];
}

interface ProjectConfiguration {
  /**
   * 项目名称
   */
  name: string;
  
  /**
   * 架构类型
   */
  architecture: string;
  
  /**
   * 技术栈
   */
  techStack: {
    frontend?: string;
    backend: string;
    realtime?: string;
    mcpSupport: boolean;
  };
  
  /**
   * 端口配置
   */
  ports: {
    /**
     * Gateway服务端口
     */
    gateway: number;
    
    /**
     * WebSocket端口
     */
    websocket: number;
    
    /**
     * MCP服务端口
     */
    mcp: number;
  };
  
  /**
   * 环境变量模板
   */
  envTemplate: Record<string, string>;
}
```

**使用示例**:
```python
from engine.mcp_core.tools.genesis import scaffold_negentropy_project

# 创建新的多Agent协作项目
result = scaffold_negentropy_project(
    projectName='MyNegentropyProject',
    rootDirectory='/path/to/your/projects/',  # [示例路径，请替换为实际项目路径]
    architectureType='four-layer',
    projectType='multi-agent',
    techStack={
        'frontend': 'react',
        'backend': 'typescript',
        'realtime': 'colyseus',
        'mcpSupport': True
    },
    includeMonitoring=True,
    includePlugins=True,
    constitutionVersion='v7.0.0'
)

if result['success']:
    print(f"✅ 项目创建成功: {result['projectPath']}")
    print(f"项目ID: {result['projectId']}")
    print(f"\n创建的文件数: {len(result['createdFiles'])}")
    print("\n下一步操作:")
    for step in result['nextSteps']:
        print(f"  {step}")
    
    # 输出环境变量配置
    print("\n环境变量配置:")
    for key, value in result['configuration']['envTemplate'].items():
        print(f"  {key}={value}")
else:
    print("❌ 项目创建失败")
```

**生成的项目结构**:
```
MyNegentropyProject/
├── .clinerules                     # 宪法入口索引
├── memory_bank/                    # 记忆库
│   ├── t0_core/                   # 核心意识层
│   ├── t1_axioms/                 # 索引与状态层
│   ├── t2_protocols/              # 执行规范层
│   └── t3_documentation/          # 分析与归档层
├── server/                         # 后端服务
│   ├── gateway/                   # Gateway模块
│   ├── agents/                    # Agent系统
│   ├── services/                  # 业务服务
│   └── types/                     # 类型定义
├── src/                            # TypeScript应用入口
│   ├── src/                       # 源代码
│   └── public/                    # 静态资源
├── engine/                         # 引擎模块
│   └── mcp_core/                  # MCP核心
├── monitoring/                     # 监控系统
├── tests/                          # 测试套件
├── docs/                           # 文档
├── package.json
├── tsconfig.json
└── docker-compose.yml
```

**故障排除**:
| 错误代码 | 描述 | 解决方案 |
|----------|------|----------|
| `GEN-001` | 目录已存在 | 选择其他目录名或删除现有目录 |
| `GEN-002` | 项目名称无效 | 项目名称只允许字母、数字和连字符 |
| `GEN-003` | 技术栈不支持 | 检查techStack参数是否有效 |
| `GEN-004` | 宪法版本不存在 | 检查constitutionVersion参数 |

---

### 5.2 sync_memory_bank

**描述**: 同步文件系统与向量知识库，确保双存储架构同构性。

**宪法依据**: §142 创世协议公理、§114 知识库同步公理

**调用场景**:
- CDD流程State A基准摄入时强制调用
- 知识库更新后自动调用
- 定期同步维护

**参数说明**:
```typescript
interface SyncMemoryBankParams {
  /**
   * 同步模式
   * @default 'bidirectional'
   */
  mode?: 'forward' | 'reverse' | 'bidirectional';
  
  /**
   * 文件路径列表（空表示全部同步）
   */
  paths?: string[];
  
  /**
   * 是否验证同构性
   * @default true
   */
  verifyIsomorphism?: boolean;
  
  /**
   * 同步后是否记录指标
   * @default true
   */
  recordMetrics?: boolean;
  
  /**
   * 向量维度
   * @default 4096
   */
  vectorDimension?: number;
}
```

**返回值格式**:
```typescript
interface SyncMemoryBankResult {
  /**
   * 同步状态
   */
  status: 'success' | 'partial' | 'failed';
  
  /**
   * 同步统计
   */
  statistics: {
    /**
     * 总文件数
     */
    totalFiles: number;
    
    /**
     * 成功同步数
     */
    syncedFiles: number;
    
    /**
     * 失败同步数
     */
    failedFiles: number;
    
    /**
     * 新增向量数
     */
    newVectors: number;
    
    /**
     * 更新向量数
     */
    updatedVectors: number;
  };
  
  /**
   * 同构性验证结果
   */
  isomorphismCheck?: {
    /**
     * 是否同构
     */
    isomorphic: boolean;
    
    /**
     * 同构性百分比
     */
    isomorphismRate: number;
    
    /**
     * 漂移检测
     */
    driftDetected: {
      /**
       * 漂移文件数
       */
      count: number;
      
      /**
       * 漂移详情
       */
      details: DriftDetail[];
    };
  };
  
  /**
   * 同步详情
   */
  details: SyncDetail[];
  
  /**
   * 指标记录ID
   */
  metricRecordId?: string;
}

interface DriftDetail {
  /**
   * 文件路径
   */
  path: string;
  
  /**
   * 漂移类型
   */
  driftType: 'content' | 'structure' | 'reference';
  
  /**
   * 严重程度
   */
  severity: 'low' | 'medium' | 'high';
  
  /**
   * 描述
   */
  description: string;
}

interface SyncDetail {
  /**
   * 文件路径
   */
  path: string;
  
  /**
   * 同步状态
   */
  status: 'success' | 'failed';
  
  /**
   * 向量ID
   */
  vectorId?: string;
  
  /**
   * 错误信息
   */
  error?: string;
}
```

**使用示例**:
```python
from engine.mcp_core.tools.genesis import sync_memory_bank

# 双向同步并验证同构性
result = sync_memory_bank(
    mode='bidirectional',
    verifyIsomorphism=True,
    recordMetrics=True,
    vectorDimension=4096
)

if result['status'] == 'success':
    stats = result['statistics']
    print(f"✅ 同步成功")
    print(f"  总文件数: {stats['totalFiles']}")
    print(f"  成功同步: {stats['syncedFiles']}")
    print(f"  新增向量: {stats['newVectors']}")
    print(f"  更新向量: {stats['updatedVectors']}")
    
    # 检查同构性
    if result['isomorphismCheck']:
        iso = result['isomorphismCheck']
        print(f"\n同构性验证: {iso['isomorphic']}")
        print(f"同构性百分比: {iso['isomorphismRate']}%")
        
        if iso['driftDetected']['count'] > 0:
            print(f"\n⚠️ 检测到知识漂移: {iso['driftDetected']['count']}个")
            for drift in iso['driftDetected']['details']:
                print(f"  - {drift['path']}: {drift['description']}")
else:
    print(f"❌ 同步失败: {result['statistics']['failedFiles']}个文件失败")
    for detail in result['details']:
        if detail['status'] == 'failed':
            print(f"  - {detail['path']}: {detail['error']}")
```

**数学基础**:

**双存储同构映射** $\phi: F \leftrightarrow V$:

$$
\phi(f) = \begin{cases}
v & \text{if } \text{create}(f) \\
\phi(f) & \text{if } \text{update}(f) \\
\emptyset & \text{if } \text{delete}(f)
\end{cases}
$$

**同构性验证** $S_{fs} \cong S_{doc}$:

$$
\text{IsomorphismRate} = \frac{|F \cap V|}{|F \cup V|} \times 100\%
$$

其中：
- $F$: 文件系统中的文件集合
- $V$: 向量库中的向量集合

**故障排除**:
| 错误代码 | 描述 | 解决方案 |
|----------|------|----------|
| `GEN-010` | 向量库连接失败 | 检查Qdrant服务状态 |
| `GEN-011` | 文件读取失败 | 检查文件权限和编码 |
| `GEN-012` | 向量创建失败 | 检查向量维度和embedding服务 |
| `GEN-013` | 同构性过低 | 执行`detect_knowledge_drift`分析漂移原因 |

---

### 5.3 list_projects

**描述**: 列出所有已注册的Negentropy-Lab项目。

**宪法依据**: §365 项目管理公理

**调用场景**:
- 查看项目列表时调用
- 项目管理时调用

**参数说明**:
```typescript
interface ListProjectsParams {
  /**
   * 筛选条件
   */
  filter?: {
    /**
     * 按架构类型筛选
     */
    architectureType?: 'four-layer' | 'seven-layer';
    
    /**
     * 按项目类型筛选
     */
    projectType?: 'multi-agent' | 'single-agent' | 'tool' | 'library';
    
    /**
     * 按状态筛选
     */
    status?: 'active' | 'archived' | 'deprecated';
  };
  
  /**
   * 是否包含统计信息
   * @default false
   */
  includeStats?: boolean;
}
```

**返回值格式**:
```typescript
interface ListProjectsResult {
  /**
   * 项目列表
   */
  projects: ProjectInfo[];
  
  /**
   * 总数
   */
  total: number;
}

interface ProjectInfo {
  /**
   * 项目ID
   */
  projectId: string;
  
  /**
   * 项目名称
   */
  name: string;
  
  /**
   * 路径
   */
  path: string;
  
  /**
   * 架构类型
   */
  architectureType: string;
  
  /**
   * 项目类型
   */
  projectType: string;
  
  /**
   * 状态
   */
  status: string;
  
  /**
   * 创建时间
   */
  createdAt: string;
  
  /**
   * 最后更新时间
   */
  updatedAt: string;
  
  /**
   * 统计信息（可选）
   */
  stats?: {
    /**
     * 代码文件数
     */
    codeFiles: number;
    
    /**
     * 测试覆盖率
     */
    testCoverage: number;
    
    /**
     * 宪法合规率
     */
    constitutionCompliance: number;
  };
}
```

---

### 5.4 create_project

**描述**: 在Memory Bank中注册新项目。

**宪法依据**: §365 项目管理公理

**调用场景**:
- 创建新项目后调用
- 项目初始化时调用

---

### 5.5 delete_project

**描述**: 删除项目并清理相关资源。

**宪法依据**: §365 项目管理公理

**调用场景**:
- 项目废弃时调用
- 项目迁移后清理旧项目

---

## 📊 创世协议约束

### 必需组件清单

| 组件 | 路径 | 说明 |
|------|------|------|
| **宪法入口** | `.clinerules` | 统一入口导航 |
| **基本法索引** | `memory_bank/t0_core/basic_law_index.md` | 核心公理索引 |
| **程序法索引** | `memory_bank/t0_core/procedural_law_index.md` | 工作流索引 |
| **技术法索引** | `memory_bank/t0_core/technical_law_index.md` | 技术标准索引 |
| **活跃上下文** | `memory_bank/t0_core/active_context.md` | 系统状态 |
| **知识图谱** | `memory_bank/t0_core/knowledge_graph.md` | 架构拓扑 |
| **MCP核心** | `engine/mcp_core/` | MCP工具链 |
| **Gateway模块** | `server/gateway/` | 网关服务 |

### 宪法合规要求

| 要求 | 说明 | 验证方式 |
|------|------|----------|
| **宪法引用** | 所有代码必须包含@constitution注解 | AST扫描 |
| **架构同构** | 代码与文档架构一致 | 架构扫描 |
| **双存储同步** | 文件系统与向量库同步 | 同构性验证 |
| **三级验证** | CDD流程State D验证 | 司法验证 |

---

## 🔗 相关标准

- **KB-101**: Markdown处理
- **KB-102**: 原子文件写入
- **DS-023**: 双存储双射映射
- **DS-027**: 双存储同构验证
- **DS-004**: 知识漂移检测

---

## 📝 使用指南

### 完整项目创建流程

```python
# 步骤1: 创建项目脚手架
scaffold_result = scaffold_negentropy_project(
    projectName='MyProject',
    rootDirectory='/path/to/',
    architectureType='four-layer'
)

# 步骤2: 同步知识库
sync_result = sync_memory_bank(
    mode='bidirectional',
    verifyIsomorphism=True
)

# 步骤3: 注册项目
register_result = create_project(
    projectId=scaffold_result['projectId'],
    projectPath=scaffold_result['projectPath']
)

# 步骤4: 验证架构
verify_result = judicial_scan_architecture(
    projectRoot=scaffold_result['projectPath']
)

# 步骤5: 运行测试
test_result = judicial_run_tests(
    testPath=f"{scaffold_result['projectPath']}/tests/"
)

print("✅ 项目创世完成！")
```

---

**文档版本**: v7.0.0  
**最后更新**: 2026-02-11  
**维护者**: Negentropy-Lab架构委员会  
**状态**: 🟢 生产就绪（遵循宪法级约束）

*遵循宪法约束: 创世即规范，架构即真理，同步即同构。*
