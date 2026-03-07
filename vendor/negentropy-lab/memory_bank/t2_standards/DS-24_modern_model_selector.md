# DS-042: ModernModelSelector 标准实现

**父索引**: [Development Standards Index](../DEVELOPMENT_STANDARDS.md)
**对应技术法**: §470-§479（外部服务集成与模型管理标准）
**宪法依据**: §181 (类型公理优先原则), §192 (模型选择器公理), §373 (模型配置主权)
**版本**: v1.0.0
**状态**: 🟡 设计中

---

## 概述
本标准定义了`ModernModelSelector`的实现规范，旨在提供一个类型安全、可扩展且具备健康感知能力的模型路由服务。继承自legacy_quarantine/server/modules/ModelSelector.ts，遵循宪法§151行为锁定原则，确保$B_{重构后} \equiv B_{重构前}$。

## 1. 核心类型定义 (Type Definition)
**宪法依据**: §181 (类型公理优先原则)

**文件位置**: `server/types/system/IModelSelector.ts`

```typescript
/**
 * 模型能力需求类型
 */
export type ModelCapability = 'general' | 'reasoning' | 'coding' | 'fast' | 'creative';

/**
 * 模型需求接口
 */
export interface IModelRequirements {
    capability: ModelCapability;
    maxTokens?: number;
    contextSize?: number;
    temperature?: number;
    priority?: 'cost' | 'speed' | 'quality';
}

/**
 * Provider配置接口
 */
export interface IProviderConfig {
    id: string;
    name: string;
    baseUrl: string;
    apiKey?: string;
    models: string[];
    capabilities: ModelCapability[];
    costPerToken: number;
    maxConcurrent: number;
    healthCheckEndpoint?: string;
}

/**
 * 模型选择结果
 */
export interface IModelSelection {
    success: boolean;
    providerId: string;
    model: string;
    reasoning?: string;
    estimatedCost?: number;
    estimatedLatency?: number;
    fallbackUsed?: boolean;
}

/**
 * 模型选择器核心接口
 */
export interface IModelSelector {
    /**
     * §192 模型选择算法
     */
    selectModel(requirements: IModelRequirements): Promise<IModelSelection>;
    
    /**
     * 注册新的Provider
     */
    registerProvider(config: IProviderConfig): boolean;
    
    /**
     * 获取所有健康Provider
     */
    getHealthyProviders(): IProviderConfig[];
    
    /**
     * 获取Provider健康状态
     */
    getProviderHealth(providerId: string): Promise<IProviderHealth>;
    
    /**
     * 更新Provider配置
     */
    updateProviderConfig(providerId: string, config: Partial<IProviderConfig>): boolean;
    
    /**
     * 获取选择统计
     */
    getSelectionStats(): ISelectionStatistics;
}

/**
 * Provider健康状态
 */
export interface IProviderHealth {
    providerId: string;
    status: 'healthy' | 'unhealthy' | 'degraded';
    lastCheck: number;
    latency: number;
    successRate: number;
    error?: string;
}

/**
 * 选择统计数据
 */
export interface ISelectionStatistics {
    totalSelections: number;
    successRate: number;
    averageLatency: number;
    averageCost: number;
    byProvider: Record<string, IProviderStats>;
}

/**
 * Provider统计
 */
export interface IProviderStats {
    selections: number;
    successRate: number;
    averageLatency: number;
    averageCost: number;
    lastUsed: number;
}
```

## 2. 路由算法实现

### 2.1 算法伪代码
```typescript
async function selectModel(requirements: IModelRequirements): Promise<IModelSelection> {
    // 步骤1：过滤符合条件的Provider
    const eligibleProviders = this.providers.filter(p => 
        p.capabilities.includes(requirements.capability) && 
        this.healthStatus[p.id]?.status === 'healthy'
    );
    
    if (eligibleProviders.length === 0) {
        return this.applyFallbackStrategy(requirements);
    }
    
    // 步骤2：计算每个Provider的得分
    const scoredProviders = eligibleProviders.map(p => ({
        provider: p,
        score: this.calculateProviderScore(p, requirements)
    }));
    
    // 步骤3：排序并选择最佳
    scoredProviders.sort((a, b) => b.score - a.score);
    const best = scoredProviders[0];
    
    // 步骤4：选择具体模型
    const model = this.selectModelFromProvider(best.provider, requirements);
    
    return {
        success: true,
        providerId: best.provider.id,
        model,
        reasoning: `Selected ${best.provider.name} based on score ${best.score.toFixed(2)}`,
        estimatedCost: this.estimateCost(best.provider, requirements),
        estimatedLatency: this.healthStatus[best.provider.id]?.latency || 1000
    };
}
```

