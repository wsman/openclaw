import os from 'os';
import { EventEmitter } from 'events';
import { MDNSDiscoverer } from '../discovery/mdns/MDNSDiscoverer';
import { ServiceInfo } from '../discovery/types/ServiceInfo';
import { logger } from '../utils/logger';
import { ClusterBackplane } from './backplane/ClusterBackplane';
import { MemoryClusterBackplane } from './backplane/MemoryClusterBackplane';
import { RedisClusterBackplane, RedisClusterBackplaneOptions } from './backplane/RedisClusterBackplane';
import { ClusterTopologyStore } from './ClusterTopologyStore';
import { ClusterNodeRecord, ClusterTopologySnapshot } from './types';
import { setClusterRuntime } from './runtime';

export interface ClusterNodeOptions {
  nodeId: string;
  clusterId: string;
  name: string;
  role?: string;
  host?: string;
  httpPort: number;
  wsPort?: number;
  rpcPort?: number;
  capabilities?: string[];
  version?: string;
  metadata?: Record<string, string>;
  heartbeatIntervalMs?: number;
  nodeTtlMs?: number;
  peerRequestTimeoutMs?: number;
  clusterToken?: string;
  seedPeers?: string[];
  backplane?: ClusterBackplane;
  redis?: RedisClusterBackplaneOptions;
  discoverer?: MDNSDiscoverer | null;
}

type JoinPeerResponse = {
  success: boolean;
  node: ClusterNodeRecord;
  topology: ClusterTopologySnapshot;
};

export class ClusterNode extends EventEmitter {
  private readonly heartbeatIntervalMs: number;
  private readonly nodeTtlMs: number;
  private readonly peerRequestTimeoutMs: number;
  private readonly topologyStore: ClusterTopologyStore;
  private readonly backplane: ClusterBackplane;
  private readonly discoverer: MDNSDiscoverer | null;
  private heartbeatTimer?: NodeJS.Timeout;
  private syncTimer?: NodeJS.Timeout;
  private readonly seedPeers: string[];
  private started = false;
  private localNode: ClusterNodeRecord;

  constructor(private readonly options: ClusterNodeOptions) {
    super();
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 5000;
    this.nodeTtlMs = options.nodeTtlMs ?? this.heartbeatIntervalMs * 3;
    this.peerRequestTimeoutMs = options.peerRequestTimeoutMs ?? 3000;
    this.discoverer = options.discoverer ?? null;
    this.seedPeers = options.seedPeers ?? [];
    this.backplane = options.backplane
      ?? (options.redis || process.env.REDIS_URL || process.env.REDIS_HOST
        ? new RedisClusterBackplane({
            redisUrl: options.redis?.redisUrl || process.env.REDIS_URL,
            host: options.redis?.host,
            port: options.redis?.port,
            password: options.redis?.password,
            db: options.redis?.db,
            keyPrefix: options.redis?.keyPrefix || `negentropy:${options.clusterId}`,
          })
        : new MemoryClusterBackplane(options.clusterId));

    this.localNode = this.createLocalNodeRecord();
    this.topologyStore = new ClusterTopologyStore(this.localNode.clusterId, this.localNode.nodeId);
    this.topologyStore.upsert(this.localNode);
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.started = true;
    await this.backplane.start();
    setClusterRuntime({
      backplane: this.backplane,
      topologyStore: this.topologyStore,
    });

    this.attachDiscovererListeners();
    this.updateDiscoveryMetadata();
    await this.publishSelf();
    await this.syncFromBackplane();
    await this.joinSeedPeers();

    this.heartbeatTimer = setInterval(() => {
      void this.publishSelf();
    }, this.heartbeatIntervalMs);

    this.syncTimer = setInterval(() => {
      void this.syncFromBackplane();
    }, this.heartbeatIntervalMs);

    logger.info(`[ClusterNode] 集群节点已启动: ${this.localNode.nodeId} (${this.backplane.mode})`);
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    this.started = false;
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }

