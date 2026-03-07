/**
 * 🚀 知识图谱构建服务
 * 
 * @constitution
 * §102 熵减原则：通过知识图谱组织信息降低复杂度
 * §148 控制论架构公理：记忆回路核心组件
 * §101 同步公理：确保知识图谱与事实同步
 * 
 * @filename KnowledgeGraphBuilder.ts
 * @version 1.0.0
 * @category Service
 * @last_updated 2026-02-26
 */

import { ExtractedFact, FactType } from './FactExtractor';

/**
 * 知识节点
 */
export interface KnowledgeNode {
  id: string;
  type: NodeType;
  label: string;
  properties: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  accessCount: number;
}

/**
 * 节点类型
 */
export type NodeType = 
  | 'entity'      // 实体：Agent、Session、Room等
  | 'event'       // 事件：发生的动作
  | 'concept'     // 概念：抽象概念
  | 'metric'      // 指标：数值
  | 'error'       // 错误：异常
  | 'state'       // 状态：系统状态
  | 'decision';   // 决策：做出的选择

/**
 * 知识边
 */
export interface KnowledgeEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: EdgeType;
  weight: number;
  properties: Record<string, unknown>;
  createdAt: Date;
}

/**
 * 边类型
 */
export type EdgeType = 
  | 'caused'        // 导致
  | 'related'       // 相关
  | 'followed'      // 随后发生
  | 'belongs'       // 属于
  | 'contains'      // 包含
  | 'references'    // 引用
  | 'occurred_at'   // 发生在
  | 'performed_by'  // 由...执行
  | 'resulted_in';  // 导致结果

/**
 * 知识图谱
 */
export interface KnowledgeGraph {
  nodes: Map<string, KnowledgeNode>;
  edges: Map<string, KnowledgeEdge>;
  metadata: {
    nodeCount: number;
    edgeCount: number;
    lastUpdated: Date;
  };
}

/**
 * 图谱查询结果
 */
export interface GraphQueryResult {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  paths: Array<Array<{ node: KnowledgeNode; edge?: KnowledgeEdge }>>;
}

/**
 * 构建器配置
 */
export interface KnowledgeGraphBuilderConfig {
  maxNodes: number;
  maxEdges: number;
  pruneAfterDays: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: KnowledgeGraphBuilderConfig = {
  maxNodes: 10000,
  maxEdges: 50000,
  pruneAfterDays: 30,
};

/**
 * 事实类型到节点类型映射
 */
const FACT_TO_NODE_TYPE: Record<FactType, NodeType> = {
  entity: 'entity',
  event: 'event',
  relation: 'concept',
  state: 'state',
  metric: 'metric',
  action: 'event',
  error: 'error',
  decision: 'decision',
};

/**
 * 知识图谱构建器
 * 从提取的事实构建知识图谱
 */
export class KnowledgeGraphBuilder {
  private config: KnowledgeGraphBuilderConfig;
  private graph: KnowledgeGraph;

  constructor(config: Partial<KnowledgeGraphBuilderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.graph = {
      nodes: new Map(),
      edges: new Map(),
      metadata: {
        nodeCount: 0,
        edgeCount: 0,
        lastUpdated: new Date(),
      },
    };
    console.log('[KnowledgeGraphBuilder] 初始化完成');
  }

