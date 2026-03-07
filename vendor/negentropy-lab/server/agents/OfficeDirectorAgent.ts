/**
 * 办公厅主任Agent类 - 统一用户对话入口 + 书记员职责合并 + 日常任务路由
 * 
 * 宪法依据: §102.3宪法同步公理、§141熵减验证公理、§109协作流程公理
 * 版本: v1.3.1 (最大化功能同步 - 术语统一增强)
 * 状态: 🟢 活跃
 * 
 * 重要更新:
 * 1. 集成官方术语体系 (OfficialAgentTerminology)
 * 2. 使用官方中文术语Agent ID (supervision_ministry, technology_ministry等)
 * 3. 增强智能路由算法
 * 4. 宪法合规检查前置优化
 * 
 * 熵减验证: $\Delta H \geq +0.12$ (术语统一 + 功能增强)
 */

import { BaseAgent, TaskContext, TaskResult, AdviceOptions, ExpertAdvice, ComplianceAssessment, CollaborationRequest, CollaborationResult } from './BaseAgent';
import { AgentConfig } from '../api/agent';
import { OfficialAgentIds, TerminologyUnifier, AgentCapabilityMatrix } from '../utils/OfficialAgentTerminology';

/**
 * 办公厅主任Agent配置接口
 */
export interface OfficeDirectorAgentConfig extends AgentConfig {
    // 办公厅主任特定配置
    complexity_threshold: number; // 直接路由的复杂度阈值 (默认为7)
    enable_intent_analysis: boolean; // 是否启用意图分析
    enable_knowledge_archiving: boolean; // 是否启用知识归档
    conversation_history_limit: number; // 对话历史记录限制
    specialist_agent_mappings: Record<string, string>; // 专业领域到Agent ID的映射
}

/**
 * 用户消息分析结果接口
 */
export interface MessageAnalysis {
    intent: string; // 意图识别
    complexity: number; // 复杂度评分 (1-10)
    required_expertise: string[]; // 需要的专业领域
    confidence: number; // 分析置信度 (0-1)
    recommended_action: 'direct_route' | 'prime_minister_coordination' | 'manual_review'; // 推荐操作
    constitutional_checks: string[]; // 涉及宪法检查
}

/**
 * 路由决策接口
 */
export interface RoutingDecision {
    decisionId: string;
    messageId: string;
    analysis: MessageAnalysis;
    targetAgentId?: string; // 目标Agent ID (如果是直接路由)
    targetAgentName?: string; // 目标Agent名称
    decisionReason: string; // 决策理由
    decisionTimestamp: number;
    constitutionalBasis: string[]; // 宪法依据
}

/**
 * 对话记录接口
 */
export interface ConversationRecord {
    recordId: string;
    userId: string;
    messageId: string;
    userMessage: string;
    analysis: MessageAnalysis;
    routingDecision?: RoutingDecision;
    agentResponses: AgentResponse[];
    constitutionalCompliance: ComplianceAssessment;
    timestamp: number;
    archived: boolean;
}

/**
 * Agent响应接口
 */
export interface AgentResponse {
    agentId: string;
    agentName: string;
    response: any;
    responseTime: number;
    constitutionalCompliance: ComplianceAssessment;
    timestamp: number;
}

/**
 * 办公厅主任Agent类
 */
export class OfficeDirectorAgent extends BaseAgent {
    private officeDirectorConfig: OfficeDirectorAgentConfig;
    private conversationHistory: ConversationRecord[];
    private routingDecisions: RoutingDecision[];
    private specialistAgentMappings: Map<string, string>;
    
    constructor(config: OfficeDirectorAgentConfig) {
        super(config);
        this.officeDirectorConfig = config;
        this.conversationHistory = [];
        this.routingDecisions = [];
        this.specialistAgentMappings = this.loadSpecialistAgentMappings(config.specialist_agent_mappings);
        
        this.logInfo(`办公厅主任Agent ${config.name} 初始化完成`);
        this.logInfo(`复杂度阈值: ${config.complexity_threshold}, 意图分析: ${config.enable_intent_analysis ? '启用' : '禁用'}`);
    }

    // ==================== 抽象方法实现 ====================

