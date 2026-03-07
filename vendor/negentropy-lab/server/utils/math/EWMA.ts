/**
 * EWMA.ts (指数加权移动平均)
 * 宪法依据: §127 (数据驱动原则), §121 (数学约束)
 * 开发标准: DS-043_性能监控与告警标准实现
 * 
 * 实现指数加权移动平均算法:
 * $EMA_t = \alpha \cdot x_t + (1 - \alpha) \cdot EMA_{t-1}$
 * 其中 $\alpha = 2 / (N + 1)$, $N$ 为时间窗口长度
 */

export class EWMA {
    private alpha: number;
    private currentAverage: number;
    private count: number;
    private initialized: boolean;
    
    /**
     * 构造函数
     * @param alpha 平滑因子 (0 < alpha ≤ 1)
     *             如果提供timeWindow，则alpha = 2 / (timeWindow + 1)
     * @param timeWindow 时间窗口长度 (数据点数)
     */
    constructor(alpha?: number, timeWindow?: number) {
        if (timeWindow !== undefined) {
            if (timeWindow <= 0) {
                throw new Error('Time window must be positive');
            }
            this.alpha = 2 / (timeWindow + 1);
        } else if (alpha !== undefined) {
            if (alpha <= 0 || alpha > 1) {
                throw new Error('Alpha must be between 0 (exclusive) and 1 (inclusive)');
            }
            this.alpha = alpha;
        } else {
            // 默认窗口长度: 10个数据点
            this.alpha = 2 / (10 + 1); // ≈ 0.1818
        }
        
        this.currentAverage = 0;
        this.count = 0;
        this.initialized = false;
    }
    
    /**
     * 添加新值
     * @param value 新值
     */
    add(value: number): void {
        if (!this.initialized) {
            // 第一个值直接作为平均值
            this.currentAverage = value;
            this.initialized = true;
        } else {
            // 应用EMA公式
            this.currentAverage = this.alpha * value + (1 - this.alpha) * this.currentAverage;
        }
        
        this.count++;
    }
    
    /**
     * 批量添加值
     * @param values 值数组
     */
    addValues(values: number[]): void {
        for (const value of values) {
            this.add(value);
        }
    }
    
    /**
     * 获取当前平均值
     */
    getAverage(): number {
        if (!this.initialized) {
            return 0;
        }
        return this.currentAverage;
    }
    
    /**
     * 获取当前值数量
     */
    getCount(): number {
        return this.count;
    }
    
    /**
     * 重置平均值
     */
    reset(): void {
        this.currentAverage = 0;
        this.count = 0;
        this.initialized = false;
    }
    
    /**
     * 获取平滑因子alpha
     */
    getAlpha(): number {
        return this.alpha;
    }
    
    /**
     * 设置平滑因子
     * @param alpha 新的平滑因子
     */
    setAlpha(alpha: number): void {
        if (alpha <= 0 || alpha > 1) {
            throw new Error('Alpha must be between 0 (exclusive) and 1 (inclusive)');
        }
        this.alpha = alpha;
    }
    
    /**
     * 设置时间窗口长度
     * @param timeWindow 时间窗口长度 (数据点数)
     */
    setTimeWindow(timeWindow: number): void {
        if (timeWindow <= 0) {
            throw new Error('Time window must be positive');
        }
        this.alpha = 2 / (timeWindow + 1);
    }
    
    /**
     * 获取当前值的标准差估计
     * 基于EWMA方差估计: $Var_t = (1 - \alpha) \cdot Var_{t-1} + \alpha \cdot (x_t - EMA_{t-1})^2$
     * @param recentValues 最近的值数组 (用于计算样本标准差)
     */
    getStandardDeviation(recentValues?: number[]): number {
        if (this.count < 2) {
            return 0;
        }
        
        if (recentValues && recentValues.length > 1) {
            // 使用提供的最近值计算样本标准差
            const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
            const variance = recentValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (recentValues.length - 1);
            return Math.sqrt(variance);
        }
        
        // 简单估计: 使用平均值的10%作为标准差
        return Math.abs(this.currentAverage) * 0.1;
    }
    
