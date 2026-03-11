/**
 * 🔒 Internal Cluster Router - 内部集群路由
 * 
 * @constitution
 * §101 同步公理: 代码与文档必须原子性同步
 * §102 熵减原则: 标准化内部通信，降低系统熵值
 * §105 数据完整性公理: 节点通信必须经过授权验证
 * §504 监控系统公理: 集群心跳必须实时可观测
 * §152 单一真理源公理: 集群状态统一管理
 * 
 * @filename cluster.ts
 * @version 1.0.0
 * @category api/internal
 * @last_updated 2026-03-09
 */

import { Request, Response, Router } from 'express';
import { ClusterNode } from '../../cluster/ClusterNode';
import { ClusterTaskDispatcher } from '../../cluster/ClusterTaskDispatcher';
import { ClusterTaskRequest } from '../../cluster/types';

export interface InternalClusterRouterOptions {
  clusterNode: ClusterNode;
  taskDispatcher: ClusterTaskDispatcher;
  clusterToken?: string;
}

function isAuthorized(req: Request, clusterToken?: string): boolean {
  if (!clusterToken) {
    return true;
  }
  return req.get('x-cluster-token') === clusterToken;
}

export function createInternalClusterRouter(options: InternalClusterRouterOptions): Router {
  const router = Router();

  router.use((req: Request, res: Response, next) => {
    if (!isAuthorized(req, options.clusterToken)) {
      res.status(401).json({
        success: false,
        error: 'unauthorized_cluster_request',
      });
      return;
    }
    next();
  });

  router.get('/topology', (_req, res) => {
    res.json({
      success: true,
      node: options.clusterNode.getLocalNode(),
      topology: options.clusterNode.getTopologySnapshot(),
    });
  });

  router.post('/join', (req, res) => {
    const node = req.body?.node;
    if (!node?.nodeId) {
      res.status(400).json({
        success: false,
        error: 'invalid_node_descriptor',
      });
      return;
    }

    options.clusterNode.acceptPeer(node, 'peer');
    res.json({
      success: true,
      node: options.clusterNode.getLocalNode(),
      topology: options.clusterNode.getTopologySnapshot(),
    });
  });

  router.post('/heartbeat', (req, res) => {
    const node = req.body?.node;
    if (!node?.nodeId) {
      res.status(400).json({
        success: false,
        error: 'invalid_node_descriptor',
      });
      return;
    }

    options.clusterNode.acceptPeer(node, 'peer');
    res.json({
      success: true,
      node: options.clusterNode.getLocalNode(),
      timestamp: Date.now(),
    });
  });

  router.post('/tasks/execute', async (req, res) => {
    const task = req.body?.task as ClusterTaskRequest | undefined;
    if (!task?.taskId || !task.type) {
      res.status(400).json({
        success: false,
        error: 'invalid_task_request',
      });
      return;
    }

    const response = await options.taskDispatcher.execute(task);
    res.status(response.ok ? 200 : 500).json(response);
  });

  return router;
}