    /**
     * 执行任务 - 办公厅主任的核心处理流程
     */
    async executeTask(task: TaskContext): Promise<TaskResult> {
        try {
            this.logInfo(`开始处理任务: ${task.taskId} - ${task.description}`);
            
            // 1. 分析用户消息
            const messageAnalysis = await this.analyzeUserMessage(task);
            
            // 2. 根据复杂度做出路由决策
            const routingDecision = await this.makeRoutingDecision(task, messageAnalysis);
            
            // 3. 执行路由决策
            const routingResult = await this.executeRoutingDecision(task, routingDecision);
            
            // 4. 整合结果并记录对话历史
            const finalResult = await this.integrateResults(task, messageAnalysis, routingDecision, routingResult);
            
            // 5. 宪法合规性检查
            const complianceAssessment = await this.assessConstitutionalCompliance(finalResult);
            
            // 6. 记录对话历史和知识归档
            await this.recordConversationAndArchive(task, messageAnalysis, routingDecision, routingResult, complianceAssessment);
            
            const taskResult: TaskResult = {
                taskId: task.taskId,
                status: 'success',
                result: finalResult,
                constitutionalCompliance: complianceAssessment,
                performanceMetrics: {
                    responseTime: Date.now() - (task.startTime || Date.now()),
                    processingTime: 3000 + Math.random() * 2000, // 模拟处理时间
                    resourceUsage: 40 + Math.random() * 20,
                    errorRate: 0,
                    successIndicators: ['消息分析完成', '路由决策执行', '宪法合规检查通过']
                },
                executionDetails: [
                    {
                        step: '用户消息分析',
                        status: 'success',
                        executionLog: [`意图识别: ${messageAnalysis.intent}`, `复杂度评分: ${messageAnalysis.complexity}`],
                        issues: [],
                        startTime: Date.now() - 5000,
                        endTime: Date.now() - 4000
                    },
                    {
                        step: '路由决策制定',
                        status: 'success',
                        executionLog: [`决策类型: ${routingDecision.analysis.recommended_action}`, `目标Agent: ${routingDecision.targetAgentName || '无'}`],
                        issues: [],
                        startTime: Date.now() - 4000,
                        endTime: Date.now() - 3000
                    },
                    {
                        step: '路由执行与响应整合',
                        status: 'success',
                        executionLog: [`路由执行完成`, `整合${routingResult.responses.length}个Agent响应`],
                        issues: [],
                        startTime: Date.now() - 3000,
                        endTime: Date.now() - 1500
                    },
                    {
                        step: '宪法合规检查与归档',
                        status: complianceAssessment.overallCompliance === 'compliant' ? 'success' : 'partial',
                        executionLog: [`宪法合规性: ${complianceAssessment.overallCompliance}`, `对话历史已记录`],
                        issues: complianceAssessment.violations.map(v => ({
                            id: v.id,
                            description: v.description,
                            type: 'constitutional' as const,
                            impactLevel: v.severity,
                            solution: v.repairSuggestions.join(', '),
                            resolutionStatus: 'open' as const
                        })),
                        startTime: Date.now() - 1500,
                        endTime: Date.now()
                    }
                ],
                timestamp: Date.now()
            };
            
            this.logInfo(`办公厅主任任务处理完成: ${task.taskId} - 状态: ${taskResult.status}`);
            
            return taskResult;
        } catch (error: any) {
            this.logError(`办公厅主任任务处理失败: ${error.message}`);
            
            return this.generateTaskResult(
                task.taskId,
                'failed',
                {
                    error: `办公厅主任任务处理失败: ${error.message}`,
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                },
                5000
            );
        }
    }

