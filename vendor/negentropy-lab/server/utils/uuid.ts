import { v4 as uuidv4, v5 as uuidv5, validate as validateUuid } from 'uuid';

/**
 * UUID工具函数
 * 简化自 MY-DOGE-DEMO 的复杂ID生成系统
 * 
 * 宪法依据：
 * - §106 Agent身份公理：每个实体必须拥有唯一身份标识
 * - §125 数据完整性公理：ID必须是唯一且可验证的
 */

// UUID命名空间（用于v5 UUID）
const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // DNS命名空间

/**
 * 生成v4随机UUID
 */
export function uuid(): string {
    return uuidv4();
}

/**
 * 生成v5命名UUID
 * @param name 用于生成UUID的名称
 */
export function namedUuid(name: string): string {
    return uuidv5(name, UUID_NAMESPACE);
}

/**
 * 验证UUID格式
 */
export function validate(uuid: string): boolean {
    return validateUuid(uuid);
}

/**
 * 生成简短ID（用于显示）
 */
export function shortId(length = 8): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * 生成消息ID
 */
export function messageId(): string {
    return `msg_${Date.now()}_${shortId(6)}`;
}

/**
 * 生成用户ID
 */
export function userId(username?: string): string {
    const base = `user_${shortId(8)}`;
    return username ? `user:${username}` : base;
}

/**
 * 生成Agent ID
 */
export function agentId(agentType: string): string {
    return `agent:${agentType}`;
}

/**
 * 生成会话ID
 */
export function sessionId(): string {
    return `session_${Date.now()}_${shortId(10)}`;
}

/**
 * 生成请求ID
 */
export function requestId(): string {
    return `req_${Date.now()}_${shortId(6)}`;
}

/**
 * ID工具函数
 */
export const idUtils = {
    /**
     * 提取ID类型
     */
    extractIdType(id: string): { type: string; value: string } | null {
        if (!id || typeof id !== 'string') {
            return null;
        }
        
        const parts = id.split(':');
        if (parts.length === 2) {
            return {
                type: parts[0],
                value: parts[1]
            };
        }
        
        return {
            type: 'unknown',
            value: id
        };
    },
    
    /**
     * 检查是否是用户ID
     */
    isUserId(id: string): boolean {
        return id.startsWith('user:');
    },
    
    /**
     * 检查是否是Agent ID
     */
    isAgentId(id: string): boolean {
        return id.startsWith('agent:');
    },
    
    /**
     * 检查是否是系统ID
     */
    isSystemId(id: string): boolean {
        return id === 'system';
    },
    
    /**
     * 生成可读的显示名称
     */
    getDisplayName(id: string, fallback = 'Unknown'): string {
        const idType = this.extractIdType(id);
        if (!idType) {
            return fallback;
        }
        
        switch (idType.type) {
            case 'user':
                return `用户 ${idType.value}`;
            case 'agent':
                // Agent类型映射
                const agentMap: Record<string, string> = {
                    'legal_expert': '法务专家',
                    'programmer': '程序猿',
                    'architect': '架构师',
                    'secretary': '书记员'
                };
                return agentMap[idType.value] || `Agent ${idType.value}`;
            case 'system':
                return '系统';
            default:
                return idType.value || fallback;
        }
    },
    
    /**
     * 批量生成ID
     */
    batchGenerate(count: number, prefix = 'id'): string[] {
        const ids: string[] = [];
        for (let i = 0; i < count; i++) {
            ids.push(`${prefix}_${shortId(8)}`);
        }
        return ids;
    }
};