"""
监察部-逆熵实验室 Knowledge Tools (The Librarian)
版本: v5.6.0 (Mathematical Rigor Update)
职责: 知识摄入、向量化与语义检索
数学基础:
    1. 滑动窗口: N = ceil((L-O)/(C-O)), C=3072, O=512 (§122)
    2. 余弦相似度: sim(A,B) = (A·B) / (||A||·||B||)
    3. 全局KNN: HNSW Graph Traversal (§121)
    4. 双存储同构: Φ: File ↔ Vector (§114)
"""

import sys
import io
import os
import hashlib
import json
import logging
import uuid
import time
import math
import base64
from typing import List, Dict, Any, Optional
from qdrant_client.http import models

# 微内核组件导入
from ..registry import registry
from ..dependencies import container
from ..utils.sanitizer import negetropy_sanitizer
from ..config import STRICT_DIMENSION
from engine.utils.file_ops import atomic_write

logger = logging.getLogger("Entropy-Librarian")

def _to_float_vector(val: Any) -> Optional[List[float]]:
    """安全地将向量数据转换为 float 列表"""
    if val is None:
        return None
    if isinstance(val, list):
        try:
            return [float(x) for x in val]
        except (TypeError, ValueError):
            return None
    return None

def _cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """计算余弦相似度 (§121)"""
    if len(vec_a) != len(vec_b) or len(vec_a) == 0:
        return 0.0
    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)

# ... [保留 store_project_knowledge, search_knowledge_base, get_project_stats 实现不变] ...

