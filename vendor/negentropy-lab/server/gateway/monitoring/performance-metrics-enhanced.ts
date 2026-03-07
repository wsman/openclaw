/**
 * 🚀 性能指标增强服务
 * 
 * 宪法依据:
 * - §101 同步公理: 性能数据实时同步
 * - §102 熵减原则: 指标收集优化
 * - §504 监控系统公理: 系统性能监控
 * 
 * 功能:
 * 1. 细粒度响应时间分布
 * 2. 资源使用率追踪
 * 3. 错误率热力图
 * 4. 自定义指标收集
 * 
 * @version 1.0.0
 * @created 2026-03-01
 * @maintainer 科技部
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { randomUUID } from 'crypto';

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 指标类型
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

/**
 * 指标值
 */
export interface MetricValue {
  /** 指标名称 */
  name: string;
  /** 指标类型 */
  type: MetricType;
  /** 当前值 */
  value: number;
  /** 时间戳 */
  timestamp: number;
  /** 标签 */
  labels: Record<string, string>;
  /** 描述 */
  description?: string;
}

/**
 * 直方图桶
 */
export interface HistogramBucket {
  /** 上边界 */
  upperBound: number;
  /** 计数 */
  count: number;
}

/**
 * 直方图数据
 */
export interface HistogramData {
  /** 桶列表 */
  buckets: HistogramBucket[];
  /** 总和 */
  sum: number;
  /** 计数 */
  count: number;
  /** 平均值 */
  avg: number;
  /** 中位数 */
  median: number;
  /** P95 */
  p95: number;
  /** P99 */
  p99: number;
}

/**
 * 响应时间分布
 */
export interface ResponseTimeDistribution {
  /** 时间范围 */
  timeRange: {
    start: number;
    end: number;
  };
  /** 分布桶 */
  distribution: Array<{
    range: string;
    count: number;
    percentage: number;
  }>;
  /** 统计数据 */
  stats: {
    min: number;
    max: number;
    avg: number;
    median: number;
    p95: number;
    p99: number;
  };
}

/**
 * 资源使用率
 */
export interface ResourceUsage {
  /** CPU使用率 (%) */
  cpuPercent: number;
  /** 内存使用率 (%) */
  memoryPercent: number;
  /** 堆内存使用 (bytes) */
  heapUsed: number;
  /** 堆内存总量 (bytes) */
  heapTotal: number;
  /** 外部内存 (bytes) */
  external: number;
  /** 事件循环延迟 (ms) */
  eventLoopDelayMs: number;
  /** 活跃句柄数 */
  activeHandles: number;
  /** 活跃请求书 */
  activeRequests: number;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 错误率数据点
 */
export interface ErrorRateDataPoint {
  /** 时间戳 */
  timestamp: number;
  /** 错误率 */
  errorRate: number;
  /** 错误类型分布 */
  errorTypes: Record<string, number>;
  /** 总请求数 */
  totalRequests: number;
  /** 错误请求数 */
  errorRequests: number;
}

/**
 * 错误率热力图
 */
export interface ErrorRateHeatmap {
  /** 时间范围 */
  timeRange: {
    start: number;
    end: number;
  };
  /** 数据点列表 */
  dataPoints: ErrorRateDataPoint[];
  /** 热力级别 */
  heatLevels: Array<{
    range: string;
    color: string;
    count: number;
  }>;
}

/**
 * 性能配置
 */
export interface PerformanceConfig {
  /** 直方图桶边界 */
  histogramBuckets: number[];
  /** 数据保留时间 (ms) */
  retentionTimeMs: number;
  /** 采样间隔 (ms) */
  sampleIntervalMs: number;
  /** 热力图时间窗口 (ms) */
  heatmapWindowMs: number;
}

// =============================================================================
// 性能指标增强服务
// =============================================================================

/**
 * 性能指标增强服务类
 */
export class PerformanceMetricsEnhanced extends EventEmitter {
  private config: PerformanceConfig;
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private responseTimes: number[] = [];
  private errorRates: ErrorRateDataPoint[] = [];
  private resourceUsageHistory: ResourceUsage[] = [];
  private customMetrics: Map<string, MetricValue> = new Map();
  private sampleTimer?: NodeJS.Timeout;
  private metrics = {
    totalRequests: 0,
    totalErrors: 0,
    avgResponseTimeMs: 0,
    currentErrorRate: 0,
    peakMemoryMB: 0,
    avgCpuPercent: 0,
  };

