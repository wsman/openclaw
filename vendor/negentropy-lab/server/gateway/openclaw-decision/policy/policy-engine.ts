/**
 * 🚀 策略引擎
 *
 * 实现 EXECUTE/REWRITE/REJECT 决策逻辑。
 *
 * @constitution
 * §101 同步公理：策略引擎需与决策服务同步
 * §102 熵减原则：集中维护策略规则
 * §152 单一真理源公理：此文件为策略引擎唯一定义
 *
 * @filename policy-engine.ts
 * @version 1.0.0
 * @category gateway/openclaw-decision
 * @last_updated 2026-03-02
 */

import { DecisionRequest, DecisionAction, DecisionErrorCode } from '../contracts/decision-contract';
import type { PolicyRule, PolicyRuleContext } from './policy-rules';
import { DEFAULT_RULES } from './policy-rules';

// 重新导出 DEFAULT_RULES 供外部使用
export { DEFAULT_RULES } from './policy-rules';

// ============================================================================
// 策略结果
// ============================================================================

/**
 * 策略评估结果
 */
export interface PolicyResult {
  /** 决策动作 */
  action: DecisionAction;
  /** 改写后的方法（REWRITE 时使用） */
  rewriteMethod?: string;
  /** 改写后的参数（REWRITE 时使用） */
  rewriteParams?: Record<string, unknown>;
  /** 原因说明 */
  reason?: string;
  /** 错误码（REJECT 时使用） */
  errorCode?: DecisionErrorCode;
  /** 错误详情（REJECT 时使用） */
  errorDetail?: Record<string, unknown>;
  /** 命中的规则 ID 列表 */
  ruleIds: string[];
  /** 策略分类 */
  category?: string;
  /** 严重级别 */
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================================================
// 策略引擎配置
// ============================================================================

export interface PolicyEngineConfig {
  /** 规则列表 */
  rules: PolicyRule[];
  /** 默认动作（当无规则匹配时） */
  defaultAction: DecisionAction;
  /** 是否启用规则热更新 */
  enableHotReload: boolean;
}

const DEFAULT_CONFIG: PolicyEngineConfig = {
  rules: DEFAULT_RULES,
  defaultAction: 'EXECUTE',
  enableHotReload: false,
};

// ============================================================================
// 策略引擎类
// ============================================================================

/**
 * 策略引擎
 */
export class PolicyEngine {
  private config: PolicyEngineConfig;
  private rules: PolicyRule[];

  constructor(config: Partial<PolicyEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.rules = [...this.config.rules];
    this.sortRules();
  }

  /**
   * 评估请求
   */
  async evaluate(request: DecisionRequest): Promise<PolicyResult> {
    const context = this.createContext(request);
    const matchedRules: PolicyRule[] = [];

    // 遍历规则
    for (const rule of this.rules) {
      if (this.matchRule(rule, context)) {
        matchedRules.push(rule);
        
        // 根据优先级处理
        const action = rule.action(context);
        
        // 如果是 REJECT，立即返回
        if (action.action === 'REJECT') {
          return {
            ...action,
            ruleIds: [rule.id],
            category: rule.category,
            severity: rule.severity,
          };
        }
        
        // 如果是 REWRITE，记录并继续检查更高优先级的 REJECT
        if (action.action === 'REWRITE') {
          // 检查是否有更高优先级的 REJECT
          const hasReject = matchedRules.some(
            r => r.id !== rule.id && r.priority > rule.priority && r.action(context).action === 'REJECT'
          );
          
          if (!hasReject) {
            return {
              ...action,
              ruleIds: [rule.id],
              category: rule.category,
              severity: rule.severity,
            };
          }
        }
      }
    }

    // 没有匹配规则，返回默认动作
    return {
      action: this.config.defaultAction,
      ruleIds: matchedRules.map(r => r.id),
    };
  }

  /**
   * 创建规则上下文
   */
  private createContext(request: DecisionRequest): PolicyRuleContext {
    return {
      method: request.method,
      params: request.params,
      transport: request.transport,
      authMeta: request.authMeta,
      scopes: request.scopes,
      sourceIp: request.sourceIp,
      headers: request.headers,
      path: request.path,
      httpMethod: request.httpMethod,
      ts: request.ts,
    };
  }

  /**
   * 匹配规则
   */
  private matchRule(rule: PolicyRule, context: PolicyRuleContext): boolean {
    if (!rule.enabled) {
      return false;
    }
    
    return rule.match(context);
  }

  /**
   * 排序规则（按优先级降序）
   */
  private sortRules(): void {
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * 添加规则
   */
  addRule(rule: PolicyRule): void {
    this.rules.push(rule);
    this.sortRules();
  }

  /**
   * 移除规则
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index >= 0) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * 获取所有规则
   */
  getRules(): PolicyRule[] {
    return [...this.rules];
  }

  /**
   * 重新加载规则
   */
  reloadRules(rules: PolicyRule[]): void {
    this.rules = [...rules];
    this.sortRules();
  }
}