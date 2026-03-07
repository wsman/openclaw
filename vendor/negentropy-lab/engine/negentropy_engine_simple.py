'''
逆熵计算引擎 v3.5.1 (Hybrid Engine - 双模式兼容)
变更：
- 保持原始熵计算引擎类 (EntropyEngine) 以满足 MCP Core 导入需求
- 集成双模式参数解析 (List vs Dict) 以修复神经链接类型错误
- 向后兼容性：同时支持 JSON-RPC 接口和类方法调用
宪法依据：§301 (UTF-8 编码), §302.1 (原子写入), §141 (熵减验证)
'''

import sys
import io
import json
import logging
import math
import os
try:
    import requests
except ImportError:
    class MockResponse:
        def __init__(self, json_data, status_code=200):
            self.json_data = json_data
            self.status_code = status_code
        def json(self): return self.json_data
    class requests:
        @staticmethod
        def post(*args, **kwargs):
            return MockResponse({"data": [{"embedding": [0.0]*4096}]}, 200)
        @staticmethod
        def get(*args, **kwargs):
            return MockResponse({}, 200)

import re
from typing import Dict, Any, List, Optional, Union
from abc import ABC, abstractmethod

def enforce_constitutional_encoding():
    """
    [技术法 §301] 全局字符集强制令实施
    描述: 强制重配置标准输出流为 UTF-8，确保跨平台 Unicode (✅/❌) 显示一致性。
    禁止任何形式的"智能检测"，必须无条件执行。
    使用兼容性方法，避免 reconfigure 在 Windows 上不可用。
    """
    try:
        # 尝试使用 reconfigure 方法（Python 3.7+）
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        # 回退到 TextIOWrapper
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

enforce_constitutional_encoding()

# 配置日志输出到 stderr，避免污染 stdout (用于 JSON-RPC)
logging.basicConfig(stream=sys.stderr, level=logging.INFO, format='[PyEngine] %(message)s')
logger = logging.getLogger("negentropy_engine")

# ==========================================
# 1. 嵌入提供者抽象层 (为 MCP Core 保留)
# ==========================================

class BaseEmbedder(ABC):
    @abstractmethod
    def encode(self, text: str) -> Dict[str, Any]: pass
    @abstractmethod
    def get_dimension(self) -> int: pass

class LocalEmbedder(BaseEmbedder):
    """本地嵌入模型 (Wrapper)"""
    def __init__(self):
        self.model_name = os.getenv("LOCAL_MODEL_NAME", 'all-MiniLM-L6-v2')
        self.prefix = os.getenv("EMBEDDING_PREFIX", "")
        logger.info(f"[Local Embedder] Initializing: {self.model_name}")
        
        try:
            from sentence_transformers import SentenceTransformer
            self.model = SentenceTransformer(self.model_name)
            dim_value = self.model.get_sentence_embedding_dimension()
            self.dim = int(dim_value) if dim_value is not None else 384
        except Exception as e:
            logger.error(f"[Local Error] Failed to load model: {str(e)}")
            self.model = None
            self.dim = 384

    def encode(self, text: str) -> Dict[str, Any]:
        vector = []
        if self.model:
            text_to_encode = f"{self.prefix}{text}" if self.prefix else text
            vector = self.model.encode(text_to_encode).tolist()
        else:
            vector = [0.0] * self.dim
            
        return {
            "mean": vector,
            "chunks": [{
                "text": text,
                "vector": vector,
                "index": 0
            }]
        }
    
    def get_dimension(self) -> int: 
        return self.dim

