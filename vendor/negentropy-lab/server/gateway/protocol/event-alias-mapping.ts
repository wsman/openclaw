/**
 * 事件别名映射中心
 * 
 * 宪法依据:
 * - §101 同步公理: 契约与实现必须同步
 * - §102 熵减原则: 统一别名映射降低系统熵值
 * - §152 单一真理源公理: 19 Events 作为 canonical 基线
 * 
 * 功能:
 * 1. 统一管理事件别名映射
 * 2. 支持向后兼容
 * 3. 提供事件元数据查询
 * 
 * @version 1.0.0
 * @created 2026-03-01
 * @maintainer 科技部
 */

// =============================================================================
// 类型定义
// =============================================================================

/**
 * 事件类别
 */
export type EventCategory = 
  | 'presence' 
  | 'cron' 
  | 'node' 
  | 'agent' 
  | 'system' 
  | 'room'
  | 'message'
  | 'error';

/**
 * 事件元数据
 */
export interface EventMetadata {
  /** 主事件名称 */
  primaryName: string;
  /** 事件类别 */
  category: EventCategory;
  /** 别名列表 */
  aliases: string[];
  /** 事件描述 */
  description: string;
  /** 负载类型 */
  payloadType?: string;
  /** 是否已废弃 */
  deprecated?: boolean;
  /** 废弃说明 */
  deprecationMessage?: string;
}

/**
 * 事件别名映射
 */
export interface EventAliasMapping {
  /** 别名 */
  alias: string;
  /** 主事件名称 */
  primary: string;
  /** 类别 */
  category: EventCategory;
}

// =============================================================================
// 事件别名映射配置
// =============================================================================

/**
 * 事件别名映射表
 * 
 * 基于 OpenClaw/Colyseus 协议的 19 Events canonical 基线
 */
export const EVENT_ALIASES: Record<string, EventAliasMapping> = {
  // ---------------------------------------------------------------------------
  // Presence 事件 (4个)
  // ---------------------------------------------------------------------------
  'presence_state': {
    alias: 'presence_state',
    primary: 'presence_state',
    category: 'presence',
  },
  'presence_change': {
    alias: 'presence_change',
    primary: 'presence_change',
    category: 'presence',
  },
  'presence_join': {
    alias: 'presence_join',
    primary: 'presence_change',
    category: 'presence',
  },
  'presence_leave': {
    alias: 'presence_leave',
    primary: 'presence_change',
    category: 'presence',
  },

  // ---------------------------------------------------------------------------
  // Cron 事件 (3个)
  // ---------------------------------------------------------------------------
  'cron_tick': {
    alias: 'cron_tick',
    primary: 'cron_tick',
    category: 'cron',
  },
  'cron_start': {
    alias: 'cron_start',
    primary: 'cron_start',
    category: 'cron',
  },
  'cron_stop': {
    alias: 'cron_stop',
    primary: 'cron_stop',
    category: 'cron',
  },

  // ---------------------------------------------------------------------------
  // Node 事件 (3个)
  // ---------------------------------------------------------------------------
  'node_add': {
    alias: 'node_add',
    primary: 'node_add',
    category: 'node',
  },
  'node_remove': {
    alias: 'node_remove',
    primary: 'node_remove',
    category: 'node',
  },
  'node_update': {
    alias: 'node_update',
    primary: 'node_update',
    category: 'node',
  },

  // ---------------------------------------------------------------------------
  // Agent 事件 (3个)
  // ---------------------------------------------------------------------------
  'agent_task_start': {
    alias: 'agent_task_start',
    primary: 'agent_task_start',
    category: 'agent',
  },
  'agent_task_complete': {
    alias: 'agent_task_complete',
    primary: 'agent_task_complete',
    category: 'agent',
  },
  'agent_task_error': {
    alias: 'agent_task_error',
    primary: 'agent_task_error',
    category: 'agent',
  },

  // ---------------------------------------------------------------------------
  // System 事件 (3个)
  // ---------------------------------------------------------------------------
  'system_start': {
    alias: 'system_start',
    primary: 'system_start',
    category: 'system',
  },
  'system_stop': {
    alias: 'system_stop',
    primary: 'system_stop',
    category: 'system',
  },
  'system_error': {
    alias: 'system_error',
    primary: 'system_error',
    category: 'system',
  },

  // ---------------------------------------------------------------------------
  // Room 事件 (2个)
  // ---------------------------------------------------------------------------
  'room_join': {
    alias: 'room_join',
    primary: 'room_join',
    category: 'room',
  },
  'room_leave': {
    alias: 'room_leave',
    primary: 'room_leave',
    category: 'room',
  },

  // ---------------------------------------------------------------------------
  // Message 事件 (1个)
  // ---------------------------------------------------------------------------
  'message': {
    alias: 'message',
    primary: 'message',
    category: 'message',
  },
};

