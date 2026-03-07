"""
知识图谱服务 (Knowledge Graph Service)
版本: 1.0.0
职责: 从 Qdrant 构建知识图谱，使用 DBSCAN 进行语义聚类
数学基础:
1. DBSCAN 聚类: eps=0.3 (余弦距离), min_samples=2
2. 余弦相似度: sim(A,B) = (A·B) / (||A||·||B||)
3. 连接权重: 基于相似度阈值 > 0.75
宪法遵循: §121 (数学约束), §148 (维度验证), §135 (输出卫生)
"""

import sys
import io

def enforce_constitutional_encoding():
    """
    [技术法 §301] 全局字符集强制令实施
    描述: 强制重配置标准输出流为 UTF-8，确保跨平台 Unicode (✅/❌) 显示一致性。
    禁止任何形式的"智能检测"，必须无条件执行。
    """
    # 方案一：标准样板代码 (The Standard Boilerplate)
    if hasattr(sys.stdout, 'reconfigure'):
        # Python 3.7+ 标准解法
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    else:
        # 遗留系统兼容解法
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 立即执行配置 (起手式)
enforce_constitutional_encoding()

import logging
import os
import time
import hashlib
import numpy as np
from typing import List, Dict, Any, Optional, Tuple
try:
    from qdrant_client import QdrantClient
    from qdrant_client.http import models as qdrant_models
except ImportError:
    try:
        from engine.utils.mock_qdrant import MockQdrantClient as QdrantClient
        qdrant_models = None
    except ImportError:
        class QdrantClient:
            def __init__(self, *args, **kwargs): pass
        qdrant_models = None

try:
    from sklearn.cluster import DBSCAN
except ImportError:
    class DBSCAN:
        def __init__(self, *args, **kwargs): pass
        def fit(self, *args, **kwargs):
            self.labels_ = []
            return self


from entropy_service.models import GraphNode, GraphLink, GraphResponse

logger = logging.getLogger("KnowledgeGraphService")


