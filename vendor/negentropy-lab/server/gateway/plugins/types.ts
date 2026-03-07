/**
 * 🚀 插件系统类型定义
 * 宪法依据: §152单一真理源公理、§101同步公理、§102熵减原则
 * 
 * 本文件是插件系统的统一类型定义中心，确保所有插件相关的类型定义具有单一真理源。
 * 任何插件相关的类型变更必须首先更新此文件，然后同步更新所有相关文档。
 * 
 * 开发者注意:
 * 1. 添加新类型时，必须同时更新相关文档和宪法依据注释
 * 2. 类型定义应尽可能精确，减少any类型的使用
 * 3. 遵循§102熵减原则，复用现有类型定义
 * 
 * 版本: v1.0.0
 * 创建时间: 2026-02-11
 * 维护者: 科技部插件系统团队
 */

// ========== 基础类型定义 ==========

/**
 * 插件类型枚举
 * 宪法依据: §152单一真理源 - 统一插件类型定义
 */
export enum PluginType {
  HTTP_MIDDLEWARE = 'http_middleware',      // HTTP请求处理插件
  WEBSOCKET_MIDDLEWARE = 'websocket_middleware', // WebSocket消息处理插件
  EVENT_HANDLER = 'event_handler',          // 事件处理插件
  SCHEDULED_TASK = 'scheduled_task',        // 定时任务插件
  DATA_TRANSFORMER = 'data_transformer',    // 数据转换插件
  EXTERNAL_INTEGRATION = 'external_integration', // 外部集成插件
  MONITORING = 'monitoring',                // 监控插件
  LOGGING = 'logging',                      // 日志插件
  SECURITY = 'security',                    // 安全插件
}

/**
 * 插件状态枚举
 * 宪法依据: §306零停机协议 - 明确插件生命周期状态
 */
export enum PluginStatus {
  NOT_LOADED = 'not_loaded',      // 未加载
  LOADING = 'loading',            // 加载中
  LOADED = 'loaded',              // 已加载
  INITIALIZING = 'initializing',  // 初始化中
  ACTIVE = 'active',              // 活跃运行中
  PAUSED = 'paused',              // 暂停
  ERROR = 'error',                // 错误状态
  UNLOADING = 'unloading',        // 卸载中
  UNLOADED = 'unloaded',          // 已卸载
}

/**
 * 插件宪法合规状态
 * 宪法依据: §101同步公理 - 明确每个宪法条文的合规状态
 */
export interface ConstitutionCompliance {
  /** §101同步公理: 插件文档与实现是否同步 */
  article101: boolean;
  /** §102熵减原则: 是否复用现有组件 */
  article102: boolean;
  /** §108异构模型策略: 是否显式指定模型参数 */
  article108: boolean;
  /** §152单一真理源: 配置是否统一管理 */
  article152: boolean;
  /** §306零停机协议: 是否支持热加载/卸载 */
  article306: boolean;
  /** §110协作效率公理: 性能是否满足要求 */
  article110: boolean;
  /** §381安全公理: 安全机制是否完整 */
  article381?: boolean;
  /** §190网络韧性公理: 是否具备韧性特性 */
  article190?: boolean;
}

/**
 * 插件依赖配置
 * 宪法依据: §102熵减原则 - 明确依赖关系，避免重复实现
 */
export interface PluginDependencies {
  /** 必需的插件ID列表 */
  required?: string[];
  /** 可选的插件ID列表 */
  optional?: string[];
  /** 对等依赖（版本兼容性要求） */
  peer?: string[];
  /** 冲突插件列表 */
  conflicts?: string[];
}

// ========== 插件清单类型 ==========

/**
 * 插件清单 (Plugin Manifest)
 * 宪法依据: §101同步公理 - 完整的元数据定义
 * 
 * 插件清单是插件的"身份证"，包含插件的所有元数据信息。
 * 每个插件必须有一个有效的清单文件，否则无法加载。
 */
export interface PluginManifest {
  /** 插件唯一标识 (必须全局唯一) */
  id: string;
  
  /** 插件名称 (人类可读) */
  name: string;
  
  /** 版本号 (遵循semver规范) */
  version: string;
  
  /** 插件类型 */
  type: PluginType;
  
  /** 插件描述 */
  description: string;
  
  /** 作者信息 */
  author: string;
  
  /** 许可证信息 */
  license: string;
  
  /** 主页URL (可选) */
  homepage?: string;
  
  /** 问题反馈URL (可选) */
  bugsUrl?: string;
  