/**
 * 事件元数据表
 */
export const EVENT_METADATA: Record<string, EventMetadata> = {
  // Presence 事件
  'presence_state': {
    primaryName: 'presence_state',
    category: 'presence',
    aliases: ['presence_state'],
    description: '房间内所有用户的状态快照',
    payloadType: 'PresenceStatePayload',
  },
  'presence_change': {
    primaryName: 'presence_change',
    category: 'presence',
    aliases: ['presence_change', 'presence_join', 'presence_leave'],
    description: '用户加入或离开房间的事件',
    payloadType: 'PresenceChangePayload',
  },

  // Cron 事件
  'cron_tick': {
    primaryName: 'cron_tick',
    category: 'cron',
    aliases: ['cron_tick'],
    description: '定时任务触发事件',
    payloadType: 'CronTickPayload',
  },
  'cron_start': {
    primaryName: 'cron_start',
    category: 'cron',
    aliases: ['cron_start'],
    description: '定时任务启动事件',
    payloadType: 'CronStartPayload',
  },
  'cron_stop': {
    primaryName: 'cron_stop',
    category: 'cron',
    aliases: ['cron_stop'],
    description: '定时任务停止事件',
    payloadType: 'CronStopPayload',
  },

  // Node 事件
  'node_add': {
    primaryName: 'node_add',
    category: 'node',
    aliases: ['node_add'],
    description: '节点添加事件',
    payloadType: 'NodeAddPayload',
  },
  'node_remove': {
    primaryName: 'node_remove',
    category: 'node',
    aliases: ['node_remove'],
    description: '节点移除事件',
    payloadType: 'NodeRemovePayload',
  },
  'node_update': {
    primaryName: 'node_update',
    category: 'node',
    aliases: ['node_update'],
    description: '节点更新事件',
    payloadType: 'NodeUpdatePayload',
  },

  // Agent 事件
  'agent_task_start': {
    primaryName: 'agent_task_start',
    category: 'agent',
    aliases: ['agent_task_start'],
    description: 'Agent任务开始事件',
    payloadType: 'AgentTaskStartPayload',
  },
  'agent_task_complete': {
    primaryName: 'agent_task_complete',
    category: 'agent',
    aliases: ['agent_task_complete'],
    description: 'Agent任务完成事件',
    payloadType: 'AgentTaskCompletePayload',
  },
  'agent_task_error': {
    primaryName: 'agent_task_error',
    category: 'agent',
    aliases: ['agent_task_error'],
    description: 'Agent任务错误事件',
    payloadType: 'AgentTaskErrorPayload',
  },

  // System 事件
  'system_start': {
    primaryName: 'system_start',
    category: 'system',
    aliases: ['system_start'],
    description: '系统启动事件',
    payloadType: 'SystemStartPayload',
  },
  'system_stop': {
    primaryName: 'system_stop',
    category: 'system',
    aliases: ['system_stop'],
    description: '系统停止事件',
    payloadType: 'SystemStopPayload',
  },
  'system_error': {
    primaryName: 'system_error',
    category: 'system',
    aliases: ['system_error'],
    description: '系统错误事件',
    payloadType: 'SystemErrorPayload',
  },

  // Room 事件
  'room_join': {
    primaryName: 'room_join',
    category: 'room',
    aliases: ['room_join'],
    description: '用户加入房间事件',
    payloadType: 'RoomJoinPayload',
  },
  'room_leave': {
    primaryName: 'room_leave',
    category: 'room',
    aliases: ['room_leave'],
    description: '用户离开房间事件',
    payloadType: 'RoomLeavePayload',
  },

  // Message 事件
  'message': {
    primaryName: 'message',
    category: 'message',
    aliases: ['message'],
    description: '消息事件',
    payloadType: 'MessagePayload',
  },
};

