# WebSocket通信优化标准 (DS-06)

**版本**: v1.0.0  
**状态**: 🟡 规划草案（当前仓库未落地）  
**类型**: 开发标准 (Development Standard)  
**宪法依据**: §310 实时通信标准、§311 WebSocket连接管理标准  
**来源文档**: PERFORMANCE_BOOST_PLAN.md (useWebSocketWithThrottle 部分)  
**制定者**: 办公厅主任 (Director of General Office)  
**批准人**: 元首 (User)  
**执行者**: 科技部 (Technology Ministry)

---

> 注：本文中的前端目录与文件路径为规划示例，当前仓库不保证已全部落地。

## 🎯 标准目标

规范 WebSocket 通信的性能优化，实现高频状态更新下的通信节流，防止 10Hz → 60Hz 的高频更新阻塞 UI，确保界面保持流畅。

## 📋 核心要求

### 1. 性能目标
- **更新频率**: 支持最高 60Hz 的数据更新
- **节流效果**: 高频更新合并，减少不必要的渲染
- **延迟控制**: 节流后消息延迟 < 32ms
- **内存使用**: 节流队列内存占用 < 10MB

### 2. 架构设计
- **节流机制**: 基于时间窗口的消息合并
- **优先级队列**: 重要消息优先处理
- **自适应节流**: 根据网络状况动态调整节流参数
- **降级策略**: 网络异常时的降级处理

## 🛠️ 核心组件规范

### 1. useWebSocketWithThrottle Hook (`<frontend>/lib/patterns/useWebSocketWithThrottle.ts`)
```typescript
// Hook 接口定义
function useWebSocketWithThrottle<T>(
  websocket: WebSocket | null,
  options: ThrottleOptions = {}
): {
  send: (data: T) => Promise<void>;
  messages: T[];
  status: 'connected' | 'disconnected' | 'error';
  queueSize: number;
};

// 节流选项
interface ThrottleOptions {
  throttleMs?: number;      // 节流时间窗口，默认 32ms (约 30fps)
  maxQueueSize?: number;    // 最大队列大小，默认 100
  priority?: (data: any) => number; // 优先级函数
  onDropped?: (data: any) => void;  // 数据丢弃回调
}
```

### 2. 节流算法实现
```typescript
class WebSocketThrottler<T> {
  private queue: Array<{ data: T; priority: number; timestamp: number }> = [];
  private lastSendTime: number = 0;
  private isProcessing: boolean = false;
  
  constructor(private options: ThrottleOptions) {}
  
  // 添加消息到队列
  add(data: T, priority?: number): void {
    const item = {
      data,
      priority: priority ?? this.options.priority?.(data) ?? 0,
      timestamp: Date.now()
    };
    
    // 插入到优先级队列
    this.insertByPriority(item);
    
    // 检查队列大小限制
    if (this.queue.length > (this.options.maxQueueSize ?? 100)) {
      const dropped = this.queue.pop();
      this.options.onDropped?.(dropped?.data);
    }
    
    // 触发处理
    this.processQueue();
  }
  
  // 处理队列
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;
    
    const now = Date.now();
    const timeSinceLastSend = now - this.lastSendTime;
    
    // 检查是否需要节流
    if (timeSinceLastSend < (this.options.throttleMs ?? 32)) {
      setTimeout(() => this.processQueue(), (this.options.throttleMs ?? 32) - timeSinceLastSend);
      return;
    }
    
    this.isProcessing = true;
    
    try {
      // 获取最高优先级的消息
      const item = this.queue.shift();
      if (item) {
        await this.sendToWebSocket(item.data);
        this.lastSendTime = Date.now();
      }
    } finally {
      this.isProcessing = false;
      
      // 继续处理剩余消息
      if (this.queue.length > 0) {
        this.processQueue();
      }
    }
  }
}
```

## 📝 技术实施标准

### 1. 节流策略
- **时间窗口节流**: 固定时间窗口内只发送一次消息
- **自适应节流**: 根据网络延迟动态调整节流参数
- **优先级节流**: 高优先级消息不受节流限制
- **批量合并**: 相似消息在节流窗口内合并发送

### 2. 队列管理
- **优先级排序**: 消息按优先级处理，高优先级优先
- **容量限制**: 队列大小有限制，防止内存溢出
- **过期清理**: 超时未处理的消息自动清理
- **统计监控**: 队列状态实时监控和告警

