/**
 * 🚀 OpenClaw 决策模块 - 审计日志
 *
 * @constitution
 * §101 同步公理：审计日志需与合同同步
 * §102 熵减原则：统一审计日志管理
 * §504 监控系统公理：实时审计合规状态
 * §104 内部事务局公理：运行时审计
 *
 * @filename audit-log.ts
 * @version 1.0.0
 * @category gateway/openclaw-decision/observability
 * @last_updated 2026-03-03
 */

import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 审计日志级别
 */
export type AuditLogLevel = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

/**
 * 审计事件类型
 */
export type AuditEventType =
  | 'decision'
  | 'authentication'
  | 'authorization'
  | 'session'
  | 'circuit_breaker'
  | 'fallback'
  | 'policy'
  | 'security'
  | 'system';

/**
 * 审计日志条目
 */
export interface AuditLogEntry {
  /** 唯一日志 ID */
  logId: string;
  /** 时间戳 ISO 8601 */
  timestamp: string;
  /** 日志级别 */
  level: AuditLogLevel;
  /** 事件类型 */
  eventType: AuditEventType;
  /** 追踪 ID */
  traceId: string;
  /** 连接 ID（可选） */
  connId?: string;
  /** 来源组件 */
  component: string;
  /** 操作描述 */
  action: string;
  /** 结果状态 */
  result: 'SUCCESS' | 'FAILURE' | 'DENIED' | 'FALLBACK';
  /** 详细数据 */
  data: Record<string, unknown>;
  /** 错误信息（如有） */
  error?: string;
  /** 持续时间（毫秒） */
  durationMs?: number;
  /** 客户端信息 */
  client?: {
    ip?: string;
    userAgent?: string;
  };
}

/**
 * 审计日志配置
 */
export interface AuditLogConfig {
  /** 是否启用审计日志 */
  enabled: boolean;
  /** 日志级别阈值 */
  levelThreshold: AuditLogLevel;
  /** 最大内存条目数 */
  maxMemoryEntries: number;
  /** 是否写入文件 */
  fileOutput: boolean;
  /** 日志文件目录 */
  fileDirectory: string;
  /** 日志文件前缀 */
  filePrefix: string;
  /** 日志轮转大小（字节） */
  rotationSizeBytes: number;
}

/**
 * 审计日志统计
 */
export interface AuditLogStats {
  totalEntries: number;
  entriesByLevel: Record<AuditLogLevel, number>;
  entriesByType: Record<AuditEventType, number>;
  entriesByResult: Record<string, number>;
  oldestEntry?: string;
  newestEntry?: string;
  fileCount: number;
  totalFileSizeBytes: number;
}

// ============================================================================
// 默认配置
// ============================================================================

export const DEFAULT_AUDIT_LOG_CONFIG: AuditLogConfig = {
  enabled: true,
  levelThreshold: 'INFO',
  maxMemoryEntries: 10000,
  fileOutput: true,
  fileDirectory: './logs/audit',
  filePrefix: 'openclaw-decision-audit',
  rotationSizeBytes: 10 * 1024 * 1024, // 10MB
};

// ============================================================================
// 审计日志器
// ============================================================================

class AuditLogger {
  private config: AuditLogConfig;
  private entries: AuditLogEntry[] = [];
  private logCounter = 0;
  private currentFileSize = 0;
  private currentFileIndex = 0;

  constructor(config: Partial<AuditLogConfig> = {}) {
    this.config = { ...DEFAULT_AUDIT_LOG_CONFIG, ...config };
    
    if (this.config.fileOutput) {
      this.ensureLogDirectory();
    }
  }

  // --------------------------------------------------------------------------
  // 核心日志方法
  // --------------------------------------------------------------------------

  /**
   * 记录审计日志
   */
  log(entry: Omit<AuditLogEntry, 'logId' | 'timestamp'>): string {
    if (!this.config.enabled) {
      return '';
    }

    // 级别过滤
    if (!this.shouldLog(entry.level)) {
      return '';
    }

    const fullEntry: AuditLogEntry = {
      ...entry,
      logId: this.generateLogId(),
      timestamp: new Date().toISOString(),
    };

    // 添加到内存缓冲
    this.entries.push(fullEntry);
    if (this.entries.length > this.config.maxMemoryEntries) {
      this.entries.shift();
    }

    // 写入文件
    if (this.config.fileOutput) {
      this.writeToFile(fullEntry);
    }

    return fullEntry.logId;
  }

  /**
   * 快捷方法：记录决策审计
   */
  logDecision(params: {
    traceId: string;
    connId?: string;
    action: string;
    result: 'SUCCESS' | 'FAILURE' | 'DENIED' | 'FALLBACK';
    data: Record<string, unknown>;
    durationMs?: number;
    error?: string;
  }): string {
    const level = params.result === 'FAILURE' ? 'ERROR' : params.result === 'DENIED' ? 'WARN' : 'INFO';
    return this.log({
      level,
      eventType: 'decision',
      traceId: params.traceId,
      connId: params.connId,
      component: 'decision-controller',
      action: params.action,
      result: params.result,
      data: params.data,
      durationMs: params.durationMs,
      error: params.error,
    });
  }

