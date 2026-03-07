/**
 * 统一模型适配器接口
 * 宪法依据: §108 异构模型策略公理
 * 
 * @module llm/adapters/ModelAdapter
 * @version 1.0.0
 * @category LLM/Adapters
 */

/**
 * 模型适配器接口
 * 
 * 所有LLM适配器必须实现此接口，确保统一的调用方式
 */
export interface ModelAdapter {
  // ===== 基础信息 =====
  /** 提供商名称 (e.g., 'openai', 'anthropic', 'deepseek') */
  readonly provider: string;
  
  /** 模型名称 (e.g., 'gpt-4', 'claude-3-5-sonnet', 'deepseek-chat') */
  readonly model: string;
  
  /** 版本号 */
  readonly version: string;
  
  // ===== 能力声明 =====
  /** 模型能力声明 */
  readonly capabilities: ModelCapabilities;
  
  // ===== 核心方法 =====
  /**
   * 聊天接口
   * @param request 聊天请求
   * @returns 聊天响应
   */
  chat(request: ChatRequest): Promise<ChatResponse>;
  
  /**
   * 流式聊天
   * @param request 聊天请求
   * @returns 异步迭代器，返回聊天块
   */
  chatStream(request: ChatRequest): AsyncIterableIterator<ChatChunk>;
  
  /**
   * 文本嵌入
   * @param text 输入文本
   * @returns 嵌入向量
   */
  embed(text: string): Promise<number[]>;
  
  // ===== 生命周期 =====
  /**
   * 初始化适配器
   */
  initialize(): Promise<void>;
  
  /**
   * 健康检查
   * @returns 健康状态
   */
  healthCheck(): Promise<HealthStatus>;
  
  /**
   * 释放资源
   */
  dispose(): Promise<void>;
  
  // ===== 配额管理 =====
  /**
   * 获取配额使用情况
   * @returns 配额使用信息
   */
  getQuotaUsage(): Promise<QuotaUsage>;
  
  /**
   * 计算成本
   * @param tokens Token数量
   * @returns 成本（美元）
   */
  getCost(tokens: number): number;
}

/**
 * 模型能力声明
 * 
 * 声明模型支持的功能和性能指标
 */
export interface ModelCapabilities {
  // ===== 基础能力 =====
  /** 是否支持聊天 */
  chat: boolean;
  
  /** 是否支持流式输出 */
  streaming: boolean;
  
  /** 是否支持函数调用 */
  function_call: boolean;
  
  /** 是否支持视觉（多模态） */
  vision: boolean;
  
  /** 是否支持嵌入 */
  embedding: boolean;
  
  // ===== 性能指标 =====
  /** 上下文窗口大小（Token数） */
  context_window: number;
  
  /** 最大输出Token数 */
  max_output_tokens: number;
  
  /** 支持的语言列表 */
  supported_languages: string[];
  
  // ===== 成本信息 =====
  /** 每千输入Token成本（美元） */
  cost_per_1k_input_tokens: number;
  
  /** 每千输出Token成本（美元） */
  cost_per_1k_output_tokens: number;
  
  // ===== 质量评级 =====
  /** 推理能力质量评级 */
  reasoning_quality: 'basic' | 'intermediate' | 'advanced';
  
  /** 编程能力质量评级 */
  coding_quality: 'basic' | 'intermediate' | 'advanced';
  
  /** 创意能力质量评级 */
  creativity_quality: 'basic' | 'intermediate' | 'advanced';
}

/**
 * 聊天消息接口
 */
export interface ChatMessage {
  /** 消息角色 */
  role: 'system' | 'user' | 'assistant' | 'tool';
  
  /** 消息内容 */
  content: string | null;
  
  /** 发送者名称（可选） */
  name?: string;
  
  /** 工具调用（可选） */
  tool_calls?: ToolCall[];
  
  /** 工具调用ID（可选） */
  tool_call_id?: string;
}

/**
 * 工具调用接口
 */
export interface ToolCall {
  /** 工具调用ID */
  id: string;
  
  /** 工具类型 */
  type: 'function';
  
  /** 函数调用信息 */
  function: {
    /** 函数名称 */
    name: string;
    /** 函数参数（JSON字符串） */
    arguments: string;
  };
}

/**
 * 工具定义接口
 */
export interface ToolDefinition {
  /** 工具类型 */
  type: 'function';
  
  /** 函数定义 */
  function: {
    /** 函数名称 */
    name: string;
    /** 函数描述 */
    description?: string;
    /** 参数Schema（JSON Schema） */
    parameters: any;
  };
}

/**
 * 聊天请求接口
 */
export interface ChatRequest {
  /** 消息列表 */
  messages: ChatMessage[];
  
  /** 模型名称（可选，默认使用适配器默认模型） */
  model?: string;
  
