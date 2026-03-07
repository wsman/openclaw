/**
 * 🎯 OpenClaw 决策服务
 *
 * @constitution
 * §101 同步公理：服务与策略引擎同步
 * §102 熵减原则：统一决策逻辑
 * §109 ToolCallBridge：标准化决策服务
 *
 * @filename service.ts
 * @version 1.0.0
 * @category gateway/openclaw-decision
 * @last_updated 2026-03-02
 */

import {
  DecisionRequest,
  DecisionResponse,
  DecisionMode,
  DecisionAction,
  createExecuteResponse,
  createRewriteResponse,
  createRejectResponse,
} from './contracts/decision-contract';
import { PolicyEngine, PolicyResult } from './policy/policy-engine';
import type { PolicyRule } from './policy/policy-rules';

/**
 * 决策服务配置
 */
export interface DecisionServiceConfig {
  /** 运行模式 */
  mode: DecisionMode;
  /** 策略规则列表 */
  rules: PolicyRule[];
  /** 默认超时（毫秒） */
  timeout?: number;
  /** 是否启用审计 */
  enableAudit?: boolean;
}

/**
 * 决策服务
 * 负责根据策略引擎做出决策
 */
export class DecisionService {
  private mode: DecisionMode;
  private policyEngine: PolicyEngine;
  private config: DecisionServiceConfig;

  constructor(config: DecisionServiceConfig) {
    this.config = {
      timeout: 5000,
      enableAudit: true,
      ...config,
    };
    this.mode = config.mode;
    this.policyEngine = new PolicyEngine({ rules: config.rules });
  }

  /**
   * 执行决策
   */
  async decide(request: DecisionRequest): Promise<DecisionResponse> {
    // OFF 模式：直接放行
    if (this.mode === 'OFF') {
      return createExecuteResponse(request.traceId);
    }

    // 执行策略评估
    const policyResult = await this.policyEngine.evaluate(request);

    // SHADOW 模式：记录但放行
    if (this.mode === 'SHADOW') {
      this.logShadowDecision(request, policyResult);
      return createExecuteResponse(request.traceId);
    }

    // ENFORCE 模式：执行决策
    return this.enforceDecision(request, policyResult);
  }

  /**
   * 获取当前模式
   */
  getMode(): DecisionMode {
    return this.mode;
  }

  /**
   * 设置模式
   */
  setMode(mode: DecisionMode): void {
    this.mode = mode;
    console.log(`[DecisionService] Mode changed to: ${mode}`);
  }

  /**
   * 获取策略引擎
   */
  getPolicyEngine(): PolicyEngine {
    return this.policyEngine;
  }

  /**
   * 添加规则
   */
  addRule(rule: PolicyRule): void {
    this.policyEngine.addRule(rule);
  }

  /**
   * 移除规则
   */
  removeRule(ruleId: string): void {
    this.policyEngine.removeRule(ruleId);
  }

  /**
   * 执行决策（ENFORCE 模式）
   */
  private enforceDecision(
    request: DecisionRequest,
    policyResult: PolicyResult
  ): DecisionResponse {
    switch (policyResult.action) {
      case 'EXECUTE':
        return createExecuteResponse(request.traceId);

      case 'REWRITE':
        return createRewriteResponse(
          request.traceId,
          policyResult.rewriteMethod || request.method,
          policyResult.rewriteParams || request.params,
          policyResult.reason
        );

      case 'REJECT':
        return createRejectResponse(
          request.traceId,
          policyResult.errorCode || 'POLICY_DENY',
          policyResult.reason || 'Request rejected by policy',
          policyResult.errorDetail
        );

      default:
        return createExecuteResponse(request.traceId);
    }
  }

  /**
   * 记录 SHADOW 模式决策
   */
  private logShadowDecision(
    request: DecisionRequest,
    policyResult: PolicyResult
  ): void {
    if (this.config.enableAudit) {
      console.log(JSON.stringify({
        type: 'shadow_decision',
        traceId: request.traceId,
        method: request.method,
        wouldBeAction: policyResult.action,
        ruleIds: policyResult.ruleIds,
        ts: new Date().toISOString(),
      }));
    }
  }
}

/**
 * 创建决策服务
 */
export function createDecisionService(
  config: DecisionServiceConfig
): DecisionService {
  return new DecisionService(config);
}

/**
 * 默认决策服务配置
 */
export const DEFAULT_SERVICE_CONFIG: DecisionServiceConfig = {
  mode: 'OFF',
  rules: [],
  timeout: 5000,
  enableAudit: true,
};