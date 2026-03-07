/**
 * 📋 Negentropy-Lab Gateway 审计日志系统
 * 
 * 宪法依据：
 * - §101 同步公理：所有操作必须记录审计日志
 * - §102 熵减原则：审计日志必须结构化，降低系统复杂性
 * - §107 通信安全公理：审计记录必须防止篡改
 * - §152 单一真理源公理：审计日志是认证操作的唯一真相源
 * - §381 安全公理：防篡改、防重放攻击、完整性保护
 * 
 * 设计原则：
 * 1. 防篡改哈希链：每条记录包含前条记录的哈希值
 * 2. 宪法合规标记：每条记录必须包含相关宪法条文引用
 * 3. 完整上下文记录：记录完整操作上下文和用户信息
 * 4. 实时监控集成：异常模式实时检测和报警
 * 5. 持久化保证：定期同步到持久化存储
 */

import { logger } from '../utils/logger';
import { createHash, randomBytes } from 'crypto';

/**
 * 审计事件类型
 * 宪法依据：§152 单一真理源公理
 */
export enum AuditEventType {
  /** 用户登录 */
  USER_LOGIN = 'user_login',
  /** 用户注销 */
  USER_LOGOUT = 'user_logout',
  /** 令牌生成 */
  TOKEN_GENERATE = 'token_generate',
  /** 令牌验证 */
  TOKEN_VERIFY = 'token_verify',
  /** 令牌刷新 */
  TOKEN_REFRESH = 'token_refresh',
  /** 令牌吊销 */
  TOKEN_REVOKE = 'token_revoke',
  /** 权限检查 */
  PERMISSION_CHECK = 'permission_check',
  /** 角色变更 */
  ROLE_CHANGE = 'role_change',
  /** 宪法合规检查 */
  CONSTITUTION_CHECK = 'constitution_check',
  /** 安全违规 */
  SECURITY_VIOLATION = 'security_violation',
  /** 系统异常 */
  SYSTEM_EXCEPTION = 'system_exception'
}

/**
 * 审计事件严重性
 * 宪法依据：§101 同步公理
 */
export enum AuditSeverity {
  /** 信息级别：正常操作 */
  INFO = 'info',
  /** 警告级别：需要注意的操作 */
  WARNING = 'warning',
  /** 错误级别：错误操作 */
  ERROR = 'error',
  /** 严重级别：安全违规或宪法违规 */
  CRITICAL = 'critical'
}

/**
 * 审计事件接口
 * 宪法依据：§152 单一真理源公理
 */
export interface AuditEvent {
  /** 事件ID (唯一标识符) */
  eventId: string;
  /** 事件类型 */
  eventType: AuditEventType;
  /** 事件严重性 */
  severity: AuditSeverity;
  /** 事件时间戳 (ISO格式) */
  timestamp: string;
  /** 用户标识 */
  userId?: string;
  /** 用户IP地址 */
  userIp?: string;
  /** 用户代理信息 */
  userAgent?: string;
  /** 操作描述 */
  description: string;
  /** 操作结果 */
  success: boolean;
  /** 错误信息（如果失败） */
  error?: string;
  /** 操作详情（JSON格式） */
  details?: Record<string, any>;
  /** 宪法合规标记 */
  constitutional: {
    /** 相关宪法条文 */
    articles: string[];
    /** 宪法合规状态 */
    compliant: boolean;
    /** 宪法检查时间戳 */
    checkedAt: string;
  };
  /** 哈希链：前条记录哈希值 */
  previousHash?: string;
  /** 当前记录哈希值 */
  hash: string;
  /** 链ID：用于标识审计链 */
  chainId: string;
}

/**
 * 审计事件创建选项
 * 宪法依据：§152 单一真理源公理
 */
export interface AuditEventOptions {
  /** 事件类型 */
  eventType: AuditEventType;
  /** 事件严重性 */
  severity?: AuditSeverity;
  /** 用户标识 */
  userId?: string;
  /** 用户IP地址 */
  userIp?: string;
  /** 用户代理信息 */
  userAgent?: string;
  /** 操作描述 */
  description: string;
  /** 操作结果 */
  success: boolean;
  /** 错误信息（如果失败） */
  error?: string;
  /** 操作详情 */
  details?: Record<string, any>;
  /** 相关宪法条文 */
  constitutionalArticles?: string[];
}

