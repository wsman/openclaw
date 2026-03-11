/**
 * 🚀 集群WebSocket API端点
 * 
 * 宪法依据：
 * - §107 通信安全公理：集群间通信的安全管理
 * - §321-§324 实时通信公理：WebSocket状态同步
 * 
 * @filename server/api/cluster-ws.ts
 * @version 1.0.0
 * @category api
 * @last_updated 2026-03-09
 */

import { Router } from 'express';
import { WebSocketClusterBroadcaster } from '../cluster/websocket';
import { logger } from '../utils/logger';

const router = Router();

/**
 * 获取全局WebSocket连接视图
 * GET /api/cluster/websocket/connections
 */
router.get('/connections', async (req, res) => {
  try {
    const broadcaster = req.app.get('clusterWsBroadcaster') as WebSocketClusterBroadcaster | null;
    
    if (!broadcaster) {
      return res.status(503).json({
        error: 'Cluster WebSocket broadcaster not available',
        message: 'Cluster mode may not be enabled',
      });
    }
    
    const connections = await broadcaster.getGlobalConnections();
    
    res.json({
      total: connections.length,
      byStatus: {
        connected: connections.filter(c => c.status === 'connected').length,
        disconnected: connections.filter(c => c.status === 'disconnected').length,
      },
      byNode: connections.reduce((acc, conn) => {
        acc[conn.nodeId] = (acc[conn.nodeId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      connections,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error(`[API] 获取集群WebSocket连接失败: ${error.message}`);
    res.status(500).json({
      error: 'Failed to get cluster WebSocket connections',
      message: error.message,
    });
  }
});

/**
 * 获取集群WebSocket广播器统计信息
 * GET /api/cluster/websocket/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const broadcaster = req.app.get('clusterWsBroadcaster') as WebSocketClusterBroadcaster | null;
    
    if (!broadcaster) {
      return res.status(503).json({
        error: 'Cluster WebSocket broadcaster not available',
        message: 'Cluster mode may not be enabled',
      });
    }
    
    const stats = broadcaster.getStats();
    
    res.json({
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error(`[API] 获取集群WebSocket统计失败: ${error.message}`);
    res.status(500).json({
      error: 'Failed to get cluster WebSocket stats',
      message: error.message,
    });
  }
});

/**
 * 广播WebSocket事件到集群（内部API）
 * POST /api/cluster/websocket/broadcast
 */
router.post('/broadcast', async (req, res) => {
  try {
    const broadcaster = req.app.get('clusterWsBroadcaster') as WebSocketClusterBroadcaster | null;
    
    if (!broadcaster) {
      return res.status(503).json({
        error: 'Cluster WebSocket broadcaster not available',
        message: 'Cluster mode may not be enabled',
      });
    }
    
    const { event, payload, scope, ttl, routing, deliverLocal } = req.body;
    
    if (!event) {
      return res.status(400).json({
        error: 'Missing required field: event',
      });
    }
    
    await broadcaster.broadcastToCluster(event, payload, scope, {
      ttl,
      routing,
      deliverLocal,
    });
    
    res.json({
      broadcasted: true,
      event,
      scope,
      routing: routing ?? { strategy: 'broadcast' },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error(`[API] 广播WebSocket事件失败: ${error.message}`);
    res.status(500).json({
      error: 'Failed to broadcast WebSocket event',
      message: error.message,
    });
  }
});

export default router;
