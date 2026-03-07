/**
 * 📉 降级策略管理器 - 三层降级确保零停机
 * 
 * 宪法依据:
 * - §306 零停机协议: 三层降级确保持续服务
 * - §108 异构模型策略: 跨提供商降级
 * - §102 熵减原则: 复用ModelRegistry和CapabilityMatcher
 * 
 * 降级流程:
 * Layer 1: 主模型 → 同级备用
 * Layer 2: 备用模型 → 低级降级
 * Layer 3: 降级模型 → 离线响应
 * 
 * @version 1.0.0 (批次4-2)
 * @category Gateway/Resilience
 */

import { ModelAdapter } from '../llm/adapters/ModelAdapter';
import { ModelRegistry } from '../llm/ModelRegistry';
import { CapabilityMatcher, TaskRequirements } from '../llm/CapabilityMatcher';
import { logger } from '../../utils/logger';
import { EventEmitter } from 'events';
import { ChatRequest, ChatResponse } from '../llm/adapters/BaseAdapter';

// 在测试环境中，logger可能不可用，提供fallback
const log = logger || {
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug
};

/**
 * 降级层级
 */
export enum DegradationLayer {
  /** Layer 1: 同级备用 */
  LAYER1 = 'layer1',
  
  /** Layer 2: 低级降级 */
  LAYER2 = 'layer2',
  
  /** Layer 3: 离线响应 */
  LAYER3 = 'layer3'
}

/**
 * 降级结果
 */
export interface DegradationResult {
  /** 是否成功 */
  success: boolean;
  
  /** 使用的层级 */
  layer: DegradationLayer;
  
  /** 使用的适配器（Layer 1和2） */
  adapter?: ModelAdapter;
  
  /** 离线响应（Layer 3） */
  offlineResponse?: string;
  
  /** 响应 */
  response?: ChatResponse;
  
  /** 错误消息 */
  errorMessage?: string;
  
  /** 降级耗时（毫秒） */
  durationMs: number;
  
  /** 降级路径 */
  path: string[];
}

/**
 * 离线响应配置
 */
export interface OfflineResponseConfig {
  /** 默认离线响应 */
  defaultMessage?: string;
  
  /** 超时响应 */
  timeoutMessage?: string;
  
  /** 速率限制响应 */
  rateLimitMessage?: string;
  
  /** 系统错误响应 */
  systemErrorMessage?: string;
}

/**
 * 降级策略配置
 */
export interface DegradationStrategyConfig {
  /** 是否启用三层降级 */
  enableThreeLayerDegradation?: boolean;
  
  /** Layer 1 配置 */
  layer1?: {
    /** 最大重试次数 */
    maxRetries?: number;
    /** 超时时间（毫秒） */
    timeout?: number;
  };
  
  /** Layer 2 配置 */
  layer2?: {
    /** 最大重试次数 */
    maxRetries?: number;
    /** 超时时间（毫秒） */
    timeout?: number;
    /** 优先使用低成本模型 */
    preferLowCost?: boolean;
  };
  
  /** Layer 3 配置 */
  layer3?: {
    /** 启用离线响应 */
    enableOfflineResponse?: boolean;
    /** 离线响应配置 */
    offlineResponseConfig?: OfflineResponseConfig;
  };
}

/**
 * 降级策略管理器
 * 
 * 实现三层降级策略，确保服务连续性
 */
export class DegradationStrategy extends EventEmitter {
  private config: Required<DegradationStrategyConfig>;
  private registry: ModelRegistry;
  private matcher: CapabilityMatcher;
  private degradationHistory: Array<{
    timestamp: Date;
    layer: DegradationLayer;
    success: boolean;
    durationMs: number;
    path: string[];
  }> = [];
  
