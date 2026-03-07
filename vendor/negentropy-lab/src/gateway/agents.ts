/**
 * Agent API路由
 */

import { Router } from 'express';

export const agentRouter = Router();

// 获取所有Agent
agentRouter.get('/', (req, res) => {
  res.json({
    agents: [
      {
        id: 'agent-001',
        name: '数据采集Agent',
        status: 'running',
        tasksCompleted: 156,
        lastActive: Date.now(),
      },
    ],
    total: 1,
  });
});

// 获取单个Agent
agentRouter.get('/:id', (req, res) => {
  res.json({
    id: req.params.id,
    name: 'Agent',
    status: 'running',
    tasksCompleted: 0,
    lastActive: Date.now(),
  });
});

// 启动Agent
agentRouter.post('/:id/start', (req, res) => {
  res.json({
    success: true,
    agentId: req.params.id,
    status: 'starting',
  });
});

// 停止Agent
agentRouter.post('/:id/stop', (req, res) => {
  res.json({
    success: true,
    agentId: req.params.id,
    status: 'stopping',
  });
});

// 获取Agent状态
agentRouter.get('/:id/status', (req, res) => {
  res.json({
    id: req.params.id,
    status: 'running',
    currentTask: null,
    metrics: {
      cpu: 25.5,
      memory: 128,
    },
  });
});
