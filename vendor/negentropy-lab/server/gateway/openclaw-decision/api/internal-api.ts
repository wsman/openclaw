/**
 * 🚀 内部 API 路由
 *
 * 提供内网可调用的 HTTP 接口，用于决策服务管理。
 *
 * @constitution
 * §101 同步公理：API 接口需与合同同步
 * §102 熵减原则：集中维护 API 路由
 * §152 单一真理源公理:此文件为内部 API 唯一定义
 *
 * @filename internal-api.ts
 * @version 1.1.0
 * @category gateway/openclaw-decision
 * @last_updated 2026-03-02
 */

import { Request, Response, Router } from 'express';
import { getDecisionController } from '../controller';
import { getCircuitBreakerManager } from '../resilience/circuit-breaker';
import { getFallbackAdapter } from '../resilience/fallback-adapter';
import { getOpenClawBridge } from '../bridge/openclaw-bridge';
import { createDefaultDecisionRequest, DecisionRequest } from '../contracts/decision-contract';
import { createWorkflowInternalApiRouter } from '../../openclaw-orchestration/api/internal-api';

// ============================================================================
// API 路由器
// ============================================================================

/**
 * 创建内部 API 路由
 */
export function createInternalApiRouter(): Router {
  const router = Router();
  const controller = getDecisionController();

  // -----------------------------------------------------
  // 决策接口
  // -----------------------------------------------------

  /**
   * POST /internal/openclaw/decision
   * 执行决策评估
   */
  router.post('/decision', async (req: Request, res: Response) => {
    try {
      const request: Partial<DecisionRequest> = req.body;
      const fullRequest = createDefaultDecisionRequest(
        request.method || '',
        request.params || {},
        request.transport || 'ws'
      );
      const response = await controller.handleDecision({
        ...fullRequest,
        ...request,
        traceId: request.traceId || fullRequest.traceId,
      });
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: errorMessage, action: 'REJECT' });
    }
  });

  /**
   * GET /internal/openclaw/decision/mode
   * 获取当前运行模式
   */
  router.get('/decision/mode', (req: Request, res: Response) => {
    res.json({ mode: controller.getMode() });
  });

  /**
   * PUT /internal/openclaw/decision/mode
   * 设置运行模式
   */
  router.put('/decision/mode', (req: Request, res: Response) => {
    try {
      const { mode } = req.body;
      controller.setMode(mode);
      res.json({ success: true, mode: controller.getMode() });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(400).json({ error: errorMessage });
    }
  });

  // -----------------------------------------------------
  // 断路器管理
  // -----------------------------------------------------

  /**
   * GET /internal/openclaw/circuit-breaker
   * 获取所有断路器状态
   */
  router.get('/circuit-breaker', (req: Request, res: Response) => {
    const manager = getCircuitBreakerManager();
    res.json(manager.getAllStats());
  });

  /**
   * POST /internal/openclaw/circuit-breaker/:name/reset
   * 重置指定断路器
   */
  router.post('/circuit-breaker/:name/reset', (req: Request, res: Response) => {
    const manager = getCircuitBreakerManager();
    const breaker = manager.getBreaker(req.params.name);
    breaker.reset();
    res.json({ success: true, name: req.params.name });
  });

  // -----------------------------------------------------
  // 回退适配器
  // -----------------------------------------------------

  /**
   * GET /internal/openclaw/fallback
   * 获取回退适配器状态
   */
  router.get('/fallback', (req: Request, res: Response) => {
    const adapter = getFallbackAdapter();
    res.json(adapter.getStats());
  });

  /**
   * POST /internal/openclaw/fallback/reset
   * 重置回退统计
   */
  router.post('/fallback/reset', (req: Request, res: Response) => {
    const adapter = getFallbackAdapter();
    adapter.reset();
    res.json({ success: true });
  });

  // -----------------------------------------------------
  // 桥接器管理
  // -----------------------------------------------------

  /**
   * GET /internal/openclaw/bridge/sessions
   * 获取所有会话
   */
  router.get('/bridge/sessions', (req: Request, res: Response) => {
    const bridge = getOpenClawBridge();
    const sessions = bridge.getAllSessions();
    res.json({
      count: sessions.length,
      sessions: sessions.map(s => ({
        connId: s.connId,
        authenticated: s.authenticated,
        createdAt: s.createdAt,
        lastActivity: s.lastActivity,
      })),
    });
  });

  /**
   * POST /internal/openclaw/bridge/cleanup
   * 清理过期会话
   */
  router.post('/bridge/cleanup', (req: Request, res: Response) => {
    const bridge = getOpenClawBridge();
    const cleaned = bridge.cleanupExpiredSessions();
    res.json({ success: true, cleaned });
  });

  /**
   * GET /internal/openclaw/status
   * 获取综合状态
   */
  router.get('/status', async (req: Request, res: Response) => {
    const controller = getDecisionController();
    const circuitBreakerManager = getCircuitBreakerManager();
    const fallbackAdapter = getFallbackAdapter();
    const bridge = getOpenClawBridge();

    res.json({
      decision: await controller.healthCheck(),
      circuitBreakers: circuitBreakerManager.getAllStats(),
      fallback: fallbackAdapter.getStats(),
      bridge: {
        sessionCount: bridge.getAllSessions().length,
        config: bridge.getConfig(),
      },
    });
  });

  // Mount workflow orchestration under the same internal /openclaw API surface so
  // extension defaults can derive a single base URL from the decision service URL.
  router.use(createWorkflowInternalApiRouter());

  return router;
}