  /** 源代码仓库URL (可选) */
  repository?: string;
  
  // ========== 宪法合规字段 ==========
  
  /**
   * 宪法合规状态
   * 宪法依据: §101同步公理 - 每个宪法条文的合规状态必须明确
   */
  constitutionCompliance: ConstitutionCompliance;
  
  /**
   * 宪法依据引用
   * 宪法依据: §101同步公理 - 明确引用相关宪法条文
   */
  constitutionalReferences?: {
    /** 主要宪法依据 */
    primary: string[];
    /** 次要宪法依据 */
    secondary?: string[];
  };
  
  // ========== 依赖配置 ==========
  
  /**
   * 依赖声明
   * 宪法依据: §102熵减原则 - 明确依赖关系，促进代码复用
   */
  dependencies?: PluginDependencies;
  
  // ========== 入口配置 ==========
  
  /** 插件入口文件路径 (相对于插件根目录) */
  entryPoint: string;
  
  /** 配置验证Schema (Zod Schema，可选) */
  configSchema?: object;
  
  /** 默认配置 (可选) */
  defaultConfig?: Record<string, any>;
  
  // ========== 生命周期钩子 ==========
  
  /**
   * 生命周期钩子定义
   * 宪法依据: §306零停机协议 - 明确的插件生命周期管理
   */
  lifecycle?: {
    /** 加载时执行 (异步) */
    onLoad?: () => Promise<void>;
    /** 初始化时执行 (异步) */
    onInitialize?: () => Promise<void>;
    /** 启动时执行 (异步) */
    onStart?: () => Promise<void>;
    /** 暂停时执行 (异步) */
    onPause?: () => Promise<void>;
    /** 恢复时执行 (异步) */
    onResume?: () => Promise<void>;
    /** 配置变更时执行 (异步) */
    onConfigChange?: (config: any) => Promise<void>;
    /** 卸载前执行 (异步) */
    beforeUnload?: () => Promise<void>;
    /** 卸载时执行 (异步) */
    onUnload?: () => Promise<void>;
  };
  
  // ========== 性能指标 ==========
  
  /**
   * 性能指标要求
   * 宪法依据: §110协作效率公理 - 明确的性能目标
   */
  performanceMetrics?: {
    /** 最大内存使用 (MB) */
    maxMemoryMB?: number;
    /** 最大CPU使用率 (%) */
    maxCpuPercent?: number;
    /** 最大响应延迟 (ms) */
    maxResponseTimeMs?: number;
    /** 最大启动时间 (ms) */
    maxStartupTimeMs?: number;
  };
  
  // ========== 权限声明 ==========
  
  /**
   * 权限要求
   * 宪法依据: §107通信安全、§381安全公理
   */
  permissions?: {
    /** 需要的网络权限 */
    network?: string[];
    /** 需要的文件系统权限 */
    filesystem?: string[];
    /** 需要的环境变量权限 */
    environment?: string[];
    /** 需要的API权限 */
    api?: string[];
  };
  
  // ========== 扩展字段 ==========
  
  /** 扩展字段 (供未来使用) */
  extensions?: Record<string, any>;
}

// ========== 加载的插件类型 ==========

/**
 * 已加载的插件实例
 * 宪法依据: §306零停机协议 - 明确的运行时状态管理
 */
export interface LoadedPlugin {
  /** 插件清单 */
  manifest: PluginManifest;
  
  /** 插件状态 */
  status: PluginStatus;
  
  /** 插件实例 (加载后的模块) */
  instance?: any;
  
  /** 插件配置 */
  config: Record<string, any>;
  
  /** 加载时间戳 */
  loadedAt: Date;
  
  /** 最后活动时间戳 */
  lastActiveAt?: Date;
  
  /** 错误信息 (如果有) */
  error?: {
    message: string;
    stack?: string;
    timestamp: Date;
  };
  
  /** 性能统计 */
  metrics?: {
    memoryUsage: number;
    cpuUsage: number;
    responseTime: number;
    callCount: number;
    errorCount: number;
  };
  
  /** 宪法合规验证结果 */
  complianceReport?: ComplianceReport;
}

// ========== 宪法合规报告类型 ==========

/**
 * 宪法合规验证结果
 * 宪法依据: §101同步公理 - 详细的合规验证报告
 */
export interface ComplianceReport {
  /** 总体合规状态 */
  overallCompliant: boolean;
  
