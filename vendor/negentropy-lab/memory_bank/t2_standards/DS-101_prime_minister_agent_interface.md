# AS-102 内阁总理Agent接口规范 (Prime Minister Agent Interface Specification)

**宪法依据**: §106 Agent身份公理、§109协作流程公理、§141熵减验证公理、§152单一真理源公理
**技术法依据**: AS-102 (内阁总理Agent接口规范)
**版本**: v1.3.0
**状态**: 🟢 活跃
**AI友好度**: ⭐⭐⭐⭐⭐ (5/5星 - 专为AI Agent设计)

---

## 🎯 标准目的

### AI Agent请注意：
**目标**: 定义内阁总理Agent的专门接口和职责，作为L2协调层核心组件，专门处理跨部门复杂任务。
**要解决的问题**: 在办公厅主任作为统一入口的基础上，提供战略级的复杂任务协调、宪法监督和冲突解决能力。

### 核心需求：
1. **战略协调**: 协调法务专家、程序猿、架构师等专业Agent解决复杂任务
2. **冲突仲裁**: 解决部门间意见分歧和优先级冲突
3. **宪法监督**: 确保所有操作符合宪法约束，特别是§152单一真理源和§141熵减验证
4. **资源调配**: 管理任务优先级和Agent资源分配
5. **复杂度评估**: 专业评估办公厅主任转交的复杂任务（复杂度>7）

---

## 📋 内阁总理Agent核心接口 (L2协调层)

### 1. IPrimeMinisterAgent 专用接口 (TypeScript)
```typescript
// AI注意：内阁总理Agent必须实现这个接口
export interface IPrimeMinisterAgent extends IAgent {
  /**
   * L2协调层核心能力：处理办公厅主任转交的复杂任务
   * @param complexTask 办公厅主任转交的复杂任务（复杂度>7）
   * @returns 战略级协调结果
   */
  coordinateComplexTask(complexTask: ComplexTask): Promise<CoordinationResult>;
  
  /**
   * 跨部门资源调配
   * @param departments 需要协调的专业部门
   * @returns 资源调配计划
   */
  allocateDepartmentResources(departments: Department[]): Promise<ResourceAllocation>;
  
  /**
   * 部门间冲突仲裁
   * @param conflicts 部门间意见分歧
   * @returns 宪法仲裁结果
   */
  arbitrateDepartmentConflicts(conflicts: DepartmentConflict[]): Promise<ArbitrationResult>;
  
  /**
   * 宪法合规监督
   * @param operation 待检查的操作
   * @returns 合规性检查报告
   */
  superviseConstitutionalCompliance(operation: ComplexOperation): Promise<ComplianceReport>;
  
  /**
   * 复杂度专业评估（二级评估）
   * @param task 待评估任务
   * @returns 专业复杂度评分（1-10）
   */
  assessComplexityProfessional(task: TaskAnalysis): Promise<ComplexityScore>;
  
  /**
   * 生成战略级协作方案
   * @param task 复杂任务
   * @returns 战略协作方案
   */
  generateStrategicPlan(task: ComplexTask): Promise<StrategicPlan>;
}
```

### 2. ComplexTask 复杂任务定义
```typescript
// AI注意：办公厅主任转交给内阁总理的复杂任务格式
export interface ComplexTask {
  // 任务唯一ID（由办公厅主任生成）
  taskId: string;
  
  // 原始用户请求内容
  originalRequest: string;
  
  // 办公厅主任的初始分析
  initialAnalysis: {
    intent: string;          // 意图识别结果
    complexity: number;      // 办公厅主任评估的复杂度（>7）
    assessment: string;      // 复杂度评估说明
    recommendedDepartments: string[]; // 建议参与的部门
  };
  
  // 任务上下文
  context: {
    conversationHistory?: Message[];      // 相关对话历史
    knowledgeReferences?: string[];       // 相关知识库引用
    constitutionalImplications?: string[]; // 涉及的宪法条款
    expectedOutcome?: string;             // 期望产出
    deadline?: number;                     // 截止时间
  };
  
  // 办公厅主任处理记录
  officeDirectorLogs: {
    timestamp: number;                    // 处理时间戳
    processingTime: number;               // 处理耗时（ms）
    assessmentMethod: string;             // 评估方法
    routingDecision: 'prime_minister';    // 路由决策
  };
}
```

