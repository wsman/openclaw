/**
 * Agent基类抽象定义
 * 
 * 宪法依据: §110协作效率公理、§109协作流程公理、§130 MCP微内核神圣公理
 * 版本: v1.0.0
 * 状态: 🟢 活跃
 */

import { AgentConfig } from '../api/agent';
import { logger } from '../utils/logger';

/**
 * 任务上下文接口
 */
export interface TaskContext {
    /** 任务ID */
    taskId: string;
    
    /** 任务描述 */
    description: string;
    
    /** 任务复杂度 (1-10) */
    complexity: number;
    
    /** 任务类型 */
    type: string;
    
    /** 输入数据 */
    input: any;
    
    /** 上下文元数据 */
    metadata: Record<string, any>;
    
    /** 宪法约束 */
    constitutionalConstraints?: string[];
    
    /** 协作历史 */
    collaborationHistory?: CollaborationRecord[];
    
    /** 开始时间 */
    startTime?: number;
    
    /** 完成时间 */
    completionTime?: number;
}

/**
 * 任务结果接口
 */
export interface TaskResult {
    /** 任务ID */
    taskId: string;
    
    /** 执行状态 */
    status: 'success' | 'partial' | 'failed' | 'cancelled';
    
    /** 执行结果 */
    result: any;
    
    /** 宪法合规性 */
    constitutionalCompliance: ComplianceAssessment;
    
    /** 性能指标 */
    performanceMetrics: PerformanceMetrics;
    
    /** 执行详情 */
    executionDetails: ExecutionDetail[];
    
    /** 完成时间戳 */
    timestamp: number;
}

/**
 * 协作请求接口
 */
export interface CollaborationRequest {
    /** 请求ID */
    requestId: string;
    
    /** 请求方Agent ID */
    requesterId: string;
    
    /** 协作目标 */
    collaborationGoal: string;
    
    /** 需要的专家领域 */
    requiredExpertise: string[];
    
    /** 输入数据 */
    inputData: any;
    
    /** 优先级 (1-10) */
    priority: number;
    
    /** 截止时间 (ms) */
    deadline?: number;
    
    /** 宪法依据 */
    constitutionalBasis?: string[];
}

/**
 * 协作结果接口
 */
export interface CollaborationResult {
    /** 协作ID */
    collaborationId: string;
    
    /** 参与方列表 */
    participants: string[];
    
    /** 协作结果 */
    result: any;
    
    /** 宪法合规性 */
    constitutionalCompliance: ComplianceAssessment;
    
    /** 协作指标 */
    collaborationMetrics: CollaborationMetrics;
    
    /** 完成时间戳 */
    timestamp: number;
}

/**
 * 合规评估接口
 */
export interface ComplianceAssessment {
    /** 总体合规性 */
    overallCompliance: 'compliant' | 'partial' | 'non-compliant';
    
    /** 合规详情 */
    complianceDetails: ComplianceDetail[];
    
    /** 违规项 */
    violations: ComplianceViolation[];
    
    /** 建议修正 */
    suggestedCorrections: CorrectionSuggestion[];
    
    /** 评估时间戳 */
    timestamp: number;
}

/**
 * 合规详情接口
 */
export interface ComplianceDetail {
    /** 宪法条款 */
    constitutionalClause: string;
    
    /** 合规状态 */
    status: 'compliant' | 'partial' | 'non-compliant';
    
    /** 合规证据 */
    complianceEvidence: string;
    
    /** 验证方法 */
    verificationMethod: string;
    
    /** 验证时间 */
    verificationTime: number;
}

/**
 * 性能指标接口
 */
export interface PerformanceMetrics {
    /** 响应时间 (ms) */
    responseTime: number;
    
    /** 处理时间 (ms) */
    processingTime: number;
    
    /** 资源使用率 (%) */
    resourceUsage: number;
    
    /** 错误率 (%) */
    errorRate: number;
    
    /** 成功指标 */
    successIndicators: string[];
}

/**
 * 执行详情接口
 */
export interface ExecutionDetail {
    /** 执行步骤 */
    step: string;
    
    /** 执行状态 */
    status: 'success' | 'partial' | 'failed' | 'skipped';
    
    /** 执行日志 */
    executionLog: string[];
    
    /** 问题记录 */
    issues: IssueRecord[];
    
    /** 开始时间 */
    startTime: number;
    
