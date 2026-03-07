/**
 * 🚀 Negentropy-Lab Gateway 配置管理器
 * 
 * 宪法依据：
 * - §101 同步公理：配置变更必须触发文档更新
 * - §102 熵减原则：统一配置管理，降低系统熵值
 * - §152 单一真理源：所有配置集中管理，消除冗余
 * - §108 异构模型策略：明确指定模型参数
 * - §306 零停机协议：配置热重载支持服务连续性
 * 
 * 移植来源：
 * 1. MY-DOGE-DEMO/server/config/server.config.ts (配置架构)
 * 2. OpenClaw Gateway 配置模式
 * 
 * 功能特性：
 * - 环境变量支持 (dotenv)
 * - TypeScript类型安全验证
 * - 热重载机制 (文件监听)
 * - 宪法合规验证
 * - 配置验证和默认值处理
 */

import dotenv from 'dotenv';
import * as path from 'path';
import { readFileSync, watch } from 'fs';
import { logger } from './utils/logger';

// 加载环境变量
dotenv.config();

// LLM提供商类型
export type LLMProvider = 'openai' | 'deepseek' | 'local';

// Gateway配置接口
export interface GatewayConfig {
  // 基础配置
  port: number;
  bind: 'loopback' | 'lan' | 'tailnet' | 'auto';
  host?: string;
  controlUiEnabled: boolean;
  openAiChatCompletionsEnabled: boolean;
  openResponsesEnabled: boolean;
  
  // 认证配置
  auth: {
    token?: string;
    password?: string;
    allowTailscale: boolean;
  };
  
  // Tailscale配置
  tailscale: {
    enabled: boolean;
    resetOnExit: boolean;
  };
  
  // WebSocket配置
  websocket: {
    enabled: boolean;
    path: string;
    maxConnections: number;
    pingInterval: number;
    pingTimeout: number;
  };
  
  // LLM服务配置 (§108异构模型策略)
  llm: {
    provider: LLMProvider;
    apiKey?: string;
    baseUrl?: string;
    defaultModel: string;
    temperature: number;
    maxTokens: number;
    timeout: number;
    maxRetries: number;
    enableStreaming: boolean;
    enableTools: boolean;
  };
  
  // 宪法合规配置
  constitution: {
    complianceChecks: boolean;
    responseLatencyMonitoring: boolean;
    modelParameterEnforcement: boolean;
    zeroDowntimeEnabled: boolean;
  };
  
  // 日志配置
  log: {
    level: 'debug' | 'info' | 'warn' | 'error';
    dir: string;
  };
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: GatewayConfig = {
  // 基础配置
  port: 4514,
  bind: 'auto',
  controlUiEnabled: true,
  openAiChatCompletionsEnabled: true,
  openResponsesEnabled: true,
  
  // 认证配置
  auth: {
    allowTailscale: false,
  },
  
  // Tailscale配置
  tailscale: {
    enabled: false,
    resetOnExit: false,
  },
  
  // WebSocket配置
  websocket: {
    enabled: true,
    path: '/gateway',
    maxConnections: 100,
    pingInterval: 30000, // 30秒
    pingTimeout: 5000,   // 5秒
  },
  
  // LLM服务配置 (§108异构模型策略)
  llm: {
    provider: 'deepseek',
    defaultModel: 'deepseek-chat',
    temperature: 0.7,
    maxTokens: 2048,
    timeout: 30000,
    maxRetries: 3,
    enableStreaming: true,
    enableTools: false,
  },
  
  // 宪法合规配置
  constitution: {
    complianceChecks: true,
    responseLatencyMonitoring: true,
    modelParameterEnforcement: true,
    zeroDowntimeEnabled: true,
  },
  
  // 日志配置
  log: {
    level: 'info',
    dir: 'logs',
  },
};

/**
 * 从环境变量加载配置
 */
function loadConfigFromEnv(): Partial<GatewayConfig> {
  const envConfig: Partial<GatewayConfig> = {};
  
  // 基础配置
  if (process.env.GATEWAY_PORT) {
    envConfig.port = parseInt(process.env.GATEWAY_PORT, 10);
  }
  if (process.env.GATEWAY_BIND_MODE) {
    envConfig.bind = process.env.GATEWAY_BIND_MODE as GatewayConfig['bind'];
  }
  if (process.env.GATEWAY_HOST) {
    envConfig.host = process.env.GATEWAY_HOST;
  }
  if (process.env.GATEWAY_CONTROL_UI_ENABLED) {
    envConfig.controlUiEnabled = process.env.GATEWAY_CONTROL_UI_ENABLED === 'true';
  }
  if (process.env.GATEWAY_OPENAI_ENABLED) {
    envConfig.openAiChatCompletionsEnabled = process.env.GATEWAY_OPENAI_ENABLED === 'true';
  }
  
  // 认证配置
  envConfig.auth = {
    token: process.env.GATEWAY_AUTH_TOKEN || DEFAULT_CONFIG.auth.token,
    password: process.env.GATEWAY_AUTH_PASSWORD || DEFAULT_CONFIG.auth.password,
    allowTailscale: process.env.GATEWAY_ALLOW_TAILSCALE === 'true',
  };
  
  // Tailscale配置
  envConfig.tailscale = {
    enabled: process.env.TAILSCALE_ENABLED === 'true',
    resetOnExit: process.env.TAILSCALE_RESET_ON_EXIT === 'true',
  };
  
  // LLM服务配置 (§108异构模型策略)
  envConfig.llm = {
    provider: (process.env.LLM_PROVIDER as LLMProvider) || DEFAULT_CONFIG.llm.provider,
    apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY,
    baseUrl: process.env.LLM_BASE_URL || DEFAULT_CONFIG.llm.baseUrl,
    defaultModel: process.env.LLM_DEFAULT_MODEL || DEFAULT_CONFIG.llm.defaultModel,
    temperature: parseFloat(process.env.LLM_TEMPERATURE || DEFAULT_CONFIG.llm.temperature.toString()),
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || DEFAULT_CONFIG.llm.maxTokens.toString(), 10),
    timeout: parseInt(process.env.LLM_TIMEOUT || DEFAULT_CONFIG.llm.timeout.toString(), 10),
    maxRetries: parseInt(process.env.LLM_MAX_RETRIES || DEFAULT_CONFIG.llm.maxRetries.toString(), 10),
    enableStreaming: process.env.LLM_ENABLE_STREAMING === 'true',
    enableTools: process.env.LLM_ENABLE_TOOLS === 'true',
  };
  
