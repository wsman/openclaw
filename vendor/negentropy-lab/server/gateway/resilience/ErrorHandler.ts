/**
 * 🛡️ 统一错误处理器 - 错误处理和降级策略（简化版）
 * 
 * 宪法依据: §306零停机协议、§190网络韧性公理、§125数据完整性公理
 * 版本: v1.0.0 (Phase 1B Day 3移植简化版)
 * 状态: 🟢 活跃
 * 
 * 核心原则:
 * 1. 不暴露内部细节 - 提供有意义的用户友好错误信息
 * 2. 优雅降级 - 在错误发生时保持基本功能可用
 * 3. 自动恢复 - 基于错误类型和频率的智能恢复策略
 * 4. 宪法合规 - 所有错误处理必须符合宪法约束
 * 
 * 错误级别:
 * - Fatal (致命): 系统无法继续运行，需要人工干预
 * - Critical (严重): 核心功能不可用，需要立即修复
 * - High (高): 重要功能受影响，需要尽快修复
 * - Medium (中): 非关键功能问题，可计划修复
 * - Low (低): 轻微问题，不影响功能
 * 
 * 降级策略:
 * 1. 功能降级 - 关闭非核心功能，保持核心功能运行
 * 2. 性能降级 - 降低服务质量，保持服务可用性
 * 3. 数据降级 - 使用缓存或默认数据替代实时数据
 */

import { logger } from '../../utils/logger';

export interface ErrorHandlerConfig {
  enableSafeDegradation: boolean;      // 是否启用安全降级
  maxRetryAttempts: number;           // 最大重试次数
  fallbackResponses: Record<string, any>;  // 回退响应配置
  logErrors: boolean;                 // 是否记录错误日志
  enableCircuitBreakerIntegration: boolean; // 是否集成断路器
  enableRateLimiterIntegration: boolean;    // 是否集成速率限制器
}

export interface ErrorContext {
  errorId: string;
  errorType: string;
  severity: 'fatal' | 'critical' | 'high' | 'medium' | 'low';
  location: string;                    // 错误位置 (文件:行号 或 组件名)
  operation: string;                   // 正在执行的操作
  userId?: string;                     // 触发错误的用户
  userLevel?: string;                  // 用户等级
  timestamp: number;
}

export interface ErrorResponse {
  success: boolean;
  errorCode: string;
  message: string;
  userMessage: string;                 // 用户友好的错误信息
  severity: string;
  retryable: boolean;
  retryAfter?: number;                 // 建议重试等待时间 (秒)
  suggestions: string[];               // 修复建议
  constitutionalCheck?: {
    compliant: boolean;
    violatedClauses: string[];
    evidence: string;
  };
  timestamp: number;
}

export interface DegradationState {
  enabled: boolean;
  level: 'full' | 'partial' | 'minimal' | 'critical';
  degradedFeatures: string[];
  recoveryETA?: number;                // 预计恢复时间
}

/**
 * 统一错误处理器类（简化版）
 * 宪法依据: §306零停机协议、§190网络韧性公理、§125数据完整性公理
 */
export class ErrorHandler {
  private config: ErrorHandlerConfig;
  private degradationState: DegradationState;
  private errorHistory: Map<string, number[]> = new Map(); // 错误ID -> 时间戳数组
  
  constructor(config: ErrorHandlerConfig) {
    this.config = config;
    this.degradationState = {
      enabled: false,
      level: 'full',
      degradedFeatures: []
    };
    
    this.logInfo('统一错误处理器初始化完成');
    this.logInfo(`宪法依据: §306零停机协议、§190网络韧性公理、§125数据完整性公理`);
  }
  
  /**
   * 处理错误并生成适当的响应
   */
  async handleError(
    error: Error,
    context: Partial<ErrorContext> = {}
  ): Promise<ErrorResponse> {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    const timestamp = Date.now();
    
    try {
      // 记录错误
      this.recordError(errorId, timestamp);
      
      // 确定错误类型和严重性
      const errorAnalysis = this.analyzeError(error, context);
      
      // 执行宪法合规检查
      const constitutionalCheck = this.performConstitutionalCheck(errorAnalysis);
      
      // 更新降级状态
      const shouldDegrade = this.shouldDegrade(errorAnalysis, timestamp);
      if (shouldDegrade && this.config.enableSafeDegradation) {
        await this.updateDegradationState(errorAnalysis);
      }
      
      // 生成响应
      const response = this.createErrorResponse(
        errorId,
        errorAnalysis,
        constitutionalCheck,
        timestamp
      );
      
      // 记录错误详情
      this.logErrorDetails(errorId, error, context, errorAnalysis, response);
      
      return response;
      
    } catch (handleError: any) {
      // 错误处理器自身出错 - 返回最小安全响应
      // 宪法依据: §306零停机协议 - 错误隔离与恢复机制
      this.logError(`错误处理器失败: ${handleError.message}`, {
        originalError: error.message,
        originalContext: context
      });
      
      return this.createFallbackResponse(errorId, error, timestamp);
    }
  }
  
