/**
 * 模型注册表
 * 
 * 管理所有可用的模型适配器
 * 
 * 宪法依据:
 * - §101 同步公理: 代码与文档同步
 * - §102 熵减原则: 统一管理，避免重复
 * 
 * @module llm/ModelRegistry
 * @version 1.0.0
 * @category LLM/Registry
 */

import { ModelAdapter, ModelCapabilities, HealthStatus, TaskRequirements } from './adapters/ModelAdapter';
import { BaseAdapter, AdapterConfig } from './adapters/BaseAdapter';
import { AdapterFactory } from './adapters/index';

/**
 * 模型注册信息
 */
export interface ModelRegistration {
  /** 模型适配器 */
  adapter: ModelAdapter;
  
  /** 注册时间 */
  registeredAt: Date;
  
  /** 是否启用 */
  enabled: boolean;
  
  /** 优先级（数字越小优先级越高） */
  priority: number;
  
  /** 标签 */
  tags: string[];
}

/**
 * 模型注册表配置
 */
export interface RegistryConfig {
  /** 是否自动初始化 */
  autoInitialize?: boolean;
  
  /** 健康检查间隔（毫秒） */
  healthCheckInterval?: number;
  
  /** 默认优先级 */
  defaultPriority?: number;
}

/**
 * 模型注册表
 * 
 * 管理所有可用的模型适配器，提供查询、筛选功能
 */
export class ModelRegistry {
  private adapters: Map<string, ModelRegistration> = new Map();
  private config: Required<RegistryConfig>;
  private healthCheckTimer?: NodeJS.Timeout;
  
  constructor(config: RegistryConfig = {}) {
    this.config = {
      autoInitialize: config.autoInitialize ?? true,
      healthCheckInterval: config.healthCheckInterval ?? 60000, // 1分钟
      defaultPriority: config.defaultPriority ?? 100,
    };
    
    console.log('[ModelRegistry] Registry initialized with config:', this.config);
  }
  
  /**
   * 注册模型适配器
   */
  async register(
    adapter: ModelAdapter,
    options: {
      enabled?: boolean;
      priority?: number;
      tags?: string[];
    } = {}
  ): Promise<void> {
    const key = `${adapter.provider}:${adapter.model}`;
    
    if (this.adapters.has(key)) {
      console.warn(`[ModelRegistry] Model already registered: ${key}`);
      return;
    }
    
    const registration: ModelRegistration = {
      adapter,
      registeredAt: new Date(),
      enabled: options.enabled ?? true,
      priority: options.priority ?? this.config.defaultPriority,
      tags: options.tags ?? [],
    };
    
    this.adapters.set(key, registration);
    
    console.log(`[ModelRegistry] Registered model: ${key}`, {
      model: adapter.model,
      capabilities: adapter.capabilities,
      priority: registration.priority,
      tags: registration.tags,
    });
    
    // 自动初始化
    if (this.config.autoInitialize) {
      await adapter.initialize();
    }
  }
  
  /**
   * 从工厂注册模型
   */
  async registerFromFactory(
    provider: string,
    model: string,
    config: AdapterConfig,
    options: {
      enabled?: boolean;
      priority?: number;
      tags?: string[];
    } = {}
  ): Promise<void> {
    const adapter = AdapterFactory.create(provider, model, config);
    await this.register(adapter, options);
  }
  
  /**
   * 从配置字符串注册模型
   * 格式: "provider:model"
   */
  async registerFromString(
    configString: string,
    adapterConfig: AdapterConfig,
    options: {
      enabled?: boolean;
      priority?: number;
      tags?: string[];
    } = {}
  ): Promise<void> {
    const adapter = AdapterFactory.fromString(configString, adapterConfig);
    await this.register(adapter, options);
  }
  
  /**
   * 批量注册模型
   */
  async registerBatch(
    models: Array<{
      provider: string;
      model: string;
      config?: AdapterConfig;
      options?: {
        enabled?: boolean;
        priority?: number;
        tags?: string[];
      };
    }>
  ): Promise<void> {
    for (const model of models) {
      await this.registerFromFactory(
        model.provider,
        model.model,
        model.config || {},
        model.options || {}
      );
    }
  }
  
  /**
   * 注销模型
   */
  async unregister(provider: string, model: string): Promise<void> {
    const key = `${provider}:${model}`;
    const registration = this.adapters.get(key);
    
    if (!registration) {
      console.warn(`[ModelRegistry] Model not found: ${key}`);
      return;
    }
    
    await registration.adapter.dispose();
    this.adapters.delete(key);
    
    console.log(`[ModelRegistry] Unregistered model: ${key}`);
  }
  