  constructor(
    registry: ModelRegistry,
    matcher: CapabilityMatcher,
    config: DegradationStrategyConfig = {}
  ) {
    super();
    
    this.registry = registry;
    this.matcher = matcher;
    this.config = {
      enableThreeLayerDegradation: config.enableThreeLayerDegradation ?? true,
      layer1: {
        maxRetries: config.layer1?.maxRetries ?? 2,
        timeout: config.layer1?.timeout ?? 10000 // 10秒
      },
      layer2: {
        maxRetries: config.layer2?.maxRetries ?? 2,
        timeout: config.layer2?.timeout ?? 15000, // 15秒
        preferLowCost: config.layer2?.preferLowCost ?? true
      },
      layer3: {
        enableOfflineResponse: config.layer3?.enableOfflineResponse ?? true,
        offlineResponseConfig: config.layer3?.offlineResponseConfig ?? {
          defaultMessage: '抱歉，服务暂时繁忙，请稍后再试。',
          timeoutMessage: '请求超时，请稍后再试。',
          rateLimitMessage: '请求频率过高，请稍后再试。',
          systemErrorMessage: '系统暂时不可用，请稍后再试。'
        }
      }
    };
    
    log.info('降级策略管理器初始化', {
      enableThreeLayer: this.config.enableThreeLayerDegradation,
      layer1Retries: this.config.layer1.maxRetries,
      layer2Retries: this.config.layer2.maxRetries,
      enableOffline: this.config.layer3.enableOfflineResponse
    });
  }
  
  /**
   * 执行降级流程
   * 宪法依据: §306零停机协议，每层延迟<10秒
   */
  async execute(
    request: ChatRequest,
    primaryAdapter: ModelAdapter
  ): Promise<ChatResponse> {
    const startTime = Date.now();
    const path: string[] = [`${primaryAdapter.provider}:${primaryAdapter.model}`];
    
    log.info(`开始降级流程，主模型: ${path[0]}`);
    
    // Layer 1: 同级备用
    const layer1Result = await this.tryLayer1(request, primaryAdapter, path);
    if (layer1Result.success) {
      const durationMs = Date.now() - startTime;
      this.recordDegradation(DegradationLayer.LAYER1, true, durationMs, path);
      log.info(`Layer 1 成功，耗时: ${durationMs}ms`);
      return layer1Result.response!;
    }
    
    log.warn('Layer 1 失败，尝试 Layer 2');
    
    // Layer 2: 低级降级
    const layer2Result = await this.tryLayer2(request, primaryAdapter, path);
    if (layer2Result.success) {
      const durationMs = Date.now() - startTime;
      this.recordDegradation(DegradationLayer.LAYER2, true, durationMs, path);
      log.info(`Layer 2 成功，耗时: ${durationMs}ms`);
      return layer2Result.response!;
    }
    
    log.warn('Layer 2 失败，尝试 Layer 3');
    
    // Layer 3: 离线响应
    const layer3Result = await this.tryLayer3(request, path, layer2Result.errorMessage);
    const durationMs = Date.now() - startTime;
    this.recordDegradation(DegradationLayer.LAYER3, layer3Result.success, durationMs, path);
    
    if (layer3Result.success) {
      log.info(`Layer 3 成功（离线响应），总耗时: ${durationMs}ms`);
      return layer3Result.response!;
    }
    
    // 所有层级都失败
    const error = new Error(`所有降级层级均失败: ${layer3Result.errorMessage}`);
    log.error('降级流程失败', error);
    this.emit('degradation-failed', { path, durationMs, error });
    
    throw error;
  }
  
