/**
 * 能力匹配引擎
 * 
 * 根据任务需求智能匹配最优模型
 * 
 * 宪法依据:
 * - §101 同步公理: 代码与文档同步
 * - §102 熵减原则: 智能匹配，减少人工选择
 * - §108 异构模型策略: 显式能力声明
 * 
 * @module llm/CapabilityMatcher
 * @version 1.0.0
 * @category LLM/Matcher
 */

import { ModelAdapter, ModelCapabilities, TaskRequirements, TaskDescription } from './adapters/ModelAdapter';

export type { TaskRequirements, TaskDescription } from './adapters/ModelAdapter';

/**
 * 匹配结果
 */
export interface MatchResult {
  /** 选中的模型 */
  adapter: ModelAdapter;
  
  /** 匹配分数 (0-100) */
  score: number;
  
  /** 匹配详情 */
  details: {
    /** 质量分数 */
    qualityScore: number;
    /** 成本分数 */
    costScore: number;
    /** 性能分数 */
    performanceScore: number;
    /** 匹配的能力 */
    matchedCapabilities: string[];
    /** 缺失的能力 */
    missingCapabilities: string[];
  };
}

/**
 * 能力匹配引擎配置
 */
export interface MatcherConfig {
  /** 质量权重 (0-1) */
  qualityWeight?: number;
  
  /** 成本权重 (0-1) */
  costWeight?: number;
  
  /** 性能权重 (0-1) */
  performanceWeight?: number;
  
  /** 是否启用日志 */
  enableLogging?: boolean;
}

/**
 * 能力匹配引擎
 * 
 * 根据任务需求智能匹配最优模型
 */
export class CapabilityMatcher {
  private config: Required<MatcherConfig>;
  
  constructor(config: MatcherConfig = {}) {
    this.config = {
      qualityWeight: config.qualityWeight ?? 0.4,
      costWeight: config.costWeight ?? 0.3,
      performanceWeight: config.performanceWeight ?? 0.3,
      enableLogging: config.enableLogging ?? true,
    };
    
    // 验证权重总和为1
    const totalWeight = this.config.qualityWeight + this.config.costWeight + this.config.performanceWeight;
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      console.warn(`[CapabilityMatcher] Weights sum to ${totalWeight}, expected 1.0. Normalizing...`);
      this.config.qualityWeight /= totalWeight;
      this.config.costWeight /= totalWeight;
      this.config.performanceWeight /= totalWeight;
    }
    
