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
 * 整合说明：
 * 此文件现在作为适配层，核心逻辑已迁移到 server/modules/agent/
 * 保持原有接口兼容，委托给 AgentService 处理
 * 
 * @version 2.0.0 (重构版)
 * @category Gateway/Agent
 */

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { authenticateJWT, AuthUser } from '../middleware/auth';

// 从统一模块导入类型和服务
import { 
  AgentConfig, 
  AgentInfo, 
  AgentRequest, 
  AgentResponse,
  AgentEngineConfig,
  CollaborationRequest,
  CollaborationResult,
  AgentService,
  getAgentService
} from '../modules/agent';

// 向后兼容的类型重导出
export type { 
  AgentConfig, 
  AgentInfo, 
  AgentRequest, 
  AgentResponse, 
  AgentEngineConfig, 
  CollaborationRequest, 
  CollaborationResult 
};

/**
 * Agent引擎核心类
 * 
 * 这是一个适配器类，委托给 AgentService 处理实际逻辑
 * 保持向后兼容性
 * 
 * 宪法依据: §152单一真理源公理，确保Agent配置统一管理
 */
export class AgentEngine {
  private service: AgentService;
  private logger = logger;

  constructor(config: Partial<AgentEngineConfig> = {}) {
    this.service = getAgentService(config);
    this.logger.info('[AgentEngine] Agent引擎已初始化（适配器模式）');
  }

  // ==================== 委托方法 ====================

  public getAllAgents(): AgentConfig[] {
    return this.service.getAllAgents();
  }

  public getAgent(agentId: string): AgentConfig | null {
    return this.service.getAgent(agentId);
  }

  public createAgent(agentData: Partial<AgentConfig>): AgentConfig {
    return this.service.createAgent(agentData);
  }

  public updateAgent(agentId: string, updateData: Partial<AgentConfig>): AgentConfig | null {
    return this.service.updateAgent(agentId, updateData);
  }

  public deleteAgent(agentId: string): boolean {
    return this.service.deleteAgent(agentId);
  }

  public async executeAgentRequest(request: AgentRequest): Promise<AgentResponse> {
    return this.service.executeAgentRequest(request);
  }

  public async executeCollaboration(request: CollaborationRequest): Promise<CollaborationResult> {
    return this.service.executeCollaboration(request);
  }

  public getEngineStats(): any {
    return this.service.getEngineStats();
  }

  public validateConstitutionalCompliance(agentId: string, action: string): any {
    return this.service.validateConstitutionalCompliance(agentId, action);
  }
}

/**
 * 创建Agent引擎路由器
 */
