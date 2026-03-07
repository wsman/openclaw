/**
 * 内阁总理Agent接口类型定义
 * 
 * 宪法依据: §110协作效率公理、§184战略协调公理、§185降级与恢复机制
 * 规范依据: AS-102_内阁总理Agent接口规范.md
 * 版本: v1.0.0
 * 状态: 🟢 活跃
 */

import { 
  IAgentBase, 
  AgentTask, 
  AgentLayer, 
  AgentSpecialty, 
  AgentStatus, 
  AgentHealth, 
  TaskContext, 
  TaskResult, 
  CollaborationRequest, 
  CollaborationResult, 
  AdviceOptions, 
  ExpertAdvice, 
  AgentMetrics, 
  AgentLogEntry,
  ComplianceResult,
  ImplementationStep
} from './IAgentBase';

// ==================== 核心类型定义 ====================

/**
 * 可用Agent信息
 */
export interface AvailableAgentInfo {
  /** Agent ID */
  id: string;
  
  /** Agent名称 */
  name: string;
  
  /** Agent层级 */
  layer: AgentLayer;
  
  /** Agent专业领域 */
  specialty: AgentSpecialty;
  
  /** 当前状态 */
  status: AgentStatus;
  
  /** 健康度评分 (0-100) */
  healthScore: number;
  
  /** 当前负载 (0-100) */
  currentLoad: number;
  
  /** 历史成功率 (%) */
  historicalSuccessRate: number;
  
  /** 平均响应时间 (ms) */
  avgResponseTime: number;
  
  /** 可用性时间窗口 */
  availabilityWindow?: AvailabilityWindow[];
}

/**
 * 可用性时间窗口
 */
export interface AvailabilityWindow {
  /** 开始时间 (小时) */
  startHour: number;
  
  /** 结束时间 (小时) */
  endHour: number;
  
  /** 星期几 (0-6, 0=周日) */
  dayOfWeek: number;
  
  /** 时区 */
  timezone: string;
}

/**
 * 协作策略方案
 */
export interface CollaborationStrategy {
  /** 策略ID */
  id: string;
  
  /** 策略类型 */
  type: 'sequential' | 'parallel' | 'hybrid' | 'fallback';
  
  /** 参与Agent分配 */
  agentAssignments: AgentAssignment[];
  
  /** 预期完成时间 (ms) */
  expectedCompletionTime: number;
  
  /** 预期成功率 (%) */
  expectedSuccessRate: number;
  
  /** 资源需求 */
  resourceRequirements: ResourceRequirement[];
  
  /** 风险分析 */
  riskAnalysis: RiskAnalysis;
  
  /** 宪法合规性 */
  constitutionalCompliance: ComplianceAssessment;
  
  /** 备选方案 */
  alternativeStrategies?: CollaborationStrategy[];
}

/**
 * Agent分配
 */
export interface AgentAssignment {
  /** Agent ID */
  agentId: string;
  
  /** 分配角色 */
  role: 'primary' | 'secondary' | 'backup' | 'reviewer';
  
  /** 任务部分 */
  taskSegment: string;
  
  /** 预期开始时间 (ms) */
  expectedStartTime: number;
  
  /** 预期完成时间 (ms) */
  expectedCompletionTime: number;
  
  /** 依赖分配 */
  dependencies?: string[];
  
  /** 成功标准 */
  successCriteria: string[];
}

/**
 * 资源需求
 */
export interface ResourceRequirement {
  /** 资源类型 */
  type: 'cpu' | 'memory' | 'network' | 'storage' | 'api-quota' | 'llm-tokens';
  
  /** 需求数量 */
  amount: number;
  
  /** 单位 */
  unit: string;
  
  /** 关键性 (1-10) */
  criticality: number;
  
  /** 替代资源 */
  alternativeResources?: AlternativeResource[];
}

/**
 * 替代资源
 */
export interface AlternativeResource {
  /** 资源类型 */
  type: string;
  
  /** 替代系数 (原需求的倍数) */
  substitutionFactor: number;
  
  /** 性能影响 (0-100, 0=无影响) */
  performanceImpact: number;
}

/**
 * 风险分析
 */
export interface RiskAnalysis {
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
 * 识别风险
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
 * 缓解策略
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
 * 监控指标
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
 * 应急预案
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
 * 执行步骤
 */
export interface ExecutionStep {
  /** 步骤序号 */
  step: number;
  
  /** 步骤描述 */
  description: string;
  
  /** 责任Agent */
  responsibleAgent: string;
  
  /** 预期耗时 (ms) */
  expectedDuration: number;
  
  /** 完成标准 */
  completionCriteria: string[];
  
  /** 依赖步骤 */
  dependencies?: number[];
}

/**
 * 回滚计划
 */
export interface RollbackPlan {
  /** 回滚条件 */
  rollbackConditions: string[];
  
  /** 回滚步骤 */
  rollbackSteps: RollbackStep[];
  
  /** 预期回滚时间 (ms) */
  expectedRollbackTime: number;
  
  /** 数据一致性检查 */
  dataConsistencyChecks: ConsistencyCheck[];
}

/**
 * 回滚步骤
 */
export interface RollbackStep {
  /** 步骤序号 */
  step: number;
  
  /** 步骤描述 */
  description: string;
  
  /** 回滚目标状态 */
  targetState: string;
  
  /** 验证检查 */
  verificationChecks: VerificationCheck[];
}

/**
 * 一致性检查
 */
export interface ConsistencyCheck {
  /** 检查ID */
  id: string;
  
  /** 检查描述 */
  description: string;
  
  /** 检查类型 */
  type: 'data' | 'state' | 'constitutional' | 'resource';
  
  /** 预期结果 */
  expectedResult: any;
  
  /** 容错阈值 */
  toleranceThreshold: number;
}

/**
 * 验证检查
 */
export interface VerificationCheck {
  /** 检查ID */
  id: string;
  
  /** 检查描述 */
  description: string;
  
  /** 检查方法 */
  method: 'automated' | 'manual' | 'hybrid';
  
  /** 验证标准 */
  validationCriteria: string[];
  
  /** 通过条件 */
  passCondition: string;
}

/**
 * 合规评估
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
 * 合规详情
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
 * 合规违规
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
 * 修正建议
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
 * 任务分配结果
 */
export interface TaskAssignment {
  /** 分配ID */
  id: string;
  
  /** 任务ID */
  taskId: string;
  
  /** 分配Agent ID */
  agentId: string;
  
  /** 分配时间 */
  assignmentTime: number;
  
  /** 预期开始时间 */
  expectedStartTime: number;
  
  /** 预期完成时间 */
  expectedCompletionTime: number;
  
  /** 优先级调整 */
  priorityAdjustment: number;
  
  /** 资源分配 */
  resourceAllocation: ResourceAllocation;
  
  /** 监控配置 */
  monitoringConfiguration: MonitoringConfig;
}

/**
 * 资源分配
 */
export interface ResourceAllocation {
  /** 分配ID */
  id: string;
  
  /** 资源类型 */
  resourceType: string;
  
  /** 分配数量 */
  allocatedAmount: number;
  
  /** 单位 */
  unit: string;
  
  /** 分配时间段 */
  allocationPeriod: TimeRange;
  
  /** 可回收标志 */
  reclaimable: boolean;
  
  /** 回收条件 */
  reclaimConditions: string[];
}

/**
 * 时间范围
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
 * 监控配置
 */
export interface MonitoringConfig {
  /** 配置ID */
  id: string;
  
