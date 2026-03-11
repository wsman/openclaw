/**
 * 🚀 跨节点WebSocket事件广播器
 *
 * 宪法依据：
 * - §107 通信安全公理：集群间通信的安全管理
 * - §321-§324 实时通信公理：WebSocket状态同步
 * - §102 熵减原则：集中管理事件去重和状态同步，降低维护复杂度
 *
 * @filename server/cluster/websocket/WebSocketClusterBroadcaster.ts
 * @version 1.0.0
 * @category cluster
 * @last_updated 2026-03-09
 */

import { randomUUID } from 'crypto';
import { ClusterNode } from '../ClusterNode';
import { ClusterBackplane } from '../backplane/ClusterBackplane';
import { ClusterEventEnvelope, ClusterNodeRecord } from '../types';
import { logger } from '../../utils/logger';
import {
  ClusterWebSocketEvent,
  ClusterWebSocketRouting,
  ClusterWebSocketRoutingStrategy,
  ClusterConnectionSync,
  ClusterConnectionView,
  WebSocketClusterBroadcasterConfig,
  DedupCacheEntry,
  ConnectionStateEntry,
  BatchedEvent,
  WebSocketClusterDispatchOptions,
} from './types';

const CLUSTER_WS_BROADCAST_CHANNEL = 'cluster:ws:broadcast';
const CLUSTER_WS_BATCH_CHANNEL = 'cluster:ws:broadcast:batch';
const CLUSTER_WS_NODE_BATCH_CHANNEL_PREFIX = 'cluster:ws:broadcast:batch:node:';
const CLUSTER_WS_CONNECTION_SYNC_CHANNEL = 'cluster:ws:connection:sync';

/**
 * WebSocket处理器接口（为了解耦）
 */
export interface IWebSocketHandler {
  sendEvent: (ws: any, event: string, payload: any) => void;
  broadcastEvent: (event: string, payload: any, scope?: string, skipCluster?: boolean) => void;
  getConnections: () => Map<any, {
    connectionId: string;
    authenticated: boolean;
    scope?: string;
    user?: string;
    clientIp: string;
    connectedAt: Date;
    lastActivity: Date;
  }>;
}

type BroadcasterStats = {
  eventsBroadcasted: number;
  eventsReceived: number;
  eventsDelivered: number;
  eventsDeduped: number;
  eventsExpired: number;
  eventsOrdered: number;
  connectionsSynced: number;
  batchesProcessed: number;
  publishOperations: number;
  targetedEvents: number;
  loadBalancedEvents: number;
  routingByStrategy: Record<ClusterWebSocketRoutingStrategy, number>;
};

/**
 * 跨节点WebSocket事件广播器
 *
 * 核心功能：
 * 1. 将本地WebSocket事件广播到集群
 * 2. 接收其他节点的事件并扇出到本地连接
 * 3. 同步连接状态到集群
 * 4. 维护全局连接视图
 * 5. 事件去重、排序与分发策略
 */
export class WebSocketClusterBroadcaster {
  private clusterNode: ClusterNode | null = null;
  private wsHandler: IWebSocketHandler | null = null;
  private backplane: ClusterBackplane | null = null;
  private localNodeId = '';

  private dedupCache = new Map<string, DedupCacheEntry>();
  private readonly dedupTtlMs: number;
  private readonly dedupWindowMs: number;
  private readonly maxDedupEntries: number;
  private dedupBuckets = new Map<number, Set<string>>();

  private connectionStateCache = new Map<string, ConnectionStateEntry>();
  private readonly connectionTtlMs: number;

  private unsubscribeBroadcast?: () => Promise<void>;
  private unsubscribeBroadcastBatch?: () => Promise<void>;
  private unsubscribeNodeBroadcastBatch?: () => Promise<void>;
  private unsubscribeSync?: () => Promise<void>;

  private heartbeatTimer?: NodeJS.Timeout;
  private readonly heartbeatIntervalMs: number;

  private batchQueue: BatchedEvent[] = [];
  private batchTimer?: NodeJS.Timeout;
  private flushingBatch = false;
  private readonly maxBatchSize: number;
  private readonly batchDelayMs: number;

