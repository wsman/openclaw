# Entropy Monitor Plugin

## 概述

熵值监控插件提供系统级监控功能，包括CPU、内存、磁盘监控以及Negentropy特有的熵值追踪（H_sys）和阈值告警。

## 宪法依据

- **§101 同步公理**: 代码与文档必须原子性同步
- **§102 熵减原则**: 监控系统熵值，确保持续熵减
- **§111-§113 资源管理公理**: 监控计算资源使用、配额调度和消耗追踪

## 核心功能

### 1. CPU监控

实时监控CPU使用率和负载：

```typescript
const cpuStats = await plugin.getCPUUsage();
console.log(`CPU Usage: ${cpuStats.usagePercent}%`);
console.log(`Load: ${cpuStats.load1m}, ${cpuStats.load5m}, ${cpuStats.load15m}`);
```

**OpenClaw复用**: 复用OpenClaw的日志系统架构（40%）

### 2. 内存监控

实时监控内存使用情况：

```typescript
const memoryStats = await plugin.getMemoryUsage();
console.log(`Memory Usage: ${memoryStats.usagePercent}%`);
console.log(`Used: ${memoryStats.used}MB / ${memoryStats.total}MB`);
```

### 3. 熵值监控（H_sys实时追踪）

监控Negentropy系统的综合熵值：

```typescript
const entropy = await plugin.getEntropy();
console.log(`H_sys (综合熵): ${entropy.h_sys}`);
console.log(`H_cog (认知熵): ${entropy.h_cog}`);
console.log(`H_struct (结构熵): ${entropy.h_struct}`);
console.log(`H_align (对齐熵): ${entropy.h_align}`);
console.log(`H_bio (生理熵): ${entropy.h_bio}`);
```

**熵值计算**:
- `H_sys`: 综合熵值（基于CPU、内存、磁盘使用率）
- `H_cog`: 认知熵（基于Agent任务复杂度和失败率）
- `H_struct`: 结构熵（基于代码结构、文档一致性）
- `H_align`: 对齐熵（基于宪法合规性）
- `H_bio`: 生理熵（基于系统健康度、稳定性）

### 4. 阈值告警

自动检测超阈值情况并发送告警：

```typescript
const alerts = await plugin.checkThresholds();

for (const alert of alerts) {
  console.warn(`[${alert.level}] ${alert.message}`);
}
```

**告警级别**:
- `info`: 信息
- `warn`: 警告
- `error`: 错误
- `critical`: 严重

### 5. 监控循环

自动定时监控系统指标：

```typescript
// 启动监控
await plugin.startMonitoring();

// 停止监控
await plugin.stopMonitoring();
```

## 配置示例

```json
{
  "id": "entropy-monitor",
  "name": "Entropy Monitor Plugin",
  "version": "1.0.0",
  "kind": "monitoring",
  "negentropy": {
    "entropyMonitor": {
      "metrics": [
        "h_sys",
        "h_cog",
        "h_struct",
        "h_align",
        "h_bio",
        "cpu",
        "memory",
        "disk"
      ],
      "thresholds": {
        "h_sys": 0.7,
        "h_cog": 0.5,
        "h_struct": 0.5,
        "h_align": 0.5,
        "h_bio": 0.8,
        "cpu": 80,
        "memory": 90,
        "disk": 85
      },
      "alertInterval": 60000,
      "monitorInterval": 5000,
      "dataRetentionDays": 7
    }
  }
}
```

**配置说明**:
- `metrics`: 监控指标列表
- `thresholds`: 阈值配置（熵值0-1，资源0-100）
- `alertInterval`: 告警间隔（毫秒）
- `monitorInterval`: 监控间隔（毫秒）
- `dataRetentionDays`: 数据保留天数

## API参考

### 方法列表

#### `getCPUUsage()`

获取CPU使用率。

**返回**: `Promise<CPUStats>`