  /**
   * Layer 1: 主模型 → 同级备用
   */
  private async tryLayer1(
    request: ChatRequest,
    primaryAdapter: ModelAdapter,
    path: string[]
  ): Promise<DegradationResult> {
    const startTime = Date.now();
    const primaryId = `${primaryAdapter.provider}:${primaryAdapter.model}`;
    const layer1Timeout = this.config.layer1.timeout ?? 10000;
    const layer1Retries = this.config.layer1.maxRetries ?? 2;
    
    log.debug(`执行 Layer 1: ${primaryId}`);
    
    try {
      // 尝试主模型
      const response = await this.withTimeout(
        primaryAdapter.chat(request),
        layer1Timeout
      );
      
      const durationMs = Date.now() - startTime;
      return {
        success: true,
        layer: DegradationLayer.LAYER1,
        adapter: primaryAdapter,
        response,
        durationMs,
        path
      };
      
    } catch (primaryError: any) {
      log.debug(`Layer 1 主模型失败: ${primaryError.message}`);
      
      // 选择同级备用模型
      const backup = await this.selectSameTierBackup(primaryAdapter);
      
      if (!backup) {
        const durationMs = Date.now() - startTime;
        return {
          success: false,
          layer: DegradationLayer.LAYER1,
          errorMessage: '无可用同级备用模型',
          durationMs,
          path
        };
      }
      
      const backupId = `${backup.provider}:${backup.model}`;
      path.push(backupId);
      
      log.debug(`Layer 1 切换到备用模型: ${backupId}`);
      
      try {
        // 尝试备用模型（带重试）
        let lastError: any;
        for (let attempt = 1; attempt <= layer1Retries; attempt++) {
          try {
            const response = await this.withTimeout(
              backup.chat(request),
              layer1Timeout
            );
            
            const durationMs = Date.now() - startTime;
            return {
              success: true,
              layer: DegradationLayer.LAYER1,
              adapter: backup,
              response,
              durationMs,
              path
            };
          } catch (retryError: any) {
            lastError = retryError;
            log.debug(`Layer 1 备用模型重试 ${attempt}/${layer1Retries} 失败`);
          }
        }
        
        const durationMs = Date.now() - startTime;
        return {
          success: false,
          layer: DegradationLayer.LAYER1,
          errorMessage: `Layer 1 备用模型重试失败: ${lastError?.message}`,
          durationMs,
          path
        };
        
      } catch (backupError: any) {
        const durationMs = Date.now() - startTime;
        return {
          success: false,
          layer: DegradationLayer.LAYER1,
          errorMessage: `Layer 1 备用模型失败: ${backupError.message}`,
          durationMs,
          path
        };
      }
    }
  }
  
  /**
   * Layer 2: 备用模型 → 低级降级
   */
  private async tryLayer2(
    request: ChatRequest,
    primaryAdapter: ModelAdapter,
    path: string[]
  ): Promise<DegradationResult> {
    const startTime = Date.now();
    const layer2Timeout = this.config.layer2.timeout ?? 15000;
    const layer2Retries = this.config.layer2.maxRetries ?? 2;
    
    log.debug('执行 Layer 2: 低级降级');
    
    // 选择低级模型
    const lowTier = await this.selectLowTierModel(primaryAdapter);
    
    if (!lowTier) {
      const durationMs = Date.now() - startTime;
      return {
        success: false,
        layer: DegradationLayer.LAYER2,
        errorMessage: '无可用低级模型',
        durationMs,
        path
      };
    }
    
    const lowTierId = `${lowTier.provider}:${lowTier.model}`;
    path.push(lowTierId);
    
    log.debug(`Layer 2 使用低级模型: ${lowTierId}`);
    
    try {
      // 尝试低级模型（带重试）
      let lastError: any;
      for (let attempt = 1; attempt <= layer2Retries; attempt++) {
        try {
          const response = await this.withTimeout(
            lowTier.chat(request),
            layer2Timeout
          );
          
          const durationMs = Date.now() - startTime;
          return {
            success: true,
            layer: DegradationLayer.LAYER2,
            adapter: lowTier,
            response,
            durationMs,
            path
          };
        } catch (retryError: any) {
          lastError = retryError;
          log.debug(`Layer 2 低级模型重试 ${attempt}/${layer2Retries} 失败`);
        }
      }
      
      const durationMs = Date.now() - startTime;
      return {
        success: false,
        layer: DegradationLayer.LAYER2,
        errorMessage: `Layer 2 低级模型重试失败: ${lastError?.message}`,
        durationMs,
        path
      };
      
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      return {
        success: false,
        layer: DegradationLayer.LAYER2,
        errorMessage: `Layer 2 低级模型失败: ${error.message}`,
        durationMs,
        path
      };
    }
  }
  