  /** 监控指标 */
  metrics: MonitoringMetric[];
  
  /** 告警规则 */
  alertRules: AlertRule[];
  
  /** 报告频率 (ms) */
  reportingFrequency: number;
  
  /** 数据保留策略 */
  dataRetentionPolicy: RetentionPolicy;
}

/**
 * 告警规则
 */
export interface AlertRule {
  /** 规则ID */
  id: string;
  
  /** 规则名称 */
  name: string;
  
  /** 条件表达式 */
  condition: string;
  
  /** 告警级别 */
  severity: 'info' | 'warning' | 'critical';
  
  /** 通知渠道 */
  notificationChannels: string[];
  
  /** 冷却时间 (ms) */
  cooldownPeriod: number;
}

/**
 * 保留策略
 */
export interface RetentionPolicy {
  /** 保留期限 (天) */
  retentionPeriod: number;
  
  /** 归档策略 */
  archivingStrategy: 'immediate' | 'periodic' | 'conditional';
  
  /** 归档条件 */
  archivingConditions: string[];
  
  /** 删除策略 */
  deletionPolicy: 'manual' | 'automatic' | 'never';
}

/**
 * 并行协调结果
 */
export interface ParallelCoordinationResult {
  /** 协调ID */
  id: string;
  
  /** 协调状态 */
  status: 'planned' | 'executing' | 'completed' | 'failed';
  
  /** 协调任务 */
  coordinatedTasks: CoordinatedTask[];
  
  /** 协调策略 */
  coordinationStrategy: CoordinationStrategy;
  
  /** 性能指标 */
  performanceMetrics: CoordinationMetrics;
  
  /** 宪法合规性 */
  constitutionalCompliance: ComplianceAssessment;
  
  /** 完成时间戳 */
  timestamp: number;
}

/**
 * 协调任务
 */
export interface CoordinatedTask {
  /** 任务ID */
  taskId: string;
  
  /** 分配Agent */
  assignedAgent: string;
  
  /** 开始时间 */
  startTime?: number;
  
  /** 完成时间 */
  completionTime?: number;
  
  /** 执行状态 */
  executionStatus: 'pending' | 'running' | 'completed' | 'failed';
  
  /** 依赖任务 */
  dependencies: string[];
  
  /** 同步点 */
  synchronizationPoints: SynchronizationPoint[];
}

/**
 * 协调策略
 */
export interface CoordinationStrategy {
  /** 策略类型 */
  type: 'master-slave' | 'peer-to-peer' | 'hierarchical' | 'decentralized';
  
  /** 通信模式 */
  communicationPattern: 'broadcast' | 'point-to-point' | 'multicast' | 'hybrid';
  
  /** 同步机制 */
  synchronizationMechanism: 'barrier' | 'checkpoint' | 'message' | 'shared-state';
  
  /** 容错机制 */
  faultToleranceMechanism: 'replication' | 'checkpointing' | 'retry' | 'fallback';
}

/**
 * 协调指标
 */
export interface CoordinationMetrics {
  /** 总体完成度 (%) */
  overallCompletion: number;
  
  /** 平均进度偏差 (%) */
  averageProgressDeviation: number;
  
  /** 通信开销 (字节) */
  communicationOverhead: number;
  
  /** 同步等待时间 (ms) */
  synchronizationWaitTime: number;
  
  /** 资源利用率 (%) */
  resourceUtilization: number;
  
  /** 宪法合规率 (%) */
  constitutionalComplianceRate: number;
}

/**
 * 同步点
 */
export interface SynchronizationPoint {
  /** 同步点ID */
  id: string;
  
  /** 同步类型 */
  type: 'start' | 'checkpoint' | 'barrier' | 'completion';
  
  /** 参与任务 */
  participatingTasks: string[];
  
  /** 同步条件 */
  synchronizationCondition: string;
  
  /** 超时设置 (ms) */
  timeout: number;
  
  /** 失败处理策略 */
  failureHandlingStrategy: 'retry' | 'skip' | 'rollback' | 'escalate';
}

/**
 * Agent冲突描述
 */
export interface AgentConflict {
  /** 冲突ID */
  id: string;
  
  /** 冲突类型 */
  type: 'resource' | 'authority' | 'interpretation' | 'priority' | 'timing';
  
  /** 冲突描述 */
  description: string;
  
  /** 严重程度 (1-10) */
  severity: number;
  
  /** 发生时间 */
  occurrenceTime: number;
  
  /** 影响范围 */
  impactScope: ImpactScope;
  
  /** 相关宪法条款 */
  relatedClauses: string[];
  
  /** 历史类似冲突 */
  historicalSimilarConflicts?: HistoricalConflict[];
}

/**
 * 影响范围
 */
export interface ImpactScope {
  /** 影响Agent列表 */
  affectedAgents: string[];
  
  /** 影响任务列表 */
  affectedTasks: string[];
  
  /** 影响资源列表 */
  affectedResources: string[];
  
  /** 影响时间范围 */
  affectedTimeRange: TimeRange;
  
  /** 影响严重度 (1-10) */
  impactSeverity: number;
}

/**
 * 历史冲突
 */
export interface HistoricalConflict {
  /** 冲突ID */
  conflictId: string;
  
  /** 冲突时间 */
  conflictTime: number;
  
  /** 冲突类型 */
  conflictType: string;
  
  /** 解决方案 */
  resolution: string;
  
  /** 解决效果 */
  resolutionEffectiveness: number;
  
  /** 经验教训 */
  lessonsLearned: string[];
}

/**
 * 冲突方信息
 */
export interface ConflictParty {
  /** Agent ID */
  agentId: string;
  
  /** Agent名称 */
  agentName: string;
  
  /** 立场描述 */
  position: string;
  
  /** 证据支持 */
  supportingEvidence: Evidence[];
  
  /** 宪法依据 */
  constitutionalBasis: string[];
  
  /** 可接受解决方案 */
  acceptableSolutions: string[];
}

/**
 * 证据
 */
export interface Evidence {
  /** 证据ID */
  id: string;
  
  /** 证据类型 */
  type: 'log' | 'metric' | 'document' | 'testimony';
  
  /** 证据内容 */
  content: string;
  
  /** 可信度 (0-1) */
  credibility: number;
  
  /** 来源 */
  source: string;
  
  /** 时间戳 */
  timestamp: number;
}

/**
 * 仲裁决议
 */
export interface ArbitrationResolution {
  /** 决议ID */
  id: string;
  
  /** 目标冲突 */
  targetConflictId: string;
  
  /** 决议内容 */
  resolution: string;
  
  /** 决议依据 */
  basis: ResolutionBasis;
  
  /** 执行要求 */
  executionRequirements: ExecutionRequirement[];
  
  /** 监控要求 */
  monitoringRequirements: MonitoringRequirement[];
  
  /** 宪法合规性 */
  constitutionalCompliance: ComplianceAssessment;
  
  /** 决议时间戳 */
  timestamp: number;
}

/**
 * 决议依据
 */
export interface ResolutionBasis {
  /** 宪法条款 */
  constitutionalClauses: string[];
  
  /** 历史先例 */
  historicalPrecedents: HistoricalPrecedent[];
  
  /** 逻辑推理 */
  logicalReasoning: string;
  
  /** 公平性原则 */
  fairnessPrinciples: string[];
  