    await this.backplane.removeNode(this.localNode.nodeId);
    await this.backplane.stop();
    setClusterRuntime(null);
  }

  getCoordinationMode(): 'memory' | 'redis' {
    return this.backplane.mode;
  }

  getLocalNode(): ClusterNodeRecord {
    return { ...this.localNode };
  }

  getTopology(): ClusterNodeRecord[] {
    return this.topologyStore.list();
  }

  getTopologySnapshot(): ClusterTopologySnapshot {
    return this.topologyStore.getSnapshot(this.backplane.mode);
  }

  getBackplane(): ClusterBackplane {
    return this.backplane;
  }

  async publish<T = unknown>(channel: string, payload: T): Promise<void> {
    await this.backplane.publish(channel, payload, this.localNode.nodeId);
  }

  async subscribe<T = unknown>(channel: string, handler: (payload: T, sourceNodeId?: string) => void | Promise<void>): Promise<() => Promise<void>> {
    return this.backplane.subscribe<T>(channel, async (event) => {
      await handler(event.payload, event.sourceNodeId);
    });
  }

  acceptPeer(peer: ClusterNodeRecord, source: ClusterNodeRecord['discoveredVia'] = 'peer'): ClusterNodeRecord {
    const merged: ClusterNodeRecord = {
      ...peer,
      discoveredVia: source,
      lastSeen: Date.now(),
    };
    this.topologyStore.upsert(merged);
    return merged;
  }

  markNodeOffline(nodeId: string): void {
    this.topologyStore.markOffline(nodeId);
  }

  async syncFromBackplane(): Promise<void> {
    const nodes = await this.backplane.listNodes();
    if (nodes.length === 0) {
      this.topologyStore.upsert(this.localNode);
      return;
    }

    const seenNodeIds = new Set<string>();
    nodes.forEach((node) => {
      const source = node.nodeId === this.localNode.nodeId ? 'self' : 'backplane';
      seenNodeIds.add(node.nodeId);
      this.topologyStore.upsert({
        ...node,
        discoveredVia: source,
      });
    });

    this.topologyStore.list().forEach((node) => {
      if (node.nodeId !== this.localNode.nodeId && !seenNodeIds.has(node.nodeId)) {
        this.topologyStore.markOffline(node.nodeId);
      }
    });
  }

  private async publishSelf(): Promise<void> {
    this.localNode = this.createLocalNodeRecord();
    this.topologyStore.upsert(this.localNode);
    this.updateDiscoveryMetadata();
    await this.backplane.upsertNode(this.localNode, this.nodeTtlMs);
    await this.backplane.publish('cluster:nodes', this.localNode, this.localNode.nodeId);
  }

  private attachDiscovererListeners(): void {
    if (!this.discoverer) {
      return;
    }

    this.discoverer.on('service-found', (service: ServiceInfo) => {
      void this.handleServiceUpdate(service, 'mdns');
    });
    this.discoverer.on('service-updated', (service: ServiceInfo) => {
      void this.handleServiceUpdate(service, 'mdns');
    });
    this.discoverer.on('service-lost', (service: ServiceInfo) => {
      if (service.id && service.id !== this.localNode.nodeId) {
        this.markNodeOffline(service.id);
      }
    });
  }

  private async handleServiceUpdate(service: ServiceInfo, source: ClusterNodeRecord['discoveredVia']): Promise<void> {
    const peer = this.serviceToNodeRecord(service, source);
    if (!peer || peer.nodeId === this.localNode.nodeId || peer.clusterId !== this.localNode.clusterId) {
      return;
    }

    this.topologyStore.upsert(peer);
    await this.tryJoinPeer(peer);
  }

  private async joinSeedPeers(): Promise<void> {
    for (const peerUrl of this.seedPeers) {
      const normalizedUrl = peerUrl.replace(/\/$/, '');
      try {
        const response = await this.fetchJson<JoinPeerResponse>(`${normalizedUrl}/internal/cluster/join`, {
          method: 'POST',
          headers: this.createClusterHeaders(),
          body: JSON.stringify({ node: this.localNode }),
        });

        if (!response.success) {
          continue;
        }

        response.topology.nodes.forEach((node) => {
          if (node.nodeId !== this.localNode.nodeId) {
            this.acceptPeer(node, 'seed');
          }
        });
      } catch (error) {
        logger.warn(`[ClusterNode] 种子节点握手失败: ${normalizedUrl} - ${(error as Error).message}`);
      }
    }
  }

  private async tryJoinPeer(peer: ClusterNodeRecord): Promise<void> {
    if (!peer.httpPort || !peer.host) {
      return;
    }

    try {
      const response = await this.fetchJson<JoinPeerResponse>(
        `http://${peer.host}:${peer.httpPort}/internal/cluster/join`,
        {
          method: 'POST',
          headers: this.createClusterHeaders(),
          body: JSON.stringify({ node: this.localNode }),
        },
      );

      if (!response.success) {
        return;
      }

      this.acceptPeer(response.node, 'peer');
      response.topology.nodes.forEach((node) => {
        if (node.nodeId !== this.localNode.nodeId) {
          this.acceptPeer(node, 'peer');
        }
      });
    } catch (error) {
      logger.debug(`[ClusterNode] 节点握手失败 ${peer.nodeId}: ${(error as Error).message}`);
    }
  }

  private updateDiscoveryMetadata(): void {
    if (!this.discoverer) {
      return;
    }

    this.discoverer.setPresenceMetadata({
      clusterId: this.localNode.clusterId,
      host: this.localNode.host,
      httpPort: String(this.localNode.httpPort),
      wsPort: String(this.localNode.wsPort),
      rpcPort: String(this.localNode.rpcPort),
      capabilities: this.localNode.capabilities.join(','),
      load: this.localNode.load.toFixed(4),
      version: this.localNode.version,
      nodeName: this.localNode.name,
      role: this.localNode.role,
    });
  }

  private createLocalNodeRecord(): ClusterNodeRecord {
    const host = this.options.host || this.detectLocalAddress();
    const cpuCount = Math.max(os.cpus().length, 1);
    const loadAverage = os.loadavg()[0] / cpuCount;
    const memoryUsage = 1 - os.freemem() / os.totalmem();
    const load = Math.min(1, Math.max(loadAverage, memoryUsage, 0));

    return {
      nodeId: this.options.nodeId,
      clusterId: this.options.clusterId,
      name: this.options.name,
      role: this.options.role || 'gateway',
      host,
      httpPort: this.options.httpPort,
      wsPort: this.options.wsPort ?? this.options.httpPort,
      rpcPort: this.options.rpcPort ?? this.options.httpPort,
      version: this.options.version || '1.0.0',
      status: load > 0.85 ? 'degraded' : 'active',
      capabilities: this.options.capabilities ?? ['gateway', 'echo', 'cluster'],
      load,
      lastSeen: Date.now(),
      discoveredVia: 'self',
      metadata: {
        ...(this.options.metadata || {}),
        hostname: os.hostname(),
        platform: os.platform(),
      },
    };
  }

  private serviceToNodeRecord(service: ServiceInfo, source: ClusterNodeRecord['discoveredVia']): ClusterNodeRecord | null {
    const txt = service.txt || {};
    const clusterId = txt.clusterId || service.clusterId || this.localNode.clusterId;
    const host = txt.host || service.host;
    const httpPort = Number(txt.httpPort || service.httpPort || service.port || 0);
    if (!host || !httpPort) {
      return null;
    }

    return {
      nodeId: service.id,
      clusterId,
      name: txt.nodeName || service.name || service.id,
      role: txt.role || service.role || 'gateway',
      host,
      httpPort,
      wsPort: Number(txt.wsPort || service.wsPort || httpPort),
      rpcPort: Number(txt.rpcPort || service.rpcPort || httpPort),
      version: txt.version || service.version || '1.0.0',
      status: (service.status === 'offline' ? 'offline' : txt.status) as ClusterNodeRecord['status'] || 'active',
      capabilities: (txt.capabilities || service.capabilities?.join(',') || 'gateway').split(',').filter(Boolean),
      load: Number(txt.load || 0),
      lastSeen: service.lastSeen || Date.now(),
      discoveredVia: source,
      rtt: service.rtt,
      metadata: service.txt,
    };
  }

  private detectLocalAddress(): string {
    const interfaces = os.networkInterfaces();
    for (const records of Object.values(interfaces)) {
      for (const record of records || []) {
        if (record.family === 'IPv4' && !record.internal) {
          return record.address;
        }
      }
    }
    return '127.0.0.1';
  }

  private createClusterHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-cluster-node-id': this.localNode.nodeId,
    };

    if (this.options.clusterToken) {
      headers['x-cluster-token'] = this.options.clusterToken;
    }

    return headers;
  }

  private async fetchJson<T>(url: string, init: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.peerRequestTimeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json() as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
