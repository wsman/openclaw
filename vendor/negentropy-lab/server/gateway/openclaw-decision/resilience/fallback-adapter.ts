/**
 * 🔄 回退适配器
 *
 * @constitution
 * §101 同步公理：回退逻辑与决策服务同步
 * §102 熵减原则：集中回退逻辑
 * §109 ToolCallBridge：弹性保护标准化
 *
 * @filename fallback-adapter.ts
 * @version 1.0.0
 * @category gateway/openclaw-decision/resilience
 * @last_updated 2026-03-02
 */

import {
  DecisionRequest,
  DecisionResponse,
  createExecuteResponse,
  generateTraceId,
} from '../contracts/decision-contract';

/**
 * 回退适配器配置
 */
export interface FallbackAdapterConfig {
  /** 是否启用回退 */
  enabled?: boolean;
  /** 回退原因 */
  fallbackReason?: string;
}

/**
 * 回退统计
 */
export interface FallbackStats {
  /** 回退次数 */
  fallbackCount: number;
  /** 最后回退时间 */
  lastFallbackTime?: number;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 回退适配器
 * 当决策服务不可用时提供降级处理
 */
export class FallbackAdapter {
  private config: Required<FallbackAdapterConfig>;
  private fallbackCount: number = 0;
  private lastFallbackTime?: number;

  constructor(config: FallbackAdapterConfig = {}) {
    this.config = {
      enabled: config.enabled ?? false,
      fallbackReason: config.fallbackReason ?? 'Decision service unavailable, using fallback',
    };
  }

  /**
   * 检查是否应该回退
   */
  shouldFallback(): boolean {
    return this.config.enabled;
  }

  /**
   * 执行回退
   */
  executeFallback(request: DecisionRequest): DecisionResponse {
    this.fallbackCount++;
    this.lastFallbackTime = Date.now();

    return {
      action: 'EXECUTE',
      traceId: request.traceId || generateTraceId(),
      ts: new Date().toISOString(),
      reason: this.config.fallbackReason,
      policyTags: {
        ruleIds: ['fallback'],
        category: 'resilience',
        severity: 'low',
      },
    };
  }

  /**
   * 获取统计信息
   */
  getStats(): FallbackStats {
    return {
      fallbackCount: this.fallbackCount,
      lastFallbackTime: this.lastFallbackTime,
      enabled: this.config.enabled,
    };
  }

  /**
   * 重置统计
   */
  reset(): void {
    this.fallbackCount = 0;
    this.lastFallbackTime = undefined;
  }

  /**
   * 设置启用状态
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }
}

// ============================================================================
// 单例管理
// ============================================================================

let adapterInstance: FallbackAdapter | null = null;

/**
 * 获取回退适配器单例
 */
export function getFallbackAdapter(config?: FallbackAdapterConfig): FallbackAdapter {
  if (!adapterInstance) {
    adapterInstance = new FallbackAdapter(config);
  }
  return adapterInstance;
}

/**
 * 重置回退适配器
 */
export function resetFallbackAdapter(): void {
  if (adapterInstance) {
    adapterInstance.reset();
  }
  adapterInstance = null;
}

/**
 * 创建回退适配器
 */
export function createFallbackAdapter(config?: FallbackAdapterConfig): FallbackAdapter {
  return new FallbackAdapter(config);
}