    /** 结束时间 */
    endTime: number;
}

/**
 * 问题记录接口
 */
export interface IssueRecord {
    /** 问题ID */
    id: string;
    
    /** 问题描述 */
    description: string;
    
    /** 问题类型 */
    type: 'technical' | 'procedural' | 'resource' | 'constitutional';
    
    /** 影响程度 (1-10) */
    impactLevel: number;
    
    /** 解决方案 */
    solution: string;
    
    /** 解决状态 */
    resolutionStatus: 'open' | 'in-progress' | 'resolved' | 'closed';
}

/**
 * 协作指标接口
 */
export interface CollaborationMetrics {
    /** 协作时间 (ms) */
    collaborationTime: number;
    
    /** 协作效率 (%) */
    collaborationEfficiency: number;
    
    /** 共识达成度 */
    consensusAchievement: number;
    
    /** 信息交换量 */
    informationExchange: number;
    
    /** 协作满意度 */
    collaborationSatisfaction: number;
}

/**
 * 合规违规接口
 */
export interface ComplianceViolation {
    /** 违规ID */
    id: string;
    
    /** 违规条款 */
    violatedClause: string;
    
    /** 违规描述 */
    description: string;
    
    /** 严重程度 (1-10) */
    severity: number;
    
    /** 影响范围 */
    impactScope: 'local' | 'system' | 'constitutional';
    
    /** 修复建议 */
    repairSuggestions: string[];
}

/**
 * 修正建议接口
 */
export interface CorrectionSuggestion {
    /** 建议ID */
    id: string;
    
    /** 目标违规 */
    targetViolationId: string;
    
    /** 修正描述 */
    description: string;
    
    /** 预期效果 */
    expectedEffect: string;
    
    /** 实施步骤 */
    implementationSteps: ImplementationStep[];
    
    /** 验证方法 */
    verificationMethod: string;
}

/**
 * 实施步骤接口
 */
export interface ImplementationStep {
    /** 步骤序号 */
    step: number;
    
    /** 步骤描述 */
    description: string;
    
    /** 责任方 */
    responsibleParty: string;
    
    /** 完成标准 */
    completionCriteria: string[];
    
    /** 截止时间 */
    deadline: number;
}

/**
 * 执行步骤接口
 */
export interface ExecutionStep {
    /** 步骤序号 */
    step: number;
    
    /** 步骤描述 */
    description: string;
    
    /** 执行条件 */
    executionConditions: string[];
    
    /** 执行方法 */
    executionMethod: string;
    
    /** 验证标准 */
    verificationCriteria: string[];
    
    /** 预计时间 (ms) */
    estimatedTime: number;
}

/**
 * 回滚计划接口
 */
export interface RollbackPlan {
    /** 计划ID */
    id: string;
    
    /** 回滚目标状态 */
    targetState: string;
    
    /** 回滚步骤 */
    rollbackSteps: ExecutionStep[];
    
    /** 数据备份策略 */
    backupStrategy: string;
    
    /** 回滚验证 */
    rollbackVerification: string;
    
    /** 回滚后恢复策略 */
    recoveryStrategy: string;
}

/**
 * 协作记录接口
 */
export interface CollaborationRecord {
    /** 记录ID */
    recordId: string;
    
    /** 协作类型 */
    collaborationType: string;
    
    /** 参与方 */
    participants: string[];
    
    /** 协作内容 */
    collaborationContent: string;
    
    /** 协作结果 */
    collaborationResult: string;
    
    /** 宪法合规性 */
    constitutionalCompliance: ComplianceAssessment;
    
    /** 记录时间 */
    timestamp: number;
}

/**
 * 专家建议选项接口
 */
export interface AdviceOptions {
    /** 建议ID */
    id: string;
    
    /** 建议类型 */
    type: 'technical' | 'procedural' | 'strategic' | 'constitutional';
    
    /** 建议内容 */
    content: string;
    
    /** 宪法依据 */
    constitutionalBasis: string[];
    
    /** 实施优先级 (1-10) */
    implementationPriority: number;
    
    /** 预期效果 */
    expectedEffect: string;
    
    /** 风险评估 */
    riskAssessment: RiskAssessment;
}

/**
 * 专家建议接口
 */
export interface ExpertAdvice {
    /** 建议ID */
    id: string;
    
    /** 请求ID */
    requestId: string;
    
    /** 提供方Agent ID */
    providerId: string;
    
