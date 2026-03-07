# WebSocket Channel Plugin

## 概述

WebSocket通信插件提供实时双向通信功能，支持WebSocket服务器、消息广播和客户端管理。

## 审法依据

- **§101 同步公理**: 代码与文档必须原子性同步
- **§401-§404 环境锚定公理**: 确保插件在正确的环境中运行
- **§118.5 智能体协同统一策略原则**: 支持Agent间通信

## 核心功能

### 1. WebSocket服务器

提供完整的WebSocket服务器功能：

```typescript
// 启动服务器
await plugin.startServer(3001);

// 停止服务器
await plugin.stopServer();

// 重启服务器
await plugin.restartServer();
```

**OpenClaw复用**: 复用OpenClaw的WebSocket服务器实现（60%）

### 2. 消息广播

支持向所有客户端广播消息：

```typescript
// 广播消息到所有客户端
await plugin.broadcast({
  type: 'system_event',
  content: { event: 'test' },
});

// 发送消息到指定客户端
await plugin.sendToClient('client-001', {
  type: 'agent_message',
  content: 'Hello',
});
```

### 3. 客户端管理

管理连接的WebSocket客户端：

```typescript
// 列出所有客户端
const clients = await plugin.manageClients('list');

// 断开指定客户端
await plugin.manageClients('disconnect', { clientId: 'client-001' });

// 踢出指定客户端
await plugin.manageClients('kick', { clientId: 'client-001' });

// 获取客户端数量
const count = plugin.getClientCount();
```

### 4. 统计信息

获取服务器统计信息：

```typescript
const stats = plugin.getStats();
console.log(`Total connections: ${stats.totalConnections}`);
console.log(`Active connections: ${stats.activeConnections}`);
console.log(`Total messages: ${stats.totalMessages}`);
console.log(`Total broadcasts: ${stats.totalBroadcasts}`);
```

## 配置示例

```json
{
  "id": "websocket-channel",
  "name": "WebSocket Channel Plugin",
  "version": "1.0.0",
  "kind": "channel",
  "negentropy": {
    "websocket": {
      "port": 3001,
      "path": "/socket",
      "cors": {
        "origin": "*",
        "credentials": true
      },
      "heartbeatInterval": 25000,
      "heartbeatTimeout": 60000,
      "maxConnections": 100
    }
  }
}
```

**配置说明**:
- `port`: WebSocket服务器端口
- `path`: WebSocket路径前缀
- `cors`: CORS配置
- `heartbeatInterval`: 心跳间隔（毫秒）
- `heartbeatTimeout`: 心跳超时（毫秒）
- `maxConnections`: 最大连接数

## API参考

### 方法列表

#### `startServer(port?)`

启动WebSocket服务器。

**参数**:
- `port`: 端口号（可选，默认使用配置中的端口）

**返回**: `Promise<void>`

---

#### `stopServer()`

停止WebSocket服务器。

**返回**: `Promise<void>`

---

#### `restartServer()`

重启WebSocket服务器。

**返回**: `Promise<void>`

---

#### `broadcast(message)`

广播消息到所有客户端。

**参数**:
- `message`: 消息内容

**返回**: `Promise<void>`

---

#### `sendToClient(clientId, message)`

发送消息到指定客户端。

**参数**:
- `clientId`: 客户端ID
- `message`: WebSocket消息对象

**返回**: `Promise<void>`

---

#### `manageClients(action, params?)`

管理客户端。

**参数**:
- `action`: 管理动作（`'list' | 'disconnect' | 'kick'`）
- `params`: 参数
  - `clientId`: 客户端ID

**返回**: `Promise<unknown>`

---

#### `getClientCount()`

获取客户端数量。

**返回**: `number`

---

#### `getStats()`

获取统计信息。

**返回**: `ChannelStats`

```typescript
interface ChannelStats {
  totalConnections: number;  // 总连接数
  activeConnections: number; // 当前连接数
  totalMessages: number;     // 总消息数
  totalBroadcasts: number;    // 总广播数
  totalErrors: number;       // 总错误数
  startTime: number;         // 启动时间
  uptime: number;            // 运行时间（毫秒）
}
```

