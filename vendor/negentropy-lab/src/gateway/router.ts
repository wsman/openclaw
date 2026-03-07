/**
 * API路由
 * 
 * @module gateway/router
 */

import { Router } from 'express';
import { agentRouter } from './agents.js';
import { taskRouter } from './tasks.js';
import { metricsRouter } from './metrics.js';
import { configRouter } from './config.js';
import { alertRouter } from './alerts.js';
import { constitutionRouter } from './constitution.js';

export function createRouter(): Router {
  const router = Router();
  
  // 状态检查
  router.get('/status', (req, res) => {
    res.json({
      connected: true,
      uptime: process.uptime(),
      connections: 0,
      messagesPerSecond: 0,
      lastUpdate: Date.now(),
    });
  });
  
  // 统计信息
  router.get('/stats', (req, res) => {
    res.json({
      totalConnections: 0,
      totalMessages: 0,
      avgLatency: 0,
      startTime: Date.now() - process.uptime() * 1000,
    });
  });
  
  // 子路由
  router.use('/agents', agentRouter);
  router.use('/tasks', taskRouter);
  router.use('/metrics', metricsRouter);
  router.use('/config', configRouter);
  router.use('/alerts', alertRouter);
  router.use('/constitution', constitutionRouter);
  
  return router;
}
