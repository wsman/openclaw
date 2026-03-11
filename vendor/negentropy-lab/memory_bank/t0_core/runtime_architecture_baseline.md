# 运行时架构基线 - Negentropy-Lab v7.6.0-dev

**版本**: v7.6.0-dev (Phase 13 Final Acceptance 已完成)
**状态**: ✅ 生效（Phase 14-15 执行中）
**最后更新**: 2026-03-10
**宪法依据**: §101同步公理、§102熵减原则、§104功能分层拓扑公理、§152单一真理源公理

---

## 1. 用途与边界

本文件是“运行时实现状态”的最小真理源，用于回答以下问题：

1. 当前有哪些可执行入口；
2. 每个入口承担哪些职责；
3. 七层架构哪些已实现、哪些仍是规划；
4. 文档出现冲突时如何仲裁。

> 仲裁优先级：`runtime_architecture_baseline.md` + `active_context.md` > 其他叙述性文档。

---

## 2. 可执行入口（不改变功能，仅做边界澄清）

| 入口 | 定位 | 代码路径 | 启动方式 |
|------|------|----------|----------|
| 默认开发入口 | API-only + 房间/Agent/Authority 主运行时 | `server/index.ts` | `npm run dev` |
| 默认生产入口 | 主运行时编译产物 | `dist/server/index.js` | `npm start` |
| Legacy入口 | 简化HTTP + `/ws` 兼容入口 | `src/index.ts` | `npm run dev:legacy` / `npm run start:legacy` |
| Gateway模块门面 | 独立Gateway装配入口（HTTP + WebSocket RPC + 插件/监控能力） | `server/gateway/index.ts` | 由脚本或调用方通过 `startNegentropyGateway()` / `startGatewayServer()` 显式调用；不是当前 npm 默认主入口 |

> 当前 npm 默认主链路不直接暴露 `/v1/chat/completions` 或 `/v1/responses`；相关能力位于 `server/gateway/` 的独立 Gateway 路径或简化实现。

---

## 3. 七层架构实现映射（运行态）

| 层级 | 状态 | 运行态实现 |
|------|------|------------|
| L5 接口表现层 | ✅ 已实现 | `src/`, `server/gateway/`, `server/api/` |
| L4 应用逻辑层 | ✅ 已实现 | `server/services/`, `server/middleware/`, `server/cache/` |
| L3 MCP微内核层 | ✅ 已实现 | `engine/mcp/`, `engine/mcp_core/` |
| L2.5 IAB监督层 | 🟡 功能集成 | `server/services/authority/AuthorityMonitoringService.ts`, `server/gateway/monitoring/` |
| L2 执行代理层 | ✅ 已实现 | `server/agents/` |
| L1 记忆银行层 | ✅ 已实现 | `memory_bank/` |
| L0.8 ToolCallBridge | 🟡 子系统已落地 | `server/types/system/IToolCallBridge.ts`, `server/services/authority/AuthorityToolCallBridge.ts`（Authority runtime 已接入广播/审计实现；统一平台实现仍待收敛） |
| L0.5 Legacy兼容层 | 🟡 局部实现 | `server/adapters/OpenClawLogAdapter.ts` 已落地，通用兼容适配器仍待补齐 |
| L0 遗留隔离层 | 📋 架构规划 | 隔离策略存在，代码待建设 |

---

## 4. 架构精简原则（功能不变）

1. **单一运行基线**：运行状态只在本文件与 `active_context.md` 维护；
2. **默认 npm 主链路唯一**：`server/index.ts` / `dist/server/index.js` 是当前默认开发/生产入口；
3. **Legacy 与 Gateway 独立路径需显式标注**：`src/index.ts` 与 `server/gateway/index.ts` 不得再表述为默认主入口；
4. **标准文档状态语义统一**：T2文档“生产就绪”仅代表规范成熟，不默认代表已上线实现；
5. **阶段报告需区分实际验收与 rehearsal**：未来日期的 Phase 14/15 报告不得替代 `active_context.md` 中的“最新实际验收”条目；
6. **跨仓信息显式标注环境前置**：凡涉及 OpenClaw/UI 联调，必须标注外部路径依赖。

---

## 5. 快速验证

```bash
npm run check:constitution
npm run check:consistency
npm run check:contract:strict
npm test -- --run
```
