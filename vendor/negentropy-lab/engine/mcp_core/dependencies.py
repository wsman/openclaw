"""
监察部-逆熵实验室 MCP Core Dependencies
版本: v6.2.0 (Storage Restructuring)
职责: 依赖注入容器，管理全局单例
"""

import sys
import logging
import time
import os
import contextlib
from typing import Dict, List, Optional
try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    # 极简 Mock FastMCP，用于 Phase 4.1-Lite 环境演示
    class FastMCP:
        def __init__(self, name): self.name = name
        def tool(self): return lambda f: f
        def resource(self, path): return lambda f: f
        def prompt(self, name): return lambda f: f
        def run(self, *args, **kwargs): 
            import sys
            sys.stderr.write(f"Mock MCP Server '{self.name}' is NOT actually running (missing 'mcp' library).\n")
            import time
            while True: time.sleep(100)

try:
    from qdrant_client import QdrantClient
    HAS_QDRANT_CLIENT = True
except ImportError:
    HAS_QDRANT_CLIENT = False
    try:
        from engine.utils.mock_qdrant import MockQdrantClient as QdrantClient
        sys.stderr.write("已加载内存版 MockQdrantClient (missing 'qdrant-client' library).\n")
    except ImportError:
        # 最后的保底
        class QdrantClient:
            def __init__(self, *args, **kwargs): pass
            def upsert(self, *args, **kwargs): pass
            def scroll(self, *args, **kwargs): return [], None
            def search(self, *args, **kwargs): return []
            def count(self, *args, **kwargs): return type('C', (), {'count': 0})()
            def get_collection(self, *args, **kwargs): return type('C', (), {'status': 'mock'})()

from .config import MCP_SERVER_NAME, QDRANT_URL, PROJECTS_FILE, DATA_DIR, QDRANT_MODE, QDRANT_PATH

logger = logging.getLogger("Entropy-Dependencies")

# ==========================================
# 1. 核心引擎 (Entropy Engine)
# ==========================================
try:
    # 临时重定向 stdout 到 stderr，防止引擎初始化时的 print 污染 MCP 协议
    with contextlib.redirect_stdout(sys.stderr):
        from negentropy_engine_simple import EntropyEngine
except ImportError as e:
    # [CRITICAL FIX] 使用 sys.stderr 确保错误可见，避免静默退出导致 "Connection closed"
    sys.stderr.write(f"\n[FATAL ERROR] Failed to import EntropyEngine: {e}\n")
    sys.stderr.write("请检查 sys.path 设置以及 negentropy_engine_simple.py 是否存在于 engine/ 目录下。\n")
    sys.exit(1)

# ==========================================
# 2. 外部服务可选依赖
# ==========================================
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

try:
    from circuitbreaker import circuit
    HAS_CIRCUITBREAKER = True
except ImportError:
    HAS_CIRCUITBREAKER = False

# ==========================================
# 3. Project Registry (依赖 AtomOps)
# ==========================================
try:
    from engine.utils.file_ops import AtomicFileHandler
    HAS_ATOMIC_OPS = True
except ImportError as e:
    logger.warning(f"AtomicFileHandler not available: {e}")
    HAS_ATOMIC_OPS = False

