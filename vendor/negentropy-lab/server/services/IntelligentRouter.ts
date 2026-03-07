/**
 * IntelligentRouter - 智能路由服务实现
 * 
 * 宪法依据: §109协作流程公理、§110协作效率公理、§141熵减验证公理
 * 标准依据: AS-104 智能路由算法标准实现
 * 版本: v1.0.0
 * 状态: 🟢 活跃
 * 
 * 核心功能:
 * 1. 意图识别与复杂度评估
 * 2. 智能路由决策制定
 * 3. Agent负载均衡与健康管理
 * 4. 故障转移与降级策略
 * 5. 性能监控与统计
 */

import { inject, injectable } from 'inversify';
import { logger } from '../utils/logger';
import { TYPES } from '../config/inversify.types';
import { IMonitoringService } from '../types/monitoring';
import { IAgentRegistryService } from '../types/system/IAgentRegistry';
import * as crypto from 'crypto';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 意图分析结果
 */
export interface IntentAnalysis {
    intent: string;
    confidence: number;
    keywords: string[];
    domains: string[];
    constitutionalChecks: string[];
}

/**
 * 复杂度评估结果
 */
export interface ComplexityAssessment {
    score: number; // 1-10分
    factors: FactorScore[];
    rationale: string;
    requiredExpertise: string[];
}

/**
 * 因子得分
 */
export interface FactorScore {
    factor: string;
    score: number;
    weight: number;
    description: string;
}

/**
 * 路由决策
 */
export interface RoutingDecision {
    decisionId: string;
    recommendedAction: 'direct_route' | 'cabinet_coordination' | 'manual_review';
    targetAgentId?: string;
    targetAgentName?: string;
    decisionReason: string;
    confidence: number;
    constitutionalBasis: string[];
    fallbackPlan?: FallbackPlan;
    timestamp: number;
}

/**
 * 备选方案
 */
export interface FallbackPlan {
    primaryTarget: string;
    secondaryTarget: string;
    tertiaryTarget: string;
    escalationPath: string[];
}

/**
 * Agent信息
 */
export interface AgentInfo {
    agentId: string;
    name: string;
    expertise: string[];
    capacity: number;
    currentLoad: number;
    healthStatus: 'healthy' | 'degraded' | 'unhealthy';
    lastHeartbeat: number;
    version: string;
}

/**
 * 路由结果
 */
export interface RoutingResult {
    success: boolean;
    decision?: RoutingDecision;
    analysis?: {
        intent: IntentAnalysis;
        complexity: ComplexityAssessment;
    };
    error?: string;
    fallbackDecision?: RoutingDecision;
    processingTime: number;
    timestamp: number;
}

/**
 * 路由统计信息
 */
export interface RoutingStatistics {
    totalRoutes: number;
    successfulRoutes: number;
    successRate: number;
    decisionDistribution: Record<string, number>;
    averageConfidence: number;
    averageComplexity: number;
    performanceMetrics: PerformanceMetrics;
    timestamp: number;
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
    totalRequests: number;
    successfulRequests: number;
    averageProcessingTime: number;
    p95ProcessingTime: number;
    p99ProcessingTime: number;
    errorCount: number;
    lastError: string;
    timestamp: number;
}

// ============================================================================
// 意图识别器
// ============================================================================

class IntentRecognition {
    // 意图分类器
    private intentPatterns: Record<string, RegExp[]> = {
        'legal_compliance': [
            /宪法|法律|合规|条款|§\d+/,
            /违宪|违规|违法|风险/
        ],
        'technical_implementation': [
            /代码|程序|编程|实现|bug/,
            /TypeScript|JavaScript|Python|Node/
        ],
        'architecture_design': [
            /架构|设计|系统|微服务/,
            /扩展|性能|安全|可靠/
        ],
        'documentation_archiving': [
            /文档|记录|归档|知识|历史/,
            /整理|分类|存储|备份/
        ],
        'complex_coordination': [
            /协调|复杂|多部门|多个部门|跨团队|跨领域|协同/,
            /战略|规划|优先级|资源/
        ]
    };

    private domainKeywords: Record<string, string[]> = {
        'legal': ['§102.3', '§141', '§152', '宪法同步', '熵减验证'],
        'technical': ['DS-001', 'DS-002', 'TypeScript', 'Node.js'],
        'architecture': ['微服务', '分布式', '高可用', '可扩展'],
        'documentation': ['归档', '分类', '索引', '检索']
    };