  // 宪法合规配置
  envConfig.constitution = {
    complianceChecks: process.env.CONSTITUTION_COMPLIANCE_CHECKS === 'true',
    responseLatencyMonitoring: process.env.RESPONSE_LATENCY_MONITORING === 'true',
    modelParameterEnforcement: process.env.MODEL_PARAMETER_ENFORCEMENT === 'true',
    zeroDowntimeEnabled: process.env.ZERO_DOWNTIME_ENABLED === 'true',
  };
  
  // 日志配置
  envConfig.log = {
    level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || DEFAULT_CONFIG.log.level,
    dir: process.env.LOG_DIR || DEFAULT_CONFIG.log.dir,
  };
  
  return envConfig;
}

/**
 * 验证配置
 * 宪法依据: §108异构模型策略 - 模型参数必须明确指定
 */
function validateConfig(config: GatewayConfig): void {
  const errors: string[] = [];
  
  // 端口验证
  if (config.port < 1 || config.port > 65535) {
    errors.push(`端口必须在1-65535之间: ${config.port}`);
  }
  
  // LLM配置验证 (§108异构模型策略)
  if (!config.llm.defaultModel || config.llm.defaultModel.trim() === '') {
    errors.push('LLM默认模型必须明确指定 (§108异构模型策略)');
  }
  
  if (config.llm.provider !== 'local' && !config.llm.apiKey) {
    errors.push(`${config.llm.provider} API密钥必须提供 (§108异构模型策略)`);
  }
  
  // 宪法合规验证
  if (config.constitution.modelParameterEnforcement && !config.llm.defaultModel) {
    errors.push('宪法合规要求模型参数必须明确指定 (§108.1)');
  }
  
  if (errors.length > 0) {
    throw new Error(`配置验证失败:\n${errors.join('\n')}`);
  }
}

/**
 * 配置管理器
 */
export class GatewayConfigManager {
  private config: GatewayConfig;
  private configPath?: string;
  private watcher?: ReturnType<typeof watch>;
  
  constructor(initialConfig?: Partial<GatewayConfig>) {
    // 加载默认配置
    this.config = { ...DEFAULT_CONFIG };
    
    // 加载环境变量配置
    const envConfig = loadConfigFromEnv();
    this.config = { ...this.config, ...envConfig };
    
    // 应用初始配置
    if (initialConfig) {
      this.config = { ...this.config, ...initialConfig };
    }
    
    // 验证配置
    validateConfig(this.config);
    
    logger.info('[Config] Gateway配置管理器已初始化');
    logger.info(`[Config] 端口: ${this.config.port}, 绑定模式: ${this.config.bind}`);
    logger.info(`[Config] LLM提供商: ${this.config.llm.provider}, 模型: ${this.config.llm.defaultModel}`);
    logger.info('[Config] 宪法合规: §101同步公理、§102熵减原则、§108异构模型策略、§152单一真理源');
  }
  