### 3. CoordinationResult 协调结果定义
```typescript
// AI注意：内阁总理协调后的返回结果
export interface CoordinationResult {
  // 任务ID
  taskId: string;
  
  // 协调状态
  coordinationStatus: 'planning' | 'executing' | 'completed' | 'failed';
  
  // 战略计划
  strategicPlan: StrategicPlan;
  
  // 参与的部门Agent
  participatingDepartments: DepartmentParticipation[];
  
  // 宪法合规检查结果
  constitutionalCompliance: ComplianceReport;
  
  // 冲突解决记录
  conflictResolutions: ConflictResolution[];
  
  // 最终整合结果
  integratedResult: IntegratedResult;
  
  // 绩效指标
  performanceMetrics: {
    totalDuration: number;                // 总协调时间（ms）
    departmentResponseTimes: Record<string, number>; // 各部门响应时间
    resourceUtilization: number;          // 资源利用率（0-1）
    entropyReduction: number;             // 熵减效果（0-1）
  };
  
  // 协调时间戳
  coordinationStartTime: number;
  coordinationEndTime: number;
}

// 战略计划定义
export interface StrategicPlan {
  // 计划概述
  overview: string;
  
  // 阶段划分
  phases: CoordinationPhase[];
  
  // 部门职责分配
  departmentAssignments: DepartmentAssignment[];
  
  // 关键决策点
  decisionPoints: DecisionPoint[];
  
  // 风险分析与缓解
  riskAnalysis: RiskAnalysis;
  
  // 宪法约束映射
  constitutionalConstraints: ConstitutionalConstraint[];
}

// 协调阶段定义
export interface CoordinationPhase {
  phaseNumber: number;
  name: string;
  description: string;
  participatingDepartments: string[];
  expectedDuration: number;
  deliverables: string[];
  successCriteria: string[];
}
```

### 4. DepartmentConflict 部门冲突定义
```typescript
// AI注意：专业Agent间的意见分歧
export interface DepartmentConflict {
  conflictId: string;
  description: string;
  conflictingParties: {
    departmentA: string;    // 部门A ID
    departmentB: string;    // 部门B ID
  };
  conflictType: 'technical' | 'constitutional' | 'priority' | 'resource' | 'methodology';
  
  // 各方立场
  positions: {
    [departmentId: string]: {
      position: string;      // 立场描述
      rationale: string;     // 理论依据
      evidence?: any[];      // 支持证据
    };
  };
  
  // 冲突影响
  impact: {
    severity: 'low' | 'medium' | 'high' | 'critical';
    affectedOperations: string[];
    timelineImpact: number;  // 对时间线的影响（小时）
  };
}
```

---

## 🔧 内阁总理Agent实现指南 (AI可直接使用的模板)

