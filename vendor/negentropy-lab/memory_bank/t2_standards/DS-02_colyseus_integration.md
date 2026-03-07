# Colyseus 集成标准 (DS-02)

**版本**: v1.0.0  
**状态**: 🟡 规划草案（当前仓库未落地）  
**类型**: 开发标准 (Development Standard)  
**宪法依据**: §310 实时通信标准、§311 WebSocket 连接管理标准  
**来源文档**: FRONTEND_REFACTOR_PLAN.md (Colyseus 深度集成部分)  
**制定者**: 办公厅主任 (Director of General Office)  
**批准人**: 元首 (User)  
**执行者**: 科技部 (Technology Ministry)

---

> 注：本文中的前端目录与文件路径为规划示例，当前仓库不保证已全部落地。

## 🎯 标准目标

规范 Colyseus WebSocket 实时通信层的集成标准，确保前端与后端 Agent 系统的稳定、高效、可靠的实时通信，支持多 Agent 协同工作。

## 📋 核心要求

### 1. 集成架构
- **通信协议**: 基于 WebSocket 的实时双向通信
- **连接模式**: 单 Client 多 Room 模式，支持同时连接多个聊天房间
- **状态同步**: 利用 Colyseus Schema 实现自动状态同步
- **消息路由**: 支持公开频道、私聊频道、Agent 动作、系统通知四种消息类型

### 2. 性能要求
- **连接建立时间**: < 1秒
- **消息往返时间 (RTT)**: < 100ms
- **断线重连时间**: < 3秒
- **并发连接数**: 支持至少 100 个并发用户
- **消息吞吐量**: 支持 1000+ 消息/秒

## 🛠️ 核心组件规范

### 1. Colyseus Client 封装 (`<frontend>/lib/colyseus.ts`)
```typescript
// 标准接口定义
interface ColyseusClientConfig {
  endpoint: string;           // 服务器地址 (ws://localhost:2567)
  reconnectAttempts: number;  // 重试次数 (默认: 3)
  reconnectInterval: number;  // 重试间隔 (默认: 2000ms)
  heartbeatInterval: number;  // 心跳间隔 (默认: 30000ms)
}

// 核心功能要求
// 1. Client 单例管理
// 2. 连接状态监控
// 3. 自动重连机制
// 4. 错误处理与恢复
```

### 2. Colyseus Context 封装 (`<frontend>/contexts/ColyseusContext.tsx`)
```typescript
// Context 提供的能力
interface ColyseusContextValue {
  client: Client | null;                // Colyseus Client 实例
  isConnected: boolean;                 // 连接状态
  connectionError: Error | null;        // 连接错误
  connect: (endpoint?: string) => Promise<void>;  // 连接方法
  disconnect: () => void;               // 断开连接
  joinRoom: (roomName: string, options?: any) => Promise<Room>; // 加入房间
}
```

### 3. 基础 Hook (`<frontend>/hooks/useColyseus.ts`)
```typescript
// Hook 接口定义
function useColyseus(): {
  client: Client | null;
  isConnected: boolean;
  error: Error | null;
  connect: (endpoint?: string) => Promise<void>;
  disconnect: () => void;
};

// 功能要求
// 1. 提供 Client 实例访问
// 2. 实时连接状态跟踪
// 3. 自动错误恢复
// 4. 连接生命周期管理
```

### 4. 房间状态 Hook (`<frontend>/hooks/useRoomState.ts`)
```typescript
// Hook 接口定义
function useRoomState<T extends Schema>(
  room: Room<T> | null,
  statePath?: string
): T | null;

// 功能要求
// 1. 自动订阅房间状态变化
// 2. 支持状态路径选择（部分状态订阅）
// 3. 性能优化（防抖/节流）
// 4. 清理和取消订阅
```

## 📝 技术实施标准

### 1. 连接管理
- **初始化连接**: 应用启动时自动建立连接
- **心跳保持**: 30秒心跳包，检测连接活性
- **断线检测**: 网络异常自动检测，触发重连
- **重连策略**: 指数退避重连，最多重试 3 次
- **连接状态**: 提供连接中、已连接、断开、错误四种状态

### 2. 房间管理
- **房间加入**: 支持参数传递，自动处理加入逻辑
- **房间离开**: 优雅离开，清理资源
- **房间状态**: 实时同步 Schema 定义的状态
- **消息监听**: 支持房间消息的发送和接收
- **错误处理**: 房间级别错误捕获和处理

### 3. 状态同步
- **Schema 一致性**: 前端 TypeScript 类型必须与后端 Schema 完全一致
- **增量更新**: 利用 Colyseus 的增量更新机制，减少数据传输
- **状态订阅**: 支持选择性订阅部分状态，优化性能
- **变更检测**: 状态变更时触发相应组件更新

