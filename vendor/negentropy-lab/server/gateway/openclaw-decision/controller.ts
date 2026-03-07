/**
 * 馃幆 OpenClaw 鍐崇瓥鎺у埗鍣?
 *
 * @constitution
 * 搂101 鍚屾鍏悊锛氭帶鍒跺櫒涓庡喅绛栨湇鍔″悓姝?
 * 搂102 鐔靛噺鍘熷垯锛氱粺涓€鍏ュ彛闄嶄綆澶嶆潅搴?
 * 搂109 ToolCallBridge锛氭爣鍑嗗寲鍐崇瓥鎺ュ彛
 *
 * @filename controller.ts
 * @version 1.1.0
 * @category gateway/openclaw-decision
 * @last_updated 2026-03-02
 */

import { Router, Request, Response } from 'express';
import {
  DecisionRequest,
  DecisionResponse,
  DecisionAction,
  DecisionMode,
  isValidDecisionAction,
  isValidDecisionMode,
  createDefaultDecisionRequest,
  createExecuteResponse,
  createRewriteResponse,
  createRejectResponse,
  generateTraceId,
  DECISION_ERROR_CODES,
} from './contracts/decision-contract';
import { DecisionService, DecisionServiceConfig } from './service';
import { DEFAULT_RULES } from './policy/policy-rules';

/**
 * 鍐崇瓥鎺у埗鍣ㄩ厤缃?
 */
export interface DecisionControllerConfig {
  /** 鍐崇瓥鏈嶅姟閰嶇疆 */
  serviceConfig: DecisionServiceConfig;
  /** 鏄惁鍚敤瀹¤鏃ュ織 */
  enableAuditLog?: boolean;
  /** 璇锋眰瓒呮椂锛堟绉掞級 */
  timeout?: number;
  /** 杩愯妯″紡锛堢畝鍖栭厤缃級 */
  mode?: DecisionMode;
}

/**
 * 鍐崇瓥鍋ュ悍妫€鏌ョ粨鏋?
 */
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  mode: DecisionMode;
  timestamp: string;
}

/**
 * 鍐崇瓥鎺у埗鍣?
 * 璐熻矗澶勭悊 HTTP 鍐崇瓥璇锋眰
 */
export class DecisionController {
  private router: Router;
  private service: DecisionService;
  private config: DecisionControllerConfig;

  constructor(config: DecisionControllerConfig) {
    this.config = {
      enableAuditLog: true,
      timeout: 5000,
      ...config,
    };
    this.service = new DecisionService(config.serviceConfig);
    this.router = this.createRouter();
  }

  /**
   * 鍒涘缓 Express 璺敱
   */
  private createRouter(): Router {
    const router = Router();

    // 鍐崇瓥绔偣
    router.post('/internal/openclaw/decision', this.handleDecision.bind(this));

    // 鍋ュ悍妫€鏌?
    router.get('/internal/openclaw/health', this.handleHealth.bind(this));

    // 妯″紡鏌ヨ
    router.get('/internal/openclaw/mode', this.handleGetMode.bind(this));

    return router;
  }

  /**
   * 鑾峰彇璺敱鍣?
   */
  getRouter(): Router {
    return this.router;
  }

  /**
   * 鑾峰彇褰撳墠妯″紡
   */
  getMode(): DecisionMode {
    return this.service.getMode();
  }

  /**
   * 璁剧疆杩愯妯″紡
   */
  setMode(mode: DecisionMode): void {
    this.service.setMode(mode);
  }

  /**
   * 澶勭悊鍐崇瓥璇锋眰锛堝叕寮€鏂规硶锛屼緵鐩存帴璋冪敤锛?
   */
  async handleDecision(request: DecisionRequest): Promise<DecisionResponse> {
    const validation = this.validateRequest(request);
    if (!validation.valid) {
      return createRejectResponse(
        request?.traceId || generateTraceId(),
        DECISION_ERROR_CODES.INVALID_PARAMS,
        validation.error || 'Invalid request'
      );
    }
    return this.service.decide(request);
  }

