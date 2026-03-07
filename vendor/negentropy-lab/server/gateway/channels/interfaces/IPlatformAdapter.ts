/**
 * 🔌 平台适配器接口定义
 * 
 * 宪法依据：
 * - §101 同步公理：统一的适配器接口确保系统一致性
 * - §102 熵减原则：复用标准适配器模式，减少技术债务
 * - §107 通信安全：适配器必须确保通信安全
 * - §110 协作效率公理：适配器优化平台通信效率
 * - §306 零停机协议：适配器支持优雅降级和故障恢复
 * - §152 单一真理源：统一定义适配器契约
 * 
 * 设计原则：
 * 1. 接口隔离：最小化接口依赖，降低耦合度
 * 2. 开放封闭：支持新平台扩展而不修改现有代码
 * 3. 错误恢复：内置重试和降级机制
 * 4. 宪法合规：所有适配器必须通过宪法合规检查
 * 
 * @version 1.0.0 (Phase 1D Day 1)
 * @category Gateway/Channels/Interfaces
 */

import type {
  PlatformType,
  UnifiedMessage,
  OutgoingMessage,
  MessageResult,
  ChannelStatus
} from '../types/Message';

/**
 * 平台适配器配置接口
 * 宪法依据：§152单一真理源，统一定义配置结构
 */
export interface PlatformAdapterConfig {
  platform: PlatformType;               // 平台类型
  enabled: boolean;                     // 是否启用
  priority: number;                     // 适配器优先级（1-10）
  
  // 连接配置
  connection: {
    timeout: number;                    // 连接超时（毫秒）
    maxRetries: number;                 // 最大重试次数
    retryDelay: number;                 // 重试延迟（毫秒）
    keepAlive: boolean;                 // 是否保持连接
  };
  
  // 安全配置
  security: {
    encryptMessages: boolean;           // 是否加密消息
    validateSignatures: boolean;        // 是否验证签名
    requireAuthentication: boolean;     // 是否需要认证
    authToken?: string;                 // 认证令牌
    apiKey?: string;                    // API密钥
  };
  
  // 性能配置
  performance: {
    maxConcurrentRequests: number;      // 最大并发请求数
    requestTimeout: number;             // 请求超时时间（毫秒）
    batchSize: number;                  // 批量处理大小
    rateLimitRps: number;               // 速率限制（请求/秒）
  };
  
  // 监控配置
  monitoring: {
    enableMetrics: boolean;             // 是否启用指标收集
    enableLogging: boolean;             // 是否启用日志记录
    logLevel: 'debug' | 'info' | 'warn' | 'error'; // 日志级别
    alertThresholds: {
      errorRate: number;                // 错误率阈值（百分比）
      latency: number;                  // 延迟阈值（毫秒）
      downtime: number;                 // 停机时间阈值（秒）
    };
  };
  
  // 平台特定配置
  platformSpecific?: Record<string, any>;
}

/**
 * 平台适配器状态接口
 * 宪法依据：§110协作效率公理，实时监控适配器状态
 */
export interface PlatformAdapterState {
  platform: PlatformType;               // 平台类型
  status: 'initializing' | 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'error' | 'maintenance'; // 适配器状态
  lastActivity: number;                 // 最后活动时间戳
  connectionStartTime?: number;         // 连接开始时间
  
  // 性能指标
  metrics: {
    messagesSent: number;               // 已发送消息数
    messagesReceived: number;           // 已接收消息数
    totalErrors: number;                // 总错误数
    avgProcessingTimeMs: number;        // 平均处理时间（毫秒）
    successRate: number;                // 成功率（百分比）
    uptime: number;                     // 运行时间（秒）
  };
  
  // 当前连接信息
  connectionInfo?: {
    connectedAt: number;                // 连接建立时间
    lastPing: number;                   // 最后心跳时间
    latencyMs: number;                  // 当前延迟（毫秒）
    connectionId?: string;              // 连接ID
  };
  
  // 错误信息
  error?: {
    code: string;                       // 错误代码
    message: string;                    // 错误描述
    timestamp: number;                  // 错误发生时间
    recoveryAttempts: number;           // 恢复尝试次数
    lastAttemptAt?: number;             // 最后尝试恢复时间
  };
  