### 4. 消息处理
- **消息类型**: 支持 Colyseus 定义的四种标准消息类型
- **序列化**: JSON 序列化/反序列化，UTF-8 编码
- **大小限制**: 单条消息大小限制为 1MB
- **错误处理**: 消息发送失败的重试机制
- **顺序保证**: 消息发送的顺序性保证

## ✅ 验收标准

### 功能验收
1. **连接能力**: 能够成功连接到 Colyseus 服务器 (ws://localhost:2567)
2. **房间加入**: 能够成功加入指定的聊天房间
3. **状态同步**: 房间状态变更能够实时同步到前端
4. **消息通信**: 能够发送和接收实时消息
5. **断线重连**: 网络异常后能够自动重连并恢复状态

### 性能验收
1. **连接时间**: 首次连接建立时间 < 1秒
2. **状态延迟**: 状态变更到前端更新的延迟 < 100ms
3. **内存使用**: 单个连接内存占用 < 10MB
4. **CPU 使用**: 空闲状态下 CPU 使用率 < 1%
5. **网络流量**: 心跳包流量 < 1KB/分钟

### 质量验收
1. **错误处理**: 所有网络错误都有妥善处理，不导致应用崩溃
2. **类型安全**: 完整的 TypeScript 类型定义，无 any 类型
3. **代码覆盖率**: 核心功能单元测试覆盖率 > 80%
4. **文档完整**: API 文档完整，包含使用示例和故障排查

## 🔄 实施流程

### 步骤 1: 环境配置
```bash
# 安装依赖
npm install colyseus.js

# TypeScript 类型配置
# 从 server/schema/ 目录获取 Schema 定义生成前端类型
```

### 步骤 2: 核心组件实现
1. **Client 封装**: 实现 `<frontend>/lib/colyseus.ts`
2. **Context 实现**: 实现 `<frontend>/contexts/ColyseusContext.tsx`
3. **Hooks 实现**: 实现 `<frontend>/hooks/useColyseus.ts` 和 `<frontend>/hooks/useRoomState.ts`
4. **类型定义**: 根据后端 Schema 生成前端类型定义

### 步骤 3: 集成测试
1. **单元测试**: 测试每个独立组件的功能
2. **集成测试**: 测试组件间的协作
3. **E2E 测试**: 测试完整的连接-通信流程
4. **性能测试**: 测试连接性能和资源使用

### 步骤 4: 文档与示例
1. **API 文档**: 生成完整的 API 文档
2. **使用示例**: 提供典型使用场景的代码示例
3. **故障排查**: 常见问题解决方案文档

## 📊 监控指标

| 指标 | 目标值 | 监控方法 | 告警阈值 |
|------|--------|----------|----------|
| 连接成功率 | > 99.9% | 日志分析 | < 99% |
| 平均连接时间 | < 1秒 | 性能监控 | > 3秒 |
| 消息往返时间 | < 100ms | 网络监控 | > 500ms |
| 断线重连成功率 | > 99% | 错误监控 | < 95% |
| 内存使用峰值 | < 50MB | 内存监控 | > 100MB |

## 🛡️ 容错与恢复

### 1. 网络异常处理
- **短暂断网**: 自动重连，保持用户状态
- **长时断网**: 提示用户，保存未发送消息
- **服务器异常**: 优雅降级，显示维护信息
- **版本不兼容**: 检测版本，提示升级

### 2. 错误恢复策略
- **连接错误**: 指数退避重试，最多 3 次
- **房间错误**: 重新加入房间，恢复状态
- **状态错误**: 重新同步，从服务器获取最新状态
- **消息错误**: 重发机制，消息去重

### 3. 降级方案
- **完全降级**: WebSocket 不可用时切换为 HTTP 轮询
- **部分降级**: 部分功能不可用时提供替代方案
- **只读模式**: 网络异常时切换为只读模式
- **本地缓存**: 重要状态本地缓存，离线可用

## 🔗 相关标准

- **DS-01**: 前端架构重构标准
- **DS-03**: React 19 应用标准
- **TS-101**: WebSocket 连接管理标准
- **TS-102**: 消息序列化格式标准
- **TS-103**: 房间状态同步标准
- **AS-101**: Agent 接口规范标准

---

**更新记录**:
- **2026-02-09**: 标准创建，基于 FRONTEND_REFACTOR_PLAN.md Colyseus 集成部分

**实施状态**:
- [ ] Colyseus Client 封装
- [ ] Colyseus Context 实现
- [ ] useColyseus Hook 实现
- [ ] useRoomState Hook 实现
- [ ] 类型定义生成
- [ ] 集成测试覆盖

*遵循宪法约束: 通信即协作，连接即信任，实时即效率。*
