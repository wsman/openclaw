/**
 * 办公厅主任Agent接口类型定义
 * 
 * 宪法依据: §110协作效率公理、§186入口管理公理、§187上下文一致性公理
 * 规范依据: AS-103_办公厅主任Agent接口规范.md
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

import { 
  AvailableAgentInfo,
  TimeRange,
  ComplianceAssessment,
  MonitoringConfig,
  AlertRule,
  VerificationRequirement,
  ResourceRequirement,
  RollbackPlan,
  IdentifiedRisk,
  MitigationStrategy,
  MonitoringMetric,
  ContingencyPlan,
  Evidence,
  ComplianceViolation,
  RecommendedAction,
  ResourceBottleneck,
  ErrorTrend,
  ComplianceTrend,
  ScalingRecommendation,
  ResourceAllocation
} from './IPrimeMinisterAgent';

// ==================== 核心类型定义 ====================

/**
 * 入口类型定义
 */
export type EntryType = 
  | 'user_request'        // 用户请求
  | 'system_event'        // 系统事件
  | 'timer_trigger'       // 定时触发
  | 'external_api'        // 外部API调用
  | 'monitoring_alert'    // 监控告警
  | 'knowledge_update';   // 知识更新

/**
 * 请求来源
 */
export interface RequestSource {
  /** 来源类型 */
  type: EntryType;
  
  /** 来源标识符 */
  identifier: string;
  
  /** 来源元数据 */
  metadata: Record<string, any>;
  
  /** 时间戳 */
  timestamp: number;
  
  /** 优先级 (1-10) */
  priority: number;
  
  /** 宪法依据 */
  constitutionalBasis?: string[];
}

/**
 * 入口点配置
 */
export interface EntryPoint {
  /** 入口点ID */
  id: string;
  
  /** 入口点名称 */
  name: string;
  
  /** 处理协议 */
  protocol: 'http' | 'websocket' | 'queue' | 'event' | 'stream';
  
  /** 端点地址 */
  endpoint: string;
  
  /** 验证配置 */
  authenticationConfig: AuthenticationConfig;
  
  /** 速率限制 */
  rateLimit: RateLimitConfig;
  
  /** 监控配置 */
  monitoring: MonitoringConfig;
  
  /** 可用性状态 */
  availability: AvailabilityStatus;
  
  /** 启用状态 */
  enabled: boolean;
  
  /** 最后活动时间 */
  lastActivityTime: number;
}

/**
 * 验证配置
 */
export interface AuthenticationConfig {
  /** 验证方法 */
  method: 'none' | 'api_key' | 'jwt' | 'oauth2' | 'custom';
  
  /** 验证参数 */
  parameters: Record<string, any>;
  
  /** 验证超时 (ms) */
  timeout: number;
  
  /** 重试次数 */
  retryCount: number;
  
  /** 错误处理策略 */
  errorHandling: ErrorHandlingStrategy;
}

/**
 * 错误处理策略
 */
export interface ErrorHandlingStrategy {
  /** 策略类型 */
  type: 'retry' | 'reject' | 'queue' | 'degrade' | 'redirect';
  
  /** 最大重试次数 */
  maxRetries: number;
  
  /** 重试间隔 (ms) */
  retryInterval: number;
  
  /** 重试退避策略 */
  backoffStrategy: 'constant' | 'linear' | 'exponential';
  
  /** 降级目标 */
  fallbackTarget?: string;
}

/**
 * 速率限制配置
 */
export interface RateLimitConfig {
  /** 每秒请求数限制 */
  requestsPerSecond: number;
  
  /** 每分钟请求数限制 */
  requestsPerMinute: number;
  
  /** 每小时请求数限制 */
  requestsPerHour: number;
  
  /** 并发连接数限制 */
  concurrentConnections: number;
  
  /** 配额重置周期 (ms) */
  quotaResetPeriod: number;
  
  /** 超出限制处理策略 */
  exceedPolicy: 'reject' | 'queue' | 'delay' | 'throttle';
}

/**
 * 可用性状态
 */
export interface AvailabilityStatus {
  /** 总体可用性 (%) */
  overallAvailability: number;
  
  /** 最近错误率 (%) */
  recentErrorRate: number;
  
  /** 平均响应时间 (ms) */
  avgResponseTime: number;
  
  /** 最近宕机时间 */
  recentDowntime: number;
  
  /** 健康检查状态 */
  healthCheckStatus: 'healthy' | 'degraded' | 'unhealthy';
  
  /** 最后检查时间 */
  lastCheckTime: number;
}

/**
 * 路由策略
 */
export interface RoutingStrategy {
  /** 策略ID */
  id: string;
  
  /** 策略类型 */
  type: 'direct' | 'round_robin' | 'least_load' | 'priority_based' | 'context_aware';
  
  /** 匹配规则 */
  matchRules: MatchRule[];
  
  /** 目标Agent列表 */
  targetAgents: string[];
  
  /** 负载均衡配置 */
  loadBalancing: LoadBalancingConfig;
  
  /** 故障转移配置 */
  failover: FailoverConfig;
  
  /** 监控配置 */
  monitoring: MonitoringConfig;
}

/**
 * 匹配规则
 */
export interface MatchRule {
  /** 规则ID */
  id: string;
  
  /** 匹配条件 */
  condition: string;
  
  /** 匹配操作符 */
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex' | 'custom';
  
  /** 匹配值 */
  value: any;
  
  /** 匹配优先级 */
  priority: number;
  
  /** 匹配结果 */
  result: 'accept' | 'reject' | 'redirect' | 'degrade';
}

/**
 * 负载均衡配置
 */
export interface LoadBalancingConfig {
  /** 均衡算法 */
  algorithm: 'round_robin' | 'weighted' | 'least_connections' | 'least_response_time';
  
  /** 权重分配 */
  weights: Record<string, number>;
  
  /** 会话保持 */
  sessionPersistence: SessionPersistenceConfig;
  
  /** 健康检查 */
  healthChecks: HealthCheckConfig[];
  
  /** 动态调整 */
  dynamicAdjustment: DynamicAdjustmentConfig;
}

/**
 * 会话保持配置
 */
export interface SessionPersistenceConfig {
  /** 是否启用 */
  enabled: boolean;
  
  /** 会话类型 */
  type: 'cookie' | 'header' | 'ip' | 'custom';
  
  /** 会话超时 (ms) */
  sessionTimeout: number;
  
  /** 会话标识符 */
  sessionIdentifier: string;
  
  /** 会话存储策略 */
  storageStrategy: 'memory' | 'redis' | 'database';
}

/**
 * 健康检查配置
 */
export interface HealthCheckConfig {
  /** 检查类型 */
  type: 'http' | 'tcp' | 'udp' | 'script' | 'custom';
  
  /** 检查端点 */
  endpoint: string;
  
  /** 检查间隔 (ms) */
  interval: number;
  
  /** 超时时间 (ms) */
  timeout: number;
  
  /** 健康阈值 */
  healthyThreshold: number;
  
  /** 不健康阈值 */
  unhealthyThreshold: number;
  
  /** 成功条件 */
  successConditions: string[];
}

/**
 * 动态调整配置
 */
export interface DynamicAdjustmentConfig {
  /** 是否启用 */
  enabled: boolean;
  
  /** 调整算法 */
  algorithm: 'response_time' | 'error_rate' | 'load' | 'custom';
  
  /** 调整间隔 (ms) */
  adjustmentInterval: number;
  
  /** 最小权重 */
  minWeight: number;
  
  /** 最大权重 */
  maxWeight: number;
  
  /** 调整步长 */
  adjustmentStep: number;
}

/**
 * 故障转移配置
 */
export interface FailoverConfig {
  /** 故障检测 */
  faultDetection: FaultDetectionConfig;
  
  /** 故障转移策略 */
  failoverStrategy: 'immediate' | 'delayed' | 'manual';
  
  /** 故障转移目标 */
  failoverTargets: FailoverTarget[];
  