  // 宪法合规状态
  constitutionalCompliance: {
    lastCheck: number;                  // 最后检查时间
    score: number;                      // 合规评分（0-100）
    issues: string[];                   // 合规问题列表
    recommendations: string[];          // 改进建议
  };
}

/**
 * 消息转换选项
 * 宪法依据：§101同步公理，统一转换配置
 */
export interface MessageConversionOptions {
  preserveFormatting: boolean;          // 是否保留格式
  normalizeEmoji: boolean;              // 是否标准化表情符号
  convertAttachments: boolean;          // 是否转换附件格式
  maxTextLength?: number;               // 最大文本长度（平台特定）
  allowedMimeTypes?: string[];          // 允许的MIME类型
  
  // 平台特定转换规则
  platformRules?: {
    slack?: {
      convertMarkdown: boolean;         // 是否转换Markdown
      preserveThreads: boolean;         // 是否保留线程
      maxTextLength?: number;           // 最大文本长度
    };
    discord?: {
      convertEmbeds: boolean;           // 是否转换嵌入
      preserveComponents: boolean;      // 是否保留组件
    };
    telegram?: {
      parseMode: 'HTML' | 'Markdown';   // 解析模式
      disableWebPreview: boolean;       // 禁用网页预览
    };
  };
}

/**
 * 平台适配器核心接口
 * 宪法依据：§152单一真理源，统一定义适配器契约
 */
export interface IPlatformAdapter {
  // 身份标识
  readonly platform: PlatformType;      // 平台类型（只读）
  readonly name: string;                // 适配器名称
  readonly version: string;             // 适配器版本
  
  // 生命周期管理
  /**
   * 初始化适配器
   * 宪法依据：§306零停机协议，确保初始化不影响服务
   */
  initialize(config: PlatformAdapterConfig): Promise<void>;
  
  /**
   * 连接平台
   * 宪法依据：§110协作效率公理，优化连接过程
   */
  connect(): Promise<void>;
  
  /**
   * 断开连接
   * 宪法依据：§306零停机协议，优雅断开连接
   */
  disconnect(): Promise<void>;
  
  /**
   * 销毁适配器
   * 宪法依据：§102熵减原则，清理资源防止内存泄漏
   */
  destroy(): Promise<void>;
  
  // 消息处理
  /**
   * 标准化平台消息
   * 宪法依据：§101同步公理，统一消息格式
   */
  normalizeMessage(platformMessage: any): Promise<UnifiedMessage>;
  
  /**
   * 发送消息到平台
   * 宪法依据：§107通信安全，确保消息安全传输
   */
  sendMessage(message: OutgoingMessage, options?: MessageConversionOptions): Promise<MessageResult>;
  
  /**
   * 批量发送消息
   * 宪法依据：§110协作效率公理，批量处理提高效率
   */
  sendMessages(messages: OutgoingMessage[], options?: MessageConversionOptions): Promise<MessageResult[]>;
  
  /**
   * 接收平台消息（回调注册）
   * 宪法依据：§101同步公理，统一消息接收机制
   */
  onMessage(callback: (message: UnifiedMessage) => void): void;
  
  /**
   * 接收平台事件（回调注册）
   * 宪法依据：§110协作效率公理，高效事件处理
   */
  onEvent(callback: (eventType: string, data: any) => void): void;
  
  // 状态管理
  /**
   * 获取适配器状态
   * 宪法依据：§110协作效率公理，实时状态监控
   */
  getState(): PlatformAdapterState;
  
  /**
   * 获取通道状态
   * 宪法依据：§152单一真理源，统一通道状态管理
   */
  getChannelStatus(channelId: string): Promise<ChannelStatus>;
  
  /**
   * 列出所有通道
   * 宪法依据：§101同步公理，统一通道列表格式
   */
  listChannels(): Promise<Array<{
    id: string;                         // 通道ID
    name: string;                       // 通道名称
    type: string;                       // 通道类型
    memberCount?: number;               // 成员数量
    description?: string;               // 描述
    isPrivate?: boolean;                // 是否私有通道
  }>>;
  
  // 错误处理
  /**
   * 获取错误历史
   * 宪法依据：§102熵减原则，记录错误便于分析
   */
  getErrorHistory(limit?: number): Promise<Array<{
    timestamp: number;                  // 错误时间戳
    code: string;                       // 错误代码
    message: string;                    // 错误描述
    context?: any;                      // 错误上下文
    resolved: boolean;                  // 是否已解决
  }>>;
  