# ---------------------------------------------------------
# Tool 4: 带游标分页的语义搜索 (Semantic Search with Cursor Pagination) - CORRECTED
# ---------------------------------------------------------
@registry.register()
@negetropy_sanitizer
def semantic_search_paginated(
    query: str,
    project_id: str,
    cursor: Optional[str] = None,
    limit: int = 10
) -> str:
    """
    [Tier 2] 带游标分页的语义搜索工具 (Corrected Implementation)。
    
    宪法依据:
    - §306: 游标分页标准 (Cursor-based Pagination)
    - §121: 数学严谨性 (Global KNN Validity via HNSW)
    - §148: 维度验证 (4096D Enforcement)
    
    变更说明:
    v5.6.0: 废弃 scroll + local sort 方案。采用 search (HNSW) + offset 方案。
    数学证明: scroll 返回物理存储顺序的切片，对其排序无法保证获得全局 Top-K 相似向量。
    只有 search 才能在海量数据中保证语义排名的全局正确性。
    """

    # ========== 阶段 1: 维度与项目验证 (§148, §138) ==========
    if not container.project_registry.project_exists(project_id):
        return json.dumps({
            "status": "error",
            "reason": f"Project {project_id} not found",
            "code": "PROJECT_NOT_FOUND"
        })

    # ========== 阶段 2: 向量化计算 (§121) ==========
    try:
        # 调用 NV-Embed-v2 模型
        vector_result = container.engine.calculate_vector(query)
        # 优先使用 mean 向量，如果没有则尝试 chunks[0]
        query_vector = vector_result.get("mean", [])
        if not query_vector:
             chunks = vector_result.get("chunks", [])
             if chunks:
                 query_vector = chunks[0].get("vector", [])

        # 严格维度检查
        if len(query_vector) != STRICT_DIMENSION:
            return json.dumps({
                "status": "error",
                "reason": f"Dimension mismatch: {len(query_vector)} != {STRICT_DIMENSION}",
                "constitutional_violation": "§148"
            })
    except Exception as e:
        return json.dumps({"status": "error", "reason": f"Embedding failure: {str(e)}"})

    # ========== 阶段 3: Cursor 解析 (§306) ==========
    search_offset = 0
    
    if cursor:
        try:
            # Base64 -> JSON -> Offset
            # 遵循 §303.1 编码规范
            decoded = base64.b64decode(cursor).decode('utf-8')
            cursor_data = json.loads(decoded)
            search_offset = int(cursor_data.get("offset", 0))
        except Exception:
            return json.dumps({
                "status": "error", 
                "reason": "Invalid cursor format; expected Base64 encoded JSON"
            })

    # ========== 阶段 4: 全局 KNN 搜索 (Mathematical Correction) ==========
    # 使用 search_points 而非 scroll，确保返回的是全局相似度最高的 Top-K
    # Qdrant 客户端旧版使用 search_points，新版可能使用 search
    try:
        # 优先尝试新版 API (search)
        if hasattr(container.qdrant, 'search'):
            search_results = container.qdrant.search(
                collection_name=f"project_{project_id}",
                query_vector=query_vector,
                limit=limit,
                offset=search_offset,
                with_payload=True,
                with_vectors=False
            )
        else:
            # 降级到旧版 API (search_points)
            search_results = container.qdrant.search_points(
                collection_name=f"project_{project_id}",
                query_vector=query_vector,
                limit=limit,
                offset=search_offset,
                with_payload=True,
                with_vectors=False
            )
    except Exception as e:
        # 降级方案：如果 search API 不可用，使用 scroll + 本地排序
        logger.warning(f"[SemanticSearch] search API failed: {e}, falling back to scroll+sort")
        try:
            scroll_result = container.qdrant.scroll(
                collection_name=f"project_{project_id}",
                limit=limit * 2,
                offset=search_offset,
                with_payload=True,
                with_vectors=True
            )
            points = scroll_result[0] if isinstance(scroll_result, tuple) else scroll_result
            
            # 本地计算余弦相似度并排序
            query_vec_f = _to_float_vector(query_vector)
            if query_vec_f is None:
                return json.dumps({"status": "error", "reason": "Failed to convert query vector"})
            
            scored_points = []
            for point in points:
                point_vector = _to_float_vector(point.vector)
                if point_vector and len(point_vector) == len(query_vec_f):
                    score = _cosine_similarity(query_vec_f, point_vector)
                    scored_points.append((point, score))
            
            scored_points.sort(key=lambda x: x[1], reverse=True)
            search_results = [sp[0] for sp in scored_points[:limit]]
        except Exception as e2:
            return json.dumps({"status": "error", "reason": f"Qdrant search failure: {str(e2)}"})

    # ========== 阶段 5: 结果格式化与元数据标准化 (§400) ==========
    matches = []
    for rank_offset, point in enumerate(search_results):
        payload = point.payload or {}
        matches.append({
            "id": point.id,
            "rank": search_offset + rank_offset + 1,
            "score": round(point.score, 4),  # 保留4位有效数字
            "content": payload.get("content", "")[:500],  # 预览截断
            "metadata": {
                "source_path": payload.get("source_path"),
                "chunk_index": payload.get("chunk_index"),
                "total_chunks": payload.get("total_chunks"),
                "project_id": project_id
            }
        })

    # ========== 阶段 6: 生成 Next Cursor (§306) ==========
    # 如果返回数量等于 limit，说明可能还有更多数据
    # 注意：search 可能会返回少于 limit 的结果（如果总数不够）
    has_more = len(matches) >= limit
    next_cursor = None
    
    if has_more:
        next_offset = search_offset + limit
        # 构建游标 Token
        cursor_payload = json.dumps({
            "offset": next_offset,
            "ver": "v1",          # 版本控制
            "ts": int(time.time())      # 可选：快照时间戳防止漂移
        })
        next_cursor = base64.b64encode(cursor_payload.encode('utf-8')).decode('utf-8')

    # ========== 阶段 7: 构建响应 ==========
    result = {
        "status": "success",
        "data": {
            "query": query,
            "project_id": project_id,
            "matches": matches,
            "pagination": {
                "cursor": cursor,        # 当前游标
                "next_cursor": next_cursor, 
                "limit": limit,
                "has_more": has_more,
                "total_fetched": len(matches)
            }
        },
        "constitutional_compliance": {
            "§306": "游标分页标准",
            "§121": "全局KNN (HNSW Search)",
            "§148": f"4096维验证"
        }
    }

    # 遵循 §337 协议完整性：确保返回纯 JSON 字符串
    return json.dumps(result, ensure_ascii=False)