  /** 温度参数（0.0-2.0） */
  temperature?: number;
  
  /** 最大Token数 */
  maxTokens?: number;
  
  /** 工具定义列表 */
  tools?: ToolDefinition[];
  
  /** 是否使用流式输出 */
  stream?: boolean;
  
  /** 工具选择策略 */
  tool_choice?: 'none' | 'auto' | { type: 'function', function: { name: string } };
}

/**
 * 聊天选择接口
 */
export interface ChatChoice {
  /** 选择索引 */
  index: number;
  
  /** 消息内容 */
  message: ChatMessage;
  
  /** 完成原因 */
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
}

/**
 * Token使用统计接口
 */
export interface TokenUsage {
  /** 输入Token数 */
  prompt_tokens: number;
  
  /** 输出Token数 */
  completion_tokens: number;
  
  /** 总Token数 */
  total_tokens: number;
}

/**
 * 聊天响应接口
 */
export interface ChatResponse {
  /** 响应ID */
  id: string;
  
  /** 模型名称 */
  model: string;
  
  /** 选择列表 */
  choices: ChatChoice[];
  
  /** Token使用统计 */
  usage?: TokenUsage;
  
  /** 延迟（毫秒） */
  latency: number;
}

/**
 * 流式聊天块接口
 */
export interface ChatChunk {
  /** 块ID */
  id: string;
  
  /** 对象类型 */
  object: 'chat.completion.chunk';
  
  /** 创建时间戳 */
  created: number;
  
  /** 模型名称 */
  model: string;
  
  /** 选择列表 */
  choices: ChunkChoice[];
}

/**
 * 块选择接口
 */
export interface ChunkChoice {
  /** 选择索引 */
  index: number;
  
  /** 增量内容 */
  delta: {
    /** 角色（仅在第一个块） */
    role?: 'assistant';
    /** 内容增量 */
    content?: string;
    /** 工具调用增量 */
    tool_calls?: ToolCall[];
  };
  
  /** 完成原因 */
  finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
}

/**
 * 健康状态接口
 */
export interface HealthStatus {
  /** 提供商名称 */
  provider: string;
  
  /** 模型名称 */
  model: string;
  
  /** 健康状态 */
  status: 'healthy' | 'degraded' | 'unhealthy';
  
  /** 延迟（毫秒） */
  latency: number;
  
  /** 最后检查时间 */
  lastCheck: Date;
  
  /** 错误率（0.0-1.0） */
  errorRate: number;
  
  /** 剩余配额（可选） */
  quotaRemaining?: number;
}

/**
 * 配额使用接口
 */
export interface QuotaUsage {
  /** 已使用配额 */
  used: number;
  
  /** 总配额 */
  total: number;
  
  /** 配额重置时间 */
  resetTime: Date;
}

/**
 * 任务需求接口（用于能力匹配）
 */
export interface TaskRequirements {
  /** 估算Token数 */
  estimatedTokens: number;
  
  /** 质量类型 */
  qualityType: 'reasoning' | 'coding' | 'creativity';
  
  /** 最小质量等级 */
  minQuality: 'basic' | 'intermediate' | 'advanced';
  
  /** 最大成本（美元） */
  maxCost?: number;
  
  /** 是否需要流式输出 */
  needsStreaming: boolean;
  
  /** 是否需要函数调用 */
  needsFunctionCall: boolean;
  
  /** 是否需要视觉能力 */
  needsVision: boolean;
}

/**
 * 任务描述接口（用于能力匹配）
 */
export interface TaskDescription {
  /** 任务描述 */
  description: string;
  
  /** 任务类型 */
  type?: 'code' | 'analysis' | 'creative' | 'general';
  
  /** 优先级 */
  priority?: 'low' | 'medium' | 'high';
}

/**
 * 重试配置接口
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  
  /** 初始延迟（毫秒） */
  delayMs: number;
  
  /** 指数退避因子 */
  backoffFactor: number;
  
  /** 可重试的错误代码 */
  retryableErrors: string[];
}

/**
 * 默认重试配置
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  delayMs: 1000,
  backoffFactor: 2,
  retryableErrors: [
    'RATE_LIMIT_EXCEEDED',
    'TEMPORARY_FAILURE',
    'TIMEOUT',
    'CONNECTION_ERROR',
  ],
};

/**
 * 适配器配置接口
 */
export interface AdapterConfig {
  /** API密钥 */
  apiKey?: string;
  
  /** 基础URL */
  baseUrl?: string;
  
  /** 超时时间（毫秒） */
  timeout?: number;
  
  /** 重试配置 */
  retry?: RetryConfig;
  
  /** 是否启用日志 */
  enableLogging?: boolean;
  
  /** 自定义配置 */
  [key: string]: any;
}

/**
 * 日志接口
 */
export interface Logger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}
