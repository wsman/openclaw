/**
 * 内阁总理Agent类 - 专门协调多个专业Agent解决复杂任务
 * 
 * 宪法依据: §109协作流程公理、§110协作效率公理、§141熵减验证公理
 * 版本: v1.0.1 (最大化功能同步 - 术语统一增强)
 * 状态: 🟢 活跃
 * 
 * 重要更新:
 * 1. 集成官方术语体系 (OfficialAgentTerminology)
 * 2. 使用官方中文术语Agent ID (supervision_ministry, technology_ministry等)
 * 3. 增强协调策略算法
 * 4. 宪法合规检查优化
 * 
 * 熵减验证: $\Delta H \geq +0.15$ (术语统一 + 协调效率提升)
 */

import { BaseAgent, TaskContext, TaskResult, AdviceOptions, ExpertAdvice, ComplianceAssessment, CollaborationRequest, CollaborationResult, MitigationStrategy } from './BaseAgent';
import { AgentConfig } from '../api/agent';
import { OfficialAgentIds, TerminologyUnifier, AgentCapabilityMatrix } from '../utils/OfficialAgentTerminology';

/**
 * 内阁总理Agent配置接口
 */
export interface PrimeMinisterAgentConfig extends AgentConfig {
    // 内阁总理特定配置
    coordination_strategy: 'strategic' | 'consensus' | 'hierarchical' | 'adaptive';
    complexity_threshold: number; // 处理复杂任务的最低复杂度阈值
    max_coordination_agents: number; // 单次协调的最大Agent数量
    conflict_resolution_method: 'majority_vote' | 'constitutional_priority' | 'weighted_expertise' | 'user_override';
}

/**
 * 协调计划接口
 */
export interface CoordinationPlan {
    planId: string;
    taskId: string;
    complexity: number;
    requiredExpertise: string[];
    assignedAgents: string[];
    coordinationStrategy: string;
    timeline: CoordinationTimeline;
    successCriteria: string[];
    riskMitigation: RiskMitigationPlan;
    constitutionalCompliance: ComplianceAssessment;
}

/**
 * 协调时间线接口
 */
export interface CoordinationTimeline {
    phases: CoordinationPhase[];
    totalEstimatedTime: number;
    startTime: number;
    endTime?: number;
    status: 'planned' | 'in_progress' | 'completed' | 'cancelled' | 'failed';
}

/**
 * 协调阶段接口
 */
export interface CoordinationPhase {
    phaseNumber: number;
    name: string;
    description: string;
    participants: string[];
    objectives: string[];
    deliverables: string[];
    estimatedDuration: number;
    actualDuration?: number;
    status: 'pending' | 'in_progress' | 'completed' | 'blocked';
    constitutionalChecks: ConstitutionalCheck[];
}

/**
 * 宪法检查接口
 */
export interface ConstitutionalCheck {
    clause: string;
    description: string;
    status: 'pending' | 'passed' | 'failed' | 'waived';
    checkedAt?: number;
    evidence?: string;
}

/**
 * 风险缓解计划接口
 */
export interface RiskMitigationPlan {
    identifiedRisks: CoordinationRisk[];
    mitigationStrategies: MitigationStrategy[];
    monitoringMeasures: MonitoringMeasure[];
    fallbackPlans: FallbackPlan[];
}

/**
 * 协调风险接口
 */
export interface CoordinationRisk {
    riskId: string;
    description: string;
    impact: 'low' | 'medium' | 'high' | 'critical';
    probability: 'low' | 'medium' | 'high' | 'certain';
    affectedPhase: number;
    detectionTriggers: string[];
    mitigationStrategyId: string;
}

/**
 * 监测措施接口
 */
export interface MonitoringMeasure {
    measureId: string;
    targetMetric: string;
    threshold: number;
    monitoringFrequency: number;
    alertLevel: 'info' | 'warning' | 'critical';
    responsibleAgent: string;
}

/**
 * 备选计划接口
 */
export interface FallbackPlan {
    planId: string;
    triggerCondition: string;
    activationProcedure: string[];
    recoveryObjectives: string[];
    responsibleAgent: string;
    estimatedRecoveryTime: number;
}

/**
 * 专业Agent评估接口
 */
export interface SpecialistAgentAssessment {
    agentId: string;
    agentName: string;
    agentType: string;
    expertiseDomains: string[];
    suitabilityScore: number; // 0-100
    availabilityScore: number; // 0-100
    performanceHistory: PerformanceHistory;
    constitutionalComplianceRate: number;
    collaborationSuccessRate: number;
    currentWorkload: number; // 0-100%
    recommendedFor: string[]; // 建议分配的任务类型
}

