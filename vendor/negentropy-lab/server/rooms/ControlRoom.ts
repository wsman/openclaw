/**
 * 🎛️ ControlRoom - Gateway状态同步房间
 * 
 * @constitution
 * §101 同步公理：代码变更必须触发文档更新
 * §102 熵减原则：所有变更必须降低或维持系统熵值
 * §109 观测回路公理：系统状态必须实时可观测
 * §152 单一真理源公理：状态同步基于唯一数据源
 * §321-§324 实时通信公理：WebSocket状态推送
 * 
 * @filename ControlRoom.ts
 * @version 1.0.0
 * @category rooms
 * @last_updated 2026-02-26
 * 
 * 功能：
 * - Gateway状态实时同步
 * - OpenClaw状态推送
 * - 系统健康度监控
 * - 宪法合规状态广播
 */

import { Room, Client } from "colyseus";
import { ArraySchema } from "@colyseus/schema";
import { ControlState, GatewayStatus, OpenClawStatus, ConstitutionCompliance } from "../schema/ControlState";
import { logger } from "../utils/logger";

/**
 * ControlRoom配置
 */
interface ControlRoomConfig {
  updateInterval: number;      // 状态更新间隔(ms)
  healthCheckInterval: number; // 健康检查间隔(ms)
  entropyThreshold: number;    // 熵值告警阈值
  complianceThreshold: number; // 合规率告警阈值
}

const DEFAULT_CONFIG: ControlRoomConfig = {
  updateInterval: 1000,        // 1秒
  healthCheckInterval: 5000,   // 5秒
  entropyThreshold: 0.3,       // 熵值>0.3告警
  complianceThreshold: 0.9,    // 合规率<90%告警
};

/**
 * 观测数据结构
 */
interface ObservationData {
  timestamp: number;
  metrics: {
    cpuUsage: number;
    memoryUsage: number;
    connectionCount: number;
    messageRate: number;
    entropyValue: number;
    complianceRate: number;
  };
  events: Array<{
    type: string;
    severity: 'info' | 'warning' | 'error';
    message: string;
    timestamp: number;
  }>;
}

/**
 * 🎛️ ControlRoom - 控制房间
 * 负责Gateway状态的实时同步和观测回路的核心实现
 */
export class ControlRoom extends Room<ControlState> {
  private config!: ControlRoomConfig;
  private observationHistory: ObservationData[] = [];
  private maxHistoryLength = 1000; // 保留最近1000条观测记录
  private lastHealthCheck = 0;
  private alertCount = 0;

  // 状态采集器引用
  private gatewayStatus!: GatewayStatus;
  private openClawStatus!: OpenClawStatus;