---

## 类型定义

### `WSMessage`

```typescript
interface WSMessage {
  type: WSMessageType;       // 消息类型
  content: unknown;          // 消息内容
  messageId: string;         // 消息ID
  from?: string;             // 发送者ID
  to?: string;               // 接收者ID（可选）
  timestamp: number;         // 时间戳
  metadata?: Record<string, unknown>; // 元数据
}
```

### `WSMessageType`

```typescript
type WSMessageType =
  | 'agent_message'       // Agent消息
  | 'system_event'        // 系统事件
  | 'entropy_update'      // 熵值更新
  | 'client_command'      // 客户端命令
  | 'broadcast'           // 广播消息
  | 'heartbeat';          // 心跳
```

### `ClientInfo`

```typescript
interface ClientInfo {
  clientId: string;                   // 客户端ID
  clientType: 'agent' | 'monitor' | 'ui' | 'external'; // 客户端类型
  clientName?: string;                // 客户端名称
  connectedAt: number;                 // 连接时间
  lastActiveAt: number;               // 最后活动时间
  ip?: string;                        // 客户端IP
  metadata?: Record<string, unknown>; // 客户端元数据
}
```

### `WebSocketConfig`

```typescript
interface WebSocketConfig {
  port: number;                       // 服务器端口
  path: string;                       // 路径前缀
  cors: {
    origin: string | string[] | boolean;
    credentials: boolean;
  };
  heartbeatInterval: number;          // 心跳间隔（毫秒）
  heartbeatTimeout: number;           // 心跳超时（毫秒）
  maxConnections: number;             // 最大连接数
}
```

## 使用示例

### 客户端连接

```typescript
import { io } from 'socket.io-client';

// 连接到服务器
const socket = io('http://localhost:3001', {
  path: '/socket',
});

// 监听连接成功事件
socket.on('connected', (data) => {
  console.log('Connected:', data);
});

// 监听Agent消息
socket.on('agent_message', (message) => {
  console.log('Agent message:', message);
});

// 监听系统事件
socket.on('system_event', (event) => {
  console.log('System event:', event);
});

// 监听熵值更新
socket.on('entropy_update', (entropy) => {
  console.log('Entropy update:', entropy);
});

// 发送消息
socket.emit('message', {
  type: 'client_command',
  content: { command: 'test' },
});

// 注册客户端类型
socket.emit('client_register', {
  clientType: 'agent',
  clientName: 'MyAgent',
});
```

### 服务器端广播

```typescript
import WebSocketChannelPlugin from './plugins/core/websocket-channel';

// 初始化插件
const plugin = new WebSocketChannelPlugin();
await plugin.initialize(api);

// 启动服务器
await plugin.startServer();

// 广播系统事件
await plugin.broadcast({
  type: 'system_event',
  content: {
    event: 'system_started',
    message: 'System has started',
  },
});

// 广播熵值更新
await plugin.broadcast({
  type: 'entropy_update',
  content: {
    h_sys: 0.5,
    h_cog: 0.3,
    h_struct: 0.2,
    h_align: 0.1,
    h_bio: 0.4,
  },
});
```

### 客户端管理

```typescript
// 列出所有客户端
const clients = await plugin.manageClients('list');
console.log('Connected clients:', clients);

for (const client of clients) {
  console.log(`  - ${client.clientName || client.clientId} (${client.clientType})`);
  console.log(`    IP: ${client.ip}`);
  console.log(`    Connected at: ${new Date(client.connectedAt).toLocaleString()}`);
}

// 断开指定客户端
await plugin.manageClients('disconnect', {
  clientId: 'client-001',
});

// 踢出客户端
await plugin.manageClients('kick', {
  clientId: 'client-002',
});
```

### 统计信息

```typescript
// 获取统计信息
const stats = plugin.getStats();

console.log(`Total connections: ${stats.totalConnections}`);
console.log(`Active connections: ${stats.activeConnections}`);
console.log(`Total messages: ${stats.totalMessages}`);
console.log(`Total broadcasts: ${stats.totalBroadcasts}`);
console.log(`Total errors: ${stats.totalErrors}`);
console.log(`Uptime: ${Math.floor(stats.uptime / 1000)}s`);

// 重置统计信息
plugin.resetStats();
```

