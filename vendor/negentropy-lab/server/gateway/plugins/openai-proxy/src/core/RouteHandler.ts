/**
 * 🚀 Route Handler - 路由处理器
 * 宪法依据: §101同步公理、§102熵减原则、§110协作效率公理
 * 
 * 本模块负责处理OpenAI API兼容路由，包括：
 * - 请求验证和解析
 * - 身份验证集成
 * - 模型映射
 * - 请求转发
 * - 响应处理
 * 
 * 版本: 1.0.0
 * 创建时间: 2026-02-12
 */

import { Request, Response } from 'express';
import { logger } from '../../../../../utils/logger';
import { ModelRouter } from './ModelRouter';
import { StreamHandler } from './StreamHandler';

/**
 * OpenAI 聊天补全请求体
 */
export interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

/**
 * 路由处理器
 */
export class RouteHandler {
  private config: any;
  private services: any;
  private modelRouter: ModelRouter;
  private streamHandler: StreamHandler;

  constructor(config: any, services: any) {
    this.config = config;
    this.services = services;
    this.modelRouter = new ModelRouter(config.models);
    this.streamHandler = new StreamHandler();
    logger.info('[RouteHandler] 路由处理器已初始化');
  }

  /**
   * 处理聊天补全请求
   * POST /v1/chat/completions
   */
  public async handleChatCompletions(req: Request, res: Response): Promise<void> {
    const requestId = this.generateRequestId();
    
    try {
      logger.info(`[RouteHandler] 收到聊天补全请求: ${requestId}`);

      // 1. 解析请求体
      const requestBody = this.parseRequest(req);
      
      // 2. 身份验证（如果启用）
      if (this.config.enableAuth) {
        await this.authenticate(req);
      }

      // 3. 模型映射
      const mappedModel = this.modelRouter.mapModel(requestBody.model);
      logger.info(`[RouteHandler] 模型映射: ${requestBody.model} -> ${mappedModel}`);

      // 4. 判断是否流式响应
      const isStreaming = requestBody.stream || false;

      if (isStreaming) {
        // 流式响应
        await this.handleStreamingResponse(req, res, requestBody, mappedModel, requestId);
      } else {
        // 非流式响应
        await this.handleNonStreamingResponse(req, res, requestBody, mappedModel, requestId);
      }

      // 5. 计费跟踪（如果启用）
      if (this.config.enableBilling) {
        await this.trackBilling(requestBody, mappedModel, requestId);
      }

      logger.info(`[RouteHandler] 请求处理完成: ${requestId}`);
    } catch (error: any) {
      logger.error(`[RouteHandler] 请求处理失败: ${requestId}`, error);
      this.handleError(res, error);
    }
  }

  /**
   * 解析请求体
   */
  private parseRequest(req: Request): ChatCompletionRequest {
    const body = req.body;

    // 验证必需字段
    if (!body.model) {
      throw new Error('缺少必需字段: model');
    }
    if (!body.messages || !Array.isArray(body.messages)) {
      throw new Error('缺少必需字段: messages');
    }

    return body as ChatCompletionRequest;
  }

  /**
   * 身份验证
   * 宪法依据: §381安全公理 - 身份验证确保系统安全
   */
  private async authenticate(req: Request): Promise<void> {
    // 检查Authorization头
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      throw new Error('缺少Authorization头');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new Error('无效的Authorization格式');
    }

    const token = authHeader.substring(7);

    // 调用Auth服务验证token
    if (this.services.auth && this.services.auth.verifyToken) {
      const isValid = await this.services.auth.verifyToken(token);
      if (!isValid) {
        throw new Error('无效的token');
      }
    } else {
      logger.warn('[RouteHandler] Auth服务未配置，跳过身份验证');
    }
  }

  /**
   * 处理流式响应
   */
  private async handleStreamingResponse(
    req: Request,
    res: Response,
    requestBody: ChatCompletionRequest,
    mappedModel: string,
    requestId: string
  ): Promise<void> {
    logger.info(`[RouteHandler] 处理流式响应: ${requestId}`);

    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // 发送流式响应
    await this.streamHandler.handleStream(res, requestBody, mappedModel, requestId);
  }

  /**
   * 处理非流式响应
   */
  private async handleNonStreamingResponse(
    req: Request,
    res: Response,
    requestBody: ChatCompletionRequest,
    mappedModel: string,
    requestId: string
  ): Promise<void> {
    logger.info(`[RouteHandler] 处理非流式响应: ${requestId}`);

    // TODO: 调用LLM服务获取响应
    const mockResponse = {
      id: requestId,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: requestBody.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: '这是一个模拟响应。实际实现需要集成LLM服务。',
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

    res.json(mockResponse);
  }

  /**
   * 计费跟踪
   * 宪法依据: §110协作效率公理 - 计费跟踪确保资源合理使用
   */
  private async trackBilling(
    requestBody: ChatCompletionRequest,
    mappedModel: string,
    requestId: string
  ): Promise<void> {
    logger.info(`[RouteHandler] 计费跟踪: ${requestId}`);

    // 调用CostTracker服务
    if (this.services.costTracker && this.services.costTracker.track) {
      // TODO: 计算token消耗
      const usage = {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      };

      await this.services.costTracker.track({
        requestId,
        model: mappedModel,
        usage,
        timestamp: new Date(),
      });
    } else {
      logger.warn('[RouteHandler] CostTracker服务未配置，跳过计费跟踪');
    }
  }

  /**
   * 错误处理
   */
  private handleError(res: Response, error: Error): void {
    const statusCode = this.getErrorCode(error);
    const errorResponse = {
      error: {
        message: error.message,
        type: this.getErrorType(error),
        param: null,
        code: null,
      },
    };

    res.status(statusCode).json(errorResponse);
  }

  /**
   * 获取错误代码
   */
  private getErrorCode(error: Error): number {
    const message = error.message.toLowerCase();
    
    if (message.includes('authorization') || message.includes('token')) {
      return 401;
    }
    if (message.includes('permission') || message.includes('forbidden')) {
      return 403;
    }
    if (message.includes('not found')) {
      return 404;
    }
    if (message.includes('rate limit')) {
      return 429;
    }
    
    return 500;
  }

  /**
   * 获取错误类型
   */
  private getErrorType(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('authorization') || message.includes('token')) {
      return 'authentication_error';
    }
    if (message.includes('permission') || message.includes('forbidden')) {
      return 'permission_error';
    }
    if (message.includes('not found')) {
      return 'not_found_error';
    }
    if (message.includes('rate limit')) {
      return 'rate_limit_error';
    }
    if (message.includes('validation') || message.includes('missing')) {
      return 'invalid_request_error';
    }
    
    return 'internal_error';
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}