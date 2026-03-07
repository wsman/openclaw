/**
 * Agent基础接口类型定义
 * 
 * 宪法依据: §152单一真理源公理、§110协作效率公理、§180-§189智能体接口与主权
 * 规范依据: AS-101_Agent基础接口规范.md
 * 版本: v1.0.0
 * 状态: 🟢 活跃
 */

// ==================== 基础类型定义 ====================

/**
 * Agent层级定义
 */
export type AgentLayer = 'L1' | 'L2' | 'L3';

/**
 * Agent专业领域
 */
export type AgentSpecialty = 
  | 'legal'        // 法律解释与合规
  | 'architecture' // 架构设计与维护
  | 'development'  // 技术实现与代码
  | 'coordination' // 战略协调与仲裁
  | 'gateway'      // 入口管理与路由
  | 'security'     // 安全审计与合规
  | 'knowledge'    // 知识管理与检索
  | 'monitoring';  // 系统监控与告警

/**
 * Agent状态
 */
export type AgentStatus = 
  | 'initializing' // 初始化中
  | 'active'       // 活跃可用
  | 'busy'         // 忙碌中
  | 'idle'         // 空闲
  | 'degraded'     // 降级运行
  | 'error'        // 错误状态
  | 'maintenance'; // 维护中

/**
 * 任务类型
 */
export type TaskType = 
  | 'legal_interpretation'   // 法律解释
  | 'architecture_design'    // 架构设计
  | 'code_generation'        // 代码生成
  | 'knowledge_retrieval'    // 知识检索
  | 'system_audit'          // 系统审计
  | 'constitutional_check'  // 宪法检查
  | 'collaboration'         // 协作协调
  | 'gateway_management'    // 网关管理
  | 'complexity_assessment' // 复杂度评估
  | 'resource_optimization'; // 资源优化

/**
 * 用户角色
 */
export type UserRole = 
  | 'admin'       // 管理员
  | 'developer'   // 开发者
  | 'architect'   // 架构师
  | 'auditor'     // 审计员
  | 'user'        // 普通用户
  | 'system';     // 系统角色

// ==================== 核心接口定义 ====================

/**
 * Agent健康状态
 */
export interface AgentHealth {
  /** 总体健康度 (0-100) */
  overall: number;
  
  /** CPU使用率 (%) */
  cpuUsage: number;
  
  /** 内存使用率 (%) */
  memoryUsage: number;
  
  /** 最后响应时间 (ms) */
  lastResponseTime: number;
  
  /** 错误率 (最近100次请求) */
  errorRate: number;
  
  /** 详细状态信息 */
  details: Record<string, any>;
  
  /** 最后检查时间戳 */
  timestamp: number;
}

/**
 * Agent任务定义
 */
export interface AgentTask {
  /** 任务ID (UUID v4) */
  id: string;
  
  /** 任务类型 */
  type: TaskType;
  
  /** 任务描述 */
  description: string;
  
  /** 优先级 (1-10, 10最高) */
  priority: number;
  
  /** 预期完成时间 (ms) */
  expectedDuration: number;
  
  /** 依赖任务ID列表 */
  dependencies?: string[];
  
  /** 任务元数据 */
  metadata?: Record<string, any>;
}

/**
 * 任务上下文
 */
export interface TaskContext {
  /** 用户信息 */
  user?: {
    id: string;
    name: string;
    role: UserRole;
  };
  
  /** 项目信息 */
  project?: {
    id: string;
    name: string;
    version: string;
  };
  
  /** 宪法依据列表 */
  constitutionalBasis?: string[];
  
  /** 相关文档引用 */
  references?: DocumentReference[];
  
  /** 历史上下文 */
  history?: TaskHistory[];
  
  /** 环境变量 */
  environment?: Record<string, any>;
}

/**
 * 文档引用
 */
export interface DocumentReference {
  /** 文档ID */
  id: string;
  
  /** 文档类型 */
  type: 'standard' | 'constitution' | 'workflow' | 'code' | 'report';
  
  /** 文档路径 */
  path: string;
  
  /** 引用部分 */
  section?: string;
  
  /** 引用版本 */
  version: string;
}

/**
 * 任务历史
 */
export interface TaskHistory {
  /** 任务ID */
  taskId: string;
  
