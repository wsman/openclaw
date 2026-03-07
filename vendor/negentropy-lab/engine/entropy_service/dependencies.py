"""
依赖注入模块：提供CodeArtisan实例和熔断器。
"""

import sys
import io
import os
from typing import Optional
from circuitbreaker import circuit

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

# 添加父目录到路径，以便导入code_artisan等模块
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from code_artisan import CodeArtisan

# 全局CodeArtisan实例
_artisan: Optional[CodeArtisan] = None

def get_artisan() -> CodeArtisan:
    """
    获取CodeArtisan单例实例。
    遵循宪法第十二条：确保熵减验证的数学严谨性。
    """
    global _artisan
    if _artisan is None:
        _artisan = CodeArtisan()
    return _artisan

# 熔断器配置
_FALLBACK_FUSE_COUNT = 3  # 3次失败后触发熔断
_FALLBACK_TIMEOUT = 30    # 30秒后尝试恢复

@circuit(failure_threshold=_FALLBACK_FUSE_COUNT, recovery_timeout=_FALLBACK_TIMEOUT)
def get_circuit_breaker():
    """
    熔断器依赖：用于保护对熵计算服务的调用。
    当连续失败达到阈值时，熔断器打开，避免级联故障。
    """
    # 这是一个空函数，仅用于熔断器装饰器的上下文
    pass


# 知识图谱服务依赖
from entropy_service.services.knowledge_graph import get_knowledge_graph_service, KnowledgeGraphService

# 全局知识图谱服务实例
_knowledge_graph_service: Optional[KnowledgeGraphService] = None

def get_knowledge_graph_service_dep() -> KnowledgeGraphService:
    """
    获取知识图谱服务单例实例。
    用于构建知识图谱，提供节点和连接数据。
    """
    global _knowledge_graph_service
    if _knowledge_graph_service is None:
        _knowledge_graph_service = get_knowledge_graph_service()
    return _knowledge_graph_service