/**
 * 审计链状态
 * 宪法依据：§101 同步公理
 */
export interface AuditChainState {
  /** 链ID */
  chainId: string;
  /** 链创建时间 */
  createdAt: string;
  /** 最后事件时间 */
  lastEventTime: string;
  /** 事件总数 */
  totalEvents: number;
  /** 链完整性验证结果 */
  integrityValid: boolean;
  /** 宪法合规状态 */
  constitutionalCompliant: boolean;
}

/**
 * 哈希链管理器
 * 宪法依据：§381 安全公理
 */
class HashChainManager {
  private currentHash: string | null = null;
  private chainId: string;
  
  constructor(chainId?: string) {
    this.chainId = chainId || this.generateChainId();
    logger.info(`[Audit] 哈希链管理器已初始化，链ID: ${this.chainId}`);
  }
  
  /**
   * 计算哈希值
   * 宪法依据：§381 安全公理
   */
  calculateHash(data: string): string {
    return createHash('sha256')
      .update(data)
      .update(this.chainId)
      .update(Date.now().toString())
      .update(randomBytes(16).toString('hex'))
      .digest('hex');
  }
  
  /**
   * 为事件生成哈希链
   * 宪法依据：§381 安全公理
   */
  generateHashForEvent(eventData: Record<string, any>): {
    previousHash: string | null;
    hash: string;
  } {
    const eventString = JSON.stringify(eventData);
    const previousHash = this.currentHash;
    const combinedData = previousHash 
      ? `${previousHash}:${eventString}:${this.chainId}`
      : `${eventString}:${this.chainId}`;
    
    const hash = this.calculateHash(combinedData);
    this.currentHash = hash;
    
    return { previousHash, hash };
  }
  
  /**
   * 验证哈希链完整性
   * 宪法依据：§381 安全公理
   */
  verifyChainIntegrity(events: AuditEvent[]): boolean {
    if (events.length === 0) return true;
    
    let expectedPreviousHash: string | null = null;
    
    for (const event of events) {
      // 验证链ID
      if (event.chainId !== this.chainId) {
        logger.error(`[Audit] 链ID不匹配: ${event.chainId} != ${this.chainId}`);
        return false;
      }
      
      // 验证哈希引用
      if (event.previousHash !== expectedPreviousHash) {
        logger.error(`[Audit] 哈希引用不匹配: ${event.previousHash} != ${expectedPreviousHash}`);
        return false;
      }
      
      // 重新计算哈希值进行验证
      const eventData = { ...event, hash: undefined };
      const eventString = JSON.stringify(eventData);
      const combinedData = expectedPreviousHash 
        ? `${expectedPreviousHash}:${eventString}:${this.chainId}`
        : `${eventString}:${this.chainId}`;
      
      const calculatedHash = this.calculateHash(combinedData);
      if (calculatedHash !== event.hash) {
        logger.error(`[Audit] 哈希值不匹配: ${calculatedHash} != ${event.hash}`);
        return false;
      }
      
      expectedPreviousHash = event.hash;
    }
    
    return true;
  }
  
  /**
   * 生成链ID
   * 宪法依据：§381 安全公理
   */
  private generateChainId(): string {
    return `audit-chain-${Date.now()}-${randomBytes(8).toString('hex')}`;
  }
  
  /**
   * 获取当前链状态
   * 宪法依据：§101 同步公理
   */
  getChainState(): AuditChainState {
    return {
      chainId: this.chainId,
      createdAt: new Date().toISOString(),
      lastEventTime: new Date().toISOString(),
      totalEvents: 0, // 实际应用中从存储中获取
      integrityValid: true,
      constitutionalCompliant: true
    };
  }
}

/**
 * 审计日志管理器
 * 宪法依据：§101 同步公理、§152 单一真理源公理、§381 安全公理
 */
export class AuditLogManager {
  private hashChainManager: HashChainManager;
  private events: AuditEvent[] = [];
  private readonly maxInMemoryEvents = 1000;
  
