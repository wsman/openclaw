/**
 * 🚀 Agent API 路由 - 薄路由层
 * 
 * 宪法依据：
 * - §152 单一真理源公理：Agent配置统一由 AgentService 管理
 * - §102 熵减原则：消除冗余的配置读写逻辑
 * 
 * 整合说明：
 * - 所有业务逻辑已迁移到 server/modules/agent/AgentService.ts
 * - 此文件仅作为 Express 路由层，负责请求解析和响应格式化
 * - 类型定义来自 server/modules/agent/types.ts
 */

import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { authenticateJWT, AuthUser } from '../middleware/auth';
import { getAgentService } from '../modules/agent/AgentService';
import { AgentConfig, AgentRequest, CollaborationRequest } from '../modules/agent/types';

// ==========================================
// 重新导出类型（向后兼容）
// ==========================================
export { AgentConfig, AgentRequest, CollaborationRequest } from '../modules/agent/types';

/**
 * 创建Agent管理路由
 * 
 * 所有操作委托给 AgentService 单例
 */
export function createAgentRouter(): Router {
  const router = Router();
  const agentService = getAgentService();

  // ==========================================
  // 🔧 Agent配置管理
  // ==========================================

  /**
   * GET /agents
   * 获取所有Agent配置（过滤敏感信息）
   */
  router.get('/', authenticateJWT, (req: Request, res: Response) => {
    try {
      const agents = agentService.getAllAgents();
      
      res.json({
        success: true,
        data: agents,
        count: agents.length,
        timestamp: Date.now()
      });
    } catch (error: any) {
      logger.error(`[AgentAPI] 获取Agent列表失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /agents/:id
   * 获取单个Agent配置详情
   */
  router.get('/:id', authenticateJWT, (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const agent = agentService.getAgent(id);

      if (!agent) {
        return res.status(404).json({ success: false, error: `Agent '${id}' 不存在` });
      }

      // 权限检查：只有管理员和Agent所有者可以查看完整配置
      const user = req.user as AuthUser | undefined;
      const userRole = user?.role;
      const isAdmin = userRole === 'admin';
      const isOwner = user?.sub === agent.created_by;

      let responseAgent: any = { ...agent };
      if (!isAdmin && !isOwner) {
        // 非管理员和非所有者只能看到部分信息
        responseAgent = {
          id: agent.id,
          name: agent.name,
          type: agent.type,
          description: agent.description,
          llm_provider: agent.llm_provider,
          llm_model: agent.llm_model,
          status: agent.status,
          version: agent.version,
          created_at: agent.created_at,
          updated_at: agent.updated_at
        };
        responseAgent._permission = 'limited';
      }

      res.json({
        success: true,
        data: responseAgent,
        permission: isAdmin || isOwner ? 'full' : 'limited'
      });
    } catch (error: any) {
      logger.error(`[AgentAPI] 获取Agent详情失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /agents
   * 创建新Agent配置
   */
  router.post('/', authenticateJWT, (req: Request, res: Response) => {
    try {
      const user = req.user as AuthUser | undefined;
      const userRole = user?.role;
      if (userRole !== 'admin') {
        return res.status(403).json({ success: false, error: '只有管理员可以创建Agent' });
      }

      const agentData = req.body;

      // 验证必要字段
      const requiredFields = ['name', 'type', 'description', 'llm_provider', 'llm_model'];
      for (const field of requiredFields) {
        if (!agentData[field]) {
          return res.status(400).json({ success: false, error: `缺少必要字段: ${field}` });
        }
      }

      // 委托 AgentService 创建
      const newAgent = agentService.createAgent({
        ...agentData,
        created_by: user?.sub || 'unknown'
      });

      logger.info(`[AgentAPI] 创建新Agent: ${newAgent.name} (${newAgent.id})`);

      res.status(201).json({
        success: true,
        data: newAgent,
        message: 'Agent创建成功'
      });
    } catch (error: any) {
      logger.error(`[AgentAPI] 创建Agent失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * PUT /agents/:id
   * 更新Agent配置
   */
  router.put('/:id', authenticateJWT, (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const updateData = req.body;

      // 权限检查
      const existingAgent = agentService.getAgentFull(id);
      if (!existingAgent) {
        return res.status(404).json({ success: false, error: `Agent '${id}' 不存在` });
      }

      const user = req.user as AuthUser | undefined;
      const userRole = user?.role;
      const isAdmin = userRole === 'admin';
      const isOwner = user?.sub === existingAgent.created_by;

      if (!isAdmin && !isOwner) {
        return res.status(403).json({ success: false, error: '没有权限修改此Agent' });
      }

      // 委托 AgentService 更新
      const updatedAgent = agentService.updateAgent(id, updateData);

      logger.info(`[AgentAPI] 更新Agent配置: ${updatedAgent?.name} (${id})`);

      res.json({
        success: true,
        data: updatedAgent,
        message: 'Agent更新成功'
      });
    } catch (error: any) {
      logger.error(`[AgentAPI] 更新Agent失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * DELETE /agents/:id
   * 删除Agent配置
   */
  router.delete('/:id', authenticateJWT, (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);

      // 权限检查：只有管理员可以删除Agent
      const user = req.user as AuthUser | undefined;
      const userRole = user?.role;
      if (userRole !== 'admin') {
        return res.status(403).json({ success: false, error: '只有管理员可以删除Agent' });
      }

      // 委托 AgentService 删除
      const deleted = agentService.deleteAgent(id);

      if (!deleted) {
        return res.status(404).json({ success: false, error: `Agent '${id}' 不存在` });
      }

      logger.info(`[AgentAPI] 删除Agent: ${id}`);

      res.json({
        success: true,
        message: 'Agent删除成功'
      });
    } catch (error: any) {
      if (error.message.includes('不能删除系统核心Agent')) {
        return res.status(400).json({ success: false, error: error.message });
      }
      logger.error(`[AgentAPI] 删除Agent失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==========================================
  // 🧪 Agent测试与验证
  // ==========================================

  /**
   * POST /agents/:id/test
   * 测试Agent LLM连接和响应
   */
  router.post('/:id/test', authenticateJWT, async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const { test_message } = req.body;

      const agent = agentService.getAgentFull(id);
      if (!agent) {
        return res.status(404).json({ success: false, error: `Agent '${id}' 不存在` });
      }

      // 委托 AgentService 执行请求
      const request: AgentRequest = {
        agentId: id,
        agentName: agent.name,
        query: test_message || '测试连接'
      };

      const response = await agentService.executeAgentRequest(request);

      res.json({
        success: response.success,
        data: {
          agent_id: agent.id,
          agent_name: agent.name,
          test_timestamp: Date.now(),
          llm_provider: agent.llm_provider,
          llm_model: agent.llm_model,
          status: response.success ? 'ok' : 'error',
          response_time: response.processing_time,
          response: response.data?.response || response.error
        },
        message: 'Agent测试完成'
      });
    } catch (error: any) {
      logger.error(`[AgentAPI] Agent测试失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /agents/:id/status
   * 获取Agent状态和健康信息
   */
  router.get('/:id/status', authenticateJWT, (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);

      const agent = agentService.getAgentFull(id);
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
      logger.error(`[AgentAPI] 获取Agent状态失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==========================================
  // 📊 引擎状态
  // ==========================================

  /**
   * GET /agents/engine/stats
   * 获取Agent引擎统计信息
   */
  router.get('/engine/stats', authenticateJWT, (req: Request, res: Response) => {
    try {
      const stats = agentService.getEngineStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error: any) {
      logger.error(`[AgentAPI] 获取引擎统计失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /agents/execute
   * 执行Agent请求（核心入口）
   */
  router.post('/execute', authenticateJWT, async (req: Request, res: Response) => {
    try {
      const request: AgentRequest = req.body;

      if (!request.agentId || !request.query) {
        return res.status(400).json({ 
          success: false, 
          error: '必须提供 agentId 和 query' 
        });
      }

      const response = await agentService.executeAgentRequest(request);

      res.json({
        success: response.success,
        data: response.data,
        processing_time: response.processing_time,
        timestamp: response.timestamp,
        error: response.error
      });
    } catch (error: any) {
      logger.error(`[AgentAPI] 执行Agent请求失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /agents/collaborate
   * 执行协作请求
   */
  router.post('/collaborate', authenticateJWT, async (req: Request, res: Response) => {
    try {
      const request: CollaborationRequest = req.body;

      if (!request.coordinatorRequest || !request.specialistRequests) {
        return res.status(400).json({ 
          success: false, 
          error: '必须提供 coordinatorRequest 和 specialistRequests' 
        });
      }

      const result = await agentService.executeCollaboration(request);

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      logger.error(`[AgentAPI] 协作请求失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /agents/:id/validate
   * 验证宪法合规性
   */
  router.post('/:id/validate', authenticateJWT, (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const { action } = req.body;

      const compliance = agentService.validateConstitutionalCompliance(id, action || 'unknown');

      res.json({
        success: true,
        data: compliance
      });
    } catch (error: any) {
      logger.error(`[AgentAPI] 合规验证失败: ${error.message}`);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

export default createAgentRouter;