  constructor(config: Partial<PerformanceConfig> = {}) {
    super();
    this.config = {
      histogramBuckets: config.histogramBuckets ?? [
        1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000,
      ],
      retentionTimeMs: config.retentionTimeMs ?? 3600000, // 1小时
      sampleIntervalMs: config.sampleIntervalMs ?? 10000, // 10秒
      heatmapWindowMs: config.heatmapWindowMs ?? 300000, // 5分钟
      ...config,
    };

    this.startSampling();

    logger.info('[PerformanceMetricsEnhanced] 性能指标增强服务已初始化', {
      config: this.config,
    });
  }

  // =============================================================================
  // 计数器操作
  // =============================================================================

  /**
   * 增加计数器
   */
  public incrementCounter(name: string, value: number = 1, labels: Record<string, string> = {}): void {
    const key = this.buildKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);

    this.emit('metric.counter', {
      name,
      type: 'counter',
      value: current + value,
      timestamp: Date.now(),
      labels,
    });
  }

  /**
   * 获取计数器值
   */
  public getCounter(name: string, labels: Record<string, string> = {}): number {
    const key = this.buildKey(name, labels);
    return this.counters.get(key) || 0;
  }

  // =============================================================================
  // 仪表盘操作
  // =============================================================================

  /**
   * 设置仪表盘值
   */
  public setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.buildKey(name, labels);
    this.gauges.set(key, value);