### 2.2 得分计算函数
**数学基础**: 多目标优化加权和

$$score(p, r) = w_{cap} \cdot C(p, r) + w_{health} \cdot H(p) + w_{cost} \cdot (1 - \frac{cost(p)}{maxCost}) + w_{perf} \cdot (1 - \frac{latency(p)}{maxLatency})$$

其中：
- $C(p, r)$：能力匹配度（0-1）
- $H(p)$：健康度（0-1）
- $cost(p)$：预估成本
- $latency(p)$：平均延迟
- 权重和：$w_{cap} + w_{health} + w_{cost} + w_{perf} = 1$

### 2.3 回退策略
```typescript
private applyFallbackStrategy(requirements: IModelRequirements): IModelSelection {
    // 一级回退：放宽能力要求
    const relaxedRequirements = { ...requirements };
    if (requirements.capability === 'reasoning') {
        relaxedRequirements.capability = 'general';
    }
    
    // 二级回退：接受降级Provider
    const degradedProviders = this.providers.filter(p => 
        p.capabilities.includes(relaxedRequirements.capability) && 
        this.healthStatus[p.id]?.status !== 'unhealthy'
    );
    
    // 三级回退：使用本地模拟
    if (degradedProviders.length === 0) {
        return {
            success: false,
            providerId: 'local',
            model: 'simulated',
            reasoning: 'All providers unavailable, using local simulation',
            fallbackUsed: true
        };
    }
    
    // 选择最佳降级Provider
    const bestDegraded = this.selectBestFromList(degradedProviders, relaxedRequirements);
    return {
        ...bestDegraded,
        fallbackUsed: true
    };
}
```

## 3. 依赖注入配置

### 3.1 类型标识符
**文件位置**: `server/config/inversify.types.ts`

```typescript
export const TYPES = {
    // ModelSelector相关类型
    ModelSelector: Symbol.for('IModelSelector'),
    ProviderConfig: Symbol.for('IProviderConfig'),
    ModelRequirements: Symbol.for('IModelRequirements'),
    
    // 默认Provider配置
    DefaultProviders: Symbol.for('DefaultProviders'),
    
    // 健康监控
    ProviderHealthMonitor: Symbol.for('IProviderHealthMonitor'),
};
```

### 3.2 容器绑定
**文件位置**: `server/config/inversify.config.ts`

```typescript
// ModelSelector绑定
container.bind<IModelSelector>(TYPES.ModelSelector)
    .to(ModernModelSelector)
    .inSingletonScope();

// 默认Provider配置
container.bind<IProviderConfig[]>(TYPES.DefaultProviders)
    .toDynamicValue(() => [
        {
            id: 'deepseek',
            name: 'DeepSeek',
            baseUrl: 'https://api.deepseek.com',
            models: ['deepseek-chat', 'deepseek-reasoner'],
            capabilities: ['general', 'reasoning', 'coding'],
            costPerToken: 0.000002,
            maxConcurrent: 10
        },
        {
            id: 'openai',
            name: 'OpenAI',
            baseUrl: 'https://api.openai.com/v1',
            models: ['gpt-4o', 'gpt-4o-mini'],
            capabilities: ['general', 'creative', 'coding'],
            costPerToken: 0.000005,
            maxConcurrent: 5
        },
        // ... 其他Provider
    ]);

// 健康监控
container.bind<IProviderHealthMonitor>(TYPES.ProviderHealthMonitor)
    .to(ProviderHealthMonitor)
    .inSingletonScope();
```

## 4. 兼容性适配器

### 4.1 适配器设计
**宪法依据**: §151 (行为锁定原则)

```typescript
/**
 * LegacyModelSelector适配器
 * 提供与legacy_quarantine/server/modules/ModelSelector.ts相同的接口
 */
export class LegacyModelSelectorAdapter {
    private modernSelector: IModelSelector;
    
    constructor(modernSelector: IModelSelector) {
        this.modernSelector = modernSelector;
    }
    
    /**
     * 兼容旧版selectModel接口
     */
    async selectModel(requirements: any, preferences?: any): Promise<any> {
        // 转换旧版参数到新版
        const modernReq = this.convertLegacyRequirements(requirements);
        
        // 调用现代选择器
        const result = await this.modernSelector.selectModel(modernReq);
        
        // 转换结果到旧版格式
        return this.convertToLegacyResult(result);
    }
    
    /**
     * 兼容旧版checkProviderHealth接口
     */
    async checkProviderHealth(providerId: string): Promise<any> {
        const health = await this.modernSelector.getProviderHealth(providerId);
        return {
            providerId: health.providerId,
            status: health.status,
            latency: health.latency,
            timestamp: health.lastCheck
        };
    }
    
    // ... 其他兼容方法
}
```

