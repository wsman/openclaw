/**
 * Entropy Monitor Plugin - 鐔靛€肩洃鎺ф彃浠?
 *
 * 瀹硶渚濇嵁:
 * - 搂101 鍚屾鍏悊: 浠ｇ爜涓庢枃妗ｅ繀椤诲師瀛愭€у悓姝?
 * - 搂102 鐔靛噺鍘熷垯: 鐩戞帶绯荤粺鐔靛€硷紝纭繚鎸佺画鐔靛噺
 * - 搂111-搂113 璧勬簮绠＄悊鍏悊: 鐩戞帶璁＄畻璧勬簮浣跨敤
 *
 * OpenClaw澶嶇敤绛栫暐 (40%):
 * - 澶嶇敤OpenClaw鐨勬棩蹇楃郴缁熸灦鏋?
 * - 澶嶇敤OpenClaw鐨勭洃鎺ф暟鎹敹闆嗘ā寮?
 * - 鎵╁睍Negentropy鐗规湁鐨勭喌鍊艰绠?
 *
 * @version 1.0.0
 * @created 2026-02-12
 * @maintainer 绉戞妧閮ㄥ悗绔垎闃?
 */

import type {
  PluginApi,
  PluginHookHandlerMap,
  PluginDefinition,
} from '../../../server/plugins/types/plugin-interfaces';
import { WebSocketChannelPlugin } from '../websocket-channel/index';

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * 鐔靛€兼寚鏍?
 *
 * 鍩轰簬Negentropy-Lab鐨勭喌鍊兼ā鍨?
 */
export interface EntropyMetrics {
  /** 缁煎悎鐔靛€?H_sys */
  h_sys: number;
  /** 璁ょ煡鐔?H_cog */
  h_cog: number;
  /** 缁撴瀯鐔?H_struct */
  h_struct: number;
  /** 瀵归綈鐔?H_align */
  h_align: number;
  /** 鐢熺悊鐔?H_bio */
  h_bio: number;
  /** 鏃堕棿鎴?*/
  timestamp: number;
}

/**
 * 鍐呭瓨缁熻
 */
export interface MemoryStats {
  /** 鎬诲唴瀛?(MB) */
  total: number;
  /** 宸茬敤鍐呭瓨 (MB) */
  used: number;
  /** 绌洪棽鍐呭瓨 (MB) */
  free: number;
  /** 鍐呭瓨浣跨敤鐜?(%) */
  usagePercent: number;
  /** 鏃堕棿鎴?*/
  timestamp: number;
}

/**
 * CPU缁熻
 */
export interface CPUStats {
  /** CPU浣跨敤鐜?(%) */
  usagePercent: number;
  /** CPU璐熻浇 (1鍒嗛挓) */
  load1m: number;
  /** CPU璐熻浇 (5鍒嗛挓) */
  load5m: number;
  /** CPU璐熻浇 (15鍒嗛挓) */
  load15m: number;
  /** 鏃堕棿鎴?*/
  timestamp: number;
}

/**
 * 纾佺洏缁熻
 */
export interface DiskStats {
  /** 鎬诲閲?(GB) */
  total: number;
  /** 宸茬敤瀹归噺 (GB) */
  used: number;
  /** 绌洪棽瀹归噺 (GB) */
  free: number;
  /** 浣跨敤鐜?(%) */
  usagePercent: number;
  /** 鏃堕棿鎴?*/
  timestamp: number;
}

/**
 * 绯荤粺鎸囨爣姹囨€?
 */
export interface SystemMetrics {
  /** CPU缁熻 */
  cpu: CPUStats;
  /** 鍐呭瓨缁熻 */
  memory: MemoryStats;
  /** 纾佺洏缁熻 */
  disk: DiskStats;
  /** 鐔靛€兼寚鏍?*/
  entropy: EntropyMetrics;
  /** 鏃堕棿鎴?*/
  timestamp: number;
}

/**
 * 鍛婅绾у埆
 */
export type AlertLevel = 'info' | 'warn' | 'error' | 'critical';