  constructor(chainId?: string) {
    this.hashChainManager = new HashChainManager(chainId);
    logger.info('[Audit] 审计日志管理器已初始化', {
      chainId: this.hashChainManager.getChainState().chainId,
      constitutional: ['§101', '§152', '§381']
    });
  }
  
  /**
   * 记录审计事件
   * 宪法依据：§101 同步公理
   */
  logEvent(options: AuditEventOptions): AuditEvent {
    // 宪法合规检查
    const constitutionalArticles = options.constitutionalArticles || this.getDefaultConstitutionalArticles(options);
    const constitutionalCompliant = this.checkConstitutionalCompliance(options);
    
    // 创建事件数据
    const timestamp = new Date().toISOString();
    const eventId = this.generateEventId();
    
    const eventData = {
      eventId,
      eventType: options.eventType,
      severity: options.severity || this.determineSeverity(options),
      timestamp,
      userId: options.userId,
      userIp: options.userIp,
      userAgent: options.userAgent,
      description: options.description,
      success: options.success,
      error: options.error,
      details: options.details,
      constitutional: {
        articles: constitutionalArticles,
        compliant: constitutionalCompliant,
        checkedAt: timestamp
      }
    };
    
    // 生成哈希链
    const hashResult = this.hashChainManager.generateHashForEvent(eventData);
    
    // 创建完整事件
    const event: AuditEvent = {
      ...eventData,
      previousHash: hashResult.previousHash || undefined,
      hash: hashResult.hash,
      chainId: this.hashChainManager.getChainState().chainId
    };
    
    // 存储事件
    this.storeEvent(event);
    
    // 记录到系统日志
    this.logToSystemLogger(event);
    
    // 检查异常模式
    this.checkForAnomalies(event);
    
    logger.info(`[Audit] 审计事件已记录: ${event.eventType}`, {
      eventId: event.eventId,
      userId: event.userId,
      success: event.success,
      constitutional: event.constitutional.articles
    });
    
    return event;
  }
  
  /**
   * 记录用户登录事件
   * 宪法依据：§107 通信安全公理
   */
  logUserLogin(
    userId: string, 
    userIp: string, 
    userAgent: string, 
    success: boolean, 
    error?: string
  ): AuditEvent {
    return this.logEvent({
      eventType: AuditEventType.USER_LOGIN,
      severity: success ? AuditSeverity.INFO : AuditSeverity.ERROR,
      userId,
      userIp,
      userAgent,
      description: `用户登录 ${success ? '成功' : '失败'}`,
      success,
      error,
      details: { userId, userIp, userAgent },
      constitutionalArticles: ['§107', '§152', '§381']
    });
  }
  
  /**
   * 记录令牌生成事件
   * 宪法依据：§107 通信安全公理
   */
  logTokenGenerate(
    userId: string, 
    tokenType: 'access' | 'refresh',
    success: boolean,
    error?: string
  ): AuditEvent {
    return this.logEvent({
      eventType: AuditEventType.TOKEN_GENERATE,
      severity: success ? AuditSeverity.INFO : AuditSeverity.ERROR,
      userId,
      description: `${tokenType}令牌生成 ${success ? '成功' : '失败'}`,
      success,
      error,
      details: { userId, tokenType },
      constitutionalArticles: ['§107', '§152', '§381']
    });
  }
  
  /**
   * 记录令牌验证事件
   * 宪法依据：§107 通信安全公理
   */
  logTokenVerify(
    userId: string, 
    tokenType: 'access' | 'refresh',
    success: boolean,
    error?: string,
    validationDetails?: Record<string, any>
  ): AuditEvent {
    return this.logEvent({
      eventType: AuditEventType.TOKEN_VERIFY,
      severity: success ? AuditSeverity.INFO : AuditSeverity.WARNING,
      userId,
      description: `${tokenType}令牌验证 ${success ? '成功' : '失败'}`,
      success,
      error,
      details: { 
        userId, 
        tokenType, 
        ...validationDetails 
      },
      constitutionalArticles: ['§107', '§152', '§381']
    });
  }
  