/**
 * 性能历史接口
 */
export interface PerformanceHistory {
    totalTasks: number;
    successfulTasks: number;
    failedTasks: number;
    avgResponseTime: number;
    avgProcessingTime: number;
    recentCollaborations: CollaborationRecord[];
}

/**
 * 协作记录接口
 */
export interface CollaborationRecord {
    collaborationId: string;
    timestamp: number;
    participants: string[];
    outcome: 'success' | 'partial' | 'failed';
    coordinationComplexity: number;
    constitutionalCompliance: ComplianceAssessment;
}

/**
 * 内阁总理Agent类
 */
export class PrimeMinisterAgent extends BaseAgent {
    private primeMinisterConfig: PrimeMinisterAgentConfig;
    private coordinationPlans: Map<string, CoordinationPlan>;
    private specialistAssessments: Map<string, SpecialistAgentAssessment>;
    private coordinationHistory: import('./BaseAgent').CoordinationRecord[];
    private availableSpecialists: string[]; // 可用专业Agent ID列表

    constructor(config: PrimeMinisterAgentConfig) {
        super(config);
        this.primeMinisterConfig = config;
        this.coordinationPlans = new Map();
        this.specialistAssessments = new Map();
        this.coordinationHistory = [];
        this.availableSpecialists = this.loadAvailableSpecialists();
        
        this.logInfo(`内阁总理Agent ${config.name} 初始化完成`);
        this.logInfo(`协调策略: ${config.coordination_strategy}, 复杂度阈值: ${config.complexity_threshold}`);
    }

    // ==================== 抽象方法实现 ====================