  /** 故障恢复策略 */
  recoveryStrategy: 'automatic' | 'semi_automatic' | 'manual';
  
  /** 回切配置 */
  fallbackConfig: FallbackConfig;
}

/**
 * 故障检测配置
 */
export interface FaultDetectionConfig {
  /** 检测方法 */
  method: 'heartbeat' | 'ping' | 'response_time' | 'custom';
  
  /** 检测间隔 (ms) */
  interval: number;
  
  /** 检测超时 (ms) */
  timeout: number;
  
  /** 故障阈值 */
  failureThreshold: number;
  
  /** 恢复阈值 */
  recoveryThreshold: number;
  
  /** 检测指标 */
  metrics: string[];
}

/**
 * 故障转移目标
 */
export interface FailoverTarget {
  /** 目标ID */
  id: string;
  
  /** 目标Agent */
  targetAgent: string;
  
  /** 转移条件 */
  transferCondition: string;
  
  /** 转移优先级 */
  priority: number;
  
  /** 预热时间 (ms) */
  warmupTime: number;
  
  /** 验证检查 */
  verificationChecks: VerificationCheck[];
}

/**
 * 回切配置
 */
export interface FallbackConfig {
  /** 是否启用 */
  enabled: boolean;
  
  /** 回切条件 */
  fallbackCondition: string;
  
  /** 回切策略 */
  fallbackStrategy: 'immediate' | 'gradual' | 'scheduled';
  
  /** 回切时间窗口 */
  fallbackWindow: TimeRange;
  
  /** 验证要求 */
  verificationRequirements: VerificationRequirement[];
}

/**
 * 路由决策
 */
export interface RoutingDecision {
  /** 决策ID */
  id: string;
  
  /** 请求标识符 */
  requestId: string;
  
  /** 路由策略 */
  routingStrategy: RoutingStrategy;
  
  /** 目标Agent */
  targetAgent: string;
  
  /** 决策依据 */
  decisionBasis: DecisionBasis;
  
  /** 决策时间 */
  decisionTime: number;
  
  /** 宪法合规性 */
  constitutionalCompliance: ComplianceAssessment;
  
  /** 性能指标 */
  performanceMetrics: RoutingMetrics;
}

/**
 * 决策依据
 */
export interface DecisionBasis {
  /** Agent负载情况 */
  agentLoad: Record<string, number>;
  
  /** Agent健康状态 */
  agentHealth: Record<string, AgentHealth>;
  
  /** 请求特征 */
  requestCharacteristics: RequestCharacteristics;
  
  /** 历史性能数据 */
  historicalPerformance: HistoricalPerformance[];
  
  /** 上下文信息 */
  contextInfo: Record<string, any>;
  
  /** 宪法约束 */
  constitutionalConstraints: string[];
}

/**
 * 请求特征
 */
export interface RequestCharacteristics {
  /** 请求类型 */
  type: string;
  
  /** 请求复杂度 */
  complexity: number;
  
  /** 预计处理时间 (ms) */
  estimatedProcessingTime: number;
  
  /** 资源需求 */
  resourceRequirements: ResourceRequirement[];
  
  /** 用户优先级 */
  userPriority: number;
  
  /** 紧急程度 */
  urgency: number;
}

/**
 * 历史性能数据
 */
export interface HistoricalPerformance {
  /** Agent ID */
  agentId: string;
  
  /** 任务类型 */
  taskType: string;
  
  /** 平均响应时间 (ms) */
  avgResponseTime: number;
  
  /** 成功率 (%) */
  successRate: number;
  
  /** 错误率 (%) */
  errorRate: number;
  
  /** 资源使用率 (%) */
  resourceUsage: number;
  
  /** 数据采样时间 */
  sampleTime: number;
}

/**
 * 路由指标
 */
export interface RoutingMetrics {
  /** 决策时间 (ms) */
  decisionTime: number;
  
  /** 路由准确率 (%) */
  routingAccuracy: number;
  
  /** 负载均衡度 */
  loadBalanceScore: number;
  
  /** 故障转移次数 */
  failoverCount: number;
  
  /** 平均延迟 (ms) */
  averageLatency: number;
  
  /** 吞吐量 (请求/秒) */
  throughput: number;
}

/**
 * 上下文快照
 */
export interface ContextSnapshot {
  /** 快照ID */
  id: string;
  
  /** 快照时间 */
  timestamp: number;
  
  /** 系统状态 */
  systemState: SystemStateSnapshot;
  
  /** Agent状态 */
  agentStates: Record<string, AgentStateSnapshot>;
  
  /** 资源状态 */
  resourceStates: ResourceStateSnapshot[];
  
  /** 请求队列状态 */
  requestQueueState: QueueStateSnapshot;
  
  /** 性能指标 */
  performanceMetrics: PerformanceSnapshot;
  
  /** 宪法合规状态 */
  constitutionalCompliance: ComplianceAssessment;
}

/**
 * 系统状态快照
 */
export interface SystemStateSnapshot {
  /** 运行状态 */
  operationalState: 'normal' | 'degraded' | 'recovering' | 'failed';
  
  /** 整体负载 (%) */
  overallLoad: number;
  
  /** 可用性 (%) */
  availability: number;
  
  /** 错误计数 */
  errorCount: number;
  
  /** 警告计数 */
  warningCount: number;
  
  /** 最后更新时间 */
  lastUpdateTime: number;
}

/**
 * Agent状态快照
 */
export interface AgentStateSnapshot {
  /** Agent ID */
  agentId: string;
  
  /** 当前状态 */
  status: AgentStatus;
  
  /** 当前负载 (%) */
  currentLoad: number;
  
  /** 排队任务数 */
  queuedTasks: number;
  
  /** 处理中任务数 */
  processingTasks: number;
  
  /** 健康状态 */
  health: AgentHealth;
  
  /** 最后活动时间 */
  lastActivityTime: number;
}

/**
 * 资源状态快照
 */
export interface ResourceStateSnapshot {
  /** 资源类型 */
  resourceType: string;
  
  /** 总容量 */
  totalCapacity: number;
  
  /** 已使用量 */
  usedAmount: number;
  
  /** 可用量 */
  availableAmount: number;
  
  /** 使用率 (%) */
  utilizationRate: number;
  
  /** 警告阈值 */
  warningThreshold: number;
  
  /** 严重阈值 */
  criticalThreshold: number;
}

/**
 * 队列状态快照
 */
export interface QueueStateSnapshot {
  /** 队列长度 */
  queueLength: number;
  
  /** 平均等待时间 (ms) */
  averageWaitTime: number;
  
  /** 最大等待时间 (ms) */
  maxWaitTime: number;
  
  /** 处理速率 (任务/秒) */
  processingRate: number;
  
  /** 队列类型 */
  queueType: 'priority' | 'fifo' | 'lifo' | 'custom';
  
  /** 优先级分布 */
  priorityDistribution: Record<string, number>;
}

/**
 * 性能快照
 */
export interface PerformanceSnapshot {
  /** 平均响应时间 (ms) */
  avgResponseTime: number;
  
  /** 吞吐量 (请求/秒) */
  throughput: number;
  
  /** 错误率 (%) */
  errorRate: number;
  
  /** 成功率 (%) */
  successRate: number;
  
  /** 可用性 (%) */
  availability: number;
  
  /** 性能趋势 */
  performanceTrend: 'improving' | 'deteriorating' | 'stable';
}

/**
 * 上下文维护计划
 */
export interface ContextMaintenancePlan {
  /** 计划ID */
  id: string;
  
  /** 维护类型 */
  type: 'routine' | 'emergency' | 'optimization' | 'cleanup';
  
  /** 维护目标 */
  maintenanceObjectives: string[];
  
  /** 维护步骤 */
  maintenanceSteps: MaintenanceStep[];
  
  /** 预期影响 */
  expectedImpact: ImpactAssessment;
  