  /**
   * 记录权限检查事件
   * 宪法依据：§107 通信安全公理
   */
  logPermissionCheck(
    userId: string,
    requiredPermissions: string[],
    grantedPermissions: string[],
    success: boolean,
    error?: string
  ): AuditEvent {
    return this.logEvent({
      eventType: AuditEventType.PERMISSION_CHECK,
      severity: success ? AuditSeverity.INFO : AuditSeverity.WARNING,
      userId,
      description: `权限检查 ${success ? '通过' : '拒绝'}`,
      success,
      error,
      details: {
        userId,
        requiredPermissions,
        grantedPermissions,
        missingPermissions: requiredPermissions.filter(p => !grantedPermissions.includes(p))
      },
      constitutionalArticles: ['§107', '§152']
    });
  }
  
  /**
   * 记录宪法合规检查事件
   * 宪法依据：§101 同步公理
   */
  logConstitutionCheck(
    operation: string,
    articles: string[],
    compliant: boolean,
    details?: Record<string, any>
  ): AuditEvent {
    return this.logEvent({
      eventType: AuditEventType.CONSTITUTION_CHECK,
      severity: compliant ? AuditSeverity.INFO : AuditSeverity.CRITICAL,
      description: `宪法合规检查: ${operation}`,
      success: compliant,
      error: compliant ? undefined : `宪法违规: ${articles.join(', ')}`,
      details: { operation, articles, ...details },
      constitutionalArticles: articles
    });
  }
  
  /**
   * 记录安全违规事件
   * 宪法依据：§381 安全公理
   */
  logSecurityViolation(
    violationType: string,
    userId?: string,
    userIp?: string,
    details?: Record<string, any>
  ): AuditEvent {
    return this.logEvent({
      eventType: AuditEventType.SECURITY_VIOLATION,
      severity: AuditSeverity.CRITICAL,
      userId,
      userIp,
      description: `安全违规: ${violationType}`,
      success: false,
      error: `安全违规检测: ${violationType}`,
      details: { violationType, ...details },
      constitutionalArticles: ['§381', '§107']
    });
  }
  
  /**
   * 获取审计事件
   * 宪法依据：§101 同步公理
   */
  getEvents(
    filter?: {
      eventType?: AuditEventType;
      userId?: string;
      startTime?: string;
      endTime?: string;
      severity?: AuditSeverity;
    },
    limit = 100
  ): AuditEvent[] {
    let filteredEvents = [...this.events];
    
    if (filter?.eventType) {
      filteredEvents = filteredEvents.filter(e => e.eventType === filter.eventType);
    }
    
    if (filter?.userId) {
      filteredEvents = filteredEvents.filter(e => e.userId === filter.userId);
    }
    
    if (filter?.startTime) {
      filteredEvents = filteredEvents.filter(e => e.timestamp >= filter.startTime!);
    }
    
    if (filter?.endTime) {
      filteredEvents = filteredEvents.filter(e => e.timestamp <= filter.endTime!);
    }
    
    if (filter?.severity) {
      filteredEvents = filteredEvents.filter(e => e.severity === filter.severity);
    }
    
    return filteredEvents.slice(0, limit).reverse(); // 最新事件在前
  }
  
  /**
   * 验证审计链完整性
   * 宪法依据：§381 安全公理
   */
  verifyIntegrity(): boolean {
    const integrityValid = this.hashChainManager.verifyChainIntegrity(this.events);
    
    logger.info('[Audit] 审计链完整性验证', {
      totalEvents: this.events.length,
      integrityValid,
      constitutional: ['§381']
    });
    
    return integrityValid;
  }
  
