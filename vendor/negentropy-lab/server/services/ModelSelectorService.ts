/**
 * 🎯 ModelSelectorService - 简化版模型选择器服务 (逆向回流自 MY-DOGE-DEMO)
 * 
 * @constitution
 * §101 同步公理：代码变更必须触发文档更新
 * §102 熵减原则：所有变更必须降低或维持系统熵值
 * §106 Agent身份公理：每个Agent必须拥有唯一身份标识和明确职责
 * §108 异构模型策略：严格指定模型参数，优化配额使用
 * §110 协作效率公理：Agent响应时间必须控制在合理范围内（目标<3秒）
 * §141 熵减验证公理：重构必须满足语义保持性和熵减验证
 * §152 单一真理源公理：代码实现与法典版本必须同步
 * §190 网络韧性公理：系统必须具备容错恢复能力
 * §192 模型选择器公理：必须根据任务复杂度动态选择最优LLM模型
 * §193 模型选择器更新公理：模型选择器必须持续学习并适应性能变化
 * §306 零停机协议：在生产级开发任务中确保服务连续性
 * §501 插件系统公理：所有扩展功能必须通过插件系统实现
 * §504 监控系统公理：系统必须实时监控宪法合规状态
 * 
 * 技术法依据: §470-§479外部服务集成与模型管理标准
 * 开发标准: DS-042 ModernModelSelector标准实现简化版
 * 
 * 逆向回流说明:
 * - 来源: MY-DOGE-DEMO的ModernModelSelector.ts (v1.0.0)
 * - 回流时间: 2026-02-05
 * - 简化原则: 保留核心功能，移除复杂特性，适配Negentropy-Lab架构
 * - 宪法合规: 保持§192模型选择器公理的核心数学基础
 * 
 * 核心功能:
 * 1. 基于权重评分的多提供商选择算法
 * 2. 健康状态监控和降级管理
 * 3. 成本优化和性能平衡
 * 4. 流式响应支持
 * 
 * @filename ModelSelectorService.ts
 * @version 1.0.0 (简化版)
 * @category LLM & AI Integration
 * @last_updated 2026-02-25
 */

import { injectable } from 'inversify';
import { IModelSelector, IModelRequirements, IModelSelection, IProviderConfig } from '../types/system/IModelSelector';
import { logger } from '../utils/logger';

// ============================================================================
// 类型扩展定义
// ============================================================================

/**
 * 提供商健康状态
 */
interface ProviderHealth {
    providerId: string;
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    lastCheck: number;
    latency: number; // 延迟(ms)
    successRate: number; // 成功率(0-1)
    errorCount: number;
    consecutiveErrors: number;
}

/**
 * 选择统计信息
 */
interface SelectionStats {
    totalSelections: number;
    successRate: number;
    averageLatency: number;
    averageCost: number;
    providerStats: Record<string, {
        selections: number;
        successRate: number;
        averageLatency: number;
        averageCost: number;
        lastUsed: number;
    }>;
}

/**
 * 权重配置
 */
interface WeightConfig {
    capability: number;   // 能力匹配权重 (0.4)
    health: number;       // 健康度权重 (0.3)
    cost: number;         // 成本权重 (0.2)
    latency: number;      // 延迟权重 (0.1)
}

/**
 * 简化版模型选择器服务
 */
@injectable()
export class ModelSelectorService implements IModelSelector {
    // 提供商配置映射
    private providers: Map<string, IProviderConfig> = new Map();
    
    // 提供商健康状态
    private providerHealth: Map<string, ProviderHealth> = new Map();
    
    // 选择统计
    private selectionStats: SelectionStats = {
        totalSelections: 0,
        successRate: 1.0,
        averageLatency: 0,
        averageCost: 0,
        providerStats: {}
    };
    
    // 权重配置
    private readonly defaultWeights: WeightConfig = {
        capability: 0.4,
        health: 0.3,
        cost: 0.2,
        latency: 0.1
    };
    
