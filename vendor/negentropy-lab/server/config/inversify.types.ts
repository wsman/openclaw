/**
 * InversifyJS 类型标识符定义
 * 
 * 宪法依据: §336 (MCP 依赖注入标准), §127 (数据驱动原则)
 * 目的: 提供独立的类型标识符定义，避免循环依赖
 * 
 * 数学基础: $T_{types} = \{id: Symbol \times name: string\}$
 * 
 * @version 1.3.0 (添加Agent系统支持)
 * @category Configuration
 */

// 类型标识符 (Type Identifiers)
export const TYPES = {
    Logger: Symbol.for('ILogger'),
    SessionManager: Symbol.for('ISessionManager'),
    HealthProbe: Symbol.for('IHealthProbe'),
    CommandRegistry: Symbol.for('ICommandRegistry'),
    ProtocolBridge: Symbol.for('IProtocolBridge'),
    ToolCallBridge: Symbol.for('IToolCallBridge'),
    EventMapper: Symbol.for('IEventMapper'),
    StreamEngine: Symbol.for('IStreamEngine'),
    ContextGuard: Symbol.for('IContextGuard'),
    PermissionService: Symbol.for('IPermissionService'),
    AuthProfiles: Symbol.for('IAuthProfilesService'),
    // ModelSelector相关类型
    ModelSelector: Symbol.for('IModelSelector'),
    ProviderConfig: Symbol.for('IProviderConfig'),
    ModelRequirements: Symbol.for('IModelRequirements'),
    DefaultProviders: Symbol.for('DefaultProviders'),
    // 监控系统相关类型
    MonitoringService: Symbol.for('IMonitoringService'),
    // LLM服务相关类型
    LLMService: Symbol.for('ILLMService'),
    // 时序存储与预测引擎相关类型
    TimeSeriesStorage: Symbol.for('ITimeSeriesStorage'),
    PredictiveEngine: Symbol.for('IPredictiveEngine'),
    OptimizationExecutor: Symbol.for('IOptimizationExecutor'),
    // Agent系统相关类型
    AgentRegistryService: Symbol.for('IAgentRegistryService'),
    IntelligentRouter: Symbol.for('IIntelligentRouter'),
    // 通道管理相关类型
    ChannelManager: Symbol.for('IChannelManager'),
    PlatformAdapterFactory: Symbol.for('IPlatformAdapterFactory'),
    // 未来扩展的类型标识符...
};

// 类型导出
export type LoggerType = typeof TYPES.Logger;
export type SessionManagerType = typeof TYPES.SessionManager;
export type HealthProbeType = typeof TYPES.HealthProbe;
export type CommandRegistryType = typeof TYPES.CommandRegistry;
export type ProtocolBridgeType = typeof TYPES.ProtocolBridge;
export type ToolCallBridgeType = typeof TYPES.ToolCallBridge;
export type EventMapperType = typeof TYPES.EventMapper;
export type StreamEngineType = typeof TYPES.StreamEngine;
export type ContextGuardType = typeof TYPES.ContextGuard;
export type PermissionServiceType = typeof TYPES.PermissionService;
export type ModelSelectorType = typeof TYPES.ModelSelector;
export type ProviderConfigType = typeof TYPES.ProviderConfig;
export type ModelRequirementsType = typeof TYPES.ModelRequirements;
export type DefaultProvidersType = typeof TYPES.DefaultProviders;
export type MonitoringServiceType = typeof TYPES.MonitoringService;
export type LLMServiceType = typeof TYPES.LLMService;
export type AgentRegistryServiceType = typeof TYPES.AgentRegistryService;
export type IntelligentRouterType = typeof TYPES.IntelligentRouter;export type ChannelManagerType = typeof TYPES.ChannelManager;
export type PlatformAdapterFactoryType = typeof TYPES.PlatformAdapterFactory;
