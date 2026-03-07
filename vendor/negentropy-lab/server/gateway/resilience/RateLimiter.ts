/**
 * 🛡️ 基于令牌桶算法的速率限制器（移植自MY-DOGE-DEMO）
 * 
 * 宪法依据: §190网络韧性公理、§306零停机协议、§110协作效率公理、DS-003弹性通信标准
 * 版本: v1.0.0 (Phase 1B Day 3移植)
 * 状态: 🟢 活跃
 * 
 * 设计原则:
 * 1. 基于用户等级的动态配额管理
 * 2. 令牌桶算法实现平滑流量控制
 * 3. 支持突发容量和平均速率限制
 * 4. 宪法合规性检查集成
 * 5. 支持热重载配置（§306零停机协议）
 * 
 * 数学公式:
 * - 令牌补充速率: r = 令牌/秒
 * - 令牌桶容量: b = 突发令牌数
 * - 当前令牌数: tokens = min(b, tokens + r * Δt)
 * 
 * 移植说明:
 * 1. 基于MY-DOGE-DEMO/server/agents/resilience/RateLimiter.ts移植
 * 2. 添加Negentropy-Lab特定的宪法合规检查
 * 3. 集成到Gateway中间件链中
 * 4. 支持热配置重载（§306零停机协议）
 * 
 * 开发者注意:
 * - 添加新用户等级时，必须同时更新宪法约束检查
 * - 配置变更必须通过宪法合规验证
 * - 错误处理必须支持安全降级（§306零停机协议）
 */

import { logger } from '../../utils/logger';

// 指数加权移动平均（EWMA）工具类（简化版，完整版在utils/math/）
class EWMA {
  private alpha: number;
  private value: number;
  private initialized = false;
  
  constructor(alpha: number) {
    this.alpha = alpha;
    this.value = 0;
  }
  
  add(value: number): void {
    if (!this.initialized) {
      this.value = value;
      this.initialized = true;
    } else {
      this.value = this.alpha * value + (1 - this.alpha) * this.value;
    }
  }
  
  getAverage(): number {
    return this.value;
  }
  
  reset(): void {
    this.value = 0;
    this.initialized = false;
  }
}

export interface RateLimitConfig {
  // 用户等级配额配置
  userLevelQuotas: Map<string, UserQuota>;
  
  // 默认配额 (当用户等级未匹配时使用)
  defaultQuota: UserQuota;
  
  // 全局最大请求率 (防止系统过载)
  globalMaxRps: number;
  
  // 是否启用宪法合规检查
  enableConstitutionalCheck: boolean;
  
  // 是否启用异常检测集成
  enableAnomalyDetection: boolean;
}

export interface UserQuota {
  requestsPerSecond: number;      // 平均每秒请求数
  burstCapacity: number;         // 突发容量 (令牌桶大小)
  maxDailyRequests: number;      // 每日最大请求数
  priority: number;              // 优先级 (1-10, 10最高)
  
  // 宪法合规约束
  constitutionalConstraints: string[];
}

export interface RateLimitResult {
  allowed: boolean;
  remainingTokens: number;
  waitTimeMs: number;
  userLevel: string;
  reason?: string;
  constitutionalCheck?: {
    compliant: boolean;
    violatedClauses: string[];
    evidence: string;
  };
}

export interface RateLimitStats {
  totalRequests: number;
  allowedRequests: number;
  rejectedRequests: number;
  currentRps: number;  // 当前实际请求率
  avgRps: EWMA;        // 指数加权平均请求率
  userStats: Map<string, UserRateStats>;
}

export interface UserRateStats {
  userId: string;
  userLevel: string;
  totalRequests: number;
  allowedRequests: number;
  rejectedRequests: number;
  currentRps: number;
  avgRps: EWMA;
  lastRequestTime: number;
  dailyRequestCount: number;
  lastResetTime: number;
}

/**
 * 基于令牌桶算法的速率限制器
 * 宪法依据: §190网络韧性公理、§306零停机协议、§110协作效率公理
 */
