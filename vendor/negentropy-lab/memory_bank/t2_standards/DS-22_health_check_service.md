# DS-037: 健康探针服务标准实现

**父索引**: [Development Standards Index](../DEVELOPMENT_STANDARDS.md)
**对应技术法**: §307 (健康探针服务标准)
**宪法依据**: §181 (类型公理优先原则), §307 (可观测性标准), §336 (依赖注入标准)
**版本**: v6.6.0 (SessionManager Migration & Type Axiom Enhancement)
**状态**: 🟢 规范定义成熟（实现待开发）
> **说明**: "规范定义成熟"表示文档定义完整，但实现代码待开发。运行实现状态以 `active_context.md` 为准。

---

**对应技术法条款**: §307 健康探针服务标准
**宪法依据**: 
- §181 类型公理优先原则: 先定义类型公理，再实现代码
- §307 可观测性标准: 提供系统健康监控能力  
- §336 依赖注入标准: 通过容器管理服务依赖

**适用场景**: 所有需要系统健康监控的服务端应用，特别是SessionManager迁移后的系统

## 1. 概述

健康探针服务提供系统级健康监控，符合可观测性标准。基于§181类型公理优先原则，必须先定义完整的类型接口，再实现具体服务。

### 数学基础

建立系统健康模型：
- **系统健康度**: $H_{system} = \min_{c \in C} H(c)$，其中$C$为组件集合
- **组件健康函数**: $H(c): C \rightarrow \{healthy, degraded, unhealthy\}$
- **整体健康判定**: $H_{total} = \bigwedge_{c \in C} H(c)$

## 2. 类型公理定义标准

### 2.1 类型定义文件位置

所有健康探针相关的类型定义必须集中存放在：
```
server/types/system/IHealthProbe.ts
```

### 2.2 接口定义完整结构

```typescript
// ============================================================================
// 健康探针服务类型公理 (Health Probe Type Axiom)
// 宪法依据: §181, §307
// ============================================================================

/**
 * 健康检查模式枚举
 */
export enum HealthCheckMode {
  FAST = 'fast',     // 快速检查核心组件 (< 100ms)
  FULL = 'full',     // 完整系统检查 (< 1s)
  DETAILED = 'detailed' // 包含详细指标
}

/**
 * 组件健康状态枚举
 * 数学基础: $H_{status} \in \{\text{healthy}, \text{degraded}, \text{unhealthy}\}$
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy'
}

/**
 * 组件健康信息接口
 */
export interface ComponentHealth {
  name: string;           // 组件标识符
  status: HealthStatus;   // 健康状态
  latency?: number;       // 检查延迟（毫秒）
  error?: string;         // 错误信息
  metrics?: Record<string, number>; // 可选的指标数据
}

/**
 * 健康检查参数
 */
export interface HealthCheckParams {
  mode?: HealthCheckMode;           // 检查模式
  timeout?: number;                 // 超时时间（毫秒）
  includeSessionStats?: boolean;    // 包含会话统计
  includeMemoryStats?: boolean;     // 包含内存统计
}

/**
 * 健康检查结果
 */
export interface HealthCheckResult {
  system: HealthStatus;           // 整体系统健康状态
  timestamp: number;              // 时间戳（毫秒）
  components: ComponentHealth[];  // 详细组件状态
  sessionStats?: SessionStats;    // 会话系统统计
  memoryStats?: MemoryStats;      // 内存使用统计
  mode: HealthCheckMode;          // 检查模式
}

/**
 * 系统健康探针服务接口 (IHealthProbe)
 * 
 * 数学基础: $H_{system} = \bigwedge_{c \in C} H(c)$
 * 其中$C$为注册的健康检查器集合，$H(c)$为组件健康函数
 */
export interface IHealthProbe {
  // 核心检查方法
  check(params?: HealthCheckParams): Promise<HealthCheckResult>;
  checkFast(): Promise<HealthCheckResult>;
  checkFull(): Promise<HealthCheckResult>;
  
  // 检查器管理
  register(registration: HealthCheckerRegistration): boolean;
  unregister(name: string): boolean;
  getCheckers(): HealthCheckerRegistration[];
  
  // 组件级检查
  checkComponent(name: string): Promise<ComponentHealth | null>;
  
  // 概要状态
  getSummary(): Promise<{
    status: HealthStatus;
    totalComponents: number;
    healthyComponents: number;
    lastCheckTimestamp: number;
  }>;
}
```

## 3. 服务实现标准

### 3.1 实现类规范

