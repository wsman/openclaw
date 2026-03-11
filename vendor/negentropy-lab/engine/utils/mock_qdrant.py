"""
Negentropy-Lab Mock Qdrant Client
版本: 1.0.0
职责: 在无 Qdrant 环境下模拟向量数据库行为，支持基本 CRUD 和搜索。
依据: Phase 4.1-Lite 本地环境对接要求
"""

import os
import json
import uuid
import time
import logging
import math
from typing import List, Dict, Any, Optional, Union, Tuple

logger = logging.getLogger("MockQdrant")

class MockPoint:
    def __init__(self, id: str, vector: List[float], payload: Dict[str, Any]):
        self.id = id
        self.vector = vector
        self.payload = payload

class MockCollectionInfo:
    def __init__(self, status: str = "green", count: int = 0):
        self.status = status
        self.points_count = count
        self.config = None

class MockCountResult:
    def __init__(self, count: int):
        self.count = count

class MockQdrantClient:
    """内存版 Mock Qdrant 客户端，支持本地文件持久化"""
    
    def __init__(self, path: Optional[str] = None, url: Optional[str] = None, **_: Any):
        self.path = path
        self.url = url
        self.collections = {} # Dict[str, List[MockPoint]]
        if path:
            os.makedirs(path, exist_ok=True)
            self._load_from_disk()
            
    def _load_from_disk(self):
        if not self.path: return
        try:
            for filename in os.listdir(self.path):
                if filename.endswith(".json") and filename.startswith("col_"):
                    col_name = filename[4:-5]
                    with open(os.path.join(self.path, filename), "r", encoding="utf-8") as f:
                        data = json.load(f)
                        self.collections[col_name] = [
                            MockPoint(p["id"], p["vector"], p["payload"]) for p in data
                        ]
            logger.info(f"MockQdrant: 已从磁盘加载 {len(self.collections)} 个集合")
        except Exception as e:
            logger.error(f"MockQdrant: 加载数据失败: {e}")

    def _save_to_disk(self, collection_name: str):
        if not self.path: return
        try:
            data = [
                {"id": p.id, "vector": p.vector, "payload": p.payload} 
                for p in self.collections.get(collection_name, [])
            ]
            filepath = os.path.join(self.path, f"col_{collection_name}.json")
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"MockQdrant: 保存数据失败: {e}")

    def upsert(self, collection_name: str, points: List[Any]):
        if collection_name not in self.collections:
            self.collections[collection_name] = []
        
        for p in points:
            # 兼容 models.PointStruct 或 dict
            p_id = getattr(p, "id", None) or p.get("id")
            p_vector = getattr(p, "vector", None) or p.get("vector")
            p_payload = getattr(p, "payload", None) or p.get("payload")
            
            # 更新或添加
            found = False
            for existing in self.collections[collection_name]:
                if existing.id == p_id:
                    existing.vector = p_vector
                    existing.payload = p_payload
                    found = True
                    break
            if not found:
                self.collections[collection_name].append(MockPoint(p_id, p_vector, p_payload))
        
        self._save_to_disk(collection_name)
        return True

    def scroll(self, collection_name: str, limit: int = 10, offset: Optional[Union[int, str]] = 0, **kwargs):
        points = self.collections.get(collection_name, [])
        
        start_idx = 0
        if isinstance(offset, int):
            start_idx = offset
        elif isinstance(offset, str) and offset.isdigit():
            start_idx = int(offset)
            
        end_idx = start_idx + limit
        result_points = points[start_idx:end_idx]
        
        next_offset = end_idx if end_idx < len(points) else None
        return result_points, next_offset

    def search(self, collection_name: str, query_vector: List[float], limit: int = 5, offset: int = 0, **kwargs):
        points = self.collections.get(collection_name, [])
        
        # 计算相似度
        def cosine_similarity(v1, v2):
            dot = sum(a*b for a,b in zip(v1, v2))
            n1 = math.sqrt(sum(a*a for a in v1))
            n2 = math.sqrt(sum(a*a for a in v2))
            return dot / (n1 * n2) if n1 > 0 and n2 > 0 else 0

        scored = []
        for p in points:
            score = cosine_similarity(query_vector, p.vector)
            scored.append((p, score))
        
        scored.sort(key=lambda x: x[1], reverse=True)
        
        results = []
        for p, score in scored[offset:offset+limit]:
            # Qdrant search result 包含 score 属性
            p.score = score
            results.append(p)
            
        return results

    def get_collection(self, collection_name: str):
        if collection_name not in self.collections:
            raise Exception(f"Collection {collection_name} not found")
        return MockCollectionInfo(count=len(self.collections[collection_name]))

    def count(self, collection_name: str, **kwargs):
        count = len(self.collections.get(collection_name, []))
        return MockCountResult(count=count)

    def create_collection(self, collection_name: str, **kwargs):
        if collection_name not in self.collections:
            self.collections[collection_name] = []
            self._save_to_disk(collection_name)
        return True

    def get_collections(self):
        class Cols:
            def __init__(self, names): self.collections = [type('Col', (), {'name': n})() for n in names]
        return Cols(list(self.collections.keys()))