  /**
   * 获取所有已注册模型
   */
  list(): ModelAdapter[] {
    return Array.from(this.adapters.values())
      .filter(reg => reg.enabled)
      .map(reg => reg.adapter);
  }
  
  /**
   * 获取所有注册信息
   */
  listRegistrations(): Map<string, ModelRegistration> {
    return new Map(this.adapters);
  }
  
  /**
   * 按提供商查找
   */
  findByProvider(provider: string): ModelAdapter[] {
    return this.list().filter(adapter => adapter.provider === provider);
  }
  
  /**
   * 按模型名称查找
   */
  findByModel(model: string): ModelAdapter[] {
    return this.list().filter(adapter => adapter.model === model);
  }
  
  /**
   * 按标签查找
   */
  findByTag(tag: string): ModelAdapter[] {
    const adapters: ModelAdapter[] = [];
    for (const reg of Array.from(this.adapters.values())) {
      if (reg.enabled && reg.tags.includes(tag)) {
        adapters.push(reg.adapter);
      }
    }
    return adapters;
  }
  
  /**
   * 按能力查找
   */
  findByCapability(
    capability: keyof ModelCapabilities,
    value: boolean = true
  ): ModelAdapter[] {
    return this.list().filter(adapter => adapter.capabilities[capability] === value);
  }
  
  /**
   * 查找支持流式的模型
   */
  findStreaming(): ModelAdapter[] {
    return this.findByCapability('streaming', true);
  }
  
  /**
   * 查找支持函数调用的模型
   */
  findFunctionCalling(): ModelAdapter[] {
    return this.findByCapability('function_call', true);
  }
  
  /**
   * 查找支持视觉的模型
   */
  findVision(): ModelAdapter[] {
    return this.findByCapability('vision', true);
  }
  
  /**
   * 按成本查找（低于指定成本）
   */
  findByMaxCost(maxCostPer1kTokens: number): ModelAdapter[] {
    return this.list().filter(adapter => {
      const avgCost = (
        adapter.capabilities.cost_per_1k_input_tokens + 
        adapter.capabilities.cost_per_1k_output_tokens
      ) / 2;
      return avgCost <= maxCostPer1kTokens;
    });
  }
  
  /**
   * 按质量查找
   */
  findByQuality(
    type: 'reasoning' | 'coding' | 'creativity',
    level: 'basic' | 'intermediate' | 'advanced'
  ): ModelAdapter[] {
    const qualityKey = `${type}_quality` as keyof ModelCapabilities;
    return this.list().filter(adapter => adapter.capabilities[qualityKey] === level);
  }
  
  /**
   * 按上下文窗口大小查找（至少指定大小）
   */
  findByMinContextWindow(minContextWindow: number): ModelAdapter[] {
    return this.list().filter(adapter => adapter.capabilities.context_window >= minContextWindow);
  }
  
  /**
   * 按优先级排序
   */
  sortByPriority(): ModelAdapter[] {
    const adaptersWithPriority: Array<{adapter: ModelAdapter, priority: number}> = [];
    for (const reg of Array.from(this.adapters.values())) {
      if (reg.enabled) {
        adaptersWithPriority.push({
          adapter: reg.adapter,
          priority: reg.priority
        });
      }
    }
    return adaptersWithPriority
      .sort((a, b) => a.priority - b.priority)
      .map(item => item.adapter);
  }
  
  /**
   * 获取最优模型
   */
  findBestMatch(requirements: TaskRequirements): ModelAdapter | null {
    const candidates = this.list().filter(adapter => {
      // 过滤不符合基本要求的模型
      if (requirements.needsFunctionCall && !adapter.capabilities.function_call) {
        return false;
      }
      
      if (requirements.needsVision && !adapter.capabilities.vision) {
        return false;
      }
      
      if (requirements.needsStreaming && !adapter.capabilities.streaming) {
        return false;
      }
      
      // 成本限制
      if (requirements.maxCost) {
        const cost = adapter.getCost(requirements.estimatedTokens);
        if (cost > requirements.maxCost) return false;
      }
      
      // 质量要求
      const quality = adapter.capabilities[`${requirements.qualityType}_quality` as keyof ModelCapabilities];
      const qualityLevels = { basic: 1, intermediate: 2, advanced: 3 };
      if (qualityLevels[quality as 'basic' | 'intermediate' | 'advanced'] < qualityLevels[requirements.minQuality]) {
        return false;
      }
      
      return true;
    });
    
    if (candidates.length === 0) {
      console.warn('[ModelRegistry] No models match requirements:', requirements);
      return null;
    }
    
    // 按综合评分排序
    return candidates
      .sort((a, b) => this.calculateScore(b, requirements) - this.calculateScore(a, requirements))[0];
  }
  
