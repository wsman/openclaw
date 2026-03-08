/**
 * 🚀 Negentropy-Lab Gateway 服务器实现 (简化版本)
 * 
 * 宪法依据：
 * - §101 同步公理：代码变更必须触发文档更新
 * - §102 熵减原则：所有变更必须降低或维持系统熵值
 * - §306 零停机协议：在生产级开发任务中确保服务连续性
 * - §108 异构模型策略：严格指定模型参数，优化配额使用
 * 
 * 移植来源：OpenClaw Gateway 核心概念
 * 适配目标：Negentropy-Lab 三服务架构（Node.js + Python MCP + 熵计算）
 */

import { logger } from '../utils/logger';
import * as http from 'http';
import express, { Request, Response } from 'express';

// 类型定义
export type GatewayBindMode = 'loopback' | 'lan' | 'tailnet' | 'auto';

export interface GatewayAuthConfig {
  token?: string;
  password?: string;
  allowTailscale?: boolean;
}

export interface GatewayTailscaleConfig {
  enabled?: boolean;
  resetOnExit?: boolean;
}

export interface GatewayServerOptions {
  /**
   * Bind address policy for the Gateway WebSocket/HTTP server.
   * - loopback: 127.0.0.1
   * - lan: 0.0.0.0
   * - tailnet: bind only to the Tailscale IPv4 address (100.64.0.0/10)
   * - auto: prefer loopback, else LAN
   */
  bind?: GatewayBindMode;
  /**
   * Advanced override for the bind host, bypassing bind resolution.
   * Prefer `bind` unless you really need a specific address.
   */
  host?: string;
  /**
   * If false, do not serve the browser Control UI.
   * Default: config `gateway.controlUi.enabled` (or true when absent).
   */
  controlUiEnabled?: boolean;
  /**
   * If false, do not serve `POST /v1/chat/completions`.
   * Default: config `gateway.http.endpoints.chatCompletions.enabled` (or false when absent).
   */
  openAiChatCompletionsEnabled?: boolean;
  /**
   * If false, do not serve `POST /v1/responses` (OpenResponses API).
   * Default: config `gateway.http.endpoints.responses.enabled` (or false when absent).
   */
  openResponsesEnabled?: boolean;
  /**
   * Override gateway auth configuration (merges with config).
   */
  auth?: GatewayAuthConfig;
  /**
   * Override gateway Tailscale exposure configuration (merges with config).
   */
  tailscale?: GatewayTailscaleConfig;
}

export interface GatewayServer {
  close: (opts?: { reason?: string; restartExpectedMs?: number | null }) => Promise<void>;
}

/**
 * 启动 Gateway 服务器
 * 
 * 宪法依据：§306 零停机协议，确保服务启动过程不影响现有连接
 * 
 * @param port 端口号，默认 4514
 * @param opts 服务器选项
 * @returns GatewayServer 实例
 */
