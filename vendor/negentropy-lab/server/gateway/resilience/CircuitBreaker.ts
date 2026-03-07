/**
 * ⚡ 断路器模式实现 - 故障检测和隔离机制（简化版）
 * 
 * 宪法依据: §306零停机协议、§190网络韧性公理、§186错误隔离与恢复机制
 * 版本: v1.0.0 (Phase 1B Day 3移植简化版)
 * 状态: 🟢 活跃
 * 
 * 核心原则:
 * 1. 三级状态: CLOSED(闭合) - HALF_OPEN(半开) - OPEN(熔断)
 * 2. 自适应恢复: 基于成功率的渐进式恢复策略
 * 3. 宪法合规: 熔断决策必须有明确的宪法依据
 * 4. 安全降级: 熔断时提供有意义的错误响应
 * 
 * 设计模式: Circuit Breaker Pattern
 * 移植来源: MY-DOGE-DEMO/server/agents/resilience/coordination/IntelligentCircuitBreaker.ts (简化版)
 * 
 * 数学公式:
 * - 失败率阈值: $F_{threshold}$
 * - 恢复检查间隔: $T_{recovery}$
 * - 半开测试请求数: $N_{test}$
 * - 恢复成功率阈值: $S_{threshold}$
 * 
 * 宪法约束:
 * - §306.3: 必须实现零停机服务连续性
 * - §190.2: 必须提供网络韧性保障
 * - §186.1: 必须支持错误隔离与恢复
 */

import { logger } from '../../utils/logger';

export enum CircuitBreakerState {
    CLOSED = 'CLOSED',      // 闭合状态: 正常处理请求
    HALF_OPEN = 'HALF_OPEN', // 半开状态: 试探性处理部分请求
    OPEN = 'OPEN'           // 熔断状态: 拒绝所有请求，快速失败
}

export interface CircuitBreakerConfig {
    // 熔断触发阈值
    failureThreshold: number;           // 连续失败次数阈值 (默认5)
    recoveryTimeout: number;            // 恢复检查间隔 (ms, 默认30000)
    halfOpenMaxAttempts: number;        // 半开状态最大测试请求数 (默认3)
    
    // 监控配置
    monitorHealth: boolean;             // 是否监控健康状态
    enableConstitutionalMonitoring: boolean; // 是否启用宪法合规监控
    enableAutoRecovery: boolean;        // 是否启用自动恢复
    
    // 高级配置
    resetTimeout: number;               // 自动重置超时 (ms)
    windowSize: number;                 // 滑动窗口大小 (请求数)
}

export interface CircuitBreakerStatus {
    serviceId: string;                  // 服务标识符
    currentState: CircuitBreakerState;  // 当前状态
    failureCount: number;               // 当前失败次数
    successCount: number;               // 当前成功次数
    lastFailureTime: number | null;     // 最后失败时间
    lastSuccessTime: number | null;     // 最后成功时间
    lastStateChange: number;            // 最后状态变更时间
    consecutiveFailures: number;        // 连续失败次数
    consecutiveSuccesses: number;       // 连续成功次数
    totalTrips: number;                 // 总熔断次数
    healthScore: number;                // 健康评分 (0-100)
}

export interface CircuitBreakerResult {
    allowed: boolean;                   // 是否允许请求
    state: CircuitBreakerState;         // 当前状态
    waitTimeMs?: number;                // 建议等待时间
    reason?: string;                    // 拒绝原因
    healthScore?: number;               // 健康评分
}

/**
 * 断路器类（简化版）
 * 宪法依据: §306零停机协议、§190网络韧性公理、§186错误隔离与恢复机制
 */
export class CircuitBreaker {
    private config: CircuitBreakerConfig;
    private status: CircuitBreakerStatus;
    private stateHistory: Array<{
        state: CircuitBreakerState;
        timestamp: number;
        reason?: string;
        details?: any;
    }>;
    private serviceId: string;
    