  /**
   * 清理错误历史
   * 宪法依据：§102熵减原则，定期清理历史数据
   */
  clearErrorHistory(): Promise<void>;
  
  // 宪法合规
  /**
   * 执行宪法合规检查
   * 宪法依据：§107通信安全、§101同步公理、§110协作效率公理
   */
  performConstitutionalCheck(): {
    timestamp: number;                  // 检查时间戳
    checks: Array<{
      clause: string;                   // 宪法条文
      description: string;              // 检查描述
      passed: boolean;                  // 是否通过
      details?: any;                    // 检查详情
    }>;
    overallScore: number;               // 总体评分（0-100）
    recommendations: string[];          // 改进建议
  };
  
  /**
   * 应用宪法合规修复
   * 宪法依据：§102熵减原则，主动修复合规问题
   */
  applyConstitutionalFixes(fixes: string[]): Promise<{
    applied: string[];                  // 已应用的修复
    failed: Array<{ fix: string; reason: string }>; // 失败的修复
  }>;
  
  // 性能优化
  /**
   * 优化适配器性能
   * 宪法依据：§110协作效率公理，持续性能优化
   */
  optimizePerformance(): Promise<{
    improvements: string[];             // 优化项
    beforeMetrics: Record<string, any>; // 优化前指标
    afterMetrics: Record<string, any>;  // 优化后指标
  }>;
  
  /**
   * 重置性能指标
   * 宪法依据：§102熵减原则，定期重置指标数据
   */
  resetMetrics(): Promise<void>;
  
  // 扩展功能
  /**
   * 执行平台特定操作
   * 宪法依据：§152单一真理源，统一扩展接口
   */
  executePlatformSpecific(operation: string, params?: any): Promise<any>;
  
  /**
   * 验证平台特定配置
   * 宪法依据：§101同步公理，统一配置验证
   */
  validatePlatformSpecificConfig(config: any): Promise<{
    valid: boolean;                     // 是否有效
    errors: string[];                   // 错误列表
    warnings: string[];                 // 警告列表
  }>;
}

/**
 * 平台适配器工厂接口
 * 宪法依据：§102熵减原则，工厂模式减少重复代码
 */
export interface IPlatformAdapterFactory {
  /**
   * 创建平台适配器实例
   * 宪法依据：§101同步公理，统一实例创建接口
   */
  createAdapter(platform: PlatformType, config: PlatformAdapterConfig): Promise<IPlatformAdapter>;
  
  /**
   * 获取支持的平台列表
   * 宪法依据：§152单一真理源，统一平台注册
   */
  getSupportedPlatforms(): PlatformType[];
  
  /**
   * 验证平台配置
   * 宪法依据：§107通信安全，配置安全验证
   */
  validateConfig(platform: PlatformType, config: PlatformAdapterConfig): Promise<{
    valid: boolean;                     // 是否有效
    errors: string[];                   // 错误列表
    warnings: string[];                 // 警告列表
  }>;
  
  /**
   * 注册新平台适配器
   * 宪法依据：§102熵减原则，支持扩展
   */
  registerAdapter(
    platform: PlatformType,
    adapterClass: new (config: PlatformAdapterConfig) => IPlatformAdapter
  ): void;
  
  /**
   * 卸载平台适配器
   * 宪法依据：§306零停机协议，优雅卸载
   */
  unregisterAdapter(platform: PlatformType): Promise<void>;
}

/**
 * 创建默认平台适配器配置
 * 宪法依据：§102熵减原则，复用标准配置
 */
export function createDefaultAdapterConfig(platform: PlatformType): PlatformAdapterConfig {
  const baseConfig: Omit<PlatformAdapterConfig, 'platform'> = {
    enabled: true,
    priority: 5,
    
    connection: {
      timeout: 30000,          // 30秒超时
      maxRetries: 3,
      retryDelay: 1000,        // 1秒重试延迟
      keepAlive: true
    },
    
    security: {
      encryptMessages: true,
      validateSignatures: true,
      requireAuthentication: true,
      authToken: undefined,
      apiKey: undefined
    },
    
    performance: {
      maxConcurrentRequests: 10,
      requestTimeout: 10000,   // 10秒请求超时
      batchSize: 10,
      rateLimitRps: 5          // 5请求/秒
    },
    
    monitoring: {
      enableMetrics: true,
      enableLogging: true,
      logLevel: 'info',
      alertThresholds: {
        errorRate: 5,          // 5%错误率阈值
        latency: 5000,         // 5秒延迟阈值
        downtime: 60           // 60秒停机阈值
      }
    },
    
    platformSpecific: {}
  };
  
  return {
    platform,
    ...baseConfig
  };
}

