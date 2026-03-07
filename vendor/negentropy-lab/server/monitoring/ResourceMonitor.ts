/**
 * 🔧 系统资源监控器
 * 
 * 宪法依据：
 * - §111 资源管理公理：实时资源监控
 * - §112 资源预警：异常检测和告警
 * - §113 资源优化：性能基准
 * 
 * 性能目标：
 * - CPU监控精度 < 1%
 * - 内存监控精度 < 1MB
 * - 监控延迟 < 100ms
 */

import os from 'os';

/**
 * 资源使用统计
 */
export interface ResourceUsage {
  cpu: {
    usage: number; // 百分比
    user: number;
    system: number;
    idle: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  network?: {
    bytesReceived: number;
    bytesSent: number;
    connections: number;
  };
  disk?: {
    readBytes: number;
    writeBytes: number;
  };
  process: {
    uptime: number;
    pid: number;
    threadCount: number;
    handleCount: number;
  };
  timestamp: number;
}

/**
 * 资源监控配置
 */
export interface ResourceMonitorConfig {
  /**
   * 监控间隔（毫秒）
   */
  interval: number;

  /**
   * CPU告警阈值（百分比）
   */
  cpuThreshold: number;

  /**
   * 内存告警阈值（百分比）
   */
  memoryThreshold: number;

  /**
   * 是否启用网络监控
   */
  enableNetworkMonitor: boolean;

  /**
   * 是否启用磁盘监控
   */
  enableDiskMonitor: boolean;

  /**
   * 历史记录保留时长（秒）
   */
  historyRetention: number;
}

/**
 * 默认监控配置
 */
const DEFAULT_MONITOR_CONFIG: ResourceMonitorConfig = {
  interval: 1000, // 1秒
  cpuThreshold: 80, // 80%
  memoryThreshold: 85, // 85%
  enableNetworkMonitor: true,
  enableDiskMonitor: false,
  historyRetention: 3600, // 1小时
};

/**
 * 资源监控事件
 */
export interface ResourceMonitorEvent {
  type: 'alert' | 'warning' | 'info';
  resource: 'cpu' | 'memory' | 'network' | 'disk';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

/**
 * 资源监控事件监听器
 */
export type ResourceMonitorListener = (event: ResourceMonitorEvent) => void;

/**
 * 资源监控器类
 */
export class ResourceMonitor {
  private config: ResourceMonitorConfig;
  private monitorTimer: NodeJS.Timeout | null = null;
  private eventListeners: ResourceMonitorListener[] = [];
  private history: ResourceUsage[] = [];
  private lastCpuInfo = process.cpuUsage();
  private lastCheckTime = Date.now();

  constructor(config: Partial<ResourceMonitorConfig> = {}) {
    this.config = { ...DEFAULT_MONITOR_CONFIG, ...config };
  }

  /**
   * 启动监控
   */
  start(): void {
    if (this.monitorTimer) {
      console.warn('[ResourceMonitor] Monitor already running');
      return;
    }

    this.monitorTimer = setInterval(() => {
      this.collectAndCheck();
    }, this.config.interval);

    console.log(`[ResourceMonitor] Started monitoring with ${this.config.interval}ms interval`);
  }

  /**
   * 停止监控
   */
  stop(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
      console.log('[ResourceMonitor] Stopped monitoring');
    }
  }

  /**
   * 获取当前资源使用情况
   */
  getCurrentUsage(): ResourceUsage {
    const timestamp = Date.now();

    // CPU使用率
    const cpuUsage = this.getCPUUsage();

    // 内存使用
    const memoryUsage = this.getMemoryUsage();

    // 进程信息
    const processInfo = this.getProcessInfo();

    const usage: ResourceUsage = {
      cpu: cpuUsage,
      memory: memoryUsage,
      process: processInfo,
      timestamp,
    };

    // 网络监控（可选）
    if (this.config.enableNetworkMonitor) {
      usage.network = this.getNetworkUsage();
    }

    // 磁盘监控（可选）
    if (this.config.enableDiskMonitor) {
      usage.disk = this.getDiskUsage();
    }

    return usage;
  }

  /**
   * 获取历史记录
   */
  getHistory(duration?: number): ResourceUsage[] {
    const now = Date.now();
    const cutoff = duration ? now - duration * 1000 : 0;

    return this.history.filter((entry) => entry.timestamp >= cutoff);
  }