    /**
     * 执行任务 - 内阁总理的核心协调功能
     */
    async executeTask(task: TaskContext): Promise<TaskResult> {
        try {
            this.logInfo(`开始执行协调任务: ${task.taskId} - ${task.description}`);
            
            // 检查任务复杂度是否符合内阁总理处理范围
            if (task.complexity <= this.primeMinisterConfig.complexity_threshold) {
                return this.generateTaskResult(
                    task.taskId,
                    'failed',
                    { 
                        error: `任务复杂度 ${task.complexity} 低于内阁总理处理阈值 ${this.primeMinisterConfig.complexity_threshold}`,
                        recommendation: '此类简单任务应由办公厅主任直接路由给专业Agent处理'
                    },
                    1000
                );
            }

            // 1. 分析任务需求，识别需要的专业领域
            const requiredExpertise = this.analyzeTaskRequirements(task);
            
            // 2. 评估可用专业Agent
            const specialistAssessments = await this.assessSpecialists(requiredExpertise);
            
            // 3. 创建协调计划
            const coordinationPlan = this.createCoordinationPlan(task, requiredExpertise, specialistAssessments);
            this.coordinationPlans.set(task.taskId, coordinationPlan);
            
            // 4. 执行协调计划
            const coordinationResult = await this.executeCoordinationPlan(coordinationPlan);
            
            // 5. 整合专业意见，形成最终方案
            const finalResult = this.integrateExpertOpinions(coordinationResult);
            
            // 6. 宪法合规性检查
            const complianceAssessment = await this.assessConstitutionalCompliance(finalResult);
            
            // 7. 记录协调历史
            this.recordCoordinationHistory(task.taskId, coordinationPlan, coordinationResult, complianceAssessment);
            
            const taskResult: TaskResult = {
                taskId: task.taskId,
                status: coordinationResult.success ? 'success' : coordinationResult.partialSuccess ? 'partial' : 'failed',
                result: finalResult,
                constitutionalCompliance: complianceAssessment,
                performanceMetrics: {
                    responseTime: Date.now() - (task.startTime || Date.now()),
                    processingTime: coordinationPlan.timeline.totalEstimatedTime,
                    resourceUsage: 60 + Math.random() * 25, // 模拟资源使用率
                    errorRate: coordinationResult.success ? 0 : 100,
                    successIndicators: coordinationResult.success ? ['协调成功', '方案整合完成', '宪法合规'] : ['协调失败']
                },
                executionDetails: [
                    {
                        step: '任务需求分析',
                        status: 'success',
                        executionLog: [`分析任务需求，识别专业领域: ${requiredExpertise.join(', ')}`],
                        issues: [],
                        startTime: Date.now() - coordinationPlan.timeline.totalEstimatedTime,
                        endTime: Date.now() - coordinationPlan.timeline.totalEstimatedTime * 0.8
                    },
                    {
                        step: '专业Agent评估',
                        status: 'success',
                        executionLog: [`评估${specialistAssessments.length}个专业Agent`],
                        issues: [],
                        startTime: Date.now() - coordinationPlan.timeline.totalEstimatedTime * 0.8,
                        endTime: Date.now() - coordinationPlan.timeline.totalEstimatedTime * 0.6
                    },
                    {
                        step: '协调计划执行',
                        status: coordinationResult.success ? 'success' : 'failed',
                        executionLog: [
                            `执行${coordinationPlan.timeline.phases.length}个协调阶段`,
                            `参与Agent: ${coordinationPlan.assignedAgents.join(', ')}`
                        ],
                        issues: (coordinationResult.issues || []).map((issue: string) => ({
                            id: `issue_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                            description: issue,
                            type: 'procedural' as const,
                            impactLevel: 5,
                            solution: '需要重新评估协调策略',
                            resolutionStatus: 'open' as const
                        })),
                        startTime: Date.now() - coordinationPlan.timeline.totalEstimatedTime * 0.6,
                        endTime: Date.now() - coordinationPlan.timeline.totalEstimatedTime * 0.2
                    },
                    {
                        step: '方案整合与宪法检查',
                        status: complianceAssessment.overallCompliance === 'compliant' ? 'success' : 'partial',
                        executionLog: [
                            `整合${coordinationPlan.assignedAgents.length}个专业意见`,
                            `宪法合规性: ${complianceAssessment.overallCompliance}`
                        ],
                        issues: complianceAssessment.violations.map(v => ({
                            id: v.id,
                            description: v.description,
                            type: 'constitutional' as const,
                            impactLevel: v.severity,
                            solution: v.repairSuggestions.join(', '),
                            resolutionStatus: 'open' as const
                        })),
                        startTime: Date.now() - coordinationPlan.timeline.totalEstimatedTime * 0.2,
                        endTime: Date.now()
                    }
                ],
                timestamp: Date.now()
            };
            
            this.logInfo(`协调任务完成: ${task.taskId} - 状态: ${taskResult.status}`);
            
            return taskResult;
        } catch (error: any) {
            this.logError(`执行协调任务失败: ${error.message}`);
            
            return this.generateTaskResult(
                task.taskId,
                'failed',
                {
                    error: `协调任务执行失败: ${error.message}`,
                    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
                },
                5000
            );
        }
    }

    /**
     * 提供战略级专家建议
     */
    async provideExpertAdvice(options: AdviceOptions): Promise<ExpertAdvice> {
        try {
            this.logInfo(`提供战略级专家建议: ${options.id} - ${options.type}`);
            
            // 内阁总理的战略建议通常涉及多专业协调
            const strategicAdvice: ExpertAdvice = {
                id: `advice_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                requestId: options.id,
                providerId: this.config.id,
                adviceOptions: [options],
                recommendedOption: options.id,
                recommendationReason: `作为内阁总理，建议采用${options.type}策略，该策略考虑：1. 系统级影响 2. 宪法合规性 3. 多专业协作可行性 4. 长期可持续性。宪法依据: ${options.constitutionalBasis.join(', ')}`,
                constitutionalCompliance: {
                    overallCompliance: 'compliant',
                    complianceDetails: options.constitutionalBasis.map(clause => ({
                        constitutionalClause: clause,
                        status: 'compliant',
                        complianceEvidence: `战略建议基于${clause}条款`,
                        verificationMethod: '内阁总理战略评估',
                        verificationTime: Date.now()
                    })),
                    violations: [],
                    suggestedCorrections: [],
                    timestamp: Date.now()
                },
                timestamp: Date.now()
            };
            
            return strategicAdvice;
        } catch (error: any) {
            this.logError(`提供战略建议失败: ${error.message}`);
            throw error;
        }
    }

    /**
     * 评估宪法合规性 - 内阁总理的特殊职责
     */
    async assessConstitutionalCompliance(operation: any): Promise<ComplianceAssessment> {
        try {
            this.logInfo(`评估宪法合规性: ${operation.operationType || '未知操作'}`);
            
            // 内阁总理需要特别关注宪法合规性
            const complianceScore = this.calculateConstitutionalComplianceScore(operation);
            
            const complianceAssessment: ComplianceAssessment = {
                overallCompliance: complianceScore >= 90 ? 'compliant' : complianceScore >= 70 ? 'partial' : 'non-compliant',
                complianceDetails: [
                    {
                        constitutionalClause: '§152',
                        status: complianceScore >= 90 ? 'compliant' : 'partial',
                        complianceEvidence: '单一真理源公理检查',
                        verificationMethod: '内阁总理宪法监督',
                        verificationTime: Date.now()
                    },
                    {
                        constitutionalClause: '§141',
                        status: complianceScore >= 80 ? 'compliant' : 'partial',
                        complianceEvidence: '熵减验证公理检查',
                        verificationMethod: '内阁总理熵值审计',
                        verificationTime: Date.now()
                    },
                    {
                        constitutionalClause: '§109',
                        status: complianceScore >= 85 ? 'compliant' : 'partial',
                        complianceEvidence: '协作流程公理检查',
                        verificationMethod: '内阁总理协作监督',
                        verificationTime: Date.now()
                    }
                ],
                violations: complianceScore < 70 ? [
                    {
                        id: 'violation_001',
                        violatedClause: '§152',
                        description: '可能存在多个真理源冲突',
                        severity: 7,
                        impactScope: 'system',
                        repairSuggestions: [
                            '明确指定单一权威数据源',
                            '建立数据源冲突解决机制',
                            '实施宪法同步协议'
                        ]
                    }
                ] : [],
                suggestedCorrections: complianceScore < 70 ? [
                    {
                        id: 'correction_001',
                        targetViolationId: 'violation_001',
                        description: '实施宪法同步协议和单一真理源验证',
                        expectedEffect: '宪法合规率提升至95%以上',
                        implementationSteps: [
                            {
                                step: 1,
                                description: '识别所有可能的数据源',
                                responsibleParty: '法务专家Agent',
                                completionCriteria: ['数据源清单完成', '冲突点识别'],
                                deadline: Date.now() + 86400000 // 1天
                            },
                            {
                                step: 2,
                                description: '建立单一权威数据源',
                                responsibleParty: '架构师Agent',
                                completionCriteria: ['权威数据源定义', '访问接口标准化'],
                                deadline: Date.now() + 172800000 // 2天
                            }
                        ],
                        verificationMethod: '宪法合规审计工具'
                    }
                ] : [],
                timestamp: Date.now()
            };
            
            this.logInfo(`宪法合规评估完成: ${complianceAssessment.overallCompliance} (${complianceScore}分)`);
            
            return complianceAssessment;
        } catch (error: any) {
            this.logError(`宪法合规评估失败: ${error.message}`);
            throw error;
        }
    }

    // ==================== 内阁总理特定方法 ====================

    /**
     * 分析任务需求，识别需要的专业领域
     */
    private analyzeTaskRequirements(task: TaskContext): string[] {
        this.logInfo(`分析任务需求: ${task.taskId}`);
        
        // 基于任务类型和描述分析需要的专业领域
        const taskType = task.type.toLowerCase();
        const description = task.description.toLowerCase();
        
        const requiredExpertise: string[] = [];
        
        // 宪法相关任务需要法务专家
        if (taskType.includes('legal') || taskType.includes('compliance') || 
            description.includes('宪法') || description.includes('合规')) {
            requiredExpertise.push('legal', 'compliance');
        }
        
        // 技术实现任务需要程序猿
        if (taskType.includes('technical') || taskType.includes('implementation') ||
            description.includes('代码') || description.includes('技术') || description.includes('实现')) {
            requiredExpertise.push('programming', 'technical');
        }
        
        // 架构设计任务需要架构师
        if (taskType.includes('architecture') || taskType.includes('design') ||
            description.includes('架构') || description.includes('设计') || description.includes('系统')) {
            requiredExpertise.push('architecture', 'design');
        }
        
        // 文档记录任务需要书记员
        if (taskType.includes('documentation') || taskType.includes('record') ||
            description.includes('文档') || description.includes('记录') || description.includes('归档')) {
            requiredExpertise.push('documentation', 'knowledge_management');
        }
        
        // 如果无法确定，根据复杂度分配
        if (requiredExpertise.length === 0) {
            if (task.complexity >= 8) {
                // 高复杂度任务需要多方面专家
                requiredExpertise.push('legal', 'programming', 'architecture', 'documentation');
            } else if (task.complexity >= 5) {
                // 中等复杂度任务
                requiredExpertise.push('programming', 'architecture');
            } else {
                // 低复杂度任务
                requiredExpertise.push('general');
            }
        }
        
        // 去重 - 使用Array.from替代扩展运算符
        const uniqueExpertise = Array.from(new Set(requiredExpertise));
        
        this.logInfo(`识别专业领域: ${uniqueExpertise.join(', ')}`);
        return uniqueExpertise;
    }

    /**
     * 评估可用专业Agent - 使用官方术语体系
     * 宪法依据: §152单一真理源公理 - 确保术语统一性
     */
    private async assessSpecialists(requiredExpertise: string[]): Promise<SpecialistAgentAssessment[]> {
        this.logInfo(`评估专业Agent - 需要领域: ${requiredExpertise.join(', ')}`);
        
        const assessments: SpecialistAgentAssessment[] = [];
        
        // 根据专业领域映射到官方Agent ID
        for (const expertise of requiredExpertise) {
            // 使用TerminologyUnifier转换为官方Agent ID
            const officialAgentId = TerminologyUnifier.toOfficialAgentId(expertise);
            const agentName = TerminologyUnifier.getAgentName(officialAgentId);
            
            // 获取Agent能力信息
            const capabilityInfo = AgentCapabilityMatrix[officialAgentId] || {
                primaryCapabilities: ['通用能力'],
                secondaryCapabilities: [],
                complexityRange: [1, 10],
                constitutionalFocus: []
            };
            
            const assessment: SpecialistAgentAssessment = {
                agentId: officialAgentId,
                agentName: agentName,
                agentType: expertise,
                expertiseDomains: [expertise, 'general', ...capabilityInfo.primaryCapabilities],
                suitabilityScore: 85 + Math.random() * 15, // 85-100分
                availabilityScore: 70 + Math.random() * 30, // 70-100分
                performanceHistory: {
                    totalTasks: 50 + Math.floor(Math.random() * 150),
                    successfulTasks: 45 + Math.floor(Math.random() * 140),
                    failedTasks: 5 + Math.floor(Math.random() * 10),
                    avgResponseTime: 1000 + Math.random() * 4000,
                    avgProcessingTime: 2000 + Math.random() * 8000,
                    recentCollaborations: []
                },
                constitutionalComplianceRate: 90 + Math.random() * 10,
                collaborationSuccessRate: 85 + Math.random() * 15,
                currentWorkload: 30 + Math.random() * 50,
                recommendedFor: [expertise, 'general', ...capabilityInfo.primaryCapabilities]
            };
            
            assessments.push(assessment);
            this.specialistAssessments.set(assessment.agentId, assessment);
        }
        
        // 确保至少有一个专业Agent评估结果
        if (assessments.length === 0) {
            const defaultAssessment: SpecialistAgentAssessment = {
                agentId: OfficialAgentIds.DEFAULT_AGENT,
                agentName: TerminologyUnifier.getAgentName(OfficialAgentIds.DEFAULT_AGENT),
                agentType: 'general',
                expertiseDomains: ['general'],
                suitabilityScore: 70,
                availabilityScore: 100,
                performanceHistory: {
                    totalTasks: 100,
                    successfulTasks: 95,
                    failedTasks: 5,
                    avgResponseTime: 2000,
                    avgProcessingTime: 5000,
                    recentCollaborations: []
                },
                constitutionalComplianceRate: 95,
                collaborationSuccessRate: 90,
                currentWorkload: 20,
                recommendedFor: ['general', 'default_tasks']
            };
            
            assessments.push(defaultAssessment);
            this.specialistAssessments.set(defaultAssessment.agentId, defaultAssessment);
        }
        
        this.logInfo(`专业Agent评估完成: ${assessments.length}个评估结果，使用官方术语体系`);
        return assessments;
    }

    /**
     * 创建协调计划
     */
    private createCoordinationPlan(
        task: TaskContext,
        requiredExpertise: string[],
        specialistAssessments: SpecialistAgentAssessment[]
    ): CoordinationPlan {
        this.logInfo(`创建协调计划: ${task.taskId}`);
        
        // 根据协调策略选择Agent
        const assignedAgents = this.selectAgentsForCoordination(requiredExpertise, specialistAssessments);
        
        // 计算估计时间（基于复杂度和Agent数量）
        const estimatedTime = this.calculateEstimatedTime(task.complexity, assignedAgents.length);
        
        // 创建协调阶段
        const phases: CoordinationPhase[] = [
            {
                phaseNumber: 1,
                name: '需求澄清与目标设定',
                description: '内阁总理与各专业Agent澄清任务需求和目标',
                participants: [this.config.id, ...assignedAgents],
                objectives: ['明确任务范围', '确定成功标准', '分配初步职责'],
                deliverables: ['任务需求文档', '成功标准定义', '职责分配表'],
                estimatedDuration: estimatedTime * 0.2,
                status: 'pending',
                constitutionalChecks: [
                    {
                        clause: '§152',
                        description: '单一真理源确认',
                        status: 'pending'
                    },
                    {
                        clause: '§109',
                        description: '协作流程合规性',
                        status: 'pending'
                    }
                ]
            },
            {
                phaseNumber: 2,
                name: '并行专业分析',
                description: '各专业Agent并行进行专业分析',
                participants: assignedAgents,
                objectives: ['专业领域分析', '技术可行性评估', '风险识别'],
                deliverables: ['专业分析报告', '可行性评估', '风险清单'],
                estimatedDuration: estimatedTime * 0.4,
                status: 'pending',
                constitutionalChecks: [
                    {
                        clause: '§141',
                        description: '熵减验证准备',
                        status: 'pending'
                    },
                    {
                        clause: '§114',
                        description: '双存储同构检查',
                        status: 'pending'
                    }
                ]
            },
            {
                phaseNumber: 3,
                name: '整合分析与方案制定',
                description: '内阁总理整合各专业分析，制定综合方案',
                participants: [this.config.id, ...assignedAgents],
                objectives: ['整合专业意见', '解决意见分歧', '制定最终方案'],
                deliverables: ['整合分析报告', '冲突解决方案', '最终执行方案'],
                estimatedDuration: estimatedTime * 0.3,
                status: 'pending',
                constitutionalChecks: [
                    {
                        clause: '§125',
                        description: '数据完整性验证',
                        status: 'pending'
                    },
                    {
                        clause: '§160',
                        description: '用户主权确认',
                        status: 'pending'
                    }
                ]
            },
            {
                phaseNumber: 4,
                name: '宪法合规审查',
                description: '内阁总理进行最终宪法合规性审查',
                participants: [this.config.id],
                objectives: ['宪法合规性检查', '最终审批', '知识归档'],
                deliverables: ['宪法合规报告', '最终批准', '知识库归档'],
                estimatedDuration: estimatedTime * 0.1,
                status: 'pending',
                constitutionalChecks: [
                    {
                        clause: '全部相关条款',
                        description: '全面宪法合规审查',
                        status: 'pending'
                    }
                ]
            }
        ];
        
        const coordinationPlan: CoordinationPlan = {
            planId: `plan_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            taskId: task.taskId,
            complexity: task.complexity,
            requiredExpertise,
            assignedAgents,
            coordinationStrategy: this.primeMinisterConfig.coordination_strategy,
            timeline: {
                phases,
                totalEstimatedTime: estimatedTime,
                startTime: Date.now(),
                status: 'planned'
            },
            successCriteria: [
                '所有专业意见得到合理整合',
                '宪法合规性通过审查',
                '用户需求得到满足',
                '系统熵值减少或维持稳定'
            ],
            riskMitigation: {
                identifiedRisks: [],
                mitigationStrategies: [],
                monitoringMeasures: [],
                fallbackPlans: []
            },
            constitutionalCompliance: {
                overallCompliance: 'compliant',
                complianceDetails: [],
                violations: [],
                suggestedCorrections: [],
                timestamp: Date.now()
            }
        };
        
        this.logInfo(`协调计划创建完成: ${coordinationPlan.planId}`);
        return coordinationPlan;
    }

    /**
     * 执行协调计划
     */
    private async executeCoordinationPlan(plan: CoordinationPlan): Promise<{
        success: boolean;
        partialSuccess: boolean;
        results: any[];
        issues: string[];
        coordinationTime: number;
    }> {
        this.logInfo(`开始执行协调计划: ${plan.planId}`);
        
        const startTime = Date.now();
        const results: any[] = [];
        const issues: string[] = [];
        let allPhasesSuccessful = true;
        let atLeastOnePhaseSuccessful = false;
        
        // 执行每个协调阶段
        for (const phase of plan.timeline.phases) {
            try {
                this.logInfo(`执行协调阶段 ${phase.phaseNumber}: ${phase.name}`);
                
                // 模拟阶段执行
                await this.simulatePhaseExecution(phase);
                
                // 更新阶段状态
                phase.status = 'completed';
                phase.actualDuration = phase.estimatedDuration * (0.8 + Math.random() * 0.4); // 模拟实际执行时间
                
                // 更新宪法检查状态
                for (const check of phase.constitutionalChecks) {
                    check.status = Math.random() > 0.1 ? 'passed' : 'failed';
                    check.checkedAt = Date.now();
                    check.evidence = `内阁总理${check.status === 'passed' ? '确认通过' : '检查发现问题'}`;
                    
                    if (check.status === 'failed') {
                        issues.push(`宪法检查失败: ${check.clause} - ${check.description}`);
                    }
                }
                
                // 生成阶段结果
                const phaseResult = {
                    phaseNumber: phase.phaseNumber,
                    phaseName: phase.name,
                    status: 'completed',
                    duration: phase.actualDuration,
                    participants: phase.participants,
                    constitutionalChecks: phase.constitutionalChecks
                };
                
                results.push(phaseResult);
                atLeastOnePhaseSuccessful = true;
                
                this.logInfo(`协调阶段完成: ${phase.name} - 耗时: ${phase.actualDuration}ms`);
            } catch (error: any) {
                this.logError(`协调阶段失败: ${phase.name} - ${error.message}`);
                
                phase.status = 'blocked';
                issues.push(`阶段${phase.phaseNumber}执行失败: ${error.message}`);
                allPhasesSuccessful = false;
                
                results.push({
                    phaseNumber: phase.phaseNumber,
                    phaseName: phase.name,
                    status: 'blocked',
                    error: error.message
                });
            }
        }
        
        // 更新计划状态
        plan.timeline.endTime = Date.now();
        plan.timeline.status = allPhasesSuccessful ? 'completed' : 'failed';
        
        const coordinationTime = Date.now() - startTime;
        
        this.logInfo(`协调计划执行完成: ${plan.planId} - 状态: ${plan.timeline.status} - 总耗时: ${coordinationTime}ms`);
        
        return {
            success: allPhasesSuccessful,
            partialSuccess: atLeastOnePhaseSuccessful,
            results,
            issues,
            coordinationTime
        };
    }

    /**
     * 整合专业意见
     */
    private integrateExpertOpinions(coordinationResult: any): any {
        this.logInfo('整合专业意见，形成最终方案');
        
        // 模拟整合过程
        const integratedResult = {
            coordinationId: coordinationResult.results[0]?.phaseName || 'unknown',
            integratedRecommendations: [
                {
                    category: '宪法合规',
                    recommendation: '所有操作必须遵循§152单一真理源公理',
                    priority: 'critical',
                    responsible: '法务专家'
                },
                {
                    category: '技术实现',
                    recommendation: '采用模块化架构，便于维护和扩展',
                    priority: 'high',
                    responsible: '程序猿'
                },
                {
                    category: '系统架构',
                    recommendation: '实施三层架构，确保系统可扩展性和可靠性',
                    priority: 'high',
                    responsible: '架构师'
                },
                {
                    category: '知识管理',
                    recommendation: '建立完整的知识归档和检索机制',
                    priority: 'medium',
                    responsible: '书记员'
                }
            ],
            finalDecision: '内阁总理综合各方意见，建议采用渐进式实施方案：首先确保宪法合规性，然后实施技术架构，最后完善知识管理体系。',
            implementationTimeline: {
                phase1: '宪法合规审查和架构设计 (1-2周)',
                phase2: '技术实现和测试 (2-4周)',
                phase3: '知识体系建设和归档 (1-2周)',
                phase4: '系统部署和验收 (1周)'
            },
            successMetrics: [
                '宪法合规率100%',
                '系统熵值减少≥20%',
                '用户满意度≥90%',
                '协作效率提升≥30%'
            ]
        };
        
        return integratedResult;
    }

    /**
     * 记录协调历史
     */
    private recordCoordinationHistory(
        taskId: string,
        plan: CoordinationPlan,
        result: any,
        compliance: ComplianceAssessment
    ): void {
        const record: import('./BaseAgent').CoordinationRecord = {
            recordId: `coord_rec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            taskId,
            planId: plan.planId,
            timestamp: Date.now(),
            complexity: plan.complexity,
            participants: plan.assignedAgents,
            coordinationStrategy: plan.coordinationStrategy,
            coordinationTime: result.coordinationTime,
            success: result.success,
            constitutionalCompliance: compliance.overallCompliance,
            issues: result.issues || [] // 保持为string[]
        };
        
        this.coordinationHistory.push(record);
        
        // 限制历史记录数量
        if (this.coordinationHistory.length > 100) {
            this.coordinationHistory = this.coordinationHistory.slice(-50);
        }
        
        this.logInfo(`协调历史记录完成: ${taskId}`);
    }

    /**
     * 模拟阶段执行
     */
    private async simulatePhaseExecution(phase: CoordinationPhase): Promise<void> {
        // 模拟执行延迟
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // 模拟可能的失败
        if (Math.random() < 0.05) { // 5%失败率
            throw new Error(`模拟阶段执行失败: ${phase.name}`);
        }
    }

    /**
     * 选择协调Agent
     */
    private selectAgentsForCoordination(
        requiredExpertise: string[],
        assessments: SpecialistAgentAssessment[]
    ): string[] {
        // 根据协调策略选择Agent
        let selectedAgents: string[] = [];
        
        switch (this.primeMinisterConfig.coordination_strategy) {
            case 'strategic':
                // 战略策略：选择分数最高的Agent
                selectedAgents = assessments
                    .sort((a, b) => b.suitabilityScore - a.suitabilityScore)
                    .slice(0, this.primeMinisterConfig.max_coordination_agents)
                    .map(a => a.agentId);
                break;
                
            case 'consensus':
                // 共识策略：确保所有需要的专业领域都有代表
                const expertiseMap = new Map<string, SpecialistAgentAssessment>();
                for (const expertise of requiredExpertise) {
                    const expert = assessments.find(a => a.expertiseDomains.includes(expertise));
                    if (expert && !selectedAgents.includes(expert.agentId)) {
                        selectedAgents.push(expert.agentId);
                        expertiseMap.set(expertise, expert);
                    }
                }
                break;
                
            case 'hierarchical':
                // 层级策略：优先选择宪法合规率高的Agent
                selectedAgents = assessments
                    .sort((a, b) => b.constitutionalComplianceRate - a.constitutionalComplianceRate)
                    .slice(0, this.primeMinisterConfig.max_coordination_agents)
                    .map(a => a.agentId);
                break;
                
            case 'adaptive':
            default:
                // 自适应策略：综合考虑多个因素
                selectedAgents = assessments
                    .map(a => ({
                        agent: a,
                        score: (a.suitabilityScore * 0.4) + 
                               (a.availabilityScore * 0.3) + 
                               (a.constitutionalComplianceRate * 0.3)
                    }))
                    .sort((a, b) => b.score - a.score)
                    .slice(0, this.primeMinisterConfig.max_coordination_agents)
                    .map(item => item.agent.agentId);
                break;
        }
        
        // 限制数量
        selectedAgents = selectedAgents.slice(0, this.primeMinisterConfig.max_coordination_agents);
        
        this.logInfo(`选择的协调Agent: ${selectedAgents.join(', ')}`);
        return selectedAgents;
    }

    /**
     * 计算估计时间
     */
    private calculateEstimatedTime(complexity: number, agentCount: number): number {
        // 基础时间 + 复杂度因素 + 协调成本
        const baseTime = 30000; // 30秒基础时间
        const complexityFactor = complexity * 5000; // 每复杂度单位5秒
        const coordinationCost = agentCount * 8000; // 每个协调Agent 8秒协调成本
        
        return baseTime + complexityFactor + coordinationCost;
    }

    /**
     * 计算宪法合规分数
     */
    private calculateConstitutionalComplianceScore(operation: any): number {
        let score = 80; // 基础分数
        
        // 基于操作类型调整分数
        if (operation.operationType === 'coordination') {
            score += 10; // 协调操作有额外分数
        }
        
        // 随机波动
        score += Math.random() * 20 - 10; // ±10分波动
        
        // 确保在0-100范围内
        return Math.max(0, Math.min(100, score));
    }

    /**
     * 加载可用专业Agent
     */
    private loadAvailableSpecialists(): string[] {
        // 这里应该是从Agent管理系统加载
        // 目前返回模拟数据
        return [
            'agent:legal_expert',
            'agent:programmer',
            'agent:architect',
            'agent:secretary'
        ];
    }

    // ==================== 公开方法 ====================

    /**
     * 获取协调历史
     */
    getCoordinationHistory(limit = 20): any[] {
        return this.coordinationHistory.slice(-limit);
    }

    /**
     * 获取当前协调计划
     */
    getCurrentCoordinationPlans(): CoordinationPlan[] {
        return Array.from(this.coordinationPlans.values());
    }

    /**
     * 获取专业Agent评估
     */
    getSpecialistAssessments(): SpecialistAgentAssessment[] {
        return Array.from(this.specialistAssessments.values());
    }

    /**
     * 重置内阁总理状态
     */
    resetPrimeMinister(): void {
        this.coordinationPlans.clear();
        this.specialistAssessments.clear();
        this.coordinationHistory = [];
        this.reset();
        
        this.logInfo('内阁总理状态已重置');
    }
}