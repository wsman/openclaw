# 前端架构重构标准 (DS-01)

**版本**: v1.0.0  
**状态**: 🟡 规划草案（当前仓库未落地）  
**类型**: 开发标准 (Development Standard)  
**宪法依据**: §102 熵减原则、§141 架构回流流程、§301 生产级标准  
**来源文档**: FRONTEND_REFACTOR_PLAN.md (Phase 1: 基础设施铺设)  
**制定者**: 办公厅主任 (Director of General Office)  
**批准人**: 元首 (User)  
**执行者**: 科技部 (Technology Ministry)

---

> 注：本文中的前端目录与文件路径为规划示例，当前仓库不保证已全部落地。

## 🎯 标准目标

规范前端架构重构的 **基础设施铺设阶段 (Phase 1)**，确保建立稳定的 WebSocket 连接和基础状态管理，为后续功能实现奠定技术基础。

## 📋 核心要求

### 1. 技术栈确认
- **核心框架**: React 19 + Vite 7
- **样式系统**: Tailwind CSS v4 (原生 CSS 变量支持)
- **通信协议**: Colyseus.js (WebSocket)
- **动画引擎**: Framer Motion (用于 Agent 思考可视化)
- **图标库**: Lucide React

### 2. 目录结构规范 (Feature-Based 架构)
```
src/
├── app/                    # 应用级配置 (Provider, Router)
├── assets/                 # 静态资源
├── features/               # 业务功能模块
│   ├── chat/               # 聊天功能
│   │   ├── components/     # 聊天特定组件
│   │   ├── hooks/          # 聊天特定 Hooks
│   │   └── types.ts
│   ├── dashboard/          # 仪表盘功能 (原 components/lib)
│   │   ├── components/
│   │   └── hooks/
│   └── agent/              # Agent 状态展示
├── hooks/                  # 通用 Hooks (useColyseus, useRoom)
├── lib/                    # 工具库 (Colyseus Client, Utils)
├── components/             # 通用 UI 组件 (Button, Input)
└── types/                  # 全局类型定义
```

## 🛠️ 实施任务清单 (Phase 1)

| 任务 ID | 任务名称 | 描述 | 优先级 | 验收标准 |
|---------|----------|------|---------|----------|
| **F-101** | **Colyseus Context 封装** | 创建 `ColyseusContext` 和 `useColyseus` Hook，管理 Client 单例 | **P0** | 1. 支持Client单例管理<br>2. 提供连接状态监听<br>3. 支持错误重连机制 |
| **F-102** | **Room 状态同步机制** | 实现 `useRoomState` Hook，利用 Colyseus Schema 自动同步状态 | **P0** | 1. 自动同步房间状态变更<br>2. 支持状态订阅/取消订阅<br>3. 性能优化（防抖/节流） |
| **F-103** | **Tailwind 4 配置优化** | 确保 PostCSS 和 CSS 变量配置正确，支持深色模式 | **P1** | 1. 正确配置CSS变量<br>2. 支持深色/浅色模式切换<br>3. 构建产物体积优化 |
| **F-104** | **目录结构重构** | 将 `components/lib` 迁移至 `features/` (如 `features/dashboard`, `features/chat`) | **P1** | 1. 完成目录结构调整<br>2. 更新所有import路径<br>3. 确保编译通过 |

## 📝 关键技术决策

### 1. React 19 特性应用
- **Actions API**: 所有的表单提交 (发送消息) 必须使用 React 19 `action` 属性或 `useActionState`
- **性能优化**: 利用 `use` API 处理异步状态，避免不必要的重渲染
- **Ref 改进**: 使用新的 Ref 处理模式优化组件性能

### 2. Colyseus 集成规范
- **Schema 一致性**: 前端必须严格按照后端定义的 Schema 生成 TypeScript 类型，保持一致性
- **连接管理**: 实现自动重连、心跳检测、连接状态监控
- **消息处理**: 统一消息序列化/反序列化格式