  /**
   * 从文件加载配置
   */
  loadFromFile(filePath: string): void {
    this.configPath = path.resolve(filePath);
    
    try {
      const fileContent = readFileSync(this.configPath, 'utf8');
      const fileConfig = JSON.parse(fileContent);
      
      // 合并配置
      this.config = { ...this.config, ...fileConfig };
      validateConfig(this.config);
      
      logger.info(`[Config] 已从文件加载配置: ${filePath}`);
      
      // 设置文件监听 (热重载)
      this.setupFileWatcher();
      
    } catch (error: any) {
      logger.warn(`[Config] 加载配置文件失败: ${error.message}, 使用默认配置`);
    }
  }
  
  /**
   * 设置文件监听器 (热重载)
   * 宪法依据: §306零停机协议 - 配置变更不影响服务运行
   */
  private setupFileWatcher(): void {
    if (!this.configPath) return;
    
    try {
      this.watcher = watch(this.configPath, (eventType) => {
        if (eventType === 'change') {
          logger.info('[Config] 配置文件变更检测到，重新加载...');
          this.loadFromFile(this.configPath!);
          logger.info('[Config] 配置热重载完成，应用新配置');
        }
      });
      
      logger.info(`[Config] 配置热重载已启用: ${this.configPath}`);
      
    } catch (error: any) {
      logger.warn(`[Config] 设置文件监听器失败: ${error.message}`);
    }
  }
  
  /**
   * 获取当前配置
   */
  getConfig(): GatewayConfig {
    return { ...this.config };
  }
  
  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<GatewayConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...newConfig };
    
    try {
      validateConfig(this.config);
      
      logger.info('[Config] 配置已更新');
      logger.debug(`[Config] 旧配置: ${JSON.stringify(oldConfig, null, 2)}`);
      logger.debug(`[Config] 新配置: ${JSON.stringify(this.config, null, 2)}`);
      
      // 触发宪法合规检查
      this.performConstitutionCheck();
      
    } catch (error: any) {
      // 恢复旧配置
      this.config = oldConfig;
      logger.error(`[Config] 配置更新失败: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * 执行宪法合规检查
   */
  private performConstitutionCheck(): void {
    const checks = [
      {
        condition: this.config.llm.defaultModel && this.config.llm.defaultModel.trim() !== '',
        article: '§108',
        description: '模型参数明确指定',
      },
      {
        condition: this.config.port > 0 && this.config.port <= 65535,
        article: '§306',
        description: '端口配置确保服务连续性',
      },
      {
        condition: this.config.constitution.complianceChecks,
        article: '§101',
        description: '宪法合规检查已启用',
      },
      {
        condition: this.config.constitution.zeroDowntimeEnabled,
        article: '§306',
        description: '零停机协议已启用',
      },
    ];
    
    const violations = checks.filter(check => !check.condition);
    
    if (violations.length > 0) {
      logger.warn(`[Config] 宪法合规警告: ${violations.map(v => `${v.article} - ${v.description}`).join(', ')}`);
    } else {
      logger.info('[Config] 所有宪法合规检查通过');
    }
  }
  
  /**
   * 获取LLM配置 (用于集成LLM服务)
   */
  getLLMConfig() {
    return {
      provider: this.config.llm.provider,
      apiKey: this.config.llm.apiKey,
      baseUrl: this.config.llm.baseUrl,
      defaultModel: this.config.llm.defaultModel,
      temperature: this.config.llm.temperature,
      maxTokens: this.config.llm.maxTokens,
      timeout: this.config.llm.timeout,
      maxRetries: this.config.llm.maxRetries,
      enableStreaming: this.config.llm.enableStreaming,
      enableTools: this.config.llm.enableTools,
    };
  }
  
  /**
   * 获取WebSocket配置
   */
  getWebSocketConfig() {
    return {
      enabled: this.config.websocket.enabled,
      path: this.config.websocket.path,
      maxConnections: this.config.websocket.maxConnections,
      pingInterval: this.config.websocket.pingInterval,
      pingTimeout: this.config.websocket.pingTimeout,
    };
  }
  
  /**
   * 获取认证配置
   */
  getAuthConfig() {
    return { ...this.config.auth };
  }
  
  /**
   * 获取基础服务器配置
   */
  getServerConfig() {
    return {
      port: this.config.port,
      bind: this.config.bind,
      host: this.config.host,
      controlUiEnabled: this.config.controlUiEnabled,
      openAiChatCompletionsEnabled: this.config.openAiChatCompletionsEnabled,
      openResponsesEnabled: this.config.openResponsesEnabled,
      tailscale: { ...this.config.tailscale },
    };
  }
  
  /**
   * 关闭配置管理器
   */
  close(): void {
    if (this.watcher) {
      this.watcher.close();
      logger.info('[Config] 配置文件监听器已关闭');
    }
  }
}

/**
 * 创建默认配置管理器
 */
export function createDefaultConfigManager(): GatewayConfigManager {
  return new GatewayConfigManager();
}

// 导出默认配置
export default {
  DEFAULT_CONFIG,
  GatewayConfigManager,
  createDefaultConfigManager,
};