  /**
   * 分析错误并确定严重性
   */
  private analyzeError(error: Error, context: Partial<ErrorContext>): {
    errorType: string;
    severity: 'fatal' | 'critical' | 'high' | 'medium' | 'low';
    retryable: boolean;
    userFriendlyMessage: string;
    technicalDetails: string;
    suggestions: string[];
  } {
    const errorMessage = error.message.toLowerCase();
    
    // 基于错误消息的启发式分类
    if (errorMessage.includes('connection') || errorMessage.includes('timeout')) {
      return {
        errorType: 'NETWORK_ERROR',
        severity: 'medium',
        retryable: true,
        userFriendlyMessage: '网络连接出现问题，请稍后重试',
        technicalDetails: `网络连接错误: ${error.message}`,
        suggestions: ['检查网络连接', '稍后重试', '如果问题持续，联系技术支持']
      };
    }
    
    if (errorMessage.includes('database') || errorMessage.includes('sql')) {
      return {
        errorType: 'DATABASE_ERROR',
        severity: 'high',
        retryable: true,
        userFriendlyMessage: '数据服务暂时不可用，请稍后重试',
        technicalDetails: `数据库错误: ${error.message}`,
        suggestions: ['稍后重试', '如果问题持续，联系数据库管理员']
      };
    }
    
    if (errorMessage.includes('authentication') || errorMessage.includes('authorization')) {
      return {
        errorType: 'AUTH_ERROR',
        severity: 'medium',
        retryable: false,
        userFriendlyMessage: '身份验证失败，请检查您的凭据',
        technicalDetails: `认证错误: ${error.message}`,
        suggestions: ['检查用户名和密码', '重新登录', '如果问题持续，联系系统管理员']
      };
    }
    
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
      return {
        errorType: 'RATE_LIMIT_ERROR',
        severity: 'low',
        retryable: true,
        userFriendlyMessage: '请求过于频繁，请稍后重试',
        technicalDetails: `速率限制错误: ${error.message}`,
        suggestions: ['降低请求频率', '等待几分钟后重试']
      };
    }
    