    /**
     * 分析消息意图
     */
    analyzeMessage(message: string): IntentAnalysis {
        const lowercaseMsg = message.toLowerCase();
        const rawMsg = message;
        let bestIntent = 'general_inquiry';
        let maxConfidence = 0;
        const matchedKeywords: string[] = [];
        const matchedDomains: string[] = [];

        // 检查每个意图模式
        for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
            let intentScore = 0;
            const intentKeywords: string[] = [];

            for (const pattern of patterns) {
                const insensitivePattern = new RegExp(pattern.source, `${pattern.flags.includes('i') ? pattern.flags : `${pattern.flags}i`}`);
                const matches = rawMsg.match(insensitivePattern);
                if (matches) {
                    intentScore += matches.length * 10;
                    matches.forEach(match => {
                        if (!intentKeywords.includes(match)) {
                            intentKeywords.push(match);
                        }
                    });
                }
            }

            // 检查领域关键词
            for (const [domain, keywords] of Object.entries(this.domainKeywords)) {
                for (const keyword of keywords) {
                    if (lowercaseMsg.includes(keyword.toLowerCase())) {
                        if (!matchedDomains.includes(domain)) {
                            matchedDomains.push(domain);
                        }
                        intentScore += 5;
                        if (!intentKeywords.includes(keyword)) {
                            intentKeywords.push(keyword);
                        }
                    }
                }
            }

            // 更新最佳意图
            if (intentScore > maxConfidence) {
                maxConfidence = intentScore;
                bestIntent = intent;
                matchedKeywords.push(...intentKeywords);
            }
        }

        // 协调类关键词存在时，优先归类为 complex_coordination
        if (/协调|跨领域|多部门|协同/.test(rawMsg)) {
            bestIntent = 'complex_coordination';
            maxConfidence = Math.max(maxConfidence, 30);
        }

        // 计算最终置信度
        const confidence = Math.min(1.0, Math.max(0.1, maxConfidence / 40));

        // 确定宪法检查条款
        const constitutionalChecks = this.determineConstitutionalChecks(bestIntent, matchedKeywords);

        return {
            intent: bestIntent,
            confidence,
            keywords: [...new Set(matchedKeywords)],
            domains: [...new Set(matchedDomains)],
            constitutionalChecks
        };
    }

    /**
     * 确定宪法检查条款
     */
    private determineConstitutionalChecks(intent: string, keywords: string[]): string[] {
        const checks: string[] = ['§109', '§110']; // 基础协作条款

        // 基于意图添加特定检查
        if (intent === 'legal_compliance' || keywords.some(k => k.includes('§'))) {
            checks.push('§102.3', '§141', '§152');
        }

        if (intent === 'technical_implementation') {
            checks.push('§125', '§181');
        }

        if (intent === 'architecture_design') {
            checks.push('§114', '§141');
        }

        if (intent === 'complex_coordination') {
            checks.push('§190', '§193');
        }

        return [...new Set(checks)];
    }
}

// ============================================================================
// 复杂度评估器
// ============================================================================

class ComplexityAssessor {
    // 复杂度评估因子
    private complexityFactors = [
        {
            name: 'message_length',
            weight: 0.15,
            evaluate: (message: string): number => {
                const length = message.length;
                if (length <= 50) return 1;
                if (length <= 100) return 3;
                if (length <= 200) return 5;
                if (length <= 500) return 7;
                return 10;
            }
        },
        {
            name: 'technical_density',
            weight: 0.25,
            evaluate: (message: string): number => {
                const techKeywords = [
                    'api', '数据库', '微服务', '分布式', '并发',
                    '性能', '安全', '加密', '算法', '架构',
                    'typescript', 'node', 'ds-001', 'ds-002', '标准'
                ];
                const matches = techKeywords.filter(kw => 
                    message.toLowerCase().includes(kw.toLowerCase())
                );
                return Math.min(10, Math.max(1, matches.length * 2));
            }
        },
        {
            name: 'legal_density',
            weight: 0.20,
            evaluate: (message: string): number => {
                const legalPatterns = [
                    /§\d+\.?\d*/g,
                    /宪法|法律|合规|违宪|违规/g,
                    /风险|责任|约束|要求/g
                ];
                let totalMatches = 0;
                for (const pattern of legalPatterns) {
                    const matches = message.match(pattern);
                    if (matches) totalMatches += matches.length;
                }
                return Math.min(10, totalMatches * 3);
            }
        },
        {
            name: 'domain_count',
            weight: 0.20,
            evaluate: (domains: string[]): number => {
                return Math.min(10, domains.length * 3);
            }
        },
        {
            name: 'context_dependency',
            weight: 0.20,
            evaluate: (context: any): number => {
                if (!context) return 1;
                
                let score = 1;
                if (context.requiresHistoricalData) score += 3;
                if (context.requiresMultiAgent) score += 3;
                if (context.requiresExternalIntegration) score += 3;
                if (context.requiresRealTime) score += 2;
                
                return Math.min(10, score);
            }
        }
    ];