  /**
   * 鍋ュ悍妫€鏌ワ紙鍏紑鏂规硶锛?
   */
  async healthCheck(): Promise<HealthCheckResult> {
    return {
      status: 'healthy',
      mode: this.service.getMode(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 澶勭悊 HTTP 鍐崇瓥璇锋眰
   */
  private async handleDecisionHttp(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    let traceId = req.body?.traceId || generateTraceId();

    try {
      // 鍙傛暟鏍￠獙
      const validation = this.validateRequest(req.body);
      if (!validation.valid) {
        res.status(400).json({
          action: 'REJECT',
          traceId,
          ts: new Date().toISOString(),
          errorCode: DECISION_ERROR_CODES.INVALID_PARAMS,
          reason: validation.error,
        });
        return;
      }

      // 鏋勫缓鍐崇瓥璇锋眰
      const decisionRequest: DecisionRequest = {
        traceId,
        transport: req.body.transport || 'ws',
        method: req.body.method,
        params: req.body.params || {},
        ts: req.body.ts || new Date().toISOString(),
        authMeta: req.body.authMeta,
        headers: req.body.headers,
        sourceIp: req.body.sourceIp,
      };

      // 璋冪敤鍐崇瓥鏈嶅姟
      const decision = await this.service.decide(decisionRequest);

      // 瀹¤鏃ュ織
      if (this.config.enableAuditLog) {
        this.logDecision(decisionRequest, decision, Date.now() - startTime);
      }

      res.json(decision);
    } catch (error) {
      console.error('[DecisionController] Decision error:', error);
      res.status(500).json({
        action: 'REJECT',
        traceId,
        ts: new Date().toISOString(),
        errorCode: DECISION_ERROR_CODES.INTERNAL_ERROR,
        reason: 'Internal decision service error',
      });
    }
  }

  /**
   * 鏍￠獙璇锋眰鍙傛暟
   */
  private validateRequest(body: any): { valid: boolean; error?: string } {
    if (!body) {
      return { valid: false, error: 'Request body is required' };
    }

    if (!body.method || typeof body.method !== 'string') {
      return { valid: false, error: 'Invalid or missing method' };
    }

    if (body.params && typeof body.params !== 'object') {
      return { valid: false, error: 'Params must be an object' };
    }

    if (body.transport && !['ws', 'http'].includes(body.transport)) {
      return { valid: false, error: 'Invalid transport (must be ws or http)' };
    }

    return { valid: true };
  }

  /**
   * 鍋ュ悍妫€鏌ョ鐐?
   */
  private handleHealth(_req: Request, res: Response): void {
    res.json({
      status: 'healthy',
      mode: this.service.getMode(),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 鑾峰彇褰撳墠妯″紡
   */
  private handleGetMode(_req: Request, res: Response): void {
    res.json({
      mode: this.service.getMode(),
      description: this.getModeDescription(this.service.getMode()),
    });
  }

  /**
   * 鑾峰彇妯″紡鎻忚堪
   */
  private getModeDescription(mode: DecisionMode): string {
    const descriptions: Record<DecisionMode, string> = {
      OFF: 'Decision service is disabled, all requests pass through',
      SHADOW: 'Decision service runs in shadow mode, logging but not blocking',
      ENFORCE: 'Decision service enforces decisions, may reject or rewrite requests',
    };
    return descriptions[mode];
  }

  /**
   * 璁板綍瀹¤鏃ュ織
   */
  private logDecision(
    request: DecisionRequest,
    response: DecisionResponse,
    duration: number
  ): void {
    console.log(JSON.stringify({
      type: 'decision_audit',
      traceId: request.traceId,
      method: request.method,
      action: response.action,
      mode: this.service.getMode(),
      duration,
      ts: new Date().toISOString(),
    }));
  }
}

// ============================================================================
// 鍗曚緥绠＄悊
// ============================================================================

let controllerInstance: DecisionController | null = null;

/**
 * 鑾峰彇鍐崇瓥鎺у埗鍣ㄥ崟渚?
 */
export function getDecisionController(config?: Partial<DecisionControllerConfig> & { mode?: DecisionMode }): DecisionController {
  if (!controllerInstance) {
    const mode = config?.mode || config?.serviceConfig?.mode || 'OFF';
    controllerInstance = new DecisionController({
      serviceConfig: {
        mode: mode as DecisionMode,
        rules: config?.serviceConfig?.rules ?? DEFAULT_RULES,
      },
      enableAuditLog: config?.enableAuditLog ?? true,
      timeout: config?.timeout ?? 5000,
    });
  } else if (config) {
    const mode = config.mode || config.serviceConfig?.mode;
    if (mode) {
      controllerInstance.setMode(mode as DecisionMode);
    }
  }
  return controllerInstance;
}

/**
 * 閲嶇疆鍐崇瓥鎺у埗鍣?
 */
export function resetDecisionController(): void {
  controllerInstance = null;
}

/**
 * 鍒涘缓鍐崇瓥鎺у埗鍣?
 */
export function createDecisionController(
  config: DecisionControllerConfig
): DecisionController {
  return new DecisionController(config);
}

/**
 * 榛樿鍐崇瓥鎺у埗鍣ㄩ厤缃?
 */
export const DEFAULT_CONTROLLER_CONFIG: DecisionControllerConfig = {
  serviceConfig: {
    mode: 'OFF',
    rules: DEFAULT_RULES,
  },
  enableAuditLog: true,
  timeout: 5000,
};

