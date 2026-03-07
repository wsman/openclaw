/**
 * 🚀 决策增强服务
 * 
 * @constitution
 * §102 熵减原则：通过历史知识和上下文优化决策
 * §148 控制论架构公理：记忆回路核心组件
 * §106 Agent协作公理：为Agent提供决策支持
 * 
 * @filename DecisionEnhancer.ts
 * @version 1.0.0
 * @category Service
 * @last_updated 2026-02-26
 */

import { getContextInjector, ContextEntry } from './ContextInjector';
import { getKnowledgeGraphBuilder } from './KnowledgeGraphBuilder';
import { getEntropyCalculator } from './EntropyCalculator';
import { getFactExtractor } from './FactExtractor';

/**
 * 决策选项
 */
export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  score: number;
  factors: DecisionFactor[];
}

/**
 * 决策因子
 */
export interface DecisionFactor {
  name: string;
  weight: number;
  value: number;
  description: string;
}

/**
 * 决策上下文
 */
export interface DecisionContext {
  query: string;
  options: DecisionOption[];
  sessionId?: string;
  agentId?: string;
  constraints?: Record<string, unknown>;
}

/**
 * 增强决策结果
 */
export interface EnhancedDecisionResult {
  recommendedOption: string;
  confidence: number;
  reasoning: string;
  context: ContextEntry[];
  factors: DecisionFactor[];
  alternatives: Array<{ optionId: string; reason: string }>;
  entropyImpact: number;
}

/**
 * 决策历史记录
 */
interface DecisionHistoryEntry {
  timestamp: Date;
  context: DecisionContext;
  result: EnhancedDecisionResult;
  outcome?: 'success' | 'failure' | 'neutral';
}

/**
 * 决策增强器配置
 */
export interface DecisionEnhancerConfig {
  maxHistorySize: number;
  minConfidence: number;
  enableLearning: boolean;
  contextWeight: number;
  entropyWeight: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: DecisionEnhancerConfig = {
  maxHistorySize: 1000,
  minConfidence: 0.6,
  enableLearning: true,
  contextWeight: 0.4,
  entropyWeight: 0.3,
};

/**
 * 决策增强器
 * 基于历史知识和上下文增强决策质量
 */
export class DecisionEnhancer {
  private config: DecisionEnhancerConfig;
  private contextInjector = getContextInjector();
  private graphBuilder = getKnowledgeGraphBuilder();
  private entropyCalculator = getEntropyCalculator();
  private factExtractor = getFactExtractor();
  private history: DecisionHistoryEntry[] = [];

  constructor(config: Partial<DecisionEnhancerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log('[DecisionEnhancer] 初始化完成');
  }

  /**
   * 增强决策
   */
  async enhance(context: DecisionContext): Promise<EnhancedDecisionResult> {
    // 1. 获取相关上下文
    const injectionResult = await this.contextInjector.inject(context.query, {
      sessionId: context.sessionId,
      agentId: context.agentId,
    });
    const contextEntries = injectionResult.entries;

    // 2. 获取熵值状态
    const entropySnapshot = this.entropyCalculator.getSnapshot();
    const currentEntropy = entropySnapshot.latest ? 
      (entropySnapshot.latest.entropy.H_sys + entropySnapshot.latest.entropy.H_cog + 
       entropySnapshot.latest.entropy.H_struct + entropySnapshot.latest.entropy.H_align) / 4 : 0;

    // 3. 评估每个选项
    const evaluatedOptions = context.options.map(option => 
      this.evaluateOption(option, contextEntries, currentEntropy)
    );

    // 4. 选择最佳选项
    const bestOption = evaluatedOptions.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    // 5. 生成推理
    const reasoning = this.generateReasoning(bestOption, contextEntries, evaluatedOptions);

    // 6. 生成备选方案
    const alternatives = evaluatedOptions
      .filter(o => o.id !== bestOption.id)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map(o => ({
        optionId: o.id,
        reason: `得分: ${o.score.toFixed(2)}`,
      }));

    // 7. 计算熵影响
    const entropyImpact = this.calculateEntropyImpact(bestOption, contextEntries);

    const result: EnhancedDecisionResult = {
      recommendedOption: bestOption.id,
      confidence: Math.min(1, bestOption.score / 100),
      reasoning,
      context: contextEntries,
      factors: bestOption.factors,
      alternatives,
      entropyImpact,
    };

    // 8. 记录决策历史
    this.recordDecision(context, result);

    // 9. 提取决策事实
    this.extractDecisionFacts(context, result);

    return result;
  }

