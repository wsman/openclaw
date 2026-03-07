/**
 * 🚀 OpenClaw 决策模块 - Prometheus 指标导出
 *
 * @constitution
 * §101 同步公理：指标定义需与合同同步
 * §102 熵减原则：统一指标管理
 * §504 监控系统公理：实时监控合规状态
 *
 * @filename metrics.ts
 * @version 1.0.0
 * @category gateway/openclaw-decision/observability
 * @last_updated 2026-03-03
 */

import { Request, Response } from 'express';

// ============================================================================
// 指标类型定义
// ============================================================================

export interface OpenClawMetrics {
  // 决策计数器
  decisionsTotal: number;
  decisionsAccepted: number;
  decisionsRejected: number;
  decisionsShadowed: number;
  
  // 断路器指标
  circuitBreakerOpens: number;
  circuitBreakerCloses: number;
  
  // 回退指标
  fallbackTriggers: number;
  fallbackSuccesses: number;
  
  // 延迟直方图
  decisionLatencyMs: number[];
  
  // 会话指标
  activeSessions: number;
  sessionTimeouts: number;
}

// ============================================================================
// 指标收集器
// ============================================================================

class MetricsCollector {
  private metrics: OpenClawMetrics = {
    decisionsTotal: 0,
    decisionsAccepted: 0,
    decisionsRejected: 0,
    decisionsShadowed: 0,
    circuitBreakerOpens: 0,
    circuitBreakerCloses: 0,
    fallbackTriggers: 0,
    fallbackSuccesses: 0,
    decisionLatencyMs: [],
    activeSessions: 0,
    sessionTimeouts: 0,
  };

  private startTime = Date.now();

  // --------------------------------------------------------------------------
  // 决策指标
  // --------------------------------------------------------------------------

  recordDecision(action: 'ACCEPT' | 'REJECT' | 'SHADOW'): void {
    this.metrics.decisionsTotal++;
    if (action === 'ACCEPT') this.metrics.decisionsAccepted++;
    else if (action === 'REJECT') this.metrics.decisionsRejected++;
    else if (action === 'SHADOW') this.metrics.decisionsShadowed++;
  }

  recordLatency(latencyMs: number): void {
    this.metrics.decisionLatencyMs.push(latencyMs);
    // 保留最近 1000 个样本
    if (this.metrics.decisionLatencyMs.length > 1000) {
      this.metrics.decisionLatencyMs.shift();
    }
  }

  // --------------------------------------------------------------------------
  // 断路器指标
  // --------------------------------------------------------------------------

  recordCircuitBreakerOpen(): void {
    this.metrics.circuitBreakerOpens++;
  }

  recordCircuitBreakerClose(): void {
    this.metrics.circuitBreakerCloses++;
  }

  // --------------------------------------------------------------------------
  // 回退指标
  // --------------------------------------------------------------------------

  recordFallbackTrigger(): void {
    this.metrics.fallbackTriggers++;
  }

  recordFallbackSuccess(): void {
    this.metrics.fallbackSuccesses++;
  }

  // --------------------------------------------------------------------------
  // 会话指标
  // --------------------------------------------------------------------------

  setActiveSessions(count: number): void {
    this.metrics.activeSessions = count;
  }

  recordSessionTimeout(): void {
    this.metrics.sessionTimeouts++;
  }

  // --------------------------------------------------------------------------
  // 导出
  // --------------------------------------------------------------------------

  getMetrics(): OpenClawMetrics {
    return { ...this.metrics };
  }

  /**
   * 导出 Prometheus 格式指标
   */
  exportPrometheus(): string {
    const m = this.metrics;
    const uptime = (Date.now() - this.startTime) / 1000;
    
    const latencyP50 = this.calculatePercentile(50);
    const latencyP95 = this.calculatePercentile(95);
    const latencyP99 = this.calculatePercentile(99);

    return `# HELP openclaw_decisions_total Total number of decisions
# TYPE openclaw_decisions_total counter
openclaw_decisions_total ${m.decisionsTotal}
openclaw_decisions_accepted ${m.decisionsAccepted}
openclaw_decisions_rejected ${m.decisionsRejected}
openclaw_decisions_shadowed ${m.decisionsShadowed}

# HELP openclaw_circuit_breaker_events Circuit breaker state changes
# TYPE openclaw_circuit_breaker_events counter
openclaw_circuit_breaker_opens ${m.circuitBreakerOpens}
openclaw_circuit_breaker_closes ${m.circuitBreakerCloses}

# HELP openclaw_fallback_total Fallback adapter metrics
# TYPE openclaw_fallback_total counter
openclaw_fallback_triggers ${m.fallbackTriggers}
openclaw_fallback_successes ${m.fallbackSuccesses}

# HELP openclaw_decision_latency_ms Decision latency in milliseconds
# TYPE openclaw_decision_latency_ms summary
openclaw_decision_latency_p50 ${latencyP50}
openclaw_decision_latency_p95 ${latencyP95}
openclaw_decision_latency_p99 ${latencyP99}

# HELP openclaw_sessions_active Active sessions count
# TYPE openclaw_sessions_active gauge
openclaw_sessions_active ${m.activeSessions}

# HELP openclaw_session_timeouts Total session timeouts
# TYPE openclaw_session_timeouts counter
openclaw_session_timeouts ${m.sessionTimeouts}

# HELP openclaw_uptime_seconds Service uptime in seconds
# TYPE openclaw_uptime_seconds gauge
openclaw_uptime_seconds ${uptime}
`;
  }

  private calculatePercentile(percentile: number): number {
    const latencies = this.metrics.decisionLatencyMs;
    if (latencies.length === 0) return 0;
    
    const sorted = [...latencies].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  reset(): void {
    this.metrics = {
      decisionsTotal: 0,
      decisionsAccepted: 0,
      decisionsRejected: 0,
      decisionsShadowed: 0,
      circuitBreakerOpens: 0,
      circuitBreakerCloses: 0,
      fallbackTriggers: 0,
      fallbackSuccesses: 0,
      decisionLatencyMs: [],
      activeSessions: 0,
      sessionTimeouts: 0,
    };
    this.startTime = Date.now();
  }
}

// ============================================================================
// 单例导出
// ============================================================================

let metricsInstance: MetricsCollector | null = null;

export function getMetricsCollector(): MetricsCollector {
  if (!metricsInstance) {
    metricsInstance = new MetricsCollector();
  }
  return metricsInstance;
}

export function resetMetricsCollector(): void {
  metricsInstance = null;
}

// ============================================================================
// HTTP 处理器
// ============================================================================

/**
 * 创建 Prometheus 指标端点处理器
 */
export function createMetricsHandler() {
  return (req: Request, res: Response) => {
    const collector = getMetricsCollector();
    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(collector.exportPrometheus());
  };
}