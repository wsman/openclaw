/**
 * 🏛️ 控制面房间基类 - BaseControlRoom
 * 
 * 宪法依据：
 * - §102 熵减原则：提取房间共同逻辑，减少代码重复
 * - §152 单一真理源公理：统一的房间生命周期管理
 * - §321-§324 实时通信公理：心跳保持、断线重连机制
 * 
 * 功能抽象：
 * 1. 生命周期管理（onCreate, onJoin, onLeave, onDispose）
 * 2. 心跳检测机制
 * 3. 消息路由框架
 * 4. 系统健康度监控
 * 5. 错误处理
 * 
 * 子类需实现：
 * - initializeState(): 初始化房间状态
 * - setupMessageHandlers(): 设置消息处理器
 * - getRoomTypeName(): 返回房间类型名称
 */

import { Room, Client } from "colyseus";
import { logger } from "../utils/logger";
import { activeRooms } from "../index";

/**
 * 控制面房间状态接口
 */
export interface ControlRoomState {
  roomId: string;
  createdAt: number;
  lastActivity: number;
  systemHealth: number;
  systemStatus: 'normal' | 'warning' | 'error';
  systemEntropy: number;
}

/**
 * 心跳配置
 */
export interface HeartbeatConfig {
  interval: number;      // 心跳间隔（毫秒）
  timeout: number;       // 超时时间（毫秒）
}

/**
 * 房间健康报告
 */
export interface RoomHealthReport {
  roomId: string;
  roomType: string;
  clientCount: number;
  systemHealth: number;
  systemEntropy: number;
  uptime: number;
  lastActivity: number;
  timestamp: number;
}

/**
 * 控制面房间基类
 * 
 * 所有控制面房间应继承此类，获得统一的生命周期管理
 */
export abstract class BaseControlRoom<T extends ControlRoomState> extends Room<T> {
  // 心跳配置
  protected heartbeatConfig: HeartbeatConfig = {
    interval: 30000,  // 30秒
    timeout: 60000    // 60秒
  };
  
  // 计时器
  protected timeElapsed: number = 0;
  protected lastHeartbeat: number = Date.now();
  
  // 房间状态
  protected isInitialized: boolean = false;
  
  /**
   * 获取房间类型名称（子类必须实现）
   */
  protected abstract getRoomTypeName(): string;
  
  /**
   * 初始化房间状态（子类必须实现）
   */
  protected abstract initializeState(options: any): void;
  
  /**
   * 设置消息处理器（子类必须实现）
   */
  protected abstract setupMessageHandlers(): void;
  
  /**
   * 房间创建入口
   */
  onCreate(options: any): void {
    const roomType = this.getRoomTypeName();
    logger.info(`[${roomType}] 创建房间实例 ${this.roomId}...`);
    
    // 注册到活跃房间列表
    activeRooms.add(this);
    
    // 初始化状态
    this.initializeState(options);
    
    // 设置基础状态字段
    this.state.roomId = this.roomId;
    this.state.createdAt = Date.now();
    this.state.lastActivity = Date.now();
    this.state.systemHealth = 1.0;
    this.state.systemStatus = 'normal';
    this.state.systemEntropy = 0.0;
    
    // 设置仿真循环
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 100);
    
    // 设置消息处理器
    this.setupMessageHandlers();
    
    // 设置心跳检测
    this.setupHeartbeatCheck();
    
