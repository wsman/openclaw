/**
 * 🏛️ 控制面房间模块入口
 * 
 * 宪法依据：
 * - §102 熵减原则：统一房间导出
 * - §152 单一真理源公理：集中管理房间类型
 * 
 * 导出：
 * - BaseControlRoom: 控制面房间基类
 * - 所有具体房间实现
 */

// 导出基类
export { BaseControlRoom, ControlRoomState, HeartbeatConfig, RoomHealthReport } from './BaseControlRoom';

// 导出具体房间实现
export { ChatRoom } from './ChatRoom';
export { ControlRoom } from './ControlRoom';
export { AgentRoom } from './AgentRoom';
export { NodeRoom } from './NodeRoom';
export { CronRoom } from './CronRoom';
export { ConfigRoom } from './ConfigRoom';
export { TaskRoom } from './TaskRoom';

/**
 * 房间类型注册表
 * 
 * 用于在服务器启动时注册所有房间类型
 */
export const RoomRegistry = {
  chat: {
    name: 'chat',
    path: './ChatRoom',
    className: 'ChatRoom'
  },
  control: {
    name: 'control',
    path: './ControlRoom',
    className: 'ControlRoom'
  },
  agent: {
    name: 'agent',
    path: './AgentRoom',
    className: 'AgentRoom'
  },
  node: {
    name: 'node',
    path: './NodeRoom',
    className: 'NodeRoom'
  },
  cron: {
    name: 'cron',
    path: './CronRoom',
    className: 'CronRoom'
  },
  config: {
    name: 'config',
    path: './ConfigRoom',
    className: 'ConfigRoom'
  },
  task: {
    name: 'task',
    path: './TaskRoom',
    className: 'TaskRoom'
  }
};

/**
 * 获取所有房间类型
 */
export function getRoomTypes(): string[] {
  return Object.keys(RoomRegistry);
}

/**
 * 获取房间配置
 */
export function getRoomConfig(roomType: string) {
  return RoomRegistry[roomType as keyof typeof RoomRegistry];
}
