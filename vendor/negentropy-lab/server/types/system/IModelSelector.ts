/**
 * 🔧 类型定义模块 - Type Definition
 *
 * 宪法依据:
 * - §101 同步公理 - 类型定义与实现代码必须原子性同步
 * - §102 熵减原则 - 标准化类型系统，降低系统熵值
 * - §106 人才把关原则 - 类型安全，编译期质量检验
 * - §151 持久化原则 - 类型契约持久化
 *
 * 功能:
 * - TypeScript接口定义
 * - 类型约束与契约
 * - 系统抽象层
 *
 * @维护者 科技部
 * @最后更新 2026-02-12
 */

/**
 * 模型选择器类型定义
 */
export type ModelCapability = 'general' | 'reasoning' | 'coding' | 'fast' | 'creative';

export interface IModelRequirements {
    capability: ModelCapability;
    maxTokens?: number;
    contextSize?: number;
    temperature?: number;
    priority?: 'quality' | 'cost' | 'speed';
}

export interface IProviderConfig {
    id: string;
    name: string;
    baseUrl: string;
    models: string[];
    capabilities: ModelCapability[];
    costPerToken: number;
    maxConcurrent: number;
    healthCheckEndpoint?: string;
}

export interface IModelSelection {
    success: boolean;
    providerId: string;
    model: string;
    estimatedCost?: number;
    estimatedLatency?: number;
    reasoning?: string;
    error?: string;
}

export interface IModelSelector {
    selectModel(requirements: IModelRequirements): Promise<IModelSelection>;
    registerProvider(config: IProviderConfig): boolean;
    getHealthyProviders(): IProviderConfig[];
    getProviderHealth(providerId: string): Promise<any>;
    updateProviderConfig(providerId: string, config: Partial<IProviderConfig>): boolean;
    getSelectionStats(): any;
    listProviders(): any[];
    removeProvider(providerId: string): boolean;
    getHealthStatus(): Map<string, any>;
}

export const DEFAULT_PROVIDERS: IProviderConfig[] = [
    {
        id: 'deepseek',
        name: 'DeepSeek',
        baseUrl: 'https://api.deepseek.com',
        models: ['deepseek-chat', 'deepseek-coder'],
        capabilities: ['general', 'reasoning', 'coding'],
        costPerToken: 0.000001,
        maxConcurrent: 10
    },
    {
        id: 'openai',
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com',
        models: ['gpt-4', 'gpt-3.5-turbo'],
        capabilities: ['general', 'reasoning', 'creative'],
        costPerToken: 0.000003,
        maxConcurrent: 5
    },
    {
        id: 'ollama',
        name: 'Ollama (Local)',
        baseUrl: 'http://localhost:11434',
        models: ['llama2', 'mistral'],
        capabilities: ['general', 'coding'],
        costPerToken: 0.0000001,
        maxConcurrent: 3
    }
];

export class ModelSelectorMath {
    static capabilityMatchScore(providerCapabilities: ModelCapability[], requirements: IModelRequirements): number {
        return providerCapabilities.includes(requirements.capability) ? 1.0 : 0;
    }
    
    static healthScore(provider: any): number {
        return 0.9;
    }
    
    static calculateEntropyReduction(beforeUncertainty: number, afterUncertainty: number): number {
        return beforeUncertainty - afterUncertainty;
    }
}