### 模板：内阁总理Agent基础实现
```typescript
// AI注意：复制这个模板创建内阁总理Agent
class PrimeMinisterAgent extends ProfessionalAgent implements IPrimeMinisterAgent {
  // Agent标识
  readonly id = 'agent:prime_minister';
  readonly displayName = '内阁总理';
  readonly description = '专门协调多个专业Agent解决复杂任务，战略级协调与冲突解决 - L2协调层';
  
  // L2协调层专有能力
  readonly capabilities: AgentCapability[] = [
    { id: 'strategic_coordination', description: '战略级跨部门协调' },
    { id: 'conflict_arbitration', description: '部门间冲突仲裁' },
    { id: 'constitutional_supervision', description: '宪法合规监督' },
    { id: 'priority_management', description: '复杂任务优先级管理' },
    { id: 'resource_allocation', description: '跨部门资源调配' },
    { id: 'complexity_professional_assessment', description: '专业复杂度评估' }
  ];
  
  // 专有资源
  private coordinationEngine: CoordinationEngine;
  private constitutionChecker: ConstitutionChecker;
  private conflictResolver: ConflictResolver;
  private departmentRegistry: DepartmentRegistry;
  
  // 初始化
  async initialize(): Promise<void> {
    await super.initialize();
    
    // 初始化协调引擎
    this.coordinationEngine = new CoordinationEngine();
    await this.coordinationEngine.initialize();
    
    // 初始化宪法检查器
    this.constitutionChecker = new ConstitutionChecker();
    await this.constitutionChecker.initialize();
    
    // 初始化冲突解决器
    this.conflictResolver = new ConflictResolver();
    await this.conflictResolver.initialize();
    
    // 初始化部门注册表
    this.departmentRegistry = new DepartmentRegistry();
    await this.departmentRegistry.initialize();
    
    console.log('内阁总理Agent初始化完成，L2协调层就绪');
  }
  
  // L2协调层核心方法：处理办公厅主任转交的复杂任务
  async coordinateComplexTask(complexTask: ComplexTask): Promise<CoordinationResult> {
    const coordinationStartTime = Date.now();
    
    try {
      // 1. 专业复杂度验证（二级评估）
      const professionalComplexity = await this.assessComplexityProfessional({
        task: complexTask.originalRequest,
        initialAssessment: complexTask.initialAnalysis
      });
      
      if (professionalComplexity <= 7) {
        throw new Error(`任务复杂度${professionalComplexity}≤7，应由办公厅主任直接路由`);
      }
      
      // 2. 宪法合规预检
      const complianceReport = await this.superviseConstitutionalCompliance({
        task: complexTask,
        constitutionalImplications: complexTask.context.constitutionalImplications || []
      });
      
      if (!complianceReport.isCompliant) {
        throw new Error(`宪法合规检查失败: ${complianceReport.violations.join(', ')}`);
      }
      
      // 3. 生成战略计划
      const strategicPlan = await this.generateStrategicPlan(complexTask);
      
      // 4. 调配部门资源
      const departments = await this.departmentRegistry.getDepartmentsByExpertise(
        strategicPlan.requiredExpertise
      );
      const resourceAllocation = await this.allocateDepartmentResources(departments);
      
      // 5. 执行战略协调
      const coordinationResult = await this.coordinationEngine.executeStrategicPlan(
        strategicPlan,
        resourceAllocation
      );
      
      // 6. 处理冲突（如果有）
      let conflictResolutions: ConflictResolution[] = [];
      if (coordinationResult.conflicts.length > 0) {
        conflictResolutions = await this.arbitrateDepartmentConflicts(coordinationResult.conflicts);
      }
      
      // 7. 整合最终结果
      const integratedResult = await this.integrateDepartmentResults(
        coordinationResult.departmentResults,
        strategicPlan
      );
      
      const coordinationEndTime = Date.now();
      
      return {
        taskId: complexTask.taskId,
        coordinationStatus: 'completed',
        strategicPlan,
        participatingDepartments: departments.map(dept => ({
          departmentId: dept.id,
          departmentName: dept.name,
          assignedTasks: resourceAllocation.assignments[dept.id] || [],
          responseTime: coordinationResult.departmentTimings[dept.id] || 0
        })),
        constitutionalCompliance: complianceReport,
        conflictResolutions,
        integratedResult,
        performanceMetrics: {
          totalDuration: coordinationEndTime - coordinationStartTime,
          departmentResponseTimes: coordinationResult.departmentTimings,
          resourceUtilization: this.calculateResourceUtilization(resourceAllocation),
          entropyReduction: this.calculateEntropyReduction(complexTask, integratedResult)
        },
        coordinationStartTime,
        coordinationEndTime
      };
      
    } catch (error) {
      // 协调失败处理
      const coordinationEndTime = Date.now();
      
      return {
        taskId: complexTask.taskId,
        coordinationStatus: 'failed',
        strategicPlan: null as any,
        participatingDepartments: [],
        constitutionalCompliance: { isCompliant: false, violations: [error.message] },
        conflictResolutions: [],
        integratedResult: { success: false, error: error.message, partialResults: [] },
        performanceMetrics: {
          totalDuration: coordinationEndTime - coordinationStartTime,
          departmentResponseTimes: {},
          resourceUtilization: 0,
          entropyReduction: 0
        },
        coordinationStartTime,
        coordinationEndTime
      };
    }
  }
  
  // 跨部门资源调配
  async allocateDepartmentResources(departments: Department[]): Promise<ResourceAllocation> {
    // 基于部门能力和当前负载进行资源调配
    const currentLoad = await this.departmentRegistry.getCurrentLoad();
    
    const allocation: ResourceAllocation = {
      timestamp: Date.now(),
      departments: departments.map(dept => dept.id),
      assignments: {},
      priorities: {},
      constraints: {}
    };
    
    // 为每个部门分配任务和资源
    for (const dept of departments) {
      const departmentLoad = currentLoad[dept.id] || 0;
      const maxCapacity = dept.capacity || 1.0;
      const availableCapacity = maxCapacity - departmentLoad;
      
      allocation.assignments[dept.id] = {
        departmentId: dept.id,
        assignedTasks: [], // 由协调引擎具体分配
        allocatedResources: {
          computeUnits: dept.computeUnits * availableCapacity,
          memoryMB: dept.memoryMB * availableCapacity,
          priorityLevel: this.calculatePriority(dept, departmentLoad)
        }
      };
      
      allocation.priorities[dept.id] = this.calculatePriority(dept, departmentLoad);
      
      // 记录约束条件
      if (availableCapacity < 0.3) {
        allocation.constraints[dept.id] = 'high_load_warning';
      }
    }
    
    return allocation;
  }
  
  // 部门间冲突仲裁
  async arbitrateDepartmentConflicts(conflicts: DepartmentConflict[]): Promise<ArbitrationResult[]> {
    const arbitrationResults: ArbitrationResult[] = [];
    
    for (const conflict of conflicts) {
      try {
        // 基于宪法公理进行仲裁
        const arbitrationResult = await this.conflictResolver.arbitrate(conflict);
        
        arbitrationResults.push({
          conflictId: conflict.conflictId,
          arbitrationMethod: 'constitutional_arbitration',
          decision: arbitrationResult.decision,
          rationale: arbitrationResult.rationale,
          constitutionalBasis: arbitrationResult.constitutionalBasis,
          binding: true,
          appealDeadline: Date.now() + 3600000, // 1小时内可上诉
          enforcementMeasures: ['priority_adjustment', 'resource_reallocation']
        });
        
        // 记录审计日志
        await this.logArbitration(conflict, arbitrationResult);
        
      } catch (arbitrationError) {
        // 仲裁失败，采用默认冲突解决策略
        arbitrationResults.push({
          conflictId: conflict.conflictId,
          arbitrationMethod: 'default_escalation',
          decision: 'escalate_to_human',
          rationale: '自动仲裁失败，需要人工干预',
          constitutionalBasis: ['§160用户主权公理'],
          binding: false,
          appealDeadline: Date.now(),
          enforcementMeasures: []
        });
      }
    }
    
    return arbitrationResults;
  }
  
  // 宪法合规监督
  async superviseConstitutionalCompliance(operation: ComplexOperation): Promise<ComplianceReport> {
    const report: ComplianceReport = {
      operationId: operation.task.taskId,
      timestamp: Date.now(),
      isCompliant: true,
      violations: [],
      warnings: [],
      recommendations: []
    };
    
    // 检查§152单一真理源公理
    const truthSourceCompliance = await this.constitutionChecker.checkSingleTruthSource(
      operation.task.context.knowledgeReferences || []
    );
    if (!truthSourceCompliance.compliant) {
      report.isCompliant = false;
      report.violations.push(`§152违反: ${truthSourceCompliance.violations.join(', ')}`);
    }
    
    // 检查§141熵减验证公理
    const entropyCompliance = await this.constitutionChecker.checkEntropyReduction(
      operation.task.initialAnalysis.complexity,
      operation.expectedEntropyReduction || 0
    );
    if (!entropyCompliance.compliant) {
      report.warnings.push(`§141警告: ${entropyCompliance.warnings.join(', ')}`);
    }
    
    // 检查§102.3宪法同步公理
    const syncCompliance = await this.constitutionChecker.checkConstitutionalSync(
      operation.constitutionalImplications || []
    );
    if (!syncCompliance.compliant) {
      report.violations.push(`§102.3违反: ${syncCompliance.violations.join(', ')}`);
    }
    
    // 检查§190网络韧性公理
    const resilienceCompliance = await this.constitutionChecker.checkNetworkResilience(
      operation.requiredDepartments || []
    );
    if (!resilienceCompliance.compliant) {
      report.warnings.push(`§190警告: ${resilienceCompliance.warnings.join(', ')}`);
    }
    
    // 提供合规建议
    if (report.violations.length > 0) {
      report.recommendations = await this.constitutionChecker.generateComplianceRecommendations(
        report.violations
      );
    }
    
    return report;
  }
  
  // 专业复杂度评估（二级评估）
  async assessComplexityProfessional(taskAnalysis: TaskAnalysis): Promise<ComplexityScore> {
    // 基于多个维度进行专业评估
    const factors = {
      // 技术维度
      technicalComplexity: await this.assessTechnicalComplexity(taskAnalysis.task),
      
      // 法律维度
      legalComplexity: await this.assessLegalComplexity(
        taskAnalysis.initialAssessment.constitutionalImplications || []
      ),
      
      // 架构维度
      architecturalComplexity: await this.assessArchitecturalComplexity(
        taskAnalysis.initialAssessment.expectedImpact || 'unknown'
      ),
      
      // 协作维度
      collaborationComplexity: taskAnalysis.initialAssessment.recommendedDepartments.length * 1.5,
      
      // 时间维度
      timeSensitivity: taskAnalysis.initialAssessment.deadline 
        ? this.calculateTimeSensitivity(taskAnalysis.initialAssessment.deadline)
        : 1
    };
    
    // 加权计算总复杂度
    const weightedScore = 
      factors.technicalComplexity * 0.3 +
      factors.legalComplexity * 0.25 +
      factors.architecturalComplexity * 0.25 +
      factors.collaborationComplexity * 0.15 +
      factors.timeSensitivity * 0.05;
    
    // 归一化到1-10分
    return Math.min(10, Math.max(1, Math.round(weightedScore)));
  }
  
  // 生成战略级协作方案
  async generateStrategicPlan(complexTask: ComplexTask): Promise<StrategicPlan> {
    // 分析任务需求
    const requirements = await this.analyzeTaskRequirements(complexTask);
    
    // 确定所需专业部门
    const requiredDepartments = await this.departmentRegistry.matchDepartmentsToRequirements(requirements);
    
    // 设计协调阶段
    const phases = this.designCoordinationPhases(requirements, requiredDepartments);
    
    // 分配部门职责
    const departmentAssignments = this.assignDepartmentResponsibilities(requiredDepartments, phases);
    
    // 分析风险
    const riskAnalysis = await this.analyzeCoordinationRisks(phases, requiredDepartments);
    
    // 识别宪法约束
    const constitutionalConstraints = await this.identifyConstitutionalConstraints(complexTask);
    
    return {
      overview: `针对"${complexTask.originalRequest.substring(0, 100)}..."的战略协作方案`,
      phases,
      departmentAssignments,
      decisionPoints: this.identifyDecisionPoints(phases),
      riskAnalysis,
      constitutionalConstraints
    };
  }
  
  // 私有工具方法
  private async calculatePriority(dept: Department, currentLoad: number): number {
    // 优先级算法：考虑部门重要性、当前负载、任务紧急度
    const importance = dept.importance || 1.0;
    const availability = 1.0 - currentLoad;
    return Math.min(10, Math.max(1, Math.round(importance * 3 + availability * 7)));
  }
  
  private calculateResourceUtilization(allocation: ResourceAllocation): number {
    const totalAssigned = Object.values(allocation.assignments).length;
    const totalAvailable = allocation.departments.length;
    return totalAvailable > 0 ? totalAssigned / totalAvailable : 0;
  }
  
  private calculateEntropyReduction(complexTask: ComplexTask, result: IntegratedResult): number {
    // 熵减效果计算：基于任务复杂度降低和结果质量
    const initialComplexity = complexTask.initialAnalysis.complexity;
    const resultQuality = result.success ? (result.confidence || 0.5) : 0;
    return Math.min(1, initialComplexity / 10 * resultQuality);
  }
}
```

