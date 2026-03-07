/**
 * 🚀 通道管理器核心类
 * 
 * 宪法依据：
 * - §101 同步公理：统一通道管理接口确保系统一致性
 * - §102 熵减原则：复用适配器模式，减少技术债务
 * - §107 通信安全：管理器确保所有通道通信安全
 * - §110 协作效率公理：优化通道调度和资源分配
 * - §306 零停机协议：通道故障自动恢复和优雅降级
 * - §152 单一真理源：统一定义通道管理契约
 * 
 * 设计原则：
 * 1. 抽象工厂模式：统一创建和管理平台适配器
 * 2. 依赖注入：支持灵活的适配器配置和替换
 * 3. 健康检查：实时监控所有通道状态
 * 4. 宪法合规：所有通道操作必须通过宪法合规检查
 * 
 * @version 1.0.0 (Phase 1D Day 1)
 * @category Gateway/Channels/Core
 */

import type {
  PlatformType,
  UnifiedMessage,
  OutgoingMessage,
  MessageResult,
  ChannelStatus,
  MessageAttachment
} from '../types/Message';

import type {
  PlatformAdapterConfig,
  PlatformAdapterState,
  IPlatformAdapter,
  IPlatformAdapterFactory,
  MessageConversionOptions
} from '../interfaces/IPlatformAdapter';

import { generateAdapterConstitutionalReport } from '../interfaces/IPlatformAdapter';

/**
 * 通道管理器配置接口
 * 宪法依据：§152单一真理源，统一定义管理器配置
 */
export interface ChannelManagerConfig {
  // 管理器标识
  managerId: string;                     // 管理器ID
  name: string;                         // 管理器名称
  version: string;                      // 管理器版本
  
  // 通道配置
  channels: {
    defaultPriority: number;            // 默认通道优先级
    maxConcurrentChannels: number;      // 最大并发通道数
    enableLoadBalancing: boolean;       // 是否启用负载均衡
    healthCheckInterval: number;        // 健康检查间隔（毫秒）
  };
  
  // 消息处理配置
  messaging: {
    enableBatching: boolean;            // 是否启用批量处理
    maxBatchSize: number;               // 最大批量大小
    batchTimeout: number;               // 批量超时时间（毫秒）
    enableRetry: boolean;               // 是否启用重试
    maxRetries: number;                 // 最大重试次数
    retryDelay: number;                 // 重试延迟（毫秒）
  };
  
  // 监控配置
  monitoring: {
    enableMetrics: boolean;             // 是否启用指标收集
    enableAlerts: boolean;              // 是否启用告警
    enableLogging: boolean;             // 是否启用日志记录
    alertThresholds: {
      errorRate: number;                // 错误率阈值（百分比）
      latency: number;                  // 延迟阈值（毫秒）
      channelDowntime: number;          // 通道停机时间阈值（秒）
    };
    logLevel: 'debug' | 'info' | 'warn' | 'error'; // 日志级别
  };
  
  // 宪法合规配置
  constitutionalCompliance: {
    enableAutoChecks: boolean;          // 是否启用自动合规检查
    checkInterval: number;              // 检查间隔（毫秒）
    minComplianceScore: number;         // 最低合规评分（0-100）
    autoFixThreshold: number;           // 自动修复阈值（百分比）
  };
}

/**
 * 通道状态接口
 * 宪法依据：§110协作效率公理，实时监控通道状态
 */
export interface ManagedChannel {
  platform: PlatformType;               // 平台类型
  channelId: string;                    // 通道ID
  adapter: IPlatformAdapter;            // 平台适配器实例
  config: PlatformAdapterConfig;        // 适配器配置
  status: 'initializing' | 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'error' | 'maintenance'; // 通道状态
  lastActivity: number;                 // 最后活动时间
  createdAt: number;                    // 创建时间
  metrics: {
    messagesSent: number;               // 已发送消息数
    messagesReceived: number;           // 已接收消息数
    totalErrors: number;                // 总错误数
    avgProcessingTimeMs: number;        // 平均处理时间（毫秒）
    uptime: number;                     // 运行时间（秒）
  };
  constitutionalCompliance: {
    lastCheck: number;                  // 最后检查时间
    score: number;                      // 合规评分（0-100）
    issues: string[];                   // 合规问题列表
    recommendations: string[];          // 改进建议
  };
}

/**
 * 消息路由规则
 * 宪法依据：§101同步公理，统一定义路由规则
 */
export interface MessageRoutingRule {
  id: string;                           // 规则ID
  name: string;                         // 规则名称
  priority: number;                     // 规则优先级（1-10）
  conditions: {
    sourcePlatform?: PlatformType;      // 源平台
    targetPlatform?: PlatformType;      // 目标平台
    channelId?: string;                 // 通道ID
    messageType?: string;               // 消息类型
    contentPattern?: RegExp;            // 内容模式
  };
  actions: {
    targetChannelId: string;            // 目标通道ID
    conversionOptions?: MessageConversionOptions; // 转换选项
    fallbackChannelId?: string;         // 备用通道ID
    retryConfig?: {
      maxRetries: number;               // 最大重试次数
      retryDelay: number;               // 重试延迟（毫秒）
    };
  };
  enabled: boolean;                     // 是否启用
}

/**
 * 通道管理器核心类
 * 宪法依据：§152单一真理源，统一通道管理实现
 */
export class ChannelManager {
  // 管理器配置
  private config: ChannelManagerConfig;
  
  // 通道注册表
  private channels = new Map<string, ManagedChannel>();
  
  // 平台适配器工厂
  private adapterFactory: IPlatformAdapterFactory;
  
  // 消息路由规则
  private routingRules: MessageRoutingRule[] = [];
  
  // 性能指标
  private metrics: {
    totalMessagesSent: number;
    totalMessagesReceived: number;
    totalRoutingDecisions: number;
    totalErrors: number;
    startTime: number;
  } = {
    totalMessagesSent: 0,
    totalMessagesReceived: 0,
    totalRoutingDecisions: 0,
    totalErrors: 0,
    startTime: Date.now()
  };
  
  // 健康检查定时器
  private healthCheckTimer?: NodeJS.Timeout;
  
  // 宪法合规检查定时器
  private constitutionalCheckTimer?: NodeJS.Timeout;
  
  // 事件监听器
  private eventListeners = new Map<string, Array<(data: any) => void>>();
  
  /**
   * 构造函数
   * 宪法依据：§101同步公理，统一管理器初始化
   */
  constructor(config: ChannelManagerConfig, adapterFactory: IPlatformAdapterFactory) {
    this.config = config;
    this.adapterFactory = adapterFactory;
    
    // 验证配置
    this.validateConfig();
    
    // 初始化事件系统
    this.initEventSystem();
    
    // 记录启动日志
    this.logInfo(`通道管理器初始化: ${config.name} v${config.version}`);
  }
  
