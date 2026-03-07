"""
IAB Tools Module - 内部事务局工具集
版本: v6.8.1 (Agent Sovereignty)
职责: 内部事务局 (Internal Affairs Bureau) 的熵值监测与事件管理工具
宪法依据: §136 (强制审计公理), §141 (自动化重构安全公理), §351 (三阶段逆熵审计公理)
开发标准引用: DS-001 (通用输出编码规范), DS-006 (三阶段逆熵审计标准实现), DS-011 (MCP服务标准实现)
数学公理: 香农熵 $H(X) = -∑ p(x) log₂ p(x)$，熵增检测 $\Delta H = H_{current} - H_{baseline}$

更新日志:
- v6.8.1: 添加宪法引用、开发标准和MCP装饰器
- v4.2: 初始版本，包含文档熵值监测和事件列表功能

核心功能:
1. 文档熵值监测 (MonitorDocumentEntropyTool)
2. 熵值事件列表 (ListEntropyIncidentsTool)

技术依赖:
- 文件系统操作: 读取熵值账本和文档
- JSON解析: 基线数据和处理结果
- 正则表达式: 表格解析
"""


import sys
import io

import json
import logging
from typing import Any, Dict, List
from .base_tool import BaseTool, registry

logger = logging.getLogger("IAB-Tools")


class MonitorDocumentEntropyTool(BaseTool):
    """
    [IAB Constitutional Division] 监测宪法与架构文档的熵值变化。
    
    数学基础:
        1. 香农熵 H(X) = -∑ p(x) log₂ p(x) (信息复杂度)
        2. 压缩率 R = 压缩后大小 / 原始大小 (结构冗余度)
        3. 综合熵增 H_doc = w₁·ΔL + w₂·ΔS + w₃·ΔR
        
    功能:
        监测指定文件列表的熵值变化，与基线数据比较，生成报告。
    """
    
    @property
    def name(self) -> str:
        return "monitor_document_entropy"
    
    @property
    def description(self) -> str:
        return "监测宪法与架构文档的熵值变化"
    
    @property
    def input_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "files": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "需要监测的文件路径列表"
                },
                "baseline_json": {
                    "type": "string",
                    "description": "基线数据的 JSON 字符串（可选）",
                    "default": "{}"
                }
            },
            "required": ["files"]
        }
    
    @property
    def output_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "timestamp": {"type": "string"},
                "scan_id": {"type": "string"},
                "results": {"type": "object"},
                "alerts": {"type": "array"},
                "status": {"type": "string"}
            }
        }
    
    def execute(self, **kwargs) -> Any:
        files = kwargs["files"]
        baseline_json = kwargs.get("baseline_json", "{}")
        
        # 动态导入，避免循环依赖
        try:
            from services.internal_affairs import monitor_document_entropy
        except ImportError:
            try:
                from services.internal_affairs import monitor_document_entropy
            except ImportError as e:
                logger.error(f"Failed to import monitor_document_entropy: {e}")
                return {"error": f"Document entropy monitor unavailable: {str(e)}"}
        
        # 调用内部事务局的监测函数
        result = monitor_document_entropy(files, baseline_json)
        
        # 如果返回的是字符串（JSON），则解析为字典
        if isinstance(result, str):
            try:
                result = json.loads(result)
            except json.JSONDecodeError:
                # 如果不是JSON，直接返回原始字符串
                pass
        
        return result


class ListEntropyIncidentsTool(BaseTool):
    """
    [IAB Ledger] 列出熵值账本中的未解决事件。
    
    功能:
        读取熵值账本 (ENTROPY_LEDGER.md)，提取状态为 OPEN 的事件。
        用于元首查看当前高熵问题。
    """
    
    @property
    def name(self) -> str:
        return "list_entropy_incidents"
    
    @property
    def description(self) -> str:
        return "列出熵值账本中的未解决事件"
    
    @property
    def input_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "status_filter": {
                    "type": "string",
                    "description": "状态过滤器（OPEN, IN_PROGRESS, RESOLVED, ARCHIVED）",
                    "default": "OPEN"
                },
                "severity_filter": {
                    "type": "string",
                    "description": "严重程度过滤器（HIGH, MEDIUM, LOW）",
                    "default": ""
                },
                "limit": {
                    "type": "integer",
                    "description": "返回结果数量限制",
                    "default": 10
                }
            },
            "required": []
        }
    
    @property
    def output_schema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "incidents": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {"type": "string"},
                            "date": {"type": "string"},
                            "component": {"type": "string"},
                            "severity": {"type": "string"},
                            "description": {"type": "string"},
                            "status": {"type": "string"},
                            "last_seen": {"type": "string"}
                        }
                    }
                },
                "count": {"type": "integer"},
                "status": {"type": "string"}
            }
        }
    
    def execute(self, **kwargs) -> Any:
        status_filter = kwargs.get("status_filter", "OPEN")
        severity_filter = kwargs.get("severity_filter", "")
        limit = kwargs.get("limit", 10)
        
        try:
            # 尝试读取熵值账本文件
            from ..config import PROJECT_ROOT
            import os
            
            ledger_path = os.path.join(PROJECT_ROOT, "storage", "knowledge", "monitoring", "ENTROPY_LEDGER.md")
            
            if not os.path.exists(ledger_path):
                return {
                    "incidents": [],
                    "count": 0,
                    "status": "LEDGER_NOT_FOUND"
                }
            
            with open(ledger_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 解析账本表格
            incidents = self._parse_ledger_table(content, status_filter, severity_filter, limit)
            
            return {
                "incidents": incidents,
                "count": len(incidents),
                "status": "SUCCESS"
            }
            
        except Exception as e:
            logger.error(f"Failed to list entropy incidents: {e}")
            return {
                "incidents": [],
                "count": 0,
                "status": f"ERROR: {str(e)}"
            }
    
    def _parse_ledger_table(self, content: str, status_filter: str, severity_filter: str, limit: int) -> List[Dict]:
        """
        解析账本表格，提取事件数据。
        表格格式为Markdown表格。
        """
        incidents = []
        lines = content.split('\n')
        
        # 找到表格开始位置
        table_start = -1
        for i, line in enumerate(lines):
            if line.strip().startswith('| ID |'):
                table_start = i
                break
        
        if table_start == -1:
            return incidents
        
        # 跳过表头行和分隔行
        for i in range(table_start + 2, len(lines)):
            line = lines[i].strip()
            if not line.startswith('|'):
                continue
            
            # 解析表格行
            cells = [cell.strip() for cell in line.split('|') if cell.strip()]
            if len(cells) < 7:
                continue
            
            # 映射单元格
            incident_id = cells[0]
            date = cells[1]
            component = cells[2]
            severity = cells[3]
            description = cells[4]
            status = cells[5]
            last_seen = cells[6] if len(cells) > 6 else ""
            
            # 应用过滤器
            if status_filter and status != status_filter:
                continue
            if severity_filter and severity != severity_filter:
                continue
            
            incidents.append({
                "id": incident_id,
                "date": date,
                "component": component,
                "severity": severity,
                "description": description,
                "status": status,
                "last_seen": last_seen
            })
            
            if len(incidents) >= limit:
                break
        
        return incidents


# 注册工具
registry.register(MonitorDocumentEntropyTool())
registry.register(ListEntropyIncidentsTool())
