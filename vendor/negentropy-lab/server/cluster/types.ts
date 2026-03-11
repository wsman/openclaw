export type ClusterNodeStatus = 'active' | 'degraded' | 'offline' | 'maintenance';

export interface ClusterNodeRecord {
  nodeId: string;
  clusterId: string;
  name: string;
  role: string;
  host: string;
  httpPort: number;
  wsPort: number;
  rpcPort: number;
  version: string;
  status: ClusterNodeStatus;
  capabilities: string[];
  load: number;
  lastSeen: number;
  discoveredVia: 'self' | 'mdns' | 'manual' | 'peer' | 'backplane' | 'seed';
  rtt?: number;
  metadata?: Record<string, string>;
}

export interface ClusterTaskRequest {
  taskId: string;
  type: string;
  payload?: unknown;
  originNodeId: string;
  requiredCapabilities?: string[];
  preferredNodeId?: string;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
}

export interface ClusterTaskResponse {
  taskId: string;
  ok: boolean;
  executedBy: string;
  durationMs: number;
  result?: unknown;
  error?: string;
}

export interface ClusterTaskLease {
  taskId: string;
  ownerNodeId: string;
  leaseId: string;
  createdAt: number;
  expiresAt: number;
  metadata?: Record<string, unknown>;
}

export interface DistributedAgentRecord {
  agentId: string;
  nodeId: string;
  name: string;
  version: string;
  expertise: string[];
  capacity: number;
  currentLoad: number;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  lastHeartbeat: number;
  metadata?: Record<string, unknown>;
}

export interface ClusterEventEnvelope<T = unknown> {
  channel: string;
  timestamp: number;
  sourceNodeId?: string;
  payload: T;
}

export interface ClusterTopologySnapshot {
  clusterId: string;
  localNodeId: string;
  coordinationMode: 'memory' | 'redis';
  nodes: ClusterNodeRecord[];
  generatedAt: number;
}

