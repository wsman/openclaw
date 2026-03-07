/**
 * 🚀 事实提取服务
 * 
 * @constitution
 * §102 熵减原则：从高熵数据中提取低熵事实
 * §148 控制论架构公理：记忆回路核心组件
 * §101 同步公理：确保事实与源数据一致性
 * 
 * @filename FactExtractor.ts
 * @version 1.0.0
 * @category Service
 * @last_updated 2026-02-26
 */

/**
 * 提取的事实
 */
export interface ExtractedFact {
  id: string;
  content: string;
  type: FactType;
  confidence: number;
  source: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

/**
 * 事实类型
 */
export type FactType = 
  | 'event'      // 事件：发生了什么
  | 'entity'     // 实体：涉及的对象
  | 'relation'   // 关系：实体间的联系
  | 'state'      // 状态：系统当前状态
  | 'metric'     // 指标：数值数据
  | 'action'     // 动作：执行的操作
  | 'error'      // 错误：异常信息
  | 'decision';  // 决策：做出的决定

/**
 * 提取模式
 */
export interface ExtractionPattern {
  type: FactType;
  patterns: RegExp[];
  extractors: Array<(match: RegExpMatchArray, text: string) => Partial<ExtractedFact>>;
}

/**
 * 提取配置
 */
export interface FactExtractorConfig {
  minConfidence: number;
  maxFactsPerDocument: number;
  enableNLP: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: FactExtractorConfig = {
  minConfidence: 0.5,
  maxFactsPerDocument: 50,
  enableNLP: false,
};

/**
 * 预定义提取模式
 */
const EXTRACTION_PATTERNS: ExtractionPattern[] = [
  {
    type: 'error',
    patterns: [
      /error[:：]\s*(.+)/gi,
      /exception[:：]\s*(.+)/gi,
      /failed[:：]\s*(.+)/gi,
      /(\w+)\s+error/i,
    ],
    extractors: [
      (match) => ({
        content: match[1] || match[0],
        metadata: { errorType: 'generic' },
      }),
    ],
  },
  {
    type: 'event',
    patterns: [
      /(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})\s+(.+)/g,
      /at\s+(\d{2}:\d{2}:\d{2})\s+(.+)/g,
    ],
    extractors: [
      (match) => ({
        content: match[2] || match[0],
        metadata: { eventTime: match[1] },
      }),
    ],
  },
  {
    type: 'action',
    patterns: [
      /(\w+)\s+(started|completed|finished|initiated)/gi,
      /(starting|starting|initiating)\s+(.+)/gi,
      /(completed|finished)\s+(.+)/gi,
    ],
    extractors: [
      (match) => ({
        content: match[0],
        metadata: { action: match[1], status: match[2] },
      }),
    ],
  },
  {
    type: 'metric',
    patterns: [
      /(\w+)\s*[=：]\s*(\d+\.?\d*)\s*(\w*)/g,
      /(\d+\.?\d*)\s*(ms|mb|%|seconds?|minutes?)/gi,
    ],
    extractors: [
      (match) => ({
        content: match[0],
        metadata: { 
          metricName: match[1], 
          value: parseFloat(match[2]), 
          unit: match[3] 
        },
      }),
    ],
  },
  {
    type: 'entity',
    patterns: [
      /agent[:：]\s*(\w+)/gi,
      /session[:：]\s*(\w+)/gi,
      /room[:：]\s*(\w+)/gi,
      /user[:：]\s*(\w+)/gi,
    ],
    extractors: [
      (match) => ({
        content: match[1],
        metadata: { entityType: match[0].split(':')[0].toLowerCase() },
      }),
    ],
  },
  {
    type: 'state',
    patterns: [
      /status[:：]\s*(\w+)/gi,
      /state[:：]\s*(\w+)/gi,
      /(connected|disconnected|active|inactive|pending|running)/gi,
    ],
    extractors: [
      (match) => ({
        content: match[1] || match[0],
        metadata: { stateValue: match[1] || match[0].toLowerCase() },
      }),
    ],
  },
  {
    type: 'decision',
    patterns: [
      /decision[:：]\s*(.+)/gi,
      /chose\s+(.+)\s+over\s+(.+)/gi,
      /selected[:：]\s*(.+)/gi,
    ],
    extractors: [
      (match) => ({
        content: match[1] || match[0],
        metadata: { decisionContext: match[2] || '' },
      }),
    ],
  },
];

/**
 * 事实提取器
 * 从文本中提取结构化事实
 */
export class FactExtractor {
  private config: FactExtractorConfig;
  private extractionCount: number = 0;

  constructor(config: Partial<FactExtractorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log('[FactExtractor] 初始化完成');
  }

