/**
 * 🔄 RedundancyManager - 冗余管理器
 * 
 * @constitution
 * §101 同步公理：代码变更必须触发文档更新
 * §102 熵减原则：所有变更必须降低或维持系统熵值
 * §109 观测回路公理：系统状态必须实时可观测
 * §321-§324 实时通信公理：双通道冗余保障
 * 
 * @filename RedundancyManager.ts
 * @version 1.0.0
 * @category gateway/redundancy
 * @last_updated 2026-02-26
 * 
 * 功能：
 * - WebHook + WebSocket双通道冗余
 * - 故障检测和自动切换
 * - 消息可靠传递保障
 * - 状态同步一致性检查
 */

import { EventEmitter } from "events";
import { logger } from "../../utils/logger";

/**
 * 通道类型
 */
type ChannelType = "websocket" | "webhook";

/**
 * 通道状态
 */
type ChannelStatus = "active" | "degraded" | "failed" | "recovering";

/**
 * 通道配置
 */
interface ChannelConfig {
  type: ChannelType;
  endpoint: string;
  timeout: number;
  retryCount: number;
  retryDelay: number;
  healthCheckInterval: number;
}

/**
 * 通道状态信息
 */
interface ChannelState {
  type: ChannelType;
  status: ChannelStatus;
  lastSuccess: number;
  lastFailure: number;
  failureCount: number;
  successCount: number;
  latency: number;
  available: boolean;
}

/**
 * 消息结构
 */
interface RedundancyMessage {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  priority: "low" | "normal" | "high" | "critical";
  requireAck: boolean;
  ackTimeout: number;
}

/**
 * 消息投递结果
 */
interface DeliveryResult {
  messageId: string;
  channel: ChannelType;
  success: boolean;
  latency: number;
  error?: string;
  timestamp: number;
}

const DEFAULT_CONFIG = {
  websocket: {
    type: "websocket" as ChannelType,
    endpoint: "ws://localhost:2567",
    timeout: 5000,
    retryCount: 3,
    retryDelay: 1000,
    healthCheckInterval: 10000,
  },
  webhook: {
    type: "webhook" as ChannelType,
    endpoint: "http://localhost:3000/webhook",
    timeout: 10000,
    retryCount: 5,
    retryDelay: 2000,
    healthCheckInterval: 30000,
  },
};

/**
 * 🔄 RedundancyManager - 冗余管理器
 * 实现WebHook + WebSocket双通道冗余和故障切换
 */
export class RedundancyManager extends EventEmitter {
  private channels: Map<ChannelType, ChannelState> = new Map();
  private config: Record<ChannelType, ChannelConfig>;
  private pendingMessages: Map<string, RedundancyMessage> = new Map();
  private messageHistory: Map<string, DeliveryResult[]> = new Map();
  private healthCheckTimers: Map<ChannelType, NodeJS.Timeout> = new Map();
  private primaryChannel: ChannelType = "websocket";
  private failoverInProgress: boolean = false;

  constructor(config?: Partial<Record<ChannelType, Partial<ChannelConfig>>>) {
    super();
    
    // 合并配置
    this.config = {
      websocket: { ...DEFAULT_CONFIG.websocket, ...config?.websocket },
      webhook: { ...DEFAULT_CONFIG.webhook, ...config?.webhook },
    };
    
    // 初始化通道状态
    this.initializeChannels();
    
    logger.info("[RedundancyManager] 冗余管理器初始化完成");
  }

  /**
   * 初始化通道
   */
  private initializeChannels() {
    // WebSocket通道
    this.channels.set("websocket", {
      type: "websocket",
      status: "active",
      lastSuccess: 0,
      lastFailure: 0,
      failureCount: 0,
      successCount: 0,
      latency: 0,
      available: true,
    });
    
    // WebHook通道
    this.channels.set("webhook", {
      type: "webhook",
      status: "active",
      lastSuccess: 0,
      lastFailure: 0,
      failureCount: 0,
      successCount: 0,
      latency: 0,
      available: true,
    });
    
    // 启动健康检查
    this.startHealthChecks();
  }