### 3. 错误处理
- **网络异常**: 网络断开时暂停节流，积累消息
- **重连恢复**: 网络恢复后批量发送积累的消息
- **降级策略**: 节流失败时降级为直接发送
- **错误报告**: 节流过程中的错误记录和报告

### 4. 性能监控
- **队列长度监控**: 实时监控队列大小
- **处理延迟监控**: 消息从入队到发送的延迟
- **丢弃率监控**: 因队列满被丢弃的消息比例
- **节流效果监控**: 节流减少的发送次数统计

## ✅ 验收标准

### 功能验收
1. **节流效果**: 高频更新被有效节流，减少不必要的渲染
2. **优先级处理**: 高优先级消息能够优先处理
3. **队列管理**: 队列大小控制有效，无内存泄漏
4. **错误恢复**: 网络异常时能够正确恢复和重试

### 性能验收
1. **帧率保持**: 高频更新下界面保持 60fps
2. **节流延迟**: 节流后消息平均延迟 < 32ms
3. **内存效率**: 队列内存占用 < 10MB
4. **CPU 使用**: 节流逻辑 CPU 占用 < 5%

### 质量验收
1. **类型安全**: 完整的 TypeScript 类型定义
2. **错误处理**: 所有可能的错误都有妥善处理
3. **测试覆盖**: 核心功能单元测试覆盖率 > 80%
4. **文档完整**: API 文档和使用示例完整

## 🔄 实施流程

### 步骤 1: Hook 实现
1. **创建 Hook 文件**: `<frontend>/lib/patterns/useWebSocketWithThrottle.ts`
2. **实现节流逻辑**: 基于时间窗口的节流算法
3. **实现优先级队列**: 支持消息优先级排序
4. **实现状态管理**: 连接状态、队列状态管理

### 步骤 2: Colyseus 集成
1. **改造 useRoomState**: 集成 useWebSocketWithThrottle
2. **配置节流参数**: 根据场景配置合适的节流参数
3. **实现消息优先级**: 定义不同类型消息的优先级
4. **集成监控**: 集成到系统性能监控

### 步骤 3: 测试优化
1. **性能测试**: 测试高频更新场景下的性能表现
2. **压力测试**: 测试高并发下的稳定性和内存使用
3. **兼容性测试**: 测试不同网络环境下的表现
4. **用户体验测试**: 测试实际使用中的流畅度

## 📊 性能指标

| 指标 | 优化前 | 优化后目标 | 测量方法 |
|------|--------|------------|----------|
| 渲染帧率 (FPS) | 10-30fps | 稳定 60fps | Chrome FPS 监控 |
| 主线程占用 | 40-60% | < 20% | Performance 面板 |
| 消息发送次数 | 60次/秒 | 30次/秒 | 网络监控 |
| 消息延迟 | 0-16ms | < 32ms | 自定义监控 |
| 内存使用 | 不定 | < 10MB | Memory 面板 |

## 🛡️ 兼容性与降级

### 1. 网络环境适应
- **良好网络**: 使用较宽松的节流参数
- **较差网络**: 使用较严格的节流参数
- **离线状态**: 积累消息，恢复后批量发送
- **不稳定网络**: 自适应调整节流策略

### 2. 降级策略
- **完全降级**: 节流逻辑异常时直接发送
- **部分降级**: 只保留基本节流，关闭高级功能
- **渐进增强**: 优先尝试优化，降级时保证基本功能

### 3. 资源限制处理
- **内存限制**: 监控队列内存，超出时清理旧消息
- **CPU 限制**: 限制节流逻辑的执行频率
- **网络限制**: 根据网络状况动态调整节流强度

## 🔗 相关标准

- **DS-01**: 前端架构重构标准
- **DS-02**: Colyseus 集成标准
- **DS-05**: 高性能渲染优化标准
- **DS-07**: Worker 线程管理标准
- **TS-101**: WebSocket 连接管理标准
- **TS-104**: 消息路由策略标准

---

**更新记录**:
- **2026-02-09**: 标准创建，基于 PERFORMANCE_BOOST_PLAN.md useWebSocketWithThrottle 部分

**实施状态**:
- [ ] useWebSocketWithThrottle Hook 实现
- [ ] Colyseus useRoomState 集成改造
- [ ] 优先级消息定义
- [ ] 性能测试与优化
- [ ] 监控与告警集成

*遵循宪法约束: 通信即效率，节流即优化，性能即体验。*