  /** 执行时间 */
  timestamp: number;
  
  /** 执行结果 */
  result: 'success' | 'partial' | 'failed' | 'cancelled';
  
  /** 执行Agent */
  agentId: string;
  
  /** 执行耗时 (ms) */
  duration: number;
  
  /** 宪法合规状态 */
  constitutionalCompliance?: ComplianceResult;
}

/**
 * 任务处理结果
 */
export interface TaskResult {
  /** 任务ID */
  taskId: string;
  
  /** 处理状态 */
  status: 'success' | 'partial' | 'failed' | 'cancelled';
  
  /** 处理结果数据 */
  data: any;
  
  /** 处理耗时 (ms) */
  duration: number;
  
  /** 消耗的Token数量 */
  tokensUsed: number;
  
  /** 错误信息 (如果有) */
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  
  /** 建议的下一步操作 */
  nextSteps?: NextStep[];
  
  /** 宪法合规验证结果 */
  constitutionalCompliance?: ComplianceResult;
  
  /** 完成时间戳 */
  timestamp: number;
}

/**
 * 下一步操作
 */
export interface NextStep {
  /** 操作描述 */
  description: string;
  
  /** 操作类型 */
  type: 'continue' | 'review' | 'correct' | 'escalate' | 'complete';
  
  /** 优先级 (1-10) */
  priority: number;
  
  /** 预计耗时 (ms) */
  estimatedDuration: number;
  
  /** 宪法依据 */
  constitutionalBasis?: string[];
}

/**
 * 宪法合规结果
 */
export interface ComplianceResult {
  /** 是否合规 */
  isCompliant: boolean;
  
  /** 违规列表 */
  violations: string[];
  
  /** 警告列表 */
  warnings: string[];
  
  /** 时间戳 */
  timestamp: number;
  
  /** 验证Agent ID */
  agentId?: string;
  
  /** 验证Agent名称 */
  agentName?: string;
}

/**
 * 协作请求
 */
export interface CollaborationRequest {
  /** 请求ID */
  id: string;
  
  /** 协作类型 */
  type: 'consultation' | 'coordination' | 'review' | 'escalation';
  
  /** 协作内容 */
  content: string;
  
  /** 紧急程度 (1-10) */
  urgency: number;
  
  /** 预期协作结果 */
  expectedOutcome: string;
  
  /** 宪法依据 */
  constitutionalBasis?: string[];
}

/**
 * 协作结果
 */
export interface CollaborationResult {
  /** 协作ID */
  collaborationId: string;
  
  /** 协作状态 */
  status: 'accepted' | 'rejected' | 'pending' | 'completed';
  
  /** 协作结果数据 */
  result: any;
  
  /** 协作耗时 (ms) */
  duration: number;
  
  /** 宪法合规状态 */
  constitutionalCompliance?: ComplianceResult;
  
  /** 完成时间戳 */
  timestamp: number;
}

/**
 * 建议选项
 */
export interface AdviceOptions {
  /** 建议深度 */
  depth: 'brief' | 'detailed' | 'comprehensive';
  
  /** 建议格式 */
  format: 'text' | 'structured' | 'code';
  
  /** 是否包含宪法依据 */
  includeConstitutionalBasis: boolean;
  
  /** 是否包含实施步骤 */
  includeImplementationSteps: boolean;
  
  /** 是否包含风险评估 */
  includeRiskAssessment: boolean;
}

/**
 * 专业建议
 */
export interface ExpertAdvice {
  /** 建议ID */
  id: string;
  
  /** 建议内容 */
  content: string;
  
  /** 建议类型 */
  type: 'strategic' | 'tactical' | 'operational' | 'corrective';
  
  /** 置信度 (0-1) */
  confidence: number;
  
  /** 宪法依据 */
  constitutionalBasis: string[];
  
  /** 实施步骤 */
  implementationSteps?: ImplementationStep[];
  
  /** 风险评估 */
  riskAssessment?: RiskAssessment;
  
  /** 生成时间戳 */
  timestamp: number;
}

/**
 * 实施步骤
 */
export interface ImplementationStep {
  /** 步骤序号 */
  step: number;
  
  /** 步骤描述 */
  description: string;
  
  /** 预期耗时 (ms) */
  estimatedDuration: number;
  
