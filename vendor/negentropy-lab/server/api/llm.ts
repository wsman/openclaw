import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { authenticateJWT } from '../middleware/auth';
import { Container } from 'inversify';
import { TYPES } from '../config/inversify.types';
import { LLMService, LLMRequest, StreamCallback } from '../services/LLMService';

/**
 * LLM API 路由 (LLM Agent服务接口)
 * 宪法依据: §192 (模型选择器公理), §110 (协作效率公理), §193 (模型选择器公理更新)
 * 技术法依据: §470-§479 (外部服务集成与模型管理标准)
 * 开发标准: DS-042 (ModernModelSelector标准实现), DS-043 (性能监控与告警标准实现)
 * 
 * 核心功能:
 * 1. Agent LLM请求处理 (同步/流式)
 * 2. 多Agent协作流程协调
 * 3. LLM服务状态监控
 * 4. Agent配置管理
 * 
 * @version 1.0.0
 * @category API Routes
 * 
 * 注意: Request.container 类型已在 server/types/express.d.ts 中统一声明
 */

/**
 * 创建LLM API路由
 */
export function createLLMRouter(): Router {
    const router = Router();

    // ==========================================
    // 🧠 Agent LLM请求处理
    // ==========================================

    /**
     * POST /llm/agent/request
     * 执行Agent LLM请求 (同步)
     */
    router.post('/agent/request', authenticateJWT, async (req: Request, res: Response) => {
        try {
            const llmRequest: LLMRequest = req.body;

            // 验证必要字段
            if (!llmRequest.agentId || !llmRequest.agentName || !llmRequest.query) {
                return res.status(400).json({
                    success: false,
                    error: '缺少必要字段: agentId, agentName, query'
                });
            }

            // 从容器中获取LLMService实例
            const container = req.container;
            if (!container) {
                throw new Error('依赖注入容器未初始化');
            }

            const llmService = container.get<LLMService>(TYPES.LLMService);

            // 执行Agent请求
            const startTime = Date.now();
            const response = await llmService.executeAgentRequest(llmRequest);
            const processingTime = Date.now() - startTime;

            logger.info(`[LLM API] Agent请求完成: ${llmRequest.agentName}, 处理时间: ${processingTime}ms`);

            res.json({
                success: response.success,
                data: response,
                processing_time: processingTime,
                timestamp: Date.now()
            });

        } catch (error: any) {
            logger.error(`[LLM API] Agent请求失败: ${error.message}`);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
        }
    });

    /**
     * POST /llm/agent/stream
     * 执行Agent LLM流式请求 (SSE)
     */
    router.post('/agent/stream', authenticateJWT, async (req: Request, res: Response) => {
        try {
            const llmRequest: LLMRequest = req.body;

            // 验证必要字段
            if (!llmRequest.agentId || !llmRequest.agentName || !llmRequest.query) {
                return res.status(400).json({
                    success: false,
                    error: '缺少必要字段: agentId, agentName, query'
                });
            }

            // 设置SSE响应头
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('Access-Control-Allow-Origin', '*');

            // 从容器中获取LLMService实例
            const container = req.container;
            if (!container) {
                throw new Error('依赖注入容器未初始化');
            }

            const llmService = container.get<LLMService>(TYPES.LLMService);

            // 创建流式回调
            const streamCallbacks: StreamCallback = {
                onToken: (token: string) => {
                    res.write(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`);
                },
                onToolStart: (tool: string) => {
                    res.write(`data: ${JSON.stringify({ type: 'tool_start', tool })}\n\n`);
                },
                onToolEnd: (tool: string, result: any) => {
                    res.write(`data: ${JSON.stringify({ type: 'tool_end', tool, result })}\n\n`);
                },
                onComplete: (response) => {
                    res.write(`data: ${JSON.stringify({ type: 'complete', response })}\n\n`);
                    res.write('data: [DONE]\n\n');
                    res.end();
                },
                onError: (error: Error) => {
                    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
                    res.write('data: [DONE]\n\n');
                    res.end();
                }
            };

            // 执行流式请求
            const requestId = await llmService.executeAgentStreamRequest(llmRequest, streamCallbacks);

            // 如果立即出错，会通过onError回调处理
            // 否则请求将在流式回调中结束

            // 确保响应在超时时正确关闭
            req.on('close', () => {
                logger.debug(`[LLM API] 流式请求连接关闭: ${requestId}`);
            });

        } catch (error: any) {
            logger.error(`[LLM API] 流式请求初始化失败: ${error.message}`);
            
            // 如果还没有发送响应头，返回JSON错误
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    error: error.message,
                    timestamp: Date.now()
                });
            } else {
                // 如果已经发送了SSE头，发送错误事件
                res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();
            }
        }
    });

    /**
     * POST /llm/collaboration
     * 执行多Agent协作请求
     */
    router.post('/collaboration', authenticateJWT, async (req: Request, res: Response) => {
        try {
            const { coordinatorRequest, specialistRequests } = req.body;

            // 验证必要字段
            if (!coordinatorRequest || !specialistRequests || !Array.isArray(specialistRequests)) {
                return res.status(400).json({
                    success: false,
                    error: '缺少必要字段: coordinatorRequest, specialistRequests (数组)'
                });
            }

            // 验证coordinatorRequest字段
            if (!coordinatorRequest.agentId || !coordinatorRequest.agentName || !coordinatorRequest.query) {
                return res.status(400).json({
                    success: false,
                    error: 'coordinatorRequest缺少必要字段: agentId, agentName, query'
                });
            }

            // 验证specialistRequests
            for (let i = 0; i < specialistRequests.length; i++) {
                const request = specialistRequests[i];
                if (!request.agentId || !request.agentName || !request.query) {
                    return res.status(400).json({
                        success: false,
                        error: `specialistRequests[${i}]缺少必要字段: agentId, agentName, query`
                    });
                }
            }

            // 从容器中获取LLMService实例
            const container = req.container;
            if (!container) {
                throw new Error('依赖注入容器未初始化');
            }

            const llmService = container.get<LLMService>(TYPES.LLMService);

            // 执行协作请求
            const startTime = Date.now();
            const collaborationResult = await llmService.executeCollaborationRequest(
                coordinatorRequest,
                specialistRequests
            );
            const processingTime = Date.now() - startTime;

            logger.info(`[LLM API] 协作请求完成: ${coordinatorRequest.agentName}, 参与Agent: ${specialistRequests.length}, 处理时间: ${processingTime}ms`);

            res.json({
                success: true,
                data: collaborationResult,
                processing_time: processingTime,
                timestamp: Date.now()
            });

        } catch (error: any) {
            logger.error(`[LLM API] 协作请求失败: ${error.message}`);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
        }
    });

    // ==========================================
    // 📊 LLM服务状态与监控
    // ==========================================

    /**
     * GET /llm/stats
     * 获取LLM服务统计信息
     */
    router.get('/stats', authenticateJWT, (req: Request, res: Response) => {
        try {
            // 从容器中获取LLMService实例
            const container = req.container;
            if (!container) {
                throw new Error('依赖注入容器未初始化');
            }

            const llmService = container.get<LLMService>(TYPES.LLMService);

            const stats = llmService.getServiceStats();

            res.json({
                success: true,
                data: stats,
                timestamp: Date.now()
            });

        } catch (error: any) {
            logger.error(`[LLM API] 获取统计信息失败: ${error.message}`);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
        }
    });

    /**
     * GET /llm/agents/config
     * 获取所有Agent配置
     */
    router.get('/agents/config', authenticateJWT, async (req: Request, res: Response) => {
        try {
            // 从容器中获取LLMService实例
            const container = req.container;
            if (!container) {
                throw new Error('依赖注入容器未初始化');
            }

            const llmService = container.get<LLMService>(TYPES.LLMService);

            // 获取所有Agent配置
            const agents = [
                'agent:legal_expert',
                'agent:programmer', 
                'agent:architect',
                'agent:office_director'
            ];

            const agentConfigs: any[] = [];

            for (const agentId of agents) {
                try {
                    const config = await llmService.getAgentConfig(agentId);
                    agentConfigs.push({
                        agentId,
                        config: {
                            provider: config.provider,
                            model: config.model,
                            temperature: config.temperature,
                            maxTokens: config.maxTokens,
                            capabilities: config.capabilities
                            // 不返回systemPrompt，可能包含敏感信息
                        }
                    });
                } catch (error) {
                    logger.warn(`[LLM API] 获取Agent配置失败: ${agentId}, ${error}`);
                }
            }

            res.json({
                success: true,
                data: {
                    agents: agentConfigs,
                    count: agentConfigs.length
                },
                timestamp: Date.now()
            });

        } catch (error: any) {
            logger.error(`[LLM API] 获取Agent配置失败: ${error.message}`);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
        }
    });

    /**
     * GET /llm/agents/:agentId/config
     * 获取特定Agent配置
     */
    router.get('/agents/:agentId/config', authenticateJWT, async (req: Request, res: Response) => {
        try {
            const { agentId } = req.params;

            // 从容器中获取LLMService实例
            const container = req.container;
            if (!container) {
                throw new Error('依赖注入容器未初始化');
            }

            const llmService = container.get<LLMService>(TYPES.LLMService);

            const config = await llmService.getAgentConfig(agentId);

            // 返回安全配置（不包含完整systemPrompt）
            const safeConfig = {
                agentId,
                provider: config.provider,
                model: config.model,
                temperature: config.temperature,
                maxTokens: config.maxTokens,
                capabilities: config.capabilities,
                systemPromptSummary: config.systemPrompt.substring(0, 100) + '...'
            };

            res.json({
                success: true,
                data: safeConfig,
                timestamp: Date.now()
            });

        } catch (error: any) {
            logger.error(`[LLM API] 获取Agent配置失败: ${error.message}`);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
        }
    });

    /**
     * POST /llm/validate/request
     * 验证Agent请求有效性
     */
    router.post('/validate/request', authenticateJWT, (req: Request, res: Response) => {
        try {
            const llmRequest: LLMRequest = req.body;

            // 从容器中获取LLMService实例
            const container = req.container;
            if (!container) {
                throw new Error('依赖注入容器未初始化');
            }

            const llmService = container.get<LLMService>(TYPES.LLMService);

            const validationResult = llmService.validateAgentRequest(llmRequest);

            res.json({
                success: validationResult.valid,
                data: validationResult,
                timestamp: Date.now()
            });

        } catch (error: any) {
            logger.error(`[LLM API] 验证请求失败: ${error.message}`);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
        }
    });

    /**
     * GET /llm/health
     * LLM服务健康检查
     */
    router.get('/health', (req: Request, res: Response) => {
        try {
            // 简单健康检查，不验证容器状态
            res.json({
                success: true,
                service: 'llm',
                status: 'healthy',
                version: '1.0.0',
                timestamp: Date.now(),
                capabilities: [
                    'agent_request',
                    'agent_stream',
                    'collaboration',
                    'stats',
                    'config',
                    'validation'
                ]
            });

        } catch (error: any) {
            logger.error(`[LLM API] 健康检查失败: ${error.message}`);
            res.status(500).json({
                success: false,
                service: 'llm',
                status: 'unhealthy',
                error: error.message,
                timestamp: Date.now()
            });
        }
    });

    /**
     * GET /llm/example/requests
     * 获取示例请求模板
     */
    router.get('/example/requests', authenticateJWT, (req: Request, res: Response) => {
        const examples = {
            legal_expert: {
                agentId: 'agent:legal_expert',
                agentName: '法务专家',
                agentType: 'legal_expert',
                query: '请解释宪法§102.3宪法同步公理的具体要求',
                context: '我们需要确保系统版本升级符合宪法同步要求',
                config: {
                    temperature: 0.3,
                    maxTokens: 1000
                }
            },
            programmer: {
                agentId: 'agent:programmer',
                agentName: '程序猿',
                agentType: 'programmer',
                query: '如何在TypeScript中实现依赖注入容器？',
                context: '我们正在重构项目架构，需要引入依赖注入',
                config: {
                    temperature: 0.5,
                    maxTokens: 2000
                }
            },
            collaboration: {
                coordinatorRequest: {
                    agentId: 'agent:office_director',
                    agentName: '办公厅主任',
                    agentType: 'office_director',
                    query: '我们需要设计一个新的CDD流程模块'
                },
                specialistRequests: [
                    {
                        agentId: 'agent:legal_expert',
                        agentName: '法务专家',
                        agentType: 'legal_expert',
                        query: '从法律合规角度评估CDD流程设计'
                    },
                    {
                        agentId: 'agent:architect',
                        agentName: '架构师',
                        agentType: 'architect',
                        query: '从架构设计角度分析CDD流程模块'
                    },
                    {
                        agentId: 'agent:programmer',
                        agentName: '程序猿',
                        agentType: 'programmer',
                        query: '从技术实现角度考虑CDD流程模块'
                    }
                ]
            }
        };

        res.json({
            success: true,
            data: examples,
            timestamp: Date.now()
        });
    });

    return router;
}
