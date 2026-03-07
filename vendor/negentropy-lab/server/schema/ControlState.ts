/**
 * 🎛️ ControlState - 控制房间状态 Schema
 * 
 * @constitution
 * §101 同步公理：代码变更必须触发文档更新
 * §102 熵减原则：所有变更必须降低或维持系统熵值
 * §109 观测回路公理：系统状态必须实时可观测
 * §152 单一真理源公理：状态同步基于唯一数据源
 * 
 * @filename ControlState.ts
 * @version 1.0.0
 * @category schema
 * @last_updated 2026-02-26
 */

import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

/**
 * Gateway状态 Schema
 */
export class GatewayStatus extends Schema {
  @type("string") status: string = "initializing"; // "initializing" | "operational" | "degraded" | "idle"
  @type("number") uptime: number = 0;
  @type("number") activeConnections: number = 0;
  @type("number") messageQueueSize: number = 0;
  @type("number") requestRate: number = 0; // requests/second
  @type("number") errorRate: number = 0; // 0.0 - 1.0
  @type("number") lastRequestTime: number = 0;
  @type({ map: "string" }) metadata = new MapSchema<string>();
}

/**
 * OpenClaw状态 Schema
 */
export class OpenClawStatus extends Schema {
  @type("boolean") connected: boolean = false;
  @type("number") lastHeartbeat: number = 0;
  @type("number") pendingCommands: number = 0;
  @type("number") responseLatency: number = 0; // ms
  @type("string") version: string = "unknown";
  @type("string") status: string = "disconnected"; // "connected" | "disconnected" | "error"
  @type({ map: "string" }) capabilities = new MapSchema<string>();
}

/**
 * 宪法合规状态 Schema
 */
export class ConstitutionCompliance extends Schema {
  @type("number") overallRate: number = 1.0; // 0.0 - 1.0
  @type("number") codeCompliance: number = 1.0;
  @type("number") docCompliance: number = 1.0;
  @type("number") directoryCompliance: number = 1.0;
  @type("number") lastCheck: number = 0;
  @type({ array: "string" }) violations = new ArraySchema<string>();
  @type({ map: "string" }) details = new MapSchema<string>();
}

/**
 * 系统告警 Schema
 */
export class SystemAlert extends Schema {
  @type("string") id: string = "";
  @type("string") severity: string = "info"; // "info" | "warning" | "error" | "critical"
  @type("string") type: string = "";
  @type("string") message: string = "";
  @type("number") timestamp: number = 0;
  @type("boolean") acknowledged: boolean = false;
  @type("string") source: string = "";
  @type({ map: "string" }) context = new MapSchema<string>();
}

/**
 * 性能指标 Schema
 */
export class PerformanceMetrics extends Schema {
  @type("number") cpuUsage: number = 0; // 0-100%
  @type("number") memoryUsage: number = 0; // 0-100%
  @type("number") networkIn: number = 0; // bytes/sec
  @type("number") networkOut: number = 0; // bytes/sec
  @type("number") diskUsage: number = 0; // 0-100%
  @type("number") avgResponseTime: number = 0; // ms
  @type("number") throughput: number = 0; // requests/sec
  @type("number") errorCount: number = 0;
  @type("number") timestamp: number = 0;
}

/**
 * 控制房间主状态 Schema
 */
export class ControlState extends Schema {
  // === 房间信息 ===
  @type("string") roomId: string = "";
  @type("number") createdAt: number = 0;
  @type("number") lastUpdate: number = 0;
  
  // === 组件状态 ===
  @type(GatewayStatus) gatewayStatus: GatewayStatus = new GatewayStatus();
  @type(OpenClawStatus) openClawStatus: OpenClawStatus = new OpenClawStatus();
  @type(ConstitutionCompliance) compliance: ConstitutionCompliance = new ConstitutionCompliance();
  
  // === 系统状态 ===
  @type("string") systemStatus: string = "healthy"; // "healthy" | "warning" | "critical"
  @type("number") systemHealth: number = 1.0; // 0.0 - 1.0
  @type("number") systemEntropy: number = 0.0; // 0.0 - 1.0 (越低越好)
  
  // === 告警管理 ===
  @type({ array: SystemAlert }) activeAlerts = new ArraySchema<SystemAlert>();
  @type("number") totalAlerts: number = 0;
  @type("number") unacknowledgedAlerts: number = 0;
  
  // === 性能指标 ===
  @type(PerformanceMetrics) performance = new PerformanceMetrics();
  
  // === 客户端管理 ===
  @type("number") connectedClients: number = 0;
  @type({ map: "string" }) clientInfo = new MapSchema<string>();
  
  // === 观测回路状态 ===
  @type("number") observationCount: number = 0;
  @type("number") lastObservationTime: number = 0;
  @type("boolean") observationLoopActive: boolean = true;
  
  /**
   * 添加告警
   */
  addAlert(alert: SystemAlert): void {
    this.activeAlerts.push(alert);
    this.totalAlerts++;
    this.unacknowledgedAlerts++;
    
    // 限制活跃告警数量
    if (this.activeAlerts.length > 100) {
      // 移除已确认的旧告警
      const unacknowledged = this.activeAlerts.filter(a => !a.acknowledged);
      this.activeAlerts.clear();
      unacknowledged.forEach(a => this.activeAlerts.push(a));
    }
  }
  
  /**
   * 确认告警
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.find(a => a.id === alertId);
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      this.unacknowledgedAlerts = Math.max(0, this.unacknowledgedAlerts - 1);
      return true;
    }
    return false;
  }
  
  /**
   * 更新系统健康度
   */
  updateSystemHealth(health: number): void {
    this.systemHealth = Math.max(0, Math.min(1, health));
    
    if (this.systemHealth >= 0.8) {
      this.systemStatus = "healthy";
    } else if (this.systemHealth >= 0.5) {
      this.systemStatus = "warning";
    } else {
      this.systemStatus = "critical";
    }
  }
  
  /**
   * 更新熵值
   */
  updateEntropy(entropy: number): void {
    this.systemEntropy = Math.max(0, Math.min(1, entropy));
  }
}