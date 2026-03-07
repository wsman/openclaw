/**
 * Entropy Monitor Plugin - 熵值监控插件
 *
 * 宪法依据:
 * - §101 同步公理: 代码与文档必须原子性同步
 * - §102 熵减原则: 监控系统熵值，确保持续熵减
 * - §111-§113 资源管理公理: 监控计算资源使用
 *
 * OpenClaw复用策略 (40%):
 * - 复用OpenClaw的日志系统架构
 * - 复用OpenClaw的监控数据收集模式
 * - 扩展Negentropy特有的熵值计算
 *
 * @version 1.0.0
 * @created 2026-02-12
 * @maintainer 科技部后端分队
 */
import type { PluginDefinition } from '../../../server/plugins/types/plugin-interfaces';
/**
 * 熵值指标
 *
 * 基于Negentropy-Lab的熵值模型
 */
export interface EntropyMetrics {
    /** 综合熵值 H_sys */
    h_sys: number;
    /** 认知熵 H_cog */
    h_cog: number;
    /** 结构熵 H_struct */
    h_struct: number;
    /** 对齐熵 H_align */
    h_align: number;
    /** 生理熵 H_bio */
    h_bio: number;
    /** 时间戳 */
    timestamp: number;
}
/**
 * 内存统计
 */
export interface MemoryStats {
    /** 总内存 (MB) */
    total: number;
    /** 已用内存 (MB) */
    used: number;
    /** 空闲内存 (MB) */
    free: number;
    /** 内存使用率 (%) */
    usagePercent: number;
    /** 时间戳 */
    timestamp: number;
}
/**
 * CPU统计
 */
export interface CPUStats {
    /** CPU使用率 (%) */
    usagePercent: number;
    /** CPU负载 (1分钟) */
    load1m: number;
    /** CPU负载 (5分钟) */
    load5m: number;
    /** CPU负载 (15分钟) */
    load15m: number;
    /** 时间戳 */
    timestamp: number;
}
/**
 * 磁盘统计
 */
export interface DiskStats {
    /** 总容量 (GB) */
    total: number;
    /** 已用容量 (GB) */
    used: number;
    /** 空闲容量 (GB) */
    free: number;
    /** 使用率 (%) */
    usagePercent: number;
    /** 时间戳 */
    timestamp: number;
}
/**
 * 系统指标汇总
 */
export interface SystemMetrics {
    /** CPU统计 */
    cpu: CPUStats;
    /** 内存统计 */
    memory: MemoryStats;
    /** 磁盘统计 */
    disk: DiskStats;
    /** 熵值指标 */
    entropy: EntropyMetrics;
    /** 时间戳 */
    timestamp: number;
}
/**
 * 告警级别
 */
export type AlertLevel = 'info' | 'warn' | 'error' | 'critical';
/**
 * 告警事件
 */
export interface Alert {
    /** 告警ID */
    alertId: string;
    /** 告警级别 */
    level: AlertLevel;
    /** 告警指标 */
    metric: string;
    /** 当前值 */
    currentValue: number;
    /** 阈值 */
    threshold: number;
    /** 告警消息 */
    message: string;
    /** 时间戳 */
    timestamp: number;
}
/**
 * 熵监控配置
 */
export interface EntropyMonitorConfig {
    /** 监控指标列表 */
    metrics: string[];
    /** 阈值配置 */
    thresholds: Record<string, number>;
    /** 告警间隔 (毫秒) */
    alertInterval: number;
    /** 监控间隔 (毫秒) */
    monitorInterval: number;
    /** 数据保留天数 */
    dataRetentionDays: number;
}
/**
 * 熵值监控插件主类
 *
 * 核心功能:
 * 1. CPU监控
 * 2. 内存监控
 * 3. 熵值监控（H_sys实时追踪）
 * 4. 阈值告警
 */
export declare class EntropyMonitorPlugin {
    private api;
    private config;
    private monitorIntervalId;
    private recentAlerts;
    private metricsHistory;
    private maxHistoryLength;
    /**
     * 获取CPU使用率
     *
     * @returns CPU统计
     *
     * OpenClaw复用: 复用OpenClaw的监控数据收集模式
     */
    getCPUUsage(): Promise<CPUStats>;
    /**
     * 收集CPU统计 (内部方法)
     *
     * @private
     */
    private collectCPUStats;
    /**
     * 获取内存使用情况
     *
     * @returns 内存统计
     */
    getMemoryUsage(): Promise<MemoryStats>;
    /**
     * 收集内存统计 (内部方法)
     *
     * @private
     */
    private collectMemoryStats;
    /**
     * 获取磁盘使用情况
     *
     * @returns 磁盘统计
     */
    getDiskUsage(): Promise<DiskStats>;
    /**
     * 收集磁盘统计 (内部方法)
     *
     * @private
     */
    private collectDiskStats;
    /**
     * 获取熵值指标
     *
     * @returns 熵值指标
     */
    getEntropy(): Promise<EntropyMetrics>;
    /**
     * 计算熵值 (内部方法)
     *
     * @private
     * @description 基于Negentropy-Lab的熵值模型计算各类熵值
     */
    private calculateEntropy;
    /**
     * 计算系统熵 H_sys
     *
     * @private
     */
    private calculateSystemEntropy;
    /**
     * 计算认知熵 H_cog
     *
     * @private
     */
    private calculateCognitiveEntropy;
    /**
     * 计算结构熵 H_struct
     *
     * @private
     */
    private calculateStructuralEntropy;
    /**
     * 计算对齐熵 H_align
     *
     * @private
     */
    private calculateAlignmentEntropy;
    /**
     * 计算生理熵 H_bio
     *
     * @private
     */
    private calculateBiologicalEntropy;
    /**
     * 收集系统指标 (内部方法)
     *
     * @private
     */
    private collectSystemMetrics;
    /**
     * 检查阈值告警
     *
     * @returns 告警列表
     */
    checkThresholds(): Promise<Alert[]>;
    /**
     * 创建告警 (内部方法)
     *
     * @private
     */
    private createAlert;
    /**
     * 判断是否应该发送告警 (避免重复告警)
     *
     * @private
     */
    private shouldSendAlert;
    /**
     * 启动监控循环
     */
    startMonitoring(): Promise<void>;
    /**
     * 停止监控循环
     */
    stopMonitoring(): Promise<void>;
    /**
     * 监控循环单次执行 (内部方法)
     *
     * @private
     */
    private monitoringTick;
    /**
     * 保存指标到历史记录 (内部方法)
     *
     * @private
     */
    private saveMetricsToHistory;
    /**
     * 获取指标历史记录
     *
     * @param limit - 返回记录数量限制
     * @returns 指标历史记录
     */
    getMetricsHistory(limit?: number): Promise<SystemMetrics[]>;
    /**
     * 获取当前系统指标
     *
     * @returns 系统指标
     */
    getCurrentMetrics(): Promise<SystemMetrics>;
    /**
     * 获取熵值趋势
     *
     * @param hours - 查询小时数
     * @returns 熵值趋势数据
     */
    getEntropyTrend(hours?: number): Promise<Array<{
        timestamp: number;
        h_sys: number;
    }>>;
}
declare const _default: PluginDefinition;
export default _default;
//# sourceMappingURL=index.d.ts.map