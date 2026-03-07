# DS-012: 依赖注入配置标准实现

**父索引**: [Development Standards Index](../DEVELOPMENT_STANDARDS.md)
**对应技术法**: §333, §336
**宪法依据**: §122 (质量门控与标准), §132 (MCP架构原则)
**版本**: v6.6.0 (SessionManager Migration & Type Axiom Enhancement)
**状态**: 🟢 生产就绪

---

## 概述

本标准定义了逆熵实验室的依赖注入(DI)配置规范，支持TypeScript(InversifyJS)和Python两种实现。根据§132 MCP架构原则，系统采用分层依赖注入架构：

### 架构分层
1. **TypeScript层 (Node.js后端)**: InversifyJS容器，管理后端服务依赖
2. **Python层 (微内核)**: dependency-injector容器，管理MCP核心组件
3. **跨层协调**: 通过接口契约确保层间依赖的一致性

## 1. TypeScript层: InversifyJS实现标准

### 1.1 配置位置
- **容器配置文件**: `server/config/inversify.config.ts`
- **类型标识符**: 统一使用Symbol.for('ServiceName')格式
- **生命周期**: 默认Singleton，支持InjectionScope

### 1.2 标准容器配置

```typescript
/** 
 * 逆熵实验室 InversifyJS 容器配置
 * 
 * 宪法依据: §132 (MCP 架构原则), §336 (MCP 依赖注入标准)
 * 目的: 提供标准化的依赖注入容器，作为 SessionManager 迁移的基础设施
 */
import { Container } from 'inversify';
import { ILogger } from '../types/common/ILogger';
import { ISessionManager } from '../types/session/ISessionManager';
import { WinstonLoggerAdapter } from '../utils/WinstonLoggerAdapter';
import { ModernSessionService } from '../services/ModernSessionService';

// 类型标识符 (Type Identifiers)
export const TYPES = {
    Logger: Symbol.for('ILogger'),
    SessionManager: Symbol.for('ISessionManager'),
    // 未来扩展的类型标识符...
};

export function createInversifyContainer(): Container {
    const container = new Container({
        defaultScope: 'Singleton'
    });

    // 1. Logger 服务 (Singleton)
    container.bind<ILogger>(TYPES.Logger)
        .to(WinstonLoggerAdapter)
        .inSingletonScope();

    // 2. Session Manager 服务 (Singleton)
    container.bind<ISessionManager>(TYPES.SessionManager)
        .to(ModernSessionService)
        .inSingletonScope();

    return container;
}
```

### 1.3 全局容器管理器

```typescript
/**
 * 全局容器实例 (Global Container Instance)
 * 提供应用程序范围内的单例容器实例
 */
export class GlobalInversifyContainer {
    private static container: Container | null = null;

    static getInstance(): Container {
        if (!this.container) {
            this.container = createInversifyContainer();
        }
        return this.container;
    }

    static resolve<T>(serviceIdentifier: symbol): T {
        return this.getInstance().get<T>(serviceIdentifier);
    }
}
```

## 2. Python层: dependency-injector实现标准

### 2.1 适用场景
- MCP微内核的核心组件管理
- 工具链依赖注入
- 配置参数外部化

### 2.2 标准实现模式

```python
# 依赖容器示例
from dependency_injector import containers, providers

class Container(containers.DeclarativeContainer):
    config = providers.Configuration()
    qdrant = providers.Singleton(QdrantClient, host="localhost", port=6333)
    registry = providers.Singleton(ToolRegistry)
    mcp = providers.Singleton(FastMCP, name="Entropy-Lab")

# 全局容器实例
container = Container()
```

## 3. 注入原则

### 3.1 单一职责
每个容器只管理一组相关依赖，遵循SRP原则。

### 3.2 生命周期管理
- **Singleton**: 全局单例，服务启动时创建
- **Factory**: 按需创建，每次调用返回新实例
- **Provider**: 延迟初始化，避免启动阻塞

### 3.3 配置外部化
配置参数必须通过Configuration提供，严禁硬编码。

## 4. SessionManager迁移示例

### 4.1 类型定义先行
```typescript
// 在 server/types/session/ISessionManager.d.ts 中定义契约
export interface ISessionManager {
    resolveSession(params: SessionResolveParams): AsyncResult<ISession>;
    getSession(sessionId: string): AsyncResult<ISession>;
    // ... 其他方法
}
```

### 4.2 容器注册
```typescript
// 在 inversify.config.ts 中注册服务
container.bind<ISessionManager>(TYPES.SessionManager)
    .to(ModernSessionService)
    .inSingletonScope();
```

### 4.3 依赖解析
```typescript
// 使用全局容器解析服务
const sessionManager = GlobalInversifyContainer.resolve<ISessionManager>(TYPES.SessionManager);
```

## 5. 监控指标

- `dependency_injection_instances_created`: 依赖注入实例创建数量
- `inversify_container_initialization_time`: 容器初始化时间
- `circular_dependency_detections`: 循环依赖检测次数

## 6. 宪法合规验证

### 6.1 三级验证要求
- **Tier 1 (架构)**: 验证容器配置与架构同构性 ($S_{fs} \cong S_{doc}$)
- **Tier 2 (契约)**: 验证接口实现与契约一致性 ($I_{code} \supseteq I_{doc}$)
- **Tier 3 (行为)**: 验证运行时行为符合业务逻辑 ($B_{code} \equiv B_{spec}$)

### 6.2 验证工具
- `judicial_verify_structure`: 验证容器配置结构
- `judicial_verify_contract`: 验证接口契约一致性
- `judicial_run_tests`: 验证行为实现

---