/**
 * 鍛婅浜嬩欢
 */
export interface Alert {
  /** 鍛婅ID */
  alertId: string;
  /** 鍛婅绾у埆 */
  level: AlertLevel;
  /** 鍛婅鎸囨爣 */
  metric: string;
  /** 褰撳墠鍊?*/
  currentValue: number;
  /** 闃堝€?*/
  threshold: number;
  /** 鍛婅娑堟伅 */
  message: string;
  /** 鏃堕棿鎴?*/
  timestamp: number;
}

/**
 * 鐔电洃鎺ч厤缃?
 */
export interface EntropyMonitorConfig {
  /** 鐩戞帶鎸囨爣鍒楄〃 */
  metrics: string[];
  /** 闃堝€奸厤缃?*/
  thresholds: Record<string, number>;
  /** 鍛婅闂撮殧 (姣) */
  alertInterval: number;
  /** 鐩戞帶闂撮殧 (姣) */
  monitorInterval: number;
  /** 鏁版嵁淇濈暀澶╂暟 */
  dataRetentionDays: number;
}

// =============================================================================
// Default Thresholds
// =============================================================================

const DEFAULT_THRESHOLDS: Record<string, number> = {
  // 鐔靛€奸槇鍊?(0-1)
  h_sys: 0.7,
  h_cog: 0.5,
  h_struct: 0.5,
  h_align: 0.5,
  h_bio: 0.8,
  // 璧勬簮闃堝€?(%)
  cpu: 80,
  memory: 90,
  disk: 85,
};

// =============================================================================
// Entropy Monitor Plugin Class
// =============================================================================

/**
 * 鐔靛€肩洃鎺ф彃浠朵富绫?
 *
 * 鏍稿績鍔熻兘:
 * 1. CPU鐩戞帶
 * 2. 鍐呭瓨鐩戞帶
 * 3. 鐔靛€肩洃鎺э紙H_sys瀹炴椂杩借釜锛?
 * 4. 闃堝€煎憡璀?
 */
export class EntropyMonitorPlugin {
  private api: PluginApi | null = null;
  public config: EntropyMonitorConfig | null = null;
  private monitorIntervalId: NodeJS.Timeout | null = null;
  private recentAlerts: Map<string, number> = new Map();
  private metricsHistory: SystemMetrics[] = [];
  private maxHistoryLength = 1000;
  private alertHandlers: Array<(alert: Alert) => void> = [];
  private lastMetricsTimestamp = 0;
  private lastEntropyTimestamp = 0;

  /**
   * 鍏煎鏃ф祴璇曟敞鍏PI
   */
  private normalizeApi(rawApi: any): PluginApi {
    const api: any = rawApi ?? {};

    if (!api.on && typeof api.events?.on === 'function') {
      api.on = api.events.on.bind(api.events);
    }
    if (!api.emit && typeof api.events?.emit === 'function') {
      api.emit = api.events.emit.bind(api.events);
    }

    if (!api.config || !api.config.negentropy) {
      const negentropy = typeof api.config?.get === 'function'
        ? api.config.get('negentropy') || {}
        : {};
      api.config = { ...(api.config || {}), negentropy };
    }

    return api as PluginApi;
  }

  private buildConfig(api: PluginApi): EntropyMonitorConfig {
    const raw = (api as any)?.config?.negentropy?.entropyMonitor || {};
    return {
      metrics: raw.metrics || ['h_sys', 'h_cog', 'h_struct', 'h_align', 'h_bio', 'cpu', 'memory', 'disk'],
      thresholds: { ...DEFAULT_THRESHOLDS, ...(raw.thresholds || {}) },
      alertInterval: raw.alertInterval ?? 60000,
      monitorInterval: raw.monitorInterval ?? 5000,
      dataRetentionDays: raw.dataRetentionDays ?? 7,
    };
  }

  /**
   * 鏃х敓鍛藉懆鏈熷吋瀹规帴鍙?
   */
  onLoad(rawApi: any): void {
    this.api = this.normalizeApi(rawApi);
    this.config = this.buildConfig(this.api);
    this.api.logger?.info?.('馃搳 Entropy Monitor plugin initialized!');
  }