```typescript
// server/services/ModernHealthProbe.ts

import { injectable, inject } from 'inversify';
import { IHealthProbe, HealthCheckParams, HealthCheckResult } from '../types/system/IHealthProbe';
import { TYPES } from '../config/inversify.types';
import { ILogger } from '../types/common/ILogger';

/**
 * ModernHealthProbe 实现类
 * 
 * @implements {IHealthProbe}
 * @version 1.0.0
 * @category System Services
 */
@injectable()
export class ModernHealthProbe implements IHealthProbe {
  private checkers: Map<string, HealthCheckerRegistration>;
  
  constructor(
    @inject(TYPES.Logger) private readonly logger: ILogger
  ) {
    this.checkers = new Map();
    this.initializeCoreCheckers();
  }
  
  // ============================================================================
  // IHealthProbe 接口实现
  // ============================================================================
  
  async check(params?: HealthCheckParams): Promise<HealthCheckResult> {
    const checkParams = params || { mode: HealthCheckMode.FAST };
    return this.executeHealthCheck(checkParams);
  }
  
  async checkFast(): Promise<HealthCheckResult> {
    return this.check({ mode: HealthCheckMode.FAST });
  }
  
  async checkFull(): Promise<HealthCheckResult> {
    return this.check({ mode: HealthCheckMode.FULL });
  }
  
  register(registration: HealthCheckerRegistration): boolean {
    if (this.checkers.has(registration.name)) {
      this.logger.warn(`Health checker '${registration.name}' already registered`);
      return false;
    }
    this.checkers.set(registration.name, registration);
    this.logger.info(`Registered health checker: ${registration.name}`);
    return true;
  }
  
  // ... 其他接口实现
}
```

### 3.2 核心检查器实现

```typescript
/**
 * 核心健康检查器实现
 */
private initializeCoreCheckers(): void {
  // 内存健康检查器
  this.register({
    name: 'memory',
    checker: this.checkMemoryHealth.bind(this),
    description: '系统内存使用情况检查',
    priority: 1,
    isCore: true
  });
  
  // 会话系统检查器
  this.register({
    name: 'sessions',
    checker: this.checkSessionHealth.bind(this),
    description: '会话系统状态检查',
    priority: 2,
    isCore: true
  });
  
  // 进程健康检查器
  this.register({
    name: 'process',
    checker: this.checkProcessHealth.bind(this),
    description: 'Node.js进程健康检查',
    priority: 3,
    isCore: true
  });
}
```

## 4. 依赖注入配置标准

### 4.1 类型标识符定义

```typescript
// server/config/inversify.types.ts

export const TYPES = {
  // ... 现有类型标识符
  HealthProbe: Symbol.for('IHealthProbe'),
  // ... 其他类型标识符
};
```

### 4.2 容器绑定配置

```typescript
// server/config/inversify.config.ts

import { IHealthProbe } from '../types/system/IHealthProbe';
import { ModernHealthProbe } from '../services/ModernHealthProbe';
import { TYPES } from './inversify.types';

// 健康探针服务绑定 (Singleton)
container.bind<IHealthProbe>(TYPES.HealthProbe)
  .to(ModernHealthProbe)
  .inSingletonScope();
```

## 5. SessionManager 集成标准

### 5.1 SessionStatistics 类型扩展

```typescript
// server/types/session/ISessionManager.d.ts

/**
 * 会话统计信息接口
 * 用于健康检查集成
 */
export interface SessionStatistics {
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  byUser: Record<string, number>;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
}

/**
 * 会话管理器接口扩展
 */
export interface ISessionManager {
  // ... 现有方法
  
  /**
   * 获取会话统计信息
   * 用于健康探针服务
   */
  getStats(): AsyncResult<SessionStatistics>;
}
```

### 5.2 ModernSessionService 实现更新

```typescript
// server/services/ModernSessionService.ts

@injectable()
export class ModernSessionService implements ISessionManager {
  // ... 现有属性和方法
  
  async getStats(): AsyncResult<SessionStatistics> {
    const totalSessions = await this.sessionStore.count();
    const activeSessions = await this.sessionStore.countByStatus('active');
    const expiredSessions = await this.sessionStore.countByStatus('expired');
    
    return Result.success({
      totalSessions,
      activeSessions,
      expiredSessions,
      byUser: await this.sessionStore.countByUser(),
      byType: await this.sessionStore.countByType(),
      byStatus: await this.sessionStore.countByStatus()
    });
  }
}
```

## 6. 健康检查器实现模式

### 6.1 内存健康检查器

