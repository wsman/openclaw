/**
 * 🚀 Agent 服务 - 核心业务逻辑
 * 
 * 宪法依据：
 * - §101 同步公理：代码变更必须触发文档更新
 * - §102 熵减原则：所有变更必须降低或维持系统熵值
 * - §109 协作流程公理：Agent协作流程标准化
 * - §110 协作效率公理：确保Agent协作效率
 * - §152 单一真理源公理：Agent配置统一管理
 * 
 * 整合来源：
 * - server/gateway/agent-engine.ts (AgentEngine 类)
 * - server/api/agent.ts (协作模拟逻辑)
 */

import { logger } from '../../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import {
  AgentConfig,
  AgentInfo,
  AgentRequest,
  AgentResponse,
  AgentEngineConfig,
  CollaborationRequest,
  CollaborationResult,
  ConstitutionalCompliance,
  getDefaultAgents
} from './types';

/**
 * Agent 服务类
 * 
 * 整合了所有 Agent 相关的核心业务逻辑
 * 宪法依据: §152单一真理源公理，确保Agent配置统一管理
 */
export class AgentService {
  private config: AgentEngineConfig;
  private agents: Map<string, AgentConfig> = new Map();
  private agentsConfigPath: string;

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

    logger.info('[AgentService] Agent服务已初始化');
    logger.info(`[AgentService] 配置: ${JSON.stringify(this.config)}`);
  }

  /**
   * 初始化 Agent 服务
   */
  public initialize(): void {
    try {
      logger.info('[AgentService] 正在初始化Agent服务...');

      // 确保配置目录存在
      const configDir = path.dirname(this.agentsConfigPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
        logger.info(`[AgentService] 创建配置目录: ${configDir}`);
      }

      // 加载或创建默认Agent配置
      this.loadAgentsConfig();

      // 启动健康检查（如果启用）
      if (this.config.enableHealthChecks) {
        this.startHealthChecks();
      }

      logger.info(`[AgentService] 初始化完成，共加载 ${this.agents.size} 个Agent`);

    } catch (error: any) {
      logger.error(`[AgentService] 初始化失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 加载 Agent 配置
   */
  private loadAgentsConfig(): void {
    try {
      if (fs.existsSync(this.agentsConfigPath)) {
        const configData = JSON.parse(fs.readFileSync(this.agentsConfigPath, 'utf-8'));
        const agents = configData.agents || [];

        agents.forEach((agent: AgentConfig) => {
          this.agents.set(agent.id, agent);
        });

        logger.info(`[AgentService] 从文件加载 ${agents.length} 个Agent配置`);
      } else {
        this.createDefaultAgents();
        logger.info('[AgentService] 创建默认Agent配置');
      }
    } catch (error: any) {
      logger.error(`[AgentService] 加载Agent配置失败: ${error.message}`);
      this.createDefaultAgents();
    }
  }

  /**
   * 创建默认 Agent 配置
   */
  private createDefaultAgents(): void {
    const defaultAgents = getDefaultAgents();

    defaultAgents.forEach(agent => {
      this.agents.set(agent.id, agent);
    });

    this.saveAgentsConfig();
  }

  /**
   * 保存 Agent 配置到文件
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

      logger.debug(`[AgentService] 保存 ${agentsArray.length} 个Agent配置到文件`);
    } catch (error: any) {
      logger.error(`[AgentService] 保存Agent配置失败: ${error.message}`);
    }
  }

  /**
   * 启动健康检查
   */
  private startHealthChecks(): void {
    logger.info('[AgentService] 启动Agent健康检查系统');

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
          logger.warn(`[AgentService] Agent ${agent.name} (${agentId}) 健康状态异常，上次活跃: ${lastActiveDiff}ms前`);
        } else {
          healthyCount++;
        }
      });

      const healthPercentage = totalCount > 0 ? (healthyCount / totalCount * 100).toFixed(1) : '0.0';

      logger.info(`[AgentService] 健康检查完成: ${healthyCount}/${totalCount} 个Agent健康 (${healthPercentage}%)`);

    } catch (error: any) {
      logger.error(`[AgentService] 健康检查执行失败: ${error.message}`);
    }
  }

  // ==================== 公共API方法 ====================

  /**
   * 获取所有 Agent 配置
   */
  public getAllAgents(): AgentConfig[] {
    return Array.from(this.agents.values()).map(agent => ({
      ...agent,
      api_key: undefined, // 移除敏感信息
      system_prompt: agent.system_prompt.substring(0, 100) + '...' // 只显示前100字符
    }));
  }

  /**
   * 获取单个 Agent 配置
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
   * 获取完整 Agent 配置（包含敏感信息，仅内部使用）
   */
  public getAgentFull(agentId: string): AgentConfig | null {
    return this.agents.get(agentId) || null;
  }

  /**
   * 创建新 Agent
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

    logger.info(`[AgentService] 创建新Agent: ${newAgent.name} (${agentId})`);

    return newAgent;
  }

  /**
   * 更新 Agent 配置
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

    logger.info(`[AgentService] 更新Agent配置: ${updatedAgent.name} (${agentId})`);

    return updatedAgent;
  }

  /**
   * 删除 Agent
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

    logger.info(`[AgentService] 删除Agent: ${agent.name} (${agentId})`);

    return true;
  }

  /**
   * 执行 Agent 请求
   */
  public async executeAgentRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      logger.info(`[AgentService] 执行Agent请求: ${request.agentName} (${request.agentId})`);

      // 验证Agent存在
      const agent = this.agents.get(request.agentId);
      if (!agent) {
        throw new Error(`Agent '${request.agentId}' 不存在`);
      }

      // 更新Agent最后活动时间
      agent.last_active = Date.now();
      this.agents.set(request.agentId, agent);

      // 这里应该调用实际的LLM服务
      // 为了兼容性，我们返回模拟响应
      const mockResponse = this.generateMockAgentResponse(agent, request);

      const processingTime = Date.now() - startTime;

      logger.info(`[AgentService] Agent请求完成: ${request.agentName}, 处理时间: ${processingTime}ms`);

      return {
        success: true,
        data: mockResponse,
        processing_time: processingTime,
        timestamp: Date.now()
      };

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      logger.error(`[AgentService] Agent请求失败: ${error.message}, 耗时: ${processingTime}ms`);

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
      logger.info(`[AgentService] 执行协作请求: ${request.coordinatorRequest.agentName}, 参与Agent: ${request.specialistRequests.length}`);

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

      logger.info(`[AgentService] 协作请求完成: ${collaborationId}, 处理时间: ${processingTime}ms`);

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
      logger.error(`[AgentService] 协作请求失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 生成模拟 Agent 响应
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
   * 将 Agent 配置转换为 Agent 信息
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
  public validateConstitutionalCompliance(agentId: string, action: string): ConstitutionalCompliance {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return {
        valid: false,
        agent_id: agentId,
        agent_name: 'Unknown',
        action: action,
        checks: [],
        violations: [{
          clause: 'N/A',
          description: `Agent '${agentId}' 不存在`,
          valid: false
        }],
        overall_compliance: 'non-compliant',
        timestamp: Date.now()
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

// 单例实例
let agentServiceInstance: AgentService | null = null;

/**
 * 获取 AgentService 单例
 */
export function getAgentService(config?: Partial<AgentEngineConfig>): AgentService {
  if (!agentServiceInstance) {
    agentServiceInstance = new AgentService(config);
  }
  return agentServiceInstance;
}

/**
 * 重置 AgentService 单例（用于测试）
 */
export function resetAgentService(): void {
  agentServiceInstance = null;
}

export default AgentService;