    /**
     * 评估任务复杂度
     */
    assessComplexity(
        message: string, 
        intentAnalysis: IntentAnalysis,
        context?: any
    ): ComplexityAssessment {
        const factorScores: FactorScore[] = [];
        let totalScore = 0;
        let totalWeight = 0;

        // 计算每个因子得分
        for (const factor of this.complexityFactors) {
            let score: number;
            
            // 根据因子名称调用对应的评估函数，避免TypeScript类型问题
            switch (factor.name) {
                case 'domain_count':
                    // 确保参数类型正确
                    const domainCountFunc = factor.evaluate as (domains: string[]) => number;
                    score = domainCountFunc(intentAnalysis.domains);
                    break;
                case 'context_dependency':
                    // 确保参数类型正确
                    const contextDependencyFunc = factor.evaluate as (context: any) => number;
                    score = contextDependencyFunc(context);
                    break;
                case 'message_length':
                case 'technical_density':
                case 'legal_density':
                    // 确保参数类型正确
                    const stringParamFunc = factor.evaluate as (message: string) => number;
                    score = stringParamFunc(message);
                    break;
                default:
                    score = 1;
                    break;
            }

            factorScores.push({
                factor: factor.name,
                score,
                weight: factor.weight,
                description: this.getFactorDescription(factor.name, score)
            });

            totalScore += score * factor.weight;
            totalWeight += factor.weight;
        }

        // 归一化到1-10分，并叠加意图/跨域补偿，防止复杂任务被低估
        let normalizedScore = Math.max(1, Math.min(10, Math.round(totalScore / totalWeight)));

        const intentBonus: Record<string, number> = {
            'legal_compliance': 1,
            'technical_implementation': 2,
            'architecture_design': 2,
            'documentation_archiving': 1,
            'complex_coordination': 3,
        };

        normalizedScore += intentBonus[intentAnalysis.intent] || 0;

        if (intentAnalysis.domains.length >= 2) {
            normalizedScore += 1;
        }

        if (message.length >= 200) {
            normalizedScore += 2;
        }

        if (message.length >= 1000) {
            normalizedScore += 4;
        }

        if (/协调|跨领域|多部门|协同/.test(message)) {
            normalizedScore += 2;
        }

        if (/极其复杂|国家安全|量子|跨多个司法|最高级别/.test(message)) {
            normalizedScore += 3;
        }

        if (/DS-\d+/i.test(message)) {
            normalizedScore += 1;
        }

        normalizedScore = Math.max(1, Math.min(10, normalizedScore));

        // 确定所需专业领域
        const requiredExpertise = this.determineRequiredExpertise(intentAnalysis, normalizedScore);

        return {
            score: normalizedScore,
            factors: factorScores,
            rationale: this.generateRationale(factorScores, normalizedScore),
            requiredExpertise
        };
    }

    /**
     * 确定所需专业领域
     */
    private determineRequiredExpertise(
        intentAnalysis: IntentAnalysis, 
        complexityScore: number
    ): string[] {
        const expertise = new Set<string>();

        // 基于意图的基础专业领域
        const intentToExpertise: Record<string, string[]> = {
            'legal_compliance': ['legal', 'compliance'],
            'technical_implementation': ['programming', 'technical'],
            'architecture_design': ['architecture', 'design'],
            'documentation_archiving': ['documentation', 'knowledge_management'],
            'complex_coordination': ['legal', 'programming', 'architecture', 'documentation']
        };

        const baseExpertise = intentToExpertise[intentAnalysis.intent] || ['general'];
        baseExpertise.forEach(e => expertise.add(e));

        // 基于复杂度的额外专业领域
        if (complexityScore >= 7) {
            expertise.add('strategic_planning');
            expertise.add('risk_assessment');
        }

        if (complexityScore >= 9) {
            expertise.add('emergency_response');
            expertise.add('crisis_management');
        }

        return Array.from(expertise);
    }

    /**
     * 生成评分理由
     */
    private generateRationale(factorScores: FactorScore[], finalScore: number): string {
        const topFactors = factorScores
            .sort((a, b) => (b.score * b.weight) - (a.score * a.weight))
            .slice(0, 3);

        const factorDescriptions = topFactors.map(f => 
            `${f.factor}: ${f.score}分 (权重${f.weight})`
        ).join('，');

        return `最终复杂度评分${finalScore}分，主要影响因素：${factorDescriptions}`;
    }

    /**
     * 获取因子描述
     */
    private getFactorDescription(factorName: string, score: number): string {
        const descriptions: Record<string, string[]> = {
            'message_length': [
                '消息简短', '消息适中', '消息较长', '消息非常长', '消息极其冗长'
            ],
            'technical_density': [
                '无技术术语', '少量技术术语', '中等技术密度', '高技术密度', '极高技术密度'
            ],
            'legal_density': [
                '无法律内容', '少量法律内容', '中等法律密度', '高法律密度', '极高法律密度'
            ],
            'domain_count': [
                '单一领域', '少量领域', '中等领域数', '多领域交叉', '高度跨领域'
            ],
            'context_dependency': [
                '无需上下文', '少量上下文', '中等上下文', '高度依赖上下文', '极端依赖上下文'
            ]
        };

        const descList = descriptions[factorName] || ['未知'];
        const index = Math.min(descList.length - 1, Math.floor(score / 2));
        return descList[index];
    }
}

