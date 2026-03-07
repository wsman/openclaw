---
type: Standard
id: DS-027
status: Active
relationships:
  implements: [LAW-TECH#§315]
  verifies: [LAW-BASIC#§114]
  related_to: [DS-007, DS-023]
tags: [dual-store, isomorphism, storage, verification]
---
# DS-027: 双存储同构验证标准实现

**父索引**: [Development Standards Index](../DEVELOPMENT_STANDARDS.md)
**对应技术法**: §114 (双存储同构架构公理), §370-§373 (双存储同构技术标准)
**宪法依据**: §114 (双存储同构架构公理), §372 (双射映射维护标准), §355 (知识漂移检测)
**版本**: v1.0.0
**状态**: 🟢 生产就绪

---

### 1. 数学定义

双存储同构验证工具 `judicial_verify_dual_store` 验证以下数学关系：

1. **双射存在性**: $\Phi: F \leftrightarrow V$，其中 $F$ 为文件系统集合，$V$ 为向量库集合。
2. **完整性条件**: $\forall f \in F, \exists! v \in V$（每个文件有且仅有一个向量对应）
3. **有效性条件**: $\forall v \in V, \exists! f \in F$（每个向量有且仅有一个文件对应）
4. **一致性条件**: $\text{hash}(f) = \text{source\_id}(v)$（文件哈希与向量源标识一致）

### 2. 工具架构

#### 2.1 工具定位
- **名称**: `judicial_verify_dual_store`
- **角色**: Tier 1 核心司法工具
- **MCP注册**: `@registry.register()` + `@negetropy_sanitizer`
- **输入参数**: `project_id` (可选，默认为所有项目)
- **输出格式**: JSON 结构化报告

#### 2.2 核心组件
```python
# 文件系统扫描器
def scan_project_files(project_id: str) -> Dict[str, Path]:
    """扫描 memory_bank/ 目录下与 project_id 相关的 .md/.txt 文件"""

# 向量库扫描器  
def get_all_vectors(collection_name: str) -> Dict[str, Dict]:
    """使用 Qdrant Scroll API 获取集合中所有向量的元数据"""

# 双射验证引擎
def verify_project_dual_store(project_id: str) -> Dict[str, Any]:
    """执行正向（File→Vector）和逆向（Vector→File）验证"""
```

### 3. 验证算法

#### 3.1 正向验证 (File → Vector)
对于每个物理文件 $f_i \in F$：
1. 计算文件哈希：$h_i = \text{SHA-256}(f_i)$
2. 检查向量库：$v_i = V[h_i]$
3. 验证条件：
   - 存在性：$v_i \neq \emptyset$
   - 一致性：$\text{hash}(f_i) = \text{source\_id}(v_i)$

#### 3.2 逆向验证 (Vector → File)
对于每个向量 $v_j \in V$：
1. 提取源标识：$s_j = \text{source\_id}(v_j)$
2. 检查物理文件：$f_j = F[s_j]$
3. 验证条件：
   - 存在性：$f_j \neq \emptyset$
   - 路径一致性：$\text{source\_path}(v_j) = \text{path}(f_j)$

#### 3.3 维度验证 (可选)
对于每个向量 $v_j \in V$：
1. 检查维度：$\text{dim}(v_j) = 4096$ (NV-Embed-v2标准)
2. 违反条件：$\text{dim}(v_j) \neq 4096$

### 4. 合规评分

#### 4.1 计算公式
$$
\text{合规分数} = 1 - \frac{|F \Delta V|}{|F| + |V|}
$$

其中 $F \Delta V$ 表示对称差集（幽灵文件 + 幽灵向量）。

#### 4.2 状态分类
- **COMPLIANT**: 合规分数 = 1.0（完美双射）
- **WARNING**: 0.8 ≤ 合规分数 < 1.0（轻微偏差）
- **NON_COMPLIANT**: 合规分数 < 0.8（严重偏差）
- **ERROR**: 系统错误（无法访问集合等）

### 5. 实施示例

#### 5.1 工具调用
```python
# 验证单个项目
result = judicial_verify_dual_store("entropy_lab_core")

# 验证所有项目  
result = judicial_verify_dual_store()  # 不指定 project_id
```

#### 5.2 典型输出
```json
{
  "tool": "judicial_verify_dual_store",
  "version": "v1.0.0",
  "constitutional_basis": "§114 (双存储同构架构公理)",
  "standard": "DS-027 (Dual-Store Isomorphism Verification)",
  "overall_status": "NON_COMPLIANT",
  "overall_compliance_score": 0.0,
  "projects_scanned": 1,
  "project_breakdown": {
    "compliant": 0,
    "warning": 0,
    "non_compliant": 1,
    "error": 0
  },
  "detailed_results": [
    {
      "project_id": "entropy_lab_core",
      "collection_name": "project_entropy_lab_core",
      "status": "NON_COMPLIANT",
      "total_files": 3,
      "total_vectors": 0,
      "ghost_files": [...],
      "ghost_vectors": [],
      "integrity_failures": [],
      "compliance_score": 0.0,
      "issues_count": 3
    }
  ]
}
```

### 6. 错误类型与处理

#### 6.1 幽灵文件 (Ghost Files)
- **定义**: $f \in F, \nexists v \in V$（文件存在但无向量）
- **处理**: 标记为 `UNINDEXED`，建议触发重新向量化
- **审计**: 记录到 `ghost_files` 列表

#### 6.2 幽灵向量 (Ghost Vectors)  
- **定义**: $v \in V, \nexists f \in F$（向量存在但无文件）
- **处理**: 标记为 `DANGLING`，严重违反双射公理
- **审计**: 记录到 `ghost_vectors` 列表

#### 6.3 完整性失败 (Integrity Failures)
- **定义**: $\text{hash}(f) \neq \text{source\_id}(v)$（哈希不匹配）
- **处理**: 标记为 `INTEGRITY_VIOLATION`，可能文件内容已修改
- **审计**: 记录到 `integrity_failures` 列表

### 7. 集成要求

#### 7.1 前置条件
1. **存储目录**: `memory_bank/` 与 `storage/qdrant_local/` 必须存在（遵循 §370）
2. **集合命名**: Qdrant 集合必须遵循 `project_{project_id}` 命名（遵循 §370）
3. **文件命名**: 推荐使用 SHA-256 哈希作为文件名（内容寻址）

#### 7.2 性能优化
- **分页扫描**: 使用 Qdrant Scroll API 分批获取向量（避免内存溢出）
- **并行处理**: 支持多项目并行验证（项目间无依赖）
- **输出截断**: 限制详细输出条目数（防止上下文污染）

#### 7.3 安全约束
- **路径安全**: 所有文件路径必须规范化，防止目录遍历攻击
- **权限验证**: 验证用户对项目的访问权限（遵循 §396）
- **错误隔离**: 单个项目验证失败不影响其他项目

### 8. 审计与监控

#### 8.1 强制审计点
1. **工具调用**: 记录每次验证请求的时间戳、项目和结果状态
2. **偏差检测**: 记录所有幽灵文件、幽灵向量和完整性失败
3. **修复操作**: 记录自动或手动修复双存储不一致的操作

#### 8.2 监控指标
- `dual_store_compliance_rate`: 双存储合规率（0-100%）
- `ghost_file_count`: 幽灵文件数量
- `ghost_vector_count`: 幽灵向量数量  
- `verification_latency`: 验证延迟（毫秒）

#### 8.3 告警阈值
- **警告**: 合规分数 < 0.95
- **严重**: 合规分数 < 0.80
- **紧急**: 幽灵向量数量 > 0（违反双射公理）

### 9. 与其他标准的关系

#### 9.1 DS-023 (双存储双射映射标准实现)
- **关系**: DS-027 是 DS-023 的可执行验证工具
- **区别**: 
  - DS-023 定义双射映射的创建和维护标准
  - DS-027 定义双射映射的验证和审计标准

#### 9.2 DS-004 (知识漂移检测标准实现)
- **关系**: 互补工具，关注不同层面的不一致
- **区别**:
  - DS-004 验证语义内容一致性（文档 vs 向量）
  - DS-027 验证结构拓扑一致性（文件 vs 向量）

#### 9.3 §114 (双存储同构架构公理)
- **关系**: DS-027 是该宪法条款的技术实现
- **验证**: 确保 $S_{fs} \cong S_{doc} \land \Phi: \text{File} \leftrightarrow \text{Vector}$

### 10. 部署建议

#### 10.1 定时任务
```yaml
# 每日凌晨执行全系统双存储审计
schedule:
  cron: "0 2 * * *"  # 每天 02:00
  command: judicial_verify_dual_store
  alert_if: compliance_score < 0.95
```

#### 10.2 CI/CD 集成
```yaml
# 在代码变更后验证受影响项目的双存储
steps:
  - name: Verify Dual-Store Isomorphism
    run: |
      python -m engine.mcp_core.tools.judiciary_dual_store ${MODIFIED_PROJECT}
```

#### 10.3 手动调用
```bash
# 验证特定项目
python -m engine.mcp_core.tools.judiciary_dual_store entropy_lab_core

# 验证所有项目
python -m engine.mcp_core.tools.judiciary_dual_store
```

---

**遵循逆熵实验室宪法约束: 代码即数学证明，架构即宪法约束。**