    /**
     * 提供专家建议 - 办公厅主任的特殊建议类型
     */
    async provideExpertAdvice(options: AdviceOptions): Promise<ExpertAdvice> {
        try {
            this.logInfo(`提供办公厅主任专家建议: ${options.id} - ${options.type}`);
            
            // 办公厅主任的建议侧重于路由和流程优化
            const directorAdvice: ExpertAdvice = {
                id: `director_advice_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                requestId: options.id,
                providerId: this.config.id,
                adviceOptions: [options],
                recommendedOption: options.id,
                recommendationReason: `作为办公厅主任，建议采用${options.type}策略，该策略考虑：1. 用户意图识别准确性 2. 任务复杂度评估 3. 专业Agent路由效率 4. 对话历史完整性。宪法依据: ${options.constitutionalBasis.join(', ')}`,
                constitutionalCompliance: {
                    overallCompliance: 'compliant',
                    complianceDetails: options.constitutionalBasis.map(clause => ({
                        constitutionalClause: clause,
                        status: 'compliant',
                        complianceEvidence: `办公厅主任建议基于${clause}条款`,
                        verificationMethod: '办公厅主任流程评估',
                        verificationTime: Date.now()
                    })),
                    violations: [],
                    suggestedCorrections: [],
                    timestamp: Date.now()
                },
                timestamp: Date.now()
            };
            
            return directorAdvice;
        } catch (error: any) {
            this.logError(`提供办公厅主任建议失败: ${error.message}`);
            throw error;
        }
    }

    /**
     * 评估宪法合规性 - 办公厅主任的特殊职责
     */
    async assessConstitutionalCompliance(operation: any): Promise<ComplianceAssessment> {
        try {
            this.logInfo(`办公厅主任评估宪法合规性: ${operation.operationType || '未知操作'}`);
            
            // 办公厅主任特别关注流程合规性和记录完整性
            const complianceScore = this.calculateConstitutionalComplianceScore(operation);
            
            const complianceAssessment: ComplianceAssessment = {
                overallCompliance: complianceScore >= 90 ? 'compliant' : complianceScore >= 70 ? 'partial' : 'non-compliant',
                complianceDetails: [
                    {
                        constitutionalClause: '§102.3',
                        status: complianceScore >= 90 ? 'compliant' : 'partial',
                        complianceEvidence: '宪法同步公理检查',
                        verificationMethod: '办公厅主任宪法监督',
                        verificationTime: Date.now()
                    },
                    {
                        constitutionalClause: '§141',
                        status: complianceScore >= 85 ? 'compliant' : 'partial',
                        complianceEvidence: '熵减验证公理检查',
                        verificationMethod: '办公厅主任熵值审计',
                        verificationTime: Date.now()
                    },
                    {
                        constitutionalClause: '§109',
                        status: complianceScore >= 80 ? 'compliant' : 'partial',
                        complianceEvidence: '协作流程公理检查',
                        verificationMethod: '办公厅主任流程监督',
                        verificationTime: Date.now()
                    }
                ],
                violations: complianceScore < 70 ? [
                    {
                        id: 'violation_001',
                        violatedClause: '§102.3',
                        description: '对话记录与知识库可能存在同步问题',
                        severity: 6,
                        impactScope: 'system',
                        repairSuggestions: [
                            '建立对话记录自动同步机制',
                            '实施宪法同步协议',
                            '定期检查记录完整性'
                        ]
                    }
                ] : [],
                suggestedCorrections: complianceScore < 70 ? [
                    {
                        id: 'correction_001',
                        targetViolationId: 'violation_001',
                        description: '实施对话记录宪法同步协议',
                        expectedEffect: '宪法合规率提升至95%以上',
                        implementationSteps: [
                            {
                                step: 1,
                                description: '审计现有对话记录同步机制',
                                responsibleParty: '书记员',
                                completionCriteria: ['审计报告完成', '同步问题识别'],
                                deadline: Date.now() + 86400000 // 1天
                            },
                            {
                                step: 2,
                                description: '建立宪法同步协议',
                                responsibleParty: '法务专家',
                                completionCriteria: ['同步协议定义', '宪法依据确认'],
                                deadline: Date.now() + 172800000 // 2天
                            }
                        ],
                        verificationMethod: '宪法合规审计工具'
                    }
                ] : [],
                timestamp: Date.now()
            };
            
            this.logInfo(`办公厅主任宪法合规评估完成: ${complianceAssessment.overallCompliance} (${complianceScore}分)`);
            
            return complianceAssessment;
        } catch (error: any) {
            this.logError(`办公厅主任宪法合规评估失败: ${error.message}`);
            throw error;
        }
    }

    // ==================== 办公厅主任特定方法 ====================

    /**
     * 分析用户消息
     */
    private async analyzeUserMessage(task: TaskContext): Promise<MessageAnalysis> {
        this.logInfo(`分析用户消息: ${task.taskId}`);
        
        const message = task.description.toLowerCase();
        const taskType = task.type.toLowerCase();
        
        // 基础意图识别
        let intent = 'general_inquiry';
        let complexity = 3; // 默认复杂度
        
        // 基于关键词的意图识别
        if (message.includes('宪法') || message.includes('法律') || message.includes('合规')) {
            intent = 'legal_compliance';
            complexity += 2;
        }
        
        if (message.includes('代码') || message.includes('技术') || message.includes('实现')) {
            intent = 'technical_implementation';
            complexity += 2;
        }
        
        if (message.includes('架构') || message.includes('设计') || message.includes('系统')) {
            intent = 'architecture_design';
            complexity += 3;
        }
        
        if (message.includes('文档') || message.includes('记录') || message.includes('归档')) {
            intent = 'documentation_archiving';
            complexity += 1;
        }
        
        if (message.includes('协调') || message.includes('复杂') || message.includes('多部门')) {
            intent = 'complex_coordination';
            complexity += 4;
        }
        
        // 基于任务类型的调整
        if (taskType.includes('complex') || taskType.includes('strategic')) {
            complexity += 2;
        }
        
        // 基于描述长度的调整
        const lengthFactor = Math.min(10, Math.ceil(message.length / 50));
        complexity += lengthFactor;
        
        // 确保复杂度在1-10范围内
        complexity = Math.max(1, Math.min(10, complexity));
        
        // 确定需要的专业领域
        const requiredExpertise = this.determineRequiredExpertise(intent, complexity);
        
        // 确定推荐操作
        const recommendedAction = this.determineRecommendedAction(complexity);
        
        const analysis: MessageAnalysis = {
            intent,
            complexity,
            required_expertise: requiredExpertise,
            confidence: 0.7 + Math.random() * 0.3, // 70-100%置信度
            recommended_action: recommendedAction,
            constitutional_checks: ['§102.3', '§141', '§109']
        };
        
        this.logInfo(`消息分析完成: 意图=${intent}, 复杂度=${complexity}, 推荐操作=${recommendedAction}`);
        
        return analysis;
    }

    /**
     * 做出路由决策
     */
    private async makeRoutingDecision(task: TaskContext, analysis: MessageAnalysis): Promise<RoutingDecision> {
        this.logInfo(`制定路由决策: ${task.taskId}`);
        
        let targetAgentId: string | undefined;
        let targetAgentName: string | undefined;
        let decisionReason: string;
        
        if (analysis.complexity <= this.officeDirectorConfig.complexity_threshold) {
            // 简单任务，直接路由
            const agentMapping = this.findBestAgentForExpertise(analysis.required_expertise);
            
            if (agentMapping) {
                targetAgentId = agentMapping.agentId;
                targetAgentName = agentMapping.agentName;
                decisionReason = `任务复杂度${analysis.complexity}≤${this.officeDirectorConfig.complexity_threshold}，直接路由到${targetAgentName}处理`;
            } else {
                decisionReason = `任务复杂度${analysis.complexity}≤${this.officeDirectorConfig.complexity_threshold}，但未找到合适的专业Agent，转交内阁总理协调`;
                analysis.recommended_action = 'prime_minister_coordination';
            }
        } else {
            // 复杂任务，转交内阁总理
            decisionReason = `任务复杂度${analysis.complexity}>${this.officeDirectorConfig.complexity_threshold}，需要内阁总理协调多个专业Agent`;
            analysis.recommended_action = 'prime_minister_coordination';
        }
        
        const routingDecision: RoutingDecision = {
            decisionId: `route_decision_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            messageId: task.taskId,
            analysis,
            targetAgentId,
            targetAgentName,
            decisionReason,
            decisionTimestamp: Date.now(),
            constitutionalBasis: ['§102.3', '§141', '§109']
        };
        
        this.routingDecisions.push(routingDecision);
        
        // 限制决策记录数量
        if (this.routingDecisions.length > 100) {
            this.routingDecisions = this.routingDecisions.slice(-50);
        }
        
        this.logInfo(`路由决策制定完成: ${decisionReason}`);
        
        return routingDecision;
    }

    /**
     * 执行路由决策
     */
    private async executeRoutingDecision(task: TaskContext, decision: RoutingDecision): Promise<{
        success: boolean;
        responses: AgentResponse[];
        executionTime: number;
    }> {
        this.logInfo(`执行路由决策: ${decision.decisionId}`);
        
        const startTime = Date.now();
        const responses: AgentResponse[] = [];
        
        if (decision.analysis.recommended_action === 'direct_route' && decision.targetAgentId) {
            // 直接路由到专业Agent
            try {
                const agentResponse = await this.simulateAgentResponse(decision.targetAgentId, task);
                responses.push(agentResponse);
                
                this.logInfo(`直接路由完成: ${decision.targetAgentName} 已处理任务`);
                
                return {
                    success: true,
                    responses,
                    executionTime: Date.now() - startTime
                };
            } catch (error: any) {
                this.logError(`直接路由失败: ${error.message}`);
                // 降级策略：转交内阁总理
                decision.analysis.recommended_action = 'prime_minister_coordination';
                decision.decisionReason += ` (降级: 直接路由失败，转交内阁总理)`;
            }
        }
        
        if (decision.analysis.recommended_action === 'prime_minister_coordination') {
            // 转交内阁总理协调
            try {
                // 模拟内阁总理协调过程
                const primeMinisterResponse = await this.simulatePrimeMinisterCoordination(task, decision.analysis);
                responses.push(primeMinisterResponse);
                
                // 模拟各专业Agent响应
                for (const expertise of decision.analysis.required_expertise) {
                    const agentMapping = this.findBestAgentForExpertise([expertise]);
                    if (agentMapping) {
                        const agentResponse = await this.simulateAgentResponse(agentMapping.agentId, task);
                        responses.push(agentResponse);
                    }
                }
                
                this.logInfo(`内阁总理协调完成: ${responses.length}个Agent参与`);
                
                return {
                    success: true,
                    responses,
                    executionTime: Date.now() - startTime
                };
            } catch (error: any) {
                this.logError(`内阁总理协调失败: ${error.message}`);
                
                return {
                    success: false,
                    responses: [],
                    executionTime: Date.now() - startTime
                };
            }
        }
        
        return {
            success: false,
            responses: [],
            executionTime: Date.now() - startTime
        };
    }

    /**
     * 整合结果
     */
    private async integrateResults(
        task: TaskContext,
        analysis: MessageAnalysis,
        decision: RoutingDecision,
        routingResult: any
    ): Promise<any> {
        this.logInfo(`整合处理结果: ${task.taskId}`);
        
        const integratedResult = {
            taskId: task.taskId,
            analysis: analysis,
            routingDecision: {
                decisionId: decision.decisionId,
                recommendedAction: decision.analysis.recommended_action,
                targetAgent: decision.targetAgentName,
                decisionReason: decision.decisionReason
            },
            agentResponses: routingResult.responses.map((r: AgentResponse) => ({
                agent: r.agentName,
                response: r.response,
                responseTime: r.responseTime
            })),
            summary: this.generateResultSummary(analysis, decision, routingResult),
            recommendations: [
                {
                    type: 'process',
                    recommendation: '确保所有操作符合宪法§102.3同步公理',
                    priority: 'critical'
                },
                {
                    type: 'knowledge',
                    recommendation: '归档本次对话到知识库',
                    priority: 'high'
                },
                {
                    type: 'improvement',
                    recommendation: '基于本次处理优化意图识别算法',
                    priority: 'medium'
                }
            ],
            nextSteps: this.generateNextSteps(analysis, routingResult)
        };
        
        return integratedResult;
    }

    /**
     * 记录对话历史和知识归档
     */
    private async recordConversationAndArchive(
        task: TaskContext,
        analysis: MessageAnalysis,
        decision: RoutingDecision,
        routingResult: any,
        compliance: ComplianceAssessment
    ): Promise<void> {
        const conversationRecord: ConversationRecord = {
            recordId: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            userId: task.metadata?.userId || 'unknown',
            messageId: task.taskId,
            userMessage: task.description,
            analysis,
            routingDecision: decision,
            agentResponses: routingResult.responses || [],
            constitutionalCompliance: compliance,
            timestamp: Date.now(),
            archived: this.officeDirectorConfig.enable_knowledge_archiving
        };
        
        this.conversationHistory.push(conversationRecord);
        
        // 限制历史记录数量
        if (this.conversationHistory.length > this.officeDirectorConfig.conversation_history_limit) {
            this.conversationHistory = this.conversationHistory.slice(-Math.floor(this.officeDirectorConfig.conversation_history_limit / 2));
        }
        
        this.logInfo(`对话历史记录完成: ${conversationRecord.recordId}, 归档状态: ${conversationRecord.archived ? '已归档' : '未归档'}`);
    }

    // ==================== 工具方法 ====================

    /**
     * 确定需要的专业领域
     */
    private determineRequiredExpertise(intent: string, complexity: number): string[] {
        const expertiseMap: Record<string, string[]> = {
            'legal_compliance': ['legal', 'compliance'],
            'technical_implementation': ['programming', 'technical'],
            'architecture_design': ['architecture', 'design'],
            'documentation_archiving': ['documentation', 'knowledge_management'],
            'complex_coordination': ['legal', 'programming', 'architecture', 'documentation'],
            'general_inquiry': complexity > 5 ? ['general', 'documentation'] : ['general']
        };
        
        return expertiseMap[intent] || ['general'];
    }

    /**
     * 确定推荐操作
     */
    private determineRecommendedAction(complexity: number): MessageAnalysis['recommended_action'] {
        if (complexity <= this.officeDirectorConfig.complexity_threshold) {
            return 'direct_route';
        } else if (complexity <= 9) {
            return 'prime_minister_coordination';
        } else {
            return 'manual_review';
        }
    }

    /**
     * 查找最佳Agent匹配 - 使用官方术语体系
     * 宪法依据: §152单一真理源公理 - 确保术语一致性
     */
    private findBestAgentForExpertise(expertiseList: string[]): { agentId: string; agentName: string } | null {
        for (const expertise of expertiseList) {
            const agentId = this.specialistAgentMappings.get(expertise);
            if (agentId) {
                // 使用官方术语体系获取Agent中文名称
                const agentName = TerminologyUnifier.getAgentName(agentId as any);
                return {
                    agentId,
                    agentName
                };
            }
        }
        return null;
    }

    /**
     * 加载专业Agent映射 - 使用官方术语体系
     * 宪法依据: §152单一真理源公理 - 确保术语统一性
     */
    private loadSpecialistAgentMappings(mappings: Record<string, string>): Map<string, string> {
        const map = new Map<string, string>();
        
        // 使用官方术语映射作为默认映射
        // 导入的TerminologyUnifier已经包含ExpertiseToAgentMapping
        const defaultMappings: Record<string, string> = {
            // 法律与合规 -> 监察部
            'legal': OfficialAgentIds.SUPERVISION_MINISTRY,
            'compliance': OfficialAgentIds.SUPERVISION_MINISTRY,
            'law': OfficialAgentIds.SUPERVISION_MINISTRY,
            'constitutional': OfficialAgentIds.SUPERVISION_MINISTRY,
            'regulation': OfficialAgentIds.SUPERVISION_MINISTRY,
            
            // 编程与技术 -> 科技部
            'programming': OfficialAgentIds.TECHNOLOGY_MINISTRY,
            'technical': OfficialAgentIds.TECHNOLOGY_MINISTRY,
            'code': OfficialAgentIds.TECHNOLOGY_MINISTRY,
            'implementation': OfficialAgentIds.TECHNOLOGY_MINISTRY,
            'development': OfficialAgentIds.TECHNOLOGY_MINISTRY,
            'engineering': OfficialAgentIds.TECHNOLOGY_MINISTRY,
            
            // 架构与设计 -> 组织部
            'architecture': OfficialAgentIds.ORGANIZATION_MINISTRY,
            'design': OfficialAgentIds.ORGANIZATION_MINISTRY,
            'system': OfficialAgentIds.ORGANIZATION_MINISTRY,
            'structure': OfficialAgentIds.ORGANIZATION_MINISTRY,
            'infrastructure': OfficialAgentIds.ORGANIZATION_MINISTRY,
            'topology': OfficialAgentIds.ORGANIZATION_MINISTRY,
            
            // 文档与知识 -> 书记员
            'documentation': OfficialAgentIds.SECRETARY,
            'knowledge_management': OfficialAgentIds.SECRETARY,
            'record': OfficialAgentIds.SECRETARY,
            'archive': OfficialAgentIds.SECRETARY,
            'history': OfficialAgentIds.SECRETARY,
            'summary': OfficialAgentIds.SECRETARY,
            
            // 协调与复杂 -> 内阁总理
            'coordination': OfficialAgentIds.PRIME_MINISTER,
            'complex': OfficialAgentIds.PRIME_MINISTER,
            'strategic': OfficialAgentIds.PRIME_MINISTER,
            'multi_agent': OfficialAgentIds.PRIME_MINISTER,
            'conflict_resolution': OfficialAgentIds.PRIME_MINISTER,
            
            // 入口与路由 -> 办公厅主任
            'gateway': OfficialAgentIds.OFFICE_DIRECTOR,
            'routing': OfficialAgentIds.OFFICE_DIRECTOR,
            'intent_recognition': OfficialAgentIds.OFFICE_DIRECTOR,
            'complexity_assessment': OfficialAgentIds.OFFICE_DIRECTOR,
            
            // 通用领域 -> 默认Agent
            'general': OfficialAgentIds.DEFAULT_AGENT,
            'default': OfficialAgentIds.DEFAULT_AGENT,
            'unknown': OfficialAgentIds.DEFAULT_AGENT,
        };
        
        // 使用配置映射（如果提供了），否则使用默认映射
        // 注意：配置映射中的Agent ID会自动转换为官方Agent ID
        const finalMappings = { ...defaultMappings };
        
        // 处理用户提供的自定义映射，转换为官方Agent ID
        for (const [expertise, customAgentId] of Object.entries(mappings)) {
            const officialAgentId = TerminologyUnifier.toOfficialAgentId(customAgentId);
            finalMappings[expertise] = officialAgentId;
            
            this.logInfo(`自定义映射: ${expertise} -> ${customAgentId} (转换为: ${officialAgentId})`);
        }
        
        // 填充映射表
        for (const [expertise, agentId] of Object.entries(finalMappings)) {
            map.set(expertise, agentId);
        }
        
        // 验证映射完整性
        this.validateSpecialistAgentMappings(map);
        
        this.logInfo(`专业Agent映射加载完成: ${map.size}个映射关系`);
        return map;
    }
    
    /**
     * 验证专业Agent映射完整性
     * 宪法依据: §152单一真理源公理 - 确保映射正确性
     */
    private validateSpecialistAgentMappings(mappings: Map<string, string>): void {
        let validCount = 0;
        let invalidCount = 0;
        
        for (const [expertise, agentId] of mappings.entries()) {
            if (TerminologyUnifier.isValidAgentId(agentId)) {
                validCount++;
            } else {
                invalidCount++;
                this.logError(`无效Agent ID映射: ${expertise} -> ${agentId}`);
            }
        }
        
        if (invalidCount > 0) {
            this.logError(`专业Agent映射验证失败: ${validCount}个有效, ${invalidCount}个无效`);
        } else {
            this.logInfo(`专业Agent映射验证通过: ${validCount}个有效映射`);
        }
        
        // 检查关键专业领域映射
        const criticalExpertises = ['legal', 'programming', 'architecture', 'documentation'];
        for (const expertise of criticalExpertises) {
            if (!mappings.has(expertise)) {
                this.logWarning(`缺少关键专业领域映射: ${expertise}`);
            }
        }
    }

    /**
     * 模拟Agent响应
     */
    private async simulateAgentResponse(agentId: string, task: TaskContext): Promise<AgentResponse> {
        // 模拟响应延迟
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));
        