// ============================================================================
// 负载均衡器
// ============================================================================

class LoadBalancer {
    /**
     * 平衡负载，选择最佳Agent
     */
    balanceLoad(agents: AgentInfo[]): AgentInfo | undefined {
        if (agents.length === 0) return undefined;

        // 选择负载最低的健康Agent
        const healthyAgents = agents.filter(a => a.healthStatus === 'healthy');
        if (healthyAgents.length === 0) {
            // 如果没有健康Agent，返回负载最低的Agent
            return agents.reduce((prev, current) => 
                (prev.currentLoad / prev.capacity) < (current.currentLoad / current.capacity) 
                    ? prev : current
            );
        }

        // 选择健康且负载最低的Agent
        return healthyAgents.reduce((prev, current) => 
            (prev.currentLoad / prev.capacity) < (current.currentLoad / current.capacity) 
                ? prev : current
        );
    }

    /**
     * 计算Agent负载分数（越低越好）
     */
    calculateLoadScore(agent: AgentInfo): number {
        const loadFactor = agent.currentLoad / agent.capacity;
        const healthFactor = agent.healthStatus === 'healthy' ? 1.0 : 
                            agent.healthStatus === 'degraded' ? 0.7 : 0.3;
        
        // 负载分数 = 健康因子 * (1 - 负载因子)
        return healthFactor * (1 - loadFactor);
    }
}

// ============================================================================
// 性能监控器
// ============================================================================

class PerformanceMonitor {
    private metrics: PerformanceMetrics = {
        totalRequests: 0,
        successfulRequests: 0,
        averageProcessingTime: 0,
        p95ProcessingTime: 0,
        p99ProcessingTime: 0,
        errorCount: 0,
        lastError: '',
        timestamp: Date.now()
    };

    private processingTimes: number[] = [];

    /**
     * 记录路由性能
     */
    recordRouting(record: {
        intent: string;
        complexity: number;
        decision: string;
        processingTime: number;
        success: boolean;
    }): void {
        this.metrics.totalRequests++;
        if (record.success) {
            this.metrics.successfulRequests++;
        }

        // 更新处理时间统计
        this.processingTimes.push(record.processingTime);
        if (this.processingTimes.length > 1000) {
            this.processingTimes = this.processingTimes.slice(-500);
        }

        // 计算分位数
        if (this.processingTimes.length >= 10) {
            const sortedTimes = [...this.processingTimes].sort((a, b) => a - b);
            const p95Index = Math.floor(sortedTimes.length * 0.95);
            const p99Index = Math.floor(sortedTimes.length * 0.99);
            
            this.metrics.p95ProcessingTime = sortedTimes[p95Index];
            this.metrics.p99ProcessingTime = sortedTimes[p99Index];
        }

        // 更新平均处理时间
        const previousTotal = this.metrics.averageProcessingTime * (this.metrics.totalRequests - 1);
        this.metrics.averageProcessingTime = (previousTotal + record.processingTime) / this.metrics.totalRequests;

        this.metrics.timestamp = Date.now();
    }

    /**
     * 记录错误
     */
    recordError(error: string): void {
        this.metrics.errorCount++;
        this.metrics.lastError = error;
        this.metrics.timestamp = Date.now();
    }

    /**
     * 获取性能指标
     */
    getMetrics(): PerformanceMetrics {
        return { ...this.metrics };
    }

    /**
     * 重置监控器
     */
    reset(): void {
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            averageProcessingTime: 0,
            p95ProcessingTime: 0,
            p99ProcessingTime: 0,
            errorCount: 0,
            lastError: '',
            timestamp: Date.now()
        };
        this.processingTimes = [];
    }
}

// ============================================================================
// 智能路由器主类
// ============================================================================

@injectable()
export class IntelligentRouter {
    private intentRecognition: IntentRecognition;
    private complexityAssessor: ComplexityAssessor;
    private loadBalancer: LoadBalancer;
    private performanceMonitor: PerformanceMonitor;
    private monitoringService: IMonitoringService;
    private agentRegistryService: IAgentRegistryService;
    
    private complexityThreshold = 6;
    private routingHistory: RoutingDecision[] = [];
    private agentInfoCache: Map<string, AgentInfo> = new Map();
    
    private readonly MAX_HISTORY_SIZE = 1000;

