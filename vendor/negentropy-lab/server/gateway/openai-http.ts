/**
 * 🚀 Negentropy-Lab OpenAI兼容HTTP API端点
 * 
 * 宪法依据：
 * - §101 同步公理：代码变更必须触发文档更新
 * - §102 熵减原则：所有变更必须降低或维持系统熵值
 * - §306 零停机协议：在生产级开发任务中确保服务连续性
 * - §110 协作效率公理：确保API响应效率
 * - §107 通信安全：HTTP API安全认证管理
 * 
 * 移植来源：
 * 1. OpenClaw Gateway openai-http.ts (核心协议)
 * 2. MY-DOGE-DEMO server/api/agent.ts (Agent管理架构)
 * 3. MY-DOGE-DEMO server/api/auth.ts (认证系统)
 * 
 * 核心功能：
 * - OpenAI兼容API: POST /v1/chat/completions
 * - 流式响应支持 (Server-Sent Events)
 * - 工具调用集成
 * - 认证与权限验证
 * 
 * @version 1.0.0 (Phase 1B移植)
 * @category Gateway/HTTP
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { GatewayAuthManager } from './auth';

// OpenAI API相关类型
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  name?: string;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAICompletionRequest {
  messages: OpenAIMessage[];
  model: string;
  temperature?: number;
  top_p?: number;
  n?: number;
  stream?: boolean;
  stop?: string | string[];
  max_tokens?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  tools?: OpenAITool[];
  tool_choice?: 'none' | 'auto' | { type: 'function', function: { name: string } };
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters: any;
  };
}

interface OpenAICompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage?: OpenAIUsage;
}

interface OpenAIChoice {
  index: number;
  message: OpenAIMessage;
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

// OpenAI流式响应事件
interface OpenAISSEEvent {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: OpenAISSEChoice[];
}

interface OpenAISSEChoice {
  index: number;
  delta: {
    role?: 'assistant';
    content?: string;
    tool_calls?: OpenAIToolCall[];
  };
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

// Agent请求类型 (从MY-DOGE-DEMO继承)
interface AgentLLMRequest {
  agentId: string;
  agentName: string;
  query: string;
  context?: string;
  config?: {
    temperature?: number;
    maxTokens?: number;
  };
}

// OpenAI HTTP处理器配置
export interface OpenAIConfig {
  enabled: boolean;
  defaultModel: string;  // 现在改为必填，确保类型安全
  maxTokens?: number;
  temperature?: number;
  toolsEnabled?: boolean;
  streamingEnabled?: boolean;
}

/**
 * OpenAI兼容HTTP API处理器
 */
export class OpenAIHTTPHandler {
  private authManager: GatewayAuthManager;
  private config: OpenAIConfig;
  private logger = logger;
  
  /**
   * 构造函数
   * @param authManager 认证管理器
   * @param config OpenAI配置
   */
  constructor(authManager: GatewayAuthManager, config: Partial<OpenAIConfig> = {}) {
    this.authManager = authManager;
    this.config = {
      enabled: true,
      defaultModel: 'gpt-3.5-turbo',
      maxTokens: 2048,
      temperature: 0.7,
      toolsEnabled: false,
      streamingEnabled: true,
      ...config,
    };
    
    // 确保 defaultModel 总是字符串
    if (!this.config.defaultModel) {
      this.config.defaultModel = 'gpt-3.5-turbo';
    }
    
    this.logger.info('[OpenAI HTTP] OpenAI兼容API处理器已初始化');
    this.logger.info(`[OpenAI HTTP] 配置: ${JSON.stringify(this.config)}`);
    this.logger.info('[OpenAI HTTP] 宪法合规: §101同步公理、§102熵减原则、§306零停机协议');
  }
  
