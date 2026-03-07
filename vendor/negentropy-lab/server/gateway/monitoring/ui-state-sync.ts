/**
 * 🚀 UI状态同步服务
 * 
 * 宪法依据:
 * - §101 同步公理: 状态变更必须实时同步到所有订阅者
 * - §102 熵减原则: 增量更新减少网络传输
 * - §321-§324 实时通信公理: 状态延迟 <100ms
 * 
 * 功能:
 * 1. 双向状态同步（服务端 <-> UI）
 * 2. 增量状态更新
 * 3. 状态订阅管理
 * 4. 实时推送
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
 * 状态变更类型
 */
export type StateChangeType = 'set' | 'delete' | 'patch' | 'reset';

/**
 * 状态变更记录
 */
export interface StateChangeRecord {
  /** 变更ID */
  id: string;
  /** 变更路径 */
  path: string;
  /** 变更类型 */
  type: StateChangeType;
  /** 旧值 */
  oldValue: any;
  /** 新值 */
  newValue: any;
  /** 变更时间戳 */
  timestamp: number;
  /** 变更来源 */
  source: string;
  /** 连接ID */
  connectionId?: string;
}

/**
 * 状态订阅配置
 */
export interface StateSubscription {
  /** 订阅ID */
  subscriptionId: string;
  /** 连接ID */
  connectionId: string;
  /** 订阅路径 */
  path: string;
  /** 是否深度订阅 */
  deep: boolean;
  /** 创建时间 */
  createdAt: number;
  /** 最后推送时间 */
  lastPushAt: number;
  /** 推送计数 */
  pushCount: number;
  /** 过滤器 */
  filter?: (change: StateChangeRecord) => boolean;
}

/**
 * 状态快照
 */
export interface StateSnapshot {
  /** 快照ID */
  snapshotId: string;
  /** 快照时间 */
  timestamp: number;
  /** 状态路径 */
  path: string;
  /** 状态数据 */
  data: any;
  /** 版本号 */
  version: number;
}

/**
 * 同步配置
 */
export interface StateSyncConfig {
  /** 最大订阅数 */
  maxSubscriptions: number;
  /** 推送节流间隔（ms） */
  pushThrottleMs: number;
  /** 快照保留数量 */
  snapshotRetention: number;
  /** 变更历史保留数量 */
  changeHistoryRetention: number;
  /** 状态压缩阈值（字节） */
  compressionThreshold: number;
}

/**
 * 推送事件
 */
export interface StatePushEvent {
  type: 'state.change' | 'state.snapshot' | 'state.sync';
  subscriptionId: string;
  path: string;
  changes: StateChangeRecord[];
  snapshot?: StateSnapshot;
  timestamp: number;
}

// =============================================================================
// UI状态同步服务
// =============================================================================

/**
 * UI状态同步服务类
 * 
 * 实现双向状态同步，目标延迟 <100ms
 */
export class UIStateSyncService extends EventEmitter {
  private config: StateSyncConfig;
  private stateStore: Map<string, any> = new Map();
  private subscriptions: Map<string, StateSubscription> = new Map();
  private connectionSubscriptions: Map<string, Set<string>> = new Map();
  private changeHistory: StateChangeRecord[] = [];
  private snapshots: Map<string, StateSnapshot[]> = new Map();
  private stateVersions: Map<string, number> = new Map();
  private pendingPushes: Map<string, NodeJS.Timeout> = new Map();
  private pendingChanges: Map<string, StateChangeRecord[]> = new Map();
  private metrics = {
    totalChanges: 0,
    totalPushes: 0,
    totalSubscriptions: 0,
    avgPushLatencyMs: 0,
    peakSubscriptions: 0,
  };