    /**
     * 获取置信区间
     * @param confidenceLevel 置信水平 (0-1)
     * @param recentValues 最近的值数组
     * @returns [下限, 上限]
     */
    getConfidenceInterval(confidenceLevel = 0.95, recentValues?: number[]): [number, number] {
        if (this.count < 2) {
            return [this.currentAverage, this.currentAverage];
        }
        
        const stdDev = this.getStandardDeviation(recentValues);
        const zScore = this.getZScore(confidenceLevel);
        const margin = zScore * stdDev / Math.sqrt(this.count);
        
        return [
            this.currentAverage - margin,
            this.currentAverage + margin
        ];
    }
    
    /**
     * 预测下一个值
     * 简单的EWMA预测: 下一个值等于当前平均值
     */
    predictNext(): number {
        return this.currentAverage;
    }
    
    /**
     * 检测异常值
     * @param value 待检测的值
     * @param threshold 阈值 (标准差的倍数)
     * @returns 是否为异常值
     */
    isOutlier(value: number, threshold = 3, recentValues?: number[]): boolean {
        if (this.count < 2) {
            return false;
        }
        
        const stdDev = this.getStandardDeviation(recentValues);
        const zScore = Math.abs((value - this.currentAverage) / stdDev);
        
        return zScore > threshold;
    }
    
    /**
     * 获取趋势方向
     * @param recentValues 最近的值数组 (至少2个)
     * @returns 趋势: 'up' | 'down' | 'stable'
     */
    getTrend(recentValues?: number[]): 'up' | 'down' | 'stable' {
        if (!recentValues || recentValues.length < 2) {
            return 'stable';
        }
        
        // 计算线性回归斜率
        const n = recentValues.length;
        const indices = Array.from({ length: n }, (_, i) => i);
        
        const sumX = indices.reduce((sum, val) => sum + val, 0);
        const sumY = recentValues.reduce((sum, val) => sum + val, 0);
        const sumXY = indices.reduce((sum, x, i) => sum + x * recentValues[i], 0);
        const sumX2 = indices.reduce((sum, x) => sum + x * x, 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        
        if (slope > 0.01) {
            return 'up';
        } else if (slope < -0.01) {
            return 'down';
        } else {
            return 'stable';
        }
    }
    
    /**
     * 导出当前状态
     */
    exportState(): { average: number; count: number; alpha: number; initialized: boolean } {
        return {
            average: this.currentAverage,
            count: this.count,
            alpha: this.alpha,
            initialized: this.initialized
        };
    }
    
    /**
     * 导入状态
     */
    importState(state: { average: number; count: number; alpha: number; initialized: boolean }): void {
        this.currentAverage = state.average;
        this.count = state.count;
        this.alpha = state.alpha;
        this.initialized = state.initialized;
    }
    
    /**
     * 根据置信水平获取Z分数
     * @param confidenceLevel 置信水平 (0-1)
     */
    private getZScore(confidenceLevel: number): number {
        // 常见置信水平对应的Z分数
        const zScores: Record<number, number> = {
            0.90: 1.645,
            0.95: 1.96,
            0.99: 2.576,
            0.997: 3.0
        };
        
        return zScores[confidenceLevel] || 1.96; // 默认95%置信水平
    }
    
    /**
     * 计算权重衰减曲线
     * @param steps 步数
     * @returns 权重数组
     */
    getWeightDecay(steps = 10): number[] {
        const weights: number[] = [];
        let weight = 1;
        
        for (let i = 0; i < steps; i++) {
            weights.push(weight);
            weight *= (1 - this.alpha);
        }
        
        return weights;
    }
    
    /**
     * 计算有效窗口大小
     * 当权重衰减到初始权重的1%时的步数
     */
    getEffectiveWindowSize(): number {
        const targetWeight = 0.01; // 1%
        const effectiveWindow = Math.log(targetWeight) / Math.log(1 - this.alpha);
        return Math.ceil(effectiveWindow);
    }
}