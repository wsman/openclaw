/**
 * @constitution
 * §110 协作效率公理：连接池复用与心跳保障低延迟协作
 * §306 零停机协议：连接健康检查与重连机制确保服务连续性
 * §381 安全公理：连接状态与认证元数据可审计追踪
 */
import { EventEmitter } from 'events';
import { WebSocket } from 'ws';

export enum ConnectionState {
  IDLE = 'IDLE',
  ACTIVE = 'ACTIVE',
  UNHEALTHY = 'UNHEALTHY',
  CLOSED = 'CLOSED',
}

export interface ConnectionPoolConfig {
  maxConnections?: number;
  minIdleConnections?: number;
  maxIdleConnections?: number;
  healthCheckInterval?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
  enableCompression?: boolean;
  enablePerMessageDeflate?: boolean;
  enableReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelayBase?: number;
}

export type ConnectionPoolOptions = ConnectionPoolConfig;

export interface ConnectionMetadata {
  id: string;
  websocket: any;
  clientIp: string;
  authenticated: boolean;
  userId?: string;
  state: ConnectionState;
  createdAt: Date;
  lastActivity: Date;
  lastHealthCheck: Date;
  requestCount: number;
  errorCount: number;
  reconnectCount: number;
  bytesSent: number;
  bytesReceived: number;
}

export type ConnectionInfo = ConnectionMetadata;

export interface ConnectionPoolStats {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  unhealthyConnections: number;
  failedConnections: number;
  messagesSent: number;
  messagesReceived: number;
  bytesSent: number;
  bytesReceived: number;
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  reconnectAttempts: number;
  compressionRatio: number;
  connectionReuseRate: number;
  memoryUsage: NodeJS.MemoryUsage;
}

export type PoolStats = ConnectionPoolStats;

export class ConnectionPool extends EventEmitter {
  private config: Required<ConnectionPoolConfig>;
  private readonly connections = new Map<string, ConnectionMetadata>();
  private readonly urlPool: string[];
  private readonly latencies: number[] = [];
  private heartbeatTimer?: NodeJS.Timeout;
  private currentUrlIndex = 0;

  private acquireCount = 0;
  private reuseCount = 0;
  private stats: ConnectionPoolStats;

  constructor(
    configOrUrls: Partial<ConnectionPoolConfig> | string[] = {},
    options: Partial<ConnectionPoolConfig> = {},
  ) {
    super();

    const fromUrls = Array.isArray(configOrUrls);
    this.urlPool = fromUrls ? configOrUrls : [];

    const config = fromUrls ? options : configOrUrls;

    this.config = {
      maxConnections: Number(config.maxConnections ?? 1000),
      minIdleConnections: Number(config.minIdleConnections ?? 0),
      maxIdleConnections: Number(config.maxIdleConnections ?? 1000),
      healthCheckInterval: Number(config.healthCheckInterval ?? 30000),
      heartbeatInterval: Number(config.heartbeatInterval ?? 30000),
      connectionTimeout: Number(config.connectionTimeout ?? 30000),
      enableCompression: Boolean(config.enableCompression ?? true),
      enablePerMessageDeflate: Boolean(config.enablePerMessageDeflate ?? true),
      enableReconnect: Boolean(config.enableReconnect ?? true),
      maxReconnectAttempts: Number(config.maxReconnectAttempts ?? 5),
      reconnectDelayBase: Number(config.reconnectDelayBase ?? 1000),
    };

    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      unhealthyConnections: 0,
      failedConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      averageLatency: 0,
      maxLatency: 0,
      minLatency: 0,
      reconnectAttempts: 0,
      compressionRatio: 0,
      connectionReuseRate: 0,
      memoryUsage: process.memoryUsage(),
    };

