/**
 * 🔍 故障检测器 - 快速检测模型故障
 * 
 * 宪法依据:
 * - §306 零停机协议: 快速故障检测，及时触发故障转移
 * - §190 网络韧性公理: 主动检测，预防级联故障
 * - §102 熵减原则: 简化检测逻辑，减少系统复杂度
 * 
 * 功能:
 * - 快速检测模型故障（<5秒）
 * - 准确分类故障类型
 * - 提供故障诊断信息
 * 
 * @version 1.0.0 (批次4-2)
 * @category Gateway/Resilience
 */

import { ModelAdapter, HealthStatus } from '../llm/adapters/ModelAdapter';
import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';

/**
 * 故障类型
 */
export enum FailureType {
  /** 超时 */
  TIMEOUT = 'timeout',
  
  /** 网络错误 */
  NETWORK = 'network',
  
  /** 速率限制 */
  RATE_LIMIT = 'rate_limit',
  
  /** 认证错误 */
  AUTH = 'auth',
  
  /** 验证错误 */
  VALIDATION = 'validation',
  
  /** 服务器错误 */
  SERVER = 'server',
  
  /** 未知错误 */
  UNKNOWN = 'unknown'
}

/**
 * 故障严重程度
 */
export enum Severity {
  /** 低 */
  LOW = 'low',
  
  /** 中 */
  MEDIUM = 'medium',
  
  /** 高 */
  HIGH = 'high',
  
  /** 严重 */
  CRITICAL = 'critical'
}

/**
 * 故障检测结果
 */
export interface DetectionResult {
  /** 是否检测到故障 */
  isFailure: boolean;
  
  /** 故障类型 */
  failureType: FailureType;
  
  /** 严重程度 */
  severity: Severity;
  
  /** 错误消息 */
  errorMessage: string;
  
  /** 是否可恢复 */
  recoverable: boolean;
  
  /** 检测延迟（毫秒） */
  detectionLatency: number;
  
  /** 诊断信息 */
  diagnostics: {
    errorClass: string;
    errorCode?: string;
    httpStatusCode?: number;
    context?: any;
  };
}

/**
 * 故障检测配置
 */
export interface FailureDetectorConfig {
  /** 检测超时（毫秒，默认5秒） */
  detectionTimeout?: number;
  
  /** 是否启用快速失败 */
  enableFastFail?: boolean;
  
  /** 最大重试次数 */
  maxRetries?: number;
  
  /** 是否记录诊断信息 */
  enableDiagnostics?: boolean;
}

/**
 * 故障检测器
 * 
 * 快速检测模型故障，为故障转移提供准确判断
 */
export class FailureDetector extends EventEmitter {
  private config: Required<FailureDetectorConfig>;
  
  constructor(config: FailureDetectorConfig = {}) {
    super();
    
    this.config = {
      detectionTimeout: config.detectionTimeout ?? 5000, // 5秒
      enableFastFail: config.enableFastFail ?? true,
      maxRetries: config.maxRetries ?? 1,
      enableDiagnostics: config.enableDiagnostics ?? true
    };
    
    this.logInfo('故障检测器初始化', {
      detectionTimeout: this.config.detectionTimeout,
      enableFastFail: this.config.enableFastFail
    });
  }
  
