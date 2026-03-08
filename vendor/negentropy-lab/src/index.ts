/**
 * Negentropy-Lab Gateway Server
 * 
 * 主入口文件
 * 
 * @module index
 * @version 1.0.0
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { createRouter } from './gateway/router.js';
import { WebSocketServer } from './websocket/server.js';
import { logger } from './utils/logger.js';

const app = express();

// 中间件
app.use(helmet());
app.use(cors());
app.use(express.json());

// 请求日志
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// API路由
app.use('/api', createRouter());

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

// 错误处理
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

// 启动服务器
const server = app.listen(config.port, () => {
  logger.info(`Gateway server running on port ${config.port}`);
  logger.info(`Environment: ${config.env}`);
});

// WebSocket服务器
const wsServer = new WebSocketServer(server);
logger.info('WebSocket server initialized');

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export { app, server, wsServer };
