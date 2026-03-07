"""
监察部-逆熵实验室 MCP Resources Tools
版本: v5.5.0 (Dual-Store Isomorphism)
职责: 提供开发标准库资源访问
宪法依据: §130 (MCP 微内核神圣公理), §131 (MCP 绝对冷启动原则)
开发标准引用: DS-011 (MCP服务标准实现), DS-007 (架构同构性验证标准实现)
数学公理: 资源映射定理 $R_{tool} = f(P_{standards})$

更新日志:
- v5.5.0: 初始版本，提供开发标准库资源读取功能
"""

import sys
import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Any, Optional

from ..registry import registry
from ..dependencies import container
from ..utils.sanitizer import negetropy_sanitizer
from ..config import PROJECT_ROOT

logger = logging.getLogger("Entropy-Resources")

# 开发标准库路径 (v6.3.0 - 合并至 03_protocols)
STANDARDS_ROOT = PROJECT_ROOT / "storage" / "memory_bank" / "03_protocols"
STANDARDS_DIR = STANDARDS_ROOT / "standards"

def _get_standards_index() -> Dict[str, Any]:
    """读取开发标准库索引文件"""
    index_path = STANDARDS_ROOT / "DEVELOPMENT_STANDARDS.md"
    if not index_path.exists():
        return {"error": "Development standards index not found"}
    
    try:
        with open(index_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 解析索引内容
        standards = {}
        current_section = ""
        
        for line in content.split('\n'):
            line = line.strip()
            
            # 检测章节标题
            if line.startswith('### '):
                current_section = line[4:].strip()
                standards[current_section] = []
            # 检测标准条目
            elif line.startswith('* [') and '](./standards/' in line:
                # 提取标准信息
                import re
                match = re.match(r'\* \[([^\]]+)\]\(\./([^)]+)\)\s*(?:\(对应([^)]+)\))?', line)
                if match:
                    name = match.group(1)
                    path = match.group(2)
                    reference = match.group(3) if match.group(3) else ""
                    
                    # 构建标准信息
                    std_info = {
                        "name": name,
                        "path": path,
                        "reference": reference,
                        "section": current_section
                    }
                    
                    if current_section and current_section in standards:
                        standards[current_section].append(std_info)
                    else:
                        if "其他标准" not in standards:
                            standards["其他标准"] = []
                        standards["其他标准"].append(std_info)
        
        return {
            "status": "success",
            "index_path": str(index_path),
            "standards_root": str(STANDARDS_ROOT),
            "sections": standards
        }
    except Exception as e:
        logger.error(f"Failed to parse standards index: {e}")
        return {"error": f"Index parsing failed: {str(e)}"}

def _get_standard_content(standard_path: str) -> Dict[str, Any]:
    """读取单个标准文件内容"""
    # 标准化路径
    if not standard_path.startswith("standards/"):
        standard_path = f"standards/{standard_path}"
    
    file_path = STANDARDS_ROOT / standard_path
    
    if not file_path.exists():
        return {"error": f"Standard file not found: {standard_path}"}
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 提取元数据
        metadata = {}
        lines = content.split('\n')
        
        # 解析头部元数据
        if len(lines) > 0 and lines[0].startswith('# '):
            title_line = lines[0][2:].strip()
            metadata["title"] = title_line
        
        # 查找版本信息
        for line in lines:
            if line.startswith('**版本**:'):
                metadata["version"] = line.split(':', 1)[1].strip()
            elif line.startswith('**对应技术法**:'):
                metadata["technical_law"] = line.split(':', 1)[1].strip()
            elif line.startswith('**宪法依据**:'):
                metadata["constitutional_basis"] = line.split(':', 1)[1].strip()
        
        return {
            "status": "success",
            "path": standard_path,
            "file_path": str(file_path),
            "metadata": metadata,
            "content": content,
            "size_bytes": len(content)
        }
    except Exception as e:
        logger.error(f"Failed to read standard file {standard_path}: {e}")
        return {"error": f"File read failed: {str(e)}"}

def _list_all_standards() -> List[Dict[str, Any]]:
    """列出所有标准文件"""
    standards = []
    
    if not STANDARDS_DIR.exists():
        return standards
    
    for file_path in STANDARDS_DIR.glob("*.md"):
        rel_path = file_path.relative_to(STANDARDS_ROOT)
        
        # 读取文件头信息
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                first_lines = [f.readline().strip() for _ in range(10)]
            
            # 提取基本信息
            name = file_path.stem
            title = ""
            version = ""
            
            for line in first_lines:
                if line.startswith('# '):
                    title = line[2:].strip()
                elif line.startswith('**版本**:'):
                    version = line.split(':', 1)[1].strip()
            
            standards.append({
                "id": name,
                "title": title if title else name,
                "path": str(rel_path),
                "version": version,
                "file_size": file_path.stat().st_size
            })
        except Exception as e:
            logger.error(f"Failed to read standard info {file_path}: {e}")
    
    return standards

@registry.register()
@negetropy_sanitizer
def get_context_resources(resource_type: str = "all", limit: int = 50) -> str:
    """
    [The Archivist v5.5.0] 提供开发标准库资源访问。
    
    输入参数:
        resource_type: 资源类型 ("all", "index", "standards", "sections")
        limit: 返回结果数量限制
        
    返回: JSON字符串，包含请求的资源信息
    
    标准遵循:
    - §130 (MCP微内核神圣公理): 确保工具注册的确定性
    - §131 (MCP绝对冷启动原则): 路径计算的确定性
    - DS-011 (MCP服务标准实现): 输出消毒和协议完整性
    
    对应技术法条款: §331, §332
    """
    try:
        logger.info(f"获取开发标准库资源: type={resource_type}, limit={limit}")
        
        # 根据资源类型返回相应数据
        if resource_type == "index":
            result = _get_standards_index()
        elif resource_type == "standards":
            standards = _list_all_standards()
            result = {
                "status": "success",
                "count": len(standards),
                "standards": standards[:limit] if limit > 0 else standards
            }
        elif resource_type == "sections":
            index_data = _get_standards_index()
            if "error" in index_data:
                result = index_data
            else:
                sections = index_data.get("sections", {})
                result = {
                    "status": "success",
                    "sections": list(sections.keys()),
                    "section_details": {k: len(v) for k, v in sections.items()}
                }
        else:  # "all" 或默认
            # 获取完整信息
            index_data = _get_standards_index()
            standards = _list_all_standards()
            
            if "error" in index_data:
                result = index_data
            else:
                result = {
                    "status": "success",
                    "system_info": {
                        "project_root": str(PROJECT_ROOT),
                        "standards_root": str(STANDARDS_ROOT),
                        "constitutional_version": "v5.5.0 (Dual-Store Isomorphism)"
                    },
                    "index": index_data,
                    "standards_summary": {
                        "total_count": len(standards),
                        "standards": standards[:10] if limit > 0 else standards[:5]
                    }
                }
        
        # 添加宪法合规信息
        if "error" not in result:
            result["constitutional_compliance"] = {
                "§130": "MCP微内核神圣公理",
                "§131": "MCP绝对冷启动原则",
                "§331": "工具注册规范",
                "DS-011": "MCP服务标准实现"
            }
        
        return json.dumps(result, ensure_ascii=False, indent=2)
        
    except Exception as e:
        logger.error(f"获取资源失败: {e}")
        return json.dumps({
            "error": str(e),
            "resource_type": resource_type,
            "suggestion": "检查开发标准库路径配置"
        }, ensure_ascii=False)

@registry.register()
@negetropy_sanitizer
def get_standard_documentation(standard_id: str) -> str:
    """
    [The Archivist] 获取特定标准的详细文档。
    
    输入参数:
        standard_id: 标准标识符 (如 "DS-001", "DS-022_Colyseus_集成标准实现")
        
    返回: JSON字符串，包含标准文档内容
    """
    try:
        logger.info(f"获取标准文档: {standard_id}")
        
        # 构建可能的文件路径
        possible_paths = [
            f"standards/{standard_id}.md",
            f"standards/DS-{standard_id}.md" if not standard_id.startswith("DS-") else f"standards/{standard_id}.md"
        ]
        
        # 尝试每个路径
        content_result = None
        for path in possible_paths:
            result = _get_standard_content(path)
            if "error" not in result:
                content_result = result
                break
        
        if not content_result:
            # 尝试通过名称查找
            all_standards = _list_all_standards()
            matching_std = None
            for std in all_standards:
                if standard_id in std["id"] or standard_id in std["title"]:
                    matching_std = std
                    break
            
            if matching_std:
                content_result = _get_standard_content(matching_std["path"])
            else:
                return json.dumps({
                    "error": f"标准未找到: {standard_id}",
                    "suggestion": "使用 get_context_resources('standards') 查看可用标准列表"
                }, ensure_ascii=False)
        
        # 添加相关元数据
        if "error" not in content_result:
            # 获取索引信息以查找相关标准
            index_data = _get_standards_index()
            if "error" not in index_data:
                # 查找此标准在哪个章节
                std_path = content_result.get("path", "")
                for section, items in index_data.get("sections", {}).items():
                    for item in items:
                        if item.get("path", "") == std_path:
                            content_result["section"] = section
                            content_result["reference"] = item.get("reference", "")
                            break
        
        return json.dumps(content_result, ensure_ascii=False, indent=2)
        
    except Exception as e:
        logger.error(f"获取标准文档失败: {e}")
        return json.dumps({
            "error": str(e),
            "standard_id": standard_id
        }, ensure_ascii=False)

@registry.register()
@negetropy_sanitizer
def search_standards(query: str, limit: int = 10) -> str:
    """
    [The Archivist] 搜索开发标准库。
    
    输入参数:
        query: 搜索查询字符串
        limit: 返回结果数量限制
        
    返回: JSON字符串，包含匹配的标准
    """
    try:
        logger.info(f"搜索标准库: query={query}, limit={limit}")
        
        all_standards = _list_all_standards()
        matches = []
        
        for std in all_standards:
            # 简单文本匹配 (在实际实现中可以使用更复杂的搜索)
            search_text = f"{std['id']} {std['title']} {std['path']}".lower()
            if query.lower() in search_text:
                matches.append(std)
            
            if len(matches) >= limit:
                break
        
        # 读取匹配标准的简要内容
        for match in matches:
            content_result = _get_standard_content(match["path"])
            if "error" not in content_result:
                # 提取前200个字符作为摘要
                content = content_result.get("content", "")
                match["summary"] = content[:200] + "..." if len(content) > 200 else content
        
        return json.dumps({
            "status": "success",
            "query": query,
            "matches_count": len(matches),
            "matches": matches
        }, ensure_ascii=False, indent=2)
        
    except Exception as e:
        logger.error(f"搜索标准库失败: {e}")
        return json.dumps({
            "error": str(e),
            "query": query
        }, ensure_ascii=False)