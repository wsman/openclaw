# WebSocket 连接池 - 使用指南

**文档版本**: v1.0.0  
**创建日期**: 2026-02-26  
**宪法依据**: §119主题驱动开发、§306零停机协议、§320 L2+项目强制使用原则  
**适用项目**: Negentropy-Lab WebSocket 性能优化项目

---

## 📋 目录

- [快速开始](#快速开始)
- [API 参考](#api-参考)
- [配置选项](#配置选项)
- [高级特性](#高级特性)
- [最佳实践](#最佳实践)
- [故障排除](#故障排除)
- [性能调优](#性能调优)
- [版本历史](#版本历史)

---

## 🚀 快速开始

### 基础安装

```bash
# 安装依赖
npm install ws @types/ws zlib compression

# TypeScript 支持
npm install -D typescript @types/node
```

### 基础使用

```typescript
import { WebSocketConnectionPool } from './ConnectionPool';

// 创建连接池
const pool = new WebSocketConnectionPool({
  url: 'wss://example.com/ws',
  maxConnections: 100,
  compression: true
});

// 订阅消息
pool.subscribe('market_data', (data) => {
  console.log('收到市场数据:', data);
});

// 发送消息
pool.send({
  type: 'subscribe',
  channels: ['btc_usd', 'eth_usd']
});
```

### 基本配置

```typescript
const config = {
  // WebSocket 服务器 URL
  url: 'wss://api.example.com/v1/ws',
  
  // 最大连接数（默认1000）
  maxConnections: 1000,
  
  // 连接超时时间（毫秒，默认10000）
  connectionTimeout: 10000,
  
  // 心跳间隔（毫秒，默认30000）
  heartbeatInterval: 30000,
  
  // 是否启用压缩（默认true）
  compression: true,
  
  // 压缩阈值（字节，默认1024）
  compressionThreshold: 1024,
  
  // 重试配置
  retry: {
    maxAttempts: 5,
    delayMs: 1000,
    backoffFactor: 2
  },
  
  // 日志配置
  debug: process.env.NODE_ENV === 'development'
};

const pool = new WebSocketConnectionPool(config);
```

---

## 📖 API 参考

### WebSocketConnectionPool 类

#### 构造函数

```typescript
new WebSocketConnectionPool(config: ConnectionPoolConfig)
```

**参数**:
- `config: ConnectionPoolConfig` - 连接池配置对象

#### 配置接口

```typescript
interface ConnectionPoolConfig {
  /** WebSocket 服务器 URL */
  url: string;
  
  /** 最大连接数 (默认: 1000) */
  maxConnections?: number;
  
  /** 连接超时时间 (毫秒，默认: 10000) */
  connectionTimeout?: number;
  
  /** 心跳间隔 (毫秒，默认: 30000) */
  heartbeatInterval?: number;
  
  /** 是否启用压缩 (默认: true) */
  compression?: boolean;
  
  /** 压缩阈值 (字节，默认: 1024) */
  compressionThreshold?: number;
  
  /** 重试配置 */
  retry?: RetryConfig;
  
  /** 调试模式 */
  debug?: boolean;
}
```

#### 主要方法

##### connect()

```typescript
async connect(): Promise<void>
```

建立连接池连接。

**返回值**: `Promise<void>`

**示例**:
```typescript
await pool.connect();
console.log('连接池已连接');
```

##### disconnect()

```typescript
async disconnect(): Promise<void>
```

断开所有连接。

**返回值**: `Promise<void>`

**示例**:
```typescript
await pool.disconnect();
console.log('连接池已断开');
```

##### subscribe()

```typescript
subscribe(channel: string, callback: MessageCallback): void
```

订阅指定频道的消息。

**参数**:
- `channel: string` - 频道名称
- `callback: MessageCallback` - 消息处理回调

**示例**:
```typescript
pool.subscribe('btc_usd', (data) => {
  console.log('BTC价格:', data.price);
});

pool.subscribe('eth_usd', (data) => {
  console.log('ETH价格:', data.price);
});
```

##### unsubscribe()

```typescript
unsubscribe(channel: string): void
```

取消订阅指定频道。

**参数**:
- `channel: string` - 频道名称

**示例**:
```typescript
pool.unsubscribe('btc_usd');
```

##### send()

```typescript
send(message: WebSocketMessage): void
```

发送消息到服务器。

**参数**:
- `message: WebSocketMessage` - 要发送的消息对象

**示例**:
```typescript
pool.send({
  type: 'subscribe',
  channels: ['btc_usd', 'eth_usd']
});
```

##### getStats()

```typescript
getStats(): ConnectionPoolStats
```

获取连接池统计信息。

**返回值**: `ConnectionPoolStats`

**示例**:
```typescript
const stats = pool.getStats();
console.log('连接数:', stats.activeConnections);
console.log('消息接收数:', stats.messagesReceived);
console.log('消息发送数:', stats.messagesSent);
```

#### 统计信息接口

```typescript
interface ConnectionPoolStats {
  /** 活跃连接数 */
  activeConnections: number;
  
  /** 总连接数 */
  totalConnections: number;
  
  /** 消息接收数 */
  messagesReceived: number;
  
  /** 消息发送数 */
  messagesSent: number;
  
  /** 错误数 */
  errors: number;
  
  /** 重连次数 */
  reconnectAttempts: number;
  
  /** 平均延迟 (毫秒) */
  averageLatency: number;
  
  /** 压缩率 (百分比) */
  compressionRate: number;
  
  /** 吞吐量 (消息/秒) */
  throughput: number;
}
```

---

## ⚙️ 配置选项

### 高级配置

```typescript
const advancedConfig = {
  url: 'wss://api.example.com/v1/ws',
  
  // 负载均衡配置
  loadBalancing: {
    strategy: 'round-robin', // 'round-robin' | 'random' | 'least-connections'
    healthCheckInterval: 5000,
    unhealthyThreshold: 3
  },
  
  // 消息批处理
  batching: {
    enabled: true,
    maxSize: 100,
    timeoutMs: 16,
    flushOnIdle: true
  },
  
  // 压缩配置
  compression: {
    enabled: true,
    level: 6, // 1-9, 默认6
    threshold: 1024, // 字节
    memLevel: 8
  },
  
  // 安全配置
  security: {
    verifyClient: true,
    caCert: './certs/ca.crt',
    protocols: ['v1', 'v2']
  },
  
  // 性能监控
  monitoring: {
    enabled: true,
    metricsInterval: 1000,
    alertThresholds: {
      latency: 100, // 毫秒
      errorRate: 0.01, // 1%
      memoryUsage: 0.8 // 80%
    }
  }
};
```

### 环境变量配置

```bash
# WebSocket 服务器配置
WEBSOCKET_URL=wss://api.example.com/v1/ws
WEBSOCKET_MAX_CONNECTIONS=1000
WEBSOCKET_COMPRESSION=true

# 心跳配置
WEBSOCKET_HEARTBEAT_INTERVAL=30000

# 重试配置
WEBSOCKET_RETRY_ATTEMPTS=5
WEBSOCKET_RETRY_DELAY_MS=1000

# 监控配置
WEBSOCKET_MONITORING_ENABLED=true
WEBSOCKET_METRICS_INTERVAL=1000
```

---

## 🚀 高级特性

### 1. 连接负载均衡

```typescript
const pool = new WebSocketConnectionPool({
  url: 'wss://api.example.com/v1/ws',
  maxConnections: 100,
  loadBalancing: {
    strategy: 'least-connections',
    healthCheckInterval: 5000
  }
});
```

**支持的负载均衡策略**:
- `round-robin`: 轮询
- `random`: 随机
- `least-connections`: 最少连接数

### 2. 消息批处理

```typescript
const pool = new WebSocketConnectionPool({
  url: 'wss://api.example.com/v1/ws',
  batching: {
    enabled: true,
    maxSize: 50,
    timeoutMs: 16,
    flushOnIdle: true
  }
});
```

### 3. 智能重连

```typescript
const pool = new WebSocketConnectionPool({
  url: 'wss://api.example.com/v1/ws',
  retry: {
    maxAttempts: 10,
    delayMs: 1000,
    backoffFactor: 2,
    jitter: true,
    maxDelayMs: 30000
  }
});
```

### 4. 性能监控

```typescript
const pool = new WebSocketConnectionPool({
  url: 'wss://api.example.com/v1/ws',
  monitoring: {
    enabled: true,
    metricsInterval: 1000,
    alertThresholds: {
      latency: 50,
      errorRate: 0.01,
      memoryUsage: 0.8
    }
  }
});

// 监听性能事件
pool.on('performance_alert', (alert) => {
  console.log('性能警报:', alert);
});
```

---

## 💡 最佳实践

### 1. 连接池管理

```typescript
// 单例模式
const createConnectionPool = () => {
  if (!global.connectionPool) {
    global.connectionPool = new WebSocketConnectionPool({
      url: process.env.WEBSOCKET_URL,
      maxConnections: parseInt(process.env.MAX_CONNECTIONS || '1000'),
      compression: true,
      heartbeatInterval: 30000
    });
  }
  return global.connectionPool;
};

// 使用
const pool = createConnectionPool();
```

### 2. 错误处理

```typescript
pool.on('error', (error) => {
  console.error('WebSocket错误:', error);
  
  // 根据错误类型采取不同措施
  if (error.code === 'ECONNREFUSED') {
    // 连接被拒绝，等待重试
    console.log('连接被拒绝，等待重试...');
  } else if (error.code === 'TIMEOUT') {
    // 超时，检查网络连接
    console.log('连接超时，检查网络...');
  }
});

pool.on('reconnect', (attempt) => {
  console.log(`第${attempt}次重连尝试...`);
});

pool.on('reconnect_failed', () => {
  console.error('重连失败，请检查配置');
});
```

### 3. 消息路由

```typescript
// 消息路由器
class MessageRouter {
  private handlers: Map<string, Function> = new Map();
  
  register(channel: string, handler: Function) {
    this.handlers.set(channel, handler);
  }
  
  route(message: WebSocketMessage) {
    const handler = this.handlers.get(message.type);
    if (handler) {
      try {
        handler(message.data);
      } catch (error) {
        console.error(`消息处理错误 [${message.type}]:`, error);
      }
    }
  }
}

// 使用
const router = new MessageRouter();
router.register('market_data', this.handleMarketData);
router.register('order_update', this.handleOrderUpdate);

pool.subscribe('all', (message) => {
  router.route(message);
});
```

### 4. 资源清理

```typescript
// 优雅关闭
async function gracefulShutdown() {
  console.log('开始优雅关闭...');
  
  // 停止接收新消息
  pool.pause();
  
  // 等待正在处理的消息完成
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 断开连接
  await pool.disconnect();
  
  console.log('优雅关闭完成');
  process.exit(0);
}

// 监听退出信号
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
```

---

## 🔧 故障排除

### 常见问题

#### 1. 连接超时

**问题**: 连接建立失败，提示超时

**解决方案**:
```typescript
const pool = new WebSocketConnectionPool({
  url: 'wss://api.example.com/v1/ws',
  connectionTimeout: 30000, // 增加超时时间
  retry: {
    maxAttempts: 10,
    delayMs: 2000,
    backoffFactor: 2
  }
});
```

#### 2. 内存泄漏

**问题**: 内存使用持续增长

**解决方案**:
```typescript
// 定期清理
setInterval(() => {
  pool.cleanup();
  const stats = pool.getStats();
  console.log(`内存使用: ${(stats.memoryUsage / 1024 / 1024).toFixed(2)}MB`);
}, 60000);

// 监控内存使用
pool.on('memory_warning', (usage) => {
  console.warn(`内存使用过高: ${(usage / 1024 / 1024).toFixed(2)}MB`);
});
```

#### 3. 消息丢失

**问题**: 消息发送后未收到确认

**解决方案**:
```typescript
// 启用消息确认
const pool = new WebSocketConnectionPool({
  url: 'wss://api.example.com/v1/ws',
  ackTimeout: 5000,
  retry: {
    maxAttempts: 3,
    delayMs: 1000
  }
});

// 监听确认事件
pool.on('ack', (messageId) => {
  console.log(`消息确认: ${messageId}`);
});

pool.on('nack', (messageId, error) => {
  console.error(`消息确认失败: ${messageId}`, error);
});
```

#### 4. 性能问题

**问题**: 消息延迟高，吞吐量低

**解决方案**:
```typescript
// 启用批处理和压缩
const pool = new WebSocketConnectionPool({
  url: 'wss://api.example.com/v1/ws',
  batching: {
    enabled: true,
    maxSize: 100,
    timeoutMs: 16
  },
  compression: {
    enabled: true,
    level: 6
  }
});

// 监控性能
pool.on('performance', (metrics) => {
  console.log('性能指标:', {
    latency: metrics.latency + 'ms',
    throughput: metrics.throughput + 'msg/s',
    compressionRate: metrics.compressionRate + '%'
  });
});
```

### 调试模式

```typescript
const pool = new WebSocketConnectionPool({
  url: 'wss://api.example.com/v1/ws',
  debug: true,
  logLevel: 'debug' // 'debug' | 'info' | 'warn' | 'error'
});

// 启用详细日志
pool.on('debug', (message, data) => {
  console.log(`[${new Date().toISOString()}] ${message}`, data);
});
```

---

## 📈 性能调优

### 1. 连接数优化

```typescript
// 根据服务器性能调整连接数
const optimalConnections = Math.min(
  navigator.hardwareConcurrency * 2, // CPU核心数 * 2
  1000 // 最大1000
);

const pool = new WebSocketConnectionPool({
  url: 'wss://api.example.com/v1/ws',
  maxConnections: optimalConnections
});
```

### 2. 批处理优化

```typescript
// 根据消息频率调整批处理参数
const pool = new WebSocketConnectionPool({
  url: 'wss://api.example.com/v1/ws',
  batching: {
    enabled: true,
    maxSize: 50, // 小批量，更及时
    timeoutMs: 8, // 更短的超时
    flushOnIdle: true
  }
});
```

### 3. 压缩优化

```typescript
// 根据消息大小选择压缩策略
const pool = new WebSocketConnectionPool({
  url: 'wss://api.example.com/v1/ws',
  compression: {
    enabled: true,
    level: 4, // 中等压缩速度
    threshold: 512, // 更小的压缩阈值
    memLevel: 6
  }
});
```

### 4. 内存优化

```typescript
// 限制内存使用
const pool = new WebSocketConnectionPool({
  url: 'wss://api.example.com/v1/ws',
  memoryLimit: 512 * 1024 * 1024, // 512MB
  gcInterval: 300000, // 5分钟执行一次GC
  messageHistory: {
    maxSize: 1000, // 最多保留1000条消息历史
    ttl: 3600000 // 1小时后自动清理
  }
});
```

---

## 📋 版本历史

### v1.0.0 (2026-02-26)
- ✅ 初始版本发布
- ✅ 基础连接池功能
- ✅ 消息压缩支持
- ✅ 性能监控
- ✅ 完整的TypeScript支持
- ✅ 宪法合规性检查 (§119/§306/§320)

### 计划中的功能
- 🔲 消息持久化
- 🔲 分布式连接池
- 🔲 更多的负载均衡策略
- 🔲 自动扩缩容
- 🆔 高级性能分析

---

## 📝 许可证

MIT License - 详见 LICENSE 文件

---

## 🆘 支持

如有问题或建议，请：
1. 查看[故障排除](#故障排除)章节
2. 启用[调试模式](#调试模式)
3. 检查[性能调优](#性能调优)建议
4. 提交 Issue 到项目仓库

---

**© 2026 OpenDoge Technology Ministry**  
**宪法依据**: §119主题驱动开发、§306零停机协议、§320 L2+项目强制使用原则