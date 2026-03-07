/**
 * 🚀 熵值计算服务
 * 
 * @constitution
 * §102 熵减原则：通过四维熵值计算监控系统有序度
 * §148 控制论架构公理：记忆回路核心组件
 * §104 内部事务局公理：提供熵值监控数据
 * 
 * @filename EntropyCalculator.ts
 * @version 1.0.0
 * @category Service
 * @last_updated 2026-02-26
 */

/**
 * 四维熵值
 */
export interface FourDimensionalEntropy {
  /** 系统熵值：整体系统混乱度 */
  H_sys: number;
  /** 认知熵值：信息处理复杂度 */
  H_cog: number;
  /** 结构熵值：架构组织复杂度 */
  H_struct: number;
  /** 对齐熵值：目标与行为偏差度 */
  H_align: number;
}

/**
 * 熵值计算输入
 */
export interface EntropyInput {
  /** 日志条目数 */
  logCount: number;
  /** 错误日志数 */
  errorCount: number;
  /** 警告日志数 */
  warnCount: number;
  /** 活跃Agent数 */
  activeAgents: number;
  /** 总Agent数 */
  totalAgents: number;
  /** 待处理任务数 */
  pendingTasks: number;
  /** 已完成任务数 */
  completedTasks: number;
  /** 平均响应时间(ms) */
  avgResponseTime: number;
  /** 内存使用率(0-1) */
  memoryUsage: number;
  /** CPU使用率(0-1) */
  cpuUsage: number;
  /** 宪法违规次数 */
  violations: number;
  /** 时间戳 */
  timestamp: Date;
}

/**
 * 熵值历史记录
 */
export interface EntropyHistoryEntry {
  timestamp: Date;
  entropy: FourDimensionalEntropy;
  input: EntropyInput;
}

/**
 * 熵值计算结果
 */
export interface EntropyCalculationResult {
  entropy: FourDimensionalEntropy;
  composite: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  alerts: string[];
  recommendations: string[];
}

/**
 * 熵值计算器配置
 */
export interface EntropyCalculatorConfig {
  historySize: number;
  alertThresholds: {
    H_sys: number;
    H_cog: number;
    H_struct: number;
    H_align: number;
    composite: number;
  };
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: EntropyCalculatorConfig = {
  historySize: 100,
  alertThresholds: {
    H_sys: 0.7,
    H_cog: 0.6,
    H_struct: 0.5,
    H_align: 0.4,
    composite: 0.6,
  },
};

/**
 * 四维熵值计算器
 * 实现基于控制论的系统熵值评估
 */
export class EntropyCalculator {
  private config: EntropyCalculatorConfig;
  private history: EntropyHistoryEntry[] = [];

  constructor(config: Partial<EntropyCalculatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log('[EntropyCalculator] 初始化完成');
  }

  /**
   * 计算四维熵值
   */
  calculate(input: EntropyInput): EntropyCalculationResult {
    // 1. 计算系统熵值 (H_sys)
    const H_sys = this.calculateSystemEntropy(input);

    // 2. 计算认知熵值 (H_cog)
    const H_cog = this.calculateCognitiveEntropy(input);

    // 3. 计算结构熵值 (H_struct)
    const H_struct = this.calculateStructuralEntropy(input);

    // 4. 计算对齐熵值 (H_align)
    const H_align = this.calculateAlignmentEntropy(input);

    const entropy: FourDimensionalEntropy = { H_sys, H_cog, H_struct, H_align };

    // 5. 计算综合熵值
    const composite = this.calculateComposite(entropy);

    // 6. 记录历史
    this.addToHistory({ timestamp: new Date(), entropy, input });

    // 7. 计算趋势
    const trend = this.calculateTrend();

    // 8. 生成告警和建议
    const alerts = this.generateAlerts(entropy, composite);
    const recommendations = this.generateRecommendations(entropy, input);

    return { entropy, composite, trend, alerts, recommendations };
  }