  onActivate(): void {
    if (!this.api) {
      return;
    }
    this.api.logger?.info?.('馃殌 Entropy Monitor plugin activated!');
  }

  onDeactivate(): void {
    if (this.api) {
      this.api.logger?.info?.('馃洃 Entropy Monitor plugin deactivated!');
    }
    if (this.monitorIntervalId) {
      clearInterval(this.monitorIntervalId);
      this.monitorIntervalId = null;
    }
  }

  // ===========================================================================
  // CPU鐩戞帶鏂规硶
  // ===========================================================================

  /**
   * 鑾峰彇CPU浣跨敤鐜?
   *
   * @returns CPU缁熻
   *
   * OpenClaw澶嶇敤: 澶嶇敤OpenClaw鐨勭洃鎺ф暟鎹敹闆嗘ā寮?
   */
  async getCPUUsage(): Promise<CPUStats> {
    if (!this.api) {
      throw new Error('Plugin not initialized');
    }
    const cpuUsage = await this.calculateCPU();

    this.api.logger?.debug?.(`馃搳 CPU Usage: ${cpuUsage.usagePercent}%`);

    return cpuUsage;
  }

  /**
   * 鍏煎鏃ф祴璇曞懡鍚?
   */
  async calculateCPU(): Promise<CPUStats> {
    return this.collectCPUStats();
  }

  /**
   * 鏀堕泦CPU缁熻 (鍐呴儴鏂规硶)
   *
   * @private
   */
  async collectCPUStats(): Promise<CPUStats> {
    // TODO: 瀹炵幇瀹為檯鐨凜PU缁熻鏀堕泦
    // 杩欓噷闇€瑕侀泦鎴愮郴缁熺骇鐩戞帶搴?
    const loadAvg = require('os').loadavg();

    return {
      usagePercent: 45.5, // 妯℃嫙鍊?
      load1m: loadAvg[0],
      load5m: loadAvg[1],
      load15m: loadAvg[2],
      timestamp: Date.now(),
    };
  }

  // ===========================================================================
  // 鍐呭瓨鐩戞帶鏂规硶
  // ===========================================================================

  /**
   * 鑾峰彇鍐呭瓨浣跨敤鎯呭喌
   *
   * @returns 鍐呭瓨缁熻
   */
  async getMemoryUsage(): Promise<MemoryStats> {
    if (!this.api) {
      throw new Error('Plugin not initialized');
    }
    const memoryUsage = await this.collectMemoryStats();

    this.api.logger?.debug?.(`馃捑 Memory Usage: ${memoryUsage.usagePercent}%`);

    return memoryUsage;
  }

  /**
   * 鏀堕泦鍐呭瓨缁熻 (鍐呴儴鏂规硶)
   *
   * @private
   */
  async collectMemoryStats(): Promise<MemoryStats> {
    const totalMem = require('os').totalmem();
    const freeMem = require('os').freemem();
    const usedMem = totalMem - freeMem;

    return {
      total: Math.round(totalMem / 1024 / 1024), // MB
      used: Math.round(usedMem / 1024 / 1024), // MB
      free: Math.round(freeMem / 1024 / 1024), // MB
      usagePercent: Math.round((usedMem / totalMem) * 100),
      timestamp: Date.now(),
    };
  }

  // ===========================================================================
  // 纾佺洏鐩戞帶鏂规硶
  // ===========================================================================

  /**
   * 鑾峰彇纾佺洏浣跨敤鎯呭喌
   *
   * @returns 纾佺洏缁熻
   */
  async getDiskUsage(): Promise<DiskStats> {
    if (!this.api) {
      throw new Error('Plugin not initialized');
    }
    const diskUsage = await this.collectDiskStats();

    this.api.logger?.debug?.(`馃捒 Disk Usage: ${diskUsage.usagePercent}%`);

    return diskUsage;
  }