    this.emit('metric.gauge', {
      name,
      type: 'gauge',
      value,
      timestamp: Date.now(),
      labels,
    });
  }

  /**
   * 获取仪表盘值
   */
  public getGauge(name: string, labels: Record<string, string> = {}): number {
    const key = this.buildKey(name, labels);
    return this.gauges.get(key) || 0;
  }

  // =============================================================================
  // 直方图操作
  // =============================================================================

  /**
   * 记录直方图值
   */
  public observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.buildKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);

    // 限制历史大小
    if (values.length > 10000) {
      values.shift();
    }

    this.histograms.set(key, values);

    this.emit('metric.histogram', {
      name,
      type: 'histogram',
      value,
      timestamp: Date.now(),
      labels,
    });
  }

  /**
   * 获取直方图数据
   */
  public getHistogram(name: string, labels: Record<string, string> = {}): HistogramData | null {
    const key = this.buildKey(name, labels);
    const values = this.histograms.get(key);

    if (!values || values.length === 0) {
      return null;
    }

    return this.calculateHistogramData(values);
  }

  /**
   * 计算直方图数据
   */
  private calculateHistogramData(values: number[]): HistogramData {
    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);

    // 计算桶
    const buckets: HistogramBucket[] = this.config.histogramBuckets.map((bound) => ({
      upperBound: bound,
      count: sorted.filter((v) => v <= bound).length,
    }));

    // 计算百分位数
    const percentile = (p: number): number => {
      const idx = Math.floor((p / 100) * count);
      return sorted[Math.min(idx, count - 1)];
    };

    return {
      buckets,
      sum,
      count,
      avg: sum / count,
      median: percentile(50),
      p95: percentile(95),
      p99: percentile(99),
    };
  }

  // =============================================================================
  // 响应时间分布
  // =============================================================================

  /**
   * 记录响应时间
   */
  public recordResponseTime(durationMs: number): void {
    this.responseTimes.push(durationMs);

    // 限制历史大小
    if (this.responseTimes.length > 100000) {
      this.responseTimes.shift();
    }

    // 更新平均响应时间
    this.metrics.totalRequests++;
    this.metrics.avgResponseTimeMs =
      (this.metrics.avgResponseTimeMs * (this.metrics.totalRequests - 1) + durationMs) /
      this.metrics.totalRequests;

    // 记录到直方图
    this.observeHistogram('response_time_ms', durationMs);
  }

  /**
   * 获取响应时间分布
   */
  public getResponseTimeDistribution(timeRangeMs: number = 60000): ResponseTimeDistribution {
    const now = Date.now();
    const start = now - timeRangeMs;

    // 过滤时间范围内的数据
    const recentTimes = this.responseTimes.slice(-10000); // 取最近的数据

    if (recentTimes.length === 0) {
      return {
        timeRange: { start, end: now },
        distribution: [],
        stats: { min: 0, max: 0, avg: 0, median: 0, p95: 0, p99: 0 },
      };
    }

    const sorted = [...recentTimes].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);

    // 创建分布桶
    const ranges = [
      { range: '0-10ms', min: 0, max: 10 },
      { range: '10-50ms', min: 10, max: 50 },
      { range: '50-100ms', min: 50, max: 100 },
      { range: '100-500ms', min: 100, max: 500 },
      { range: '500ms-1s', min: 500, max: 1000 },
      { range: '1s-5s', min: 1000, max: 5000 },
      { range: '>5s', min: 5000, max: Infinity },
    ];

    const distribution = ranges.map((r) => {
      const rangeCount = sorted.filter((v) => v >= r.min && v < r.max).length;
      return {
        range: r.range,
        count: rangeCount,
        percentage: (rangeCount / count) * 100,
      };
    });

    // 计算统计值
    const percentile = (p: number): number => {
      const idx = Math.floor((p / 100) * count);
      return sorted[Math.min(idx, count - 1)];
    };

    return {
      timeRange: { start, end: now },
      distribution,
      stats: {
        min: sorted[0],
        max: sorted[count - 1],
        avg: sum / count,
        median: percentile(50),
        p95: percentile(95),
        p99: percentile(99),
      },
    };
  }

  // =============================================================================
  // 资源使用率追踪
  // =============================================================================

  /**
   * 获取当前资源使用率
   */
  public getCurrentResourceUsage(): ResourceUsage {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const usage: ResourceUsage = {
      cpuPercent: (cpuUsage.user + cpuUsage.system) / 1000, // 转换为毫秒
      memoryPercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      eventLoopDelayMs: 0, // 需要专门的监控
      activeHandles: (process as any)._getActiveHandles?.()?.length || 0,
      activeRequests: (process as any)._getActiveRequests?.()?.length || 0,
      timestamp: Date.now(),
    };

    // 更新峰值内存
    const memMB = memUsage.heapUsed / (1024 * 1024);
    if (memMB > this.metrics.peakMemoryMB) {
      this.metrics.peakMemoryMB = memMB;
    }

    return usage;
  }

  /**
   * 记录资源使用率
   */
  public recordResourceUsage(): void {
    const usage = this.getCurrentResourceUsage();
    this.resourceUsageHistory.push(usage);

    // 限制历史大小
    if (this.resourceUsageHistory.length > 1000) {
      this.resourceUsageHistory.shift();
    }

    // 更新平均CPU
    this.metrics.avgCpuPercent =
      (this.metrics.avgCpuPercent * 0.9 + usage.cpuPercent * 0.1);
  }

  /**
   * 获取资源使用率历史
   */
  public getResourceUsageHistory(limit: number = 100): ResourceUsage[] {
    return this.resourceUsageHistory.slice(-limit);
  }

  // =============================================================================
  // 错误率热力图
  // =============================================================================

  /**
   * 记录错误
   */
  public recordError(errorType: string, labels: Record<string, string> = {}): void {
    this.metrics.totalErrors++;
    this.incrementCounter('errors_total', 1, { error_type: errorType, ...labels });

    // 更新当前错误率
    if (this.metrics.totalRequests > 0) {
      this.metrics.currentErrorRate =
        this.metrics.totalErrors / this.metrics.totalRequests;
    }
  }

  /**
   * 记录错误率数据点
   */
  public recordErrorRateDataPoint(): void {
    const now = Date.now();

    const dataPoint: ErrorRateDataPoint = {
      timestamp: now,
      errorRate: this.metrics.currentErrorRate,
      errorTypes: {},
      totalRequests: this.metrics.totalRequests,
      errorRequests: this.metrics.totalErrors,
    };

    // 收集错误类型分布
    for (const [key, value] of this.counters.entries()) {
      if (key.startsWith('errors_total:')) {
        const errorType = key.split(':')[1] || 'unknown';
        dataPoint.errorTypes[errorType] = value;
      }
    }

    this.errorRates.push(dataPoint);

    // 限制历史大小
    if (this.errorRates.length > 1000) {
      this.errorRates.shift();
    }
  }

  /**
   * 获取错误率热力图
   */
  public getErrorRateHeatmap(timeRangeMs: number = 300000): ErrorRateHeatmap {
    const now = Date.now();
    const start = now - timeRangeMs;

    // 过滤时间范围内的数据
    const dataPoints = this.errorRates.filter(
      (dp) => dp.timestamp >= start && dp.timestamp <= now
    );

    // 计算热力级别
    const heatLevels = [
      { range: '0-1%', color: 'green', count: 0 },
      { range: '1-5%', color: 'yellow', count: 0 },
      { range: '5-10%', color: 'orange', count: 0 },
      { range: '>10%', color: 'red', count: 0 },
    ];

    for (const dp of dataPoints) {
      const rate = dp.errorRate * 100;
      if (rate < 1) heatLevels[0].count++;
      else if (rate < 5) heatLevels[1].count++;
      else if (rate < 10) heatLevels[2].count++;
      else heatLevels[3].count++;
    }

    return {
      timeRange: { start, end: now },
      dataPoints,
      heatLevels,
    };
  }

  // =============================================================================
  // 自定义指标
  // =============================================================================

  /**
   * 注册自定义指标
   */
  public registerMetric(metric: Omit<MetricValue, 'timestamp'>): void {
    const fullMetric: MetricValue = {
      ...metric,
      timestamp: Date.now(),
    };

    const key = this.buildKey(metric.name, metric.labels);
    this.customMetrics.set(key, fullMetric);

    this.emit('metric.registered', fullMetric);
  }

  /**
   * 更新自定义指标
   */
  public updateMetric(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.buildKey(name, labels);
    const existing = this.customMetrics.get(key);

    if (existing) {
      existing.value = value;
      existing.timestamp = Date.now();
      this.emit('metric.updated', existing);
    } else {
      this.registerMetric({ name, type: 'gauge', value, labels });
    }
  }

  /**
   * 获取所有自定义指标
   */
  public getCustomMetrics(): MetricValue[] {
    return Array.from(this.customMetrics.values());
  }

  // =============================================================================
  // 采样与清理
  // =============================================================================

  /**
   * 启动定期采样
   */
  private startSampling(): void {
    this.sampleTimer = setInterval(() => {
      this.recordResourceUsage();
      this.recordErrorRateDataPoint();
      this.cleanupOldData();
    }, this.config.sampleIntervalMs);
  }

  /**
   * 清理过期数据
   */
  private cleanupOldData(): void {
    const cutoff = Date.now() - this.config.retentionTimeMs;

    // 清理响应时间数据
    if (this.responseTimes.length > 50000) {
      this.responseTimes = this.responseTimes.slice(-30000);
    }

    // 清理错误率数据
    this.errorRates = this.errorRates.filter((dp) => dp.timestamp >= cutoff);

    // 清理资源使用率历史
    this.resourceUsageHistory = this.resourceUsageHistory.filter(
      (ru) => ru.timestamp >= cutoff
    );
  }

  // =============================================================================
  // 工具方法
  // =============================================================================

  /**
   * 构建指标键
   */
  private buildKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    return labelStr ? `${name}{${labelStr}}` : name;
  }

  // =============================================================================
  // 指标与诊断
  // =============================================================================

  /**
   * 获取服务指标
   */
  public getMetrics() {
    return {
      ...this.metrics,
      activeCounters: this.counters.size,
      activeGauges: this.gauges.size,
      activeHistograms: this.histograms.size,
      customMetricsCount: this.customMetrics.size,
      responseTimeCount: this.responseTimes.length,
      errorRateCount: this.errorRates.length,
    };
  }

  /**
   * 获取完整性能报告
   */
  public getPerformanceReport(): any {
    return {
      timestamp: Date.now(),
      metrics: this.getMetrics(),
      responseTime: this.getResponseTimeDistribution(),
      resourceUsage: this.getCurrentResourceUsage(),
      errorRate: this.getErrorRateHeatmap(),
      topErrors: this.getTopErrors(5),
    };
  }

  /**
   * 获取错误Top N
   */
  private getTopErrors(limit: number): Array<{ type: string; count: number }> {
    const errorCounts: Array<{ type: string; count: number }> = [];

    for (const [key, value] of this.counters.entries()) {
      if (key.startsWith('errors_total')) {
        const match = key.match(/error_type="([^"]+)"/);
        const errorType = match ? match[1] : 'unknown';
        errorCounts.push({ type: errorType, count: value });
      }
    }

    return errorCounts.sort((a, b) => b.count - a.count).slice(0, limit);
  }

  /**
   * 获取诊断信息
   */
  public getDiagnostics() {
    return {
      config: this.config,
      metrics: this.getMetrics(),
      recentResourceUsage: this.getResourceUsageHistory(10),
    };
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    if (this.sampleTimer) {
      clearInterval(this.sampleTimer);
    }

    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.responseTimes = [];
    this.errorRates = [];
    this.resourceUsageHistory = [];
    this.customMetrics.clear();
    this.removeAllListeners();

    logger.info('[PerformanceMetricsEnhanced] 性能指标增强服务已清理');
  }
}

// =============================================================================
// 导出
// =============================================================================

export default PerformanceMetricsEnhanced;