---

## 🚀 快速开始：使用内阁总理Agent (AI协作示例)

### 场景：复杂法典重构任务
```typescript
// AI示例：如何使用内阁总理Agent协调复杂任务
async function handleComplexConstitutionalRefactoring() {
  // 假设办公厅主任已经处理了用户请求，识别为复杂任务
  const complexTask: ComplexTask = {
    taskId: 'task_constitutional_refactor_001',
    originalRequest: '重构法典索引系统，合并冗余条款，优化引用结构',
    initialAnalysis: {
      intent: 'constitutional_restructuring',
      complexity: 9,  // 办公厅主任评估为9分
      assessment: '涉及多部门协作，需要宪法修改和技术实现',
      recommendedDepartments: ['legal_expert', 'programmer', 'architect']
    },
    context: {
      constitutionalImplications: ['§102.3', '§114', '§141', '§152'],
      expectedOutcome: '统一的三层法典索引架构',
      deadline: Date.now() + 86400000  // 24小时
    },
    officeDirectorLogs: {
      timestamp: Date.now(),
      processingTime: 1500,
      assessmentMethod: 'intent_analysis_v2',
      routingDecision: 'prime_minister'
    }
  };
  
  // 获取内阁总理Agent实例
  const primeMinister = await AgentRegistry.getAgent('agent:prime_minister') as IPrimeMinisterAgent;
  
  // 发起战略协调
  const coordinationResult = await primeMinister.coordinateComplexTask(complexTask);
  
  // 处理协调结果
  if (coordinationResult.coordinationStatus === 'completed') {
    console.log('战略协调成功完成!');
    console.log('参与部门:', coordinationResult.participatingDepartments.map(d => d.departmentName));
    console.log('总协调时间:', coordinationResult.performanceMetrics.totalDuration, 'ms');
    console.log('熵减效果:', coordinationResult.performanceMetrics.entropyReduction);
    
    // 将结果返回给办公厅主任
    return coordinationResult.integratedResult;
    
  } else {
    console.error('战略协调失败:', coordinationResult.integratedResult.error);
    
    // 启动危机处理协议
    await this.initiateCrisisProtocol(complexTask, coordinationResult);
    
    return {
      success: false,
      error: '内阁总理协调失败，已启动危机处理协议',
      fallbackResult: await this.getFallbackSolution(complexTask)
    };
  }
}
```