  /** 风险评估 */
  riskAssessment: RiskAssessment;
  
  /** 回滚计划 */
  rollbackPlan: RollbackPlan;
  
  /** 宪法合规性 */
  constitutionalCompliance: ComplianceAssessment;
}

/**
 * 维护步骤
 */
export interface MaintenanceStep {
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
  
  /** 依赖步骤 */
  dependencies?: number[];
  
  /** 验证检查 */
  verificationChecks: VerificationCheck[];
}

/**
 * 影响评估
 */
export interface ImpactAssessment {
  /** 性能影响 */
  performanceImpact: number;
  
  /** 功能影响 */
  functionalityImpact: number;
  
  /** 可用性影响 */
  availabilityImpact: number;
  
  /** 用户体验影响 */
  userExperienceImpact: number;
  
  /** 系统稳定性影响 */
  systemStabilityImpact: number;
}

/**
 * 风险评估
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
  
  /** 检查时间 */
  checkTime: number;
}

/**
 * 系统事件
 */
export interface SystemEvent {
  /** 事件ID */
  id: string;
  
  /** 事件类型 */
  type: 'info' | 'warning' | 'error' | 'critical' | 'audit';
  
  /** 事件源 */
  source: string;
  
  /** 事件描述 */
  description: string;
  
  /** 事件详情 */
  details: Record<string, any>;
  
  /** 发生时间 */
  occurrenceTime: number;
  
  /** 影响范围 */
  impactScope: ImpactScope;
  
  /** 相关宪法条款 */
  relatedClauses: string[];
  
  /** 处理状态 */
  handlingStatus: 'unhandled' | 'in_progress' | 'resolved' | 'escalated';
}

/**
 * 影响范围
 */
export interface ImpactScope {
  /** 影响Agent列表 */
  affectedAgents: string[];
  
  /** 影响服务列表 */
  affectedServices: string[];
  
  /** 影响用户列表 */
  affectedUsers: string[];
  
  /** 影响时间范围 */
  affectedTimeRange: TimeRange;
  
  /** 影响严重度 (1-10) */
  impactSeverity: number;
}

/**
 * 事件处理结果
 */
export interface EventHandlingResult {
  /** 结果ID */
  id: string;
  
  /** 目标事件 */
  targetEvent: SystemEvent;
  
  /** 处理状态 */
  status: 'success' | 'partial' | 'failed' | 'cancelled';
  
  /** 处理详情 */
  handlingDetails: HandlingDetail[];
  
  /** 处理耗时 (ms) */
  handlingDuration: number;
  
  /** 宪法合规性 */
  constitutionalCompliance: ComplianceAssessment;
  
  /** 完成时间戳 */
  timestamp: number;
}

/**
 * 处理详情
 */
export interface HandlingDetail {
  /** 处理步骤 */
  handlingStep: string;
  
  /** 执行Agent */
  executingAgent: string;
  
  /** 开始时间 */
  startTime: number;
  
  /** 结束时间 */
  endTime: number;
  
  /** 执行结果 */
  result: 'success' | 'partial' | 'failed' | 'skipped';
  
  /** 执行日志 */
  executionLog: string[];
}

/**
 * 性能调优建议
 */
export interface PerformanceOptimization {
  /** 建议ID */
  id: string;
  
  /** 优化目标 */
  optimizationTarget: string;
  
  /** 当前状态 */
  currentState: PerformanceState;
  
  /** 目标状态 */
  targetState: PerformanceState;
  
  /** 优化方案 */
  optimizationPlan: OptimizationPlan;
  
  /** 预期效果 */
  expectedEffect: OptimizationEffect;
  
  /** 实施优先级 (1-10) */
  implementationPriority: number;
  
  /** 宪法合规性 */
  constitutionalCompliance: ComplianceAssessment;
}

/**
 * 性能状态
 */
export interface PerformanceState {
  /** 响应时间 (ms) */
  responseTime: number;
  
  /** 吞吐量 (请求/秒) */
  throughput: number;
  
  /** 错误率 (%) */
  errorRate: number;
  
  /** 可用性 (%) */
  availability: number;
  
  /** 资源使用率 (%) */
  resourceUtilization: number;
  
  /** 用户满意度 (%) */
  userSatisfaction: number;
}

/**
 * 优化计划
 */
export interface OptimizationPlan {
  /** 优化策略 */
  optimizationStrategies: OptimizationStrategy[];
  
  /** 实施步骤 */
  implementationSteps: ImplementationStep[];
  
  /** 资源需求 */
  resourceRequirements: ResourceRequirement[];
  
  /** 风险评估 */
  riskAssessment: RiskAssessment;
  
  /** 监控计划 */
  monitoringPlan: MonitoringPlan;
}

/**
 * 优化策略
 */
export interface OptimizationStrategy {
  /** 策略类型 */
  type: 'algorithm' | 'configuration' | 'resource' | 'architecture' | 'process';
  
  /** 策略描述 */
  description: string;
  
  /** 预期改进 (%) */
  expectedImprovement: number;
  
  /** 实施复杂度 (1-10) */
  implementationComplexity: number;
  
  /** 影响范围 */
  impactScope: string[];
}

/**
 * 监控计划
 */
export interface MonitoringPlan {
  /** 监控指标 */
  metrics: MonitoringMetric[];
  
  /** 监控频率 (ms) */
  monitoringFrequency: number;
  
  /** 告警规则 */
  alertRules: AlertRule[];
  
  /** 报告要求 */
  reportingRequirements: ReportingRequirement[];
  
  /** 数据分析 */
  dataAnalysis: DataAnalysisConfig;
}

/**
 * 报告要求
 */
export interface ReportingRequirement {
  /** 报告类型 */
  reportType: 'performance' | 'compliance' | 'security' | 'operational';
  
  /** 报告频率 */
  reportingFrequency: number;
  
  /** 报告格式 */
  reportFormat: 'json' | 'html' | 'pdf' | 'markdown';
  
  /** 接收方 */
  recipients: string[];
  
  /** 包含指标 */
  includedMetrics: string[];
}

/**
 * 数据分析配置
 */
export interface DataAnalysisConfig {
  /** 分析方法 */
  analysisMethod: 'trend' | 'comparison' | 'correlation' | 'prediction';
  
  /** 分析周期 */
  analysisPeriod: TimeRange;
  
  /** 分析维度 */
  analysisDimensions: string[];
  
  /** 数据源 */
  dataSources: string[];
  
  /** 分析工具 */
  analysisTools: string[];
}

/**
 * 优化效果
 */
export interface OptimizationEffect {
  /** 性能改进 (%) */
  performanceImprovement: number;
  
  /** 资源节省 (%) */
  resourceSaving: number;
  
  /** 错误减少 (%) */
  errorReduction: number;
  
  /** 可用性提升 (%) */
  availabilityImprovement: number;
  
  /** 用户体验提升 (%) */
  userExperienceImprovement: number;
  
  /** 投资回报率 */
  returnOnInvestment: number;
}

/**
 * 合规检查结果
 */
export interface ComplianceCheckResult {
  /** 检查ID */
  id: string;
  
  /** 检查类型 */
  type: 'routine' | 'on_demand' | 'event_triggered' | 'pre_change';
  
  /** 检查范围 */
  checkScope: CheckScope;
  
  /** 检查结果 */
  checkResults: CheckResult[];
  
  /** 总体合规状态 */
  overallCompliance: 'compliant' | 'non_compliant' | 'requires_attention';
  
  /** 违规项 */
  violations: ComplianceViolation[];
  
  /** 改进建议 */
  improvementSuggestions: ImprovementSuggestion[];
  
  /** 检查时间戳 */
  timestamp: number;
}

/**
 * 检查范围
 */
export interface CheckScope {
  /** 检查对象 */
  checkTargets: string[];
  
  /** 检查标准 */
  checkStandards: string[];
  
  /** 检查深度 */
  checkDepth: 'basic' | 'standard' | 'comprehensive' | 'deep';
  