    this.startHeartbeat();
  }

  addConnection(ws: any, clientIp: string, authenticated = false, userId?: string): string {
    if (this.connections.size >= this.config.maxConnections) {
      throw new Error('Connection pool is full');
    }

    const id = this.generateConnectionId();
    const now = new Date();
    const metadata: ConnectionMetadata = {
      id,
      websocket: ws,
      clientIp,
      authenticated,
      userId,
      state: ConnectionState.IDLE,
      createdAt: now,
      lastActivity: now,
      lastHealthCheck: now,
      requestCount: 0,
      errorCount: 0,
      reconnectCount: 0,
      bytesSent: 0,
      bytesReceived: 0,
    };

    this.connections.set(id, metadata);
    this.attachSocketListeners(metadata);
    this.refreshStats();
    return id;
  }

  acquireConnection(_timeoutMs = 0): ConnectionMetadata | null {
    const target = Array.from(this.connections.values()).find(
      (item) => item.state === ConnectionState.IDLE,
    );

    if (!target) {
      return null;
    }

    target.state = ConnectionState.ACTIVE;
    target.requestCount += 1;
    target.lastActivity = new Date();

    this.acquireCount += 1;
    if (target.requestCount > 1) {
      this.reuseCount += 1;
    }

    this.refreshStats();
    return target;
  }

  releaseConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    if (connection.state !== ConnectionState.CLOSED) {
      connection.state = ConnectionState.IDLE;
      connection.lastActivity = new Date();
    }

    this.refreshStats();
  }

  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return;
    }

    connection.state = ConnectionState.CLOSED;
    try {
      if (typeof connection.websocket?.close === 'function') {
        connection.websocket.close();
      }
    } catch {
      // ignore close errors
    }

    this.connections.delete(connectionId);
    this.refreshStats();
  }

  getConnection(connectionId: string): ConnectionMetadata | undefined {
    return this.connections.get(connectionId);
  }

  getAllConnections(): ConnectionMetadata[] {
    return Array.from(this.connections.values());
  }

  getAllConnectionIds(): string[] {
    return Array.from(this.connections.keys());
  }

  queryConnections(predicate: (meta: ConnectionMetadata) => boolean): ConnectionMetadata[] {
    return Array.from(this.connections.values()).filter(predicate);
  }

  updateConfig(partial: Partial<ConnectionPoolConfig>): void {
    this.config = {
      ...this.config,
      ...partial,
    };
  }

  async sendToConnection(connectionId: string, data: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    if (typeof connection.websocket?.send !== 'function') {
      throw new Error('Connection websocket does not support send');
    }

    const encoded = this.encodePayload(data);
    connection.websocket.send(encoded);
    connection.bytesSent += encoded.length;
    this.stats.messagesSent += 1;
    this.stats.bytesSent += encoded.length;
    this.refreshStats();
  }

  async broadcast(data: any): Promise<void> {
    const ids = this.getAllConnectionIds();
    await Promise.all(ids.map((id) => this.sendToConnection(id, data).catch(() => undefined)));
  }

  async createConnectionToUrl(url?: string): Promise<ConnectionMetadata> {
    const targetUrl = url || this.getNextUrl();
    if (!targetUrl) {
      throw new Error('No WebSocket URL available');
    }

    const ws = new WebSocket(targetUrl);
    const id = this.addConnection(ws, targetUrl, false);
    return this.connections.get(id)!;
  }

  closeConnection(connectionId: string): void {
    this.removeConnection(connectionId);
  }

  async closeAll(): Promise<void> {
    await this.close();
  }

  async close(): Promise<void> {
    for (const connectionId of this.getAllConnectionIds()) {
      this.removeConnection(connectionId);
    }

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    this.refreshStats();
  }

  getStats(): ConnectionPoolStats {
    this.refreshStats();
    return {
      ...this.stats,
      memoryUsage: process.memoryUsage(),
    };
  }

  getPerformanceReport(): {
    stats: ConnectionPoolStats;
    connections: ConnectionMetadata[];
    uptime: number;
    healthScore: number;
  } {
    const stats = this.getStats();
    return {
      stats,
      connections: this.getAllConnections(),
      uptime: Date.now(),
      healthScore: this.calculateHealthScore(stats),
    };
  }

  getRecommendedConnections(): number {
    const memory = process.memoryUsage();
    const ratio = memory.heapTotal > 0 ? (memory.heapTotal - memory.heapUsed) / memory.heapTotal : 0.5;
    return Math.max(1, Math.floor(this.config.maxConnections * Math.max(0.2, ratio)));
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const connection of this.connections.values()) {
        if (typeof connection.websocket?.ping === 'function') {
          try {
            connection.websocket.ping();
          } catch {
            connection.errorCount += 1;
            connection.state = ConnectionState.UNHEALTHY;
          }
        }
      }
      this.refreshStats();
    }, this.config.heartbeatInterval);
  }

  private attachSocketListeners(connection: ConnectionMetadata): void {
    const ws = connection.websocket;
    if (!ws || typeof ws.on !== 'function') {
      return;
    }

    ws.on('message', (data: Buffer | string) => {
      const size = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(String(data));
      connection.bytesReceived += size;
      connection.lastActivity = new Date();
      this.stats.messagesReceived += 1;
      this.stats.bytesReceived += size;
      this.refreshStats();
    });

    ws.on('error', () => {
      connection.errorCount += 1;
      connection.state = ConnectionState.UNHEALTHY;
      this.stats.failedConnections += 1;
      this.refreshStats();
    });

    ws.on('close', () => {
      this.removeConnection(connection.id);
    });

    ws.on('pong', () => {
      connection.lastHealthCheck = new Date();
      if (connection.state === ConnectionState.UNHEALTHY) {
        connection.state = ConnectionState.IDLE;
      }
      this.refreshStats();
    });
  }

  private refreshStats(): void {
    const all = Array.from(this.connections.values());
    const total = all.length;
    const active = all.filter((item) => item.state === ConnectionState.ACTIVE).length;
    const idle = all.filter((item) => item.state === ConnectionState.IDLE).length;
    const unhealthy = all.filter((item) => item.state === ConnectionState.UNHEALTHY).length;

    this.stats.totalConnections = total;
    this.stats.activeConnections = active;
    this.stats.idleConnections = idle;
    this.stats.unhealthyConnections = unhealthy;
    this.stats.connectionReuseRate = this.acquireCount > 0 ? this.reuseCount / this.acquireCount : 0;

    this.stats.averageLatency = this.latencies.length
      ? this.latencies.reduce((sum, value) => sum + value, 0) / this.latencies.length
      : 0;
    this.stats.maxLatency = this.latencies.length ? Math.max(...this.latencies) : 0;
    this.stats.minLatency = this.latencies.length ? Math.min(...this.latencies) : 0;
    this.stats.memoryUsage = process.memoryUsage();
  }

  private encodePayload(data: any): Buffer {
    if (Buffer.isBuffer(data)) {
      return data;
    }
    if (typeof data === 'string') {
      return Buffer.from(data);
    }
    return Buffer.from(JSON.stringify(data ?? {}));
  }

  private getNextUrl(): string | undefined {
    if (this.urlPool.length === 0) {
      return undefined;
    }
    const url = this.urlPool[this.currentUrlIndex];
    this.currentUrlIndex = (this.currentUrlIndex + 1) % this.urlPool.length;
    return url;
  }

  private calculateHealthScore(stats: ConnectionPoolStats): number {
    if (stats.totalConnections === 0) {
      return 100;
    }
    const unhealthyPenalty = (stats.unhealthyConnections / stats.totalConnections) * 40;
    const failurePenalty = (stats.failedConnections / Math.max(1, stats.totalConnections)) * 40;
    return Math.max(0, 100 - unhealthyPenalty - failurePenalty);
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export const createConnectionPool = (
  urlsOrConfig: string[] | Partial<ConnectionPoolConfig> = {},
  options: Partial<ConnectionPoolConfig> = {},
) => {
  if (Array.isArray(urlsOrConfig)) {
    return new ConnectionPool(urlsOrConfig, options);
  }
  return new ConnectionPool(urlsOrConfig, options);
};
