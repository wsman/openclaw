---
type: Standard
id: DS-011
status: Active
relationships:
  implements: [LAW-TECH#§311.1, LAW-TECH#§331]
  verifies: [LAW-BASIC#§135, LAW-BASIC#§130]
  related_to: [DS-010]
  required_by: [WF-201]
tags: [mcp, service, registration, tier-2]
---
# DS-011: MCP服务标准实现

**父索引**: [技术法索引](../t0_core/technical_law_index.md)
**对应技术法**: §311.1, §331
**宪法依据**: §122 (质量门控与标准), §135 (输出卫生), §130 (MCP微内核神圣公理)
**版本**: v7.0.0 (Negentropy-Lab)
**状态**: 🟢 生产就绪

---

**对应技术法条款**: §311.1, §331
**宪法依据**: §135 (输出卫生), §130 (MCP微内核神圣公理)
**适用场景**: MCP工具的输出消毒和工具注册

### 问题背景
MCP工具返回大量数据（如向量）时，必须进行截断或摘要，防止上下文溢出。同时，MCP工具需要统一的注册机制，确保工具发现、管理和执行的确定性。

### 强制标准
所有MCP工具必须使用输出消毒装饰器，并通过`@registry.register()`装饰器注册。

### 标准实现模式

#### 输出消毒装饰器

```python
import functools
import json

def negetropy_sanitizer(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        result = func(*args, **kwargs)
        # 如果结果是字符串，尝试解析为 JSON
        if isinstance(result, str):
            try:
                data = json.loads(result)
                # 截断逻辑... (参见 mcp_core/utils/sanitizer.py)
                return json.dumps(data, ensure_ascii=False)
            except:
                pass
        return result
    return wrapper
```

#### 工具注册装饰器

```python
# 工具注册装饰器示例
from mcp_core.registry import registry

@registry.register()
def example_tool(param: str) -> dict:
    """示例工具"""
    return {"result": param}
```

### 使用示例

```python
@negetropy_sanitizer
@registry.register()
def get_project_knowledge(project_id: str) -> dict:
    """获取项目知识"""
    # ... 实现逻辑
    return knowledge_data
```

### 监控指标
- `mcp_tools_registered_count`: 已注册工具数量
- `mcp_sanitizer_applied_count`: 输出消毒应用次数

---

**宪法依据**: §130 (MCP微内核神圣公理), §135 (输出卫生), §311.1 (MCP服务标准), §331 (工具注册规范)  
**维护状态**: 活跃维护  
**最后更新**: 2026-02-11  
**移植来源**: MY-DOGE-DEMO v6.8.0