    if (errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return {
        errorType: 'VALIDATION_ERROR',
        severity: 'medium',
        retryable: false,
        userFriendlyMessage: '输入数据格式不正确',
        technicalDetails: `验证错误: ${error.message}`,
        suggestions: ['检查输入数据的格式和内容', '参考API文档']
      };
    }
    
    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return {
        errorType: 'NOT_FOUND_ERROR',
        severity: 'low',
        retryable: false,
        userFriendlyMessage: '请求的资源不存在',
        technicalDetails: `未找到资源: ${error.message}`,
        suggestions: ['检查资源标识符是否正确', '查看可用资源列表']
      };
    }
    
    // 默认错误分类
    return {
      errorType: 'INTERNAL_ERROR',
      severity: 'critical',
      retryable: false,
      userFriendlyMessage: '服务器内部错误，请稍后重试',
      technicalDetails: `内部错误: ${error.message}`,
      suggestions: ['稍后重试', '如果问题持续，联系技术支持并报告错误ID']
    };
  }
  
  /**
   * 执行宪法合规检查
   */
  private performConstitutionalCheck(errorAnalysis: any): {
    compliant: boolean;
    violatedClauses: string[];
    evidence: string;
  } {
    const violatedClauses: string[] = [];
    const evidence: string[] = [];
    
    // 检查是否违反零停机协议
    if (errorAnalysis.severity === 'fatal' || errorAnalysis.severity === 'critical') {
      violatedClauses.push('§306.1');
      evidence.push('严重错误可能影响服务可用性');
    }
    
    // 检查是否违反数据完整性公理
    if (errorAnalysis.errorType === 'DATABASE_ERROR') {
      violatedClauses.push('§125.2');
      evidence.push('数据库错误可能影响数据完整性');
    }
    
    // 检查是否违反网络韧性公理
    if (errorAnalysis.errorType === 'NETWORK_ERROR') {
      violatedClauses.push('§190.3');
      evidence.push('网络连接错误表明系统韧性不足');
    }
    
    return {
      compliant: violatedClauses.length === 0,
      violatedClauses,
      evidence: evidence.join('; ')
    };
  }
  
  /**
   * 记录错误
   */
  private recordError(errorId: string, timestamp: number): void {
    if (!this.errorHistory.has(errorId)) {
      this.errorHistory.set(errorId, []);
    }
    
    const timestamps = this.errorHistory.get(errorId)!;
    timestamps.push(timestamp);
    
    // 清理旧的时间戳（保留最近1小时）
    const oneHourAgo = timestamp - 3600000;
    const recentTimestamps = timestamps.filter(ts => ts > oneHourAgo);
    this.errorHistory.set(errorId, recentTimestamps);
  }
  
  /**
   * 确定是否需要降级
   */
  private shouldDegrade(
    errorAnalysis: any,
    timestamp: number
  ): boolean {
    // 致命错误总是触发降级
    if (errorAnalysis.severity === 'fatal') {
      return true;
    }
    
    // 检查错误频率
    const errorKey = errorAnalysis.errorType;
    const timestamps = this.errorHistory.get(errorKey) || [];
    
    // 如果过去5分钟内出现超过5次相同类型的严重错误，触发降级
    const fiveMinutesAgo = timestamp - 300000;
    const recentErrors = timestamps.filter(ts => ts > fiveMinutesAgo);
    
    return recentErrors.length > 5 && errorAnalysis.severity === 'critical';
  }
  
  /**
   * 更新降级状态
   */
  private async updateDegradationState(errorAnalysis: any): Promise<void> {
    const currentLevel = this.degradationState.level;
    let newLevel: 'full' | 'partial' | 'minimal' | 'critical' = 'partial';
    
    // 根据错误严重性确定新的降级级别
    switch (errorAnalysis.severity) {
      case 'fatal':
        newLevel = 'critical';
        break;
      case 'critical':
        newLevel = 'minimal';
        break;
      case 'high':
        newLevel = 'partial';
        break;
      default:
        newLevel = 'partial';
    }
    
    // 只有在需要更严格降级时才更新
    const levelOrder = { full: 0, partial: 1, minimal: 2, critical: 3 };
    if (levelOrder[newLevel] > levelOrder[currentLevel]) {
      this.degradationState = {
        enabled: true,
        level: newLevel,
        degradedFeatures: this.getDegradedFeaturesForLevel(newLevel),
        recoveryETA: Date.now() + this.calculateRecoveryTime(errorAnalysis)
      };
      
      this.logWarning(`系统降级至 ${newLevel} 级别`);
      this.logWarning(`降级功能: ${this.degradationState.degradedFeatures.join(', ')}`);
    }
  }
  
  /**
   * 获取指定降级级别的功能列表
   */
  private getDegradedFeaturesForLevel(level: string): string[] {
    switch (level) {
      case 'partial':
        return ['advanced_analytics', 'realtime_updates', 'batch_processing'];
      case 'minimal':
        return ['advanced_analytics', 'realtime_updates', 'batch_processing', 'data_export', 'custom_reports'];
      case 'critical':
        return ['advanced_analytics', 'realtime_updates', 'batch_processing', 'data_export', 'custom_reports', 'user_registration'];
      default:
        return [];
    }
  }
  
  /**
   * 计算恢复时间
   */
  private calculateRecoveryTime(errorAnalysis: any): number {
    // 基于错误类型和严重性的简单恢复时间估算
    switch (errorAnalysis.severity) {
      case 'fatal':
        return 3600000; // 1小时
      case 'critical':
        return 1800000; // 30分钟
      case 'high':
        return 900000;  // 15分钟
      case 'medium':
        return 300000;  // 5分钟
      default:
        return 60000;   // 1分钟
    }
  }
  
  /**
   * 创建错误响应
   */
  private createErrorResponse(
    errorId: string,
    errorAnalysis: any,
    constitutionalCheck: any,
    timestamp: number
  ): ErrorResponse {
    const response: ErrorResponse = {
      success: false,
      errorCode: errorAnalysis.errorType,
      message: errorAnalysis.technicalDetails,
      userMessage: errorAnalysis.userFriendlyMessage,
      severity: errorAnalysis.severity,
      retryable: errorAnalysis.retryable,
      suggestions: errorAnalysis.suggestions,
      timestamp
    };
    
    // 添加宪法合规检查结果
    if (constitutionalCheck && !constitutionalCheck.compliant) {
      response.constitutionalCheck = constitutionalCheck;
    }
    
    // 如果是可重试的错误，添加重试建议
    if (response.retryable) {
      const retryAfter = this.calculateRetryAfter(errorAnalysis.severity);
      response.retryAfter = retryAfter;
      response.suggestions.push(`建议等待 ${retryAfter} 秒后重试`);
    }
    
    return response;
  }
  
  /**
   * 计算重试等待时间
   */
  private calculateRetryAfter(severity: string): number {
    // 基于严重性的指数退避策略
    const baseDelay = 1; // 1秒基础延迟
    
    switch (severity) {
      case 'fatal':
        return baseDelay * 300; // 5分钟
      case 'critical':
        return baseDelay * 60;  // 1分钟
      case 'high':
        return baseDelay * 30;  // 30秒
      case 'medium':
        return baseDelay * 10;  // 10秒
      case 'low':
        return baseDelay * 5;   // 5秒
      default:
        return baseDelay * 15;  // 15秒
    }
  }
  
  /**
   * 记录错误详情
   */
  private logErrorDetails(
    errorId: string,
    error: Error,
    context: Partial<ErrorContext>,
    errorAnalysis: any,
    response: ErrorResponse
  ): void {
    if (!this.config.logErrors) {
      return;
    }
    
    const logData = {
      errorId,
      timestamp: new Date().toISOString(),
      errorType: errorAnalysis.errorType,
      severity: errorAnalysis.severity,
      location: context.location || 'unknown',
      operation: context.operation || 'unknown',
      userId: context.userId,
      userLevel: context.userLevel,
      message: error.message,
      stack: error.stack,
      userMessage: response.userMessage,
      suggestions: response.suggestions,
      constitutionalCheck: response.constitutionalCheck
    };
    
    const logLevel = errorAnalysis.severity === 'fatal' || errorAnalysis.severity === 'critical' ? 'ERROR' : 'WARN';
    
    const logMessage = `错误 ${errorId}: ${errorAnalysis.errorType} (${errorAnalysis.severity}) - ${error.message}`;
    
    if (logLevel === 'ERROR') {
      this.logError(logMessage, logData);
    } else {
      this.logWarning(logMessage, logData);
    }
  }
  
  /**
   * 创建回退响应
   */
  private createFallbackResponse(
    errorId: string,
    error: Error,
    timestamp: number
  ): ErrorResponse {
    return {
      success: false,
      errorCode: 'FALLBACK_ERROR',
      message: '错误处理器发生内部错误',
      userMessage: '系统遇到未知错误，请稍后重试',
      severity: 'critical',
      retryable: true,
      suggestions: [
        '稍后重试',
        '如果问题持续，联系技术支持并报告错误ID',
        '检查网络连接和服务状态'
      ],
      constitutionalCheck: {
        compliant: false,
        violatedClauses: ['§306'],
        evidence: '错误处理器本身失败，违反零停机协议'
      },
      timestamp
    };
  }
  
  /**
   * Express中间件集成
   * 宪法依据: §306零停机协议，确保中间件正确处理错误
   */
  middleware() {
    return async (err: Error, req: any, res: any, next: Function) => {
      try {
        const context: Partial<ErrorContext> = {
          errorType: err.name || 'EXPRESS_ERROR',
          location: 'express_middleware',
          operation: `${req.method} ${req.path}`,
          userId: req.user?.id,
          userLevel: req.user?.level,
          timestamp: Date.now()
        };
        
        const errorResponse = await this.handleError(err, context);
        
        // 设置适当的HTTP状态码
        let statusCode = 500;
        
        switch (errorResponse.errorCode) {
          case 'AUTH_ERROR':
            statusCode = 401;
            break;
          case 'RATE_LIMIT_ERROR':
            statusCode = 429;
            break;
          case 'VALIDATION_ERROR':
            statusCode = 400;
            break;
          case 'NOT_FOUND_ERROR':
            statusCode = 404;
            break;
          default:
            statusCode = 500;
        }
        
        // 添加重试头部（如果适用）
        if (errorResponse.retryAfter) {
          res.setHeader('Retry-After', errorResponse.retryAfter.toString());
        }
        
        // 发送响应
        res.status(statusCode).json(errorResponse);
        
      } catch (handlerError: any) {
        // 错误处理器失败时返回最小安全响应
        this.logError(`错误处理器中间件失败: ${handlerError.message}`);
        
        res.status(500).json({
          success: false,
          errorCode: 'HANDLER_FAILURE',
          message: '系统内部错误',
          userMessage: '服务器遇到未知错误，请稍后重试',
          severity: 'critical',
          retryable: true,
          suggestions: ['稍后重试', '联系技术支持'],
          timestamp: Date.now()
        });
      }
    };
  }
  
  /**
   * 获取降级状态
   */
  getDegradationState(): DegradationState {
    return { ...this.degradationState };
  }
  
  /**
   * 手动触发降级
   */
  degradeToLevel(level: 'full' | 'partial' | 'minimal' | 'critical', reason: string): void {
    this.degradationState = {
      enabled: true,
      level,
      degradedFeatures: this.getDegradedFeaturesForLevel(level),
      recoveryETA: Date.now() + this.calculateRecoveryTime({ severity: 'critical' })
    };
    
    this.logWarning(`手动降级至 ${level} 级别: ${reason}`);
  }
  
  /**
   * 恢复服务（手动）
   */
  recoverService(): void {
    this.degradationState = {
      enabled: false,
      level: 'full',
      degradedFeatures: []
    };
    
    this.logInfo('服务已恢复至正常状态');
  }
  
  /**
   * 获取错误统计
   */
  getErrorStats(): {
    totalErrors: number;
    errorCounts: Record<string, number>;
    recentErrors: Array<{ errorId: string; count: number; lastOccurrence: number }>;
    degradationState: DegradationState;
  } {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    
    const recentErrors: Array<{ errorId: string; count: number; lastOccurrence: number }> = [];
    const errorCounts: Record<string, number> = {};
    
    for (const [errorId, timestamps] of this.errorHistory.entries()) {
      const recentCount = timestamps.filter(ts => ts > oneHourAgo).length;
      if (recentCount > 0) {
        recentErrors.push({
          errorId,
          count: recentCount,
          lastOccurrence: Math.max(...timestamps)
        });
        
        const errorType = this.extractErrorTypeFromId(errorId);
        errorCounts[errorType] = (errorCounts[errorType] || 0) + recentCount;
      }
    }
    
    return {
      totalErrors: recentErrors.reduce((sum, err) => sum + err.count, 0),
      errorCounts,
      recentErrors,
      degradationState: this.degradationState
    };
  }
  
  /**
   * 从错误ID提取错误类型
   */
  private extractErrorTypeFromId(errorId: string): string {
    // 简化实现：假设错误ID格式为 err_时间戳_随机数
    // 实际应该从错误分析中获取类型
    return 'UNKNOWN';
  }
  
  private logInfo(message: string, data?: any): void {
    logger.info(`[ErrorHandler] ${message}`, data);
  }
  
  private logWarning(message: string, data?: any): void {
    logger.warn(`[ErrorHandler] ${message}`, data);
  }
  
  private logError(message: string, data?: any): void {
    logger.error(`[ErrorHandler] ${message}`, data);
  }
}

