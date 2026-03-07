/**
 * Metrics API路由
 */

import { Router } from 'express';

export const metricsRouter = Router();

// 获取系统指标
metricsRouter.get('/', (req, res) => {
  res.json({
    cpu: 45.5,
    memory: 62.3,
    network: {
      in: 50000,
      out: 30000,
    },
    entropy: {
      h_sys: 0.25,
      h_cog: 0.18,
      h_struct: 0.22,
      h_align: 0.15,
    },
    timestamp: Date.now(),
  });
});

// 获取熵值
metricsRouter.get('/entropy', (req, res) => {
  res.json({
    h_sys: 0.25,
    h_cog: 0.18,
    h_struct: 0.22,
    h_align: 0.15,
    trend: 'decreasing',
    timestamp: Date.now(),
  });
});