class ProjectRegistry:
    """管理多项目配置的注册表 (移植版)"""
    
    def __init__(self):
        self._ensure_data_dir()
        self.projects = self._load_projects()
        
    def _ensure_data_dir(self):
        if not DATA_DIR.exists():
            try:
                DATA_DIR.mkdir(parents=True, exist_ok=True)
            except OSError as e:
                logger.error(f"Cannot create data dir {DATA_DIR}: {e}")
        
        if not PROJECTS_FILE.exists():
            default_core = {
                "entropy_lab_core": {
                    "anchor": "逆熵计算、数学证明、系统架构、代码质量、香农熵、信噪比、宪法约束、NV-Embed-v2、4096维度",
                    "description": "逆熵实验室核心真理库 (System Axioms)",
                    "created_at": int(time.time()),
                    "protected": True
                }
            }
            if HAS_ATOMIC_OPS:
                AtomicFileHandler.write_json(str(PROJECTS_FILE), default_core)
            else:
                # 降级写入
                import json
                try:
                    with open(PROJECTS_FILE, 'w', encoding='utf-8') as f:
                        json.dump(default_core, f, ensure_ascii=False, indent=2)
                except OSError as e:
                    logger.error(f"Failed to write initial projects file: {e}")

    def _load_projects(self) -> Dict:
        try:
            if HAS_ATOMIC_OPS:
                AtomicFileHandler.repair_if_corrupted(str(PROJECTS_FILE))
                return AtomicFileHandler.read_json(str(PROJECTS_FILE))
            else:
                import json
                if not PROJECTS_FILE.exists():
                    return {}
                with open(PROJECTS_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load projects: {e}")
            return {}
            
    def refresh(self):
        self.projects = self._load_projects()

    def list_projects(self) -> List[str]:
        return list(self.projects.keys())

    def project_exists(self, project_id: str) -> bool:
        return project_id in self.projects
        
    def get_anchor(self, project_id: str) -> Optional[str]:
        return self.projects.get(project_id, {}).get("anchor")
        
    def is_protected(self, project_id: str) -> bool:
        return self.projects.get(project_id, {}).get("protected", False)

    def create_project(self, project_id: str, anchor: str, description: str = "") -> bool:
        if project_id in self.projects:
            return False
        
        self.projects[project_id] = {
            "anchor": anchor,
            "description": description,
            "created_at": int(time.time()),
            "protected": False
        }
        
        if HAS_ATOMIC_OPS:
            return AtomicFileHandler.write_json(str(PROJECTS_FILE), self.projects)
        else:
            import json
            try:
                with open(PROJECTS_FILE, 'w', encoding='utf-8') as f:
                    json.dump(self.projects, f, ensure_ascii=False, indent=2)
                return True
            except OSError:
                return False

    def delete_project(self, project_id: str) -> bool:
        if project_id not in self.projects:
            return False
        if self.is_protected(project_id):
            return False
        
        del self.projects[project_id]
        
        if HAS_ATOMIC_OPS:
            return AtomicFileHandler.write_json(str(PROJECTS_FILE), self.projects)
        else:
            import json
            try:
                with open(PROJECTS_FILE, 'w', encoding='utf-8') as f:
                    json.dump(self.projects, f, ensure_ascii=False, indent=2)
                return True
            except OSError:
                return False

class Container:
    _instance = None
    
    def __init__(self):
        # 这里的 print 绝对禁止，FastMCP 会接管
        self.mcp = FastMCP(MCP_SERVER_NAME)
        
        try:
            self.engine = EntropyEngine()
        except Exception as e:
            sys.stderr.write(f"[FATAL] EntropyEngine initialization failed: {e}\n")
            raise

        if QDRANT_MODE == "local":
            self.qdrant = QdrantClient(path=QDRANT_PATH)
        else:
            self.qdrant = QdrantClient(url=QDRANT_URL)
        self.project_registry = ProjectRegistry()
        self.circuit = circuit if HAS_CIRCUITBREAKER else None
        
        # 懒加载高级模块
        self.artisan = None
        self.compliance = None
        self.librarian = None
        self._init_optional_modules()
        
    def _init_optional_modules(self):
        try:
            from code_artisan import CodeArtisan
            from compliance_officer import ComplianceOfficer
            from librarian import Librarian
            
            self.artisan = CodeArtisan()
            self.compliance = ComplianceOfficer()
            self.librarian = Librarian()
        except ImportError as e:
            logger.debug(f"Optional modules skipped: {e}")
            pass 

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

# 全局单例
container = Container.get_instance()