  /** 效率考虑 */
  efficiencyConsiderations: string[];
}

/**
 * 历史先例
 */
export interface HistoricalPrecedent {
  /** 先例ID */
  precedentId: string;
  
  /** 类似冲突 */
  similarConflict: string;
  
  /** 采用方案 */
  adoptedSolution: string;
  
  /** 实施效果 */
  implementationEffect: number;
  
  /** 适用性分析 */
  applicabilityAnalysis: string;
}

/**
 * 执行要求
 */
export interface ExecutionRequirement {
  /** 要求ID */
  id: string;
  
  /** 要求描述 */
  description: string;
  
  /** 责任方 */
  responsibleParty: string;
  
  /** 完成标准 */
  completionCriteria: string[];
  
  /** 截止时间 */
  deadline: number;
  
  /** 验证方法 */
  verificationMethod: string;
}

/**
 * 监控要求
 */
export interface MonitoringRequirement {
  /** 要求ID */
  id: string;
  
  /** 监控指标 */
  metrics: MonitoringMetric[];
  
  /** 监控频率 */
  monitoringFrequency: number;
  
  /** 告警阈值 */
  alertThresholds: AlertThreshold[];
  
  /** 报告要求 */
  reportingRequirements: ReportingRequirement[];
}

/**
 * 告警阈值
 */
export interface AlertThreshold {
  /** 指标名称 */
  metricName: string;
  
  /** 警告阈值 */
  warningThreshold: number;
  
  /** 严重阈值 */
  criticalThreshold: number;
  
  /** 持续时间阈值 (ms) */
  durationThreshold: number;
}

/**
 * 报告要求
 */
export interface ReportingRequirement {
  /** 报告类型 */
  reportType: 'status' | 'compliance' | 'performance' | 'incident';
  
  /** 报告频率 */
  reportingFrequency: number;
  
  /** 报告格式 */
  reportFormat: 'json' | 'html' | 'pdf' | 'markdown';
  
  /** 接收方 */
  recipients: string[];
  
  /** 包含内容 */
  includedContent: string[];
}

/**
 * 系统资源定义
 */
export interface SystemResource {
  /** 资源类型 */
  type: 'cpu' | 'memory' | 'network' | 'storage' | 'api-quota' | 'llm-tokens';
  
  /** 资源标识符 */
  identifier: string;
  
  /** 总容量 */
  totalCapacity: number;
  
  /** 当前使用量 */
  currentUsage: number;
  
  /** 预留量 */
  reservedAmount: number;
  
  /** 可用量 */
  availableAmount: number;
  
  /** 单位 */
  unit: string;
  
  /** 重要程度 (1-10) */
  importance: number;
}

/**
 * 资源竞争者
 */
export interface ResourceCompetitor {
  /** Agent ID */
  agentId: string;
  
  /** 竞争需求 */
  demand: number;
  
  /** 优先级 (1-10) */
  priority: number;
  
  /** 宪法依据 */
  constitutionalBasis: string[];
  
  /** 替代方案 */
  alternativeOptions: AlternativeOption[];
  
  /** 协商意愿 */
  willingnessToNegotiate: boolean;
}

/**
 * 替代选项
 */
export interface AlternativeOption {
  /** 选项ID */
  id: string;
  
  /** 选项描述 */
  description: string;
  
  /** 性能影响 */
  performanceImpact: number;
  
  /** 成本影响 */
  costImpact: number;
  
  /** 可行性 */
  feasibility: number;
}

/**
 * 资源分配方案
 */
export interface ResourceAllocation {
  /** 分配ID */
  id: string;
  
  /** 目标资源 */
  targetResource: string;
  
  /** 分配方案 */
  allocations: IndividualAllocation[];
  
  /** 分配依据 */
  allocationBasis: string;
  
  /** 监控配置 */
  monitoringConfiguration: MonitoringConfig;
  
  /** 重新评估条件 */
  reevaluationConditions: string[];
  
  /** 分配时间戳 */
  timestamp: number;
}

/**
 * 个体分配
 */
export interface IndividualAllocation {
  /** Agent ID */
  agentId: string;
  
  /** 分配量 */
  allocatedAmount: number;
  
  /** 分配期限 */
  allocationPeriod: TimeRange;
  
  /** 使用限制 */
  usageLimitations: string[];
  
  /** 回收条件 */
  reclaimConditions: string[];
}

/**
 * 工作重叠描述
 */
export interface WorkOverlap {
  /** 重叠ID */
  id: string;
  
  /** 重叠类型 */
  type: 'task' | 'responsibility' | 'authority' | 'timeline';
  
  /** 重叠描述 */
  description: string;
  
  /** 重叠程度 (0-1) */
  overlapDegree: number;
  
  /** 影响分析 */
  impactAnalysis: OverlapImpact;
  
  /** 相关任务 */
  relatedTasks: string[];
  
  /** 涉及Agent */
  involvedAgents: string[];
}

/**
 * 重叠影响
 */
export interface OverlapImpact {
  /** 效率影响 */
  efficiencyImpact: number;
  
  /** 质量影响 */
  qualityImpact: number;
  
  /** 资源浪费 */
  resourceWaste: number;
  
  /** 冲突风险 */
  conflictRisk: number;
  
  /** 宪法合规风险 */
  constitutionalRisk: number;
}

/**
 * 调解方案
 */
export interface MediationPlan {
  /** 计划ID */
  id: string;
  
  /** 目标重叠 */
  targetOverlapId: string;
  
  /** 调解方案 */
  mediationSolution: string;
  
  /** 责任划分 */
  responsibilityDivision: ResponsibilityMap[];
  
  /** 协调机制 */
  coordinationMechanism: CoordinationMechanism;
  
  /** 监控评估 */
  monitoringEvaluation: EvaluationPlan;
  
  /** 宪法合规性 */
  constitutionalCompliance: ComplianceAssessment;
  
  /** 计划时间戳 */
  timestamp: number;
}

/**
 * 责任映射
 */
export interface ResponsibilityMap {
  /** Agent ID */
  agentId: string;
  
  /** 主要责任 */
  primaryResponsibilities: string[];
  
  /** 次要责任 */
  secondaryResponsibilities: string[];
  
  /** 协调责任 */
  coordinationResponsibilities: string[];
  
  /** 汇报关系 */
  reportingRelationships: string[];
  
  /** 决策权限 */
  decisionAuthority: string[];
}

/**
 * 协调机制
 */
export interface CoordinationMechanism {
  /** 协调类型 */
  type: 'regular' | 'ad-hoc' | 'escalation' | 'crisis';
  
  /** 协调频率 */
  coordinationFrequency: number;
  
  /** 协调渠道 */
  coordinationChannels: string[];
  
  /** 决策流程 */
  decisionProcess: string;
  
  /** 冲突解决流程 */
  conflictResolutionProcess: string;
}

/**
 * 评估计划
 */
export interface EvaluationPlan {
  /** 评估指标 */
  evaluationMetrics: EvaluationMetric[];
  
  /** 评估频率 */
  evaluationFrequency: number;
  
  /** 评估方法 */
  evaluationMethod: string;
  
  /** 改进阈值 */
  improvementThresholds: ImprovementThreshold[];
  
  /** 持续改进流程 */
  continuousImprovementProcess: string;
}

/**
 * 评估指标
 */
export interface EvaluationMetric {
  /** 指标名称 */
  name: string;
  
  /** 指标描述 */
  description: string;
  