  /**
   * 从事实添加节点
   */
  addFact(fact: ExtractedFact): KnowledgeNode | null {
    const nodeType = FACT_TO_NODE_TYPE[fact.type];
    
    // 检查节点数量限制
    if (this.graph.nodes.size >= this.config.maxNodes) {
      this.pruneOldestNodes(100);
    }

    // 检查是否已存在相似节点
    const existingNode = this.findSimilarNode(fact.content, nodeType);
    if (existingNode) {
      // 更新访问计数和时间
      existingNode.accessCount++;
      existingNode.updatedAt = new Date();
      return existingNode;
    }

    // 创建新节点
    const node: KnowledgeNode = {
      id: this.generateNodeId(),
      type: nodeType,
      label: fact.content.substring(0, 100),
      properties: {
        source: fact.source,
        confidence: fact.confidence,
        originalType: fact.type,
        ...fact.metadata,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      accessCount: 1,
    };

    this.graph.nodes.set(node.id, node);
    this.graph.metadata.nodeCount = this.graph.nodes.size;
    this.graph.metadata.lastUpdated = new Date();

    return node;
  }

  /**
   * 批量添加事实
   */
  addFacts(facts: ExtractedFact[]): KnowledgeNode[] {
    const nodes: KnowledgeNode[] = [];

    for (const fact of facts) {
      const node = this.addFact(fact);
      if (node) {
        nodes.push(node);
      }
    }

    // 自动建立关联
    this.autoLinkNodes(nodes);

    return nodes;
  }

  /**
   * 添加边
   */
  addEdge(
    sourceId: string,
    targetId: string,
    type: EdgeType,
    properties: Record<string, unknown> = {},
    weight: number = 1.0
  ): KnowledgeEdge | null {
    // 验证节点存在
    if (!this.graph.nodes.has(sourceId) || !this.graph.nodes.has(targetId)) {
      return null;
    }

    // 检查是否已存在相同边
    for (const [, edge] of this.graph.edges) {
      if (edge.sourceId === sourceId && edge.targetId === targetId && edge.type === type) {
        edge.weight = Math.min(edge.weight + 0.1, 1.0);
        return edge;
      }
    }

    // 检查边数量限制
    if (this.graph.edges.size >= this.config.maxEdges) {
      this.pruneOldestEdges(100);
    }

    const edge: KnowledgeEdge = {
      id: this.generateEdgeId(),
      sourceId,
      targetId,
      type,
      weight,
      properties,
      createdAt: new Date(),
    };

    this.graph.edges.set(edge.id, edge);
    this.graph.metadata.edgeCount = this.graph.edges.size;
    this.graph.metadata.lastUpdated = new Date();

    return edge;
  }

  /**
   * 自动关联节点
   */
  private autoLinkNodes(nodes: KnowledgeNode[]): void {
    if (nodes.length < 2) return;

    // 基于时间顺序建立followed关系
    for (let i = 1; i < nodes.length; i++) {
      const prev = nodes[i - 1];
      const curr = nodes[i];
      
      // 同类型节点建立followed关系
      if (prev.type === curr.type) {
        this.addEdge(prev.id, curr.id, 'followed', {}, 0.5);
      }

      // 错误节点与事件节点建立caused关系
      if (prev.type === 'event' && curr.type === 'error') {
        this.addEdge(prev.id, curr.id, 'caused', {}, 0.8);
      }
    }

    // 基于相同源建立related关系
    const sourceGroups = new Map<string, KnowledgeNode[]>();
    for (const node of nodes) {
      const source = String(node.properties.source || '');
      if (!sourceGroups.has(source)) {
        sourceGroups.set(source, []);
      }
      sourceGroups.get(source)!.push(node);
    }

    for (const [, group] of sourceGroups) {
      if (group.length > 1) {
        for (let i = 1; i < group.length; i++) {
          this.addEdge(group[i - 1].id, group[i].id, 'related', {}, 0.3);
        }
      }
    }
  }

  /**
   * 查找相似节点
   */
  private findSimilarNode(content: string, type: NodeType): KnowledgeNode | null {
    const normalizedContent = content.toLowerCase().trim();

    for (const [, node] of this.graph.nodes) {
      if (node.type === type) {
        const similarity = this.calculateSimilarity(
          normalizedContent,
          node.label.toLowerCase()
        );
        if (similarity > 0.8) {
          return node;
        }
      }
    }

    return null;
  }

  /**
   * 计算相似度（简单Jaccard）
   */
  private calculateSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.split(/\s+/));
    const wordsB = new Set(b.split(/\s+/));
    
    const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);
    