    // 健康监控定时器
    private healthMonitorInterval?: NodeJS.Timeout;
    
    constructor() {
        this.initializeDefaultProviders();
        this.startHealthMonitoring();
        logger.info('[ModelSelectorService] 简化版模型选择器初始化完成');
    }
    
    /**
     * 初始化默认提供商
     */
    private initializeDefaultProviders(): void {
        // 深度求索提供商 (首选)
        const deepseekProvider: IProviderConfig = {
            id: 'deepseek',
            name: 'DeepSeek',
            baseUrl: 'https://api.deepseek.com',
            models: ['deepseek-chat', 'deepseek-coder'],
            capabilities: ['general', 'reasoning', 'coding'],
            costPerToken: 0.000001,
            maxConcurrent: 10
        };
        
        // OpenAI提供商 (备用)
        const openaiProvider: IProviderConfig = {
            id: 'openai',
            name: 'OpenAI',
            baseUrl: 'https://api.openai.com',
            models: ['gpt-4', 'gpt-3.5-turbo'],
            capabilities: ['general', 'reasoning', 'creative'],
            costPerToken: 0.000003,
            maxConcurrent: 5
        };
        
        // Ollama本地提供商 (开发环境)
        const ollamaProvider: IProviderConfig = {
            id: 'ollama',
            name: 'Ollama (Local)',
            baseUrl: 'http://localhost:11434',
            models: ['llama2', 'mistral'],
            capabilities: ['general', 'coding'],
            costPerToken: 0.0000001,
            maxConcurrent: 3
        };
        
        this.providers.set(deepseekProvider.id, deepseekProvider);
        this.providers.set(openaiProvider.id, openaiProvider);
        this.providers.set(ollamaProvider.id, ollamaProvider);
        
        // 初始化健康状态
        this.providers.forEach((provider) => {
            this.providerHealth.set(provider.id, {
                providerId: provider.id,
                status: 'unknown',
                lastCheck: Date.now(),
                latency: 1000,
                successRate: 0.95,
                errorCount: 0,
                consecutiveErrors: 0
            });
        });
        
        logger.info(`[ModelSelectorService] 默认提供商初始化完成: ${this.providers.size}个`);
    }
    