  /**
   * 评估单个选项
   */
  private evaluateOption(
    option: DecisionOption,
    contextEntries: ContextEntry[],
    currentEntropy: number
  ): DecisionOption {
    const factors: DecisionFactor[] = [];

    // 1. 上下文相关性因子
    const contextRelevance = this.calculateContextRelevance(option, contextEntries);
    factors.push({
      name: 'contextRelevance',
      weight: this.config.contextWeight,
      value: contextRelevance,
      description: `上下文相关性: ${(contextRelevance * 100).toFixed(0)}%`,
    });

    // 2. 熵减潜力因子
    const entropyReduction = this.calculateEntropyReduction(option, currentEntropy);
    factors.push({
      name: 'entropyReduction',
      weight: this.config.entropyWeight,
      value: entropyReduction,
      description: `熵减潜力: ${(entropyReduction * 100).toFixed(0)}%`,
    });

    // 3. 历史成功率因子
    const historicalSuccess = this.calculateHistoricalSuccess(option);
    factors.push({
      name: 'historicalSuccess',
      weight: 0.2,
      value: historicalSuccess,
      description: `历史成功率: ${(historicalSuccess * 100).toFixed(0)}%`,
    });

    // 4. 资源效率因子
    const resourceEfficiency = this.estimateResourceEfficiency(option);
    factors.push({
      name: 'resourceEfficiency',
      weight: 0.1,
      value: resourceEfficiency,
      description: `资源效率: ${(resourceEfficiency * 100).toFixed(0)}%`,
    });

    // 计算总分
    const score = factors.reduce((sum, factor) => 
      sum + factor.value * factor.weight * 100, 0
    );

    return {
      ...option,
      score: Math.round(score * 100) / 100,
      factors,
    };
  }

  /**
   * 计算上下文相关性
   */
  private calculateContextRelevance(
    option: DecisionOption,
    contextEntries: ContextEntry[]
  ): number {
    if (contextEntries.length === 0) return 0.5;

    const optionText = `${option.label} ${option.description}`.toLowerCase();
    let matchCount = 0;

    for (const entry of contextEntries) {
      const keywords = entry.content.toLowerCase().split(/\s+/);
      for (const keyword of keywords) {
        if (keyword.length > 3 && optionText.includes(keyword)) {
          matchCount++;
        }
      }
    }

    return Math.min(1, matchCount / (contextEntries.length * 3));
  }

  /**
   * 计算熵减潜力
   */
  private calculateEntropyReduction(option: DecisionOption, currentEntropy: number): number {
    // 基于选项类型和当前熵值估算熵减潜力
    const optionText = `${option.label} ${option.description}`.toLowerCase();

    // 高熵值时，倾向于降低复杂度的选项
    if (currentEntropy > 0.6) {
      if (optionText.includes('simplify') || optionText.includes('简化') || 
          optionText.includes('reduce') || optionText.includes('减少')) {
        return 0.9;
      }
      if (optionText.includes('optimize') || optionText.includes('优化')) {
        return 0.8;
      }
    }

    // 中等熵值时，倾向于维持稳定的选项
    if (currentEntropy > 0.3) {
      if (optionText.includes('maintain') || optionText.includes('保持') ||
          optionText.includes('stable') || optionText.includes('稳定')) {
        return 0.7;
      }
    }

    // 默认熵减潜力
    return 0.5;
  }

  /**
   * 计算历史成功率
   */
  private calculateHistoricalSuccess(option: DecisionOption): number {
    const relevantHistory = this.history.filter(entry => 
      entry.result.recommendedOption === option.id ||
      entry.context.options.some(o => o.id === option.id)
    );

    if (relevantHistory.length === 0) return 0.5;

    const successCount = relevantHistory.filter(entry => 
      entry.outcome === 'success'
    ).length;

    const failureCount = relevantHistory.filter(entry => 
      entry.outcome === 'failure'
    ).length;

    if (successCount + failureCount === 0) return 0.5;

    return successCount / (successCount + failureCount);
  }

  /**
   * 估算资源效率
   */
  private estimateResourceEfficiency(option: DecisionOption): number {
    const optionText = `${option.label} ${option.description}`.toLowerCase();

    // 基于关键词估算
    if (optionText.includes('cache') || optionText.includes('缓存')) {
      return 0.9;
    }
    if (optionText.includes('async') || optionText.includes('异步')) {
      return 0.8;
    }
    if (optionText.includes('batch') || optionText.includes('批量')) {
      return 0.85;
    }
    if (optionText.includes('parallel') || optionText.includes('并行')) {
      return 0.8;
    }

    return 0.6;
  }

