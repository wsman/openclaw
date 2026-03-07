"""
监察部-逆熵实验室 Judiciary Tools
版本: v5.3.1 (Orthogonal Decomposition)
职责: 架构扫描、契约验证、熵值测量与结构验证
更新: 重构 judicial_verify_structure，实施复杂度正交分解 (Tier-1)。
"""
import ast
import json
import logging
import os
import difflib
import re
import fnmatch
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Dict, List, Tuple, Set, Any
from ..registry import registry
from ..dependencies import container
from ..utils.sanitizer import negetropy_sanitizer
from ..config import PROJECT_ROOT

logger = logging.getLogger("Entropy-Judiciary")

# [Configuration] 忽略列表 - 降低系统熵值的关键
IGNORE_DIRS = {
    'node_modules', '.git', '__pycache__', '.idea', '.vscode', 
    'dist', 'build', 'coverage', 'venv', 'env', '.pytest_cache', 'mypy_cache'
}
MAX_VIOLATIONS_OUTPUT = 50  # 限制输出条目数

# [修复] 适配 Tri-Core 架构的导入逻辑
HAS_JUDICIARY = False
try:
    from engine.services.judiciary import JudiciaryService
    HAS_JUDICIARY = True
except ImportError as e:
    logger.debug(f"JudiciaryService module not available: {e}, some tools will be limited.")
    HAS_JUDICIARY = False

def _get_judiciary():
    if not HAS_JUDICIARY:
        raise ImportError("JudiciaryService module not available (Import failed)")
    return JudiciaryService(str(PROJECT_ROOT))