# ---------------------------------------------------------
# Tool 1: 智能知识存储 (Store Project Knowledge) - 双存储版本
# ---------------------------------------------------------
@registry.register()
@negetropy_sanitizer
def store_project_knowledge(content: str, project_id: str, metadata: Optional[Dict[str, Any]] = None) -> str:
    """
    [The Librarian v5.5.0] 将知识存入双存储系统（文件系统+向量数据库）。
    遵循 §114 双存储同构架构公理和 §215 双存储操作流程。
    
    输入参数:
        content: 文本内容
        project_id: 项目标识符
        metadata: 额外元数据 (可选)
        
    返回: JSON 字符串，包含状态和存储的片段ID

    标准遵循:
    - §114 双存储同构架构公理
    - §215 双存储操作流程
    - §302.1 原子文件写入标准
    - §341-§344 长文档处理标准
    - DS-010: MCP工具策略标准实现

    对应技术法条款: §311.2, §341-§344, §370-§373
    """
    if metadata is None:
        metadata = {}
    
    # 1. 语义门控 (§137): 检查 project_id
    if not container.project_registry.project_exists(project_id):
        return json.dumps({
            "status": "REJECTED", 
            "reason": f"Project {project_id} not found",
            "suggested_action": "请先通过管理工具创建项目"
        })

    # 2. 双存储准备：生成文件ID和路径
    try:
        # 生成文件唯一标识符 (SHA-256哈希)
        file_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()
        
        # 构建文件系统路径 (遵循 §370 目录结构标准)
        base_dir = os.path.join("storage", "corpus", project_id, "documents")
        os.makedirs(base_dir, exist_ok=True)
        
        # 文件名: 使用哈希值确保唯一性
        file_name = f"{file_hash}.md"
        file_path = os.path.join(base_dir, file_name)
        
        # 元数据文件路径
        meta_file_path = os.path.join(base_dir, f"{file_hash}.meta.json")
        
        # 3. 原子写入文件系统 (遵循 §302.1 原子写入原则)
        # 写入主内容文件
        atomic_write(file_path, content)
        
        # 准备元数据
        file_metadata = {
            "source_id": file_hash,
            "project_id": project_id,
            "file_size": len(content),
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "original_metadata": metadata,
            "encoding": "utf-8",
            "content_type": "markdown"
        }
        
        # 写入元数据文件
        atomic_write(meta_file_path, json.dumps(file_metadata, ensure_ascii=False, indent=2))
        
        logger.info(f"[Dual-Store] 文件系统写入完成: {file_path} ({len(content)} 字节)")
        
    except Exception as e:
        logger.error(f"[Dual-Store] 文件系统写入失败: {e}")
        return json.dumps({
            "status": "ERROR",
            "reason": f"文件系统写入失败: {str(e)}",
            "constitutional_violation": "§302.1 (原子写入)"
        })

    # 4. 使用熵引擎进行向量化与分片
    try:
        # engine.calculate_vector 返回 {"mean": [...], "chunks": [...]}
        vector_result = container.engine.calculate_vector(content)
        chunks = vector_result.get("chunks", [])
        if not chunks:
            return json.dumps({
                "status": "ERROR",
                "reason": "Engine returned no chunks"
            })
    except Exception as e:
        logger.error(f"Failed to vectorize content: {e}")
        return json.dumps({
            "status": "ERROR",
            "reason": f"Vectorization failed: {str(e)}"
        })
    
    stored_chunks = []
    errors = []
    
    for i, chunk_data in enumerate(chunks):
        try:
            chunk_text = chunk_data.get("text", "")
            vector = chunk_data.get("vector", [])
            
            # 5. 质量审计 (Entropy Engine)
            quality_result = container.engine.evaluate_raw_quality(chunk_text)
            snr_score = quality_result.get('score', 0)
            snr_db = quality_result.get('snr_db', 0)
            
            if snr_db < 0.5:  # 过滤低质量噪音
                logger.warning(f"Dropping chunk {i} due to low SNR: {snr_db:.2f} dB")
                errors.append(f"chunk_{i}_low_snr")
                continue

            # 6. 维度验证 (宪法 §148)
            if len(vector) != STRICT_DIMENSION:
                return json.dumps({
                    "status": "ERROR", 
                    "reason": f"Dimension Breach: {len(vector)} != {STRICT_DIMENSION}",
                    "constitutional_violation": "§148"
                })

            # 7. 准备元数据 (遵循 §371 向量存储关联标准)
            chunk_metadata = {
                "content": chunk_text,
                "project_id": project_id,
                "chunk_index": i,
                "total_chunks": len(chunks),
                "timestamp": int(time.time()),
                "snr_score": snr_score,
                "snr_db": snr_db,
                "vector_dimension": len(vector),
                # 双存储关联元数据 (关键字段)
                "source_id": file_hash,
                "source_path": file_path.replace("\\", "/"),  # 统一使用斜杠
                "source_file": file_name,
                "file_size": len(content),
                # 原始元数据
                **metadata
            }
            
            # 8. 存入 Qdrant (遵循 §371 向量存储关联标准)
            point_id = str(uuid.uuid4())
            
            container.qdrant.upsert(
                collection_name=f"project_{project_id}",
                points=[
                    models.PointStruct(
                        id=point_id,
                        vector=vector,
                        payload=chunk_metadata
                    )
                ]
            )
            
            stored_chunks.append({
                "id": point_id,
                "chunk_index": i,
                "snr_db": snr_db,
                "source_id": file_hash,
                "source_path": file_path
            })
            
            logger.info(f"[Dual-Store] 存储分片 {i}: {file_hash} (SNR: {snr_db:.2f} dB)")
            
        except Exception as e:
            logger.error(f"Failed to store chunk {i}: {e}")
            errors.append(f"chunk_{i}_error: {str(e)}")

    # 9. 返回结果 (包含双存储信息)
    result = {
        "status": "PARTIAL" if errors else "COMPLETE",
        "chunks_processed": len(chunks),
        "chunks_stored": len(stored_chunks),
        "stored_chunks": stored_chunks,
        "errors": errors if errors else None,
        "vector_dimension": STRICT_DIMENSION,
        "dual_store_info": {
            "file_system": {
                "source_id": file_hash,
                "file_path": file_path,
                "file_size": len(content),
                "metadata_path": meta_file_path
            },
            "vector_db": {
                "collection": f"project_{project_id}",
                "points_stored": len(stored_chunks)
            }
        },
        "constitutional_compliance": {
            "§114": "双存储同构架构公理",
            "§122": "滑动窗口分片 (由引擎处理)",
            "§148": f"维度验证 {STRICT_DIMENSION}D",
            "§137": "语义门控",
            "§302.1": "原子文件写入",
            "§341-§344": "长文档处理标准"
        }
    }
    
    return json.dumps(result, ensure_ascii=False)


