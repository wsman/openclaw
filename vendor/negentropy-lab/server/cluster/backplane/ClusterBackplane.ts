import { ClusterEventEnvelope, ClusterNodeRecord, ClusterTaskLease, DistributedAgentRecord } from '../types';

export type ClusterMessageHandler<T = unknown> = (event: ClusterEventEnvelope<T>) => void | Promise<void>;

export interface ClusterBackplane {
  readonly mode: 'memory' | 'redis';
  start(): Promise<void>;
  stop(): Promise<void>;
  publish<T = unknown>(channel: string, payload: T, sourceNodeId?: string): Promise<void>;
  subscribe<T = unknown>(channel: string, handler: ClusterMessageHandler<T>): Promise<() => Promise<void>>;
  upsertNode(node: ClusterNodeRecord, ttlMs: number): Promise<void>;
  removeNode(nodeId: string): Promise<void>;
  listNodes(): Promise<ClusterNodeRecord[]>;
  upsertAgent(agent: DistributedAgentRecord, ttlMs: number): Promise<void>;
  removeAgent(agentId: string): Promise<void>;
  listAgents(): Promise<DistributedAgentRecord[]>;
  tryAcquireTaskLease(
    taskId: string,
    ownerNodeId: string,
    ttlMs: number,
    metadata?: Record<string, unknown>,
  ): Promise<ClusterTaskLease | null>;
  renewTaskLease(taskId: string, ownerNodeId: string, ttlMs: number): Promise<ClusterTaskLease | null>;
  releaseTaskLease(taskId: string, ownerNodeId: string): Promise<boolean>;
  getTaskLease(taskId: string): Promise<ClusterTaskLease | null>;
}

