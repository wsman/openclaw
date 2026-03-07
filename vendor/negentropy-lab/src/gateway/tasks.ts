/**
 * Task API路由
 */

import { Router } from 'express';

export const taskRouter = Router();

// 获取所有任务
taskRouter.get('/', (req, res) => {
  res.json({
    tasks: [
      {
        id: 'task-001',
        name: '数据同步任务',
        status: 'running',
        priority: 'L2',
        progress: 65,
        createdAt: Date.now() - 3600000,
      },
    ],
    total: 1,
  });
});

// 创建任务
taskRouter.post('/', (req, res) => {
  res.json({
    success: true,
    taskId: `task-${Date.now()}`,
    status: 'pending',
  });
});

// 获取单个任务
taskRouter.get('/:id', (req, res) => {
  res.json({
    id: req.params.id,
    name: 'Task',
    status: 'pending',
    priority: 'L3',
    progress: 0,
    createdAt: Date.now(),
  });
});

// 取消任务
taskRouter.post('/:id/cancel', (req, res) => {
  res.json({
    success: true,
    taskId: req.params.id,
    status: 'cancelled',
  });
});
