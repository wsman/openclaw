# DS-023: 双存储双射映射标准实现

**父索引**: [Development Standards Index](../DEVELOPMENT_STANDARDS.md)
**对应技术法**: §365, §370-§372
**宪法依据**: §114 (双存储同构架构公理)
**版本**: v6.8.0
**状态**: 🟢 生产就绪

---

### 1. 数学定义
建立双射函数 $\Phi: F \leftrightarrow V$，其中 $F$ 为文件系统集合，$V$ 为向量库集合。
满足条件：
1. **单射性 (Injectivity)**: $\forall f_1, f_2 \in F, f_1 \neq f_2 \implies \Phi(f_1) \neq \Phi(f_2)$
2. **满射性 (Surjectivity)**: $\forall v \in V, \exists f \in F, \Phi(f) = v$

### 2. 标准实现模式

#### 2.1 正向映射 (File -> Vector)
在文件写入操作中，必须同步生成向量并注入元数据锚点。

```python
def create_dual_store_entry(project_id: str, content: str, meta: dict):
    # 1. 生成唯一标识 (Source ID)
    file_hash = calculate_sha256(content)
    
    # 2. 物理存储 (File System) - 原子写入
    file_path = atomic_write_file(
        path=f"storage/corpus/{project_id}/documents/{file_hash}.md",
        content=content
    )
    
    # 3. 语义索引 (Vector DB)
    vector_payload = {
        "metadata": {
            "source_id": file_hash,          # 双射锚点 A
            "source_path": file_path,        # 双射锚点 B
            "project_id": project_id,
            "content_hash": file_hash,       # 完整性校验
            **meta
        }
    }
    
    qdrant_client.upsert(
        collection_name=project_id,
        points=[
            PointStruct(
                id=generate_uuid_from_hash(file_hash), 
                vector=embedding_model.encode(content),
                payload=vector_payload
            )
        ]
    )
    
    # 4. 验证双射
    assert verify_bijection(file_hash, project_id)

```

#### 2.2 逆向映射 (Vector -> File)

从向量检索结果回溯原始文件时，必须验证物理存在性。

```python
def resolve_source_file(vector_result: ScoredPoint) -> str:
    payload = vector_result.payload
    source_path = payload.get("metadata", {}).get("source_path")
    source_id = payload.get("metadata", {}).get("source_id")
    
    # 验证物理文件存在性
    if not os.path.exists(source_path):
        raise BrokenBijectionError(f"Vector {source_id} points to non-existent file {source_path}")
        
    # 验证内容完整性 (可选，高性能模式可跳过)
    current_hash = calculate_file_hash(source_path)
    if current_hash != source_id:
        raise IntegrityDriftError(f"File content drifted for {source_id}")
        
    return read_file(source_path)

```

### 3. 一致性修复 (Entropy Convergence)

`detect_knowledge_drift` 工具必须实现以下逻辑：

#### 3.1 孤儿向量清理
当向量库中存在无对应文件的向量时，视为"孤儿向量"，必须：
1. 标记为无效状态
2. 记录审计日志
3. 可选：定期批量清理（需元首御准）

#### 3.2 缺失索引补全
当文件系统中存在无对应向量的文档时，视为"缺失索引"，必须：
1. 自动触发向量生成
2. 确保双射完整性恢复
3. 记录修复操作日志

### 4. 验证函数实现

```python
def verify_bijection(file_hash: str, project_id: str) -> bool:
    """验证文件与向量的双射关系"""
    
    # 1. 文件存在性验证
    expected_path = f"storage/corpus/{project_id}/documents/{file_hash}.md"
    if not os.path.exists(expected_path):
        return False
    
    # 2. 向量存在性验证
    results = qdrant_client.scroll(
        collection_name=project_id,
        filter=Filter(
            must=[
                FieldCondition(
                    key="metadata.source_id",
                    match=MatchValue(value=file_hash)
                )
            ]
        ),
        limit=1
    )
    
    if not results or len(results[0]) == 0:
        return False
    
    # 3. 路径一致性验证
    vector = results[0][0]
    vector_path = vector.payload.get("metadata", {}).get("source_path")
    
    return vector_path == expected_path

def check_dual_store_integrity(project_id: str) -> Dict[str, Any]:
    """检查双存储完整性，返回统计报告"""
    
    # 统计文件数量
    corpus_dir = f"storage/corpus/{project_id}/documents"
    file_count = len([f for f in os.listdir(corpus_dir) if f.endswith('.md')]) if os.path.exists(corpus_dir) else 0
    
    # 统计向量数量
    vector_info = qdrant_client.get_collection(project_id)
    vector_count = vector_info.vectors_count if hasattr(vector_info, 'vectors_count') else 0
    
    # 抽样验证双射
    sample_files = random.sample(os.listdir(corpus_dir), min(10, file_count)) if os.path.exists(corpus_dir) and file_count > 0 else []
    bijection_samples = []
    
    for file in sample_files:
        if file.endswith('.md'):
            file_hash = file.replace('.md', '')
            bijection_samples.append({
                "file": file_hash,
                "bijection_valid": verify_bijection(file_hash, project_id)
            })
    
    return {
        "file_count": file_count,
        "vector_count": vector_count,
        "status": "consistent" if file_count == vector_count else "inconsistent",
        "bijection_samples": bijection_samples,
        "drift_percentage": abs(file_count - vector_count) / max(file_count, vector_count) if max(file_count, vector_count) > 0 else 0.0
    }

```

### 5. 审计与监控

#### 5.1 强制审计点
以下操作必须记录审计日志：
1. 双存储条目创建
2. 双射验证结果（成功/失败）
3. 孤儿向量检测与清理
4. 缺失索引补全操作

#### 5.2 监控指标
- `dual_store_integrity_score`: 双存储完整性得分 (0-100)
- `orphan_vector_count`: 孤儿向量数量
- `missing_index_count`: 缺失索引数量
- `bijection_verification_success_rate`: 双射验证成功率

### 6. 错误处理

#### 6.1 错误类型
- `BrokenBijectionError`: 双射关系断裂
- `IntegrityDriftError`: 内容完整性漂移
- `OrphanVectorError`: 孤儿向量错误
- `MissingIndexError`: 缺失索引错误

#### 6.2 恢复策略
1. **自动恢复**: 对于缺失索引，自动生成向量
2. **人工干预**: 对于孤儿向量，需人工审核后清理
3. **回滚机制**: 双射验证失败时回滚到上一一致状态

---

**遵循逆熵实验室宪法约束: 代码即数学证明，架构即宪法约束。**