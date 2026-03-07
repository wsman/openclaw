/**
 * Negentropy-Lab Plugin System - Core Interface Definitions
 * 
 * 宪法依据:
 * - §101 同步公理: 代码与文档必须原子性同步
 * - §102 熵减原则: 复用OpenClaw已有架构，避免重复实现
 * - §108 异构模型策略: 明确模型参数配置
 * 
 * @version 1.0.0
 * @created 2026-02-12
 * @maintainer 科技部后端分队
 */

import type { IncomingMessage, ServerResponse } from 'http';
import type { Room } from '@colyseus/core';

// =============================================================================
// PluginType - 运行时插件类型 (9种)
// =============================================================================

/**
 * 运行时插件类型枚举
 * 
 * 定义了系统支持的9种运行时插件类型，用于插件注册和生命周期管理。
 * 与PluginKind(6)分层建模：
 * - PluginType: 运行时行为分类（用于PluginManager加载和调度）
 * - PluginKind: 功能领域分类（用于插件注册表组织）
 * 
 * 宪法依据: §501插件系统公理
 * 文档参考: memory_bank/t0_core/basic_law_index.md 第7.3节
 */
export type PluginType = 
  | 'HTTP_MIDDLEWARE'       // Express中间件，请求处理、认证、日志
  | 'WEBSOCKET_MIDDLEWARE'  // WebSocket消息拦截、校验与治理
  | 'EVENT_HANDLER'         // 事件处理器，系统事件处理
  | 'SCHEDULED_TASK'        // 定时任务与计划调度
  | 'DATA_TRANSFORMER'      // 数据转换插件，数据清洗、格式转换
  | 'EXTERNAL_INTEGRATION'  // 外部系统集成与适配
  | 'MONITORING'            // 监控插件，性能监控、指标收集
  | 'LOGGING'               // 日志插件，结构化日志、审计
  | 'SECURITY';             // 安全插件，鉴权与策略防护

/**
 * PluginType枚举数组，用于运行时验证
 */
export const PLUGIN_TYPES: PluginType[] = [
  'HTTP_MIDDLEWARE',
  'WEBSOCKET_MIDDLEWARE',
  'EVENT_HANDLER',
  'SCHEDULED_TASK',
  'DATA_TRANSFORMER',
  'EXTERNAL_INTEGRATION',
  'MONITORING',
  'LOGGING',
  'SECURITY'
];

// =============================================================================
// Plugin Manifest & Configuration
// =============================================================================

/**
 * Plugin Manifest - 插件清单文件 (negentropy.plugin.json)
 * 
 * OpenClaw兼容: 100%
 * Negentropy扩展: Agent集成、熵监控、宪法合规
 */
export interface PluginManifest {
  /** 插件唯一标识符 (必需) */
  id: string;
  /** 插件名称 */
  name?: string;
  /** 插件描述 */
  description?: string;
  /** 插件版本 */
  version?: string;
  /** 插件类型 */
  kind?: PluginKind;
  /** 主入口文件 */
  main?: string;
  /** 配置Schema */
  configSchema?: PluginConfigSchema;
  /** OpenClaw兼容性标志 */
  openclawCompat?: boolean;
  /** Negentropy-Lab扩展配置 */
  negentropy?: NegentropyExtension;
  /** 插件源路径 (运行时添加) */
  sourcePath?: string;
}

/**
 * 插件类型
 */
export type PluginKind = 
  | 'core'           // 核心插件
  | 'agent'          // Agent集成插件
  | 'monitoring'     // 监控插件
  | 'channel'        // 通信通道插件
  | 'gateway'        // 网关插件
  | 'memory';        // 记忆插件

/**
 * Negentropy-Lab扩展配置
 */
export interface NegentropyExtension {
  /** Agent集成配置 */
  agentIntegration?: AgentIntegrationConfig;
  /** 熵监控配置 */
  entropyMonitor?: EntropyMonitorConfig;
  /** 宪法合规配置 */
  constitutionalCompliance?: ConstitutionalComplianceConfig;
}

/**
 * Agent集成配置
 */
export interface AgentIntegrationConfig {
  /** 推荐模型 (遵循§108异构模型策略) */
  model?: string;
  /** 超时配置 (遵循§118长时间任务执行公理) */
  timeout?: number;
  /** 最大递归深度 */
  depth?: number;
  /** 权限级别 */
  permissions?: string[];
}