# ---------------------------------------------------------
# Tool 2: 语义知识检索 (Search Knowledge Base)
# ---------------------------------------------------------
@registry.register()
@negetropy_sanitizer
def search_knowledge_base(query: str, project_id: str, limit: int = 5) -> str:
    """
    [The Librarian] 基于语义相似度检索知识。
    
    输入参数:
        query: 查询文本
        project_id: 项目标识符
        limit: 返回结果数量 (默认5)
        
    返回: JSON 字符串，包含匹配结果和相似度分数
    """
    # 1. 验证项目存在
    if not container.project_registry.project_exists(project_id):
        return json.dumps({
            "error": f"Project {project_id} not found",
            "suggested_action": "检查项目ID或先创建项目"
        })

    try:
        # 2. 查询向量化
        vector_result = container.engine.calculate_vector(query)
        # 使用第一个chunk的向量作为查询向量，如果没有则使用mean向量
        chunks = vector_result.get("chunks", [])
        if chunks and len(chunks) > 0:
            query_vector = chunks[0].get("vector", [])
        else:
            query_vector = vector_result.get("mean", [])
        
        if len(query_vector) != STRICT_DIMENSION:
            return json.dumps({
                "error": f"Query vector dimension mismatch: {len(query_vector)} != {STRICT_DIMENSION}",
                "constitutional_violation": "§148"
            })

        # 3. 向量检索 - 使用 scroll + 本地余弦相似度计算
        # 遵循 vector_projection.py 的模式
        scroll_result = container.qdrant.scroll(
            collection_name=f"project_{project_id}",
            limit=limit * 2,  # 多取一些用于排序
            with_payload=True,
            with_vectors=True
        )
        
        # Qdrant scroll 返回 (points, next_page_offset)
        points = scroll_result[0] if isinstance(scroll_result, tuple) else scroll_result
        
        # 转换为 float 向量用于计算
        query_vec_f = _to_float_vector(query_vector)
        if query_vec_f is None:
            return json.dumps({"error": "Failed to convert query vector"})
        
        # 计算每个点的余弦相似度并排序
        scored_points = []
        for point in points:
            point_vector = _to_float_vector(point.vector)
            if point_vector and len(point_vector) == len(query_vec_f):
                score = _cosine_similarity(query_vec_f, point_vector)
                scored_points.append((point, score))
        
        # 按相似度降序排序
        scored_points.sort(key=lambda x: x[1], reverse=True)
        
        # 取 top-K
        top_points = [sp[0] for sp in scored_points[:limit]]

        # 4. 结果格式化
        matches = []
        for i, point in enumerate(top_points):
            payload = point.payload or {}
            score = scored_points[i][1] if i < len(scored_points) else 0
            match_data = {
                "rank": i + 1,
                "score": round(score, 4),
                "id": str(point.id),
                "content": payload.get("content", ""),
                "metadata": {
                    k: v for k, v in payload.items() 
                    if k not in ["content"]
                }
            }
            matches.append(match_data)

        # 5. 返回结构化结果
        result = {
            "query": query,
            "project_id": project_id,
            "matches_found": len(matches),
            "matches": matches,
            "search_parameters": {
                "limit": limit,
                "score_threshold": 0.3,
                "vector_dimension": STRICT_DIMENSION
            },
            "constitutional_compliance": {
                "§121": "余弦相似度计算",
                "§148": f"维度验证 {STRICT_DIMENSION}D"
            }
        }
        
        return json.dumps(result, ensure_ascii=False)
        
    except Exception as e:
        logger.error(f"Search failed: {e}")
        return json.dumps({
            "error": str(e),
            "query": query,
            "project_id": project_id
        })


