/**
 * Constitution API路由
 */

import { Router } from 'express';

export const constitutionRouter = Router();

// 获取合规状态
constitutionRouter.get('/compliance', (req, res) => {
  res.json({
    overall: 95.5,
    articles: [
      { id: '§101', name: '单一真理源', compliance: 100 },
      { id: '§102', name: '熵减原则', compliance: 98 },
      { id: '§103', name: '同步公理', compliance: 95 },
    ],
    lastUpdate: Date.now(),
  });
});

// 获取违规列表
constitutionRouter.get('/violations', (req, res) => {
  res.json({
    violations: [],
    total: 0,
  });
});