  constructor(config: Partial<StateSyncConfig> = {}) {
    super();
    this.config = {
      maxSubscriptions: config.maxSubscriptions ?? 10000,
      pushThrottleMs: config.pushThrottleMs ?? 50, // 50ms节流，确保 <100ms 延迟
      snapshotRetention: config.snapshotRetention ?? 10,
      changeHistoryRetention: config.changeHistoryRetention ?? 1000,
      compressionThreshold: config.compressionThreshold ?? 1024,
      ...config,
    };

    logger.info('[UIStateSync] 状态同步服务已初始化', {
      config: this.config,
      constitutionalBasis: '§101 同步公理, §321-§324 实时通信公理',
    });
  }

  // =============================================================================
  // 状态操作
  // =============================================================================

  /**
   * 获取状态
   */
  public getState(path: string): any {
    return this.stateStore.get(path);
  }

  /**
   * 设置状态
   */
  public setState(
    path: string,
    value: any,
    options: {
      source?: string;
      connectionId?: string;
      silent?: boolean;
    } = {}
  ): StateChangeRecord {
    const oldValue = this.stateStore.get(path);
    const newValue = value;
    const timestamp = Date.now();
    const version = (this.stateVersions.get(path) || 0) + 1;

    // 创建变更记录
    const change: StateChangeRecord = {
      id: `change:${randomUUID()}`,
      path,
      type: 'set',
      oldValue,
      newValue,
      timestamp,
      source: options.source || 'system',
      connectionId: options.connectionId,
    };

    // 更新状态存储
    this.stateStore.set(path, newValue);
    this.stateVersions.set(path, version);

    // 记录变更历史
    this.recordChange(change);

    // 触发变更事件
    if (!options.silent) {
      this.emit('state.change', change);
      this.schedulePush(path, change);
    }

    logger.debug(`[UIStateSync] 状态已更新: ${path}`, {
      version,
      source: change.source,
    });

    return change;
  }

  /**
   * 批量设置状态
   */
  public setStates(
    updates: Array<{ path: string; value: any }>,
    options: {
      source?: string;
      connectionId?: string;
      silent?: boolean;
    } = {}
  ): StateChangeRecord[] {
    const changes: StateChangeRecord[] = [];
    const timestamp = Date.now();

    for (const update of updates) {
      const oldValue = this.stateStore.get(update.path);
      const version = (this.stateVersions.get(update.path) || 0) + 1;

      const change: StateChangeRecord = {
        id: `change:${randomUUID()}`,
        path: update.path,
        type: 'set',
        oldValue,
        newValue: update.value,
        timestamp,
        source: options.source || 'system',
        connectionId: options.connectionId,
      };

      this.stateStore.set(update.path, update.value);
      this.stateVersions.set(update.path, version);
      this.recordChange(change);
      changes.push(change);
    }

    if (!options.silent) {
      this.emit('state.batch.change', changes);
      // 批量推送优化
      this.scheduleBatchPush(changes);
    }

    return changes;
  }

  /**
   * 补丁更新状态
   */
  public patchState(
    path: string,
    patch: Record<string, any>,
    options: {
      source?: string;
      connectionId?: string;
      silent?: boolean;
    } = {}
  ): StateChangeRecord {
    const oldValue = this.stateStore.get(path) || {};
    const newValue = this.deepMerge(oldValue, patch);
    return this.setState(path, newValue, { ...options, source: options.source || 'patch' });
  }

  /**
   * 删除状态
   */
  public deleteState(
    path: string,
    options: {
      source?: string;
      connectionId?: string;
      silent?: boolean;
    } = {}
  ): StateChangeRecord | null {
    if (!this.stateStore.has(path)) {
      return null;
    }

    const oldValue = this.stateStore.get(path);
    const timestamp = Date.now();

    const change: StateChangeRecord = {
      id: `change:${randomUUID()}`,
      path,
      type: 'delete',
      oldValue,
      newValue: undefined,
      timestamp,
      source: options.source || 'system',
      connectionId: options.connectionId,
    };

    this.stateStore.delete(path);
    this.recordChange(change);

    if (!options.silent) {
      this.emit('state.change', change);
      this.schedulePush(path, change);
    }

    return change;
  }