### 4.2 自动注册机制
```typescript
/**
 * ModelSelector初始化器
 */
export class ModelSelectorInitializer {
    static async initialize(container: Container): Promise<void> {
        // 创建现代选择器实例
        const modernSelector = container.get<IModelSelector>(TYPES.ModelSelector);
        
        // 创建适配器
        const adapter = new LegacyModelSelectorAdapter(modernSelector);
        
        // 注册到全局上下文（向后兼容）
        (global as any).legacyModelSelector = adapter;
        
        // 初始化默认Provider
        await this.initializeDefaultProviders(modernSelector);
        
        console.log('[ModelSelector] ModernModelSelector initialized with legacy compatibility');
    }
}
```

## 5. 验证与测试

### 5.1 三级验证策略
1. **Tier 1 结构验证**: 验证类型定义完整性
2. **Tier 2 契约验证**: 验证接口实现一致性
3. **Tier 3 行为验证**: 测试选择算法正确性

### 5.2 性能指标
- **选择算法时间复杂度**: $O(n)$，其中n为Provider数量
- **健康检查频率**: 每30秒一次
- **缓存命中率目标**: >80%
- **选择延迟目标**: <50ms (p95)

### 5.3 测试场景
```typescript
describe('ModernModelSelector', () => {
    test('should select correct model for reasoning task', async () => {
        const selector = container.get<IModelSelector>(TYPES.ModelSelector);
        const requirements: IModelRequirements = {
            capability: 'reasoning',
            maxTokens: 4000
        };
        
        const result = await selector.selectModel(requirements);
        expect(result.success).toBe(true);
        expect(result.providerId).toBe('deepseek'); // DeepSeek擅长推理
    });
    
    test('should fallback when primary provider unhealthy', async () => {
        // 模拟DeepSeek不健康
        mockHealthStatus('deepseek', 'unhealthy');
        
        const result = await selector.selectModel({ capability: 'reasoning' });
        expect(result.fallbackUsed).toBe(true);
        expect(result.providerId).not.toBe('deepseek');
    });
    
    test('should respect cost priority', async () => {
        const requirements: IModelRequirements = {
            capability: 'general',
            priority: 'cost'
        };
        
        const result = await selector.selectModel(requirements);
        // 应该选择成本最低的Provider
        expect(result.estimatedCost).toBeLessThan(0.00001);
    });
});
```

---

## 实施路线图

### Phase 1: 类型定义与接口设计 (1天)
1. 创建`IModelSelector.ts`类型定义
2. 定义数据结构和接口契约
3. 建立数学基础验证

### Phase 2: 核心算法实现 (2天)
1. 实现选择算法和得分计算
2. 集成健康监控
3. 实现回退策略

### Phase 3: 集成与测试 (2天)
1. 依赖注入容器集成
2. 兼容性适配器实现
3. 三级验证测试套件

### Phase 4: 部署与监控 (1天)
1. 性能监控集成
2. 生产环境配置
3. 文档和培训

---

## 宪法合规性验证

| 宪法条款 | 合规要求 | DS-042实现 |
|---------|---------|-----------|
| §181 类型公理优先 | 类型定义先行 | 完整的TypeScript类型定义 |
| §192 模型选择器公理 | 智能路由算法 | 多目标优化选择算法 |
| §151 行为锁定原则 | 行为等价性 | Legacy适配器确保向后兼容 |
| §336 依赖注入标准 | 容器管理 | InversifyJS集成 |
| §307 健康探针标准 | 健康监控 | 定期健康检查和熔断 |
| §373 模型配置主权 | 用户控制权 | 前端配置界面支持 |

---

**版本记录**：
- v1.0.0 (2026-01-30)：初始版本，基于legacy ModelSelector架构升级

**宪法引用链**：
- §373 模型配置主权 → §192 模型选择器公理 → 技术法§470-§479 → DS-042

**数学基础**：
- 能力匹配度: $C(p, r) = \frac{|capabilities_p \cap requirements_r|}{|requirements_r|}$
- 健康度函数: $H(p) = 0.4 \times (1 - \frac{latency}{5000}) + 0.4 \times successRate + 0.2 \times (1 - loadFactor)$
- 熵减证明: $\Delta H_{selection} = H_{before} - H_{after} \leq 0$，选择算法降低系统不确定性