  /** 检查方法 */
  checkMethod: 'automated' | 'manual' | 'hybrid';
  
  /** 抽样策略 */
  samplingStrategy: 'full' | 'random' | 'stratified' | 'targeted';
}

/**
 * 检查结果
 */
export interface CheckResult {
  /** 检查项 */
  checkItem: string;
  
  /** 检查标准 */
  checkStandard: string;
  
  /** 实际状态 */
  actualState: string;
  
  /** 期望状态 */
  expectedState: string;
  
  /** 检查结果 */
  result: 'pass' | 'fail' | 'warning' | 'not_applicable';
  
  /** 结果详情 */
  resultDetails: string;
  
  /** 证据 */
  evidence: Evidence[];
}

/**
 * 改进建议
 */
export interface ImprovementSuggestion {
  /** 建议ID */
  id: string;
  
  /** 目标问题 */
  targetIssue: string;
  
  /** 建议内容 */
  suggestion: string;
  
  /** 预期效果 */
  expectedEffect: string;
  
  /** 实施优先级 (1-10) */
  implementationPriority: number;
  
  /** 实施步骤 */
  implementationSteps: ImplementationStep[];
}

/**
 * 入口监控报告
 */
export interface EntryMonitoringReport {
  /** 报告ID */
  id: string;
  
  /** 报告时间范围 */
  reportPeriod: TimeRange;
  
  /** 入口点状态 */
  entryPointStatus: EntryPointStatus[];
  
  /** 流量统计 */
  trafficStatistics: TrafficStatistics;
  
  /** 性能分析 */
  performanceAnalysis: PerformanceAnalysis;
  
  /** 错误分析 */
  errorAnalysis: ErrorAnalysis;
  
  /** 安全分析 */
  securityAnalysis: SecurityAnalysis;
  
  /** 合规状态 */
  complianceStatus: ComplianceStatus;
  
  /** 建议措施 */
  recommendedActions: RecommendedAction[];
}

/**
 * 入口点状态
 */
export interface EntryPointStatus {
  /** 入口点ID */
  entryPointId: string;
  
  /** 可用性 (%) */
  availability: number;
  
  /** 响应时间 (ms) */
  responseTime: number;
  
  /** 吞吐量 (请求/秒) */
  throughput: number;
  
  /** 错误率 (%) */
  errorRate: number;
  
  /** 当前连接数 */
  currentConnections: number;
  
  /** 状态变化历史 */
  statusHistory: StatusHistory[];
}

/**
 * 状态历史
 */
export interface StatusHistory {
  /** 时间戳 */
  timestamp: number;
  
  /** 状态 */
  status: 'up' | 'down' | 'degraded' | 'maintenance';
  
  /** 持续时间 (ms) */
  duration: number;
  
  /** 影响范围 */
  impactScope: string[];
  
  /** 恢复时间 */
  recoveryTime?: number;
}

/**
 * 流量统计
 */
export interface TrafficStatistics {
  /** 总请求数 */
  totalRequests: number;
  
  /** 请求类型分布 */
  requestTypeDistribution: Record<string, number>;
  
  /** 请求来源分布 */
  sourceDistribution: Record<string, number>;
  
  /** 峰值流量 (请求/秒) */
  peakTraffic: number;
  
  /** 平均流量 (请求/秒) */
  averageTraffic: number;
  
  /** 流量趋势 */
  trafficTrend: TrafficTrend;
}

/**
 * 流量趋势
 */
export interface TrafficTrend {
  /** 趋势方向 */
  direction: 'increasing' | 'decreasing' | 'stable';
  
  /** 趋势强度 */
  strength: number;
  
  /** 周期性模式 */
  seasonalPatterns: SeasonalPattern[];
  
  /** 异常点 */
  anomalies: Anomaly[];
  
  /** 预测值 */
  forecast: TrafficForecast;
}

/**
 * 季节性模式
 */
export interface SeasonalPattern {
  /** 周期类型 */
  periodType: 'hourly' | 'daily' | 'weekly' | 'monthly';
  
  /** 周期强度 */
  patternStrength: number;
  
  /** 峰值时间 */
  peakTimes: TimeRange[];
  
  /** 谷值时间 */
  troughTimes: TimeRange[];
}

/**
 * 异常点
 */
export interface Anomaly {
  /** 异常时间 */
  anomalyTime: number;
  
  /** 异常类型 */
  type: 'spike' | 'dip' | 'outage' | 'irregular';
  
  /** 异常程度 */
  severity: number;
  
  /** 可能原因 */
  possibleCauses: string[];
  
  /** 处理状态 */
  handlingStatus: 'detected' | 'investigating' | 'resolved' | 'ignored';
}

/**
 * 流量预测
 */
export interface TrafficForecast {
  /** 预测时间范围 */
  forecastPeriod: TimeRange;
  
  /** 预测值 */
  predictedValues: number[];
  
  /** 置信区间 */
  confidenceInterval: [number, number];
  
  /** 预测方法 */
  forecastMethod: 'arima' | 'prophet' | 'neural_network' | 'ensemble';
  
  /** 预测准确率 (%) */
  forecastAccuracy: number;
}

/**
 * 性能分析
 */
export interface PerformanceAnalysis {
  /** 响应时间分布 */
  responseTimeDistribution: DistributionAnalysis;
  
  /** 吞吐量分析 */
  throughputAnalysis: ThroughputAnalysis;
  
  /** 资源使用分析 */
  resourceUsageAnalysis: ResourceUsageAnalysis;
  
  /** 瓶颈识别 */
  bottleneckIdentification: Bottleneck[];
  
  /** 性能趋势 */
  performanceTrends: PerformanceTrend[];
}

/**
 * 分布分析
 */
export interface DistributionAnalysis {
  /** P50 (中位数) */
  p50: number;
  
  /** P90 */
  p90: number;
  
  /** P95 */
  p95: number;
  
  /** P99 */
  p99: number;
  
  /** 平均值 */
  mean: number;
  
  /** 标准差 */
  standardDeviation: number;
  
  /** 分布类型 */
  distributionType: 'normal' | 'lognormal' | 'exponential' | 'weibull';
}

/**
 * 吞吐量分析
 */
export interface ThroughputAnalysis {
  /** 平均吞吐量 (请求/秒) */
  averageThroughput: number;
  
  /** 最大吞吐量 (请求/秒) */
  maxThroughput: number;
  
  /** 吞吐量稳定性 */
  throughputStability: number;
  
  /** 吞吐量限制因素 */
  limitingFactors: string[];
  
  /** 吞吐量容量 */
  throughputCapacity: number;
}

/**
 * 资源使用分析
 */
export interface ResourceUsageAnalysis {
  /** CPU使用率 (%) */
  cpuUsage: number;
  
  /** 内存使用率 (%) */
  memoryUsage: number;
  
  /** 网络使用率 (%) */
  networkUsage: number;
  
  /** 存储使用率 (%) */
  storageUsage: number;
  
  /** 资源瓶颈 */
  resourceBottlenecks: ResourceBottleneck[];
  
  /** 优化建议 */
  optimizationSuggestions: string[];
}

/**
 * 瓶颈
 */
export interface Bottleneck {
  /** 瓶颈类型 */
  type: 'cpu' | 'memory' | 'network' | 'io' | 'database' | 'external_service';
  
  /** 瓶颈位置 */
  location: string;
  
  /** 影响程度 (1-10) */
  impactLevel: number;
  
  /** 瓶颈表现 */
  symptoms: string[];
  
  /** 缓解策略 */
  mitigationStrategies: string[];
}

/**
 * 性能趋势
 */
export interface PerformanceTrend {
  /** 指标名称 */
  metricName: string;
  
  /** 当前值 */
  currentValue: number;
  
  /** 历史平均值 */
  historicalAverage: number;
  
  /** 趋势方向 */
  trendDirection: 'improving' | 'deteriorating' | 'stable';
  