  private orderedBuffers = new Map<string, ClusterWebSocketEvent[]>();
  private orderedTimers = new Map<string, NodeJS.Timeout>();
  private readonly orderingWindowMs: number;

  private eventSequence = 0;
  private stats: BroadcasterStats = {
    eventsBroadcasted: 0,
    eventsReceived: 0,
    eventsDelivered: 0,
    eventsDeduped: 0,
    eventsExpired: 0,
    eventsOrdered: 0,
    connectionsSynced: 0,
    batchesProcessed: 0,
    publishOperations: 0,
    targetedEvents: 0,
    loadBalancedEvents: 0,
    routingByStrategy: {
      broadcast: 0,
      targeted: 0,
      'least-loaded': 0,
      capability: 0,
      'sticky-hash': 0,
    },
  };

  private initialized = false;

  constructor(config: WebSocketClusterBroadcasterConfig = {}) {
    this.dedupTtlMs = config.eventDedupTtlMs ?? 60_000;
    this.dedupWindowMs = Math.max(100, config.dedupWindowMs ?? 5_000);
    this.maxDedupEntries = Math.max(256, config.maxDedupEntries ?? 8_192);
    this.connectionTtlMs = config.connectionTtlMs ?? 300_000;
    this.heartbeatIntervalMs = config.heartbeatIntervalMs ?? 30_000;
    this.maxBatchSize = Math.max(1, config.maxBatchSize ?? 10);
    this.batchDelayMs = Math.max(1, config.batchDelayMs ?? 50);
    this.orderingWindowMs = Math.max(0, config.orderingWindowMs ?? 25);
  }

  async initialize(
    clusterNode: ClusterNode,
    wsHandler: IWebSocketHandler,
  ): Promise<void> {
    if (this.initialized) {
      logger.warn('[Cluster WS] 广播器已经初始化，跳过重复初始化');
      return;
    }

    this.clusterNode = clusterNode;
    this.wsHandler = wsHandler;
    this.backplane = clusterNode.getBackplane();
    this.localNodeId = clusterNode.getLocalNode().nodeId;

    await this.subscribeToClusterEvents();
    this.startHeartbeat();

    this.initialized = true;
    logger.info(`[Cluster WS] 广播器已初始化: ${this.localNodeId}`);
  }

  async broadcastToCluster(
    eventType: string,
    payload: any,
    scope?: string,
    options: WebSocketClusterDispatchOptions = {},
  ): Promise<void> {
    if (!this.initialized || !this.backplane) {
      logger.debug('[Cluster WS] 广播器未初始化，跳过广播');
      return;
    }

    const now = Date.now();
    const eventId = this.generateEventId();
    const routingResolution = this.resolveRouting(options.routing);
    const event: ClusterWebSocketEvent = {
      eventId,
      sourceNodeId: this.localNodeId,
      timestamp: now,
      eventType,
      payload,
      scope,
      ttl: options.ttl ?? this.dedupTtlMs,
      sequence: ++this.eventSequence,
      routing: routingResolution.routing,
    };

    this.recordEventId(eventId, now);
    this.recordRoutingStats(routingResolution.routing.strategy ?? 'broadcast');

    if (options.deliverLocal && this.wsHandler && this.shouldDeliverLocally(event)) {
      this.wsHandler.broadcastEvent(event.eventType, event.payload, event.scope, true);
      this.stats.eventsDelivered++;
    }

    if (routingResolution.channels.length === 0) {
      logger.debug(`[Cluster WS] 事件无需跨节点分发: ${eventType}`);
      this.stats.eventsBroadcasted++;
      return;
    }

    this.batchQueue.push({
      event,
      targetScope: scope,
      timestamp: now,
      channels: routingResolution.channels,
      routeStrategy: routingResolution.routing.strategy ?? 'broadcast',
    });

    if (this.batchQueue.length >= this.maxBatchSize) {
      await this.flushBatch();
    } else {
      this.scheduleBatchFlush();
    }

    this.stats.eventsBroadcasted++;
  }

  async syncConnectionStatus(
    connectionId: string,
    status: 'connected' | 'disconnected',
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.initialized || !this.backplane) {
      return;
    }