  /**
   * 鏀堕泦纾佺洏缁熻 (鍐呴儴鏂规硶)
   *
   * @private
   */
  async collectDiskStats(): Promise<DiskStats> {
    // TODO: 瀹炵幇瀹為檯鐨勭鐩樼粺璁℃敹闆?
    return {
      total: 500, // GB (妯℃嫙鍊?
      used: 250,
      free: 250,
      usagePercent: 50,
      timestamp: Date.now(),
    };
  }

  // ===========================================================================
  // 鐔靛€肩洃鎺ф柟娉?
  // ===========================================================================

  /**
   * 鑾峰彇鐔靛€兼寚鏍?
   *
   * @returns 鐔靛€兼寚鏍?
   */
  async getEntropy(): Promise<EntropyMetrics> {
    if (!this.api) {
      throw new Error('Plugin not initialized');
    }
    const entropy = await this.calculateEntropy();
    this.api.logger?.debug?.(`馃搱 Entropy H_sys: ${entropy.h_sys}`);

    // 鍏煎妯″紡: 姣忔璇诲彇鐔靛€奸兘璁板綍蹇収锛屼緵getHistory浣跨敤
    try {
      const snapshot = await this.collectSystemMetrics();
      this.saveMetricsToHistory(snapshot);
    } catch {
      // 蹇界暐閲囨牱澶辫触锛屼笉褰卞搷涓绘祦绋?
    }

    // 浠呭湪鏁呴殰鎭㈠璇涓嬭嚜鍔ㄦ帹閫侊紝閬垮厤涓庢樉寮?broadcast 閫犳垚閲嶅鏇存柊
    if (WebSocketChannelPlugin.consumeFailureSignal()) {
      await WebSocketChannelPlugin.publish('entropy_update', {
        entropy,
        timestamp: entropy.timestamp,
      });
    }

    return entropy;
  }

  /**
   * 璁＄畻鐔靛€?(鍐呴儴鏂规硶)
   *
   * @private
   * @description 鍩轰簬Negentropy-Lab鐨勭喌鍊兼ā鍨嬭绠楀悇绫荤喌鍊?
   */
  async calculateEntropy(): Promise<EntropyMetrics> {
    const [cpu, memory, disk] = await Promise.all([
      this.collectCPUStats(),
      this.collectMemoryStats(),
      this.collectDiskStats(),
    ]);
    const h_sys = this.calculateSystemEntropyFromUsage(cpu.usagePercent, memory.usagePercent, disk.usagePercent);

    // H_cog: 璁ょ煡鐔?(鍩轰簬Agent浠诲姟澶嶆潅搴﹀拰澶辫触鐜?
    const h_cog = await this.calculateCognitiveEntropy();

    // H_struct: 缁撴瀯鐔?(鍩轰簬浠ｇ爜缁撴瀯銆佹枃妗ｄ竴鑷存€?
    const h_struct = await this.calculateStructuralEntropy();

    // H_align: 瀵归綈鐔?(鍩轰簬瀹硶鍚堣鎬?
    const h_align = await this.calculateAlignmentEntropy();

    // H_bio: 鐢熺悊鐔?(鍩轰簬绯荤粺鍋ュ悍搴︺€佺ǔ瀹氭€?
    const h_bio = await this.calculateBiologicalEntropy({
      cpu,
      memory,
      disk,
      entropy: {} as EntropyMetrics,
      timestamp: Date.now(),
    });

    const now = Date.now();
    const entropyTs = now <= this.lastEntropyTimestamp ? this.lastEntropyTimestamp + 1 : now;
    this.lastEntropyTimestamp = entropyTs;

    return {
      h_sys,
      h_cog,
      h_struct,
      h_align,
      h_bio,
      timestamp: entropyTs,
    };
  }

  /**
   * 璁＄畻绯荤粺鐔?H_sys
   *
   * @private
   */
  private calculateSystemEntropy(metrics: SystemMetrics): number {
    const cpuFactor = metrics.cpu.usagePercent / 100;
    const memoryFactor = metrics.memory.usagePercent / 100;
    const diskFactor = metrics.disk.usagePercent / 100;

    // 缁煎悎鐔?= 鍔犳潈骞冲潎
    return (cpuFactor * 0.4 + memoryFactor * 0.4 + diskFactor * 0.2);
  }