export class RateLimiter {
  private config: RateLimitConfig;
  private userBuckets: Map<string, UserTokenBucket>;
  private globalBucket: GlobalTokenBucket;
  private stats: RateLimitStats;
  
  constructor(config: RateLimitConfig) {
    this.config = config;
    this.userBuckets = new Map();
    this.globalBucket = new GlobalTokenBucket(config.globalMaxRps);
    
    // 初始化统计信息
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      rejectedRequests: 0,
      currentRps: 0,
      avgRps: new EWMA(0.1), // α=0.1对应约19个数据点的时间窗口
      userStats: new Map()
    };
    
    this.logInfo('速率限制器初始化完成');
    this.logInfo(`宪法依据: §190网络韧性公理、§306零停机协议、§110协作效率公理`);
    this.logInfo(`用户等级配额: ${Array.from(config.userLevelQuotas.keys()).join(', ')}`);
  }
  
  /**
   * 检查速率限制
   * @param userId 用户ID
   * @param userLevel 用户等级
   * @param requestCost 请求成本 (默认1个令牌)
   * @returns 速率限制结果
   */
  async checkRateLimit(
    userId: string,
    userLevel = 'default',
    requestCost = 1
  ): Promise<RateLimitResult> {
    const startTime = Date.now();
    this.stats.totalRequests++;
    
    try {
      // 1. 宪法合规性预检查
      let constitutionalCheck;
      if (this.config.enableConstitutionalCheck) {
        constitutionalCheck = await this.performConstitutionalCheck(userId, userLevel);
        if (!constitutionalCheck.compliant) {
          this.stats.rejectedRequests++;
          return {
            allowed: false,
            remainingTokens: 0,
            waitTimeMs: 0,
            userLevel,
            reason: '宪法合规检查失败',
            constitutionalCheck
          };
        }
      }
      
      // 2. 获取用户配额
      const userQuota = this.getUserQuota(userLevel);
      
      // 3. 获取或创建用户令牌桶
      let userBucket = this.userBuckets.get(userId);
      if (!userBucket) {
        userBucket = new UserTokenBucket(userQuota, userId);
        this.userBuckets.set(userId, userBucket);
      }
      
      // 4. 更新用户统计信息
      this.updateUserStats(userId, userLevel);
      
      // 5. 检查全局速率限制
      const globalCheck = this.globalBucket.tryConsume(1);
      if (!globalCheck.allowed) {
        this.stats.rejectedRequests++;
        this.logWarning(`全局速率限制触发: 用户${userId}, 等待时间${globalCheck.waitTimeMs}ms`);
        
        return {
          allowed: false,
          remainingTokens: 0,
          waitTimeMs: globalCheck.waitTimeMs,
          userLevel,
          reason: '系统全局速率限制',
          constitutionalCheck
        };
      }
      
      // 6. 检查用户速率限制
      const userCheck = userBucket.tryConsume(requestCost);
      if (!userCheck.allowed) {
        this.stats.rejectedRequests++;
        this.logWarning(`用户速率限制触发: ${userId}, 等级${userLevel}, 等待时间${userCheck.waitTimeMs}ms`);
        
        return {
          allowed: false,
          remainingTokens: userCheck.remainingTokens,
          waitTimeMs: userCheck.waitTimeMs,
          userLevel,
          reason: '用户速率限制',
          constitutionalCheck
        };
      }
      
      // 7. 更新成功统计
      this.stats.allowedRequests++;
      this.updateRpsStats();
      
      return {
        allowed: true,
        remainingTokens: userCheck.remainingTokens,
        waitTimeMs: 0,
        userLevel,
        constitutionalCheck
      };
      
    } catch (error: any) {
      this.logError(`速率限制检查失败: ${error.message}`);
      
      // 安全降级: 在异常情况下允许请求通过
      // 宪法依据: §306零停机协议 - 错误隔离与恢复机制
      return {
        allowed: true,
        remainingTokens: 0,
        waitTimeMs: 0,
        userLevel,
        reason: `速率限制器异常，安全降级: ${error.message}`
      };
    }
  }
  
  /**
   * 强制执行速率限制 (阻塞直到获得令牌或超时)
   * 宪法依据: §110协作效率公理，优化资源分配
   */
  async enforceRateLimit(
    userId: string,
    userLevel = 'default',
    timeoutMs = 5000
  ): Promise<RateLimitResult> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const result = await this.checkRateLimit(userId, userLevel);
      
      if (result.allowed) {
        return result;
      }
      
      // 等待建议的等待时间或最小等待时间
      const waitTime = Math.min(result.waitTimeMs, 100);
      await this.sleep(waitTime);
    }
    
    // 超时
    this.stats.rejectedRequests++;
    
    return {
      allowed: false,
      remainingTokens: 0,
      waitTimeMs: timeoutMs,
      userLevel,
      reason: `速率限制超时 (${timeoutMs}ms)`
    };
  }
  
  /**
   * Express中间件集成
   * 宪法依据: §101同步公理，确保中间件与主系统同步
   */
  middleware() {
    return async (req: any, res: any, next: Function) => {
      try {
        // 从请求中提取用户信息（简化实现）
        const userId = req.user?.id || req.ip || 'anonymous';
        const userLevel = req.user?.level || 'default';
        
        const result = await this.checkRateLimit(userId, userLevel);
        
        if (!result.allowed) {
          // 根据宪法§306零停机协议提供有意义的错误信息
          return res.status(429).json({
            error: '请求频率过高',
            message: result.reason,
            waitTimeMs: result.waitTimeMs,
            retryAfter: Math.ceil(result.waitTimeMs / 1000),
            constitutionalCheck: result.constitutionalCheck
          });
        }
        
        // 添加速率限制信息到请求头
        res.setHeader('X-RateLimit-Remaining', result.remainingTokens);
        res.setHeader('X-RateLimit-User-Level', userLevel);
        
        next();
      } catch (error: any) {
        // 安全降级：速率限制器异常时允许请求通过
        // 宪法依据: §306零停机协议
        this.logError(`速率限制中间件异常: ${error.message}`);
        next();
      }
    };
  }
  
  /**
   * 获取用户配额
   */
  private getUserQuota(userLevel: string): UserQuota {
    const quota = this.config.userLevelQuotas.get(userLevel);
    if (quota) {
      return quota;
    }
    
    this.logWarning(`未找到用户等级${userLevel}的配额，使用默认配额`);
    return this.config.defaultQuota;
  }
  
  /**
   * 执行宪法合规检查
   * 宪法依据: §190网络韧性公理、§306零停机协议、§110协作效率公理
   */
  private async performConstitutionalCheck(userId: string, userLevel: string): Promise<{
    compliant: boolean;
    violatedClauses: string[];
    evidence: string;
  }> {
    const userQuota = this.getUserQuota(userLevel);
    const violatedClauses: string[] = [];
    const evidence: string[] = [];
    
    // 检查配额是否包含宪法约束
    if (userQuota.constitutionalConstraints.length === 0) {
      violatedClauses.push('§190.1');
      evidence.push('用户配额未包含宪法约束');
    }
    
    // 检查优先级设置是否合理
    if (userQuota.priority < 1 || userQuota.priority > 10) {
      violatedClauses.push('§110.2');
      evidence.push(`用户优先级设置不合理: ${userQuota.priority}`);
    }
    
    // 检查突发容量是否合理
    if (userQuota.burstCapacity < userQuota.requestsPerSecond) {
      violatedClauses.push('§306.3');
      evidence.push(`突发容量(${userQuota.burstCapacity})小于平均速率(${userQuota.requestsPerSecond})`);
    }
    
    // 检查每日限制是否合理
    const dailySeconds = 24 * 60 * 60;
    const theoreticalMax = userQuota.requestsPerSecond * dailySeconds;
    if (userQuota.maxDailyRequests > theoreticalMax * 2) {
      violatedClauses.push('§190.4');
      evidence.push(`每日限制(${userQuota.maxDailyRequests})超过理论最大值(${theoreticalMax})的两倍`);
    }
    
    return {
      compliant: violatedClauses.length === 0,
      violatedClauses,
      evidence: evidence.join('; ')
    };
  }
  
  /**
   * 更新用户统计信息
   */
  private updateUserStats(userId: string, userLevel: string): void {
    let userStat = this.stats.userStats.get(userId);
    
    if (!userStat) {
      userStat = {
        userId,
        userLevel,
        totalRequests: 0,
        allowedRequests: 0,
        rejectedRequests: 0,
        currentRps: 0,
        avgRps: new EWMA(0.1),
        lastRequestTime: Date.now(),
        dailyRequestCount: 0,
        lastResetTime: Date.now()
      };
      this.stats.userStats.set(userId, userStat);
    }
    
    // 检查是否需要重置每日计数
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    if (now - userStat.lastResetTime > oneDayMs) {
      userStat.dailyRequestCount = 0;
      userStat.lastResetTime = now;
    }
    
    userStat.totalRequests++;
    userStat.lastRequestTime = now;
  }
  
  /**
   * 更新RPS统计
   */
  private updateRpsStats(): void {
    const now = Date.now();
    
    // 更新全局RPS统计
    this.stats.avgRps.add(1);
    
    // 计算当前RPS (基于最近1秒的请求)
    // 实际实现应该更精确
    this.stats.currentRps = this.stats.avgRps.getAverage() * 10; // 简化计算
  }
  
  /**
   * 获取统计信息
   */
  getStats(): RateLimitStats {
    return {
      ...this.stats,
      userStats: new Map(this.stats.userStats)
    };
  }
  
  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      allowedRequests: 0,
      rejectedRequests: 0,
      currentRps: 0,
      avgRps: new EWMA(0.1),
      userStats: new Map()
    };
    
    this.logInfo('速率限制统计信息已重置');
  }
  
  /**
   * 更新配置
   * 宪法依据: §101同步公理，配置变更需确保系统稳定性
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    const oldConfig = { ...this.config };
    this.config = {
      ...this.config,
      ...config,
      userLevelQuotas: config.userLevelQuotas 
        ? new Map([...this.config.userLevelQuotas, ...config.userLevelQuotas])
        : this.config.userLevelQuotas
    };
    
    this.logInfo('速率限制配置已更新');
    this.logInfo(`宪法依据: §101同步公理 - 配置变更触发系统更新`);
    this.logDebug(`旧配置: ${JSON.stringify(oldConfig)}`);
    this.logDebug(`新配置: ${JSON.stringify(this.config)}`);
  }
  
  /**
   * 获取用户令牌桶状态
   */
  getUserBucketStatus(userId: string): any {
    const bucket = this.userBuckets.get(userId);
    if (!bucket) {
      return null;
    }
    
    return bucket.getStatus();
  }
  
  /**
   * 清理过期用户令牌桶
   */
  cleanupExpiredBuckets(maxAgeMs = 3600000): void { // 默认1小时
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [userId, bucket] of this.userBuckets.entries()) {
      if (now - bucket.lastAccessTime > maxAgeMs) {
        this.userBuckets.delete(userId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.logInfo(`清理了${cleanedCount}个过期用户令牌桶`);
    }
  }
  
  /**
   * 睡眠辅助函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * 日志记录
   */
  private logInfo(message: string): void {
    logger.info(`[RateLimiter] ${message}`);
  }
  
  private logWarning(message: string): void {
    logger.warn(`[RateLimiter] ${message}`);
  }
  
  private logError(message: string): void {
    logger.error(`[RateLimiter] ${message}`);
  }
  
  private logDebug(message: string): void {
    logger.debug(`[RateLimiter] ${message}`);
  }
}

