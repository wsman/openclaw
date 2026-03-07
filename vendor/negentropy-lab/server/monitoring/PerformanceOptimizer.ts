/**
 * 🔧 性能优化器
 * 
 * 宪法依据：
 * - §111 资源管理公理：性能优化
 * - §113 资源优化：持续改进
 * 
 * 性能目标：
 * - CPU使用率 < 5% (空闲)
 * - 内存占用 < 100MB (稳定)
 * - 启动时间 < 3秒
 */

import { ResourceMonitor, ResourceUsage, ResourceMonitorEvent } from './ResourceMonitor';

/**
 * 性能优化建议
 */
export interface PerformanceOptimization {
  type: 'cpu' | 'memory' | 'startup' | 'network';
  priority: 'high' | 'medium' | 'low';
  description: string;
  impact: string;
  action: string;
}

/**
 * 性能基准
 */
export interface PerformanceBaseline {
  cpuIdle: number;
  memoryUsage: number;
  startupTime: number;
  eventLoopLag: number;
}

/**
 * 性能优化器配置
 */
export interface PerformanceOptimizerConfig {
  /**
   * 目标CPU使用率（空闲时）
   */
  targetCpuIdle: number;

  /**
   * 目标内存使用（MB）
   */
  targetMemoryUsage: number;

  /**
   * 目标启动时间（秒）
   */
  targetStartupTime: number;

  /**
   * 事件循环延迟阈值（毫秒）
   */
  eventLoopLagThreshold: number;

  /**
   * 是否自动优化
   */
  autoOptimize: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_OPTIMIZER_CONFIG: PerformanceOptimizerConfig = {
  targetCpuIdle: 5,
  targetMemoryUsage: 100,
  targetStartupTime: 3,
  eventLoopLagThreshold: 100,
  autoOptimize: false,
};

/**
 * 性能优化器类
 */
export class PerformanceOptimizer {
  private config: PerformanceOptimizerConfig;
  private monitor: ResourceMonitor;
  private baseline: PerformanceBaseline | null = null;
  private optimizations: PerformanceOptimization[] = [];

  constructor(
    config: Partial<PerformanceOptimizerConfig> = {},
    monitor?: ResourceMonitor
  ) {
    this.config = { ...DEFAULT_OPTIMIZER_CONFIG, ...config };
    this.monitor = monitor || new ResourceMonitor();

    // 设置监控监听器
    this.monitor.addEventListener(this.handleResourceEvent.bind(this));
  }

  /**
   * 启动性能监控和优化
   */
  start(): void {
    this.monitor.start();
    console.log('[PerformanceOptimizer] Started');
  }

  /**
   * 停止性能监控
   */
  stop(): void {
    this.monitor.stop();
    console.log('[PerformanceOptimizer] Stopped');
  }

  /**
   * 建立性能基准
   */
  async establishBaseline(): Promise<PerformanceBaseline> {
    console.log('[PerformanceOptimizer] Establishing performance baseline...');

    // 收集30秒数据
    const samples: ResourceUsage[] = [];
    const sampleInterval = setInterval(() => {
      samples.push(this.monitor.getCurrentUsage());
    }, 1000);

    await new Promise((resolve) => setTimeout(resolve, 30000));
    clearInterval(sampleInterval);

    // 计算平均值
    const avgCpu = samples.reduce((sum, s) => sum + s.cpu.usage, 0) / samples.length;
    const avgMemory = samples.reduce((sum, s) => sum + s.memory.heapUsed, 0) / samples.length;

    this.baseline = {
      cpuIdle: 100 - avgCpu,
      memoryUsage: avgMemory / 1024 / 1024, // 转换为MB
      startupTime: process.uptime(),
      eventLoopLag: await this.measureEventLoopLag(),
    };

    console.log('[PerformanceOptimizer] Baseline established:', this.baseline);
    return this.baseline;
  }

