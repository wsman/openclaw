/**
 * 🚀 策略规则定义
 *
 * 定义默认策略规则，实现认证、授权、速率限制等。
 *
 * @constitution
 * §101 同步公理：策略规则需与业务需求同步
 * §102 熵减原则：集中维护规则定义
 * §152 单一真理源公理：此文件为策略规则唯一定义
 *
 * @filename policy-rules.ts
 * @version 1.0.0
 * @category gateway/openclaw-decision
 * @last_updated 2026-03-02
 */

import { DecisionAction, DecisionErrorCode } from '../contracts/decision-contract';

// ============================================================================
// 规则上下文
// ============================================================================

/**
 * 策略规则评估上下文
 */
export interface PolicyRuleContext {
  /** RPC 方法名 */
  method: string;
  /** 请求参数 */
  params: Record<string, unknown>;
  /** 传输协议 */
  transport: 'ws' | 'http';
  /** 认证元信息 */
  authMeta?: {
    userId?: string;
    sessionId?: string;
    deviceId?: string;
    authType?: 'jwt' | 'api_key' | 'session' | 'anonymous';
    roles?: string[];
    rawHeaders?: Record<string, string>;
  };
  /** 权限范围 */
  scopes?: string[];
  /** 来源 IP */
  sourceIp?: string;
  /** 请求头 */
  headers?: Record<string, string>;
  /** 请求路径（HTTP） */
  path?: string;
  /** HTTP 方法 */
  httpMethod?: string;
  /** 请求时间戳 */
  ts: string;
}

// ============================================================================
// 规则动作结果
// ============================================================================

/**
 * 规则动作结果
 */
export interface PolicyRuleAction {
  /** 决策动作 */
  action: DecisionAction;
  /** 改写方法 */
  rewriteMethod?: string;
  /** 改写参数 */
  rewriteParams?: Record<string, unknown>;
  /** 原因 */
  reason?: string;
  /** 错误码 */
  errorCode?: DecisionErrorCode;
  /** 错误详情 */
  errorDetail?: Record<string, unknown>;
}

// ============================================================================
// 策略规则
// ============================================================================

/**
 * 策略规则定义
 */