    constructor(config: Partial<CircuitBreakerConfig> = {}) {
        this.serviceId = 'gateway_circuit_breaker';
        this.config = {
            failureThreshold: 5,
            recoveryTimeout: 30000,     // 30秒
            halfOpenMaxAttempts: 3,
            monitorHealth: true,
            enableConstitutionalMonitoring: true,
            enableAutoRecovery: true,
            resetTimeout: 60000,        // 60秒
            windowSize: 100,
            ...config
        };
        
        // 初始化状态
        this.status = {
            serviceId: this.serviceId,
            currentState: CircuitBreakerState.CLOSED,
            failureCount: 0,
            successCount: 0,
            lastFailureTime: null,
            lastSuccessTime: null,
            lastStateChange: Date.now(),
            consecutiveFailures: 0,
            consecutiveSuccesses: 0,
            totalTrips: 0,
            healthScore: 100
        };
        
        this.stateHistory = [{
            state: CircuitBreakerState.CLOSED,
            timestamp: Date.now(),
            reason: '初始化',
            details: { config: this.config }
        }];
        
        this.logInfo('断路器初始化完成');
        this.logInfo(`宪法依据: §306零停机协议、§190网络韧性公理、§186错误隔离与恢复机制`);
        this.logInfo(`配置: 失败阈值=${this.config.failureThreshold}, 恢复超时=${this.config.recoveryTimeout}ms`);
        
        // 启动健康监控（如果启用）
        if (this.config.monitorHealth) {
            this.startHealthMonitoring();
        }
    }
    
    /**
     * 检查请求是否允许通过
     */
    async allowRequest(operation = 'default'): Promise<CircuitBreakerResult> {
        const currentTime = Date.now();
        
        switch (this.status.currentState) {
            case CircuitBreakerState.CLOSED:
                // 闭合状态: 允许所有请求
                return {
                    allowed: true,
                    state: CircuitBreakerState.CLOSED,
                    healthScore: this.status.healthScore
                };
                
            case CircuitBreakerState.HALF_OPEN:
                // 半开状态: 允许有限数量的测试请求
                if (this.status.consecutiveSuccesses < this.config.halfOpenMaxAttempts) {
                    return {
                        allowed: true,
                        state: CircuitBreakerState.HALF_OPEN,
                        healthScore: this.status.healthScore,
                        reason: `半开状态测试请求 (${this.status.consecutiveSuccesses + 1}/${this.config.halfOpenMaxAttempts})`
                    };
                } else {
                    // 测试请求已满，等待评估
                    const timeInHalfOpen = currentTime - this.status.lastStateChange;
                    const remainingTime = Math.max(1000, this.config.recoveryTimeout - timeInHalfOpen);
                    
                    return {
                        allowed: false,
                        state: CircuitBreakerState.HALF_OPEN,
                        waitTimeMs: remainingTime,
                        reason: '半开状态测试请求已满，等待评估结果',
                        healthScore: this.status.healthScore
                    };
                }
                
            case CircuitBreakerState.OPEN:
                // 熔断状态: 检查是否需要尝试恢复
                const timeInOpenState = currentTime - this.status.lastStateChange;
                
                if (timeInOpenState >= this.config.recoveryTimeout) {
                    // 达到恢复检查时间，切换到半开状态
                    await this.transitionToState(
                        CircuitBreakerState.HALF_OPEN,
                        '自动恢复检查',
                        { timeInOpenState }
                    );
                    
                    // 重新检查
                    return this.allowRequest(operation);
                }
                
                // 仍在熔断状态，拒绝请求
                const remainingTime = this.config.recoveryTimeout - timeInOpenState;
                return {
                    allowed: false,
                    state: CircuitBreakerState.OPEN,
                    waitTimeMs: Math.max(1000, remainingTime),
                    reason: `熔断状态生效中 (${Math.round(timeInOpenState / 1000)}秒)`,
                    healthScore: this.status.healthScore
                };
                
            default:
                // 未知状态，拒绝请求
                return {
                    allowed: false,
                    state: this.status.currentState,
                    waitTimeMs: 5000,
                    reason: '未知断路器状态',
                    healthScore: 0
                };
        }
    }
    
