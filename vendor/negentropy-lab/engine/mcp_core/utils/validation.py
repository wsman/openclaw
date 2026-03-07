"""
监察部-逆熵实验室 MCP Core Validation
版本: v4.2
职责: 数据验证与宪法合规检查
"""


import sys
import io

import logging
from typing import List
from ..config import STRICT_DIMENSION

logger = logging.getLogger("Entropy-Validation")

def validate_dimensions(vector: List[float]) -> bool:
    """
    [Security] 维度安全检查
    依据: .clinerules - STRICTLY ENFORCE 4096 DIMENSIONS
    """
    if not vector:
        return False
        
    if len(vector) != STRICT_DIMENSION:
        logger.error(f"Dimensionality Breach: Expected {STRICT_DIMENSION}, got {len(vector)}")
        return False
    return True