```typescript
interface CPUStats {
  usagePercent: number;  // CPU使用率
  load1m: number;        // 1分钟负载
  load5m: number;        // 5分钟负载
  load15m: number;       // 15分钟负载
  timestamp: number;
}
```

---

#### `getMemoryUsage()`

获取内存使用情况。

**返回**: `Promise<MemoryStats>`

```typescript
interface MemoryStats {
  total: number;          // 总内存 (MB)
  used: number;           // 已用内存 (MB)
  free: number;           // 空闲内存 (MB)
  usagePercent: number;    // 内存使用率 (%)
  timestamp: number;
}
```

---

#### `getDiskUsage()`

获取磁盘使用情况。

**返回**: `Promise<DiskStats>`

```typescript
interface DiskStats {
  total: number;          // 总容量 (GB)
  used: number;           // 已用容量 (GB)
  free: number;           // 空闲容量 (GB)
  usagePercent: number;    // 使用率 (%)
  timestamp: number;
}
```

---

#### `getEntropy()`

获取熵值指标。

**返回**: `Promise<EntropyMetrics>`

```typescript
interface EntropyMetrics {
  h_sys: number;          // 综合熵值
  h_cog: number;          // 认知熵
  h_struct: number;       // 结构熵
  h_align: number;        // 对齐熵
  h_bio: number;          // 生理熵
  timestamp: number;
}
```

---

#### `checkThresholds()`

检查阈值告警。

**返回**: `Promise<Alert[]>`

```typescript
interface Alert {
  alertId: string;
  level: 'info' | 'warn' | 'error' | 'critical';
  metric: string;         // 触发告警的指标
  currentValue: number;   // 当前值
  threshold: number;      // 阈值
  message: string;        // 告警消息
  timestamp: number;
}
```

---

#### `getCurrentMetrics()`

获取当前系统指标。

**返回**: `Promise<SystemMetrics>`

```typescript
interface SystemMetrics {
  cpu: CPUStats;
  memory: MemoryStats;
  disk: DiskStats;
  entropy: EntropyMetrics;
  timestamp: number;
}
```

---

#### `getMetricsHistory(limit?)`

获取指标历史记录。

**参数**:
- `limit`: 返回记录数量限制（默认100）

**返回**: `Promise<SystemMetrics[]>`

---

#### `getEntropyTrend(hours?)`

获取熵值趋势。

**参数**:
- `hours`: 查询小时数（默认24）

**返回**: `Promise<Array<{ timestamp: number; h_sys: number }>>`

---

#### `startMonitoring()`

启动监控循环。

**返回**: `Promise<void>`

---

#### `stopMonitoring()`

停止监控循环。

**返回**: `Promise<void>`

---

## 使用示例

### 基本监控

```typescript
import EntropyMonitorPlugin from './plugins/core/entropy-monitor';

// 初始化插件
const plugin = new EntropyMonitorPlugin();
await plugin.initialize(api);

// 获取当前指标
const metrics = await plugin.getCurrentMetrics();
console.log(`CPU: ${metrics.cpu.usagePercent}%`);
console.log(`Memory: ${metrics.memory.usagePercent}%`);
console.log(`H_sys: ${metrics.entropy.h_sys}`);
```

### 熵值监控

```typescript
// 获取熵值指标
const entropy = await plugin.getEntropy();

// 检查熵值是否过高
if (entropy.h_sys > 0.7) {
  console.warn('System entropy is too high!');
  console.warn('H_sys:', entropy.h_sys);
  console.warn('H_cog:', entropy.h_cog);
  console.warn('H_struct:', entropy.h_struct);
  console.warn('H_align:', entropy.h_align);
  console.warn('H_bio:', entropy.h_bio);
}
```

### 告警处理