  /**
   * 从文本中提取事实
   */
  extract(text: string, source: string = 'unknown'): ExtractedFact[] {
    const facts: ExtractedFact[] = [];
    const timestamp = new Date();

    for (const pattern of EXTRACTION_PATTERNS) {
      for (const regex of pattern.patterns) {
        let match: RegExpMatchArray | null;
        const globalRegex = new RegExp(regex.source, regex.flags);

        while ((match = globalRegex.exec(text)) !== null) {
          if (facts.length >= this.config.maxFactsPerDocument) {
            break;
          }

          // 使用第一个成功的提取器
          for (const extractor of pattern.extractors) {
            try {
              const partial = extractor(match, text);
              
              if (partial.content) {
                const fact: ExtractedFact = {
                  id: this.generateFactId(),
                  content: partial.content.trim(),
                  type: pattern.type,
                  confidence: this.calculateConfidence(match, text),
                  source,
                  timestamp,
                  metadata: partial.metadata || {},
                };

                // 只保留置信度足够高的事实
                if (fact.confidence >= this.config.minConfidence) {
                  facts.push(fact);
                  this.extractionCount++;
                }
              }
            } catch (error) {
              // 提取失败，继续下一个
              console.warn('[FactExtractor] 提取失败:', error);
            }
          }
        }
      }
    }

    // 去重
    const uniqueFacts = this.deduplicateFacts(facts);

    console.log(`[FactExtractor] 从 ${source} 提取了 ${uniqueFacts.length} 个事实`);
    return uniqueFacts;
  }

  /**
   * 从日志条目中提取事实
   */
  extractFromLog(log: {
    message: string;
    level: string;
    source: string;
    timestamp?: string;
    metadata?: Record<string, unknown>;
  }): ExtractedFact[] {
    const facts = this.extract(log.message, log.source);

    // 为错误日志添加额外的事实
    if (log.level === 'error' || log.level === 'warn') {
      facts.unshift({
        id: this.generateFactId(),
        content: log.message,
        type: 'error',
        confidence: 0.9,
        source: log.source,
        timestamp: new Date(log.timestamp || Date.now()),
        metadata: {
          level: log.level,
          ...log.metadata,
        },
      });
    }

    return facts;
  }

  /**
   * 批量提取事实
   */
  extractBatch(documents: Array<{ text: string; source: string }>): ExtractedFact[] {
    const allFacts: ExtractedFact[] = [];

    for (const doc of documents) {
      const facts = this.extract(doc.text, doc.source);
      allFacts.push(...facts);
    }

    return this.deduplicateFacts(allFacts);
  }

  /**
   * 计算置信度
   */
  private calculateConfidence(match: RegExpMatchArray, text: string): number {
    let confidence = 0.5;

    // 匹配长度因子
    const matchLength = match[0].length;
    const lengthFactor = Math.min(1, matchLength / 50);
    confidence += lengthFactor * 0.2;

    // 匹配位置因子（开头的匹配更可信）
    const position = match.index || 0;
    const positionFactor = 1 - Math.min(1, position / text.length);
    confidence += positionFactor * 0.1;

    // 完整性因子（是否匹配到捕获组）
    if (match.length > 1 && match[1]) {
      confidence += 0.2;
    }

    return Math.min(1, confidence);
  }

  /**
   * 生成事实ID
   */
  private generateFactId(): string {
    return `fact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 去重事实
   */
  private deduplicateFacts(facts: ExtractedFact[]): ExtractedFact[] {
    const seen = new Map<string, ExtractedFact>();

    for (const fact of facts) {
      const key = `${fact.type}:${fact.content}`;
      
      if (!seen.has(key)) {
        seen.set(key, fact);
      } else {
        // 保留置信度更高的
        const existing = seen.get(key)!;
        if (fact.confidence > existing.confidence) {
          seen.set(key, fact);
        }
      }
    }

    return Array.from(seen.values());
  }

  /**
   * 按类型过滤事实
   */
  filterByType(facts: ExtractedFact[], types: FactType[]): ExtractedFact[] {
    return facts.filter(fact => types.includes(fact.type));
  }

  /**
   * 按置信度过滤事实
   */
  filterByConfidence(facts: ExtractedFact[], minConfidence: number): ExtractedFact[] {
    return facts.filter(fact => fact.confidence >= minConfidence);
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalExtractions: number;
    patternsCount: number;
  } {
    return {
      totalExtractions: this.extractionCount,
      patternsCount: EXTRACTION_PATTERNS.length,
    };
  }

  /**
   * 添加自定义模式
   */
  addCustomPattern(pattern: ExtractionPattern): void {
    EXTRACTION_PATTERNS.push(pattern);
    console.log(`[FactExtractor] 添加自定义模式: ${pattern.type}`);
  }
}

// 单例实例
let extractorInstance: FactExtractor | null = null;

/**
 * 获取事实提取器单例
 */
export function getFactExtractor(config?: Partial<FactExtractorConfig>): FactExtractor {
  if (!extractorInstance) {
    extractorInstance = new FactExtractor(config);
  }
  return extractorInstance;
}

export default FactExtractor;