  /**
   * 获取状态快照
   */
  public getSnapshot(path: string): StateSnapshot | null {
    const snapshots = this.snapshots.get(path);
    return snapshots && snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  }

  /**
   * 创建状态快照
   */
  public createSnapshot(path: string): StateSnapshot {
    const data = this.stateStore.get(path);
    const version = this.stateVersions.get(path) || 0;

    const snapshot: StateSnapshot = {
      snapshotId: `snapshot:${randomUUID()}`,
      timestamp: Date.now(),
      path,
      data: this.deepClone(data),
      version,
    };

    // 保留最近的快照
    const pathSnapshots = this.snapshots.get(path) || [];
    pathSnapshots.push(snapshot);
    if (pathSnapshots.length > this.config.snapshotRetention) {
      pathSnapshots.shift();
    }
    this.snapshots.set(path, pathSnapshots);

    return snapshot;
  }

  // =============================================================================
  // 订阅管理
  // =============================================================================

  /**
   * 订阅状态变更
   */
  public subscribe(
    connectionId: string,
    path: string,
    options: {
      deep?: boolean;
      filter?: (change: StateChangeRecord) => boolean;
      sendSnapshot?: boolean;
    } = {}
  ): StateSubscription | null {
    // 检查订阅数量限制
    const connectionSubs = this.connectionSubscriptions.get(connectionId);
    if (connectionSubs && connectionSubs.size >= 100) {
      logger.warn(`[UIStateSync] 连接订阅数量达到上限: ${connectionId}`);
      return null;
    }

    if (this.subscriptions.size >= this.config.maxSubscriptions) {
      logger.warn('[UIStateSync] 全局订阅数量达到上限');
      return null;
    }

    const subscriptionId = `sub:${connectionId}:${path}:${randomUUID().substring(0, 8)}`;
    const subscription: StateSubscription = {
      subscriptionId,
      connectionId,
      path,
      deep: options.deep ?? false,
      createdAt: Date.now(),
      lastPushAt: 0,
      pushCount: 0,
      filter: options.filter,
    };

    this.subscriptions.set(subscriptionId, subscription);

    // 添加到连接订阅映射
    if (!this.connectionSubscriptions.has(connectionId)) {
      this.connectionSubscriptions.set(connectionId, new Set());
    }
    this.connectionSubscriptions.get(connectionId)!.add(subscriptionId);

    // 更新指标
    this.metrics.totalSubscriptions++;
    if (this.subscriptions.size > this.metrics.peakSubscriptions) {
      this.metrics.peakSubscriptions = this.subscriptions.size;
    }

    // 发送当前状态快照
    if (options.sendSnapshot) {
      const snapshot = this.createSnapshot(path);
      this.emit('push', {
        type: 'state.snapshot',
        subscriptionId,
        path,
        changes: [],
        snapshot,
        timestamp: Date.now(),
      } as StatePushEvent);
    }

    logger.debug(`[UIStateSync] 新订阅: ${subscriptionId}`, {
      connectionId,
      path,
      deep: subscription.deep,
    });

    return subscription;
  }