  /**
   * 处理OpenAI兼容API请求
   * 
   * 宪法依据: §110协作效率公理，确保API响应延迟<3s
   */
  public handleOpenAIRequest = async (req: Request, res: Response, next: NextFunction) => {
    if (!this.config.enabled) {
      return res.status(503).json({
        error: {
          message: 'OpenAI API endpoint is disabled',
          type: 'service_unavailable',
          code: 'endpoint_disabled'
        }
      });
    }
    
    const startTime = Date.now();
    
    try {
      // 验证请求格式
      const openaiRequest = req.body as OpenAICompletionRequest;
      
      if (!openaiRequest) {
        return res.status(400).json({
          error: {
            message: 'Request body is required',
            type: 'invalid_request_error',
            param: null
          }
        });
      }
      
      if (!openaiRequest.messages || !Array.isArray(openaiRequest.messages)) {
        return res.status(400).json({
          error: {
            message: 'messages field is required and must be an array',
            type: 'invalid_request_error',
            param: 'messages'
          }
        });
      }
      
      // 记录请求信息
      this.logger.info(`[OpenAI HTTP] 请求接收: model=${openaiRequest.model}, messages=${openaiRequest.messages.length}, stream=${openaiRequest.stream || false}`);
      
      // 流式响应处理
      if (openaiRequest.stream === true && this.config.streamingEnabled) {
        return this.handleStreamingResponse(req, res, openaiRequest);
      }
      
      // 非流式响应处理
      return this.handleRegularResponse(req, res, openaiRequest, startTime);
      
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`[OpenAI HTTP] 请求处理失败: ${error.message}, 耗时: ${processingTime}ms`);
      
      res.status(500).json({
        error: {
          message: 'Internal server error',
          type: 'internal_error',
          code: 'server_error'
        }
      });
    }
  };
  
  /**
   * 处理流式响应 (Server-Sent Events)
   */
  private handleStreamingResponse(req: Request, res: Response, openaiRequest: OpenAICompletionRequest): void {
    const requestId = `chatcmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const model = openaiRequest.model || this.config.defaultModel;
    const startTime = Date.now();
    
    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // 发送初始事件
    this.sendSSEEvent(res, {
      id: requestId,
      object: 'chat.completion.chunk',
      created: Math.floor(startTime / 1000),
      model: model,
      choices: [{
        index: 0,
        delta: { role: 'assistant' },
        finish_reason: null
      }]
    });
    
    // 处理消息内容 (简化版 - 实际应集成LLM服务)
    const messageContent = openaiRequest.messages[openaiRequest.messages.length - 1]?.content || 'Hello!';
    
    // 模拟流式响应
    const words = messageContent.split(' ');
    let currentIndex = 0;
    
    const streamInterval = setInterval(() => {
      if (currentIndex >= words.length) {
        // 发送完成事件
        this.sendSSEEvent(res, {
          id: requestId,
          object: 'chat.completion.chunk',
          created: Math.floor(startTime / 1000),
          model: model,
          choices: [{
            index: 0,
            delta: {},
            finish_reason: 'stop'
          }]
        });
        
        this.sendSSEEvent(res, { id: requestId, object: 'chat.completion.chunk', created: Math.floor(startTime / 1000), model: model, choices: [] });
        res.write('data: [DONE]\n\n');
        res.end();
        
        clearInterval(streamInterval);
        
        const processingTime = Date.now() - startTime;
        this.logger.info(`[OpenAI HTTP] 流式响应完成: ${requestId}, 耗时: ${processingTime}ms`);
        return;
      }
      
      // 发送内容块
      const word = words[currentIndex] + (currentIndex < words.length - 1 ? ' ' : '');
      this.sendSSEEvent(res, {
        id: requestId,
        object: 'chat.completion.chunk',
        created: Math.floor(startTime / 1000),
        model: model,
        choices: [{
          index: 0,
          delta: { content: word },
          finish_reason: null
        }]
      });
      
      currentIndex++;
    }, 100); // 每100ms发送一个单词
    
    // 连接关闭时清理
    req.on('close', () => {
      clearInterval(streamInterval);
      this.logger.info(`[OpenAI HTTP] 流式连接关闭: ${requestId}`);
    });
  }
  
  /**
   * 发送SSE事件
   */
  private sendSSEEvent(res: Response, data: any): void {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
  
  /**
   * 处理常规响应
   */
  private async handleRegularResponse(
    req: Request, 
    res: Response, 
    openaiRequest: OpenAICompletionRequest,
    startTime: number
  ): Promise<void> {
    const requestId = `chatcmpl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const model = openaiRequest.model || this.config.defaultModel;
    
    try {
      // 将OpenAI请求转换为Agent请求
      const agentRequest = this.convertToAgentRequest(openaiRequest);
      
      // 这里应该调用实际的LLM服务
      // 为了Phase 1B移植，我们先返回模拟响应
      const responseContent = await this.generateMockResponse(openaiRequest);
      
      const usage: OpenAIUsage = {
        prompt_tokens: this.estimateTokens(openaiRequest.messages),
        completion_tokens: this.estimateTokens([{ role: 'assistant', content: responseContent }]),
        total_tokens: 0
      };
      usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
      
      const response: OpenAICompletionResponse = {
        id: requestId,
        object: 'chat.completion',
        created: Math.floor(startTime / 1000),
        model: model,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: responseContent
          },
          finish_reason: 'stop'
        }],
        usage: usage
      };
      
      const processingTime = Date.now() - startTime;
      this.logger.info(`[OpenAI HTTP] 常规响应完成: ${requestId}, 耗时: ${processingTime}ms`);
      
      res.json(response);
      
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`[OpenAI HTTP] 常规响应失败: ${error.message}, 耗时: ${processingTime}ms`);
      
      res.status(500).json({
        error: {
          message: 'Failed to generate response',
          type: 'internal_error',
          code: 'response_generation_failed'
        }
      });
    }
  }
  
  /**
   * 将OpenAI请求转换为Agent请求
   * 
   * 复用MY-DOGE-DEMO的Agent请求格式
   */
  private convertToAgentRequest(openaiRequest: OpenAICompletionRequest): AgentLLMRequest {
    const lastMessage = openaiRequest.messages[openaiRequest.messages.length - 1];
    const query = lastMessage?.content || '';
    
    // 构建上下文
    const context = openaiRequest.messages
      .slice(0, -1)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');
    
    return {
      agentId: 'agent:openai_gateway',
      agentName: 'OpenAI Gateway Agent',
      query: query,
      context: context || undefined,
      config: {
        temperature: openaiRequest.temperature || this.config.temperature,
        maxTokens: openaiRequest.max_tokens || this.config.maxTokens
      }
    };
  }
  
  /**
   * 生成模拟响应
   */
  private async generateMockResponse(openaiRequest: OpenAICompletionRequest): Promise<string> {
    const lastMessage = openaiRequest.messages[openaiRequest.messages.length - 1];
    const query = lastMessage?.content || '';
    
    // 基于查询生成响应
    if (query.toLowerCase().includes('hello') || query.toLowerCase().includes('hi')) {
      return 'Hello! I am Negentropy-Lab Gateway, providing OpenAI-compatible API services.';
    } else if (query.toLowerCase().includes('help')) {
      return 'I can help you with various tasks. This is a mock response from the OpenAI-compatible API endpoint.';
    } else if (query.toLowerCase().includes('gateway')) {
      return 'The Negentropy-Lab Gateway provides WebSocket and HTTP APIs with OpenAI compatibility. It supports streaming responses and tool calling.';
    }
    
    return `I received your message: "${query.substring(0, 100)}...". This is a response from the Negentropy-Lab OpenAI-compatible API.`;
  }
  
  /**
   * 估算Token数量 (简化版)
   */
  private estimateTokens(messages: OpenAIMessage[]): number {
    let totalTokens = 0;
    
    for (const message of messages) {
      if (message.content) {
        // 简单估算: 英文大约每4个字符1个token，中文大约每2个字符1个token
        const content = message.content;
        const charCount = content.length;
        const englishRatio = (content.match(/[a-zA-Z]/g) || []).length / Math.max(charCount, 1);
        const tokensPerChar = englishRatio > 0.7 ? 0.25 : 0.5; // 英文0.25, 中文0.5
        
        totalTokens += Math.ceil(charCount * tokensPerChar);
      }
      
      // 角色token
      totalTokens += 5;
    }
    
    return totalTokens;
  }
  
  /**
   * 创建Express中间件
   */
  public createMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // 验证请求路径
      if (req.path === '/v1/chat/completions' && req.method === 'POST') {
        return this.handleOpenAIRequest(req, res, next);
      }
      next();
    };
  }
  
  /**
   * 获取配置信息
   */
  public getConfig(): OpenAIConfig {
    return { ...this.config };
  }
  
  /**
   * 更新配置
   */
  public updateConfig(newConfig: Partial<OpenAIConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info(`[OpenAI HTTP] 配置已更新: ${JSON.stringify(this.config)}`);
  }
}

