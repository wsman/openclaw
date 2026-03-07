/**
 * Agent系统核心类型定义
 * 
 * 宪法依据: §109协作流程公理、§110协作效率公理、§141熵减验证公理
 * 标准依据: AS-104 智能路由算法标准实现
 * 版本: v1.1.0 (回流集成自 Negentropy-Lab v1.3.0)
 * 
 * @version 1.1.0
 * @category Agent System
 */

/**
 * Agent配置接口 (回流自 Negentropy-Lab)
 * 回流时间: 2026-02-05
 * 回流依据: §152单一真理源公理、§102.3宪法同步公理、程序法§231架构回流流程
 */
export interface AgentConfig {
    /** Agent唯一标识符 */
    id: string;
    
    /** Agent名称 */
    name: string;
    
    /** Agent类型 */
    type: 'supervision_ministry' | 'technology_ministry' | 'organization_ministry' | 'secretary' | 'office_director' | 'prime_minister' | 'custom';
    
    /** Agent描述 */
    description: string;
    
    // LLM配置
    llm_provider: 'deepseek' | 'openai' | 'local' | 'azure' | 'anthropic' | 'custom';
    llm_model: string;
    api_key?: string; // 加密存储
    api_endpoint?: string;
    
    // 协作参数
    max_response_time: number; // ms
    max_token_limit: number;
    temperature: number;
    system_prompt: string;
    
    // 协作规则
    collaboration_rules: {
        can_initiate_collaboration: boolean;
        can_coordinate_others: boolean;
        expertise_domains: string[];
        required_preconditions: string[];
    };
    
    // 状态
    status: 'active' | 'inactive' | 'maintenance' | 'testing';
    last_active: number;
    version: string;
    
    // 元数据
    created_at: number;
    updated_at: number;
    created_by: string;
    
    // 可选字段: Agent标识符（兼容现有类型）
    agentId?: string;
}

/**
 * Agent基本信息
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
 * Agent注册信息
 */
export interface AgentRegistration {
    agentId: string;
    name: string;
    version: string;
    startupTime: number;
    capabilities: string[];
    status: 'starting' | 'running' | 'stopping' | 'stopped' | 'failed';
    lastHeartbeat: number;
    metadata?: Record<string, any>;
}

/**
 * Agent心跳数据
 */
export interface AgentHeartbeat {
    agentId: string;
    timestamp: number;
    cpuUsage?: number;
    memoryUsage?: number;
    load: number; // 0-1, 当前负载比例
    healthStatus: 'healthy' | 'degraded' | 'unhealthy';
    pendingTasks?: number;
    errorCount?: number;
    metrics?: Record<string, number>;
}

/**
 * Agent容量信息
 */
export interface AgentCapacity {
    agentId: string;
    currentLoad: number;
    capacity: number;
    availableCapacity: number;
    loadPercentage: number;
    healthStatus: 'healthy' | 'degraded' | 'unhealthy';
    lastHeartbeatAge: number;
}

/**
 * Agent选择策略
 */
export type AgentSelectionStrategy = 
    | 'load-balanced'     // 负载均衡
    | 'expertise-first'   // 专业领域优先
    | 'health-first'      // 健康状态优先
    | 'round-robin'       // 轮询
    | 'random'            // 随机选择

/**
 * Agent查询选项
 */
export interface AgentQueryOptions {
    strategy?: AgentSelectionStrategy;
    requiredExpertise?: string[];
    maxLoad?: number;
    minHealthStatus?: 'healthy' | 'degraded';
    excludeIds?: string[];
    limit?: number;
}

/**
 * Agent注册表统计信息
 */
export interface AgentRegistryStats {
    totalAgents: number;
    registeredAgents: number;
    healthyAgents: number;
    degradedAgents: number;
    unhealthyAgents: number;
    averageLoad: number;
    maxLoad: number;
    minLoad: number;
    totalCapacity: number;
    usedCapacity: number;
    availableCapacity: number;
    byExpertise: Record<string, number>;
    byStatus: Record<string, number>;
    timestamp: number;
}

/**
 * Agent注册表配置
 */
export interface AgentRegistryConfig {
    heartbeatTimeoutMs: number;
    cleanupIntervalMs: number;
    maxLoadThreshold: number;
    enableAutoScaling: boolean;
    minHealthyAgents: number;
    maxAgentsPerExpertise: number;
}

/**
 * Agent任务上下文接口 (回流自 Negentropy-Lab)
 */
export interface AgentTaskContext {
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
    collaborationHistory?: AgentCollaborationRecord[];
    
    /** 开始时间 */
    startTime?: number;
    
    /** 完成时间 */
    completionTime?: number;
}

/**
 * Agent协作记录接口 (回流自 Negentropy-Lab)
 */
export interface AgentCollaborationRecord {
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
    constitutionalCompliance: AgentComplianceAssessment;
    
    /** 记录时间 */
    timestamp: number;
}

/**
 * Agent合规评估接口 (回流自 Negentropy-Lab)
 */
export interface AgentComplianceAssessment {
    /** 总体合规性 */
    overallCompliance: 'compliant' | 'partial' | 'non-compliant';
    
    /** 合规详情 */
    complianceDetails: AgentComplianceDetail[];
    
    /** 违规项 */
    violations: AgentComplianceViolation[];
    
    /** 建议修正 */
    suggestedCorrections: AgentCorrectionSuggestion[];
    
    /** 评估时间戳 */
    timestamp: number;
}

/**
 * Agent合规详情接口 (回流自 Negentropy-Lab)
 */
export interface AgentComplianceDetail {
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
 * Agent合规违规接口 (回流自 Negentropy-Lab)
 */
export interface AgentComplianceViolation {
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
 * Agent修正建议接口 (回流自 Negentropy-Lab)
 */
export interface AgentCorrectionSuggestion {
    /** 建议ID */
    id: string;
    
    /** 目标违规 */
    targetViolationId: string;
    
    /** 修正描述 */
    description: string;
    
    /** 预期效果 */
    expectedEffect: string;
    
    /** 实施步骤 */
    implementationSteps: AgentImplementationStep[];
    
    /** 验证方法 */
    verificationMethod: string;
}

/**
 * Agent实施步骤接口 (回流自 Negentropy-Lab)
 */
export interface AgentImplementationStep {
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
 * 办公厅主任Agent配置接口 (回流自 Negentropy-Lab)
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
 * Agent回流版本兼容性声明
 * 
 * 版本兼容性规则:
 * 1. AgentConfig接口是Negentropy-Lab Agent系统的核心定义
 * 2. 现有AgentTypes.ts中的接口保持原样以向后兼容
 * 3. AgentConfig中的agentId字段兼容现有AgentInfo接口的agentId
 * 4. 新的Agent类应该使用AgentConfig接口，旧代码继续使用原有接口
 * 
 * 宪法依据: §152单一真理源公理、§102.3宪法同步公理
 * 回流完成时间: 2026-02-05
 */