  /** 目标值 */
  targetValue: number;
  
  /** 当前值 */
  currentValue: number;
  
  /** 权重 */
  weight: number;
  
  /** 数据源 */
  dataSource: string;
}

/**
 * 改进阈值
 */
export interface ImprovementThreshold {
  /** 指标名称 */
  metricName: string;
  
  /** 满意阈值 */
  satisfactoryThreshold: number;
  
  /** 优秀阈值 */
  excellentThreshold: number;
  
  /** 改进目标 */
  improvementTarget: number;
  
  /** 时间框架 */
  timeframe: number;
}

/**
 * 降级级别定义
 */
export type DegradationLevel = 
  | 'level-1'  // 轻微降级，仅非核心功能受限
  | 'level-2'  // 中度降级，部分核心功能受限
  | 'level-3'  // 严重降级，多数核心功能受限
  | 'level-4'  // 紧急降级，仅关键功能可用
  | 'level-5'; // 生存模式，仅基础功能可用

/**
 * 降级原因
 */
export interface DegradationReason {
  /** 原因类型 */
  type: 'resource' | 'performance' | 'error' | 'security' | 'constitutional';
  
  /** 原因描述 */
  description: string;
  
  /** 严重程度 (1-10) */
  severity: number;
  
  /** 影响范围 */
  impactScope: ImpactScope;
  
  /** 预期持续时间 (ms) */
  expectedDuration: number;
  
  /** 根本原因分析 */
  rootCauseAnalysis: string;
}

/**
 * 系统健康度报告
 */
export interface SystemHealthReport {
  /** 报告时间 */
  timestamp: number;
  
  /** 总体健康度 (0-100) */
  overallHealth: number;
  
  /** 各Agent健康度 */
  agentHealth: Record<string, AgentHealth>;
  
  /** 资源使用情况 */
  resourceUsage: ResourceUsageSummary;
  
  /** 性能指标 */
  performanceMetrics: PerformanceMetrics;
  
  /** 错误统计 */
  errorStatistics: ErrorStats;
  
  /** 宪法合规状态 */
  constitutionalCompliance: SystemCompliance;
  
  /** 风险预警 */
  riskWarnings: RiskWarning[];
  
  /** 建议措施 */
  recommendedActions: RecommendedAction[];
}

/**
 * 资源使用汇总
 */
export interface ResourceUsageSummary {
  /** CPU使用率 (%) */
  cpuUsage: number;
  
  /** 内存使用率 (%) */
  memoryUsage: number;
  
  /** 网络使用率 (%) */
  networkUsage: number;
  
  /** 存储使用率 (%) */
  storageUsage: number;
  
  /** API配额使用率 (%) */
  apiQuotaUsage: number;
  
  /** LLM Token使用率 (%) */
  llmTokenUsage: number;
  
  /** 资源瓶颈 */
  resourceBottlenecks: ResourceBottleneck[];
}

/**
 * 资源瓶颈
 */
export interface ResourceBottleneck {
  /** 资源类型 */
  resourceType: string;
  
  /** 使用率 (%) */
  usageRate: number;
  
  /** 影响范围 */
  impactScope: string[];
  
  /** 严重程度 (1-10) */
  severity: number;
  
  /** 缓解建议 */
  mitigationSuggestions: string[];
}

/**
 * 性能指标
 */
export interface PerformanceMetrics {
  /** 平均响应时间 (ms) */
  avgResponseTime: number;
  
  /** 吞吐量 (请求/秒) */
  throughput: number;
  
  /** 错误率 (%) */
  errorRate: number;
  
  /** 可用性 (%) */
  availability: number;
  
  /** 延迟分布 */
  latencyDistribution: LatencyDistribution;
  
  /** 容量规划 */
  capacityPlanning: CapacityPlan;
}

/**
 * 延迟分布
 */
export interface LatencyDistribution {
  /** P50 (中位数) */
  p50: number;
  
  /** P90 */
  p90: number;
  
  /** P95 */
  p95: number;
  
  /** P99 */
  p99: number;
  
  /** 最大延迟 */
  max: number;
  
  /** 最小延迟 */
  min: number;
}

/**
 * 容量规划
 */
export interface CapacityPlan {
  /** 当前容量 */
  currentCapacity: number;
  
  /** 预测需求 */
  projectedDemand: number;
  
  /** 容量缺口 */
  capacityGap: number;
  
  /** 扩展建议 */
  scalingRecommendations: ScalingRecommendation[];
  
  /** 扩展时间框架 */
  scalingTimeframe: TimeRange;
}

/**
 * 扩展建议
 */
export interface ScalingRecommendation {
  /** 建议类型 */
  type: 'horizontal' | 'vertical' | 'optimization' | 'architectural';
  
  /** 建议描述 */
  description: string;
  
  /** 预期效果 */
  expectedImpact: number;
  
  /** 实施成本 (1-10) */
  implementationCost: number;
  
  /** 实施时间 (ms) */
  implementationTime: number;
  
  /** 风险分析 */
  riskAnalysis: RiskAnalysis;
}

/**
 * 错误统计
 */
export interface ErrorStats {
  /** 总错误数 */
  totalErrors: number;
  
  /** 错误类型分布 */
  errorTypeDistribution: Record<string, number>;
  
  /** 错误趋势 */
  errorTrend: ErrorTrend;
  
  /** 平均修复时间 (ms) */
  meanTimeToRepair: number;
  
  /** 错误影响分析 */
  errorImpactAnalysis: ImpactAnalysis;
}

/**
 * 错误趋势
 */
export interface ErrorTrend {
  /** 趋势方向 */
  direction: 'increasing' | 'decreasing' | 'stable';
  
  /** 趋势强度 */
  strength: number;
  
  /** 预测值 */
  forecast: number[];
  
  /** 置信区间 */
  confidenceInterval: ConfidenceInterval;
  
  /** 季节性模式 */
  seasonalPattern: SeasonalPattern;
}

/**
 * 置信区间
 */
export interface ConfidenceInterval {
  /** 下限 */
  lowerBound: number;
  
  /** 上限 */
  upperBound: number;
  
  /** 置信水平 (0-1) */
  confidenceLevel: number;
}

/**
 * 季节性模式
 */
export interface SeasonalPattern {
  /** 周期长度 */
  periodLength: number;
  
  /** 季节性强度 */
  seasonalStrength: number;
  
  /** 趋势成分 */
  trendComponent: number;
  
  /** 残差成分 */
  residualComponent: number;
}

/**
 * 影响分析
 */
export interface ImpactAnalysis {
  /** 业务影响 */
  businessImpact: number;
  
  /** 用户体验影响 */
  userExperienceImpact: number;
  
  /** 系统稳定性影响 */
  systemStabilityImpact: number;
  
  /** 宪法合规影响 */
  constitutionalComplianceImpact: number;
  
  /** 财务影响 */
  financialImpact: number;
}

/**
 * 系统合规状态
 */
export interface SystemCompliance {
  /** 总体合规率 (%) */
  overallComplianceRate: number;
  
  /** 各领域合规率 */
  domainComplianceRates: Record<string, number>;
  
  /** 合规趋势 */
  complianceTrend: ComplianceTrend;
  
  /** 主要违规项 */
  majorViolations: MajorViolation[];
  
  /** 合规改进计划 */
  complianceImprovementPlan: ImprovementPlan;
}

/**
 * 合规趋势
 */
export interface ComplianceTrend {
  /** 趋势方向 */
  direction: 'improving' | 'deteriorating' | 'stable';
  
