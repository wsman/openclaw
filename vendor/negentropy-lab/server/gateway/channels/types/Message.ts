/**
 * 📨 通道管理器统一消息类型定义
 * 
 * 宪法依据：
 * - §101 同步公理：统一消息格式确保系统一致性
 * - §102 熵减原则：复用标准消息格式，减少技术债务
 * - §107 通信安全：消息加密和完整性验证
 * - §110 协作效率公理：高效的消息处理机制
 * - §152 单一真理源：统一定义消息数据模型
 * 
 * 设计原则：
 * 1. 跨平台兼容性：支持Slack、Discord、Telegram等平台
 * 2. 类型安全：完整的TypeScript类型定义
 * 3. 可扩展性：支持未来平台扩展
 * 4. 宪法合规：所有消息包含宪法合规验证信息
 * 
 * @version 1.0.0 (Phase 1D Day 1)
 * @category Gateway/Channels/Types
 */

/**
 * 支持的平台类型
 * 宪法依据：§101同步公理，统一平台标识符
 */
export type PlatformType = 'slack' | 'discord' | 'telegram' | 'web' | 'api' | 'console';

/**
 * 消息类型枚举
 * 宪法依据：§110协作效率公理，明确消息类型提高处理效率
 */
export enum MessageType {
  TEXT = 'text',                  // 文本消息
  ATTACHMENT = 'attachment',      // 附件消息
  IMAGE = 'image',                // 图片消息
  VIDEO = 'video',                // 视频消息
  AUDIO = 'audio',                // 音频消息
  FILE = 'file',                  // 文件消息
  COMMAND = 'command',            // 命令消息
  EVENT = 'event',                // 事件消息
  SYSTEM = 'system',              // 系统消息
  ERROR = 'error'                 // 错误消息
}

/**
 * 消息优先级
 * 宪法依据：§110协作效率公理，优先级调度优化资源使用
 */
export enum MessagePriority {
  LOW = 1,        // 低优先级（异步处理）
  NORMAL = 5,     // 正常优先级（普通消息）
  HIGH = 10,      // 高优先级（实时消息）
  CRITICAL = 20   // 关键优先级（系统告警）
}

/**
 * 消息附件接口
 * 宪法依据：§107通信安全，附件需要安全验证
 */
export interface MessageAttachment {
  id: string;                     // 附件唯一标识
  type: string;                   // 附件类型（image, video, audio, file等）
  url: string;                    // 附件URL
  filename?: string;              // 文件名
  size?: number;                  // 文件大小（字节）
  mimeType?: string;              // MIME类型
  thumbnailUrl?: string;          // 缩略图URL
  description?: string;           // 附件描述
  metadata?: Record<string, any>; // 附加元数据
  
  // 安全验证信息
  secure?: {
    signed?: boolean;             // 是否签名验证
    encrypted?: boolean;          // 是否加密
    hash?: string;                // 文件哈希（完整性验证）
  };
}

/**
 * 统一消息接口 - 核心数据模型
 * 宪法依据：§152单一真理源，所有平台消息统一格式
 */
export interface UnifiedMessage {
  // 基础标识
  id: string;                     // 消息全局唯一ID
  platform: PlatformType;         // 消息来源平台
  channelId: string;              // 通道ID
  userId: string;                 // 用户ID
  threadId?: string;              // 线程ID（用于消息回复链）
  
  // 内容信息
  type: MessageType;              // 消息类型
  text: string;                   // 消息文本内容
  html?: string;                  // HTML格式内容
  attachments?: MessageAttachment[]; // 消息附件列表
  
  // 时间戳
  timestamp: number;              // 消息创建时间戳（毫秒）
  receivedAt?: number;            // 消息接收时间戳（毫秒）
  processedAt?: number;           // 消息处理时间戳（毫秒）
  
  // 元数据
  metadata: {
    platformMessageId?: string;   // 原始平台消息ID
    platformChannelName?: string; // 原始通道名称
    platformUserName?: string;    // 原始用户名
    platformUserAvatar?: string;  // 原始用户头像
    
    // 消息处理状态
    isEdited?: boolean;           // 是否被编辑过
    isDeleted?: boolean;          // 是否被删除
    isPinned?: boolean;           // 是否被置顶
    isReaction?: boolean;         // 是否是表情回复
    
    // 宪法合规信息
    constitutionalCompliance?: {
      checked: boolean;           // 是否经过宪法合规检查
      complianceScore: number;    // 合规评分（0-100）
      violations?: string[];      // 宪法违规列表
      checkedAt?: number;         // 检查时间戳
    };
    
    // 性能监控
    processingStats?: {
      receivedAtGateway: number;  // Gateway接收时间
      normalizedAt: number;       // 标准化处理完成时间
      routedAt?: number;          // 路由完成时间
      deliveredAt?: number;       // 投递完成时间
    };
    
    // 扩展元数据（平台特定）
    [key: string]: any;
  };
  
