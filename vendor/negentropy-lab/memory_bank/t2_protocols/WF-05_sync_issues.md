# WF-SYNC-ISSUES: GitHub Issues 同步协议

/**
 * 宪法依据：
 * - §201 CDD工作流规范：任务同步是State B/C的重要环节
 * - §152 单一真理源公理：任务清单文档作为原子任务的单一来源
 * - §101 同步公理：GitHub Issues与任务清单保持双向同步
 * - §109 协作流程公理：支持多Agent协作的任务追踪
 */


**版本**: v1.5.0  
**协议类型**: T2-工作流协议  
**触发**: State B (Tasking结束) 或 State C (执行中)

---

## 1. 目标

将任务清单文档中的 Markdown 任务自动转换为 GitHub Issues，并保持双向链接。

## 2. 前置检查

1. **Git Remote**: 必须配置了指向 GitHub 的 remote.origin.url
2. **MCP Server**: GitHub MCP Server 必须活跃
3. **任务清单**: 必须存在可追踪的任务清单文档（推荐 `memory_bank/t2_standards/DS-28_feature_specification.md`）

## 3. 执行流程

### Step 1: 解析任务
扫描任务清单中未标记 Issue ID 的任务：
- `- [ ] {Task}` → ✅ 新任务，需要同步
- `- [ ] {Task} [#123]` → ⏭️ 已同步，跳过
- `- [x] {Task}` → ⏭️ 已完成，跳过

### Step 2: 创建 Issue
调用 GitHub API 创建 Issue：
```markdown
**Title**: `[Task] {Task Description}`
**Body**: 包含来源、上下文、相关规范
**Labels**: `cdd-task`, `feature-{feature-id}`
```

### Step 3: 回写链接
更新任务清单，添加 Issue 链接：
```
- [ ] 实现用户登录接口 → - [ ] 实现用户登录接口 [#101]
```

## 4. 异常处理

| 场景 | 处理方式 |
|------|----------|
| Remote Mismatch | 终止并警告 |
| API Rate Limit | 暂停并提示 |
| MCP 不可用 | 跳过同步，记录警告 |
| Issue 创建失败 | 记录错误，继续下一任务 |

---

**版本**: v1.5.0
