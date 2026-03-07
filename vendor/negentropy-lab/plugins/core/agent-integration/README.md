# Agent Integration Plugin

## 概述

Agent集成插件提供完整的Agent管理功能，包括LLM服务集成、任务调度、状态管理和模型故障转移。

## 宪法依据

- **§101 同步公理**: 代码与文档必须原子性同步
- **§108 异构模型策略**: 明确模型参数配置，支持Tier 0/1/2模型分层
- **§118 长时间任务执行公理**: 支持复杂度分级（L1-L4）和超时配置
- **§118.5 智能体协同统一策略原则**: 统一Agent管理

## 核心功能

### 1. LLM服务集成

支持多种LLM模型，包括：
- OpenAI系列（GPT-4, GPT-3.5）
- Google系列（Gemini 3 Pro, Gemini 3 Flash）
- ZAI系列（GLM-4.7, GLM-4.7-Flash）

**OpenClaw复用**: 复用OpenClaw的模型管理API调用模式（50%）

```typescript
const response = await plugin.callLLM(
  'zai/glm-4.7',
  'Generate a plan for task X',
  { timeout: 30000 }
);
```

### 2. 任务调度（基于§118复杂度分级）

支持4级复杂度任务调度：

| 复杂度 | 超时时间 | 最大深度 | 推荐模型 | 分批执行 |
|--------|----------|----------|----------|----------|
| L1 | 15分钟 | 5 | Gemini 3 Flash | 否 |
| L2 | 30分钟 | 10 | Gemini 3 Flash | 否 |
| L3 | 60分钟 | 15 | Gemini 3 Pro | 否 |
| L4 | 无超时 | 20 | Gemini 3 Pro High | 是 |

```typescript
const taskId = await plugin.scheduleTask(
  {
    taskId: 'task-001',
    description: 'Analyze complex data',
    type: 'analysis',
  },
  'L3'
);
```

### 3. Agent状态管理

实时追踪Agent状态：

```typescript
// 获取所有Agent状态
const statuses: AgentStatus[] = await plugin.getAgentStatus();

// 获取特定Agent状态
const agentStatus: AgentStatus = await plugin.getAgentStatus('agent-001');
```

**Agent状态定义**:
- `idle`: 空闲
- `busy`: 忙碌
- `error`: 错误
- `offline`: 离线

### 4. 模型故障转移

自动故障转移机制：

```typescript
// 主模型失败时自动切换到备用模型
await plugin.fallbackModel(
  'zai/glm-4.7',
  'zai/glm-4.7-flash'
);
```

**宪法依据**: §108 异构模型策略

## 配置示例

```json
{
  "id": "agent-integration",
  "name": "Agent Integration Plugin",
  "version": "1.0.0",
  "kind": "agent",
  "negentropy": {
    "agentIntegration": {
      "model": "zai/glm-4.7",
      "timeout": 3600000,
      "depth": 2,
      "fallback": "zai/glm-4.7-flash",
      "complexityConfig": {
        "L1": {
          "timeout": 900000,
          "maxDepth": 5,
          "recommendedModel": "google-antigravity/gemini-3-flash",
          "batchExecution": false
        },
        "L2": {
          "timeout": 1800000,
          "maxDepth": 10,
          "recommendedModel": "google-antigravity/gemini-3-flash",
          "batchExecution": false
        },
        "L3": {
          "timeout": 3600000,
          "maxDepth": 15,
          "recommendedModel": "google-antigravity/gemini-3-pro",
          "batchExecution": false
        },
        "L4": {
          "timeout": null,
          "maxDepth": 20,
          "recommendedModel": "google-antigravity/gemini-3-pro-high",
          "batchExecution": true
        }
      }
    }
  }
}
```

## API参考

### 方法列表

#### `callLLM(model, prompt, options?)`

调用LLM服务。

**参数**:
- `model`: 模型名称（如 `'zai/glm-4.7'`）
- `prompt`: 提示词
- `options`: 可选配置
  - `timeout`: 超时时间（毫秒）
  - `maxTokens`: 最大token数
  - `temperature`: 温度参数（0-1）

**返回**: `Promise<LLMResponse>`

---

#### `scheduleTask(task, complexity)`

调度任务。

**参数**:
- `task`: 任务对象
  - `taskId`: 任务ID
  - `description`: 任务描述
  - `type`: 任务类型
  - `params`: 任务参数（可选）
- `complexity`: 复杂度等级（`'L1' | 'L2' | 'L3' | 'L4'`）

**返回**: `Promise<string>` - 任务ID

---

#### `getAgentStatus(agentId?)`

获取Agent状态。