### 场景：部门间冲突解决
```typescript
// AI示例：内阁总理仲裁部门冲突
async function resolveInterDepartmentConflict() {
  // 模拟部门冲突：法务专家 vs 程序猿
  const conflict: DepartmentConflict = {
    conflictId: 'conflict_constitutional_vs_technical_001',
    description: '关于新功能宪法合规性的技术实现冲突',
    conflictingParties: {
      departmentA: 'agent:legal_expert',
      departmentB: 'agent:programmer'
    },
    conflictType: 'constitutional',
    positions: {
      'agent:legal_expert': {
        position: '必须先完成宪法合规审查才能进行技术实现',
        rationale: '§102.3宪法同步公理要求技术实现前必须确保宪法合规',
        evidence: ['DS-005_自动化重构安全标准实现.md', 'WF-210_安全操作流程.md']
      },
      'agent:programmer': {
        position: '需要技术原型验证才能确定宪法合规的具体要求',
        rationale: '技术可行性影响宪法条款的具体实现方式',
        evidence: ['DS-001_UTF-8输出配置标准实现.md', 'DS-002_原子文件写入标准实现.md']
      }
    },
    impact: {
      severity: 'high',
      affectedOperations: ['新功能开发', '知识库修改', '系统集成'],
      timelineImpact: 48  // 48小时影响
    }
  };
  
  // 获取内阁总理Agent
  const primeMinister = await AgentRegistry.getAgent('agent:prime_minister') as IPrimeMinisterAgent;
  
  // 仲裁冲突
  const arbitrationResult = await primeMinister.arbitrateDepartmentConflicts([conflict]);
  
  if (arbitrationResult[0].binding) {
    console.log('冲突仲裁完成，具有约束力');
    console.log('仲裁决定:', arbitrationResult[0].decision);
    console.log('宪法依据:', arbitrationResult[0].constitutionalBasis);
    
    // 强制执行仲裁决定
    await this.enforceArbitrationDecision(arbitrationResult[0]);
    
  } else {
    console.log('冲突需要人工干预，已上报');
    
    // 上报给人类用户（根据§160用户主权公理）
    await this.escalateToHumanUser(conflict, arbitrationResult[0]);
  }
}
```