  /**
   * Layer 3: 降级模型 → 离线响应
   */
  private async tryLayer3(
    request: ChatRequest,
    path: string[],
    previousError?: string
  ): Promise<DegradationResult> {
    const startTime = Date.now();
    
    log.debug('执行 Layer 3: 离线响应');
    
    if (!this.config.layer3.enableOfflineResponse) {
      const durationMs = Date.now() - startTime;
      return {
        success: false,
        layer: DegradationLayer.LAYER3,
        errorMessage: previousError || 'Layer 3 离线响应未启用',
        durationMs,
        path
      };
    }
    
    // 确定响应类型
    const offlineConfig = this.config.layer3.offlineResponseConfig ?? {};
    let responseMessage = offlineConfig.defaultMessage ?? 'Service is temporarily unavailable, please retry later.';
    
    if (previousError) {
      if (previousError.toLowerCase().includes('timeout')) {
        responseMessage = offlineConfig.timeoutMessage ?? responseMessage;
      } else if (previousError.toLowerCase().includes('rate limit')) {
        responseMessage = offlineConfig.rateLimitMessage ?? responseMessage;
      } else if (previousError.toLowerCase().includes('error')) {
        responseMessage = offlineConfig.systemErrorMessage ?? responseMessage;
      }
    }
    
    path.push('[OFFLINE]');
    
    // 构造离线响应
    const response: ChatResponse = {
      id: `offline_${Date.now()}`,
      model: 'offline_response',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: responseMessage
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      },
      latency: 0,
    };
    
    const durationMs = Date.now() - startTime;
    
