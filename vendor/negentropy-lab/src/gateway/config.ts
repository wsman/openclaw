/**
 * Config API路由
 */

import { Router } from 'express';

export const configRouter = Router();

// 获取配置
configRouter.get('/', (req, res) => {
  res.json({
    version: '1.0.0',
    environment: 'development',
    features: {
      constitution: true,
      memory: true,
      sync: true,
    },
  });
});

// 更新配置
configRouter.put('/', (req, res) => {
  res.json({
    success: true,
    message: 'Configuration updated',
    updatedKeys: Object.keys(req.body),
  });
});