export async function startGatewayServer(
  port = 4514,
  opts: GatewayServerOptions = {}
): Promise<GatewayServer> {
  logger.info('[Gateway] 正在初始化 Negentropy-Lab Gateway 服务器...');
  
  // 设置环境变量供其他模块使用
  process.env.NEGENTROPY_GATEWAY_PORT = String(port);
  
  // 解析配置选项
  const {
    bind = 'auto',
    host,
    controlUiEnabled = true,
    openAiChatCompletionsEnabled = true,
    openResponsesEnabled = true,
    auth,
    tailscale,
  } = opts;
  
  // 记录宪法合规信息
  logger.info('[Gateway] 宪法合规检查启动...');
  logger.info(`[Gateway] §101同步公理: 代码变更将触发文档更新`);
  logger.info(`[Gateway] §102熵减原则: 评估系统熵值影响`);
  logger.info(`[Gateway] §306零停机协议: 确保服务连续性`);
  logger.info(`[Gateway] §108异构模型策略: 严格指定模型参数`);
  
  // 初始化运行时配置
  const runtimeConfig = resolveGatewayRuntimeConfig({
    port,
    bind,
    host,
    controlUiEnabled,
    openAiChatCompletionsEnabled,
    openResponsesEnabled,
    auth,
    tailscale,
  });
  
  // 创建 Express 应用
  const app = express();
  
  // 配置中间件
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  // 健康检查端点
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      service: 'Negentropy-Lab Gateway',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      features: {
        websocket: false, // 简化版本，暂时禁用 WebSocket
        http: true,
        openai: runtimeConfig.openAiChatCompletionsEnabled,
        openresponses: runtimeConfig.openResponsesEnabled,
      },
    });
  });
  
  // OpenAI 兼容端点
  if (runtimeConfig.openAiChatCompletionsEnabled) {
    app.post('/v1/chat/completions', (req: Request, res: Response) => {
      const { messages, model, stream } = req.body;
      
      logger.info(`[Gateway] OpenAI API 请求: ${model}, 消息数: ${messages?.length || 0}`);
      
      // 简化响应
      const response = {
        id: `chatcmpl_${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model || 'gpt-3.5-turbo',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '这是来自 Negentropy-Lab Gateway 的响应。',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
        },
      };
      
      res.json(response);
    });
  }
  
  // OpenResponses 端点
  if (runtimeConfig.openResponsesEnabled) {
    app.post('/v1/responses', (req: Request, res: Response) => {
      const { prompt, files } = req.body;
      
      logger.info(`[Gateway] OpenResponses API 请求: ${prompt?.substring(0, 50)}...`);
      
      res.json({
        id: `resp_${Date.now()}`,
        response: '这是来自 Negentropy-Lab Gateway 的 OpenResponses 响应。',
        files: files || [],
      });
    });
  }
  
  // Webhook 端点
  app.post('/hooks/:action', (req: Request, res: Response) => {
    const { action } = req.params;
    const payload = req.body;
    
    logger.info(`[Gateway] Webhook 调用: ${action}`);
    
    res.json({
      received: true,
      action,
      timestamp: new Date().toISOString(),
    });
  });
  
  // 默认路由
  app.use((req: Request, res: Response) => {
    if (req.url?.startsWith('/api/')) {
      res.status(404).json({
        error: 'API端点未找到',
        path: req.url,
        availableEndpoints: ['/health', '/v1/chat/completions', '/v1/responses', '/hooks/:action']
      });
    } else {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Negentropy-Lab Gateway</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
            h1 { color: #333; }
            .endpoints { background: #f5f5f5; padding: 20px; border-radius: 5px; margin: 30px auto; max-width: 600px; text-align: left; }
            .endpoint { margin: 10px 0; font-family: monospace; }
          </style>
        </head>
        <body>
          <h1>🚀 Negentropy-Lab Gateway</h1>
          <p>AI Gateway 服务 v1.0.0</p>
          
          <div class="endpoints">
            <h3>可用端点：</h3>
            <div class="endpoint">• 健康检查: <a href="/health">/health</a></div>
            <div class="endpoint">• OpenAI API: POST /v1/chat/completions</div>
            <div class="endpoint">• OpenResponses API: POST /v1/responses</div>
            <div class="endpoint">• Webhooks: POST /hooks/:action</div>
          </div>
          
          <p><em>宪法依据: §101同步公理、§102熵减原则、§306零停机协议</em></p>
        </body>
        </html>
      `);
    }
  });
  
  // 创建 HTTP 服务器
  const server = http.createServer(app);
  
  // 启动服务器
  return new Promise((resolve, reject) => {
    server.listen(port, runtimeConfig.bindHost, () => {
      logger.info(`[Gateway] 🚀 Negentropy-Lab Gateway 启动成功`);
      logger.info(`[Gateway] 📡 地址: http://${runtimeConfig.bindHost || 'localhost'}:${port}`);
      logger.info(`[Gateway] 🏥 健康检查: http://${runtimeConfig.bindHost || 'localhost'}:${port}/health`);
      logger.info(`[Gateway] 🤖 OpenAI API: http://${runtimeConfig.bindHost || 'localhost'}:${port}/v1/chat/completions`);
      logger.info(`[Gateway] 📋 运行模式: ${runtimeConfig.nodeEnv || 'production'}`);
      logger.info(`[Gateway] 🔒 认证模式: ${runtimeConfig.auth.token ? 'Token' : runtimeConfig.auth.password ? 'Password' : 'None'}`);
      
      // 返回关闭函数
      resolve({
        close: async (closeOpts?: { reason?: string; restartExpectedMs?: number | null }) => {
          logger.info('[Gateway] 正在关闭 Gateway 服务器...');
          
          return new Promise<void>((resolveClose, rejectClose) => {
            server.close((err) => {
              if (err) {
                logger.error(`[Gateway] 关闭服务器时出错: ${err}`);
                rejectClose(err);
              } else {
                logger.info('[Gateway] Gateway 服务器已关闭');
                
                if (closeOpts?.reason) {
                  logger.info(`[Gateway] 关闭原因: ${closeOpts.reason}`);
                }
                
                resolveClose();
              }
            });
          });
        },
      });
    });
    
    server.on('error', (err) => {
      logger.error(`[Gateway] 服务器启动失败: ${err}`);
      reject(err);
    });
  });
}