  /**
   * 快捷方法：记录认证审计
   */
  logAuthentication(params: {
    traceId: string;
    connId?: string;
    action: string;
    result: 'SUCCESS' | 'FAILURE';
    data: Record<string, unknown>;
    client?: { ip?: string; userAgent?: string };
    error?: string;
  }): string {
    const level = params.result === 'FAILURE' ? 'WARN' : 'INFO';
    return this.log({
      level,
      eventType: 'authentication',
      traceId: params.traceId,
      connId: params.connId,
      component: 'auth-handler',
      action: params.action,
      result: params.result,
      data: params.data,
      client: params.client,
      error: params.error,
    });
  }

  /**
   * 快捷方法：记录策略审计
   */
  logPolicy(params: {
    traceId: string;
    policyId: string;
    action: string;
    result: 'SUCCESS' | 'FAILURE' | 'DENIED';
    data: Record<string, unknown>;
    error?: string;
  }): string {
    const level = params.result === 'DENIED' ? 'WARN' : 'INFO';
    return this.log({
      level,
      eventType: 'policy',
      traceId: params.traceId,
      component: 'policy-engine',
      action: `policy:${params.policyId}:${params.action}`,
      result: params.result,
      data: params.data,
      error: params.error,
    });
  }

  /**
   * 快捷方法：记录安全事件审计
   */
  logSecurity(params: {
    traceId: string;
    action: string;
    result: 'SUCCESS' | 'FAILURE' | 'DENIED';
    data: Record<string, unknown>;
    client?: { ip?: string; userAgent?: string };
    error?: string;
  }): string {
    return this.log({
      level: 'CRITICAL',
      eventType: 'security',
      traceId: params.traceId,
      component: 'security-layer',
      action: params.action,
      result: params.result,
      data: params.data,
      client: params.client,
      error: params.error,
    });
  }

  /**
   * 快捷方法：记录断路器审计
   */
  logCircuitBreaker(params: {
    traceId: string;
    breakerName: string;
    action: string;
    result: 'SUCCESS' | 'FAILURE';
    data: Record<string, unknown>;
    error?: string;
  }): string {
    const level = params.result === 'FAILURE' ? 'WARN' : 'INFO';
    return this.log({
      level,
      eventType: 'circuit_breaker',
      traceId: params.traceId,
      component: `circuit-breaker:${params.breakerName}`,
      action: params.action,
      result: params.result,
      data: params.data,
      error: params.error,
    });
  }

  /**
   * 快捷方法：记录回退审计
   */
  logFallback(params: {
    traceId: string;
    reason: string;
    result: 'SUCCESS' | 'FAILURE' | 'FALLBACK';
    data: Record<string, unknown>;
    durationMs?: number;
    error?: string;
  }): string {
    return this.log({
      level: 'WARN',
      eventType: 'fallback',
      traceId: params.traceId,
      component: 'fallback-adapter',
      action: `fallback:${params.reason}`,
      result: params.result,
      data: params.data,
      durationMs: params.durationMs,
      error: params.error,
    });
  }

  // --------------------------------------------------------------------------
  // 查询方法
  // --------------------------------------------------------------------------

  /**
   * 获取所有日志条目
   */
  getEntries(): AuditLogEntry[] {
    return [...this.entries];
  }

  /**
   * 获取最近 N 条日志
   */
  getRecentEntries(count: number = 100): AuditLogEntry[] {
    return this.entries.slice(-count);
  }

  /**
   * 按 traceId 查询
   */
  getEntriesByTraceId(traceId: string): AuditLogEntry[] {
    return this.entries.filter(e => e.traceId === traceId);
  }

  /**
   * 按事件类型查询
   */
  getEntriesByType(eventType: AuditEventType): AuditLogEntry[] {
    return this.entries.filter(e => e.eventType === eventType);
  }

  /**
   * 按级别查询
   */
  getEntriesByLevel(level: AuditLogLevel): AuditLogEntry[] {
    return this.entries.filter(e => e.level === level);
  }

  /**
   * 按时间范围查询
   */
  getEntriesByTimeRange(start: Date, end: Date): AuditLogEntry[] {
    return this.entries.filter(e => {
      const ts = new Date(e.timestamp);
      return ts >= start && ts <= end;
    });
  }

  // --------------------------------------------------------------------------
  // 统计方法
  // --------------------------------------------------------------------------

