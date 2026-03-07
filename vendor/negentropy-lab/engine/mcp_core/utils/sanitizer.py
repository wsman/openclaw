"""
监察部-逆熵实验室 MCP Core Sanitizer
版本: v4.2
职责: 输出数据消毒与逆熵处理
"""


import sys
import io

import json
import logging
import functools
from typing import Any
import numpy as np

# 尝试导入可选依赖
try:
    from pydantic import BaseModel
    HAS_PYDANTIC = True
except ImportError:
    HAS_PYDANTIC = False

try:
    import dataclasses
    HAS_DATACLASSES = True
except ImportError:
    HAS_DATACLASSES = False

logger = logging.getLogger("Entropy-Sanitizer")

def truncate_vectors(data: Any) -> Any:
    """
    递归遍历 JSON 对象，将高维向量折叠为元数据字符串。
    阈值设为 16。
    """
    if isinstance(data, np.ndarray):
        return truncate_vectors(data.tolist())
    
    if HAS_PYDANTIC and isinstance(data, BaseModel):
        return truncate_vectors(data.model_dump())
    
    if HAS_DATACLASSES and dataclasses.is_dataclass(data) and not isinstance(data, type):
        return truncate_vectors(dataclasses.asdict(data))
    
    if isinstance(data, dict):
        return {k: truncate_vectors(v) for k, v in data.items()}
    
    elif isinstance(data, (list, tuple, set)):
        original_type = type(data)
        items = list(data)
        
        if len(items) > 16 and all(isinstance(x, (int, float)) for x in items):
            preview = f"[{items[0]:.4f}, {items[1]:.4f}, ...]"
            return f"Vector<{len(items)}> {preview} (Truncated for Negentropy)"
        
        processed = [truncate_vectors(item) for item in items]
        
        if original_type == tuple:
            return tuple(processed)
        elif original_type == set:
            return set(processed)
        else:
            return processed
    else:
        return data

def negetropy_sanitizer(func):
    """
    [The Artisan] 逆熵消毒装饰器
    """
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        result = func(*args, **kwargs)
        if isinstance(result, str):
            try:
                data = json.loads(result)
                processed = truncate_vectors(data)
                return json.dumps(processed, ensure_ascii=False)
            except (json.JSONDecodeError, TypeError):
                return result
        else:
            return truncate_vectors(result)
    return wrapper