  /** 变化速率 */
  changeRate: number;
  
  /** 趋势置信度 (0-1) */
  trendConfidence: number;
}

/**
 * 错误分析
 */
export interface ErrorAnalysis {
  /** 总错误数 */
  totalErrors: number;
  
  /** 错误类型分布 */
  errorTypeDistribution: Record<string, number>;
  
  /** 错误趋势 */
  errorTrend: ErrorTrend;
  
  /** 根本原因分析 */
  rootCauseAnalysis: RootCauseAnalysis[];
  
  /** 影响评估 */
  impactAssessment: ErrorImpactAssessment;
  
  /** 改进建议 */
  improvementRecommendations: string[];
}

/**
 * 根本原因分析
 */
export interface RootCauseAnalysis {
  /** 错误ID */
  errorId: string;
  
  /** 根本原因 */
  rootCause: string;
  
  /** 原因类别 */
  causeCategory: 'code' | 'configuration' | 'resource' | 'network' | 'external';
  
  /** 确定性 (0-1) */
  certainty: number;
  
  /** 证据 */
  evidence: Evidence[];
  
  /** 修复建议 */
  fixRecommendations: string[];
}

/**
 * 错误影响评估
 */
export interface ErrorImpactAssessment {
  /** 用户影响 */
  userImpact: number;
  
  /** 业务影响 */
  businessImpact: number;
  
  /** 系统影响 */
  systemImpact: number;
  
  /** 财务影响 */
  financialImpact: number;
  
  /** 信誉影响 */
  reputationImpact: number;
}

/**
 * 安全分析
 */
export interface SecurityAnalysis {
  /** 安全事件统计 */
  securityIncidents: SecurityIncident[];
  
  /** 威胁检测 */
  threatDetections: ThreatDetection[];
  
  /** 漏洞评估 */
  vulnerabilityAssessment: VulnerabilityAssessment;
  
  /** 合规检查 */
  complianceChecks: ComplianceCheckResult[];
  
  /** 安全态势 */
  securityPosture: SecurityPosture;
}

/**
 * 安全事件
 */
export interface SecurityIncident {
  /** 事件ID */
  id: string;
  
  /** 事件类型 */
  type: 'authentication' | 'authorization' | 'data_breach' | 'dos' | 'malware';
  
  /** 事件严重性 */
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  /** 事件描述 */
  description: string;
  
  /** 发生时间 */
  occurrenceTime: number;
  
  /** 响应状态 */
  responseStatus: 'detected' | 'investigating' | 'contained' | 'resolved';
  
  /** 影响范围 */
  impactScope: ImpactScope;
}

/**
 * 威胁检测
 */
export interface ThreatDetection {
  /** 检测ID */
  id: string;
  
  /** 威胁类型 */
  threatType: 'suspicious_activity' | 'malicious_payload' | 'exploit_attempt' | 'data_exfiltration';
  
  /** 威胁级别 */
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  
  /** 检测时间 */
  detectionTime: number;
  
  /** 检测方法 */
  detectionMethod: 'signature' | 'anomaly' | 'behavior' | 'heuristic';
  
  /** 处理状态 */
  handlingStatus: 'pending' | 'investigating' | 'mitigated' | 'false_positive';
}

/**
 * 漏洞评估
 */
export interface VulnerabilityAssessment {
  /** 评估ID */
  id: string;
  
  /** 发现漏洞数 */
  vulnerabilitiesFound: number;
  
  /** 高危漏洞数 */
  criticalVulnerabilities: number;
  
  /** 中危漏洞数 */
  mediumVulnerabilities: number;
  
  /** 低危漏洞数 */
  lowVulnerabilities: number;
  
  /** 修复建议 */
  remediationRecommendations: string[];
  
  /** 评估时间 */
  assessmentTime: number;
}

/**
 * 安全态势
 */
export interface SecurityPosture {
  /** 总体安全评分 (0-100) */
  overallSecurityScore: number;
  
  /** 防护能力评分 */
  protectionScore: number;
  
  /** 检测能力评分 */
  detectionScore: number;
  
  /** 响应能力评分 */
  responseScore: number;
  
  /** 恢复能力评分 */
  recoveryScore: number;
  
  /** 改进建议 */
  improvementRecommendations: string[];
}

/**
 * 合规状态
 */
export interface ComplianceStatus {
  /** 总体合规率 (%) */
  overallComplianceRate: number;
  
  /** 合规项分布 */
  complianceDistribution: Record<string, number>;
  
  /** 不合规项 */
  nonComplianceItems: NonComplianceItem[];
  
  /** 合规趋势 */
  complianceTrend: ComplianceTrend;
  
  /** 改进计划 */
  improvementPlan: ComplianceImprovementPlan;
}

/**
 * 不合规项
 */
export interface NonComplianceItem {
  /** 项目ID */
  id: string;
  
  /** 合规标准 */
  complianceStandard: string;
  
  /** 不合规描述 */
  nonComplianceDescription: string;
  
  /** 严重程度 */
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  /** 修复状态 */
  remediationStatus: 'open' | 'in_progress' | 'completed' | 'deferred';
  
  /** 预计修复时间 */
  estimatedRemediationTime: number;
}

/**
 * 合规改进计划
 */
export interface ComplianceImprovementPlan {
  /** 计划ID */
  id: string;
  
  /** 改进目标 */
  improvementObjectives: string[];
  
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

// ==================== 办公厅主任Agent接口 ====================

/**
 * 办公厅主任Agent接口 - L2协调层Agent，负责入口管理与路由分发
 * 宪法依据: §186入口管理公理、§187上下文一致性公理
 * 版本: v1.0.0
 */
export interface IChiefOfStaffAgent extends IAgentBase {
  // === 入口管理 ===
  /**
   * 注册入口点
   * @param entryPoint 入口点配置
   * @returns 注册结果
   */
  registerEntryPoint(entryPoint: EntryPoint): Promise<RegistrationResult>;
  
  /**
   * 注销入口点
   * @param entryPointId 入口点ID
   * @returns 注销结果
   */
  unregisterEntryPoint(entryPointId: string): Promise<UnregistrationResult>;
  
  /**
   * 更新入口点配置
   * @param entryPointId 入口点ID
   * @param configUpdates 配置更新
   * @returns 更新结果
   */
  updateEntryPointConfig(
    entryPointId: string,
    configUpdates: Partial<EntryPoint>
  ): Promise<UpdateResult>;
  
  /**
   * 监控入口点状态
   * @param entryPointId 入口点ID（可选）
   * @returns 入口点状态报告
   */
  monitorEntryPoints(entryPointId?: string): Promise<EntryMonitoringReport>;
  
  // === 路由管理 ===
  /**
   * 配置路由策略
   * @param routingStrategy 路由策略
   * @returns 配置结果
   */
  configureRoutingStrategy(routingStrategy: RoutingStrategy): Promise<ConfigurationResult>;
  
  /**
   * 路由请求到合适Agent
   * @param request 请求内容
   * @param source 请求来源
   * @returns 路由决策
   */
  routeRequest(
    request: any,
    source: RequestSource
  ): Promise<RoutingDecision>;
  
  /**
   * 优化路由策略
   * @param performanceMetrics 性能指标
   * @returns 优化后的路由策略
   */
  optimizeRoutingStrategy(
    performanceMetrics: RoutingMetrics
  ): Promise<RoutingStrategy>;
  
  // === 上下文维护 ===
  /**
   * 捕获系统上下文快照
   * @returns 上下文快照
   */
  captureContextSnapshot(): Promise<ContextSnapshot>;
  
  /**
   * 维护系统上下文一致性
   * @param maintenancePlan 维护计划
   * @returns 维护结果
   */
  maintainContextConsistency(
    maintenancePlan: ContextMaintenancePlan
  ): Promise<MaintenanceResult>;
  
  /**
   * 恢复上下文状态
   * @param snapshotId 快照ID
   * @returns 恢复结果
   */
  restoreContextState(snapshotId: string): Promise<RestorationResult>;
  
