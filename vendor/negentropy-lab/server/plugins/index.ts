/**
 * 🚀 插件系统入口 - 兼容层
 * 
 * @constitution
 * §102 熵减原则：消除冗余代码，统一插件接口
 * §152 单一真理源公理：插件逻辑集中在 gateway/plugins
 * 
 * 整合说明：
 * - 所有插件逻辑已迁移到 server/gateway/plugins/
 * - 此文件提供向后兼容的接口
 * - 新代码请直接从 '../gateway/plugins' 导入
 * 
 * @deprecated 请直接从 '../gateway/plugins' 导入
 * @see server/gateway/plugins/index.ts
 */

// 发出废弃警告（非生产环境）
if (process.env.NODE_ENV !== 'production') {
  console.warn('⚠️  DEPRECATED: plugins/index.ts 已废弃，请直接从 gateway/plugins 导入');
}

// ==========================================
// 重新导出 gateway/plugins 内容
// ==========================================

export * from '../gateway/plugins';

// 导出主要类和错误类型
export {
  PluginManager,
  PluginManagerError,
  PluginNotFoundError,
  PluginValidationError,
  PluginDependencyError,
  PluginLifecycleError
} from '../gateway/plugins';

// 导出类型（便于类型检查）
export type {
  PluginType,
  PluginStatus,
  PluginManifest,
  LoadedPlugin,
  PluginManagerOptions,
  PluginEvent,
  PluginEventType,
  PluginApiResponse
} from '../gateway/plugins/types';

// ==========================================
// 向后兼容的工厂函数
// ==========================================

import { PluginManager } from '../gateway/plugins';
import type { PluginManagerOptions } from '../gateway/plugins/types';

/**
 * 创建插件管理器实例
 * 
 * @param config - 插件管理器配置
 * @returns 插件管理器实例
 * @deprecated 使用 new PluginManager(config) 替代
 */
export function createPluginManager(config?: Partial<PluginManagerOptions>) {
  return new PluginManager(config);
}

// ==========================================
// 插件系统常量（向后兼容）
// ==========================================

/**
 * 插件系统版本
 */
export const PLUGIN_SYSTEM_VERSION = '1.0.0';

/**
 * 插件清单文件名
 */
export const PLUGIN_MANIFEST_FILE = 'negentropy.plugin.json';

/**
 * OpenClaw兼容插件清单文件名
 */
export const OPENCLAW_PLUGIN_MANIFEST_FILE = 'openclaw.plugin.json';

/**
 * 插件主入口文件
 */
export const PLUGIN_MAIN_FILE = 'index.ts';

/**
 * 插件系统配置键
 */
export const PLUGIN_CONFIG_KEY = 'plugins';
