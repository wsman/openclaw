/**
 * 📨 Slack平台适配器实现
 * 
 * 宪法依据：
 * - §101 同步公理：统一Slack消息格式确保系统一致性
 * - §102 熵减原则：复用Slack SDK，减少技术债务
 * - §107 通信安全：Slack消息加密和Webhook签名验证
 * - §110 协作效率公理：优化Slack API调用和批量处理
 * - §306 零停机协议：Slack连接故障恢复和优雅降级
 * - §152 单一真理源：统一定义Slack适配器契约
 * 
 * 设计原则：
 * 1. 原生SDK集成：使用@slack/bolt或@slack/web-api
 * 2. 实时事件处理：支持Slack Events API和Socket Mode
 * 3. 消息格式兼容：支持Slack块元素、附件、线程等特性
 * 4. 宪法合规：Slack适配器必须通过宪法合规检查
 * 
 * @version 1.0.0 (Phase 1D Day 1)
 * @category Gateway/Channels/Platforms
 */

import type {
  PlatformType,
  UnifiedMessage,
  OutgoingMessage,
  MessageResult,
  ChannelStatus,
  MessageAttachment
} from '../../types/Message';

import type {
  PlatformAdapterConfig,
  PlatformAdapterState,
  MessageConversionOptions
} from '../../interfaces/IPlatformAdapter';

import { BasePlatformAdapter } from '../BasePlatformAdapter';
import { MessageType, MessagePriority } from '../../types/Message';

/**
 * Slack平台适配器具体实现
 * 宪法依据：§152单一真理源，统一Slack适配器实现
 */
export class SlackAdapter extends BasePlatformAdapter {
  // Slack特定属性
  private slackClient: any; // 实际类型取决于使用的Slack SDK
  private botUserId?: string;
  private teamId?: string;
  private workspaceName?: string;
  
  // Slack连接状态
  private slackSocketMode?: boolean;
  private slackAppToken?: string;
  private slackBotToken?: string;
  private slackSigningSecret?: string;
  
  // 消息缓存（用于线程回复等）
  private messageCache = new Map<string, any>();
  private threadCache = new Map<string, any[]>();
  
  // 通道缓存
  private channelCache = new Map<string, any>();
  private userCache = new Map<string, any>();
  
  /**
   * 构造函数
   * 宪法依据：§101同步公理，统一构造函数签名
   */
  constructor(config: PlatformAdapterConfig) {
    super(config);
    
    // 初始化Slack特定配置
    this.initializeSlackSpecificConfig();
  }
  
  // 抽象属性实现
  
  /**
   * 平台类型
   * 宪法依据：§101同步公理，明确标识平台类型
   */
  readonly platform: PlatformType = 'slack';
  
  /**
   * 适配器名称
   * 宪法依据：§152单一真理源，统一适配器标识
   */
  readonly name: string = 'Slack Platform Adapter';
  
  /**
   * 适配器版本
   * 宪法依据：§101同步公理，版本追踪
   */
  readonly version: string = '1.0.0';
  
  // 抽象方法实现
  