/**
 * 创建默认错误处理器配置
 * 宪法依据: §102熵减原则，复用MY-DOGE-DEMO已验证配置
 */
export function createDefaultErrorHandlerConfig(): ErrorHandlerConfig {
  return {
    enableSafeDegradation: true,
    maxRetryAttempts: 3,
    fallbackResponses: {
      'rate_limit_exceeded': {
        success: false,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        message: '请求频率过高',
        userMessage: '请求过于频繁，请稍后重试',
        severity: 'low',
        retryable: true,
        retryAfter: 60,
        suggestions: ['降低请求频率', '等待60秒后重试']
      },
      'validation_failed': {
        success: false,
        errorCode: 'VALIDATION_FAILED',
        message: '请求参数验证失败',
        userMessage: '输入数据格式不正确',
        severity: 'medium',
        retryable: false,
        suggestions: ['检查输入数据的格式和内容', '参考API文档']
      },
      'circuit_open': {
        success: false,
        errorCode: 'CIRCUIT_OPEN',
        message: '服务暂时不可用',
        userMessage: '服务暂时不可用，请稍后重试',
        severity: 'high',
        retryable: true,
        retryAfter: 300,
        suggestions: ['等待5分钟后重试', '如果问题持续，联系技术支持']
      }
    },
    logErrors: true,
    enableCircuitBreakerIntegration: true,
    enableRateLimiterIntegration: true
  };
}

export default {
  ErrorHandler,
  createDefaultErrorHandlerConfig
};