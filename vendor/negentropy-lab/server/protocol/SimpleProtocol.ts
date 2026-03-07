import { Client } from "colyseus";
import { logger } from "../utils/logger";

/**
 * 🔌 简单协议处理器 (Simple Protocol Handler)
 * 简化自 ProtocolBridge，移除了复杂的协议模式和NCP支持
 * 
 * 宪法依据：
 * - §197 Colyseus通道协议公理：通信必须遵循标准化协议
 * - §199通道消息协议规范：消息格式必须统一
 * - §321-§324实时通信公理：WebSocket通信需心跳保持和断线重连
 * 
 * 简化原则：
 * 1. 移除NCP协议支持，使用简单的JSON格式
 * 2. 移除混合模式切换，统一使用基本消息格式
 * 3. 移除复杂的序列化逻辑，简化消息处理
 * 4. 保留基本的错误处理和降级机制
 */

export interface SimpleProtocolConfig {
    roomId: string;
    enableLogging?: boolean;
    maxMessageSize?: number; // 最大消息大小（字节）
}

export interface MessageSendOptions {
    clientId?: string;
    priority?: "low" | "normal" | "high";
    timeout?: number;
}

export type MessageHandler = (messageType: string, data: any, client: Client) => void;

/**
 * 简单协议处理器
 */
export class SimpleProtocol {
    private config: SimpleProtocolConfig;
    private messageCount = 0;
    private errorCount = 0;
    
    constructor(config: SimpleProtocolConfig) {
        this.config = {
            enableLogging: false,
            maxMessageSize: 1024 * 1024, // 默认1MB
            ...config
        };
        
        logger.info(`[SimpleProtocol] 初始化，房间ID：${this.config.roomId}，最大消息大小：${this.config.maxMessageSize}字节`);
    }
    
    /**
     * 发送消息给客户端
     * 简化版本：直接使用Colyseus的send方法
     */
    send(
        client: Client,
        messageType: string,
        data: any,
        options?: MessageSendOptions
    ): boolean {
        try {
            // 验证消息类型
            if (!this.validateMessageType(messageType)) {
                throw new Error(`无效的消息类型：${messageType}`);
            }
            
            // 验证消息数据
            const validatedData = this.validateMessageData(data);
            
            // 构建消息对象
            const message = {
                type: messageType,
                data: validatedData,
                timestamp: Date.now(),
                roomId: this.config.roomId,
                clientId: options?.clientId || client.sessionId
            };
            
            // 发送消息
            client.send(messageType, message);
            
            this.messageCount++;
            
            // 记录日志
            if (this.config.enableLogging) {
                this.logMessage('send', messageType, data, options?.clientId);
            }
            
            return true;
        } catch (error: any) {
            this.errorCount++;
            logger.error(`[SimpleProtocol] 发送消息失败：${error.message}`);
            
            // 尝试降级发送（仅发送原始数据）
            try {
                client.send(messageType, data);
                logger.warn(`[SimpleProtocol] 降级发送成功：${messageType}`);
                return true;
            } catch (fallbackError: any) {
                logger.error(`[SimpleProtocol] 降级发送也失败：${fallbackError.message}`);
                return false;
            }
        }
    }
    
    /**
     * 广播消息给所有客户端
     */
    broadcast(
        clients: Client[],
        messageType: string,
        data: any,
        options?: MessageSendOptions
    ): number {
        let successCount = 0;
        
        for (const client of clients) {
            if (this.send(client, messageType, data, options)) {
                successCount++;
            }
        }
        
        if (this.config.enableLogging) {
            logger.info(`[SimpleProtocol] 广播消息 ${messageType}，成功：${successCount}/${clients.length}`);
        }
        
        return successCount;
    }
    
    /**
     * 接收消息处理
     * 简化版本：直接调用处理器
     */
    onMessage(
        rawMessage: any,
        client: Client,
        handler: MessageHandler
    ): boolean {
        try {
            // 验证消息格式
            if (!rawMessage || typeof rawMessage !== 'object') {
                throw new Error("消息格式无效，必须是对象");
            }
            
            // 提取消息类型和数据
            let messageType: string;
            let data: any;
            
            // 支持两种格式：
            // 1. 简单格式：{ type: "xxx", data: {...} }
            // 2. 直接格式：消息类型在外部传递，数据是rawMessage
            if ('type' in rawMessage && 'data' in rawMessage) {
                messageType = rawMessage.type;
                data = rawMessage.data;
                
                // 验证时间戳（可选）
                if (rawMessage.timestamp) {
                    const now = Date.now();
                    const messageTime = rawMessage.timestamp;
                    const timeDiff = now - messageTime;
                    
                    if (timeDiff > 60000) { // 60秒内有效
                        logger.warn(`[SimpleProtocol] 消息时间戳过旧：${timeDiff}ms`);
                    }
                }
            } else {
                // 如果消息格式不包含type和data，则假设消息类型已在外部传递
                // 这种情况下，handler需要在外部被调用
                return false;
            }
            
            // 验证消息类型
            if (!this.validateMessageType(messageType)) {
                throw new Error(`无效的消息类型：${messageType}`);
            }
            
            // 验证消息数据
            const validatedData = this.validateMessageData(data);
            
            // 调用处理器
            handler(messageType, validatedData, client);
            
            // 记录日志
            if (this.config.enableLogging) {
                this.logMessage('receive', messageType, data, client.sessionId);
            }
            
            return true;
        } catch (error: any) {
            this.errorCount++;
            logger.error(`[SimpleProtocol] 处理消息失败：${error.message}`);
            
            // 尝试发送错误响应给客户端
            this.sendErrorResponse(client, error.message);
            return false;
        }
    }
    