/**
 * 用户令牌桶实现
 * 宪法依据: §190网络韧性公理，确保令牌桶算法正确性
 */
class UserTokenBucket {
  private quota: UserQuota;
  private tokens: number;
  private lastRefillTime: number;
  private userId: string;
  public lastAccessTime: number;
  
  constructor(quota: UserQuota, userId: string) {
    this.quota = quota;
    this.userId = userId;
    this.tokens = quota.burstCapacity; // 初始时令牌桶是满的
    this.lastRefillTime = Date.now();
    this.lastAccessTime = Date.now();
  }
  
  tryConsume(tokens = 1): { allowed: boolean; remainingTokens: number; waitTimeMs: number } {
    this.lastAccessTime = Date.now();
    this.refillTokens();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return {
        allowed: true,
        remainingTokens: this.tokens,
        waitTimeMs: 0
      };
    }
    
    // 计算需要等待的时间
    const tokensNeeded = tokens - this.tokens;
    const waitTimeMs = Math.ceil((tokensNeeded / this.quota.requestsPerSecond) * 1000);
    
    return {
      allowed: false,
      remainingTokens: this.tokens,
      waitTimeMs
    };
  }
  
  private refillTokens(): void {
    const now = Date.now();
    const elapsedMs = now - this.lastRefillTime;
    
    // 计算应补充的令牌数
    const tokensToAdd = (elapsedMs / 1000) * this.quota.requestsPerSecond;
    
    this.tokens = Math.min(this.quota.burstCapacity, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }
  
  getStatus(): any {
    this.refillTokens();
    
    return {
      userId: this.userId,
      tokens: this.tokens,
      capacity: this.quota.burstCapacity,
      refillRate: this.quota.requestsPerSecond,
      lastRefillTime: this.lastRefillTime,
      lastAccessTime: this.lastAccessTime,
      quota: {
        requestsPerSecond: this.quota.requestsPerSecond,
        burstCapacity: this.quota.burstCapacity,
        maxDailyRequests: this.quota.maxDailyRequests,
        priority: this.quota.priority,
        constitutionalConstraints: this.quota.constitutionalConstraints
      }
    };
  }
}