    this.isInitialized = true;
    logger.info(`[${roomType}] 房间创建完成：${this.roomId}`);
  }
  
  /**
   * 客户端加入
   */
  onJoin(client: Client, options: any): void {
    const roomType = this.getRoomTypeName();
    logger.info(`[${roomType}] 客户端 ${client.sessionId} 加入房间`);
    
    // 更新最后活动时间
    this.state.lastActivity = Date.now();
    
    // 发送系统信息
    client.send("system_info", {
      roomType,
      roomId: this.roomId,
      serverTime: Date.now()
    });
  }
  
  /**
   * 客户端离开
   */
  onLeave(client: Client, consented: boolean): void {
    const roomType = this.getRoomTypeName();
    logger.info(`[${roomType}] 客户端 ${client.sessionId} 离开房间 (consented: ${consented})`);
    
    // 更新最后活动时间
    this.state.lastActivity = Date.now();
  }
  
  /**
   * 房间销毁
   */
  onDispose(): void {
    const roomType = this.getRoomTypeName();
    logger.info(`[${roomType}] 销毁房间 ${this.roomId}...`);
    
    // 从活跃房间列表移除
    activeRooms.delete(this);
    
    logger.info(`[${roomType}] 房间 ${this.roomId} 已销毁`);
  }
  
  /**
   * 更新循环（子类可覆盖扩展）
   */
  protected update(deltaTime: number): void {
    this.timeElapsed += deltaTime;
    
    // 定期更新系统健康度（1Hz）
    if (this.timeElapsed >= 1000) {
      this.updateSystemHealth();
      this.updateSystemEntropy();
      this.timeElapsed = 0;
    }
    
    // 心跳检测
    if (Date.now() - this.lastHeartbeat > this.heartbeatConfig.interval) {
      this.checkHeartbeats();
      this.lastHeartbeat = Date.now();
    }
  }
  
  /**
   * 更新系统健康度
   */
  protected updateSystemHealth(): void {
    // 基础健康度计算（子类可覆盖）
    const clientRatio = this.clients.length > 0 ? 1.0 : 0.5;
    const timeSinceLastActivity = Date.now() - this.state.lastActivity;
    const activityScore = timeSinceLastActivity < 60000 ? 1.0 : 0.5;
    
    this.state.systemHealth = clientRatio * 0.5 + activityScore * 0.5;
    
    // 更新状态
    if (this.state.systemHealth >= 0.8) {
      this.state.systemStatus = 'normal';
    } else if (this.state.systemHealth >= 0.5) {
      this.state.systemStatus = 'warning';
    } else {
      this.state.systemStatus = 'error';
    }
  }
  
  /**
   * 更新系统熵值
   */
  protected updateSystemEntropy(): void {
    // 基础熵值计算（子类可覆盖）
    // 熵值越低表示系统越有序
    const timeSinceLastActivity = Date.now() - this.state.lastActivity;
    const activityEntropy = Math.min(1.0, timeSinceLastActivity / 300000); // 5分钟
    
    this.state.systemEntropy = activityEntropy;
  }
  
  /**
   * 设置心跳检测
   */
  protected setupHeartbeatCheck(): void {
    this.clock.setInterval(() => {
      this.broadcast("heartbeat_request", {
        timestamp: Date.now(),
        interval: this.heartbeatConfig.interval
      });
    }, this.heartbeatConfig.interval);
  }
  
  /**
   * 检查心跳（子类可覆盖扩展）
   */
  protected checkHeartbeats(): void {
    // 基础心跳检查逻辑（子类可覆盖）
    this.state.lastActivity = Date.now();
  }
  
  /**
   * 发送错误消息
   */
  protected sendError(client: Client, errorCode: string, errorMessage: string): void {
    client.send("error", {
      code: errorCode,
      message: errorMessage,
      timestamp: Date.now()
    });
    
    logger.warn(`[${this.getRoomTypeName()}] 发送错误：${errorCode} - ${errorMessage}`);
  }
  
  /**
   * 广播系统消息
   */
  protected broadcastSystemMessage(content: string, metadata?: Record<string, any>): void {
    this.broadcast("system_message", {
      content,
      senderId: "system",
      timestamp: Date.now(),
      metadata
    });
  }
  
  /**
   * 获取房间健康报告
   */
  getHealthReport(): RoomHealthReport {
    return {
      roomId: this.roomId,
      roomType: this.getRoomTypeName(),
      clientCount: this.clients.length,
      systemHealth: this.state.systemHealth,
      systemEntropy: this.state.systemEntropy,
      uptime: Date.now() - this.state.createdAt,
      lastActivity: this.state.lastActivity,
      timestamp: Date.now()
    };
  }
  
  /**
   * 延迟函数（用于异步操作）
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default BaseControlRoom;