---

## 📊 内阁总理Agent性能指标 (AI监控指南)

### 监控仪表板
内阁总理Agent应报告以下关键性能指标：

| 指标 | 定义 | 目标值 | 监控频率 |
|------|------|--------|----------|
| **协调成功率** | 成功完成的协调任务比例 | > 95% | 实时 |
| **平均协调时间** | 从接收到完成的平均时间 | < 30分钟 | 每5分钟 |
| **冲突解决率** | 成功仲裁的部门冲突比例 | > 90% | 实时 |
| **宪法合规率** | 合规操作的比例 | 100% | 实时 |
| **部门响应率** | 专业部门及时响应比例 | > 85% | 每15分钟 |
| **资源利用率** | 部门资源使用效率 | 60-80% | 每5分钟 |
| **熵减效果** | 任务处理前后的熵值变化 | ΔH > 0 | 每任务 |

### 健康检查
```typescript
// AI注意：内阁总理Agent健康检查实现
async function checkPrimeMinisterHealth(): Promise<HealthReport> {
  const report: HealthReport = {
    agentId: 'agent:prime_minister',
    timestamp: Date.now(),
    component: 'prime_minister',
    status: 'healthy',
    metrics: {},
    issues: []
  };
  
  // 检查协调引擎
  try {
    const engineStatus = await this.coordinationEngine.getStatus();
    report.metrics.coordinationEngine = engineStatus;
    
    if (engineStatus.status !== 'ready') {
      report.status = 'degraded';
      report.issues.push('协调引擎状态异常');
    }
  } catch (error) {
    report.status = 'unhealthy';
    report.issues.push(`协调引擎检查失败: ${error.message}`);
  }
  
  // 检查宪法检查器
  try {
    const constitutionStatus = await this.constitutionChecker.getStatus();
    report.metrics.constitutionChecker = constitutionStatus;
  } catch (error) {
    report.status = 'unhealthy';
    report.issues.push(`宪法检查器检查失败: ${error.message}`);
  }
  
  // 检查部门注册表
  try {
    const registryStatus = await this.departmentRegistry.getStatus();
    report.metrics.departmentRegistry = registryStatus;
    
    const totalDepartments = registryStatus.registeredDepartments;
    const availableDepartments = registryStatus.availableDepartments;
    
    if (availableDepartments / totalDepartments < 0.7) {
      report.status = 'degraded';
      report.issues.push(`部门可用率低: ${availableDepartments}/${totalDepartments}`);
    }
  } catch (error) {
    report.status = 'unhealthy';
    report.issues.push(`部门注册表检查失败: ${error.message}`);
  }
  
  // 检查最近协调任务
  const recentTasks = await this.getRecentCoordinationTasks(10);
  const successRate = recentTasks.filter(t => t.success).length / recentTasks.length;
  report.metrics.recentSuccessRate = successRate;
  
  if (successRate < 0.8) {
    report.status = 'degraded';
    report.issues.push(`近期协调成功率低: ${(successRate * 100).toFixed(1)}%`);
  }
  
  return report;
}
```