  /**
   * 计算系统熵值
   * 基于错误率、资源使用率等
   */
  private calculateSystemEntropy(input: EntropyInput): number {
    const { logCount, errorCount, warnCount, memoryUsage, cpuUsage } = input;

    if (logCount === 0) return 0;

    // 错误和警告占比
    const errorRate = logCount > 0 ? (errorCount + warnCount * 0.5) / logCount : 0;

    // 资源压力
    const resourcePressure = (memoryUsage + cpuUsage) / 2;

    // 综合系统熵值
    const H_sys = Math.min(1, errorRate * 0.6 + resourcePressure * 0.4);

    return Math.round(H_sys * 1000) / 1000;
  }

  /**
   * 计算认知熵值
   * 基于信息处理复杂度
   */
  private calculateCognitiveEntropy(input: EntropyInput): number {
    const { logCount, avgResponseTime, pendingTasks, completedTasks } = input;

    const totalTasks = pendingTasks + completedTasks;
    if (totalTasks === 0) return 0;

    // 任务积压率
    const backlogRate = pendingTasks / totalTasks;

    // 响应时间因子（基准300ms）
    const responseFactor = Math.min(1, avgResponseTime / 1000);

    // 信息量因子
    const infoFactor = Math.min(1, logCount / 1000);

    // 综合认知熵值
    const H_cog = backlogRate * 0.4 + responseFactor * 0.4 + infoFactor * 0.2;

    return Math.round(H_cog * 1000) / 1000;
  }

  /**
   * 计算结构熵值
   * 基于架构组织复杂度
   */
  private calculateStructuralEntropy(input: EntropyInput): number {
    const { activeAgents, totalAgents, pendingTasks, completedTasks } = input;

    if (totalAgents === 0) return 0;

    // Agent利用率
    const utilization = activeAgents / totalAgents;

    // 任务分布均衡度（理想值0.5）
    const totalTasks = pendingTasks + completedTasks;
    const balance = totalTasks > 0 
      ? 1 - Math.abs(0.5 - pendingTasks / totalTasks) 
      : 1;

    // 结构熵值：低利用率和不均衡分布增加熵值
    const H_struct = (1 - utilization) * 0.5 + (1 - balance) * 0.5;

    return Math.round(H_struct * 1000) / 1000;
  }

  /**
   * 计算对齐熵值
   * 基于目标与行为偏差度
   */
  private calculateAlignmentEntropy(input: EntropyInput): number {
    const { errorCount, violations, completedTasks } = input;

    if (completedTasks === 0) return 0;

    // 宪法违规率
    const violationRate = violations / (completedTasks + violations);

    // 错误率
    const errorRate = errorCount / (completedTasks + errorCount);

    // 对齐熵值
    const H_align = violationRate * 0.6 + errorRate * 0.4;

    return Math.round(H_align * 1000) / 1000;
  }

  /**
   * 计算综合熵值
   */
  private calculateComposite(entropy: FourDimensionalEntropy): number {
    // 加权平均：系统熵值权重最高
    const weights = { H_sys: 0.35, H_cog: 0.25, H_struct: 0.2, H_align: 0.2 };
    
    const composite = 
      entropy.H_sys * weights.H_sys +
      entropy.H_cog * weights.H_cog +
      entropy.H_struct * weights.H_struct +
      entropy.H_align * weights.H_align;

    return Math.round(composite * 1000) / 1000;
  }

  /**
   * 添加到历史记录
   */
  private addToHistory(entry: EntropyHistoryEntry): void {
    this.history.push(entry);
    
    // 保持历史记录大小
    while (this.history.length > this.config.historySize) {
      this.history.shift();
    }
  }

  /**
   * 计算熵值趋势
   */
  private calculateTrend(): 'increasing' | 'decreasing' | 'stable' {
    if (this.history.length < 3) {
      return 'stable';
    }

    const recent = this.history.slice(-5);
    const values = recent.map(h => 
      this.calculateComposite(h.entropy)
    );

    // 计算简单线性趋势
    let sum = 0;
    for (let i = 1; i < values.length; i++) {
      sum += values[i] - values[i - 1];
    }

    const avgChange = sum / (values.length - 1);
    
    if (avgChange > 0.01) return 'increasing';
    if (avgChange < -0.01) return 'decreasing';
    return 'stable';
  }