  /**
   * 分析性能问题
   */
  analyze(): PerformanceOptimization[] {
    const currentUsage = this.monitor.getCurrentUsage();
    this.optimizations = [];

    // CPU分析
    if (currentUsage.cpu.usage > this.config.targetCpuIdle * 2) {
      this.optimizations.push({
        type: 'cpu',
        priority: 'high',
        description: 'CPU usage is high during idle state',
        impact: `Current: ${currentUsage.cpu.usage.toFixed(1)}%, Target: <${this.config.targetCpuIdle}%`,
        action: 'Review event loop, timers, and background tasks',
      });
    }

    // 内存分析
    const memoryMB = currentUsage.memory.heapUsed / 1024 / 1024;
    if (memoryMB > this.config.targetMemoryUsage) {
      this.optimizations.push({
        type: 'memory',
        priority: 'high',
        description: 'Memory usage exceeds target',
        impact: `Current: ${memoryMB.toFixed(1)}MB, Target: <${this.config.targetMemoryUsage}MB`,
        action: 'Check for memory leaks, optimize data structures',
      });
    }

    // 启动时间分析
    const uptime = process.uptime();
    if (uptime < 10 && uptime > this.config.targetStartupTime) {
      this.optimizations.push({
        type: 'startup',
        priority: 'medium',
        description: 'Startup time is slow',
        impact: `Current: ${uptime.toFixed(1)}s, Target: <${this.config.targetStartupTime}s`,
        action: 'Implement lazy loading, parallel initialization',
      });
    }

    return this.optimizations;
  }

  /**
   * 获取优化建议报告
   */
  getOptimizationReport(): string {
    const report = [
      '# Performance Optimization Report',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      '## Current Status',
      '',
    ];

    if (this.baseline) {
      report.push(`- Baseline CPU Idle: ${this.baseline.cpuIdle.toFixed(1)}%`);
      report.push(`- Baseline Memory: ${this.baseline.memoryUsage.toFixed(1)}MB`);
      report.push(`- Baseline Startup: ${this.baseline.startupTime.toFixed(1)}s`);
      report.push('');
    }

    if (this.optimizations.length > 0) {
      report.push('## Optimization Recommendations');
      report.push('');

      this.optimizations.forEach((opt, index) => {
        report.push(`### ${index + 1}. ${opt.description}`);
        report.push(`- **Type**: ${opt.type}`);
        report.push(`- **Priority**: ${opt.priority}`);
        report.push(`- **Impact**: ${opt.impact}`);
        report.push(`- **Action**: ${opt.action}`);
        report.push('');
      });
    } else {
      report.push('✅ No performance issues detected.');
    }

    return report.join('\n');
  }

  /**
   * 测量事件循环延迟
   */
  private async measureEventLoopLag(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const end = process.hrtime.bigint();
        const lagMs = Number(end - start) / 1_000_000;
        resolve(lagMs);
      });
    });
  }

  /**
   * 处理资源监控事件
   */
  private handleResourceEvent(event: ResourceMonitorEvent): void {
    if (event.type === 'alert') {
      console.warn(`[PerformanceOptimizer] Resource alert: ${event.message}`);

      if (this.config.autoOptimize) {
        this.applyAutoOptimization(event);
      }
    }
  }

  /**
   * 应用自动优化
   */
  private applyAutoOptimization(event: ResourceMonitorEvent): void {
    switch (event.resource) {
      case 'memory':
        // 触发垃圾回收（如果可用）
        if (global.gc) {
          global.gc();
          console.log('[PerformanceOptimizer] Triggered garbage collection');
        }
        break;

      case 'cpu':
        // 降低监控频率
        console.log('[PerformanceOptimizer] Consider reducing monitoring frequency');
        break;

      default:
        break;
    }
  }

  /**
   * 获取当前性能指标
   */
  getCurrentMetrics(): {
    cpu: number;
    memory: number;
    eventLoopLag: number;
  } {
    const usage = this.monitor.getCurrentUsage();
    
    return {
      cpu: usage.cpu.usage,
      memory: usage.memory.heapUsed / 1024 / 1024,
      eventLoopLag: 0, // 需要异步测量
    };
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.monitor.cleanup();
    this.optimizations = [];
  }
}

export default PerformanceOptimizer;