/**
 * 熵监控配置
 */
export interface EntropyMonitorConfig {
  /** 监控指标列表 */
  metrics: string[];
  /** 阈值配置 */
  thresholds: Record<string, number>;
  /** 报警级别 */
  alertLevel?: 'info' | 'warn' | 'error';
}

/**
 * 宪法合规配置
 */
export interface ConstitutionalComplianceConfig {
  /** 必需的宪法条款 */
  requiredClauses: string[];
  /** 验证规则Schema */
  validationRules?: ValidationSchema;
}

/**
 * 验证Schema (简化版)
 */
export interface ValidationSchema {
  type: string;
  rules?: ValidationRule[];
}

/**
 * 验证规则
 */
export interface ValidationRule {
  /** 规则名称 */
  name: string;
  /** 规则描述 */
  description?: string;
  /** 规则类型 */
  type: 'required' | 'optional' | 'conditional';
  /** 条件表达式 */
  condition?: string;
}

/**
 * 插件配置Schema
 */
export interface PluginConfigSchema {
  /** JSON Schema格式 */
  type?: 'object';
  properties?: Record<string, any>;
  required?: string[];
  additionalProperties?: boolean;
  /** UI提示 */
  uiHints?: Record<string, PluginConfigUiHint>;
}

/**
 * UI提示配置
 */
export interface PluginConfigUiHint {
  /** 字段标签 */
  label?: string;
  /** 帮助文本 */
  help?: string;
  /** 是否高级配置 */
  advanced?: boolean;
  /** 是否敏感信息 */
  sensitive?: boolean;
  /** 占位符文本 */
  placeholder?: string;
}

// =============================================================================
// Plugin Definition
// =============================================================================

/**
 * 插件定义
 * 
 * OpenClaw兼容: OpenClawPluginDefinition
 * Negentropy扩展: NegentropyExtension
 */
export interface PluginDefinition extends PluginManifest {
  /** 插件初始化函数 */
  initialize?: (api: PluginApi) => void | Promise<void>;
  /** 插件激活函数 */
  activate?: (api: PluginApi) => void | Promise<void>;
  /** 插件停用函数 */
  deactivate?: (api: PluginApi) => void | Promise<void>;
  /** 插件清理函数 */
  cleanup?: (api: PluginApi) => void | Promise<void>;
}

/**
 * 插件模块 (支持导出函数或对象)
 */
export type PluginModule = 
  | PluginDefinition
  | ((api: PluginApi) => void | Promise<void>);

// =============================================================================
// Plugin API
// =============================================================================

/**
 * 插件API接口
 * 
 * 提供给插件的运行时API，包括:
 * - 日志记录
 * - 配置管理
 * - 生命周期钩子
 * - 工具注册
 * - HTTP路由注册
 * - Room注册
 */
export interface PluginApi {
  /** 插件ID */
  id: string;
  /** 插件名称 */
  name: string;
  /** 插件版本 */
  version?: string;
  /** 插件描述 */
  description?: string;
  /** 插件来源路径 */
  source: string;
  /** 插件配置 */
  config: any;
  /** 插件自定义配置 */
  pluginConfig?: Record<string, unknown>;
  /** 运行时环境 */
  runtime: PluginRuntime;
  /** 日志记录器 */
  logger: PluginLogger;
  /** 注册生命周期钩子 */
  on: <K extends PluginHookName>(
    hookName: K,
    handler: PluginHookHandlerMap[K],
    opts?: { priority?: number }
  ) => void;
  /** Optional event emitter exposed by some runtimes for hook fan-out */
  emit?: <K extends PluginHookName>(hookName: K, event: Parameters<PluginHookHandlerMap[K]>[0]) => void;
  /** 注册HTTP路由 */
  registerHttpRoute: (params: { 
    path: string; 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void;
  }) => void;
  /** 注册Colyseus Room */
  registerRoom: (name: string, roomClass: any) => void;
  /** 获取已注册的Room */
  getRoom: (name: string) => Room | undefined;
  /** 解析路径 (相对于插件目录) */
  resolvePath: (input: string) => string;
}

/**
 * 插件运行时环境
 */
export interface PluginRuntime {
  /** 工作空间目录 */
  workspaceDir?: string;
  /** 状态目录 */
  stateDir: string;
  /** 插件目录 */
  pluginDir: string;
  /** 数据存储目录 */
  dataDir: string;
}

