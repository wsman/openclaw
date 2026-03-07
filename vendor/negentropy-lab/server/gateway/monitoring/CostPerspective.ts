/**
 * 🚀 成本透视系统 (Cost Perspective System)
 * 
 * @constitution
 * §101 同步公理：代码变更必须触发文档更新
 * §102 熵减原则：复用现有监控架构
 * §110 协作效率公理：优化成本追踪性能
 * §152 单一真理源：统一成本数据接口
 * §192 LLM成本透明公理：所有LLM调用必须追踪成本
 * §193 成本预算控制公理：支持预算限制和告警
 * 
 * @filename CostPerspective.ts
 * @version 1.0.0
 * @category monitoring
 * @last_updated 2026-02-26
 */

/**
 * LLM提供商
 */
export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GOOGLE = 'google',
  DEEPSEEK = 'deepseek',
  MISTRAL = 'mistral',
  COHERE = 'cohere',
  LOCAL = 'local',
}

/**
 * 成本记录
 */
export interface CostRecord {
  /** 记录ID */
  id: string;
  /** 时间戳 */
  timestamp: Date;
  /** 提供商 */
  provider: LLMProvider;
  /** 模型名称 */
  model: string;
  /** 输入token数 */
  inputTokens: number;
  /** 输出token数 */
  outputTokens: number;
  /** 总token数 */
  totalTokens: number;
  /** 输入成本 (USD) */
  inputCost: number;
  /** 输出成本 (USD) */
  outputCost: number;
  /** 总成本 (USD) */
  totalCost: number;
  /** 请求ID */
  requestId?: string;
  /** 用户ID */
  userId?: string;
  /** 项目ID */
  projectId?: string;
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 成本预算配置
 */
export interface CostBudget {
  /** 预算ID */
  id: string;
  /** 预算名称 */
  name: string;
  /** 预算周期 */
  period: 'daily' | 'weekly' | 'monthly';
  /** 预算金额 (USD) */
  limit: number;
  /** 警告阈值 (百分比) */
  warningThreshold: number;
  /** 临界阈值 (百分比) */
  criticalThreshold: number;
  /** 是否启用 */
  enabled: boolean;
  /** 作用范围 */
  scope: {
    providers?: LLMProvider[];
    models?: string[];
    userIds?: string[];
    projectIds?: string[];
  };
}

/**
 * 成本报告
 */
export interface CostReport {
  /** 报告ID */
  id: string;
  /** 生成时间 */
  generatedAt: Date;
  /** 报告周期 */
  period: {
    start: Date;
    end: Date;
  };
  /** 总成本 */
  totalCost: number;
  /** 按提供商分组 */
  byProvider: Record<LLMProvider, number>;
  /** 按模型分组 */
  byModel: Record<string, number>;
  /** 按用户分组 */
  byUser: Record<string, number>;
  /** 按项目分组 */
  byProject: Record<string, number>;
  /** Token统计 */
  tokenStats: {
    totalInput: number;
    totalOutput: number;
    total: number;
  };
  /** 预算状态 */
  budgetStatus: Array<{
    budget: CostBudget;
    currentSpend: number;
    percentage: number;
    status: 'ok' | 'warning' | 'critical' | 'exceeded';
  }>;
}

/**
 * 模型定价信息
 */
export interface ModelPricing {
  /** 模型名称 */
  model: string;
  /** 提供商 */
  provider: LLMProvider;
  /** 输入价格 (USD per 1K tokens) */
  inputPricePer1K: number;
  /** 输出价格 (USD per 1K tokens) */
  outputPricePer1K: number;
  /** 最后更新时间 */
  lastUpdated: Date;
}

/**
 * 默认模型定价
 * 宪法依据: §192 LLM成本透明公理
 */
const DEFAULT_PRICING: ModelPricing[] = [
  // OpenAI
  { model: 'gpt-4-turbo', provider: LLMProvider.OPENAI, inputPricePer1K: 0.01, outputPricePer1K: 0.03, lastUpdated: new Date('2026-02-01') },
  { model: 'gpt-4', provider: LLMProvider.OPENAI, inputPricePer1K: 0.03, outputPricePer1K: 0.06, lastUpdated: new Date('2026-02-01') },
  { model: 'gpt-3.5-turbo', provider: LLMProvider.OPENAI, inputPricePer1K: 0.0005, outputPricePer1K: 0.0015, lastUpdated: new Date('2026-02-01') },
  // Anthropic
  { model: 'claude-3-opus', provider: LLMProvider.ANTHROPIC, inputPricePer1K: 0.015, outputPricePer1K: 0.075, lastUpdated: new Date('2026-02-01') },
  { model: 'claude-3-sonnet', provider: LLMProvider.ANTHROPIC, inputPricePer1K: 0.003, outputPricePer1K: 0.015, lastUpdated: new Date('2026-02-01') },
  { model: 'claude-3-haiku', provider: LLMProvider.ANTHROPIC, inputPricePer1K: 0.00025, outputPricePer1K: 0.00125, lastUpdated: new Date('2026-02-01') },
  // Google
  { model: 'gemini-pro', provider: LLMProvider.GOOGLE, inputPricePer1K: 0.00025, outputPricePer1K: 0.0005, lastUpdated: new Date('2026-02-01') },
  { model: 'gemini-ultra', provider: LLMProvider.GOOGLE, inputPricePer1K: 0.0025, outputPricePer1K: 0.0075, lastUpdated: new Date('2026-02-01') },
  // DeepSeek
  { model: 'deepseek-chat', provider: LLMProvider.DEEPSEEK, inputPricePer1K: 0.00014, outputPricePer1K: 0.00028, lastUpdated: new Date('2026-02-01') },
  { model: 'deepseek-coder', provider: LLMProvider.DEEPSEEK, inputPricePer1K: 0.00014, outputPricePer1K: 0.00028, lastUpdated: new Date('2026-02-01') },
  // Local (免费)
  { model: 'local-llama', provider: LLMProvider.LOCAL, inputPricePer1K: 0, outputPricePer1K: 0, lastUpdated: new Date('2026-02-01') },
];

/**
 * 成本透视系统
 * 宪法依据: §192 LLM成本透明公理, §193 成本预算控制公理
 */
export class CostPerspectiveSystem {
  private records: CostRecord[] = [];
  private budgets: CostBudget[] = [];
  private pricing: Map<string, ModelPricing> = new Map();
  private metrics = {
    totalRecords: 0,
    totalCost: 0,
    totalTokens: 0,
  };

