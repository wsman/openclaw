/**
 * Agent Integration Plugin - Agent集成插件
 *
 * 宪法依据:
 * - §101 同步公理: 代码与文档必须原子性同步
 * - §108 异构模型策略: 明确模型参数配置
 * - §118 长时间任务执行公理: 支持复杂度分级和超时配置
 * - §118.5 智能体协同统一策略原则: 统一Agent管理
 *
 * OpenClaw复用策略 (50%):
 * - 复用OpenClaw的模型管理API调用模式
 * - 复用任务调度基础逻辑
 * - 扩展Negentropy特有的复杂度分级
 *
 * @version 1.0.0
 * @created 2026-02-12
 * @maintainer 科技部后端分队
 */
import type { PluginDefinition } from '../../../server/plugins/types/plugin-interfaces';
/**
 * 任务复杂度等级 (遵循§118.1复杂度评估)
 */
export type TaskComplexity = 'L1' | 'L2' | 'L3' | 'L4';
/**
 * 任务定义
 */
export interface Task {
    /** 任务ID */
    taskId: string;
    /** 任务描述 */
    description: string;
    /** 任务类型 */
    type: string;
    /** 任务参数 */
    params?: Record<string, unknown>;
    /** 任务优先级 */
    priority?: number;
    /** 任务标签 */
    tags?: string[];
}
/**
 * LLM响应结果
 */
export interface LLMResponse {
    /** 响应内容 */
    content: string;
    /** 使用的模型 */
    model: string;
    /** 消耗的tokens */
    tokens?: {
        prompt: number;
        completion: number;
        total: number;
    };
    /** 执行时长 */
    durationMs: number;
    /** 是否成功 */
    success: boolean;
    /** 错误信息 */
    error?: string;
}
/**
 * Agent状态
 */
export interface AgentStatus {
    /** Agent ID */
    agentId: string;
    /** Agent名称 */
    name: string;
    /** 状态 */
    status: 'idle' | 'busy' | 'error' | 'offline';
    /** 当前任务 */
    currentTask?: Task;
    /** 活动时间戳 */
    lastActive: number;
    /** 完成任务数 */
    tasksCompleted: number;
    /** 失败任务数 */
    tasksFailed: number;
}
/**
 * 复杂度配置 (遵循§118.2超时配置原则)
 */
export interface ComplexityConfig {
    /** 超时时间 (毫秒) - L4无超时 */
    timeout?: number;
    /** 最大递归深度 */
    maxDepth?: number;
    /** 推荐模型 */
    recommendedModel?: string;
    /** 是否需要分批执行 */
    batchExecution?: boolean;
}
/**
 * Agent集成配置
 */
export interface AgentIntegrationConfig {
    /** 默认模型 */
    model: string;
    /** 超时配置 */
    timeout: number;
    /** 最大递归深度 */
    depth: number;
    /** 故障转移模型 */
    fallback: string;
    /** 复杂度配置映射 */
    complexityConfig: Record<TaskComplexity, ComplexityConfig>;
}
/**
 * Agent集成插件主类
 *
 * 核心功能:
 * 1. LLM服务集成（支持多种模型）
 * 2. 任务调度功能（基于§118复杂度分级）
 * 3. Agent状态管理
 * 4. 模型故障转移机制
 */
export declare class AgentIntegrationPlugin {
    private api;
    private config;
    private agentStatuses;
    private taskQueue;
    private isProcessing;
    /**
     * 调用LLM服务
     *
     * @param model - 模型名称
     * @param prompt - 提示词
     * @param options - 选项 (timeout, maxTokens, etc.)
     * @returns LLM响应
     *
     * OpenClaw复用: 复用OpenClaw的模型调用模式
     */
    callLLM(model: string, prompt: string, options?: {
        timeout?: number;
        maxTokens?: number;
        temperature?: number;
    }): Promise<LLMResponse>;
    /**
     * 执行LLM调用 (内部方法)
     *
     * @private
     */
    private executeLLMCall;
    /**
     * 调度任务
     *
     * @param task - 任务定义
     * @param complexity - 任务复杂度 (L1-L4)
     * @returns 任务ID
     *
     * 宪法依据: §118.1 复杂度评估, §118.2 超时配置
     */
    scheduleTask(task: Task, complexity: TaskComplexity): Promise<string>;
    /**
     * 处理任务队列
     *
     * @private
     */
    private processTaskQueue;
    /**
     * 执行任务
     *
     * @private
     */
    private executeTask;
    /**
     * 获取Agent状态
     *
     * @param agentId - Agent ID (可选，不指定则返回所有Agent)
     * @returns Agent状态或状态列表
     */
    getAgentStatus(agentId?: string): Promise<AgentStatus | AgentStatus[]>;
    /**
     * 更新Agent状态
     *
     * @param agentId - Agent ID
     * @param updates - 状态更新
     *
     * @private
     */
    private updateAgentStatus;
    /**
     * 模型故障转移
     *
     * @param primary - 主模型
     * @param fallback - 备用模型
     * @returns 故障转移结果
     *
     * 宪法依据: §108 异构模型策略
     */
    fallbackModel(primary: string, fallback: string): Promise<void>;
    /**
     * 验证模型可用性
     *
     * @param model - 模型名称
     * @returns 是否可用
     */
    validateModel(model: string): Promise<boolean>;
    /**
     * 评估任务复杂度
     *
     * @param task - 任务定义
     * @returns 复杂度等级 (L1-L4)
     *
     * 宪法依据: §118.1 复杂度评估
     */
    assessComplexity(task: Task): Promise<TaskComplexity>;
    /**
     * 获取复杂度配置
     *
     * @param complexity - 复杂度等级
     * @returns 复杂度配置
     */
    getComplexityConfig(complexity: TaskComplexity): ComplexityConfig;
}
declare const _default: PluginDefinition;
export default _default;
//# sourceMappingURL=index.d.ts.map