  /** 详细检查结果 */
  checks: Array<{
    /** 宪法条文编号 */
    article: string;
    /** 检查项描述 */
    description: string;
    /** 合规状态 */
    compliant: boolean;
    /** 检查时间 */
    checkedAt: Date;
    /** 详细信息 */
    details?: string;
    /** 建议改进项 */
    recommendations?: string[];
  }>;
  
  /** 熵值分析结果 (§102) */
  entropyAnalysis?: {
    /** 总代码行数 */
    totalLines: number;
    /** 复用代码行数 */
    reusedLines: number;
    /** 新代码行数 */
    newLines: number;
    /** 复用率 */
    reuseRate: number;
    /** 熵值评分 (0-1，越低越好) */
    entropyScore: number;
    /** 可复用的组件列表 */
    reusableComponents: string[];
  };
  
  /** 性能分析结果 (§110) */
  performanceAnalysis?: {
    /** 启动时间 (ms) */
    startupTimeMs: number;
    /** 内存使用 (MB) */
    memoryUsageMB: number;
    /** API响应延迟 (ms) */
    apiResponseTimeMs: number;
    /** 是否符合性能要求 */
    meetsRequirements: boolean;
  };
  
  /** 生成报告的时间 */
  generatedAt: Date;
  
  /** 报告版本 */
  version: string;
}

// ========== 插件事件类型 ==========

/**
 * 插件事件类型
 * 宪法依据: §101同步公理 - 统一的事件类型定义
 */
export enum PluginEventType {
  PLUGIN_LOADED = 'plugin:loaded',
  PLUGIN_UNLOADED = 'plugin:unloaded',
  PLUGIN_ERROR = 'plugin:error',
  PLUGIN_CONFIG_CHANGED = 'plugin:config_changed',
  PLUGIN_STATUS_CHANGED = 'plugin:status_changed',
  PLUGIN_PERFORMANCE_ALERT = 'plugin:performance_alert',
  PLUGIN_CONSTITUTION_VIOLATION = 'plugin:constitution_violation',
}

/**
 * 插件事件
 * 宪法依据: §101同步公理 - 统一的事件数据结构
 */
export interface PluginEvent {
  /** 事件类型 */
  type: PluginEventType;
  
  /** 插件ID */
  pluginId: string;
  
  /** 事件时间戳 */
  timestamp: Date;
  
  /** 事件数据 */
  data: Record<string, any>;
  
  /** 事件来源 */
  source: string;
}

// ========== 插件管理器配置 ==========

/**
 * 插件管理器配置
 * 宪法依据: §152单一真理源 - 统一的管理器配置
 */
export interface PluginManagerOptions {
  /** 插件目录路径 */
  pluginDirectory: string;
  
  /** 是否启用热加载 */
  hotReload: boolean;
  
  /** 热加载检查间隔 (ms) */
  hotReloadInterval: number;
  
  /** 是否启用宪法合规检查 */
  constitutionCheck: boolean;
  
  /** 是否启用性能监控 */
  performanceMonitoring: boolean;
  
  /** 性能监控间隔 (ms) */
  monitoringInterval: number;
  
  /** 最大插件数量限制 */
  maxPlugins: number;
  
  /** 插件隔离级别 */
  isolationLevel: 'none' | 'partial' | 'full';
  
  /** 错误处理策略 */
  errorHandling: 'strict' | 'lenient' | 'custom';
  
  /** 自定义错误处理器 */
  customErrorHandler?: (error: Error, pluginId: string) => Promise<void>;
  
  /** 日志级别 */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

// ========== API响应类型 ==========

/**
 * 插件API响应
 * 宪法依据: §110协作效率公理 - 标准化的API响应格式
 */
export interface PluginApiResponse<T = any> {
  /** 请求是否成功 */
  success: boolean;
  
  /** 响应数据 */
  data?: T;
  
  /** 错误信息 */
  error?: {
    /** 错误代码 */
    code: string;
    /** 错误消息 */
    message: string;
    /** 详细错误信息 */
    details?: any;
  };
  
  /** 元数据 */
  meta?: {
    /** 响应时间戳 */
    timestamp: Date;
    /** 请求处理时间 (ms) */
    processingTimeMs: number;
    /** 插件版本 */
    pluginVersion?: string;
  };
}

// ========== 插件接口定义 ==========

/**
 * 基础插件接口
 * 宪法依据: §152单一真理源 - 统一的插件接口定义
 */
export interface IPlugin {
  /** 获取插件清单 */
  getManifest(): PluginManifest;
  
  /** 初始化插件 */
  initialize(config?: Record<string, any>): Promise<void>;
  
