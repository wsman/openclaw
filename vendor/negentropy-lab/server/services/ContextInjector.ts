/**
 * 🚀 上下文注入服务
 * 
 * @constitution
 * §102 熵减原则：通过智能上下文注入降低信息熵
 * §148 控制论架构公理：记忆回路核心组件
 * §106 Agent协作公理：为Agent提供上下文支持
 * 
 * @filename ContextInjector.ts
 * @version 1.0.0
 * @category Service
 * @last_updated 2026-02-26
 */

import { getVectorizationPipeline } from './VectorizationPipeline';
import { getKnowledgeGraphBuilder, KnowledgeNode } from './KnowledgeGraphBuilder';
import { getEntropyCalculator } from './EntropyCalculator';

/**
 * 注入上下文类型
 */
export type ContextType = 
  | 'session'     // 会话上下文
  | 'agent'       // Agent上下文
  | 'task'        // 任务上下文
  | 'error'       // 错误上下文
  | 'decision'    // 决策上下文
  | 'knowledge';  // 知识上下文

/**
 * 上下文条目
 */
export interface ContextEntry {
  type: ContextType;
  content: string;
  relevance: number;
  source: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

/**
 * 注入结果
 */
export interface InjectionResult {
  entries: ContextEntry[];
  totalTokens: number;
  sources: string[];
  entropyImpact: number;
}

/**
 * 注入配置
 */
export interface ContextInjectorConfig {
  maxEntries: number;
  maxTokens: number;
  minRelevance: number;
  includeEntropy: boolean;
  includeKnowledge: boolean;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: ContextInjectorConfig = {
  maxEntries: 10,
  maxTokens: 2000,
  minRelevance: 0.5,
  includeEntropy: true,
  includeKnowledge: true,
};

/**
 * 上下文注入器
 * 为Agent和任务提供相关上下文
 */
export class ContextInjector {
  private config: ContextInjectorConfig;
  private pipeline = getVectorizationPipeline();
  private graphBuilder = getKnowledgeGraphBuilder();

  constructor(config: Partial<ContextInjectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log('[ContextInjector] 初始化完成');
  }

  /**
   * 为查询注入上下文
   */
  async inject(query: string, options: {
    types?: ContextType[];
    sessionId?: string;
    agentId?: string;
    collection?: string;
  } = {}): Promise<InjectionResult> {
    const entries: ContextEntry[] = [];
    let totalTokens = 0;
    const sources: string[] = [];
    let entropyImpact = 0;

    // 1. 从向量存储搜索相关上下文
    if (!options.types || options.types.includes('knowledge')) {
      const vectorEntries = await this.searchVectorContext(query, options.collection);
      entries.push(...vectorEntries);
      sources.push('vector_store');
    }

    // 2. 从知识图谱获取相关上下文
    if (this.config.includeKnowledge && (!options.types || options.types.includes('knowledge'))) {
      const graphEntries = await this.getGraphContext(query);
      entries.push(...graphEntries);
      sources.push('knowledge_graph');
    }

    // 3. 获取会话上下文
    if (options.sessionId && (!options.types || options.types.includes('session'))) {
      const sessionEntries = await this.getSessionContext(options.sessionId);
      entries.push(...sessionEntries);
      sources.push('session');
    }

    // 4. 获取Agent上下文
    if (options.agentId && (!options.types || options.types.includes('agent'))) {
      const agentEntries = await this.getAgentContext(options.agentId);
      entries.push(...agentEntries);
      sources.push('agent');
    }

    // 5. 添加熵值上下文
    if (this.config.includeEntropy) {
      const entropyEntries = this.getEntropyContext();
      entries.push(...entropyEntries);
      sources.push('entropy_calculator');
    }

    // 6. 排序和过滤
    const filteredEntries = this.filterAndRank(entries);

    // 7. 限制token数量
    const limitedEntries = this.limitTokens(filteredEntries);

    // 计算总token数和熵影响
    totalTokens = limitedEntries.reduce((sum, e) => sum + this.estimateTokens(e.content), 0);
    entropyImpact = this.calculateEntropyImpact(limitedEntries);

    return {
      entries: limitedEntries,
      totalTokens,
      sources: [...new Set(sources)],
      entropyImpact,
    };
  }

  /**
   * 从向量存储搜索上下文
   */
  private async searchVectorContext(
    query: string,
    collection: string = 'openclaw_logs'
  ): Promise<ContextEntry[]> {
    try {
      const results = await this.pipeline.search(collection, query, 5, this.config.minRelevance);

      return results.map(result => ({
        type: 'knowledge' as ContextType,
        content: result.content,
        relevance: result.score,
        source: 'vector_search',
        timestamp: new Date(),
        metadata: result.metadata,
      }));
    } catch (error) {
      console.error('[ContextInjector] 向量搜索失败:', error);
      return [];
    }
  }

  /**
   * 从知识图谱获取上下文
   */
  private async getGraphContext(query: string): Promise<ContextEntry[]> {
    const entries: ContextEntry[] = [];

    try {
      // 搜索相关节点
      const nodes = this.graphBuilder.queryNodes({
        labelContains: query.substring(0, 20),
        limit: 5,
      });

      for (const node of nodes) {
        entries.push({
          type: 'knowledge',
          content: this.formatNodeContent(node),
          relevance: 0.7,
          source: 'knowledge_graph',
          timestamp: node.updatedAt,
          metadata: node.properties,
        });

        // 获取邻居节点
        const neighbors = this.graphBuilder.getNeighbors(node.id, 1);
        for (const neighbor of neighbors.nodes.slice(0, 3)) {
          if (neighbor.id !== node.id) {
            entries.push({
              type: 'knowledge',
              content: this.formatNodeContent(neighbor),
              relevance: 0.5,
              source: 'knowledge_graph_neighbor',
              timestamp: neighbor.updatedAt,
              metadata: neighbor.properties,
            });
          }
        }
      }
    } catch (error) {
      console.error('[ContextInjector] 知识图谱查询失败:', error);
    }

    return entries;
  }

