/**
 * WebSocket Channel Plugin - WebSocket通信插件
 *
 * 宪法依据:
 * - §101 同步公理: 代码与文档必须原子性同步
 * - §401-§404 环境锚定公理: 确保插件在正确的环境中运行
 * - §118.5 智能体协同统一策略原则: 支持Agent间通信
 *
 * OpenClaw复用策略 (60%):
 * - 复用OpenClaw的WebSocket服务器实现
 * - 复用OpenClaw的客户端管理逻辑
 * - 复用OpenClaw的消息广播机制
 *
 * @version 1.0.0
 * @created 2026-02-12
 * @maintainer 科技部后端分队
 */
import type { PluginDefinition } from '../../../server/plugins/types/plugin-interfaces';
/**
 * WebSocket消息类型
 */
export type WSMessageType = 'agent_message' | 'system_event' | 'entropy_update' | 'client_command' | 'broadcast' | 'heartbeat';
/**
 * WebSocket消息
 */
export interface WSMessage {
    /** 消息类型 */
    type: WSMessageType;
    /** 消息内容 */
    content: unknown;
    /** 消息ID */
    messageId: string;
    /** 发送者ID */
    from?: string;
    /** 接收者ID (可选，不指定则广播) */
    to?: string;
    /** 时间戳 */
    timestamp: number;
    /** 元数据 */
    metadata?: Record<string, unknown>;
}
/**
 * 客户端信息
 */
export interface ClientInfo {
    /** 客户端ID */
    clientId: string;
    /** 客户端类型 */
    clientType: 'agent' | 'monitor' | 'ui' | 'external';
    /** 客户端名称 */
    clientName?: string;
    /** 连接时间 */
    connectedAt: number;
    /** 最后活动时间 */
    lastActiveAt: number;
    /** 客户端IP */
    ip?: string;
    /** 客户端元数据 */
    metadata?: Record<string, unknown>;
}
/**
 * WebSocket配置
 */
export interface WebSocketConfig {
    /** 服务器端口 */
    port: number;
    /** 路径前缀 */
    path: string;
    /** 允许的来源 */
    cors: {
        origin: string | string[] | boolean;
        credentials: boolean;
    };
    /** 心跳间隔 (毫秒) */
    heartbeatInterval: number;
    /** 心跳超时 (毫秒) */
    heartbeatTimeout: number;
    /** 最大连接数 */
    maxConnections: number;
}
/**
 * 统计信息
 */
export interface ChannelStats {
    /** 总连接数 */
    totalConnections: number;
    /** 当前连接数 */
    activeConnections: number;
    /** 总消息数 */
    totalMessages: number;
    /** 总广播数 */
    totalBroadcasts: number;
    /** 总错误数 */
    totalErrors: number;
    /** 启动时间 */
    startTime: number;
}
/**
 * WebSocket通信插件主类
 *
 * 核心功能:
 * 1. WebSocket服务器
 * 2. 消息广播功能
 * 3. 客户端管理
 */
export declare class WebSocketChannelPlugin {
    private api;
    private config;
    private io;
    private httpServer;
    private clients;
    private heartbeatIntervalId;
    private stats;
    /**
     * 启动WebSocket服务器
     *
     * @param port - 端口号 (可选，默认使用配置中的端口)
     *
     * OpenClaw复用: 复用OpenClaw的WebSocket服务器实现模式
     */
    startServer(port?: number): Promise<void>;
    /**
     * 停止WebSocket服务器
     */
    stopServer(): Promise<void>;
    /**
     * 重启WebSocket服务器
     */
    restartServer(): Promise<void>;
    /**
     * 注册Socket事件处理器
     *
     * @private
     */
    private registerSocketHandlers;
    /**
     * 处理连接
     *
     * @private
     */
    private handleConnection;
    /**
     * 处理断开
     *
     * @private
     */
    private handleDisconnect;
    /**
     * 处理消息
     *
     * @private
     */
    private handleMessage;
    /**
     * 处理Agent消息
     *
     * @private
     */
    private handleAgentMessage;
    /**
     * 处理客户端命令
     *
     * @private
     */
    private handleClientCommand;
    /**
     * 处理广播请求
     *
     * @private
     */
    private handleBroadcast;
    /**
     * 处理心跳
     *
     * @private
     */
    private handleHeartbeat;
    /**
     * 处理客户端注册
     *
     * @private
     */
    private handleClientRegister;
    /**
     * 广播消息到所有客户端
     *
     * @param message - 消息内容
     *
     * OpenClaw复用: 复用OpenClaw的消息广播机制
     */
    broadcast(message: unknown): Promise<void>;
    /**
     * 发送消息到指定客户端
     *
     * @param clientId - 客户端ID
     * @param message - 消息内容
     */
    sendToClient(clientId: string, message: WSMessage): Promise<void>;
    /**
     * 管理客户端
     *
     * @param action - 管理动作 (list|disconnect|kick)
     * @param params - 参数
     */
    manageClients(action: 'list' | 'disconnect' | 'kick', params?: {
        clientId?: string;
    }): Promise<unknown>;
    /**
     * 列出所有客户端
     */
    listClients(): ClientInfo[];
    /**
     * 断开客户端
     *
     * @private
     */
    private disconnectClient;
    /**
     * 踢出客户端
     *
     * @private
     */
    private kickClient;
    /**
     * 获取客户端数量
     */
    getClientCount(): number;
    /**
     * 启动心跳检查
     *
     * @private
     */
    private startHeartbeatCheck;
    /**
     * 停止心跳检查
     *
     * @private
     */
    private stopHeartbeatCheck;
    /**
     * 检查心跳
     *
     * @private
     */
    private checkHeartbeat;
    /**
     * 获取统计信息
     */
    getStats(): ChannelStats;
    /**
     * 重置统计信息
     */
    resetStats(): void;
}
declare const _default: PluginDefinition;
export default _default;
//# sourceMappingURL=index.d.ts.map