/**
 * 验证平台适配器配置合规性
 * 宪法依据：§107通信安全、§110协作效率公理
 */
export function validateAdapterConfig(config: PlatformAdapterConfig): {
  valid: boolean;
  violations: string[];
  warnings: string[];
} {
  const violations: string[] = [];
  const warnings: string[] = [];
  
  // §107 通信安全检查
  if (config.security.requireAuthentication && !config.security.authToken && !config.security.apiKey) {
    violations.push('§107: 需要认证但未提供认证令牌或API密钥');
  }
  
  if (!config.security.encryptMessages) {
    warnings.push('§107: 建议启用消息加密以增强通信安全');
  }
  
  // §110 协作效率检查
  if (config.performance.rateLimitRps > 50) {
    warnings.push('§110: 高请求频率可能影响平台协作效率');
  }
  
  if (config.connection.timeout < 1000) {
    violations.push('§110: 连接超时时间过短可能影响协作效率');
  }
  
  // §306 零停机协议检查
  if (config.connection.maxRetries < 1) {
    violations.push('§306: 最大重试次数必须至少为1以确保故障恢复');
  }
  
  if (config.monitoring.alertThresholds.downtime > 300) {
    warnings.push('§306: 停机时间阈值过高，建议设为300秒以下');
  }
  
  // §101 同步公理检查
  if (!config.platform) {
    violations.push('§101: 必须指定平台类型');
  }
  
  // §102 熵减原则检查
  if (config.priority < 1 || config.priority > 10) {
    violations.push('§102: 适配器优先级必须在1-10范围内');
  }
  
  const valid = violations.length === 0;
  
  return {
    valid,
    violations,
    warnings
  };
}

/**
 * 生成平台适配器宪法合规报告
 * 宪法依据：§101同步公理，提供详细合规报告
 */
export function generateAdapterConstitutionalReport(config: PlatformAdapterConfig, state?: PlatformAdapterState): {
  timestamp: number;
  configValidation: ReturnType<typeof validateAdapterConfig>;
  stateCompliance?: {
    score: number;
    issues: string[];
  };
  overallStatus: 'compliant' | 'partial' | 'non-compliant';
  recommendations: string[];
} {
  const configValidation = validateAdapterConfig(config);
  
  let overallStatus: 'compliant' | 'partial' | 'non-compliant' = 'compliant';
  const recommendations: string[] = [];
  
  if (!configValidation.valid) {
    overallStatus = 'non-compliant';
    recommendations.push('立即修正配置违规项');
  } else if (configValidation.warnings.length > 0) {
    overallStatus = 'partial';
    recommendations.push('考虑修正配置警告项以提升合规性');
  }
  
  if (state) {
    if (state.constitutionalCompliance.score < 80) {
      overallStatus = 'non-compliant';
      recommendations.push(`适配器状态合规评分较低（${state.constitutionalCompliance.score}），需要改进`);
    } else if (state.constitutionalCompliance.score < 90) {
      overallStatus = overallStatus === 'compliant' ? 'partial' : overallStatus;
      recommendations.push(`适配器状态合规评分中等（${state.constitutionalCompliance.score}），建议优化`);
    }
    
    if (state.status === 'error' || state.status === 'disconnected') {
      overallStatus = 'non-compliant';
      recommendations.push(`适配器状态异常（${state.status}），需要立即处理`);
    }
  }
  
  // 通用建议
  if (config.security.encryptMessages === false) {
    recommendations.push('建议启用消息加密（§107通信安全）');
  }
  
  if (config.connection.maxRetries < 3) {
    recommendations.push('建议增加最大重试次数至3或更高（§306零停机协议）');
  }
  
  return {
    timestamp: Date.now(),
    configValidation,
    stateCompliance: state ? {
      score: state.constitutionalCompliance.score,
      issues: state.constitutionalCompliance.issues
    } : undefined,
    overallStatus,
    recommendations
  };
}

