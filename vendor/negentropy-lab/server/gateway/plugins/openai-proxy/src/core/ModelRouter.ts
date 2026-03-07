/**
 * 🚀 Model Router - 模型路由器
 * 宪法依据: §101同步公理、§102熵减原则、§108异构模型策略
 * 
 * 本模块负责模型映射，将OpenAI模型名映射到实际使用的模型：
 * - gpt-4 -> google-antigravity/gemini-3-pro-high
 * - gpt-3.5-turbo -> google-antigravity/gemini-3-flash
 * 
 * 版本: 1.0.0
 * 创建时间: 2026-02-12
 */

import { logger } from '../../../../../utils/logger';

/**
 * 模型路由器
 */
export class ModelRouter {
  private modelMapping: Record<string, string>;
  private defaultModel: string;

  constructor(modelMapping: Record<string, string>) {
    this.modelMapping = { ...modelMapping };
    this.defaultModel = modelMapping['gpt-3.5-turbo'] || 'google-antigravity/gemini-3-flash';
    logger.info('[ModelRouter] 模型路由器已初始化');
  }

  /**
   * 映射模型
   * 宪法依据: §108异构模型策略 - 明确的模型映射
   */
  public mapModel(model: string): string {
    const mapped = this.modelMapping[model];
    
    if (mapped) {
      logger.debug(`[ModelRouter] 模型映射: ${model} -> ${mapped}`);
      return mapped;
    }

    // 如果找不到映射，返回默认模型
    logger.warn(`[ModelRouter] 模型 ${model} 未找到映射，使用默认模型 ${this.defaultModel}`);
    return this.defaultModel;
  }

  /**
   * 更新模型映射
   * 宪法依据: §101同步公理 - 配置更新
   */
  public updateModels(modelMapping: Record<string, string>): void {
    this.modelMapping = { ...modelMapping };
    this.defaultModel = modelMapping['gpt-3.5-turbo'] || 'google-antigravity/gemini-3-flash';
    logger.info('[ModelRouter] 模型映射已更新');
  }

  /**
   * 获取所有支持的模型
   */
  public getSupportedModels(): string[] {
    return Object.keys(this.modelMapping);
  }

  /**
   * 检查模型是否支持
   */
  public isModelSupported(model: string): boolean {
    return model in this.modelMapping;
  }
}