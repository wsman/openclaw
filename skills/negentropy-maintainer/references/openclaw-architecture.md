# OpenClaw 架构与当前 Negentropy 叠加层审计

**审计日期**: 2026-03-08  
**OpenClaw 版本**: 2026.3.8  
**审计基准**: 当前仓库代码快照（已合并 `origin/main`）  
**文档级别**: Maintainer reference

> 本文档只记录已从当前代码中核对出的事实，并把 Negentropy 维护栈与 OpenClaw 宿主架构明确拆开描述。高漂移数字保留最少、尽量引用可复核入口，避免再次变成“手写快照”。

---

## 1. 当前结论

当前工作树不是“纯 upstream OpenClaw”，而是：

1. **官方 OpenClaw 宿主核心**
2. **本地 Negentropy 维护技能层**
3. **Negentropy OpenClaw 运行时扩展层**
4. **Negentropy 外部后端 vendor 快照层**
5. **本地 stack wiring 与同步脚本层**

与旧版结论相比，当前最重要的变化是：

- OpenClaw 已更新到 `2026.3.8`
- Negentropy 扩展不再只是 `gateway_request` 决策桥
- 现在还包含 **workflow orchestration bridge**
- vendor 后端中已经存在完整的 `openclaw-orchestration` 模块
- 宿主侧 HTTP 入口已经统一接入通用策略辅助层
- 仓库中已有 `negentropy:v11:live-smoke` 验证入口

---

## 2. 已核对事实

下表中的内容都已从当前代码重新核对：

| 项目 | 当前事实 | 依据 |
|------|----------|------|
| OpenClaw 版本 | `2026.3.8` | `package.json` |
| 扩展目录数量 | `43` 个目录 | `extensions/` 目录扫描 |
| Gateway 方法数 | `95` | 运行 `listGatewayMethods()` |
| Gateway 事件数 | `19` | `src/gateway/server-methods-list.ts` |
| Negentropy vendor 版本 | `7.6.0` | `vendor/negentropy-lab/package.json` |
| 决策模式 | `OFF` / `SHADOW` / `ENFORCE` | `extensions/negentropy-lab/openclaw.plugin.json` |
| Workflow bridge | 已接入 | `extensions/negentropy-lab/index.ts` |
| Workflow internal API | 已挂到 `/internal/openclaw` | `vendor/negentropy-lab/server/gateway/openclaw-decision/api/internal-api.ts` |
| 自定义维护脚本 | 已存在 | `scripts/custom-stack.mjs` |
| Live smoke 命令 | 已存在 | `package.json` |

---

## 3. OpenClaw 宿主核心架构

### 3.1 入口链路

当前主机侧入口链路可以概括为：

- `src/entry.ts`：Node 入口包装、环境归一化、进程级保护
- `src/cli/run-main.ts`：CLI 参数重写、环境装载、命令路由
- `src/gateway/server.ts`：导出 Gateway 启动函数
- `src/gateway/server.impl.ts`：Gateway 控制平面实际实现

这说明旧文档里“入口链路”这个判断仍然成立，但版本与上下文已经变化，不能继续写死旧版本号和个人本地路径。

### 3.2 Gateway 控制平面

OpenClaw 仍然以 `src/gateway/` 作为控制平面核心，负责：

- WebSocket Gateway 协议
- HTTP 兼容入口
- 配置与状态方法
- 运行时 sidecars
- 定时维护、发现、重载等生命周期逻辑

当前 Gateway 的方法与事件真值应来自：

- `src/gateway/server-methods-list.ts`
- 运行时 `listGatewayMethods()`
- `GATEWAY_EVENTS`

不要再把旧行号当成长期稳定锚点；现在 `listGatewayMethods()` 已经是函数，不是旧的静态导出列表。

### 3.3 插件与扩展边界

宿主通用扩展边界仍然集中在：

- `src/plugins/types.ts`
- `src/plugins/hooks.ts`
- `src/plugin-sdk/core.ts`

对 Negentropy 这类集成来说，当前最关键的通用宿主接入点是：

