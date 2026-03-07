/**
 * 配置管理
 * 
 * @module config
 */

import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // 服务器配置
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  env: process.env.NODE_ENV || 'development',
  
  // WebSocket配置
  websocket: {
    path: '/ws',
    heartbeatInterval: 30000,
    maxConnections: 1000,
  },
  
  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json' as const,
  },
  
  // 数据库配置
  database: {
    url: process.env.DATABASE_URL || 'sqlite://data/negentropy.db',
  },
  
  // 向量数据库配置
  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
    collection: process.env.QDRANT_COLLECTION || 'negentropy',
  },
  
  // 宪法配置
  constitution: {
    rulesPath: process.env.CONSTITUTION_RULES_PATH || './config/rules',
    validationEnabled: process.env.CONSTITUTION_VALIDATION === 'true',
  },
  
  // 审批配置
  approval: {
    timeout: parseInt(process.env.APPROVAL_TIMEOUT || '3600000', 10),
    autoApprove: process.env.AUTO_APPROVE === 'true',
  },
};

export default config;