    /**
     * 选择模型 (核心算法)
     * 数学基础: 多目标优化加权和 $S = Σ w_i × score_i$
     */
    async selectModel(requirements: IModelRequirements): Promise<IModelSelection> {
        const startTime = Date.now();
        
        try {
            // 1. 获取健康提供商
            const healthyProviders = this.getHealthyProvidersPrivate();
            
            if (healthyProviders.length === 0) {
                logger.warn('[ModelSelectorService] 无健康提供商，执行降级策略');
                return this.applyFallbackStrategy(requirements);
            }
            
            // 2. 计算每个提供商的得分
            const scoredProviders = healthyProviders.map(provider => ({
                provider,
                score: this.calculateProviderScore(provider, requirements)
            }));
            
            // 3. 按得分降序排序
            scoredProviders.sort((a, b) => b.score - a.score);
            
            // 4. 选择最佳提供商
            const bestProvider = scoredProviders[0].provider;
            const bestScore = scoredProviders[0].score;
            
            // 5. 选择具体模型
            const selectedModel = this.selectModelFromProvider(bestProvider, requirements);
            
            // 6. 计算预估成本
            const estimatedCost = this.estimateCost(bestProvider, requirements);
            
            // 7. 获取预估延迟
            const health = this.providerHealth.get(bestProvider.id);
            const estimatedLatency = health?.latency || 1000;
            
            // 8. 构建结果
            const result: IModelSelection = {
                success: true,
                providerId: bestProvider.id,
                model: selectedModel,
                estimatedCost,
                estimatedLatency,
                reasoning: `选择 ${bestProvider.name} (得分: ${bestScore.toFixed(2)})`
            };
            
            // 9. 记录统计
            this.recordSelection(true, result, Date.now() - startTime);
            
            logger.info(`[ModelSelectorService] 模型选择完成: ${bestProvider.id}/${selectedModel}, 得分: ${bestScore.toFixed(2)}, 成本: ${estimatedCost}`);
            
            return result;
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`[ModelSelectorService] 模型选择失败: ${errorMessage}`);
            
            const errorResult: IModelSelection = {
                success: false,
                providerId: 'unknown',
                model: 'unknown',
                error: `模型选择失败: ${errorMessage}`,
                reasoning: '模型选择过程中发生错误'
            };
            
            this.recordSelection(false, errorResult, Date.now() - startTime);
            
            return errorResult;
        }
    }
    
    /**
     * 计算提供商得分
     * 数学公式: $S = w_{cap} × C + w_{health} × H + w_{cost} × (1 - \frac{cost}{maxCost}) + w_{latency} × (1 - \frac{latency}{maxLatency})$
     */
    private calculateProviderScore(provider: IProviderConfig, requirements: IModelRequirements): number {
        const health = this.providerHealth.get(provider.id);
        
        // 1. 能力匹配得分
        const capabilityScore = this.calculateCapabilityScore(provider, requirements);
        
        // 2. 健康度得分
        const healthScore = this.calculateHealthScore(health);
        
        // 3. 成本得分 (成本越低得分越高)
        const maxCost = Math.max(0.000001, ...Array.from(this.providers.values()).map(p => p.costPerToken));
        const costScore = 1 - (provider.costPerToken / maxCost);
        
        // 4. 延迟得分 (延迟越低得分越高)
        const latency = health?.latency || 1000;
        const maxLatency = 5000; // 最大允许延迟(ms)
        const latencyScore = Math.max(0, 1 - (latency / maxLatency));
        
        // 5. 动态权重调整 (根据需求优先级)
        const weights = this.adjustWeightsForRequirements(requirements);
        
        // 6. 计算最终得分
        const finalScore = (
            weights.capability * capabilityScore +
            weights.health * healthScore +
            weights.cost * costScore +
            weights.latency * latencyScore
        );
        
        return finalScore;
    }
    
    /**
     * 计算能力匹配得分
     */
    private calculateCapabilityScore(provider: IProviderConfig, requirements: IModelRequirements): number {
        // 检查提供商是否支持所需能力
        const supportsCapability = provider.capabilities.includes(requirements.capability);
        
        if (!supportsCapability) {
            return 0; // 完全不匹配
        }
        
        // 能力匹配基础得分
        let score = 0.8;
        
        // 额外加分项
        if (requirements.capability === 'reasoning' && provider.models.some(m => m.includes('reasoner'))) {
            score += 0.15; // 推理能力强化
        }
        
        if (requirements.capability === 'coding' && provider.models.some(m => m.includes('coder'))) {
            score += 0.15; // 编码能力强化
        }
        
        // 上下文大小检查 (如果有要求)
        if (requirements.contextSize !== undefined && provider.models.some(m => {
            // 简单模型上下文大小检查
            const modelContexts: Record<string, number> = {
                'deepseek-chat': 32768,
                'deepseek-coder': 32768,
                'deepseek-reasoner': 8192,
                'gpt-4': 128000,
                'gpt-3.5-turbo': 16384,
                'llama2': 4096,
                'mistral': 8192
            };
            const contextSize = modelContexts[m] || 4096;
            return contextSize >= (requirements.contextSize || 0);
        })) {
            score += 0.05; // 上下文大小匹配
        }
        
        return Math.min(1.0, score);
    }
    
    /**
     * 计算健康度得分
     */
    private calculateHealthScore(health?: ProviderHealth): number {
        if (!health) {
            return 0.5; // 未知状态默认得分
        }
        
        switch (health.status) {
            case 'healthy':
                return 1.0;
            case 'degraded':
                return 0.7;
            case 'unhealthy':
                return 0.2;
            case 'unknown':
                return 0.5;
            default:
                return 0.5;
        }
    }
    
    /**
     * 根据需求调整权重
     */
    private adjustWeightsForRequirements(requirements: IModelRequirements): WeightConfig {
        const weights = { ...this.defaultWeights };
        
        // 根据优先级调整权重
        if (requirements.priority === 'cost') {
            weights.cost = 0.4;
            weights.latency = 0.1;
        } else if (requirements.priority === 'speed') {
            weights.latency = 0.4;
            weights.cost = 0.1;
        } else if (requirements.priority === 'quality') {
            weights.capability = 0.5;
            weights.health = 0.3;
        }
        
        // 确保权重总和为1
        const total = weights.capability + weights.health + weights.cost + weights.latency;
        if (total !== 1.0) {
            const factor = 1.0 / total;
            weights.capability *= factor;
            weights.health *= factor;
            weights.cost *= factor;
            weights.latency *= factor;
        }
        
        return weights;
    }
    
    /**
     * 从提供商选择具体模型
     */
    private selectModelFromProvider(provider: IProviderConfig, requirements: IModelRequirements): string {
        // 基于能力类型选择模型
        switch (requirements.capability) {
            case 'reasoning':
                // 优先选择推理优化模型
                const reasoningModel = provider.models.find(m => 
                    m.includes('reasoner') || m.includes('opus') || m.includes('o1')
                );
                if (reasoningModel) return reasoningModel;
                break;
                
            case 'coding':
                // 优先选择代码优化模型
                const codingModel = provider.models.find(m => 
                    m.includes('coder') || m.includes('code') || m.includes('llama')
                );
                if (codingModel) return codingModel;
                break;
                
            case 'fast':
                // 选择轻量级快速模型
                const fastModel = provider.models.find(m => 
                    m.includes('turbo') || m.includes('mini') || m.includes('haiku')
                );
                if (fastModel) return fastModel;
                break;
        }
        
        // 默认返回第一个模型
        return provider.models[0];
    }
    
    /**
     * 估计成本
     */
    private estimateCost(provider: IProviderConfig, requirements: IModelRequirements): number {
        const tokenEstimate = requirements.maxTokens || 1000; // 默认1000个token
        return provider.costPerToken * tokenEstimate;
    }
    
    /**
     * 降级策略
     */
    private applyFallbackStrategy(requirements: IModelRequirements): IModelSelection {
        // 1. 放宽能力要求
        const relaxedRequirements = { ...requirements };
        if (relaxedRequirements.capability === 'reasoning') {
            relaxedRequirements.capability = 'general';
        }
        
        // 2. 尝试所有提供商 (包括不健康的)
        const allProviders = Array.from(this.providers.values());
        if (allProviders.length === 0) {
            return {
                success: false,
                providerId: 'unknown',
                model: 'unknown',
                error: '无可用提供商',
                reasoning: '所有提供商均不可用'
            };
        }
        
        // 3. 选择成本最低的提供商
        const cheapestProvider = allProviders.reduce((cheapest, current) => 
            current.costPerToken < cheapest.costPerToken ? current : cheapest
        );
        
        const selectedModel = this.selectModelFromProvider(cheapestProvider, relaxedRequirements);
        const estimatedCost = this.estimateCost(cheapestProvider, relaxedRequirements);
        
        return {
            success: true,
            providerId: cheapestProvider.id,
            model: selectedModel,
            estimatedCost,
            estimatedLatency: 5000, // 降级延迟估计
            reasoning: `降级选择: ${cheapestProvider.name} (成本最低)`
        };
    }
    
    /**
     * 记录选择统计
     */
    private recordSelection(success: boolean, result: IModelSelection, latency: number): void {
        this.selectionStats.totalSelections++;
        
        // 更新提供商统计
        if (result.providerId && result.providerId !== 'unknown') {
            let providerStats = this.selectionStats.providerStats[result.providerId];
            if (!providerStats) {
                providerStats = {
                    selections: 0,
                    successRate: 0,
                    averageLatency: 0,
                    averageCost: 0,
                    lastUsed: Date.now()
                };
            }
            
            providerStats.selections++;
            providerStats.lastUsed = Date.now();
            
            // 更新成功率
            const prevSuccessCount = (providerStats.selections - 1) * providerStats.successRate;
            providerStats.successRate = (prevSuccessCount + (success ? 1 : 0)) / providerStats.selections;
            
            // 更新平均延迟
            if (latency > 0) {
                const prevTotalLatency = providerStats.averageLatency * (providerStats.selections - 1);
                providerStats.averageLatency = (prevTotalLatency + latency) / providerStats.selections;
            }
            
            // 更新平均成本
            if (result.estimatedCost && result.estimatedCost > 0) {
                const prevTotalCost = providerStats.averageCost * (providerStats.selections - 1);
                providerStats.averageCost = (prevTotalCost + result.estimatedCost) / providerStats.selections;
            }
            
            this.selectionStats.providerStats[result.providerId] = providerStats;
        }
        
        // 更新全局成功率
        let totalSuccessCount = 0;
        Object.values(this.selectionStats.providerStats).forEach(stats => {
            totalSuccessCount += stats.selections * stats.successRate;
        });
        
        this.selectionStats.successRate = totalSuccessCount / this.selectionStats.totalSelections;
    }
    
    /**
     * 启动健康监控
     */
    private startHealthMonitoring(): void {
        // 每30秒检查一次健康状态
        this.healthMonitorInterval = setInterval(async () => {
            await this.performHealthChecks();
        }, 30000); // §470.2 要求≤30s
        
        logger.info('[ModelSelectorService] 健康监控已启动 (30秒间隔)');
    }
    
    /**
     * 执行健康检查
     */
    private async performHealthChecks(): Promise<void> {
        const checkPromises = Array.from(this.providers.keys()).map(async (providerId) => {
            try {
                await this.checkProviderHealth(providerId);
            } catch (error) {
                logger.warn(`[ModelSelectorService] 提供商 ${providerId} 健康检查失败:`, error);
            }
        });
        
        await Promise.all(checkPromises);
    }
    
    /**
     * 检查提供商健康状态
     */
    private async checkProviderHealth(providerId: string): Promise<void> {
        const provider = this.providers.get(providerId);
        if (!provider) return;
        
        const startTime = Date.now();
        
        try {
            // 简化的健康检查 (实际应该调用提供商API)
            await this.simulateHealthCheck(provider.baseUrl);
            
            const latency = Date.now() - startTime;
            const health: ProviderHealth = {
                providerId,
                status: latency > 2000 ? 'degraded' : 'healthy',
                lastCheck: Date.now(),
                latency,
                successRate: 0.95, // 模拟成功率
                errorCount: 0,
                consecutiveErrors: 0
            };
            
            this.providerHealth.set(providerId, health);
            
        } catch (error) {
            const health = this.providerHealth.get(providerId) || {
                providerId,
                status: 'unknown',
                lastCheck: Date.now(),
                latency: 0,
                successRate: 0,
                errorCount: 0,
                consecutiveErrors: 0
            };
            
            health.status = 'unhealthy';
            health.lastCheck = Date.now();
            health.latency = Date.now() - startTime;
            health.errorCount++;
            health.consecutiveErrors++;
            
            // 连续错误过多则标记为不可用
            if (health.consecutiveErrors >= 3) {
                health.status = 'unhealthy';
            }
            
            this.providerHealth.set(providerId, health);
        }
    }
    
    /**
     * 模拟健康检查
     */
    private async simulateHealthCheck(endpoint: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const timeout = 3000;
            const timeoutId = setTimeout(() => {
                reject(new Error(`健康检查超时 (${timeout}ms)`));
            }, timeout);
            
            // 模拟网络延迟 (100-500ms)
            const delay = 100 + Math.random() * 400;
            setTimeout(() => {
                clearTimeout(timeoutId);
                
                // 模拟5%的失败率
                if (Math.random() < 0.05) {
                    reject(new Error('模拟健康检查失败'));
                } else {
                    resolve();
                }
            }, delay);
        });
    }
    
    /**
     * 获取健康提供商 (私有方法)
     */
    private getHealthyProvidersPrivate(): IProviderConfig[] {
        const healthy: IProviderConfig[] = [];
        
        this.providers.forEach((provider) => {
            const health = this.providerHealth.get(provider.id);
            
            // 允许 'healthy' 和 'degraded' 状态
            // 'unknown' 表示刚启动，还未检查，视为可能健康
            if (!health || health.status === 'healthy' || health.status === 'degraded' || health.status === 'unknown') {
                healthy.push(provider);
            }
        });
        
        return healthy;
    }
    
    // ============================================================================
    // 接口方法实现
    // ============================================================================
    
    registerProvider(config: IProviderConfig): boolean {
        if (this.providers.has(config.id)) {
            logger.warn(`[ModelSelectorService] 提供商 ${config.id} 已存在`);
            return false;
        }
        
        this.providers.set(config.id, config);
        
        // 初始化健康状态
        this.providerHealth.set(config.id, {
            providerId: config.id,
            status: 'unknown',
            lastCheck: Date.now(),
            latency: 1000,
            successRate: 0.95,
            errorCount: 0,
            consecutiveErrors: 0
        });
        
        logger.info(`[ModelSelectorService] 提供商 ${config.id} 注册成功`);
        return true;
    }
    
    getHealthyProviders(): IProviderConfig[] {
        return this.getHealthyProvidersPrivate();
    }
    
    async getProviderHealth(providerId: string): Promise<any> {
        const provider = this.providers.get(providerId);
        if (!provider) {
            return {
                providerId,
                status: 'unknown',
                lastCheck: Date.now(),
                latency: 0,
                successRate: 0
            };
        }
        
        const health = this.providerHealth.get(providerId);
        if (!health) {
            return {
                providerId,
                status: 'unknown',
                lastCheck: Date.now(),
                latency: 0,
                successRate: 0
            };
        }
        
        return health;
    }
    
    updateProviderConfig(providerId: string, config: Partial<IProviderConfig>): boolean {
        const provider = this.providers.get(providerId);
        if (!provider) {
            return false;
        }
        
        const updatedProvider = { ...provider, ...config };
        this.providers.set(providerId, updatedProvider);
        
        logger.info(`[ModelSelectorService] 提供商 ${providerId} 配置已更新`);
        return true;
    }
    
    getSelectionStats(): any {
        return { ...this.selectionStats };
    }
    
    listProviders(): any[] {
        const providers: any[] = [];
        
        this.providers.forEach((config, id) => {
            const health = this.providerHealth.get(id);
            providers.push({
                id: config.id,
                name: config.name,
                models: config.models,
                capabilities: config.capabilities,
                status: health?.status || 'unknown',
                lastCheck: health?.lastCheck || Date.now(),
                latency: health?.latency || 0,
                successRate: health?.successRate || 0
            });
        });
        
        return providers;
    }
    
    removeProvider(providerId: string): boolean {
        const removed = this.providers.delete(providerId);
        if (removed) {
            this.providerHealth.delete(providerId);
            delete this.selectionStats.providerStats[providerId];
            logger.info(`[ModelSelectorService] 提供商 ${providerId} 已移除`);
        }
        return removed;
    }
    
    getHealthStatus(): Map<string, any> {
        return new Map(this.providerHealth);
    }
    
    // ============================================================================
    // 清理和关闭
    // ============================================================================
    
    /**
     * 清理资源
     */
    cleanup(): void {
        if (this.healthMonitorInterval) {
            clearInterval(this.healthMonitorInterval);
            this.healthMonitorInterval = undefined;
        }
        
        logger.info('[ModelSelectorService] 资源已清理');
    }
}