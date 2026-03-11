/**
 * 🌐 Cluster API Router - 集群API路由
 * 
 * @constitution
 * §101 同步公理: 代码与文档必须原子性同步
 * §102 熵减原则: 标准化集群通信，降低系统熵值
 * §105 数据完整性公理: 任务分发必须经过验证
 * §504 监控系统公理: 集群状态必须实时可观测
 * §152 单一真理源公理: 集群拓扑统一管理
 * 
 * @filename cluster.ts
 * @version 1.0.0
 * @category api/cluster
 * @last_updated 2026-03-09
 */

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ClusterNode } from '../cluster/ClusterNode';
import { ClusterTaskDispatcher } from '../cluster/ClusterTaskDispatcher';
import { TaskLeaseManager } from '../cluster/TaskLeaseManager';
import { ClusterTaskRequest, ClusterTaskResponse } from '../cluster/types';

export interface ClusterApiRouterOptions {
  clusterNode: ClusterNode;
  taskDispatcher: ClusterTaskDispatcher;
  taskLeaseManager: TaskLeaseManager;
  clusterToken?: string;
}

async function forwardTask(
  clusterToken: string | undefined,
  targetHost: string,
  targetPort: number,
  task: ClusterTaskRequest,
): Promise<ClusterTaskResponse> {
  const response = await fetch(`http://${targetHost}:${targetPort}/internal/cluster/tasks/execute`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(clusterToken ? { 'x-cluster-token': clusterToken } : {}),
    },
    body: JSON.stringify({ task }),
  });

  return await response.json() as ClusterTaskResponse;
}

export function createClusterApiRouter(options: ClusterApiRouterOptions): Router {
  const router = Router();

  router.get('/topology', (_req, res) => {
    res.json({
      success: true,
      topology: options.clusterNode.getTopologySnapshot(),
    });
  });

  router.get('/nodes', (_req, res) => {
    res.json({
      success: true,
      nodes: options.clusterNode.getTopology(),
    });
  });

  router.get('/leases/:taskId', async (req, res) => {
    const lease = await options.taskLeaseManager.getLease(req.params.taskId);
    res.json({
      success: true,
      lease,
    });
  });

  router.post('/tasks/dispatch', async (req, res) => {
    const localNode = options.clusterNode.getLocalNode();
    const task: ClusterTaskRequest = {
      taskId: req.body?.taskId || uuidv4(),
      type: req.body?.type,
      payload: req.body?.payload,
      originNodeId: localNode.nodeId,
      requiredCapabilities: req.body?.requiredCapabilities || [],
      preferredNodeId: req.body?.preferredNodeId,
      timeoutMs: req.body?.timeoutMs || 15000,
      metadata: req.body?.metadata || {},
    };

    if (!task.type) {
      res.status(400).json({
        success: false,
        error: 'task.type is required',
      });
      return;
    }

    const topology = options.clusterNode.getTopology();
    const primaryNode = options.taskLeaseManager.selectNode(topology, {
      requiredCapabilities: task.requiredCapabilities,
      preferredNodeId: task.preferredNodeId,
    });

    if (!primaryNode) {
      res.status(503).json({
        success: false,
        error: 'no_available_cluster_node',
      });
      return;
    }

    const attempt = async (targetNodeId: string, excludedNodeIds: string[] = []) => {
      const target = options.taskLeaseManager.selectNode(topology, {
        requiredCapabilities: task.requiredCapabilities,
        preferredNodeId: targetNodeId,
        excludedNodeIds,
      });

      if (!target) {
        return null;
      }

      const lease = await options.taskLeaseManager.acquire(task.taskId, target.nodeId, task.timeoutMs || 15000, {
        type: task.type,
      });

      if (!lease) {
        return null;
      }

      try {
        if (target.nodeId === localNode.nodeId) {
          return await options.taskDispatcher.execute(task);
        }

        return await forwardTask(
          options.clusterToken,
          target.host,
          target.httpPort,
          task,
        );
      } catch (error) {
        options.clusterNode.markNodeOffline(target.nodeId);
        if (excludedNodeIds.includes(target.nodeId)) {
          throw error;
        }
        return attempt(primaryNode.nodeId, [...excludedNodeIds, target.nodeId]);
      } finally {
        await options.taskLeaseManager.release(task.taskId, target.nodeId);
      }
    };

    const response = await attempt(primaryNode.nodeId);
    if (!response) {
      res.status(503).json({
        success: false,
        error: 'task_lease_conflict',
      });
      return;
    }

    res.status(response.ok ? 200 : 500).json(response);
  });

  return router;
}