/**
 * 插件日志记录器
 */
export interface PluginLogger {
  debug?: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
}

// =============================================================================
// Plugin Lifecycle Hooks
// =============================================================================

/**
 * 插件钩子名称
 * 
 * 涵盖完整的插件生命周期:
 * - 系统启动/停止
 * - 插件加载/卸载
 * - 消息处理
 * - Agent交互
 * - 数据持久化
 */
export type PluginHookName =
  | 'plugin_load'           // 插件加载前
  | 'plugin_loaded'         // 插件加载后
  | 'plugin_activate'       // 插件激活前
  | 'plugin_activated'      // 插件激活后
  | 'plugin_deactivate'     // 插件停用前
  | 'plugin_deactivated'    // 插件停用后
  | 'plugin_unload'         // 插件卸载前
  | 'plugin_unloaded'       // 插件卸载后
  | 'system_start'          // 系统启动
  | 'system_stop'           // 系统停止
  | 'before_agent_task'     // Agent任务执行前
  | 'after_agent_task'      // Agent任务执行后
  | 'message_received'      // 消息接收
  | 'message_sent'          // 消息发送
  | 'config_changed'        // 配置变更
  | 'error_occurred';       // 错误发生

/**
 * 插件钩子上下文
 */
export interface PluginHookContext {
  /** 插件ID */
  pluginId?: string;
  /** 插件名称 */
  pluginName?: string;
  /** 时间戳 */
  timestamp: number;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * Agent任务钩子上下文
 */
export interface AgentTaskContext extends PluginHookContext {
  /** Agent ID */
  agentId?: string;
  /** 任务类型 */
  taskType?: string;
  /** 任务复杂度 */
  complexity?: 'L1' | 'L2' | 'L3' | 'L4';
  /** 模型 */
  model?: string;
  /** 超时配置 */
  timeout?: number;
}

/**
 * 消息钩子上下文
 */
export interface MessageContext extends PluginHookContext {
  /** 消息ID */
  messageId?: string;
  /** 发送者ID */
  from?: string;
  /** 接收者ID */
  to?: string;
  /** 消息类型 */
  type?: string;
}

/**
 * 错误钩子上下文
 */
export interface ErrorContext extends PluginHookContext {
  /** 错误类型 */
  errorType?: string;
  /** 错误消息 */
  errorMessage?: string;
  /** 错误堆栈 */
  stackTrace?: string;
  /** 错误来源 */
  source?: string;
}

/**
 * 配置变更钩子上下文
 */
export interface ConfigChangeContext extends PluginHookContext {
  /** 配置键 */
  key?: string;
  /** 旧值 */
  oldValue?: unknown;
  /** 新值 */
  newValue?: unknown;
}

/**
 * 插件钩子事件映射
 */
export interface PluginHookHandlerMap {
  plugin_load: (event: PluginHookEvent, ctx: PluginHookContext) => Promise<void> | void;
  plugin_loaded: (event: PluginHookEvent, ctx: PluginHookContext) => Promise<void> | void;
  plugin_activate: (event: PluginHookEvent, ctx: PluginHookContext) => Promise<void> | void;
  plugin_activated: (event: PluginHookEvent, ctx: PluginHookContext) => Promise<void> | void;
  plugin_deactivate: (event: PluginHookEvent, ctx: PluginHookContext) => Promise<void> | void;
  plugin_deactivated: (event: PluginHookEvent, ctx: PluginHookContext) => Promise<void> | void;
  plugin_unload: (event: PluginHookEvent, ctx: PluginHookContext) => Promise<void> | void;
  plugin_unloaded: (event: PluginHookEvent, ctx: PluginHookContext) => Promise<void> | void;
  system_start: (event: SystemHookEvent, ctx: PluginHookContext) => Promise<void> | void;
  system_stop: (event: SystemHookEvent, ctx: PluginHookContext) => Promise<void> | void;
  before_agent_task: (event: AgentTaskEvent, ctx: AgentTaskContext) => Promise<void> | void;
  after_agent_task: (event: AgentTaskEvent, ctx: AgentTaskContext) => Promise<void> | void;
  message_received: (event: MessageEvent, ctx: MessageContext) => Promise<void> | void;
  message_sent: (event: MessageEvent, ctx: MessageContext) => Promise<void> | void;
  config_changed: (event: ConfigChangeEvent, ctx: ConfigChangeContext) => Promise<void> | void;
  error_occurred: (event: ErrorEvent, ctx: ErrorContext) => Promise<void> | void;
}

/**
 * 通用插件钩子事件
 */
export interface PluginHookEvent {
  /** 插件ID */
  pluginId: string;
  /** 事件时间戳 */
  timestamp: number;
}

/**
 * 系统钩子事件
 */
export interface SystemHookEvent extends PluginHookEvent {
  /** 系统端口 */
  port?: number;
  /** 停止原因 */
  reason?: string;
}

/**
 * Agent任务事件
 */
export interface AgentTaskEvent extends PluginHookEvent {
  /** 任务ID */
  taskId?: string;
  /** 任务描述 */
  taskDescription?: string;
  /** 执行结果 */
  result?: unknown;
  /** 是否成功 */
  success?: boolean;
  /** 执行时长 (毫秒) */
  durationMs?: number;
}

/**
 * 消息事件
 */
export interface MessageEvent extends PluginHookEvent {
  /** 消息内容 */
  content?: string;
  /** 消息元数据 */
  metadata?: Record<string, unknown>;
  /** 是否成功 */
  success?: boolean;
  /** 错误信息 */
  error?: string;
}

/**
 * 配置变更事件
 */
export interface ConfigChangeEvent extends PluginHookEvent {
  /** 配置文件路径 */
  configPath?: string;
}

/**
 * 错误事件
 */
export interface ErrorEvent extends PluginHookEvent {
  /** 错误对象 */
  error?: Error;
}

// =============================================================================
// Plugin State
// =============================================================================

/**
 * 插件状态
 */
export type PluginState = 
  | 'unloaded'       // 未加载
  | 'loading'        // 加载中
  | 'loaded'         // 已加载
  | 'activating'     // 激活中
  | 'active'         // 激活
  | 'deactivating'   // 停用中
  | 'inactive'       // 非激活状态
  | 'error';         // 错误状态

/**
 * 插件状态记录
 */
export interface PluginStateRecord {
  /** 插件ID */
  pluginId: string;
  /** 插件状态 */
  state: PluginState;
  /** 状态变更时间 */
  timestamp: number;
  /** 错误信息 (如果处于错误状态) */
  error?: string;
}

// =============================================================================
// Plugin Registry
// =============================================================================

/**
 * 插件注册表条目
 */
export interface PluginRegistryEntry {
  /** 插件清单 */
  manifest: PluginManifest;
  /** 插件定义 */
  definition: PluginDefinition;
  /** 插件状态 */
  state: PluginState;
  /** 插件配置 */
  config: Record<string, unknown>;
  /** 加载时间 */
  loadTime?: number;
  /** 激活时间 */
  activateTime?: number;
  /** 错误信息 */
  error?: string;
  /** 插件来源 (bundled | workspace) */
  origin: 'bundled' | 'workspace';
  /** 插件目录路径 */
  sourcePath: string;
}

// =============================================================================
// Plugin Dependencies
// =============================================================================

/**
 * 插件依赖
 */
export interface PluginDependency {
  /** 依赖的插件ID */
  pluginId: string;
  /** 最低版本要求 */
  version?: string;
  /** 是否必需 */
  required: boolean;
}

/**
 * 依赖解析结果
 */
export interface DependencyResolution {
  /** 是否成功 */
  success: boolean;
  /** 依赖列表 */
  dependencies: PluginDependency[];
  /** 缺失的依赖 */
  missing: string[];
  /** 冲突的依赖 */
  conflicts: string[];
}

// =============================================================================
// Plugin Isolation
// =============================================================================

/**
 * 插件沙箱配置
 */
export interface PluginSandboxConfig {
  /** 是否启用沙箱 */
  enabled: boolean;
  /** 允许的模块 */
  allowedModules?: string[];
  /** 禁止的模块 */
  forbiddenModules?: string[];
  /** CPU限制 (百分比) */
  cpuLimit?: number;
  /** 内存限制 (MB) */
  memoryLimit?: number;
  /** 超时限制 (毫秒) */
  timeoutLimit?: number;
}

// =============================================================================
// Export All
// =============================================================================

export * from './plugin-interfaces';