    /**
     * 记录请求成功
     * 宪法依据: §306零停机协议 - 成功恢复跟踪
     */
    recordSuccess(responseTimeMs?: number): void {
        this.status.successCount++;
        this.status.lastSuccessTime = Date.now();
        
        if (this.status.currentState === CircuitBreakerState.HALF_OPEN) {
            this.status.consecutiveSuccesses++;
            this.status.consecutiveFailures = 0;
            
            // 检查是否满足恢复条件
            const successRate = this.status.consecutiveSuccesses / this.config.halfOpenMaxAttempts;
            if (successRate >= 0.8) { // 80%成功率恢复
                this.transitionToState(
                    CircuitBreakerState.CLOSED,
                    '半开状态恢复成功',
                    { successRate, consecutiveSuccesses: this.status.consecutiveSuccesses }
                );
            }
        } else if (this.status.currentState === CircuitBreakerState.CLOSED) {
            this.status.consecutiveSuccesses++;
            this.status.consecutiveFailures = Math.max(0, this.status.consecutiveFailures - 1);
            
            // 重置健康评分
            this.updateHealthScore(true);
        }
        
        this.logDebug(`请求成功记录: 状态=${this.status.currentState}, 连续成功=${this.status.consecutiveSuccesses}`);
    }
    
    /**
     * 记录请求失败
     * 宪法依据: §186错误隔离与恢复机制 - 失败跟踪
     */
    recordFailure(errorType: string, constitutionalViolation = false): void {
        this.status.failureCount++;
        this.status.lastFailureTime = Date.now();
        
        if (this.status.currentState === CircuitBreakerState.HALF_OPEN) {
            this.status.consecutiveFailures++;
            this.status.consecutiveSuccesses = Math.max(0, this.status.consecutiveSuccesses - 1);
            
            // 半开状态失败可能触发重新熔断
            if (this.status.consecutiveFailures >= 2) { // 半开状态容忍2次失败
                this.transitionToState(
                    CircuitBreakerState.OPEN,
                    '半开状态测试失败',
                    { consecutiveFailures: this.status.consecutiveFailures, errorType }
                );
            }
        } else if (this.status.currentState === CircuitBreakerState.CLOSED) {
            this.status.consecutiveFailures++;
            this.status.consecutiveSuccesses = Math.max(0, this.status.consecutiveSuccesses - 1);
            
            // 检查是否触发熔断
            if (this.status.consecutiveFailures >= this.config.failureThreshold) {
                const reason = constitutionalViolation 
                    ? `宪法违规触发熔断: ${errorType}`
                    : `错误率触发熔断: ${errorType}`;
                    
                this.transitionToState(
                    CircuitBreakerState.OPEN,
                    reason,
                    { 
                        consecutiveFailures: this.status.consecutiveFailures,
                        errorType,
                        constitutionalViolation 
                    }
                );
            }
        }
        
        // 更新健康评分
        this.updateHealthScore(false);
        
        this.logWarning(`请求失败记录: ${errorType}, 状态=${this.status.currentState}, 连续失败=${this.status.consecutiveFailures}`);
    }
    
    /**
     * 状态转换
     */
    private async transitionToState(
        newState: CircuitBreakerState,
        reason: string,
        details?: any
    ): Promise<void> {
        const oldState = this.status.currentState;
        
        // 更新状态
        this.status.currentState = newState;
        this.status.lastStateChange = Date.now();
        
        // 记录状态变更
        this.stateHistory.push({
            state: newState,
            timestamp: Date.now(),
            reason,
            details
        });
        
        // 限制历史记录大小
        if (this.stateHistory.length > 50) {
            this.stateHistory = this.stateHistory.slice(-30);
        }
        
        // 状态特定处理
        switch (newState) {
            case CircuitBreakerState.OPEN:
                this.status.totalTrips++;
                this.status.consecutiveSuccesses = 0;
                this.status.consecutiveFailures = 0;
                break;
                
            case CircuitBreakerState.HALF_OPEN:
                this.status.consecutiveSuccesses = 0;
                this.status.consecutiveFailures = 0;
                break;
                
            case CircuitBreakerState.CLOSED:
                this.status.consecutiveSuccesses = 0;
                this.status.consecutiveFailures = 0;
                break;
        }
        
        this.logInfo(`断路器状态变更: ${oldState} -> ${newState} (原因: ${reason})`);
        
        if (details) {
            this.logDebug(`状态变更详情: ${JSON.stringify(details)}`);
        }
    }
    