  private calculateSystemEntropyFromUsage(cpuPercent: number, memoryPercent: number, diskPercent: number): number {
    return (cpuPercent / 100) * 0.4 + (memoryPercent / 100) * 0.4 + (diskPercent / 100) * 0.2;
  }

  /**
   * 璁＄畻璁ょ煡鐔?H_cog
   *
   * @private
   */
  private async calculateCognitiveEntropy(): Promise<number> {
    // TODO: 鍩轰簬Agent浠诲姟鐘舵€佽绠楄鐭ョ喌
    // 渚嬪: 浠诲姟澶辫触鐜囥€佸鏉傚害鍒嗗竷绛?
    return 0.3; // 妯℃嫙鍊?
  }

  /**
   * 璁＄畻缁撴瀯鐔?H_struct
   *
   * @private
   */
  private async calculateStructuralEntropy(): Promise<number> {
    // TODO: 鍩轰簬浠ｇ爜缁撴瀯鍜屾枃妗ｄ竴鑷存€ц绠楃粨鏋勭喌
    // 渚嬪: 浠ｇ爜閲嶅搴︺€佹枃妗ｈ鐩栫巼绛?
    return 0.2; // 妯℃嫙鍊?
  }

  /**
   * 璁＄畻瀵归綈鐔?H_align
   *
   * @private
   */
  private async calculateAlignmentEntropy(): Promise<number> {
    // TODO: 鍩轰簬瀹硶鍚堣鎬ц绠楀榻愮喌
    // 渚嬪: 瀹硶杩濊娆℃暟銆佷慨澶嶈繘搴︾瓑
    return 0.1; // 妯℃嫙鍊?
  }

  /**
   * 璁＄畻鐢熺悊鐔?H_bio
   *
   * @private
   */
  private async calculateBiologicalEntropy(metrics: SystemMetrics): Promise<number> {
    // 鍩轰簬绯荤粺鍋ュ悍搴︺€佺ǔ瀹氭€ц绠楃敓鐞嗙喌
    const cpuFactor = metrics.cpu.usagePercent / 100;
    const memoryFactor = metrics.memory.usagePercent / 100;

    return (cpuFactor * 0.5 + memoryFactor * 0.5);
  }

  /**
   * 鏀堕泦绯荤粺鎸囨爣 (鍐呴儴鏂规硶)
   *
   * @private
   */
  async collectSystemMetrics(): Promise<SystemMetrics> {
    const metricTs = Date.now();
    const [cpu, memory, disk] = await Promise.all([
      this.collectCPUStats(),
      this.collectMemoryStats(),
      this.collectDiskStats(),
    ]);

    const entropy: EntropyMetrics = {
      h_sys: this.calculateSystemEntropyFromUsage(cpu.usagePercent, memory.usagePercent, disk.usagePercent),
      h_cog: await this.calculateCognitiveEntropy(),
      h_struct: await this.calculateStructuralEntropy(),
      h_align: await this.calculateAlignmentEntropy(),
      h_bio: await this.calculateBiologicalEntropy({
        cpu,
        memory,
        disk,
        entropy: {} as EntropyMetrics,
        timestamp: metricTs,
      }),
      timestamp: metricTs,
    };

    return {
      cpu: { ...cpu, timestamp: metricTs },
      memory: { ...memory, timestamp: metricTs },
      disk: { ...disk, timestamp: metricTs },
      entropy,
      timestamp: metricTs,
    };
  }

  // ===========================================================================
  // 闃堝€煎憡璀︽柟娉?
  // ===========================================================================

