/**
 * 🔧 类型定义模块 - Type Definition
 *
 * 宪法依据:
 * - §101 同步公理 - 类型定义与实现代码必须原子性同步
 * - §102 熵减原则 - 标准化类型系统，降低系统熵值
 * - §106 人才把关原则 - 类型安全，编译期质量检验
 * - §151 持久化原则 - 类型契约持久化
 *
 * 功能:
 * - TypeScript接口定义
 * - 类型约束与契约
 * - 系统抽象层
 *
 * @维护者 科技部
 * @最后更新 2026-02-12
 */

/**
 * 监控服务接口定义
 */
export interface IMonitoringService {
    record(providerId: string, data: any): void;
    getProviderHealth(providerId: string): any;
    getSystemStatus(): any;
    getTimeWindowStats(): any;
    getActiveAlerts(): any[];
    recordError(error: any): void;
    recordMetric(name: string, value: number): void;
    recordEvent(event: string, data?: any): void;
    recordTrace(traceId: string, data: any): void;
    recordAuditLog(log: any): void;
    flush(): Promise<void>;
    startTimer(name: string): () => number;
    endTimer(name: string): number;
    incrementCounter(name: string, value?: number): void;
    decrementCounter(name: string, value?: number): void;
    setGauge(name: string, value: number): void;
    recordHistogram(name: string, value: number): void;
}