  // === 事件处理 ===
  /**
   * 处理系统事件
   * @param event 系统事件
   * @returns 事件处理结果
   */
  handleSystemEvent(event: SystemEvent): Promise<EventHandlingResult>;
  
  /**
   * 监控系统事件
   * @param eventFilter 事件过滤器（可选）
   * @returns 事件监控报告
   */
  monitorSystemEvents(eventFilter?: Partial<SystemEvent>): Promise<EventMonitoringReport>;
  
  /**
   * 升级事件处理
   * @param eventId 事件ID
   * @param escalationReason 升级原因
   * @returns 升级结果
   */
  escalateEvent(
    eventId: string,
    escalationReason: string
  ): Promise<EscalationResult>;
  
  // === 性能管理 ===
  /**
   * 分析系统性能
   * @param analysisCriteria 分析标准
   * @returns 性能分析报告
   */
  analyzeSystemPerformance(
    analysisCriteria: PerformanceAnalysisCriteria
  ): Promise<PerformanceAnalysisReport>;
  
  /**
   * 提出性能优化建议
   * @param performanceState 当前性能状态
   * @returns 性能优化建议
   */
  proposePerformanceOptimization(
    performanceState: PerformanceState
  ): Promise<PerformanceOptimization>;
  
  /**
   * 实施性能优化
   * @param optimization 优化方案
   * @returns 优化实施结果
   */
  implementPerformanceOptimization(
    optimization: PerformanceOptimization
  ): Promise<OptimizationResult>;
  
  // === 合规管理 ===
  /**
   * 执行合规检查
   * @param checkScope 检查范围
   * @returns 合规检查结果
   */
  performComplianceCheck(
    checkScope: CheckScope
  ): Promise<ComplianceCheckResult>;
  
  /**
   * 监控合规状态
   * @param timeframe 时间范围
   * @returns 合规状态报告
   */
  monitorComplianceStatus(
    timeframe: TimeRange
  ): Promise<ComplianceStatus>;
  
  /**
   * 执行合规改进
   * @param improvementPlan 改进计划
   * @returns 改进执行结果
   */
  executeComplianceImprovement(
    improvementPlan: ComplianceImprovementPlan
  ): Promise<ImprovementResult>;
  
  // === 高级管理 ===
  /**
   * 协调入口点故障转移
   * @param failedEntryPointId 故障入口点ID
   * @returns 故障转移结果
   */
  coordinateEntryPointFailover(
    failedEntryPointId: string
  ): Promise<FailoverResult>;
  
  /**
   * 管理负载均衡
   * @param loadBalancingConfig 负载均衡配置
   * @returns 负载均衡结果
   */
  manageLoadBalancing(
    loadBalancingConfig: LoadBalancingConfig
  ): Promise<LoadBalancingResult>;
  
  /**
   * 预测系统容量
   * @param forecastPeriod 预测周期
   * @returns 容量预测报告
   */
  forecastSystemCapacity(
    forecastPeriod: TimeRange
  ): Promise<CapacityForecast>;
  
  /**
   * 优化系统资源分配
   * @param resourceStates 资源状态
   * @returns 资源优化方案
   */
  optimizeResourceAllocation(
    resourceStates: ResourceStateSnapshot[]
  ): Promise<ResourceOptimizationPlan>;
}

// ==================== 辅助类型定义 ====================

/**
 * 注册结果
 */
export interface RegistrationResult {
  /** 是否成功 */
  success: boolean;
  
  /** 注册ID */
  registrationId: string;
  
  /** 注册详情 */
  details: string;
  
  /** 宪法合规性 */
  constitutionalCompliance: ComplianceAssessment;
  
  /** 时间戳 */
  timestamp: number;
}

/**
 * 注销结果
 */
export interface UnregistrationResult {
  /** 是否成功 */
  success: boolean;
  
  /** 注销详情 */
  details: string;
  
  /** 释放的资源 */
  releasedResources: string[];
  
  /** 影响范围 */
  impactScope: ImpactScope;
  
  /** 时间戳 */
  timestamp: number;
}

/**
 * 更新结果
 */
export interface UpdateResult {
  /** 是否成功 */
  success: boolean;
  
  /** 更新详情 */
  details: string;
  
  /** 变更内容 */
  changes: Record<string, any>;
  
  /** 宪法合规性 */
  constitutionalCompliance: ComplianceAssessment;
  
  /** 时间戳 */
  timestamp: number;
}

/**
 * 配置结果
 */
export interface ConfigurationResult {
  /** 是否成功 */
  success: boolean;
  
  /** 配置ID */
  configurationId: string;
  
  /** 配置详情 */
  details: string;
  
  /** 影响范围 */
  impactScope: ImpactScope;
  
  /** 验证结果 */
  validationResults: ValidationResult[];
  
  /** 时间戳 */
  timestamp: number;
}

/**
 * 验证结果
 */
export interface ValidationResult {
  /** 验证项 */
  validationItem: string;
  
  /** 验证状态 */
  status: 'pass' | 'fail' | 'warning';
  
  /** 验证详情 */
  details: string;
  
  /** 建议 */
  recommendations: string[];
}

/**
 * 维护结果
 */
export interface MaintenanceResult {
  /** 是否成功 */
  success: boolean;
  
  /** 维护ID */
  maintenanceId: string;
  
  /** 维护详情 */
  details: string;
  
  /** 实际影响 */
  actualImpact: ImpactAssessment;
  
  /** 宪法合规性 */
  constitutionalCompliance: ComplianceAssessment;
  
  /** 时间戳 */
  timestamp: number;
}

/**
 * 恢复结果
 */
export interface RestorationResult {
  /** 是否成功 */
  success: boolean;
  
  /** 恢复ID */
  restorationId: string;
  
  /** 恢复详情 */
  details: string;
  
  /** 恢复的数据量 */
  dataRecovered: number;
  
  /** 恢复时间 */
  recoveryTime: number;
  
  /** 时间戳 */
  timestamp: number;
}

/**
 * 事件监控报告
 */
export interface EventMonitoringReport {
  /** 报告ID */
  id: string;
  
  /** 报告时间范围 */
  reportPeriod: TimeRange;
  
  /** 事件统计 */
  eventStatistics: EventStatistics;
  
  /** 事件趋势 */
  eventTrends: EventTrend[];
  
  /** 重要事件 */
  significantEvents: SystemEvent[];
  
  /** 处理效率 */
  handlingEfficiency: HandlingEfficiency;
  
  /** 改进建议 */
  improvementSuggestions: string[];
}

/**
 * 事件统计
 */
export interface EventStatistics {
  /** 总事件数 */
  totalEvents: number;
  
  /** 事件类型分布 */
  eventTypeDistribution: Record<string, number>;
  
  /** 事件严重性分布 */
  severityDistribution: Record<string, number>;
  
  /** 平均处理时间 (ms) */
  averageHandlingTime: number;
  
  /** 解决率 (%) */
  resolutionRate: number;
}

/**
 * 事件趋势
 */
export interface EventTrend {
  /** 事件类型 */
  eventType: string;
  
  /** 趋势方向 */
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  
  /** 趋势强度 */
  trendStrength: number;
  
  /** 周期性模式 */
  seasonalPatterns: SeasonalPattern[];
  
  /** 预测值 */
  forecast: number[];
}

/**
 * 处理效率
 */
export interface HandlingEfficiency {
  /** 平均响应时间 (ms) */
  averageResponseTime: number;
  
  /** 平均解决时间 (ms) */
  averageResolutionTime: number;
  
  /** 一次解决率 (%) */
  firstContactResolutionRate: number;
  
  /** 升级率 (%) */
  escalationRate: number;
  
  /** 用户满意度 (%) */
  userSatisfactionRate: number;
}

/**
 * 升级结果
 */
export interface EscalationResult {
  /** 是否成功 */
  success: boolean;
  