  /**
   * 初始化管理器
   * 宪法依据：§306零停机协议，分阶段初始化
   */
  async initialize(): Promise<void> {
    try {
      this.logInfo('开始初始化通道管理器');
      
      // 启动健康检查
      this.startHealthChecks();
      
      // 启动宪法合规检查（如果启用）
      if (this.config.constitutionalCompliance.enableAutoChecks) {
        this.startConstitutionalChecks();
      }
      
      this.logInfo('通道管理器初始化成功');
      
      // 触发初始化完成事件
      this.emitEvent('manager_initialized', {
        managerId: this.config.managerId,
        timestamp: Date.now(),
        config: this.config
      });
      
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`通道管理器初始化失败: ${errorMessage}`);
      throw new Error(`通道管理器初始化失败: ${errorMessage}`);
    }
  }
  
  /**
   * 销毁管理器
   * 宪法依据：§102熵减原则，清理所有资源
   */
  async destroy(): Promise<void> {
    try {
      this.logInfo('开始销毁通道管理器');
      
      // 停止定时器
      this.stopHealthChecks();
      this.stopConstitutionalChecks();
      
      // 断开所有通道连接
      await this.disconnectAllChannels();
      
      // 销毁所有适配器
      await this.destroyAllAdapters();
      
      // 清理事件监听器
      this.eventListeners.clear();
      
      this.logInfo('通道管理器销毁成功');
      
      // 触发销毁事件
      this.emitEvent('manager_destroyed', {
        managerId: this.config.managerId,
        timestamp: Date.now()
      });
      
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`通道管理器销毁失败: ${errorMessage}`);
      throw new Error(`通道管理器销毁失败: ${errorMessage}`);
    }
  }
  
  /**
   * 注册通道
   * 宪法依据：§152单一真理源，统一通道注册接口
   */
  async registerChannel(
    platform: PlatformType,
    channelId: string,
    adapterConfig: PlatformAdapterConfig
  ): Promise<ManagedChannel> {
    try {
      this.logInfo(`开始注册通道: ${platform}/${channelId}`);
      
      // 检查通道是否已存在
      if (this.channels.has(channelId)) {
        throw new Error(`通道已存在: ${channelId}`);
      }
      
      // 检查并发通道数限制
      if (this.channels.size >= this.config.channels.maxConcurrentChannels) {
        throw new Error(`超过最大并发通道数限制: ${this.config.channels.maxConcurrentChannels}`);
      }
      
      // 验证适配器配置
      const configValidation = await this.adapterFactory.validateConfig(platform, adapterConfig);
      if (!configValidation.valid) {
        throw new Error(`适配器配置验证失败: ${configValidation.errors.join(', ')}`);
      }
      
      // 创建适配器实例
      const adapter = await this.adapterFactory.createAdapter(platform, adapterConfig);
      
      // 初始化适配器
      await adapter.initialize(adapterConfig);
      
      // 创建托管通道对象
      const now = Date.now();
      const managedChannel: ManagedChannel = {
        platform,
        channelId,
        adapter,
        config: adapterConfig,
        status: 'disconnected',
        lastActivity: now,
        createdAt: now,
        metrics: {
          messagesSent: 0,
          messagesReceived: 0,
          totalErrors: 0,
          avgProcessingTimeMs: 0,
          uptime: 0
        },
        constitutionalCompliance: {
          lastCheck: now,
          score: 100,
          issues: [],
          recommendations: []
        }
      };
      
      // 注册通道
      this.channels.set(channelId, managedChannel);
      
      // 注册消息处理器
      adapter.onMessage((message: UnifiedMessage) => {
        this.handleIncomingMessage(channelId, message);
      });
      
      // 注册事件处理器
      adapter.onEvent((eventType: string, data: any) => {
        this.handleAdapterEvent(channelId, eventType, data);
      });
      
      this.logInfo(`通道注册成功: ${platform}/${channelId}`);
      
      // 触发通道注册事件
      this.emitEvent('channel_registered', {
        channelId,
        platform,
        timestamp: now,
        adapterConfig
      });
      
      return managedChannel;
      
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`通道注册失败: ${platform}/${channelId} - ${errorMessage}`);
      throw new Error(`通道注册失败: ${platform}/${channelId} - ${errorMessage}`);
    }
  }
  
  /**
   * 注销通道
   * 宪法依据：§102熵减原则，清理通道资源
   */
  async unregisterChannel(channelId: string): Promise<void> {
    try {
      this.logInfo(`开始注销通道: ${channelId}`);
      
      // 检查通道是否存在
      const channel = this.channels.get(channelId);
      if (!channel) {
        throw new Error(`通道不存在: ${channelId}`);
      }
      
      // 断开连接
      if (channel.status === 'connected' || channel.status === 'connecting') {
        await channel.adapter.disconnect();
      }
      
      // 销毁适配器
      await channel.adapter.destroy();
      
      // 从注册表中移除
      this.channels.delete(channelId);
      
      this.logInfo(`通道注销成功: ${channelId}`);
      
      // 触发通道注销事件
      this.emitEvent('channel_unregistered', {
        channelId,
        platform: channel.platform,
        timestamp: Date.now()
      });
      
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`通道注销失败: ${channelId} - ${errorMessage}`);
      throw new Error(`通道注销失败: ${channelId} - ${errorMessage}`);
    }
  }
  
  /**
   * 连接通道
   * 宪法依据：§110协作效率公理，优化连接过程
   */
  async connectChannel(channelId: string): Promise<void> {
    try {
      this.logInfo(`开始连接通道: ${channelId}`);
      
      // 检查通道是否存在
      const channel = this.channels.get(channelId);
      if (!channel) {
        throw new Error(`通道不存在: ${channelId}`);
      }
      
      // 检查通道状态
      if (channel.status === 'connected') {
        this.logInfo(`通道已连接: ${channelId}`);
        return;
      }
      
      if (channel.status === 'connecting') {
        throw new Error(`通道正在连接中: ${channelId}`);
      }
      
      // 更新通道状态
      channel.status = 'connecting';
      
      // 连接适配器
      await channel.adapter.connect();
      
      // 更新通道状态
      channel.status = 'connected';
      channel.lastActivity = Date.now();
      
      this.logInfo(`通道连接成功: ${channelId}`);
      
      // 触发通道连接事件
      this.emitEvent('channel_connected', {
        channelId,
        platform: channel.platform,
        timestamp: Date.now()
      });
      
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`通道连接失败: ${channelId} - ${errorMessage}`);
      
      // 更新通道状态
      const channel = this.channels.get(channelId);
      if (channel) {
        channel.status = 'error';
      }
      
      throw new Error(`通道连接失败: ${channelId} - ${errorMessage}`);
    }
  }
  
  /**
   * 断开通道连接
   * 宪法依据：§306零停机协议，优雅断开连接
   */
  async disconnectChannel(channelId: string): Promise<void> {
    try {
      this.logInfo(`开始断开通道连接: ${channelId}`);
      
      // 检查通道是否存在
      const channel = this.channels.get(channelId);
      if (!channel) {
        throw new Error(`通道不存在: ${channelId}`);
      }
      
      // 检查通道状态
      if (channel.status === 'disconnected') {
        this.logInfo(`通道已断开连接: ${channelId}`);
        return;
      }
      
      if (channel.status === 'disconnecting') {
        throw new Error(`通道正在断开连接中: ${channelId}`);
      }
      
      // 更新通道状态
      channel.status = 'disconnecting';
      
      // 断开适配器连接
      await channel.adapter.disconnect();
      
      // 更新通道状态
      channel.status = 'disconnected';
      channel.lastActivity = Date.now();
      
      this.logInfo(`通道断开连接成功: ${channelId}`);
      
      // 触发通道断开连接事件
      this.emitEvent('channel_disconnected', {
        channelId,
        platform: channel.platform,
        timestamp: Date.now()
      });
      
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`通道断开连接失败: ${channelId} - ${errorMessage}`);
      
      // 强制更新通道状态
      const channel = this.channels.get(channelId);
      if (channel) {
        channel.status = 'disconnected';
      }
      
      throw new Error(`通道断开连接失败: ${channelId} - ${errorMessage}`);
    }
  }
  
  /**
   * 发送消息
   * 宪法依据：§107通信安全，确保消息安全传输
   */
  async sendMessage(
    message: OutgoingMessage,
    options?: MessageConversionOptions
  ): Promise<MessageResult> {
    const startTime = Date.now();
    
    try {
      this.logDebug(`开始发送消息: ${message.id}`);
      
      // 验证消息
      this.validateOutgoingMessage(message);
      
      // 查找目标通道
      const targetChannel = await this.resolveTargetChannel(message, options);
      if (!targetChannel) {
        throw new Error(`无法找到目标通道: ${message.channelId || '未指定'}`);
      }
      
      // 检查通道状态
      if (targetChannel.status !== 'connected') {
        throw new Error(`目标通道未连接: ${targetChannel.channelId} (状态: ${targetChannel.status})`);
      }
      
      // 发送消息
      const result = await targetChannel.adapter.sendMessage(message, options);
      
      // 更新指标
      this.updateMetricsForMessage(targetChannel, result, Date.now() - startTime);
      
      this.logInfo(`消息发送成功: ${message.id} -> ${targetChannel.channelId} (${Date.now() - startTime}ms)`);
      
      // 触发消息发送事件
      this.emitEvent('message_sent', {
        messageId: message.id,
        channelId: targetChannel.channelId,
        platform: targetChannel.platform,
        result,
        timestamp: Date.now()
      });
      
      return result;
      
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`消息发送失败: ${message.id} - ${errorMessage}`);
      
      // 更新错误指标
      this.metrics.totalErrors++;
      
      // 返回错误结果
      const result: MessageResult = {
        success: false,
        messageId: message.id,
        status: 'failed',
        timestamp: Date.now(),
        error: {
          code: 'CHANNEL_MANAGER_SEND_FAILED',
          message: errorMessage,
          details: error,
          retryable: this.isErrorRetryable(error)
        },
        metrics: {
          processingTimeMs: Date.now() - startTime,
          totalTimeMs: Date.now() - startTime
        },
        compliance: {
          checked: true,
          violations: ['§107: 通道管理器消息发送失败'],
          complianceScore: 0
        }
      };
      
      // 触发消息发送失败事件
      this.emitEvent('message_send_failed', {
        messageId: message.id,
        error: errorMessage,
        result,
        timestamp: Date.now()
      });
      
      return result;
    }
  }
  
  /**
   * 批量发送消息
   * 宪法依据：§110协作效率公理，批量处理提高效率
   */
  async sendMessages(
    messages: OutgoingMessage[],
    options?: MessageConversionOptions
  ): Promise<MessageResult[]> {
    const startTime = Date.now();
    
    try {
      this.logInfo(`开始批量发送消息: ${messages.length}条`);
      
      if (messages.length === 0) {
        return [];
      }
      
      // 检查批量大小限制
      const maxBatchSize = this.config.messaging.maxBatchSize;
      if (messages.length > maxBatchSize) {
        this.logWarn(`批量消息数量(${messages.length})超过限制(${maxBatchSize})，将分批处理`);
        
        // 分批处理
        const batches: OutgoingMessage[][] = [];
        for (let i = 0; i < messages.length; i += maxBatchSize) {
          batches.push(messages.slice(i, i + maxBatchSize));
        }
        
        // 并行处理批次
        const results: MessageResult[] = [];
        for (const batch of batches) {
          const batchResults = await this.processMessageBatch(batch, options);
          results.push(...batchResults);
        }
        
        return results;
      }
      
      // 直接批量处理
      return await this.processMessageBatch(messages, options);
      
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`批量消息发送失败: ${messages.length}条消息 - ${errorMessage}`);
      
      // 为每个消息返回错误结果
      return messages.map(message => ({
        success: false,
        messageId: message.id,
        status: 'failed',
        timestamp: Date.now(),
        error: {
          code: 'BATCH_SEND_FAILED',
          message: errorMessage,
          details: error,
          retryable: this.isErrorRetryable(error)
        },
        metrics: {
          processingTimeMs: Date.now() - startTime,
          totalTimeMs: Date.now() - startTime
        },
        compliance: {
          checked: true,
          violations: ['§107: 批量消息发送失败'],
          complianceScore: 0
        }
      }));
    }
  }
  
  /**
   * 获取通道状态
   * 宪法依据：§110协作效率公理，实时状态监控
   */
  async getChannelStatus(channelId: string): Promise<ChannelStatus> {
    try {
      this.logDebug(`获取通道状态: ${channelId}`);
      
      // 检查通道是否存在
      const channel = this.channels.get(channelId);
      if (!channel) {
        throw new Error(`通道不存在: ${channelId}`);
      }
      
      // 获取适配器状态
      const status = await channel.adapter.getChannelStatus(channelId);
      
      // 更新通道最后活动时间
      channel.lastActivity = Date.now();
      
      return status;
      
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`获取通道状态失败: ${channelId} - ${errorMessage}`);
      throw new Error(`获取通道状态失败: ${channelId} - ${errorMessage}`);
    }
  }
  
  /**
   * 列出所有通道
   * 宪法依据：§101同步公理，统一通道列表格式
   */
  listChannels(): Array<{
    channelId: string;
    platform: PlatformType;
    status: string;
    lastActivity: number;
    metrics: {
      messagesSent: number;
      messagesReceived: number;
      totalErrors: number;
      avgProcessingTimeMs: number;
      uptime: number;
    };
    constitutionalCompliance: {
      score: number;
      lastCheck: number;
    };
  }> {
    const channels: Array<{
      channelId: string;
      platform: PlatformType;
      status: string;
      lastActivity: number;
      metrics: {
        messagesSent: number;
        messagesReceived: number;
        totalErrors: number;
        avgProcessingTimeMs: number;
        uptime: number;
      };
      constitutionalCompliance: {
        score: number;
        lastCheck: number;
      };
    }> = [];
    
    for (const [channelId, channel] of this.channels.entries()) {
      channels.push({
        channelId,
        platform: channel.platform,
        status: channel.status,
        lastActivity: channel.lastActivity,
        metrics: { ...channel.metrics },
        constitutionalCompliance: {
          score: channel.constitutionalCompliance.score,
          lastCheck: channel.constitutionalCompliance.lastCheck
        }
      });
    }
    
    return channels;
  }
  
  /**
   * 添加消息路由规则
   * 宪法依据：§101同步公理，统一路由规则定义
   */
  addRoutingRule(rule: MessageRoutingRule): void {
    try {
      this.logInfo(`添加消息路由规则: ${rule.name} (${rule.id})`);
      
      // 验证规则
      this.validateRoutingRule(rule);
      
      // 添加规则
      this.routingRules.push(rule);
      
      // 按优先级排序
      this.routingRules.sort((a, b) => b.priority - a.priority);
      
      this.logInfo(`消息路由规则添加成功: ${rule.name} (优先级: ${rule.priority})`);
      
      // 触发规则添加事件
      this.emitEvent('routing_rule_added', {
        ruleId: rule.id,
        ruleName: rule.name,
        priority: rule.priority,
        timestamp: Date.now()
      });
      
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`消息路由规则添加失败: ${rule.name} - ${errorMessage}`);
      throw new Error(`消息路由规则添加失败: ${rule.name} - ${errorMessage}`);
    }
  }
  
  /**
   * 删除消息路由规则
   * 宪法依据：§102熵减原则，清理不再需要的规则
   */
  removeRoutingRule(ruleId: string): boolean {
    const initialLength = this.routingRules.length;
    this.routingRules = this.routingRules.filter(rule => rule.id !== ruleId);
    const removed = this.routingRules.length < initialLength;
    
    if (removed) {
      this.logInfo(`消息路由规则删除成功: ${ruleId}`);
      
      // 触发规则删除事件
      this.emitEvent('routing_rule_removed', {
        ruleId,
        timestamp: Date.now()
      });
    } else {
      this.logWarn(`消息路由规则未找到: ${ruleId}`);
    }
    
    return removed;
  }
  
  /**
   * 执行宪法合规检查
   * 宪法依据：§107通信安全、§101同步公理、§110协作效率公理
   */
  performConstitutionalCheck(): {
    timestamp: number;
    managerCheck: {
      clause: string;
      description: string;
      passed: boolean;
      details?: any;
    }[];
    channelChecks: Array<{
      channelId: string;
      platform: PlatformType;
      checks: Array<{
        clause: string;
        description: string;
        passed: boolean;
        details?: any;
      }>;
      overallScore: number;
    }>;
    overallScore: number;
    recommendations: string[];
  } {
    const now = Date.now();
    const managerChecks: Array<{
      clause: string;
      description: string;
      passed: boolean;
      details?: any;
    }> = [];
    const channelChecks: Array<{
      channelId: string;
      platform: PlatformType;
      checks: Array<{
        clause: string;
        description: string;
        passed: boolean;
        details?: any;
      }>;
      overallScore: number;
    }> = [];
    
    let passedManagerChecks = 0;
    
    // §101 同步公理检查
    const syncCheck = this.checkSynchronizationAxiom();
    managerChecks.push(syncCheck);
    if (syncCheck.passed) passedManagerChecks++;
    
    // §102 熵减原则检查
    const entropyCheck = this.checkEntropyReductionAxiom();
    managerChecks.push(entropyCheck);
    if (entropyCheck.passed) passedManagerChecks++;
    
    // §107 通信安全检查
    const securityCheck = this.checkCommunicationSecurityAxiom();
    managerChecks.push(securityCheck);
    if (securityCheck.passed) passedManagerChecks++;
    
    // §110 协作效率公理检查
    const efficiencyCheck = this.checkCollaborationEfficiencyAxiom();
    managerChecks.push(efficiencyCheck);
    if (efficiencyCheck.passed) passedManagerChecks++;
    
    // §306 零停机协议检查
    const zeroDowntimeCheck = this.checkZeroDowntimeProtocolAxiom();
    managerChecks.push(zeroDowntimeCheck);
    if (zeroDowntimeCheck.passed) passedManagerChecks++;
    
    // §152 单一真理源检查
    const singleSourceCheck = this.checkSingleSourceOfTruthAxiom();
    managerChecks.push(singleSourceCheck);
    if (singleSourceCheck.passed) passedManagerChecks++;
    
    // 计算管理器总体评分
    const managerOverallScore = Math.round((passedManagerChecks / managerChecks.length) * 100);
    
    // 检查所有通道
    let totalChannelScore = 0;
    let channelCount = 0;
    
    for (const [channelId, channel] of this.channels.entries()) {
      try {
        const channelReport = generateAdapterConstitutionalReport(channel.config, channel.adapter.getState());
        
        const checks: Array<{
          clause: string;
          description: string;
          passed: boolean;
          details?: any;
        }> = [];
        
        // 转换通道报告为检查格式
        if (channelReport.configValidation) {
          checks.push({
            clause: '§107',
            description: '适配器配置安全验证',
            passed: channelReport.configValidation.valid,
            details: channelReport.configValidation
          });
        }
        
        if (channelReport.stateCompliance) {
          checks.push({
            clause: '§110',
            description: '适配器状态合规',
            passed: channelReport.stateCompliance.score >= 80,
            details: channelReport.stateCompliance
          });
        }
        
        const channelOverallScore = channelReport.overallStatus === 'compliant' ? 100 :
                                  channelReport.overallStatus === 'partial' ? 70 : 30;
        
        channelChecks.push({
          channelId,
          platform: channel.platform,
          checks,
          overallScore: channelOverallScore
        });
        
        totalChannelScore += channelOverallScore;
        channelCount++;
        
        // 更新通道的宪法合规状态
        channel.constitutionalCompliance = {
          lastCheck: now,
          score: channelOverallScore,
          issues: channelReport.stateCompliance?.issues || [],
          recommendations: channelReport.recommendations
        };
        
      } catch (error: any) {
        this.logWarn(`通道宪法合规检查失败: ${channelId} - ${error.message}`);
      }
    }
    
    // 计算总体评分（加权平均：管理器40%，通道60%）
    const averageChannelScore = channelCount > 0 ? totalChannelScore / channelCount : 100;
    const overallScore = Math.round((managerOverallScore * 0.4) + (averageChannelScore * 0.6));
    
    // 生成建议
    const recommendations = this.generateConstitutionalRecommendations(managerChecks, channelChecks);
    
    this.logInfo(`宪法合规检查完成: 总体评分 ${overallScore}%`);
    
    return {
      timestamp: now,
      managerCheck: managerChecks,
      channelChecks,
      overallScore,
      recommendations
    };
  }
  
  /**
   * 获取管理器状态
   * 宪法依据：§110协作效率公理，实时状态报告
   */
  getManagerStatus(): {
    managerId: string;
    name: string;
    version: string;
    status: 'initializing' | 'running' | 'stopping' | 'stopped' | 'error';
    totalChannels: number;
    connectedChannels: number;
    metrics: {
      totalMessagesSent: number;
      totalMessagesReceived: number;
      totalRoutingDecisions: number;
      totalErrors: number;
      startTime: number;
    };
    constitutionalCompliance: {
      lastCheck: number;
      score: number;
      issues: string[];
      recommendations: string[];
    };
    uptime: number;
  } {
    // 计算连接通道数
    let connectedChannels = 0;
    for (const channel of this.channels.values()) {
      if (channel.status === 'connected') {
        connectedChannels++;
      }
    }
    
    // 确定管理器状态
    let status: 'initializing' | 'running' | 'stopping' | 'stopped' | 'error' = 'running';
    if (this.channels.size === 0) {
      status = 'initializing';
    }
    
    // 检查是否有错误通道
    for (const channel of this.channels.values()) {
      if (channel.status === 'error') {
        status = 'error';
        break;
      }
    }
    
    // 执行宪法合规检查
    const constitutionalReport = this.performConstitutionalCheck();
    
    return {
      managerId: this.config.managerId,
      name: this.config.name,
      version: this.config.version,
      status,
      totalChannels: this.channels.size,
      connectedChannels,
      metrics: { ...this.metrics },
      constitutionalCompliance: {
        lastCheck: constitutionalReport.timestamp,
        score: constitutionalReport.overallScore,
        issues: constitutionalReport.recommendations.filter(r => r.includes('需要立即') || r.includes('严重')),
        recommendations: constitutionalReport.recommendations
      },
      uptime: Math.floor((Date.now() - this.metrics.startTime) / 1000)
    };
  }
  
  /**
   * 添加事件监听器
   * 宪法依据：§101同步公理，统一事件系统
   */
  on(eventType: string, listener: (data: any) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
    this.logDebug(`事件监听器注册成功: ${eventType}`);
  }
  
  /**
   * 移除事件监听器
   * 宪法依据：§102熵减原则，清理事件监听器
   */
  off(eventType: string, listener: (data: any) => void): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index !== -1) {
        listeners.splice(index, 1);
        this.logDebug(`事件监听器移除成功: ${eventType}`);
      }
    }
  }
  
  // 私有方法
  
  /**
   * 验证配置
   * 宪法依据：§107通信安全，配置安全验证
   */
  private validateConfig(): void {
    const violations: string[] = [];
    
    // 检查必需字段
    if (!this.config.managerId) {
      violations.push('必须指定管理器ID');
    }
    
    if (!this.config.name) {
      violations.push('必须指定管理器名称');
    }
    
    if (!this.config.version) {
      violations.push('必须指定管理器版本');
    }
    
    // 检查通道配置
    if (this.config.channels.maxConcurrentChannels < 1) {
      violations.push('最大并发通道数必须至少为1');
    }
    
    if (this.config.channels.healthCheckInterval < 1000) {
      violations.push('健康检查间隔必须至少为1000毫秒');
    }
    
    // 检查消息处理配置
    if (this.config.messaging.maxBatchSize < 1) {
      violations.push('最大批量大小必须至少为1');
    }
    
    if (this.config.messaging.batchTimeout < 100) {
      violations.push('批量超时时间必须至少为100毫秒');
    }
    
    if (this.config.messaging.maxRetries < 0) {
      violations.push('最大重试次数不能为负数');
    }
    
    // 检查监控配置
    if (this.config.monitoring.alertThresholds.errorRate < 0 || this.config.monitoring.alertThresholds.errorRate > 100) {
      violations.push('错误率阈值必须在0-100范围内');
    }
    
    if (this.config.monitoring.alertThresholds.latency < 0) {
      violations.push('延迟阈值不能为负数');
    }
    
    if (this.config.monitoring.alertThresholds.channelDowntime < 0) {
      violations.push('通道停机时间阈值不能为负数');
    }
    
    // 检查宪法合规配置
    if (this.config.constitutionalCompliance.minComplianceScore < 0 || this.config.constitutionalCompliance.minComplianceScore > 100) {
      violations.push('最低合规评分必须在0-100范围内');
    }
    
    if (this.config.constitutionalCompliance.autoFixThreshold < 0 || this.config.constitutionalCompliance.autoFixThreshold > 100) {
      violations.push('自动修复阈值必须在0-100范围内');
    }
    
    if (violations.length > 0) {
      throw new Error(`管理器配置验证失败: ${violations.join(', ')}`);
    }
  }
  
  /**
   * 初始化事件系统
   * 宪法依据：§101同步公理，统一事件处理
   */
  private initEventSystem(): void {
    // 注册默认事件监听器
    this.on('channel_registered', (data) => {
      this.logInfo(`通道注册事件: ${data.channelId} (${data.platform})`);
    });
    
    this.on('channel_unregistered', (data) => {
      this.logInfo(`通道注销事件: ${data.channelId}`);
    });
    
    this.on('channel_connected', (data) => {
      this.logInfo(`通道连接事件: ${data.channelId}`);
    });
    
    this.on('channel_disconnected', (data) => {
      this.logInfo(`通道断开连接事件: ${data.channelId}`);
    });
    
    this.on('message_sent', (data) => {
      this.logDebug(`消息发送事件: ${data.messageId} -> ${data.channelId}`);
    });
    
    this.on('message_send_failed', (data) => {
      this.logWarn(`消息发送失败事件: ${data.messageId} - ${data.error}`);
    });
    
    this.on('message_received', (data) => {
      this.logDebug(`消息接收事件: ${data.messageId} <- ${data.channelId}`);
    });
    
    this.logInfo('事件系统初始化成功');
  }
  
  /**
   * 触发事件
   * 宪法依据：§110协作效率公理，高效事件分发
   */
  private emitEvent(eventType: string, data: any): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data);
        } catch (error: any) {
          this.logError(`事件监听器执行失败: ${eventType} - ${error.message}`);
        }
      }
    }
  }
  
  /**
   * 启动健康检查
   * 宪法依据：§306零停机协议，持续健康监控
   */
  private startHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.config.channels.healthCheckInterval);
    
    this.logInfo(`健康检查已启动，间隔: ${this.config.channels.healthCheckInterval}ms`);
  }
  
  /**
   * 停止健康检查
   * 宪法依据：§102熵减原则，清理定时器资源
   */
  private stopHealthChecks(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
      this.logInfo('健康检查已停止');
    }
  }
  
  /**
   * 启动宪法合规检查
   * 宪法依据：§107通信安全，持续合规监控
   */
  private startConstitutionalChecks(): void {
    if (this.constitutionalCheckTimer) {
      clearInterval(this.constitutionalCheckTimer);
    }
    
    this.constitutionalCheckTimer = setInterval(() => {
      this.performConstitutionalCheck();
    }, this.config.constitutionalCompliance.checkInterval);
    
    this.logInfo(`宪法合规检查已启动，间隔: ${this.config.constitutionalCompliance.checkInterval}ms`);
  }
  
  /**
   * 停止宪法合规检查
   * 宪法依据：§102熵减原则，清理定时器资源
   */
  private stopConstitutionalChecks(): void {
    if (this.constitutionalCheckTimer) {
      clearInterval(this.constitutionalCheckTimer);
      this.constitutionalCheckTimer = undefined;
      this.logInfo('宪法合规检查已停止');
    }
  }
  
  /**
   * 断开所有通道连接
   * 宪法依据：§306零停机协议，有序断开连接
   */
  private async disconnectAllChannels(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];
    
    for (const [channelId, channel] of this.channels.entries()) {
      if (channel.status === 'connected' || channel.status === 'connecting') {
        disconnectPromises.push(
          this.disconnectChannel(channelId).catch(error => {
            this.logError(`断开通道连接失败: ${channelId} - ${error.message}`);
          })
        );
      }
    }
    
    await Promise.all(disconnectPromises);
    this.logInfo(`所有通道连接已断开，共${disconnectPromises.length}个通道`);
  }
  
  /**
   * 销毁所有适配器
   * 宪法依据：§102熵减原则，彻底清理资源
   */
  private async destroyAllAdapters(): Promise<void> {
    const destroyPromises: Promise<void>[] = [];
    
    for (const [channelId, channel] of this.channels.entries()) {
      destroyPromises.push(
        channel.adapter.destroy().catch(error => {
          this.logError(`销毁适配器失败: ${channelId} - ${error.message}`);
        })
      );
    }
    
    await Promise.all(destroyPromises);
    this.logInfo(`所有适配器已销毁，共${destroyPromises.length}个适配器`);
    
    // 清空通道注册表
    this.channels.clear();
  }
  
  /**
   * 验证出站消息
   * 宪法依据：§107通信安全，消息安全验证
   */
  private validateOutgoingMessage(message: OutgoingMessage): void {
    if (!message.id) {
      throw new Error('消息必须包含ID');
    }
    
    if (!message.platform) {
      throw new Error('消息必须指定目标平台');
    }
    
    if (!message.text && (!message.attachments || message.attachments.length === 0)) {
      throw new Error('消息必须包含文本内容或附件');
    }
    
    if (message.text && message.text.length > 10000) {
      throw new Error('消息文本长度不能超过10000字符');
    }
  }
  
  /**
   * 解析目标通道
   * 宪法依据：§101同步公理，统一通道解析逻辑
   */
  private async resolveTargetChannel(
    message: OutgoingMessage,
    options?: MessageConversionOptions
  ): Promise<ManagedChannel | null> {
    // 如果有指定的通道ID，直接使用
    if (message.channelId) {
      const channel = this.channels.get(message.channelId);
      if (channel) {
        return channel;
      }
    }
    
    // 应用路由规则
    for (const rule of this.routingRules) {
      if (!rule.enabled) continue;
      
      const matches = this.evaluateRoutingRule(rule, message, options);
      if (matches) {
        const channel = this.channels.get(rule.actions.targetChannelId);
        if (channel) {
          this.logDebug(`消息路由匹配规则: ${message.id} -> ${rule.name} -> ${channel.channelId}`);
          return channel;
        }
      }
    }
    
    // 默认路由：根据平台类型选择第一个匹配的通道
    for (const channel of this.channels.values()) {
      if (channel.platform === message.platform && channel.status === 'connected') {
        this.logDebug(`消息使用默认路由: ${message.id} -> ${channel.channelId}`);
        return channel;
      }
    }
    
    return null;
  }
  
  /**
   * 评估路由规则
   * 宪法依据：§101同步公理，统一规则评估
   */
  private evaluateRoutingRule(
    rule: MessageRoutingRule,
    message: OutgoingMessage,
    options?: MessageConversionOptions
  ): boolean {
    const conditions = rule.conditions;
    
    // 检查目标平台
    if (conditions.targetPlatform && conditions.targetPlatform !== message.platform) {
      return false;
    }
    
    // 检查通道ID
    if (conditions.channelId && conditions.channelId !== message.channelId) {
      return false;
    }
    
    // 检查消息类型（OutgoingMessage没有type属性，跳过此项检查）
    // if (conditions.messageType && conditions.messageType !== message.type) {
    //   return false;
    // }
    
    // 检查内容模式
    if (conditions.contentPattern && message.text) {
      if (!conditions.contentPattern.test(message.text)) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * 验证路由规则
   * 宪法依据：§107通信安全，规则安全验证
   */
  private validateRoutingRule(rule: MessageRoutingRule): void {
    if (!rule.id) {
      throw new Error('路由规则必须包含ID');
    }
    
    if (!rule.name) {
      throw new Error('路由规则必须包含名称');
    }
    
    if (rule.priority < 1 || rule.priority > 10) {
      throw new Error('路由规则优先级必须在1-10范围内');
    }
    
    if (!rule.actions.targetChannelId) {
      throw new Error('路由规则必须指定目标通道ID');
    }
    
    // 检查目标通道是否存在
    if (!this.channels.has(rule.actions.targetChannelId)) {
      throw new Error(`路由规则指定的目标通道不存在: ${rule.actions.targetChannelId}`);
    }
  }
  
  /**
   * 处理消息批次
   * 宪法依据：§110协作效率公理，高效批量处理
   */
  private async processMessageBatch(
    messages: OutgoingMessage[],
    options?: MessageConversionOptions
  ): Promise<MessageResult[]> {
    const startTime = Date.now();
    const results: MessageResult[] = [];
    
    // 按目标通道分组消息
    const messagesByChannel = new Map<string, OutgoingMessage[]>();
    
    for (const message of messages) {
      try {
        const targetChannel = await this.resolveTargetChannel(message, options);
        if (!targetChannel) {
          throw new Error(`无法找到目标通道: ${message.channelId || '未指定'}`);
        }
        
        if (!messagesByChannel.has(targetChannel.channelId)) {
          messagesByChannel.set(targetChannel.channelId, []);
        }
        messagesByChannel.get(targetChannel.channelId)!.push(message);
      } catch (error: any) {
        results.push(this.createErrorMessageResult(message, error));
      }
    }
    
    // 并行处理每个通道的批次
    const channelPromises: Promise<MessageResult[]>[] = [];
    
    for (const [channelId, channelMessages] of messagesByChannel.entries()) {
      const channel = this.channels.get(channelId);
      if (!channel) continue;
      
      channelPromises.push(
        channel.adapter.sendMessages(channelMessages, options).then(channelResults => {
          // 更新指标
          for (let i = 0; i < channelMessages.length; i++) {
            const message = channelMessages[i];
            const result = channelResults[i];
            this.updateMetricsForMessage(channel, result, 0); // 处理时间已在适配器中计算
          }
          return channelResults;
        }).catch(error => {
          // 为批次中的每个消息创建错误结果
          return channelMessages.map(message => this.createErrorMessageResult(message, error));
        })
      );
    }
    
    // 等待所有通道处理完成
    const allResults = await Promise.all(channelPromises);
    
    // 合并结果
    for (const channelResults of allResults) {
      results.push(...channelResults);
    }
    
    // 更新管理器指标
    this.metrics.totalMessagesSent += messages.length;
    this.metrics.totalRoutingDecisions += messages.length;
    
    const totalTime = Date.now() - startTime;
    this.logInfo(`消息批次处理完成: ${messages.length}条消息 (${totalTime}ms)`);
    
    return results;
  }
  
  /**
   * 创建错误消息结果
   * 宪法依据：§102熵减原则，统一错误处理
   */
  private createErrorMessageResult(message: OutgoingMessage, error: any): MessageResult {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      success: false,
      messageId: message.id,
      status: 'failed',
      timestamp: Date.now(),
      error: {
        code: 'BATCH_PROCESSING_FAILED',
        message: errorMessage,
        details: error,
        retryable: this.isErrorRetryable(error)
      },
      metrics: {
        processingTimeMs: 0,
        totalTimeMs: 0
      },
      compliance: {
        checked: true,
        violations: ['§107: 批次处理失败'],
        complianceScore: 0
      }
    };
  }
  
  /**
   * 处理传入消息
   * 宪法依据：§101同步公理，统一消息处理
   */
  private handleIncomingMessage(channelId: string, message: UnifiedMessage): void {
    try {
      // 更新通道指标
      const channel = this.channels.get(channelId);
      if (channel) {
        channel.metrics.messagesReceived++;
        channel.lastActivity = Date.now();
        this.updateChannelMetrics(channel);
      }
      
      // 更新管理器指标
      this.metrics.totalMessagesReceived++;
      
      this.logDebug(`消息接收: ${message.id} <- ${channelId}`);
      
      // 触发消息接收事件
      this.emitEvent('message_received', {
        messageId: message.id,
        channelId,
        platform: message.platform,
        message,
        timestamp: Date.now()
      });
      
    } catch (error: any) {
      this.logError(`处理传入消息失败: ${message.id} - ${error.message}`);
    }
  }
  
  /**
   * 处理适配器事件
   * 宪法依据：§110协作效率公理，统一事件处理
   */
  private handleAdapterEvent(channelId: string, eventType: string, data: any): void {
    try {
      this.logDebug(`适配器事件: ${channelId} - ${eventType}`);
      
      // 更新通道最后活动时间
      const channel = this.channels.get(channelId);
      if (channel) {
        channel.lastActivity = Date.now();
      }
      
      // 转发适配器事件
      this.emitEvent(`adapter_${eventType}`, {
        channelId,
        eventType,
        data,
        timestamp: Date.now()
      });
      
    } catch (error: any) {
      this.logError(`处理适配器事件失败: ${channelId} - ${eventType} - ${error.message}`);
    }
  }
  
  /**
   * 更新通道指标
   * 宪法依据：§110协作效率公理，实时指标更新
   */
  private updateChannelMetrics(channel: ManagedChannel): void {
    // 计算运行时间
    channel.metrics.uptime = Math.floor((Date.now() - channel.createdAt) / 1000);
    
    // 计算平均处理时间（简化版）
    // 实际实现中可能需要更复杂的计算
  }
  
  /**
   * 更新消息指标
   * 宪法依据：§110协作效率公理，消息处理指标
   */
  private updateMetricsForMessage(channel: ManagedChannel, result: MessageResult, processingTime: number): void {
    // 更新通道指标
    channel.metrics.messagesSent++;
    
    if (!result.success) {
      channel.metrics.totalErrors++;
    }
    
    // 更新平均处理时间（简化移动平均）
    if (processingTime > 0) {
      const alpha = 0.1; // 平滑因子
      channel.metrics.avgProcessingTimeMs = Math.round(
        alpha * processingTime + (1 - alpha) * channel.metrics.avgProcessingTimeMs
      );
    }
    
    channel.lastActivity = Date.now();
    this.updateChannelMetrics(channel);
    
    // 更新管理器指标
    this.metrics.totalMessagesSent++;
    this.metrics.totalRoutingDecisions++;
    
    if (!result.success) {
      this.metrics.totalErrors++;
    }
  }
  
  /**
   * 执行健康检查
   * 宪法依据：§306零停机协议，持续健康监控
   */
  private performHealthChecks(): void {
    const now = Date.now();
    const healthCheckPromises: Promise<void>[] = [];
    
    for (const [channelId, channel] of this.channels.entries()) {
      healthCheckPromises.push(
        (async () => {
          try {
            // 检查通道状态
            const state = channel.adapter.getState();
            
            // 更新通道状态
            channel.status = state.status;
            channel.lastActivity = now;
            
            // 检查是否需要重新连接
            if (channel.status === 'disconnected' && channel.config.enabled) {
              const timeSinceLastActivity = now - channel.lastActivity;
              if (timeSinceLastActivity > 60000) { // 超过1分钟未活动
                this.logInfo(`自动重新连接通道: ${channelId}`);
                await this.connectChannel(channelId).catch(error => {
                  this.logWarn(`自动重新连接失败: ${channelId} - ${error.message}`);
                });
              }
            }
            
            // 检查错误率
            const errorRate = channel.metrics.totalErrors / (channel.metrics.messagesSent + channel.metrics.messagesReceived);
            if (errorRate > this.config.monitoring.alertThresholds.errorRate / 100) {
              this.logWarn(`通道错误率过高: ${channelId} - ${(errorRate * 100).toFixed(2)}%`);
              
              this.emitEvent('health_check_warning', {
                channelId,
                warning: `错误率过高: ${(errorRate * 100).toFixed(2)}%`,
                timestamp: now
              });
            }
            
          } catch (error: any) {
            this.logError(`健康检查失败: ${channelId} - ${error.message}`);
            channel.status = 'error';
          }
        })()
      );
    }
    
    // 并行执行所有健康检查
    Promise.all(healthCheckPromises).then(() => {
      this.logDebug(`健康检查完成: 检查了${this.channels.size}个通道`);
    }).catch(error => {
      this.logError(`健康检查执行失败: ${error.message}`);
    });
  }
  
  /**
   * 检查错误是否可重试
   * 宪法依据：§306零停机协议，智能重试策略
   */
  private isErrorRetryable(error: any): boolean {
    // 网络错误通常可重试
    if (error.code?.includes('NETWORK') || error.code?.includes('TIMEOUT')) {
      return true;
    }
    
    // 平台限流通常可重试（需要等待）
    if (error.code?.includes('RATE_LIMIT') || error.code?.includes('TOO_MANY_REQUESTS')) {
      return true;
    }
    
    // 认证错误通常不可重试（需要重新认证）
    if (error.code?.includes('AUTH') || error.code?.includes('UNAUTHORIZED')) {
      return false;
    }
    
    // 默认情况下，非致命错误可重试
    return !error.fatal;
  }
  
  // 宪法合规检查方法
  
  /**
   * 检查§101同步公理
   * 宪法依据：§101同步公理，确保消息格式统一
   */
  private checkSynchronizationAxiom(): {
    clause: string;
    description: string;
    passed: boolean;
    details?: any;
  } {
    const passed = this.channels.size > 0 && this.routingRules.length > 0;
    
    return {
      clause: '§101',
      description: '同步公理：通道注册和路由规则',
      passed,
      details: {
        channelCount: this.channels.size,
        routingRuleCount: this.routingRules.length,
        eventListeners: this.eventListeners.size
      }
    };
  }
  
  /**
   * 检查§102熵减原则
   * 宪法依据：§102熵减原则，减少系统复杂性
   */
  private checkEntropyReductionAxiom(): {
    clause: string;
    description: string;
    passed: boolean;
    details?: any;
  } {
    // 检查错误总数
    const excessiveErrors = this.metrics.totalErrors > 100;
    
    // 检查通道数量是否在合理范围内
    const reasonableChannelCount = this.channels.size <= this.config.channels.maxConcurrentChannels;
    
    // 检查路由规则是否有重复
    const ruleIds = new Set<string>();
    const duplicateRules = this.routingRules.some(rule => {
      if (ruleIds.has(rule.id)) return true;
      ruleIds.add(rule.id);
      return false;
    });
    
    const passed = !excessiveErrors && reasonableChannelCount && !duplicateRules;
    
    return {
      clause: '§102',
      description: '熵减原则：系统复杂性和错误管理',
      passed,
      details: {
        totalErrors: this.metrics.totalErrors,
        channelCount: this.channels.size,
        maxConcurrentChannels: this.config.channels.maxConcurrentChannels,
        duplicateRules
      }
    };
  }
  
  /**
   * 检查§107通信安全
   * 宪法依据：§107通信安全，确保消息安全传输
   */
  private checkCommunicationSecurityAxiom(): {
    clause: string;
    description: string;
    passed: boolean;
    details?: any;
  } {
    // 检查所有通道的加密配置
    let allChannelsEncrypted = true;
    for (const channel of this.channels.values()) {
      if (!channel.config.security.encryptMessages) {
        allChannelsEncrypted = false;
        break;
      }
    }
    
    const passed = allChannelsEncrypted && this.config.monitoring.enableAlerts;
    
    return {
      clause: '§107',
      description: '通信安全：消息加密和告警配置',
      passed,
      details: {
        allChannelsEncrypted,
        enableAlerts: this.config.monitoring.enableAlerts,
        channelCount: this.channels.size
      }
    };
  }
  
  /**
   * 检查§110协作效率公理
   * 宪法依据：§110协作效率公理，优化资源使用
   */
  private checkCollaborationEfficiencyAxiom(): {
    clause: string;
    description: string;
    passed: boolean;
    details?: any;
  } {
    // 计算总体成功率
    const totalMessages = this.metrics.totalMessagesSent + this.metrics.totalMessagesReceived;
    const successRate = totalMessages > 0 ? (1 - (this.metrics.totalErrors / totalMessages)) * 100 : 100;
    
    // 检查负载均衡配置
    const loadBalancingEnabled = this.config.channels.enableLoadBalancing;
    
    // 检查批量处理配置
    const batchingEnabled = this.config.messaging.enableBatching;
    
    const passed = successRate >= 95 && loadBalancingEnabled && batchingEnabled;
    
    return {
      clause: '§110',
      description: '协作效率：成功率和优化配置',
      passed,
      details: {
        successRate: Math.round(successRate),
        loadBalancingEnabled,
        batchingEnabled,
        totalMessages,
        totalErrors: this.metrics.totalErrors
      }
    };
  }
  
  /**
   * 检查§306零停机协议
   * 宪法依据：§306零停机协议，确保服务连续性
   */
  private checkZeroDowntimeProtocolAxiom(): {
    clause: string;
    description: string;
    passed: boolean;
    details?: any;
  } {
    // 检查重试配置
    const retryConfigOk = this.config.messaging.enableRetry && this.config.messaging.maxRetries >= 1;
    
    // 检查健康检查配置
    const healthCheckConfigOk = this.config.channels.healthCheckInterval > 0;
    
    // 检查是否有未连接的通道
    let allChannelsConnected = true;
    for (const channel of this.channels.values()) {
      if (channel.status !== 'connected' && channel.config.enabled) {
        allChannelsConnected = false;
        break;
      }
    }
    
    const passed = retryConfigOk && healthCheckConfigOk && allChannelsConnected;
    
    return {
      clause: '§306',
      description: '零停机协议：故障恢复和服务连续性',
      passed,
      details: {
        retryEnabled: this.config.messaging.enableRetry,
        maxRetries: this.config.messaging.maxRetries,
        healthCheckInterval: this.config.channels.healthCheckInterval,
        allChannelsConnected,
        connectedChannels: Array.from(this.channels.values()).filter(c => c.status === 'connected').length,
        totalChannels: this.channels.size
      }
    };
  }
  
  /**
   * 检查§152单一真理源
   * 宪法依据：§152单一真理源，确保数据一致性
   */
  private checkSingleSourceOfTruthAxiom(): {
    clause: string;
    description: string;
    passed: boolean;
    details?: any;
  } {
    // 检查配置一致性
    const configConsistent = Boolean(this.config.managerId && this.config.name && this.config.version);
    
    // 检查状态数据完整性
    const stateComplete = Boolean(this.metrics && this.eventListeners);
    
    // 检查所有通道是否有完整配置
    let allChannelsConfigComplete = true;
    for (const channel of this.channels.values()) {
      if (!channel.config.platform || !channel.channelId) {
        allChannelsConfigComplete = false;
        break;
      }
    }
    
    const passed = configConsistent && stateComplete && allChannelsConfigComplete;
    
    return {
      clause: '§152',
      description: '单一真理源：配置和状态一致性',
      passed,
      details: {
        configConsistent,
        stateComplete,
        allChannelsConfigComplete,
        channelCount: this.channels.size
      }
    };
  }
  
  /**
   * 生成宪法合规建议
   * 宪法依据：§102熵减原则，提供改进建议
   */
  private generateConstitutionalRecommendations(
    managerChecks: Array<{
      clause: string;
      description: string;
      passed: boolean;
      details?: any;
    }>,
    channelChecks: Array<{
      channelId: string;
      platform: PlatformType;
      checks: Array<{
        clause: string;
        description: string;
        passed: boolean;
        details?: any;
      }>;
      overallScore: number;
    }>
  ): string[] {
    const recommendations: string[] = [];
    
    // 分析管理器检查结果
    for (const check of managerChecks) {
      if (!check.passed) {
        switch (check.clause) {
          case '§101':
            recommendations.push('注册更多通道和路由规则以提高消息处理能力');
            break;
          case '§102':
            if (check.details?.excessiveErrors) {
              recommendations.push('调查并解决系统级错误，清理错误历史');
            }
            if (check.details?.duplicateRules) {
              recommendations.push('清理重复的路由规则');
            }
            break;
          case '§107':
            if (!check.details?.allChannelsEncrypted) {
              recommendations.push('为所有通道启用消息加密');
            }
            if (!check.details?.enableAlerts) {
              recommendations.push('启用告警系统以提前发现安全问题');
            }
            break;
          case '§110':
            if (check.details?.successRate < 95) {
              recommendations.push(`优化消息处理逻辑以提高成功率（当前：${check.details.successRate}%）`);
            }
            if (!check.details?.loadBalancingEnabled) {
              recommendations.push('启用负载均衡以优化资源使用');
            }
            if (!check.details?.batchingEnabled) {
              recommendations.push('启用批量处理以提高效率');
            }
            break;
          case '§306':
            if (!check.details?.retryEnabled) {
              recommendations.push('启用重试机制以提高服务可用性');
            }
            if (!check.details?.healthCheckInterval) {
              recommendations.push('配置健康检查以监控通道状态');
            }
            if (!check.details?.allChannelsConnected) {
              recommendations.push('检查并修复未连接的通道');
            }
            break;
          case '§152':
            recommendations.push('确保所有配置和状态数据的一致性');
            break;
        }
      }
    }
    
    // 分析通道检查结果
    for (const channelCheck of channelChecks) {
      if (channelCheck.overallScore < 80) {
        recommendations.push(`检查并优化通道 ${channelCheck.channelId} (${channelCheck.platform}) 的合规性`);
      }
    }
    
    // 通用建议
    if (this.channels.size === 0) {
      recommendations.push('注册至少一个通道以启用消息处理功能');
    }
    
    if (this.routingRules.length === 0) {
      recommendations.push('添加路由规则以支持灵活的消息路由');
    }
    
    return recommendations;
  }
  
  /**
   * 记录信息日志
   * 宪法依据：§101同步公理，统一日志格式
   */
  private logInfo(message: string, ...args: any[]): void {
    if (this.config.monitoring.enableLogging && this.config.monitoring.logLevel !== 'error') {
      console.log(`[CHANNEL_MANAGER] [${this.config.managerId}] [INFO] ${message}`, ...args);
    }
  }
  
  /**
   * 记录警告日志
   * 宪法依据：§102熵减原则，预警系统
   */
  private logWarn(message: string, ...args: any[]): void {
    if (this.config.monitoring.enableLogging && this.config.monitoring.logLevel !== 'error') {
      console.warn(`[CHANNEL_MANAGER] [${this.config.managerId}] [WARN] ${message}`, ...args);
    }
  }
  
  /**
   * 记录错误日志
   * 宪法依据：§102熵减原则，错误追踪
   */
  private logError(message: string, ...args: any[]): void {
    if (this.config.monitoring.enableLogging) {
      console.error(`[CHANNEL_MANAGER] [${this.config.managerId}] [ERROR] ${message}`, ...args);
    }
  }
  
  /**
   * 记录调试日志
   * 宪法依据：§101同步公理，详细调试信息
   */
  private logDebug(message: string, ...args: any[]): void {
    if (this.config.monitoring.enableLogging && this.config.monitoring.logLevel === 'debug') {
      console.debug(`[CHANNEL_MANAGER] [${this.config.managerId}] [DEBUG] ${message}`, ...args);
    }
  }
}

/**
 * 创建默认通道管理器配置
 * 宪法依据：§102熵减原则，复用标准配置
 */
export function createDefaultChannelManagerConfig(managerId: string): ChannelManagerConfig {
  return {
    managerId,
    name: `Channel Manager ${managerId}`,
    version: '1.0.0',
    
    channels: {
      defaultPriority: 5,
      maxConcurrentChannels: 10,
      enableLoadBalancing: true,
      healthCheckInterval: 30000 // 30秒
    },
    
    messaging: {
      enableBatching: true,
      maxBatchSize: 50,
      batchTimeout: 5000, // 5秒
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000 // 1秒
    },
    
    monitoring: {
      enableMetrics: true,
      enableAlerts: true,
      enableLogging: true,
      alertThresholds: {
        errorRate: 5, // 5%
        latency: 5000, // 5秒
        channelDowntime: 60 // 60秒
      },
      logLevel: 'info'
    },
    
    constitutionalCompliance: {
      enableAutoChecks: true,
      checkInterval: 300000, // 5分钟
      minComplianceScore: 80,
      autoFixThreshold: 30 // 30%
    }
  };
}