  /**
   * 获取统计摘要
   */
  getSummary(duration: number = 300): {
    cpu: { avg: number; max: number; min: number };
    memory: { avg: number; max: number; min: number };
    alertCount: number;
    warningCount: number;
  } {
    const history = this.getHistory(duration);
    
    if (history.length === 0) {
      return {
        cpu: { avg: 0, max: 0, min: 0 },
        memory: { avg: 0, max: 0, min: 0 },
        alertCount: 0,
        warningCount: 0,
      };
    }

    const cpuValues = history.map((h) => h.cpu.usage);
    const memoryValues = history.map((h) => h.memory.usagePercent);

    return {
      cpu: {
        avg: cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length,
        max: Math.max(...cpuValues),
        min: Math.min(...cpuValues),
      },
      memory: {
        avg: memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length,
        max: Math.max(...memoryValues),
        min: Math.min(...memoryValues),
      },
      alertCount: 0, // 需要从事件历史计算
      warningCount: 0,
    };
  }

  /**
   * 添加事件监听器
   */
  addEventListener(listener: ResourceMonitorListener): void {
    this.eventListeners.push(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(listener: ResourceMonitorListener): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * 收集数据并检查阈值
   */
  private collectAndCheck(): void {
    const usage = this.getCurrentUsage();

    // 添加到历史记录
    this.history.push(usage);

    // 清理过期历史
    this.cleanHistory();

    // 检查CPU阈值
    if (usage.cpu.usage > this.config.cpuThreshold) {
      this.emitEvent({
        type: 'alert',
        resource: 'cpu',
        message: `CPU usage ${usage.cpu.usage.toFixed(1)}% exceeds threshold ${this.config.cpuThreshold}%`,
        value: usage.cpu.usage,
        threshold: this.config.cpuThreshold,
        timestamp: usage.timestamp,
      });
    }

    // 检查内存阈值
    if (usage.memory.usagePercent > this.config.memoryThreshold) {
      this.emitEvent({
        type: 'alert',
        resource: 'memory',
        message: `Memory usage ${usage.memory.usagePercent.toFixed(1)}% exceeds threshold ${this.config.memoryThreshold}%`,
        value: usage.memory.usagePercent,
        threshold: this.config.memoryThreshold,
        timestamp: usage.timestamp,
      });
    }
  }

  /**
   * 获取CPU使用率
   */
  private getCPUUsage(): {
    usage: number;
    user: number;
    system: number;
    idle: number;
  } {
    const currentCpuUsage = process.cpuUsage();
    const now = Date.now();
    const elapsedMs = now - this.lastCheckTime;
    const elapsedMicroseconds = elapsedMs * 1000;

    // 计算差值
    const userDiff = currentCpuUsage.user - this.lastCpuInfo.user;
    const systemDiff = currentCpuUsage.system - this.lastCpuInfo.system;
    const totalDiff = userDiff + systemDiff;

    // 计算百分比
    const usage = elapsedMicroseconds > 0 ? (totalDiff / elapsedMicroseconds) * 100 : 0;

    // 更新上次信息
    this.lastCpuInfo = currentCpuUsage;
    this.lastCheckTime = now;

    return {
      usage: Math.min(usage, 100),
      user: userDiff,
      system: systemDiff,
      idle: Math.max(0, elapsedMicroseconds - totalDiff),
    };
  }

  /**
   * 获取内存使用
   */
  private getMemoryUsage(): {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  } {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    const processMemory = process.memoryUsage();

    return {
      total: totalMemory,
      used: usedMemory,
      free: freeMemory,
      usagePercent: memoryUsagePercent,
      heapUsed: processMemory.heapUsed,
      heapTotal: processMemory.heapTotal,
      external: processMemory.external,
      rss: processMemory.rss,
    };
  }

  /**
   * 获取网络使用（简化版）
   */
  private getNetworkUsage(): {
    bytesReceived: number;
    bytesSent: number;
    connections: number;
  } {
    // 简化实现，实际需要系统特定API
    return {
      bytesReceived: 0,
      bytesSent: 0,
      connections: 0,
    };
  }

  /**
   * 获取磁盘使用（简化版）
   */
  private getDiskUsage(): {
    readBytes: number;
    writeBytes: number;
  } {
    return {
      readBytes: 0,
      writeBytes: 0,
    };
  }

  /**
   * 获取进程信息
   */
  private getProcessInfo(): {
    uptime: number;
    pid: number;
    threadCount: number;
    handleCount: number;
  } {
    return {
      uptime: process.uptime(),
      pid: process.pid,
      threadCount: 1, // Node.js单线程
      handleCount: 0, // 需要平台特定API
    };
  }

  /**
   * 清理过期历史
   */
  private cleanHistory(): void {
    const now = Date.now();
    const cutoff = now - this.config.historyRetention * 1000;
    this.history = this.history.filter((entry) => entry.timestamp >= cutoff);
  }

  /**
   * 发送事件
   */
  private emitEvent(event: ResourceMonitorEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[ResourceMonitor] Event listener error:', error);
      }
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.stop();
    this.history = [];
    this.eventListeners = [];
  }
}

export default ResourceMonitor;