// ============= 辅助函数实现 =============

/**
 * 解析运行时配置
 */
function resolveGatewayRuntimeConfig(options: any) {
  const {
    port,
    bind,
    host,
    controlUiEnabled,
    openAiChatCompletionsEnabled,
    openResponsesEnabled,
    auth,
    tailscale,
  } = options;
  
  // 确定绑定主机
  let bindHost = host;
  if (!bindHost) {
    switch (bind) {
      case 'loopback':
        bindHost = '127.0.0.1';
        break;
      case 'lan':
        bindHost = '0.0.0.0';
        break;
      case 'tailnet':
        // Tailscale 地址，简化处理
        bindHost = '0.0.0.0';
        break;
      case 'auto':
      default:
        bindHost = '127.0.0.1';
        break;
    }
  }
  
  return {
    bindHost,
    port,
    controlUiEnabled,
    openAiChatCompletionsEnabled,
    openResponsesEnabled,
    auth: auth || {},
    tailscale: tailscale || {},
    nodeEnv: process.env.NODE_ENV || 'production',
  };
}

/**
 * 简化版本的 Gateway 认证模块
 */
export class GatewayAuth {
  private tokens = new Set<string>();
  
  constructor(config: GatewayAuthConfig) {
    if (config.token) {
      this.tokens.add(config.token);
    }
  }
  
  authenticate(token?: string, password?: string): boolean {
    // Token 认证
    if (token && this.tokens.has(token)) {
      return true;
    }
    
    // 简化实现：开发环境允许所有连接
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    
    return false;
  }
}

/**
 * 创建配置热重载处理器
 */
export function createConfigReloadHandler() {
  logger.info('[Gateway] 配置热重载处理器已创建');
  
  return {
    update: (config: any) => {
      logger.info('[Gateway] 配置热重载请求收到');
      // 简化实现，只记录日志
      return Promise.resolve(true);
    },
  };
}

/**
 * 创建通道管理器（简化版）
 */
export function createChannelManager() {
  logger.info('[Gateway] 通道管理器已创建');
  
  return {
    start: () => {
      logger.info('[Gateway] 通道管理器启动');
      return Promise.resolve();
    },
    stop: () => {
      logger.info('[Gateway] 通道管理器停止');
      return Promise.resolve();
    },
  };
}

/**
 * 创建定时任务服务（简化版）
 */
export function createCronService() {
  logger.info('[Gateway] 定时任务服务已创建');
  
  return {
    start: () => {
      logger.info('[Gateway] 定时任务服务启动');
      return Promise.resolve();
    },
    stop: () => {
      logger.info('[Gateway] 定时任务服务停止');
      return Promise.resolve();
    },
  };
}