    /**
     * 发送错误响应
     */
    sendErrorResponse(client: Client, errorMessage: string): boolean {
        return this.send(client, "error", {
            code: "protocol_error",
            message: errorMessage,
            timestamp: Date.now()
        });
    }
    
    /**
     * 获取统计信息
     */
    getStats(): {
        totalMessages: number;
        totalErrors: number;
        successRate: number;
        roomId: string;
    } {
        const successRate = this.messageCount > 0 
            ? ((this.messageCount - this.errorCount) / this.messageCount) * 100
            : 100;
            
        return {
            totalMessages: this.messageCount,
            totalErrors: this.errorCount,
            successRate: Math.round(successRate * 100) / 100,
            roomId: this.config.roomId
        };
    }
    
    /**
     * 验证消息类型
     * 只允许字母、数字、下划线和连字符
     */
    private validateMessageType(messageType: string): boolean {
        if (typeof messageType !== 'string') {
            return false;
        }
        
        if (messageType.length < 1 || messageType.length > 50) {
            return false;
        }
        
        // 允许的字符：字母、数字、下划线、连字符、点
        const validPattern = /^[a-zA-Z0-9_\-\.]+$/;
        if (!validPattern.test(messageType)) {
            return false;
        }
        
        // 保留的系统消息类型
        const reservedTypes = [
            'system', 'error', 'heartbeat', 'heartbeat_request', 
            'heartbeat_ack', 'protocol_error', 'internal_error'
        ];
        
        if (reservedTypes.includes(messageType)) {
            logger.warn(`[SimpleProtocol] 使用了保留的消息类型：${messageType}`);
        }
        
        return true;
    }
    
    /**
     * 验证消息数据
     */
    private validateMessageData(data: any): any {
        // 检查数据大小
        try {
            const dataString = JSON.stringify(data);
            if (dataString.length > (this.config.maxMessageSize || 1024 * 1024)) {
                throw new Error(`消息数据过大：${dataString.length}字节，最大允许${this.config.maxMessageSize}字节`);
            }
        } catch (error: any) {
            throw new Error(`无法序列化消息数据：${error.message}`);
        }
        
        // 防止循环引用
        const seen = new WeakSet();
        const checkCircular = (obj: any, path: string[] = []): void => {
            if (obj && typeof obj === 'object') {
                if (seen.has(obj)) {
                    throw new Error(`检测到循环引用：${path.join('.')}`);
                }
                seen.add(obj);
                
                for (const key in obj) {
                    if (Object.prototype.hasOwnProperty.call(obj, key)) {
                        checkCircular(obj[key], [...path, key]);
                    }
                }
                
                seen.delete(obj); // 清理，避免内存泄漏
            }
        };
        
        try {
            checkCircular(data);
        } catch (error: any) {
            throw new Error(`消息数据包含循环引用：${error.message}`);
        }
        
        return data;
    }
    
    /**
     * 记录消息日志
     */
    private logMessage(
        direction: 'send' | 'receive',
        messageType: string,
        data: any,
        clientId?: string
    ): void {
        let dataPreview: string;
        
        if (data === null || data === undefined) {
            dataPreview = 'null';
        } else if (typeof data === 'string') {
            dataPreview = data.length > 50 ? data.substring(0, 50) + '...' : data;
        } else if (typeof data === 'object') {
            try {
                const jsonStr = JSON.stringify(data);
                dataPreview = jsonStr.length > 100 ? jsonStr.substring(0, 100) + '...' : jsonStr;
            } catch (error) {
                dataPreview = '[无法序列化的对象]';
            }
        } else {
            dataPreview = String(data);
        }
        
        logger.info(`[SimpleProtocol] ${direction.toUpperCase()} | ${messageType} | 客户端：${clientId || '未知'} | 数据：${dataPreview}`);
    }
    
    /**
     * 心跳消息处理（简化）
     */
    handleHeartbeat(client: Client, heartbeatData: any): boolean {
        const now = Date.now();
        
        // 验证心跳数据
        if (!heartbeatData || typeof heartbeatData !== 'object') {
            return false;
        }
        
        // 发送心跳确认
        return this.send(client, "heartbeat_ack", {
            serverTime: now,
            clientTime: heartbeatData.timestamp || now,
            latency: heartbeatData.latency || 0
        });
    }
    
    /**
     * 构建标准消息格式
     */
    buildMessage(messageType: string, data: any, clientId?: string): any {
        return {
            protocol: "simple",
            version: "1.0.0",
            type: messageType,
            data: data,
            timestamp: Date.now(),
            roomId: this.config.roomId,
            clientId: clientId,
            _simple: true // 标记为简单协议消息
        };
    }
    
    /**
     * 检查是否是简单协议消息
     */
    static isSimpleProtocolMessage(message: any): boolean {
        return message && 
               typeof message === 'object' && 
               message._simple === true &&
               message.protocol === "simple";
    }
}