- `gateway_request`
- `subagent_spawning`
- `subagent_spawned`
- `subagent_ended`
- `session_start`
- `session_end`

这意味着旧版“Negentropy 只通过 `gateway_request` 接入”的描述已经不完整。

---

## 4. Negentropy 维护栈的当前分层

### 4.1 `skills/negentropy-maintainer`

职责：维护流程、分层边界、同步策略、提交边界、上游比较规则。  
它不参与运行时行为。

关键文件：

- `skills/negentropy-maintainer/SKILL.md`
- `skills/negentropy-maintainer/references/module-map.md`
- `skills/negentropy-maintainer/references/long-term-maintenance.md`
- `skills/negentropy-maintainer/references/change-playbooks.md`

### 4.2 `extensions/negentropy-lab`

职责：OpenClaw 运行时桥接层。  
当前不只负责“决策桥”，还负责“工作流桥”和命令面。

当前已核对到的能力包括：

- 决策桥配置解析
- `gateway_request` 处理
- workflow client / workflow bridge
- 工作流事件映射
- `/negentropy workflow ...` 命令处理
- 决策契约快照对齐测试

关键文件：

- `extensions/negentropy-lab/index.ts`
- `extensions/negentropy-lab/openclaw.plugin.json`
- `extensions/negentropy-lab/src/decision-bridge.ts`
- `extensions/negentropy-lab/src/gateway-request.ts`
- `extensions/negentropy-lab/src/workflow-config.ts`
- `extensions/negentropy-lab/src/workflow-client.ts`
- `extensions/negentropy-lab/src/workflow-bridge.ts`
- `extensions/negentropy-lab/src/workflow-command.ts`
- `extensions/negentropy-lab/src/workflow-events.ts`
- `extensions/negentropy-lab/src/decision-contract.snapshot.ts`

### 4.3 `vendor/negentropy-lab`

职责：外部 Negentropy-Lab 后端快照。  
当前已不只是“决策服务”代码快照，还包含工作流编排后端。

当前已核对到的 vendor 内部结构包括：

- `server/gateway/openclaw-decision/`
- `server/gateway/openclaw-orchestration/`
- workflow registry
- orchestration service
- run store
- internal API router

关键文件：

- `vendor/negentropy-lab/server/gateway/openclaw-decision/api/internal-api.ts`
- `vendor/negentropy-lab/server/gateway/openclaw-orchestration/api/internal-api.ts`
- `vendor/negentropy-lab/server/gateway/openclaw-orchestration/service/workflow-registry.ts`
- `vendor/negentropy-lab/server/gateway/openclaw-orchestration/service/orchestration-service.ts`
- `vendor/negentropy-lab/server/gateway/openclaw-orchestration/runtime/run-store.ts`

### 4.4 `custom/` 与 `scripts/custom-stack.mjs`

职责：本地 stack wiring、同步配置、vendor 同步入口。

当前已核对到：

- `custom/README.md` 给出本地维护命令
- `scripts/custom-stack.mjs` 负责 `status` 与 `sync-negentropy`
- 脚本定义了包含目录、包含文件和排除项
- 脚本会写入 `vendor/negentropy-lab/.openclaw-vendor.json`

注意：

- 当前仓库里确实跟踪了 `vendor/negentropy-lab/.openclaw-vendor.json`
- 但 maintainer guidance 仍然把它视为同步元数据
- 后续维护时需要继续把它当作“需要额外审视”的文件，而不是运行时源码

---

## 5. 当前 Negentropy 集成形态

### 5.1 决策桥

当前决策桥仍然是 Negentropy 接入 OpenClaw 的第一层：

- 扩展接收 Gateway 请求
- 构造统一决策请求
- 向 vendor 决策服务请求策略
- 决定放行、重写或拒绝

宿主通用接入点：

- `src/gateway/plugin-request-policy.ts`
- `src/gateway/openai-http.ts`
- `src/gateway/openresponses-http.ts`
- `src/gateway/tools-invoke-http.ts`

在当前代码里，OpenAI HTTP 入口同时包含：