    /** 建议选项列表 */
    adviceOptions: AdviceOptions[];
    
    /** 推荐选项 */
    recommendedOption: string;
    
    /** 推荐理由 */
    recommendationReason: string;
    
    /** 宪法合规性 */
    constitutionalCompliance: ComplianceAssessment;
    
    /** 提供时间 */
    timestamp: number;
}

/**
 * Agent指标接口
 */
export interface AgentMetrics {
    /** Agent ID */
    agentId: string;
    
    /** 任务总数 */
    totalTasks: number;
    
    /** 成功任务数 */
    successfulTasks: number;
    
    /** 失败任务数 */
    failedTasks: number;
    
    /** 平均响应时间 (ms) */
    avgResponseTime: number;
    
    /** 平均处理时间 (ms) */
    avgProcessingTime: number;
    
    /** 资源使用率 (%) */
    resourceUtilization: number;
    
    /** 宪法合规率 (%) */
    constitutionalComplianceRate: number;
    
    /** 协作次数 */
    collaborationCount: number;
    
    /** 协作成功率 (%) */
    collaborationSuccessRate: number;
    
    /** 监控时间段 */
    monitoringPeriod: TimeRange;
}

/**
 * 时间范围接口
 */
export interface TimeRange {
    /** 开始时间 */
    start: number;
    
    /** 结束时间 */
    end: number;
    
    /** 时区 */
    timezone: string;
}

/**
 * 风险评估接口
 */
export interface RiskAssessment {
    /** 总体风险等级 (1-10) */
    overallRisk: number;
    
    /** 识别风险 */
    identifiedRisks: IdentifiedRisk[];
    
    /** 缓解策略 */
    mitigationStrategies: MitigationStrategy[];
    
    /** 监控指标 */
    monitoringMetrics: MonitoringMetric[];
    
    /** 应急预案 */
    contingencyPlans: ContingencyPlan[];
}

/**
 * 识别风险接口
 */
export interface IdentifiedRisk {
    /** 风险ID */
    id: string;
    
    /** 风险描述 */
    description: string;
    
    /** 风险类别 */
    category: 'technical' | 'organizational' | 'constitutional' | 'resource';
    
    /** 概率 (0-1) */
    probability: number;
    
    /** 影响 (1-10) */
    impact: number;
    
    /** 风险值 (概率×影响) */
    riskValue: number;
    
    /** 触发条件 */
    triggerConditions: string[];
}

/**
 * 缓解策略接口
 */
export interface MitigationStrategy {
    /** 策略ID */
    id: string;
    
    /** 策略描述 */
    description: string;
    
    /** 目标风险 */
    targetRiskId: string;
    
    /** 预期效果 (风险降低百分比) */
    expectedEffectiveness: number;
    
    /** 实施成本 (1-10) */
    implementationCost: number;
    
    /** 实施时间 (ms) */
    implementationTime: number;
}

/**
 * 协调记录接口
 */
export interface CoordinationRecord {
    /** 记录ID */
    recordId: string;
    
    /** 任务ID */
    taskId: string;
    
    /** 计划ID */
    planId: string;
    
    /** 时间戳 */
    timestamp: number;
    
    /** 复杂度 */
    complexity: number;
    
    /** 参与方 */
    participants: string[];
    
    /** 协调策略 */
    coordinationStrategy: string;
    
    /** 协调时间 */
    coordinationTime: number;
    
    /** 成功状态 */
    success: boolean;
    
    /** 宪法合规性 */
    constitutionalCompliance: string;
    
    /** 问题列表 */
    issues: string[];
}

/**
 * 监控指标接口
 */
export interface MonitoringMetric {
    /** 指标ID */
    id: string;
    
    /** 指标名称 */
    name: string;
    
    /** 指标类型 */
    type: 'performance' | 'error' | 'resource' | 'constitutional';
    
    /** 阈值 */
    threshold: number;
    
    /** 监控频率 (ms) */
    monitoringFrequency: number;
    
    /** 告警级别 */
    alertLevel: 'info' | 'warning' | 'critical';
}

/**
 * 应急预案接口
 */
export interface ContingencyPlan {
    /** 计划ID */
    id: string;
    
    /** 适用场景 */
    scenario: string;
    
    /** 触发条件 */
    triggerConditions: string[];
    
    /** 执行步骤 */
    executionSteps: ExecutionStep[];
    