  /** 变化速率 */
  changeRate: number;
  
  /** 预测合规率 */
  forecastedComplianceRate: number;
  
  /** 达到目标时间 */
  timeToTarget: number;
}

/**
 * 主要违规项
 */
export interface MajorViolation {
  /** 违规ID */
  id: string;
  
  /** 违规条款 */
  violatedClause: string;
  
  /** 违规描述 */
  description: string;
  
  /** 影响范围 */
  impactScope: string[];
  
  /** 修复优先级 (1-10) */
  repairPriority: number;
  
  /** 修复状态 */
  repairStatus: 'pending' | 'in-progress' | 'completed' | 'failed';
}

/**
 * 改进计划
 */
export interface ImprovementPlan {
  /** 计划ID */
  id: string;
  
  /** 计划目标 */
  objectives: string[];
  
  /** 实施步骤 */
  implementationSteps: ImplementationStep[];
  
  /** 责任分配 */
  responsibilityAssignment: ResponsibilityAssignment[];
  
  /** 时间框架 */
  timeframe: TimeRange;
  
  /** 成功标准 */
  successCriteria: string[];
}

/**
 * 责任分配
 */
export interface ResponsibilityAssignment {
  /** Agent ID */
  agentId: string;
  
  /** 责任描述 */
  responsibility: string;
  
  /** 完成标准 */
  completionCriteria: string[];
  
  /** 截止时间 */
  deadline: number;
  
  /** 依赖关系 */
  dependencies: string[];
}

/**
 * 风险预警
 */
export interface RiskWarning {
  /** 预警ID */
  id: string;
  
  /** 预警级别 */
  level: 'info' | 'warning' | 'critical';
  
  /** 预警类型 */
  type: 'performance' | 'security' | 'constitutional' | 'resource';
  
  /** 预警描述 */
  description: string;
  
  /** 影响范围 */
  impactScope: string[];
  
  /** 建议措施 */
  recommendedActions: string[];
  
  /** 紧急程度 (1-10) */
  urgency: number;
}

/**
 * 建议措施
 */
export interface RecommendedAction {
  /** 措施ID */
  id: string;
  
  /** 措施描述 */
  description: string;
  
  /** 措施类型 */
  type: 'immediate' | 'short-term' | 'long-term' | 'preventive';
  
  /** 实施优先级 (1-10) */
  implementationPriority: number;
  
  /** 预期效果 */
  expectedEffect: string;
  
  /** 实施步骤 */
  implementationSteps: ImplementationStep[];
}

/**
 * 降级实施结果
 */
export interface DegradationResult {
  /** 结果ID */
  id: string;
  
  /** 目标降级级别 */
  targetLevel: DegradationLevel;
  
  /** 实施状态 */
  status: 'planned' | 'executing' | 'completed' | 'failed' | 'rolled-back';
  
  /** 实施详情 */
  implementationDetails: ImplementationDetail[];
  
  /** 影响评估 */
  impactAssessment: ImpactAssessment;
  
  /** 宪法合规性 */
  constitutionalCompliance: ComplianceAssessment;
  
  /** 完成时间戳 */
  timestamp: number;
}

/**
 * 实施详情
 */
export interface ImplementationDetail {
  /** 组件名称 */
  component: string;
  
  /** 变更描述 */
  changeDescription: string;
  
  /** 变更前状态 */
  beforeState: string;
  
  /** 变更后状态 */
  afterState: string;
  
  /** 变更时间 */
  changeTime: number;
  
  /** 变更结果 */
  changeResult: 'success' | 'partial' | 'failed';
}

/**
 * 影响评估
 */
export interface ImpactAssessment {
  /** 性能影响 */
  performanceImpact: number;
  
  /** 功能影响 */
  functionalityImpact: number;
  
  /** 用户体验影响 */
  userExperienceImpact: number;
  
  /** 系统稳定性影响 */
  systemStabilityImpact: number;
  
  /** 恢复难度 */
  recoveryDifficulty: number;
}

/**
 * 恢复计划
 */
export interface RecoveryPlan {
  /** 计划ID */
  id: string;
  
  /** 恢复目标 */
  recoveryTarget: RecoveryTarget;
  
  /** 恢复策略 */
  recoveryStrategy: RecoveryStrategy;
  
  /** 恢复步骤 */
  recoverySteps: RecoveryStep[];
  
  /** 资源需求 */
  resourceRequirements: ResourceRequirement[];
  
  /** 成功标准 */
  successCriteria: string[];
  
  /** 风险分析 */
  riskAnalysis: RiskAnalysis;
}

/**
 * 恢复目标
 */
export interface RecoveryTarget {
  /** 目标状态 */
  targetState: string;
  
  /** 恢复时间目标 (ms) */
  recoveryTimeObjective: number;
  
  /** 恢复点目标 */
  recoveryPointObjective: number;
  
  /** 数据一致性要求 */
  dataConsistencyRequirements: string[];
  
  /** 服务级别目标 */
  serviceLevelObjectives: ServiceLevelObjective[];
}

/**
 * 服务级别目标
 */
export interface ServiceLevelObjective {
  /** 指标名称 */
  metricName: string;
  
  /** 目标值 */
  targetValue: number;
  
  /** 容忍窗口 */
  toleranceWindow: number;
  
  /** 测量方法 */
  measurementMethod: string;
  
  /** 报告频率 */
  reportingFrequency: number;
}

/**
 * 恢复策略
 */
export interface RecoveryStrategy {
  /** 策略类型 */
  type: 'hot' | 'warm' | 'cold' | 'parallel' | 'sequential';
  
  /** 策略描述 */
  description: string;
  
  /** 预期恢复时间 */
  expectedRecoveryTime: number;
  
  /** 数据丢失容忍度 */
  dataLossTolerance: number;
  
  /** 验证方法 */
  verificationMethod: string;
}

/**
 * 恢复步骤
 */
export interface RecoveryStep {
  /** 步骤序号 */
  step: number;
  
  /** 步骤描述 */
  description: string;
  
  /** 执行Agent */
  executingAgent: string;
  
  /** 预期耗时 (ms) */
  expectedDuration: number;
  
  /** 成功标准 */
  successCriteria: string[];
  
  /** 回滚步骤 */
  rollbackStep?: RollbackStep;
}

/**
 * 恢复执行结果
 */
export interface RecoveryResult {
  /** 结果ID */
  id: string;
  
  /** 恢复计划ID */
  recoveryPlanId: string;
  
  /** 执行状态 */
  status: 'planned' | 'executing' | 'completed' | 'failed' | 'partial';
  
  /** 执行详情 */
  executionDetails: ExecutionDetail[];
  
  /** 性能指标 */
  performanceMetrics: RecoveryMetrics;
  
  /** 宪法合规性 */
  constitutionalCompliance: ComplianceAssessment;
  
  /** 完成时间戳 */
  timestamp: number;
}

/**
 * 执行详情
 */
export interface ExecutionDetail {
  /** 步骤序号 */
  step: number;
  
  /** 开始时间 */
  startTime: number;
  
  /** 结束时间 */
  endTime: number;
  
  /** 执行结果 */
  result: 'success' | 'partial' | 'failed' | 'skipped';
  
  /** 执行日志 */
  executionLog: string[];
  
