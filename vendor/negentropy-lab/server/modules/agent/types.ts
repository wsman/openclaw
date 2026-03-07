/**
 * 🏛️ Agent 类型定义 - 单一真理源
 * 
 * 宪法依据：
 * - §152 单一真理源公理：Agent配置统一管理
 * - §106 Agent身份公理：每个Agent必须拥有唯一身份标识和明确职责
 * 
 * 整合来源：
 * - server/api/agent.ts (原 AgentConfig 定义)
 * - server/gateway/agent-engine.ts (重复定义)
 * - server/types/system/AgentTypes.ts (扩展定义)
 */

/**
 * Agent 类型枚举
 */
export type AgentType = 
  | 'supervision_ministry' 
  | 'technology_ministry' 
  | 'organization_ministry' 
  | 'secretary' 
  | 'office_director' 
  | 'prime_minister' 
  | 'custom';

/**
 * LLM 提供商类型
 */
export type LLMProvider = 
  | 'deepseek' 
  | 'openai' 
  | 'local' 
  | 'azure' 
  | 'anthropic' 
  | 'custom';

/**
 * Agent 状态枚举
 */
export type AgentStatus = 'active' | 'inactive' | 'maintenance' | 'testing';

/**
 * 协作规则配置
 */
export interface CollaborationRules {
  /** 是否可以发起协作 */
  can_initiate_collaboration: boolean;
  /** 是否可以协调其他Agent */
  can_coordinate_others: boolean;
  /** 专业领域列表 */
  expertise_domains: string[];
  /** 必需的前置条件 */
  required_preconditions: string[];
}

/**
 * Agent 配置接口 - 唯一定义
 * 
 * 整合了所有 Agent 配置字段，确保类型一致性
 */
export interface AgentConfig {
  // === 基础标识 ===
  id: string;
  agentId?: string;  // 兼容字段
  name: string;
  type: AgentType;
  description: string;
  version: string;

  // === LLM 配置 ===
  llm_provider: LLMProvider;
  llm_model: string;
  api_key?: string;      // 加密存储
  api_endpoint?: string;

  // === 运行参数 ===
  max_response_time: number;  // ms
  max_token_limit: number;
  temperature: number;
  system_prompt: string;

  // === 协作配置 ===
  collaboration_rules: CollaborationRules;

  // === 状态信息 ===
  status: AgentStatus;
  last_active: number;
  
  // === 当前任务状态 ===
  currentTaskId?: string;
  taskProgress?: number;

  // === 元数据 ===
  created_at: number;
  updated_at: number;
  created_by: string;
}

/**
 * 办公厅主任扩展配置
 */
export interface OfficeDirectorAgentConfig extends AgentConfig {
  type: 'office_director';
  /** 可以路由的Agent列表 */
  routing_targets?: string[];
  /** 复杂度阈值 */
  complexity_threshold?: number;
}

/**
 * Agent 信息摘要（用于协作响应）
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
 * Agent 请求接口
 */
export interface AgentRequest {
  agentId: string;
  agentName: string;
  query: string;
  context?: string;
  config?: {
    temperature?: number;
    maxTokens?: number;
  };
}

/**
 * Agent 响应接口
 */
export interface AgentResponse {
  success: boolean;
  data?: any;
  processing_time?: number;
  timestamp: number;
  error?: string;
}

/**
 * 协作请求接口
 */
export interface CollaborationRequest {
  coordinatorRequest: AgentRequest;
  specialistRequests: AgentRequest[];
}

/**
 * 协作结果接口
 */
export interface CollaborationResult {
  collaborationId: string;
  coordinator: AgentInfo;
  participants: AgentInfo[];
  result: any;
  processingTime: number;
  complianceCheck: {
    constitutional: boolean;
    technical: boolean;
    operational: boolean;
  };
}

/**
 * Agent 引擎配置
 */
export interface AgentEngineConfig {
  enabled: boolean;
  defaultAgentsPath?: string;
  autoInitialize?: boolean;
  enableHealthChecks?: boolean;
  maxAgents?: number;
}

/**
 * 宪法合规检查结果
 */
