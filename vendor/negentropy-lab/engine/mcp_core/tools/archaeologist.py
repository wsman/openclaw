"""
监察部-逆熵实验室 Archaeologist Tools
版本: v1.0
职责: 遗留代码分析与消化

import sys
import io

"""
import json
import logging
import os
from typing import Optional
from ..registry import registry
from ..utils.sanitizer import negetropy_sanitizer

# 尝试导入服务层
try:
    from services.archaeologist import TheArchaeologist
    HAS_SERVICE = True
except ImportError:
    HAS_SERVICE = False
    # 降级处理：如果服务层不存在，创建一个简单的模拟类
    class _FakeArchaeologist:
        def digest(self, file_path: str):
            return {"error": "Archaeologist service not initialized"}
    # 为了类型兼容，将模拟类赋值给同一个变量名
    TheArchaeologist = _FakeArchaeologist

logger = logging.getLogger("Archaeologist-Tool")

@registry.register()
@negetropy_sanitizer
def digest_legacy_code(file_path: str) -> str:
    """
    [The Archaeologist] 分析遗留代码并提取纯逻辑。
    
    Args:
        file_path: 遗留代码文件的路径 (相对于项目根目录或绝对路径)
    
    Returns:
        JSON字符串，包含分析结果
    """
    if not HAS_SERVICE:
        return json.dumps({"error": "Archaeologist service not initialized"}, ensure_ascii=False)
    
    try:
        # 确保文件路径是绝对路径
        if not os.path.isabs(file_path):
            # 尝试相对于项目根目录
            project_root = os.path.join(os.path.dirname(__file__), "../../../..")
            abs_path = os.path.abspath(os.path.join(project_root, file_path))
        else:
            abs_path = file_path
        
        # 检查文件是否存在
        if not os.path.exists(abs_path):
            return json.dumps({"error": f"File not found: {abs_path}"}, ensure_ascii=False)
        
        # 调用服务层
        service = TheArchaeologist()
        result = service.digest(abs_path)
        
        return json.dumps(result, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Digestion error: {e}")
        return json.dumps({"error": str(e)}, ensure_ascii=False)
