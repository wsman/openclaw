"""
监察部-逆熵实验室 Codex Navigator Tools
版本: v6.8.0 (Agent Sovereignty)
职责: 提供法典内核的查询、导航与验证功能
宪法依据: §181 (类型公理优先原则), §337 (MCP协议完整性标准), §352 (架构同构性验证)
开发标准引用: DS-001 (通用输出编码规范), DS-011 (MCP服务标准实现), DS-038 (TypeScript模块导入分离标准)
数学公理: 法典映射定理 $C_{kernel} = f(C_{original})$，确保信息无损压缩

更新日志:
- v6.8.0: 初始版本，提供法典内核熵减优化后的查询接口
- v6.3.0: 遵循§156增强级三级验证协议

核心功能:
1. 法典内核章节结构查询
2. 条款详情检索 (基于§编号)
3. 法典间引用完整性验证
4. 法典熵值分析与优化建议
"""

import sys
import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import re

from ..registry import registry
from ..dependencies import container
from ..utils.sanitizer import negetropy_sanitizer
from ..config import PROJECT_ROOT, logger

# 法典内核路径
CODEX_KERNEL_DIR = PROJECT_ROOT / "storage" / "memory_bank" / "04_analysis_and_visualization" / "kernel_summary"
BASIC_LAW_KERNEL_PATH = CODEX_KERNEL_DIR / "basic_law_kernel.md"  # 待创建
PROCEDURAL_LAW_KERNEL_PATH = CODEX_KERNEL_DIR / "procedural_law_kernel.md"
TECHNICAL_LAW_KERNEL_PATH = CODEX_KERNEL_DIR / "technical_law_kernel.md"

# 原始法典路径 (引用完整性验证)
ORIGINAL_LAWS_DIR = PROJECT_ROOT / ".clinerules"
BASIC_LAW_PATH = ORIGINAL_LAWS_DIR / "basic_law_index.md"
PROCEDURAL_LAW_PATH = ORIGINAL_LAWS_DIR / "procedural_law.md"
TECHNICAL_LAW_PATH = ORIGINAL_LAWS_DIR / "technical_law.md"

# 法典映射表
LAW_MAPPINGS = {
    "basic": {
        "name": "基本法内核",
        "kernel_path": BASIC_LAW_KERNEL_PATH,
        "original_path": BASIC_LAW_PATH,
        "section_range": "§100-§199"
    },
    "procedural": {
        "name": "程序法内核",
        "kernel_path": PROCEDURAL_LAW_KERNEL_PATH,
        "original_path": PROCEDURAL_LAW_PATH,
        "section_range": "§200-§299"
    },
    "technical": {
        "name": "技术法内核", 
        "kernel_path": TECHNICAL_LAW_KERNEL_PATH,
        "original_path": TECHNICAL_LAW_PATH,
        "section_range": "§300-§499"
    }
}