  onCreate(options: any) {
    logger.info(`[ControlRoom] 创建控制房间 ${this.roomId}...`);
    
    // 合并配置
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    
    // 初始化状态
    this.setState(new ControlState());
    this.state.roomId = this.roomId;
    this.state.createdAt = Date.now();
    this.state.lastUpdate = Date.now();
    
    // 初始化Gateway状态
    this.gatewayStatus = new GatewayStatus();
    this.gatewayStatus.status = "initializing";
    this.gatewayStatus.uptime = 0;
    this.gatewayStatus.activeConnections = 0;
    this.gatewayStatus.messageQueueSize = 0;
    this.gatewayStatus.requestRate = 0;
    this.gatewayStatus.errorRate = 0;
    this.state.gatewayStatus = this.gatewayStatus;
    
    // 初始化OpenClaw状态
    this.openClawStatus = new OpenClawStatus();
    this.openClawStatus.connected = false;
    this.openClawStatus.lastHeartbeat = 0;
    this.openClawStatus.pendingCommands = 0;
    this.openClawStatus.responseLatency = 0;
    this.state.openClawStatus = this.openClawStatus;
    
    // 初始化宪法合规状态
    this.state.compliance = new ConstitutionCompliance();
    this.state.compliance.overallRate = 1.0;
    this.state.compliance.codeCompliance = 1.0;
    this.state.compliance.docCompliance = 1.0;
    this.state.compliance.lastCheck = Date.now();
    
    // 设置状态更新循环
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), this.config.updateInterval);
    
    // 设置消息处理器
    this.setupMessageHandlers();
    
    logger.info(`[ControlRoom] 控制房间创建完成`);
  }

  /**
   * 设置消息处理器
   */
  private setupMessageHandlers() {
    this.onMessage("*", (client, type, message) => {
      const typeStr = String(type);
      
      switch (typeStr) {
        case "request_status":
          this.handleStatusRequest(client);
          break;
          
        case "request_observation":
          this.handleObservationRequest(client, message);
          break;
          
        case "update_gateway_config":
          this.handleGatewayConfigUpdate(client, message);
          break;
          
        case "subscribe_alerts":
          this.handleAlertSubscription(client, message);
          break;
          
        case "constitution_check":
          this.handleConstitutionCheck(client, message);
          break;
          
        default:
          logger.debug(`[ControlRoom] 未处理的消息类型：${typeStr}`);
      }
    });
  }

  /**
   * 处理状态请求
   */
  private handleStatusRequest(client: Client) {
    client.send("status_response", {
      gateway: this.gatewayStatus,
      openClaw: this.openClawStatus,
      compliance: this.state.compliance,
      timestamp: Date.now()
    });
  }

  /**
   * 处理观测数据请求
   */
  private handleObservationRequest(client: Client, message: any) {
    const { limit = 100, since = 0 } = message;
    
    const observations = this.observationHistory
      .filter(o => o.timestamp >= since)
      .slice(-limit);
    
    client.send("observation_response", {
      observations,
      total: this.observationHistory.length,
      timestamp: Date.now()
    });
  }

  /**
   * 处理Gateway配置更新
   */
  private handleGatewayConfigUpdate(client: Client, message: any) {
    // 验证权限（需要管理员权限）
    // TODO: 实现权限验证
    
    const { config } = message;
    if (!config) {
      client.send("error", { code: "invalid_config", message: "配置不能为空" });
      return;
    }
    
    logger.info(`[ControlRoom] 收到Gateway配置更新请求: ${JSON.stringify(config)}`);
    
    // 广播配置更新
    this.broadcast("gateway_config_updated", {
      config,
      updatedBy: client.sessionId,
      timestamp: Date.now()
    });
  }

  /**
   * 处理告警订阅
   */
  private handleAlertSubscription(client: Client, message: any) {
    const { types = [], threshold = {} } = message;
    
    // 存储订阅信息（简化实现）
    client.send("alert_subscription_confirmed", {
      types,
      threshold,
      timestamp: Date.now()
    });
    
    logger.info(`[ControlRoom] 客户端 ${client.sessionId} 订阅告警`);
  }

  /**
   * 处理宪法检查请求
   */
  private handleConstitutionCheck(client: Client, message: any) {
    const { scope = "all" } = message;
    
    // 触发宪法合规检查
    this.performConstitutionCheck();
    
    client.send("constitution_check_started", {
      scope,
      estimatedTime: 5000, // 预估5秒
      timestamp: Date.now()
    });
  }

  /**
   * 执行宪法合规检查
   */
  private performConstitutionCheck() {
    // 模拟合规检查结果
    // 实际实现会调用constitution-check.js脚本
    const compliance = this.state.compliance;
    
    // 模拟数据（实际应从脚本获取）
    compliance.codeCompliance = 1.0;
    compliance.docCompliance = 1.0;
    compliance.directoryCompliance = 1.0;
    compliance.overallRate = 1.0;
    compliance.lastCheck = Date.now();
    compliance.violations = new ArraySchema<string>();
    
    // 广播合规状态
    this.broadcast("compliance_updated", {
      compliance,
      timestamp: Date.now()
    });
  }

  /**
   * 主更新循环
   */
  private update(deltaTime: number) {
    const now = Date.now();
    
    // 更新Gateway状态
    this.updateGatewayStatus();
    
    // 更新OpenClaw状态
    this.updateOpenClawStatus();
    
    // 定期健康检查
    if (now - this.lastHealthCheck > this.config.healthCheckInterval) {
      this.performHealthCheck();
      this.lastHealthCheck = now;
    }
    
    // 记录观测数据
    this.recordObservation();
    
    // 检查告警条件
    this.checkAlertConditions();
    
    // 更新状态时间戳
    this.state.lastUpdate = now;
  }

  /**
   * 更新Gateway状态
   */
  private updateGatewayStatus() {
    // 模拟状态数据（实际应从Gateway服务获取）
    this.gatewayStatus.uptime = Date.now() - this.state.createdAt;
    
    // 模拟连接数波动
    const baseConnections = 50;
    const fluctuation = Math.floor(Math.random() * 10) - 5;
    this.gatewayStatus.activeConnections = Math.max(0, baseConnections + fluctuation);
    
    // 模拟请求率
    this.gatewayStatus.requestRate = 100 + Math.random() * 50;
    
    // 模拟错误率
    this.gatewayStatus.errorRate = Math.random() * 0.01; // 0-1%
    
    // 状态计算
    if (this.gatewayStatus.errorRate > 0.05) {
      this.gatewayStatus.status = "degraded";
    } else if (this.gatewayStatus.activeConnections === 0) {
      this.gatewayStatus.status = "idle";
    } else {
      this.gatewayStatus.status = "operational";
    }
    
    this.state.gatewayStatus = this.gatewayStatus;
  }

  /**
   * 更新OpenClaw状态
   */
  private updateOpenClawStatus() {
    // 模拟OpenClaw连接状态
    // 实际实现应该通过WebSocket/WebHook与OpenClaw通信
    const now = Date.now();
    
    // 模拟心跳检测
    if (this.openClawStatus.connected) {
      // 如果超过30秒没有心跳，标记为断开
      if (now - this.openClawStatus.lastHeartbeat > 30000) {
        this.openClawStatus.connected = false;
        logger.warn("[ControlRoom] OpenClaw心跳超时，标记为断开");
      }
    }
    
    // 模拟延迟
    this.openClawStatus.responseLatency = 10 + Math.random() * 20; // 10-30ms
    
    this.state.openClawStatus = this.openClawStatus;
  }

  /**
   * 执行健康检查
   */
  private performHealthCheck() {
    const issues: string[] = [];
    
    // 检查熵值
    if (this.state.systemEntropy > this.config.entropyThreshold) {
      issues.push(`系统熵值过高: ${this.state.systemEntropy.toFixed(3)}`);
    }
    
    // 检查合规率
    if (this.state.compliance.overallRate < this.config.complianceThreshold) {
      issues.push(`宪法合规率过低: ${(this.state.compliance.overallRate * 100).toFixed(1)}%`);
    }
    
    // 检查Gateway状态
    if (this.gatewayStatus.status === "degraded") {
      issues.push("Gateway状态降级");
    }
    
    // 检查OpenClaw连接
    if (!this.openClawStatus.connected) {
      issues.push("OpenClaw连接断开");
    }
    
    // 更新系统状态
    if (issues.length === 0) {
      this.state.systemStatus = "healthy";
      this.state.systemHealth = 1.0;
    } else if (issues.length <= 2) {
      this.state.systemStatus = "warning";
      this.state.systemHealth = 0.7;
    } else {
      this.state.systemStatus = "critical";
      this.state.systemHealth = 0.3;
    }
    
    // 如果有问题，广播告警
    if (issues.length > 0) {
      this.broadcast("system_alert", {
        severity: this.state.systemStatus,
        issues,
        timestamp: Date.now()
      });
      this.alertCount++;
    }
  }

  /**
   * 记录观测数据
   */
  private recordObservation() {
    const observation: ObservationData = {
      timestamp: Date.now(),
      metrics: {
        cpuUsage: 30 + Math.random() * 40, // 模拟30-70%
        memoryUsage: 40 + Math.random() * 30, // 模拟40-70%
        connectionCount: this.gatewayStatus.activeConnections,
        messageRate: this.gatewayStatus.requestRate,
        entropyValue: this.state.systemEntropy,
        complianceRate: this.state.compliance.overallRate
      },
      events: [] // 事件在performHealthCheck中收集
    };
    
    this.observationHistory.push(observation);
    
    // 限制历史长度
    if (this.observationHistory.length > this.maxHistoryLength) {
      this.observationHistory.shift();
    }
  }

  /**
   * 检查告警条件
   */
  private checkAlertConditions() {
    // 熵值告警
    if (this.state.systemEntropy > this.config.entropyThreshold) {
      this.broadcast("entropy_alert", {
        value: this.state.systemEntropy,
        threshold: this.config.entropyThreshold,
        timestamp: Date.now()
      });
    }
    
    // 合规率告警
    if (this.state.compliance.overallRate < this.config.complianceThreshold) {
      this.broadcast("compliance_alert", {
        value: this.state.compliance.overallRate,
        threshold: this.config.complianceThreshold,
        timestamp: Date.now()
      });
    }
  }

  /**
   * 外部接口：更新OpenClaw心跳
   */
  public updateOpenClawHeartbeat(latency: number) {
    this.openClawStatus.connected = true;
    this.openClawStatus.lastHeartbeat = Date.now();
    this.openClawStatus.responseLatency = latency;
  }

  /**
   * 外部接口：推送系统事件
   */
  public pushSystemEvent(event: { type: string; severity: 'info' | 'warning' | 'error'; message: string }) {
    this.broadcast("system_event", {
      ...event,
      timestamp: Date.now()
    });
  }

  onJoin(client: Client, options: any) {
    logger.info(`[ControlRoom] 客户端 ${client.sessionId} 加入控制房间`);
    
    // 发送当前状态
    client.send("control_state", {
      gateway: this.gatewayStatus,
      openClaw: this.openClawStatus,
      compliance: this.state.compliance,
      systemStatus: this.state.systemStatus,
      systemHealth: this.state.systemHealth,
      observationCount: this.observationHistory.length,
      alertCount: this.alertCount,
      timestamp: Date.now()
    });
    
    // 广播客户端加入
    this.broadcast("client_joined", {
      sessionId: client.sessionId,
      timestamp: Date.now()
    }, { except: client });
  }

  onLeave(client: Client, consented: boolean) {
    logger.info(`[ControlRoom] 客户端 ${client.sessionId} 离开控制房间 (consented: ${consented})`);
    
    this.broadcast("client_left", {
      sessionId: client.sessionId,
      consented,
      timestamp: Date.now()
    });
  }

  onDispose() {
    logger.info(`[ControlRoom] 销毁控制房间 ${this.roomId}`);
    
    // 清理观测历史
    this.observationHistory = [];
  }
}

export default ControlRoom;