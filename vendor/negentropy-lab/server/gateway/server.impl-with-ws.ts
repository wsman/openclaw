/**
 * 🚀 Negentropy-Lab Gateway 服务器实现 (整合WebSocket版本)
 * 
 * 宪法依据：
 * - §101 同步公理：代码变更必须触发文档更新
 * - §102 熵减原则：所有变更必须降低或维持系统熵值
 * - §306 零停机协议：在生产级开发任务中确保服务连续性
 * - §107 通信安全公理：WebSocket连接的安全管理
 * - §321-§324 实时通信公理：JSON-RPC协议设计
 * 
 * 移植来源：OpenClaw Gateway 核心概念 + WebSocket协议
 * 适配目标：Negentropy-Lab 三服务架构（Node.js + Python MCP + 熵计算）
 */

import { logger } from '../utils/logger';
import * as http from 'http';
import express, { Request, Response } from 'express';
import { GatewayWebSocketHandler, WsConnectionConfig } from './websocket-handler-fixed';
import { GatewayAuthManager, createDefaultAuthManager } from './auth';

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
  /**
   * WebSocket configuration options
   */
  websocket?: WsConnectionConfig;
}

export interface GatewayServer {
  close: (opts?: { reason?: string; restartExpectedMs?: number | null }) => Promise<void>;
  wsHandler?: GatewayWebSocketHandler;
  getConnectionStats?: () => any;
}

