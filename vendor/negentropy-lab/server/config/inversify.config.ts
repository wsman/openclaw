/**
 * InversifyJS 容器配置 (完整版)
 * 
 * 宪法依据: §132 (MCP 架构原则), §336 (MCP 依赖注入标准), DS-012 (依赖注入配置标准)
 * 目的: 提供完整的依赖注入容器，支持所有核心服务
 * 
 * @version 2.0.0 (支持Agent系统)
 * @category Configuration
 */

import { Container } from 'inversify';
import { IModelSelector } from '../types/system/IModelSelector';
import { IProviderConfig } from '../types/system/IModelSelector';
import { IMonitoringService } from '../types/monitoring';
import { ILLMService } from '../services/ILLMService';
import { LLMService } from '../services/LLMService';
import { DEFAULT_PROVIDERS } from '../types/system/IModelSelector';
import { IAgentRegistryService } from '../types/system/IAgentRegistry';
import { AgentRegistryService } from '../services/AgentRegistryService';
import { IntelligentRouter } from '../services/IntelligentRouter';
import { ChannelManager, ChannelManagerConfig } from '../gateway/channels/core/ChannelManager';
import { PlatformAdapterFactory } from '../gateway/channels/core/PlatformAdapterFactory';
import { IPlatformAdapterFactory } from '../gateway/channels/interfaces/IPlatformAdapter';

// 类型标识符 (Type Identifiers)
import { TYPES } from './inversify.types';

// 创建模拟服务
class MockModelSelector implements IModelSelector {
    async selectModel(requirements: any): Promise<any> {
        return {
            success: true,
            providerId: 'deepseek',
            model: 'deepseek-chat',
            estimatedCost: 0.000001,
            estimatedLatency: 1000
        };
    }
    
    registerProvider(config: any): boolean { return true; }
    getHealthyProviders(): any[] { return []; }
    async getProviderHealth(providerId: string): Promise<any> { return { status: 'healthy' }; }
    updateProviderConfig(providerId: string, config: any): boolean { return true; }
    getSelectionStats(): any { return {}; }
    listProviders(): any[] { return []; }
    removeProvider(providerId: string): boolean { return true; }
    getHealthStatus(): Map<string, any> { return new Map(); }
}

class MockMonitoringService implements IMonitoringService {
    record(providerId: string, data: any): void {}
    getProviderHealth(providerId: string): any { return {}; }
    getSystemStatus(): any { return {}; }
    getTimeWindowStats(): any { return {}; }
    getActiveAlerts(): any[] { return []; }
    recordError(error: any): void {}
    recordMetric(name: string, value: number): void {}
    recordEvent(event: string, data?: any): void {}
    recordTrace(traceId: string, data: any): void {}
    recordAuditLog(log: any): void {}
    async flush(): Promise<void> {}
    startTimer(name: string): () => number { return () => 0; }
    endTimer(name: string): number { return 0; }
    incrementCounter(name: string, value?: number): void {}
    decrementCounter(name: string, value?: number): void {}
    setGauge(name: string, value: number): void {}
    recordHistogram(name: string, value: number): void {}
}

/**
 * 创建并配置全局容器
 * 
 * @returns 配置完成的 InversifyJS 容器
 */
