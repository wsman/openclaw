/**
 * Alert API路由
 */

import { Router } from 'express';

export const alertRouter = Router();

// 获取告警列表
alertRouter.get('/', (req, res) => {
  res.json({
    alerts: [],
    total: 0,
  });
});

// 创建告警
alertRouter.post('/', (req, res) => {
  res.json({
    success: true,
    alertId: `alert-${Date.now()}`,
  });
});

// 确认告警
alertRouter.post('/:id/acknowledge', (req, res) => {
  res.json({
    success: true,
    alertId: req.params.id,
    acknowledged: true,
  });
});

// 清除告警
alertRouter.delete('/:id', (req, res) => {
  res.json({
    success: true,
    alertId: req.params.id,
  });
});
