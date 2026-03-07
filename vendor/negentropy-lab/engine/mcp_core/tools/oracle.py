"""
监察部-逆熵实验室 Oracle Tools
版本: v1.1 (Unified)
职责: 数据预测与趋势分析 (统一入口)

import sys
import io

"""
import json
import logging
import numpy as np
from typing import List, Dict, Any, Optional
from ..registry import registry
from ..utils.sanitizer import negetropy_sanitizer

# 尝试导入服务层
try:
    from services.oracle import the_oracle
    HAS_SERVICE = True
except ImportError:
    HAS_SERVICE = False
    the_oracle = None

logger = logging.getLogger("Oracle-Tool")

def _simple_linear_regression(data_points: List[float]) -> Dict[str, Any]:
    """简单的线性回归实现 (y = alpha * x + beta)"""
    if not data_points or len(data_points) < 2:
        return {"alpha": 0.0, "beta": 0.0, "r_squared": 0.0}
    
    n = len(data_points)
    x = np.arange(n)
    y = np.array(data_points)
    x_mean, y_mean = np.mean(x), np.mean(y)
    
    numerator = np.sum((x - x_mean) * (y - y_mean))
    denominator = np.sum((x - x_mean) ** 2)
    alpha = numerator / denominator if denominator != 0 else 0.0
    beta = y_mean - alpha * x_mean
    
    y_pred = alpha * x + beta
    ss_res = np.sum((y - y_pred) ** 2)
    ss_tot = np.sum((y - y_mean) ** 2)
    r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 1.0
    
    return {
        "alpha": float(alpha),
        "beta": float(beta),
        "r_squared": float(r_squared),
        "next_prediction": float(alpha * n + beta)
    }

@registry.register()
@negetropy_sanitizer
def consult_oracle(
    query: str, 
    data_points: Optional[List[float]] = None, 
    mode: str = "trend"
) -> str:
    """
    [The Oracle] 统一预测接口。
    
    Args:
        query: 咨询意图描述
        data_points: (可选) 时间序列数据点，用于趋势分析
        mode: 咨询模式 
              - 'trend': 执行线性回归趋势分析 (默认)
              - 'prophecy': 生成系统级预言报告 (需服务层支持)
    """
    try:
        # 模式 1: 趋势分析 (Trend Analysis)
        if mode == "trend":
            if data_points is None: 
                data_points = []
            
            regression_result = _simple_linear_regression(data_points)
            response = {
                "mode": "trend",
                "query": query,
                "data_points_count": len(data_points),
                "regression": regression_result,
                "prediction": {
                    "next_value": regression_result["next_prediction"],
                    "trend": "increasing" if regression_result["alpha"] > 0 else "decreasing",
                    "confidence": regression_result["r_squared"]
                }
            }
            return json.dumps(response, indent=2, ensure_ascii=False)

        # 模式 2: 系统预言 (System Prophecy)
        elif mode == "prophecy":
            if not HAS_SERVICE or the_oracle is None:
                return json.dumps({"error": "Oracle service not initialized"}, ensure_ascii=False)
            
            prophecy = the_oracle.generate_prophecy()
            return json.dumps({
                "mode": "prophecy",
                "query": query,
                "prophecy": prophecy
            }, indent=2, ensure_ascii=False)

        else:
            return json.dumps({"error": f"Unknown mode: {mode}"})

    except Exception as e:
        logger.error(f"Oracle consultation error: {e}")
        return json.dumps({"error": str(e)}, ensure_ascii=False)

# [DEPRECATED] 向后兼容保留，但不再注册
def generate_prophecy() -> str:
    """[已弃用] 请使用 consult_oracle(query='system review', mode='prophecy')"""
    return consult_oracle("Legacy prophecy request", mode="prophecy")