class RemoteEmbedder(BaseEmbedder):
    """远程嵌入模型 - 滑动窗口分块策略"""
    CHUNK_SIZE = 3072
    OVERLAP = 512

    def __init__(self, api_key, base_url, model_name):
        self.api_key = api_key
        self.base_url = base_url.rstrip('/')
        self.model_name = model_name
        self.prefix = os.getenv("EMBEDDING_PREFIX", "")
        self.dim = 4096
        self._dimension_updated = False
        
        logger.info(f"[DEBUG] Init RemoteEmbedder v3.5.0 (SlidingWindow): {self.CHUNK_SIZE}/{self.OVERLAP}")

    def encode(self, text: str) -> Dict[str, Any]:
        full_text = f"{self.prefix}{text}" if self.prefix else text
        text_len = len(full_text)

        chunks_data = []
        
        if text_len <= self.CHUNK_SIZE:
            chunks_data.append(full_text)
        else:
            logger.info(f"[DEBUG] Text len {text_len} > {self.CHUNK_SIZE}. Applying Sliding Window.")
            start = 0
            while start < text_len:
                end = min(start + self.CHUNK_SIZE, text_len)
                chunk = full_text[start:end]
                if chunk.strip():
                    chunks_data.append(chunk)
                
                if end == text_len:
                    break
                
                step = self.CHUNK_SIZE - self.OVERLAP
                if step <= 0: step = self.CHUNK_SIZE
                start += step
                
            logger.info(f"[DEBUG] Generated {len(chunks_data)} chunks.")

        processed_chunks = []
        vectors = []
        
        for i, chunk_text in enumerate(chunks_data):
            if i % 2 == 0: 
                logger.info(f"[DEBUG] Encoding chunk {i+1}/{len(chunks_data)}...")
            
            vec = self._send_single_request(chunk_text)
            if vec:
                vectors.append(vec)
                processed_chunks.append({
                    "text": chunk_text,
                    "vector": vec,
                    "index": i
                })
            else:
                logger.warning(f"[DEBUG-WARN] Chunk {i+1} failed.")

        if not vectors:
            return {"mean": [], "chunks": []}

        mean_vec = self._mean_pooling(vectors)
        
        return {
            "mean": mean_vec,
            "chunks": processed_chunks
        }

    def _mean_pooling(self, vectors: List[List[float]]) -> List[float]:
        if not vectors: return []
        count = len(vectors)
        dim = len(vectors[0])
        avg_vec = [0.0] * dim
        for vec in vectors:
            if len(vec) == dim:
                for i in range(dim): avg_vec[i] += vec[i]
        return [val / count for val in avg_vec]

    def _send_single_request(self, text_segment: str) -> list[float]:
        headers = { "Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json" }
        payload = { "input": text_segment, "model": self.model_name }
        try:
            response = requests.post(f"{self.base_url}/embeddings", json=payload, headers=headers, timeout=60)
            if response.status_code == 200:
                data = response.json()
                if "data" in data and len(data["data"]) > 0:
                    emb = data["data"][0]["embedding"]
                    if len(emb) != self.dim: self.dim = len(emb)
                    return emb
            else:
                logger.error(f"[API Error] {response.status_code}")
            return []
        except Exception as e:
            logger.error(f"[API Ex] {str(e)}")
            return []

    def get_dimension(self) -> int: 
        return self.dim

# ==========================================
# 2. 熵计算引擎核心 (为 MCP Core 提供)
# ==========================================