export function createInversifyContainer(): Container {
    const container = new Container({
        defaultScope: 'Singleton'
    });

    // ============================================================================
    // 注册核心服务 (完整版)
    // ============================================================================

    // 1. Model Selector 服务 (Singleton)
    container.bind<IModelSelector>(TYPES.ModelSelector)
        .to(MockModelSelector)
        .inSingletonScope();

    // 2. Monitoring Service 服务 (Singleton)
    container.bind<IMonitoringService>(TYPES.MonitoringService)
        .to(MockMonitoringService)
        .inSingletonScope();

    // 3. LLM Service 服务 (Singleton) - 绑定接口到具体实现
    container.bind<ILLMService>(TYPES.LLMService)
        .to(LLMService)
        .inSingletonScope();

    // 4. 默认Provider配置 (Singleton)
    container.bind<IProviderConfig[]>(TYPES.DefaultProviders)
        .toDynamicValue(() => DEFAULT_PROVIDERS)
        .inSingletonScope();

    // 5. Agent Registry 服务 (Singleton)
    container.bind<IAgentRegistryService>(TYPES.AgentRegistryService)
        .to(AgentRegistryService)
        .inSingletonScope();

    // 6. Intelligent Router 服务 (Singleton)
    container.bind<IntelligentRouter>(TYPES.IntelligentRouter)
        .to(IntelligentRouter)
        .inSingletonScope();

    // 7. Platform Adapter Factory 服务 (Singleton)
    container.bind<IPlatformAdapterFactory>(TYPES.PlatformAdapterFactory)
        .to(PlatformAdapterFactory)
        .inSingletonScope();

    // 8. Channel Manager 服务 (Singleton)
    const channelManagerConfig: ChannelManagerConfig = {
        managerId: 'main-channel-manager',
        name: 'Main Channel Manager',
        version: '1.0.0',
        channels: {
            defaultPriority: 5,
            maxConcurrentChannels: 10,
            enableLoadBalancing: true,
            healthCheckInterval: 30000
        },
        messaging: {
            enableBatching: true,
            maxBatchSize: 50,
            batchTimeout: 1000,
            enableRetry: true,
            maxRetries: 3,
            retryDelay: 1000
        },
        monitoring: {
            enableMetrics: true,
            enableAlerts: true,
            enableLogging: true,
            alertThresholds: {
                errorRate: 5,
                latency: 5000,
                channelDowntime: 60
            },
            logLevel: 'info'
        },
        constitutionalCompliance: {
            enableAutoChecks: true,
            checkInterval: 300000,
            minComplianceScore: 80,
            autoFixThreshold: 70
        }
    };

    container.bind<ChannelManager>(TYPES.ChannelManager)
        .toDynamicValue((context) => {
            const factory = context.container.get<IPlatformAdapterFactory>(TYPES.PlatformAdapterFactory);
            return new ChannelManager(channelManagerConfig, factory);
        })
        .inSingletonScope();

    // ============================================================================
    // 验证容器配置
    // ============================================================================

    console.log('[Inversify] 简化容器配置完成，已注册服务:');
    console.log(`  - ${TYPES.ModelSelector.toString()}: ${container.isBound(TYPES.ModelSelector)}`);
    console.log(`  - ${TYPES.MonitoringService.toString()}: ${container.isBound(TYPES.MonitoringService)}`);
    console.log(`  - ${TYPES.LLMService.toString()}: ${container.isBound(TYPES.LLMService)}`);
    console.log(`  - ${TYPES.DefaultProviders.toString()}: ${container.isBound(TYPES.DefaultProviders)}`);

    return container;
}

/**
 * 全局容器实例 (Global Container Instance)
 * 
 * 提供应用程序范围内的单例容器实例
 */
export class GlobalInversifyContainer {
    private static container: Container | null = null;

    /**
     * 获取全局容器实例 (延迟初始化)
     * 
     * @returns 全局容器实例
     */
    static getInstance(): Container {
        if (!this.container) {
            this.container = createInversifyContainer();
        }
        return this.container;
    }

    /**
     * 设置全局容器实例 (用于测试或特殊场景)
     * 
     * @param container 自定义容器实例
     */
    static setInstance(container: Container): void {
        this.container = container;
    }

    /**
     * 重置全局容器 (主要用于测试)
     */
    static reset(): void {
        this.container = null;
    }

    /**
     * 从容器解析服务
     * 
     * @template T 服务类型
     * @param serviceIdentifier 服务标识符
     * @returns 解析的服务实例
     */
    static resolve<T>(serviceIdentifier: symbol): T {
        return this.getInstance().get<T>(serviceIdentifier);
    }

    /**
     * 检查服务是否已注册
     * 
     * @param serviceIdentifier 服务标识符
     * @returns 是否已注册
     */
    static isRegistered(serviceIdentifier: symbol): boolean {
        return this.getInstance().isBound(serviceIdentifier);
    }
}

/**
 * 容器初始化钩子 (Container Initialization Hook)
 * 
 * 在应用程序启动时调用，确保容器正确初始化
 */
export function initializeContainer(): Container {
    return GlobalInversifyContainer.getInstance();
}

// 默认导出容器创建函数
export default createInversifyContainer;