  /** 升级ID */
  escalationId: string;
  
  /** 升级详情 */
  details: string;
  
  /** 接收方 */
  recipient: string;
  
  /** 升级级别 */
  escalationLevel: 'low' | 'medium' | 'high' | 'critical';
  
  /** 时间戳 */
  timestamp: number;
}

/**
 * 性能分析标准
 */
export interface PerformanceAnalysisCriteria {
  /** 分析维度 */
  analysisDimensions: string[];
  
  /** 时间范围 */
  timeRange: TimeRange;
  
  /** 基准指标 */
  baselineMetrics: Record<string, number>;
  
  /** 阈值配置 */
  thresholdConfig: ThresholdConfig;
  
  /** 分析方法 */
  analysisMethod: string;
}

/**
 * 阈值配置
 */
export interface ThresholdConfig {
  /** 警告阈值 */
  warningThresholds: Record<string, number>;
  
  /** 严重阈值 */
  criticalThresholds: Record<string, number>;
  
  /** 持续时间阈值 (ms) */
  durationThresholds: Record<string, number>;
  
  /** 阈值应用规则 */
  applicationRules: string[];
}

/**
 * 性能分析报告
 */
export interface PerformanceAnalysisReport {
  /** 报告ID */
  id: string;
  
  /** 报告时间范围 */
  reportPeriod: TimeRange;
  
  /** 性能摘要 */
  performanceSummary: PerformanceSummary;
  
  /** 详细分析 */
  detailedAnalysis: PerformanceDetailedAnalysis;
  
  /** 瓶颈识别 */
  bottlenecks: Bottleneck[];
  
  /** 优化建议 */
  optimizationRecommendations: OptimizationRecommendation[];
  
  /** 合规状态 */
  complianceStatus: ComplianceAssessment;
}

/**
 * 性能摘要
 */
export interface PerformanceSummary {
  /** 总体评分 (0-100) */
  overallScore: number;
  
  /** 关键指标 */
  keyMetrics: Record<string, number>;
  
  /** 性能状态 */
  performanceStatus: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  
  /** 趋势分析 */
  trendAnalysis: TrendAnalysis;
  
  /** 改进空间 */
  improvementOpportunities: string[];
}

/**
 * 趋势分析
 */
export interface TrendAnalysis {
  /** 总体趋势 */
  overallTrend: 'improving' | 'deteriorating' | 'stable';
  
  /** 趋势强度 */
  trendStrength: number;
  
  /** 预测趋势 */
  forecastedTrend: 'improving' | 'deteriorating' | 'stable';
  
  /** 预测置信度 (0-1) */
  forecastConfidence: number;
  
  /** 预测时间范围 */
  forecastTimeframe: TimeRange;
}

/**
 * 性能详细分析
 */
export interface PerformanceDetailedAnalysis {
  /** 响应时间分析 */
  responseTimeAnalysis: DistributionAnalysis;
  
  /** 吞吐量分析 */
  throughputAnalysis: ThroughputAnalysis;
  
  /** 资源使用分析 */
  resourceUsageAnalysis: ResourceUsageAnalysis;
  
  /** 错误分析 */
  errorAnalysis: ErrorAnalysis;
  
  /** 可用性分析 */
  availabilityAnalysis: AvailabilityAnalysis;
}

/**
 * 可用性分析
 */
export interface AvailabilityAnalysis {
  /** 总体可用性 (%) */
  overallAvailability: number;
  
  /** 可用性分布 */
  availabilityDistribution: Record<string, number>;
  
  /** 宕机时间分析 */
  downtimeAnalysis: DowntimeAnalysis;
  
  /** 可用性趋势 */
  availabilityTrend: TrendAnalysis;
  
  /** 改进建议 */
  improvementSuggestions: string[];
}

/**
 * 宕机时间分析
 */
export interface DowntimeAnalysis {
  /** 总宕机时间 (ms) */
  totalDowntime: number;
  
  /** 宕机次数 */
  downtimeCount: number;
  
  /** 平均宕机时间 (ms) */
  averageDowntime: number;
  
  /** 最长宕机时间 (ms) */
  maxDowntime: number;
  
  /** 宕机原因分布 */
  causeDistribution: Record<string, number>;
}

/**
 * 优化建议
 */
export interface OptimizationRecommendation {
  /** 建议ID */
  id: string;
  
  /** 优化目标 */
  optimizationTarget: string;
  
  /** 当前状态 */
  currentState: number;
  
  /** 目标状态 */
  targetState: number;
  
  /** 预期改进 (%) */
  expectedImprovement: number;
  
  /** 实施优先级 (1-10) */
  implementationPriority: number;
  
  /** 实施步骤 */
  implementationSteps: ImplementationStep[];
}

/**
 * 优化结果
 */
export interface OptimizationResult {
  /** 是否成功 */
  success: boolean;
  
  /** 优化ID */
  optimizationId: string;
  
  /** 优化详情 */
  details: string;
  
  /** 实际改进 */
  actualImprovement: number;
  
  /** 资源消耗 */
  resourceConsumption: ResourceConsumption;
  
  /** 宪法合规性 */
  constitutionalCompliance: ComplianceAssessment;
  
  /** 时间戳 */
  timestamp: number;
}

/**
 * 资源消耗
 */
export interface ResourceConsumption {
  /** CPU消耗 */
  cpuConsumption: number;
  
  /** 内存消耗 */
  memoryConsumption: number;
  
  /** 时间消耗 (ms) */
  timeConsumption: number;
  
  /** 成本消耗 */
  costConsumption: number;
  
  /** 效益评估 */
  benefitAssessment: number;
}

/**
 * 改进结果
 */
export interface ImprovementResult {
  /** 是否成功 */
  success: boolean;
  
  /** 改进ID */
  improvementId: string;
  
  /** 改进详情 */
  details: string;
  
  /** 改进效果 */
  improvementEffect: number;
  
  /** 合规改进 */
  complianceImprovement: number;
  
  /** 宪法合规性 */
  constitutionalCompliance: ComplianceAssessment;
  
  /** 时间戳 */
  timestamp: number;
}

/**
 * 故障转移结果
 */
export interface FailoverResult {
  /** 是否成功 */
  success: boolean;
  
  /** 故障转移ID */
  failoverId: string;
  
  /** 故障转移详情 */
  details: string;
  
  /** 转移时间 (ms) */
  transferTime: number;
  
  /** 数据丢失情况 */
  dataLoss: DataLossAssessment;
  
  /** 服务恢复时间 (ms) */
  serviceRecoveryTime: number;
  
  /** 时间戳 */
  timestamp: number;
}

/**
 * 数据丢失评估
 */
export interface DataLossAssessment {
  /** 是否发生数据丢失 */
  dataLost: boolean;
  
  /** 丢失数据量 */
  lostDataAmount: number;
  
  /** 丢失数据类型 */
  lostDataTypes: string[];
  
  /** 影响范围 */
  impactScope: ImpactScope;
  
  /** 恢复可能性 */
  recoveryPossibility: number;
}

/**
 * 负载均衡结果
 */
export interface LoadBalancingResult {
  /** 是否成功 */
  success: boolean;
  
  /** 负载均衡ID */
  loadBalancingId: string;
  
  /** 负载均衡详情 */
  details: string;
  
  /** 负载分布 */
  loadDistribution: Record<string, number>;
  
  /** 性能改进 */
  performanceImprovement: number;
  
  /** 资源利用率 */
  resourceUtilization: number;
  
  /** 时间戳 */
  timestamp: number;
}

/**
 * 容量预测
 */
export interface CapacityForecast {
  /** 预测ID */
  id: string;
  
  /** 预测时间范围 */
  forecastPeriod: TimeRange;
  
  /** 容量需求预测 */
  capacityDemandForecast: DemandForecast;
  
  /** 资源需求预测 */
  resourceRequirementForecast: ResourceForecast;
  
  /** 瓶颈预测 */
  bottleneckForecast: BottleneckForecast[];
  