  /**
   * 启动健康检查
   */
  private startHealthChecks() {
    Object.entries(this.config).forEach(([type, config]) => {
      const timer = setInterval(() => {
        this.performHealthCheck(type as ChannelType);
      }, config.healthCheckInterval);
      
      this.healthCheckTimers.set(type as ChannelType, timer);
    });
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(channelType: ChannelType) {
    const channel = this.channels.get(channelType);
    if (!channel) return;
    
    try {
      const startTime = Date.now();
      
      // 模拟健康检查（实际应调用真实端点）
      const isHealthy = await this.checkChannelHealth(channelType);
      
      const latency = Date.now() - startTime;
      channel.latency = latency;
      
      if (isHealthy) {
        channel.lastSuccess = Date.now();
        channel.successCount++;
        channel.failureCount = 0;
        
        if (channel.status === "failed" || channel.status === "recovering") {
          channel.status = "active";
          channel.available = true;
          logger.info(`[RedundancyManager] 通道 ${channelType} 恢复正常`);
          this.emit("channel_recovered", { channelType, latency });
        }
      } else {
        throw new Error("Health check failed");
      }
      
    } catch (error: any) {
      channel.lastFailure = Date.now();
      channel.failureCount++;
      
      if (channel.failureCount >= 3) {
        channel.status = "failed";
        channel.available = false;
        logger.error(`[RedundancyManager] 通道 ${channelType} 健康检查失败: ${error.message}`);
        
        // 触发故障切换
        this.handleChannelFailure(channelType);
      } else {
        channel.status = "degraded";
        logger.warn(`[RedundancyManager] 通道 ${channelType} 降级: ${error.message}`);
      }
      
      this.emit("channel_health_check_failed", { channelType, error: error.message });
    }
  }

  /**
   * 检查通道健康（模拟）
   */
  private async checkChannelHealth(channelType: ChannelType): Promise<boolean> {
    // 模拟检查 - 实际实现应发送真实请求
    return new Promise((resolve) => {
      setTimeout(() => {
        // 95%成功率模拟
        resolve(Math.random() > 0.05);
      }, 10 + Math.random() * 50);
    });
  }

  /**
   * 处理通道故障
   */
  private handleChannelFailure(failedChannel: ChannelType) {
    if (this.failoverInProgress) return;
    
    this.failoverInProgress = true;
    
    // 切换主通道
    const newPrimary = failedChannel === "websocket" ? "webhook" : "websocket";
    const newChannel = this.channels.get(newPrimary);
    
    if (newChannel && newChannel.available) {
      this.primaryChannel = newPrimary;
      logger.info(`[RedundancyManager] 故障切换: ${failedChannel} -> ${newPrimary}`);
      
      this.emit("failover", {
        from: failedChannel,
        to: newPrimary,
        timestamp: Date.now()
      });
      
      // 重新投递待处理消息
      this.redeliverPendingMessages();
    } else {
      logger.error("[RedundancyManager] 无可用备用通道");
      this.emit("all_channels_failed", { timestamp: Date.now() });
    }
    
    this.failoverInProgress = false;
  }

  /**
   * 发送消息（自动选择通道）
   */
  public async sendMessage(message: Omit<RedundancyMessage, "id" | "timestamp">): Promise<DeliveryResult> {
    const fullMessage: RedundancyMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };
    
    // 存储待处理消息
    this.pendingMessages.set(fullMessage.id, fullMessage);
    
    // 选择通道
    const channel = this.selectChannel(fullMessage.priority);
    
    // 发送消息
    const result = await this.deliverMessage(fullMessage, channel);
    
    // 处理结果
    if (result.success) {
      this.pendingMessages.delete(fullMessage.id);
      this.recordDeliveryResult(result);
    } else {
      // 尝试备用通道
      const backupChannel = channel === "websocket" ? "webhook" : "websocket";
      const backupResult = await this.deliverMessage(fullMessage, backupChannel);
      
      if (backupResult.success) {
        this.pendingMessages.delete(fullMessage.id);
        this.recordDeliveryResult(backupResult);
        return backupResult;
      }
      
      // 两个通道都失败
      this.emit("delivery_failed", { message: fullMessage, results: [result, backupResult] });
    }
    
    return result;
  }

  /**
   * 选择最佳通道
   */
  private selectChannel(priority: string): ChannelType {
    const primary = this.channels.get(this.primaryChannel);
    const secondary = this.channels.get(this.primaryChannel === "websocket" ? "webhook" : "websocket");
    
    // 关键消息优先使用可用通道
    if (priority === "critical") {
      if (primary?.available && primary.status === "active") {
        return this.primaryChannel;
      }
      if (secondary?.available) {
        return this.primaryChannel === "websocket" ? "webhook" : "websocket";
      }
    }
    
    // 普通消息使用主通道（如果可用）
    if (primary?.available) {
      return this.primaryChannel;
    }
    
    // 使用备用通道
    return this.primaryChannel === "websocket" ? "webhook" : "websocket";
  }

