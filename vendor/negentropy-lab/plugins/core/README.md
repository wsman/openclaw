# Negentropy-Lab 核心插件总览

## 概述

本目录包含Negentropy-Lab的核心插件实现，共3个插件：

1. **Agent集成插件** (`agent-integration`) - Agent管理、LLM服务、任务调度
2. **熵值监控插件** (`entropy-monitor`) - 系统监控、熵值追踪、阈值告警
3. **WebSocket通信插件** (`websocket-channel`) - 实时通信、消息广播、客户端管理

## 宪法依据

- **§101 同步公理**: 代码与文档必须原子性同步
- **§102 熵减原则**: 所有插件实现遵循熵减原则
- **§118 长时间任务执行公理**: Agent集成插件支持复杂度分级
- **§118.5 智能体协同统一策略原则**: 统一Agent管理和通信
- **§108 异构模型策略**: Agent集成插件支持模型分层
- **§111-§113 资源管理公理**: 监控插件支持资源追踪
- **§401-§404 环境锚定公理**: 所有插件在锚定环境中运行

## 插件列表

### 1. Agent Integration Plugin

**插件ID**: `agent-integration`
**版本**: `1.0.0`
**类型**: `agent`

**核心功能**:
- LLM服务集成（支持多种模型）
- 任务调度功能（基于§118复杂度分级）
- Agent状态管理
- 模型故障转移机制

**OpenClaw复用**: 50%

**文档**: [agent-integration/README.md](./agent-integration/README.md)

---

### 2. Entropy Monitor Plugin

**插件ID**: `entropy-monitor`
**版本**: `1.0.0`
**类型**: `monitoring`

**核心功能**:
- CPU监控
- 内存监控
- 熵值监控（H_sys实时追踪）
- 阈值告警

**OpenClaw复用**: 40%

**文档**: [entropy-monitor/README.md](./entropy-monitor/README.md)

---

### 3. WebSocket Channel Plugin

**插件ID**: `websocket-channel`
**版本**: `1.0.0`
**类型**: `channel`

**核心功能**:
- WebSocket服务器
- 消息广播功能
- 客户端管理

**OpenClaw复用**: 60%

**文档**: [websocket-channel/README.md](./websocket-channel/README.md)

## 快速开始

### 1. 安装依赖

```bash
cd projects/Negentropy-Lab
npm install
```

### 2. 加载插件

插件会通过插件系统自动加载，无需手动配置。

### 3. 运行测试

```bash
# 运行所有核心插件测试
npm test -- plugins/core

# 运行单个插件测试
npm test -- plugins/core/agent-integration
npm test -- plugins/core/entropy-monitor
npm test -- plugins/core/websocket-channel
```

### 4. 启动开发服务器

```bash
npm run dev
```

## 插件依赖关系

```
┌─────────────────┐
│   Plugin System │
│   (基础架构)     │
└────────┬────────┘
         │
    ┌────┴────┬─────────┬──────────┐
    │         │         │          │
    ▼         ▼         ▼          ▼
┌──────┐ ┌──────┐ ┌──────┐   ┌──────────┐
│Agent │ │Monitor│ │WebSocket│  │ Hello   │
│Integration│ │Monitor│ │ Channel│   │ World   │
└──────┘ └──────┘ └──────┘   │(Example)│
                               └──────────┘
```

**说明**:
- 所有插件依赖于插件系统基础架构
- 核心插件之间相互独立，可以单独使用
- `hello-world`是示例插件，用于演示插件功能

## 配置管理

### 全局配置

插件配置位于 `server/config/plugins.json`（如存在）。

### 插件配置

每个插件都有自己的配置文件 `negentropy.plugin.json`：

- `agent-integration/negentropy.plugin.json`
- `entropy-monitor/negentropy.plugin.json`
- `websocket-channel/negentropy.plugin.json`

## API示例

### Agent集成

```typescript
import AgentIntegrationPlugin from './plugins/core/agent-integration';

// 调用LLM
const response = await plugin.callLLM(
  'zai/glm-4.7',
  'Generate a plan'
);

// 调度任务
await plugin.scheduleTask(
  { taskId: 'task-001', description: 'Analyze data', type: 'analysis' },
  'L3'
);

// 获取Agent状态
const status = await plugin.getAgentStatus('agent-001');
```

