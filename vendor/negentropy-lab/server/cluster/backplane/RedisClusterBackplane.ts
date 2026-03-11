import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { ClusterBackplane, ClusterMessageHandler } from './ClusterBackplane';
import { ClusterEventEnvelope, ClusterNodeRecord, ClusterTaskLease, DistributedAgentRecord } from '../types';

export interface RedisClusterBackplaneOptions {
  redisUrl?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export class RedisClusterBackplane implements ClusterBackplane {
  readonly mode = 'redis' as const;
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly keyPrefix: string;
  private readonly handlers = new Map<string, Set<ClusterMessageHandler>>();
  private started = false;

  constructor(options: RedisClusterBackplaneOptions = {}) {
    const keyPrefix = options.keyPrefix || 'negentropy:cluster';
    this.keyPrefix = keyPrefix.replace(/:$/, '');

    const config = options.redisUrl
      ? options.redisUrl
      : {
          host: options.host || process.env.REDIS_HOST || '127.0.0.1',
          port: options.port || Number(process.env.REDIS_PORT || 6379),
          password: options.password || process.env.REDIS_PASSWORD || undefined,
          db: options.db ?? Number(process.env.REDIS_DB || 0),
        };

    this.publisher = new Redis(config as any);
    this.subscriber = new Redis(config as any);
    this.subscriber.on('message', (channel, message) => {
      const handlers = this.handlers.get(channel);
      if (!handlers || handlers.size === 0) {
        return;
      }

      const parsed = JSON.parse(message) as ClusterEventEnvelope;
      handlers.forEach((handler) => {
        void handler(parsed);
      });
    });
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;
  }

  async stop(): Promise<void> {
    await this.subscriber.quit();
    await this.publisher.quit();
    this.started = false;
  }

  async publish<T = unknown>(channel: string, payload: T, sourceNodeId?: string): Promise<void> {
    const event: ClusterEventEnvelope<T> = {
      channel,
      timestamp: Date.now(),
      sourceNodeId,
      payload,
    };
    await this.publisher.publish(channel, JSON.stringify(event));
  }

  async subscribe<T = unknown>(channel: string, handler: ClusterMessageHandler<T>): Promise<() => Promise<void>> {
    const handlers = this.handlers.get(channel) ?? new Set<ClusterMessageHandler>();
    handlers.add(handler as ClusterMessageHandler);
    this.handlers.set(channel, handlers);
    await this.subscriber.subscribe(channel);

    return async () => {
      const existing = this.handlers.get(channel);
      if (!existing) {
        return;
      }

      existing.delete(handler as ClusterMessageHandler);
      if (existing.size === 0) {
        this.handlers.delete(channel);
        await this.subscriber.unsubscribe(channel);
      }
    };
  }

  async upsertNode(node: ClusterNodeRecord, ttlMs: number): Promise<void> {
    const key = this.nodeKey(node.nodeId);
    const tx = this.publisher.multi();
    tx.sadd(this.nodesIndexKey(), node.nodeId);
    tx.set(key, JSON.stringify(node), 'PX', ttlMs);
    await tx.exec();
  }

  async removeNode(nodeId: string): Promise<void> {
    const tx = this.publisher.multi();
    tx.srem(this.nodesIndexKey(), nodeId);
    tx.del(this.nodeKey(nodeId));
    await tx.exec();
  }

  async listNodes(): Promise<ClusterNodeRecord[]> {
    return this.readIndexedValues<ClusterNodeRecord>(this.nodesIndexKey(), (id) => this.nodeKey(id));
  }

  async upsertAgent(agent: DistributedAgentRecord, ttlMs: number): Promise<void> {
    const key = this.agentKey(agent.agentId);
    const tx = this.publisher.multi();
    tx.sadd(this.agentsIndexKey(), agent.agentId);
    tx.set(key, JSON.stringify(agent), 'PX', ttlMs);
    await tx.exec();
  }

  async removeAgent(agentId: string): Promise<void> {
    const tx = this.publisher.multi();
    tx.srem(this.agentsIndexKey(), agentId);
    tx.del(this.agentKey(agentId));
    await tx.exec();
  }

  async listAgents(): Promise<DistributedAgentRecord[]> {
    return this.readIndexedValues<DistributedAgentRecord>(this.agentsIndexKey(), (id) => this.agentKey(id));
  }

  async tryAcquireTaskLease(
    taskId: string,
    ownerNodeId: string,
    ttlMs: number,
    metadata?: Record<string, unknown>,
  ): Promise<ClusterTaskLease | null> {
    const lease: ClusterTaskLease = {
      taskId,
      ownerNodeId,
      leaseId: uuidv4(),
      createdAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
      metadata,
    };

    const result = await this.publisher.set(this.leaseKey(taskId), JSON.stringify(lease), 'PX', ttlMs, 'NX');
    return result === 'OK' ? lease : null;
  }

  async renewTaskLease(taskId: string, ownerNodeId: string, ttlMs: number): Promise<ClusterTaskLease | null> {
    const key = this.leaseKey(taskId);
    const existing = await this.getTaskLease(taskId);
    if (!existing || existing.ownerNodeId !== ownerNodeId) {
      return null;
    }

    const renewed: ClusterTaskLease = {
      ...existing,
      expiresAt: Date.now() + ttlMs,
    };
    await this.publisher.set(key, JSON.stringify(renewed), 'PX', ttlMs);
    return renewed;
  }

  async releaseTaskLease(taskId: string, ownerNodeId: string): Promise<boolean> {
    const existing = await this.getTaskLease(taskId);
    if (!existing || existing.ownerNodeId !== ownerNodeId) {
      return false;
    }
    await this.publisher.del(this.leaseKey(taskId));
    return true;
  }

  async getTaskLease(taskId: string): Promise<ClusterTaskLease | null> {
    const raw = await this.publisher.get(this.leaseKey(taskId));
    return raw ? (JSON.parse(raw) as ClusterTaskLease) : null;
  }

  private async readIndexedValues<T>(indexKey: string, keyForId: (id: string) => string): Promise<T[]> {
    const ids = await this.publisher.smembers(indexKey);
    if (ids.length === 0) {
      return [];
    }

    const pipeline = this.publisher.pipeline();
    ids.forEach((id) => pipeline.get(keyForId(id)));
    const results = await pipeline.exec();

    const values: T[] = [];
    const missingIds: string[] = [];

    results?.forEach((tuple, index) => {
      const [, raw] = tuple;
      if (!raw) {
        missingIds.push(ids[index]);
        return;
      }
      values.push(JSON.parse(raw as string) as T);
    });

    if (missingIds.length > 0) {
      await this.publisher.srem(indexKey, ...missingIds);
    }

    return values;
  }

  private nodesIndexKey(): string {
    return `${this.keyPrefix}:nodes:index`;
  }

  private nodeKey(nodeId: string): string {
    return `${this.keyPrefix}:nodes:${nodeId}`;
  }

  private agentsIndexKey(): string {
    return `${this.keyPrefix}:agents:index`;
  }

  private agentKey(agentId: string): string {
    return `${this.keyPrefix}:agents:${agentId}`;
  }

  private leaseKey(taskId: string): string {
    return `${this.keyPrefix}:leases:${taskId}`;
  }
}

