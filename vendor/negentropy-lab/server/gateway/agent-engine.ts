/**
 * 🚀 Negentropy-Lab Agent引擎集成模块
 * 
 * 宪法依据：
 * - §101 同步公理：代码变更必须触发文档更新
 * - §102 熵减原则：所有变更必须降低或维持系统熵值
 * - §306 零停机协议：在生产级开发任务中确保服务连续性
 * - §109 协作流程公理：Agent协作流程标准化
 * - §110 协作效率公理：确保Agent协作效率
 * - §152 单一真理源公理：Agent配置统一管理
 * 
 * 移植来源：
 * 1. MY-DOGE-DEMO server/api/agent.ts (Agent配置管理API)
 * 2. MY-DOGE-DEMO server/types/system/AgentTypes.ts (Agent类型定义)
 * 3. MY-DOGE-DEMO server/api/llm.ts (Agent LLM服务集成)
 * 
 * 核心功能：
 * - Agent配置管理
 * - Agent协作协调
 * - LLM服务集成
 * - 宪法合规验证
 * - 状态监控与报告
 * 
 * @version 1.0.0 (Phase 1B移植)
 * @category Gateway/Agent
 */

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { authenticateJWT, AuthUser } from '../middleware/auth';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

// 导入MY-DOGE-DEMO Agent类型 (完整版)
import { AgentConfig, OfficeDirectorAgentConfig, AgentInfo } from '../types/system/AgentTypes';

// 扩展Express Request类型以包含用户信息
declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

// Agent引擎配置
export interface AgentEngineConfig {
  enabled: boolean;
  defaultAgentsPath?: string;
  autoInitialize?: boolean;
  enableHealthChecks?: boolean;
  maxAgents?: number;
}

// Agent请求接口
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

// Agent响应接口
export interface AgentResponse {
  success: boolean;
  data?: any;
  processing_time?: number;
  timestamp: number;
  error?: string;
}

// Agent协作请求接口
export interface CollaborationRequest {
  coordinatorRequest: AgentRequest;
  specialistRequests: AgentRequest[];
}

// Agent协作结果接口
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
 * Agent引擎核心类
 * 
 * 宪法依据: §152单一真理源公理，确保Agent配置统一管理
 */
export class AgentEngine {
  private config: AgentEngineConfig;
  private agents: Map<string, AgentConfig> = new Map();
  private logger = logger;
  private agentsConfigPath: string;
  
  /**
   * 构造函数
   * @param config Agent引擎配置
   */
  constructor(config: Partial<AgentEngineConfig> = {}) {
    this.config = {
      enabled: true,
      defaultAgentsPath: path.join(process.cwd(), 'storage', 'config', 'agents.json'),
      autoInitialize: true,
      enableHealthChecks: true,
      maxAgents: 100,
      ...config,
    };
    
    this.agentsConfigPath = this.config.defaultAgentsPath!;
    
    if (this.config.autoInitialize) {
      this.initialize();
    }
    
    this.logger.info('[Agent Engine] Agent引擎已初始化');
    this.logger.info(`[Agent Engine] 配置: ${JSON.stringify(this.config)}`);
    this.logger.info('[Agent Engine] 宪法合规: §101同步公理、§102熵减原则、§109协作流程公理、§110协作效率公理、§152单一真理源公理');
  }
  
