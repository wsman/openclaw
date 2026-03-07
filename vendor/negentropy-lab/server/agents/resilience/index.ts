/**
 * 网关防御系统导出文件
 * 
 * 宪法依据: §190网络韧性公理、§152单一真理源公理、§125数据完整性公理
 * 版本: v1.0.0
 * 状态: 🟢 活跃
 * 
 * 提供三层网关防御系统的统一导出接口:
 * 1. 速率限制器 (RateLimiter) - 基于令牌桶算法的请求限流
 * 2. 请求验证器 (RequestValidator) - 宪法合规与参数完整性检查
 * 3. 异常检测器 (AnomalyDetector) - 基于机器学习的行为异常检测
 * 
 * 设计原则:
 * - 模块化: 每个组件可以独立使用或组合使用
 * - 宪法合规: 所有操作都有明确的宪法条款引用
 * - 弹性设计: 组件故障时能够优雅降级
 * - 性能优化: 支持高并发和低延迟处理
 */

export * from './RateLimiter';
export * from './RequestValidator';
// export * from './AnomalyDetector';

/**
 * 网关防御系统配置工厂
 */
export class GatewayDefenseFactory {
  /**
   * 创建默认的速率限制器配置
   */
  static createDefaultRateLimiterConfig() {
    const userLevelQuotas = new Map([
      ['admin', {
        requestsPerSecond: 100,
        burstCapacity: 200,
        maxDailyRequests: 10000,
        priority: 10,
        constitutionalConstraints: ['§190', '§152', '§125']
      }],
      ['premium', {
        requestsPerSecond: 50,
        burstCapacity: 100,
        maxDailyRequests: 5000,
        priority: 8,
        constitutionalConstraints: ['§190', '§125']
      }],
      ['standard', {
        requestsPerSecond: 20,
        burstCapacity: 40,
        maxDailyRequests: 2000,
        priority: 5,
        constitutionalConstraints: ['§190']
      }],
      ['basic', {
        requestsPerSecond: 5,
        burstCapacity: 10,
        maxDailyRequests: 500,
        priority: 3,
        constitutionalConstraints: ['§190']
      }],
      ['default', {
        requestsPerSecond: 10,
        burstCapacity: 20,
        maxDailyRequests: 1000,
        priority: 1,
        constitutionalConstraints: ['§190']
      }]
    ]);

    return {
      userLevelQuotas,
      defaultQuota: {
        requestsPerSecond: 10,
        burstCapacity: 20,
        maxDailyRequests: 1000,
        priority: 1,
        constitutionalConstraints: ['§190']
      },
      globalMaxRps: 1000,
      enableConstitutionalCheck: true,
      enableAnomalyDetection: true
    };
  }