  /**
   * 获取统计信息
   */
  getStats(): AuditLogStats {
    const entriesByLevel: Record<AuditLogLevel, number> = {
      INFO: 0,
      WARN: 0,
      ERROR: 0,
      CRITICAL: 0,
    };

    const entriesByType: Record<AuditEventType, number> = {
      decision: 0,
      authentication: 0,
      authorization: 0,
      session: 0,
      circuit_breaker: 0,
      fallback: 0,
      policy: 0,
      security: 0,
      system: 0,
    };

    const entriesByResult: Record<string, number> = {};

    for (const entry of this.entries) {
      entriesByLevel[entry.level]++;
      entriesByType[entry.eventType]++;
      entriesByResult[entry.result] = (entriesByResult[entry.result] || 0) + 1;
    }

    let fileCount = 0;
    let totalFileSizeBytes = 0;

    if (this.config.fileOutput && fs.existsSync(this.config.fileDirectory)) {
      const files = fs.readdirSync(this.config.fileDirectory)
        .filter(f => f.startsWith(this.config.filePrefix));
      fileCount = files.length;
      
      for (const file of files) {
        const filePath = path.join(this.config.fileDirectory, file);
        const stats = fs.statSync(filePath);
        totalFileSizeBytes += stats.size;
      }
    }

    return {
      totalEntries: this.entries.length,
      entriesByLevel,
      entriesByType,
      entriesByResult,
      oldestEntry: this.entries[0]?.timestamp,
      newestEntry: this.entries[this.entries.length - 1]?.timestamp,
      fileCount,
      totalFileSizeBytes,
    };
  }

  // --------------------------------------------------------------------------
  // 管理方法
  // --------------------------------------------------------------------------

  /**
   * 清空内存日志
   */
  clear(): void {
    this.entries = [];
  }

  /**
   * 重置审计日志器
   */
  reset(): void {
    this.entries = [];
    this.logCounter = 0;
    this.currentFileSize = 0;
    this.currentFileIndex = 0;
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AuditLogConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.config.fileOutput) {
      this.ensureLogDirectory();
    }
  }

  // --------------------------------------------------------------------------
  // 私有方法
  // --------------------------------------------------------------------------

  private generateLogId(): string {
    this.logCounter++;
    const timestamp = Date.now().toString(36);
    const counter = this.logCounter.toString(36).padStart(6, '0');
    return `AUDIT-${timestamp}-${counter}`;
  }

  private shouldLog(level: AuditLogLevel): boolean {
    const levels: AuditLogLevel[] = ['INFO', 'WARN', 'ERROR', 'CRITICAL'];
    const entryLevel = levels.indexOf(level);
    const threshold = levels.indexOf(this.config.levelThreshold);
    return entryLevel >= threshold;
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.config.fileDirectory)) {
      fs.mkdirSync(this.config.fileDirectory, { recursive: true });
    }
  }

  private writeToFile(entry: AuditLogEntry): void {
    try {
      const logLine = JSON.stringify(entry) + '\n';
      const logBuffer = Buffer.from(logLine);
      
      // 检查是否需要轮转
      if (this.currentFileSize + logBuffer.length > this.config.rotationSizeBytes) {
        this.currentFileIndex++;
        this.currentFileSize = 0;
      }

      const filename = `${this.config.filePrefix}-${this.getDatePrefix()}-${this.currentFileIndex.toString().padStart(4, '0')}.jsonl`;
      const filePath = path.join(this.config.fileDirectory, filename);

      fs.appendFileSync(filePath, logBuffer);
      this.currentFileSize += logBuffer.length;
    } catch (error) {
      // 文件写入失败不应影响主流程
      console.error('Audit log file write failed:', error);
    }
  }

  private getDatePrefix(): string {
    const now = new Date();
    return `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
  }
}

// ============================================================================
// 单例导出
// ============================================================================

let auditLoggerInstance: AuditLogger | null = null;

export function getAuditLogger(): AuditLogger {
  if (!auditLoggerInstance) {
    auditLoggerInstance = new AuditLogger();
  }
  return auditLoggerInstance;
}

export function resetAuditLogger(): void {
  auditLoggerInstance = null;
}

export function createAuditLogger(config: Partial<AuditLogConfig> = {}): AuditLogger {
  return new AuditLogger(config);
}

// ============================================================================
// HTTP 处理器
// ============================================================================

/**
 * 创建审计日志查询端点处理器
 */
export function createAuditLogHandler() {
  return (req: Request, res: Response) => {
    const audit = getAuditLogger();
    const { traceId, eventType, level, limit = '100' } = req.query;

    let entries: AuditLogEntry[];

    if (traceId && typeof traceId === 'string') {
      entries = audit.getEntriesByTraceId(traceId);
    } else if (eventType && typeof eventType === 'string') {
      entries = audit.getEntriesByType(eventType as AuditEventType);
    } else if (level && typeof level === 'string') {
      entries = audit.getEntriesByLevel(level as AuditLogLevel);
    } else {
      entries = audit.getRecentEntries(parseInt(limit as string, 10));
    }

    res.json({
      count: entries.length,
      entries,
    });
  };
}

/**
 * 创建审计日志统计端点处理器
 */
export function createAuditStatsHandler() {
  return (req: Request, res: Response) => {
    const audit = getAuditLogger();
    res.json(audit.getStats());
  };
}

/**
 * 创建审计日志按 traceId 追踪端点处理器
 */
export function createAuditTraceHandler() {
  return (req: Request, res: Response) => {
    const audit = getAuditLogger();
    const { traceId } = req.params;

    if (!traceId) {
      res.status(400).json({ error: 'traceId is required' });
      return;
    }

    const entries = audit.getEntriesByTraceId(traceId);
    
    res.json({
      traceId,
      count: entries.length,
      timeline: entries.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      ),
    });
  };
}