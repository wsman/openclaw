/**
 * Negentropy-Lab Plugin System - Main Entry Point
 * 
 * 宪法依据:
 * - §101 同步公理: 代码与文档必须原子性同步
 * - §102 熵减原则: 复用OpenClaw已有架构，避免重复实现
 * - §108 异构模型策略: 明确模型参数配置
 * - §118 长时间任务执行公理: 支持超时配置
 * - §306 零停机协议: 支持热加载/热卸载
 * 
 * @version 1.0.0
 * @created 2026-02-12
 * @maintainer 科技部后端分队
 * 
 * 概述:
 * 本模块提供Negentropy-Lab的插件系统核心功能，包括:
 * - 插件管理器 (PluginManager)
 * - 插件CLI工具 (PluginCLI)
 * - 插件接口定义 (Plugin Interfaces)
 * - 插件注册表 (Plugin Registry)
 * 
 * OpenClaw兼容性:
 * - 支持OpenClaw插件格式 (openclaw.plugin.json)
 * - 扩展Negentropy-Lab特定功能 (negentropy.plugin.json)
 * - 复用OpenClaw插件架构60%
 */

// =============================================================================
// Core Exports
// =============================================================================

export { PluginManager } from './core/PluginManager';
export { PluginManagerConfig } from './core/PluginManager';

// =============================================================================
// CLI Exports
// =============================================================================

export { PluginCLI } from './cli/PluginCLI';
export { PluginCLIConfig } from './cli/PluginCLI';

// =============================================================================
// Type Exports
// =============================================================================

export * from './types/plugin-interfaces';

// =============================================================================
// Utilities
// =============================================================================

import { PluginManager as PluginManagerClass, PluginManagerConfig } from './core/PluginManager';
import { PluginCLI as PluginCLIClass, PluginCLIConfig as PluginCLIConfigType } from './cli/PluginCLI';

/**
 * 创建插件管理器实例
 * 
 * @param config - 插件管理器配置
 * @returns 插件管理器实例
 */
export function createPluginManager(config?: PluginManagerConfig) {
  return new PluginManagerClass(config);
}

/**
 * 创建插件CLI实例
 * 
 * @param config - 插件CLI配置
 * @returns 插件CLI实例
 */
export function createPluginCLI(config: PluginCLIConfigType) {
  return new PluginCLIClass(config);
}

// =============================================================================
// Plugin System Constants
// =============================================================================

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