// =============================================================================
// 工具函数
// =============================================================================

/**
 * 解析事件名称为主事件名称
 * 
 * @param eventName - 事件名称或别名
 * @returns 主事件名称，如果不存在返回原名称
 */
export function resolveEventName(eventName: string): string {
  const mapping = EVENT_ALIASES[eventName];
  return mapping ? mapping.primary : eventName;
}

/**
 * 获取事件元数据
 * 
 * @param eventName - 事件名称
 * @returns 事件元数据，如果不存在返回 undefined
 */
export function getEventMetadata(eventName: string): EventMetadata | undefined {
  const primaryName = resolveEventName(eventName);
  return EVENT_METADATA[primaryName];
}

/**
 * 获取事件类别
 * 
 * @param eventName - 事件名称
 * @returns 事件类别，如果不存在返回 undefined
 */
export function getEventCategory(eventName: string): EventCategory | undefined {
  const metadata = getEventMetadata(eventName);
  return metadata?.category;
}

/**
 * 获取类别的所有事件
 * 
 * @param category - 事件类别
 * @returns 事件名称列表
 */
export function getEventsByCategory(category: EventCategory): string[] {
  return Object.values(EVENT_METADATA)
    .filter(metadata => metadata.category === category)
    .map(metadata => metadata.primaryName);
}

/**
 * 检查事件是否有效
 * 
 * @param eventName - 事件名称
 * @returns 是否为已知事件
 */
export function isValidEvent(eventName: string): boolean {
  return eventName in EVENT_ALIASES || eventName in EVENT_METADATA;
}

/**
 * 获取所有主事件名称
 * 
 * @returns 主事件名称列表
 */
export function getAllPrimaryEvents(): string[] {
  return Object.keys(EVENT_METADATA);
}

/**
 * 获取所有事件别名
 * 
 * @returns 所有别名列表
 */
export function getAllEventAliases(): string[] {
  return Object.keys(EVENT_ALIASES);
}

/**
 * 获取事件统计信息
 * 
 * @returns 事件统计
 */
export function getEventStats(): {
  totalEvents: number;
  totalAliases: number;
  byCategory: Record<EventCategory, number>;
} {
  const byCategory: Record<EventCategory, number> = {
    presence: 0,
    cron: 0,
    node: 0,
    agent: 0,
    system: 0,
    room: 0,
    message: 0,
    error: 0,
  };

  for (const metadata of Object.values(EVENT_METADATA)) {
    byCategory[metadata.category]++;
  }

  return {
    totalEvents: Object.keys(EVENT_METADATA).length,
    totalAliases: Object.keys(EVENT_ALIASES).length,
    byCategory,
  };
}

// =============================================================================
// 导出
// =============================================================================

export const EVENT_ALIAS_MAPPING_CENTER = {
  EVENT_ALIASES,
  EVENT_METADATA,
  resolveEventName,
  getEventMetadata,
  getEventCategory,
  getEventsByCategory,
  isValidEvent,
  getAllPrimaryEvents,
  getAllEventAliases,
  getEventStats,
};

export default EVENT_ALIAS_MAPPING_CENTER;