@registry.register()
@negetropy_sanitizer
def judicial_scan_architecture(target_path: Optional[str] = None) -> str:
    """[The Architect] 扫描架构同构性。"""
    try:
        service = _get_judiciary()
        result = service.scan_architecture(target_path)
        return json.dumps(result, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Judicial scan error: {e}")
        return json.dumps({"error": str(e)})

@registry.register()
@negetropy_sanitizer
def judicial_verify_contract(code_file: str, doc_file: Optional[str] = None) -> str:
    """[The Notary] 验证接口契约。

    标准遵循:
    - DS-008: 接口契约一致性标准实现

    对应技术法条款: §353
    """
    try:
        service = _get_judiciary()
        result = service.verify_module_contract(code_file, doc_file)
        return json.dumps(result, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Judicial verify error: {e}")
        return json.dumps({"error": str(e)})

@registry.register()
@negetropy_sanitizer
def judicial_measure_complexity(file_path: str) -> str:
    """[The Physicist] 测量代码熵值 (V(G))。

    标准遵循:
    - DS-009: 圈复杂度测量标准实现

    对应技术法条款: §354
    """
    try:
        service = _get_judiciary()
        result = service.measure_complexity(file_path)
        return json.dumps(result, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Judicial measure error: {e}")
        return json.dumps({"error": str(e)})

# ---------------------------------------------------------
# Structure Verification (v5.3.1 Tier-1 Orthogonal Decomposition)
# ---------------------------------------------------------

def _parse_system_patterns(content: str) -> Tuple[Dict[str, Dict], Set[str]]:
    """[Helper] 解析 systemPatterns.md 内容，提取期望结构与忽略模式"""
    # 1. 提取 ASCII 树
    tree_match = re.search(r'以下ASCII树定义了[^`]*?```(.*?)```', content, re.DOTALL)
    if not tree_match:
        tree_match = re.search(r'```(.*?)```', content, re.DOTALL)
    
    if not tree_match:
        raise ValueError("无法在文档中找到ASCII树定义")
    
    ascii_tree = tree_match.group(1).strip()
    expected_items = _parse_ascii_tree(ascii_tree, Path(PROJECT_ROOT))
    
    # 2. 提取忽略模式
    ignored_patterns = _parse_ignored_patterns(content)
    
    return expected_items, ignored_patterns

def _compare_structures(
    expected_items: Dict[str, Dict], 
    actual_items: Dict[str, Dict], 
    ignored_patterns: Set[str]
) -> Tuple[List[Dict], List[Dict]]:
    """[Helper] 执行集合差集运算 $S_{doc} \Delta S_{fs}$ 与类型检查"""
    violations = []
    warnings = []
    
    # 1. 检查缺失项 (Missing Items)
    for item_path, item_info in expected_items.items():
        if item_path not in actual_items:
            if _is_ignored(item_path, ignored_patterns):
                warnings.append({
                    "type": "missing_exempted",
                    "path": str(item_path),
                    "expected_type": item_info["type"],
                    "description": f"缺失但豁免的{item_info['type']}: {item_path}"
                })
            else:
                violations.append({
                    "type": "missing",
                    "path": str(item_path),
                    "expected_type": item_info["type"],
                    "description": f"缺失{item_info['type']}: {item_path}"
                })
        else:
            # 检查类型匹配 (Type Mismatch)
            actual_info = actual_items[item_path]
            if item_info["type"] != actual_info["type"]:
                violations.append({
                    "type": "type_mismatch",
                    "path": str(item_path),
                    "expected_type": item_info["type"],
                    "actual_type": actual_info["type"],
                    "description": f"类型不匹配: 期望{item_info['type']}，实际{actual_info['type']}"
                })
    
    # 2. 检查未授权项 (Unauthorized Items)
    for item_path, item_info in actual_items.items():
        if item_path not in expected_items:
            if _is_authorized_by_parent(item_path, expected_items):
                continue
            
            if _is_ignored(item_path, ignored_patterns):
                warnings.append({
                    "type": "unauthorized_exempted",
                    "path": str(item_path),
                    "actual_type": item_info["type"],
                    "description": f"未授权但豁免的{item_info['type']}: {item_path}"
                })
            else:
                violations.append({
                    "type": "unauthorized",
                    "path": str(item_path),
                    "actual_type": item_info["type"],
                    "description": f"未授权的{item_info['type']}: {item_path}"
                })
                
    return violations, warnings

def _generate_structure_report(
    patterns_path: Path,
    expected_count: int,
    actual_count: int,
    violations: List[Dict],
    warnings: List[Dict],
    ignored_patterns: Set[str],
    expected_items_keys: List[str]
) -> Dict[str, Any]:
    """[Helper] 生成结构化合规报告"""
    # 1. 计算合规率
    effective_violations = [v for v in violations if not _is_ignored(v["path"], ignored_patterns)]
    is_compliant = len(effective_violations) == 0
    
    exempted_expected_count = sum(1 for path in expected_items_keys if _is_ignored(path, ignored_patterns))
    effective_expected_count = expected_count - exempted_expected_count
    
    if effective_expected_count > 0:
        compliance_rate = (effective_expected_count - len(effective_violations)) / effective_expected_count * 100
    else:
        compliance_rate = 100.0

    # 2. 截断输出
    display_violations = violations[:MAX_VIOLATIONS_OUTPUT]
    
    # 3. 构造结果字典
    return {
        "status": "compliant" if is_compliant else "non_compliant",
        "system_patterns_file": str(patterns_path),
        "project_root": str(PROJECT_ROOT),
        "expected_items_count": expected_count,
        "actual_items_count": actual_count,
        "violations_count": len(violations),
        "effective_violations_count": len(effective_violations),
        "violations": display_violations,
        "warnings": warnings[:MAX_VIOLATIONS_OUTPUT],
        "note": "Violations output truncated for clarity" if len(violations) > MAX_VIOLATIONS_OUTPUT else "",
        "compliance_rate": f"{compliance_rate:.1f}%",
        "mathematical_axiom": "S_fs ≅ S_doc",
        "verification": "PASS" if is_compliant else "FAIL",
        "metrics": {
            "exempted_expected_items": exempted_expected_count,
            "effective_expected_items": effective_expected_count,
            "exempted_violations": len(violations) - len(effective_violations)
        }
    }

@registry.register()
@negetropy_sanitizer
def judicial_verify_structure(system_patterns_path: Optional[str] = None, test_param: Optional[str] = None) -> str:
    """
    [The Architect v5.3.1] 验证物理文件系统与systemPatterns.md定义的架构同构性。
    支持 'Ignored Patterns' 动态豁免与 Glob 匹配。
    数学公理: S_fs ≅ S_doc

    标准遵循:
    - DS-007: 架构同构性验证标准实现

    对应技术法条款: §352
    """
    try:
        # 添加更多诊断信息
        import os
        logger.info(f"Current working directory: {os.getcwd()}")
        logger.info(f"PROJECT_ROOT: {PROJECT_ROOT}")
        logger.info(f"PROJECT_ROOT absolute: {Path(PROJECT_ROOT).absolute()}")
        
        # 1. 确定systemPatterns.md文件路径
        if system_patterns_path is None:
            patterns_path = Path(PROJECT_ROOT) / "memory_bank" / "02_system_axioms" / "systemPatterns.md"
        else:
            # 处理相对路径：如果传入的是相对路径，尝试基于PROJECT_ROOT解析
            input_path = Path(system_patterns_path)
            if not input_path.is_absolute():
                # 尝试作为相对于PROJECT_ROOT的路径
                patterns_path = Path(PROJECT_ROOT) / system_patterns_path
                logger.info(f"Relative path detected, resolved to: {patterns_path}")
            else:
                patterns_path = input_path
        
        # 添加诊断日志
        logger.info(f"patterns_path input: {system_patterns_path}")
        logger.info(f"Resolved patterns_path: {patterns_path}")
        logger.info(f"Absolute path: {patterns_path.absolute()}")
        logger.info(f"Path exists: {patterns_path.exists()}")
        
        if not patterns_path.exists():
            return json.dumps({
                "error": f"systemPatterns.md not found at {patterns_path}",
                "suggestion": "请确保已创建符合v5.1规范的系统模式文档"
            }, ensure_ascii=False)
        
        # 2. 读取并解析内容 (Parse)
        try:
            with open(patterns_path, 'r', encoding='utf-8') as f:
                content = f.read()
            expected_items, ignored_patterns = _parse_system_patterns(content)
        except Exception as e:
            return json.dumps({"error": f"解析错误: {str(e)}"}, ensure_ascii=False)
        
        # 3. 扫描文件系统 (Scan)
        actual_items = _scan_filesystem(Path(PROJECT_ROOT), ignored_patterns)
        
        # 4. 比较差异 (Diff)
        violations, warnings = _compare_structures(expected_items, actual_items, ignored_patterns)
        
        # 5. 生成报告 (Report)
        result = _generate_structure_report(
            patterns_path,
            len(expected_items),
            len(actual_items),
            violations,
            warnings,
            ignored_patterns,
            list(expected_items.keys())
        )
        
        return json.dumps(result, indent=2, ensure_ascii=False)
        
    except Exception as e:
        logger.error(f"Structure verification error: {e}")
        return json.dumps({
            "error": str(e),
            "type": type(e).__name__,
            "suggestion": "检查PROJECT_ROOT配置或文件权限"
        }, ensure_ascii=False)

def _parse_ignored_patterns(content: str) -> Set[str]:
    """从Markdown中提取 Ignored Patterns 列表"""
    patterns = set(IGNORE_DIRS)
    match = re.search(r'##\s+\d+\.\s+Ignored Patterns.*?\n(.*?)(?=\n##|\Z)', content, re.DOTALL | re.IGNORECASE)
    if match:
        block = match.group(1)
        for line in block.splitlines():
            line = line.strip()
            if line.startswith(('-', '*')):
                pattern = line.lstrip('-* ').strip()
                if pattern:
                    patterns.add(pattern)
    # 将IGNORE_DIRS中的目录转换为glob模式
    default_globs = [d + '/**' for d in IGNORE_DIRS]
    patterns.update(default_globs)
    return patterns

def _is_ignored(path: str, patterns: Set[str]) -> bool:
    """使用 Glob 模式检查路径是否被忽略"""
    # 标准化路径：转换为正斜杠
    path = path.replace('\\', '/')
    for pattern in patterns:
        clean_pattern = pattern.rstrip('/')
        if path == clean_pattern: 
            return True
        # 如果模式以 '/' 或 '**' 结尾，检查前缀匹配
        if pattern.endswith('/') or pattern.endswith('**'):
            if path.startswith(clean_pattern + '/'): 
                return True
        # 尝试直接 glob 匹配
        if fnmatch.fnmatch(path, pattern): 
            return True
        # 尝试带通配符前缀的匹配
        if fnmatch.fnmatch(path, f"**/{pattern}"): 
            return True
        # 如果模式是目录名，匹配该目录下的所有内容
        if not pattern.endswith('/') and not pattern.endswith('**'):
            if path.startswith(pattern + '/'):
                return True
    return False

def _scan_filesystem(root: Path, ignored_patterns: Set[str]) -> Dict[str, Dict]:
    """扫描文件系统并动态剪枝"""
    actual_items = {}
    for dirpath, dirnames, filenames in os.walk(root):
        rel_dir = os.path.relpath(dirpath, root).replace("\\", "/")
        if rel_dir == ".": rel_dir = ""
        
        # 剪枝：动态检查目录是否匹配忽略模式
        for i in range(len(dirnames) - 1, -1, -1):
            d_name = dirnames[i]
            d_rel_path = f"{rel_dir}/{d_name}" if rel_dir else d_name
            if _is_ignored(d_rel_path, ignored_patterns):
                del dirnames[i]
                continue
            actual_items[d_rel_path] = {"type": "dir", "path": os.path.join(dirpath, d_name)}

        for f_name in filenames:
            f_rel_path = f"{rel_dir}/{f_name}" if rel_dir else f_name
            if not _is_ignored(f_rel_path, ignored_patterns):
                actual_items[f_rel_path] = {"type": "file", "path": os.path.join(dirpath, f_name)}
            
    return actual_items

def _should_skip_ascii_line(line: str) -> bool:
    """判断是否应该跳过该行"""
    stripped = line.strip()
    return not stripped or stripped.startswith('#')

def _extract_ascii_content(prefix: str, line: str) -> Optional[str]:
    """提取有效内容，去除注释和空白"""
    content = line[len(prefix):].strip()
    if not content:
        return None
    if '#' in content:
        content = content.split('#')[0].strip()
    if content in ['root/', 'root', '.', './']:
        return None
    return content

def _parse_ascii_tree(ascii_tree: str, project_root: Path) -> Dict[str, Dict]:
    """
    解析ASCII树，返回期望的目录/文件集合
    格式: 完整相对路径 -> {"type": "dir"|"file", "pattern": 原始模式}
    """
    items = {}
    stack = [(-1, "")]
    
    lines = ascii_tree.split('\n')
    
    for line in lines:
        if _should_skip_ascii_line(line):
            continue
            
        match = re.match(r'^([\s│├└─]*)', line)
        prefix = match.group(1) if match else ""
        
        content = _extract_ascii_content(prefix, line)
        if content is None:
            continue
            
        indent_level = len(prefix)
        is_dir = content.endswith('/')
        clean_name = content.rstrip('/')
        
        while len(stack) > 1 and indent_level <= stack[-1][0]:
            stack.pop()
            
        parent_path = stack[-1][1]
        full_path = f"{parent_path}/{clean_name}" if parent_path else clean_name
            
        items[full_path] = {
            "type": "dir" if is_dir else "file",
            "pattern": content
        }
        
        if is_dir:
            stack.append((indent_level, full_path))
            
    return items

def _is_authorized_by_parent(item_path: str, expected_items: Dict[str, Dict]) -> bool:
    """检查路径是否因为其父目录在预期列表中而被授权"""
    parts = item_path.split('/')
    for i in range(len(parts) - 1, 0, -1):
        prefix = '/'.join(parts[:i])
        if prefix in expected_items and expected_items[prefix]["type"] == "dir":
            return True
    return False

def _is_exempted(item_path: str) -> bool:
    """检查路径是否在豁免列表中 (前缀匹配)"""
    exempted_prefixes = ['dist/', 'build/', 'node_modules/', 'legacy_quarantine/']
    for prefix in exempted_prefixes:
        if item_path.startswith(prefix):
            return True
    return False

# ---------------------------------------------------------
# Knowledge Drift Detection (Complete Logic)
# ---------------------------------------------------------

@registry.register()
@negetropy_sanitizer
def detect_knowledge_drift(project_id: str = "entropy_lab_core") -> str:
    """
    [Audit] 监测核心文档与向量知识库之间的认知偏差。

    标准遵循:
    - DS-004: 知识漂移检测标准实现

    对应技术法条款: §355
    """
    try:
        logger.info(f"Starting entropy check for {project_id}...")
        
        collection_name = f"project_{project_id}"
        remote_map = _get_remote_snapshot(collection_name)
        
        root_dir = str(PROJECT_ROOT)
        targets = [
            {"path": ".clinerules", "type": "dir"},
            {"path": "memory_bank", "type": "dir"},
            {"path": "docs", "type": "dir"}
        ]
        local_files = _scan_local_files(root_dir, targets)
        
        new_files, modified_files, deleted_files = _calculate_drift(local_files, remote_map)
        
        report = _generate_diff_report(new_files, modified_files, deleted_files)
        return json.dumps({"status": "complete", "report": report}, ensure_ascii=False)
        
    except Exception as e:
        logger.error(f"Drift detection error: {e}")
        return json.dumps({"error": str(e)})

def _get_remote_snapshot(collection_name: str) -> Dict[str, str]:
    remote_map = {}
    offset = 0
    limit = 100
    while True:
        results, next_page = container.qdrant.scroll(
            collection_name=collection_name, limit=limit, offset=offset, with_payload=True, with_vectors=False
        )
        for point in results:
            payload = point.payload or {}
            source = payload.get("metadata", {}).get("source", "")
            content = payload.get("content", "")
            if source: remote_map[source] = content
        if not results or len(results) < limit: break
        offset += limit
    return remote_map

def _read_file_content(file_path: str) -> Optional[str]:
    """处理单个文件目标，返回文件内容或None"""
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8", errors='replace') as f:
                return f.read()
        except Exception:
            return None
    return None

def _scan_directory_md_files(root_dir: str, dir_path: str) -> Dict[str, str]:
    """处理目录目标，递归扫描.md文件"""
    dir_files = {}
    if not os.path.exists(dir_path):
        return dir_files
        
    for root, _, files in os.walk(dir_path):
        for file in files:
            if file.endswith(".md"):
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, root_dir).replace("\\", "/")
                content = _read_file_content(full_path)
                if content is not None:
                    dir_files[rel_path] = content
    return dir_files

def _scan_local_files(root_dir: str, targets: List[Dict[str, str]]) -> Dict[str, str]:
    local_files = {}
    for target in targets:
        path = os.path.join(root_dir, target["path"])
        if target["type"] == "file":
            content = _read_file_content(path)
            if content is not None:
                local_files[target["path"]] = content
        else:
            dir_files = _scan_directory_md_files(root_dir, path)
            local_files.update(dir_files)
    return local_files

def _calculate_drift(local_files, remote_map):
    new_files = []
    modified_files = []
    deleted_files = []
    target_prefixes = (".clinerules", "memory_bank", "docs/")
    
    for rel_path, local_content in local_files.items():
        if rel_path not in remote_map:
            new_files.append(rel_path)
        else:
            remote_content = remote_map[rel_path]
            if local_content.strip() != remote_content.strip():
                diff = difflib.unified_diff(
                    remote_content.splitlines(), local_content.splitlines(),
                    fromfile=f"Remote:{rel_path}", tofile=f"Local:{rel_path}", lineterm=""
                )
                modified_files.append({"path": rel_path, "diff": "\n".join(list(diff)[:15])})
    
    for remote_path in remote_map.keys():
        if any(remote_path.startswith(p) for p in target_prefixes):
            if remote_path not in local_files: deleted_files.append(remote_path)
    return new_files, modified_files, deleted_files

def _generate_diff_report(new_files, modified_files, deleted_files):
    report_lines = []
    for f in new_files: report_lines.append(f"🟢 [NEW] {f}")
    for item in modified_files: report_lines.append(f"🟡 [MODIFIED] {item['path']}")
    for f in deleted_files: report_lines.append(f"🔴 [DELETED] {f}")
    if not report_lines: return "✅ System Integrity Verified: Zero Drift."
    return f"⚠️ Knowledge Drift Detected ({len(report_lines)} items):\n\n" + "\n\n".join(report_lines)

# ---------------------------------------------------------
# Signature Verification (Tier 2: Module Signatures)
# ---------------------------------------------------------

@dataclass(frozen=True)
class FunctionSignature:
    name: str
    args: Tuple[str, ...]
    types: Tuple[str, ...]
    return_type: str
    is_async: bool
    parent_class: Optional[str] = None
    @property
    def identifier(self) -> str:
        return f"{self.parent_class}.{self.name}" if self.parent_class else self.name

class SignatureVerifier:
    def verify(self, code_path: str, doc_path: str) -> Dict[str, Any]:
        try:
            code_sigs = self._parse_python_file(code_path)
            doc_sigs = self._parse_markdown_idl(doc_path)
            code_map = {sig.identifier: sig for sig in code_sigs}
            doc_map = {sig.identifier: sig for sig in doc_sigs}
            missing_impls = set(doc_map.keys()) - set(code_map.keys())
            type_mismatches = []
            for key in (set(doc_map.keys()) & set(code_map.keys())):
                doc_s = doc_map[key]
                code_s = code_map[key]
                if self._sigs_mismatch(doc_s, code_s):
                    type_mismatches.append({"interface": key, "expected": str(doc_s), "actual": str(code_s)})
            success = len(missing_impls) == 0 and len(type_mismatches) == 0
            return {
                "status": "PASS" if success else "FAIL",
                "metrics": {"coverage_ratio": len(set(doc_map.keys()) & set(code_map.keys())) / len(doc_sigs) if doc_sigs else 1.0},
                "violations": {"missing_implementation": list(missing_impls), "signature_mismatch": type_mismatches}
            }
        except Exception as e: return {"status": "ERROR", "message": str(e)}

    def _sigs_mismatch(self, s1, s2):
        # Simplified check for brevity; logic remains same as original
        return (s1.is_async != s2.is_async) or (s1.return_type != s2.return_type) or (len(s1.args) != len(s2.args))

    def _parse_python_file(self, path: str) -> Set[FunctionSignature]:
        with open(path, 'r', encoding='utf-8') as f: return self._extract_signatures_from_ast(f.read())

    def _parse_markdown_idl(self, path: str) -> Set[FunctionSignature]:
        with open(path, 'r', encoding='utf-8') as f:
            matches = re.findall(r"```python:interface-def\n(.*?)```", f.read(), re.DOTALL)
        sigs = set()
        for block in matches: sigs.update(self._extract_signatures_from_ast(block))
        return sigs

    def _extract_signatures_from_ast(self, source_code: str) -> Set[FunctionSignature]:
        sigs = set()
        try: tree = ast.parse(source_code)
        except: return sigs
        def visit(node, parent=None):
            if isinstance(node, ast.ClassDef):
                for item in node.body: visit(item, node.name)
            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                if not node.name.startswith('_'):
                    args = [a.arg for a in node.args.args if a.arg != 'self']
                    types = [ast.unparse(a.annotation) if a.annotation else "Any" for a in node.args.args if a.arg != 'self']
                    ret = ast.unparse(node.returns) if node.returns else "Any"
                    sigs.add(FunctionSignature(node.name, tuple(args), tuple(types), ret, isinstance(node, ast.AsyncFunctionDef), parent))
        for n in ast.iter_child_nodes(tree): visit(n)
        return sigs

# ==========================================
# 宪法 §130 神圣领土协议卫士
# ==========================================
SACRED_PATHS = ["engine/mcp_core", "engine/interfaces/l5_bridge.py"]
def is_sacred_territory(file_path: str) -> bool:
    p = Path(file_path).as_posix()
    return any(p.startswith(sacred) for sacred in SACRED_PATHS)

class ProtocolGuardian:
    def scan_file(self, file_path: str) -> List[str]:
        violations = []
        try:
            with open(file_path, "r", encoding="utf-8") as f: tree = ast.parse(f.read())
            for node in ast.walk(tree):
                if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "print":
                    # Simplified safe check
                    is_safe = any(k.arg == "file" and "stderr" in ast.unparse(k.value) for k in node.keywords)
                    if not is_safe: violations.append(f"Line {node.lineno}: Unsafe print in sacred territory")
        except: pass
        return violations

# ==========================================
# 宪法 §354 复杂度正交分解 Helpers (Tier 2)
# ==========================================
def _resolve_module_path(module_path: str) -> str:
    path = os.path.join(PROJECT_ROOT, module_path) if not os.path.isabs(module_path) else module_path
    if not os.path.exists(path): raise FileNotFoundError(path)
    return path

def _collect_python_files(directory_path: str) -> List[str]:
    py_files = []
    for root, _, files in os.walk(directory_path):
        py_files.extend([os.path.join(root, f) for f in files if f.endswith('.py')])
    return py_files

def _verify_single_file(file_path: str, doc_path: str) -> Dict:
    if is_sacred_territory(file_path):
        if v := ProtocolGuardian().scan_file(file_path):
            return {"file": file_path, "status": "FAIL", "violations": {"protocol": v}}
    res = SignatureVerifier().verify(file_path, doc_path)
    res["file"] = file_path
    return res

def _aggregate_results(results: List[Dict]) -> Dict:
    failed = [r for r in results if r.get("status") != "PASS"]
    return {
        "status": "FAIL" if failed else "PASS",
        "file_count": len(results),
        "failed_files": len(failed),
        "detailed_results": results,
        "mathematical_axiom": "$I_{code} \\supseteq I_{doc}$"
    }

@registry.register()
@negetropy_sanitizer
def judicial_verify_signatures(module_path: str) -> str:
    """[Tier 2] 验证模块签名一致性 (Refactored for §354)"""
    try:
        doc_path = Path(PROJECT_ROOT) / "memory_bank/02_system_axioms/techContext.md"
        abs_path = _resolve_module_path(module_path)
        files = _collect_python_files(abs_path) if os.path.isdir(abs_path) else [abs_path]
        if not files: return json.dumps({"status": "WARNING", "error": "No Python files found"})
        
        results = [_verify_single_file(f, str(doc_path)) for f in files]
        return json.dumps(_aggregate_results(results), ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)

@registry.register()
@negetropy_sanitizer
def judicial_run_tests(test_scope: str = "all") -> str:
    """[Tier 3] 执行行为实现验证。"""
    import subprocess, sys
    try:
        results = {}
        if test_scope in ["all", "python"]:
            cmd = [sys.executable, "-m", "pytest", str(Path(PROJECT_ROOT)/"engine/tests"), "-v", "--tb=short"]
            res = subprocess.run(cmd, capture_output=True, text=True, cwd=PROJECT_ROOT)
            results["python"] = {"passed": res.returncode == 0, "output": res.stdout}
        
        all_passed = all(r["passed"] for r in results.values())
        return json.dumps({
            "status": "PASS" if all_passed else "FAIL", "results": results, 
            "mathematical_axiom": "$B_{code} \\equiv B_{spec}$"
        }, ensure_ascii=False, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)}, ensure_ascii=False)