    if (this.config.enableLogging) {
      console.log('[CapabilityMatcher] Initialized with config:', this.config);
    }
  }
  
  /**
   * 分析任务需求
   */
  analyzeRequirements(task: TaskDescription): TaskRequirements {
    const requirements: TaskRequirements = {
      estimatedTokens: this.estimateTokens(task),
      qualityType: this.detectQualityType(task),
      minQuality: 'intermediate',
      needsStreaming: false,
      needsFunctionCall: false,
      needsVision: false,
    };
    
    // 根据任务复杂度调整需求
    const complexity = this.assessComplexity(task);
    
    if (complexity === 'L4') {
      requirements.minQuality = 'advanced';
    } else if (complexity === 'L1') {
      requirements.minQuality = 'basic';
    }
    
    // 检测是否需要流式输出
    requirements.needsStreaming = this.detectStreamingNeed(task);
    
    // 检测是否需要函数调用
    requirements.needsFunctionCall = this.detectFunctionCallNeed(task);
    
    // 检测是否需要视觉能力
    requirements.needsVision = this.detectVisionNeed(task);
    
    if (this.config.enableLogging) {
      console.log('[CapabilityMatcher] Analyzed requirements:', requirements);
    }
    
    return requirements;
  }
  
  /**
   * 能力匹配评分
   */
  scoreMatch(
    adapter: ModelAdapter,
    requirements: TaskRequirements
  ): number {
    const result = this.match(adapter, requirements);
    return result.score;
  }
  
  /**
   * 匹配模型
   */
  match(adapter: ModelAdapter, requirements: TaskRequirements): MatchResult {
    const details = {
      qualityScore: 0,
      costScore: 0,
      performanceScore: 0,
      matchedCapabilities: [] as string[],
      missingCapabilities: [] as string[],
    };
    
    // 1. 基础能力检查（必须有）
    const requiredCapabilities: string[] = [];
    const presentCapabilities: string[] = [];
    
    if (requirements.needsFunctionCall) {
      requiredCapabilities.push('function_call');
      if (adapter.capabilities.function_call) {
        presentCapabilities.push('function_call');
        details.matchedCapabilities.push('function_call');
      } else {
        details.missingCapabilities.push('function_call');
      }
    }
    
    if (requirements.needsVision) {
      requiredCapabilities.push('vision');
      if (adapter.capabilities.vision) {
        presentCapabilities.push('vision');
        details.matchedCapabilities.push('vision');
      } else {
        details.missingCapabilities.push('vision');
      }
    }
    
    if (requirements.needsStreaming) {
      requiredCapabilities.push('streaming');
      if (adapter.capabilities.streaming) {
        presentCapabilities.push('streaming');
        details.matchedCapabilities.push('streaming');
      } else {
        details.missingCapabilities.push('streaming');
      }
    }
    
    // 如果缺少必需能力，返回0分
    if (requiredCapabilities.length > 0 && presentCapabilities.length < requiredCapabilities.length) {
      return {
        adapter,
        score: 0,
        details,
      };
    }
    
    // 2. 质量匹配 (40%)
    const qualityLevels = { basic: 1, intermediate: 2, advanced: 3 };
    const adapterQuality = adapter.capabilities[`${requirements.qualityType}_quality` as keyof ModelCapabilities];
    const requiredQuality = requirements.minQuality;
    
    const adapterQualityLevel = qualityLevels[adapterQuality as 'basic' | 'intermediate' | 'advanced'];
    const requiredQualityLevel = qualityLevels[requiredQuality];
    
    if (adapterQualityLevel < requiredQualityLevel) {
      // 质量不达标，返回0分
      return {
        adapter,
        score: 0,
        details,
      };
    }
    
    details.qualityScore = (adapterQualityLevel / requiredQualityLevel) * this.config.qualityWeight * 100;
    
    // 3. 成本匹配 (30%)
    if (requirements.maxCost !== undefined) {
      const cost = adapter.getCost(requirements.estimatedTokens);
      const costScore = Math.max(0, 1 - cost / requirements.maxCost);
      details.costScore = costScore * this.config.costWeight * 100;
    } else {
      // 无成本限制，给满分
      details.costScore = this.config.costWeight * 100;
    }
    
    // 4. 性能匹配 (30%)
    let performanceScore = 0;
    
    // 流式支持
    if (requirements.needsStreaming && adapter.capabilities.streaming) {
      performanceScore += 0.5;
    }
    
    // 函数调用支持
    if (requirements.needsFunctionCall && adapter.capabilities.function_call) {
      performanceScore += 0.5;
    }
    
    // 上下文窗口
    if (requirements.estimatedTokens > 0) {
      const contextRatio = adapter.capabilities.context_window / requirements.estimatedTokens;
      if (contextRatio >= 2) {
        performanceScore += 0.3;
      } else if (contextRatio >= 1.5) {
        performanceScore += 0.2;
      } else if (contextRatio >= 1) {
        performanceScore += 0.1;
      }
    }
    
    // 归一化性能分数
    performanceScore = Math.min(performanceScore, 1.0);
    details.performanceScore = performanceScore * this.config.performanceWeight * 100;
    
    // 计算总分
    const totalScore = details.qualityScore + details.costScore + details.performanceScore;
    
    return {
      adapter,
      score: totalScore,
      details,
    };
  }
  
  /**
   * 选择最优模型
   */
  selectBest(
    adapters: ModelAdapter[],
    requirements: TaskRequirements
  ): MatchResult | null {
    if (adapters.length === 0) {
      console.warn('[CapabilityMatcher] No adapters provided');
      return null;
    }
    
    // 匹配所有模型
    const scored = adapters
      .map(adapter => this.match(adapter, requirements))
      .filter(result => result.score > 0)
      .sort((a, b) => b.score - a.score);
    
    if (scored.length === 0) {
      console.warn('[CapabilityMatcher] No models match requirements:', requirements);
      return null;
    }
    
    if (this.config.enableLogging) {
      console.log(`[CapabilityMatcher] Selected best model: ${scored[0].adapter.provider}:${scored[0].adapter.model} (score: ${scored[0].score.toFixed(2)})`);
    }
    
    return scored[0];
  }
  
  /**
   * 估算Token数量
   */
  private estimateTokens(task: TaskDescription): number {
    // 简单的Token估算
    const descLength = task.description.length;
    
    // 英文约4字符=1token，中文约2字符=1token
    const charCount = descLength;
    const englishCount = (task.description.match(/[a-zA-Z]/g) || []).length;
    const englishRatio = englishCount / Math.max(charCount, 1);
    const tokensPerChar = englishRatio > 0.7 ? 0.25 : 0.5;
    
    const estimatedTokens = Math.ceil(charCount * tokensPerChar);
    
    // 考虑输出约为输入的2倍
    return estimatedTokens * 3;
  }
  
  /**
   * 检测任务类型
   */
  private detectQualityType(task: TaskDescription): 'reasoning' | 'coding' | 'creativity' {
    const desc = task.description.toLowerCase();
    const type = task.type?.toLowerCase();
    
    // 优先使用显式类型
    if (type === 'code' || type === 'coding') {
      return 'coding';
    } else if (type === 'creative' || type === 'creativity') {
      return 'creativity';
    } else if (type === 'analysis') {
      return 'reasoning';
    }
    
    // 基于关键词推断
    const codeKeywords = [
      'code', 'function', 'algorithm', 'implement', 'debug',
      'refactor', 'test', 'class', 'interface', 'api'
    ];
    
    const creativeKeywords = [
      'write', 'create', 'story', 'poem', 'creative',
      'generate content', 'draft', 'narrative'
    ];
    
    const analysisKeywords = [
      'analyze', 'reasoning', 'logic', 'solve', 'calculate',
      'explain', 'understand', 'compare', 'evaluate'
    ];
    
    const codeCount = codeKeywords.filter(kw => desc.includes(kw)).length;
    const creativeCount = creativeKeywords.filter(kw => desc.includes(kw)).length;
    const analysisCount = analysisKeywords.filter(kw => desc.includes(kw)).length;
    
    if (codeCount > creativeCount && codeCount > analysisCount) {
      return 'coding';
    } else if (creativeCount > codeCount && creativeCount > analysisCount) {
      return 'creativity';
    } else {
      return 'reasoning';
    }
  }
  
  /**
   * 评估任务复杂度
   */
  private assessComplexity(task: TaskDescription): 'L1' | 'L2' | 'L3' | 'L4' {
    const desc = task.description.toLowerCase();
    const priority = task.priority?.toLowerCase();
    
    // 优先级高，复杂度提升
    if (priority === 'high') {
      return 'L4';
    } else if (priority === 'medium') {
      return 'L3';
    } else if (priority === 'low') {
      return 'L1';
    }
    
    // 基于关键词评估
    const l4Keywords = ['architecture', 'design', 'redesign', 'migration', 'refactor', 'system'];
    const l3Keywords = ['optimize', 'integrate', 'implement', 'feature', 'enhance'];
    const l2Keywords = ['update', 'modify', 'change', 'extend'];
    const l1Keywords = ['fix', 'bug', 'error', 'add', 'simple'];
    
    const l4Count = l4Keywords.filter(kw => desc.includes(kw)).length;
    const l3Count = l3Keywords.filter(kw => desc.includes(kw)).length;
    const l2Count = l2Keywords.filter(kw => desc.includes(kw)).length;
    const l1Count = l1Keywords.filter(kw => desc.includes(kw)).length;
    
    if (l4Count > 0) return 'L4';
    if (l3Count > 0) return 'L3';
    if (l2Count > 0) return 'L2';
    if (l1Count > 0) return 'L1';
    
    // 默认L2
    return 'L2';
  }
  
  /**
   * 检测是否需要流式输出
   */
  private detectStreamingNeed(task: TaskDescription): boolean {
    const desc = task.description.toLowerCase();
    
    // 长任务通常需要流式输出
    if (desc.length > 500) {
      return true;
    }
    
    // 明确要求实时响应
    const streamingKeywords = ['stream', 'real-time', 'instant', 'continuous'];
    return streamingKeywords.some(kw => desc.includes(kw));
  }
  
  /**
   * 检测是否需要函数调用
   */
  private detectFunctionCallNeed(task: TaskDescription): boolean {
    const desc = task.description.toLowerCase();
    
    const functionCallKeywords = [
      'function', 'api call', 'tool', 'execute', 'run',
      'invoke', 'call', 'action'
    ];
    
    return functionCallKeywords.some(kw => desc.includes(kw));
  }
  
  /**
   * 检测是否需要视觉能力
   */
  private detectVisionNeed(task: TaskDescription): boolean {
    const desc = task.description.toLowerCase();
    const type = task.type?.toLowerCase();
    
    if (type === 'vision' || type === 'image' || type === 'multimodal') {
      return true;
    }
    
    const visionKeywords = [
      'image', 'picture', 'photo', 'visual', 'chart',
      'diagram', 'screenshot', 'analyze image'
    ];
    
    return visionKeywords.some(kw => desc.includes(kw));
  }
  
  /**
   * 获取配置
   */
  getConfig(): Readonly<Required<MatcherConfig>> {
    return this.config;
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<MatcherConfig>): void {
    Object.assign(this.config, config);
    
    // 重新验证权重
    const totalWeight = this.config.qualityWeight + this.config.costWeight + this.config.performanceWeight;
    if (Math.abs(totalWeight - 1.0) > 0.01) {
      this.config.qualityWeight /= totalWeight;
      this.config.costWeight /= totalWeight;
      this.config.performanceWeight /= totalWeight;
    }
    
    if (this.config.enableLogging) {
      console.log('[CapabilityMatcher] Config updated:', this.config);
    }
  }
}

export default CapabilityMatcher;
