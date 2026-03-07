/**
 * 🏭 平台适配器工厂实现
 * 
 * 宪法依据：
 * - §101 同步公理：统一的适配器创建接口
 * - §102 熵减原则：解耦适配器创建逻辑，减少重复代码
 * - §152 单一真理源：统一管理支持的平台和适配器映射
 * 
 * @version 1.0.0 (Phase 1D Day 1)
 * @category Gateway/Channels/Core
 */

import type { PlatformType } from '../types/Message';
import type { 
  IPlatformAdapter, 
  IPlatformAdapterFactory, 
  PlatformAdapterConfig 
} from '../interfaces/IPlatformAdapter';

import { SlackAdapter } from '../platforms/slack/SlackAdapter';
import { DiscordAdapter } from '../platforms/discord/DiscordAdapter';
import { TelegramAdapter } from '../platforms/telegram/TelegramAdapter';

/**
 * 平台适配器工厂
 */
export class PlatformAdapterFactory implements IPlatformAdapterFactory {
  private adapterRegistry = new Map<PlatformType, new (config: PlatformAdapterConfig) => IPlatformAdapter>();

  constructor() {
    // 默认注册支持的平台
    this.registerAdapter('slack', SlackAdapter as any);
    this.registerAdapter('discord', DiscordAdapter as any);
    this.registerAdapter('telegram', TelegramAdapter as any);
  }

  /**
   * 创建平台适配器实例
   */
  async createAdapter(platform: PlatformType, config: PlatformAdapterConfig): Promise<IPlatformAdapter> {
    const AdapterClass = this.adapterRegistry.get(platform);
    if (!AdapterClass) {
      throw new Error(`不支持的平台类型: ${platform}`);
    }

    return new AdapterClass(config);
  }

  /**
   * 获取支持的平台列表
   */
  getSupportedPlatforms(): PlatformType[] {
    return Array.from(this.adapterRegistry.keys());
  }

  /**
   * 验证平台配置
   */
  async validateConfig(platform: PlatformType, config: PlatformAdapterConfig): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    // 基础验证已在 BasePlatformAdapter 中处理
    // 这里可以添加更具体的平台配置验证逻辑
    
    const errors: string[] = [];
    if (config.platform !== platform) {
      errors.push(`配置平台(${config.platform})与指定平台(${platform})不匹配`);
    }

    // 创建临时实例进行深度验证
    try {
      const adapter = await this.createAdapter(platform, config);
      const validation = await adapter.validatePlatformSpecificConfig(config.platformSpecific || {});
      return {
        valid: errors.length === 0 && validation.valid,
        errors: [...errors, ...validation.errors],
        warnings: validation.warnings
      };
    } catch (error: any) {
      return {
        valid: false,
        errors: [...errors, error.message],
        warnings: []
      };
    }
  }

  /**
   * 注册新平台适配器
   */
  registerAdapter(
    platform: PlatformType,
    adapterClass: new (config: PlatformAdapterConfig) => IPlatformAdapter
  ): void {
    this.adapterRegistry.set(platform, adapterClass);
  }

  /**
   * 卸载平台适配器
   */
  async unregisterAdapter(platform: PlatformType): Promise<void> {
    this.adapterRegistry.delete(platform);
  }
}