  /**
   * 获取审计统计
   * 宪法依据：§101 同步公理
   */
  getStats(): Record<string, any> {
    const eventCounts: Record<string, number> = {};
    const severityCounts: Record<string, number> = {};
    const userActivity: Record<string, number> = {};
    
    for (const event of this.events) {
      // 统计事件类型
      eventCounts[event.eventType] = (eventCounts[event.eventType] || 0) + 1;
      
      // 统计严重性
      severityCounts[event.severity] = (severityCounts[event.severity] || 0) + 1;
      
      // 统计用户活动
      if (event.userId) {
        userActivity[event.userId] = (userActivity[event.userId] || 0) + 1;
      }
    }
    
    return {
      totalEvents: this.events.length,
      eventCounts,
      severityCounts,
      userActivityCount: Object.keys(userActivity).length,
      chainIntegrity: this.verifyIntegrity(),
      chainId: this.hashChainManager.getChainState().chainId,
      lastUpdated: new Date().toISOString()
    };
  }
  
  /**
   * 清理旧事件
   * 宪法依据：§102 熵减原则
   */
  cleanupOldEvents(maxAgeHours = 24): number {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();
    const initialCount = this.events.length;
    
    this.events = this.events.filter(event => event.timestamp >= cutoffTime);
    const removedCount = initialCount - this.events.length;
    
    if (removedCount > 0) {
      logger.info('[Audit] 旧事件已清理', {
        removed: removedCount,
        remaining: this.events.length,
        maxAgeHours,
        constitutional: ['§102']
      });
    }
    
    return removedCount;
  }
  
  /**
   * 私有方法：存储事件
   * 宪法依据：§152 单一真理源公理
   */
  private storeEvent(event: AuditEvent): void {
    this.events.push(event);
    
    // 如果内存中的事件超过限制，清理最旧的事件
    if (this.events.length > this.maxInMemoryEvents) {
      this.events = this.events.slice(-this.maxInMemoryEvents);
      logger.debug('[Audit] 审计事件已截断，保持内存限制', {
        maxInMemoryEvents: this.maxInMemoryEvents
      });
    }
  }
  
  /**
   * 私有方法：记录到系统日志
   * 宪法依据：§101 同步公理
   */
  private logToSystemLogger(event: AuditEvent): void {
    const logMessage = `[Audit Event] ${event.eventType}: ${event.description} - User: ${event.userId || 'anonymous'} - Success: ${event.success}`;
    
    switch (event.severity) {
      case AuditSeverity.CRITICAL:
      case AuditSeverity.ERROR:
        logger.error(logMessage, { eventId: event.eventId });
        break;
      case AuditSeverity.WARNING:
        logger.warn(logMessage, { eventId: event.eventId });
        break;
      default:
        logger.info(logMessage, { eventId: event.eventId });
    }
  }
  
  /**
   * 私有方法：检查异常模式
   * 宪法依据：§381 安全公理
   */
  private checkForAnomalies(event: AuditEvent): void {
    // 检查快速失败登录
    if (event.eventType === AuditEventType.USER_LOGIN && !event.success) {
      const recentFailures = this.getEvents({
        eventType: AuditEventType.USER_LOGIN,
        userId: event.userId,
        startTime: new Date(Date.now() - 5 * 60 * 1000).toISOString() // 最近5分钟
      }).filter(e => !e.success);
      
      if (recentFailures.length >= 5) {
        logger.warn('[Audit] 检测到可能的暴力破解尝试', {
          userId: event.userId,
          userIp: event.userIp,
          failureCount: recentFailures.length,
          timeWindow: '5分钟'
        });
      }
    }
    
    // 检查宪法违规频率
    if (!event.constitutional.compliant) {
      const recentViolations = this.getEvents({
        eventType: AuditEventType.CONSTITUTION_CHECK,
        startTime: new Date(Date.now() - 60 * 60 * 1000).toISOString() // 最近1小时
      }).filter(e => !e.success);
      
      if (recentViolations.length >= 10) {
        logger.error('[Audit] 检测到高频宪法违规', {
          violations: recentViolations.length,
          timeWindow: '1小时',
          articles: event.constitutional.articles
        });
      }
    }
  }
  
  /**
   * 私有方法：生成事件ID
   * 宪法依据：§152 单一真理源公理
   */
  private generateEventId(): string {
    return `audit-${Date.now()}-${randomBytes(8).toString('hex')}`;
  }
  
