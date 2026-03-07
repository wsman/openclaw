/**
 * 🌐 NodeState - 节点状态 Schema
 * 
 * @constitution
 * §101 同步公理：代码变更必须触发文档更新
 * §102 熵减原则：所有变更必须降低或维持系统熵值
 * §109 观测回路公理：系统状态必须实时可观测
 * §152 单一真理源公理：状态同步基于唯一数据源
 * 
 * @filename NodeState.ts
 * @version 1.0.0
 * @category schema
 * @last_updated 2026-02-26
 */

import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

/**
 * 节点资源指标 Schema
 */
export class NodeResources extends Schema {
  @type("number") cpuCores: number = 0;
  @type("number") cpuUsage: number = 0; // 0-100%
  @type("number") memoryTotal: number = 0; // bytes
  @type("number") memoryUsed: number = 0; // bytes
  @type("number") memoryUsage: number = 0; // 0-100%
  @type("number") diskTotal: number = 0; // bytes
  @type("number") diskUsed: number = 0; // bytes
  @type("number") diskUsage: number = 0; // 0-100%
  @type("number") networkIn: number = 0; // bytes/sec
  @type("number") networkOut: number = 0; // bytes/sec
}

/**
 * 节点能力 Schema
 */
export class NodeCapabilities extends Schema {
  @type("boolean") canSpawnAgents: boolean = true;
  @type("boolean") canProcessLLM: boolean = false;
  @type("boolean") canStoreData: boolean = false;
  @type("boolean") canRoute: boolean = true;
  @type({ array: "string" }) supportedModels = new ArraySchema<string>();
  @type({ map: "string" }) extensions = new MapSchema<string>();
}

/**
 * 单个节点状态 Schema
 */
export class NodeState extends Schema {
  // === 基本身份 ===
  @type("string") id: string = "";
  @type("string") name: string = "";
  @type("string") type: string = "worker"; // "master" | "worker" | "observer" | "edge"
  
  // === 网络信息 ===
  @type("string") host: string = "";
  @type("number") port: number = 0;
  @type("string") ipAddress: string = "";
  @type("string") region: string = "default";
  
  // === 状态信息 ===
  @type("string") status: string = "offline"; // "online" | "offline" | "busy" | "maintenance" | "error"
  @type("boolean") available: boolean = false;
  @type("number") lastHeartbeat: number = 0;
  @type("number") uptime: number = 0; // seconds
  
  // === 资源指标 ===
  @type(NodeResources) resources: NodeResources = new NodeResources();
  
  // === 能力 ===
  @type(NodeCapabilities) capabilities: NodeCapabilities = new NodeCapabilities();
  
  // === 负载信息 ===
  @type("number") loadFactor: number = 0; // 0.0 - 1.0
  @type("number") activeConnections: number = 0;
  @type("number") activeAgents: number = 0;
  @type("number") pendingTasks: number = 0;
  
  // === 时间戳 ===
  @type("number") createdAt: number = 0;
  @type("number") lastUpdate: number = 0;
  
  // === 元数据 ===
  @type("string") version: string = "";
  @type({ map: "string" }) metadata = new MapSchema<string>();
  @type({ array: "string" }) tags = new ArraySchema<string>();
}

/**
 * 节点连接 Schema
 */
export class NodeConnection extends Schema {
  @type("string") id: string = "";
  @type("string") sourceNodeId: string = "";
  @type("string") targetNodeId: string = "";
  @type("string") type: string = "mesh"; // "mesh" | "hierarchical" | "peer"
  @type("string") status: string = "active"; // "active" | "inactive" | "degraded"
  @type("number") latency: number = 0; // ms
  @type("number") bandwidth: number = 0; // bytes/sec
  @type("number") establishedAt: number = 0;
  @type("number") lastActivity: number = 0;
}

/**
 * 节点拓扑 Schema
 */
export class NodeTopology extends Schema {
  // === 房间信息 ===
  @type("string") roomId: string = "";
  @type("number") createdAt: number = 0;
  @type("number") lastUpdate: number = 0;
  
  // === 节点集合 ===
  @type({ map: NodeState }) nodes = new MapSchema<NodeState>();
  
  // === 连接集合 ===
  @type({ map: NodeConnection }) connections = new MapSchema<NodeConnection>();
  
  // === 统计信息 ===
  @type("number") totalNodes: number = 0;
  @type("number") onlineNodes: number = 0;
  @type("number") totalConnections: number = 0;
  @type("number") activeConnections: number = 0;
  
  // === 系统状态 ===
  @type("string") topologyStatus: string = "healthy"; // "healthy" | "degraded" | "critical"
  @type("number") aggregateLoad: number = 0; // 0.0 - 1.0
  @type("number") aggregateCpu: number = 0;
  @type("number") aggregateMemory: number = 0;
  
  /**
   * 获取在线节点数量
   */
  getOnlineNodeCount(): number {
    let count = 0;
    this.nodes.forEach((node: NodeState) => {
      if (node.status === "online" || node.status === "busy") {
        count++;
      }
    });
    return count;
  }
  
  /**
   * 获取指定区域的节点
   */
  getNodesByRegion(region: string): NodeState[] {
    const result: NodeState[] = [];
    this.nodes.forEach((node: NodeState) => {
      if (node.region === region) {
        result.push(node);
      }
    });
    return result;
  }
  
  /**
   * 获取最空闲的节点
   */
  getIdleNode(): NodeState | null {
    let idlest: NodeState | null = null;
    let lowestLoad = 1.0;
    
    this.nodes.forEach((node: NodeState) => {
      if (node.available && node.loadFactor < lowestLoad) {
        lowestLoad = node.loadFactor;
        idlest = node;
      }
    });
    
    return idlest;
  }
  
  /**
   * 计算聚合负载
   */
  calculateAggregateLoad(): number {
    let totalLoad = 0;
    let count = 0;
    
    this.nodes.forEach((node: NodeState) => {
      if (node.status === "online" || node.status === "busy") {
        totalLoad += node.loadFactor;
        count++;
      }
    });
    
    this.aggregateLoad = count > 0 ? totalLoad / count : 0;
    return this.aggregateLoad;
  }
  
  /**
   * 更新拓扑状态
   */
  updateTopologyStatus(): void {
    this.calculateAggregateLoad();
    const onlineRatio = this.getOnlineNodeCount() / (this.totalNodes || 1);
    
    if (onlineRatio >= 0.8 && this.aggregateLoad < 0.7) {
      this.topologyStatus = "healthy";
    } else if (onlineRatio >= 0.5 && this.aggregateLoad < 0.9) {
      this.topologyStatus = "degraded";
    } else {
      this.topologyStatus = "critical";
    }
  }
}