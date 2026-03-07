"""
监察部-逆熵实验室 Genesis Tools
版本: v4.3 (Renaissance)
职责: 项目创世、脚手架生成与知识同步

import sys
import io

"""
import os
import json
import time
import shutil
import uuid
import logging
import glob
from typing import List, Optional
from qdrant_client.http import models

logger = logging.getLogger("Entropy-Genesis")

# 微内核组件
from ..registry import registry
from ..dependencies import container
from ..utils.sanitizer import negetropy_sanitizer
from ..config import PROJECTS_FILE, PROJECT_ROOT, STRICT_DIMENSION

# 导入原子文件操作 (从 engine.utils 导入)
try:
    from engine.utils.file_ops import AtomicFileHandler
    HAS_ATOMIC_OPS = True
except ImportError:
    HAS_ATOMIC_OPS = False
    logger.warning("AtomicFileHandler not available, atomic writes will be degraded.")

# 导入模板 (路径修正)
try:
    from templates import CLINERULES_TEMPLATE, ACTIVE_CONTEXT_TEMPLATE, PROJECT_CONTEXT_TEMPLATE
except ImportError:
    # Fallback Templates
    CLINERULES_TEMPLATE = "# Default .clinerules"
    ACTIVE_CONTEXT_TEMPLATE = "# Default Context"
    PROJECT_CONTEXT_TEMPLATE = "# Default Project Context"

# ---------------------------------------------------------
# Project Management (CRUD)
# ---------------------------------------------------------

@registry.register()
def list_projects() -> str:
    """[Management] 列出所有已注册的项目。"""
    try:
        container.project_registry.refresh()
        projects = container.project_registry.projects
        
        info = []
        for pid, data in projects.items():
            info.append({
                "id": pid,
                "description": data.get("description", ""),
                "protected": data.get("protected", False)
            })
        return json.dumps(info, indent=2, ensure_ascii=False)
    except Exception as e:
        return json.dumps({"error": str(e)})

@registry.register()
def create_project(project_id: str, anchor: str, description: str = "") -> str:
    """[Management] 创建新项目配置。"""
    if not project_id or not anchor:
        return "Error: project_id and anchor required."
    
    if container.project_registry.create_project(project_id, anchor, description):
        return json.dumps({"status": "success", "message": f"Project '{project_id}' created."})
    return json.dumps({"status": "error", "message": f"Failed to create '{project_id}' (maybe exists?)."})

@registry.register()
def delete_project(project_id: str) -> str:
    """[Management] 删除项目（受保护项目除外）。"""
    if container.project_registry.delete_project(project_id):
        return json.dumps({"status": "success", "message": f"Project '{project_id}' deleted."})
    return json.dumps({"status": "error", "message": f"Failed to delete '{project_id}' (protected or not found)."})

# ---------------------------------------------------------
# Genesis Protocol (Scaffolding)
# ---------------------------------------------------------