```typescript
private async checkMemoryHealth(params: HealthCheckParams): Promise<ComponentHealth> {
  const memoryUsage = process.memoryUsage();
  const heapLimit = typeof process.memoryUsage.rss === 'function' 
    ? process.memoryUsage.rss() 
    : 512 * 1024 * 1024; // 默认512MB
  
  const usageRatio = memoryUsage.heapUsed / heapLimit;
  
  let status = HealthStatus.HEALTHY;
  if (usageRatio > 0.9) {
    status = HealthStatus.UNHEALTHY;
  } else if (usageRatio > 0.7) {
    status = HealthStatus.DEGRADED;
  }
  
  return {
    name: 'memory',
    status,
    metrics: {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      rss: memoryUsage.rss,
      usageRatio: Math.round(usageRatio * 100) / 100
    }
  };
}
```

### 6.2 会话健康检查器

```typescript
private async checkSessionHealth(params: HealthCheckParams): Promise<ComponentHealth> {
  try {
    const stats = await this.sessionManager.getStats();
    
    if (!stats.success) {
      return {
        name: 'sessions',
        status: HealthStatus.UNHEALTHY,
        error: stats.error
      };
    }
    
    const sessionStats = stats.data;
    const activeRatio = sessionStats.activeSessions / Math.max(sessionStats.totalSessions, 1);
    
    let status = HealthStatus.HEALTHY;
    if (activeRatio > 0.95) {
      status = HealthStatus.DEGRADED;
    } else if (sessionStats.expiredSessions > sessionStats.activeSessions * 0.5) {
      status = HealthStatus.UNHEALTHY;
    }
    
    return {
      name: 'sessions',
      status,
      metrics: {
        totalSessions: sessionStats.totalSessions,
        activeSessions: sessionStats.activeSessions,
        expiredSessions: sessionStats.expiredSessions,
        activeRatio: Math.round(activeRatio * 100) / 100
      }
    };
  } catch (error) {
    return {
      name: 'sessions',
      status: HealthStatus.UNHEALTHY,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
```

## 7. 可观测性标准实现 (§307)

### 7.1 健康指标收集

健康探针服务必须收集以下指标：
- **系统级指标**: 整体健康状态、检查延迟
- **组件级指标**: 各组件状态、错误率、响应时间
- **资源指标**: 内存使用、CPU负载、会话数量

### 7.2 健康状态判定矩阵

| 检查项 | HEALTHY 标准 | DEGRADED 标准 | UNHEALTHY 标准 |
|--------|--------------|---------------|----------------|
| 内存使用 | < 70% | 70%-90% | > 90% |
| 活跃会话比 | < 80% | 80%-95% | > 95% |
| 过期会话比 | < 20% | 20%-50% | > 50% |
| 检查延迟 | < 50ms | 50-200ms | > 200ms |

## 8. 验证与合规

### 8.1 类型验证

```bash
# 1. 执行类型检查
npx tsc --noEmit --project server/

# 2. 验证接口实现完整性
npx judicial_verify_contract IHealthProbe

# 3. 验证依赖注入绑定
npx judicial_verify_structure
```

### 8.2 功能测试

```typescript
// 测试示例
describe('ModernHealthProbe', () => {
  let healthProbe: IHealthProbe;
  
  beforeEach(() => {
    const container = initializeContainer();
    healthProbe = container.get<IHealthProbe>(TYPES.HealthProbe);
  });
  
  test('should perform fast health check', async () => {
    const result = await healthProbe.checkFast();
    expect(result.system).toBe(HealthStatus.HEALTHY);
    expect(result.components.length).toBeGreaterThan(0);
  });
  
  test('should register custom checker', () => {
    const success = healthProbe.register({
      name: 'custom',
      checker: async () => ({ name: 'custom', status: HealthStatus.HEALTHY }),
      description: 'Custom health checker',
      priority: 10,
      isCore: false
    });
    expect(success).toBe(true);
  });
});
```

### 8.3 宪法合规矩阵

| 宪法条款 | 合规要求 | 验证方法 |
|---------|---------|---------|
| §181 | 类型公理优先 | 检查IHealthProbe.ts存在性和完整性 |
| §307 | 可观测性标准 | 验证健康指标收集和状态判定 |
| §336 | 依赖注入标准 | 验证InversifyJS容器绑定 |
| §396 | 用户系统集成 | 验证SessionManager.getStats()集成 |

## 9. 部署与监控

### 9.1 健康检查端点

健康探针服务必须通过REST端点提供健康状态：
```
GET /api/health/fast    # 快速检查
GET /api/health/full    # 完整检查
GET /api/health/detail  # 详细检查
```

### 9.2 监控集成

健康探针应集成到系统监控仪表板：
- **Prometheus指标**: `system_health_status` (0=healthy, 1=degraded, 2=unhealthy)
- **Grafana面板**: 显示系统健康趋势和组件状态
- **告警规则**: 当状态为UNHEALTHY超过5分钟时触发告警

---

**执行标准**: 所有HealthProbe相关实现必须遵循此标准，确保系统可观测性和类型安全性。