### Agent间通信

```typescript
// Agent A发送消息
socket.emit('agent_message', {
  type: 'agent_message',
  content: {
    from: 'agent-a',
    to: 'agent-b',
    message: 'Hello Agent B',
  },
});

// Agent B接收消息
socket.on('agent_message', (message) => {
  if (message.content.to === 'agent-b') {
    console.log('Received message from Agent A:', message.content);
  }
});
```

## 消息类型

### agent_message

Agent间通信消息。

```typescript
{
  type: 'agent_message',
  content: {
    from: 'agent-001',
    to: 'agent-002',
    message: 'Hello',
  },
}
```

### system_event

系统事件消息。

```typescript
{
  type: 'system_event',
  content: {
    event: 'system_started',
    message: 'System has started',
  },
}
```

### entropy_update

熵值更新消息。

```typescript
{
  type: 'entropy_update',
  content: {
    h_sys: 0.5,
    h_cog: 0.3,
    h_struct: 0.2,
    h_align: 0.1,
    h_bio: 0.4,
  },
}
```

### client_command

客户端命令消息。

```typescript
{
  type: 'client_command',
  content: {
    command: 'execute_task',
    params: { ... },
  },
}
```

### broadcast

广播消息。

```typescript
{
  type: 'broadcast',
  content: {
    message: 'Broadcast to all clients',
  },
}
```

### heartbeat

心跳消息。

```typescript
{
  type: 'heartbeat',
  content: {},
}
```

## 客户端类型

### agent

Agent客户端，用于Agent间通信。

```typescript
socket.emit('client_register', {
  clientType: 'agent',
  clientName: 'MyAgent',
});
```

### monitor

监控客户端，用于接收监控数据。

```typescript
socket.emit('client_register', {
  clientType: 'monitor',
  clientName: 'MonitoringDashboard',
});
```

### ui

UI客户端，用于前端界面。

```typescript
socket.emit('client_register', {
  clientType: 'ui',
  clientName: 'WebInterface',
});
```

### external

外部客户端，用于第三方集成。

```typescript
socket.emit('client_register', {
  clientType: 'external',
  clientName: 'ExternalService',
});
```

## 测试覆盖

测试覆盖率: ≥ 70%

运行测试:
```bash
npm test -- plugins/core/websocket-channel
```

测试套件:
- ✅ 服务器控制
- ✅ 客户端管理
- ✅ 消息广播
- ✅ 统计信息
- ✅ 客户端连接
- ✅ 心跳检查
- ✅ 消息类型
- ✅ 客户端类型

## 性能指标

- 连接建立延迟: < 100ms
- 消息广播延迟: < 50ms
- 最大并发连接: 100
- 消息吞吐: > 1000 msg/s

## 故障排查

### 常见问题

**Q: 客户端无法连接**
A: 检查端口配置、CORS设置和防火墙规则。

**Q: 心跳超时**
A: 调整heartbeatInterval和heartbeatTimeout配置。

**Q: 消息广播延迟高**
A: 检查网络延迟和服务器负载。

## 维护指南

### 日常维护

1. **监控连接数**: 定期检查活动连接数和最大连接数
2. **清理超时客户端**: 定期检查并清理超时客户端
3. **查看统计信息**: 定期查看统计信息，了解系统运行状态

### 升级指南

1. 备份当前配置
2. 更新插件代码
3. 重新加载插件
4. 验证WebSocket功能正常

## 版本历史

### v1.0.0 (2026-02-12)

- ✅ WebSocket服务器
- ✅ 消息广播
- ✅ 客户端管理
- ✅ 统计信息
- ✅ 心跳检查
- ✅ 多种消息类型
- ✅ 多种客户端类型
- ✅ 完整测试覆盖
- ✅ 完整文档

## 许可证

遵循Negentropy-Lab项目许可证。

## 贡献者

- 科技部后端分队
