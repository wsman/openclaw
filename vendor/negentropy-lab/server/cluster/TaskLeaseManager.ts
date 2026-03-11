import { ClusterBackplane } from './backplane/ClusterBackplane';
import { ClusterNodeRecord, ClusterTaskLease } from './types';

export interface TaskLeaseSelectionOptions {
  requiredCapabilities?: string[];
  preferredNodeId?: string;
  excludedNodeIds?: string[];
}

export class TaskLeaseManager {
  constructor(private readonly backplane: ClusterBackplane) {}

  async acquire(taskId: string, ownerNodeId: string, ttlMs: number, metadata?: Record<string, unknown>): Promise<ClusterTaskLease | null> {
    return this.backplane.tryAcquireTaskLease(taskId, ownerNodeId, ttlMs, metadata);
  }

  async renew(taskId: string, ownerNodeId: string, ttlMs: number): Promise<ClusterTaskLease | null> {
    return this.backplane.renewTaskLease(taskId, ownerNodeId, ttlMs);
  }

  async release(taskId: string, ownerNodeId: string): Promise<boolean> {
    return this.backplane.releaseTaskLease(taskId, ownerNodeId);
  }

  async getLease(taskId: string): Promise<ClusterTaskLease | null> {
    return this.backplane.getTaskLease(taskId);
  }

  selectNode(nodes: ClusterNodeRecord[], options: TaskLeaseSelectionOptions = {}): ClusterNodeRecord | null {
    const excluded = new Set(options.excludedNodeIds || []);
    const candidates = nodes.filter((node) => {
      if (excluded.has(node.nodeId)) {
        return false;
      }
      if (node.status === 'offline' || node.status === 'maintenance') {
        return false;
      }
      if (!options.requiredCapabilities || options.requiredCapabilities.length === 0) {
        return true;
      }
      return options.requiredCapabilities.every((capability) => node.capabilities.includes(capability));
    });

    if (options.preferredNodeId) {
      const preferred = candidates.find((node) => node.nodeId === options.preferredNodeId);
      if (preferred) {
        return preferred;
      }
    }

    const sorted = candidates.sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === 'active' ? -1 : 1;
      }
      if (left.load !== right.load) {
        return left.load - right.load;
      }
      return right.lastSeen - left.lastSeen;
    });

    return sorted[0] ?? null;
  }
}

