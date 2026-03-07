"""
Entropy Tools Module - 逆熵审计工具集
版本: v6.8.1 (Agent Sovereignty)
职责: 提供逆熵实验室核心熵值计算与审计功能
宪法依据: §136 (强制审计公理), §141 (自动化重构安全公理), §351 (三阶段逆熵审计公理)
开发标准引用: DS-001 (通用输出编码规范), DS-006 (三阶段逆熵审计标准实现), DS-011 (MCP服务标准实现)
数学公理: 香农熵 $H(X) = -∑ p(x) log₂ p(x)$，三阶段逆熵指数 $N_{idx} = w_1·S_{SNR} + w_2·S_{struct} + w_3·S_{align}$

更新日志:
- v6.8.1: 添加宪法引用、开发标准和MCP装饰器
- v4.2: 迁移至BaseTool架构，包含三阶段审计和香农熵计算

核心功能:
1. 三阶段逆熵审计 (AuditContentTool)
2. 香农熵计算 (CalculateShannonEntropyTool)

技术依赖:
- 逆熵引擎: 提供SNR、结构、对齐分析
- 依赖注入: container.engine实例
- 消毒装饰器: negetropy_sanitizer
"""


import sys
import io

import json
import logging
from typing import Any, Dict, Optional
from .base_tool import BaseTool, tool, registry
from ..dependencies import container
from ..utils.sanitizer import negetropy_sanitizer

logger = logging.getLogger("Entropy-Tools")


class AuditContentTool(BaseTool):
    """
    [IAP 2.0] 执行三阶段逆熵审计流水线。
    
    流水线步骤:
    1. 原始完整性 (SNR) - 评估信噪比
    2. 结构熵 (Structure) - 评估信息有序度
    3. 目标对齐 (Alignment) - (如果提供了 context_goal) 评估一致性

    标准遵循:
    - DS-006: 三阶段逆熵审计标准实现

    对应技术法条款: §351
    """
    
    @property
    def name(self) -> str:
        return "audit_content"
    
    @property
    def description(self) -> str:
        return "执行三阶段逆熵审计流水线"
    
    @property
    def input_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "content": {
                    "type": "string",
                    "description": "待审计的文本内容"
                },
                "context_goal": {
                    "type": "string",
                    "description": "用于对齐审计的战略目标文本"
                }
            },
            "required": ["content"]
        }
    
    @property
    def output_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "verdict": {"type": "string"},
                "scores": {"type": "object"},
                "details": {"type": "array"},
                "negentropy_index": {"type": "number"}
            }
        }
    
    @negetropy_sanitizer
    def execute(self, **kwargs) -> Any:
        content = kwargs["content"]
        context_goal = kwargs.get("context_goal")
        
        logger.info("Starting audit pipeline...")
        report = {
            "verdict": "UNKNOWN",
            "scores": {},
            "details": [],
            "negentropy_index": 0
        }
        
        try:
            # 获取引擎实例
            engine = container.engine
            
            # Stage 1: 原始完整性 (SNR)
            quality_res = engine.evaluate_raw_quality(content)
            snr_score = quality_res.get('score', 0)
            snr_db = quality_res.get('snr_db', 0)
            report['scores']['raw_integrity'] = snr_score
            report['scores']['snr_db'] = snr_db
            report['details'].append({"stage": "SNR", "data": quality_res})
            
            # 阈值校准：从 60 降至 1.0 (拒绝线)
            if snr_score < 1.0:
                report['verdict'] = "REJECTED_NOISE"
                return report

            # Stage 2: 结构熵
            struct_res = engine.generate_structure(content)
            struct_score = struct_res.get('score', 0)
            entropy_value = struct_res.get('entropy_value', 0.0)
            report['scores']['primary_structure'] = struct_score
            report['scores']['shannon_entropy'] = entropy_value
            report['details'].append({"stage": "Structure", "data": struct_res})
            
            if struct_score < 50:
                report['verdict'] = "REJECTED_CHAOS"
                return report

            # Stage 3: 目标对齐 (可选)
            alignment_score = 0
            if context_goal:
                # 将 context_goal 视为目标列表或单一目标字符串
                goals = [context_goal] if isinstance(context_goal, str) else context_goal
                align_res = engine.audit_alignment(content, goals)
                alignment_score = align_res.get('score', 0)
                similarity = align_res.get('similarity', 0)
                report['scores']['goal_alignment'] = alignment_score
                report['scores']['similarity'] = similarity
                report['details'].append({"stage": "Alignment", "data": align_res})
            
            # 计算综合逆熵指数
            normalized_snr = min(snr_score * 20, 100)
            
            if context_goal:
                n_idx = (normalized_snr * 0.25 + struct_score * 0.25 + alignment_score * 0.5)
            else:
                n_idx = (normalized_snr * 0.5 + struct_score * 0.5)
                
            report['negentropy_index'] = n_idx
            report['verdict'] = "ORDERED" if n_idx >= 60 else "INCONCLUSIVE"
            
            return report
            
        except Exception as e:
            logger.error(f"Audit pipeline failed: {e}")
            return {"error": str(e), "stage": "pipeline_execution"}
    
    def sanitize_output(self, raw_output: Any) -> Any:
        # 基类已经应用了 negetropy_sanitizer 装饰器，这里直接返回
        return raw_output


class CalculateShannonEntropyTool(BaseTool):
    """
    [Math] 计算文本的香农熵 (Shannon Entropy)。
    单位: bits.
    """
    
    @property
    def name(self) -> str:
        return "calculate_shannon_entropy"
    
    @property
    def description(self) -> str:
        return "计算文本的香农熵 (Shannon Entropy)"
    
    @property
    def input_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "待计算熵值的文本"
                }
            },
            "required": ["text"]
        }
    
    @property
    def output_schema(self) -> Dict[str, Any]:
        return {
            "type": "number",
            "description": "香农熵值（单位：bits）"
        }
    
    def execute(self, **kwargs) -> Any:
        text = kwargs["text"]
        try:
            engine = container.engine
            struct_res = engine.generate_structure(text)
            entropy_value = struct_res.get('entropy_value', 0.0)
            return round(entropy_value, 4)
        except Exception as e:
            logger.error(f"Failed to calculate entropy: {e}")
            return 0.0


# 使用装饰器注册函数的示例（可选）
@tool(
    name="test_tool",
    description="测试工具",
    input_schema={
        "type": "object",
        "properties": {
            "message": {"type": "string"}
        },
        "required": ["message"]
    },
    output_schema={
        "type": "object",
        "properties": {
            "echo": {"type": "string"}
        }
    }
)
def test_tool(message: str) -> Dict[str, str]:
    """简单的测试工具"""
    return {"echo": message}


# 注册基于类的工具
registry.register(AuditContentTool())
registry.register(CalculateShannonEntropyTool())