  /** 问题记录 */
  issues: IssueRecord[];
}

/**
 * 恢复指标
 */
export interface RecoveryMetrics {
  /** 总恢复时间 (ms) */
  totalRecoveryTime: number;
  
  /** 平均步骤时间 (ms) */
  averageStepTime: number;
  
  /** 成功率 (%) */
  successRate: number;
  
  /** 数据完整性 (%) */
  dataIntegrity: number;
  
  /** 服务可用性 (%) */
  serviceAvailability: number;
}

/**
 * 问题记录
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
 * 系统状态
 */
export interface SystemState {
  /** 状态ID */
  id: string;
  
  /** 状态描述 */
  description: string;
  
  /** 状态类型 */
  type: 'operational' | 'degraded' | 'recovering' | 'failed' | 'maintenance';
  
  /** 状态指标 */
  stateMetrics: StateMetric[];
  
  /** 宪法合规状态 */
  constitutionalCompliance: ComplianceAssessment;
  
  /** 状态时间戳 */
  timestamp: number;
}

/**
 * 状态指标
 */
export interface StateMetric {
  /** 指标名称 */
  name: string;
  
  /** 当前值 */
  currentValue: number;
  
  /** 目标值 */
  targetValue: number;
  
  /** 单位 */
  unit: string;
  
  /** 趋势 */
  trend: 'improving' | 'deteriorating' | 'stable';
  
  /** 重要程度 (1-10) */
  importance: number;
}

/**
 * 恢复可行性评估
 */
export interface RecoveryFeasibility {
  /** 评估ID */
  id: string;
  
  /** 可行性等级 */
  feasibilityLevel: 'high' | 'medium' | 'low' | 'impossible';
  
  /** 可行性评分 (0-100) */
  feasibilityScore: number;
  
  /** 可行性分析 */
  feasibilityAnalysis: FeasibilityAnalysis;
  
  /** 建议方案 */
  recommendedApproach: RecommendedApproach;
  
  /** 风险评估 */
  riskAssessment: RiskAnalysis;
  
  /** 宪法合规性 */
  constitutionalCompliance: ComplianceAssessment;
}

/**
 * 可行性分析
 */
export interface FeasibilityAnalysis {
  /** 技术可行性 */
  technicalFeasibility: number;
  
  /** 资源可行性 */
  resourceFeasibility: number;
  
  /** 时间可行性 */
  temporalFeasibility: number;
  
  /** 组织可行性 */
  organizationalFeasibility: number;
  
  /** 宪法可行性 */
  constitutionalFeasibility: number;
  
  /** 约束条件 */
  constraints: Constraint[];
}

/**
 * 约束条件
 */
export interface Constraint {
  /** 约束类型 */
  type: 'technical' | 'resource' | 'time' | 'constitutional' | 'organizational';
  
  /** 约束描述 */
  description: string;
  
  /** 约束强度 (1-10) */
  strength: number;
  
  /** 缓解可能性 */
  mitigationPossibility: number;
  
  /** 影响范围 */
  impactScope: string[];
}

/**
 * 建议方案
 */
export interface RecommendedApproach {
  /** 方案ID */
  id: string;
  
  /** 方案描述 */
  description: string;
  
  /** 方案类型 */
  type: 'full' | 'partial' | 'phased' | 'alternative';
  
  /** 预期效果 */
  expectedEffectiveness: number;
  
  /** 实施复杂度 (1-10) */
  implementationComplexity: number;
  
  /** 实施步骤 */
  implementationSteps: ImplementationStep[];
}

/**
 * 系统操作
 */
export interface SystemOperation {
  /** 操作ID */
  id: string;
  
  /** 操作类型 */
  type: 'strategy_formulation' | 'task_assignment' | 'conflict_arbitration' | 'degradation_implementation';
  
  /** 操作描述 */
  description: string;
  
  /** 操作数据 */
  data: any;
  
  /** 操作时间 */
  timestamp: number;
  
  /** 宪法依据 */
  constitutionalBasis?: string[];
}

/**
 * 合规性验证结果
 */
export interface ComplianceVerification {
  /** 验证ID */
  id: string;
  
  /** 目标操作 */
  targetOperation: SystemOperation;
  
  /** 验证结果 */
  verificationResult: 'compliant' | 'non-compliant' | 'requires_clarification';
  
  /** 验证详情 */
  verificationDetails: VerificationDetail[];
  
  /** 建议修正 */
  suggestedCorrections: CorrectionSuggestion[];
  
  /** 验证时间戳 */
  timestamp: number;
}

/**
 * 验证详情
 */
export interface VerificationDetail {
  /** 验证项 */
  verificationItem: string;
  
  /** 验证方法 */
  verificationMethod: string;
  
  /** 验证结果 */
  result: 'pass' | 'fail' | 'warning';
  
  /** 结果详情 */
  resultDetails: string;
  
  /** 证据 */
  evidence: Evidence[];
}

/**
 * 宪法修正提案
 */
export interface ConstitutionalAmendment {
  /** 修正ID */
  id: string;
  
  /** 目标条款 */
  targetClause: string;
  
  /** 修正内容 */
  amendmentContent: string;
  
  /** 修正类型 */
  type: 'addition' | 'modification' | 'deletion' | 'clarification';
  
  /** 影响分析 */
  impactAnalysis: AmendmentImpact;
  
  /** 过渡方案 */
  transitionPlan: TransitionStrategy;
  
  /** 验证要求 */
  verificationRequirements: VerificationRequirement[];
  
  /** 回滚机制 */
  rollbackMechanism: RollbackPlan;
}

/**
 * 修正影响分析
 */
export interface AmendmentImpact {
  /** 技术影响 */
  technicalImpact: ImpactAssessment;
  
  /** 流程影响 */
  proceduralImpact: ImpactAssessment;
  
  /** 组织影响 */
  organizationalImpact: ImpactAssessment;
  
  /** 系统影响 */
  systemImpact: ImpactAssessment;
  
  /** 宪法一致性 */
  constitutionalConsistency: ConsistencyAnalysis;
}

/**
 * 一致性分析
 */
export interface ConsistencyAnalysis {
  /** 内部一致性 */
  internalConsistency: number;
  
  /** 外部一致性 */
  externalConsistency: number;
  
  /** 逻辑一致性 */
  logicalConsistency: number;
  
  /** 实践一致性 */
  practicalConsistency: number;
  
  /** 一致性问题 */
  consistencyIssues: ConsistencyIssue[];
}

/**
 * 一致性问题
 */
export interface ConsistencyIssue {
  /** 问题描述 */
  description: string;
  
  /** 影响条款 */
  affectedClauses: string[];
  
  /** 严重程度 (1-10) */
  severity: number;
  
  /** 解决建议 */
  resolutionSuggestions: string[];
}

/**
 * 过渡策略
 */
export interface TransitionStrategy {
  /** 策略ID */
  id: string;
  
  /** 策略类型 */
  type: 'immediate' | 'gradual' | 'parallel' | 'phased';
  
  /** 策略描述 */
  description: string;
  
  /** 过渡步骤 */
  transitionSteps: TransitionStep[];
  
  /** 回滚计划 */
  rollbackPlan: RollbackPlan;
  
  /** 成功标准 */
  successCriteria: string[];
}

/**
 * 过渡步骤
 */
export interface TransitionStep {
  /** 步骤序号 */
  step: number;
  
  /** 步骤描述 */
  description: string;
  
  /** 开始条件 */
  startCondition: string;
  
