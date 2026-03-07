import winston from 'winston';

/**
 * 日志配置
 * 简化自 MY-DOGE-DEMO 的复杂日志系统
 * 
 * 宪法依据：
 * - §108 消息历史公理：所有操作必须有记录
 * - §125 数据完整性公理：日志记录必须完整可靠
 */

// 日志级别定义
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};

// 日志级别颜色
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
};

// 添加颜色支持
winston.addColors(colors);

// 创建日志格式
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
        (info) => `${info.timestamp} [${info.level}]: ${info.message}`
    )
);

// 创建控制台传输
const transports = [
    new winston.transports.Console({
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    }),
];

// 创建日志记录器实例
export const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    levels,
    format,
    transports,
});

// 日志工具函数
export const logUtils = {
    /**
     * 记录聊天消息
     */
    logChatMessage(sender: string, content: string, roomId?: string): void {
        const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;
        logger.info(`[Chat] ${sender} -> ${roomId || 'global'}: ${preview}`);
    },
    
    /**
     * 记录Agent活动
     */
    logAgentActivity(agentName: string, action: string, userId?: string): void {
        const userInfo = userId ? ` for ${userId}` : '';
        logger.info(`[Agent] ${agentName} ${action}${userInfo}`);
    },
    
    /**
     * 记录用户连接
     */
    logUserConnection(userId: string, action: 'join' | 'leave', roomId?: string): void {
        const roomInfo = roomId ? ` in ${roomId}` : '';
        logger.info(`[User] ${userId} ${action}${roomInfo}`);
    },
    
    /**
     * 记录系统错误
     */
    logSystemError(error: Error, context?: string): void {
        const contextInfo = context ? ` [${context}]` : '';
        logger.error(`[System${contextInfo}] ${error.message}`);
        
        // 开发环境下记录堆栈
        if (process.env.NODE_ENV !== 'production') {
            logger.debug(`[System${contextInfo}] Stack: ${error.stack}`);
        }
    },
    
    /**
     * 记录性能指标
     */
    logPerformance(operation: string, duration: number, threshold = 1000): void {
        const level = duration > threshold ? 'warn' : 'info';
        const message = `[Perf] ${operation}: ${duration}ms`;
        
        if (level === 'warn') {
            logger.warn(message);
        } else {
            logger.info(message);
        }
    },
    
    /**
     * 记录协议消息
     */
    logProtocolMessage(direction: 'send' | 'receive', type: string, clientId?: string): void {
        const clientInfo = clientId ? ` to ${clientId}` : '';
        logger.debug(`[Protocol] ${direction.toUpperCase()} ${type}${clientInfo}`);
    }
};