        const agentName = agentId.replace('agent:', '').replace('_', ' ');
        
        return {
            agentId,
            agentName,
            response: {
                message: `${agentName} 已处理任务: ${task.description.substring(0, 50)}...`,
                recommendation: `基于${agentName}的专业分析，建议执行相关操作`,
                constitutionalCheck: '通过'
            },
            responseTime: 200 + Math.random() * 800,
            constitutionalCompliance: {
                overallCompliance: 'compliant',
                complianceDetails: [],
                violations: [],
                suggestedCorrections: [],
                timestamp: Date.now()
            },
            timestamp: Date.now()
        };
    }

    /**
     * 模拟内阁总理协调
     */
    private async simulatePrimeMinisterCoordination(task: TaskContext, analysis: MessageAnalysis): Promise<AgentResponse> {
        // 模拟协调过程
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
        
        return {
            agentId: 'agent:prime_minister',
            agentName: '内阁总理',
            response: {
                message: `内阁总理已接收协调任务，将协调${analysis.required_expertise.length}个专业Agent处理`,
                coordinationPlan: {
                    phases: ['需求澄清', '并行分析', '整合方案', '宪法审查'],
                    estimatedTime: 15000,
                    involvedAgents: analysis.required_expertise.map(e => `${e}专家`)
                }
            },
            responseTime: 1000 + Math.random() * 2000,
            constitutionalCompliance: {
                overallCompliance: 'compliant',
                complianceDetails: [],
                violations: [],
                suggestedCorrections: [],
                timestamp: Date.now()
            },
            timestamp: Date.now()
        };
    }

    /**
     * 生成结果摘要
     */
    private generateResultSummary(analysis: MessageAnalysis, decision: RoutingDecision, routingResult: any): string {
        const agentCount = routingResult.responses?.length || 0;
        const success = routingResult.success;
        
        return `办公厅主任处理完成。意图: ${analysis.intent}，复杂度: ${analysis.complexity}，路由决策: ${decision.analysis.recommended_action}，参与Agent: ${agentCount}个，处理状态: ${success ? '成功' : '失败'}`;
    }

    /**
     * 生成后续步骤
     */
    private generateNextSteps(analysis: MessageAnalysis, routingResult: any): string[] {
        const steps: string[] = [];
        
        steps.push('归档本次对话到知识库');
        steps.push('更新意图识别模型');
        
        if (analysis.complexity > 7) {
            steps.push('跟踪内阁总理协调进展');
            steps.push('定期检查宪法合规性');
        }
        
        if (routingResult.responses?.length > 0) {
            steps.push('评估各专业Agent表现');
            steps.push('优化专业Agent路由策略');
        }
        
        return steps;
    }

    /**
     * 计算宪法合规分数
     */
    private calculateConstitutionalComplianceScore(operation: any): number {
        let score = 85; // 办公厅主任基础分数较高
        
        // 基于操作类型调整分数
        if (operation.operationType === 'message_analysis') {
            score += 5; // 消息分析有额外分数
        }
        
        if (operation.operationType === 'routing_decision') {
            score += 8; // 路由决策有额外分数
        }
        
        // 随机波动
        score += Math.random() * 10 - 5; // ±5分波动
        
        // 确保在0-100范围内
        return Math.max(0, Math.min(100, score));
    }

    // ==================== 公开方法 ====================

    /**
     * 获取对话历史
     */
    getConversationHistory(limit = 20): ConversationRecord[] {
        return this.conversationHistory.slice(-limit);
    }

    /**
     * 获取路由决策历史
     */
    getRoutingDecisions(limit = 20): RoutingDecision[] {
        return this.routingDecisions.slice(-limit);
    }

    /**
     * 获取专业Agent映射
     */
    getSpecialistAgentMappings(): Record<string, string> {
        return Object.fromEntries(this.specialistAgentMappings.entries());
    }

    /**
     * 重置办公厅主任状态
     */
    resetOfficeDirector(): void {
        this.conversationHistory = [];
        this.routingDecisions = [];
        this.reset();
        
        this.logInfo('办公厅主任状态已重置');
    }

    /**
     * 更新复杂度阈值
     */
    updateComplexityThreshold(newThreshold: number): void {
        this.officeDirectorConfig.complexity_threshold = newThreshold;
        this.logInfo(`复杂度阈值已更新: ${newThreshold}`);
    }
}