  /** 完成标准 */
  completionCriteria: string[];
  
  /** 验证检查 */
  verificationChecks: VerificationCheck[];
  
  /** 风险控制 */
  riskControls: RiskControl[];
}

/**
 * 风险控制
 */
export interface RiskControl {
  /** 控制ID */
  id: string;
  
  /** 控制类型 */
  type: 'preventive' | 'detective' | 'corrective';
  
  /** 控制描述 */
  description: string;
  
  /** 控制效果 */
  controlEffectiveness: number;
  
  /** 实施要求 */
  implementationRequirements: string[];
}

/**
 * 验证要求
 */
export interface VerificationRequirement {
  /** 要求ID */
  id: string;
  
  /** 要求描述 */
  description: string;
  
  /** 验证方法 */
  verificationMethod: string;
  
  /** 通过标准 */
  passCriteria: string[];
  
  /** 责任方 */
  responsibleParty: string;
  
  /** 截止时间 */
  deadline: number;
}

/**
 * 修正理由
 */
export interface AmendmentJustification {
  /** 理由ID */
  id: string;
  
  /** 问题描述 */
  problemDescription: string;
  
  /** 现状分析 */
  currentSituationAnalysis: string;
  
  /** 预期改进 */
  expectedImprovements: string[];
  
  /** 替代方案分析 */
  alternativeAnalysis: AlternativeAnalysis;
  
  /** 成本效益分析 */
  costBenefitAnalysis: CostBenefitAnalysis;
  
  /** 宪法依据 */
  constitutionalBasis: string[];
}

/**
 * 替代方案分析
 */
export interface AlternativeAnalysis {
  /** 考虑方案 */
  consideredAlternatives: AlternativeOption[];
  
  /** 方案比较 */
  comparisonMatrix: ComparisonMatrix;
  
  /** 推荐方案 */
  recommendedAlternative: string;
  
  /** 推荐理由 */
  recommendationReason: string;
}

/**
 * 比较矩阵
 */
export interface ComparisonMatrix {
  /** 比较维度 */
  dimensions: ComparisonDimension[];
  
  /** 方案评分 */
  alternativeScores: AlternativeScore[];
  
  /** 权重分配 */
  weightAllocation: WeightAllocation[];
}

/**
 * 比较维度
 */
export interface ComparisonDimension {
  /** 维度名称 */
  name: string;
  
  /** 维度描述 */
  description: string;
  
  /** 重要程度 (1-10) */
  importance: number;
  
  /** 测量方法 */
  measurementMethod: string;
  
  /** 数据源 */
  dataSource: string;
}

/**
 * 方案评分
 */
export interface AlternativeScore {
  /** 方案名称 */
  alternativeName: string;
  
  /** 维度评分 */
  dimensionScores: DimensionScore[];
  
  /** 总分 */
  totalScore: number;
  
  /** 排名 */
  rank: number;
}

/**
 * 维度评分
 */
export interface DimensionScore {
  /** 维度名称 */
  dimensionName: string;
  
  /** 评分值 */
  score: number;
  
  /** 评分依据 */
  scoringBasis: string;
  
  /** 置信度 (0-1) */
  confidence: number;
}

/**
 * 权重分配
 */
export interface WeightAllocation {
  /** 维度名称 */
  dimensionName: string;
  
  /** 权重值 */
  weight: number;
  
  /** 分配理由 */
  allocationReason: string;
  
  /** 敏感性分析 */
  sensitivityAnalysis: SensitivityAnalysis;
}

/**
 * 敏感性分析
 */
export interface SensitivityAnalysis {
  /** 权重变化范围 */
  weightVariationRange: [number, number];
  
  /** 评分变化范围 */
  scoreVariationRange: [number, number];
  
  /** 敏感维度 */
  sensitiveDimensions: string[];
  
  /** 稳定性分析 */
  stabilityAnalysis: string;
}

/**
 * 成本效益分析
 */
export interface CostBenefitAnalysis {
  /** 实施成本 */
  implementationCosts: CostItem[];
  
  /** 运营成本 */
  operationalCosts: CostItem[];
  
  /** 预期收益 */
  expectedBenefits: BenefitItem[];
  
  /** 投资回报率 */
  returnOnInvestment: number;
  
  /** 回收期 (月) */
  paybackPeriod: number;
  
  /** 净现值 */
  netPresentValue: number;
}

/**
 * 成本项目
 */
export interface CostItem {
  /** 成本类型 */
  type: 'one-time' | 'recurring' | 'variable' | 'fixed';
  
  /** 成本描述 */
  description: string;
  
  /** 成本金额 */
  amount: number;
  
  /** 货币单位 */
  currency: string;
  
  /** 发生时间 */
  occurrenceTime: number;
  
  /** 确定性 (0-1) */
  certainty: number;
}

/**
 * 收益项目
 */
export interface BenefitItem {
  /** 收益类型 */
  type: 'quantitative' | 'qualitative' | 'strategic' | 'operational';
  
  /** 收益描述 */
  description: string;
  
  /** 收益金额 */
  amount?: number;
  
  /** 货币单位 */
  currency?: string;
  
  /** 实现时间 */
  realizationTime: number;
  
  /** 确定性 (0-1) */
  certainty: number;
}

/**
 * 修正执行结果
 */
export interface AmendmentResult {
  /** 结果ID */
  id: string;
  
  /** 目标修正 */
  targetAmendment: ConstitutionalAmendment;
  
  /** 执行状态 */
  status: 'planned' | 'executing' | 'completed' | 'failed' | 'rolled-back';
  
  /** 执行详情 */
  executionDetails: ExecutionDetail[];
  
  /** 影响评估 */
  impactAssessment: ImpactAssessment;
  
  /** 宪法合规性 */
  constitutionalCompliance: ComplianceAssessment;
  
  /** 完成时间戳 */
  timestamp: number;
}

/**
 * 解释上下文
 */
export interface InterpretationContext {
  /** 上下文ID */
  id: string;
  
  /** 问题背景 */
  problemBackground: string;
  
  /** 相关案例 */
  relevantCases: RelevantCase[];
  
  /** 系统状态 */
  systemState: SystemState;
  
  /** 用户需求 */
  userRequirements: string[];
  
  /** 宪法环境 */
  constitutionalEnvironment: ConstitutionalEnvironment;
}

/**
 * 相关案例
 */
export interface RelevantCase {
  /** 案例ID */
  caseId: string;
  
  /** 案例描述 */
  description: string;
  
  /** 相似度 (0-1) */
  similarity: number;
  
  /** 适用性分析 */
  applicabilityAnalysis: string;
  
  /** 参考价值 */
  referenceValue: number;
}

/**
 * 宪法环境
 */
export interface ConstitutionalEnvironment {
  /** 生效条款 */
  activeClauses: string[];
  
  /** 历史解释 */
  historicalInterpretations: HistoricalInterpretation[];
  
  /** 司法倾向 */
  judicialTendencies: string[];
  
  /** 系统惯例 */
  systemConventions: string[];
  
  /** 环境约束 */
  environmentalConstraints: string[];
}

/**
 * 历史解释
 */
export interface HistoricalInterpretation {
  /** 解释ID */
  interpretationId: string;
  
  /** 解释条款 */
  interpretedClause: string;
  
  /** 解释内容 */
  interpretationContent: string;
  
  /** 解释时间 */
  interpretationTime: number;
  
  /** 解释权威性 */
  interpretationAuthority: number;
  