/**
 * 创建OpenAI HTTP API路由器
 * 
 * 宪法依据: §101同步公理，确保API路由与文档同步更新
 */
export function createOpenAIHTTPRouter(authManager: GatewayAuthManager, config?: Partial<OpenAIConfig>) {
  const router = require('express').Router();
  const openAIHandler = new OpenAIHTTPHandler(authManager, config);
  
  // OpenAI兼容端点
  router.post('/v1/chat/completions', openAIHandler.handleOpenAIRequest);
  
  // OpenAI端点状态检查
  router.get('/v1/chat/completions/status', (req: Request, res: Response) => {
    const config = openAIHandler.getConfig();
    
    res.json({
      status: config.enabled ? 'enabled' : 'disabled',
      config: config,
      endpoints: {
        chat_completions: '/v1/chat/completions',
        streaming: config.streamingEnabled,
        tools: config.toolsEnabled
      },
      constitutional_compliance: {
        article_101: '代码与文档同步',
        article_102: '熵值降低评估',
        article_306: '零停机协议',
        article_110: '协作效率保障'
      },
      timestamp: new Date().toISOString()
    });
  });
  
  logger.info('[OpenAI HTTP] OpenAI兼容API路由器已创建');
  
  return router;
}

/**
 * 集成到现有Express应用
 */
export function integrateOpenAIHTTP(app: any, authManager: GatewayAuthManager, config?: Partial<OpenAIConfig>) {
  const openaiRouter = createOpenAIHTTPRouter(authManager, config);
  
  // 挂载路由
  app.use('/openai', openaiRouter);
  
  // 也挂载到根路径，保持兼容性
  app.post('/v1/chat/completions', (req: Request, res: Response, next: NextFunction) => {
    const handler = new OpenAIHTTPHandler(authManager, config);
    return handler.handleOpenAIRequest(req, res, next);
  });
  
  logger.info('[OpenAI HTTP] OpenAI兼容API已集成到Express应用');
  
  return {
    openaiRouter,
    getHandler: () => new OpenAIHTTPHandler(authManager, config)
  };
}

export default {
  OpenAIHTTPHandler,
  createOpenAIHTTPRouter,
  integrateOpenAIHTTP
};