    const localConnections = this.wsHandler?.getConnections() || new Map();
    const connection = Array.from(localConnections.values()).find(
      (conn) => conn.connectionId === connectionId,
    );

    if (!connection && status === 'connected') {
      logger.warn(`[Cluster WS] 连接不存在，无法同步: ${connectionId}`);
      return;
    }

    const now = Date.now();
    const sync: ClusterConnectionSync = {
      connectionId,
      nodeId: this.localNodeId,
      status,
      authenticated: connection?.authenticated ?? false,
      scope: connection?.scope,
      user: connection?.user,
      clientIp: connection?.clientIp ?? 'unknown',
      connectedAt: connection?.connectedAt.getTime() ?? now,
      lastActivity: connection?.lastActivity.getTime() ?? now,
      metadata,
    };

    if (status === 'connected') {
      this.connectionStateCache.set(connectionId, {
        sync,
        lastSeen: now,
      });
    } else {
      this.connectionStateCache.delete(connectionId);
    }

    await this.backplane.publish(CLUSTER_WS_CONNECTION_SYNC_CHANNEL, sync, this.localNodeId);
    this.stats.connectionsSynced++;
  }

  async getGlobalConnections(): Promise<ClusterConnectionView[]> {
    const views: ClusterConnectionView[] = [];
    const localConnections = this.wsHandler?.getConnections() || new Map();

    for (const [, conn] of localConnections.entries()) {
      views.push({
        connectionId: conn.connectionId,
        nodeId: this.localNodeId,
        nodeName: this.clusterNode?.getLocalNode().name ?? 'unknown',
        status: 'connected',
        authenticated: conn.authenticated,
        scope: conn.scope,
        user: conn.user,
        clientIp: conn.clientIp,
        connectedAt: conn.connectedAt.toISOString(),
        lastActivity: conn.lastActivity.toISOString(),
      });
    }

    for (const [connectionId, entry] of this.connectionStateCache.entries()) {
      if (entry.sync.nodeId === this.localNodeId) {
        continue;
      }

      if (Date.now() - entry.lastSeen > this.connectionTtlMs) {
        this.connectionStateCache.delete(connectionId);
        continue;
      }

      const topology = this.clusterNode?.getTopology() || [];
      const node = topology.find((item) => item.nodeId === entry.sync.nodeId);

      views.push({
        connectionId: entry.sync.connectionId,
        nodeId: entry.sync.nodeId,
        nodeName: node?.name ?? 'unknown',
        status: entry.sync.status,
        authenticated: entry.sync.authenticated,
        scope: entry.sync.scope,
        user: entry.sync.user,
        clientIp: entry.sync.clientIp,
        connectedAt: new Date(entry.sync.connectedAt).toISOString(),
        lastActivity: new Date(entry.sync.lastActivity).toISOString(),
      });
    }

    return views;
  }

  getStats() {
    return {
      ...this.stats,
      routingByStrategy: { ...this.stats.routingByStrategy },
      eventsBroadcast: this.stats.eventsBroadcasted,
      dedupCacheSize: this.dedupCache.size,
      dedupBucketCount: this.dedupBuckets.size,
      connectionCacheSize: this.connectionStateCache.size,
      batchQueueSize: this.batchQueue.length,
      orderingBufferSize: Array.from(this.orderedBuffers.values()).reduce((sum, items) => sum + items.length, 0),
      initialized: this.initialized,
    };
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    logger.info(`[Cluster WS] 正在关闭广播器: ${this.localNodeId}`);

    if (this.batchQueue.length > 0) {
      await this.flushBatch();
    }

    if (this.unsubscribeBroadcast) {
      await this.unsubscribeBroadcast();
      this.unsubscribeBroadcast = undefined;
    }

    if (this.unsubscribeBroadcastBatch) {
      await this.unsubscribeBroadcastBatch();
      this.unsubscribeBroadcastBatch = undefined;
    }

    if (this.unsubscribeNodeBroadcastBatch) {
      await this.unsubscribeNodeBroadcastBatch();
      this.unsubscribeNodeBroadcastBatch = undefined;
    }

    if (this.unsubscribeSync) {
      await this.unsubscribeSync();
      this.unsubscribeSync = undefined;
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    for (const timer of this.orderedTimers.values()) {
      clearTimeout(timer);
    }
    this.orderedTimers.clear();
    this.orderedBuffers.clear();

    this.dedupCache.clear();
    this.dedupBuckets.clear();
    this.connectionStateCache.clear();
    this.batchQueue = [];
    this.flushingBatch = false;
    this.initialized = false;

    logger.info('[Cluster WS] 广播器已关闭');
  }

  private async subscribeToClusterEvents(): Promise<void> {
    if (!this.backplane) {
      throw new Error('Backplane not initialized');
    }

    this.unsubscribeBroadcast = await this.backplane.subscribe<ClusterWebSocketEvent>(
      CLUSTER_WS_BROADCAST_CHANNEL,
      async (envelope: ClusterEventEnvelope<ClusterWebSocketEvent>) => {
        await this.processIncomingEvents([envelope.payload], envelope.sourceNodeId);
      },
    );

    this.unsubscribeBroadcastBatch = await this.backplane.subscribe<ClusterWebSocketEvent[]>(
      CLUSTER_WS_BATCH_CHANNEL,
      async (envelope: ClusterEventEnvelope<ClusterWebSocketEvent[]>) => {
        await this.processIncomingEvents(envelope.payload, envelope.sourceNodeId);
      },
    );

    this.unsubscribeNodeBroadcastBatch = await this.backplane.subscribe<ClusterWebSocketEvent[]>(
      this.getNodeBatchChannel(this.localNodeId),
      async (envelope: ClusterEventEnvelope<ClusterWebSocketEvent[]>) => {
        await this.processIncomingEvents(envelope.payload, envelope.sourceNodeId);
      },
    );

    this.unsubscribeSync = await this.backplane.subscribe<ClusterConnectionSync>(
      CLUSTER_WS_CONNECTION_SYNC_CHANNEL,
      async (envelope: ClusterEventEnvelope<ClusterConnectionSync>) => {
        await this.handleConnectionSync(envelope.payload, envelope.sourceNodeId);
      },
    );

    logger.info('[Cluster WS] 已订阅集群事件通道');
  }

  private async processIncomingEvents(
    events: ClusterWebSocketEvent[] | undefined,
    sourceNodeId?: string,
  ): Promise<void> {
    if (!events || events.length === 0) {
      return;
    }

    const orderedEvents = [...events].sort((left, right) => this.compareEvents(left, right));
    for (const event of orderedEvents) {
      await this.handleClusterBroadcast(event, sourceNodeId ?? event.sourceNodeId);
    }
  }

  private async handleClusterBroadcast(
    event: ClusterWebSocketEvent,
    sourceNodeId?: string,
  ): Promise<void> {
    if ((sourceNodeId || event.sourceNodeId) === this.localNodeId) {
      return;
    }

    this.stats.eventsReceived++;

    if (!this.shouldProcessEvent(event)) {
      this.stats.eventsDeduped++;
      logger.debug(`[Cluster WS] 事件已去重: ${event.eventId}`);
      return;
    }

    if (event.ttl && Date.now() - event.timestamp > event.ttl) {
      this.stats.eventsExpired++;
      logger.debug(`[Cluster WS] 事件已过期: ${event.eventId}`);
      return;
    }

    if (!this.shouldDeliverLocally(event)) {
      logger.debug(`[Cluster WS] 当前节点跳过事件: ${event.eventType}, routing=${event.routing?.strategy ?? 'broadcast'}`);
      return;
    }

    if (this.orderingWindowMs === 0) {
      this.deliverEvent(event);
      return;
    }

    this.queueOrderedEvent(event);
  }

  private async handleConnectionSync(
    sync: ClusterConnectionSync,
    sourceNodeId?: string,
  ): Promise<void> {
    if ((sourceNodeId || sync.nodeId) === this.localNodeId) {
      return;
    }

    const now = Date.now();

    if (sync.status === 'connected') {
      this.connectionStateCache.set(sync.connectionId, {
        sync,
        lastSeen: now,
      });
      logger.debug(`[Cluster WS] 连接已同步: ${sync.connectionId} on ${sourceNodeId || sync.nodeId}`);
    } else {
      this.connectionStateCache.delete(sync.connectionId);
      logger.debug(`[Cluster WS] 连接已断开: ${sync.connectionId} on ${sourceNodeId || sync.nodeId}`);
    }
  }

  private shouldProcessEvent(event: ClusterWebSocketEvent): boolean {
    if (this.dedupCache.has(event.eventId)) {
      return false;
    }

    const now = Date.now();
    if (now - event.timestamp > this.dedupTtlMs) {
      return false;
    }

    this.recordEventId(event.eventId, event.timestamp);
    return true;
  }

  private recordEventId(eventId: string, timestamp: number): void {
    const now = Date.now();
    const bucketKey = this.getDedupBucketKey(now + this.dedupTtlMs);

    this.dedupCache.set(eventId, {
      timestamp,
      expiresAt: now + this.dedupTtlMs,
    });

    if (!this.dedupBuckets.has(bucketKey)) {
      this.dedupBuckets.set(bucketKey, new Set());
    }
    this.dedupBuckets.get(bucketKey)!.add(eventId);

    if (this.dedupCache.size > this.maxDedupEntries) {
      this.cleanupDedupCache();
      while (this.dedupCache.size > this.maxDedupEntries) {
        const oldestKey = this.dedupCache.keys().next().value;
        if (!oldestKey) {
          break;
        }
        this.dedupCache.delete(oldestKey);
      }
    }
  }

  private cleanupDedupCache(): void {
    const now = Date.now();
    const cutoffBucketKey = this.getDedupBucketKey(now);
    const expiredBuckets = Array.from(this.dedupBuckets.keys()).filter((bucketKey) => bucketKey <= cutoffBucketKey);
    let removed = 0;

    for (const bucketKey of expiredBuckets) {
      const eventIds = this.dedupBuckets.get(bucketKey);
      if (!eventIds) {
        continue;
      }
      for (const eventId of eventIds) {
        const entry = this.dedupCache.get(eventId);
        if (entry && entry.expiresAt <= now) {
          this.dedupCache.delete(eventId);
          removed++;
        }
      }
      this.dedupBuckets.delete(bucketKey);
    }

    if (removed > 0) {
      logger.debug(`[Cluster WS] 清理过期去重缓存: ${removed}条`);
    }
  }

  private scheduleBatchFlush(): void {
    if (this.batchTimer || this.flushingBatch || this.batchQueue.length === 0) {
      return;
    }

    this.batchTimer = setTimeout(() => {
      void this.flushBatch();
    }, this.batchDelayMs);
  }

  private async flushBatch(): Promise<void> {
    if (this.flushingBatch || this.batchQueue.length === 0 || !this.backplane) {
      return;
    }

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    this.flushingBatch = true;
    let batch: BatchedEvent[] = [];

    try {
      while (this.batchQueue.length > 0 && this.backplane) {
        batch = this.batchQueue.splice(0, this.maxBatchSize);
        batch.sort((left, right) => this.compareEvents(left.event, right.event));

        const grouped = new Map<string, ClusterWebSocketEvent[]>();
        for (const item of batch) {
          for (const channel of item.channels) {
            if (!grouped.has(channel)) {
              grouped.set(channel, []);
            }
            grouped.get(channel)!.push(item.event);
          }
        }

        for (const [channel, events] of grouped.entries()) {
          const orderedEvents = [...events].sort((left, right) => this.compareEvents(left, right));
          await this.backplane.publish(channel, orderedEvents, this.localNodeId);
          this.stats.publishOperations++;
        }

        this.stats.batchesProcessed++;
        logger.debug(`[Cluster WS] 已批处理 ${batch.length} 个事件，发布到 ${grouped.size} 个通道`);
      }
    } catch (error) {
      logger.error(`[Cluster WS] 批处理事件失败: ${error}`);
      if (batch.length > 0) {
        this.batchQueue.unshift(...batch);
      }
    } finally {
      this.flushingBatch = false;
      if (this.batchQueue.length > 0) {
        this.scheduleBatchFlush();
      }
    }
  }

  private queueOrderedEvent(event: ClusterWebSocketEvent): void {
    const bufferKey = event.sourceNodeId || 'unknown';
    const buffer = this.orderedBuffers.get(bufferKey) || [];
    buffer.push(event);
    buffer.sort((left, right) => this.compareEvents(left, right));
    this.orderedBuffers.set(bufferKey, buffer);

    if (this.orderedTimers.has(bufferKey)) {
      return;
    }

    const timer = setTimeout(() => {
      this.orderedTimers.delete(bufferKey);
      void this.flushOrderedEvents(bufferKey);
    }, this.orderingWindowMs);

    this.orderedTimers.set(bufferKey, timer);
  }

  private async flushOrderedEvents(bufferKey: string): Promise<void> {
    const buffer = this.orderedBuffers.get(bufferKey);
    if (!buffer || buffer.length === 0) {
      return;
    }

    this.orderedBuffers.delete(bufferKey);
    buffer.sort((left, right) => this.compareEvents(left, right));
    this.stats.eventsOrdered += buffer.length;

    for (const event of buffer) {
      this.deliverEvent(event);
    }
  }

  private deliverEvent(event: ClusterWebSocketEvent): void {
    if (!this.wsHandler) {
      return;
    }

    this.wsHandler.broadcastEvent(event.eventType, event.payload, event.scope, true);
    this.stats.eventsDelivered++;
    logger.debug(`[Cluster WS] 已扇出事件: ${event.eventType} from ${event.sourceNodeId}`);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      void this.sendHeartbeat();
      this.cleanupExpiredConnections();
      this.cleanupDedupCache();
    }, this.heartbeatIntervalMs);

    logger.info(`[Cluster WS] 心跳已启动，间隔: ${this.heartbeatIntervalMs}ms`);
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.wsHandler || !this.backplane) {
      return;
    }

    const localConnections = this.wsHandler.getConnections();
    const now = Date.now();

    for (const [, conn] of localConnections.entries()) {
      const sync: ClusterConnectionSync = {
        connectionId: conn.connectionId,
        nodeId: this.localNodeId,
        status: 'connected',
        authenticated: conn.authenticated,
        scope: conn.scope,
        user: conn.user,
        clientIp: conn.clientIp,
        connectedAt: conn.connectedAt.getTime(),
        lastActivity: conn.lastActivity.getTime(),
      };

      this.connectionStateCache.set(conn.connectionId, {
        sync,
        lastSeen: now,
      });

      await this.backplane.publish(CLUSTER_WS_CONNECTION_SYNC_CHANNEL, sync, this.localNodeId);
    }
  }

  private cleanupExpiredConnections(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [connectionId, entry] of this.connectionStateCache.entries()) {
      if (entry.sync.nodeId === this.localNodeId) {
        continue;
      }

      if (now - entry.lastSeen > this.connectionTtlMs) {
        expired.push(connectionId);
      }
    }

    for (const connectionId of expired) {
      this.connectionStateCache.delete(connectionId);
      logger.debug(`[Cluster WS] 清理过期连接状态: ${connectionId}`);
    }
  }

  private resolveRouting(routing?: ClusterWebSocketRouting): { routing: ClusterWebSocketRouting; channels: string[] } {
    const strategy = routing?.strategy ?? 'broadcast';
    const activeNodes = this.getEligibleNodes(routing?.requiredCapabilities);
    const allActiveNodeIds = activeNodes.map((node) => node.nodeId);
    let targetNodeIds: string[] | undefined;

    switch (strategy) {
      case 'targeted':
        targetNodeIds = this.uniqueNodeIds([
          ...(routing?.targetNodeIds || []),
          ...(routing?.targetNodeId ? [routing.targetNodeId] : []),
        ]);
        break;
      case 'least-loaded': {
        const chosen = [...activeNodes].sort((left, right) => {
          if (left.load !== right.load) {
            return left.load - right.load;
          }
          return left.nodeId.localeCompare(right.nodeId);
        })[0];
        targetNodeIds = chosen ? [chosen.nodeId] : undefined;
        break;
      }
      case 'capability':
        targetNodeIds = activeNodes.length > 0 ? activeNodes.map((node) => node.nodeId) : undefined;
        break;
      case 'sticky-hash': {
        const candidates = activeNodes.length > 0 ? activeNodes : this.getEligibleNodes();
        const key = routing?.hashKey || this.localNodeId;
        const chosen = candidates.length > 0
          ? candidates[this.hashString(key) % candidates.length]
          : undefined;
        targetNodeIds = chosen ? [chosen.nodeId] : undefined;
        break;
      }
      case 'broadcast':
      default:
        targetNodeIds = undefined;
        break;
    }

    if (!targetNodeIds || targetNodeIds.length === 0) {
      return {
        routing: { ...routing, strategy: 'broadcast', targetNodeIds: undefined },
        channels: [CLUSTER_WS_BATCH_CHANNEL],
      };
    }

    const uniqueTargets = this.uniqueNodeIds(targetNodeIds).filter((nodeId) => nodeId !== this.localNodeId);
    if (uniqueTargets.length === 0) {
      return {
        routing: { ...routing, strategy, targetNodeIds },
        channels: [],
      };
    }

    const shouldUseGlobalBatch = uniqueTargets.length === allActiveNodeIds.filter((nodeId) => nodeId !== this.localNodeId).length;
    return {
      routing: { ...routing, strategy, targetNodeIds },
      channels: shouldUseGlobalBatch
        ? [CLUSTER_WS_BATCH_CHANNEL]
        : uniqueTargets.map((nodeId) => this.getNodeBatchChannel(nodeId)),
    };
  }

  private shouldDeliverLocally(event: ClusterWebSocketEvent): boolean {
    const strategy = event.routing?.strategy ?? 'broadcast';
    const targetNodeIds = event.routing?.targetNodeIds;

    if (!targetNodeIds || targetNodeIds.length === 0) {
      return true;
    }

    switch (strategy) {
      case 'targeted':
      case 'least-loaded':
      case 'sticky-hash':
        return targetNodeIds.includes(this.localNodeId);
      case 'capability':
        return targetNodeIds.includes(this.localNodeId);
      case 'broadcast':
      default:
        return true;
    }
  }

  private getEligibleNodes(requiredCapabilities: string[] = []): ClusterNodeRecord[] {
    const topology = this.clusterNode?.getTopology() || [];
    const activeNodes = topology.filter((node) => node.status !== 'offline' && node.status !== 'maintenance');
    if (requiredCapabilities.length === 0) {
      return activeNodes;
    }

    return activeNodes.filter((node) =>
      requiredCapabilities.every((capability) => node.capabilities.includes(capability)),
    );
  }

  private recordRoutingStats(strategy: ClusterWebSocketRoutingStrategy): void {
    this.stats.routingByStrategy[strategy] += 1;
    if (strategy !== 'broadcast') {
      this.stats.targetedEvents += 1;
    }
    if (strategy === 'least-loaded' || strategy === 'sticky-hash') {
      this.stats.loadBalancedEvents += 1;
    }
  }

  private compareEvents(left: ClusterWebSocketEvent, right: ClusterWebSocketEvent): number {
    if (left.timestamp !== right.timestamp) {
      return left.timestamp - right.timestamp;
    }

    if ((left.sequence ?? 0) !== (right.sequence ?? 0)) {
      return (left.sequence ?? 0) - (right.sequence ?? 0);
    }

    return left.eventId.localeCompare(right.eventId);
  }

  private getDedupBucketKey(timestamp: number): number {
    return Math.floor(timestamp / this.dedupWindowMs);
  }

  private getNodeBatchChannel(nodeId: string): string {
    return `${CLUSTER_WS_NODE_BATCH_CHANNEL_PREFIX}${nodeId}`;
  }

  private uniqueNodeIds(nodeIds: string[]): string[] {
    return Array.from(new Set(nodeIds.filter(Boolean)));
  }

  private hashString(value: string): number {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash;
  }

  private generateEventId(): string {
    return `${this.localNodeId}:${Date.now()}:${randomUUID()}`;
  }
}

export default WebSocketClusterBroadcaster;