@registry.register()
def scaffold_negentropy_project(project_name: str, target_path: str, description: str) -> str:
    """
    [Genesis] 初始化标准逆熵项目结构。
    1. 生成分层目录结构 (memory_bank/system & project).
    2. 继承核心知识模版.
    3. 生成项目特有的上下文文档.
    4. 注册项目到系统.
    """
    try:
        safe_name = "".join(c for c in project_name.lower() if c.isalnum() or c == '_')
        base_path = os.path.join(target_path, safe_name)
        
        if os.path.exists(base_path):
            return json.dumps({"status": "error", "message": f"Path {base_path} exists."})

        # 1. 创建目录结构
        dirs = [
            "src", "docs", "tests/unit", "tests/manual", 
            "memory_bank/system",   # [Core] 继承区
            "memory_bank/project"   # [Custom] 项目区
        ]
        for d in dirs:
            os.makedirs(os.path.join(base_path, d), exist_ok=True)

        # 2. 继承模版
        template_src = os.path.join(PROJECT_ROOT, "memory_bank/data/templates/core_knowledge")
        target_dst = os.path.join(base_path, "memory_bank/system")
        
        inherited_files = []
        if os.path.exists(template_src):
            for item in os.listdir(template_src):
                s = os.path.join(template_src, item)
                d = os.path.join(target_dst, item)
                if os.path.isfile(s):
                    shutil.copy2(s, d)
                    inherited_files.append(item)
        
        # 3. 生成上下文文档 (原子写入)
        if HAS_ATOMIC_OPS:
            clinerules_path = os.path.join(base_path, ".clinerules")
            AtomicFileHandler.write_text(clinerules_path, CLINERULES_TEMPLATE)
            
            active_context_path = os.path.join(base_path, "memory_bank", "project", "activeContext.md")
            AtomicFileHandler.write_text(active_context_path, ACTIVE_CONTEXT_TEMPLATE)

            project_context_path = os.path.join(base_path, "memory_bank", "project", "projectContext.md")
            AtomicFileHandler.write_text(project_context_path, PROJECT_CONTEXT_TEMPLATE.format(description=description))
            
            requirements_path = os.path.join(base_path, "memory_bank", "project", "requirements.md")
            requirements_content = f"# Project Requirements\n\n## Overview\n{description}\n"
            AtomicFileHandler.write_text(requirements_path, requirements_content)
        else:
            # 降级处理
            logger.warning("AtomicFileHandler not available, using normal file write.")
            with open(os.path.join(base_path, ".clinerules"), 'w', encoding='utf-8') as f:
                f.write(CLINERULES_TEMPLATE)
            with open(os.path.join(base_path, "memory_bank", "project", "activeContext.md"), 'w', encoding='utf-8') as f:
                f.write(ACTIVE_CONTEXT_TEMPLATE)
            with open(os.path.join(base_path, "memory_bank", "project", "projectContext.md"), 'w', encoding='utf-8') as f:
                f.write(PROJECT_CONTEXT_TEMPLATE.format(description=description))
            with open(os.path.join(base_path, "memory_bank", "project", "requirements.md"), 'w', encoding='utf-8') as f:
                f.write(f"# Project Requirements\n\n## Overview\n{description}\n")
        
        # 4. 注册项目与集合
        container.project_registry.create_project(safe_name, description, description)
        _ensure_collection_exists(safe_name)
        
        result = {
            "status": "success",
            "message": f"Genesis Complete: Project '{safe_name}' scaffolded at {base_path}.",
            "inherited_files": inherited_files,
            "collection": f"project_{safe_name}"
        }
        return json.dumps(result, indent=2, ensure_ascii=False)
        
    except Exception as e:
        logger.error(f"Scaffold failed: {e}")
        return json.dumps({"status": "error", "message": str(e)})

# ---------------------------------------------------------
# Synchronization
# ---------------------------------------------------------

@registry.register()
def sync_memory_bank(project_id: str, memory_bank_path: str) -> str:
    """
    [Sync] 将 Memory Bank 文档同步到向量库。
    支持单文件或目录递归扫描。
    """
    if not container.project_registry.project_exists(project_id):
        return json.dumps({"status": "error", "message": f"Project '{project_id}' not found."})

    synced_count = 0
    synced_files = []
    try:
        if os.path.isfile(memory_bank_path):
            files = [memory_bank_path]
        else:
            files = glob.glob(os.path.join(memory_bank_path, "**", "*.md"), recursive=True)

        collection_name = f"project_{project_id}"
        _ensure_collection_exists(project_id)
        
        for fpath in files:
            with open(fpath, "r", encoding="utf-8") as f:
                content = f.read()
            
            if os.path.isfile(memory_bank_path):
                rel_path = os.path.basename(fpath)
            else:
                rel_path = os.path.relpath(fpath, memory_bank_path)

            # 使用 engine.calculate_vector 获取向量
            vector_result = container.engine.calculate_vector(content)
            vector = vector_result.get("mean", [])
            if not vector or len(vector) != STRICT_DIMENSION:
                logger.warning(f"Skipping {rel_path}: vector dimension mismatch")
                continue

            point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, content))
            
            container.qdrant.upsert(
                collection_name=collection_name,
                points=[
                    models.PointStruct(
                        id=point_id,
                        vector=vector,
                        payload={
                            "content": content,
                            "metadata": {
                                "tags": ["memory_bank", "sync"],
                                "project": project_id,
                                "source": rel_path
                            },
                            "timestamp": int(time.time())
                        }
                    )
                ]
            )
            synced_count += 1
            synced_files.append(rel_path)
            
        result = {
            "status": "success",
            "message": f"Synced {synced_count} files to '{project_id}'.",
            "synced_count": synced_count,
            "synced_files": synced_files[:10]  # 只返回前10个，避免过长
        }
        return json.dumps(result, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Sync failed: {e}")
        return json.dumps({"status": "error", "message": str(e)})

def _ensure_collection_exists(project_id: str):
    collection_name = f"project_{project_id}"
    try:
        collections = container.qdrant.get_collections()
        existing = [col.name for col in collections.collections]
        if collection_name not in existing:
            container.qdrant.create_collection(
                collection_name=collection_name,
                vectors_config=models.VectorParams(
                    size=STRICT_DIMENSION, 
                    distance=models.Distance.COSINE
                )
            )
            logger.info(f"Collection created: {collection_name}")
    except Exception as e:
        logger.error(f"Failed to ensure collection: {e}")