  // 优先级和路由
  priority: MessagePriority;      // 消息优先级
  routing?: {
    targetAgentId?: string;       // 目标Agent ID
    targetChannelId?: string;     // 目标通道ID
    routingRules?: string[];      // 路由规则列表
    fallbackTargets?: string[];   // 备用目标列表
  };
  
  // 宪法合规验证标记
  constitutionalValidation?: {
    hasValidSignature: boolean;   // 是否有有效签名
    isEncrypted: boolean;         // 是否加密
    integrityVerified: boolean;   // 完整性是否已验证
    timestampValid: boolean;      // 时间戳是否有效
    securityLevel: 'high' | 'medium' | 'low'; // 安全等级
  };
}

/**
 * 出站消息接口（发送到平台）
 * 宪法依据：§107通信安全，出站消息需要安全处理
 */
export interface OutgoingMessage {
  id: string;                     // 消息ID（用于追踪）
  platform: PlatformType;         // 目标平台
  channelId: string;              // 目标通道ID
  userId?: string;                // 目标用户ID（用于私信）
  
  // 内容
  text: string;                   // 消息文本
  html?: string;                  // HTML格式内容
  attachments?: MessageAttachment[]; // 附件列表
  
  // 消息选项
  options?: {
    threadId?: string;            // 回复线程ID
    ephemeral?: boolean;          // 是否临时消息（仅限某些平台）
    broadcast?: boolean;          // 是否广播消息
    priority?: MessagePriority;   // 消息优先级
    
    // 平台特定选项
    slack?: {
      blocks?: any[];             // Slack块元素
      attachments?: any[];        // Slack附件
      thread_ts?: string;         // Slack线程时间戳
      mrkdwn?: boolean;           // 是否启用Markdown
    };
    
    discord?: {
      embeds?: any[];             // Discord嵌入
      components?: any[];         // Discord组件
      tts?: boolean;              // 文本转语音
      allowed_mentions?: any;     // 允许的提及
    };
    
    telegram?: {
      parse_mode?: string;        // 解析模式（Markdown/HTML）
      disable_web_page_preview?: boolean; // 禁用网页预览
      disable_notification?: boolean;     // 禁用通知
      reply_to_message_id?: number;       // 回复消息ID
    };
  };
  
  // 安全选项
  security?: {
    encrypt?: boolean;            // 是否加密
    sign?: boolean;               // 是否签名
    ttl?: number;                 // 消息生存时间（毫秒）
  };
  
  // 追踪信息
  tracking?: {
    sourceMessageId?: string;     // 源消息ID（用于回复）
    correlationId?: string;       // 关联ID
    deliveryReportRequired?: boolean; // 是否需要投递报告
  };
}

/**
 * 消息处理结果
 * 宪法依据：§101同步公理，处理结果标准化
 */
export interface MessageResult {
  success: boolean;               // 是否成功
  messageId: string;              // 消息ID（与OutgoingMessage.id相同）
  platformMessageId?: string;     // 平台消息ID（平台返回的ID）
  
  // 状态信息
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'pending';
  timestamp: number;              // 结果时间戳
  
  // 错误信息
  error?: {
    code: string;                 // 错误代码
    message: string;              // 错误描述
    details?: any;                // 错误详情
    retryable?: boolean;          // 是否可重试
  };
  
  // 性能指标
  metrics?: {
    processingTimeMs: number;     // 处理时间（毫秒）
    queueTimeMs?: number;         // 队列等待时间（毫秒）
    deliveryTimeMs?: number;      // 投递时间（毫秒）
    totalTimeMs: number;          // 总时间（毫秒）
  };
  
  // 宪法合规验证结果
  compliance?: {
    checked: boolean;             // 是否检查
    violations?: string[];        // 违规列表
    complianceScore: number;      // 合规评分
  };
}

/**
 * 通道状态接口
 * 宪法依据：§110协作效率公理，通道状态监控
 */
export interface ChannelStatus {
  platform: PlatformType;         // 平台类型
  channelId: string;              // 通道ID
  status: 'connected' | 'connecting' | 'disconnected' | 'error'; // 连接状态
  lastActivity: number;           // 最后活动时间
  
  // 连接统计
  stats?: {
    messagesSent: number;         // 已发送消息数
    messagesReceived: number;     // 已接收消息数
    errors: number;               // 错误数
    avgProcessingTimeMs: number;  // 平均处理时间
    uptime: number;               // 运行时间（秒）
  };
  
  // 错误信息
  error?: {
    code: string;                 // 错误代码
    message: string;              // 错误描述
    timestamp: number;            // 错误发生时间
    recoveryAttempts?: number;    // 恢复尝试次数
  };
  