  /** 依赖步骤 */
  dependencies?: number[];
  
  /** 完成标准 */
  completionCriteria: string[];
}

/**
 * 风险评估
 */
export interface RiskAssessment {
  /** 总体风险等级 (1-10) */
  overallRisk: number;
  
  /** 风险类别 */
  riskCategories: RiskCategory[];
  
  /** 缓解措施 */
  mitigationStrategies: MitigationStrategy[];
  
  /** 监控指标 */
  monitoringMetrics: MonitoringMetric[];
}

/**
 * 风险类别
 */
export interface RiskCategory {
  /** 类别名称 */
  name: string;
  
  /** 风险描述 */
  description: string;
  
  /** 风险等级 (1-10) */
  level: number;
  
  /** 影响范围 */
  impactScope: 'local' | 'system' | 'constitutional';
  
  /** 发生概率 (0-1) */
  probability: number;
}

/**
 * 缓解策略
 */
export interface MitigationStrategy {
  /** 策略名称 */
  name: string;
  
  /** 策略描述 */
  description: string;
  
  /** 预期效果 */
  expectedEffectiveness: number;
  
  /** 实施成本 (1-10) */
  implementationCost: number;
  
  /** 宪法依据 */
  constitutionalBasis?: string[];
}

/**
 * 监控指标
 */
export interface MonitoringMetric {
  /** 指标名称 */
  name: string;
  
  /** 指标描述 */
  description: string;
  
  /** 当前值 */
  currentValue: number;
  
  /** 阈值 */
  threshold: number;
  
  /** 监控频率 (ms) */
  monitoringFrequency: number;
}

/**
 * Agent性能指标
 */
export interface AgentMetrics {
  /** 处理任务总数 */
  totalTasks: number;
  
  /** 成功任务数 */
  successfulTasks: number;
  
  /** 平均响应时间 (ms) */
  avgResponseTime: number;
  
  /** 总Token消耗 */
  totalTokensUsed: number;
  
  /** 协作次数 */
  collaborationCount: number;
  
  /** 各任务类型分布 */
  taskTypeDistribution: Record<string, number>;
  
  /** 各时间段性能数据 */
  timeSeriesData?: MetricDataPoint[];
}

/**
 * 指标数据点
 */
export interface MetricDataPoint {
  /** 时间戳 */
  timestamp: number;
  
  /** 指标值 */
  value: number;
  
  /** 指标类型 */
  metricType: string;
  
  /** 附加数据 */
  metadata?: Record<string, any>;
}

/**
 * Agent日志条目
 */
export interface AgentLogEntry {
  /** 日志级别 */
  level: 'info' | 'warn' | 'error' | 'debug' | 'audit';
  
  /** 消息内容 */
  message: string;
  
  /** 时间戳 */
  timestamp: number;
  
  /** 相关任务ID */
  taskId?: string;
  
  /** 用户ID */
  userId?: string;
  
  /** 附加数据 */
  data?: Record<string, any>;
  
  /** 宪法条款引用 */
  constitutionalReferences?: string[];
}

// ==================== 核心接口 ====================

/**
 * Agent基础接口 - 所有Agent必须实现此接口
 * 宪法依据: §182 Agent主权与自治公理
 * 版本: v1.0.0
 */
export interface IAgentBase {
  // === 核心标识 ===
  /** Agent唯一标识符 (遵循UUID v4格式) */
  readonly id: string;
  
  /** Agent显示名称 (如"法务专家Agent") */
  readonly name: string;
  
  /** Agent层级 (L1入口层/L2协调层/L3专业层) */
  readonly layer: AgentLayer;
  
  /** Agent专业领域 (如"法律解释"、"架构设计") */
  readonly specialty: AgentSpecialty;
  
  // === 状态管理 ===
  /** Agent当前状态 */
  readonly status: AgentStatus;
  
  /** 激活Agent，准备接收任务 */
  activate(): Promise<void>;
  
  /** 停用Agent，释放资源 */
  deactivate(): Promise<void>;
  
  /** 获取Agent健康状态 */
  getHealth(): Promise<AgentHealth>;
  
  // === 任务处理 ===
  /**
   * 处理任务请求
   * @param task 任务描述
   * @param context 任务上下文
   * @returns 任务处理结果
   */
  processTask(task: AgentTask, context?: TaskContext): Promise<TaskResult>;
  