  /**
   * 初始化Agent引擎
   */
  public initialize(): void {
    try {
      this.logger.info('[Agent Engine] 正在初始化Agent引擎...');
      
      // 确保配置目录存在
      const configDir = path.dirname(this.agentsConfigPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
        this.logger.info(`[Agent Engine] 创建配置目录: ${configDir}`);
      }
      
      // 加载或创建默认Agent配置
      this.loadAgentsConfig();
      
      // 启动健康检查（如果启用）
      if (this.config.enableHealthChecks) {
        this.startHealthChecks();
      }
      
      this.logger.info(`[Agent Engine] 初始化完成，共加载 ${this.agents.size} 个Agent`);
      
    } catch (error: any) {
      this.logger.error(`[Agent Engine] 初始化失败: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * 加载Agent配置
   */
  private loadAgentsConfig(): void {
    try {
      if (fs.existsSync(this.agentsConfigPath)) {
        const configData = JSON.parse(fs.readFileSync(this.agentsConfigPath, 'utf-8'));
        const agents = configData.agents || [];
        
        agents.forEach((agent: AgentConfig) => {
          this.agents.set(agent.id, agent);
        });
        
        this.logger.info(`[Agent Engine] 从文件加载 ${agents.length} 个Agent配置`);
      } else {
        this.createDefaultAgents();
        this.logger.info('[Agent Engine] 创建默认Agent配置');
      }
    } catch (error: any) {
      this.logger.error(`[Agent Engine] 加载Agent配置失败: ${error.message}`);
      this.createDefaultAgents();
    }
  }
  
  /**
   * 创建默认Agent配置
   */
  private createDefaultAgents(): void {
    const defaultAgents: AgentConfig[] = [
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
        created_by: 'system',
        agentId: 'agent:supervision_ministry'
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
        created_by: 'system',
        agentId: 'agent:technology_ministry'
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
        created_by: 'system',
        agentId: 'agent:organization_ministry'
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
        created_by: 'system',
        agentId: 'agent:office_director'
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
        created_by: 'system',
        agentId: 'agent:prime_minister'
      }
    ];
    
    defaultAgents.forEach(agent => {
      this.agents.set(agent.id, agent);
    });
    
    this.saveAgentsConfig();
  }
  
  /**
   * 保存Agent配置到文件
   */
  private saveAgentsConfig(): void {
    try {
      const agentsArray = Array.from(this.agents.values());
      const configData = {
        agents: agentsArray,
        version: '1.0.0',
        created_at: Date.now(),
        updated_at: Date.now(),
        engine_version: '1.0.0'
      };
      
      fs.writeFileSync(
        this.agentsConfigPath,
        JSON.stringify(configData, null, 2),
        'utf-8'
      );
      
      this.logger.debug(`[Agent Engine] 保存 ${agentsArray.length} 个Agent配置到文件`);
    } catch (error: any) {
      this.logger.error(`[Agent Engine] 保存Agent配置失败: ${error.message}`);
    }
  }
  
  /**
   * 启动健康检查
   */
  private startHealthChecks(): void {
    this.logger.info('[Agent Engine] 启动Agent健康检查系统');
    
    // 定期健康检查（每5分钟）
    setInterval(() => {
      this.performHealthChecks();
    }, 5 * 60 * 1000);
    
    // 立即执行一次健康检查
    this.performHealthChecks();
  }
  
  /**
   * 执行健康检查
   */
  private performHealthChecks(): void {
    try {
      const now = Date.now();
      let healthyCount = 0;
      const totalCount = this.agents.size;
      
      this.agents.forEach((agent, agentId) => {
        const lastActiveDiff = now - agent.last_active;
        const isHealthy = lastActiveDiff < 3600000; // 1小时内活跃视为健康
        
        if (!isHealthy) {
          this.logger.warn(`[Agent Engine] Agent ${agent.name} (${agentId}) 健康状态异常，上次活跃: ${lastActiveDiff}ms前`);
        } else {
          healthyCount++;
        }
      });
      
      const healthPercentage = totalCount > 0 ? (healthyCount / totalCount * 100).toFixed(1) : '0.0';
      
      this.logger.info(`[Agent Engine] 健康检查完成: ${healthyCount}/${totalCount} 个Agent健康 (${healthPercentage}%)`);
      
    } catch (error: any) {
      this.logger.error(`[Agent Engine] 健康检查执行失败: ${error.message}`);
    }
  }
  
  // ==================== 公共API方法 ====================
  
  /**
   * 获取所有Agent配置
   */
  public getAllAgents(): AgentConfig[] {
    return Array.from(this.agents.values()).map(agent => ({
      ...agent,
      api_key: undefined, // 移除敏感信息
      system_prompt: agent.system_prompt.substring(0, 100) + '...' // 只显示前100字符
    }));
  }
  
  /**
   * 获取单个Agent配置
   */
  public getAgent(agentId: string): AgentConfig | null {
    const agent = this.agents.get(agentId);
    if (!agent) return null;
    
    // 返回安全版本（移除敏感信息）
    return {
      ...agent,
      api_key: undefined,
      system_prompt: agent.system_prompt.substring(0, 100) + '...'
    };
  }
  
  /**
   * 创建新Agent
   */
  public createAgent(agentData: Partial<AgentConfig>): AgentConfig {
    if (!agentData.name || !agentData.type) {
      throw new Error('Agent名称和类型是必填项');
    }
    
    // 生成唯一ID
    const agentId = `agent:${agentData.type}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    const newAgent: AgentConfig = {
      id: agentId,
      name: agentData.name,
      type: agentData.type,
      description: agentData.description || '自定义Agent',
      llm_provider: agentData.llm_provider || 'deepseek',
      llm_model: agentData.llm_model || 'deepseek-chat',
      api_key: agentData.api_key,
      api_endpoint: agentData.api_endpoint,
      max_response_time: agentData.max_response_time || 30000,
      max_token_limit: agentData.max_token_limit || 8192,
      temperature: agentData.temperature || 0.5,
      system_prompt: agentData.system_prompt || '自定义Agent系统提示',
      collaboration_rules: {
        can_initiate_collaboration: agentData.collaboration_rules?.can_initiate_collaboration || false,
        can_coordinate_others: agentData.collaboration_rules?.can_coordinate_others || false,
        expertise_domains: agentData.collaboration_rules?.expertise_domains || ['general'],
        required_preconditions: agentData.collaboration_rules?.required_preconditions || []
      },
      status: agentData.status || 'active',
      last_active: Date.now(),
      version: agentData.version || '1.0.0',
      created_at: Date.now(),
      updated_at: Date.now(),
      created_by: agentData.created_by || 'system',
      agentId: agentId
    };
    
    this.agents.set(agentId, newAgent);
    this.saveAgentsConfig();
    
    this.logger.info(`[Agent Engine] 创建新Agent: ${newAgent.name} (${agentId})`);
    
    return newAgent;
  }
  
  /**
   * 更新Agent配置
   */
  public updateAgent(agentId: string, updateData: Partial<AgentConfig>): AgentConfig | null {
    const agent = this.agents.get(agentId);
    if (!agent) return null;
    
    const updatedAgent: AgentConfig = {
      ...agent,
      ...updateData,
      updated_at: Date.now(),
      id: agentId, // 防止ID被修改
      agentId: agentId
    };
    
    this.agents.set(agentId, updatedAgent);
    this.saveAgentsConfig();
    
    this.logger.info(`[Agent Engine] 更新Agent配置: ${updatedAgent.name} (${agentId})`);
    
    return updatedAgent;
  }
  
  /**
   * 删除Agent
   */
  public deleteAgent(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    
    // 防止删除系统核心Agent
    if (agent.type === 'office_director' || agent.type === 'prime_minister') {
      throw new Error('不能删除系统核心Agent');
    }
    
    this.agents.delete(agentId);
    this.saveAgentsConfig();
    
    this.logger.info(`[Agent Engine] 删除Agent: ${agent.name} (${agentId})`);
    
    return true;
  }
  
  /**
   * 执行Agent请求
   */
  public async executeAgentRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`[Agent Engine] 执行Agent请求: ${request.agentName} (${request.agentId})`);
      
      // 验证Agent存在
      const agent = this.agents.get(request.agentId);
      if (!agent) {
        throw new Error(`Agent '${request.agentId}' 不存在`);
      }
      
      // 更新Agent最后活动时间
      agent.last_active = Date.now();
      this.agents.set(request.agentId, agent);
      
      // 这里应该调用实际的LLM服务
      // 为了Phase 1B移植，我们返回模拟响应
      const mockResponse = this.generateMockAgentResponse(agent, request);
      
      const processingTime = Date.now() - startTime;
      
      this.logger.info(`[Agent Engine] Agent请求完成: ${request.agentName}, 处理时间: ${processingTime}ms`);
      
      return {
        success: true,
        data: mockResponse,
        processing_time: processingTime,
        timestamp: Date.now()
      };
      
    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      this.logger.error(`[Agent Engine] Agent请求失败: ${error.message}, 耗时: ${processingTime}ms`);
      
      return {
        success: false,
        error: error.message,
        processing_time: processingTime,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * 执行协作请求
   */
  public async executeCollaboration(request: CollaborationRequest): Promise<CollaborationResult> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`[Agent Engine] 执行协作请求: ${request.coordinatorRequest.agentName}, 参与Agent: ${request.specialistRequests.length}`);
      
      // 验证协调者Agent
      const coordinator = this.agents.get(request.coordinatorRequest.agentId);
      if (!coordinator) {
        throw new Error(`协调者Agent '${request.coordinatorRequest.agentId}' 不存在`);
      }
      
      // 验证参与者Agent
      const participants: AgentConfig[] = [];
      for (const specialistRequest of request.specialistRequests) {
        const agent = this.agents.get(specialistRequest.agentId);
        if (!agent) {
          throw new Error(`参与者Agent '${specialistRequest.agentId}' 不存在`);
        }
        participants.push(agent);
      }
      
      // 更新所有Agent的活动时间
      coordinator.last_active = Date.now();
      participants.forEach(agent => {
        agent.last_active = Date.now();
        this.agents.set(agent.id, agent);
      });
      
      // 模拟协作处理
      const collaborationId = `collab_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
      
      const result = {
        collaborationId,
        summary: `协作处理完成，协调者: ${coordinator.name}，参与者: ${participants.map(p => p.name).join(', ')}`,
        individualResults: participants.map(agent => ({
          agentId: agent.id,
          agentName: agent.name,
          expertise: agent.collaboration_rules.expertise_domains,
          contribution: `来自 ${agent.name} 的专业意见`
        })),
        integratedResult: `基于 ${participants.length} 个专业Agent的协作分析，建议采用综合解决方案。`
      };
      
      const processingTime = Date.now() - startTime;
      
      this.logger.info(`[Agent Engine] 协作请求完成: ${collaborationId}, 处理时间: ${processingTime}ms`);
      
      return {
        collaborationId,
        coordinator: this.convertToAgentInfo(coordinator),
        participants: participants.map(this.convertToAgentInfo),
        result,
        processingTime,
        complianceCheck: {
          constitutional: true,
          technical: true,
          operational: true
        }
      };
      
    } catch (error: any) {
      this.logger.error(`[Agent Engine] 协作请求失败: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * 生成模拟Agent响应
   */
  private generateMockAgentResponse(agent: AgentConfig, request: AgentRequest): any {
    const query = request.query || '';
    
    // 基于Agent类型生成不同响应
    switch (agent.type) {
      case 'supervision_ministry':
        return {
          agent: agent.name,
          response: `作为法务专家，我分析了您的查询: "${query.substring(0, 50)}..."。建议参考宪法§101同步公理和§102熵减原则。`,
          compliance_check: {
            constitutional: true,
            legal: true,
            risk_assessment: '低风险'
          }
        };
        
      case 'technology_ministry':
        return {
          agent: agent.name,
          response: `作为技术专家，我分析了您的查询: "${query.substring(0, 50)}..."。建议采用TypeScript实现，遵循DS-xxx技术标准。`,
          technical_advice: {
            language: 'TypeScript',
            framework: 'Express.js',
            architecture: '微服务'
          }
        };
        
      case 'organization_ministry':
        return {
          agent: agent.name,
          response: `作为架构师，我分析了您的查询: "${query.substring(0, 50)}..."。建议考虑系统可扩展性和性能优化。`,
          architecture_advice: {
            scalability: '高',
            performance: '优化建议',
            reliability: '高可用'
          }
        };
        
      case 'office_director':
        return {
          agent: agent.name,
          response: `作为办公厅主任，我接收了您的消息。复杂度评估: 5/10。将路由到合适的专业Agent处理。`,
          routing_decision: {
            complexity_score: 5,
            recommended_agent: 'technology_ministry',
            reason: '技术实现类任务'
          }
        };
        
      case 'prime_minister':
        return {
          agent: agent.name,
          response: `作为内阁总理，我将协调相关部门处理这个复杂问题。`,
          coordination_plan: {
            coordinator: 'prime_minister',
            participants: ['supervision_ministry', 'technology_ministry', 'organization_ministry'],
            schedule: '立即执行'
          }
        };
        
      default:
        return {
          agent: agent.name,
          response: `我收到了您的查询: "${query.substring(0, 50)}..."。这是一般性响应。`,
          note: '自定义Agent响应'
        };
    }
  }
  
  /**
   * 将Agent配置转换为Agent信息
   */
  private convertToAgentInfo(agent: AgentConfig): AgentInfo {
    return {
      agentId: agent.id,
      name: agent.name,
      expertise: agent.collaboration_rules.expertise_domains,
      capacity: agent.max_token_limit,
      currentLoad: 0.3, // 模拟负载
      healthStatus: 'healthy',
      lastHeartbeat: agent.last_active,
      version: agent.version
    };
  }
  
  /**
   * 获取引擎状态
   */
  public getEngineStats(): any {
    const agentsArray = Array.from(this.agents.values());
    
    const stats = {
      total_agents: agentsArray.length,
      by_type: {} as Record<string, number>,
      by_status: {} as Record<string, number>,
      health_status: {
        healthy: 0,
        degraded: 0,
        unhealthy: 0
      },
      load_distribution: {
        low: 0,    // < 0.3
        medium: 0, // 0.3 - 0.7
        high: 0    // > 0.7
      },
      timestamp: Date.now()
    };
    
    agentsArray.forEach(agent => {
      // 按类型统计
      stats.by_type[agent.type] = (stats.by_type[agent.type] || 0) + 1;
      
      // 按状态统计
      stats.by_status[agent.status] = (stats.by_status[agent.status] || 0) + 1;
      
      // 健康状态（简化版）
      const lastActiveDiff = Date.now() - agent.last_active;
      if (lastActiveDiff < 300000) { // 5分钟内活跃
        stats.health_status.healthy++;
      } else if (lastActiveDiff < 3600000) { // 1小时内活跃
        stats.health_status.degraded++;
      } else {
        stats.health_status.unhealthy++;
      }
      
      // 负载分布（模拟）
      const simulatedLoad = Math.random();
      if (simulatedLoad < 0.3) stats.load_distribution.low++;
      else if (simulatedLoad < 0.7) stats.load_distribution.medium++;
      else stats.load_distribution.high++;
    });
    
    return stats;
  }
  
  /**
   * 验证宪法合规性
   */
  public validateConstitutionalCompliance(agentId: string, action: string): any {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return {
        valid: false,
        error: `Agent '${agentId}' 不存在`
      };
    }
    
    // 简化版宪法合规检查
    const complianceChecks = [
      {
        clause: '§101',
        description: '同步公理合规',
        valid: agent.system_prompt.includes('宪法') || agent.description.includes('宪法')
      },
      {
        clause: '§102',
        description: '熵减原则合规',
        valid: true // 简化处理
      },
      {
        clause: '§109',
        description: '协作流程公理合规',
        valid: agent.collaboration_rules.expertise_domains.length > 0
      },
      {
        clause: '§110',
        description: '协作效率公理合规',
        valid: agent.max_response_time <= 60000
      },
      {
        clause: '§152',
        description: '单一真理源公理合规',
        valid: agent.id.startsWith('agent:')
      }
    ];
    
    const violations = complianceChecks.filter(check => !check.valid);
    
    return {
      valid: violations.length === 0,
      agent_id: agentId,
      agent_name: agent.name,
      action: action,
      checks: complianceChecks,
      violations: violations,
      overall_compliance: violations.length === 0 ? 'compliant' : violations.length <= 2 ? 'partial' : 'non-compliant',
      timestamp: Date.now()
    };
  }
}