export function createAgentEngineRouter(agentEngine: AgentEngine): Router {
  const router: Router = Router();

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
      logger.error(`[AgentEngine API] 获取Agent列表失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 获取单个Agent
  router.get('/agents/:id', (req: Request, res: Response) => {
    try {
      const agent = agentEngine.getAgent(String(req.params.id));
      if (!agent) {
        return res.status(404).json({ success: false, error: 'Agent不存在' });
      }
      res.json({ success: true, data: agent });
    } catch (error: any) {
      logger.error(`[AgentEngine API] 获取Agent详情失败: ${error.message}`);
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
      logger.error(`[AgentEngine API] 创建Agent失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 更新Agent
  router.put('/agents/:id', (req: Request, res: Response) => {
    try {
      const updatedAgent = agentEngine.updateAgent(String(req.params.id), req.body);
      if (!updatedAgent) {
        return res.status(404).json({ success: false, error: 'Agent不存在' });
      }
      res.json({
        success: true,
        data: updatedAgent,
        message: 'Agent更新成功'
      });
    } catch (error: any) {
      logger.error(`[AgentEngine API] 更新Agent失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 删除Agent
  router.delete('/agents/:id', (req: Request, res: Response) => {
    try {
      const success = agentEngine.deleteAgent(String(req.params.id));
      if (!success) {
        return res.status(404).json({ success: false, error: 'Agent不存在' });
      }
      res.json({ success: true, message: 'Agent删除成功' });
    } catch (error: any) {
      logger.error(`[AgentEngine API] 删除Agent失败: ${error.message}`);
      const status = error.message.includes('不能删除系统核心Agent') ? 400 : 500;
      res.status(status).json({ success: false, error: error.message });
    }
  });

  // 执行Agent请求
  router.post('/agents/:id/execute', async (req: Request, res: Response) => {
    try {
      const request: AgentRequest = {
        agentId: String(req.params.id),
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
      logger.error(`[AgentEngine API] 执行Agent请求失败: ${error.message}`);
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
      logger.error(`[AgentEngine API] 执行协作请求失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 获取引擎状态
  router.get('/stats', (req: Request, res: Response) => {
    try {
      const stats = agentEngine.getEngineStats();
      res.json({ success: true, data: stats });
    } catch (error: any) {
      logger.error(`[AgentEngine API] 获取引擎状态失败: ${error.message}`);
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
      logger.error(`[AgentEngine API] 宪法合规验证失败: ${error.message}`);
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
        version: '2.0.0',
        stats: stats,
        timestamp: Date.now()
      });
    } catch (error: any) {
      logger.error(`[AgentEngine API] 健康检查失败: ${error.message}`);
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        error: error.message
      });
    }
  });

  // Agent测试端点
  router.post('/agents/:id/test', authenticateJWT, async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const { test_message } = req.body;

      const agent = agentEngine.getAgent(id);

      if (!agent) {
        return res.status(404).json({ success: false, error: `Agent '${id}' 不存在` });
      }

      const testResponse = {
        agent_id: agent.id,
        agent_name: agent.name,
        test_timestamp: Date.now(),
        llm_provider: agent.llm_provider,
        llm_model: agent.llm_model,
        status: 'simulated',
        response_time: Math.random() * 1000 + 500,
        response: test_message
          ? `测试消息: "${test_message}" 已接收。Agent ${agent.name} 就绪。`
          : `Agent ${agent.name} 测试成功。LLM配置: ${agent.llm_provider}/${agent.llm_model}`,
        capabilities: agent.collaboration_rules.expertise_domains
      };

      agentEngine.updateAgent(String(req.params.id), { last_active: Date.now() });

      res.json({
        success: true,
        data: testResponse,
        message: 'Agent测试完成'
      });
    } catch (error: any) {
      logger.error(`[AgentEngine API] Agent测试失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Agent状态端点
  router.get('/agents/:id/status', authenticateJWT, (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const agent = agentEngine.getAgent(id);

      if (!agent) {
        return res.status(404).json({ success: false, error: `Agent '${id}' 不存在` });
      }

      const now = Date.now();
      const lastActiveDiff = now - agent.last_active;
      const isOnline = lastActiveDiff < 300000;

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
      logger.error(`[AgentEngine API] 获取Agent状态失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 协作规则端点
  router.get('/agents/collaboration/rules', authenticateJWT, (req: Request, res: Response) => {
    try {
      const agents = agentEngine.getAllAgents();

      const collaborationRules = agents.map(agent => ({
        agent_id: agent.id,
        agent_name: agent.name,
        agent_type: agent.type,
        can_initiate_collaboration: agent.collaboration_rules.can_initiate_collaboration,
        can_coordinate_others: agent.collaboration_rules.can_coordinate_others,
        expertise_domains: agent.collaboration_rules.expertise_domains,
        required_preconditions: agent.collaboration_rules.required_preconditions
      }));

      res.json({
        success: true,
        data: {
          rules: collaborationRules,
          total_agents: agents.length,
          coordinators: agents.filter(a => a.collaboration_rules.can_coordinate_others).length
        }
      });
    } catch (error: any) {
      logger.error(`[AgentEngine API] 获取协作规则失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  logger.info('[AgentEngine] Agent引擎路由器已创建');

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

  logger.info('[AgentEngine] Agent引擎已集成到Express应用');

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
