/**
 * 🌐 NodeRoom - 节点拓扑管理房间
 * 
 * @constitution
 * §101 同步公理：代码变更必须触发文档更新
 * §102 熵减原则：所有变更必须降低或维持系统熵值
 * §109 观测回路公理：系统状态必须实时可观测
 * §152 单一真理源公理：状态同步基于唯一数据源
 * 
 * @filename NodeRoom.ts
 * @version 1.0.0
 * @category rooms
 * @last_updated 2026-02-26
 * 
 * 功能：
 * - 节点拓扑管理（注册/注销/健康检查）
 * - 节点发现和状态同步
 * - 负载均衡支持
 * - 跨节点通信路由
 */

import { Room, Client } from "colyseus";
import { NodeTopology, NodeState, NodeConnection, NodeResources, NodeCapabilities } from "../schema/NodeState";
import { logger } from "../utils/logger";
import { v4 as uuidv4 } from "uuid";
import { getClusterRuntime } from "../cluster/runtime";
import { ClusterNodeRecord } from "../cluster/types";

/**
 * NodeRoom配置
 */
interface NodeRoomConfig {
  heartbeatInterval: number;
  heartbeatTimeout: number;
  maxNodes: number;
  enableAutoDiscovery: boolean;
}

const DEFAULT_CONFIG: NodeRoomConfig = {
  heartbeatInterval: 10000, // 10秒
  heartbeatTimeout: 30000, // 30秒
  maxNodes: 100,
  enableAutoDiscovery: true,
};

/**
 * 🌐 NodeRoom - 节点拓扑管理房间
 * 负责节点发现、状态同步和拓扑管理
 */
export class NodeRoom extends Room<NodeTopology> {
  private config!: NodeRoomConfig;
  private lastHealthCheck = 0;
  private nodeClientMap: Map<string, string> = new Map(); // nodeId -> sessionId

  onCreate(options: any) {
    logger.info(`[NodeRoom] 创建节点拓扑管理房间 ${this.roomId}...`);
    
    // 合并配置
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    
    // 初始化状态
    this.setState(new NodeTopology());
    this.state.roomId = this.roomId;
    this.state.createdAt = Date.now();
    this.state.lastUpdate = Date.now();
    
    // 设置更新循环
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 1000);
    
    // 设置消息处理器
    this.setupMessageHandlers();
    
    // 初始化本地节点
    this.initializeLocalNode();
    this.syncFromClusterRuntime();
    