    /** 预期恢复时间 (ms) */
    expectedRecoveryTime: number;
    
    /** 回滚机制 */
    rollbackMechanism: RollbackPlan;
}

/**
 * Agent日志条目接口
 */
export interface AgentLogEntry {
    /** 日志ID */
    logId: string;
    
    /** Agent ID */
    agentId: string;
    
    /** 日志级别 */
    level: 'debug' | 'info' | 'warning' | 'error' | 'critical';
    
    /** 日志消息 */
    message: string;
    
    /** 日志详情 */
    details: Record<string, any>;
    
    /** 时间戳 */
    timestamp: number;
    
    /** 关联任务ID */
    taskId?: string;
    
    /** 宪法条款 */
    constitutionalClause?: string;
}

/**
 * 抽象Agent基类
 */
export abstract class BaseAgent {
    // Agent配置信息
    protected config: AgentConfig;
    
    // Agent状态
    protected status: 'idle' | 'busy' | 'maintenance' | 'error';
    
    // Agent健康度 (0-100)
    protected health: number;
    
    // 当前任务列表
    protected currentTasks: Map<string, TaskContext>;
    
    // 任务历史记录
    protected taskHistory: TaskResult[];
    
    // 协作历史记录
    protected collaborationHistory: CollaborationRecord[];
    
    // Agent指标
    protected metrics: AgentMetrics;
    
    // Agent日志
    protected logs: AgentLogEntry[];
    
    /**
     * 构造函数
     * @param config Agent配置
     */
    constructor(config: AgentConfig) {
        this.config = config;
        this.status = 'idle';
        this.health = 100;
        this.currentTasks = new Map();
        this.taskHistory = [];
        this.collaborationHistory = [];
        this.logs = [];
        
        // 初始化指标
        this.metrics = {
            agentId: config.id,
            totalTasks: 0,
            successfulTasks: 0,
            failedTasks: 0,
            avgResponseTime: 0,
            avgProcessingTime: 0,
            resourceUtilization: 0,
            constitutionalComplianceRate: 100,
            collaborationCount: 0,
            collaborationSuccessRate: 100,
            monitoringPeriod: {
                start: Date.now(),
                end: Date.now(),
                timezone: 'Asia/Shanghai'
            }
        };
        
        this.logInfo(`Agent ${config.name} 初始化完成`);
    }
    
    // ==================== 抽象方法 ====================
    
    /**
     * 执行任务 (抽象方法)
     * @param task 任务上下文
     * @returns 任务结果
     */
    abstract executeTask(task: TaskContext): Promise<TaskResult>;
    
    /**
     * 提供专家建议 (抽象方法)
     * @param options 建议选项
     * @returns 专家建议
     */
    abstract provideExpertAdvice(options: AdviceOptions): Promise<ExpertAdvice>;
    
    /**
     * 评估宪法合规性 (抽象方法)
     * @param operation 待评估操作
     * @returns 合规评估结果
     */
    abstract assessConstitutionalCompliance(operation: any): Promise<ComplianceAssessment>;
    
    // ==================== 通用方法 ====================
    
    /**
     * 接收任务
     * @param task 任务上下文
     * @returns 任务接收结果
     */
    async receiveTask(task: TaskContext): Promise<{ success: boolean; message: string }> {
        try {
            // 检查Agent状态
            if (this.status === 'maintenance' || this.status === 'error') {
                return {
                    success: false,
                    message: `Agent ${this.config.name} 当前状态为 ${this.status}，无法接收新任务`
                };
            }
            
            // 检查Agent负载
            if (this.currentTasks.size >= 10) {
                return {
                    success: false,
                    message: `Agent ${this.config.name} 当前负载过高，已处理任务数: ${this.currentTasks.size}`
                };
            }
            
            // 检查任务复杂度是否在Agent能力范围内
            if (task.complexity > 10) {
                return {
                    success: false,
                    message: `任务复杂度 ${task.complexity} 超出Agent能力范围`
                };
            }
            
            // 记录任务
            task.startTime = Date.now();
            this.currentTasks.set(task.taskId, task);
            this.status = 'busy';
            
            this.logInfo(`接收新任务: ${task.taskId} - ${task.description}`);
            this.logDebug(`任务详情: 复杂度=${task.complexity}, 类型=${task.type}`);
            
            return {
                success: true,
                message: `任务 ${task.taskId} 已接收，开始处理`
            };
        } catch (error: any) {
            this.logError(`接收任务失败: ${error.message}`);
            return {
                success: false,
                message: `接收任务失败: ${error.message}`
            };
        }
    }
    
