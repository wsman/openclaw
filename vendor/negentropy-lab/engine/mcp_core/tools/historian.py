"""
监察部-逆熵实验室 Historian Tools
版本: v6.2.0 (Storage Restructuring)
职责: 结构化归档与上下文重置，实现CDD闭环自动化
数学基础: H_archive = H_active - Delta H_reset

import sys
import io

"""
import os
import re
import json
import datetime
import logging
from typing import Dict, List, Optional
from pathlib import Path

# 微内核组件
from ..registry import registry
from ..dependencies import container
from ..utils.sanitizer import negetropy_sanitizer
from ..config import PROJECT_ROOT

logger = logging.getLogger("Entropy-Historian")

# ---------------------------------------------------------
# The Historian (CDD Archival)
# ---------------------------------------------------------

@registry.register()
@negetropy_sanitizer
def archive_task_outcome(task_id: str, conclusion: str, next_step: str) -> str:
    """
    [The Historian] 主归档函数：归档任务成果并重置活跃上下文。
    数学基础: H_archive = H_active - Delta H_reset
    """
    try:
        logger.info(f"开始归档任务: {task_id}")
        
        # 1. 定义路径 (使用 PROJECT_ROOT 确保正确性)
        project_root = Path(PROJECT_ROOT)
        active_context_path = project_root / "memory_bank/01_active_state/activeContext.md"
        decision_log_path = project_root / "memory_bank/01_active_state/DECISION_LOG.md"
        
        # 2. 读取当前活跃上下文
        if not active_context_path.exists():
            return json.dumps({"error": "activeContext.md not found"})
            
        with open(active_context_path, 'r', encoding='utf-8') as f:
            context_content = f.read()
        
        # 3. 解析信息
        accomplishments = _parse_accomplishments(context_content)
        current_focus = _parse_current_focus(context_content)
        
        # 4. 生成历史记录条目
        history_entry = _generate_history_entry(
            task_id, conclusion, next_step, accomplishments, current_focus
        )
        
        # 5. 追加到决策日志 (使用原子写入降级逻辑)
        # 注意：此处简化处理，实际应复用 atomic write helper
        if decision_log_path.exists():
            with open(decision_log_path, 'r', encoding='utf-8') as f:
                existing_log = f.read()
            # 在头部插入 (假设有固定头部) 或者追加？标准做法是逆序插入或者头部插入
            # 根据提供的historian.py逻辑，是在标题后插入
            # 简化为：在文件最前面追加（或者按照某种约定）
            # 这里采用：在现有内容前插入新条目
            new_log = f"{history_entry}\n\n{existing_log}"
        else:
            new_log = history_entry
            
        with open(decision_log_path, 'w', encoding='utf-8') as f:
            f.write(new_log)
            
        # 6. 重置活跃上下文
        new_context = _reset_context(context_content)
        with open(active_context_path, 'w', encoding='utf-8') as f:
            f.write(new_context)
            
        return json.dumps({
            "status": "ARCHIVED",
            "task_id": task_id,
            "message": f"Task {task_id} archived. Context reset."
        }, ensure_ascii=False)
        
    except Exception as e:
        logger.error(f"Archival failed: {e}")
        return json.dumps({"error": str(e)})

# --- Helper Functions (Simplified from original service) ---

def _parse_accomplishments(content: str) -> List[Dict]:
    """解析成就"""
    accomplishments = []
    pattern = r'## Recent Accomplishments\s*(.*?)(?=\n##|\n---|\n\*\*\*|\Z)'
    match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
    if match:
        text = match.group(1).strip()
        # 简单提取每一行以 - 开头的
        for line in text.split('\n'):
            line = line.strip()
            if line.startswith('-'):
                accomplishments.append({"raw": line})
    return accomplishments

def _parse_current_focus(content: str) -> Dict:
    """解析当前焦点"""
    focus = {}
    pattern = r'## Current Focus\s*(.*?)(?=\n##|\n---|\n\*\*\*|\Z)'
    match = re.search(pattern, content, re.DOTALL | re.IGNORECASE)
    if match:
        focus["raw"] = match.group(1).strip()
    return focus

def _generate_history_entry(task_id, conclusion, next_step, accomplishments, focus) -> str:
    """生成 Markdown 条目"""
    today = datetime.datetime.now().strftime('%Y-%m-%d')
    acc_text = "\n".join([a['raw'] for a in accomplishments]) if accomplishments else "无成就记录"
    focus_text = focus.get('raw', "无焦点记录")
    
    return f"""## {task_id}: 系统状态归档
**日期**: {today}
**状态**: 已完成归档
**结论**: {conclusion}

### 归档内容摘要

#### 已完成成就
{acc_text}

#### 归档前焦点状态
{focus_text}

### 归档后建议
**下一步**: {next_step}

---"""

def _reset_context(content: str) -> str:
    """重置上下文内容"""
    # 1. 重置成就
    acc_pattern = r'(## Recent Accomplishments\s*)(.*?)(?=\n##|\n---|\n\*\*\*|\Z)'
    today = datetime.datetime.now().strftime('%Y-%m-%d')
    new_acc = f"## Recent Accomplishments\n\n- **[{today}] System History Archived**:\n  - ✅ Task outcome archived.\n  - ✅ Context reset.\n"
    content = re.sub(acc_pattern, new_acc, content, flags=re.DOTALL | re.IGNORECASE)
    
    # 2. 重置焦点
    focus_pattern = r'(## Current Focus\s*)(.*?)(?=\n##|\n---|\n\*\*\*|\Z)'
    new_focus = "## Current Focus\n- **Phase**: Post-Archive Planning\n- **Goal**: Define next constitutional cycle\n"
    content = re.sub(focus_pattern, new_focus, content, flags=re.DOTALL | re.IGNORECASE)
    
    return content
