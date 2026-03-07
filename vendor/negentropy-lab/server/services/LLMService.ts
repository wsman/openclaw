/**
 * 🚀 LLMService - 多Agent LLM集成服务
 * 
 * @constitution
 * §101 同步公理：代码变更必须触发文档更新
 * §102 熵减原则：所有变更必须降低或维持系统熵值
 * §106 Agent身份公理：每个Agent必须拥有唯一身份标识和明确职责
 * §108 异构模型策略：严格指定模型参数，优化配额使用
 * §110 协作效率公理：Agent响应时间必须控制在合理范围内（目标<3秒）
 * §141 熵减验证公理：重构必须满足语义保持性和熵减验证
 * §152 单一真理源公理：代码实现与法典版本必须同步
 * §190 网络韧性公理：系统必须具备容错恢复能力
 * §192 模型选择器公理：必须根据任务复杂度动态选择最优LLM模型
 * §193 模型选择器更新公理：模型选择器必须持续学习并适应性能变化
 * §306 零停机协议：在生产级开发任务中确保服务连续性
 * §501 插件系统公理：所有扩展功能必须通过插件系统实现
 * §504 监控系统公理：系统必须实时监控宪法合规状态
 * 
 * 技术法依据: §470-§479 (外部服务集成与模型管理标准)
 * 开发标准: DS-042 (ModernModelSelector标准实现), DS-043 (性能监控与告警标准实现)
 * 
 * 核心功能:
 * 1. Agent LLM请求处理 (同步/流式)
 * 2. 多Agent协作流程协调
 * 3. 模型选择器集成与成本优化
 * 4. PythonWorkerBridge通信管理
 * 5. 性能监控与审计日志
 * 
 * @filename LLMService.ts
 * @version 1.0.0
 * @category Core Services
 * @last_updated 2026-02-25
 */

import { inject, injectable } from 'inversify';
import { IModelSelector, IModelRequirements, IModelSelection, IProviderConfig } from '../types/system/IModelSelector';
import { IMonitoringService } from '../types/monitoring';
import { PythonWorkerBridge } from '../infrastructure/bridge/PythonWorkerBridge';
import { logger } from '../utils/logger';
import { TYPES } from '../config/inversify.types';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * LLM请求接口
 */
export interface LLMRequest {
    agentId: string;                // Agent标识符 (e.g., "agent:legal_expert")
    agentName: string;              // Agent显示名称
    agentType: string;              // Agent类型 (legal_expert, architect, programmer, etc.)
    query: string;                  // 查询内容
    context?: string;               // 额外上下文信息
    config?: AgentLLMConfig;        // Agent特定配置
}

/**
 * Agent LLM配置
 */
export interface AgentLLMConfig {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
    stop?: string[];
}

/**
 * LLM响应接口
 */
export interface LLMResponse {
    success: boolean;
    requestId: string;
    agentId: string;
    agentName: string;
    content: string;
    providerId: string;
    model: string;
    estimatedCost: number;
    estimatedLatency: number;
    timestamp: number;
    error?: string;
}

/**
 * 协作请求结果
 */
export interface CollaborationResult {
    coordinatorResponse: LLMResponse;
    specialistResponses: Record<string, LLMResponse>;
    integratedResponse: string;
    totalCost: number;
    totalLatency: number;
    timestamp: number;
}

/**
 * 流式回调接口
 */
export interface StreamCallback {
    onToken?: (token: string) => void;
    onToolStart?: (tool: string) => void;
    onToolEnd?: (tool: string, result: any) => void;
    onComplete?: (response: LLMResponse) => void;
    onError?: (error: Error) => void;
}

/**
 * Agent配置定义
 */
export interface AgentConfig {
    provider: string;
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    capabilities: string[];
}

/**
 * 服务统计信息
 */
export interface ServiceStats {
    totalRequests: number;
    successRate: number;
    averageLatency: number;
    totalCost: number;
    activeAgents: number;
    providers: string[];
    timestamp: number;
}