  /** 引用次数 */
  citationCount: number;
}

/**
 * 解释依据
 */
export interface InterpretationBasis {
  /** 宪法条款依据 */
  constitutionalClauses: string[];
  
  /** 历史先例依据 */
  historicalPrecedents: HistoricalPrecedent[];
  
  /** 系统惯例依据 */
  systemConventions: string[];
  
  /** 逻辑推理依据 */
  logicalReasoning: string;
  
  /** 实践验证依据 */
  practicalValidation: string[];
}

/**
 * 适用范围
 */
export interface ApplicationScope {
  /** 适用对象 */
  applicableSubjects: string[];
  
  /** 适用场景 */
  applicableScenarios: string[];
  
  /** 适用时间范围 */
  applicableTimeRange: TimeRange;
  
  /** 例外情况 */
  exceptions: string[];
  
  /** 限制条件 */
  constraints: string[];
}

/**
 * 宪法解释
 */
export interface ConstitutionalInterpretation {
  /** 解释ID */
  id: string;
  
  /** 目标条款 */
  targetClause: string;
  
  /** 解释内容 */
  interpretation: string;
  
  /** 解释类型 */
  type: 'literal' | 'contextual' | 'purposive' | 'systematic';
  
  /** 解释依据 */
  interpretationBasis: InterpretationBasis;
  
  /** 适用范围 */
  applicationScope: ApplicationScope;
  
  /** 宪法合规性 */
  constitutionalCompliance: ComplianceAssessment;
  
  /** 发布时间 */
  publicationTime: number;
  
  /** 解释权威性 */
  interpretationAuthority: number;
  
  /** 引用次数 */
  citationCount: number;
}

// ==================== 内阁总理Agent接口 ====================

/**
 * 内阁总理Agent接口 - L2协调层核心Agent
 * 宪法依据: §184战略协调公理、§185降级与恢复机制
 * 版本: v1.0.0
 */
export interface IPrimeMinisterAgent extends IAgentBase {
  // === 战略协作规划 ===
  /**
   * 制定协作策略
   * @param task 待协作任务
   * @param context 任务上下文
   * @returns 协作策略方案
   */
  formulateCollaborationStrategy(
    task: AgentTask,
    context?: TaskContext
  ): Promise<CollaborationStrategy>;
  
  /**
   * 分配任务给Agent
   * @param task 待分配任务
   * @param availableAgents 可用Agent列表
   * @returns 任务分配结果
   */
  assignTaskToAgent(
    task: AgentTask,
    availableAgents: AvailableAgentInfo[]
  ): Promise<TaskAssignment>;
  
  /**
   * 协调并行任务执行
   * @param tasks 待协调任务列表
   * @param agents 可用Agent列表
   * @returns 并行协调结果
   */
  coordinateParallelTasks(
    tasks: AgentTask[],
    agents: AvailableAgentInfo[]
  ): Promise<ParallelCoordinationResult>;
  
  // === 冲突仲裁与解决 ===
  /**
   * 仲裁Agent冲突
   * @param conflict 冲突描述
   * @param parties 冲突方信息
   * @returns 仲裁决议
   */
  arbitrateAgentConflict(
    conflict: AgentConflict,
    parties: ConflictParty[]
  ): Promise<ArbitrationResolution>;
  
  /**
   * 调解工作重叠
   * @param overlap 工作重叠描述
   * @returns 调解方案
   */
  mediateWorkOverlap(
    overlap: WorkOverlap
  ): Promise<MediationPlan>;
  
  /**
   * 分配系统资源
   * @param resource 目标资源
   * @param competitors 资源竞争者
   * @returns 资源分配方案
   */
  allocateSystemResource(
    resource: SystemResource,
    competitors: ResourceCompetitor[]
  ): Promise<ResourceAllocation>;
  
  // === 系统降级与恢复 ===
  /**
   * 评估系统健康度
   * @returns 系统健康度报告
   */
  evaluateSystemHealth(): Promise<SystemHealthReport>;
  
  /**
   * 实施降级措施
   * @param level 目标降级级别
   * @param reason 降级原因
   * @returns 降级实施结果
   */
  implementDegradation(
    level: DegradationLevel,
    reason: DegradationReason
  ): Promise<DegradationResult>;
  
  /**
   * 规划恢复方案
   * @param state 当前系统状态
   * @returns 恢复计划
   */
  planRecovery(
    state: SystemState
  ): Promise<RecoveryPlan>;
  
  /**
   * 执行恢复操作
   * @param plan 恢复计划
   * @returns 恢复执行结果
   */
  executeRecovery(
    plan: RecoveryPlan
  ): Promise<RecoveryResult>;
  
  /**
   * 评估恢复可行性
   * @param plan 恢复计划
   * @returns 恢复可行性评估
   */
  assessRecoveryFeasibility(
    plan: RecoveryPlan
  ): Promise<RecoveryFeasibility>;
  
  // === 宪法维护与解释 ===
  /**
   * 验证系统操作合规性
   * @param operation 系统操作
   * @returns 合规性验证结果
   */
  verifyOperationCompliance(
    operation: SystemOperation
  ): Promise<ComplianceVerification>;
  
  /**
   * 解释宪法条款
   * @param clause 目标条款
   * @param context 解释上下文
   * @returns 宪法解释
   */
  interpretConstitutionalClause(
    clause: string,
    context: InterpretationContext
  ): Promise<ConstitutionalInterpretation>;
  
  /**
   * 提出宪法修正案
   * @param justification 修正理由
   * @returns 宪法修正提案
   */
  proposeConstitutionalAmendment(
    justification: AmendmentJustification
  ): Promise<ConstitutionalAmendment>;
  
  /**
   * 执行宪法修正
   * @param amendment 宪法修正提案
   * @returns 修正执行结果
   */
  executeConstitutionalAmendment(
    amendment: ConstitutionalAmendment
  ): Promise<AmendmentResult>;
  
  // === 系统状态监控 ===
  /**
   * 监控系统状态变化
   * @returns 系统状态快照
   */
  monitorSystemState(): Promise<SystemState>;
  
  /**
   * 生成合规报告
   * @param timeframe 时间范围
   * @returns 系统合规状态报告
   */
  generateComplianceReport(
    timeframe: TimeRange
  ): Promise<SystemCompliance>;
  
  // === 高级协调方法 ===
  /**
   * 优化协作策略
   * @param strategy 现有协作策略
   * @param performanceMetrics 性能指标
   * @returns 优化后的协作策略
   */
  optimizeCollaborationStrategy(
    strategy: CollaborationStrategy,
    performanceMetrics: CoordinationMetrics
  ): Promise<CollaborationStrategy>;
  
  /**
   * 动态调整任务分配
   * @param assignment 现有任务分配
   * @param agentStatusChanges Agent状态变化
   * @returns 调整后的任务分配
   */
  adjustTaskAssignment(
    assignment: TaskAssignment,
    agentStatusChanges: Record<string, AgentStatus>
  ): Promise<TaskAssignment>;
  
  /**
   * 预测系统风险
   * @param timeframe 预测时间范围
   * @returns 风险分析报告
   */
  predictSystemRisks(
    timeframe: TimeRange
  ): Promise<RiskAnalysis>;
  
  /**
   * 制定应急响应计划
   * @param scenario 应急场景
   * @returns 应急预案
   */
  developContingencyPlan(
    scenario: string
  ): Promise<ContingencyPlan>;
}
