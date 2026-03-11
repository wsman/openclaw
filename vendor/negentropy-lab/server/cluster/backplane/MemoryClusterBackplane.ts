import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { ClusterBackplane, ClusterMessageHandler } from './ClusterBackplane';
import { ClusterEventEnvelope, ClusterNodeRecord, ClusterTaskLease, DistributedAgentRecord } from '../types';

type ExpiringValue<T> = {
  value: T;
  expiresAt: number;
};

class MemoryClusterState {
  readonly emitter = new EventEmitter();
  readonly nodes = new Map<string, ExpiringValue<ClusterNodeRecord>>();
  readonly agents = new Map<string, ExpiringValue<DistributedAgentRecord>>();
  readonly leases = new Map<string, ExpiringValue<ClusterTaskLease>>();
}

const states = new Map<string, MemoryClusterState>();

function getState(namespace: string): MemoryClusterState {
  if (!states.has(namespace)) {
    states.set(namespace, new MemoryClusterState());
  }
  return states.get(namespace)!;
}

function cloneEvent<T>(event: ClusterEventEnvelope<T>): ClusterEventEnvelope<T> {
  return {
    channel: event.channel,
    timestamp: event.timestamp,
    sourceNodeId: event.sourceNodeId,
    payload: event.payload,
  };
}

export class MemoryClusterBackplane implements ClusterBackplane {
  readonly mode = 'memory' as const;
  private readonly state: MemoryClusterState;

  constructor(private readonly namespace: string) {
    this.state = getState(namespace);
  }

  async start(): Promise<void> {}

  async stop(): Promise<void> {}

  async publish<T = unknown>(channel: string, payload: T, sourceNodeId?: string): Promise<void> {
    const event: ClusterEventEnvelope<T> = {
      channel,
      timestamp: Date.now(),
      sourceNodeId,
      payload,
    };
    this.state.emitter.emit(channel, cloneEvent(event));
  }

  async subscribe<T = unknown>(channel: string, handler: ClusterMessageHandler<T>): Promise<() => Promise<void>> {
    const listener = (event: ClusterEventEnvelope<T>) => {
      void handler(cloneEvent(event));
    };
    this.state.emitter.on(channel, listener);
    return async () => {
      this.state.emitter.off(channel, listener);
    };
  }

  async upsertNode(node: ClusterNodeRecord, ttlMs: number): Promise<void> {
    this.pruneExpired();
    this.state.nodes.set(node.nodeId, {
      value: { ...node },
      expiresAt: Date.now() + ttlMs,
    });
  }

  async removeNode(nodeId: string): Promise<void> {
    this.state.nodes.delete(nodeId);
  }

  async listNodes(): Promise<ClusterNodeRecord[]> {
    this.pruneExpired();
    return Array.from(this.state.nodes.values()).map((entry) => ({ ...entry.value }));
  }

  async upsertAgent(agent: DistributedAgentRecord, ttlMs: number): Promise<void> {
    this.pruneExpired();
    this.state.agents.set(agent.agentId, {
      value: { ...agent },
      expiresAt: Date.now() + ttlMs,
    });
  }

  async removeAgent(agentId: string): Promise<void> {
    this.state.agents.delete(agentId);
  }

  async listAgents(): Promise<DistributedAgentRecord[]> {
    this.pruneExpired();
    return Array.from(this.state.agents.values()).map((entry) => ({ ...entry.value }));
  }

  async tryAcquireTaskLease(
    taskId: string,
    ownerNodeId: string,
    ttlMs: number,
    metadata?: Record<string, unknown>,
  ): Promise<ClusterTaskLease | null> {
    this.pruneExpired();
    if (this.state.leases.has(taskId)) {
      return null;
    }

    const now = Date.now();
    const lease: ClusterTaskLease = {
      taskId,
      ownerNodeId,
      leaseId: uuidv4(),
      createdAt: now,
      expiresAt: now + ttlMs,
      metadata,
    };

    this.state.leases.set(taskId, {
      value: lease,
      expiresAt: lease.expiresAt,
    });
    return { ...lease };
  }

  async renewTaskLease(taskId: string, ownerNodeId: string, ttlMs: number): Promise<ClusterTaskLease | null> {
    this.pruneExpired();
    const existing = this.state.leases.get(taskId);
    if (!existing || existing.value.ownerNodeId !== ownerNodeId) {
      return null;
    }

    const renewed: ClusterTaskLease = {
      ...existing.value,
      expiresAt: Date.now() + ttlMs,
    };

    this.state.leases.set(taskId, {
      value: renewed,
      expiresAt: renewed.expiresAt,
    });
    return { ...renewed };
  }

  async releaseTaskLease(taskId: string, ownerNodeId: string): Promise<boolean> {
    this.pruneExpired();
    const existing = this.state.leases.get(taskId);
    if (!existing || existing.value.ownerNodeId !== ownerNodeId) {
      return false;
    }
    this.state.leases.delete(taskId);
    return true;
  }

  async getTaskLease(taskId: string): Promise<ClusterTaskLease | null> {
    this.pruneExpired();
    const existing = this.state.leases.get(taskId);
    return existing ? { ...existing.value } : null;
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [nodeId, entry] of this.state.nodes.entries()) {
      if (entry.expiresAt <= now) {
        this.state.nodes.delete(nodeId);
      }
    }
    for (const [agentId, entry] of this.state.agents.entries()) {
      if (entry.expiresAt <= now) {
        this.state.agents.delete(agentId);
      }
    }
    for (const [taskId, entry] of this.state.leases.entries()) {
      if (entry.expiresAt <= now) {
        this.state.leases.delete(taskId);
      }
    }
  }
}