/**
 * 全局令牌桶实现
 * 宪法依据: §306零停机协议，防止系统过载
 */
class GlobalTokenBucket {
  private maxRps: number;
  private tokens: number;
  private lastRefillTime: number;
  
  constructor(maxRps: number) {
    this.maxRps = maxRps;
    this.tokens = maxRps; // 初始时令牌桶是满的
    this.lastRefillTime = Date.now();
  }
  
  tryConsume(tokens = 1): { allowed: boolean; waitTimeMs: number } {
    this.refillTokens();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return {
        allowed: true,
        waitTimeMs: 0
      };
    }
    
    // 计算需要等待的时间
    const tokensNeeded = tokens - this.tokens;
    const waitTimeMs = Math.ceil((tokensNeeded / this.maxRps) * 1000);
    
    return {
      allowed: false,
      waitTimeMs
    };
  }
  
  private refillTokens(): void {
    const now = Date.now();
    const elapsedMs = now - this.lastRefillTime;
    
    // 计算应补充的令牌数
    const tokensToAdd = (elapsedMs / 1000) * this.maxRps;
    
    this.tokens = Math.min(this.maxRps, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }
  
  getStatus(): any {
    this.refillTokens();
    
    return {
      tokens: this.tokens,
      capacity: this.maxRps,
      refillRate: this.maxRps,
      lastRefillTime: this.lastRefillTime
    };
  }
}

/**
 * 创建默认速率限制器配置
 * 宪法依据: §102熵减原则，复用MY-DOGE-DEMO已验证配置
 */
export function createDefaultRateLimiterConfig(): RateLimitConfig {
  const userLevelQuotas = new Map([
    ['admin', {
      requestsPerSecond: 100,
      burstCapacity: 200,
      maxDailyRequests: 10000,
      priority: 10,
      constitutionalConstraints: ['§190', '§306', '§110']
    }],
    ['premium', {
      requestsPerSecond: 50,
      burstCapacity: 100,
      maxDailyRequests: 5000,
      priority: 8,
      constitutionalConstraints: ['§190', '§306']
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

export default {
  RateLimiter,
  createDefaultRateLimiterConfig
};