  /**
   * 取消订阅
   */
  public unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return false;
    }

    this.subscriptions.delete(subscriptionId);

    // 从连接订阅映射中移除
    const connectionSubs = this.connectionSubscriptions.get(subscription.connectionId);
    if (connectionSubs) {
      connectionSubs.delete(subscriptionId);
      if (connectionSubs.size === 0) {
        this.connectionSubscriptions.delete(subscription.connectionId);
      }
    }

    logger.debug(`[UIStateSync] 取消订阅: ${subscriptionId}`);
    return true;
  }

  /**
   * 取消连接的所有订阅
   */
  public unsubscribeAll(connectionId: string): number {
    const connectionSubs = this.connectionSubscriptions.get(connectionId);
    if (!connectionSubs) {
      return 0;
    }

    const count = connectionSubs.size;
    for (const subscriptionId of connectionSubs) {
      this.subscriptions.delete(subscriptionId);
    }
    this.connectionSubscriptions.delete(connectionId);

    logger.debug(`[UIStateSync] 取消连接所有订阅: ${connectionId}, 数量: ${count}`);
    return count;
  }

  /**
   * 获取连接的订阅
   */
  public getSubscriptions(connectionId: string): StateSubscription[] {
    const subscriptionIds = this.connectionSubscriptions.get(connectionId);
    if (!subscriptionIds) {
      return [];
    }

    return Array.from(subscriptionIds)
      .map((id) => this.subscriptions.get(id))
      .filter((sub): sub is StateSubscription => sub !== undefined);
  }

  // =============================================================================
  // 推送机制
  // =============================================================================

  /**
   * 调度状态推送（带节流）
   */
  private schedulePush(path: string, change: StateChangeRecord): void {
    // 收集需要推送的订阅
    const targetSubscriptions = this.findMatchingSubscriptions(path, change);
    if (targetSubscriptions.length === 0) {
      return;
    }

    // 将变更添加到待推送队列
    for (const subscription of targetSubscriptions) {
      const pending = this.pendingChanges.get(subscription.subscriptionId) || [];
      pending.push(change);
      this.pendingChanges.set(subscription.subscriptionId, pending);

      // 设置节流推送
      if (!this.pendingPushes.has(subscription.subscriptionId)) {
        const timer = setTimeout(() => {
          this.executePush(subscription.subscriptionId);
        }, this.config.pushThrottleMs);
        this.pendingPushes.set(subscription.subscriptionId, timer);
      }
    }
  }

  /**
   * 调度批量推送
   */
  private scheduleBatchPush(changes: StateChangeRecord[]): void {
    const subscriptionChanges = new Map<string, StateChangeRecord[]>();

    // 按订阅分组变更
    for (const change of changes) {
      const matchingSubs = this.findMatchingSubscriptions(change.path, change);
      for (const subscription of matchingSubs) {
        const pending = subscriptionChanges.get(subscription.subscriptionId) || [];
        pending.push(change);
        subscriptionChanges.set(subscription.subscriptionId, pending);
      }
    }

    // 调度推送
    for (const [subscriptionId, subsChanges] of subscriptionChanges.entries()) {
      const pending = this.pendingChanges.get(subscriptionId) || [];
      pending.push(...subsChanges);
      this.pendingChanges.set(subscriptionId, pending);

      if (!this.pendingPushes.has(subscriptionId)) {
        const timer = setTimeout(() => {
          this.executePush(subscriptionId);
        }, this.config.pushThrottleMs);
        this.pendingPushes.set(subscriptionId, timer);
      }
    }
  }

  /**
   * 执行推送
   */
  private executePush(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    const changes = this.pendingChanges.get(subscriptionId);

    // 清理待推送状态
    this.pendingChanges.delete(subscriptionId);
    this.pendingPushes.delete(subscriptionId);

    if (!subscription || !changes || changes.length === 0) {
      return;
    }

    const pushStart = Date.now();

    // 创建推送事件
    const pushEvent: StatePushEvent = {
      type: 'state.change',
      subscriptionId,
      path: subscription.path,
      changes,
      timestamp: Date.now(),
    };

    // 发送推送事件
    this.emit('push', pushEvent);

    // 更新订阅统计
    subscription.lastPushAt = Date.now();
    subscription.pushCount++;

    // 更新指标
    this.metrics.totalPushes++;
    const latency = Date.now() - pushStart;
    this.metrics.avgPushLatencyMs =
      (this.metrics.avgPushLatencyMs * (this.metrics.totalPushes - 1) + latency) /
      this.metrics.totalPushes;

    logger.debug(`[UIStateSync] 推送完成: ${subscriptionId}`, {
      changeCount: changes.length,
      latencyMs: latency,
    });
  }

  /**
   * 查找匹配的订阅
   */
  private findMatchingSubscriptions(
    path: string,
    change: StateChangeRecord
  ): StateSubscription[] {
    const matching: StateSubscription[] = [];

    for (const subscription of this.subscriptions.values()) {
      // 检查路径匹配
      const pathMatches = subscription.deep
        ? path.startsWith(subscription.path)
        : path === subscription.path;

      if (!pathMatches) {
        continue;
      }

      // 检查过滤器
      if (subscription.filter && !subscription.filter(change)) {
        continue;
      }

      // 排除变更来源连接
      if (change.connectionId && change.connectionId === subscription.connectionId) {
        continue;
      }

      matching.push(subscription);
    }

    return matching;
  }

  // =============================================================================
  // 工具方法
  // =============================================================================

  /**
   * 记录变更历史
   */
  private recordChange(change: StateChangeRecord): void {
    this.changeHistory.push(change);
    this.metrics.totalChanges++;

    // 保留最近的变更历史
    if (this.changeHistory.length > this.config.changeHistoryRetention) {
      this.changeHistory.shift();
    }
  }

  /**
   * 深度合并
   */
  private deepMerge(target: any, source: any): any {
    if (typeof target !== 'object' || target === null) {
      return source;
    }
    if (typeof source !== 'object' || source === null) {
      return target;
    }

    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (key in target && typeof target[key] === 'object' && typeof source[key] === 'object') {
        result[key] = this.deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  /**
   * 深度克隆
   */
  private deepClone(value: any): any {
    if (value === undefined || value === null) {
      return value;
    }
    return JSON.parse(JSON.stringify(value));
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
      activeSubscriptions: this.subscriptions.size,
      activeConnections: this.connectionSubscriptions.size,
      statePaths: this.stateStore.size,
      changeHistorySize: this.changeHistory.length,
      pendingPushes: this.pendingPushes.size,
      avgLatencyTargetMet: this.metrics.avgPushLatencyMs < 100,
    };
  }

  /**
   * 获取变更历史
   */
  public getChangeHistory(options: {
    path?: string;
    limit?: number;
    since?: number;
  } = {}): StateChangeRecord[] {
    let history = [...this.changeHistory];

    if (options.path) {
      history = history.filter((c) => c.path.startsWith(options.path!));
    }

    if (options.since) {
      history = history.filter((c) => c.timestamp >= options.since!);
    }

    const limit = options.limit ?? 100;
    return history.slice(-limit);
  }

  /**
   * 获取诊断信息
   */
  public getDiagnostics() {
    return {
      config: this.config,
      metrics: this.getMetrics(),
      topPaths: this.getTopStatePaths(10),
      topSubscribers: this.getTopSubscribers(10),
      recentChanges: this.changeHistory.slice(-5),
    };
  }

  /**
   * 获取最活跃的状态路径
   */
  private getTopStatePaths(limit: number): Array<{ path: string; version: number }> {
    return Array.from(this.stateVersions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([path, version]) => ({ path, version }));
  }

  /**
   * 获取最活跃的订阅者
   */
  private getTopSubscribers(limit: number): Array<{ connectionId: string; count: number }> {
    const counts = new Map<string, number>();
    for (const sub of this.subscriptions.values()) {
      counts.set(sub.connectionId, (counts.get(sub.connectionId) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([connectionId, count]) => ({ connectionId, count }));
  }

  /**
   * 清理资源
   */
  public dispose(): void {
    // 清理所有待推送定时器
    for (const timer of this.pendingPushes.values()) {
      clearTimeout(timer);
    }
    this.pendingPushes.clear();
    this.pendingChanges.clear();

    // 清理状态
    this.subscriptions.clear();
    this.connectionSubscriptions.clear();
    this.stateStore.clear();
    this.changeHistory.length = 0;
    this.snapshots.clear();

    this.removeAllListeners();

    logger.info('[UIStateSync] 状态同步服务已清理');
  }
}

// =============================================================================
// 导出
// =============================================================================

export default UIStateSyncService;