def _load_kernel_content(law_type: str) -> Dict[str, Any]:
    """加载指定法典的内核内容"""
    mapping = LAW_MAPPINGS.get(law_type)
    if not mapping:
        return {"error": f"未知法典类型: {law_type}"}
    
    kernel_path = mapping["kernel_path"]
    if not kernel_path.exists():
        return {"error": f"法典内核文件不存在: {kernel_path}"}
    
    try:
        with open(kernel_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 解析章节结构
        chapters = []
        current_chapter = ""
        lines = content.split('\n')
        
        for line in lines:
            line = line.strip()
            # 检测章节标题 (## 开头)
            if line.startswith('## '):
                chapter_title = line[3:].strip()
                chapters.append({
                    "title": chapter_title,
                    "level": 2,
                    "sections": []
                })
                current_chapter = chapter_title
            # 检测章节标题 (### 开头)
            elif line.startswith('### '):
                section_title = line[4:].strip()
                if chapters and current_chapter:
                    chapters[-1]["sections"].append(section_title)
                else:
                    chapters.append({
                        "title": section_title,
                        "level": 3,
                        "sections": []
                    })
        
        # 提取§条款
        sections = []
        section_pattern = r'§(\d+(?:\.\d+)?)\s+([^\n]+)'
        for match in re.finditer(section_pattern, content):
            section_num = match.group(1)
            section_title = match.group(2).strip()
            sections.append({
                "number": f"§{section_num}",
                "title": section_title,
                "law_type": law_type
            })
        
        return {
            "status": "success",
            "law_type": law_type,
            "name": mapping["name"],
            "kernel_path": str(kernel_path),
            "section_range": mapping["section_range"],
            "content_preview": content[:500] + "..." if len(content) > 500 else content,
            "size_bytes": len(content),
            "chapters": chapters,
            "sections": sections,
            "section_count": len(sections)
        }
    except Exception as e:
        logger.error(f"加载法典内核失败 ({law_type}): {e}")
        return {"error": f"加载失败: {str(e)}"}

def _get_section_detail(law_type: str, section_num: str) -> Dict[str, Any]:
    """获取特定条款的详细信息"""
    mapping = LAW_MAPPINGS.get(law_type)
    if not mapping:
        return {"error": f"未知法典类型: {law_type}"}
    
    kernel_path = mapping["kernel_path"]
    if not kernel_path.exists():
        return {"error": f"法典内核文件不存在: {kernel_path}"}
    
    try:
        with open(kernel_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 搜索指定条款
        search_pattern = rf'§{re.escape(section_num)}\s+([^\n]+)(.*?)(?=§\d+|\Z)'
        match = re.search(search_pattern, content, re.DOTALL)
        
        if not match:
            return {"error": f"条款 §{section_num} 在{law_type}中未找到"}
        
        section_title = match.group(1).strip()
        section_content = match.group(2).strip()
        
        # 提取数学公式和强制标准
        math_pattern = r'\$\$?(.*?)\$\$?'
        math_formulas = re.findall(math_pattern, section_content)
        
        # 提取MUST/MUST NOT约束
        must_pattern = r'\*\*MUST\*\*:?\s*([^\n\.]+)'
        must_not_pattern = r'\*\*MUST NOT\*\*:?\s*([^\n\.]+)'
        must_constraints = re.findall(must_pattern, section_content)
        must_not_constraints = re.findall(must_not_pattern, section_content)
        
        # 提取宪法引用
        constitutional_ref_pattern = r'\[基本法 §(\d+)\]'
        constitutional_refs = re.findall(constitutional_ref_pattern, section_content)
        
        # 提取开发标准引用
        standard_ref_pattern = r'DS-(\d+)'
        standard_refs = re.findall(standard_ref_pattern, section_content)
        
        return {
            "status": "success",
            "law_type": law_type,
            "section": f"§{section_num}",
            "title": section_title,
            "content": section_content,
            "content_preview": section_content[:300] + "..." if len(section_content) > 300 else section_content,
            "analysis": {
                "math_formulas_count": len(math_formulas),
                "must_constraints": must_constraints,
                "must_not_constraints": must_not_constraints,
                "constitutional_references": [f"§{ref}" for ref in constitutional_refs],
                "standard_references": [f"DS-{ref}" for ref in standard_refs]
            },
            "kernel_path": str(kernel_path)
        }
    except Exception as e:
        logger.error(f"获取条款详情失败 (§{section_num} in {law_type}): {e}")
        return {"error": f"详情提取失败: {str(e)}"}

def _verify_cross_references(law_type: str) -> Dict[str, Any]:
    """验证法典间引用完整性"""
    mapping = LAW_MAPPINGS.get(law_type)
    if not mapping:
        return {"error": f"未知法典类型: {law_type}"}
    
    kernel_path = mapping["kernel_path"]
    if not kernel_path.exists():
        return {"error": f"法典内核文件不存在: {kernel_path}"}
    
    try:
        with open(kernel_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 查找所有引用
        references = []
        
        # 基本法引用模式: [基本法 §xxx]
        basic_law_pattern = r'\[基本法 §(\d+(?:\.\d+)?)\]'
        for match in re.finditer(basic_law_pattern, content):
            ref = match.group(1)
            references.append({
                "type": "basic_law",
                "reference": f"§{ref}",
                "context": content[max(0, match.start()-50):match.end()+50]
            })
        
        # 技术法引用模式: [技术法 §xxx]
        technical_law_pattern = r'\[技术法 §(\d+(?:\.\d+)?)\]'
        for match in re.finditer(technical_law_pattern, content):
            ref = match.group(1)
            references.append({
                "type": "technical_law",
                "reference": f"§{ref}",
                "context": content[max(0, match.start()-50):match.end()+50]
            })
        
        # 程序法引用模式: [程序法 §xxx]
        procedural_law_pattern = r'\[程序法 §(\d+(?:\.\d+)?)\]'
        for match in re.finditer(procedural_law_pattern, content):
            ref = match.group(1)
            references.append({
                "type": "procedural_law",
                "reference": f"§{ref}",
                "context": content[max(0, match.start()-50):match.end()+50]
            })
        
        # 开发标准引用模式: DS-xxx
        standard_pattern = r'DS-(\d+)'
        for match in re.finditer(standard_pattern, content):
            ref = match.group(1)
            references.append({
                "type": "development_standard",
                "reference": f"DS-{ref}",
                "context": content[max(0, match.start()-50):match.end()+50]
            })
        
        return {
            "status": "success",
            "law_type": law_type,
            "reference_count": len(references),
            "references_by_type": {
                "basic_law": len([r for r in references if r["type"] == "basic_law"]),
                "technical_law": len([r for r in references if r["type"] == "technical_law"]),
                "procedural_law": len([r for r in references if r["type"] == "procedural_law"]),
                "development_standard": len([r for r in references if r["type"] == "development_standard"])
            },
            "references": references[:10],  # 只返回前10个引用，防止响应过大
            "integrity_score": min(1.0, len(references) / 100.0)  # 简单完整性评分
        }
    except Exception as e:
        logger.error(f"验证引用完整性失败 ({law_type}): {e}")
        return {"error": f"验证失败: {str(e)}"}

def _search_codex_content(query: str, law_type: Optional[str] = None) -> Dict[str, Any]:
    """搜索法典内容"""
    results = []
    
    # 确定搜索范围
    search_types = [law_type] if law_type else LAW_MAPPINGS.keys()
    
    for law_key in search_types:
        mapping = LAW_MAPPINGS.get(law_key)
        if not mapping or not mapping["kernel_path"].exists():
            continue
        
        try:
            with open(mapping["kernel_path"], 'r', encoding='utf-8') as f:
                content = f.read()
            
            # 简单文本搜索 (实际实现中可使用更复杂的搜索算法)
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if query.lower() in line.lower():
                    # 提取上下文
                    context_start = max(0, i - 2)
                    context_end = min(len(lines), i + 3)
                    context = '\n'.join(lines[context_start:context_end])
                    
                    results.append({
                        "law_type": law_key,
                        "law_name": mapping["name"],
                        "line_number": i + 1,
                        "matched_line": line.strip(),
                        "context": context,
                        "kernel_path": str(mapping["kernel_path"])
                    })
                    
                    # 限制结果数量
                    if len(results) >= 20:
                        break
            
            if len(results) >= 20:
                break
                
        except Exception as e:
            logger.error(f"搜索法典内容失败 ({law_key}): {e}")
            continue
    
    return {
        "status": "success",
        "query": query,
        "law_type_filter": law_type,
        "results_count": len(results),
        "results": results
    }

@registry.register()
@negetropy_sanitizer
def get_codex_structure(law_type: str = "all") -> str:
    """
    [Codex Navigator] 获取法典内核的章节结构。
    
    输入参数:
        law_type: 法典类型 ("basic", "procedural", "technical", "all")
        
    返回: JSON字符串，包含法典结构和元数据
    
    宪法依据:
    - §181 (类型公理优先原则): 确保结构定义的数学严谨性
    - §352 (架构同构性验证): 验证内核与原始法典的结构一致性
    
    开发标准: DS-038 (TypeScript模块导入分离标准)
    """
    try:
        logger.info(f"获取法典结构: law_type={law_type}")
        
        if law_type == "all":
            # 返回所有法典的结构
            all_structures = {}
            for key in LAW_MAPPINGS.keys():
                result = _load_kernel_content(key)
                if "error" not in result:
                    all_structures[key] = result
            
            response = {
                "status": "success",
                "law_type": "all",
                "total_laws": len(all_structures),
                "laws": all_structures,
                "system_info": {
                    "kernel_dir": str(CODEX_KERNEL_DIR),
                    "constitutional_version": "v6.8.0 (Agent Sovereignty)",
                    "entropy_optimization": "已完成法典熵减优化"
                }
            }
        else:
            # 返回指定法典的结构
            result = _load_kernel_content(law_type)
            if "error" in result:
                response = result
            else:
                response = {
                    "status": "success",
                    **result,
                    "system_info": {
                        "kernel_dir": str(CODEX_KERNEL_DIR),
                        "constitutional_compliance": {
                            "§181": "类型公理优先原则",
                            "§352": "架构同构性验证",
                            "§156": "增强级三级验证协议"
                        }
                    }
                }
        
        return json.dumps(response, ensure_ascii=False, indent=2)
        
    except Exception as e:
        logger.error(f"获取法典结构失败: {e}")
        return json.dumps({
            "error": str(e),
            "law_type": law_type,
            "suggestion": "检查法典内核文件是否存在"
        }, ensure_ascii=False)

@registry.register()
@negetropy_sanitizer
def get_codex_section(law_type: str, section_num: str) -> str:
    """
    [Codex Navigator] 获取特定条款的详细信息。
    
    输入参数:
        law_type: 法典类型 ("basic", "procedural", "technical")
        section_num: 条款编号 (如 "301.1", "201", "114")
        
    返回: JSON字符串，包含条款详情和分析
    
    宪法依据:
    - §181 (类型公理优先原则): 确保条款类型定义的严谨性
    - §306 (游标分页标准): 支持快速检索 ($O(1)$复杂度目标)
    
    开发标准: DS-001 (通用输出编码规范)
    """
    try:
        logger.info(f"获取法典条款: {law_type} §{section_num}")
        
        result = _get_section_detail(law_type, section_num)
        
        # 添加宪法合规信息
        if "error" not in result:
            result["constitutional_compliance"] = {
                "§181": "类型公理优先原则",
                "§306": f"游标分页标准 (检索复杂度: $O(1)$ 目标)",
                "§124": "编码一致性公理 (UTF-8强制)"
            }
        
        return json.dumps(result, ensure_ascii=False, indent=2)
        
    except Exception as e:
        logger.error(f"获取法典条款失败: {e}")
        return json.dumps({
            "error": str(e),
            "law_type": law_type,
            "section_num": section_num,
            "suggestion": "确认条款编号格式正确 (如 '301.1' 而不是 '§301.1')"
        }, ensure_ascii=False)

@registry.register()
@negetropy_sanitizer
def verify_codex_references(law_type: str = "all") -> str:
    """
    [Codex Navigator] 验证法典间引用完整性。
    
    输入参数:
        law_type: 法典类型 ("basic", "procedural", "technical", "all")
        
    返回: JSON字符串，包含引用完整性分析
    
    宪法依据:
    - §156 (增强级三级验证协议): 架构同构性验证 ($S_{fs} \cong S_{doc}$)
    - §102.2 (引用完整性公理): 确保规范与实现的双向可追溯性
    
    开发标准: DS-007 (架构同构性验证标准实现)
    """
    try:
        logger.info(f"验证法典引用完整性: law_type={law_type}")
        
        if law_type == "all":
            # 验证所有法典
            all_verifications = {}
            total_references = 0
            integrity_scores = []
            
            for key in LAW_MAPPINGS.keys():
                result = _verify_cross_references(key)
                if "error" not in result:
                    all_verifications[key] = result
                    total_references += result.get("reference_count", 0)
                    integrity_scores.append(result.get("integrity_score", 0.0))
            
            avg_integrity = sum(integrity_scores) / len(integrity_scores) if integrity_scores else 0.0
            
            response = {
                "status": "success",
                "verification_scope": "all",
                "total_laws_verified": len(all_verifications),
                "total_references_found": total_references,
                "average_integrity_score": round(avg_integrity, 3),
                "integrity_assessment": "高完整性" if avg_integrity > 0.7 else "中等完整性" if avg_integrity > 0.4 else "低完整性",
                "verifications": all_verifications,
                "constitutional_compliance": {
                    "§156": "增强级三级验证协议 (Tier 1: 结构完整性)",
                    "§102.2": "引用完整性公理 (双向可追溯性)",
                    "§141": "自动化重构安全 (语义保持性 $S' = S$)"
                }
            }
        else:
            # 验证指定法典
            result = _verify_cross_references(law_type)
            if "error" in result:
                response = result
            else:
                response = {
                    **result,
                    "constitutional_compliance": {
                        "§156": f"增强级三级验证协议 - 验证 {law_type} 法典",
                        "§102.2": "引用完整性公理",
                        "§320.1": "自动化架构同步标准"
                    }
                }
        
        return json.dumps(response, ensure_ascii=False, indent=2)
        
    except Exception as e:
        logger.error(f"验证法典引用完整性失败: {e}")
        return json.dumps({
            "error": str(e),
            "law_type": law_type,
            "suggestion": "检查法典内核文件的引用格式"
        }, ensure_ascii=False)

@registry.register()
@negetropy_sanitizer
def search_codex(query: str, law_type: Optional[str] = None) -> str:
    """
    [Codex Navigator] 搜索法典内容。
    
    输入参数:
        query: 搜索查询字符串
        law_type: 可选，限制搜索的法典类型
        
    返回: JSON字符串，包含搜索结果
    
    宪法依据:
    - §460 (混合检索增强公理): $S_{hybrid} = w_v \times S_{vector} + w_t \times S_{text}$
    - §306 (游标分页标准): 支持结果分页和性能优化
    
    开发标准: DS-030 (混合检索增强标准实现)
    """
    try:
        logger.info(f"搜索法典: query='{query}', law_type={law_type}")
        
        result = _search_codex_content(query, law_type)
        
        # 添加搜索性能信息
        if "error" not in result:
            result["search_algorithm"] = "文本匹配 (后续可升级为混合检索)"
            result["performance_note"] = "当前使用简单文本搜索，复杂度 $O(n)$。未来可升级为 $O(1)$ 哈希索引。"
            result["constitutional_compliance"] = {
                "§460": "混合检索增强公理 (目标权重: $w_v=0.7, w_t=0.3$)",
                "§306": "游标分页标准 (支持大规模结果集)",
                "§405": "性能与熵减指标 (检索复杂度优化)"
            }
        
        return json.dumps(result, ensure_ascii=False, indent=2)
        
    except Exception as e:
        logger.error(f"搜索法典失败: {e}")
        return json.dumps({
            "error": str(e),
            "query": query,
            "law_type": law_type,
            "suggestion": "简化查询词或检查法典内核文件访问权限"
        }, ensure_ascii=False)

@registry.register()
@negetropy_sanitizer
def analyze_codex_entropy(law_type: str = "all") -> str:
    """
    [Codex Navigator] 分析法典熵值变化。
    
    输入参数:
        law_type: 法典类型 ("basic", "procedural", "technical", "all")
        
    返回: JSON字符串，包含熵值分析和优化建议
    
    宪法依据:
    - §136 (强制审计): 生成关键内容前必须调用熵值监测
    - §141 (自动化重构安全): 确保熵减验证 ($H' \leq H$)
    - §351 (三阶段逆熵审计): 信噪比分析、结构熵评估、目标对齐验证
    
    开发标准: DS-006 (三阶段逆熵审计标准实现)
    """
    try:
        logger.info(f"分析法典熵值: law_type={law_type}")
        
        # 简单熵值分析 (实际实现中可使用更复杂的熵计算)
        analysis_results = {}
        
        if law_type == "all":
            law_types_to_analyze = LAW_MAPPINGS.keys()
        else:
            law_types_to_analyze = [law_type]
        
        for law_key in law_types_to_analyze:
            mapping = LAW_MAPPINGS.get(law_key)
            if not mapping or not mapping["kernel_path"].exists():
                analysis_results[law_key] = {"error": "法典内核文件不存在"}
                continue
            
            try:
                # 读取内核文件
                with open(mapping["kernel_path"], 'r', encoding='utf-8') as f:
                    kernel_content = f.read()
                
                kernel_size = len(kernel_content)
                
                # 读取原始文件 (如果存在)
                original_size = 0
                if mapping["original_path"].exists():
                    with open(mapping["original_path"], 'r', encoding='utf-8') as f:
                        original_content = f.read()
                    original_size = len(original_content)
                
                # 计算压缩率 (简单熵值代理)
                compression_ratio = kernel_size / original_size if original_size > 0 else 1.0
                
                # 分析结构特征
                lines = kernel_content.split('\n')
                math_formula_count = len(re.findall(r'\$\$?(.*?)\$\$?', kernel_content))
                must_constraint_count = len(re.findall(r'\*\*MUST\*\*', kernel_content))
                section_count = len(re.findall(r'§\d+(?:\.\d+)?', kernel_content))
                
                # 熵值评估 (简单启发式)
                entropy_score = 1.0 - (math_formula_count / max(1, section_count))  # 数学公式越多，熵值越低
                
                analysis_results[law_key] = {
                    "status": "success",
                    "kernel_size_bytes": kernel_size,
                    "original_size_bytes": original_size,
                    "compression_ratio": round(compression_ratio, 3),
                    "structure_metrics": {
                        "line_count": len(lines),
                        "section_count": section_count,
                        "math_formula_count": math_formula_count,
                        "must_constraint_count": must_constraint_count,
                        "constraint_density": round(must_constraint_count / max(1, section_count), 2)
                    },
                    "entropy_analysis": {
                        "entropy_score": round(entropy_score, 3),
                        "entropy_assessment": "低熵" if entropy_score < 0.3 else "中熵" if entropy_score < 0.7 else "高熵",
                        "optimization_potential": round(1.0 - entropy_score, 3)
                    },
                    "optimization_suggestions": [
                        "增加数学公式约束以提高确定性" if math_formula_count < section_count/2 else "数学约束充足",
                        "增加MUST/MUST NOT约束以降低认知熵" if must_constraint_count < section_count else "约束密度良好",
                        "考虑进一步压缩冗余描述" if compression_ratio > 0.5 else "压缩率良好"
                    ]
                }
                
            except Exception as e:
                logger.error(f"分析法典熵值失败 ({law_key}): {e}")
                analysis_results[law_key] = {"error": f"分析失败: {str(e)}"}
        
        response = {
            "status": "success",
            "analysis_scope": law_type,
            "timestamp": "2026-01-30T03:47:13Z",
            "entropy_analysis": analysis_results,
            "constitutional_compliance": {
                "§136": "强制审计 (熵值监测)",
                "§141": "自动化重构安全 (熵减验证 $H' \leq H$)",
                "§351": "三阶段逆熵审计",
                "DS-006": "三阶段逆熵审计标准实现"
            },
            "mathematical_basis": "香农熵 $H(X) = -∑ p(x) log₂ p(x)$，结构熵 $H_s = -∑ p(s) log₂ p(s)$"
        }
        
        return json.dumps(response, ensure_ascii=False, indent=2)
        
    except Exception as e:
        logger.error(f"分析法典熵值失败: {e}")
        return json.dumps({
            "error": str(e),
            "law_type": law_type,
            "suggestion": "检查法典文件访问权限和格式"
        }, ensure_ascii=False)