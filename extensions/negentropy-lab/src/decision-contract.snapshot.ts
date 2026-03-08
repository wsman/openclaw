/**
 * AUTO-GENERATED FILE — DO NOT HAND-EDIT.
 *
 * Canonical source:
 *   vendor/negentropy-lab/server/gateway/openclaw-decision/contracts/decision-contract.ts
 *
 * Sync command:
 *   node extensions/negentropy-lab/scripts/sync-decision-contract-snapshot.mjs
 */

/**
 * 🚀 OpenClaw -> Negentropy 决策合同 v1
 *
 * 定义 OpenClaw 网关请求拦截到 Negentropy 决策服务的请求/响应合同。
 *
 * @constitution
 * §101 同步公理：决策合同变更需与 OpenClaw 桥接层同步
 * §102 熵减原则：集中维护决策类型，避免多源漂移
 * §152 单一真理源公理：此文件为决策协议唯一定义
 * §109 ToolCallBridge标准化架构公理：决策接口遵循标准化桥接规范
 *
 * @filename decision-contract.ts
 * @version 1.0.0
 * @category gateway/openclaw-decision
 * @last_updated 2026-03-02
 */

// ============================================================================
// 决策动作类型
// ============================================================================

/**
 * 决策动作枚举
 * - EXECUTE: 按原方法执行
 * - REWRITE: 按改写后的 method/params 执行
 * - REJECT: 直接返回错误，不进入执行
 */
export type DecisionAction = 'EXECUTE' | 'REWRITE' | 'REJECT';

export const DECISION_ACTIONS: readonly DecisionAction[] = [
  'EXECUTE',
  'REWRITE',
  'REJECT',
] as const;

// ============================================================================
// 传输类型
// ============================================================================

/**
 * 传输协议类型
 */
export type TransportType = 'ws' | 'http';

// ============================================================================
// 认证元数据
// ============================================================================

/**
 * 认证元数据
 */
export interface AuthMeta {
  /** 用户ID */
  userId?: string;
  /** 会话ID */
  sessionId?: string;
  /** 设备ID */
  deviceId?: string;
  /** 认证类型 */
  authType?: 'jwt' | 'api_key' | 'session' | 'anonymous';
  /** 角色列表 */
  roles?: string[];
  /** 原始认证头 */
  rawHeaders?: Record<string, string>;
}

// ============================================================================
// 决策请求
// ============================================================================

/**
 * 决策请求接口
 * OpenClaw 发送给 Negentropy 的决策请求
 */
export interface DecisionRequest {
  /** 追踪ID（用于链路追踪） */
  traceId: string;

  /** 连接ID（WebSocket 连接标识） */
  connId?: string;

  /** 传输协议类型 */
  transport: TransportType;

  /** 请求方法名 */
  method: string;

  /** 请求参数 */
  params: Record<string, unknown>;

  /** 认证元数据 */
  authMeta?: AuthMeta;

  /** 权限范围 */
  scopes?: string[];

  /** 请求时间戳（ISO 8601） */
  ts: string;

  /** 请求来源 IP */
  sourceIp?: string;

  /** 请求头 */
  headers?: Record<string, string>;

  /** 请求路径（HTTP 专用） */
  path?: string;

  /** 请求 HTTP 方法（HTTP 专用） */
  httpMethod?: string;
}

// ============================================================================
// 决策响应
// ============================================================================

/**
 * 策略标签
 */
export interface PolicyTags {
  /** 命中的规则ID列表 */
  ruleIds?: string[];
  /** 策略分类 */
  category?: string;
  /** 策略严重级别 */
  severity?: 'low' | 'medium' | 'high' | 'critical';
  /** 自定义标签 */
  custom?: Record<string, unknown>;
}

/**
 * 决策响应接口
 * Negentropy 返回给 OpenClaw 的决策结果
 */
export interface DecisionResponse {
  /** 决策动作 */
  action: DecisionAction;

  /** 改写后的方法（仅 REWRITE 时有效） */
  method?: string;

  /** 改写后的参数（仅 REWRITE 时有效） */
  params?: Record<string, unknown>;

  /** 决策原因（人类可读） */
  reason?: string;