**参数**:
- `agentId`: Agent ID（可选，不指定则返回所有Agent）

**返回**: `Promise<AgentStatus | AgentStatus[]>`

---

#### `fallbackModel(primary, fallback)`

模型故障转移。

**参数**:
- `primary`: 主模型名称
- `fallback`: 备用模型名称

**返回**: `Promise<void>`

---

#### `assessComplexity(task)`

评估任务复杂度。

**参数**:
- `task`: 任务对象

**返回**: `Promise<TaskComplexity>` - 复杂度等级

---

#### `getComplexityConfig(complexity)`

获取复杂度配置。

**参数**:
- `complexity`: 复杂度等级

**返回**: `ComplexityConfig`

---

## 类型定义

### `Task`

```typescript
interface Task {
  taskId: string;
  description: string;
  type: string;
  params?: Record<string, unknown>;
  priority?: number;
  tags?: string[];
}
```

### `LLMResponse`

```typescript
interface LLMResponse {
  content: string;
  model: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
  durationMs: number;
  success: boolean;
  error?: string;
}
```

### `AgentStatus`

```typescript
interface AgentStatus {
  agentId: string;
  name: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  currentTask?: Task;
  lastActive: number;
  tasksCompleted: number;
  tasksFailed: number;
}
```

### `TaskComplexity`

```typescript
type TaskComplexity = 'L1' | 'L2' | 'L3' | 'L4';
```

### `ComplexityConfig`

```typescript
interface ComplexityConfig {
  timeout?: number;
  maxDepth?: number;
  recommendedModel?: string;
  batchExecution?: boolean;
}
```

## 使用示例

### 基本使用

```typescript
import AgentIntegrationPlugin from './plugins/core/agent-integration';

// 初始化插件
const plugin = new AgentIntegrationPlugin();
await plugin.initialize(api);

// 调用LLM
const response = await plugin.callLLM(
  'zai/glm-4.7',
  'Generate a plan'
);

console.log(response.content);
```

### 任务调度

```typescript
// 创建任务
const task: Task = {
  taskId: 'task-001',
  description: 'Analyze market data',
  type: 'analysis',
  params: {
    timeframe: '1d',
    symbol: 'BTC/USD',
  },
};

// 评估复杂度
const complexity = await plugin.assessComplexity(task);

// 调度任务
await plugin.scheduleTask(task, complexity);
```

### Agent状态监控

```typescript
// 获取所有Agent状态
const allAgents = await plugin.getAgentStatus();

for (const agent of allAgents) {
  console.log(`${agent.name}: ${agent.status}`);

  if (agent.status === 'busy' && agent.currentTask) {
    console.log(`  Current task: ${agent.currentTask.description}`);
  }
}
```

### 模型故障转移

```typescript
// 验证模型可用性
const isValid = await plugin.validateModel('zai/glm-4.7');

if (!isValid) {
  // 切换到备用模型
  await plugin.fallbackModel(
    'zai/glm-4.7',
    'zai/glm-4.7-flash'
  );
}
```

## 测试覆盖

测试覆盖率: ≥ 70%

运行测试:
```bash
npm test -- plugins/core/agent-integration
```

测试套件:
- ✅ 插件初始化
- ✅ LLM服务调用
- ✅ 任务调度
- ✅ 复杂度评估
- ✅ Agent状态管理
- ✅ 模型故障转移
- ✅ 复杂度配置

## 性能指标

- LLM调用延迟: < 2s (95th percentile)
- 任务调度延迟: < 100ms
- 状态更新延迟: < 50ms
- 故障转移时间: < 5s

## 故障排查

### 常见问题

**Q: LLM调用超时**
A: 检查模型配置的超时时间，或考虑使用故障转移模型。

**Q: 任务积压**
A: 检查任务队列长度和Agent数量，考虑增加并行度。

**Q: 模型故障转移未生效**
A: 确保备用模型配置正确且可用。

## 维护指南

### 日常维护

1. **监控Agent状态**: 定期检查Agent状态和任务完成情况
2. **清理任务队列**: 定期清理已完成或失败的任务
3. **更新模型配置**: 根据模型可用性和性能调整配置

### 升级指南

1. 备份当前配置
2. 更新插件代码
3. 重新加载插件
4. 验证功能正常

## 版本历史

### v1.0.0 (2026-02-12)

- ✅ LLM服务集成
- ✅ 任务调度（§118复杂度分级）
- ✅ Agent状态管理
- ✅ 模型故障转移
- ✅ 完整测试覆盖
- ✅ 完整文档

## 许可证

遵循Negentropy-Lab项目许可证。

## 贡献者

- 科技部后端分队