  /**
   * 妫€鏌ラ槇鍊煎憡璀?
   *
   * @returns 鍛婅鍒楄〃
   */
  async checkThresholds(): Promise<Alert[]> {
    if (!this.api || !this.config) {
      return [];
    }

    const alerts: Alert[] = [];
    const metrics = await this.collectSystemMetrics();
    const thresholds = this.config.thresholds;

    // 妫€鏌ョ喌鍊奸槇鍊?
    const entropyChecks = [
      { metric: 'h_sys', value: metrics.entropy.h_sys },
      { metric: 'h_cog', value: metrics.entropy.h_cog },
      { metric: 'h_struct', value: metrics.entropy.h_struct },
      { metric: 'h_align', value: metrics.entropy.h_align },
      { metric: 'h_bio', value: metrics.entropy.h_bio },
    ];

    for (const check of entropyChecks) {
      const threshold = thresholds[check.metric];
      if (threshold && check.value > threshold) {
        const alert = this.createAlert(check.metric, check.value, threshold, 'warn');
        if (this.shouldSendAlert(alert)) {
          alerts.push(alert);
        }
      }
    }

    // 妫€鏌ヨ祫婧愰槇鍊?
    const resourceChecks = [
      { metric: 'cpu', value: metrics.cpu.usagePercent },
      { metric: 'memory', value: metrics.memory.usagePercent },
      { metric: 'disk', value: metrics.disk.usagePercent },
    ];

    for (const check of resourceChecks) {
      const threshold = thresholds[check.metric];
      if (threshold && check.value > threshold) {
        const level: AlertLevel = check.value > threshold + 10 ? 'error' : 'warn';
        const alert = this.createAlert(check.metric, check.value, threshold, level);
        if (this.shouldSendAlert(alert)) {
          alerts.push(alert);
        }
      }
    }

    // 鍏煎鍥炶皟 + 浜嬩欢閫氱煡
    for (const alert of alerts) {
      for (const handler of this.alertHandlers) {
        try {
          handler(alert);
        } catch {
          // 蹇界暐鍥炶皟寮傚父
        }
      }
      this.api.emit?.('error_occurred', {
        pluginId: this.api.id,
        error: new Error(alert.message),
        timestamp: alert.timestamp,
      });
    }

    return alerts;
  }

  /**
   * 鍒涘缓鍛婅 (鍐呴儴鏂规硶)
   *
   * @private
   */
  private createAlert(metric: string, currentValue: number, threshold: number, level: AlertLevel): Alert {
    const alertId = `${metric}-${Date.now()}`;
    const message = `${metric.toUpperCase()} threshold exceeded: ${currentValue.toFixed(2)} > ${threshold.toFixed(2)}`;

    return {
      alertId,
      level,
      metric,
      currentValue,
      threshold,
      message,
      timestamp: Date.now(),
    };
  }

  /**
   * 鍒ゆ柇鏄惁搴旇鍙戦€佸憡璀?(閬垮厤閲嶅鍛婅)
   *
   * @private
   */
  private shouldSendAlert(alert: Alert): boolean {
    const lastAlertTime = this.recentAlerts.get(alert.metric);
    const now = Date.now();

    if (lastAlertTime && now - lastAlertTime < (this.config?.alertInterval || 60000)) {
      return false; // 杩樺湪鍛婅闂撮殧鍐?
    }

    this.recentAlerts.set(alert.metric, now);
    return true;
  }

  // ===========================================================================
  // 鐩戞帶寰幆鏂规硶
  // ===========================================================================

  /**
   * 鍚姩鐩戞帶寰幆
   */
  async startMonitoring(): Promise<void> {
    if (!this.api || !this.config) {
      throw new Error('Plugin not initialized');
    }

    if (this.monitorIntervalId) {
      this.api.logger.warn('Monitoring already started');
      return;
    }

    const interval = this.config.monitorInterval;

    this.api.logger.info(`馃攳 Starting monitoring loop (interval: ${interval}ms)`);

    this.monitorIntervalId = setInterval(async () => {
      try {
        await this.monitoringTick();
      } catch (error) {
        if (this.api) {
          this.api.logger.error('Error in monitoring loop:', error);
        }
      }
    }, interval);
  }

  /**
   * 鍋滄鐩戞帶寰幆
   */
  async stopMonitoring(): Promise<void> {
    if (!this.monitorIntervalId) {
      return;
    }

    if (this.api) {
      this.api.logger.info('馃洃 Stopping monitoring loop');
    }

    clearInterval(this.monitorIntervalId);
    this.monitorIntervalId = null;
  }