    /**
     * 更新健康评分
     */
    private updateHealthScore(success: boolean): void {
        const baseScore = 100;
        
        // 计算基于成功率和状态的评分
        let score = baseScore;
        
        // 状态惩罚
        switch (this.status.currentState) {
            case CircuitBreakerState.OPEN:
                score -= 50; // 熔断状态严重惩罚
                break;
            case CircuitBreakerState.HALF_OPEN:
                score -= 20; // 半开状态中等惩罚
                break;
        }
        
        // 失败率惩罚
        const totalRequests = this.status.successCount + this.status.failureCount;
        if (totalRequests > 0) {
            const failureRate = this.status.failureCount / totalRequests;
            score -= Math.min(30, failureRate * 30); // 最多扣30分
        }
        
        // 连续失败惩罚
        if (this.status.consecutiveFailures > 0) {
            const penalty = Math.min(20, this.status.consecutiveFailures * 5);
            score -= penalty;
        }
        
        // 确保分数在0-100范围内
        score = Math.max(0, Math.min(100, score));
        
        this.status.healthScore = Math.round(score);
    }
    
    /**
     * 启动健康监控
     */
    private startHealthMonitoring(): void {
        // 简化实现：每30秒更新一次健康评分
        setInterval(() => {
            this.updateHealthScore(true); // 定期更新
        }, 30000);
        
        this.logInfo('健康监控已启动 (30秒间隔)');
    }
    
    // ==================== 公开方法 ====================
    
    /**
     * Express中间件集成
     * 宪法依据: §306零停机协议，确保中间件正确处理断路器逻辑
     */
    middleware() {
        return async (req: any, res: any, next: Function) => {
            try {
                const operation = `${req.method} ${req.path}`;
                const result = await this.allowRequest(operation);
                
                if (!result.allowed) {
                    // 根据宪法§306零停机协议提供有意义的错误信息
                    return res.status(503).json({
                        error: '服务暂时不可用',
                        message: result.reason,
                        state: result.state,
                        waitTimeMs: result.waitTimeMs,
                        retryAfter: Math.ceil((result.waitTimeMs || 0) / 1000),
                        healthScore: result.healthScore,
                        constitutionalReference: ['§306', '§190', '§186']
                    });
                }
                
                // 添加断路器状态到请求头
                res.setHeader('X-Circuit-Breaker-State', result.state);
                res.setHeader('X-Circuit-Breaker-Health', result.healthScore || 100);
                
                // 保存引用以便记录结果
                const originalSend = res.send.bind(res);
                res.send = (body: any) => {
                    // 根据状态码记录成功或失败
                    if (res.statusCode >= 200 && res.statusCode < 400) {
                        this.recordSuccess();
                    } else if (res.statusCode >= 400 && res.statusCode < 500) {
                        this.recordFailure(`HTTP_${res.statusCode}`, false);
                    } else if (res.statusCode >= 500) {
                        this.recordFailure(`HTTP_${res.statusCode}`, false);
                    }
                    
                    return originalSend(body);
                };
                
                next();
                
            } catch (error: any) {
                // 安全降级：断路器异常时允许请求通过
                // 宪法依据: §306零停机协议
                this.logError(`断路器中间件异常: ${error.message}`);
                next();
            }
        };
    }
    
    /**
     * 获取当前状态
     */
    getStatus(): CircuitBreakerStatus {
        return { ...this.status };
    }
    
    /**
     * 获取状态历史
     */
    getStateHistory(limit = 10): Array<{
        state: CircuitBreakerState;
        timestamp: number;
        reason?: string;
        details?: any;
    }> {
        return this.stateHistory.slice(-limit);
    }
    
    /**
     * 手动触发熔断
     */
    async manualTrip(reason = '手动干预'): Promise<void> {
        await this.transitionToState(
            CircuitBreakerState.OPEN,
            `手动触发: ${reason}`,
            { manual: true }
        );
        this.logInfo(`手动触发熔断: ${reason}`);
    }
    
