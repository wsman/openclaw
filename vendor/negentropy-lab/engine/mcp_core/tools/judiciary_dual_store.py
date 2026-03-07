"""
监察部-逆熵实验室 Dual-Store Isomorphism Verification Tool
版本: v1.0.0
职责: 验证 storage/corpus (物理文件域) 与 Qdrant (向量域) 之间的严格双射关系
宪法依据: §114 (双存储同构架构公理), §372 (双射映射维护标准), §355 (知识漂移检测)
技术标准: DS-027 (Dual-Store Isomorphism Verification)
"""
import json
import logging
import os
import hashlib
from pathlib import Path
from typing import Dict, List, Set, Any, Optional
from ..registry import registry
from ..dependencies import container
from ..utils.sanitizer import negetropy_sanitizer
from ..config import PROJECT_ROOT, STRICT_DIMENSION

logger = logging.getLogger("Entropy-DualStore")

# 全局常量
STORAGE_ROOT = Path(PROJECT_ROOT) / "storage" / "corpus"
MAX_OUTPUT_ITEMS = 100  # 限制输出条目数，防止上下文溢出


def calculate_file_hash(file_path: Path) -> str:
    """
    计算文件的 SHA-256 哈希值 (遵循 §370 文件系统存储标准)
    返回: 64字符十六进制字符串
    """
    sha256 = hashlib.sha256()
    try:
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256.update(chunk)
        return sha256.hexdigest()
    except Exception as e:
        logger.error(f"计算文件哈希失败 {file_path}: {e}")
        raise


def get_all_vectors(collection_name: str) -> Dict[str, Dict[str, Any]]:
    """
    获取指定集合中的所有向量元数据 (使用 Scroll API)
    返回: {source_id: payload}
    """
    vectors = {}
    offset = None
    try:
        while True:
            points, next_offset = container.qdrant.scroll(
                collection_name=collection_name,
                scroll_filter=None,
                limit=100,
                with_payload=True,
                with_vectors=False,
                offset=offset
            )
            for point in points:
                payload = point.payload or {}
                # 提取 source_id (可能存储在 metadata 或直接是 payload 字段)
                source_id = payload.get("source_id")
                if not source_id:
                    # 尝试从 metadata 字段获取
                    metadata = payload.get("metadata", {})
                    source_id = metadata.get("source_id")
                
                if source_id:
                    vectors[source_id] = payload
            
            if not points or len(points) < 100 or next_offset is None:
                break
            offset = next_offset
    
    except Exception as e:
        logger.error(f"获取集合 {collection_name} 的向量失败: {e}")
        raise
    
    return vectors


def scan_project_files(project_id: str) -> Dict[str, Path]:
    """
    扫描项目的物理文件 (storage/corpus/{project_id}/documents/)
    返回: {file_hash: file_path}
    """
    doc_dir = STORAGE_ROOT / project_id / "documents"
    if not doc_dir.exists():
        logger.warning(f"项目 {project_id} 的文档目录不存在: {doc_dir}")
        return {}
    
    files = {}
    for ext in ["*.md", "*.txt"]:  # 支持常见的文本文件扩展名
        for f in doc_dir.glob(ext):
            # 假设文件名是哈希值 (去除扩展名)
            file_hash = f.stem
            files[file_hash] = f
    
    return files


