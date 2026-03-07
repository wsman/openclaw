/**
 * 🚀 OpenClaw 决策模块 - 健康检查端点
 *
 * @constitution
 * §101 同步公理：健康检查端点需与合同同步
 * §102 熵减原则：统一健康检查管理
 * §504 监控系统公理：实时监控合规状态
 *
 * @filename health.ts
 * @version 1.0.0
 * @category gateway/openclaw-decision/observability
 * @last_updated 2026-03-03
 */

import { Request, Response } from 'express';
import { getDecisionController } from '../controller';
import { getCircuitBreakerManager } from '../resilience/circuit-breaker';
import { getFallbackAdapter } from '../resilience/fallback-adapter';
import { getOpenClawBridge } from '../bridge/openclaw-bridge';

// ============================================================================
// 类型定义
// ============================================================================

export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  components: {
    decision: ComponentHealth;
    circuitBreakers: ComponentHealth;
    fallback: ComponentHealth;
    bridge: ComponentHealth;
  };
}

export interface ComponentHealth {
  status: 'ok' | 'degraded' | 'error';
  message?: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// 健康检查器
// ============================================================================

class HealthChecker {
  private startTime = Date.now();

  async check(): Promise<HealthCheckResult> {
    const components = {
      decision: await this.checkDecision(),
      circuitBreakers: this.checkCircuitBreakers(),
      fallback: this.checkFallback(),
      bridge: this.checkBridge(),
    };

    // 计算整体状态
    const status = this.calculateOverallStatus(components);

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      components,
    };
  }

  private async checkDecision(): Promise<ComponentHealth> {
    try {
      const controller = getDecisionController();
      const healthResult = await controller.healthCheck();
      return {
        status: healthResult.status === 'healthy' ? 'ok' : 'degraded',
        message: healthResult.status === 'healthy' ? 'healthy' : 'unhealthy',
        details: {
          mode: healthResult.mode,
          timestamp: healthResult.timestamp,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private checkCircuitBreakers(): ComponentHealth {
    try {
      const manager = getCircuitBreakerManager();
      const stats = manager.getAllStats();
      const openCount = Object.values(stats).filter(
        (s: any) => s.state === 'OPEN'
      ).length;

      if (openCount > 0) {
        return {
          status: 'degraded',
          message: `${openCount} circuit breaker(s) open`,
          details: { stats },
        };
      }
      return { status: 'ok', details: { stats } };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private checkFallback(): ComponentHealth {
    try {
      const adapter = getFallbackAdapter();
      const stats = adapter.getStats();
      
      if (stats.fallbackCount > 10) {
        return {
          status: 'degraded',
          message: 'High fallback trigger count',
          details: { stats },
        };
      }
      return { status: 'ok', details: { stats } };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private checkBridge(): ComponentHealth {
    try {
      const bridge = getOpenClawBridge();
      const sessions = bridge.getAllSessions();
      const activeCount = sessions.filter(s => s.authenticated).length;

      return {
        status: 'ok',
        details: {
          totalSessions: sessions.length,
          activeSessions: activeCount,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private calculateOverallStatus(
    components: HealthCheckResult['components']
  ): 'ok' | 'degraded' | 'error' {
    const statuses = Object.values(components).map(c => c.status);
    
    if (statuses.includes('error')) return 'error';
    if (statuses.includes('degraded')) return 'degraded';
    return 'ok';
  }
}

// ============================================================================
// 单例导出
// ============================================================================

let healthCheckerInstance: HealthChecker | null = null;

export function getHealthChecker(): HealthChecker {
  if (!healthCheckerInstance) {
    healthCheckerInstance = new HealthChecker();
  }
  return healthCheckerInstance;
}

export function resetHealthChecker(): void {
  healthCheckerInstance = null;
}

// ============================================================================
// HTTP 处理器
// ============================================================================

/**
 * 创建健康检查端点处理器
 */
export function createHealthCheckHandler() {
  return async (req: Request, res: Response) => {
    const checker = getHealthChecker();
    const result = await checker.check();
    
    // 根据状态设置 HTTP 状态码
    const statusCode = result.status === 'ok' ? 200 :
                       result.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(result);
  };
}

/**
 * 创建存活检查端点处理器
 */
export function createLivenessHandler() {
  return (req: Request, res: Response) => {
    res.status(200).json({ alive: true });
  };
}

/**
 * 创建就绪检查端点处理器
 */
export function createReadinessHandler() {
  return async (req: Request, res: Response) => {
    const checker = getHealthChecker();
    const result = await checker.check();
    
    if (result.status === 'error') {
      res.status(503).json({ ready: false, reason: 'Health check failed' });
    } else {
      res.status(200).json({ ready: true });
    }
  };
}
