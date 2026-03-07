"""
逆熵实验室 - 监控指标定义
版本: v3.1.0
宪法约束: 基础设施宪法第2条 - 数据驱动
设计目标: 定义Prometheus监控指标，确保指标数量≤20个
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
from prometheus_client import Gauge, Counter, Histogram, Info

# ========== 系统健康度指标 ==========

# 系统健康度评分 (0-1之间)
SYSTEM_HEALTH_SCORE = Gauge(
    'system_health_score',
    '逆熵实验室系统健康度评分 ($H_s$)',
    ['layer']
)

# ========== 熵减趋势指标 ==========

# 熵减趋势指标: 记录最近一次计算的代码复杂度变化
NEGENTROPY_COMPLEXITY_TREND = Gauge(
    'negentropy_complexity_trend',
    '最近一次代码重构的熵减趋势 ($\Delta V(G) = V(G\') - V(G)$)，负值表示熵减',
    ['operation_type', 'strategy']
)

# 香农熵值指标
SHANNON_ENTROPY_VALUE = Gauge(
    'shannon_entropy_value',
    '计算的香农熵值 ($H(X) = -\sum p(x_i) \log_2 p(x_i)$)',
    ['content_type', 'language']
)

# ========== 宪法拦截率指标 ==========

# 宪法拦截计数器
CONSTITUTION_REJECTION_COUNTER = Counter(
    'constitution_rejection_total',
    '宪法拦截总次数 ($N_{rejected}$)',
    ['article', 'reason']
)

# 请求总数计数器
REQUEST_TOTAL_COUNTER = Counter(
    'request_total',
    '总请求数 ($N_{total}$)',
    ['endpoint', 'method', 'status']
)

# 宪法拦截率 (通过Recording Rules计算)
# $R_c = N_{rejected} / N_{total}$

# ========== 性能指标 ==========

# 请求延迟直方图 (秒)
REQUEST_DURATION_HISTOGRAM = Histogram(
    'request_duration_seconds',
    '请求处理时间直方图',
    ['endpoint', 'method'],
    buckets=(0.01, 0.05, 0.1, 0.5, 1, 5, 10)
)

# 向量存储查询延迟
VECTOR_STORE_QUERY_DURATION = Histogram(
    'vector_store_query_duration_seconds',
    '向量存储查询延迟直方图',
    ['operation', 'collection'],
    buckets=(0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1)
)

# ========== 资源指标 ==========

# 向量存储集合大小
VECTOR_COLLECTION_SIZE = Gauge(
    'vector_collection_size',
    '向量存储集合大小 (向量数量)',
    ['collection_name']
)

# 知识库文档数量
KNOWLEDGE_DOCUMENT_COUNT = Gauge(
    'knowledge_document_count',
    '知识库文档数量',
    ['project_id', 'document_type']
)

# ========== 系统信息指标 ==========

# 系统版本信息
SYSTEM_VERSION_INFO = Info(
    'negentropy_system_version',
    '逆熵实验室系统版本信息'
)

# 宪法版本信息
CONSTITUTION_VERSION_INFO = Info(
    'negentropy_constitution_version',
    '宪法版本信息'
)

# ========== 指标注册函数 ==========

def register_system_info(version: str = "v3.1.0"):
    """
    注册系统信息指标
    
    参数:
        version: 系统版本号
    """
    SYSTEM_VERSION_INFO.info({
        'version': version,
        'constitution_compliance': 'true',
        'architecture_layer': '1.6'
    })
    
    CONSTITUTION_VERSION_INFO.info({
        'constitution_version': 'v2.8.0',
        'infrastructure_article_1': 'true',
        'infrastructure_article_2': 'true'
    })

# ========== 指标更新工具函数 ==========

def update_entropy_trend(operation_type: str, strategy: str, delta_vg: float):
    """
    更新熵减趋势指标
    
    参数:
        operation_type: 操作类型 (如 'refactor', 'complexity_calculation')
        strategy: 策略类型 (如 'flatten', 'extract_method')
        delta_vg: 熵减趋势值 ($\Delta V(G) = V(G') - V(G)$)
    """
    NEGENTROPY_COMPLEXITY_TREND.labels(
        operation_type=operation_type,
        strategy=strategy
    ).set(delta_vg)

def increment_rejection_counter(article: str, reason: str):
    """
    增加宪法拦截计数器
    
    参数:
        article: 违反的宪法条款 (如 'article_8', 'article_12')
        reason: 拦截原因 (如 'snr_too_low', 'dimension_mismatch')
    """
    CONSTITUTION_REJECTION_COUNTER.labels(
        article=article,
        reason=reason
    ).inc()

def increment_request_counter(endpoint: str, method: str, status: str):
    """
    增加请求计数器
    
    参数:
        endpoint: 端点路径 (如 '/api/v1/complexity')
        method: HTTP方法 (如 'POST', 'GET')
        status: 状态分类 (如 'success', 'error', 'rejected')
    """
    REQUEST_TOTAL_COUNTER.labels(
        endpoint=endpoint,
        method=method,
        status=status
    ).inc()

def update_system_health_score(layer: str, score: float):
    """
    更新系统健康度评分
    
    参数:
        layer: 架构层 (如 '1.5', '1.6', '5')
        score: 健康度评分 (0-1之间)
    """
    SYSTEM_HEALTH_SCORE.labels(layer=layer).set(score)

def update_vector_collection_size(collection_name: str, size: int):
    """
    更新向量存储集合大小
    
    参数:
        collection_name: 集合名称
        size: 向量数量
    """
    VECTOR_COLLECTION_SIZE.labels(
        collection_name=collection_name
    ).set(size)

def update_knowledge_document_count(project_id: str, document_type: str, count: int):
    """
    更新知识库文档数量
    
    参数:
        project_id: 项目ID
        document_type: 文档类型 (如 'raw', 'vector', 'processed')
        count: 文档数量
    """
    KNOWLEDGE_DOCUMENT_COUNT.labels(
        project_id=project_id,
        document_type=document_type
    ).set(count)