def verify_project_dual_store(project_id: str) -> Dict[str, Any]:
    """
    验证单个项目的双存储同构性
    返回: 包含验证结果的字典
    """
    logger.info(f"开始验证项目 {project_id} 的双存储同构性")
    
    # 1. 扫描物理文件
    physical_files = scan_project_files(project_id)
    
    # 2. 获取向量集合
    # 处理项目ID前缀：如果已经是project_前缀，则直接使用；否则添加project_前缀
    if project_id.startswith("project_"):
        collection_name = project_id
    else:
        collection_name = f"project_{project_id}"
    try:
        vector_metadata = get_all_vectors(collection_name)
    except Exception as e:
        logger.error(f"无法获取集合 {collection_name}: {e}")
        # 如果集合不存在，所有文件都是幽灵文件
        ghost_files = [str(path) for path in physical_files.values()]
        return {
            "project_id": project_id,
            "collection_name": collection_name,
            "status": "ERROR",
            "error": f"无法访问集合: {e}",
            "total_files": len(physical_files),
            "total_vectors": 0,
            "ghost_files": ghost_files[:MAX_OUTPUT_ITEMS],
            "ghost_vectors": [],
            "integrity_failures": [],
            "dimension_violations": [],
            "compliance_score": 0.0
        }
    
    # 3. 初始化结果容器
    ghost_files = []  # 文件存在但无向量
    ghost_vectors = []  # 向量存在但无文件
    integrity_failures = []  # 哈希不匹配
    dimension_violations = []  # 维度不符合 4096
    
    # 4. 正向验证: File -> Vector
    for file_hash, file_path in physical_files.items():
        if file_hash not in vector_metadata:
            ghost_files.append({
                "hash": file_hash,
                "path": str(file_path),
                "reason": "Missing corresponding vector in Qdrant"
            })
        else:
            # 验证文件内容哈希是否匹配
            try:
                current_hash = calculate_file_hash(file_path)
                if current_hash != file_hash:
                    integrity_failures.append({
                        "hash": file_hash,
                        "path": str(file_path),
                        "expected": file_hash,
                        "actual": current_hash,
                        "reason": "File content hash mismatch"
                    })
            except Exception as e:
                integrity_failures.append({
                    "hash": file_hash,
                    "path": str(file_path),
                    "reason": f"Hash calculation failed: {e}"
                })
    
    # 5. 逆向验证: Vector -> File
    for source_id, payload in vector_metadata.items():
        if source_id not in physical_files:
            ghost_vectors.append({
                "source_id": source_id,
                "payload": payload,
                "reason": "Missing physical file"
            })
        
        # 检查维度 (如果向量数据中包含维度信息)
        # 注意: 这里只是示例，实际维度检查可能需要获取向量本身
        # 由于我们设置 with_vectors=False，这里无法直接检查
        # 可以在获取向量时启用 with_vectors=True 来验证
    
    # 6. 计算合规分数
    total_items = len(physical_files) + len(vector_metadata)
    total_issues = len(ghost_files) + len(ghost_vectors) + len(integrity_failures)
    
    if total_items > 0:
        compliance_score = 1.0 - (total_issues / total_items)
    else:
        compliance_score = 1.0
    
    # 7. 确定状态
    if total_issues == 0:
        status = "COMPLIANT"
    elif compliance_score >= 0.8:
        status = "WARNING"
    else:
        status = "NON_COMPLIANT"
    
    return {
        "project_id": project_id,
        "collection_name": collection_name,
        "status": status,
        "total_files": len(physical_files),
        "total_vectors": len(vector_metadata),
        "ghost_files": ghost_files[:MAX_OUTPUT_ITEMS],
        "ghost_vectors": ghost_vectors[:MAX_OUTPUT_ITEMS],
        "integrity_failures": integrity_failures[:MAX_OUTPUT_ITEMS],
        "dimension_violations": dimension_violations[:MAX_OUTPUT_ITEMS],
        "compliance_score": round(compliance_score, 4),
        "issues_count": total_issues,
        "note": f"Output limited to {MAX_OUTPUT_ITEMS} items per category" if (
            len(ghost_files) > MAX_OUTPUT_ITEMS or 
            len(ghost_vectors) > MAX_OUTPUT_ITEMS or
            len(integrity_failures) > MAX_OUTPUT_ITEMS
        ) else ""
    }