---

## ⚠️ 常见问题与解决方案 (AI故障排除指南)

### 问题1：部门无响应
**现象**: 内阁总理调用专业部门Agent时无响应或超时
**解决方案**：
```typescript
async function handleDepartmentUnresponsive(departmentId: string, task: ComplexTask): Promise<FallbackPlan> {
  console.warn(`部门 ${departmentId} 无响应，启动故障处理`);
  
  // 策略1：寻找替代部门
  const alternativeDepartment = await this.departmentRegistry.findAlternative(departmentId);
  if (alternativeDepartment) {
    console.log(`找到替代部门: ${alternativeDepartment.id}`);
    return {
      action: 'replace_department',
      alternative: alternativeDepartment,
      taskAdjustment: await this.adjustTaskForAlternative(task, alternativeDepartment)
    };
  }
  
  // 策略2：降级处理
  console.log('无替代部门，启动降级处理');
  const downgradedTask = await this.downgradeTaskComplexity(task, departmentId);
  
  // 策略3：转回办公厅主任重新路由
  if (downgradedTask.complexity <= 7) {
    console.log('任务复杂度已降至7以下，转回办公厅主任');
    return {
      action: 'return_to_office_director',
      downgradedTask,
      reason: 'department_unavailable_complexity_reduced'
    };
  }
  
  // 策略4：人工干预
  console.log('启动人工干预协议');
  return {
    action: 'human_intervention',
    escalationLevel: 'critical',
    estimatedWaitTime: 300000,  // 5分钟
    fallbackInstructions: await this.generateHumanInstructions(task)
  };
}
```

### 问题2：宪法约束冲突
**现象**: 不同宪法条款要求相互冲突
**解决方案**：
```typescript
async function resolveConstitutionalConflict(conflictingClauses: string[]): Promise<ConflictResolution> {
  // 应用宪法冲突解决层次
  const hierarchy = {
    '§160': 100,  // 用户主权公理最高优先级
    '§152': 90,   // 单一真理源公理
    '§141': 80,   // 熵减验证公理
    '§125': 70,   // 数据完整性公理
    '§102.3': 60, // 宪法同步公理
    '§190': 50    // 网络韧性公理
  };
  
  // 找出最高优先级的条款
  const priorities = conflictingClauses.map(clause => ({
    clause,
    priority: hierarchy[clause] || 10
  }));
  
  priorities.sort((a, b) => b.priority - a.priority);
  
  const primaryClause = priorities[0].clause;
  const secondaryClauses = priorities.slice(1).map(p => p.clause);
  
  return {
    decision: `优先遵循${primaryClause}，${secondaryClauses.join('、')}在${primaryClause}框架下解释`,
    rationale: `根据宪法冲突解决层次，${primaryClause}具有更高优先级`,
    constitutionalBasis: ['宪法冲突解决协议'],
    complianceCheck: await this.ensureComplianceWithPrimary(primaryClause, secondaryClauses)
  };
}
```