    /**
     * 完成任务
     * @param taskResult 任务结果
     */
    async completeTask(taskResult: TaskResult): Promise<void> {
        try {
            // 从当前任务列表中移除
            const task = this.currentTasks.get(taskResult.taskId);
            if (task) {
                this.currentTasks.delete(taskResult.taskId);
                taskResult.timestamp = Date.now();
                
                // 计算任务执行时间
                const executionTime = Date.now() - (task.startTime || Date.now());
                
                // 更新指标
                this.metrics.totalTasks++;
                if (taskResult.status === 'success') {
                    this.metrics.successfulTasks++;
                } else {
                    this.metrics.failedTasks++;
                }
                
                // 更新平均响应时间和处理时间
                this.updateMetrics(taskResult, executionTime);
                
                // 添加到历史记录
                this.taskHistory.push(taskResult);
                
                // 检查是否需要切换回空闲状态
                if (this.currentTasks.size === 0) {
                    this.status = 'idle';
                }
                
                this.logInfo(`完成任务: ${taskResult.taskId} - 状态: ${taskResult.status}`);
                this.logDebug(`任务执行时间: ${executionTime}ms, 结果: ${JSON.stringify(taskResult.result).substring(0, 200)}...`);
            }
        } catch (error: any) {
            this.logError(`完成任务处理失败: ${error.message}`);
        }
    }
    