@registry.register()
@negetropy_sanitizer
def judicial_verify_dual_store(project_id: Optional[str] = None) -> str:
    """
    [The Cartographer v1.0.0] 验证双存储同构性。
    
    验证 storage/corpus (物理文件域) 与 Qdrant (向量域) 之间的严格双射关系。
    支持全系统审计 (不指定 project_id) 或针对单个项目的审计。
    
    标准遵循:
    - DS-027: 双存储同构验证标准实现
    
    对应技术法条款: §114, §370-§373
    
    参数:
        project_id: (可选) 要验证的项目ID。如果为None，则验证所有项目。
    
    返回:
        JSON字符串，包含审计结果和合规分数。
    """
    try:
        logger.info("启动双存储同构验证")
        
        # 确保存储根目录存在
        if not STORAGE_ROOT.exists():
            return json.dumps({
                "error": f"存储根目录不存在: {STORAGE_ROOT}",
                "suggestion": "请确保已按照 §114 配置双存储架构"
            }, ensure_ascii=False, indent=2)
        
        results = []
        
        if project_id:
            # 验证单个项目
            if not (STORAGE_ROOT / project_id).exists():
                return json.dumps({
                    "error": f"项目目录不存在: {project_id}",
                    "suggestion": f"请检查 storage/corpus/{project_id} 是否存在"
                }, ensure_ascii=False, indent=2)
            
            project_ids = [project_id]
        else:
            # 验证所有项目
            project_ids = []
            for item in STORAGE_ROOT.iterdir():
                if item.is_dir():
                    project_ids.append(item.name)
            
            if not project_ids:
                return json.dumps({
                    "warning": "未找到任何项目",
                    "suggestion": "storage/corpus 目录下没有项目目录"
                }, ensure_ascii=False, indent=2)
        
        # 验证每个项目
        for pid in project_ids:
            try:
                result = verify_project_dual_store(pid)
                results.append(result)
            except Exception as e:
                results.append({
                    "project_id": pid,
                    "status": "ERROR",
                    "error": str(e)
                })
        
        # 汇总结果
        total_projects = len(results)
        compliant_projects = sum(1 for r in results if r.get("status") == "COMPLIANT")
        non_compliant_projects = sum(1 for r in results if r.get("status") == "NON_COMPLIANT")
        warning_projects = sum(1 for r in results if r.get("status") == "WARNING")
        error_projects = sum(1 for r in results if r.get("status") == "ERROR")
        
        # 计算总体合规分数 (加权平均)
        valid_results = [r for r in results if "compliance_score" in r]
        if valid_results:
            overall_score = sum(r["compliance_score"] for r in valid_results) / len(valid_results)
        else:
            overall_score = 0.0
        
        overall_status = "COMPLIANT"
        if error_projects > 0:
            overall_status = "ERROR"
        elif non_compliant_projects > 0:
            overall_status = "NON_COMPLIANT"
        elif warning_projects > 0:
            overall_status = "WARNING"
        
        final_report = {
            "tool": "judicial_verify_dual_store",
            "version": "v1.0.0",
            "constitutional_basis": "§114 (双存储同构架构公理)",
            "standard": "DS-027 (Dual-Store Isomorphism Verification)",
            "overall_status": overall_status,
            "overall_compliance_score": round(overall_score, 4),
            "projects_scanned": total_projects,
            "project_breakdown": {
                "compliant": compliant_projects,
                "warning": warning_projects,
                "non_compliant": non_compliant_projects,
                "error": error_projects
            },
            "detailed_results": results,
            "mathematical_axiom": "S_fs ≅ S_doc ∧ Φ: File ↔ Vector (bijection)",
            "verification_summary": f"验证了 {total_projects} 个项目，总体合规率: {overall_score:.1%}"
        }
        
        # 添加截断说明
        total_ghost_files = sum(len(r.get("ghost_files", [])) for r in results)
        total_ghost_vectors = sum(len(r.get("ghost_vectors", [])) for r in results)
        total_integrity_issues = sum(len(r.get("integrity_failures", [])) for r in results)
        
        if any([total_ghost_files > MAX_OUTPUT_ITEMS, 
                total_ghost_vectors > MAX_OUTPUT_ITEMS, 
                total_integrity_issues > MAX_OUTPUT_ITEMS]):
            final_report["output_note"] = f"详细输出已截断，每类最多显示 {MAX_OUTPUT_ITEMS} 条"
        
        return json.dumps(final_report, ensure_ascii=False, indent=2)
        
    except Exception as e:
        logger.error(f"双存储同构验证失败: {e}")
        return json.dumps({
            "error": str(e),
            "type": type(e).__name__,
            "suggestion": "检查 Qdrant 连接和存储目录权限"
        }, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    # 用于本地测试
    import sys
    logging.basicConfig(level=logging.INFO)
    
    if len(sys.argv) > 1:
        project_id = sys.argv[1]
    else:
        project_id = None
    
    result = judicial_verify_dual_store(project_id)
    print(result)