# DS-004: 知识漂移检测标准实现

**父索引**: [Development Standards Index](../DEVELOPMENT_STANDARDS.md)
**对应技术法**: §312
**宪法依据**: §122 (质量门控与标准)
**版本**: v6.8.0 (Dual-Store Isomorphism)
**状态**: 🟢 生产就绪

---

**对应技术法条款**: §312
**宪法依据**: §136 (强制审计)
**适用场景**: 知识库一致性验证、文件系统与向量存储同步

### 问题背景
向量知识库与文件系统文档可能发生认知偏差，导致知识不一致。

### 强制标准
所有知识管理流程必须定期调用`detect_knowledge_drift`进行一致性验证。

### 标准实现模式 (Python)

```python
import json
import os
import difflib
from typing import Dict, List, Tuple

def detect_knowledge_drift(project_id: str = "entropy_lab_core") -> str:
    """
    [Audit] 监测核心文档与向量知识库之间的认知偏差。
    遵循宪法 §136 强制审计要求。
    
    返回: JSON 格式的漂移报告，包含新增、修改、删除的文件信息
    """
    # 1. 获取远程向量库快照
    remote_map = _get_remote_snapshot(f"project_{project_id}")
    
    # 2. 扫描本地文件系统
    root_dir = str(PROJECT_ROOT)
    targets = [
        {"path": ".clinerules", "type": "dir"},
        {"path": "memory_bank", "type": "dir"},
        {"path": "docs", "type": "dir"}
    ]
    local_files = _scan_local_files(root_dir, targets)
    
    # 3. 计算差异 (新增、修改、删除)
    new_files, modified_files, deleted_files = _calculate_drift(local_files, remote_map)
    
    # 4. 生成标准化报告
    report = _generate_diff_report(new_files, modified_files, deleted_files)
    
    return json.dumps({
        "status": "complete",
        "project_id": project_id,
        "report": report,
        "metrics": {
            "new_files": len(new_files),
            "modified_files": len(modified_files),
            "deleted_files": len(deleted_files)
        }
    }, ensure_ascii=False)

def _get_remote_snapshot(collection_name: str) -> Dict[str, str]:
    """从 Qdrant 获取向量库快照"""
    remote_map = {}
    offset = 0
    limit = 100
    
    while True:
        results, next_page = container.qdrant.scroll(
            collection_name=collection_name,
            limit=limit,
            offset=offset,
            with_payload=True,
            with_vectors=False
        )
        
        for point in results:
            payload = point.payload or {}
            source = payload.get("metadata", {}).get("source", "")
            content = payload.get("content", "")
            if source:
                remote_map[source] = content
        
        if not results or len(results) < limit:
            break
        offset += limit
    
    return remote_map

def _scan_local_files(root_dir: str, targets: List[Dict[str, str]]) -> Dict[str, str]:
    """扫描本地文件系统 (仅处理 .md 文件)"""
    local_files = {}
    for target in targets:
        path = os.path.join(root_dir, target["path"])
        if not os.path.exists(path):
            continue
        
        if target["type"] == "file":
            try:
                with open(path, "r", encoding="utf-8", errors='replace') as f:
                    local_files[target["path"]] = f.read()
            except PermissionError:
                continue
        else:  # directory
            for root, _, files in os.walk(path):
                for file in files:
                    if file.endswith(".md"):
                        full_path = os.path.join(root, file)
                        rel_path = os.path.relpath(full_path, root_dir).replace("\\", "/")
                        try:
                            with open(full_path, "r", encoding="utf-8", errors='replace') as f:
                                local_files[rel_path] = f.read()
                        except PermissionError:
                            continue
    
    return local_files

def _calculate_drift(local_files: Dict[str, str], remote_map: Dict[str, str]) -> Tuple[List[str], List[Dict], List[str]]:
    """计算文件差异"""
    new_files = []
    modified_files = []
    deleted_files = []
    target_prefixes = (".clinerules", "memory_bank/", "docs/")
    
    # 检查新增和修改的文件
    for rel_path, local_content in local_files.items():
        if rel_path not in remote_map:
            new_files.append(rel_path)
        else:
            remote_content = remote_map[rel_path]
            if local_content.strip() != remote_content.strip():
                diff = difflib.unified_diff(
                    remote_content.splitlines(),
                    local_content.splitlines(),
                    fromfile=f"Remote:{rel_path}",
                    tofile=f"Local:{rel_path}",
                    lineterm=""
                )
                diff_text = "\n".join(list(diff)[:15])
                if len(list(diff)) > 15:
                    diff_text += "\n... (more changes)"
                
                modified_files.append({
                    "path": rel_path,
                    "diff": diff_text,
                    "change_count": len(list(diff)) - 2  # 减去头部的两行
                })
    
    # 检查已删除的文件
    for remote_path in remote_map.keys():
        if any(remote_path.startswith(p) for p in target_prefixes):
            if remote_path not in local_files:
                deleted_files.append(remote_path)
    
    return new_files, modified_files, deleted_files

def _generate_diff_report(new_files: List[str], modified_files: List[Dict], deleted_files: List[str]) -> str:
    """生成人类可读的差异报告"""
    report_lines = []
    
    for f in new_files:
        report_lines.append(f"🟢 [NEW] {f}")
    
    for item in modified_files:
        report_lines.append(f"🟡 [MODIFIED] {item['path']} ({item['change_count']} changes)")
        if item['diff']:
            report_lines.append(f"```diff\n{item['diff']}\n```")
    
    for f in deleted_files:
        report_lines.append(f"🔴 [DELETED] {f}")
    
    if not report_lines:
        return "✅ 系统完整性已验证：零漂移"
    
    return f"⚠️ 检测到知识漂移 ({len(report_lines)} 项):\n\n" + "\n\n".join(report_lines)
```

### 执行频率标准
- **生产环境**: 每日自动执行一次
- **开发环境**: 每次代码提交前执行
- **紧急情况**: 怀疑知识不一致时手动执行

### 漂移处理流程
1. **检测**: 执行 `detect_knowledge_drift`
2. **评估**: 分析漂移报告，判断严重程度
3. **同步**: 调用 `sync_memory_bank` 修复漂移
4. **验证**: 再次执行检测，确认修复成功

---
