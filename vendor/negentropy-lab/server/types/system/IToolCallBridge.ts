/**
 * 🔧 IToolCallBridge - 工具调用桥接器接口
 *
 * 宪法依据:
 * - §101 同步公理 - 类型定义与实现代码必须原子性同步
 * - §102 熵减原则 - 标准化类型系统，降低系统熵值
 * - §106 人才把关原则 - 类型安全，编译期质量检验
 * - §109 ToolCallBridge标准化架构公理 - 智能体工具调用事件广播标准化接口
 * - §151 持久化原则 - 类型契约持久化
 * - §438 工具调用事件广播公理 - 工具调用状态变化必须广播到所有订阅者
 * - §439 工具类型推断标准 - 工具分类算法标准化
 * - §440 工具调用桥接器接口契约 - 统一的事件广播接口
 *
 * 功能:
 * - TypeScript接口定义
 * - 工具调用事件广播机制
 * - 智能体工具调用标准化桥接
 * - L0.8层：工具调用桥接器层
 *
 * @维护者 科技部
 * @最后更新 2026-02-25
 */

/**
 * 工具调用事件类型
 * 标准事件集合: E = {TOOL_CALL, TOOL_RESULT, TOOL_ERROR, TOOL_PROGRESS}
 */
export enum ToolCallEventType {
    TOOL_CALL = 'TOOL_CALL',
    TOOL_RESULT = 'TOOL_RESULT',
    TOOL_ERROR = 'TOOL_ERROR',
    TOOL_PROGRESS = 'TOOL_PROGRESS'
}

/**
 * 工具分类
 * P(s) = APPLICATION if s starts with 'mcp_' or 'http_'
 * P(s) = CONTEXT if s starts with 'memory_' or 'context_'
 * P(s) = BUILTIN otherwise
 */
export enum ToolCategory {
    APPLICATION = 'APPLICATION',  // mcp_*, http_*
    CONTEXT = 'CONTEXT',          // memory_*, context_*
    BUILTIN = 'BUILTIN'           // 其他内置工具
}

/**
 * 工具调用负载基础接口
 */
export interface ToolCallPayload {
    toolName: string;
    toolId: string;
    timestamp: number;
    sessionId?: string;
    agentId?: string;
    category: ToolCategory;
    metadata?: Record<string, any>;
}

/**
 * 工具开始调用负载
 */
export interface ToolStartPayload extends ToolCallPayload {
    args: any;
    timeout?: number;
}

/**
 * 工具结果负载
 */
export interface ToolResultPayload extends ToolCallPayload {
    result: any;
    duration: number;
    tokenCount?: number;
}

/**
 * 工具错误负载
 */
export interface ToolErrorPayload extends ToolCallPayload {
    error: string;
    errorCode: string;
    stackTrace?: string;
    duration: number;
}

/**
 * 工具进度负载
 */
export interface ToolProgressPayload extends ToolCallPayload {
    progress: number;  // 0-100
    stage: string;
    message?: string;
}

/**
 * NCP消息格式 (前端通信)
 */
export interface NCPMessage {
    type: ToolCallEventType;
    payload: ToolCallPayload;
    broadcastId: string;
    timestamp: number;
}

/**
 * IToolCallBridge - 工具调用桥接器接口
 * 
 * 职责: L0.8层工具调用桥接器，作为智能体工具调用系统与前端NCP消息系统之间的标准化接口
 * 
 * 数学基础:
 * - 事件广播函数: B: E × C → M_NCP
 * - 工具类型推断: F_infer: ToolName → S_category
 * - 并发控制: |A_active| ≤ max_concurrent (默认max_concurrent = 10)
 */
export interface IToolCallBridge {
    /**
     * 广播工具开始调用事件
     * @param payload 工具开始调用负载
     * @returns 广播ID
     * 
     * 宪法依据: §438 工具调用事件广播公理
     */
    broadcastToolStart(payload: ToolStartPayload): string;

    /**
     * 广播工具结果事件
     * @param payload 工具结果负载
     * @returns 广播ID
     * 
     * 宪法依据: §438 工具调用事件广播公理
     */
    broadcastToolResult(payload: ToolResultPayload): string;

    /**
     * 广播工具错误事件
     * @param payload 工具错误负载
     * @returns 广播ID
     * 
     * 宪法依据: §438 工具调用事件广播公理
     */
    broadcastToolError(payload: ToolErrorPayload): string;

    /**
     * 广播工具进度事件
     * @param payload 工具进度负载
     * @returns 广播ID
     * 
     * 宪法依据: §438 工具调用事件广播公理
     */
    broadcastToolProgress(payload: ToolProgressPayload): string;

    /**
     * 注册工具调用处理器
     * @param tool 工具名称
     * @param handler 工具处理函数
     * 
     * 宪法依据: §109 ToolCallBridge标准化架构公理
     */
    registerTool(tool: string, handler: (args: any) => Promise<any>): void;

    /**
     * 调用工具
     * @param tool 工具名称
     * @param args 工具参数
     * @returns 工具执行结果
     * 
     * 宪法依据: §109 ToolCallBridge标准化架构公理
     */
    callTool(tool: string, args: any): Promise<any>;

    /**
     * 订阅工具调用事件
     * @param eventType 事件类型
     * @param callback 回调函数
     * @returns 订阅ID
     * 
     * 宪法依据: §438 工具调用事件广播公理
     */
    subscribe(eventType: ToolCallEventType, callback: (message: NCPMessage) => void): string;

    /**
     * 取消订阅工具调用事件
     * @param subscriptionId 订阅ID
     * 
     * 宪法依据: §438 工具调用事件广播公理
     */
    unsubscribe(subscriptionId: string): void;

    /**
     * 推断工具分类
     * @param toolName 工具名称
     * @returns 工具分类
     * 
     * 分类算法:
     * P(s) = APPLICATION if s starts with 'mcp_' or 'http_'
     * P(s) = CONTEXT if s starts with 'memory_' or 'context_'
     * P(s) = BUILTIN otherwise
     * 
     * 宪法依据: §439 工具类型推断标准
     */
    inferToolCategory(toolName: string): ToolCategory;

    /**
     * 获取活跃工具调用数量
     * @returns 当前活跃调用数
     * 
     * 约束: |A_active| ≤ max_concurrent (默认10)
     * 
     * 宪法依据: §109 ToolCallBridge标准化架构公理
     */
    getActiveCallCount(): number;

    /**
     * 设置最大并发数
     * @param maxConcurrent 最大并发数
     * 
     * 宪法依据: §109 ToolCallBridge标准化架构公理
     */
    setMaxConcurrent(maxConcurrent: number): void;
}

/**
 * IToolCallBridge配置选项
 */
export interface ToolCallBridgeConfig {
    maxConcurrent?: number;        // 默认10
    defaultTimeout?: number;       // 默认30000ms
    enableBroadcast?: boolean;     // 默认true
    broadcastChannel?: string;     // 默认'tool_calls'
}

/**
 * ToolCallBridge工厂函数类型
 */
export type ToolCallBridgeFactory = (config?: ToolCallBridgeConfig) => IToolCallBridge;