    return {
      success: true,
      layer: DegradationLayer.LAYER3,
      offlineResponse: responseMessage,
      response,
      durationMs,
      path
    };
  }
  
  /**
   * 选择同级备用模型
   */
  private async selectSameTierBackup(primaryAdapter: ModelAdapter): Promise<ModelAdapter | null> {
    const primaryProvider = primaryAdapter.provider;
    const primaryId = `${primaryAdapter.provider}:${primaryAdapter.model}`;
    
    // 获取所有模型
    const allAdapters = this.registry.list();
    
    // 排除主模型
    const candidates = allAdapters.filter(
      a => `${a.provider}:${a.model}` !== primaryId
    );
    
    if (candidates.length === 0) {
      return null;
    }
    
    // 优先选择同提供商的模型
    const sameProviderCandidates = candidates.filter(a => a.provider === primaryProvider);
    
    if (sameProviderCandidates.length > 0) {
      // 按优先级排序
      sameProviderCandidates.sort((a, b) => {
        const regA = this.registry.listRegistrations().get(`${a.provider}:${a.model}`);
        const regB = this.registry.listRegistrations().get(`${b.provider}:${b.model}`);
        return (regA?.priority ?? 100) - (regB?.priority ?? 100);
      });
      
      return sameProviderCandidates[0];
    }
    
    // 跨提供商：选择能力相似的模型
    const taskRequirements: TaskRequirements = {
      estimatedTokens: 1000,
      qualityType: 'reasoning',
      minQuality: 'intermediate',
      needsStreaming: false,
      needsFunctionCall: false,
      needsVision: false
    };
    
    const bestMatch = this.matcher.selectBest(candidates, taskRequirements);
    return bestMatch ? bestMatch.adapter : null;
  }
  
  /**
   * 选择低级模型
   */
  private async selectLowTierModel(primaryAdapter: ModelAdapter): Promise<ModelAdapter | null> {
    const primaryId = `${primaryAdapter.provider}:${primaryAdapter.model}`;
    
    // 获取所有模型
    const allAdapters = this.registry.list();
    
    // 排除主模型
    const candidates = allAdapters.filter(
      a => `${a.provider}:${a.model}` !== primaryId
    );
    
    if (candidates.length === 0) {
      return null;
    }
    
    // 优先选择低成本模型
    if (this.config.layer2.preferLowCost) {
      // 按成本排序
      candidates.sort((a, b) => {
        const costA = (a.capabilities.cost_per_1k_input_tokens + 
                       a.capabilities.cost_per_1k_output_tokens) / 2;
        const costB = (b.capabilities.cost_per_1k_input_tokens + 
                       b.capabilities.cost_per_1k_output_tokens) / 2;
        return costA - costB;
      });
      
      // 确保质量不低于basic
      for (const adapter of candidates) {
        if (adapter.capabilities.reasoning_quality === 'basic' ||
            adapter.capabilities.reasoning_quality === 'intermediate') {
          return adapter;
        }
      }
    }
    
    // 默认：选择basic质量模型
    const basicModels = candidates.filter(
      a => a.capabilities.reasoning_quality === 'basic'
    );
    
    if (basicModels.length > 0) {
      return basicModels[0];
    }
    
    // 最后备选：按优先级
    candidates.sort((a, b) => {
      const regA = this.registry.listRegistrations().get(`${a.provider}:${a.model}`);
      const regB = this.registry.listRegistrations().get(`${b.provider}:${b.model}`);
      return (regA?.priority ?? 100) - (regB?.priority ?? 100);
    });
    
    return candidates[0];
  }
  
  /**
   * 带超时的Promise
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  }
  
  /**
   * 记录降级历史
   */
  private recordDegradation(
    layer: DegradationLayer,
    success: boolean,
    durationMs: number,
    path: string[]
  ): void {
    this.degradationHistory.push({
      timestamp: new Date(),
      layer,
      success,
      durationMs,
      path
    });
    
    // 限制历史记录数量（保留最近1000条）
    if (this.degradationHistory.length > 1000) {
      this.degradationHistory = this.degradationHistory.slice(-500);
    }
    
    this.emit('degradation-recorded', {
      layer,
      success,
      durationMs,
      path
    });
  }
  
  /**
   * 获取降级统计
   */
  getDegradationStats(): {
    total: number;
    byLayer: Record<string, number>;
    successRate: number;
    avgDurationMs: number;
    recentPaths: Array<{layer: string, path: string[], durationMs: number}>;
  } {
    const total = this.degradationHistory.length;
    const byLayer: Record<string, number> = {
      layer1: 0,
      layer2: 0,
      layer3: 0
    };
    
    let successCount = 0;
    let totalDuration = 0;
    
    for (const record of this.degradationHistory) {
      byLayer[record.layer]++;
      
      if (record.success) {
        successCount++;
      }
      
      totalDuration += record.durationMs;
    }
    
    const recentPaths = this.degradationHistory.slice(-20).map(r => ({
      layer: r.layer,
      path: r.path,
      durationMs: r.durationMs
    }));
    
    return {
      total,
      byLayer,
      successRate: total > 0 ? successCount / total : 1,
      avgDurationMs: total > 0 ? totalDuration / total : 0,
      recentPaths
    };
  }
  
  /**
   * 获取配置
   */
  getConfig(): Readonly<Required<DegradationStrategyConfig>> {
    return this.config;
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<DegradationStrategyConfig>): void {
    Object.assign(this.config, config);
    log.info('配置已更新');
  }
  
  /**
   * 清空降级历史
   */
  clearHistory(): void {
    this.degradationHistory = [];
    log.info('降级历史已清空');
  }
}

/**
 * 创建默认降级策略配置
 */
export function createDefaultDegradationStrategyConfig(): DegradationStrategyConfig {
  return {
    enableThreeLayerDegradation: true,
    layer1: {
      maxRetries: 2,
      timeout: 10000
    },
    layer2: {
      maxRetries: 2,
      timeout: 15000,
      preferLowCost: true
    },
    layer3: {
      enableOfflineResponse: true,
      offlineResponseConfig: {
        defaultMessage: '抱歉，服务暂时繁忙，请稍后再试。',
        timeoutMessage: '请求超时，请稍后再试。',
        rateLimitMessage: '请求频率过高，请稍后再试。',
        systemErrorMessage: '系统暂时不可用，请稍后再试。'
      }
    }
  };
}

export default {
  DegradationStrategy,
  createDefaultDegradationStrategyConfig,
  DegradationLayer
};
