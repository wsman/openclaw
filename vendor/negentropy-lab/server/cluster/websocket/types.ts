/**
 * 🚀 跨节点WebSocket事件扇出类型定义
 * 
 * 宪法依据：
 * - §107 通信安全公理：集群间通信的安全管理
 * - §321-§324 实时通信公理：WebSocket状态同步
 * 
 * @filename server/cluster/websocket/types.ts
 * @version 1.0.0
 * @category cluster
 * @last_updated 2026-03-09
 */

/**
 * 集群WebSocket事件信封
 */
export type ClusterWebSocketRoutingStrategy =
  | 'broadcast'
  | 'targeted'
  | 'least-loaded'
  | 'capability'
  | 'sticky-hash';

export interface ClusterWebSocketRouting {
  /** 路由策略 */
  strategy?: ClusterWebSocketRoutingStrategy;
  /** 单目标节点ID */
  targetNodeId?: string;
  /** 多目标节点ID */
  targetNodeIds?: string[];
  /** 所需能力标签 */
  requiredCapabilities?: string[];
  /** sticky hash的键 */
  hashKey?: string;
}

export interface WebSocketClusterDispatchOptions {
  /** 事件TTL（毫秒） */
  ttl?: number;
  /** 路由配置 */
  routing?: ClusterWebSocketRouting;
  /** 是否在源节点也执行一次本地投递 */
  deliverLocal?: boolean;
}

export interface ClusterWebSocketEvent {
  /** 全局唯一事件ID（格式：nodeId:timestamp:uuid） */
  eventId: string;
  /** 源节点ID */
  sourceNodeId: string;
  /** 事件时间戳（Unix毫秒） */
  timestamp: number;
  /** WebSocket事件类型 */
  eventType: string;
  /** 事件负载 */
  payload: any;
  /** 权限范围过滤 */
  scope?: string;
  /** 事件TTL（毫秒，默认60000ms） */
  ttl?: number;
  /** 单节点内的序列号，用于稳定排序 */
  sequence?: number;
  /** 路由信息 */
  routing?: ClusterWebSocketRouting;
}

/**
 * 连接状态同步消息
 */
export interface ClusterConnectionSync {
  /** 连接ID */
  connectionId: string;
  /** 所在节点ID */
  nodeId: string;
  /** 连接状态 */
  status: 'connected' | 'disconnected';
  /** 是否已认证 */
  authenticated: boolean;
  /** 权限范围 */
  scope?: string;
  /** 用户ID */
  user?: string;
  /** 客户端IP */
  clientIp: string;
  /** 连接建立时间 */
  connectedAt: number;
  /** 最后活跃时间 */
  lastActivity: number;
  /** 额外元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * 全局连接视图
 */
export interface ClusterConnectionView {
  /** 连接ID */
  connectionId: string;
  /** 所在节点ID */
  nodeId: string;
  /** 节点名称 */
  nodeName: string;
  /** 连接状态 */
  status: 'connected' | 'disconnected';
  /** 是否已认证 */
  authenticated: boolean;
  /** 权限范围 */
  scope?: string;
  /** 用户ID */
  user?: string;
  /** 客户端IP */
  clientIp: string;
  /** 连接建立时间 */
  connectedAt: string;
  /** 最后活跃时间 */
  lastActivity: string;
}

/**
 * 广播器配置
 */
export interface WebSocketClusterBroadcasterConfig {
  /** 事件去重TTL（毫秒） */
  eventDedupTtlMs?: number;
  /** 去重时间窗口（毫秒） */
  dedupWindowMs?: number;
  /** 最大去重缓存条目数 */
  maxDedupEntries?: number;
  /** 连接状态心跳间隔（毫秒） */
  heartbeatIntervalMs?: number;
  /** 连接状态TTL（毫秒） */
  connectionTtlMs?: number;
  /** 是否启用事件压缩 */
  enableCompression?: boolean;
  /** 最大批量事件数量 */
  maxBatchSize?: number;
  /** 批处理延迟（毫秒） */
  batchDelayMs?: number;
  /** 乱序重排窗口（毫秒） */
  orderingWindowMs?: number;
}

/**
 * 去重缓存条目
 */
export interface DedupCacheEntry {
  timestamp: number;
  expiresAt: number;
}

/**
 * 连接状态缓存条目
 */
export interface ConnectionStateEntry {
  sync: ClusterConnectionSync;
  lastSeen: number;
}

/**
 * 批处理事件
 */
export interface BatchedEvent {
  event: ClusterWebSocketEvent;
  targetScope?: string;
  timestamp: number;
  channels: string[];
  routeStrategy: ClusterWebSocketRoutingStrategy;
}
