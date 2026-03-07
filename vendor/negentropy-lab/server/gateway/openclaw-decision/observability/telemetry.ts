/**
 * 🚀 OpenClaw 决策模块 - 遥测数据收集
 *
 * @constitution
 * §101 同步公理: 遥测数据需与合同同步
 * §102 熵减原则: 统一遥测管理
 * §504 监控系统公理: 实时监控合规状态
 *
 * @filename telemetry.ts
 * @version 1.0.0
 * @category gateway/openclaw-decision/observability
 * @last_updated 2026-03-03
 */

import { Request, Response } from 'express';
import { getDecisionController } from '../controller';
import { getCircuitBreakerManager } from '../resilience/circuit-breaker';
import { getFallbackAdapter } from '../resilience/fallback-adapter';
import { getOpenClawBridge } from '../bridge/openclaw-bridge';
import { getMetricsCollector } from './metrics';

// ============================================================================
// 类型定义
// ============================================================================

export interface TelemetryEvent {
  timestamp: string;
  eventType: 'decision' | 'circuit_breaker' | 'fallback' | 'latency' | 'session';
  component: string;
  data: Record<string, unknown>;
}

export interface TelemetrySnapshot {
  timestamp: string;
  uptime: number;
  events: TelemetryEvent[];
  summary: {
    totalEvents: number;
    eventsByType: Record<string, number>;
  };
  system: {
    decision: {
      mode: string;
      status: 'healthy' | 'unhealthy';
    };
    circuitBreakers: Record<string, unknown>;
    fallback: {
      fallbackCount: number;
      lastFallbackTime?: number;
      enabled: boolean;
    };
    bridge: {
      sessionCount: number;
    };
  };
}

// ============================================================================
// 遥测缓冲区
// ============================================================================

class TelemetryBuffer {
  private events: TelemetryEvent[] = [];
  private maxEvents = 1000;
  private startTime = Date.now();

  /**
   * 记录遥测事件
   */
  recordEvent(event: Omit<TelemetryEvent, 'timestamp'>): void {
    const fullEvent: TelemetryEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };
    this.events.push(fullEvent);
    
    // 保留最近 N 个事件
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  /**
   * 获取所有事件
   */
  getEvents(): TelemetryEvent[] {
    return [...this.events];
  }

  /**
   * 获取最近 N 个事件
   */
  getRecentEvents(count: number = 100): TelemetryEvent[] {
    return this.events.slice(-count);
  }

  /**
   * 按类型获取事件
   */
  getEventsByType(eventType: TelemetryEvent['eventType']): TelemetryEvent[] {
    return this.events.filter(e => e.eventType === eventType);
  }

  /**
   * 生成事件摘要
   */
  getSummary(): { totalEvents: number; eventsByType: Record<string, number> } {
    const eventsByType: Record<string, number> = {};
    
    for (const event of this.events) {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
    }

    return {
      totalEvents: this.events.length,
      eventsByType,
    };
  }

  /**
   * 生成完整遥测快照
   */
  async generateSnapshot(): Promise<TelemetrySnapshot> {
    const controller = getDecisionController();
    const circuitBreakerManager = getCircuitBreakerManager();
    const fallbackAdapter = getFallbackAdapter();
    const bridge = getOpenClawBridge();

    let decisionStatus: 'healthy' | 'unhealthy' = 'healthy';
    try {
      const healthResult = await controller.healthCheck();
      decisionStatus = healthResult.status;
    } catch (error) {
      decisionStatus = 'unhealthy';
    }

    return {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      events: this.getRecentEvents(100),
      summary: this.getSummary(),
      system: {
        decision: {
          mode: controller.getMode(),
          status: decisionStatus,
        },
        circuitBreakers: circuitBreakerManager.getAllStats(),
        fallback: fallbackAdapter.getStats(),
        bridge: {
          sessionCount: bridge.getAllSessions().length,
        },
      },
    };
  }

  /**
   * 清空事件缓冲区
   */
  clear(): void {
    this.events = [];
  }

  /**
   * 重置遥测器
   */
  reset(): void {
    this.events = [];
    this.startTime = Date.now();
  }
}

// ============================================================================
// 单例导出
// ============================================================================

let telemetryInstance: TelemetryBuffer | null = null;

export function getTelemetryBuffer(): TelemetryBuffer {
  if (!telemetryInstance) {
    telemetryInstance = new TelemetryBuffer();
  }
  return telemetryInstance;
}

export function resetTelemetryBuffer(): void {
  telemetryInstance = null;
}

// ============================================================================
// 便捷记录函数
// ============================================================================

/**
 * 记录决策事件
 */
export function recordDecisionEvent(
  action: string,
  data: Record<string, unknown>
): void {
  const telemetry = getTelemetryBuffer();
  telemetry.recordEvent({
    eventType: 'decision',
    component: 'decision-controller',
    data: { action, ...data },
  });
}

/**
 * 记录断路器事件
 */
export function recordCircuitBreakerEvent(
  breakerName: string,
  event: string,
  data: Record<string, unknown> = {}
): void {
  const telemetry = getTelemetryBuffer();
  telemetry.recordEvent({
    eventType: 'circuit_breaker',
    component: `circuit-breaker-${breakerName}`,
    data: { event, ...data },
  });
}

/**
 * 记录回退事件
 */
export function recordFallbackEvent(
  reason: string,
  data: Record<string, unknown> = {}
): void {
  const telemetry = getTelemetryBuffer();
  telemetry.recordEvent({
    eventType: 'fallback',
    component: 'fallback-adapter',
    data: { reason, ...data },
  });
}

/**
 * 记录延迟事件
 */
export function recordLatencyEvent(
  operation: string,
  latencyMs: number,
  data: Record<string, unknown> = {}
): void {
  const telemetry = getTelemetryBuffer();
  telemetry.recordEvent({
    eventType: 'latency',
    component: 'performance',
    data: { operation, latencyMs, ...data },
  });
  
  // 同时记录到指标收集器
  const metrics = getMetricsCollector();
  metrics.recordLatency(latencyMs);
}

/**
 * 记录会话事件
 */
export function recordSessionEvent(
  event: string,
  connId: string,
  data: Record<string, unknown> = {}
): void {
  const telemetry = getTelemetryBuffer();
  telemetry.recordEvent({
    eventType: 'session',
    component: 'openclaw-bridge',
    data: { event, connId, ...data },
  });
}

// ============================================================================
// HTTP 处理器
// ============================================================================

/**
 * 创建遥测端点处理器
 */
export function createTelemetryHandler() {
  return async (req: Request, res: Response) => {
    const telemetry = getTelemetryBuffer();
    const snapshot = await telemetry.generateSnapshot();
    res.json(snapshot);
  };
}

/**
 * 创建事件列表端点处理器
 */
export function createEventsHandler() {
  return (req: Request, res: Response) => {
    const telemetry = getTelemetryBuffer();
    const { type, limit = '100' } = req.query;
    
    let events: TelemetryEvent[];
    if (type && typeof type === 'string') {
      events = telemetry.getEventsByType(type as TelemetryEvent['eventType']);
    } else {
      events = telemetry.getRecentEvents(parseInt(limit as string, 10));
    }
    
    res.json({
      count: events.length,
      events,
    });
  };
}

/**
 * 创建遥测摘要端点处理器
 */
export function createTelemetrySummaryHandler() {
  return (req: Request, res: Response) => {
    const telemetry = getTelemetryBuffer();
    res.json(telemetry.getSummary());
  };
}