### 熵值监控

```typescript
import EntropyMonitorPlugin from './plugins/core/entropy-monitor';

// 获取熵值
const entropy = await plugin.getEntropy();
console.log(`H_sys: ${entropy.h_sys}`);

// 检查阈值告警
const alerts = await plugin.checkThresholds();

// 启动监控循环
await plugin.startMonitoring();
```

### WebSocket通信

```typescript
import WebSocketChannelPlugin from './plugins/core/websocket-channel';

// 启动服务器
await plugin.startServer(3001);

// 广播消息
await plugin.broadcast({
  type: 'system_event',
  content: { message: 'Hello' },
});

// 获取客户端列表
const clients = await plugin.manageClients('list');
```

## 测试覆盖率

所有核心插件的测试覆盖率均 ≥ 70%：

| 插件 | 测试覆盖率 | 测试文件 |
|------|-----------|----------|
| agent-integration | ≥ 70% | `index.test.ts` |
| entropy-monitor | ≥ 70% | `index.test.ts` |
| websocket-channel | ≥ 70% | `index.test.ts` |

## 性能指标

### Agent Integration Plugin

- LLM调用延迟: < 2s (95th percentile)
- 任务调度延迟: < 100ms
- 状态更新延迟: < 50ms
- 故障转移时间: < 5s

### Entropy Monitor Plugin

- 指标采集延迟: < 10ms
- 熵值计算延迟: < 50ms
- 历史记录查询: < 100ms
- 监控循环开销: < 1% CPU

### WebSocket Channel Plugin

- 连接建立延迟: < 100ms
- 消息广播延迟: < 50ms
- 最大并发连接: 100
- 消息吞吐: > 1000 msg/s

## 故障排查

### 通用问题

**Q: 插件无法加载**
A: 检查插件配置文件 `negentropy.plugin.json` 是否正确。

**Q: 测试失败**
A: 运行 `npm install` 确保所有依赖已安装。

### Agent集成插件

**Q: LLM调用超时**
A: 检查模型配置的超时时间，或考虑使用故障转移模型。

**Q: 任务积压**
A: 检查任务队列长度和Agent数量，考虑增加并行度。

### 熵值监控插件

**Q: CPU使用率报告不准确**
A: 检查系统监控库配置，确保正确读取CPU统计。

**Q: 熵值持续上升**
A: 检查系统负载、Agent任务数量和宪法合规性，采取熵减措施。

### WebSocket通信插件

**Q: 客户端无法连接**
A: 检查端口配置、CORS设置和防火墙规则。

**Q: 心跳超时**
A: 调整heartbeatInterval和heartbeatTimeout配置。

## 维护指南

### 日常维护

1. **监控插件状态**: 定期检查所有插件的运行状态
2. **查看统计信息**: 使用 `getStats()` 查看插件运行统计
3. **检查告警**: 监控熵值监控插件的阈值告警

### 更新升级

1. 备份当前配置
2. 更新插件代码
3. 重新加载插件
4. 验证功能正常
5. 运行测试确保没有回归

### 性能优化

1. **调整监控间隔**: 根据实际需求调整监控间隔
2. **优化配置参数**: 根据系统负载调整配置参数
3. **清理历史数据**: 定期清理过期数据

## 贡献指南

### 添加新插件

1. 创建插件目录: `plugins/core/new-plugin/`
2. 创建主文件: `index.ts`
3. 创建配置文件: `negentropy.plugin.json`
4. 创建测试文件: `index.test.ts`
5. 创建文档: `README.md`
6. 遵循现有插件的代码风格和结构

### 代码规范

- 使用TypeScript编写
- 遵循ESLint配置
- 添加完整的JSDoc注释
- 确保测试覆盖率 ≥ 70%
- 遵循宪法约束（§101、§102等）

## 版本历史

### v1.0.0 (2026-02-12)

- ✅ Agent集成插件
- ✅ 熵值监控插件
- ✅ WebSocket通信插件
- ✅ 完整测试覆盖
- ✅ 完整文档

## 许可证

遵循Negentropy-Lab项目许可证。

## 贡献者

- 科技部后端分队

## 联系方式

如有问题或建议，请联系科技部后端分队。

---

*最后更新: 2026-02-12*