export interface PolicyRule {
  /** 规则 ID */
  id: string;
  /** 规则名称 */
  name: string;
  /** 规则描述 */
  description?: string;
  /** 优先级（数字越大优先级越高） */
  priority: number;
  /** 是否启用 */
  enabled: boolean;
  /** 规则分类 */
  category: string;
  /** 严重级别 */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** 匹配函数 */
  match: (context: PolicyRuleContext) => boolean;
  /** 动作函数 */
  action: (context: PolicyRuleContext) => PolicyRuleAction;
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 检查是否已认证
 */
function isAuthenticated(context: PolicyRuleContext): boolean {
  return !!context.authMeta?.userId && context.authMeta?.authType !== 'anonymous';
}

/**
 * 检查是否具有角色
 */
function hasRole(context: PolicyRuleContext, role: string): boolean {
  return context.authMeta?.roles?.includes(role) ?? false;
}

/**
 * 检查是否具有权限范围
 */
function hasScope(context: PolicyRuleContext, scope: string): boolean {
  return context.scopes?.includes(scope) ?? false;
}

/**
 * 检查方法是否匹配
 */
function isMethod(context: PolicyRuleContext, ...methods: string[]): boolean {
  return methods.includes(context.method);
}

/**
 * 创建 EXECUTE 动作
 */
function executeAction(): PolicyRuleAction {
  return { action: 'EXECUTE' };
}

/**
 * 创建 REJECT 动作
 */
function rejectAction(
  errorCode: DecisionErrorCode,
  reason: string,
  detail?: Record<string, unknown>
): PolicyRuleAction {
  return {
    action: 'REJECT',
    errorCode,
    reason,
    errorDetail: detail,
  };
}

/**
 * 创建 REWRITE 动作
 */
function rewriteAction(
  method: string,
  params: Record<string, unknown>,
  reason: string
): PolicyRuleAction {
  return {
    action: 'REWRITE',
    rewriteMethod: method,
    rewriteParams: params,
    reason,
  };
}

// ============================================================================
// 默认规则
// ============================================================================

/**
 * 默认策略规则列表
 */
export const DEFAULT_RULES: PolicyRule[] = [
  // -----------------------------------------------------
  // 认证规则
  // -----------------------------------------------------
  {
    id: 'auth.required',
    name: '认证必需',
    description: '敏感操作需要认证',
    priority: 1000,
    enabled: true,
    category: 'authentication',
    severity: 'high',
    match: (ctx) => {
      // 需要认证的方法列表
      const authRequiredMethods = [
        'agent.execute',
        'agent.stop',
        'config.update',
        'room.create',
        'room.destroy',
        'plugin.install',
        'plugin.uninstall',
      ];
      return authRequiredMethods.includes(ctx.method) && !isAuthenticated(ctx);
    },
    action: () => rejectAction('AUTH_REQUIRED', 'Authentication required for this operation'),
  },

  // -----------------------------------------------------
  // 角色规则
  // -----------------------------------------------------
  {
    id: 'role.admin',
    name: '管理员角色',
    description: '管理操作需要管理员角色',
    priority: 900,
    enabled: true,
    category: 'authorization',
    severity: 'high',
    match: (ctx) => {
      const adminMethods = [
        'config.update',
        'system.restart',
        'plugin.install',
        'plugin.uninstall',
        'user.delete',
      ];
      return adminMethods.includes(ctx.method) && isAuthenticated(ctx) && !hasRole(ctx, 'admin');
    },
    action: () => rejectAction('AUTH_INSUFFICIENT_SCOPE', 'Admin role required'),
  },

  // -----------------------------------------------------
  // 方法限制规则
  // -----------------------------------------------------
  {
    id: 'method.disabled',
    name: '方法禁用',
    description: '禁用的方法列表',
    priority: 950,
    enabled: true,
    category: 'method-control',
    severity: 'critical',
    match: (ctx) => {
      // 禁用的方法列表
      const disabledMethods = [
        'debug.dump',
        'internal.wipe',
        'dangerous.execute',
      ];
      return disabledMethods.includes(ctx.method);
    },
    action: (ctx) => rejectAction('METHOD_DISABLED', `Method ${ctx.method} is disabled`),
  },

  // -----------------------------------------------------
  // 匿名用户限制规则
  // -----------------------------------------------------
  {
    id: 'anonymous.restricted',
    name: '匿名用户限制',
    description: '限制匿名用户的访问',
    priority: 800,
    enabled: true,
    category: 'authorization',
    severity: 'medium',
    match: (ctx) => {
      if (ctx.authMeta?.authType !== 'anonymous') {
        return false;
      }
      // 匿名用户允许的方法
      const allowedForAnonymous = ['health', 'status', 'echo'];
      return !allowedForAnonymous.includes(ctx.method);
    },
    action: (ctx) => rejectAction('AUTH_REQUIRED', `Anonymous access not allowed for ${ctx.method}`),
  },

  // -----------------------------------------------------
  // 参数验证规则
  // -----------------------------------------------------
  {
    id: 'param.validation',
    name: '参数验证',
    description: '验证必需参数',
    priority: 700,
    enabled: true,
    category: 'validation',
    severity: 'medium',
    match: (ctx) => {
      // 检查特定方法的必需参数
      if (ctx.method === 'agent.execute' && !ctx.params.task) {
        return true;
      }
      if (ctx.method === 'room.join' && !ctx.params.roomId) {
        return true;
      }
      return false;
    },
    action: (ctx) => rejectAction('PARAM_MISSING', `Required parameter missing for ${ctx.method}`),
  },

  // -----------------------------------------------------
  // 方法重写规则（示例）
  // -----------------------------------------------------
  {
    id: 'rewrite.health',
    name: '健康检查重写',
    description: '将旧的健康检查方法重写到新方法',
    priority: 100,
    enabled: true,
    category: 'compatibility',
    severity: 'low',
    match: (ctx) => {
      return ctx.method === 'health.check';
    },
    action: (ctx) => rewriteAction('health', ctx.params, 'Method renamed from health.check to health'),
  },

  // -----------------------------------------------------
  // 速率限制规则（占位）
  // -----------------------------------------------------
  {
    id: 'rate.limit',
    name: '速率限制',
    description: '检查请求速率',
    priority: 600,
    enabled: false, // 默认禁用，需要外部状态
    category: 'rate-limiting',
    severity: 'medium',
    match: () => false, // 需要集成外部速率限制状态
    action: () => rejectAction('POLICY_RATE_LIMITED', 'Rate limit exceeded'),
  },

  // -----------------------------------------------------
  // 超时保护规则（占位）
  // -----------------------------------------------------
  {
    id: 'timeout.protection',
    name: '超时保护',
    description: '长时间运行操作保护',
    priority: 500,
    enabled: false, // 默认禁用
    category: 'protection',
    severity: 'low',
    match: () => false,
    action: () => rejectAction('POLICY_TIMEOUT', 'Operation timeout'),
  },
];

// ============================================================================
// 规则工厂函数
// ============================================================================

/**
 * 创建自定义规则
 */
export function createRule(
  id: string,
  name: string,
  options: {
    priority?: number;
    enabled?: boolean;
    category?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    description?: string;
    match: (context: PolicyRuleContext) => boolean;
    action: (context: PolicyRuleContext) => PolicyRuleAction;
  }
): PolicyRule {
  return {
    id,
    name,
    description: options.description,
    priority: options.priority ?? 100,
    enabled: options.enabled ?? true,
    category: options.category ?? 'custom',
    severity: options.severity ?? 'medium',
    match: options.match,
    action: options.action,
  };
}