  /** 策略标签 */
  policyTags?: PolicyTags;

  /** 决策有效期（毫秒） */
  ttlMs?: number;

  /** 追踪ID（回显请求的 traceId） */
  traceId: string;

  /** 决策时间戳（ISO 8601） */
  ts: string;

  /** 错误码（仅 REJECT 时有效） */
  errorCode?: string;

  /** 错误详情（仅 REJECT 时有效） */
  errorDetail?: Record<string, unknown>;

  /** 建议重试延迟（毫秒） */
  retryAfterMs?: number;
}

// ============================================================================
// 错误码定义
// ============================================================================

/**
 * 决策错误码
 */
export const DECISION_ERROR_CODES = {
  // 策略相关
  POLICY_DENY: 'POLICY_DENY',
  POLICY_TIMEOUT: 'POLICY_TIMEOUT',
  POLICY_RATE_LIMITED: 'POLICY_RATE_LIMITED',

  // 认证相关
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  AUTH_INSUFFICIENT_SCOPE: 'AUTH_INSUFFICIENT_SCOPE',

  // 方法相关
  METHOD_UNKNOWN: 'METHOD_UNKNOWN',
  METHOD_DISABLED: 'METHOD_DISABLED',
  METHOD_RESTRICTED: 'METHOD_RESTRICTED',

  // 参数相关
  PARAM_INVALID: 'PARAM_INVALID',
  PARAM_MISSING: 'PARAM_MISSING',
  INVALID_PARAMS: 'INVALID_PARAMS',

  // 系统相关
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
} as const;

export type DecisionErrorCode = (typeof DECISION_ERROR_CODES)[keyof typeof DECISION_ERROR_CODES];

// ============================================================================
// 运行模式
// ============================================================================

/**
 * 决策服务运行模式
 * - OFF: 关闭拦截，走原链路
 * - SHADOW: 决策只观测不阻断
 * - ENFORCE: 决策生效
 */
export type DecisionMode = 'OFF' | 'SHADOW' | 'ENFORCE';

export const DECISION_MODES: readonly DecisionMode[] = [
  'OFF',
  'SHADOW',
  'ENFORCE',
] as const;

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 验证决策动作是否有效
 */
export function isValidDecisionAction(action: unknown): action is DecisionAction {
  return typeof action === 'string' && DECISION_ACTIONS.includes(action as DecisionAction);
}

/**
 * 验证运行模式是否有效
 */
export function isValidDecisionMode(mode: unknown): mode is DecisionMode {
  return typeof mode === 'string' && DECISION_MODES.includes(mode as DecisionMode);
}

/**
 * 创建默认决策请求
 */
export function createDefaultDecisionRequest(
  method: string,
  params: Record<string, unknown>,
  transport: TransportType = 'ws'
): DecisionRequest {
  return {
    traceId: generateTraceId(),
    transport,
    method,
    params,
    ts: new Date().toISOString(),
  };
}

/**
 * 创建 EXECUTE 决策响应
 */
export function createExecuteResponse(traceId: string): DecisionResponse {
  return {
    action: 'EXECUTE',
    traceId,
    ts: new Date().toISOString(),
  };
}

/**
 * 创建 REWRITE 决策响应
 */
export function createRewriteResponse(
  traceId: string,
  method: string,
  params: Record<string, unknown>,
  reason?: string
): DecisionResponse {
  return {
    action: 'REWRITE',
    method,
    params,
    reason,
    traceId,
    ts: new Date().toISOString(),
  };
}

/**
 * 创建 REJECT 决策响应
 */
export function createRejectResponse(
  traceId: string,
  errorCode: DecisionErrorCode,
  reason?: string,
  errorDetail?: Record<string, unknown>
): DecisionResponse {
  return {
    action: 'REJECT',
    errorCode,
    reason,
    errorDetail,
    traceId,
    ts: new Date().toISOString(),
  };
}

/**
 * 生成追踪ID
 */
export function generateTraceId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `dec-${timestamp}-${random}`;
}

// ============================================================================
// 合同版本
// ============================================================================

export const DECISION_CONTRACT_VERSION = '1.0.0';
export const DECISION_CONTRACT_DATE = '2026-03-02';