  /** 启动插件 */
  start(): Promise<void>;
  
  /** 暂停插件 */
  pause(): Promise<void>;
  
  /** 恢复插件 */
  resume(): Promise<void>;
  
  /** 更新插件配置 */
  updateConfig(config: Record<string, any>): Promise<void>;
  
  /** 获取插件状态 */
  getStatus(): PluginStatus;
  
  /** 获取插件性能指标 */
  getMetrics(): Promise<Record<string, any>>;
  
  /** 执行宪法合规自查 */
  checkConstitutionCompliance(): Promise<ComplianceReport>;
  
  /** 清理资源 */
  cleanup(): Promise<void>;
}

/**
 * HTTP中间件插件接口
 * 宪法依据: §110协作效率公理 - 标准化的HTTP插件接口
 */
export interface IHttpPlugin extends IPlugin {
  /** 获取Express中间件 */
  getMiddleware(): any;
  
  /** 处理HTTP请求 */
  handleRequest?(req: any, res: any, next: any): Promise<void> | void;
}

/**
 * WebSocket中间件插件接口
 * 宪法依据: §110协作效率公理 - 标准化的WebSocket插件接口
 */
export interface IWebSocketPlugin extends IPlugin {
  /** 处理WebSocket连接 */
  handleConnection?(socket: any, request: any): Promise<void>;
  
  /** 处理WebSocket消息 */
  handleMessage?(socket: any, message: any): Promise<void>;
  
  /** 处理WebSocket关闭 */
  handleClose?(socket: any): Promise<void>;
}

/**
 * 事件处理器插件接口
 */
export interface IEventHandlerPlugin extends IPlugin {
  /** 订阅事件 */
  subscribe(eventType: string, handler: (event: any) => Promise<void>): void;
  
  /** 发布事件 */
  publish(eventType: string, data: any): Promise<void>;
  
  /** 取消订阅 */
  unsubscribe(eventType: string, handler: Function): void;
}

// ========== 工具类型 ==========

/**
 * 插件过滤器
 */
export type PluginFilter = (plugin: LoadedPlugin) => boolean;

/**
 * 插件排序函数
 */
export type PluginSorter = (a: LoadedPlugin, b: LoadedPlugin) => number;

/**
 * 插件搜索选项
 */
export interface PluginSearchOptions {
  /** 搜索关键词 */
  query?: string;
  /** 插件类型过滤 */
  types?: PluginType[];
  /** 宪法合规状态过滤 */
  constitutionCompliant?: boolean;
  /** 状态过滤 */
  status?: PluginStatus[];
  /** 分页参数 */
  pagination?: {
    page: number;
    pageSize: number;
  };
  /** 排序字段 */
  sortBy?: 'name' | 'loadedAt' | 'lastActiveAt' | 'status';
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}

/**
 * 类型定义验证函数
 * 宪法依据: §101同步公理 - 确保类型定义的有效性
 */
export function validatePluginManifest(manifest: any): manifest is PluginManifest {
  // 基本必填字段检查
  const requiredFields = ['id', 'name', 'version', 'type', 'description', 'author', 'license', 'entryPoint'];
  for (const field of requiredFields) {
    if (!manifest[field]) {
      return false;
    }
  }
  
  // 宪法合规字段检查
  if (!manifest.constitutionCompliance || typeof manifest.constitutionCompliance !== 'object') {
    return false;
  }
  
  // 必需的宪法合规字段 (使用修正后的字段名)
  const requiredComplianceFields = ['article101', 'article102', 'article108', 'article152', 'article306', 'article110'];
  for (const field of requiredComplianceFields) {
    if (typeof manifest.constitutionCompliance[field] !== 'boolean') {
      return false;
    }
  }
  
  // 类型枚举验证
  if (!Object.values(PluginType).includes(manifest.type)) {
    return false;
  }
  
  return true;
}

/**
 * 生成默认插件清单
 * 宪法依据: §102熵减原则 - 提供默认值，减少重复配置
 */
export function createDefaultPluginManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  const defaultManifest: PluginManifest = {
    id: 'plugin-' + Date.now(),
    name: '未命名插件',
    version: '1.0.0',
    type: PluginType.EVENT_HANDLER,
    description: '这是一个插件',
    author: '未知作者',
    license: 'MIT',
    constitutionCompliance: {
      article101: false,
      article102: false,
      article108: false,
      article152: false,
      article306: false,
      article110: false,
    },
    entryPoint: './index.js',
    ...overrides,
  };
  
  return defaultManifest;
}