### 3. Tailwind 4 配置标准
- **CSS 变量优先**: 不再使用 `tailwind.config.js` 的旧配置方式，全面转向 CSS 变量配置
- **主题系统**: 建立统一的主题变量体系，支持自定义主题扩展
- **性能优化**: 配置 PurgeCSS 优化，移除未使用的样式

## ✅ 验收标准 (Phase 1)

### 功能验收
1. **连接能力**: 能够连接到本地 Colyseus 服务器 (ws://localhost:2567)
2. **状态管理**: `useRoomState` Hook 能够正确同步房间状态变化
3. **样式系统**: Tailwind 4 样式系统正常工作，深色模式可切换
4. **目录结构**: 新的 Feature-Based 目录结构就绪，所有组件正确导入

### 质量验收
1. **编译通过**: 无 TypeScript 类型错误，无 ESLint 错误
2. **性能基准**: 首次加载时间 < 3秒，交互响应时间 < 100ms
3. **代码规范**: 遵循项目代码规范，提交前通过代码审查

### 文档验收
1. **API 文档**: Colyseus Context 和 Hooks 有完整的 API 文档
2. **使用示例**: 提供典型使用场景的代码示例
3. **故障排查**: 常见问题解决方案文档

## 🔄 实施流程

### 步骤 1: 环境准备
```bash
# 安装依赖
npm install colyseus.js framer-motion lucide-react

# 配置 TypeScript 类型
# 从后端获取 Schema 定义生成前端类型
```

### 步骤 2: 基础设施实现
1. 创建 `<frontend>/lib/colyseus.ts` - Colyseus Client 配置
2. 创建 `<frontend>/contexts/ColyseusContext.tsx` - React Context 封装
3. 创建 `<frontend>/hooks/useColyseus.ts` - 基础 Hook
4. 创建 `<frontend>/hooks/useRoomState.ts` - 状态同步 Hook

### 步骤 3: 样式系统配置
1. 配置 `tailwind.config.js` 使用 CSS 变量
2. 创建 `<frontend>/styles/theme.css` - 主题变量定义
3. 配置 PostCSS 插件链

### 步骤 4: 目录重构
1. 分析现有组件结构
2. 创建 Feature-Based 目录
3. 迁移组件并更新导入路径
4. 验证编译和功能正常

## 📊 性能指标

| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| 首次加载时间 | < 3秒 | Lighthouse 性能测试 |
| Colyseus 连接建立时间 | < 1秒 | 网络面板监控 |
| 状态同步延迟 | < 100ms | 性能监测工具 |
| 内存使用 | < 50MB | Chrome DevTools |
| 打包体积 (gzipped) | < 200KB | Webpack Bundle Analyzer |

## 🛡️ 质量保证

### 代码审查要点
1. **类型安全**: 所有组件必须有完整的 TypeScript 类型定义
2. **错误处理**: 网络错误、连接异常有妥善处理
3. **性能优化**: 避免不必要的重渲染，使用 memoization
4. **可测试性**: 组件设计支持单元测试和集成测试

### 测试策略
1. **单元测试**: Colyseus Hooks 的独立测试
2. **集成测试**: 上下文和组件集成测试
3. **E2E 测试**: 完整用户流程测试

## 🔗 相关标准

- **DS-02**: Colyseus 集成标准
- **DS-03**: React 19 应用标准  
- **DS-04**: 熵减架构迁移标准
- **TS-101**: WebSocket 连接管理标准
- **TS-103**: 房间状态同步标准

---

**更新记录**:
- **2026-02-09**: 标准创建，基于 FRONTEND_REFACTOR_PLAN.md Phase 1 内容

**状态跟踪**:
- [ ] F-101: Colyseus Context 封装
- [ ] F-102: Room 状态同步机制  
- [ ] F-103: Tailwind 4 配置优化
- [ ] F-104: 目录结构重构

*遵循宪法约束: 标准即规范，架构即熵减，质量即信任。*