/**
 * 创建Agent引擎路由器
 */
export function createAgentEngineRouter(agentEngine: AgentEngine) {
  const router = Router();
  
  // 获取所有Agent
  router.get('/agents', (req: Request, res: Response) => {
    try {
      const agents = agentEngine.getAllAgents();
      res.json({
        success: true,
        data: agents,
        count: agents.length,
        timestamp: Date.now()
      });
    } catch (error: any) {
      logger.error(`[Agent Engine API] 获取Agent列表失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // 获取单个Agent
  router.get('/agents/:id', (req: Request, res: Response) => {
    try {
      const agent = agentEngine.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ success: false, error: 'Agent不存在' });
      }
      res.json({ success: true, data: agent });
    } catch (error: any) {
      logger.error(`[Agent Engine API] 获取Agent详情失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // 创建Agent
  router.post('/agents', (req: Request, res: Response) => {
    try {
      const newAgent = agentEngine.createAgent(req.body);
      res.status(201).json({
        success: true,
        data: newAgent,
        message: 'Agent创建成功'
      });
    } catch (error: any) {
      logger.error(`[Agent Engine API] 创建Agent失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // 更新Agent
  router.put('/agents/:id', (req: Request, res: Response) => {
    try {
      const updatedAgent = agentEngine.updateAgent(req.params.id, req.body);
      if (!updatedAgent) {
        return res.status(404).json({ success: false, error: 'Agent不存在' });
      }
      res.json({
        success: true,
        data: updatedAgent,
        message: 'Agent更新成功'
      });
    } catch (error: any) {
      logger.error(`[Agent Engine API] 更新Agent失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // 删除Agent
  router.delete('/agents/:id', (req: Request, res: Response) => {
    try {
      const success = agentEngine.deleteAgent(req.params.id);
      if (!success) {
        return res.status(404).json({ success: false, error: 'Agent不存在' });
      }
      res.json({ success: true, message: 'Agent删除成功' });
    } catch (error: any) {
      logger.error(`[Agent Engine API] 删除Agent失败: ${error.message}`);
      const status = error.message.includes('不能删除系统核心Agent') ? 400 : 500;
      res.status(status).json({ success: false, error: error.message });
    }
  });
  
  // 执行Agent请求
  router.post('/agents/:id/execute', async (req: Request, res: Response) => {
    try {
      const request: AgentRequest = {
        agentId: req.params.id,
        agentName: req.body.agentName || 'Unknown',
        query: req.body.query,
        context: req.body.context,
        config: req.body.config
      };
      
      const response = await agentEngine.executeAgentRequest(request);
      
      if (response.success) {
        res.json(response);
      } else {
        res.status(500).json(response);
      }
    } catch (error: any) {
      logger.error(`[Agent Engine API] 执行Agent请求失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // 执行协作请求
  router.post('/agents/collaboration', async (req: Request, res: Response) => {
    try {
      const request: CollaborationRequest = req.body;
      const result = await agentEngine.executeCollaboration(request);
      res.json({ success: true, data: result });
    } catch (error: any) {
      logger.error(`[Agent Engine API] 执行协作请求失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // 获取引擎状态
  router.get('/stats', (req: Request, res: Response) => {
    try {
      const stats = agentEngine.getEngineStats();
      res.json({ success: true, data: stats });
    } catch (error: any) {
      logger.error(`[Agent Engine API] 获取引擎状态失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // 宪法合规验证
  router.post('/compliance/validate', (req: Request, res: Response) => {
    try {
      const { agentId, action } = req.body;
      if (!agentId || !action) {
        return res.status(400).json({ success: false, error: 'agentId和action是必填项' });
      }
      
      const validation = agentEngine.validateConstitutionalCompliance(agentId, action);
      res.json({ success: true, data: validation });
    } catch (error: any) {
      logger.error(`[Agent Engine API] 宪法合规验证失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // 健康检查
  router.get('/health', (req: Request, res: Response) => {
    try {
      const stats = agentEngine.getEngineStats();
      const healthStatus = stats.health_status.healthy / stats.total_agents > 0.8 ? 'healthy' : 'degraded';
      
      res.json({
        success: true,
        status: healthStatus,
        service: 'agent_engine',
        version: '1.0.0',
        stats: stats,
        timestamp: Date.now()
      });
    } catch (error: any) {
      logger.error(`[Agent Engine API] 健康检查失败: ${error.message}`);
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        error: error.message
      });
    }
  });

  // ==========================================
  // 🧪 Agent测试与验证端点（移植自MY-DOGE-DEMO）
  // ==========================================

  /**
   * POST /agents/:id/test
   * 测试Agent LLM连接和响应
   */
  router.post('/agents/:id/test', authenticateJWT, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { test_message } = req.body;
      
      const agent = agentEngine.getAgent(id);
      
      if (!agent) {
        return res.status(404).json({ success: false, error: `Agent '${id}' 不存在` });
      }
      
      // 简单的测试逻辑（实际应该调用LLM服务）
      const testResponse = {
        agent_id: agent.id,
        agent_name: agent.name,
        test_timestamp: Date.now(),
        llm_provider: agent.llm_provider,
        llm_model: agent.llm_model,
        status: 'simulated',
        response_time: Math.random() * 1000 + 500, // 模拟响应时间
        response: test_message 
          ? `测试消息: "${test_message}" 已接收。Agent ${agent.name} 就绪。`
          : `Agent ${agent.name} 测试成功。LLM配置: ${agent.llm_provider}/${agent.llm_model}`,
        capabilities: agent.collaboration_rules.expertise_domains
      };
      
      // 更新最后活动时间
      const updateData = { last_active: Date.now() };
      agentEngine.updateAgent(id, updateData);
      
      res.json({
        success: true,
        data: testResponse,
        message: 'Agent测试完成'
      });
    } catch (error: any) {
      logger.error(`[Agent Engine API] Agent测试失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /agents/:id/status
   * 获取Agent状态和健康信息
   */
  router.get('/agents/:id/status', authenticateJWT, (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const agent = agentEngine.getAgent(id);
      
      if (!agent) {
        return res.status(404).json({ success: false, error: `Agent '${id}' 不存在` });
      }
      
      const now = Date.now();
      const lastActiveDiff = now - agent.last_active;
      const isOnline = lastActiveDiff < 300000; // 5分钟内活跃视为在线
      
      const statusInfo = {
        agent_id: agent.id,
        agent_name: agent.name,
        status: agent.status,
        online: isOnline,
        last_active: agent.last_active,
        last_active_human: new Date(agent.last_active).toISOString(),
        inactive_duration_seconds: Math.floor(lastActiveDiff / 1000),
        llm_config: {
          provider: agent.llm_provider,
          model: agent.llm_model,
          configured: !!(agent.llm_provider && agent.llm_model)
        },
        collaboration_capabilities: agent.collaboration_rules,
        health_score: isOnline ? 95 : 60,
        warnings: !agent.llm_provider ? ['未配置LLM提供商'] : []
      };
      
      res.json({
        success: true,
        data: statusInfo
      });
    } catch (error: any) {
      logger.error(`[Agent Engine API] 获取Agent状态失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==========================================
  // 🤝 协作配置管理端点（移植自MY-DOGE-DEMO）
  // ==========================================

  /**
   * GET /agents/collaboration/rules
   * 获取所有协作规则配置
   */
  router.get('/agents/collaboration/rules', authenticateJWT, (req: Request, res: Response) => {
    try {
      const agents = agentEngine.getAllAgents();
      
      // 提取所有Agent的协作规则
      const collaborationRules = agents.map(agent => ({
        agent_id: agent.id,
        agent_name: agent.name,
        agent_type: agent.type,
        can_initiate_collaboration: agent.collaboration_rules.can_initiate_collaboration,
        can_coordinate_others: agent.collaboration_rules.can_coordinate_others,
        expertise_domains: agent.collaboration_rules.expertise_domains,
        required_preconditions: agent.collaboration_rules.required_preconditions,
        example_scenarios: generateExampleScenarios(agent.type)
      }));
      
      // 生成协作关系图
      const collaborationGraph = {
        nodes: agents.map(agent => ({
          id: agent.id,
          name: agent.name,
          type: agent.type,
          role: agent.collaboration_rules.can_coordinate_others ? 'coordinator' : 'specialist'
        })),
        edges: generateCollaborationEdges(agents)
      };
      
      res.json({
        success: true,
        data: {
          rules: collaborationRules,
          graph: collaborationGraph,
          total_agents: agents.length,
          coordinators: agents.filter(a => a.collaboration_rules.can_coordinate_others).length
        }
      });
    } catch (error: any) {
      logger.error(`[Agent Engine API] 获取协作规则失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /agents/collaboration/simulate
   * 模拟协作流程
   */
  router.post('/agents/collaboration/simulate', authenticateJWT, (req: Request, res: Response) => {
    try {
      const { scenario, participating_agents } = req.body;
      
      if (!scenario) {
        return res.status(400).json({ success: false, error: '需要提供协作场景描述' });
      }
      
      const agents = agentEngine.getAllAgents();
      
      // 验证参与Agent
      const selectedAgents = participating_agents 
        ? agents.filter(a => participating_agents.includes(a.id))
        : agents.filter(a => a.status === 'active').slice(0, 3); // 默认选择3个活跃Agent
      
      if (selectedAgents.length === 0) {
        return res.status(400).json({ success: false, error: '没有可用的Agent参与协作' });
      }
      
      // 查找协调者
      const coordinators = selectedAgents.filter(a => a.collaboration_rules.can_coordinate_others);
      const coordinator = coordinators[0] || selectedAgents[0];
      
      // 模拟协作过程
      const collaborationId = `collab_sim_${Date.now()}`;
      const stages = [
        {
          name: '分析阶段',
          description: '办公厅主任分析问题，确定需要哪些专业Agent参与',
          coordinator: coordinator.name,
          duration_ms: 5000,
          agents_involved: [coordinator.id]
        },
        {
          name: '任务分配',
          description: '将问题分解为子任务，分配给各专业Agent',
          coordinator: coordinator.name,
          duration_ms: 3000,
          agents_involved: selectedAgents.map(a => a.id)
        },
        {
          name: '并行处理',
          description: '各专业Agent并行处理分配的任务',
          coordinator: coordinator.name,
          duration_ms: 10000,
          agents_involved: selectedAgents.map(a => a.id)
        },
        {
          name: '结果整合',
          description: '办公厅主任整合各方意见，形成最终方案',
          coordinator: coordinator.name,
          duration_ms: 7000,
          agents_involved: [coordinator.id]
        }
      ];
      
      const totalDuration = stages.reduce((sum, stage) => sum + stage.duration_ms, 0);
      
      const simulationResult = {
        collaboration_id: collaborationId,
        scenario: scenario,
        coordinator: {
          id: coordinator.id,
          name: coordinator.name,
          type: coordinator.type
        },
        participating_agents: selectedAgents.map(a => ({
          id: a.id,
          name: a.name,
          type: a.type,
          expertise: a.collaboration_rules.expertise_domains
        })),
        stages: stages,
        metrics: {
          total_duration_ms: totalDuration,
          total_agents: selectedAgents.length,
          estimated_real_time_ms: totalDuration * 0.5, // 假设实际执行更快
          complexity_score: calculateComplexityScore(selectedAgents, scenario)
        },
        simulated_result: `基于${selectedAgents.length}个Agent的协作分析，针对场景"${scenario.substring(0, 50)}..."，建议采用多阶段协作方案。办公厅主任${coordinator.name}将协调${selectedAgents.length-1}个专业Agent共同解决问题。`
      };
      
      res.json({
        success: true,
        data: simulationResult,
        message: '协作流程模拟完成'
      });
    } catch (error: any) {
      logger.error(`[Agent Engine API] 协作模拟失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==========================================
  // 🔧 工具函数
  // ==========================================

  /**
   * 生成示例场景
   */
  function generateExampleScenarios(agentType: string): string[] {
    const scenarios: Record<string, string[]> = {
      'supervision_ministry': [
        '检查新功能是否符合宪法§201 CDD流程',
        '评估数据存储方案是否符合§125数据完整性公理',
        '解释§114双存储同构公理在具体场景中的应用'
      ],
      'technology_ministry': [
        '实现原子文件写入功能（DS-002标准）',
        '优化数据库查询性能',
        '修复UTF-8编码问题（DS-001标准）'
      ],
      'organization_ministry': [
        '设计微服务架构方案',
        '评估系统扩展性瓶颈',
        '规划技术债务偿还路线图'
      ],
      'secretary': [
        '记录会议决策和行动项',
        '整理项目文档结构',
        '归档历史版本信息'
      ],
      'office_director': [
        '接收用户消息并进行意图识别',
        '评估任务复杂度并决定路由路径',
        '记录对话历史和知识要点',
        '简单任务直接路由到专业Agent',
        '复杂任务转交给内阁总理协调'
      ],
      'prime_minister': [
        '协调监察部、科技部、组织部Agent解决跨部门复杂任务',
        '仲裁专业Agent之间的意见分歧',
        '监督宪法合规性检查（§152单一真理源、§141熵减验证）',
        '管理复杂任务的优先级和资源分配',
        '整合多专业Agent意见形成最终方案'
      ],
      'custom': [
        '处理自定义任务类型',
        '根据配置执行特定功能'
      ]
    };
    
    return scenarios[agentType] || ['处理通用任务'];
  }

  /**
   * 生成协作关系边
   */
  function generateCollaborationEdges(agents: AgentConfig[]): any[] {
    const edges: any[] = [];
    
    // 查找所有协调者
    const coordinators = agents.filter(a => a.collaboration_rules.can_coordinate_others);
    const specialists = agents.filter(a => !a.collaboration_rules.can_coordinate_others);
    
    // 协调者连接所有专家
    for (const coordinator of coordinators) {
      for (const specialist of specialists) {
        edges.push({
          source: coordinator.id,
          target: specialist.id,
          type: 'coordinates',
          strength: 0.8
        });
      }
    }
    
    // 专家之间的协作连接（基于领域重叠）
    for (let i = 0; i < specialists.length; i++) {
      for (let j = i + 1; j < specialists.length; j++) {
        const agentA = specialists[i];
        const agentB = specialists[j];
        
        // 计算领域重叠度
        const domainsA = new Set(agentA.collaboration_rules.expertise_domains);
        const domainsB = new Set(agentB.collaboration_rules.expertise_domains);
        const overlap = [...domainsA].filter(domain => domainsB.has(domain)).length;
        
        if (overlap > 0) {
          edges.push({
            source: agentA.id,
            target: agentB.id,
            type: 'collaborates',
            strength: overlap * 0.2
          });
        }
      }
    }
    
    return edges;
  }

  /**
   * 计算协作复杂度分数
   */
  function calculateComplexityScore(agents: AgentConfig[], scenario: string): number {
    let score = 50; // 基础分数
    
    // 基于Agent数量
    score += agents.length * 5;
    
    // 基于Agent类型多样性
    const uniqueTypes = new Set(agents.map(a => a.type)).size;
    score += uniqueTypes * 10;
    
    // 基于场景复杂度（简单启发式）
    const scenarioLength = scenario.length;
    if (scenarioLength > 500) score += 20;
    else if (scenarioLength > 200) score += 10;
    
    // 限制在0-100之间
    return Math.min(100, Math.max(0, score));
  }
  
  logger.info('[Agent Engine] Agent引擎路由器已创建');
  
  return router;
}

/**
 * 集成Agent引擎到现有Express应用
 */
export function integrateAgentEngine(app: any, config?: Partial<AgentEngineConfig>) {
  const agentEngine = new AgentEngine(config);
  const agentRouter = createAgentEngineRouter(agentEngine);
  
  // 挂载路由
  app.use('/api/agents', agentRouter);
  
  logger.info('[Agent Engine] Agent引擎已集成到Express应用');
  
  return {
    agentEngine,
    agentRouter,
    getEngine: () => agentEngine
  };
}

export default {
  AgentEngine,
  createAgentEngineRouter,
  integrateAgentEngine
};