export interface ConstitutionalCompliance {
  valid: boolean;
  agent_id: string;
  agent_name: string;
  action: string;
  checks: Array<{
    clause: string;
    description: string;
    valid: boolean;
  }>;
  violations: Array<{
    clause: string;
    description: string;
    valid: boolean;
  }>;
  overall_compliance: 'compliant' | 'partial' | 'non-compliant';
  timestamp: number;
}

// === 默认 Agent 配置 ===

/**
 * 获取默认 Agent 配置列表
 */
export function getDefaultAgents(): AgentConfig[] {
  return [
    {
      id: 'agent:supervision_ministry',
      name: '监察部Agent',
      type: 'supervision_ministry',
      description: '负责法律、合规和宪法解释的专业Agent',
      llm_provider: 'deepseek',
      llm_model: 'deepseek-chat',
      max_response_time: 30000,
      max_token_limit: 8192,
      temperature: 0.3,
      system_prompt: '你是逆熵实验室的法务专家，负责法律、合规和宪法解释。你需要：1. 检查所有操作的宪法依据 2. 识别潜在的法律风险 3. 提供合规建议 4. 解释法典条款的含义和应用。所有回答必须引用具体的宪法条款（如§201、§141等）。',
      collaboration_rules: {
        can_initiate_collaboration: false,
        can_coordinate_others: false,
        expertise_domains: ['legal', 'compliance', 'constitutional'],
        required_preconditions: ['legal_analysis_needed', 'compliance_check', 'constitutional_interpretation']
      },
      status: 'active',
      last_active: Date.now(),
      version: '1.0.0',
      created_at: Date.now(),
      updated_at: Date.now(),
      created_by: 'system'
    },
    {
      id: 'agent:technology_ministry',
      name: '科技部Agent',
      type: 'technology_ministry',
      description: '负责代码实现和技术细节的专业Agent',
      llm_provider: 'deepseek',
      llm_model: 'deepseek-chat',
      max_response_time: 25000,
      max_token_limit: 16384,
      temperature: 0.5,
      system_prompt: '你是逆熵实验室的程序猿，负责代码实现和技术细节。你需要：1. 编写高效、可维护的代码 2. 遵循技术法标准 3. 处理技术问题和bug 4. 提供技术架构建议。所有代码必须遵循DS-xxx技术标准。',
      collaboration_rules: {
        can_initiate_collaboration: false,
        can_coordinate_others: false,
        expertise_domains: ['programming', 'technical', 'implementation', 'debugging'],
        required_preconditions: ['code_implementation_needed', 'technical_problem', 'bug_fix']
      },
      status: 'active',
      last_active: Date.now(),
      version: '1.0.0',
      created_at: Date.now(),
      updated_at: Date.now(),
      created_by: 'system'
    },
    {
      id: 'agent:organization_ministry',
      name: '组织部Agent',
      type: 'organization_ministry',
      description: '负责系统架构设计和优化的专业Agent',
      llm_provider: 'deepseek',
      llm_model: 'deepseek-chat',
      max_response_time: 35000,
      max_token_limit: 12288,
      temperature: 0.4,
      system_prompt: '你是逆熵实验室的架构师，负责系统架构设计和优化。你需要：1. 设计可扩展的架构方案 2. 评估技术债务和风险 3. 提供架构改进建议 4. 确保系统符合架构公理。所有建议必须考虑§114双存储同构、§152单一真理源等架构约束。',
      collaboration_rules: {
        can_initiate_collaboration: false,
        can_coordinate_others: false,
        expertise_domains: ['architecture', 'design', 'optimization', 'scalability'],
        required_preconditions: ['architecture_review_needed', 'design_decision', 'performance_optimization']
      },
      status: 'active',
      last_active: Date.now(),
      version: '1.0.0',
      created_at: Date.now(),
      updated_at: Date.now(),
      created_by: 'system'
    },
    {
      id: 'agent:secretary',
      name: '书记员',
      type: 'secretary',
      description: '负责文档记录和知识管理的专业Agent',
      llm_provider: 'deepseek',
      llm_model: 'deepseek-chat',
      max_response_time: 20000,
      max_token_limit: 6144,
      temperature: 0.3,
      system_prompt: '你是逆熵实验室的书记员，负责文档记录和知识管理。你需要：1. 记录会议纪要和决策 2. 整理和归档知识 3. 维护文档一致性 4. 提供文档模板和标准。所有文档必须遵循技术法文档标准和记忆银行规范。',
      collaboration_rules: {
        can_initiate_collaboration: false,
        can_coordinate_others: false,
        expertise_domains: ['documentation', 'knowledge_management', 'records', 'archiving'],
        required_preconditions: ['documentation_needed', 'knowledge_organization', 'record_keeping']
      },
      status: 'active',
      last_active: Date.now(),
      version: '1.0.0',
      created_at: Date.now(),
      updated_at: Date.now(),
      created_by: 'system'
    },
    {
      id: 'agent:office_director',
      name: '办公厅主任',
      type: 'office_director',
      description: '统一用户对话入口 + 书记员职责合并 + 日常任务路由 - L1入口层',
      llm_provider: 'deepseek',
      llm_model: 'deepseek-chat',
      max_response_time: 45000,
      max_token_limit: 16384,
      temperature: 0.4,
      system_prompt: '你是逆熵实验室的办公厅主任，负责所有用户消息的统一入口，集成了书记员的记录职责和初步处理能力。你需要：1. 接收并格式化用户消息 2. 进行意图识别和复杂度评估（1-10分）3. 复杂度≤7的简单任务直接路由到对应专业Agent 4. 复杂度>7的复杂任务转交给内阁总理Agent协调 5. 记录完整的对话历史和知识要点 6. 归档协作结果到知识库。遵循§102.3宪法同步公理和§141熵减验证公理。',
      collaboration_rules: {
        can_initiate_collaboration: true,
        can_coordinate_others: false,
        expertise_domains: ['entry_management', 'intent_analysis', 'complexity_assessment', 'documentation', 'knowledge_archiving', 'simple_routing'],
        required_preconditions: ['user_message_received', 'initial_processing_needed', 'record_keeping_required']
      },
      status: 'active',
      last_active: Date.now(),
      version: '1.3.0',
      created_at: Date.now(),
      updated_at: Date.now(),
      created_by: 'system'
    } as OfficeDirectorAgentConfig,
    {
      id: 'agent:prime_minister',
      name: '内阁总理',
      type: 'prime_minister',
      description: '专门协调多个专业Agent解决复杂任务，战略级协调与冲突解决 - L2协调层',
      llm_provider: 'deepseek',
      llm_model: 'deepseek-chat',
      max_response_time: 60000,
      max_token_limit: 16384,
      temperature: 0.2,
      system_prompt: '你是逆熵实验室的内阁总理，专门负责跨部门复杂任务的战略级协调。你需要：1. 接收办公厅主任转交的复杂任务（复杂度>7）2. 分析任务需求，协调法务专家、程序猿、架构师等专业Agent 3. 解决部门间意见分歧和冲突 4. 监督宪法合规性（§152单一真理源、§141熵减验证等）5. 管理任务优先级和资源分配 6. 整合专业意见形成最终方案返回给办公厅主任。遵循§109协作流程公理和§190网络韧性公理。',
      collaboration_rules: {
        can_initiate_collaboration: true,
        can_coordinate_others: true,
        expertise_domains: ['strategic_coordination', 'cross_department_collaboration', 'conflict_resolution', 'constitutional_supervision', 'priority_management', 'resource_allocation'],
        required_preconditions: ['complex_task', 'cross_department_coordination_needed', 'strategic_decision_required', 'constitutional_compliance_check']
      },
      status: 'active',
      last_active: Date.now(),
      version: '1.0.0',
      created_at: Date.now(),
      updated_at: Date.now(),
      created_by: 'system'
    }
  ];
}

export default {
  AgentConfig: {} as AgentConfig,
  AgentInfo: {} as AgentInfo,
  AgentRequest: {} as AgentRequest,
  AgentResponse: {} as AgentResponse,
  CollaborationRequest: {} as CollaborationRequest,
  CollaborationResult: {} as CollaborationResult,
  getDefaultAgents
};
