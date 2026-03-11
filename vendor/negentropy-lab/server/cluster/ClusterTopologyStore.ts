import { EventEmitter } from 'events';
import { ClusterNodeRecord, ClusterTopologySnapshot } from './types';

export class ClusterTopologyStore extends EventEmitter {
  private readonly nodes = new Map<string, ClusterNodeRecord>();

  constructor(private readonly clusterId: string, private readonly localNodeId: string) {
    super();
  }

  upsert(node: ClusterNodeRecord): ClusterNodeRecord {
    const normalized = { ...node };
    this.nodes.set(node.nodeId, normalized);
    this.emit('changed', this.getSnapshot('memory'));
    return normalized;
  }

  remove(nodeId: string): void {
    if (this.nodes.delete(nodeId)) {
      this.emit('changed', this.getSnapshot('memory'));
    }
  }

  markOffline(nodeId: string): void {
    const existing = this.nodes.get(nodeId);
    if (!existing) {
      return;
    }

    this.nodes.set(nodeId, {
      ...existing,
      status: 'offline',
      lastSeen: Date.now(),
    });
    this.emit('changed', this.getSnapshot('memory'));
  }

  getNode(nodeId: string): ClusterNodeRecord | undefined {
    const node = this.nodes.get(nodeId);
    return node ? { ...node } : undefined;
  }

  list(): ClusterNodeRecord[] {
    return Array.from(this.nodes.values())
      .map((node) => ({ ...node }))
      .sort((left, right) => left.nodeId.localeCompare(right.nodeId));
  }

  replaceAll(nodes: ClusterNodeRecord[]): void {
    this.nodes.clear();
    nodes.forEach((node) => this.nodes.set(node.nodeId, { ...node }));
    this.emit('changed', this.getSnapshot('memory'));
  }

  getSnapshot(coordinationMode: 'memory' | 'redis'): ClusterTopologySnapshot {
    return {
      clusterId: this.clusterId,
      localNodeId: this.localNodeId,
      coordinationMode,
      nodes: this.list(),
      generatedAt: Date.now(),
    };
  }
}