    /**
     * 请求协作
     * @param request 协作请求
     * @returns 协作结果
     */
    async requestCollaboration(request: CollaborationRequest): Promise<CollaborationResult> {
        try {
            // 检查Agent是否可以发起协作
            if (!this.config.collaboration_rules.can_initiate_collaboration) {
                throw new Error(`Agent ${this.config.name} 无权发起协作请求`);
            }
            
            this.logInfo(`发起协作请求: ${request.requestId} - 目标: ${request.collaborationGoal}`);
            
            // 这里应该是调用协调者Agent进行协作
            // 目前先返回模拟结果
            const collaborationId = `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            const collaborationResult: CollaborationResult = {
                collaborationId,
                participants: [this.config.id, ...request.requiredExpertise.map(e => `agent:${e}`)],
                result: {
                    success: true,
                    collaboration: request.collaborationGoal,
                    contributions: request.requiredExpertise.map(e => ({
                        agent: `agent:${e}`,
                        contribution: `为协作目标提供${e}领域专业知识`
                    }))
                },
                constitutionalCompliance: {
                    overallCompliance: 'compliant',
                    complianceDetails: [],
                    violations: [],
                    suggestedCorrections: [],
                    timestamp: Date.now()
                },
                collaborationMetrics: {
                    collaborationTime: 5000,
                    collaborationEfficiency: 85,
                    consensusAchievement: 90,
                    informationExchange: 75,
                    collaborationSatisfaction: 88
                },
                timestamp: Date.now()
            };
            
            // 记录协作历史
            const collaborationRecord: CollaborationRecord = {
                recordId: collaborationId,
                collaborationType: 'expert_collaboration',
                participants: collaborationResult.participants,
                collaborationContent: request.collaborationGoal,
                collaborationResult: '协作成功完成',
                constitutionalCompliance: collaborationResult.constitutionalCompliance,
                timestamp: Date.now()
            };
            
            this.collaborationHistory.push(collaborationRecord);
            this.metrics.collaborationCount++;
            
            this.logInfo(`协作请求完成: ${collaborationId}`);
            
            return collaborationResult;
        } catch (error: any) {
            this.logError(`协作请求失败: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * 响应协作请求
     * @param request 协作请求
     * @returns 协作响应
     */
    async respondToCollaboration(request: CollaborationRequest): Promise<{ accepted: boolean; message: string; expertise: string[] }> {
        try {
            // 检查Agent是否具备所需专业领域
            const availableExpertise = this.config.collaboration_rules.expertise_domains.filter(
                (expertise: string) => request.requiredExpertise.includes(expertise)
            );
            
            if (availableExpertise.length === 0) {
                this.logInfo(`拒绝协作请求 ${request.requestId}: 没有匹配的专业领域`);
                return {
                    accepted: false,
                    message: `Agent ${this.config.name} 不具备所需专业领域`,
                    expertise: []
                };
            }
            
            // 检查Agent当前负载
            if (this.currentTasks.size >= 5) {
                this.logInfo(`拒绝协作请求 ${request.requestId}: 当前负载过高`);
                return {
                    accepted: false,
                    message: `Agent ${this.config.name} 当前负载过高，无法参与协作`,
                    expertise: []
                };
            }
            
            this.logInfo(`接受协作请求: ${request.requestId} - 提供专业领域: ${availableExpertise.join(', ')}`);
            
            return {
                accepted: true,
                message: `Agent ${this.config.name} 接受协作请求`,
                expertise: availableExpertise
            };
        } catch (error: any) {
            this.logError(`处理协作响应失败: ${error.message}`);
            return {
                accepted: false,
                message: `处理协作响应失败: ${error.message}`,
                expertise: []
            };
        }
    }
    
    /**
     * 获取Agent状态
     * @returns Agent状态信息
     */
    getStatus(): {
        id: string;
        name: string;
        type: string;
        status: string;
        health: number;
        currentTasks: number;
        totalTasks: number;
        successfulTasks: number;
        collaborationCount: number;
    } {
        return {
            id: this.config.id,
            name: this.config.name,
            type: this.config.type,
            status: this.status,
            health: this.health,
            currentTasks: this.currentTasks.size,
            totalTasks: this.metrics.totalTasks,
            successfulTasks: this.metrics.successfulTasks,
            collaborationCount: this.metrics.collaborationCount
        };
    }
    
    /**
     * 获取Agent指标
     * @returns Agent指标数据
     */
    getMetrics(): AgentMetrics {
        return {
            ...this.metrics,
            monitoringPeriod: {
                ...this.metrics.monitoringPeriod,
                end: Date.now()
            }
        };
    }
    
    /**
     * 获取Agent日志
     * @param limit 日志数量限制
     * @returns Agent日志列表
     */
    getLogs(limit = 100): AgentLogEntry[] {
        return this.logs.slice(-limit);
    }
    
    /**
     * 更新Agent健康度
     * @param healthChange 健康度变化值 (-100 到 100)
     */
    updateHealth(healthChange: number): void {
        const newHealth = this.health + healthChange;
        this.health = Math.max(0, Math.min(100, newHealth));
        
        // 根据健康度调整状态
        if (this.health < 30) {
            this.status = 'error';
            this.logError(`Agent健康度严重下降: ${this.health}%`);
        } else if (this.health < 70) {
            this.status = 'maintenance';
            this.logWarning(`Agent健康度下降: ${this.health}%，进入维护状态`);
        }
    }
    
    /**
     * 重置Agent状态
     */
    reset(): void {
        this.currentTasks.clear();
        this.status = 'idle';
        this.health = 100;
        this.logInfo(`Agent状态已重置`);
    }
    
    /**
     * 获取Agent配置
     * @returns Agent配置信息
     */
    getConfig(): AgentConfig {
        return { ...this.config };
    }
    
    /**
     * 更新Agent配置
     * @param configUpdate 配置更新
     */
    updateConfig(configUpdate: Partial<AgentConfig>): void {
        this.config = {
            ...this.config,
            ...configUpdate,
            updated_at: Date.now()
        };
        this.logInfo(`Agent配置已更新`);
    }
    
    // ==================== 日志方法 ====================
    
    /**
     * 记录调试日志
     * @param message 日志消息
     * @param details 日志详情
     */
    protected logDebug(message: string, details?: Record<string, any>): void {
        this.addLog('debug', message, details);
    }
    
    /**
     * 记录信息日志
     * @param message 日志消息
     * @param details 日志详情
     */
    protected logInfo(message: string, details?: Record<string, any>): void {
        this.addLog('info', message, details);
        logger.info(`[${this.config.name}] ${message}`);
    }
    
    /**
     * 记录警告日志
     * @param message 日志消息
     * @param details 日志详情
     */
    protected logWarning(message: string, details?: Record<string, any>): void {
        this.addLog('warning', message, details);
        logger.warn(`[${this.config.name}] ${message}`);
    }
    
    /**
     * 记录错误日志
     * @param message 日志消息
     * @param details 日志详情
     */
    protected logError(message: string, details?: Record<string, any>): void {
        this.addLog('error', message, details);
        logger.error(`[${this.config.name}] ${message}`);
    }
    
    /**
     * 记录严重错误日志
     * @param message 日志消息
     * @param details 日志详情
     */
    protected logCritical(message: string, details?: Record<string, any>): void {
        this.addLog('critical', message, details);
        logger.error(`[${this.config.name}] CRITICAL: ${message}`);
    }
    
    /**
     * 添加日志条目
     * @param level 日志级别
     * @param message 日志消息
     * @param details 日志详情
     */
    private addLog(level: AgentLogEntry['level'], message: string, details?: Record<string, any>): void {
        const logEntry: AgentLogEntry = {
            logId: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            agentId: this.config.id,
            level,
            message,
            details: details || {},
            timestamp: Date.now()
        };
        
        this.logs.push(logEntry);
        
        // 限制日志数量
        if (this.logs.length > 1000) {
            this.logs = this.logs.slice(-500);
        }
    }
    
    // ==================== 工具方法 ====================
    
    /**
     * 更新Agent指标
     * @param taskResult 任务结果
     * @param executionTime 执行时间
     */
    private updateMetrics(taskResult: TaskResult, executionTime: number): void {
        // 更新平均响应时间
        const totalTasks = this.metrics.totalTasks;
        if (totalTasks > 0) {
            this.metrics.avgResponseTime = (this.metrics.avgResponseTime * (totalTasks - 1) + executionTime) / totalTasks;
        }
        
        // 更新平均处理时间
        if (taskResult.performanceMetrics && taskResult.performanceMetrics.processingTime) {
            this.metrics.avgProcessingTime = (this.metrics.avgProcessingTime * (totalTasks - 1) + taskResult.performanceMetrics.processingTime) / totalTasks;
        }
        
        // 更新资源使用率
        if (taskResult.performanceMetrics && taskResult.performanceMetrics.resourceUsage) {
            this.metrics.resourceUtilization = (this.metrics.resourceUtilization * (totalTasks - 1) + taskResult.performanceMetrics.resourceUsage) / totalTasks;
        }
        
        // 更新宪法合规率
        if (taskResult.constitutionalCompliance) {
            const complianceScore = taskResult.constitutionalCompliance.overallCompliance === 'compliant' ? 100 :
                                 taskResult.constitutionalCompliance.overallCompliance === 'partial' ? 50 : 0;
            this.metrics.constitutionalComplianceRate = (this.metrics.constitutionalComplianceRate * (totalTasks - 1) + complianceScore) / totalTasks;
        }
    }
    
    /**
     * 生成合规评估
     * @param operation 待评估操作
     * @param complianceScore 合规评分
     * @returns 合规评估结果
     */
    protected generateComplianceAssessment(operation: any, complianceScore: number): ComplianceAssessment {
        const overallCompliance: ComplianceAssessment['overallCompliance'] = 
            complianceScore >= 90 ? 'compliant' :
            complianceScore >= 70 ? 'partial' : 'non-compliant';
        
        return {
            overallCompliance,
            complianceDetails: [],
            violations: [],
            suggestedCorrections: [],
            timestamp: Date.now()
        };
    }
    
    /**
     * 生成任务结果
     * @param taskId 任务ID
     * @param status 任务状态
     * @param result 任务结果
     * @param executionTime 执行时间
     * @returns 任务结果对象
     */
    protected generateTaskResult(
        taskId: string,
        status: TaskResult['status'],
        result: any,
        executionTime: number
    ): TaskResult {
        return {
            taskId,
            status,
            result,
            constitutionalCompliance: {
                overallCompliance: 'compliant',
                complianceDetails: [],
                violations: [],
                suggestedCorrections: [],
                timestamp: Date.now()
            },
            performanceMetrics: {
                responseTime: executionTime,
                processingTime: executionTime * 0.8,
                resourceUsage: 30 + Math.random() * 40,
                errorRate: status === 'success' ? 0 : 100,
                successIndicators: status === 'success' ? ['任务完成', '符合预期'] : ['任务失败']
            },
            executionDetails: [
                {
                    step: '任务执行',
                    status: status === 'success' ? 'success' : 'failed',
                    executionLog: [`任务${status === 'success' ? '成功' : '失败'}完成`],
                    issues: [],
                    startTime: Date.now() - executionTime,
                    endTime: Date.now()
                }
            ],
            timestamp: Date.now()
        };
    }
}