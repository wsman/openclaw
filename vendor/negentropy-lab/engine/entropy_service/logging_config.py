"""
日志配置模块，支持分布式追踪。
"""

import sys
import io
import logging
import uuid
from typing import Optional

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

def generate_trace_id() -> str:
    """生成追踪ID"""
    return str(uuid.uuid4())

def setup_logging(level: int = logging.INFO) -> logging.Logger:
    """
    设置日志配置，返回配置好的logger实例。
    """
    # 创建logger
    logger = logging.getLogger("entropy_service")
    logger.setLevel(level)
    
    # 避免重复添加handler
    if not logger.handlers:
        # 创建控制台handler
        console_handler = logging.StreamHandler()
        console_handler.setLevel(level)
        
        # 创建格式化器
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - [%(trace_id)s] - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        console_handler.setFormatter(formatter)
        
        # 添加handler到logger
        logger.addHandler(console_handler)
    
    # 添加一个过滤器，用于注入trace_id
    class TraceFilter(logging.Filter):
        def filter(self, record):
            if not hasattr(record, 'trace_id'):
                record.trace_id = 'N/A'
            return True
    
    # 确保只有一个TraceFilter实例
    if not any(isinstance(f, TraceFilter) for f in logger.filters):
        logger.addFilter(TraceFilter())
    
    return logger