  /**
   * 投递消息
   */
  private async deliverMessage(message: RedundancyMessage, channelType: ChannelType): Promise<DeliveryResult> {
    const channel = this.channels.get(channelType);
    const config = this.config[channelType];
    
    if (!channel || !channel.available) {
      return {
        messageId: message.id,
        channel: channelType,
        success: false,
        latency: 0,
        error: "Channel unavailable",
        timestamp: Date.now(),
      };
    }
    
    const startTime = Date.now();
    
    try {
      // 模拟消息投递（实际应调用真实发送逻辑）
      const success = await this.performDelivery(message, channelType, config);
      
      const latency = Date.now() - startTime;
      
      if (success) {
        channel.lastSuccess = Date.now();
        channel.successCount++;
        channel.latency = latency;
        
        return {
          messageId: message.id,
          channel: channelType,
          success: true,
          latency,
          timestamp: Date.now(),
        };
      } else {
        throw new Error("Delivery failed");
      }
      
    } catch (error: any) {
      channel.lastFailure = Date.now();
      channel.failureCount++;
      
      // 连续失败检测
      if (channel.failureCount >= 3) {
        channel.status = "failed";
        channel.available = false;
        this.handleChannelFailure(channelType);
      }
      
      return {
        messageId: message.id,
        channel: channelType,
        success: false,
        latency: Date.now() - startTime,
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * 执行投递（模拟）
   */
  private async performDelivery(
    message: RedundancyMessage,
    channelType: ChannelType,
    config: ChannelConfig
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Delivery timeout"));
      }, config.timeout);
      
      // 模拟投递 - 90%成功率
      setTimeout(() => {
        clearTimeout(timeout);
        if (Math.random() > 0.1) {
          resolve(true);
        } else {
          reject(new Error("Simulated delivery failure"));
        }
      }, 5 + Math.random() * 50);
    });
  }

  /**
   * 记录投递结果
   */
  private recordDeliveryResult(result: DeliveryResult) {
    if (!this.messageHistory.has(result.messageId)) {
      this.messageHistory.set(result.messageId, []);
    }
    this.messageHistory.get(result.messageId)!.push(result);
    
    // 限制历史长度
    if (this.messageHistory.size > 1000) {
      const oldestKey = this.messageHistory.keys().next().value;
      if (oldestKey) {
        this.messageHistory.delete(oldestKey);
      }
    }
  }

  /**
   * 重新投递待处理消息
   */
  private async redeliverPendingMessages() {
    const pending = Array.from(this.pendingMessages.values());
    
    for (const message of pending) {
      try {
        await this.sendMessage({
          type: message.type,
          payload: message.payload,
          priority: message.priority,
          requireAck: message.requireAck,
          ackTimeout: message.ackTimeout,
        });
      } catch (error) {
        logger.error(`[RedundancyManager] 消息重投失败: ${message.id}`);
      }
    }
  }

  /**
   * 获取通道状态
   */
  public getChannelStatus(): Record<ChannelType, ChannelState> {
    const status: Record<ChannelType, ChannelState> = {
      websocket: this.channels.get("websocket")!,
      webhook: this.channels.get("webhook")!,
    };
    return status;
  }

  /**
   * 获取主通道
   */
  public getPrimaryChannel(): ChannelType {
    return this.primaryChannel;
  }

  /**
   * 手动切换通道
   */
  public switchChannel(newPrimary: ChannelType): boolean {
    const channel = this.channels.get(newPrimary);
    
    if (!channel || !channel.available) {
      logger.warn(`[RedundancyManager] 无法切换到不可用通道: ${newPrimary}`);
      return false;
    }
    
    const oldPrimary = this.primaryChannel;
    this.primaryChannel = newPrimary;
    
    logger.info(`[RedundancyManager] 手动切换通道: ${oldPrimary} -> ${newPrimary}`);
    
    this.emit("channel_switched", {
      from: oldPrimary,
      to: newPrimary,
      manual: true,
      timestamp: Date.now()
    });
    
    return true;
  }

  /**
   * 获取统计信息
   */
  public getStats() {
    const channels = this.getChannelStatus();
    
    return {
      primaryChannel: this.primaryChannel,
      channels: {
        websocket: {
          status: channels.websocket.status,
          available: channels.websocket.available,
          latency: channels.websocket.latency,
          successRate: channels.websocket.successCount / 
            (channels.websocket.successCount + channels.websocket.failureCount) || 0,
        },
        webhook: {
          status: channels.webhook.status,
          available: channels.webhook.available,
          latency: channels.webhook.latency,
          successRate: channels.webhook.successCount / 
            (channels.webhook.successCount + channels.webhook.failureCount) || 0,
        },
      },
      pendingMessages: this.pendingMessages.size,
      historySize: this.messageHistory.size,
    };
  }

  /**
   * 关闭冗余管理器
   */
  public shutdown() {
    // 停止健康检查
    this.healthCheckTimers.forEach((timer) => clearInterval(timer));
    this.healthCheckTimers.clear();
    
    // 清理待处理消息
    this.pendingMessages.clear();
    this.messageHistory.clear();
    
    logger.info("[RedundancyManager] 冗余管理器已关闭");
    
    this.emit("shutdown", { timestamp: Date.now() });
  }
}

export default RedundancyManager;