- 上游新增的输入 URL allowlist 归一化
- 本地 Negentropy 策略接入

这也是本次合并 `origin/main` 时真实发生冲突的地方，说明这份架构文档必须承认“宿主侧仍有少量通用边界改动”，而不是把所有变化都描述成仅在扩展层发生。

### 5.2 工作流桥

当前工作流桥已经是集成的第二层，不应再省略：

- `workflowEnabled`
- `orchestrationApiBaseUrl`
- `workflowTimeoutMs`
- `autoDispatchSubagents`

扩展层会：

- 注册 workflow 相关命令
- 将 subagent/session 生命周期事件映射成 workflow runtime events
- 根据 vendor 返回的 action 自动执行 `runtime.subagent.run(...)`

这说明当前集成已经从“只做策略拦截”演进到“策略 + 手动工作流编排”。

#### 5.2.1 Workflow 命令面

当前 OpenClaw 侧对外暴露的 workflow 控制面并不是独立命令，而是挂在单一
`/negentropy` 命名空间下，由 `handleWorkflowCommand()` 处理 `workflow`
子命令。

按当前代码，真实支持的 workflow 命令至少包括：

- `/negentropy workflow status [runId]`
  - 不带 `runId` 时返回按创建时间倒序的首个 run（内部先取最近 10 条，再返回首项）
  - 带 `runId` 时返回该 run 的完整摘要
- `/negentropy workflow list`
  - 当前列出最多 20 条 run
- `/negentropy workflow trace <runId> [limit]`
  - 默认 tail 30 条，非正整数会回退到默认值
- `/negentropy workflow run <name>`
  - 手动启动一个已注册 workflow
- `/negentropy workflow retry <runId>`
  - 基于既有 run 发起 retry
- `/negentropy workflow reconcile [runId] [--include-terminal] [--reason <text>]`
  - 可针对单个 run，也可不带 `runId` 对当前 run 集合执行 reconcile
  - 未显式提供 `--reason` 时，bridge 会生成
    `manual_reconcile:<source>:<requestedBy>` 风格的默认 reason
- `/negentropy workflow cancel <runId> [--emergency]`
  - 默认是普通 cancel；带 `--emergency` 时走 emergency stop 语义
- `/negentropy workflow emergency-stop <runId>`
  - 是 emergency cancel 的显式入口
- `/negentropy workflow stop <runId>`
  - 也是实现里已支持的别名，但当前没有写进 usage text

这些细节对架构判断很重要：

- 这套命令面只有在 `workflowEnabled !== false` 时才可用，否则
  `/negentropy workflow ...` 会直接返回 disabled 提示
- 命令层当前承担的是“人工触发 / 观察 / 修复”workflow run 的控制面，
  不是“平台已经全面自治编排”的同义表达
- `autoDispatchSubagents !== false` 只控制 bridge 是否自动执行 vendor
  返回的 `spawn_subagent` action；它不改变命令面本身仍是人工入口的事实
- 这组命令最终映射到 vendor `/internal/openclaw/workflows` 下的
  `run`、`retry`、`reconcile`、`cancel`、`list`、`get`、`log`
  等内部 API；生命周期桥接事件则单独走 `event`

另外，`extensions/negentropy-lab/index.ts` 顶层 `usageText()` 目前列出了
大部分 workflow 子命令，但尚未把 `workflow reconcile` 和 `workflow stop`
别名写进去；维护时应以 `extensions/negentropy-lab/src/workflow-command.ts`
里的解析逻辑为准。

### 5.3 Vendor 工作流后端

当前 vendor 内部已包含完整的工作流后端能力：

- `createWorkflowInternalApiRouter()`
- `WorkflowRegistry`
- `OrchestrationService`
- `WorkflowRunStore`

并且内置了至少三个可验证的 MVP workflow：

- `serial_planner_executor_complete`
- `parallel_research_implementation_review`
- `failure_retry_escalate`

此外，`vendor/negentropy-lab/server/gateway/openclaw-decision/api/internal-api.ts`
已经把 workflow router 挂到同一个 `/internal/openclaw` 面下，便于扩展层从 decision URL 派生 workflow base URL。

