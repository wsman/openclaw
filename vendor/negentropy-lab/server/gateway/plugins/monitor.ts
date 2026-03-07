/**
 * 插件性能监控器（轻量实现）
 *
 * @constitution
 * §101 同步公理：监控接口与PluginManager调用点保持同步
 * §110 协作效率公理：监控采集不阻塞插件主流程
 * §306 零停机协议：监控生命周期独立于插件生命周期
 */

interface PluginMetricSnapshot {
  startedAt: number;
  lastUpdatedAt: number;
  eventCount: number;
}

export class PerformanceMonitor {
  private snapshots = new Map<string, PluginMetricSnapshot>();

  async initialize(): Promise<void> {
    // 轻量实现：保留异步接口，便于后续替换真实监控实现
  }

  async startMonitoring(pluginId: string): Promise<void> {
    const now = Date.now();
    this.snapshots.set(pluginId, {
      startedAt: now,
      lastUpdatedAt: now,
      eventCount: 0,
    });
  }

  async stopMonitoring(pluginId: string): Promise<void> {
    this.snapshots.delete(pluginId);
  }

  async getPluginMetrics(pluginId: string): Promise<Record<string, number>> {
    const snapshot = this.snapshots.get(pluginId);
    if (!snapshot) {
      return {};
    }

    const now = Date.now();
    const uptimeMs = Math.max(0, now - snapshot.startedAt);
    snapshot.lastUpdatedAt = now;
    snapshot.eventCount += 1;

    return {
      uptimeMs,
      monitorEvents: snapshot.eventCount,
      monitorLastUpdatedAt: snapshot.lastUpdatedAt,
    };
  }

  async destroy(): Promise<void> {
    this.snapshots.clear();
  }
}

export default PerformanceMonitor;