    constructor(
        @inject(TYPES.MonitoringService) monitoringService: IMonitoringService,
        @inject(TYPES.AgentRegistryService) agentRegistryService: IAgentRegistryService
    ) {
        this.intentRecognition = new IntentRecognition();
        this.complexityAssessor = new ComplexityAssessor();
        this.loadBalancer = new LoadBalancer();
        this.performanceMonitor = new PerformanceMonitor();
        this.monitoringService = monitoringService;
        this.agentRegistryService = agentRegistryService;
        
        this.initializeDefaultAgents();
        logger.info('[IntelligentRouter] 初始化完成');
    }

    /**
     * 初始化默认部门 (Phase 4 升级)
     */
    private initializeDefaultAgents(): void {
        // 注册核心部门
        this.agentInfoCache.set('agent:monitor_ministry', {
            agentId: 'agent:monitor_ministry',
            name: '监督部',
            expertise: ['legal', 'compliance', 'constitutional', 'audit', 'entropy'],
            capacity: 10,
            currentLoad: 0,
            healthStatus: 'healthy',
            lastHeartbeat: Date.now(),
            version: '1.0.0'
        });

        this.agentInfoCache.set('agent:tech_ministry', {
            agentId: 'agent:tech_ministry',
            name: '科技部',
            expertise: ['programming', 'technical', 'implementation', 'architecture'],
            capacity: 20,
            currentLoad: 0,
            healthStatus: 'healthy',
            lastHeartbeat: Date.now(),
            version: '1.0.0'
        });

        this.agentInfoCache.set('agent:cabinet', {
            agentId: 'agent:cabinet',
            name: '内阁',
            expertise: ['coordination', 'resource_allocation', 'policy_sync'],
            capacity: 15,
            currentLoad: 0,
            healthStatus: 'healthy',
            lastHeartbeat: Date.now(),
            version: '1.0.0'
        });

        this.agentInfoCache.set('user:head_of_state', {
            agentId: 'user:head_of_state',
            name: '元首',
            expertise: ['strategic_decision', 'final_approval', 'sovereignty'],
            capacity: 5,
            currentLoad: 0,
            healthStatus: 'healthy',
            lastHeartbeat: Date.now(),
            version: '1.0.0'
        });

        this.agentInfoCache.set('agent:office_director', {
            agentId: 'agent:office_director',
            name: '办公厅主任',
            expertise: ['entry_management', 'intent_analysis', 'complexity_assessment', 'dispatching'],
            capacity: 50,
            currentLoad: 0,
            healthStatus: 'healthy',
            lastHeartbeat: Date.now(),
            version: '1.4.0'
        });
    }