  /**
   * 鐩戞帶寰幆鍗曟鎵ц (鍐呴儴鏂规硶)
   *
   * @private
   */
  private async monitoringTick(): Promise<void> {
    if (!this.api) {
      return;
    }

    // 鏀堕泦绯荤粺鎸囨爣
    const metrics = await this.collectSystemMetrics();

    // 淇濆瓨鍒板巻鍙茶褰?
    this.saveMetricsToHistory(metrics);

    // 妫€鏌ラ槇鍊煎憡璀?
    const alerts = await this.checkThresholds();

    // 澶勭悊鍛婅
    for (const alert of alerts) {
      this.api.logger?.warn?.(`馃毃 Alert [${alert.level.toUpperCase()}]: ${alert.message}`);

      // 瑙﹀彂鍛婅浜嬩欢
      this.api.emit?.('error_occurred', {
        pluginId: this.api.id,
        error: new Error(alert.message),
        timestamp: alert.timestamp,
      });
    }
  }

  /**
   * 淇濆瓨鎸囨爣鍒板巻鍙茶褰?(鍐呴儴鏂规硶)
   *
   * @private
   */
  saveMetricsToHistory(metrics: SystemMetrics): void {
    this.metricsHistory.push(metrics);

    // 闄愬埗鍘嗗彶璁板綍闀垮害
    if (this.metricsHistory.length > this.maxHistoryLength) {
      this.metricsHistory.shift();
    }
  }

  // ===========================================================================
  // 鏌ヨ鏂规硶
  // ===========================================================================

  /**
   * 鑾峰彇鎸囨爣鍘嗗彶璁板綍
   *
   * @param limit - 杩斿洖璁板綍鏁伴噺闄愬埗
   * @returns 鎸囨爣鍘嗗彶璁板綍
   */
  async getMetricsHistory(limit = 100): Promise<SystemMetrics[]> {
    return this.metricsHistory.slice(-limit);
  }

  /**
   * 鑾峰彇褰撳墠绯荤粺鎸囨爣
   *
   * @returns 绯荤粺鎸囨爣
   */
  async getCurrentMetrics(): Promise<SystemMetrics> {
    return this.collectSystemMetrics();
  }

  /**
   * 鍏煎鏃ф祴璇曟帴鍙?
   */
  async getCPUStats(): Promise<CPUStats> {
    return this.calculateCPU();
  }

  async getMemoryStats(): Promise<MemoryStats> {
    return this.collectMemoryStats();
  }

  async getAllMetrics(): Promise<SystemMetrics> {
    const now = Date.now();
    const metricTs = now <= this.lastMetricsTimestamp ? this.lastMetricsTimestamp + 1 : now;
    this.lastMetricsTimestamp = metricTs;

    let cpu: CPUStats;
    try {
      cpu = await this.getCPUStats();
    } catch {
      cpu = { usagePercent: 0, load1m: 0, load5m: 0, load15m: 0, timestamp: now };
    }

    let memory: MemoryStats;
    try {
      memory = await this.getMemoryStats();
    } catch {
      memory = { total: 0, used: 0, free: 0, usagePercent: 0, timestamp: now };
    }

    let disk: DiskStats;
    try {
      disk = await this.collectDiskStats();
    } catch {
      disk = { total: 0, used: 0, free: 0, usagePercent: 0, timestamp: now };
    }

    let entropy: EntropyMetrics;
    try {
      entropy = await this.getEntropy();
    } catch {
      entropy = { h_sys: 0, h_cog: 0, h_struct: 0, h_align: 0, h_bio: 0, timestamp: now };
    }

    const metrics: SystemMetrics = {
      cpu: { ...cpu, timestamp: metricTs },
      memory: { ...memory, timestamp: metricTs },
      disk: { ...disk, timestamp: metricTs },
      entropy: { ...entropy, timestamp: metricTs },
      timestamp: metricTs,
    };

    this.saveMetricsToHistory(metrics);
    return metrics;
  }

