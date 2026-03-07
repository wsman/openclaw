---
type: Standard
id: DS-010
status: Active
relationships:
  implements: [LAW-TECH#§311.2]
  verifies: [LAW-BASIC#§137]
  related_to: [DS-011]
  required_by: [WF-201]
tags: [mcp, strategy, governance, tier-2]
---
# DS-010: MCP工具策略标准实现

**父索引**: [技术法索引](../t0_core/technical_law_index.md)
**对应技术法**: §311.2
**宪法依据**: §122 (质量门控与标准), §137 (语义门控)
**版本**: v7.0.0 (Negentropy-Lab)
**状态**: 🟢 生产就绪

---

**对应技术法条款**: §311.2
**宪法依据**: §137 (语义门控)
**适用场景**: MCP工具中的知识存储决策流程

### 问题背景
在存储知识前必须进行语义门控和质量审计，遵循完整的三阶段决策流程，以确保知识库的质量和逆熵特性。

### 强制标准
所有MCP工具在存储知识前必须调用`mcp_tool_usage_strategy`函数，执行完整的三阶段决策流程。

### 标准实现模式

```python
def mcp_tool_usage_strategy(content: str, context: dict) -> str:
    """
    MCP工具使用策略标准实现
    遵循宪法 §137 的完整三阶段决策流程
    """
    from entropy_lab.mcp_tools import check_relevance, audit_content, store_project_knowledge
    
    # 1. 语义门控 (§137)
    relevance = check_relevance(content, context["project_id"])
    if relevance.score < 0.6:
        return "REJECT"
    
    # 2. 质量审计 (§136)
    audit = audit_content(content, context.get("goal"))
    if audit.verdict == "REJECTED" or audit.snr_db < 1.0:
        return "REFACTOR"
    
    # 3. 自动存储决策
    if relevance.score >= 0.8 and audit.negentropy_index >= 80:
        store_project_knowledge(content, context["project_id"])
        return "AUTO_STORE"
    
    # 4. 人工审核区域
    return "MANUAL_REVIEW"
```

### 使用示例

```python
# 在MCP工具中调用策略
context = {"project_id": "entropy_lab_core", "goal": "存储项目文档"}
decision = mcp_tool_usage_strategy(content, context)
if decision == "AUTO_STORE":
    # 自动存储
    pass
elif decision == "MANUAL_REVIEW":
    # 提示人工审核
    pass
```

### 监控指标
- `mcp_strategy_reject_rate`: 策略拒绝率
- `mcp_strategy_auto_store_rate`: 自动存储率
- `mcp_strategy_manual_review_rate`: 人工审核率

---

**宪法依据**: §137 (语义门控), §311.2 (MCP工具策略标准)  
**维护状态**: 活跃维护  
**最后更新**: 2026-02-11  
**移植来源**: MY-DOGE-DEMO v6.8.0