---

## 6. 当前进度判断

### 6.1 已完成并可从代码验证的部分

- OpenClaw 宿主侧插件边界已存在
- Negentropy 决策桥已接入宿主 HTTP/Gateway 策略入口
- Negentropy workflow bridge 已接入扩展层
- vendor 工作流编排模块已进入仓库
- 自定义同步与状态命令已存在
- 决策契约快照与对齐测试已存在
- live smoke 命令已存在

### 6.2 我本次审计确认到的最新状态

本次审计期间，本地已成功执行：

```bash
pnpm negentropy:v11:live-smoke
```

该脚本完成了 workflow run / retry / cancel / emergency-stop / timeout /
trace / reconcile 等路径的本地 smoke 验证。

这比旧版文档更进一步，因为它不再只是“脚本存在”，而是已经有一次本地验证结果。

### 6.3 仍然不能从当前仓库单独证明的部分

以下内容仍然不能仅凭仓库快照直接证明：

- 生产环境切换完成
- 灰度发布结果
- 生产监控、回滚、运维预案全部完成并归档
- 所有 phase 报告都已归档

因此，当前最稳妥的结论是：

> 代码接线、宿主边界和本地 smoke 验证已经能证明“集成设计与主要路径可运行”，但仍不能把当前仓库单独当作“生产切换已完成”的最终证据。

---

## 7. 与旧版文档相比必须修正的点

旧稿中以下内容已经不应继续保留：

- `2026.3.7` 版本号
- `D:/Games/openclaw/` 这种个人本地绝对路径
- “Negentropy 只接入 `gateway_request`” 这种过时表述
- 把 Gateway 方法/事件数量绑定到旧的静态行号
- 忽略 workflow bridge / workflow orchestration 的描述
- 把当前工作树描述成只有“上游核心 + 一个模糊本地层”

当前更准确的表述应该是：

- 宿主核心 + stack wiring + maintenance skill + runtime extension + vendor snapshot
- 决策桥和工作流桥共同构成当前 Negentropy 集成
- 宿主核心改动保持在通用边界，扩展层承载 Negentropy 特有逻辑

---

## 8. 建议的长期维护方式

为了让这份架构参考不再迅速过时，建议长期遵守以下规则：

1. **只保留少量高价值真值**
   - 版本号
   - Gateway 方法/事件总数
   - 扩展目录数量
   - vendor 版本号

2. **把高漂移信息交给脚本生成**
   - 方法清单
   - 事件清单
   - 依赖树
   - 大规模目录统计

3. **把 Negentropy 描述拆成四类**
   - stack wiring
   - maintenance skill
   - runtime extension
   - vendor snapshot

4. **优先引用“边界文件”**
   - `src/plugins/types.ts`
   - `src/plugins/hooks.ts`
   - `src/plugin-sdk/core.ts`
   - `src/gateway/plugin-request-policy.ts`
   - `extensions/negentropy-lab/index.ts`
   - `vendor/negentropy-lab/server/gateway/openclaw-decision/api/internal-api.ts`
   - `vendor/negentropy-lab/server/gateway/openclaw-orchestration/`

---

## 9. 最终审计结论

截至 `2026-03-08`，这份架构参考文档应当反映的真实状态是：

- **OpenClaw 宿主核心** 已更新到 `2026.3.8`
- **Negentropy 扩展层** 已经从单纯决策桥演进到“决策桥 + workflow bridge”
- **vendor 后端层** 已包含 `openclaw-orchestration`
- **宿主通用边界** 已覆盖 plugin hook、HTTP policy helper 和薄入口集成
- **维护层** 已形成 `skills/negentropy-maintainer + custom-stack.mjs` 的明确流程

因此，当前项目最新进度可以被概括为：

> Negentropy 集成已经进入“宿主边界清晰、扩展层可运行、vendor 编排后端落地、维护流程成形”的阶段；但生产完成度仍需依赖外部环境报告和归档证据，而不能只依赖仓库源码本身。