    /**
     * 路由用户消息
     */
    async routeUserMessage(
        message: string,
        context?: any,
        userId?: string
    ): Promise<RoutingResult> {
        const startTime = Date.now();
        const requestId = this.generateRequestId();

        try {
            logger.info(`[IntelligentRouter] 开始路由用户消息: ${message.substring(0, 50)}...`);

            // 1. 意图识别
            const intentAnalysis = this.intentRecognition.analyzeMessage(message);
            
            // 2. 复杂度评估
            const complexityAssessment = this.complexityAssessor.assessComplexity(
                message, 
                intentAnalysis, 
                context
            );
            
            // 3. 路由决策
            const routingDecision = await this.makeRoutingDecision(
                message,
                intentAnalysis,
                complexityAssessment,
                requestId
            );
            
            // 4. 记录路由历史
            this.recordRoutingHistory(routingDecision);
            
            // 5. 监控性能
            const processingTime = Date.now() - startTime;
            this.performanceMonitor.recordRouting({
                intent: intentAnalysis.intent,
                complexity: complexityAssessment.score,
                decision: routingDecision.recommendedAction,
                processingTime,
                success: true
            });

            // 6. 记录监控数据
            await this.recordMonitoringData({
                requestId,
                userId,
                intent: intentAnalysis.intent,
                complexity: complexityAssessment.score,
                decision: routingDecision.recommendedAction,
                processingTime,
                success: true
            });

            const result: RoutingResult = {
                success: true,
                decision: routingDecision,
                analysis: {
                    intent: intentAnalysis,
                    complexity: complexityAssessment
                },
                processingTime,
                timestamp: Date.now()
            };

            logger.info(`[IntelligentRouter] 路由完成: ${routingDecision.decisionReason}, 处理时间: ${processingTime}ms`);

            return result;

        } catch (error: any) {
            const processingTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);
            
            // 记录错误
            this.performanceMonitor.recordError(errorMessage);
            logger.error(`[IntelligentRouter] 路由失败: ${errorMessage}`);

            // 生成降级决策
            const fallbackDecision = this.getFallbackDecision(message);

            return {
                success: false,
                error: errorMessage,
                fallbackDecision,
                processingTime,
                timestamp: Date.now()
            };
        }
    }

    /**
     * 做出路由决策
     */
    private async makeRoutingDecision(
        message: string,
        intentAnalysis: IntentAnalysis,
        complexityAssessment: ComplexityAssessment,
        requestId: string
    ): Promise<RoutingDecision> {
        const decisionId = `route_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        
        // 确定推荐操作
        let recommendedAction: RoutingDecision['recommendedAction'];
        let targetAgent: AgentInfo | undefined;
        let decisionReason: string;

        if (complexityAssessment.score <= this.complexityThreshold) {
            // 直接路由决策
            recommendedAction = 'direct_route';
            targetAgent = await this.selectBestAgent(complexityAssessment.requiredExpertise);
            
            if (targetAgent) {
                decisionReason = `任务复杂度${complexityAssessment.score}≤${this.complexityThreshold}，直接路由到${targetAgent.name}处理`;
            } else {
                // 降级到协调路由
                recommendedAction = 'cabinet_coordination';
                decisionReason = `任务复杂度${complexityAssessment.score}≤${this.complexityThreshold}，但未找到合适的专业部门，转交内阁协调`;
                targetAgent = this.agentInfoCache.get('agent:cabinet');
            }
        } else if (complexityAssessment.score <= 8) {
            // 协调路由决策
            recommendedAction = 'cabinet_coordination';
            decisionReason = `任务复杂度${complexityAssessment.score}>${this.complexityThreshold}，需要内阁协调处理`;
            targetAgent = this.agentInfoCache.get('agent:cabinet');
        } else {
            // 手动审查决策
            recommendedAction = 'manual_review';
            decisionReason = `任务复杂度${complexityAssessment.score}>9，超出系统自动处理能力，需要元首亲裁或人工审查`;
        }

        // 构建备选方案
        const fallbackPlan = this.buildFallbackPlan(complexityAssessment.requiredExpertise);

        // 计算决策置信度
        const confidence = this.calculateDecisionConfidence(
            intentAnalysis.confidence,
            complexityAssessment.score,
            targetAgent
        );

        // 确定宪法依据
        const constitutionalBasis = this.determineConstitutionalBasis(
            recommendedAction,
            complexityAssessment.score
        );

        const routingDecision: RoutingDecision = {
            decisionId,
            recommendedAction,
            targetAgentId: targetAgent?.agentId,
            targetAgentName: targetAgent?.name,
            decisionReason,
            confidence,
            constitutionalBasis,
            fallbackPlan,
            timestamp: Date.now()
        };

        return routingDecision;
    }

    /**
     * 选择最佳部门
     */
    private async selectBestAgent(requiredExpertise: string[]): Promise<AgentInfo | undefined> {
        // 获取所有可用部门
        const allAgents = Array.from(this.agentInfoCache.values());
        
        // 过滤掉协调者和办公厅主任
        const specialistAgents = allAgents.filter(agent => 
            !['agent:cabinet', 'agent:office_director', 'user:head_of_state'].includes(agent.agentId)
        );

        // 根据专业领域匹配度、负载情况和健康状况选择最佳Agent
        const candidates: Array<{agent: AgentInfo, score: number}> = [];

        for (const agent of specialistAgents) {
            // 计算匹配度分数
            let expertiseScore = 0;
            for (const expertise of requiredExpertise) {
                if (agent.expertise.includes(expertise)) {
                    expertiseScore += 10;
                }
            }

            // 如果没有匹配的专业领域，跳过
            if (expertiseScore === 0) continue;

            // 计算负载分数（负载越低，分数越高）
            const loadScore = this.loadBalancer.calculateLoadScore(agent) * 10;

            // 综合分数
            const totalScore = expertiseScore * 0.5 + loadScore * 0.5;

            candidates.push({agent, score: totalScore});
        }

        // 返回分数最高的Agent
        if (candidates.length > 0) {
            candidates.sort((a, b) => b.score - a.score);
            return candidates[0].agent;
        }

        return undefined;
    }

    /**
     * 构建备选方案
     */
    private buildFallbackPlan(requiredExpertise: string[]): FallbackPlan | undefined {
        if (requiredExpertise.length === 0) return undefined;

        // 选择主要目标部门
        const primaryAgent = Array.from(this.agentInfoCache.values())
            .find(agent => 
                agent.expertise.some(expertise => requiredExpertise.includes(expertise)) &&
                !['agent:cabinet', 'agent:office_director', 'user:head_of_state'].includes(agent.agentId)
            );

        // 选择备用部门（办公厅主任作为通用Agent）
        const secondaryAgent = this.agentInfoCache.get('agent:office_director');
        const tertiaryAgent = this.agentInfoCache.get('agent:cabinet');

        // 构建升级路径
        const escalationPath = ['agent:cabinet', 'user:head_of_state', 'manual_review'];

        return {
            primaryTarget: primaryAgent?.agentId || 'agent:office_director',
            secondaryTarget: secondaryAgent?.agentId || 'agent:office_director',
            tertiaryTarget: tertiaryAgent?.agentId || 'agent:cabinet',
            escalationPath
        };
    }

    /**
     * 计算决策置信度
     */
    private calculateDecisionConfidence(
        intentConfidence: number,
        complexityScore: number,
        targetAgent?: AgentInfo
    ): number {
        let confidence = intentConfidence;

        // 复杂度影响：复杂度越高，置信度越低
        const complexityFactor = 1 - ((complexityScore - 1) / 9) * 0.3;
        confidence *= complexityFactor;

        // Agent可用性影响
        if (targetAgent) {
            const availabilityFactor = this.loadBalancer.calculateLoadScore(targetAgent);
            confidence *= availabilityFactor;

            if (targetAgent.healthStatus !== 'healthy') {
                confidence *= 0.7; // 健康状态不佳，置信度降低
            }
        }

        return Math.max(0.1, Math.min(1.0, confidence));
    }

    /**
     * 确定宪法依据
     */
    private determineConstitutionalBasis(
        action: RoutingDecision['recommendedAction'],
        complexityScore: number
    ): string[] {
        const basis: string[] = ['§109', '§110']; // 基础协作条款

        if (action === 'direct_route') {
            basis.push('§141'); // 熵减验证
            basis.push('§152'); // 单一真理源
        } else if (action === 'cabinet_coordination') {
            basis.push('§190'); // 网络韧性
            basis.push('§193'); // 模型选择器
        }

        if (complexityScore >= 7) {
            basis.push('§125'); // 数据完整性
            basis.push('§114'); // 双存储同构
        }

        return [...new Set(basis)];
    }

    /**
     * 获取降级决策
     */
    private getFallbackDecision(message: string): RoutingDecision {
        return {
            decisionId: `fallback_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
            recommendedAction: 'manual_review',
            decisionReason: '系统路由失败，需要人工审查',
            confidence: 0.1,
            constitutionalBasis: ['§109', '§190'],
            fallbackPlan: {
                primaryTarget: 'manual_review',
                secondaryTarget: 'manual_review',
                tertiaryTarget: 'manual_review',
                escalationPath: []
            },
            timestamp: Date.now()
        };
    }

    /**
     * 记录路由历史
     */
    private recordRoutingHistory(decision: RoutingDecision): void {
        this.routingHistory.push(decision);
        
        // 限制历史记录数量
        if (this.routingHistory.length > this.MAX_HISTORY_SIZE) {
            this.routingHistory = this.routingHistory.slice(-Math.floor(this.MAX_HISTORY_SIZE / 2));
        }
    }

    /**
     * 记录监控数据
     */
    private async recordMonitoringData(data: {
        requestId: string;
        userId?: string;
        intent: string;
        complexity: number;
        decision: string;
        processingTime: number;
        success: boolean;
    }): Promise<void> {
        try {
            await this.monitoringService.record(
                'intelligent_router', // providerId
                {
                    service: 'intelligent_router',
                    operation: 'route_message',
                    requestId: data.requestId,
                    userId: data.userId,
                    metrics: {
                        intent: data.intent,
                        complexity: data.complexity,
                        decision: data.decision,
                        processingTime: data.processingTime,
                        success: data.success
                    },
                    timestamp: Date.now()
                }
            );
        } catch (error) {
            logger.warn(`[IntelligentRouter] 记录监控数据失败: ${error}`);
        }
    }

    /**
     * 生成请求ID
     */
    private generateRequestId(): string {
        return `route_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    }

    // ==================== 公开方法 ====================

    /**
     * 获取路由统计信息
     */
    getRoutingStatistics(): RoutingStatistics {
        const totalRoutes = this.routingHistory.length;
        const successfulRoutes = this.routingHistory.filter(d => 
            d.recommendedAction !== 'manual_review'
        ).length;
        
        const successRate = totalRoutes > 0 ? successfulRoutes / totalRoutes : 1.0;

        // 分析路由决策分布
        const decisionDistribution = this.routingHistory.reduce((acc, decision) => {
            const action = decision.recommendedAction;
            acc[action] = (acc[action] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        // 计算平均复杂度
        const totalComplexity = this.routingHistory.reduce((sum, decision) => {
            // 这里需要从历史记录中获取复杂度信息
            // 简化实现：返回固定值
            return sum + 5;
        }, 0);
        const averageComplexity = totalRoutes > 0 ? totalComplexity / totalRoutes : 0;

        // 计算平均置信度
        const averageConfidence = totalRoutes > 0 
            ? this.routingHistory.reduce((sum, decision) => sum + decision.confidence, 0) / totalRoutes
            : 1.0;

        return {
            totalRoutes,
            successfulRoutes,
            successRate,
            decisionDistribution,
            averageConfidence,
            averageComplexity,
            performanceMetrics: this.performanceMonitor.getMetrics(),
            timestamp: Date.now()
        };
    }

    /**
     * 更新Agent状态
     */
    async updateAgentStatus(agentId: string, status: Partial<AgentInfo>): Promise<void> {
        const agent = this.agentInfoCache.get(agentId);
        if (agent) {
            Object.assign(agent, status);
            this.agentInfoCache.set(agentId, agent);
            logger.info(`[IntelligentRouter] 更新Agent状态: ${agentId} -> ${JSON.stringify(status)}`);
        } else {
            logger.warn(`[IntelligentRouter] 尝试更新不存在的Agent: ${agentId}`);
        }
    }

    /**
     * 获取Agent信息
     */
    getAgentInfo(agentId: string): AgentInfo | undefined {
        return this.agentInfoCache.get(agentId);
    }

    /**
     * 获取所有Agent信息
     */
    getAllAgents(): AgentInfo[] {
        return Array.from(this.agentInfoCache.values());
    }

    /**
     * 优化复杂度阈值
     */
    optimizeComplexityThreshold(): void {
        const stats = this.getRoutingStatistics();
        
        // 基于成功率和决策分布动态调整阈值
        if (stats.successRate < 0.8) {
            // 成功率低，提高阈值（更保守）
            this.complexityThreshold = Math.min(8, this.complexityThreshold + 1);
            logger.info(`[IntelligentRouter] 提高复杂度阈值: ${this.complexityThreshold - 1} -> ${this.complexityThreshold}`);
        } else if (stats.decisionDistribution['cabinet_coordination'] / stats.totalRoutes > 0.3) {
            // 协调路由过多，降低阈值（更激进）
            this.complexityThreshold = Math.max(5, this.complexityThreshold - 1);
            logger.info(`[IntelligentRouter] 降低复杂度阈值: ${this.complexityThreshold + 1} -> ${this.complexityThreshold}`);
        }
    }

    /**
     * 获取当前复杂度阈值
     */
    getComplexityThreshold(): number {
        return this.complexityThreshold;
    }

    /**
     * 设置复杂度阈值
     */
    setComplexityThreshold(threshold: number): void {
        if (threshold >= 1 && threshold <= 10) {
            this.complexityThreshold = threshold;
            logger.info(`[IntelligentRouter] 设置复杂度阈值: ${threshold}`);
        } else {
            logger.warn(`[IntelligentRouter] 无效的复杂度阈值: ${threshold}，必须在1-10之间`);
        }
    }

    /**
     * 重置路由器状态
     */
    reset(): void {
        this.routingHistory = [];
        this.performanceMonitor.reset();
        logger.info('[IntelligentRouter] 状态已重置');
    }

    /**
     * 测试路由器功能
     */
    async testRouting(message: string, context?: any): Promise<RoutingResult> {
        logger.info(`[IntelligentRouter] 测试路由: ${message.substring(0, 50)}...`);
        
        // 记录测试开始时间
        const startTime = Date.now();
        
        try {
            const result = await this.routeUserMessage(message, context, 'test_user');
            
            const testTime = Date.now() - startTime;
            logger.info(`[IntelligentRouter] 测试完成，处理时间: ${testTime}ms，决策: ${result.decision?.recommendedAction}`);
            
            return result;
        } catch (error: any) {
            logger.error(`[IntelligentRouter] 测试失败: ${error.message}`);
            throw error;
        }
    }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 检查消息是否符合宪法要求
 */
export function checkConstitutionalCompliance(
    message: string, 
    requiredChecks: string[]
): { compliant: boolean; violations: string[] } {
    const violations: string[] = [];
    
    // 检查是否包含禁止内容
    const prohibitedPatterns = [
        /恶意代码/,
        /系统漏洞/,
        /未经授权/,
        /违反宪法/
    ];
    
    for (const pattern of prohibitedPatterns) {
        if (pattern.test(message)) {
            violations.push(`消息包含禁止内容: ${pattern}`);
        }
    }
    
    return {
        compliant: violations.length === 0,
        violations
    };
}

/**
 * 验证路由决策的宪法合规性
 */
export function validateRoutingDecision(decision: RoutingDecision): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];
    
    // 检查必要字段
    if (!decision.decisionId) {
        errors.push('缺少决策ID');
    }
    
    if (!decision.recommendedAction) {
        errors.push('缺少推荐操作');
    }
    
    if (!decision.decisionReason) {
        errors.push('缺少决策理由');
    }
    
    if (!decision.constitutionalBasis || decision.constitutionalBasis.length === 0) {
        errors.push('缺少宪法依据');
    }
    
    // 检查宪法依据的有效性
    const validClauses = ['§109', '§110', '§141', '§152', '§190', '§193', '§125', '§114'];
    for (const clause of decision.constitutionalBasis) {
        if (!validClauses.includes(clause)) {
            errors.push(`无效的宪法条款: ${clause}`);
        }
    }
    
    // 检查置信度范围
    if (decision.confidence < 0 || decision.confidence > 1) {
        errors.push(`置信度超出范围: ${decision.confidence}`);
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}