### 问题3：协调过程无限循环
**现象**: 部门间反馈循环导致协调无法收敛
**解决方案**：
```typescript
async function detectAndBreakCoordinationLoop(coordinationProcess: CoordinationProcess): Promise<LoopBreakResult> {
  const loopDetection = {
    maxIterations: 10,
    maxDuration: 1800000,  // 30分钟
    iterationCount: coordinationProcess.iterationCount || 0,
    startTime: coordinationProcess.startTime || Date.now()
  };
  
  // 检查是否超过限制
  const currentDuration = Date.now() - loopDetection.startTime;
  
  if (loopDetection.iterationCount >= loopDetection.maxIterations) {
    console.warn(`协调迭代超过${loopDetection.maxIterations}次，检测到可能循环`);
    return await this.breakLoopByForcedDecision(coordinationProcess);
  }
  
  if (currentDuration >= loopDetection.maxDuration) {
    console.warn(`协调持续时间超过${loopDetection.maxDuration/60000}分钟`);
    return await this.breakLoopByTimeLimit(coordinationProcess);
  }
  
  // 检查部门间反馈模式
  const feedbackPattern = this.analyzeFeedbackPattern(coordinationProcess.departmentFeedbacks);
  if (feedbackPattern.isCyclic) {
    console.warn(`检测到循环反馈模式: ${feedbackPattern.cycleDescription}`);
    return await this.breakLoopByPatternIntervention(coordinationProcess, feedbackPattern);
  }
  
  // 正常情况
  return {
    shouldBreak: false,
    continueReason: '协调正常进行',
    suggestedAdjustment: null
  };
}
```

---

## 🔄 版本兼容性 (L2协调层升级指南)

### 版本迁移路径
- **v1.0.0 → v1.1.0**: 基础内阁总理Agent，支持简单部门协调
- **v1.1.0 → v1.2.0**: 添加宪法冲突仲裁和资源调配
- **v1.2.0 → v1.3.0**: **三层架构集成**，与办公厅主任紧密协同

### 向后兼容性保证
```typescript
// AI注意：内阁总理Agent版本兼容性处理
class BackwardCompatiblePrimeMinister extends PrimeMinisterAgent {
  async coordinateComplexTask(complexTask: any): Promise<any> {
    // 检测任务格式版本
    const taskVersion = this.detectTaskVersion(complexTask);
    
    // 版本适配
    const adaptedTask = await this.adaptTaskToCurrentVersion(complexTask, taskVersion);
    
    // 调用父类方法
    return super.coordinateComplexTask(adaptedTask);
  }
  
  private detectTaskVersion(task: any): string {
    // 版本检测逻辑
    if (task.officeDirectorLogs?.routingDecision === 'prime_minister') {
      return 'v1.3.0';  // 三层架构版本
    } else if (task.complexityAssessment?.method === 'professional') {
      return 'v1.2.0';  // 专业评估版本
    } else if (task.departmentRequirements) {
      return 'v1.1.0';  // 部门需求版本
    } else {
      return 'v1.0.0';  // 基础版本
    }
  }
}
```

---

## 📝 验证清单 (内阁总理Agent自检清单)

在实现内阁总理Agent时，请验证以下项目：

✅ **L2协调层完整性**：
- [ ] 实现了完整的 `IPrimeMinisterAgent` 接口
- [ ] `coordinateComplexTask()` 能处理复杂度>7的任务
- [ ] `arbitrateDepartmentConflicts()` 能有效解决部门冲突
- [ ] `superviseConstitutionalCompliance()` 能准确检查宪法合规

✅ **三层架构集成**：
- [ ] 能正确接收办公厅主任转交的任务
- [ ] 任务复杂度验证逻辑准确
- [ ] 结果能正确返回给办公厅主任
- [ ] 与L1、L3层Agent通信正常

✅ **宪法监督能力**：
- [ ] 能检查§152单一真理源公理
- [ ] 能验证§141熵减验证公理
- [ ] 能确保§102.3宪法同步公理
- [ ] 能保障§190网络韧性公理

✅ **性能与监控**：
- [ ] 实时报告协调成功率
- [ ] 监控部门响应时间
- [ ] 计算熵减效果指标
- [ ] 实现健康检查机制

✅ **故障恢复**：
- [ ] 部门无响应时的替代方案
- [ ] 宪法冲突的解决策略
- [ ] 协调循环的检测和中断
- [ ] 人工干预的上报机制

---

**宪法依据**: §106 Agent身份公理、§109协作流程公理、§141熵减验证公理、§152单一真理源公理  
**维护责任**: 内阁总理Agent（自身）、架构师Agent（架构监督）  
**最后更新**: 2026-02-04  
**状态**: **内阁总理Agent标准就绪，L2协调层就位，支持三层架构协同**