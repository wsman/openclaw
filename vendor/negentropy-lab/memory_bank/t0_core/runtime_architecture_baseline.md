# 运行时架构基线 - Negentropy-Lab v7.6.0-dev

**版本**: v7.6.0-dev (Phase 13 Final Acceptance 已完成)  
**状态**: ✅ 生效（Phase 14-15 规划中）  
**最后更新**: 2026-03-06  
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
| 轻量API入口 | 简化HTTP + `/ws` | `src/index.ts` | `npm run dev` |
| Colyseus主入口 | API-only + 房间/Agent集成 | `server/index.ts` | `npm run dev:colyseus` |
| Gateway入口 | HTTP + WebSocket RPC + 插件能力 | `server/gateway/index.ts` | `server/gateway/server.impl-with-ws.ts` 被调用 |

---

## 3. 七层架构实现映射（运行态）

| 层级 | 状态 | 运行态实现 |
|------|------|------------|
| L5 接口表现层 | ✅ 已实现 | `src/`, `server/gateway/`, `server/api/` |
| L4 应用逻辑层 | ✅ 已实现 | `server/services/`, `server/middleware/`, `server/cache/` |
| L3 MCP微内核层 | ✅ 已实现 | `engine/mcp/`, `engine/mcp_core/` |
| L2.5 IAB监督层 | 🟡 功能集成 | `server/gateway/monitoring/core/` |
| L2 执行代理层 | ✅ 已实现 | `server/agents/` |
| L1 记忆银行层 | ✅ 已实现 | `memory_bank/` |
| L0.8 ToolCallBridge | 🟡 接口在位 | `server/types/system/IToolCallBridge.ts`（实现待补齐） |
| L0.5 Legacy兼容层 | 📋 架构规划 | 适配器层仅保留设计与接口 |
| L0 遗留隔离层 | 📋 架构规划 | 隔离策略存在，代码待建设 |

---

## 4. 架构精简原则（功能不变）

1. **单一运行基线**：运行状态只在本文件与 `active_context.md` 维护；
2. **索引文档去实现细节**：`.clinerules` 保留导航，不重复展开实现状态细节；
3. **标准文档状态语义统一**：T2文档“生产就绪”仅代表规范成熟，不默认代表已上线实现；
4. **跨仓信息显式标注环境前置**：凡涉及 OpenClaw/UI 联调，必须标注外部路径依赖。

---

## 5. 快速验证

```bash
npm run check:constitution
npm run check:consistency
npm run check:contract:strict
npm test -- --run
```