/**
 * 请求验证结果
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

// ============================================================================
// LLMService主类
// ============================================================================

@injectable()
export class LLMService {
    private modelSelector: IModelSelector;
    private monitoringService: IMonitoringService;
    private pythonBridge: PythonWorkerBridge;
    
    private requestCount = 0;
    private successCount = 0;
    private totalLatency = 0;
    private totalCost = 0;
    
    // Agent配置映射
    private agentConfigs: Map<string, AgentConfig> = new Map();
    
    constructor(
        @inject(TYPES.ModelSelector) modelSelector: IModelSelector,
        @inject(TYPES.MonitoringService) monitoringService: IMonitoringService
    ) {
        this.modelSelector = modelSelector;
        this.monitoringService = monitoringService;
        this.pythonBridge = PythonWorkerBridge.getInstance();
        
        this.initializeAgentConfigs();
        logger.info('[LLMService] 初始化完成，Agent数量: ' + this.agentConfigs.size);
    }
    
    /**
     * 初始化Agent配置
     */
    private initializeAgentConfigs(): void {
        // 法务专家Agent
        this.agentConfigs.set('agent:legal_expert', {
            provider: 'deepseek',
            model: 'deepseek-chat',
            temperature: 0.3,
            maxTokens: 8192,
            systemPrompt: `# 逆熵实验室 - Agent系统

当前Agent: 法务专家 (legal_expert)

## 核心职责
1. 解释基本法条款和宪法约束
2. 确保知识库修改符合法律合规性
3. 提供公理推理和法律逻辑分析
4. 维护法典引用完整性

## 回答要求
1. 必须引用宪法依据 (e.g., §102.3宪法同步公理)
2. 关注法律合规性和架构约束
3. 提供明确的建议和风险提示
4. 保持专业、严谨的法律语言风格

## 知识范围
- 逆熵实验室法典体系
- 宪法约束和架构公理
- 法律合规性标准
- 知识库管理规范`,
            capabilities: ['reasoning', 'compliance']
        });
        
        // 程序猿Agent
        this.agentConfigs.set('agent:programmer', {
            provider: 'deepseek',
            model: 'deepseek-chat',
            temperature: 0.5,
            maxTokens: 16384,
            systemPrompt: `# 逆熵实验室 - Agent系统

当前Agent: 程序猿 (programmer)

## 核心职责
1. 提供TypeScript/JavaScript技术实现建议
2. 生成代码片段和架构设计
3. 解决Colyseus集成技术问题
4. 优化系统性能和代码质量

## 回答要求
1. 提供可执行的代码示例
2. 包含必要的TypeScript类型定义
3. 考虑性能和可维护性
4. 遵循逆熵实验室代码规范

## 技术栈
- TypeScript / JavaScript
- Colyseus + Node.js
- 文件系统操作
- 实时WebSocket通信
- 依赖注入 (Inversify)`,
            capabilities: ['coding', 'implementation']
        });
        
        // 架构师Agent
        this.agentConfigs.set('agent:architect', {
            provider: 'deepseek',
            model: 'deepseek-chat',
            temperature: 0.4,
            maxTokens: 12288,
            systemPrompt: `# 逆熵实验室 - Agent系统

当前Agent: 架构师 (architect)

## 核心职责
1. 维护知识图谱和系统架构
2. 优化系统性能和可扩展性
3. 设计微服务和模块边界
4. 确保架构一致性

## 回答要求
1. 提供架构图和组件关系
2. 考虑系统可扩展性和可维护性
3. 分析技术债务和优化机会
4. 遵循逆熵实验室架构原则

## 架构原则
- 微服务架构
- 事件驱动设计
- 实时数据处理
- 知识图谱集成
- 监控和可观察性`,
            capabilities: ['architecture', 'design']
        });
        
        // 办公厅主任Agent (协调者)
        this.agentConfigs.set('agent:office_director', {
            provider: 'deepseek',
            model: 'deepseek-chat',
            temperature: 0.4,
            maxTokens: 16384,
            systemPrompt: `# 逆熵实验室 - Agent系统

当前Agent: 办公厅主任 (office_director)

## 核心职责
1. 协调多个专业Agent协作
2. 整合专业意见形成综合方案
3. 管理协作流程和任务分配
4. 确保协作效率和结果质量

## 回答要求
1. 协调各专业Agent意见
2. 提供整合后的综合建议
3. 管理协作进度和冲突解决
4. 保持中立客观的协调角色

## 协作流程
1. 接收用户任务请求
2. 分发给相关专业Agent
3. 收集专业Agent意见
4. 整合形成最终方案
5. 反馈给用户`,
            capabilities: ['coordination', 'integration']
        });
        
        // 默认Agent配置
        this.agentConfigs.set('default', {
            provider: 'deepseek',
            model: 'deepseek-chat',
            temperature: 0.5,
            maxTokens: 8192,
            systemPrompt: `# 逆熵实验室 - Agent系统

当前Agent: 通用助手

## 核心职责
提供通用的技术支持和问题解答

## 回答要求
1. 提供准确有用的信息
2. 保持专业友好的态度
3. 根据问题类型调整回答风格
4. 必要时建议咨询专业Agent`,
            capabilities: ['general']
        });
    }
    
    /**
     * 执行Agent LLM请求
     */
    public async executeAgentRequest(request: LLMRequest): Promise<LLMResponse> {
        const startTime = Date.now();
        const requestId = `llm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        try {
            // 验证请求
            const validation = this.validateAgentRequest(request);
            if (!validation.valid) {
                throw new Error(`请求验证失败: ${validation.errors.join(', ')}`);
            }
            
            // 获取Agent配置
            const agentConfig = await this.getAgentConfig(request.agentId);
            
            // 构建模型需求
            const requirements = this.buildModelRequirements(request, agentConfig);
            
            // 选择模型
            const selection = await this.modelSelector.selectModel(requirements);
            if (!selection.success) {
                throw new Error(`模型选择失败: ${selection.error || '未知错误'}`);
            }
            
            // 构建Python请求上下文
            const context = this.buildRequestContext(request, agentConfig);
            
            // 执行Python调用
            const pythonResponse = await this.pythonBridge.exec(
                'neural_agent.process_agent_query',
                [request.query, context, JSON.stringify(agentConfig)]
            );
            
            const content = this.extractContent(pythonResponse);
            const latency = Date.now() - startTime;
            
            // 计算实际成本
            const tokenCount = this.estimateTokenCount(content);
            const actualCost = this.calculateActualCost(selection, tokenCount);
            
            // 构建响应
            const response: LLMResponse = {
                success: true,
                requestId,
                agentId: request.agentId,
                agentName: request.agentName,
                content,
                providerId: selection.providerId,
                model: selection.model,
                estimatedCost: actualCost,
                estimatedLatency: latency,
                timestamp: Date.now()
            };
            
            // 记录监控指标
            this.recordMetrics(selection.providerId, {
                latency,
                success: true,
                statusCode: 200,
                model: selection.model,
                estimatedCost: actualCost,
                tokenCount
            });
            
            // 更新统计
            this.updateStats(true, latency, actualCost);
            
            logger.info(`[LLMService] Agent请求成功: ${request.agentName} (${selection.model}), 延迟: ${latency}ms, 成本: ${actualCost}`);
            
            return response;
            
        } catch (error) {
            const latency = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // 记录错误监控
            this.recordMetrics('unknown', {
                latency,
                success: false,
                statusCode: 500,
                model: 'unknown',
                estimatedCost: 0,
                error: errorMessage
            });
            
            // 更新统计
            this.updateStats(false, latency, 0);
            
            logger.error(`[LLMService] Agent请求失败: ${request.agentName}, 错误: ${errorMessage}`);
            
            return {
                success: false,
                requestId,
                agentId: request.agentId,
                agentName: request.agentName,
                content: `**系统错误**: ${errorMessage}\n\n请稍后重试或联系系统管理员。`,
                providerId: 'unknown',
                model: 'unknown',
                estimatedCost: 0,
                estimatedLatency: latency,
                timestamp: Date.now(),
                error: errorMessage
            };
        }
    }
    
    /**
     * 执行流式Agent LLM请求
     */
    public async executeAgentStreamRequest(
        request: LLMRequest, 
        callbacks: StreamCallback
    ): Promise<string> {
        const requestId = `llm_stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const startTime = Date.now();
        
        try {
            // 验证请求
            const validation = this.validateAgentRequest(request);
            if (!validation.valid) {
                throw new Error(`请求验证失败: ${validation.errors.join(', ')}`);
            }
            
            // 获取Agent配置
            const agentConfig = await this.getAgentConfig(request.agentId);
            
            // 构建模型需求
            const requirements = this.buildModelRequirements(request, agentConfig);
            
            // 选择模型
            const selection = await this.modelSelector.selectModel(requirements);
            if (!selection.success) {
                throw new Error(`模型选择失败: ${selection.error || '未知错误'}`);
            }
            
            // 构建Python请求上下文
            const context = this.buildRequestContext(request, agentConfig);
            
            // 执行流式Python调用
            await this.pythonBridge.stream(
                'neural_agent.process_agent_query_stream',
                [request.query, context, JSON.stringify(agentConfig)],
                (chunk: string) => {
                    try {
                        const parsed = JSON.parse(chunk);
                        const { type, content, tool, result } = parsed;
                        
                        switch (type) {
                            case 'token':
                                callbacks.onToken?.(content);
                                break;
                            case 'tool_start':
                                callbacks.onToolStart?.(tool);
                                break;
                            case 'tool_end':
                                callbacks.onToolEnd?.(tool, result);
                                break;
                        }
                    } catch (e) {
                        // 忽略解析错误，继续处理
                    }
                }
            );
            
            const latency = Date.now() - startTime;
            
            // 计算估算成本
            const estimatedCost = selection.estimatedCost || 0.000001;
            
            // 记录监控指标
            this.recordMetrics(selection.providerId, {
                latency,
                success: true,
                statusCode: 200,
                model: selection.model,
                estimatedCost,
                stream: true
            });
            
            // 调用完成回调
            const response: LLMResponse = {
                success: true,
                requestId,
                agentId: request.agentId,
                agentName: request.agentName,
                content: '[流式响应完成]',
                providerId: selection.providerId,
                model: selection.model,
                estimatedCost,
                estimatedLatency: latency,
                timestamp: Date.now()
            };
            
            callbacks.onComplete?.(response);
            
            logger.info(`[LLMService] Agent流式请求完成: ${request.agentName}, 延迟: ${latency}ms`);
            
            return requestId;
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            callbacks.onError?.(new Error(errorMessage));
            
            logger.error(`[LLMService] Agent流式请求失败: ${request.agentName}, 错误: ${errorMessage}`);
            
            throw error;
        }
    }
    
    /**
     * 执行多Agent协作请求
     */
    public async executeCollaborationRequest(
        coordinatorRequest: LLMRequest,
        specialistRequests: LLMRequest[]
    ): Promise<CollaborationResult> {
        const startTime = Date.now();
        const collaborationId = `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        logger.info(`[LLMService] 开始协作请求: ${coordinatorRequest.agentName}, 专业Agent数量: ${specialistRequests.length}`);
        
        try {
            // 1. 并行执行所有专业Agent请求
            const specialistPromises = specialistRequests.map(async (request) => {
                try {
                    const response = await this.executeAgentRequest(request);
                    return { agentId: request.agentId, response };
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    logger.warn(`[LLMService] 专业Agent ${request.agentName} 请求失败: ${errorMessage}`);
                    
                    // 返回错误响应，但不中断协作
                    const errorResponse: LLMResponse = {
                        success: false,
                        requestId: `error_${Date.now()}`,
                        agentId: request.agentId,
                        agentName: request.agentName,
                        content: `**Agent处理错误**: ${errorMessage}`,
                        providerId: 'unknown',
                        model: 'unknown',
                        estimatedCost: 0,
                        estimatedLatency: 0,
                        timestamp: Date.now(),
                        error: errorMessage
                    };
                    
                    return { agentId: request.agentId, response: errorResponse };
                }
            });
            
            const specialistResults = await Promise.all(specialistPromises);
            
            // 2. 构建专业Agent意见摘要
            const specialistSummary = this.buildSpecialistSummary(specialistResults);
            
            // 3. 构建办公厅主任的整合查询
            const integratedQuery = this.buildIntegratedQuery(coordinatorRequest, specialistSummary);
            
            // 4. 执行办公厅主任整合请求
            const integratedRequest: LLMRequest = {
                ...coordinatorRequest,
                query: integratedQuery,
                context: `# 办公厅主任整合任务

协作ID: ${collaborationId}
专业Agent数量: ${specialistRequests.length}

${specialistSummary}`
            };
            
            const coordinatorResponse = await this.executeAgentRequest(integratedRequest);
            
            // 5. 计算总成本和总延迟
            const specialistResponses: Record<string, LLMResponse> = {};
            let totalCost = coordinatorResponse.estimatedCost;
            let totalLatency = coordinatorResponse.estimatedLatency;
            
            specialistResults.forEach(result => {
                specialistResponses[result.agentId] = result.response;
                totalCost += result.response.estimatedCost;
                totalLatency += result.response.estimatedLatency;
            });
            
            // 6. 生成整合响应
            const integratedResponse = this.extractKeyPoints(coordinatorResponse.content);
            
            const result: CollaborationResult = {
                coordinatorResponse,
                specialistResponses,
                integratedResponse,
                totalCost,
                totalLatency,
                timestamp: Date.now()
            };
            
            logger.info(`[LLMService] 协作请求完成: ${coordinatorRequest.agentName}, 总成本: ${totalCost}, 总延迟: ${totalLatency}ms`);
            
            return result;
            
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`[LLMService] 协作请求失败: ${errorMessage}`);
            
            throw new Error(`协作请求失败: ${errorMessage}`);
        }
    }
    
    /**
     * 获取Agent配置
     */
    public async getAgentConfig(agentId: string): Promise<AgentConfig> {
        const config = this.agentConfigs.get(agentId) || this.agentConfigs.get('default');
        if (!config) {
            throw new Error(`未找到Agent配置: ${agentId}`);
        }
        return config;
    }
    
    /**
     * 获取服务统计信息
     */
    public getServiceStats(): ServiceStats {
        const successRate = this.requestCount > 0 ? this.successCount / this.requestCount : 1.0;
        const averageLatency = this.requestCount > 0 ? this.totalLatency / this.requestCount : 0;
        
        return {
            totalRequests: this.requestCount,
            successRate,
            averageLatency,
            totalCost: this.totalCost,
            activeAgents: this.agentConfigs.size,
            providers: ['deepseek', 'openai', 'anthropic', 'ollama'],
            timestamp: Date.now()
        };
    }
    
    /**
     * 验证Agent请求
     */
    public validateAgentRequest(request: LLMRequest): ValidationResult {
        const errors: string[] = [];
        
        if (!request.agentId || request.agentId.trim() === '') {
            errors.push('缺少agentId');
        }
        
        if (!request.agentName || request.agentName.trim() === '') {
            errors.push('缺少agentName');
        }
        
        if (!request.query || request.query.trim() === '') {
            errors.push('查询内容不能为空');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    // ============================================================================
    // 私有辅助方法
    // ============================================================================
    
    private buildModelRequirements(request: LLMRequest, agentConfig: AgentConfig): IModelRequirements {
        // 根据Agent能力类型映射到模型能力
        let capability: 'general' | 'reasoning' | 'coding' | 'fast' | 'creative' = 'general';
        
        if (agentConfig.capabilities.includes('coding')) {
            capability = 'coding';
        } else if (agentConfig.capabilities.includes('reasoning') || agentConfig.capabilities.includes('compliance')) {
            capability = 'reasoning';
        } else if (agentConfig.capabilities.includes('creative')) {
            capability = 'creative';
        }
        
        return {
            capability,
            maxTokens: agentConfig.maxTokens || 8192,
            contextSize: 4096,
            temperature: agentConfig.temperature || 0.5,
            priority: 'quality' as const
        };
    }
    
    private buildRequestContext(request: LLMRequest, agentConfig: AgentConfig): string {
        const timestamp = new Date().toISOString();
        
        // 限制查询内容的长度，防止上下文过长
        const limitedQuery = request.query.length > 1000 
            ? request.query.substring(0, 1000) + '...（内容已截断）'
            : request.query;
        
        // 限制额外上下文的长度
        let limitedContext = '';
        if (request.context) {
            limitedContext = request.context.length > 2000
                ? request.context.substring(0, 2000) + '...（上下文已截断）'
                : request.context;
        }
        
        // 限制系统提示词的长度
        const limitedSystemPrompt = agentConfig.systemPrompt.length > 4000
            ? agentConfig.systemPrompt.substring(0, 4000) + '...（系统提示已截断）'
            : agentConfig.systemPrompt;
        
        return `${limitedSystemPrompt}

## 当前请求详情
- 请求ID: ${Date.now()}
- 请求时间: ${timestamp}
- Agent类型: ${request.agentType}
- 查询内容: ${limitedQuery}

${limitedContext ? `## 额外上下文
${limitedContext}` : ''}

## 回答要求
请以${request.agentName}的身份回答，确保回答符合Agent的职责和能力范围。`;
    }
    
    private extractContent(pythonResponse: any): string {
        if (typeof pythonResponse === 'string') {
            return pythonResponse;
        } else if (pythonResponse && typeof pythonResponse === 'object') {
            // 尝试从Python响应对象中提取内容
            if (pythonResponse.content) {
                return pythonResponse.content;
            } else if (pythonResponse.result) {
                return pythonResponse.result;
            } else if (pythonResponse.response) {
                return pythonResponse.response;
            }
        }
        
        return JSON.stringify(pythonResponse, null, 2);
    }
    
    private estimateTokenCount(text: string): number {
        // 简单估算：中文字符约1.5个token，英文字符约0.25个token
        const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        const englishChars = text.length - chineseChars;
        
        return Math.ceil(chineseChars * 1.5 + englishChars * 0.25);
    }
    
    private calculateActualCost(selection: IModelSelection, tokenCount: number): number {
        if (selection.estimatedCost && selection.estimatedCost > 0) {
            // 假设预估成本是基于1000个token的，按比例计算
            return selection.estimatedCost * (tokenCount / 1000);
        }
        
        // 默认成本：每千token 0.000001
        return 0.000001 * (tokenCount / 1000);
    }
    
    private recordMetrics(providerId: string, metrics: {
        latency: number;
        success: boolean;
        statusCode: number;
        model: string;
        estimatedCost: number;
        tokenCount?: number;
        stream?: boolean;
        error?: string;
    }): void {
        try {
            this.monitoringService.record(providerId, {
                timestamp: Date.now(),
                latency: metrics.latency,
                success: metrics.success,
                statusCode: metrics.statusCode,
                providerId,
                model: metrics.model,
                estimatedCost: metrics.estimatedCost,
                tokensUsed: metrics.tokenCount
            });
        } catch (error) {
            logger.warn(`[LLMService] 记录监控指标失败: ${error}`);
        }
    }
    
    private updateStats(success: boolean, latency: number, cost: number): void {
        this.requestCount++;
        if (success) {
            this.successCount++;
            this.totalLatency += latency;
            this.totalCost += cost;
        }
    }
    
    private buildSpecialistSummary(results: Array<{ agentId: string; response: LLMResponse }>): string {
        let summary = '# 各专业Agent意见汇总\n\n';
        
        results.forEach(({ agentId, response }) => {
            const agentName = response.agentName || agentId.replace('agent:', '');
            const contentSummary = this.extractSummary(response.content, 200);
            
            summary += `## ${agentName} (${agentId})\n`;
            summary += `**状态**: ${response.success ? '✅ 成功' : '❌ 失败'}\n`;
            
            if (response.error) {
                summary += `**错误**: ${response.error}\n`;
            } else {
                summary += `**摘要**: ${contentSummary}\n`;
                summary += `**模型**: ${response.model} (${response.providerId})\n`;
                summary += `**成本**: ${response.estimatedCost.toFixed(8)}\n`;
            }
            
            summary += '\n';
        });
        
        return summary;
    }
    
    private buildIntegratedQuery(coordinatorRequest: LLMRequest, specialistSummary: string): string {
        return `${coordinatorRequest.query}

## 任务要求
请基于以下各专业Agent的意见，提供一个综合的、平衡的最终方案。

${specialistSummary}

## 整合要求
1. 综合考虑所有专业Agent的意见
2. 识别潜在冲突并提供解决方案
3. 形成可执行的最终建议
4. 保持专业性和实用性`;
    }
    
    private extractSummary(content: string, maxLength = 150): string {
        if (content.length <= maxLength) {
            return content;
        }
        
        // 尝试在句子边界处截断
        const sentences = content.split(/[。！？.!?]/);
        let summary = '';
        
        for (const sentence of sentences) {
            if ((summary + sentence).length > maxLength - 3) { // 保留...的空间
                break;
            }
            summary += sentence + '。';
        }
        
        return summary.length > 0 ? summary + '...' : content.substring(0, maxLength - 3) + '...';
    }
    
    private extractKeyPoints(content: string, maxPoints = 3): string {
        const sentences = content.split(/[。！？.!?]/).filter(s => s.trim().length > 10);
        const keyPoints = sentences.slice(0, maxPoints).map((sentence, index) => {
            const trimmed = sentence.trim();
            return `• ${trimmed}${trimmed.endsWith('。') ? '' : '。'}`;
        });
        
        return keyPoints.join('\n');
    }
}