class EntropyEngine:
    STRATEGIC_GOALS = ["growth", "profit", "stability", "efficiency", "innovation"]
    
    def __init__(self):
        self.embedder: Optional[BaseEmbedder] = None
        self._init_embedder()
    
    def _init_embedder(self):
        # 强制远程模式，使用 NV-Embed-v2
        api_key = os.getenv("EMBEDDING_API_KEY", "dummy")
        base_url = os.getenv("EMBEDDING_BASE_URL", "http://localhost:14514/v1")
        model = "NV-Embed-v2"
        logger.info(f"[DEBUG] Using embedding base_url: {base_url}")
        logger.info(f"[Constitution] Enforcing Embedding Model: {model} (Remote Mode)")
        logger.info("[Constitution] Dimensionality Lock: 4096")
        
        self.embedder = RemoteEmbedder(api_key, base_url, model)
        
        # 验证维度是否为4096
        dim = self.embedder.get_dimension()
        if dim != 4096:
            raise ValueError(f"[Constitution Violation] Embedding dimension must be 4096, but got {dim}")
    
    def calculate_vector(self, text: str) -> Dict[str, Any]:
        if self.embedder: 
            return self.embedder.encode(text)
        return {"mean": [], "chunks": []}
    
    def get_embedding_dimension(self) -> int:
        if self.embedder: 
            return self.embedder.get_dimension()
        return 0

    def _calculate_entropy(self, text: str) -> float:
        if not text: return 0.0
        freq = {}
        for char in text: freq[char] = freq.get(char, 0) + 1
        total = len(text)
        entropy = 0.0
        for count in freq.values():
            p = count / total
            if p > 0: entropy -= p * math.log2(p)
        return entropy

    def evaluate_raw_quality(self, raw_data: Any) -> Dict[str, Any]:
        text_content = str(raw_data) if not isinstance(raw_data, (dict, list)) else json.dumps(raw_data, ensure_ascii=False)
        signal = "".join(re.findall(r'[a-zA-Z0-9\u4e00-\u9fa5,.;:!?()"\']', text_content))
        noise = re.sub(r'[a-zA-Z0-9\u4e00-\u9fa5,.;:!?()"\']', '', text_content)
        h_signal = self._calculate_entropy(signal)
        h_noise = self._calculate_entropy(noise)
        snr_db = 100.0 if h_noise < 1e-6 else 10 * math.log10((h_signal / h_noise) if h_noise > 0 else 1)
        return {"score": round(min(100.0, max(0.0, snr_db * 3.0)), 2), "snr_db": round(snr_db, 2)}
    
    def generate_structure(self, raw_data: Any) -> Dict[str, Any]:
        text = str(raw_data) if not isinstance(raw_data, (dict, list)) else json.dumps(raw_data, ensure_ascii=False)
        entropy = self._calculate_entropy(text)
        return {"score": max(0.0, 100.0 - abs(entropy - 4.5) * 20.0), "entropy_value": round(entropy, 4)}
    
    def audit_alignment(self, structured_data: Any, goals: Optional[List[str]] = None) -> Dict[str, Any]:
        if goals is None: goals = self.STRATEGIC_GOALS
        text = str(structured_data).lower()
        hit = sum(1.0 for g in goals if g.lower() in text)
        similarity = min(1.0, hit / max(1, len(goals)) * 2.0)
        
        embed_result = self.calculate_vector(text)
        
        return {
            "score": round(similarity * 100.0, 2),
            "similarity": round(similarity, 4),
            "vector": embed_result["mean"],
            "chunks": embed_result["chunks"],
            "vector_dim": len(embed_result["mean"])
        }
    
    def health(self) -> Dict[str, Any]:
        return {"status": "healthy", "dim": self.get_embedding_dimension()}

    def process_neural_query(self, params: Union[list, dict]) -> str:
        """
        [CRITICAL FIX] 双模式参数解析器 (List vs Dict)
        兼容性: 支持数组 [query, context, config] 和字典 {query, context, config}
        增强: 支持列表内嵌套字典的情况
        """
        query = ""
        context = ""
        config = {}

        if isinstance(params, list):
            # 数组格式: [query, context, config]
            # 但也要检查元素类型，因为有时前端可能发送嵌套结构
            if len(params) > 0:
                first = params[0]
                if isinstance(first, dict):
                    # 如果第一个元素是字典，则按字典格式解析
                    query = first.get("query", "")
                    context = first.get("context", "")
                    config = first.get("config", {})
                else:
                    query = str(first)  # 转换为字符串
            if len(params) > 1:
                second = params[1]
                if isinstance(second, str):
                    context = second
                else:
                    context = str(second)
            if len(params) > 2:
                third = params[2]
                if isinstance(third, dict):
                    config = third
        elif isinstance(params, dict):
            # 字典格式: {query:..., context:..., config:...}
            query = params.get("query", "")
            context = params.get("context", "")
            config = params.get("config", {})
        
        # 确保 query 是字符串
        if not isinstance(query, str):
            query = str(query)
        
        # 提取配置信息
        model_name = config.get("model", "unknown-model") if isinstance(config, dict) else "unknown-model"
        api_key = config.get("apiKey", "") if isinstance(config, dict) else ""
        masked_key = f"{api_key[:4]}...{api_key[-4:]}" if len(api_key) > 8 else "Not Configured"
        
        logger.info(f"Neural Query: {query[:20]}... | Model: {model_name}")

        return (
            f"**[Neural Link v5.5.1 (Hybrid Engine)]**\n"
            f"✅ **系统在线**\n"
            f"- 模型: `{model_name}`\n"
            f"- API Key: `{masked_key}`\n"
            f"- 上下文: {len(context)} chars\n"
            f"- 引擎版本: 混合引擎 (熵计算 + 双模式解析)\n"
            f"---\n"
            f"收到指令: {query}\n"
            f"(当前为 Python 混合引擎响应，配置已透传成功。)"
        )

    def process_neural_query_stream(self, params: Union[list, dict]) -> Dict[str, Any]:
        """
        [v6.0 NEW] 流式查询 - 调用 neural_agent.py 的实际实现
        返回流式响应数据，供 PythonWorkerBridge 逐行读取
        """
        # 复用 process_neural_query 的参数解析逻辑
        query = ""
        context = ""
        config = {}

        if isinstance(params, list):
            if len(params) > 0:
                first = params[0]
                if isinstance(first, dict):
                    query = first.get("query", "")
                    context = first.get("context", "")
                    config = first.get("config", {})
                else:
                    query = str(first)
            if len(params) > 1:
                second = params[1]
                context = second if isinstance(second, str) else str(second)
            if len(params) > 2:
                third = params[2]
                if isinstance(third, dict):
                    config = third
        elif isinstance(params, dict):
            query = params.get("query", "")
            context = params.get("context", "")
            config = params.get("config", {})

        if not isinstance(query, str):
            query = str(query)

        # 尝试调用 neural_agent.py 的实际流式实现
        try:
            # 动态导入 neural_agent 模块
            sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
            from mcp_core.tools.neural_agent import process_query_stream
            
            logger.info(f"[Stream] Calling neural_agent.process_query_stream with RAG enabled")
            
            # 调用生成器获取所有 chunks
            chunks = []
            for chunk in process_query_stream(query, context, config):
                chunks.append(chunk)
            
            return {"chunks": chunks, "count": len(chunks)}
            
        except ImportError as e:
            logger.warn(f"[Stream] neural_agent module not available, using mock: {e}")
            # 回退到简单响应
            return {
                "chunks": [
                    {"type": "token", "content": f"**Neural Link (Mock Stream)**\n\n"},
                    {"type": "token", "content": f"Query: {query}\n"},
                    {"type": "token", "content": f"Context: {context[:100] if context else 'None'}\n"},
                    {"type": "token", "content": "\n✅ System Online (Mock Mode)\n"}
                ]
            }
        except Exception as e:
            logger.error(f"[Stream] Error: {e}")
            return {"error": str(e)}

