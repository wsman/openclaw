"""
数据模型定义，与gRPC协议对齐。
遵循委员会决议：数据模型必须严格对齐.proto定义的结构。
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

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

class Status(str, Enum):
    """重构状态枚举"""
    SUCCESS = "SUCCESS"
    NO_CHANGE = "NO_CHANGE"
    BLOCKED = "BLOCKED"
    ERROR = "ERROR"

class Confidence(str, Enum):
    """计算置信度枚举"""
    HIGH = "HIGH"
    LOW = "LOW"
    UNKNOWN = "UNKNOWN"

class FunctionComplexity(BaseModel):
    """函数复杂度详情"""
    name: str = Field(..., description="函数名")
    complexity: float = Field(..., description="圈复杂度")
    rank: str = Field(..., description="复杂度等级 (A-F)")
    line: int = Field(..., description="行号")

class ComplexityRequest(BaseModel):
    """复杂度计算请求"""
    code: Optional[str] = Field(None, description="代码内容")
    file_path: Optional[str] = Field(None, description="文件路径")
    language: str = Field("python", description="编程语言")

class ComplexityResponse(BaseModel):
    """复杂度计算响应"""
    total_complexity: float = Field(..., description="总圈复杂度")
    average_complexity: float = Field(..., description="平均圈复杂度")
    confidence: Confidence = Field(..., description="计算置信度")
    method: str = Field(..., description="计算方法")
    proof_of_reduction: str = Field(
        "",
        description="熵减证明字段，包含 $V(G') \\leq V(G)$ 等数学证明"
    )
    functions: List[FunctionComplexity] = Field(default_factory=list, description="函数详情")

class RefactorRequest(BaseModel):
    """重构请求"""
    code: str = Field(..., description="代码内容")
    language: str = Field("python", description="编程语言")
    strategy: str = Field("flatten", description="重构策略")

class RefactorResponse(BaseModel):
    """重构响应"""
    status: Status = Field(..., description="重构状态")
    entropy_reduced: bool = Field(..., description="熵是否减少")
    original_complexity: float = Field(..., description="原始复杂度")
    refactored_complexity: float = Field(..., description="重构后复杂度")
    mathematical_proof: str = Field(
        "",
        description="数学证明：$V(G') \\leq V(G)$ 等"
    )
    refactored_code: Optional[str] = Field(None, description="重构后的代码")
    message: Optional[str] = Field(None, description="附加信息")

# 错误响应模型
class ErrorResponse(BaseModel):
    """错误响应"""
    error: str = Field(..., description="错误描述")
    trace_id: Optional[str] = Field(None, description="追踪ID")
    detail: Optional[str] = Field(None, description="详细错误信息")


# 知识图谱模型
class GraphNode(BaseModel):
    """知识图谱节点"""
    id: str = Field(..., description="节点唯一ID")
    label: str = Field(..., description="节点显示标签")
    type: str = Field("chunk", description="节点类型")
    cluster_id: int = Field(-1, description="聚类ID")
    tags: List[str] = Field(default_factory=list, description="标签集合")
    metadata: Optional[dict] = Field(default_factory=dict, description="元数据")


class GraphLink(BaseModel):
    """知识图谱连接"""
    source: str = Field(..., description="源节点ID")
    target: str = Field(..., description="目标节点ID")
    weight: float = Field(..., description="连接权重 (0-1)")
    type: str = Field("similarity", description="连接类型")


class GraphResponse(BaseModel):
    """知识图谱响应"""
    project_id: str = Field(..., description="项目ID")
    timestamp: float = Field(..., description="生成时间戳")
    node_count: int = Field(..., description="节点数量")
    link_count: int = Field(..., description="连接数量")
    clusters: int = Field(..., description="聚类数量")
    nodes: List[GraphNode] = Field(..., description="节点列表")
    links: List[GraphLink] = Field(..., description="连接列表")
