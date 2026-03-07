/**
 * 🔗 OpenClaw 决策桥接 SDK
 *
 * 供 OpenClaw 网关调用的决策服务客户端 SDK
 *
 * @constitution
 * §101 同步公理：SDK 与决策服务同步
 * §102 熵减原则：统一桥接接口
 * §109 ToolCallBridge：标准化桥接规范
 *
 * @filename decision-bridge-sdk.ts
 * @version 1.0.0
 * @category gateway/openclaw-decision/bridge
 * @last_updated 2026-03-02
 */

import {
  DecisionRequest,
  DecisionResponse,
  DecisionMode,
  DecisionAction,
  createDefaultDecisionRequest,
  DECISION_ERROR_CODES,
} from '../contracts/decision-contract';
import { SignatureService, SignatureConfig } from '../security/signature';
import { ReplayGuard } from '../security/replay-guard';
import { CircuitBreaker } from '../resilience/circuit-breaker';
import { RetryExecutor } from '../resilience/retry';

/**
 * 桥接 SDK 配置
 */
export interface DecisionBridgeConfig {
  /** 决策服务 URL */
  serviceUrl: string;
  /** 运行模式 */
  mode: DecisionMode;
  /** 签名配置 */
  signature?: SignatureConfig;
  /** 请求超时（毫秒） */
  timeout?: number;
  /** 是否启用防重放 */
  enableReplayGuard?: boolean;
}

/**
 * 决策结果
 */
export interface BridgeDecisionResult {
  /** 决策动作 */
  action: DecisionAction;
  /** 改写后的方法 */
  method?: string;
  /** 改写后的参数 */
  params?: Record<string, unknown>;
  /** 错误码 */
  errorCode?: string;
  /** 错误原因 */
  reason?: string;
  /** 追踪ID */
  traceId: string;
  /** 是否从缓存获取 */
  fromCache?: boolean;
}

/**
 * OpenClaw 决策桥接 SDK
 */
export class DecisionBridgeSDK {
  private config: Required<Omit<DecisionBridgeConfig, 'signature'>> & { signature?: SignatureConfig };
  private signatureService?: SignatureService;
  private replayGuard?: ReplayGuard;
  private circuitBreaker: CircuitBreaker;
  private retryExecutor: RetryExecutor;

  constructor(config: DecisionBridgeConfig) {
    this.config = {
      timeout: 5000,
      enableReplayGuard: true,
      ...config,
    };

    if (config.signature) {
      this.signatureService = new SignatureService(config.signature);
    }

    if (this.config.enableReplayGuard) {
      this.replayGuard = new ReplayGuard();
    }

    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      timeout: 30000,
    });

    this.retryExecutor = new RetryExecutor({
      maxRetries: 2,
      initialDelay: 100,
    });
  }

  /**
   * 请求决策
   */
  async decide(request: Partial<DecisionRequest>): Promise<BridgeDecisionResult> {
    // OFF 模式直接放行
    if (this.config.mode === 'OFF') {
      return {
        action: 'EXECUTE',
        traceId: request.traceId || this.generateTraceId(),
      };
    }

    // 构建完整请求
    const fullRequest: DecisionRequest = {
      traceId: request.traceId || this.generateTraceId(),
      transport: request.transport || 'ws',
      method: request.method || '',
      params: request.params || {},
      ts: request.ts || new Date().toISOString(),
      ...request,
    };

    // 使用熔断器和重试
    const breakerResult = await this.circuitBreaker.execute(async () => {
      const retryResult = await this.retryExecutor.execute(async () => {
        return this.callDecisionService(fullRequest);
      });
      return retryResult;
    });

    if (!breakerResult.success || !breakerResult.result?.success) {
      // 决策服务不可用时，根据模式处理
      if (this.config.mode === 'SHADOW') {
        return {
          action: 'EXECUTE',
          traceId: fullRequest.traceId,
        };
      }
      
      return {
        action: 'REJECT',
        errorCode: DECISION_ERROR_CODES.SERVICE_UNAVAILABLE,
        reason: breakerResult.error?.message || breakerResult.result?.error?.message || 'Decision service unavailable',
        traceId: fullRequest.traceId,
      };
    }

    return breakerResult.result.result!;
  }

  /**
   * 调用决策服务
   */
  private async callDecisionService(request: DecisionRequest): Promise<BridgeDecisionResult> {
    const url = `${this.config.serviceUrl}/internal/openclaw/decision`;
    const body = JSON.stringify(request);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 添加签名头
    if (this.signatureService) {
      const sigHeaders = this.signatureService.generateHeaders(body);
      headers['x-signature'] = sigHeaders['x-signature'];
      headers['x-signature-timestamp'] = sigHeaders['x-signature-timestamp'];
      if (sigHeaders['x-signature-nonce']) {
        headers['x-signature-nonce'] = sigHeaders['x-signature-nonce'];
      }
    }

    // 防重放检查
    if (this.replayGuard && headers['x-signature-nonce']) {
      const nonce = headers['x-signature-nonce'];
      const timestamp = parseInt(headers['x-signature-timestamp'], 10);
      const replayResult = this.replayGuard.check(nonce, timestamp);
      
      if (!replayResult.valid) {
        return {
          action: 'REJECT',
          errorCode: DECISION_ERROR_CODES.AUTH_INVALID,
          reason: replayResult.reason || 'Replay detected',
          traceId: request.traceId,
        };
      }
    }

    // 发送请求
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Decision service returned ${response.status}`);
      }

      const decision = (await response.json()) as DecisionResponse;

      return {
        action: decision.action,
        method: decision.method,
        params: decision.params,
        errorCode: decision.errorCode,
        reason: decision.reason,
        traceId: decision.traceId,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * 生成追踪ID
   */
  private generateTraceId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `br-${timestamp}-${random}`;
  }

  /**
   * 获取当前模式
   */
  getMode(): DecisionMode {
    return this.config.mode;
  }

  /**
   * 设置模式
   */
  setMode(mode: DecisionMode): void {
    this.config.mode = mode;
  }

  /**
   * 获取熔断器状态
   */
  getCircuitBreakerState(): string {
    return this.circuitBreaker.getState();
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ healthy: boolean; mode: DecisionMode; circuitBreaker: string }> {
    return {
      healthy: this.circuitBreaker.getState() !== 'open',
      mode: this.config.mode,
      circuitBreaker: this.circuitBreaker.getState(),
    };
  }

  /**
   * 关闭 SDK
   */
  destroy(): void {
    if (this.replayGuard) {
      this.replayGuard.stop();
    }
  }
}

/**
 * 创建决策桥接 SDK
 */
export function createDecisionBridgeSDK(config: DecisionBridgeConfig): DecisionBridgeSDK {
  return new DecisionBridgeSDK(config);
}