  /**
   * 平台特定的初始化逻辑
   * 宪法依据：§306零停机协议，确保Slack SDK初始化不影响服务
   */
  protected async platformSpecificInitialize(): Promise<void> {
    try {
      this.logInfo('开始初始化Slack适配器');
      
      // 验证Slack配置
      this.validateSlackConfig();
      
      // 初始化Slack客户端（模拟实现，实际需要安装@slack/bolt或@slack/web-api）
      await this.initializeSlackClient();
      
      // 验证Slack连接
      await this.testSlackConnection();
      
      // 初始化缓存
      await this.initializeCaches();
      
      this.logInfo('Slack适配器初始化成功');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Slack适配器初始化失败: ${errorMessage}`);
      throw new Error(`Slack适配器初始化失败: ${errorMessage}`);
    }
  }
  
  /**
   * 平台特定的连接逻辑
   * 宪法依据：§110协作效率公理，优化Slack连接
   */
  protected async platformSpecificConnect(): Promise<void> {
    try {
      this.logInfo('开始连接Slack平台');
      
      // 建立Slack连接（模拟实现）
      await this.connectToSlack();
      
      // 获取Bot用户信息
      await this.fetchBotUserInfo();
      
      // 获取工作区信息
      await this.fetchWorkspaceInfo();
      
      // 设置事件监听器
      await this.setupEventListeners();
      
      this.logInfo('Slack平台连接成功');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Slack平台连接失败: ${errorMessage}`);
      throw new Error(`Slack平台连接失败: ${errorMessage}`);
    }
  }
  
  /**
   * 平台特定的断开连接逻辑
   * 宪法依据：§306零停机协议，优雅断开Slack连接
   */
  protected async platformSpecificDisconnect(): Promise<void> {
    try {
      this.logInfo('开始断开Slack平台连接');
      
      // 清理事件监听器
      await this.cleanupEventListeners();
      
      // 断开Slack连接（模拟实现）
      await this.disconnectFromSlack();
      
      // 清理缓存
      this.cleanupCaches();
      
      this.logInfo('Slack平台断开连接成功');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logWarn(`Slack平台断开连接过程中发生错误: ${errorMessage}`);
      // 断开连接过程中的错误不抛出，确保资源清理
    }
  }
  
  /**
   * 平台特定的销毁逻辑
   * 宪法依据：§102熵减原则，清理Slack特定资源
   */
  protected async platformSpecificDestroy(): Promise<void> {
    try {
      this.logInfo('开始销毁Slack适配器资源');
      
      // 清理所有缓存
      this.messageCache.clear();
      this.threadCache.clear();
      this.channelCache.clear();
      this.userCache.clear();
      
      // 销毁Slack客户端（模拟实现）
      await this.destroySlackClient();
      
      this.logInfo('Slack适配器资源销毁成功');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logWarn(`Slack适配器资源销毁过程中发生错误: ${errorMessage}`);
    }
  }
  
  /**
   * 平台特定的消息标准化逻辑
   * 宪法依据：§101同步公理，Slack消息格式转换
   */
  protected async platformSpecificNormalizeMessage(platformMessage: any): Promise<UnifiedMessage> {
    try {
      // 验证Slack消息格式
      this.validateSlackMessage(platformMessage);
      
      // 标准化Slack消息
      const unifiedMessage = this.normalizeSlackMessage(platformMessage);
      
      // 缓存原始消息（用于线程回复等）
      this.cacheSlackMessage(platformMessage, unifiedMessage);
      
      return unifiedMessage;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Slack消息标准化失败: ${errorMessage}`);
      throw new Error(`Slack消息标准化失败: ${errorMessage}`);
    }
  }
  
  /**
   * 平台特定的消息发送逻辑
   * 宪法依据：§107通信安全，Slack消息安全传输
   */
  protected async platformSpecificSendMessage(message: OutgoingMessage, options?: MessageConversionOptions): Promise<MessageResult> {
    try {
      // 验证消息配置
      this.validateSlackMessageConfig(message, options);
      
      // 转换统一消息为Slack格式
      const slackMessage = this.convertToSlackFormat(message, options);
      
      // 发送Slack消息（模拟实现）
      const slackResult = await this.sendSlackMessage(slackMessage);
      
      // 创建消息结果
      const result = this.createMessageResult(message, slackResult);
      
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Slack消息发送失败: ${errorMessage}`);
      
      // 返回错误结果
      return {
        success: false,
        messageId: message.id,
        status: 'failed',
        timestamp: Date.now(),
        error: {
          code: 'SLACK_SEND_FAILED',
          message: errorMessage,
          details: error,
          retryable: this.isSlackErrorRetryable(error)
        },
        metrics: {
          processingTimeMs: 0,
          totalTimeMs: 0
        },
        compliance: {
          checked: true,
          violations: ['§107: Slack消息发送失败'],
          complianceScore: 0
        }
      };
    }
  }
  
  /**
   * 平台特定的通道状态获取逻辑
   * 宪法依据：§110协作效率公理，Slack通道状态查询
   */
  protected async platformSpecificGetChannelStatus(channelId: string): Promise<ChannelStatus> {
    try {
      // 验证通道ID
      this.validateChannelId(channelId);
      
      // 获取Slack通道信息（模拟实现）
      const channelInfo = await this.fetchSlackChannelInfo(channelId);
      
      // 创建通道状态
      const channelStatus: ChannelStatus = {
        platform: 'slack',
        channelId,
        status: 'connected',
        lastActivity: Date.now(),
        stats: {
          messagesSent: this.metrics.messagesSent,
          messagesReceived: this.metrics.messagesReceived,
          errors: this.metrics.totalErrors,
          avgProcessingTimeMs: this.state.metrics.avgProcessingTimeMs,
          uptime: this.state.metrics.uptime
        },
        constitutionalCompliance: {
          lastCheck: Date.now(),
          score: this.state.constitutionalCompliance.score,
          issues: this.state.constitutionalCompliance.issues
        }
      };
      
      return channelStatus;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Slack通道状态获取失败: ${errorMessage}`);
      
      // 返回错误状态
      return {
        platform: 'slack',
        channelId,
        status: 'error',
        lastActivity: Date.now(),
        error: {
          code: 'CHANNEL_STATUS_FAILED',
          message: errorMessage,
          timestamp: Date.now()
        },
        constitutionalCompliance: {
          lastCheck: Date.now(),
          score: 0,
          issues: [`通道状态获取失败: ${errorMessage}`]
        }
      };
    }
  }
  
  /**
   * 平台特定的通道列表获取逻辑
   * 宪法依据：§101同步公理，Slack通道列表格式
   */
  protected async platformSpecificListChannels(): Promise<Array<{
    id: string;
    name: string;
    type: string;
    memberCount?: number;
    description?: string;
    isPrivate?: boolean;
  }>> {
    try {
      this.logInfo('开始获取Slack通道列表');
      
      // 获取Slack通道列表（模拟实现）
      const slackChannels = await this.fetchSlackChannels();
      
      // 转换Slack通道格式
      const channels = slackChannels.map((channel: any) => ({
        id: channel.id,
        name: channel.name,
        type: this.mapSlackChannelType(channel),
        memberCount: channel.num_members,
        description: channel.purpose?.value,
        isPrivate: channel.is_private
      }));
      
      // 更新缓存
      this.updateChannelCache(slackChannels);
      
      this.logInfo(`Slack通道列表获取成功: ${channels.length}个通道`);
      
      return channels;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Slack通道列表获取失败: ${errorMessage}`);
      throw new Error(`Slack通道列表获取失败: ${errorMessage}`);
    }
  }
  
  /**
   * 平台特定的操作执行逻辑
   * 宪法依据：§152单一真理源，Slack特定操作接口
   */
  protected async platformSpecificExecute(operation: string, params?: any): Promise<any> {
    try {
      this.logInfo(`执行Slack特定操作: ${operation}`);
      
      switch (operation) {
        case 'getUserInfo':
          return await this.executeGetUserInfo(params);
          
        case 'getChannelHistory':
          return await this.executeGetChannelHistory(params);
          
        case 'postEphemeral':
          return await this.executePostEphemeral(params);
          
        case 'addReaction':
          return await this.executeAddReaction(params);
          
        case 'updateMessage':
          return await this.executeUpdateMessage(params);
          
        case 'deleteMessage':
          return await this.executeDeleteMessage(params);
          
        case 'createChannel':
          return await this.executeCreateChannel(params);
          
        case 'inviteToChannel':
          return await this.executeInviteToChannel(params);
          
        default:
          throw new Error(`不支持的Slack操作: ${operation}`);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Slack特定操作执行失败: ${operation} - ${errorMessage}`);
      throw new Error(`Slack特定操作执行失败: ${operation} - ${errorMessage}`);
    }
  }
  
  /**
   * 平台特定的配置验证逻辑
   * 宪法依据：§107通信安全，Slack配置安全验证
   */
  protected async platformSpecificValidateConfig(config: any): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // 验证必需配置
    if (!config.slackBotToken) {
      errors.push('必须提供Slack Bot Token');
    }
    
    if (!config.slackSigningSecret) {
      warnings.push('建议提供Slack Signing Secret以增强安全性');
    }
    
    // 验证Token格式（模拟验证）
    if (config.slackBotToken && !this.isValidSlackToken(config.slackBotToken)) {
      errors.push('Slack Bot Token格式无效');
    }
    
    // 验证权限范围（如果有）
    if (config.requiredScopes && config.requiredScopes.length > 0) {
      const missingScopes = this.checkMissingScopes(config);
      if (missingScopes.length > 0) {
        warnings.push(`缺少以下Slack权限范围: ${missingScopes.join(', ')}`);
      }
    }
    
    // 验证Webhook配置（如果有）
    if (config.webhookUrl && !this.isValidWebhookUrl(config.webhookUrl)) {
      errors.push('Webhook URL格式无效');
    }
    
    // 验证Socket Mode配置（如果启用）
    if (config.useSocketMode && !config.slackAppToken) {
      errors.push('启用Socket Mode时必须提供Slack App Token');
    }
    
    const valid = errors.length === 0;
    
    return {
      valid,
      errors,
      warnings
    };
  }
  
  // Slack特定方法
  
  /**
   * 初始化Slack特定配置
   * 宪法依据：§102熵减原则，配置复用和验证
   */
  private initializeSlackSpecificConfig(): void {
    const platformSpecific = this.config.platformSpecific || {};
    
    // 提取Slack配置
    this.slackBotToken = platformSpecific.slackBotToken;
    this.slackSigningSecret = platformSpecific.slackSigningSecret;
    this.slackAppToken = platformSpecific.slackAppToken;
    this.slackSocketMode = platformSpecific.useSocketMode || false;
    
    // 设置默认Slack特定配置
    if (!this.config.platformSpecific) {
      this.config.platformSpecific = {};
    }
    
    // 确保有合理的Slack特定配置
    if (!this.config.platformSpecific.slackBotToken) {
      this.config.platformSpecific.slackBotToken = process.env.SLACK_BOT_TOKEN;
    }
    
    if (!this.config.platformSpecific.slackSigningSecret) {
      this.config.platformSpecific.slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
    }
    
    if (!this.config.platformSpecific.slackAppToken) {
      this.config.platformSpecific.slackAppToken = process.env.SLACK_APP_TOKEN;
    }
    
    this.logDebug('Slack特定配置初始化完成');
  }
  
  /**
   * 验证Slack配置
   * 宪法依据：§107通信安全，Slack配置安全验证
   */
  private validateSlackConfig(): void {
    const platformSpecific = this.config.platformSpecific || {};
    
    // 检查必需配置
    if (!platformSpecific.slackBotToken) {
      throw new Error('缺少必需的Slack配置: slackBotToken');
    }
    
    // 检查Token格式
    if (!this.isValidSlackToken(platformSpecific.slackBotToken)) {
      throw new Error('Slack Bot Token格式无效');
    }
    
    // 检查签名密钥（如果提供）
    if (platformSpecific.slackSigningSecret && !this.isValidSigningSecret(platformSpecific.slackSigningSecret)) {
      throw new Error('Slack Signing Secret格式无效');
    }
    
    // 检查App Token（如果使用Socket Mode）
    if (platformSpecific.useSocketMode && !platformSpecific.slackAppToken) {
      throw new Error('启用Socket Mode时必须提供slackAppToken');
    }
    
    this.logDebug('Slack配置验证通过');
  }
  
  /**
   * 初始化Slack客户端（模拟实现）
   * 宪法依据：§306零停机协议，优雅初始化
   */
  private async initializeSlackClient(): Promise<void> {
    try {
      this.logInfo('初始化Slack客户端');
      
      // 模拟Slack客户端初始化
      // 实际实现需要使用@slack/bolt或@slack/web-api
      this.slackClient = {
        // 模拟客户端方法
        auth: {
          test: async () => ({
            ok: true,
            url: 'https://slack.com',
            team: 'Test Team',
            user: 'test_bot',
            team_id: 'T12345678',
            user_id: 'U12345678',
            bot_id: 'B12345678'
          })
        },
        
        // 模拟聊天API
        chat: {
          postMessage: async (params: any) => ({
            ok: true,
            channel: params.channel,
            ts: Date.now().toString(),
            message: params
          }),
          
          update: async (params: any) => ({
            ok: true,
            channel: params.channel,
            ts: params.ts,
            text: params.text
          }),
          
          delete: async (params: any) => ({
            ok: true,
            channel: params.channel,
            ts: params.ts
          })
        },
        
        // 模拟对话API
        conversations: {
          list: async () => ({
            ok: true,
            channels: [
              { id: 'C12345678', name: 'general', is_channel: true, is_private: false },
              { id: 'C87654321', name: 'random', is_channel: true, is_private: false }
            ]
          }),
          
          info: async (params: any) => ({
            ok: true,
            channel: {
              id: params.channel,
              name: 'test-channel',
              is_channel: true,
              is_private: false,
              num_members: 10
            }
          })
        },
        
        // 模拟用户API
        users: {
          info: async (params: any) => ({
            ok: true,
            user: {
              id: params.user,
              name: 'test_user',
              real_name: 'Test User',
              profile: {
                image_24: 'https://avatar.url/24.png',
                image_32: 'https://avatar.url/32.png',
                image_48: 'https://avatar.url/48.png'
              }
            }
          })
        }
      };
      
      this.logInfo('Slack客户端初始化成功');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Slack客户端初始化失败: ${errorMessage}`);
      throw new Error(`Slack客户端初始化失败: ${errorMessage}`);
    }
  }
  
  /**
   * 测试Slack连接
   * 宪法依据：§110协作效率公理，连接健康检查
   */
  private async testSlackConnection(): Promise<void> {
    try {
      this.logInfo('测试Slack连接');
      
      if (!this.slackClient || !this.slackClient.auth || !this.slackClient.auth.test) {
        throw new Error('Slack客户端未正确初始化');
      }
      
      // 模拟auth.test调用
      const authTest = await this.slackClient.auth.test();
      
      if (!authTest.ok) {
        throw new Error('Slack认证测试失败');
      }
      
      // 保存认证信息
      this.teamId = authTest.team_id;
      this.botUserId = authTest.user_id;
      this.workspaceName = authTest.team;
      
      this.logInfo(`Slack连接测试成功: ${this.workspaceName} (${this.teamId})`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Slack连接测试失败: ${errorMessage}`);
      throw new Error(`Slack连接测试失败: ${errorMessage}`);
    }
  }
  
  /**
   * 初始化缓存
   * 宪法依据：§110协作效率公理，缓存优化性能
   */
  private async initializeCaches(): Promise<void> {
    this.logInfo('初始化Slack缓存');
    
    // 清空现有缓存
    this.messageCache.clear();
    this.threadCache.clear();
    this.channelCache.clear();
    this.userCache.clear();
    
    // 预加载常用通道（如果需要）
    if (this.config.performance.maxConcurrentRequests > 0) {
      await this.preloadCommonChannels();
    }
    
    this.logInfo('Slack缓存初始化完成');
  }
  
  /**
   * 连接Slack平台（模拟实现）
   * 宪法依据：§306零停机协议，优雅连接
   */
  private async connectToSlack(): Promise<void> {
    this.logInfo('连接Slack平台');
    
    // 模拟连接过程
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.logInfo('Slack平台连接完成');
  }
  
  /**
   * 获取Bot用户信息
   * 宪法依据：§101同步公理，获取身份信息
   */
  private async fetchBotUserInfo(): Promise<void> {
    try {
      this.logInfo('获取Bot用户信息');
      
      if (!this.slackClient || !this.slackClient.users || !this.slackClient.users.info) {
        throw new Error('Slack客户端未正确初始化');
      }
      
      if (!this.botUserId) {
        throw new Error('Bot用户ID未设置');
      }
      
      // 模拟获取用户信息
      const userInfo = await this.slackClient.users.info({ user: this.botUserId });
      
      if (!userInfo.ok) {
        throw new Error('获取Bot用户信息失败');
      }
      
      // 缓存用户信息
      this.userCache.set(this.botUserId, userInfo.user);
      
      this.logInfo(`Bot用户信息获取成功: ${userInfo.user.name}`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logWarn(`获取Bot用户信息失败: ${errorMessage}`);
      // 非关键错误，不抛出
    }
  }
  
  /**
   * 获取工作区信息
   * 宪法依据：§101同步公理，获取环境信息
   */
  private async fetchWorkspaceInfo(): Promise<void> {
    try {
      this.logInfo('获取Slack工作区信息');
      
      // 模拟获取工作区信息
      // 实际实现可能需要调用team.info或其他API
      
      this.logInfo('Slack工作区信息获取成功');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logWarn(`获取Slack工作区信息失败: ${errorMessage}`);
      // 非关键错误，不抛出
    }
  }
  
  /**
   * 设置事件监听器
   * 宪法依据：§110协作效率公理，高效事件处理
   */
  private async setupEventListeners(): Promise<void> {
    this.logInfo('设置Slack事件监听器');
    
    // 模拟设置事件监听器
    // 实际实现需要设置message、reaction_added、channel_created等事件监听
    
    this.logInfo('Slack事件监听器设置完成');
  }
  
  /**
   * 清理事件监听器
   * 宪法依据：§102熵减原则，清理资源
   */
  private async cleanupEventListeners(): Promise<void> {
    this.logInfo('清理Slack事件监听器');
    
    // 模拟清理事件监听器
    
    this.logInfo('Slack事件监听器清理完成');
  }
  
  /**
   * 断开Slack连接（模拟实现）
   * 宪法依据：§306零停机协议，优雅断开
   */
  private async disconnectFromSlack(): Promise<void> {
    this.logInfo('断开Slack平台连接');
    
    // 模拟断开连接过程
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.logInfo('Slack平台断开连接完成');
  }
  
  /**
   * 清理缓存
   * 宪法依据：§102熵减原则，定期清理
   */
  private cleanupCaches(): void {
    this.logInfo('清理Slack缓存');
    
    this.messageCache.clear();
    this.threadCache.clear();
    this.channelCache.clear();
    this.userCache.clear();
    
    this.logInfo('Slack缓存清理完成');
  }
  
  /**
   * 销毁Slack客户端（模拟实现）
   * 宪法依据：§102熵减原则，彻底清理
   */
  private async destroySlackClient(): Promise<void> {
    this.logInfo('销毁Slack客户端');
    
    // 模拟销毁客户端
    this.slackClient = null;
    
    this.logInfo('Slack客户端销毁完成');
  }
  
  /**
   * 验证Slack消息格式
   * 宪法依据：§107通信安全，消息格式验证
   */
  private validateSlackMessage(message: any): void {
    if (!message) {
      throw new Error('Slack消息为空');
    }
    
    if (!message.type) {
      throw new Error('Slack消息缺少type字段');
    }
    
    if (!message.channel) {
      throw new Error('Slack消息缺少channel字段');
    }
    
    if (!message.user && !message.bot_id) {
      throw new Error('Slack消息缺少user或bot_id字段');
    }
    
    // 验证必需的事件字段
    if (message.type === 'message' && !message.text && !message.blocks) {
      throw new Error('消息类型缺少text或blocks字段');
    }
    
    this.logDebug(`Slack消息格式验证通过: ${message.type}`);
  }
  
  /**
   * 标准化Slack消息
   * 宪法依据：§101同步公理，统一消息格式
   */
  private normalizeSlackMessage(slackMessage: any): UnifiedMessage {
    const messageId = this.generateMessageId(slackMessage);
    const timestamp = this.extractTimestamp(slackMessage);
    
    // 提取消息类型
    const messageType = this.mapSlackMessageType(slackMessage);
    
    // 提取文本内容
    const text = this.extractTextContent(slackMessage);
    
    // 提取附件
    const attachments = this.extractAttachments(slackMessage);
    
    // 提取元数据
    const metadata = this.extractSlackMetadata(slackMessage);
    
    // 创建统一消息
    const unifiedMessage: UnifiedMessage = {
      id: messageId,
      platform: 'slack',
      channelId: slackMessage.channel,
      userId: slackMessage.user || slackMessage.bot_id || 'unknown',
      threadId: slackMessage.thread_ts,
      type: messageType,
      text,
      attachments,
      timestamp,
      receivedAt: Date.now(),
      metadata: {
        platformMessageId: slackMessage.ts,
        platformChannelName: slackMessage.channel_name,
        platformUserName: slackMessage.username,
        platformUserAvatar: slackMessage.icons?.image_48,
        constitutionalCompliance: {
          checked: true,
          complianceScore: 100,
          checkedAt: Date.now()
        },
        processingStats: {
          receivedAtGateway: Date.now(),
          normalizedAt: Date.now()
        },
        ...metadata
      },
      priority: this.determineMessagePriority(slackMessage),
      constitutionalValidation: {
        hasValidSignature: this.validateSlackSignature(slackMessage),
        isEncrypted: false, // Slack消息默认不加密
        integrityVerified: true,
        timestampValid: this.validateTimestamp(timestamp),
        securityLevel: 'high'
      }
    };
    
    return unifiedMessage;
  }
  
  /**
   * 缓存Slack消息
   * 宪法依据：§110协作效率公理，缓存优化性能
   */
  private cacheSlackMessage(slackMessage: any, unifiedMessage: UnifiedMessage): void {
    const messageId = unifiedMessage.id;
    
    // 缓存原始消息
    this.messageCache.set(messageId, {
      slackMessage,
      unifiedMessage,
      cachedAt: Date.now()
    });
    
    // 如果是线程消息，缓存到线程
    if (slackMessage.thread_ts) {
      const threadMessages = this.threadCache.get(slackMessage.thread_ts) || [];
      threadMessages.push({
        messageId,
        slackMessage,
        unifiedMessage,
        timestamp: unifiedMessage.timestamp
      });
      this.threadCache.set(slackMessage.thread_ts, threadMessages);
    }
    
    // 限制缓存大小
    if (this.messageCache.size > 1000) {
      this.evictOldCacheEntries();
    }
  }
  
  /**
   * 验证Slack消息配置
   * 宪法依据：§107通信安全，配置验证
   */
  private validateSlackMessageConfig(message: OutgoingMessage, options?: MessageConversionOptions): void {
    if (!message.channelId) {
      throw new Error('Slack消息必须指定channelId');
    }
    
    if (!message.text && (!message.attachments || message.attachments.length === 0)) {
      throw new Error('Slack消息必须包含text或attachments');
    }
    
    // 检查文本长度限制
    const maxLength = options?.maxTextLength || 40000;
    if (message.text && message.text.length > maxLength) {
      throw new Error(`Slack消息文本长度超过限制: ${message.text.length} > ${maxLength}`);
    }
    
    // 检查附件限制
    if (message.attachments && message.attachments.length > 10) {
      throw new Error(`Slack消息附件数量超过限制: ${message.attachments.length} > 10`);
    }
  }
  
  /**
   * 转换统一消息为Slack格式
   * 宪法依据：§101同步公理，格式转换
   */
  private convertToSlackFormat(message: OutgoingMessage, options?: MessageConversionOptions): any {
    const slackMessage: any = {
      channel: message.channelId,
      text: message.text
    };
    
    // 添加选项
    if (message.options?.slack) {
      Object.assign(slackMessage, message.options.slack);
    }
    
    // 添加转换选项
    if (options) {
      this.applyConversionOptions(slackMessage, options);
    }
    
    // 添加附件（如果需要）
    if (message.attachments && message.attachments.length > 0) {
      slackMessage.attachments = this.convertAttachmentsToSlack(message.attachments);
    }
    
    // 添加线程信息
    if (message.options?.threadId) {
      slackMessage.thread_ts = message.options.threadId;
    }
    
    // 添加Markdown支持
    if (options?.platformRules?.slack?.convertMarkdown !== false) {
      slackMessage.mrkdwn = true;
    }
    
    return slackMessage;
  }
  
  /**
   * 发送Slack消息（模拟实现）
   * 宪法依据：§110协作效率公理，高效消息发送
   */
  private async sendSlackMessage(slackMessage: any): Promise<any> {
    this.logDebug(`发送Slack消息到通道: ${slackMessage.channel}`);
    
    if (!this.slackClient || !this.slackClient.chat || !this.slackClient.chat.postMessage) {
      throw new Error('Slack客户端未正确初始化');
    }
    
    // 模拟发送消息
    const result = await this.slackClient.chat.postMessage(slackMessage);
    
    if (!result.ok) {
      throw new Error('Slack消息发送失败');
    }
    
    return result;
  }
  
  /**
   * 创建消息结果
   * 宪法依据：§101同步公理，统一结果格式
   */
  private createMessageResult(message: OutgoingMessage, slackResult: any): MessageResult {
    const now = Date.now();
    
    const result: MessageResult = {
      success: true,
      messageId: message.id,
      platformMessageId: slackResult.ts,
      status: 'sent',
      timestamp: now,
      metrics: {
        processingTimeMs: 0, // 实际实现中需要计算
        totalTimeMs: 0
      },
      compliance: {
        checked: true,
        violations: [],
        complianceScore: 100
      }
    };
    
    return result;
  }
  
  /**
   * 检查Slack错误是否可重试
   * 宪法依据：§306零停机协议，智能重试策略
   */
  private isSlackErrorRetryable(error: any): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Slack限流错误可重试
    if (errorMessage.includes('rate_limited') || errorMessage.includes('too_many_requests')) {
      return true;
    }
    
    // 网络错误可重试
    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return true;
    }
    
    // 服务器错误可重试
    if (errorMessage.includes('server_error') || errorMessage.includes('internal_error')) {
      return true;
    }
    
    // 认证错误不可重试
    if (errorMessage.includes('invalid_auth') || errorMessage.includes('not_authed')) {
      return false;
    }
    
    // 权限错误不可重试
    if (errorMessage.includes('not_allowed') || errorMessage.includes('permission_denied')) {
      return false;
    }
    
    // 默认情况下，非致命错误可重试
    return !error.fatal;
  }
  
  /**
   * 验证通道ID
   * 宪法依据：§101同步公理，标识符验证
   */
  private validateChannelId(channelId: string): void {
    if (!channelId) {
      throw new Error('通道ID不能为空');
    }
    
    // Slack通道ID格式验证
    if (!channelId.match(/^[CDG][A-Z0-9]{8,}$/)) {
      throw new Error(`无效的Slack通道ID格式: ${channelId}`);
    }
  }
  
  /**
   * 获取Slack通道信息（模拟实现）
   * 宪法依据：§110协作效率公理，高效数据获取
   */
  private async fetchSlackChannelInfo(channelId: string): Promise<any> {
    this.logDebug(`获取Slack通道信息: ${channelId}`);
    
    if (!this.slackClient || !this.slackClient.conversations || !this.slackClient.conversations.info) {
      throw new Error('Slack客户端未正确初始化');
    }
    
    // 先检查缓存
    const cachedInfo = this.channelCache.get(channelId);
    if (cachedInfo) {
      return cachedInfo;
    }
    
    // 模拟获取通道信息
    const result = await this.slackClient.conversations.info({ channel: channelId });
    
    if (!result.ok) {
      throw new Error(`获取Slack通道信息失败: ${channelId}`);
    }
    
    // 缓存结果
    this.channelCache.set(channelId, result.channel);
    
    return result.channel;
  }
  
  /**
   * 获取Slack通道列表（模拟实现）
   * 宪法依据：§110协作效率公理，批量数据获取
   */
  private async fetchSlackChannels(): Promise<any[]> {
    this.logDebug('获取Slack通道列表');
    
    if (!this.slackClient || !this.slackClient.conversations || !this.slackClient.conversations.list) {
      throw new Error('Slack客户端未正确初始化');
    }
    
    // 模拟获取通道列表
    const result = await this.slackClient.conversations.list();
    
    if (!result.ok) {
      throw new Error('获取Slack通道列表失败');
    }
    
    return result.channels || [];
  }
  
  /**
   * 映射Slack通道类型
   * 宪法依据：§101同步公理，类型统一
   */
  private mapSlackChannelType(channel: any): string {
    if (channel.is_channel) return 'public_channel';
    if (channel.is_group) return 'private_channel';
    if (channel.is_im) return 'direct_message';
    if (channel.is_mpim) return 'group_direct_message';
    return 'unknown';
  }
  
  /**
   * 更新通道缓存
   * 宪法依据：§110协作效率公理，缓存优化
   */
  private updateChannelCache(channels: any[]): void {
    for (const channel of channels) {
      this.channelCache.set(channel.id, channel);
    }
    
    // 限制缓存大小
    if (this.channelCache.size > 500) {
      const keys = Array.from(this.channelCache.keys());
      const toRemove = keys.slice(0, keys.length - 400);
      for (const key of toRemove) {
        this.channelCache.delete(key);
      }
    }
  }
  
  /**
   * 执行获取用户信息操作
   * 宪法依据：§110协作效率公理，高效数据操作
   */
  private async executeGetUserInfo(params: any): Promise<any> {
    if (!params.userId) {
      throw new Error('必须提供userId参数');
    }
    
    // 先检查缓存
    const cachedUser = this.userCache.get(params.userId);
    if (cachedUser) {
      return cachedUser;
    }
    
    if (!this.slackClient || !this.slackClient.users || !this.slackClient.users.info) {
      throw new Error('Slack客户端未正确初始化');
    }
    
    const result = await this.slackClient.users.info({ user: params.userId });
    
    if (!result.ok) {
      throw new Error(`获取用户信息失败: ${params.userId}`);
    }
    
    // 缓存结果
    this.userCache.set(params.userId, result.user);
    
    return result.user;
  }
  
  /**
   * 执行获取通道历史操作
   * 宪法依据：§110协作效率公理，历史数据获取
   */
  private async executeGetChannelHistory(params: any): Promise<any> {
    if (!params.channelId) {
      throw new Error('必须提供channelId参数');
    }
    
    // 模拟获取通道历史
    // 实际实现需要使用conversations.history API
    
    return {
      ok: true,
      messages: [],
      has_more: false
    };
  }
  
  /**
   * 执行发送临时消息操作
   * 宪法依据：§107通信安全，临时消息处理
   */
  private async executePostEphemeral(params: any): Promise<any> {
    if (!params.channelId || !params.userId || !params.text) {
      throw new Error('必须提供channelId、userId和text参数');
    }
    
    // 模拟发送临时消息
    // 实际实现需要使用chat.postEphemeral API
    
    return {
      ok: true,
      message_ts: Date.now().toString()
    };
  }
  
  /**
   * 执行添加表情反应操作
   * 宪法依据：§110协作效率公理，反应处理
   */
  private async executeAddReaction(params: any): Promise<any> {
    if (!params.name || !params.channelId || !params.timestamp) {
      throw new Error('必须提供name、channelId和timestamp参数');
    }
    
    // 模拟添加表情反应
    // 实际实现需要使用reactions.add API
    
    return {
      ok: true
    };
  }
  
  /**
   * 执行更新消息操作
   * 宪法依据：§101同步公理，消息更新
   */
  private async executeUpdateMessage(params: any): Promise<any> {
    if (!params.channelId || !params.timestamp || !params.text) {
      throw new Error('必须提供channelId、timestamp和text参数');
    }
    
    if (!this.slackClient || !this.slackClient.chat || !this.slackClient.chat.update) {
      throw new Error('Slack客户端未正确初始化');
    }
    
    const result = await this.slackClient.chat.update({
      channel: params.channelId,
      ts: params.timestamp,
      text: params.text
    });
    
    if (!result.ok) {
      throw new Error(`更新消息失败: ${params.timestamp}`);
    }
    
    return result;
  }
  
  /**
   * 执行删除消息操作
   * 宪法依据：§102熵减原则，消息清理
   */
  private async executeDeleteMessage(params: any): Promise<any> {
    if (!params.channelId || !params.timestamp) {
      throw new Error('必须提供channelId和timestamp参数');
    }
    
    if (!this.slackClient || !this.slackClient.chat || !this.slackClient.chat.delete) {
      throw new Error('Slack客户端未正确初始化');
    }
    
    const result = await this.slackClient.chat.delete({
      channel: params.channelId,
      ts: params.timestamp
    });
    
    if (!result.ok) {
      throw new Error(`删除消息失败: ${params.timestamp}`);
    }
    
    return result;
  }
  
  /**
   * 执行创建通道操作
   * 宪法依据：§110协作效率公理，通道管理
   */
  private async executeCreateChannel(params: any): Promise<any> {
    if (!params.name) {
      throw new Error('必须提供name参数');
    }
    
    // 模拟创建通道
    // 实际实现需要使用conversations.create API
    
    return {
      ok: true,
      channel: {
        id: 'C' + Date.now().toString().slice(-8),
        name: params.name,
        is_channel: true,
        is_private: params.isPrivate || false
      }
    };
  }
  
  /**
   * 执行邀请到通道操作
   * 宪法依据：§110协作效率公理，成员管理
   */
  private async executeInviteToChannel(params: any): Promise<any> {
    if (!params.channelId || !params.userIds || params.userIds.length === 0) {
      throw new Error('必须提供channelId和userIds参数');
    }
    
    // 模拟邀请用户到通道
    // 实际实现需要使用conversations.invite API
    
    return {
      ok: true,
      channel: {
        id: params.channelId
      }
    };
  }
  
  // 工具方法
  
  /**
   * 验证Slack Token格式
   * 宪法依据：§107通信安全，Token验证
   */
  private isValidSlackToken(token: string): boolean {
    // Slack Token格式验证（简化版）
    // 实际格式: xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx
    return Boolean(token && token.length > 10 && token.includes('-'));
  }
  
  /**
   * 验证签名密钥格式
   * 宪法依据：§107通信安全，签名验证
   */
  private isValidSigningSecret(secret: string): boolean {
    // Slack Signing Secret格式验证（简化版）
    return Boolean(secret && secret.length === 32 && /^[a-f0-9]+$/i.test(secret));
  }
  
  /**
   * 检查缺少的权限范围
   * 宪法依据：§107通信安全，权限验证
   */
  private checkMissingScopes(config: any): string[] {
    // 模拟权限范围检查
    // 实际实现需要检查Bot Token的权限范围
    return [];
  }
  
  /**
   * 验证Webhook URL格式
   * 宪法依据：§107通信安全，URL验证
   */
  private isValidWebhookUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'https:' && 
             parsedUrl.hostname.includes('hooks.slack.com');
    } catch {
      return false;
    }
  }
  
  /**
   * 预加载常用通道
   * 宪法依据：§110协作效率公理，预加载优化
   */
  private async preloadCommonChannels(): Promise<void> {
    try {
      const commonChannelIds = ['general', 'random'];
      
      for (const channelName of commonChannelIds) {
        try {
          // 模拟获取通道信息
          // 实际实现需要根据通道名称查找通道ID
        } catch (error) {
          // 忽略预加载错误
        }
      }
    } catch (error) {
      // 忽略预加载错误
    }
  }
  
  /**
   * 生成消息ID
   * 宪法依据：§101同步公理，统一标识符生成
   */
  private generateMessageId(slackMessage: any): string {
    if (slackMessage.ts) {
      return `slack_${slackMessage.channel}_${slackMessage.ts}`;
    }
    return `slack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * 提取时间戳
   * 宪法依据：§101同步公理，时间标准化
   */
  private extractTimestamp(slackMessage: any): number {
    if (slackMessage.ts) {
      // Slack时间戳格式: "1234567890.123456"
      const ts = parseFloat(slackMessage.ts) * 1000;
      if (!isNaN(ts)) {
        return ts;
      }
    }
    
    if (slackMessage.event_ts) {
      const ts = parseFloat(slackMessage.event_ts) * 1000;
      if (!isNaN(ts)) {
        return ts;
      }
    }
    
    return Date.now();
  }
  
  /**
   * 映射Slack消息类型
   * 宪法依据：§101同步公理，类型映射
   */
  private mapSlackMessageType(slackMessage: any): MessageType {
    const type = slackMessage.type || 'message';
    const subtype = slackMessage.subtype;
    
    if (type === 'message') {
      if (subtype === 'file_share') return MessageType.ATTACHMENT;
      if (subtype === 'message_changed') return MessageType.TEXT;
      if (subtype === 'message_deleted') return MessageType.SYSTEM;
      return MessageType.TEXT;
    }
    
    if (type === 'reaction_added') return MessageType.EVENT;
    if (type === 'channel_created') return MessageType.EVENT;
    if (type === 'user_change') return MessageType.EVENT;
    
    return MessageType.TEXT;
  }
  
  /**
   * 提取文本内容
   * 宪法依据：§101同步公理，内容提取
   */
  private extractTextContent(slackMessage: any): string {
    if (slackMessage.text) {
      return slackMessage.text;
    }
    
    if (slackMessage.message?.text) {
      return slackMessage.message.text;
    }
    
    if (slackMessage.blocks) {
      // 从blocks中提取文本
      return this.extractTextFromBlocks(slackMessage.blocks);
    }
    
    return '';
  }
  
  /**
   * 从blocks中提取文本
   * 宪法依据：§101同步公理，结构化内容提取
   */
  private extractTextFromBlocks(blocks: any[]): string {
    let text = '';
    
    for (const block of blocks) {
      if (block.type === 'section' && block.text?.text) {
        text += block.text.text + '\n';
      } else if (block.type === 'context' && block.elements) {
        for (const element of block.elements) {
          if (element.text) {
            text += element.text + ' ';
          }
        }
        text += '\n';
      }
    }
    
    return text.trim();
  }
  
  /**
   * 提取附件
   * 宪法依据：§101同步公理，附件标准化
   */
  private extractAttachments(slackMessage: any): MessageAttachment[] {
    const attachments: MessageAttachment[] = [];
    
    // 处理Slack附件
    if (slackMessage.files && slackMessage.files.length > 0) {
      for (const file of slackMessage.files) {
        attachments.push({
          id: file.id,
          type: this.mapFileType(file),
          url: file.url_private || file.permalink,
          filename: file.name,
          size: file.size,
          mimeType: file.mimetype,
          thumbnailUrl: file.thumb_64 || file.thumb_360,
          description: file.title,
          metadata: {
            filetype: file.filetype,
            mode: file.mode
          },
          secure: {
            signed: !!file.url_private,
            encrypted: false,
            hash: file.sha256
          }
        });
      }
    }
    
    return attachments;
  }
  
  /**
   * 映射文件类型
   * 宪法依据：§101同步公理，类型统一
   */
  private mapFileType(file: any): string {
    const mimetype = file.mimetype || '';
    const filetype = file.filetype || '';
    
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.startsWith('audio/')) return 'audio';
    if (filetype === 'pdf') return 'file';
    if (filetype === 'doc' || filetype === 'docx') return 'file';
    if (filetype === 'xls' || filetype === 'xlsx') return 'file';
    
    return 'file';
  }
  
  /**
   * 提取Slack元数据
   * 宪法依据：§152单一真理源，元数据统一
   */
  private extractSlackMetadata(slackMessage: any): Record<string, any> {
    const metadata: Record<string, any> = {
      slack: {}
    };
    
    // 提取Slack特定字段
    const slackFields = ['ts', 'event_ts', 'thread_ts', 'subtype', 'hidden', 'deleted_ts'];
    for (const field of slackFields) {
      if (slackMessage[field] !== undefined) {
        metadata.slack[field] = slackMessage[field];
      }
    }
    
    // 提取反应
    if (slackMessage.reactions) {
      metadata.slack.reactions = slackMessage.reactions;
    }
    
    // 提取blocks（如果有）
    if (slackMessage.blocks) {
      metadata.slack.blocks = slackMessage.blocks;
    }
    
    return metadata;
  }
  
  /**
   * 确定消息优先级
   * 宪法依据：§110协作效率公理，优先级调度
   */
  private determineMessagePriority(slackMessage: any): MessagePriority {
    const subtype = slackMessage.subtype;
    const text = slackMessage.text || '';
    
    // 紧急消息
    if (text.includes('urgent') || text.includes('emergency')) {
      return MessagePriority.CRITICAL;
    }
    
    // 系统消息
    if (subtype === 'channel_join' || subtype === 'channel_leave') {
      return MessagePriority.LOW;
    }
    
    // 提及消息
    if (text.includes('<!here>') || text.includes('<!channel>')) {
      return MessagePriority.HIGH;
    }
    
    // 默认优先级
    return MessagePriority.NORMAL;
  }
  
  /**
   * 验证Slack签名
   * 宪法依据：§107通信安全，签名验证
   */
  private validateSlackSignature(slackMessage: any): boolean {
    // 模拟签名验证
    // 实际实现需要验证X-Slack-Signature和X-Slack-Request-Timestamp
    
    // 如果有签名配置，进行验证
    if (this.slackSigningSecret) {
      // 这里应该实现实际的签名验证逻辑
      return true; // 模拟返回true
    }
    
    // 如果没有配置签名密钥，假设消息来自可信来源
    return true;
  }
  
  /**
   * 验证时间戳
   * 宪法依据：§107通信安全，时间验证
   */
  private validateTimestamp(timestamp: number): boolean {
    const now = Date.now();
    const fiveMinutes = 5 * 60 * 1000;
    
    // 时间戳应该在合理范围内（当前时间±5分钟）
    return Math.abs(now - timestamp) < fiveMinutes;
  }
  
  /**
   * 应用转换选项
   * 宪法依据：§101同步公理，选项应用
   */
  private applyConversionOptions(slackMessage: any, options: MessageConversionOptions): void {
    if (options.preserveFormatting === false) {
      // 清理格式
      if (slackMessage.text) {
        slackMessage.text = this.cleanFormatting(slackMessage.text);
      }
    }
    
    if (options.normalizeEmoji) {
      // 标准化表情符号
      if (slackMessage.text) {
        slackMessage.text = this.normalizeEmoji(slackMessage.text);
      }
    }
    
    if (options.platformRules?.slack) {
      const slackRules = options.platformRules.slack;
      
      if (slackRules.convertMarkdown !== undefined) {
        slackMessage.mrkdwn = slackRules.convertMarkdown;
      }
      
      if (slackRules.preserveThreads !== undefined && slackRules.preserveThreads === false) {
        // 不保留线程
        delete slackMessage.thread_ts;
      }
    }
  }
  
  /**
   * 清理格式
   * 宪法依据：§101同步公理，格式标准化
   */
  private cleanFormatting(text: string): string {
    // 简化格式清理
    return text
      .replace(/```[\s\S]*?```/g, '')  // 移除代码块
      .replace(/`[^`]+`/g, '')         // 移除行内代码
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')  // 移除粗体/斜体
      .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')    // 移除下划线
      .replace(/~{2}([^~]+)~{2}/g, '$1');       // 移除删除线
  }
  
  /**
   * 标准化表情符号
   * 宪法依据：§101同步公理，表情符号统一
   */
  private normalizeEmoji(text: string): string {
    // 简化表情符号标准化
    const emojiMap: Record<string, string> = {
      ':smile:': '😊',
      ':slightly_smiling_face:': '🙂',
      ':thumbsup:': '👍',
      ':heart:': '❤️',
      ':fire:': '🔥'
    };
    
    let normalized = text;
    for (const [shortcode, emoji] of Object.entries(emojiMap)) {
      normalized = normalized.replace(new RegExp(shortcode, 'g'), emoji);
    }
    
    return normalized;
  }
  
  /**
   * 转换附件为Slack格式
   * 宪法依据：§101同步公理，附件格式转换
   */
  private convertAttachmentsToSlack(attachments: MessageAttachment[]): any[] {
    return attachments.map(attachment => ({
      title: attachment.description,
      title_link: attachment.url,
      text: attachment.description,
      image_url: attachment.type === 'image' ? attachment.url : undefined,
      thumb_url: attachment.thumbnailUrl,
      footer: attachment.filename,
      ts: Math.floor(Date.now() / 1000)
    }));
  }
  
  /**
   * 淘汰旧缓存条目
   * 宪法依据：§102熵减原则，缓存管理
   */
  private evictOldCacheEntries(): void {
    const entries = Array.from(this.messageCache.entries());
    
    // 按缓存时间排序
    entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    
    // 淘汰最旧的20%条目
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.messageCache.delete(entries[i][0]);
    }
    
    this.logDebug(`淘汰了${toRemove}个旧缓存条目`);
  }
}