  constructor() {
    // 初始化定价信息
    for (const p of DEFAULT_PRICING) {
      this.pricing.set(`${p.provider}:${p.model}`, p);
    }
  }

  /**
   * 记录LLM调用成本
   */
  recordCost(params: {
    provider: LLMProvider;
    model: string;
    inputTokens: number;
    outputTokens: number;
    requestId?: string;
    userId?: string;
    projectId?: string;
    metadata?: Record<string, any>;
  }): CostRecord {
    const pricing = this.getPricing(params.provider, params.model);
    
    const inputCost = (params.inputTokens / 1000) * pricing.inputPricePer1K;
    const outputCost = (params.outputTokens / 1000) * pricing.outputPricePer1K;
    const totalCost = inputCost + outputCost;

    const record: CostRecord = {
      id: `cost-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      provider: params.provider,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      totalTokens: params.inputTokens + params.outputTokens,
      inputCost,
      outputCost,
      totalCost,
      requestId: params.requestId,
      userId: params.userId,
      projectId: params.projectId,
      metadata: params.metadata,
    };

    this.records.push(record);
    this.metrics.totalRecords++;
    this.metrics.totalCost += totalCost;
    this.metrics.totalTokens += record.totalTokens;

    // 检查预算
    this.checkBudgets(record);

    return record;
  }

  /**
   * 获取模型定价
   */
  private getPricing(provider: LLMProvider, model: string): ModelPricing {
    const key = `${provider}:${model}`;
    const pricing = this.pricing.get(key);
    
    if (pricing) {
      return pricing;
    }

    // 返回默认定价（未知模型）
    return {
      model,
      provider,
      inputPricePer1K: 0.01,
      outputPricePer1K: 0.03,
      lastUpdated: new Date(),
    };
  }

  /**
   * 添加预算
   */
  addBudget(budget: CostBudget): void {
    this.budgets.push(budget);
  }

  /**
   * 移除预算
   */
  removeBudget(budgetId: string): void {
    this.budgets = this.budgets.filter(b => b.id !== budgetId);
  }

  /**
   * 检查预算
   */
  private checkBudgets(record: CostRecord): void {
    for (const budget of this.budgets) {
      if (!budget.enabled) continue;

      const currentSpend = this.calculatePeriodSpend(budget);
      const percentage = (currentSpend / budget.limit) * 100;

      if (percentage >= budget.criticalThreshold) {
        console.warn(`[CostPerspective] 预算临界: ${budget.name} - ${percentage.toFixed(1)}%`);
        // 触发临界告警
        this.triggerAlert(budget, 'critical', currentSpend, percentage);
      } else if (percentage >= budget.warningThreshold) {
        console.warn(`[CostPerspective] 预算警告: ${budget.name} - ${percentage.toFixed(1)}%`);
        // 触发警告告警
        this.triggerAlert(budget, 'warning', currentSpend, percentage);
      }
    }
  }

  /**
   * 计算周期支出
   */
  private calculatePeriodSpend(budget: CostBudget): number {
    const now = new Date();
    let startDate: Date;

    switch (budget.period) {
      case 'daily':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'weekly':
        const dayOfWeek = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - dayOfWeek);
        break;
      case 'monthly':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    return this.records
      .filter(r => {
        if (r.timestamp < startDate) return false;
        if (budget.scope.providers && !budget.scope.providers.includes(r.provider)) return false;
        if (budget.scope.models && !budget.scope.models.includes(r.model)) return false;
        if (budget.scope.userIds && r.userId && !budget.scope.userIds.includes(r.userId)) return false;
        if (budget.scope.projectIds && r.projectId && !budget.scope.projectIds.includes(r.projectId)) return false;
        return true;
      })
      .reduce((sum, r) => sum + r.totalCost, 0);
  }

  /**
   * 触发告警
   */
  private triggerAlert(budget: CostBudget, level: 'warning' | 'critical', currentSpend: number, percentage: number): void {
    // 这里可以集成到事件系统或通知系统
    const alert = {
      type: 'cost_budget_alert',
      budget: budget.name,
      level,
      currentSpend,
      limit: budget.limit,
      percentage,
      timestamp: new Date(),
    };
    console.log(`[CostPerspective] 告警:`, JSON.stringify(alert));
  }

  /**
   * 生成成本报告
   */
  generateReport(period: { start: Date; end: Date }): CostReport {
    const filteredRecords = this.records.filter(
      r => r.timestamp >= period.start && r.timestamp <= period.end
    );

    const byProvider: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    const byProject: Record<string, number> = {};
    let totalInput = 0;
    let totalOutput = 0;

    for (const record of filteredRecords) {
      // 按提供商
      byProvider[record.provider] = (byProvider[record.provider] || 0) + record.totalCost;
      // 按模型
      byModel[record.model] = (byModel[record.model] || 0) + record.totalCost;
      // 按用户
      if (record.userId) {
        byUser[record.userId] = (byUser[record.userId] || 0) + record.totalCost;
      }
      // 按项目
      if (record.projectId) {
        byProject[record.projectId] = (byProject[record.projectId] || 0) + record.totalCost;
      }
      // Token统计
      totalInput += record.inputTokens;
      totalOutput += record.outputTokens;
    }

    const totalCost = filteredRecords.reduce((sum, r) => sum + r.totalCost, 0);

    // 预算状态
    const budgetStatus = this.budgets.map(budget => {
      const currentSpend = this.calculatePeriodSpend(budget);
      const percentage = (currentSpend / budget.limit) * 100;
      let status: 'ok' | 'warning' | 'critical' | 'exceeded';
      
      if (percentage >= 100) status = 'exceeded';
      else if (percentage >= budget.criticalThreshold) status = 'critical';
      else if (percentage >= budget.warningThreshold) status = 'warning';
      else status = 'ok';

      return { budget, currentSpend, percentage, status };
    });

    return {
      id: `report-${Date.now()}`,
      generatedAt: new Date(),
      period,
      totalCost,
      byProvider: byProvider as Record<LLMProvider, number>,
      byModel,
      byUser,
      byProject,
      tokenStats: {
        totalInput,
        totalOutput,
        total: totalInput + totalOutput,
      },
      budgetStatus,
    };
  }

  /**
   * 获取指标
   */
  getMetrics(): Record<string, any> {
    return {
      ...this.metrics,
      recordCount: this.records.length,
      budgetCount: this.budgets.length,
      pricingCount: this.pricing.size,
    };
  }

  /**
   * 清理旧记录
   */
  cleanupOldRecords(olderThanDays: number): number {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    
    const before = this.records.length;
    this.records = this.records.filter(r => r.timestamp >= cutoff);
    const removed = before - this.records.length;

    if (removed > 0) {
      console.log(`[CostPerspective] 清理了 ${removed} 条旧记录`);
    }

    return removed;
  }
}

// 导出单例
export const costPerspectiveSystem = new CostPerspectiveSystem();
export default costPerspectiveSystem;