```typescript
// 检查阈值告警
const alerts = await plugin.checkThresholds();

for (const alert of alerts) {
  switch (alert.level) {
    case 'info':
      console.log(`[INFO] ${alert.message}`);
      break;
    case 'warn':
      console.warn(`[WARN] ${alert.message}`);
      break;
    case 'error':
      console.error(`[ERROR] ${alert.message}`);
      break;
    case 'critical':
      console.error(`[CRITICAL] ${alert.message}`);
      // 发送紧急通知
      await sendEmergencyNotification(alert);
      break;
  }
}
```

### 启动监控循环

```typescript
// 启动监控循环（每5秒采集一次指标）
await plugin.startMonitoring();

// 监控循环会自动：
// 1. 采集系统指标
// 2. 保存到历史记录
// 3. 检查阈值告警
// 4. 触发告警事件

// 停止监控循环
await plugin.stopMonitoring();
```

### 熵值趋势分析

```typescript
// 获取过去24小时的熵值趋势
const trend = await plugin.getEntropyTrend(24);

// 分析趋势
const avgEntropy = trend.reduce((sum, item) => sum + item.h_sys, 0) / trend.length;

console.log(`Average H_sys (24h): ${avgEntropy.toFixed(3)}`);

if (avgEntropy > 0.6) {
  console.warn('System entropy is trending upward!');
}
```

## 默认阈值

### 熵值阈值（0-1）

| 指标 | 阈值 | 说明 |
|------|------|------|
| H_sys | 0.7 | 综合熵值阈值 |
| H_cog | 0.5 | 认知熵阈值 |
| H_struct | 0.5 | 结构熵阈值 |
| H_align | 0.5 | 对齐熵阈值 |
| H_bio | 0.8 | 生理熵阈值 |

### 资源阈值（0-100）

| 指标 | 阈值 | 说明 |
|------|------|------|
| CPU | 80 | CPU使用率阈值 |
| Memory | 90 | 内存使用率阈值 |
| Disk | 85 | 磁盘使用率阈值 |

## 测试覆盖

测试覆盖率: ≥ 70%

运行测试:
```bash
npm test -- plugins/core/entropy-monitor
```

测试套件:
- ✅ CPU监控
- ✅ 内存监控
- ✅ 磁盘监控
- ✅ 熵值计算
- ✅ 阈值检查
- ✅ 指标历史
- ✅ 监控循环

## 性能指标

- 指标采集延迟: < 10ms
- 熵值计算延迟: < 50ms
- 历史记录查询: < 100ms
- 监控循环开销: < 1% CPU

## 故障排查

### 常见问题

**Q: CPU使用率报告不准确**
A: 检查系统监控库配置，确保正确读取CPU统计。

**Q: 内存泄漏告警误报**
A: 调整内存阈值，或检查是否有合理的内存增长。

**Q: 熵值持续上升**
A: 检查系统负载、Agent任务数量和宪法合规性，采取熵减措施。

## 维护指南

### 日常维护

1. **监控熵值趋势**: 定期检查H_sys趋势，确保持续熵减
2. **清理历史数据**: 定期清理过期的指标历史记录
3. **调整阈值**: 根据实际运行情况调整告警阈值

### 熵减措施

当系统熵值过高时，可以采取以下措施：
1. 清理无用文件和临时数据
2. 优化代码结构和文档一致性
3. 检查并修复宪法违规
4. 重启系统服务

### 升级指南

1. 备份当前配置和历史数据
2. 更新插件代码
3. 重新加载插件
4. 验证监控功能正常

## 版本历史

### v1.0.0 (2026-02-12)

- ✅ CPU监控
- ✅ 内存监控
- ✅ 磁盘监控
- ✅ 熵值监控（H_sys实时追踪）
- ✅ 阈值告警
- ✅ 指标历史记录
- ✅ 熵值趋势分析
- ✅ 完整测试覆盖
- ✅ 完整文档

## 许可证

遵循Negentropy-Lab项目许可证。

## 贡献者

- 科技部后端分队
