import { Room, Client } from "colyseus";
import { ArraySchema } from "@colyseus/schema";
import { ControlState, GatewayStatus, OpenClawStatus, ConstitutionCompliance } from "../schema/ControlState";
import { getAuthorityRuntime } from "../runtime/authorityRuntime";
import { MutationProposalInput } from "../services/authority/types";
import { logger } from "../utils/logger";

interface ControlRoomConfig {
  updateInterval: number;
  healthCheckInterval: number;
  entropyThreshold: number;
  complianceThreshold: number;
}

const DEFAULT_CONFIG: ControlRoomConfig = {
  updateInterval: 1000,
  healthCheckInterval: 5000,
  entropyThreshold: 0.3,
  complianceThreshold: 0.9,
};

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
    severity: "info" | "warning" | "error";
    message: string;
    timestamp: number;
  }>;
}

export class ControlRoom extends Room<ControlState> {
  private config!: ControlRoomConfig;
  private observationHistory: ObservationData[] = [];
  private maxHistoryLength = 1000;
  private lastHealthCheck = 0;
  private alertCount = 0;
  private gatewayStatus!: GatewayStatus;
  private openClawStatus!: OpenClawStatus;

  onCreate(options: any) {
    logger.info(`[ControlRoom] Creating control room ${this.roomId}...`);

    this.config = { ...DEFAULT_CONFIG, ...(options?.config || {}) };

    this.setState(new ControlState());
    this.state.roomId = this.roomId;
    this.state.createdAt = Date.now();
    this.state.lastUpdate = Date.now();

    this.gatewayStatus = new GatewayStatus();
    this.gatewayStatus.status = "initializing";
    this.gatewayStatus.uptime = 0;
    this.gatewayStatus.activeConnections = 0;
    this.gatewayStatus.messageQueueSize = 0;
    this.gatewayStatus.requestRate = 0;
    this.gatewayStatus.errorRate = 0;
    this.state.gatewayStatus = this.gatewayStatus;

    this.openClawStatus = new OpenClawStatus();
    this.openClawStatus.connected = false;
    this.openClawStatus.lastHeartbeat = 0;
    this.openClawStatus.pendingCommands = 0;
    this.openClawStatus.responseLatency = 0;
    this.state.openClawStatus = this.openClawStatus;

    this.state.compliance = new ConstitutionCompliance();
    this.state.compliance.overallRate = 1.0;
    this.state.compliance.codeCompliance = 1.0;
    this.state.compliance.docCompliance = 1.0;
    this.state.compliance.directoryCompliance = 1.0;
    this.state.compliance.lastCheck = Date.now();

    this.setupMessageHandlers();
    this.syncFromAuthority();
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), this.config.updateInterval);

    logger.info("[ControlRoom] Control room ready");
  }

  private setupMessageHandlers() {
    this.onMessage("*", (client, type, message) => {
      switch (String(type)) {
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
          logger.debug(`[ControlRoom] Unhandled message type: ${String(type)}`);
      }
    });
  }

  private handleStatusRequest(client: Client) {
    this.syncFromAuthority();
    client.send("status_response", {
      gateway: this.gatewayStatus,
      openClaw: this.openClawStatus,
      compliance: this.state.compliance,
      timestamp: Date.now(),
    });
  }

  private handleObservationRequest(client: Client, message: any) {
    const limit = Math.max(1, Math.min(500, Number(message?.limit || 100)));
    const since = Number(message?.since || 0);
    const observations = this.observationHistory.filter((entry) => entry.timestamp >= since).slice(-limit);

    client.send("observation_response", {
      observations,
      total: this.observationHistory.length,
      timestamp: Date.now(),
    });
  }

  private handleGatewayConfigUpdate(client: Client, message: any) {
    const config = message?.config;
    if (!config) {
      client.send("error", { code: "invalid_config", message: "Config is required" });
      return;
    }

    try {
      this.commitAuthorityMutation({
        proposer: `session:${client.sessionId}`,
        targetPath: "governance.policies.gateway_config",
        operation: "update",
        payload: JSON.stringify(config),
        reason: "control_room_gateway_config_update",
      });
      this.commitAuthorityMutation({
        proposer: `session:${client.sessionId}`,
        targetPath: "governance.policies.gateway_config_updated_by",
        operation: "update",
        payload: client.sessionId,
        reason: "control_room_gateway_config_update",
      });
      this.commitAuthorityMutation({
        proposer: `session:${client.sessionId}`,
        targetPath: "governance.policies.gateway_config_updated_at",
        operation: "update",
        payload: String(Date.now()),
        reason: "control_room_gateway_config_update",
      });

      this.broadcast("gateway_config_updated", {
        config,
        updatedBy: client.sessionId,
        timestamp: Date.now(),
      });
    } catch (error: any) {
      client.send("error", { code: "config_update_failed", message: error.message });
    }
  }

  private handleAlertSubscription(client: Client, message: any) {
    client.send("alert_subscription_confirmed", {
      types: Array.isArray(message?.types) ? message.types : [],
      threshold: message?.threshold || {},
      timestamp: Date.now(),
    });
  }

  private handleConstitutionCheck(client: Client, message: any) {
    const scope = String(message?.scope || "all");
    this.performConstitutionCheck();
    client.send("constitution_check_started", {
      scope,
      estimatedTime: 5000,
      timestamp: Date.now(),
    });
  }

  private performConstitutionCheck() {
    this.syncFromAuthority();
    const compliance = this.state.compliance;
    compliance.codeCompliance = this.state.compliance.codeCompliance;
    compliance.docCompliance = this.state.compliance.docCompliance;
    compliance.directoryCompliance = this.state.compliance.directoryCompliance;
    compliance.overallRate = this.state.compliance.overallRate;
    compliance.lastCheck = Date.now();
    compliance.violations = new ArraySchema<string>();

    this.broadcast("compliance_updated", {
      compliance,
      timestamp: Date.now(),
    });
  }

  private update(_deltaTime: number) {
    const now = Date.now();

    this.syncFromAuthority();
    this.updateOpenClawStatus();

    if (now - this.lastHealthCheck > this.config.healthCheckInterval) {
      this.performHealthCheck();
      this.lastHealthCheck = now;
    }

    this.recordObservation();
    this.checkAlertConditions();
    this.state.lastUpdate = now;
  }

  private syncFromAuthority() {
    const runtime = getAuthorityRuntime();
    runtime.entropyEngine.recalculate();
    runtime.breakerService.evaluate();
    runtime.projectionService.syncControlState(this.state);
    this.gatewayStatus = this.state.gatewayStatus;
  }

  private updateOpenClawStatus() {
    const now = Date.now();
    if (this.openClawStatus.connected && now - this.openClawStatus.lastHeartbeat > 30000) {
      this.openClawStatus.connected = false;
      logger.warn("[ControlRoom] OpenClaw heartbeat timed out");
    }

    this.openClawStatus.responseLatency = this.openClawStatus.connected
      ? this.openClawStatus.responseLatency || 15
      : 0;
    this.state.openClawStatus = this.openClawStatus;
  }

  private performHealthCheck() {
    const issues: string[] = [];

    if (this.state.systemEntropy > this.config.entropyThreshold) {
      issues.push(`entropy:${this.state.systemEntropy.toFixed(3)}`);
    }
    if (this.state.compliance.overallRate < this.config.complianceThreshold) {
      issues.push(`compliance:${(this.state.compliance.overallRate * 100).toFixed(1)}%`);
    }
    if (this.gatewayStatus.status === "degraded") {
      issues.push("gateway_degraded");
    }
    if (!this.openClawStatus.connected) {
      issues.push("openclaw_disconnected");
    }

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

    if (issues.length > 0) {
      this.broadcast("system_alert", {
        severity: this.state.systemStatus,
        issues,
        timestamp: Date.now(),
      });
      this.alertCount += 1;
    }
  }

  private recordObservation() {
    const observation: ObservationData = {
      timestamp: Date.now(),
      metrics: {
        cpuUsage: 20 + this.state.systemEntropy * 50,
        memoryUsage: 30 + this.state.systemEntropy * 40,
        connectionCount: this.gatewayStatus.activeConnections,
        messageRate: this.gatewayStatus.requestRate,
        entropyValue: this.state.systemEntropy,
        complianceRate: this.state.compliance.overallRate,
      },
      events: [],
    };

    this.observationHistory.push(observation);
    if (this.observationHistory.length > this.maxHistoryLength) {
      this.observationHistory.shift();
    }
  }

  private checkAlertConditions() {
    if (this.state.systemEntropy > this.config.entropyThreshold) {
      this.broadcast("entropy_alert", {
        value: this.state.systemEntropy,
        threshold: this.config.entropyThreshold,
        timestamp: Date.now(),
      });
    }

    if (this.state.compliance.overallRate < this.config.complianceThreshold) {
      this.broadcast("compliance_alert", {
        value: this.state.compliance.overallRate,
        threshold: this.config.complianceThreshold,
        timestamp: Date.now(),
      });
    }
  }

  public updateOpenClawHeartbeat(latency: number) {
    this.openClawStatus.connected = true;
    this.openClawStatus.lastHeartbeat = Date.now();
    this.openClawStatus.responseLatency = latency;
  }

  public pushSystemEvent(event: { type: string; severity: "info" | "warning" | "error"; message: string }) {
    this.broadcast("system_event", {
      ...event,
      timestamp: Date.now(),
    });
  }

  onJoin(client: Client) {
    this.syncFromAuthority();
    logger.info(`[ControlRoom] Client ${client.sessionId} joined`);

    client.send("control_state", {
      gateway: this.gatewayStatus,
      openClaw: this.openClawStatus,
      compliance: this.state.compliance,
      systemStatus: this.state.systemStatus,
      systemHealth: this.state.systemHealth,
      observationCount: this.observationHistory.length,
      alertCount: this.alertCount,
      timestamp: Date.now(),
    });
  }

  onLeave(client: Client) {
    logger.info(`[ControlRoom] Client ${client.sessionId} left`);
  }

  onDispose() {
    logger.info(`[ControlRoom] Disposing room ${this.roomId}`);
  }

  private commitAuthorityMutation(proposal: MutationProposalInput) {
    const result = getAuthorityRuntime().mutationPipeline.propose(proposal);
    if (!result.ok) {
      throw new Error(result.error || "authority mutation rejected");
    }
    return result;
  }
}

export default ControlRoom;