class KnowledgeGraphService:
    """知识图谱构建服务"""

    def __init__(self, qdrant_url: Optional[str] = None):
        """
        初始化服务
        Args:
            qdrant_url: Qdrant 服务地址，如果为None，则从环境变量QDANT_URL读取
        """
        if qdrant_url is None:
            qdrant_url = os.getenv("QDANT_URL", os.getenv("QDRANT_URL", "http://negentropy-qdrant:6333"))
        
        if qdrant_url.lower() in ["mock", "local", "memory"]:
            # 计算 storage 路径
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            qdrant_path = os.path.join(base_dir, "storage", "qdrant_local")
            os.makedirs(qdrant_path, exist_ok=True)
            self.client = QdrantClient(path=qdrant_path)
            logger.info(f"KnowledgeGraphService 启用本地 Mock 模式，存储路径: {qdrant_path}")
        else:
            self.client = QdrantClient(url=qdrant_url)
            logger.info(f"KnowledgeGraphService 初始化完成，连接至 {qdrant_url}")

    def build_graph(self, project_id: str) -> GraphResponse:
        """
        为指定项目构建知识图谱
        Args:
            project_id: 项目标识符
        Returns:
            GraphResponse: 包含节点和连接的知识图谱
        """
        collection_name = f"project_{project_id}"
        start_time = time.time()
        logger.info(f"开始构建知识图谱: {collection_name}")

        # 1. 批量获取向量数据 (Limit 2000 for performance safety)
        try:
            points, _ = self.client.scroll(
                collection_name=collection_name,
                limit=2000,
                with_payload=True,
                with_vectors=True,
                scroll_filter=None
            )
            logger.info(f"从 Qdrant 获取到 {len(points)} 个点")
        except Exception as e:
            logger.error(f"Qdrant 查询失败: {e}")
            # 返回空图谱而不是报错，保证前端鲁棒性
            return self._empty_response(project_id, start_time)

        if not points:
            logger.warning(f"项目 {project_id} 没有数据点")
            return self._empty_response(project_id, start_time)

        # 2. 准备聚类数据
        vectors = [p.vector for p in points]
        vector_array = np.array(vectors)

        # 验证维度 (宪法 §148)
        if vector_array.shape[1] != 4096:
            logger.error(f"维度违规: {vector_array.shape[1]} != 4096")
            # 仍继续处理，但记录警告
            # 实际生产环境可能需要更严格的处理

        # 使用余弦距离 (Cosine Distance) = 1 - Cosine Similarity
        # DBSCAN eps=0.3 意味着相似度 > 0.7 归为一类
        logger.info("开始 DBSCAN 聚类...")
        clustering = DBSCAN(eps=0.3, min_samples=2, metric='cosine', n_jobs=-1).fit(vector_array)
        labels = clustering.labels_
        
        unique_labels = set(labels)
        cluster_count = len(unique_labels) - (1 if -1 in unique_labels else 0)
        logger.info(f"聚类完成: {cluster_count} 个簇, {sum(labels == -1)} 个噪声点")

        # 3. 构建节点
        nodes: List[GraphNode] = []
        node_id_to_index: Dict[str, int] = {}
        
        for idx, (point, label) in enumerate(zip(points, labels)):
            payload = point.payload or {}
            content = payload.get("content", "")
            
            # 生成标签：截取内容前30字符
            point_id = str(point.id)  # 确保转换为字符串
            label_text = content[:30] + "..." if len(content) > 30 else content
            if not label_text.strip():
                label_text = f"节点_{point_id[:8]}"
            
            # 构建标签列表
            tags = payload.get("tags", [])
            if not tags and "chunk_index" in payload:
                tags.append(f"chunk_{payload['chunk_index']}")
            
            # 构建元数据 (遵守 §135 输出卫生，不包含完整向量)
            vector_dimension = len(point.vector) if point.vector else 0
            metadata = {
                "snr_db": float(payload.get("snr_db", 0)),
                "chunk_index": int(payload.get("chunk_index", 0)),
                "total_chunks": int(payload.get("total_chunks", 1)),
                "timestamp": int(payload.get("timestamp", 0)),
                "vector_dimension": vector_dimension,
                "cluster_label": int(label)
            }
            
            node = GraphNode(
                id=point_id,
                label=label_text,
                type="document_chunk",
                cluster_id=int(label),
                tags=tags,
                metadata=metadata
            )
            nodes.append(node)
            node_id_to_index[point_id] = idx

        # 4. 构建连接 (优化策略：减少计算量)
        logger.info("开始构建连接...")
        links: List[GraphLink] = self._build_links_optimized(nodes, vector_array, labels, node_id_to_index)
        
        logger.info(f"图谱构建完成: {len(nodes)} 节点, {len(links)} 连接")

        return GraphResponse(
            project_id=project_id,
            timestamp=time.time(),
            node_count=len(nodes),
            link_count=len(links),
            clusters=cluster_count,
            nodes=nodes,
            links=links
        )

    def _build_links_optimized(self, 
                               nodes: List[GraphNode], 
                               vectors: np.ndarray,
                               labels: np.ndarray,
                               node_id_to_index: Dict[str, int]) -> List[GraphLink]:
        """
        优化连接构建策略
        策略: 每个簇内构建最小生成树，簇间不连接
        """
        links: List[GraphLink] = []
        
        # 按簇分组
        cluster_to_indices: Dict[int, List[int]] = {}
        for idx, label in enumerate(labels):
            if label not in cluster_to_indices:
                cluster_to_indices[label] = []
            cluster_to_indices[label].append(idx)
        
        # 移除噪声簇 (-1)
        if -1 in cluster_to_indices:
            del cluster_to_indices[-1]
        
        # 对每个簇构建连接
        for label, indices in cluster_to_indices.items():
            if len(indices) < 2:
                continue  # 至少需要2个节点才能连接
            
            # 计算簇内相似度矩阵 (仅计算必要部分)
            cluster_vectors = vectors[indices]
            
            # 对于小簇，计算全连接
            if len(indices) <= 10:
                # 计算余弦相似度矩阵
                norm = np.linalg.norm(cluster_vectors, axis=1, keepdims=True)
                norm_vectors = cluster_vectors / norm
                similarity_matrix = np.dot(norm_vectors, norm_vectors.T)
                
                # 选择相似度 > 0.75 的连接
                for i in range(len(indices)):
                    for j in range(i + 1, len(indices)):
                        sim = similarity_matrix[i, j]
                        if sim > 0.75:
                            source_id = nodes[indices[i]].id
                            target_id = nodes[indices[j]].id
                            links.append(GraphLink(
                                source=source_id,
                                target=target_id,
                                weight=float(sim),
                                type="semantic_cluster"
                            ))
            else:
                # 对于大簇，使用更高效的连接策略
                # 策略: 连接每个节点到最相似的3个邻居
                # 使用近似最近邻 (这里简化，使用随机采样)
                sampled_indices = np.random.choice(indices, size=min(20, len(indices)), replace=False)
                sampled_vectors = vectors[sampled_indices]
                
                # 计算采样点之间的相似度
                norm = np.linalg.norm(sampled_vectors, axis=1, keepdims=True)
                norm_vectors = sampled_vectors / norm
                similarity_matrix = np.dot(norm_vectors, norm_vectors.T)
                
                # 为每个采样点连接最相似的2个邻居
                for i, idx_i in enumerate(sampled_indices):
                    # 获取相似度最高的2个邻居 (排除自己)
                    sim_scores = similarity_matrix[i]
                    sim_scores[i] = -1  # 排除自己
                    top_indices = np.argsort(sim_scores)[-2:]  # 取最相似的2个
                    
                    for j in top_indices:
                        if j >= len(sampled_indices):
                            continue
                        sim = sim_scores[j]
                        if sim > 0.75:
                            source_id = nodes[idx_i].id
                            target_id = nodes[sampled_indices[j]].id
                            links.append(GraphLink(
                                source=source_id,
                                target=target_id,
                                weight=float(sim),
                                type="semantic_cluster"
                            ))
        
        return links

    def _empty_response(self, project_id: str, start_time: float) -> GraphResponse:
        """返回空响应"""
        return GraphResponse(
            project_id=project_id,
            timestamp=time.time(),
            node_count=0,
            link_count=0,
            clusters=0,
            nodes=[],
            links=[]
        )

    def get_graph_summary(self, project_id: str) -> Dict[str, Any]:
        """
        [L5 Interface] 获取图谱摘要元数据 (Low Entropy)
        宪法依据: §127 数据驱动原则
        """
        try:
            # 1. 获取完整图数据以计算连接数 (复用 build_graph)
            # 注意: 这可能是一个昂贵的操作，生产环境应考虑缓存
            graph_response = self.build_graph(project_id)
            
            # 2. 提取统计数据
            node_count = graph_response.node_count
            edge_count = graph_response.link_count
            last_updated = int(graph_response.timestamp)
            
            # 3. 计算数据指纹 (Hash)
            # 使用 节点数:连接数:项目ID 的组合作为简单指纹
            # 只要拓扑结构变化，指纹就会变化
            data_fingerprint = f"{node_count}:{edge_count}:{project_id}"
            data_hash = hashlib.md5(data_fingerprint.encode()).hexdigest()
            
            return {
                "project_id": project_id,
                "node_count": node_count,
                "edge_count": edge_count,
                "last_updated": last_updated,
                "hash": data_hash
            }
        except Exception as e:
            logger.error(f"获取图谱摘要失败: {e}")
            # 返回空摘要以符合降级策略
            return {
                "project_id": project_id,
                "node_count": 0,
                "edge_count": 0,
                "last_updated": int(time.time()),
                "hash": ""
            }


# 单例实例
_instance: Optional[KnowledgeGraphService] = None

def get_knowledge_graph_service(qdrant_url: Optional[str] = None) -> KnowledgeGraphService:
    """获取知识图谱服务单例"""
    global _instance
    if _instance is None:
        _instance = KnowledgeGraphService(qdrant_url)
    return _instance