  // 宪法合规状态
  constitutionalCompliance?: {
    lastCheck: number;            // 最后检查时间
    score: number;                // 合规评分
    issues?: string[];            // 合规问题列表
  };
}

/**
 * 消息标准化配置
 * 宪法依据：§152单一真理源，统一定义标准化规则
 */
export interface MessageNormalizationConfig {
  // 文本处理
  maxTextLength: number;          // 最大文本长度
  stripHtml: boolean;             // 是否去除HTML
  normalizeWhitespace: boolean;   // 是否标准化空白字符
  
  // 附件处理
  maxAttachments: number;         // 最大附件数
  allowedMimeTypes: string[];     // 允许的MIME类型
  maxFileSize: number;            // 最大文件大小（字节）
  
  // 安全处理
  sanitizeInput: boolean;         // 是否清理输入（防XSS）
  validateUrls: boolean;          // 是否验证URL
  blockInjectionPatterns: boolean; // 是否阻止注入模式
  
  // 平台特定处理规则
  platformRules?: Partial<Record<PlatformType, {
    maxTextLength?: number;       // 平台特定最大长度
    supportedAttachments?: string[]; // 支持的附件类型
    requiredFields?: string[];    // 必填字段
  }>>;
}

/**
 * 创建统一消息的默认配置
 * 宪法依据：§102熵减原则，复用标准配置
 */
export function createDefaultNormalizationConfig(): MessageNormalizationConfig {
  return {
    maxTextLength: 4000,
    stripHtml: true,
    normalizeWhitespace: true,
    
    maxAttachments: 10,
    allowedMimeTypes: [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm',
      'audio/mpeg', 'audio/wav', 'audio/ogg',
      'application/pdf', 'application/zip', 'text/plain'
    ],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    
    sanitizeInput: true,
    validateUrls: true,
    blockInjectionPatterns: true,
    
    platformRules: {
      slack: {
        maxTextLength: 40000,     // Slack支持更长文本
        supportedAttachments: ['image', 'video', 'audio', 'file']
      },
      discord: {
        maxTextLength: 2000,      // Discord消息限制
        supportedAttachments: ['image', 'video', 'audio', 'file']
      },
      telegram: {
        maxTextLength: 4096,      // Telegram消息限制
        supportedAttachments: ['image', 'video', 'audio', 'file', 'document']
      }
    }
  };
}

/**
 * 验证消息是否符合宪法合规要求
 * 宪法依据：§107通信安全、§101同步公理
 * 
 * @param message 待验证的消息
 * @returns 验证结果
 */
export function validateConstitutionalCompliance(message: UnifiedMessage): {
  isValid: boolean;
  violations: string[];
  score: number;
} {
  const violations: string[] = [];
  let score = 100; // 初始满分
  
  // §107 通信安全检查
  if (!message.constitutionalValidation?.hasValidSignature) {
    violations.push('§107: 消息缺少有效签名');
    score -= 20;
  }
  
  if (!message.constitutionalValidation?.integrityVerified) {
    violations.push('§107: 消息完整性未验证');
    score -= 20;
  }
  
  // §101 同步公理检查
  if (!message.id || !message.timestamp) {
    violations.push('§101: 消息缺少必需标识符或时间戳');
    score -= 15;
  }
  
  // §110 协作效率检查
  if (message.priority === undefined) {
    violations.push('§110: 消息缺少优先级设置');
    score -= 10;
  }
  
  // §152 单一真理源检查
  if (!message.platform || !message.channelId || !message.userId) {
    violations.push('§152: 消息缺少平台、通道或用户标识');
    score -= 15;
  }
  
  // 安全检查
  if (message.text.length > 10000) {
    violations.push('安全: 消息文本过长');
    score -= 10;
  }
  
  // 计算最终分数（不低于0）
  const finalScore = Math.max(0, score);
  
  return {
    isValid: violations.length === 0,
    violations,
    score: finalScore
  };
}

/**
 * 生成消息宪法合规报告
 * 宪法依据：§101同步公理，提供详细合规报告
 */
export function generateConstitutionalReport(message: UnifiedMessage): {
  messageId: string;
  timestamp: number;
  validation: ReturnType<typeof validateConstitutionalCompliance>;
  recommendations: string[];
} {
  const validation = validateConstitutionalCompliance(message);
  
  const recommendations: string[] = [];
  
  if (!validation.isValid) {
    recommendations.push('立即修正上述宪法合规违规项');
  }
  
  if (validation.score < 80) {
    recommendations.push('消息宪法合规评分较低，建议加强安全措施');
  }
  
  if (!message.constitutionalValidation?.isEncrypted) {
    recommendations.push('建议启用消息加密（§107通信安全）');
  }
  
  return {
    messageId: message.id,
    timestamp: Date.now(),
    validation,
    recommendations
  };
}