    /**
     * 手动恢复
     */
    async manualReset(): Promise<void> {
        await this.transitionToState(
            CircuitBreakerState.CLOSED,
            '手动恢复',
            { manualReset: true }
        );
        this.logInfo('手动恢复断路器到闭合状态');
    }
    
    /**
     * 重置断路器状态
     */
    reset(): void {
        this.status = {
            ...this.status,
            currentState: CircuitBreakerState.CLOSED,
            failureCount: 0,
            successCount: 0,
            lastFailureTime: null,
            lastSuccessTime: null,
            lastStateChange: Date.now(),
            consecutiveFailures: 0,
            consecutiveSuccesses: 0,
            totalTrips: 0,
            healthScore: 100
        };
        
        this.stateHistory = [{
            state: CircuitBreakerState.CLOSED,
            timestamp: Date.now(),
            reason: '重置',
            details: { reset: true }
        }];
        
        this.logInfo('断路器状态已重置');
    }
    
    /**
     * 获取配置
     */
    getConfig(): CircuitBreakerConfig {
        return { ...this.config };
    }
    
    /**
     * 更新配置
     */
    updateConfig(configUpdate: Partial<CircuitBreakerConfig>): void {
        this.config = { ...this.config, ...configUpdate };
        this.logInfo('断路器配置已更新');
    }
    
    /**
     * 执行宪法合规检查
     */
    performConstitutionalCheck(): {
        compliant: boolean;
        violatedClauses: string[];
        recommendations: string[];
    } {
        const checks = [
            {
                clause: '§306',
                description: '零停机协议合规',
                check: () => this.config.enableAutoRecovery && this.config.recoveryTimeout > 0,
                result: null as boolean | null
            },
            {
                clause: '§190',
                description: '网络韧性公理合规',
                check: () => this.config.monitorHealth && this.status.healthScore > 0,
                result: null
            },
            {
                clause: '§186',
                description: '错误隔离与恢复机制合规',
                check: () => this.config.failureThreshold > 0 && this.config.recoveryTimeout > 0,
                result: null
            }
        ];
        
        // 执行检查
        checks.forEach(check => {
            try {
                check.result = check.check();
            } catch (error) {
                check.result = false;
            }
        });
        
        const passedChecks = checks.filter(c => c.result).length;
        const totalChecks = checks.length;
        const complianceScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;
        
        const violatedClauses = checks.filter(c => !c.result).map(c => c.clause);
        const recommendations = [];
        
        if (violatedClauses.includes('§306')) {
            recommendations.push('建议启用自动恢复并设置合理的恢复超时');
        }
        if (violatedClauses.includes('§190')) {
            recommendations.push('建议启用健康监控以保障网络韧性');
        }
        if (violatedClauses.includes('§186')) {
            recommendations.push('建议设置合理的失败阈值和恢复超时');
        }
        
        return {
            compliant: complianceScore >= 67, // 至少通过2/3
            violatedClauses,
            recommendations: recommendations.length > 0 ? recommendations : ['宪法合规状态良好']
        };
    }
    
    // ==================== 日志方法 ====================
    
    private logDebug(message: string, details?: any): void {
        logger.debug(`[CircuitBreaker] ${message}`, details || '');
    }
    
    private logInfo(message: string, details?: any): void {
        logger.info(`[CircuitBreaker] ${message}`, details || '');
    }
    
    private logWarning(message: string, details?: any): void {
        logger.warn(`[CircuitBreaker] ${message}`, details || '');
    }
    
    private logError(message: string, details?: any): void {
        logger.error(`[CircuitBreaker] ${message}`, details || '');
    }
}

/**
 * 创建默认断路器配置
 * 宪法依据: §102熵减原则，复用MY-DOGE-DEMO已验证配置
 */
export function createDefaultCircuitBreakerConfig(): CircuitBreakerConfig {
    return {
        failureThreshold: 5,
        recoveryTimeout: 30000,      // 30秒
        halfOpenMaxAttempts: 3,
        monitorHealth: true,
        enableConstitutionalMonitoring: true,
        enableAutoRecovery: true,
        resetTimeout: 60000,         // 60秒
        windowSize: 100
    };
}

export default {
    CircuitBreaker,
    createDefaultCircuitBreakerConfig
};