/**
 * 🚀 灰度发布配置
 *
 * 定义决策服务的灰度发布策略和回滚机制。
 *
 * @constitution
 * §101 同步公理：灰度配置需与部署策略同步
 * §102 熵减原则：集中维护灰度规则
 * §152 单一真理源公理：此文件为灰度配置唯一定义
 *
 * @filename grayscale-config.ts
 * @version 1.0.0
 * @category gateway/openclaw-decision
 * @last_updated 2026-03-02
 */

// ============================================================================
// 灰度阶段
// ============================================================================

/**
 * 灰度发布阶段
 */
export type GrayscaleStage = 
  | 'canary'    // 金丝雀（1-5%）
  | 'beta'      // Beta 测试（5-20%）
  | 'staging'   // 预发布（20-50%）
  | 'production'; // 全量发布（100%）

/**
 * 灰度配置
 */
export interface GrayscaleConfig {
  /** 当前阶段 */
  stage: GrayscaleStage;
  /** 流量百分比（0-100） */
  percentage: number;
  /** 白名单连接ID */
  whitelistConnIds: string[];
  /** 白名单用户ID */
  whitelistUserIds: string[];
  /** 黑名单连接ID */
  blacklistConnIds: string[];
  /** 是否启用自动回滚 */
  autoRollback: boolean;
  /** 自动回滚阈值（错误率百分比） */
  rollbackThreshold: number;
  /** 回滚冷却时间（毫秒） */
  rollbackCooldown: number;
}

/**
 * 默认灰度配置
 */
export const DEFAULT_GRAYSCALE_CONFIG: GrayscaleConfig = {
  stage: 'canary',
  percentage: 1,
  whitelistConnIds: [],
  whitelistUserIds: [],
  blacklistConnIds: [],
  autoRollback: true,
  rollbackThreshold: 10,
  rollbackCooldown: 60000,
};

// ============================================================================
// 灰度管理器
// ============================================================================

/**
 * 灰度发布管理器
 */
export class GrayscaleManager {
  private config: GrayscaleConfig;
  private lastRollbackTime?: Date;
  private errorCount: number = 0;
  private totalRequests: number = 0;

  constructor(config: Partial<GrayscaleConfig> = {}) {
    this.config = { ...DEFAULT_GRAYSCALE_CONFIG, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): GrayscaleConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<GrayscaleConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 检查是否应该启用决策服务
   */
  shouldEnableDecision(connId: string, userId?: string): boolean {
    // 检查黑名单
    if (this.config.blacklistConnIds.includes(connId)) {
      return false;
    }

    // 检查白名单
    if (this.config.whitelistConnIds.includes(connId)) {
      return true;
    }
    if (userId && this.config.whitelistUserIds.includes(userId)) {
      return true;
    }

    // 按百分比决定
    const hash = this.hashString(connId);
    return (hash % 100) < this.config.percentage;
  }

  /**
   * 记录请求结果
   */
  recordResult(success: boolean): void {
    this.totalRequests++;
    if (!success) {
      this.errorCount++;
    }

    // 检查是否需要自动回滚
    if (this.config.autoRollback && this.shouldAutoRollback()) {
      this.triggerRollback();
    }
  }

  /**
   * 检查是否应该自动回滚
   */
  private shouldAutoRollback(): boolean {
    if (this.totalRequests < 100) {
      return false; // 样本太少
    }

    // 检查冷却时间
    if (this.lastRollbackTime) {
      const elapsed = Date.now() - this.lastRollbackTime.getTime();
      if (elapsed < this.config.rollbackCooldown) {
        return false;
      }
    }

    const errorRate = (this.errorCount / this.totalRequests) * 100;
    return errorRate >= this.config.rollbackThreshold;
  }

  /**
   * 触发回滚
   */
  private triggerRollback(): void {
    this.lastRollbackTime = new Date();
    
    // 回滚到上一阶段
    const stages: GrayscaleStage[] = ['canary', 'beta', 'staging', 'production'];
    const currentIndex = stages.indexOf(this.config.stage);
    
    if (currentIndex > 0) {
      this.config.stage = stages[currentIndex - 1];
      this.config.percentage = this.getPercentageForStage(this.config.stage);
    }

    // 重置计数
    this.errorCount = 0;
    this.totalRequests = 0;

    // 记录日志
    console.warn('[GrayscaleRollback]', JSON.stringify({
      ts: this.lastRollbackTime.toISOString(),
      newStage: this.config.stage,
      newPercentage: this.config.percentage,
    }));
  }

  /**
   * 获取阶段对应的百分比
   */
  private getPercentageForStage(stage: GrayscaleStage): number {
    const percentages: Record<GrayscaleStage, number> = {
      canary: 1,
      beta: 10,
      staging: 30,
      production: 100,
    };
    return percentages[stage];
  }

  /**
   * 字符串哈希
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    stage: GrayscaleStage;
    percentage: number;
    totalRequests: number;
    errorCount: number;
    errorRate: number;
    lastRollbackTime?: Date;
  } {
    return {
      stage: this.config.stage,
      percentage: this.config.percentage,
      totalRequests: this.totalRequests,
      errorCount: this.errorCount,
      errorRate: this.totalRequests > 0 ? (this.errorCount / this.totalRequests) * 100 : 0,
      lastRollbackTime: this.lastRollbackTime,
    };
  }

  /**
   * 推进到下一阶段
   */
  promote(): boolean {
    const stages: GrayscaleStage[] = ['canary', 'beta', 'staging', 'production'];
    const currentIndex = stages.indexOf(this.config.stage);
    
    if (currentIndex < stages.length - 1) {
      this.config.stage = stages[currentIndex + 1];
      this.config.percentage = this.getPercentageForStage(this.config.stage);
      this.errorCount = 0;
      this.totalRequests = 0;
      return true;
    }
    
    return false;
  }

  /**
   * 回滚到指定阶段
   */
  rollbackTo(stage: GrayscaleStage): void {
    this.config.stage = stage;
    this.config.percentage = this.getPercentageForStage(stage);
    this.errorCount = 0;
    this.totalRequests = 0;
    this.lastRollbackTime = new Date();
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    this.errorCount = 0;
    this.totalRequests = 0;
  }
}

// ============================================================================
// 单例实例
// ============================================================================

let managerInstance: GrayscaleManager | null = null;

/**
 * 获取灰度管理器单例
 */
export function getGrayscaleManager(config?: Partial<GrayscaleConfig>): GrayscaleManager {
  if (!managerInstance) {
    managerInstance = new GrayscaleManager(config);
  }
  return managerInstance;
}

/**
 * 重置灰度管理器（用于测试）
 */
export function resetGrayscaleManager(): void {
  managerInstance = null;
}