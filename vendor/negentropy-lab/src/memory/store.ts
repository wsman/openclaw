/**
 * 记忆回路核心
 * 
 * @module memory/store
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

// 知识节点
export interface KnowledgeNode {
  id: string;
  type: 'concept' | 'fact' | 'rule' | 'procedure';
  content: string;
  entropy: number;
  createdAt: number;
  updatedAt: number;
  relations: string[];
  vectorized: boolean;
  accessCount: number;
  importance: number;
}

// 知识关系
export interface KnowledgeRelation {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'is-a' | 'has-a' | 'part-of' | 'related-to' | 'derives-from';
  weight: number;
  createdAt: number;
}

// 熵减转换
export interface EntropyTransformation {
  id: string;
  inputEntropy: number;
  outputEntropy: number;
  reduction: number;
  type: string;
  timestamp: number;
}

/**
 * 记忆存储
 */
export class MemoryStore {
  private nodes: Map<string, KnowledgeNode> = new Map();
  private relations: Map<string, KnowledgeRelation> = new Map();
  private transformations: EntropyTransformation[] = [];

  /**
   * 添加知识节点
   */
  addNode(params: {
    type: 'concept' | 'fact' | 'rule' | 'procedure';
    content: string;
    entropy?: number;
    importance?: number;
  }): KnowledgeNode {
    const node: KnowledgeNode = {
      id: uuidv4(),
      type: params.type,
      content: params.content,
      entropy: params.entropy || 1.0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      relations: [],
      vectorized: false,
      accessCount: 0,
      importance: params.importance || 0.5,
    };

    this.nodes.set(node.id, node);
    logger.info(`Added knowledge node: ${node.id}`);
    return node;
  }

  /**
   * 获取节点
   */
  getNode(id: string): KnowledgeNode | undefined {
    const node = this.nodes.get(id);
    if (node) {
      node.accessCount++;
      node.updatedAt = Date.now();
    }
    return node;
  }

  /**
   * 搜索节点
   */
  searchNodes(query: string, limit = 10): KnowledgeNode[] {
    const results: KnowledgeNode[] = [];
    
    for (const node of this.nodes.values()) {
      if (node.content.toLowerCase().includes(query.toLowerCase())) {
        results.push(node);
        if (results.length >= limit) break;
      }
    }
    
    return results;
  }

  /**
   * 添加关系
   */
  addRelation(params: {
    sourceId: string;
    targetId: string;
    type: 'is-a' | 'has-a' | 'part-of' | 'related-to' | 'derives-from';
    weight?: number;
  }): KnowledgeRelation | null {
    const source = this.nodes.get(params.sourceId);
    const target = this.nodes.get(params.targetId);
    
    if (!source || !target) {
      logger.warn(`Cannot create relation: node not found`);
      return null;
    }

    const relation: KnowledgeRelation = {
      id: uuidv4(),
      sourceId: params.sourceId,
      targetId: params.targetId,
      type: params.type,
      weight: params.weight || 1.0,
      createdAt: Date.now(),
    };

    this.relations.set(relation.id, relation);
    source.relations.push(relation.id);
    target.relations.push(relation.id);

    logger.info(`Added relation: ${params.sourceId} -> ${params.targetId}`);
    return relation;
  }

  /**
   * 记录熵减转换
   */
  recordTransformation(params: {
    inputEntropy: number;
    outputEntropy: number;
    type: string;
  }): EntropyTransformation {
    const transformation: EntropyTransformation = {
      id: uuidv4(),
      inputEntropy: params.inputEntropy,
      outputEntropy: params.outputEntropy,
      reduction: params.inputEntropy - params.outputEntropy,
      type: params.type,
      timestamp: Date.now(),
    };

    this.transformations.push(transformation);
    logger.info(`Recorded entropy transformation: -${transformation.reduction}`);
    return transformation;
  }

  /**
   * 获取统计
   */
  getStats(): {
    totalNodes: number;
    totalRelations: number;
    totalTransformations: number;
    avgEntropy: number;
    totalEntropyReduction: number;
  } {
    let totalEntropy = 0;
    for (const node of this.nodes.values()) {
      totalEntropy += node.entropy;
    }

    const totalReduction = this.transformations.reduce(
      (sum, t) => sum + t.reduction,
      0
    );

    return {
      totalNodes: this.nodes.size,
      totalRelations: this.relations.size,
      totalTransformations: this.transformations.length,
      avgEntropy: this.nodes.size > 0 ? totalEntropy / this.nodes.size : 0,
      totalEntropyReduction: totalReduction,
    };
  }

  /**
   * 获取所有节点
   */
  getAllNodes(): KnowledgeNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * 获取所有关系
   */
  getAllRelations(): KnowledgeRelation[] {
    return Array.from(this.relations.values());
  }

  /**
   * 获取转换历史
   */
  getTransformations(limit = 100): EntropyTransformation[] {
    return this.transformations.slice(-limit);
  }
}

// 全局实例
export const memoryStore = new MemoryStore();