  /**
   * 评估任务复杂度
   * @param task 任务描述
   * @returns 复杂度评分 (0-100)
   */
  evaluateComplexity(task: AgentTask): Promise<number>;
  
  // === 协作接口 ===
  /**
   * 与其他Agent协作
   * @param otherAgentId 协作Agent的ID
   * @param collaboration 协作请求
   * @returns 协作结果
   */
  collaborate(otherAgentId: string, collaboration: CollaborationRequest): Promise<CollaborationResult>;
  
  /**
   * 提供专业建议
   * @param query 咨询问题
   * @param options 建议选项
   * @returns 专业建议
   */
  provideExpertAdvice(query: string, options?: AdviceOptions): Promise<ExpertAdvice>;
  
  // === 监控与审计 ===
  /** 获取性能指标 */
  getMetrics(): Promise<AgentMetrics>;
  
  /** 获取最近的操作日志 */
  getRecentLogs(limit?: number): Promise<AgentLogEntry[]>;
}

// ==================== 工具函数 ====================

/**
 * Agent错误类
 */
export class AgentError extends Error {
  constructor(
    public code: string,
    message: string,
    public constitutionalViolations?: string[],
    public recoverySteps?: string[]
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

/**
 * Agent错误代码定义
 */
export const AGENT_ERROR_CODES = {
  // 宪法违规错误 (1000-1999)
  CONSTITUTIONAL_VIOLATION: '1001',
  LAYER_VIOLATION: '1002',
  INTERFACE_VIOLATION: '1003',
  
  // 资源错误 (2000-2999)
  RESOURCE_EXHAUSTED: '2001',
  MEMORY_LIMIT_EXCEEDED: '2002',
  TIMEOUT_EXCEEDED: '2003',
  
  // 协作错误 (3000-3999)
  COLLABORATION_FAILED: '3001',
  AGENT_UNAVAILABLE: '3002',
  PROTOCOL_VIOLATION: '3003',
  
  // 任务错误 (4000-4999)
  TASK_REJECTED: '4001',
  COMPLEXITY_TOO_HIGH: '4002',
  DEPENDENCY_FAILED: '4003',
};

/**
 * 宪法合规检查器
 */
export class ConstitutionalComplianceChecker {
  /**
   * 检查Agent接口合规性
   */
  static checkAgentInterface(agent: IAgentBase): ComplianceResult {
    const violations: string[] = [];
    const warnings: string[] = [];
    
    // 检查必填属性
    if (!agent.id) violations.push('§182.1: Agent缺少id属性');
    if (!agent.name) violations.push('§182.1: Agent缺少name属性');
    if (!agent.layer) violations.push('§182.1: Agent缺少layer属性');
    if (!agent.specialty) violations.push('§182.1: Agent缺少specialty属性');
    
    // 检查方法实现
    const requiredMethods = ['processTask', 'evaluateComplexity', 'collaborate', 'provideExpertAdvice'];
    for (const method of requiredMethods) {
      if (typeof (agent as any)[method] !== 'function') {
        violations.push(`§183.1: Agent缺少${method}方法实现`);
      }
    }
    
    return {
      isCompliant: violations.length === 0,
      violations,
      warnings,
      timestamp: Date.now(),
      agentId: agent.id,
      agentName: agent.name,
    };
  }
  
  /**
   * 检查任务合规性
   */
  static checkTaskCompliance(task: AgentTask, context?: TaskContext): ComplianceResult {
    const violations: string[] = [];
    const warnings: string[] = [];
    
    // 检查任务必填字段
    if (!task.id) violations.push('§183.2: 任务缺少id');
    if (!task.type) violations.push('§183.2: 任务缺少type');
    if (!task.description) violations.push('§183.2: 任务缺少description');
    if (task.priority < 1 || task.priority > 10) {
      warnings.push('§183.3: 任务优先级应在1-10范围内');
    }
    
    // 检查宪法依据
    if (context?.constitutionalBasis && context.constitutionalBasis.length === 0) {
      warnings.push('§183.4: 任务应包含宪法依据');
    }
    
    return {
      isCompliant: violations.length === 0,
      violations,
      warnings,
      timestamp: Date.now(),
    };
  }
}

/**
 * 基础Agent抽象类
 */
export abstract class BaseAgent implements IAgentBase {
  public readonly id: string;
  public readonly name: string;
  public readonly layer: AgentLayer;
  public readonly specialty: AgentSpecialty;
  public get status(): AgentStatus {
    return this._status;
  }
  
  private _status: AgentStatus = 'initializing';
  protected metrics: AgentMetrics = {
    totalTasks: 0,
    successfulTasks: 0,
    avgResponseTime: 0,
    totalTokensUsed: 0,
    collaborationCount: 0,
    taskTypeDistribution: {},
  };
  
  protected logs: AgentLogEntry[] = [];
  protected maxLogSize = 1000;
  
  constructor(
    name: string,
    layer: AgentLayer,
    specialty: AgentSpecialty
  ) {
    this.id = this.generateId();
    this.name = name;
    this.layer = layer;
    this.specialty = specialty;
  }
  
  // 必须实现的方法
  abstract processTask(task: AgentTask, context?: TaskContext): Promise<TaskResult>;
  abstract evaluateComplexity(task: AgentTask): Promise<number>;
  abstract collaborate(otherAgentId: string, collaboration: CollaborationRequest): Promise<CollaborationResult>;
  abstract provideExpertAdvice(query: string, options?: AdviceOptions): Promise<ExpertAdvice>;
  
  // 可选覆盖的方法
  async activate(): Promise<void> {
    this._status = 'active';
    this.log('info', 'Agent activated');
  }
  
  async deactivate(): Promise<void> {
    this._status = 'idle';
    this.log('info', 'Agent deactivated');
  }
  
  async getHealth(): Promise<AgentHealth> {
    return {
      overall: 100,
      cpuUsage: 0,
      memoryUsage: 0,
      lastResponseTime: 0,
      errorRate: 0,
      details: {},
      timestamp: Date.now(),
    };
  }
  
  async getMetrics(): Promise<AgentMetrics> {
    return { ...this.metrics };
  }
  
  async getRecentLogs(limit = 50): Promise<AgentLogEntry[]> {
    return this.logs.slice(-limit);
  }
  
  // 辅助方法
  protected generateId(): string {
    return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  protected log(level: AgentLogEntry['level'], message: string, data?: Record<string, any>): void {
    const logEntry: AgentLogEntry = {
      level,
      message,
      timestamp: Date.now(),
      data,
    };
    
    this.logs.push(logEntry);
    
    // 保持日志大小限制
    if (this.logs.length > this.maxLogSize) {
      this.logs = this.logs.slice(-this.maxLogSize);
    }
    
    // 控制台输出（开发环境）
    if (process.env.NODE_ENV !== 'production') {
      const prefix = `[${this.name}]`;
      switch (level) {
        case 'error':
          console.error(prefix, message, data || '');
          break;
        case 'warn':
          console.warn(prefix, message, data || '');
          break;
        default:
          console.log(prefix, `${level.toUpperCase()}:`, message, data || '');
      }
    }
  }
  
  protected updateMetrics(result: TaskResult): void {
    this.metrics.totalTasks++;
    if (result.status === 'success') {
      this.metrics.successfulTasks++;
    }
    
    // 更新平均响应时间
    const totalTime = this.metrics.avgResponseTime * (this.metrics.totalTasks - 1) + result.duration;
    this.metrics.avgResponseTime = totalTime / this.metrics.totalTasks;
    
    // 更新Token消耗
    this.metrics.totalTokensUsed += result.tokensUsed || 0;
    
    // 更新任务类型分布
    const taskType = (result as any).taskType || 'unknown';
    this.metrics.taskTypeDistribution[taskType] = (this.metrics.taskTypeDistribution[taskType] || 0) + 1;
  }
  
  protected validateTaskInput(task: AgentTask, context?: TaskContext): void {
    const compliance = ConstitutionalComplianceChecker.checkTaskCompliance(task, context);
    if (!compliance.isCompliant) {
      throw new AgentError(
        AGENT_ERROR_CODES.CONSTITUTIONAL_VIOLATION,
        '任务输入违反宪法约束',
        compliance.violations,
        ['检查任务必填字段', '验证宪法依据']
      );
    }
  }
}