  /**
   * 计算模型评分
   */
  private calculateScore(adapter: ModelAdapter, req: TaskRequirements): number {
    let score = 0;
    const qualityLevels = { basic: 1, intermediate: 2, advanced: 3 };
    
    // 质量评分 (40%)
    const quality = adapter.capabilities[`${req.qualityType}_quality` as keyof ModelCapabilities];
    const qualityLevel = qualityLevels[quality as 'basic' | 'intermediate' | 'advanced'];
    const requiredLevel = qualityLevels[req.minQuality];
    const qualityScore = (qualityLevel / requiredLevel) * 40;
    score += qualityScore;
    
    // 成本评分 (30%)
    if (req.maxCost) {
      const cost = adapter.getCost(req.estimatedTokens);
      const costScore = Math.max(0, 1 - cost / req.maxCost) * 30;
      score += costScore;
    } else {
      score += 30; // 无成本限制，给满分
    }
    
    // 性能评分 (30%)
    if (req.needsStreaming && adapter.capabilities.streaming) {
      score += 15;
    }
    if (req.needsFunctionCall && adapter.capabilities.function_call) {
      score += 15;
    }
    
    return score;
  }
  
  /**
   * 获取模型统计信息
   */
  getStats(): {
    total: number;
    enabled: number;
    byProvider: Record<string, number>;
    byCapability: Record<string, number>;
  } {
    const all: Array<{enabled: boolean, adapter: ModelAdapter}> = [];
    for (const reg of Array.from(this.adapters.values())) {
      all.push(reg);
    }
    const enabled = all.filter(reg => reg.enabled);
    
    const byProvider: Record<string, number> = {};
    const byCapability: Record<string, number> = {};
    
    for (const reg of enabled) {
      const adapter = reg.adapter;
      
      // 按提供商统计
      byProvider[adapter.provider] = (byProvider[adapter.provider] || 0) + 1;
      
      // 按能力统计
      if (adapter.capabilities.streaming) {
        byCapability['streaming'] = (byCapability['streaming'] || 0) + 1;
      }
      if (adapter.capabilities.function_call) {
        byCapability['function_call'] = (byCapability['function_call'] || 0) + 1;
      }
      if (adapter.capabilities.vision) {
        byCapability['vision'] = (byCapability['vision'] || 0) + 1;
      }
      if (adapter.capabilities.embedding) {
        byCapability['embedding'] = (byCapability['embedding'] || 0) + 1;
      }
    }
    
    return {
      total: all.length,
      enabled: enabled.length,
      byProvider,
      byCapability,
    };
  }
  
  /**
   * 健康检查所有模型
   */
  async healthCheckAll(): Promise<Map<string, HealthStatus>> {
    const results = new Map<string, HealthStatus>();
    
    for (const [key, registration] of Array.from(this.adapters.entries())) {
      if (!registration.enabled) continue;
      
      try {
        const health = await registration.adapter.healthCheck();
        results.set(key, health);
      } catch (error) {
        results.set(key, {
          provider: registration.adapter.provider,
          model: registration.adapter.model,
          status: 'unhealthy',
          latency: 0,
          lastCheck: new Date(),
          errorRate: 1,
        });
      }
    }
    
    return results;
  }
  
  /**
   * 启动定期健康检查
   */
  startHealthCheck(): void {
    if (this.healthCheckTimer) {
      console.warn('[ModelRegistry] Health check already running');
      return;
    }
    
    console.log(`[ModelRegistry] Starting health check (interval: ${this.config.healthCheckInterval}ms)`);
    
    this.healthCheckTimer = setInterval(async () => {
      const results = await this.healthCheckAll();
      
      let healthy = 0;
      let degraded = 0;
      let unhealthy = 0;
      
      for (const health of Array.from(results.values())) {
        if (health.status === 'healthy') healthy++;
        else if (health.status === 'degraded') degraded++;
        else unhealthy++;
      }
      
      console.log(`[ModelRegistry] Health check: ${healthy} healthy, ${degraded} degraded, ${unhealthy} unhealthy`);
    }, this.config.healthCheckInterval);
  }
  
  /**
   * 停止定期健康检查
   */
  stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
      console.log('[ModelRegistry] Health check stopped');
    }
  }
  
  /**
   * 清理所有模型
   */
  async dispose(): Promise<void> {
    this.stopHealthCheck();
    
    for (const [key, registration] of Array.from(this.adapters.entries())) {
      await registration.adapter.dispose();
    }
    
    this.adapters.clear();
    console.log('[ModelRegistry] All models disposed');
  }
}

export default ModelRegistry;