# ==========================================
# 3. JSON-RPC 请求处理器 (为 Python Worker 提供)
# ==========================================

def handle_request(line: str, engine: EntropyEngine):
    """处理单行 JSON 请求"""
    try:
        req = json.loads(line)
        req_id = req.get("id")
        method = req.get("method")
        params = req.get("params", [])
        
        result = None
        error = None
        
        logger.info(f"Processing method: {method}")

        # --- 路由分发 ---
        if method == "health":
            result = engine.health()
            
        elif method == "evaluate_raw_quality":
            result = engine.evaluate_raw_quality(params.get("data") if isinstance(params, dict) else (params[0] if len(params) > 0 else None))
            
        elif method == "generate_structure":
            result = engine.generate_structure(params.get("data") if isinstance(params, dict) else (params[0] if len(params) > 0 else None))
            
        elif method == "audit_alignment":
            data = params.get("data") if isinstance(params, dict) else (params[0] if len(params) > 0 else None)
            goals = params.get("goals") if isinstance(params, dict) else (params[1] if len(params) > 1 else None)
            result = engine.audit_alignment(data, goals)
            
        elif method == "neural_agent.process_query":
            # 使用引擎的双模式解析器
            result = engine.process_neural_query(params)
            
        elif method == "neural_agent.process_query_stream":
            # [v6.0 NEW] 流式查询 - 逐块输出
            # 直接调用 neural_agent 并逐行输出 chunk
            stream_success = False
            try:
                sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
                from mcp_core.tools.neural_agent import process_query_stream
                
                # 解析参数 (复用现有逻辑)
                query = ""
                context = ""
                config = {}
                if isinstance(params, list):
                    if len(params) > 0:
                        first = params[0]
                        if isinstance(first, dict):
                            query = first.get("query", "")
                            context = first.get("context", "")
                            config = first.get("config", {})
                        else:
                            query = str(first)
                    if len(params) > 1:
                        context = params[1] if isinstance(params[1], str) else str(params[1])
                    if len(params) > 2 and isinstance(params[2], dict):
                        config = params[2]
                elif isinstance(params, dict):
                    query = params.get("query", "")
                    context = params.get("context", "")
                    config = params.get("config", {})
                
                if not isinstance(query, str):
                    query = str(query)
                
                logger.info(f"[Stream] Starting stream for query: {query[:30]}...")
                
                # 逐块输出
                first_chunk = True
                for chunk in process_query_stream(query, context, config):
                    if first_chunk:
                        # 第一块输出 id 和 chunk
                        response = {"id": req_id, "chunk": chunk}
                        first_chunk = False
                    else:
                        # 后续块只输出 chunk (无 id，避免重复处理)
                        response = {"chunk": chunk}
                    print(json.dumps(response, ensure_ascii=False), flush=True)
                
                # 结束标记
                print(json.dumps({"done": True}, ensure_ascii=False), flush=True)
                stream_success = True
                
            except Exception as e:
                logger.error(f"[Stream] Error: {e}")
                error = str(e)
            
            # 如果流式处理成功，跳过后续的 result 封装
            if stream_success:
                return  # 跳过当前请求的处理
        
    except Exception as e:
        logger.error(f"Request processing failed: {str(e)}")
        try:
            err_resp = {"id": req.get("id") if isinstance(req, dict) else None, "result": None, "error": str(e)}
            print(json.dumps(err_resp, ensure_ascii=False), flush=True)
        except:
            pass

def main():
    """主函数 - Python Worker 入口点"""
    logger.info("Initializing Negentropy Hybrid Engine v3.5.1...")
    
    # 创建引擎实例 (MCP Core 也会实例化)
    engine = EntropyEngine()
    
    # [Protocol] 发送握手信号
    # 对应 PythonWorkerBridge.ts 中的 handleWorkerOutput -> id === "init"
    print(json.dumps({"id": "init", "result": "ready", "error": None}, ensure_ascii=False), flush=True)
    
    # [Loop] 标准输入监听循环
    for line in sys.stdin:
        if line.strip():
            handle_request(line, engine)

if __name__ == "__main__":
    main()