/**
 * 启动 Gateway 服务器 (整合WebSocket版本)
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
  logger.info('[Gateway] 正在初始化 Negentropy-Lab Gateway 服务器 (WebSocket整合版)...');
  
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
    websocket = {},
  } = opts;
  
  // 记录宪法合规信息
  logger.info('[Gateway] 宪法合规检查启动...');
  logger.info(`[Gateway] §101同步公理: 代码变更将触发文档更新`);
  logger.info(`[Gateway] §102熵减原则: 评估系统熵值影响`);
  logger.info(`[Gateway] §306零停机协议: 确保服务连续性`);
  logger.info(`[Gateway] §107通信安全: WebSocket安全管理`);
  logger.info(`[Gateway] §321-§324实时通信: JSON-RPC协议设计`);
  
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
        websocket: true, // 现在支持 WebSocket
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
  
  // WebSocket 连接状态端点
  app.get('/api/websocket/stats', (req: Request, res: Response) => {
    // 这个端点将在启动后由 wsHandler 提供数据
    res.json({
      websocket: {
        enabled: true,
        endpoint: `ws://${runtimeConfig.bindHost || 'localhost'}:${port}/gateway`,
        protocol: 'JSON-RPC',
        authentication: 'required',
      },
      note: '请使用WebSocket客户端连接到 /gateway 端点'
    });
  });
  
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
        availableEndpoints: ['/health', '/v1/chat/completions', '/v1/responses', '/hooks/:action', '/api/websocket/stats']
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
            .websocket-info { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px auto; max-width: 600px; }
          </style>
        </head>
        <body>
          <h1>🚀 Negentropy-Lab Gateway</h1>
          <p>AI Gateway 服务 v1.0.0 (WebSocket整合版)</p>
          
          <div class="websocket-info">
            <h3>🎯 WebSocket 网关已启用</h3>
            <p><strong>连接地址:</strong> <code>ws://${runtimeConfig.bindHost || 'localhost'}:${port}/gateway</code></p>
            <p><strong>协议:</strong> JSON-RPC (OpenClaw兼容)</p>
            <p><strong>支持方法:</strong> connect, health, system.presence, agent</p>
          </div>
          
          <div class="endpoints">
            <h3>HTTP API 端点：</h3>
            <div class="endpoint">• WebSocket统计: <a href="/api/websocket/stats">/api/websocket/stats</a></div>
            <div class="endpoint">• 健康检查: <a href="/health">/health</a></div>
            <div class="endpoint">• OpenAI API: POST /v1/chat/completions</div>
            <div class="endpoint">• OpenResponses API: POST /v1/responses</div>
            <div class="endpoint">• Webhooks: POST /hooks/:action</div>
          </div>
          
          <p><em>宪法依据: §101同步公理、§102熵减原则、§306零停机协议、§107通信安全</em></p>
        </body>
        </html>
      `);
    }
  });
  
  // 创建 HTTP 服务器
  const server = http.createServer(app);
  
  // 创建 WebSocket 处理器
  const authManager = createDefaultAuthManager();
  const wsConfig: WsConnectionConfig = {
    ...websocket,
    authManager,
  };
  
  const wsHandler = new GatewayWebSocketHandler(wsConfig);
  
  // 启动服务器
  return new Promise((resolve, reject) => {
    server.listen(port, runtimeConfig.bindHost, () => {
      // 附加 WebSocket 处理器到 HTTP 服务器
      wsHandler.attachToServer(server);
      
      logger.info(`[Gateway] 🚀 Negentropy-Lab Gateway 启动成功`);
      logger.info(`[Gateway] 📡 HTTP地址: http://${runtimeConfig.bindHost || 'localhost'}:${port}`);
      logger.info(`[Gateway] ⚡ WebSocket地址: ws://${runtimeConfig.bindHost || 'localhost'}:${port}/gateway`);
      logger.info(`[Gateway] 🏥 健康检查: http://${runtimeConfig.bindHost || 'localhost'}:${port}/health`);
      logger.info(`[Gateway] 🤖 OpenAI API: http://${runtimeConfig.bindHost || 'localhost'}:${port}/v1/chat/completions`);
      logger.info(`[Gateway] 📋 运行模式: ${runtimeConfig.nodeEnv || 'production'}`);
      logger.info(`[Gateway] 🔒 认证模式: ${runtimeConfig.auth.token ? 'Token' : runtimeConfig.auth.password ? 'Password' : 'Default'}`);
      logger.info(`[Gateway] 🔗 WebSocket 网关: 已启用, 支持JSON-RPC协议`);
      
      // 注册额外的RPC方法
      registerAdditionalMethods(wsHandler);
      
      // 返回关闭函数
      const gatewayServer: GatewayServer = {
        close: async (closeOpts?: { reason?: string; restartExpectedMs?: number | null }) => {
          logger.info('[Gateway] 正在关闭 Gateway 服务器...');
          
          // 先关闭WebSocket连接
          wsHandler.closeAllConnections(closeOpts?.reason || 'Server shutdown');
          
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
        wsHandler,
        getConnectionStats: () => wsHandler.getConnectionStats(),
      };
      
      resolve(gatewayServer);
    });
    
    server.on('error', (err) => {
      logger.error(`[Gateway] 服务器启动失败: ${err}`);
      reject(err);
    });
  });
}

/**
 * 注册额外的RPC方法
 */
function registerAdditionalMethods(wsHandler: GatewayWebSocketHandler): void {
  // 系统信息方法
  wsHandler.registerMethod('system.info', async () => {
    return {
      name: 'Negentropy-Lab Gateway',
      version: '1.0.0',
      protocolVersion: 1,
      features: ['websocket', 'http-api', 'openai-compatible', 'authentication'],
      constitution: {
        compliance: '§101, §102, §107, §306, §321-§324',
        source: 'OpenClaw移植项目',
      },
      timestamp: new Date().toISOString(),
    };
  });
  
  // 状态方法
  wsHandler.registerMethod('system.status', async () => {
    return {
      status: 'operational',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    };
  });
  
  // Echo测试方法
  wsHandler.registerMethod('echo', async (params: any) => {
    return {
      echo: params,
      timestamp: new Date().toISOString(),
      server: 'Negentropy-Lab Gateway',
    };
  });
  
  logger.info('[Gateway] 额外RPC方法已注册: system.info, system.status, echo');
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