  /**
   * 生成推理说明
   */
  private generateReasoning(
    bestOption: DecisionOption,
    contextEntries: ContextEntry[],
    allOptions: DecisionOption[]
  ): string {
    const parts: string[] = [];

    parts.push(`推荐选项 "${bestOption.label}" (得分: ${bestOption.score.toFixed(2)})`);

    // 添加主要因素
    const topFactors = bestOption.factors
      .sort((a, b) => (b.value * b.weight) - (a.value * a.weight))
      .slice(0, 2);

    for (const factor of topFactors) {
      parts.push(`- ${factor.description}`);
    }

    // 添加上下文支持
    if (contextEntries.length > 0) {
      parts.push(`- 基于 ${contextEntries.length} 条相关上下文信息`);
    }

    // 添加与其他选项的比较
    if (allOptions.length > 1) {
      const secondBest = allOptions
        .filter(o => o.id !== bestOption.id)
        .sort((a, b) => b.score - a.score)[0];
      
      if (secondBest) {
        const diff = bestOption.score - secondBest.score;
        parts.push(`- 比次优选项 "${secondBest.label}" 高 ${diff.toFixed(2)} 分`);
      }
    }

    return parts.join('\n');
  }

  /**
   * 计算熵影响
   */
  private calculateEntropyImpact(
    option: DecisionOption,
    contextEntries: ContextEntry[]
  ): number {
    const entropyFactor = option.factors.find(f => f.name === 'entropyReduction');
    const contextFactor = option.factors.find(f => f.name === 'contextRelevance');

    const entropyValue = entropyFactor ? entropyFactor.value : 0.5;
    const contextValue = contextFactor ? contextFactor.value : 0.5;

    // 综合熵影响
    return Math.round((entropyValue * 0.6 + contextValue * 0.4) * 100) / 100;
  }

  /**
   * 记录决策历史
   */
  private recordDecision(context: DecisionContext, result: EnhancedDecisionResult): void {
    this.history.push({
      timestamp: new Date(),
      context,
      result,
    });

    // 保持历史记录大小
    while (this.history.length > this.config.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * 提取决策事实
   */
  private extractDecisionFacts(
    context: DecisionContext,
    result: EnhancedDecisionResult
  ): void {
    const decisionText = `决策: ${context.query} -> ${result.recommendedOption} (置信度: ${result.confidence})`;
    
    const facts = this.factExtractor.extract(decisionText, 'decision_enhancer');
    
    // 添加到知识图谱
    this.graphBuilder.addFacts(facts);
  }

  /**
   * 记录决策结果
   */
  recordOutcome(decisionId: string, outcome: 'success' | 'failure' | 'neutral'): void {
    // 查找最近的匹配决策
    const recentDecision = this.history
      .slice()
      .reverse()
      .find(entry => entry.result.recommendedOption === decisionId);

    if (recentDecision) {
      recentDecision.outcome = outcome;
      console.log(`[DecisionEnhancer] 记录决策结果: ${decisionId} -> ${outcome}`);
    }
  }

  /**
   * 获取决策统计
   */
  getStats(): {
    totalDecisions: number;
    successRate: number;
    averageConfidence: number;
    topFactors: Array<{ name: string; averageValue: number }>;
  } {
    const withOutcome = this.history.filter(h => h.outcome !== undefined);
    const successes = withOutcome.filter(h => h.outcome === 'success');

    const avgConfidence = this.history.length > 0
      ? this.history.reduce((sum, h) => sum + h.result.confidence, 0) / this.history.length
      : 0;

    // 计算各因素平均值
    const factorValues = new Map<string, number[]>();
    for (const entry of this.history) {
      for (const factor of entry.result.factors) {
        if (!factorValues.has(factor.name)) {
          factorValues.set(factor.name, []);
        }
        factorValues.get(factor.name)!.push(factor.value);
      }
    }

    const topFactors = Array.from(factorValues.entries())
      .map(([name, values]) => ({
        name,
        averageValue: values.reduce((a, b) => a + b, 0) / values.length,
      }))
      .sort((a, b) => b.averageValue - a.averageValue)
      .slice(0, 5);

    return {
      totalDecisions: this.history.length,
      successRate: withOutcome.length > 0 ? successes.length / withOutcome.length : 0,
      averageConfidence: avgConfidence,
      topFactors,
    };
  }

  /**
   * 获取配置
   */
  getConfig(): DecisionEnhancerConfig {
    return { ...this.config };
  }
}

// 单例实例
let enhancerInstance: DecisionEnhancer | null = null;

/**
 * 获取决策增强器单例
 */
export function getDecisionEnhancer(config?: Partial<DecisionEnhancerConfig>): DecisionEnhancer {
  if (!enhancerInstance) {
    enhancerInstance = new DecisionEnhancer(config);
  }
  return enhancerInstance;
}

export default DecisionEnhancer;