  /**
   * 创建默认的请求验证器配置
   */
  static createDefaultRequestValidatorConfig() {
    // 注入攻击模式检测正则
    const injectionPatterns = [
      /<script\b[^>]*>/i, // 脚本标签
      /javascript:/i,      // JavaScript协议
      /on\w+\s*=/i,       // 事件处理器
      /union\s+select/i,  // SQL注入
      /--\s*$/i,          // SQL注释
      /;\s*(exec|execute)/i, // 命令执行
      /<\?php/i,          // PHP代码
      /eval\s*\(/i,       // eval函数
      /document\./i,      // DOM操作
      /alert\s*\(/i       // alert弹窗
    ];

    // 权限映射
    const requiredPermissions = new Map([
      ['create_task', ['task_create']],
      ['update_task', ['task_update']],
      ['delete_task', ['task_delete']],
      ['query_data', ['data_read']],
      ['update_config', ['config_write']],
      ['admin_operation', ['admin_access']]
    ]);

    return {
      enableConstitutionalValidation: true,
      enableParameterValidation: true,
      enableSecurityValidation: true,
      enableFormatValidation: true,
      enableAuthorizationValidation: true,
      maxRequestBodySize: 1024 * 1024, // 1MB
      maxParameterCount: 100,
      allowedContentTypes: ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data'],
      constitutionalRuleEngineEndpoint: process.env.CONSTITUTIONAL_ENGINE_ENDPOINT,
      requireExplicitClauseReference: false,
      injectionPatterns,
      maxNestingDepth: 10,
      maxStringLength: 10000,
      requiredPermissions
    };
  }

  /**
   * 创建默认的异常检测器配置
   */
  static createDefaultAnomalyDetectorConfig() {
    return {
      enableRequestFrequencyDetection: true,
      enableResponseTimeDetection: true,
      enableErrorRateDetection: true,
      enableResourceUsageDetection: true,
      enableBehaviorPatternDetection: true,
      ewmaAlpha: 0.1,
      zScoreThreshold: 3.0,
      iqrMultiplier: 1.5,
      windowSize: 100,
      enableConstitutionalAnalysis: true,
      requiredConstitutionalClauses: ['§190', '§141', '§127'],
      maxProcessingTimeMs: 10,
      minSamplesForDetection: 20,
      anomalyCooldownPeriodMs: 60000,
      consecutiveAnomaliesThreshold: 3,
      enableAdaptiveThresholds: true
    };
  }

  /**
   * 创建完整的网关防御系统
   */
  static createGatewayDefenseSystem(anomalyDetectorConfig?: any, requestValidatorConfig?: any, rateLimiterConfig?: any) {
    // 创建异常检测器
    const anomalyDetector = new (require('./AnomalyDetector').AnomalyDetector)(
      anomalyDetectorConfig || this.createDefaultAnomalyDetectorConfig()
    );

    // 创建请求验证器
    const requestValidator = new (require('./RequestValidator').RequestValidator)(
      requestValidatorConfig || this.createDefaultRequestValidatorConfig()
    );

    // 创建速率限制器
    const rateLimiter = new (require('./RateLimiter').RateLimiter)(
      rateLimiterConfig || this.createDefaultRateLimiterConfig(),
      anomalyDetector
    );

    return {
      rateLimiter,
      requestValidator,
      anomalyDetector,
      
      // 简化的统一接口
      async checkRequest(userId: string, userLevel: string, requestData: any, operationType: string) {
        // 1. 速率限制检查
        const rateLimitResult = await rateLimiter.checkRateLimit(userId, userLevel);
        if (!rateLimitResult.allowed) {
          return {
            allowed: false,
            reason: 'rate_limit_exceeded',
            details: rateLimitResult,
            waitTimeMs: rateLimitResult.waitTimeMs
          };
        }

        // 2. 请求验证
        const validationContext = {
          requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
          userId,
          userLevel,
          operationType,
          targetAgentId: 'gateway',
          timestamp: Date.now()
        };

        const validationResult = await requestValidator.validateRequest(validationContext, requestData);
        if (!validationResult.valid) {
          return {
            allowed: false,
            reason: 'validation_failed',
            details: validationResult,
            issues: validationResult.tier1.issues.concat(
              validationResult.tier2.issues,
              validationResult.tier3.issues
            )
          };
        }

        // 3. 异常检测
        const anomalyContext = {
          userId,
          userLevel,
          agentId: 'gateway',
          operationType,
          timestamp: Date.now(),
          requestId: validationContext.requestId
        };

        const features = {
          requestFrequency: 1, // 默认频率
          frequencyBaseline: 10,
          frequencyZScore: 0,
          responseTimeMs: 0, // 将在实际响应时更新
          responseTimeBaseline: 100,
          responseTimeZScore: 0,
          errorRate: 0,
          errorRateBaseline: 0.01,
          errorRateZScore: 0,
          requestPatternScore: 70, // 默认模式得分
          sessionDurationMs: 0,
          requestSizeBytes: JSON.stringify(requestData).length
        };

        const anomalyResult = await anomalyDetector.detectAnomaly(anomalyContext, features);
        if (anomalyResult.isAnomaly && anomalyResult.anomalySeverity === 'critical') {
          return {
            allowed: false,
            reason: 'critical_anomaly_detected',
            details: anomalyResult,
            recommendedActions: anomalyResult.recommendedActions
          };
        }

        return {
          allowed: true,
          rateLimit: rateLimitResult,
          validation: validationResult,
          anomaly: anomalyResult,
          requestId: validationContext.requestId
        };
      }
    };
  }
}