    logger.info(`[NodeRoom] 节点拓扑管理房间创建完成`);
  }

  /**
   * 设置消息处理器
   */
  private setupMessageHandlers() {
    this.onMessage("*", (client, type, message) => {
      const typeStr = String(type);
      
      switch (typeStr) {
        case "register_node":
          this.handleRegisterNode(client, message);
          break;
          
        case "unregister_node":
          this.handleUnregisterNode(client, message);
          break;
          
        case "heartbeat":
          this.handleHeartbeat(client, message);
          break;
          
        case "update_resources":
          this.handleUpdateResources(client, message);
          break;
          
        case "request_topology":
          this.handleTopologyRequest(client);
          break;
          
        case "request_route":
          this.handleRouteRequest(client, message);
          break;
          
        case "broadcast_to_nodes":
          this.handleBroadcastToNodes(client, message);
          break;
          
        default:
          logger.debug(`[NodeRoom] 未处理的消息类型：${typeStr}`);
      }
    });
  }

  /**
   * 初始化本地节点
   */
  private initializeLocalNode() {
    const localNode = new NodeState();
    localNode.id = "node:local";
    localNode.name = "Local Gateway Node";
    localNode.type = "master";
    localNode.host = "localhost";
    localNode.port = 2567;
    localNode.ipAddress = "127.0.0.1";
    localNode.region = "default";
    localNode.status = "online";
    localNode.available = true;
    localNode.lastHeartbeat = Date.now();
    localNode.uptime = 0;
    localNode.createdAt = Date.now();
    localNode.version = "1.0.0";
    
    // 设置资源
    localNode.resources = new NodeResources();
    localNode.resources.cpuCores = 4;
    localNode.resources.cpuUsage = 0;
    localNode.resources.memoryTotal = 8 * 1024 * 1024 * 1024; // 8GB
    localNode.resources.memoryUsed = 0;
    localNode.resources.memoryUsage = 0;
    
    // 设置能力
    localNode.capabilities = new NodeCapabilities();
    localNode.capabilities.canSpawnAgents = true;
    localNode.capabilities.canProcessLLM = true;
    localNode.capabilities.canRoute = true;
    
    this.state.nodes.set(localNode.id, localNode);
    this.state.totalNodes++;
    this.state.onlineNodes++;
    
    logger.info(`[NodeRoom] 本地节点初始化完成: ${localNode.id}`);
  }

  /**
   * 处理节点注册
   */
  private handleRegisterNode(client: Client, message: any) {
    const { name, type, host, port, ipAddress, region, capabilities, metadata } = message;
    
    if (!name || !type) {
      client.send("error", { code: "invalid_request", message: "缺少必要参数" });
      return;
    }
    
    // 检查节点数量限制
    if (this.state.nodes.size >= this.config.maxNodes) {
      client.send("error", { code: "node_limit_reached", message: "已达最大节点数量" });
      return;
    }
    
    const nodeId = `node:${uuidv4()}`;
    
    // 创建节点
    const node = new NodeState();
    node.id = nodeId;
    node.name = name;
    node.type = type;
    node.host = host || "unknown";
    node.port = port || 0;
    node.ipAddress = ipAddress || "unknown";
    node.region = region || "default";
    node.status = "online";
    node.available = true;
    node.lastHeartbeat = Date.now();
    node.uptime = 0;
    node.createdAt = Date.now();
    node.version = metadata?.version || "unknown";
    
    // 设置资源
    node.resources = new NodeResources();
    if (message.resources) {
      Object.assign(node.resources, message.resources);
    }
    
    // 设置能力
    node.capabilities = new NodeCapabilities();
    if (capabilities) {
      Object.assign(node.capabilities, capabilities);
    }
    
    // 添加到拓扑
    this.state.nodes.set(nodeId, node);
    this.state.totalNodes++;
    this.state.onlineNodes++;
    
    // 记录客户端映射
    this.nodeClientMap.set(nodeId, client.sessionId);
    
    // 发送注册成功
    client.send("node_registered", {
      nodeId,
      topology: {
        totalNodes: this.state.totalNodes,
        onlineNodes: this.state.onlineNodes,
      },
      timestamp: Date.now()
    });
    
    // 广播节点加入
    this.broadcast("node_event", {
      event: "joined",
      nodeId,
      name,
      type,
      timestamp: Date.now()
    }, { except: client });
    
    logger.info(`[NodeRoom] 节点注册成功: ${name} (${nodeId})`);
  }

  /**
   * 处理节点注销
   */
  private handleUnregisterNode(client: Client, message: any) {
    const { nodeId, reason = "manual" } = message;
    
    const node = this.state.nodes.get(nodeId);
    if (!node) {
      client.send("error", { code: "node_not_found", message: `节点 ${nodeId} 不存在` });
      return;
    }
    
    this.unregisterNode(nodeId, reason);
    
    client.send("node_unregistered", {
      nodeId,
      reason,
      timestamp: Date.now()
    });
  }

  /**
   * 注销节点
   */
  private unregisterNode(nodeId: string, reason: string) {
    const node = this.state.nodes.get(nodeId);
    if (!node) return;
    
    node.status = "offline";
    node.available = false;
    node.lastUpdate = Date.now();
    
    // 更新统计
    this.state.onlineNodes--;
    
    // 移除客户端映射
    this.nodeClientMap.delete(nodeId);
    
    // 移除相关连接
    const connectionsToRemove: string[] = [];
    this.state.connections.forEach((conn, connId) => {
      if (conn.sourceNodeId === nodeId || conn.targetNodeId === nodeId) {
        connectionsToRemove.push(connId);
      }
    });
    connectionsToRemove.forEach(connId => {
      this.state.connections.delete(connId);
      this.state.activeConnections--;
    });
    
    // 广播节点离开
    this.broadcast("node_event", {
      event: "left",
      nodeId,
      name: node.name,
      reason,
      timestamp: Date.now()
    });
    
    logger.info(`[NodeRoom] 节点注销: ${node.name} (${nodeId}), 原因: ${reason}`);
  }

  /**
   * 处理心跳
   */
  private handleHeartbeat(client: Client, message: any) {
    const { nodeId, resources, loadFactor, activeConnections, activeAgents } = message;
    
    const node = this.state.nodes.get(nodeId);
    if (!node) {
      client.send("error", { code: "node_not_found", message: `节点 ${nodeId} 不存在` });
      return;
    }
    
    // 更新心跳时间
    node.lastHeartbeat = Date.now();
    node.lastUpdate = Date.now();
    node.status = "online";
    node.available = true;
    
    // 更新资源
    if (resources) {
      Object.assign(node.resources, resources);
    }
    
    // 更新负载
    if (loadFactor !== undefined) {
      node.loadFactor = loadFactor;
    }
    if (activeConnections !== undefined) {
      node.activeConnections = activeConnections;
    }
    if (activeAgents !== undefined) {
      node.activeAgents = activeAgents;
    }
    
    // 发送心跳响应
    client.send("heartbeat_ack", {
      nodeId,
      serverTime: Date.now(),
      topologyStatus: this.state.topologyStatus,
      timestamp: Date.now()
    });
  }

  /**
   * 处理资源更新
   */
  private handleUpdateResources(client: Client, message: any) {
    const { nodeId, resources } = message;
    
    const node = this.state.nodes.get(nodeId);
    if (!node) {
      client.send("error", { code: "node_not_found", message: `节点 ${nodeId} 不存在` });
      return;
    }
    
    if (resources) {
      Object.assign(node.resources, resources);
      node.lastUpdate = Date.now();
    }
    
    client.send("resources_updated", {
      nodeId,
      timestamp: Date.now()
    });
  }

  /**
   * 处理拓扑请求
   */
  private handleTopologyRequest(client: Client) {
    client.send("topology_snapshot", {
      nodes: Array.from(this.state.nodes.values()),
      connections: Array.from(this.state.connections.values()),
      stats: {
        totalNodes: this.state.totalNodes,
        onlineNodes: this.state.onlineNodes,
        totalConnections: this.state.totalConnections,
        activeConnections: this.state.activeConnections,
        aggregateLoad: this.state.aggregateLoad,
        topologyStatus: this.state.topologyStatus,
      },
      timestamp: Date.now()
    });
  }

  /**
   * 处理路由请求
   */
  private handleRouteRequest(client: Client, message: any) {
    const { targetNodeId, targetCapability, preferLowestLatency = true } = message;
    
    let targetNode: NodeState | null = null;
    
    if (targetNodeId) {
      // 指定目标节点
      targetNode = this.state.nodes.get(targetNodeId) || null;
    } else if (targetCapability) {
      // 按能力查找
      this.state.nodes.forEach((node: NodeState) => {
        if (node.available && node.capabilities) {
          const capKey = targetCapability as keyof NodeCapabilities;
          if (node.capabilities[capKey] === true) {
            if (!targetNode || (preferLowestLatency && node.loadFactor < targetNode.loadFactor)) {
              targetNode = node;
            }
          }
        }
      });
    } else {
      // 获取最空闲节点
      targetNode = this.state.getIdleNode();
    }
    
    if (!targetNode) {
      client.send("route_error", {
        error: "no_available_node",
        message: "没有可用的目标节点",
        timestamp: Date.now()
      });
      return;
    }
    
    client.send("route_response", {
      targetNodeId: targetNode.id,
      targetNode: {
        id: targetNode.id,
        name: targetNode.name,
        host: targetNode.host,
        port: targetNode.port,
        loadFactor: targetNode.loadFactor,
      },
      timestamp: Date.now()
    });
  }

  /**
   * 处理广播到节点
   */
  private handleBroadcastToNodes(client: Client, message: any) {
    const { eventType, data, targetNodes, excludeNodes = [] } = message;
    
    // 获取目标节点
    let targets: NodeState[] = [];
    
    if (targetNodes && targetNodes.length > 0) {
      targets = targetNodes
        .map((id: string) => this.state.nodes.get(id))
        .filter((n: NodeState | undefined): n is NodeState => n !== undefined && n.available);
    } else {
      this.state.nodes.forEach((node: NodeState) => {
        if (node.available && !excludeNodes.includes(node.id)) {
          targets.push(node);
        }
      });
    }
    
    // 广播消息
    const broadcastData = {
      eventType,
      data,
      sourceNodeId: message.sourceNodeId,
      timestamp: Date.now()
    };
    
    this.broadcast("node_broadcast", broadcastData);
    
    client.send("broadcast_sent", {
      targetCount: targets.length,
      timestamp: Date.now()
    });
  }

  /**
   * 主更新循环
   */
  private update(deltaTime: number) {
    const now = Date.now();
    this.syncFromClusterRuntime();
    
    // 定期健康检查
    if (now - this.lastHealthCheck > this.config.heartbeatInterval) {
      this.performHealthCheck();
      this.lastHealthCheck = now;
    }
    
    // 更新本地节点uptime
    const localNode = this.state.nodes.get("node:local");
    if (localNode) {
      localNode.uptime = Math.floor((now - localNode.createdAt) / 1000);
    }
    
    // 更新拓扑状态
    this.state.updateTopologyStatus();
    this.state.lastUpdate = now;
  }

  /**
   * 执行健康检查
   */
  private performHealthCheck() {
    const now = Date.now();
    
    this.state.nodes.forEach((node: NodeState) => {
      if (node.id === "node:local") return; // 跳过本地节点
      
      const timeSinceLastHeartbeat = now - node.lastHeartbeat;
      
      if (timeSinceLastHeartbeat > this.config.heartbeatTimeout) {
        // 节点超时，标记为离线
        if (node.status === "online" || node.status === "busy") {
          logger.warn(`[NodeRoom] 节点超时: ${node.name} (${node.id})`);
          
          node.status = "offline";
          node.available = false;
          this.state.onlineNodes--;
          
          this.broadcast("node_health_alert", {
            nodeId: node.id,
            nodeName: node.name,
            issue: "timeout",
            lastHeartbeat: node.lastHeartbeat,
            timestamp: now
          });
        }
      } else if (timeSinceLastHeartbeat > this.config.heartbeatInterval * 2) {
        // 节点延迟告警
        if (node.status === "online") {
          node.status = "busy"; // 标记为忙碌（可能有延迟）
        }
      }
    });
  }

  onJoin(client: Client, options: any) {
    logger.info(`[NodeRoom] 客户端 ${client.sessionId} 加入节点拓扑管理房间`);
    this.syncFromClusterRuntime();
    
    // 发送当前拓扑状态
    client.send("topology_state", {
      nodes: Array.from(this.state.nodes.values()),
      connections: Array.from(this.state.connections.values()),
      stats: {
        totalNodes: this.state.totalNodes,
        onlineNodes: this.state.onlineNodes,
        topologyStatus: this.state.topologyStatus,
      },
      timestamp: Date.now()
    });
  }

  onLeave(client: Client, consented: boolean) {
    logger.info(`[NodeRoom] 客户端 ${client.sessionId} 离开节点拓扑管理房间`);
    
    // 查找并注销该客户端关联的节点
    for (const [nodeId, sessionId] of this.nodeClientMap) {
      if (sessionId === client.sessionId) {
        this.unregisterNode(nodeId, "client_disconnected");
        break;
      }
    }
  }

  onDispose() {
    logger.info(`[NodeRoom] 销毁节点拓扑管理房间 ${this.roomId}`);
    
    // 清理映射
    this.nodeClientMap.clear();
  }

  private syncFromClusterRuntime() {
    const runtime = getClusterRuntime();
    if (!runtime) {
      return;
    }

    const clusterNodes = runtime.topologyStore.list();
    if (clusterNodes.length === 0) {
      return;
    }

    const seen = new Set<string>();
    clusterNodes.forEach((clusterNode) => {
      seen.add(clusterNode.nodeId);
      this.applyClusterNode(clusterNode);
    });

    const nodesToRemove: string[] = [];
    this.state.nodes.forEach((node, nodeId) => {
      if (!seen.has(nodeId)) {
        nodesToRemove.push(nodeId);
      }
    });

    nodesToRemove.forEach((nodeId) => {
      this.state.nodes.delete(nodeId);
    });

    this.state.totalNodes = this.state.nodes.size;
    this.state.onlineNodes = Array.from(this.state.nodes.values()).filter((node) => node.available).length;
  }

  private applyClusterNode(clusterNode: ClusterNodeRecord) {
    const node = this.state.nodes.get(clusterNode.nodeId) || new NodeState();
    const isNew = !this.state.nodes.has(clusterNode.nodeId);

    node.id = clusterNode.nodeId;
    node.name = clusterNode.name;
    node.type = clusterNode.role === "gateway" ? "master" : "worker";
    node.host = clusterNode.host;
    node.port = clusterNode.httpPort;
    node.ipAddress = clusterNode.host;
    node.region = clusterNode.clusterId;
    node.status = clusterNode.status === "offline" ? "offline" : clusterNode.status === "degraded" ? "busy" : "online";
    node.available = clusterNode.status === "active" || clusterNode.status === "degraded";
    node.lastHeartbeat = clusterNode.lastSeen;
    node.lastUpdate = clusterNode.lastSeen;
    node.version = clusterNode.version;
    node.loadFactor = clusterNode.load;
    node.capabilities.canRoute = clusterNode.capabilities.includes("gateway") || clusterNode.capabilities.includes("route");
    node.capabilities.canProcessLLM = clusterNode.capabilities.includes("llm");
    node.capabilities.canSpawnAgents = clusterNode.capabilities.includes("agent");
    node.capabilities.canStoreData = clusterNode.capabilities.includes("storage");

    if (isNew) {
      this.state.nodes.set(clusterNode.nodeId, node);
    }
  }
}

export default NodeRoom;