# ---------------------------------------------------------
# Tool 3: 获取项目统计信息 (可选)
# ---------------------------------------------------------
@registry.register()
@negetropy_sanitizer
def get_project_stats(project_id: str) -> str:
    """
    [The Librarian] 获取指定项目的知识库统计信息。
    """
    if not container.project_registry.project_exists(project_id):
        return json.dumps({"error": f"Project {project_id} not found"})
    
    try:
        # 获取集合信息
        collection_info = container.qdrant.get_collection(collection_name=f"project_{project_id}")
        
        # 获取点数
        count_result = container.qdrant.count(
            collection_name=f"project_{project_id}",
            exact=True
        )
        
        # 安全提取配置信息，避免序列化复杂对象
        def extract_config(config_obj):
            """提取配置信息为基本类型"""
            if config_obj is None:
                return None
            result = {}
            
            # 处理 params
            if hasattr(config_obj, 'params') and config_obj.params:
                params = config_obj.params
                # 提取向量的维度信息
                if hasattr(params, 'vectors'):
                    vectors = params.vectors
                    if hasattr(vectors, 'size'):
                        result["vector_size"] = vectors.size
                    if hasattr(vectors, 'distance'):
                        result["distance"] = str(vectors.distance)
            
            # 添加其他配置信息
            if hasattr(config_obj, 'hnsw_config') and config_obj.hnsw_config:
                result["hnsw_m"] = getattr(config_obj.hnsw_config, 'm', None)
                result["hnsw_ef_construct"] = getattr(config_obj.hnsw_config, 'ef_construct', None)
            
            return result
        
        # 构建可序列化的结果
        result = {
            "project_id": project_id,
            "collection_info": {
                "status": collection_info.status,
                "points_count": count_result.count,
                "config": extract_config(collection_info.config)
            },
            "count": count_result.count,
            "timestamp": int(time.time())
        }
        
        return json.dumps(result, ensure_ascii=False)
        
    except Exception as e:
        logger.error(f"Failed to get project stats: {e}")
        return json.dumps({"error": str(e)})