  /**
   * 生成告警
   */
  private generateAlerts(entropy: FourDimensionalEntropy, composite: number): string[] {
    const alerts: string[] = [];
    const thresholds = this.config.alertThresholds;

    if (entropy.H_sys > thresholds.H_sys) {
      alerts.push(`⚠️ 系统熵值过高: ${entropy.H_sys} > ${thresholds.H_sys}`);
    }
    if (entropy.H_cog > thresholds.H_cog) {
      alerts.push(`⚠️ 认知熵值过高: ${entropy.H_cog} > ${thresholds.H_cog}`);
    }
    if (entropy.H_struct > thresholds.H_struct) {
      alerts.push(`⚠️ 结构熵值过高: ${entropy.H_struct} > ${thresholds.H_struct}`);
    }
    if (entropy.H_align > thresholds.H_align) {
      alerts.push(`⚠️ 对齐熵值过高: ${entropy.H_align} > ${thresholds.H_align}`);
    }
    if (composite > thresholds.composite) {
      alerts.push(`🔴 综合熵值过高: ${composite} > ${thresholds.composite}`);
    }

    return alerts;
  }

  /**
   * 生成建议
   */
  private generateRecommendations(entropy: FourDimensionalEntropy, input: EntropyInput): string[] {
    const recommendations: string[] = [];

    if (entropy.H_sys > 0.5 && input.errorCount > 10) {
      recommendations.push('建议检查错误日志并修复高频错误');
    }
    if (entropy.H_cog > 0.5 && input.pendingTasks > input.completedTasks) {
      recommendations.push('建议增加Agent数量或优化任务分配');
    }
    if (entropy.H_struct > 0.4 && input.activeAgents < input.totalAgents * 0.5) {
      recommendations.push('建议激活更多空闲Agent以提高利用率');
    }
    if (entropy.H_align > 0.3 && input.violations > 0) {
      recommendations.push('建议检查宪法合规性并修复违规行为');
    }
    if (input.memoryUsage > 0.8) {
      recommendations.push('建议清理内存或扩展资源');
    }
    if (input.cpuUsage > 0.8) {
      recommendations.push('建议优化CPU密集型任务或扩展资源');
    }

    return recommendations;
  }

  /**
   * 获取历史记录
   */
  getHistory(limit: number = 10): EntropyHistoryEntry[] {
    return this.history.slice(-limit);
  }

  /**
   * 获取当前熵值快照
   */
  getSnapshot(): {
    latest: EntropyHistoryEntry | null;
    average: FourDimensionalEntropy;
    trend: 'increasing' | 'decreasing' | 'stable';
  } {
    const latest = this.history.length > 0 ? this.history[this.history.length - 1] : null;
    
    // 计算平均值
    const avg: FourDimensionalEntropy = { H_sys: 0, H_cog: 0, H_struct: 0, H_align: 0 };
    if (this.history.length > 0) {
      for (const entry of this.history) {
        avg.H_sys += entry.entropy.H_sys;
        avg.H_cog += entry.entropy.H_cog;
        avg.H_struct += entry.entropy.H_struct;
        avg.H_align += entry.entropy.H_align;
      }
      avg.H_sys = Math.round((avg.H_sys / this.history.length) * 1000) / 1000;
      avg.H_cog = Math.round((avg.H_cog / this.history.length) * 1000) / 1000;
      avg.H_struct = Math.round((avg.H_struct / this.history.length) * 1000) / 1000;
      avg.H_align = Math.round((avg.H_align / this.history.length) * 1000) / 1000;
    }

    return {
      latest,
      average: avg,
      trend: this.calculateTrend(),
    };
  }

  /**
   * 清空历史
   */
  clearHistory(): void {
    this.history = [];
    console.log('[EntropyCalculator] 历史记录已清空');
  }
}

// 单例实例
let calculatorInstance: EntropyCalculator | null = null;

/**
 * 获取熵值计算器单例
 */
export function getEntropyCalculator(config?: Partial<EntropyCalculatorConfig>): EntropyCalculator {
  if (!calculatorInstance) {
    calculatorInstance = new EntropyCalculator(config);
  }
  return calculatorInstance;
}

export default EntropyCalculator;