  /** 扩展建议 */
  scalingRecommendations: ScalingRecommendation[];
  
  /** 预测置信度 (0-1) */
  forecastConfidence: number;
}

/**
 * 需求预测
 */
export interface DemandForecast {
  /** 请求量预测 */
  requestVolumeForecast: VolumeForecast;
  
  /** 处理时间预测 */
  processingTimeForecast: TimeForecast;
  
  /** 并发需求预测 */
  concurrencyForecast: ConcurrencyForecast;
  
  /** 峰值预测 */
  peakForecast: PeakForecast;
  
  /** 趋势分析 */
  trendAnalysis: TrendAnalysis;
}

/**
 * 容量预测
 */
export interface VolumeForecast {
  /** 预测值 */
  predictedValues: number[];
  
  /** 置信区间 */
  confidenceInterval: [number, number];
  
  /** 季节性模式 */
  seasonalPatterns: SeasonalPattern[];
  
  /** 异常预测 */
  anomalyPredictions: AnomalyPrediction[];
  
  /** 预测方法 */
  forecastMethod: string;
}

/**
 * 异常预测
 */
export interface AnomalyPrediction {
  /** 预测时间 */
  predictionTime: number;
  
  /** 异常概率 (0-1) */
  anomalyProbability: number;
  
  /** 异常类型 */
  anomalyType: string;
  
  /** 影响程度 (1-10) */
  impactLevel: number;
  
  /** 缓解建议 */
  mitigationSuggestions: string[];
}

/**
 * 时间预测
 */
export interface TimeForecast {
  /** 平均处理时间预测 (ms) */
  averageProcessingTime: number;
  
  /** 处理时间分布预测 */
  processingTimeDistribution: DistributionAnalysis;
  
  /** 延迟预测 */
  latencyForecast: LatencyForecast;
  
  /** 瓶颈时间预测 */
  bottleneckTimeForecast: Record<string, number>;
}

/**
 * 延迟预测
 */
export interface LatencyForecast {
  /** P50预测 */
  p50: number;
  
  /** P90预测 */
  p90: number;
  
  /** P95预测 */
  p95: number;
  
  /** P99预测 */
  p99: number;
  
  /** 最大延迟预测 */
  max: number;
}

/**
 * 并发预测
 */
export interface ConcurrencyForecast {
  /** 平均并发数预测 */
  averageConcurrency: number;
  
  /** 峰值并发数预测 */
  peakConcurrency: number;
  
  /** 并发分布预测 */
  concurrencyDistribution: DistributionAnalysis;
  
  /** 并发趋势 */
  concurrencyTrend: TrendAnalysis;
}

/**
 * 峰值预测
 */
export interface PeakForecast {
  /** 峰值时间预测 */
  peakTimes: TimeRange[];
  
  /** 峰值强度预测 */
  peakIntensities: number[];
  
  /** 峰值持续时间预测 (ms) */
  peakDurations: number[];
  
  /** 峰值影响预测 */
  peakImpacts: ImpactAssessment[];
}

/**
 * 资源预测
 */
export interface ResourceForecast {
  /** CPU需求预测 */
  cpuDemandForecast: ResourceDemandForecast;
  
  /** 内存需求预测 */
  memoryDemandForecast: ResourceDemandForecast;
  
  /** 存储需求预测 */
  storageDemandForecast: ResourceDemandForecast;
  
  /** 网络需求预测 */
  networkDemandForecast: ResourceDemandForecast;
  
  /** 成本预测 */
  costForecast: CostForecast;
}

/**
 * 资源需求预测
 */
export interface ResourceDemandForecast {
  /** 平均需求 */
  averageDemand: number;
  
  /** 峰值需求 */
  peakDemand: number;
  
  /** 需求趋势 */
  demandTrend: TrendAnalysis;
  
  /** 容量缺口 */
  capacityGap: number;
  
  /** 扩展建议 */
  scalingSuggestions: ScalingSuggestion[];
}

/**
 * 成本预测
 */
export interface CostForecast {
  /** 总成本预测 */
  totalCost: number;
  
  /** 成本分布 */
  costDistribution: Record<string, number>;
  
  /** 成本趋势 */
  costTrend: TrendAnalysis;
  
  /** 成本优化建议 */
  costOptimizationSuggestions: string[];
  
  /** 投资回报预测 */
  returnOnInvestment: number;
}

/**
 * 扩展建议
 */
export interface ScalingSuggestion {
  /** 建议类型 */
  type: 'horizontal' | 'vertical' | 'auto_scaling' | 'optimization';
  
  /** 建议描述 */
  description: string;
  
  /** 预期效果 */
  expectedEffect: number;
  
  /** 实施复杂度 (1-10) */
  implementationComplexity: number;
  
  /** 成本影响 */
  costImpact: number;
}

/**
 * 瓶颈预测
 */
export interface BottleneckForecast {
  /** 瓶颈类型 */
  type: string;
  
  /** 瓶颈位置 */
  location: string;
  
  /** 预计出现时间 */
  estimatedOccurrenceTime: number;
  
  /** 预计影响程度 (1-10) */
  estimatedImpactLevel: number;
  
  /** 预防措施 */
  preventiveMeasures: string[];
  
  /** 缓解策略 */
  mitigationStrategies: string[];
}

/**
 * 资源优化方案
 */
export interface ResourceOptimizationPlan {
  /** 方案ID */
  id: string;
  
  /** 优化目标 */
  optimizationObjectives: string[];
  
  /** 当前资源状态 */
  currentResourceState: ResourceStateSnapshot[];
  
  /** 优化方案 */
  optimizationStrategies: OptimizationStrategy[];
  
  /** 预期效果 */
  expectedEffects: ExpectedEffect[];
  
  /** 实施计划 */
  implementationPlan: ImplementationPlan;
  
  /** 风险评估 */
  riskAssessment: RiskAssessment;
  
  /** 宪法合规性 */
  constitutionalCompliance: ComplianceAssessment;
}

/**
 * 预期效果
 */
export interface ExpectedEffect {
  /** 资源类型 */
  resourceType: string;
  
  /** 预期节省 (%) */
  expectedSaving: number;
  
  /** 性能改进 (%) */
  performanceImprovement: number;
  
  /** 成本节省 (%) */
  costSaving: number;
  
  /** 实施时间 (ms) */
  implementationTime: number;
}

/**
 * 实施计划
 */
export interface ImplementationPlan {
  /** 实施步骤 */
  implementationSteps: ImplementationStep[];
  
  /** 资源分配 */
  resourceAllocation: ResourceAllocation[];
  
  /** 时间安排 */
  schedule: ImplementationSchedule;
  
  /** 依赖关系 */
  dependencies: Dependency[];
  
  /** 成功标准 */
  successCriteria: string[];
}

/**
 * 实施时间表
 */
export interface ImplementationSchedule {
  /** 开始时间 */
  startTime: number;
  
  /** 结束时间 */
  endTime: number;
  
  /** 里程碑 */
  milestones: Milestone[];
  
  /** 关键路径 */
  criticalPath: string[];
  
  /** 缓冲时间 (ms) */
  bufferTime: number;
}

/**
 * 里程碑
 */
export interface Milestone {
  /** 里程碑ID */
  id: string;
  
  /** 里程碑描述 */
  description: string;
  
  /** 完成时间 */
  completionTime: number;
  
  /** 完成标准 */
  completionCriteria: string[];
  
  /** 依赖里程碑 */
  dependentMilestones: string[];
}

/**
 * 依赖关系
 */
export interface Dependency {
  /** 依赖ID */
  id: string;
  
  /** 依赖类型 */
  type: 'technical' | 'resource' | 'temporal' | 'logical';
  
  /** 依赖描述 */
  description: string;
  
  /** 依赖方 */
  dependent: string;
  
  /** 被依赖方 */
  dependee: string;
  
  /** 依赖强度 (1-10) */
  dependencyStrength: number;
}