/**
 * 🚀 OpenClaw日志适配器
 * 
 * @constitution
 * §102 熵减原则：通过日志捕获和处理降低系统熵值
 * §148 控制论架构公理：观测回路组件
 * §101 同步公理：确保日志数据同步
 * 
 * @filename OpenClawLogAdapter.ts
 * @version 1.0.0
 * @category Adapter
 * @last_updated 2026-02-26
 */

import { getVectorizationPipeline } from '../services/VectorizationPipeline';

/**
 * OpenClaw日志条目
 */
export interface OpenClawLogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  source: string;
  sessionId?: string;
  agentId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 日志适配器配置
 */
export interface OpenClawLogAdapterConfig {
  openclawPath: string;
  batchSize: number;
  flushInterval: number;
  logPatterns: string[];
  excludePatterns: string[];
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Partial<OpenClawLogAdapterConfig> = {
  batchSize: 50,
  flushInterval: 5000,
  logPatterns: ['*.log', '*.json'],
  excludePatterns: ['*.tmp', '*.bak'],
};

/**
 * OpenClaw日志适配器
 * 负责捕获、处理和向量化OpenClaw日志
 */
export class OpenClawLogAdapter {
  private config: Partial<OpenClawLogAdapterConfig>;
  private openclawPath: string;
  private buffer: OpenClawLogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private pipeline = getVectorizationPipeline();

  constructor(openclawPath: string, config: Partial<OpenClawLogAdapterConfig> = {}) {
    this.openclawPath = openclawPath;
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log(`[OpenClawLogAdapter] 初始化，路径: ${openclawPath}`);
  }

  /**
   * 启动适配器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[OpenClawLogAdapter] 适配器已在运行');
      return;
    }

    this.isRunning = true;

    // 启动定时刷新
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);

    console.log('[OpenClawLogAdapter] 适配器已启动');
  }

  /**
   * 停止适配器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // 停止定时器
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // 刷新剩余日志
    await this.flush();

    console.log('[OpenClawLogAdapter] 适配器已停止');
  }

  /**
   * 接收日志条目
   */
  ingestLog(entry: OpenClawLogEntry): void {
    this.buffer.push(entry);

    // 达到批量大小时自动刷新
    if (this.buffer.length >= this.config.batchSize!) {
      this.flush();
    }
  }

  /**
   * 批量接收日志
   */
  ingestLogs(entries: OpenClawLogEntry[]): void {
    this.buffer.push(...entries);

    // 达到批量大小时自动刷新
    if (this.buffer.length >= this.config.batchSize!) {
      this.flush();
    }
  }

  /**
   * 刷新缓冲区到向量化流水线
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const logsToProcess = [...this.buffer];
    this.buffer = [];

    console.log(`[OpenClawLogAdapter] 刷新 ${logsToProcess.length} 条日志`);

    // 转换为向量化任务
    const tasks = logsToProcess.map(entry => ({
      id: `log_${entry.timestamp}_${Math.random().toString(36).substr(2, 9)}`,
      content: this.formatLogContent(entry),
      metadata: {
        type: 'openclaw_log',
        timestamp: entry.timestamp,
        level: entry.level,
        source: entry.source,
        sessionId: entry.sessionId,
        agentId: entry.agentId,
        ...entry.metadata,
      },
      collection: 'openclaw_logs',
      priority: entry.level === 'error' ? 'high' as const : 
                entry.level === 'warn' ? 'medium' as const : 'low' as const,
    }));

    // 添加到流水线
    this.pipeline.addBatchTasks(tasks);

    // 处理流水线
    await this.pipeline.processQueue();
  }

  /**
   * 格式化日志内容用于向量化
   */
  private formatLogContent(entry: OpenClawLogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level.toUpperCase()}]`,
      `[${entry.source}]`,
      entry.message,
    ];

    if (entry.sessionId) {
      parts.push(`Session: ${entry.sessionId}`);
    }

    if (entry.agentId) {
      parts.push(`Agent: ${entry.agentId}`);
    }

    if (entry.metadata) {
      parts.push(`Metadata: ${JSON.stringify(entry.metadata)}`);
    }

    return parts.join(' ');
  }

  /**
   * 从WebSocket接收日志流
   */
  handleWebSocketMessage(data: unknown): void {
    try {
      const parsed = JSON.parse(String(data)) as OpenClawLogEntry;
      this.ingestLog(parsed);
    } catch (error) {
      console.error('[OpenClawLogAdapter] 解析WebSocket消息失败:', error);
    }
  }

  /**
   * 搜索相关日志
   */
  async searchLogs(
    query: string,
    limit: number = 10,
    filters?: {
      level?: string;
      source?: string;
      sessionId?: string;
    }
  ): Promise<Array<{
    id: string;
    score: number;
    entry: OpenClawLogEntry;
  }>> {
    const results = await this.pipeline.search('openclaw_logs', query, limit);

    return results
      .filter(result => {
        // 应用过滤器
        if (filters?.level && result.metadata.level !== filters.level) {
          return false;
        }
        if (filters?.source && result.metadata.source !== filters.source) {
          return false;
        }
        if (filters?.sessionId && result.metadata.sessionId !== filters.sessionId) {
          return false;
        }
        return true;
      })
      .map(result => ({
        id: result.id,
        score: result.score,
        entry: {
          timestamp: String(result.metadata.timestamp || ''),
          level: result.metadata.level as OpenClawLogEntry['level'] || 'info',
          message: result.content,
          source: String(result.metadata.source || 'unknown'),
          sessionId: result.metadata.sessionId as string | undefined,
          agentId: result.metadata.agentId as string | undefined,
          metadata: result.metadata,
        },
      }));
  }

  /**
   * 获取高熵日志（错误和警告）
   */
  async getHighEntropyLogs(limit: number = 20): Promise<OpenClawLogEntry[]> {
    const errorLogs = await this.searchLogs('error exception failed crash', limit / 2);
    const warnLogs = await this.searchLogs('warning warn alert', limit / 2);

    return [...errorLogs, ...warnLogs].map(r => r.entry);
  }

  /**
   * 获取适配器状态
   */
  getStatus(): {
    isRunning: boolean;
    bufferSize: number;
    openclawPath: string;
  } {
    return {
      isRunning: this.isRunning,
      bufferSize: this.buffer.length,
      openclawPath: this.openclawPath,
    };
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    bufferSize: number;
    isRunning: boolean;
  }> {
    return {
      status: this.isRunning ? 'healthy' : 'unhealthy',
      bufferSize: this.buffer.length,
      isRunning: this.isRunning,
    };
  }
}

// 单例实例
let adapterInstance: OpenClawLogAdapter | null = null;

/**
 * 获取适配器单例
 */
export function getOpenClawLogAdapter(
  openclawPath?: string,
  config?: Partial<OpenClawLogAdapterConfig>
): OpenClawLogAdapter {
  if (!adapterInstance) {
    adapterInstance = new OpenClawLogAdapter(
      openclawPath || 'D:\\Games\\openclaw',
      config
    );
  }
  return adapterInstance;
}

export default OpenClawLogAdapter;