  /**
   * 获取会话上下文
   */
  private async getSessionContext(sessionId: string): Promise<ContextEntry[]> {
    // 从向量存储搜索会话相关内容
    try {
      const results = await this.pipeline.search(
        'openclaw_logs',
        `session:${sessionId}`,
        3,
        0.3
      );

      return results.map(result => ({
        type: 'session' as ContextType,
        content: result.content,
        relevance: result.score * 0.8,
        source: 'session_history',
        timestamp: new Date(),
        metadata: { sessionId, ...result.metadata },
      }));
    } catch (error) {
      console.error('[ContextInjector] 会话上下文获取失败:', error);
      return [];
    }
  }

  /**
   * 获取Agent上下文
   */
  private async getAgentContext(agentId: string): Promise<ContextEntry[]> {
    try {
      const results = await this.pipeline.search(
        'openclaw_logs',
        `agent:${agentId}`,
        3,
        0.3
      );

      return results.map(result => ({
        type: 'agent' as ContextType,
        content: result.content,
        relevance: result.score * 0.8,
        source: 'agent_history',
        timestamp: new Date(),
        metadata: { agentId, ...result.metadata },
      }));
    } catch (error) {
      console.error('[ContextInjector] Agent上下文获取失败:', error);
      return [];
    }
  }

  /**
   * 获取熵值上下文
   */
  private getEntropyContext(): ContextEntry[] {
    const calculator = getEntropyCalculator();
    const snapshot = calculator.getSnapshot();

    if (!snapshot.latest) {
      return [];
    }

    return [{
      type: 'knowledge',
      content: `系统熵值状态: H_sys=${snapshot.latest.entropy.H_sys}, ` +
               `H_cog=${snapshot.latest.entropy.H_cog}, ` +
               `H_struct=${snapshot.latest.entropy.H_struct}, ` +
               `H_align=${snapshot.latest.entropy.H_align}, ` +
               `趋势=${snapshot.trend}`,
      relevance: 0.6,
      source: 'entropy_monitor',
      timestamp: new Date(),
      metadata: {
        entropy: snapshot.latest.entropy,
        trend: snapshot.trend,
      },
    }];
  }

  /**
   * 格式化节点内容
   */
  private formatNodeContent(node: KnowledgeNode): string {
    return `[${node.type}] ${node.label}`;
  }

  /**
   * 过滤和排序条目
   */
  private filterAndRank(entries: ContextEntry[]): ContextEntry[] {
    // 过滤低相关性条目
    const filtered = entries.filter(e => e.relevance >= this.config.minRelevance);

    // 按相关性排序
    filtered.sort((a, b) => b.relevance - a.relevance);

    // 限制数量
    return filtered.slice(0, this.config.maxEntries);
  }

  /**
   * 限制token数量
   */
  private limitTokens(entries: ContextEntry[]): ContextEntry[] {
    const result: ContextEntry[] = [];
    let totalTokens = 0;

    for (const entry of entries) {
      const tokens = this.estimateTokens(entry.content);
      if (totalTokens + tokens <= this.config.maxTokens) {
        result.push(entry);
        totalTokens += tokens;
      }
    }

    return result;
  }

  /**
   * 估算token数量
   */
  private estimateTokens(text: string): number {
    // 简单估算：每4个字符约1个token
    return Math.ceil(text.length / 4);
  }

  /**
   * 计算熵影响
   */
  private calculateEntropyImpact(entries: ContextEntry[]): number {
    if (entries.length === 0) return 0;

    // 基于相关性和数量的熵减少估算
    const avgRelevance = entries.reduce((sum, e) => sum + e.relevance, 0) / entries.length;
    const diversity = new Set(entries.map(e => e.type)).size / 6;

    return Math.round((avgRelevance * 0.7 + diversity * 0.3) * 100) / 100;
  }

  /**
   * 构建提示上下文
   */
  buildPromptContext(entries: ContextEntry[]): string {
    if (entries.length === 0) {
      return '';
    }

    const sections: string[] = ['## 相关上下文\n'];

    // 按类型分组
    const grouped = new Map<ContextType, ContextEntry[]>();
    for (const entry of entries) {
      if (!grouped.has(entry.type)) {
        grouped.set(entry.type, []);
      }
      grouped.get(entry.type)!.push(entry);
    }

    // 构建各部分
    for (const [type, typeEntries] of grouped) {
      sections.push(`### ${this.getTypeLabel(type)}`);
      for (const entry of typeEntries) {
        sections.push(`- ${entry.content}`);
      }
      sections.push('');
    }

    return sections.join('\n');
  }

  /**
   * 获取类型标签
   */
  private getTypeLabel(type: ContextType): string {
    const labels: Record<ContextType, string> = {
      session: '会话历史',
      agent: 'Agent信息',
      task: '任务相关',
      error: '错误信息',
      decision: '决策记录',
      knowledge: '知识库',
    };
    return labels[type] || type;
  }

  /**
   * 获取配置
   */
  getConfig(): ContextInjectorConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<ContextInjectorConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[ContextInjector] 配置已更新');
  }
}

// 单例实例
let injectorInstance: ContextInjector | null = null;

/**
 * 获取上下文注入器单例
 */
export function getContextInjector(config?: Partial<ContextInjectorConfig>): ContextInjector {
  if (!injectorInstance) {
    injectorInstance = new ContextInjector(config);
  }
  return injectorInstance;
}

export default ContextInjector;