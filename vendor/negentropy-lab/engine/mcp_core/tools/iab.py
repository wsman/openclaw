"""
监察部-逆熵实验室 IAB Tools
版本: v4.2
职责: 内部事务局专用工具 (文档熵值监测)
"""

import sys
import io

import json
import logging
import os
import zlib
import math
from typing import List, Dict, Optional
from ..registry import registry
from ..utils.sanitizer import negetropy_sanitizer
from ..config import PROJECT_ROOT

logger = logging.getLogger("Entropy-IAB-Tools")

@registry.register()
@negetropy_sanitizer
def monitor_document_entropy(files: List[str], baseline_json: str = "{}") -> str:
    """
    [IAB Constitutional Division] 监测宪法与架构文档的熵值变化。
    
    数学基础:
        1. 香农熵 H(X) = -∑ p(x) log₂ p(x)
        2. 压缩率 R = 压缩后大小 / 原始大小
    """
    report = {"timestamp": "now", "files": {}, "alerts": []}
    
    for rel_path in files:
        file_path = os.path.join(PROJECT_ROOT, rel_path)
        if not os.path.exists(file_path):
            report["files"][rel_path] = {"status": "MISSING"}
            continue
            
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            # 1. 计算香农熵
            prob = [float(content.count(c)) / len(content) for c in dict.fromkeys(list(content))]
            shannon = -sum(p * math.log2(p) for p in prob)
            
            # 2. 计算压缩率 (GZIP)
            compressed = zlib.compress(content.encode('utf-8'))
            compression_ratio = len(compressed) / len(content)
            
            # 3. 判定
            status = "STABLE"
            if shannon > 6.0: status = "HIGH_ENTROPY"
            if shannon > 7.5: status = "CRITICAL_ENTROPY"
            
            report["files"][rel_path] = {
                "size": len(content),
                "shannon_entropy": round(shannon, 4),
                "compression_ratio": round(compression_ratio, 4),
                "status": status
            }
            
            if status != "STABLE":
                report["alerts"].append(f"{rel_path}: {status} (H={shannon:.2f})")
                
        except Exception as e:
            logger.error(f"Error analyzing {rel_path}: {e}")
            report["files"][rel_path] = {"error": str(e)}
    
    return json.dumps(report, indent=2, ensure_ascii=False)

# [DEPRECATED v4.3.2] Merged into monitor_document_entropy
# @registry.register() 
@negetropy_sanitizer
def audit_content(content: str, context_goal: Optional[str] = None) -> str:
    """
    [IAB 2.0] 执行三阶段逆熵审计流水线 (monitor_document_entropy 的别名)。
    
    这是 monitor_document_entropy 的向后兼容别名，用于保持符号一致性。
    根据宪法 §101 (代码即形式证明)，确保架构定义与实际实现的符号统一。
    
    Args:
        content: 待审计的文本内容
        context_goal: (可选) 用于对齐审计的战略目标文本
    """
    import json
    import math
    import zlib
    
    # 模拟 audit_content 的原始逻辑，但使用 monitor_document_entropy 的语义
    # 实际上，monitor_document_entropy 接受文件列表，而 audit_content 接受单个文本
    # 因此我们需要适配。创建一个临时文件路径用于分析。
    # 为了简化，我们直接计算单个文本的熵值。
    
    try:
        # 1. 计算香农熵
        prob = [float(content.count(c)) / len(content) for c in dict.fromkeys(list(content))]
        shannon = -sum(p * math.log2(p) for p in prob) if prob else 0.0
        
        # 2. 计算压缩率 (GZIP)
        compressed = zlib.compress(content.encode('utf-8'))
        compression_ratio = len(compressed) / len(content) if content else 1.0
        
        # 3. 判定
        status = "STABLE"
        if shannon > 6.0: status = "HIGH_ENTROPY"
        if shannon > 7.5: status = "CRITICAL_ENTROPY"
        
        report = {
            "verdict": status,
            "scores": {
                "shannon_entropy": round(shannon, 4),
                "compression_ratio": round(compression_ratio, 4)
            },
            "details": {
                "content_preview": content[:100] + "..." if len(content) > 100 else content,
                "context_goal": context_goal
            }
        }
        
        return json.dumps(report, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Audit content error: {e}")
        return json.dumps({"error": str(e)})

@registry.register()
@negetropy_sanitizer
def record_daily_metric(
    date: str, 
    tokens: int, 
    entropy_delta: float, 
    system_entropy: float, 
    events: List[str]
) -> str:
    """
    [The Ticker] 记录每日量化指标。
    """
    try:
        ledger_path = os.path.join(PROJECT_ROOT, "memory_bank/monitoring/daily_quant_metrics.json")
        
        # 读取现有数据
        if os.path.exists(ledger_path):
            with open(ledger_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        else:
            data = {"history": []}
            
        # 检查是否已存在当日数据 (覆盖更新)
        history = data.get("history", [])
        existing_index = next((i for i, item in enumerate(history) if item["date"] == date), -1)
        
        new_entry = {
            "date": date,
            "tokens_consumed": tokens,
            "entropy_delta": entropy_delta,
            "system_entropy": system_entropy,
            "events": events
        }
        
        if existing_index != -1:
            history[existing_index] = new_entry
        else:
            history.append(new_entry)
            
        # 排序
        history.sort(key=lambda x: x["date"])
        data["history"] = history
        
        # 原子写入
        # (简化处理，生产环境应使用 AtomicFileHandler)
        with open(ledger_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
        return json.dumps({"status": "RECORDED", "entry": new_entry}, ensure_ascii=False)
        
    except Exception as e:
        logger.error(f"Failed to record metric: {e}")
        return json.dumps({"error": str(e)})