  /**
   * 快速检测故障
   * 宪法依据: §306零停机协议，检测延迟<5秒
   */
  async detect(adapter: ModelAdapter): Promise<DetectionResult> {
    const startTime = Date.now();
    const adapterId = `${adapter.provider}:${adapter.model}`;
    
    this.logDebug(`开始故障检测: ${adapterId}`);
    
    try {
      // 设置超时保护
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Detection timeout after ${this.config.detectionTimeout}ms`));
        }, this.config.detectionTimeout);
      });
      
      // 执行健康检查
      const healthCheckPromise = adapter.healthCheck();
      
      // 竞争：健康检查 vs 超时
      const health = await Promise.race([healthCheckPromise, timeoutPromise]);
      
      const latency = Date.now() - startTime;
      
      // 分析健康状态
      if (health.status === 'unhealthy') {
        const result: DetectionResult = {
          isFailure: true,
          failureType: this.inferFailureType(),
          severity: this.assessSeverity(health),
          errorMessage: 'Unhealthy status',
          recoverable: this.isRecoverable(health),
          detectionLatency: latency,
          diagnostics: this.extractDiagnostics(health)
        };
        
        this.logWarning(`检测到故障: ${adapterId}`, result);
        this.emit('failure-detected', { adapterId, result });
        
        return result;
      }
      
      // 健康状态
      const result: DetectionResult = {
        isFailure: false,
        failureType: FailureType.UNKNOWN,
        severity: Severity.LOW,
        errorMessage: '',
        recoverable: true,
        detectionLatency: latency,
        diagnostics: {
          errorClass: 'HealthCheck',
          context: { status: health.status }
        }
      };
      
      this.logDebug(`故障检测完成（健康）: ${adapterId}`, { latency });
      
      return result;
      
    } catch (error: any) {
      const latency = Date.now() - startTime;
      const result: DetectionResult = {
        isFailure: true,
        failureType: this.classifyError(error),
        severity: this.assessErrorSeverity(error),
        errorMessage: error.message,
        recoverable: this.isErrorRecoverable(error),
        detectionLatency: latency,
        diagnostics: this.extractErrorDiagnostics(error)
      };
      
      this.logWarning(`检测到故障（异常）: ${adapterId}`, result);
      this.emit('failure-detected', { adapterId, result, error });
      
      return result;
    }
  }
  
  /**
   * 判断是否需要故障转移
   */
  shouldFailover(error: Error): boolean {
    const failureType = this.classifyError(error);
    const severity = this.assessErrorSeverity(error);
    
    // 高严重程度或特定类型的错误需要故障转移
    const failoverTypes = [FailureType.TIMEOUT, FailureType.NETWORK, FailureType.RATE_LIMIT];
    const severeFailures = [Severity.HIGH, Severity.CRITICAL];
    
    return failoverTypes.includes(failureType) || severeFailures.includes(severity);
  }
  
  /**
   * 分类错误类型
   */
  private classifyError(error: Error): FailureType {
    const message = error.message.toLowerCase();
    const name = error.constructor.name.toLowerCase();
    
    // 超时错误
    if (message.includes('timeout') || message.includes('timed out') || name.includes('timeout')) {
      return FailureType.TIMEOUT;
    }
    
    // 网络错误
    if (message.includes('network') || 
        message.includes('connection') || 
        message.includes('econnrefused') ||
        message.includes('enotfound') ||
        message.includes('etimedout')) {
      return FailureType.NETWORK;
    }
    
    // 速率限制
    if (message.includes('rate limit') || 
        message.includes('quota') || 
        message.includes('429')) {
      return FailureType.RATE_LIMIT;
    }
    
    // 认证错误
    if (message.includes('auth') || 
        message.includes('token') || 
        message.includes('unauthorized') ||
        message.includes('401')) {
      return FailureType.AUTH;
    }
    
    // 验证错误
    if (message.includes('invalid') || 
        message.includes('validation') ||
        message.includes('400') ||
        message.includes('bad request')) {
      return FailureType.VALIDATION;
    }
    
    // 服务器错误
    if (message.includes('500') || 
        message.includes('502') || 
        message.includes('503') ||
        message.includes('504') ||
        name.includes('server')) {
      return FailureType.SERVER;
    }
    
    return FailureType.UNKNOWN;
  }
  
  /**
   * 从健康状态推断故障类型
   */
  private inferFailureType(errorMessage?: string): FailureType {
    if (!errorMessage) {
      return FailureType.UNKNOWN;
    }
    
    return this.classifyError(new Error(errorMessage));
  }
  
  /**
   * 评估严重程度
   */
  private assessSeverity(health: HealthStatus): Severity {
    // 根据错误率和状态评估
    if (health.errorRate >= 0.8) {
      return Severity.CRITICAL;
    } else if (health.errorRate >= 0.5) {
      return Severity.HIGH;
    } else if (health.errorRate >= 0.3) {
      return Severity.MEDIUM;
    }
    
    return Severity.LOW;
  }
  
  /**
   * 评估错误严重程度
   */
  private assessErrorSeverity(error: Error): Severity {
    const failureType = this.classifyError(error);
    
    switch (failureType) {
      case FailureType.TIMEOUT:
      case FailureType.NETWORK:
        return Severity.HIGH;
      
      case FailureType.RATE_LIMIT:
        return Severity.MEDIUM;
      
      case FailureType.AUTH:
      case FailureType.VALIDATION:
        return Severity.MEDIUM;
      
      case FailureType.SERVER:
        return Severity.CRITICAL;
      
      default:
        return Severity.LOW;
    }
  }
  
  /**
   * 判断是否可恢复
   */
  private isRecoverable(health: HealthStatus): boolean {
    const failureType = this.inferFailureType();
    
    // 超时和网络错误通常是可恢复的
    const recoverableTypes = [
      FailureType.TIMEOUT,
      FailureType.NETWORK,
      FailureType.RATE_LIMIT
    ];
    
    return recoverableTypes.includes(failureType);
  }
  
  /**
   * 判断错误是否可恢复
   */
  private isErrorRecoverable(error: Error): boolean {
    const failureType = this.classifyError(error);
    
    // 超时和网络错误通常是可恢复的
    const recoverableTypes = [
      FailureType.TIMEOUT,
      FailureType.NETWORK,
      FailureType.RATE_LIMIT
    ];
    
    return recoverableTypes.includes(failureType);
  }
  
  /**
   * 提取诊断信息
   */
  private extractDiagnostics(health: HealthStatus): DetectionResult['diagnostics'] {
    return {
      errorClass: 'HealthCheck',
      httpStatusCode: undefined,
      context: {
        status: health.status,
        latency: health.latency,
        errorRate: health.errorRate
      }
    };
  }
  
  /**
   * 提取错误诊断信息
   */
  private extractErrorDiagnostics(error: any): DetectionResult['diagnostics'] {
    const diagnostics: DetectionResult['diagnostics'] = {
      errorClass: error.constructor.name,
      errorCode: error.code,
      httpStatusCode: error.statusCode || error.status,
      context: {}
    };
    
    // 提取附加上下文
    if (this.config.enableDiagnostics) {
      if (error.response) {
        diagnostics.context.response = {
          status: error.response.status,
          statusText: error.response.statusText,
          headers: error.response.headers
        };
      }
      
      if (error.request) {
        diagnostics.context.request = {
          method: error.request.method,
          url: error.request.url,
          headers: error.request.headers
        };
      }
    }
    
    return diagnostics;
  }
  
  /**
   * 获取配置
   */
  getConfig(): Readonly<Required<FailureDetectorConfig>> {
    return this.config;
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<FailureDetectorConfig>): void {
    Object.assign(this.config, config);
    this.logInfo('配置已更新');
  }
  
  // ==================== 日志方法 ====================
  
  private logDebug(message: string, details?: any): void {
    logger.debug(`[FailureDetector] ${message}`, details || '');
  }
  
  private logInfo(message: string, details?: any): void {
    logger.info(`[FailureDetector] ${message}`, details || '');
  }
  
  private logWarning(message: string, details?: any): void {
    logger.warn(`[FailureDetector] ${message}`, details || '');
  }
  
  private logError(message: string, error?: any): void {
    logger.error(`[FailureDetector] ${message}`, error || '');
  }
}

/**
 * 创建默认故障检测配置
 */
export function createDefaultFailureDetectorConfig(): FailureDetectorConfig {
  return {
    detectionTimeout: 5000,
    enableFastFail: true,
    maxRetries: 1,
    enableDiagnostics: true
  };
}

export default {
  FailureDetector,
  createDefaultFailureDetectorConfig,
  FailureType,
  Severity
};