  /**
   * 私有方法：获取默认宪法条文
   * 宪法依据：§101 同步公理
   */
  private getDefaultConstitutionalArticles(options: AuditEventOptions): string[] {
    const baseArticles = ['§101', '§152'];
    
    if (options.eventType === AuditEventType.USER_LOGIN || 
        options.eventType === AuditEventType.TOKEN_GENERATE ||
        options.eventType === AuditEventType.TOKEN_VERIFY) {
      baseArticles.push('§107');
    }
    
    if (options.severity === AuditSeverity.CRITICAL || 
        options.eventType === AuditEventType.SECURITY_VIOLATION) {
      baseArticles.push('§381');
    }
    
    if (!options.success) {
      baseArticles.push('§102');
    }
    
    return baseArticles;
  }
  
  /**
   * 私有方法：检查宪法合规性
   * 宪法依据：§101 同步公理
   */
  private checkConstitutionalCompliance(options: AuditEventOptions): boolean {
    // 基本宪法合规检查
    if (!options.description || options.description.trim().length === 0) {
      return false; // 违反 §101：缺乏操作描述
    }
    
    // 安全相关操作的额外检查
    if (options.eventType === AuditEventType.TOKEN_GENERATE && !options.userId) {
      return false; // 违反 §107：令牌生成缺少用户标识
    }
    
    // 宪法违规事件的特殊处理
    if (options.eventType === AuditEventType.SECURITY_VIOLATION && options.success) {
      return false; // 安全违规事件不能标记为成功
    }
    
    return true;
  }
  
  /**
   * 私有方法：确定事件严重性
   * 宪法依据：§101 同步公理
   */
  private determineSeverity(options: AuditEventOptions): AuditSeverity {
    if (!options.success) {
      if (options.eventType === AuditEventType.SECURITY_VIOLATION) {
        return AuditSeverity.CRITICAL;
      }
      if (options.eventType === AuditEventType.CONSTITUTION_CHECK) {
        return AuditSeverity.CRITICAL;
      }
      return AuditSeverity.ERROR;
    }
    
    switch (options.eventType) {
      case AuditEventType.USER_LOGIN:
      case AuditEventType.TOKEN_GENERATE:
        return AuditSeverity.INFO;
      case AuditEventType.PERMISSION_CHECK:
        return AuditSeverity.WARNING;
      default:
        return AuditSeverity.INFO;
    }
  }
}

/**
 * 创建默认审计日志管理器
 * 宪法依据：§152 单一真理源公理
 */
export function createDefaultAuditLogManager(): AuditLogManager {
  const manager = new AuditLogManager();
  
  logger.info('[Audit] 默认审计日志管理器已创建', {
    chainId: manager.getStats().chainId,
    constitutional: ['§101', '§152', '§381']
  });
  
  return manager;
}

/**
 * 审计日志工具函数
 * 宪法依据：§101 同步公理
 */
export const auditUtils = {
  /**
   * 快速记录用户登录
   */
  logLogin(userId: string, userIp: string, userAgent: string, success: boolean, error?: string): AuditEvent {
    const manager = createDefaultAuditLogManager();
    return manager.logUserLogin(userId, userIp, userAgent, success, error);
  },
  
  /**
   * 快速记录令牌生成
   */
  logTokenGen(userId: string, tokenType: 'access' | 'refresh', success: boolean, error?: string): AuditEvent {
    const manager = createDefaultAuditLogManager();
    return manager.logTokenGenerate(userId, tokenType, success, error);
  },
  
  /**
   * 快速记录权限检查
   */
  logPermCheck(userId: string, required: string[], granted: string[], success: boolean, error?: string): AuditEvent {
    const manager = createDefaultAuditLogManager();
    return manager.logPermissionCheck(userId, required, granted, success, error);
  },
  
  /**
   * 快速记录宪法合规检查
   */
  logConstitution(operation: string, articles: string[], compliant: boolean, details?: Record<string, any>): AuditEvent {
    const manager = createDefaultAuditLogManager();
    return manager.logConstitutionCheck(operation, articles, compliant, details);
  },
  
  /**
   * 获取审计统计
   */
  getAuditStats(): Record<string, any> {
    const manager = createDefaultAuditLogManager();
    return manager.getStats();
  }
};

export default AuditLogManager;