    return intersection.size / union.size;
  }

  /**
   * 生成节点ID
   */
  private generateNodeId(): string {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成边ID
   */
  private generateEdgeId(): string {
    return `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 查询节点
   */
  queryNodes(options: {
    type?: NodeType;
    labelContains?: string;
    limit?: number;
  }): KnowledgeNode[] {
    let results = Array.from(this.graph.nodes.values());

    if (options.type) {
      results = results.filter(n => n.type === options.type);
    }

    if (options.labelContains) {
      const search = options.labelContains.toLowerCase();
      results = results.filter(n => n.label.toLowerCase().includes(search));
    }

    // 按更新时间排序
    results.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * 获取节点的邻居
   */
  getNeighbors(nodeId: string, depth: number = 1): GraphQueryResult {
    const nodes: KnowledgeNode[] = [];
    const edges: KnowledgeEdge[] = [];
    const visited = new Set<string>();
    const queue: Array<{ id: string; level: number }> = [{ id: nodeId, level: 0 }];

    while (queue.length > 0) {
      const { id, level } = queue.shift()!;

      if (visited.has(id) || level > depth) continue;
      visited.add(id);

      const node = this.graph.nodes.get(id);
      if (node) {
        nodes.push(node);
      }

      // 查找相关边
      for (const [, edge] of this.graph.edges) {
        if (edge.sourceId === id && !visited.has(edge.targetId)) {
          edges.push(edge);
          queue.push({ id: edge.targetId, level: level + 1 });
        } else if (edge.targetId === id && !visited.has(edge.sourceId)) {
          edges.push(edge);
          queue.push({ id: edge.sourceId, level: level + 1 });
        }
      }
    }

    return { nodes, edges, paths: [] };
  }

  /**
   * 查找路径
   */
  findPath(fromId: string, toId: string, maxDepth: number = 5): GraphQueryResult {
    const paths: Array<Array<{ node: KnowledgeNode; edge?: KnowledgeEdge }>> = [];
    const visited = new Set<string>();
    const graph = this.graph;

    const dfs = (
      currentId: string, 
      targetId: string, 
      path: Array<{ node: KnowledgeNode; edge?: KnowledgeEdge }>,
      depth: number
    ): boolean => {
      if (depth > maxDepth) return false;
      if (visited.has(currentId)) return false;

      const node = graph.nodes.get(currentId);
      if (!node) return false;

      visited.add(currentId);
      path.push({ node });

      if (currentId === targetId) {
        paths.push([...path]);
        return true;
      }

      // 搜索邻居
      for (const [, edge] of graph.edges) {
        if (edge.sourceId === currentId) {
          path[path.length - 1].edge = edge;
          dfs(edge.targetId, targetId, path, depth + 1);
        }
      }

      path.pop();
      visited.delete(currentId);
      return false;
    };

    dfs(fromId, toId, [], 0);

    const nodes = new Map<string, KnowledgeNode>();
    const edges = new Map<string, KnowledgeEdge>();

    for (const path of paths) {
      for (const step of path) {
        nodes.set(step.node.id, step.node);
        if (step.edge) {
          edges.set(step.edge.id, step.edge);
        }
      }
    }

    return {
      nodes: Array.from(nodes.values()),
      edges: Array.from(edges.values()),
      paths,
    };
  }

  /**
   * 清理最旧的节点
   */
  private pruneOldestNodes(count: number): void {
    const sorted = Array.from(this.graph.nodes.values())
      .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
    
    for (let i = 0; i < Math.min(count, sorted.length); i++) {
      const node = sorted[i];
      this.graph.nodes.delete(node.id);
      
      // 删除相关边
      for (const [edgeId, edge] of this.graph.edges) {
        if (edge.sourceId === node.id || edge.targetId === node.id) {
          this.graph.edges.delete(edgeId);
        }
      }
    }

    this.graph.metadata.nodeCount = this.graph.nodes.size;
    this.graph.metadata.edgeCount = this.graph.edges.size;
  }

  /**
   * 清理最旧的边
   */
  private pruneOldestEdges(count: number): void {
    const sorted = Array.from(this.graph.edges.values())
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    for (let i = 0; i < Math.min(count, sorted.length); i++) {
      this.graph.edges.delete(sorted[i].id);
    }

    this.graph.metadata.edgeCount = this.graph.edges.size;
  }

  /**
   * 获取图谱统计
   */
  getStats(): {
    nodeCount: number;
    edgeCount: number;
    nodeTypes: Record<NodeType, number>;
    edgeTypes: Record<EdgeType, number>;
  } {
    const nodeTypes: Record<string, number> = {};
    const edgeTypes: Record<string, number> = {};

    for (const [, node] of this.graph.nodes) {
      nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
    }

    for (const [, edge] of this.graph.edges) {
      edgeTypes[edge.type] = (edgeTypes[edge.type] || 0) + 1;
    }

    return {
      nodeCount: this.graph.nodes.size,
      edgeCount: this.graph.edges.size,
      nodeTypes: nodeTypes as Record<NodeType, number>,
      edgeTypes: edgeTypes as Record<EdgeType, number>,
    };
  }

  /**
   * 导出图谱
   */
  export(): {
    nodes: Array<{ id: string; type: string; label: string; properties: Record<string, unknown> }>;
    edges: Array<{ id: string; sourceId: string; targetId: string; type: string; weight: number }>;
    metadata: KnowledgeGraph['metadata'];
  } {
    return {
      nodes: Array.from(this.graph.nodes.values()).map(n => ({
        id: n.id,
        type: n.type,
        label: n.label,
        properties: n.properties,
      })),
      edges: Array.from(this.graph.edges.values()).map(e => ({
        id: e.id,
        sourceId: e.sourceId,
        targetId: e.targetId,
        type: e.type,
        weight: e.weight,
      })),
      metadata: this.graph.metadata,
    };
  }

  /**
   * 清空图谱
   */
  clear(): void {
    this.graph.nodes.clear();
    this.graph.edges.clear();
    this.graph.metadata.nodeCount = 0;
    this.graph.metadata.edgeCount = 0;
    this.graph.metadata.lastUpdated = new Date();
    console.log('[KnowledgeGraphBuilder] 图谱已清空');
  }
}

// 单例实例
let builderInstance: KnowledgeGraphBuilder | null = null;

/**
 * 获取知识图谱构建器单例
 */
export function getKnowledgeGraphBuilder(config?: Partial<KnowledgeGraphBuilderConfig>): KnowledgeGraphBuilder {
  if (!builderInstance) {
    builderInstance = new KnowledgeGraphBuilder(config);
  }
  return builderInstance;
}

export default KnowledgeGraphBuilder;