  async getHistory(metric: keyof EntropyMetrics, limit = 10): Promise<Array<{ timestamp: number; value: number }>> {
    const history = this.metricsHistory
      .slice(-limit)
      .map((m) => ({
        timestamp: m.timestamp,
        value: (m.entropy as any)?.[metric] ?? 0,
      }));

    if (history.length === 0) {
      const entropy = await this.getEntropy();
      return [{ timestamp: entropy.timestamp, value: (entropy as any)[metric] ?? 0 }];
    }

    return history;
  }

  setThreshold(metric: string, threshold: number): void {
    if (!this.config) {
      return;
    }
    this.config.thresholds[metric] = threshold;
  }

  onAlert(handler: (alert: Alert) => void): void {
    this.alertHandlers.push(handler);
  }

  /**
   * 鑾峰彇鐔靛€艰秼鍔?
   *
   * @param hours - 鏌ヨ灏忔椂鏁?
   * @returns 鐔靛€艰秼鍔挎暟鎹?
   */
  async getEntropyTrend(hours = 24): Promise<Array<{ timestamp: number; h_sys: number }>> {
    const metrics = await this.getMetricsHistory();
    const cutoffTime = Date.now() - hours * 60 * 60 * 1000;

    return metrics
      .filter(m => m.timestamp >= cutoffTime)
      .map(m => ({
        timestamp: m.timestamp,
        h_sys: m.entropy.h_sys,
      }));
  }
}

// =============================================================================
// Plugin Definition
// =============================================================================

// =============================================================================
// Plugin Definition
// =============================================================================

const pluginInstance = new EntropyMonitorPlugin();

const onSystemStart: PluginHookHandlerMap['system_start'] = async () => {
  console.log('\n========================================');
  console.log('Entropy Monitor Plugin Started');
  console.log('========================================\n');
};

const onSystemStop: PluginHookHandlerMap['system_stop'] = async () => {
  console.log('\n========================================');
  console.log('Entropy Monitor Plugin Stopped');
  console.log('========================================\n');
};

const registerHooks = (api: PluginApi): void => {
  api.on('system_start', onSystemStart);
  api.on('system_stop', onSystemStop);
  api.logger.info('Entropy Monitor hooks registered');
};

export default {
  id: 'entropy-monitor',
  name: 'Entropy Monitor Plugin',
  description: 'Entropy monitor plugin for CPU, memory, and threshold alerts',
  version: '1.0.0',
  kind: 'monitoring',
  main: 'index.ts',
  openclawCompat: true,

  negentropy: {
    entropyMonitor: {
      metrics: ['h_sys', 'h_cog', 'h_struct', 'h_align', 'cpu', 'memory', 'disk'],
      thresholds: DEFAULT_THRESHOLDS,
      alertInterval: 60000,
      monitorInterval: 5000,
      dataRetentionDays: 7,
    },
    constitutionalCompliance: {
      requiredClauses: ['§101', '§102', '§111', '§112', '§113'],
      validationRules: {
        type: 'object',
        rules: [
          {
            name: 'Entropy Monitoring',
            description: 'H_sys must be monitored in real-time (§102)',
            type: 'required',
          },
          {
            name: 'Resource Monitoring',
            description: 'CPU and memory must be monitored (§111)',
            type: 'required',
          },
          {
            name: 'Threshold Alerts',
            description: 'Threshold alerts must be configured (§113)',
            type: 'required',
          },
        ],
      },
    },
  },

  async initialize(api: PluginApi): Promise<void> {
    pluginInstance.onLoad(api);
  },

  async activate(api: PluginApi): Promise<void> {
    pluginInstance.onActivate();
    registerHooks(api);
    await pluginInstance.startMonitoring();
  },

  async deactivate(): Promise<void> {
    await pluginInstance.stopMonitoring();
    pluginInstance.onDeactivate();
  },

  async cleanup(api: PluginApi): Promise<void> {
    api.logger.info('Entropy Monitor plugin cleaned up!');
  },
} as PluginDefinition;
