/**
 * 宪法规则引擎
 * 
 * @module constitution/engine
 */

import { logger } from '../utils/logger.js';

// 规则定义
export interface ConstitutionRule {
  id: string;
  article: string;
  name: string;
  description: string;
  severity: 'minor' | 'major' | 'critical';
  enabled: boolean;
  validator: (context: RuleContext) => RuleResult;
}

// 规则上下文
export interface RuleContext {
  command?: string;
  commandType?: string;
  source?: string;
  agent?: any;
  task?: any;
  metadata?: Record<string, any>;
}

// 规则结果
export interface RuleResult {
  passed: boolean;
  message?: string;
  details?: any;
}

// 违规记录
export interface Violation {
  id: string;
  ruleId: string;
  article: string;
  command: string;
  commandType: string;
  reason: string;
  severity: 'minor' | 'major' | 'critical';
  timestamp: number;
  source: string;
  handled: boolean;
}

/**
 * 宪法引擎
 */
export class ConstitutionEngine {
  private rules: Map<string, ConstitutionRule> = new Map();
  private violations: Violation[] = [];

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * 初始化默认规则
   */
  private initializeDefaultRules(): void {
    // §101 单一真理源
    this.addRule({
      id: 'rule-101-1',
      article: '§101',
      name: '单一真理源',
      description: '所有数据必须通过Gateway访问',
      severity: 'major',
      enabled: true,
      validator: (ctx) => {
        if (ctx.source && !ctx.source.startsWith('gateway')) {
          return {
            passed: false,
            message: '数据源必须经过Gateway',
          };
        }
        return { passed: true };
      },
    });

    // §102 熵减原则
    this.addRule({
      id: 'rule-102-1',
      article: '§102',
      name: '熵减原则',
      description: '操作必须减少系统熵',
      severity: 'major',
      enabled: true,
      validator: (ctx) => {
        // 简化验证逻辑
        return { passed: true };
      },
    });

    // §103 同步公理
    this.addRule({
      id: 'rule-103-1',
      article: '§103',
      name: '同步公理',
      description: '状态变更必须同步到所有节点',
      severity: 'critical',
      enabled: true,
      validator: (ctx) => {
        return { passed: true };
      },
    });

    logger.info(`Initialized ${this.rules.size} constitution rules`);
  }

  /**
   * 添加规则
   */
  addRule(rule: ConstitutionRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * 获取所有规则
   */
  getRules(): ConstitutionRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 验证操作
   */
  validate(context: RuleContext): { passed: boolean; violations: Violation[] } {
    const violations: Violation[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      try {
        const result = rule.validator(context);
        
        if (!result.passed) {
          const violation: Violation = {
            id: `violation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ruleId: rule.id,
            article: rule.article,
            command: context.command || '',
            commandType: context.commandType || '',
            reason: result.message || `违反规则: ${rule.name}`,
            severity: rule.severity,
            timestamp: Date.now(),
            source: context.source || 'unknown',
            handled: false,
          };
          
          violations.push(violation);
          this.violations.push(violation);
          
          logger.warn(`Violation detected: ${rule.article} - ${result.message}`);
        }
      } catch (error) {
        logger.error(`Rule validation error for ${rule.id}:`, error);
      }
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }

  /**
   * 获取违规列表
   */
  getViolations(options?: { unhandledOnly?: boolean; limit?: number }): Violation[] {
    let result = this.violations;
    
    if (options?.unhandledOnly) {
      result = result.filter((v) => !v.handled);
    }
    
    if (options?.limit) {
      result = result.slice(0, options.limit);
    }
    
    return result;
  }

  /**
   * 处理违规
   */
  handleViolation(violationId: string, method: string): boolean {
    const violation = this.violations.find((v) => v.id === violationId);
    if (violation) {
      violation.handled = true;
      logger.info(`Violation ${violationId} handled with method: ${method}`);
      return true;
    }
    return false;
  }

  /**
   * 获取合规率
   */
  getComplianceRate(): number {
    if (this.violations.length === 0) return 100;
    
    const handled = this.violations.filter((v) => v.handled).length;
    return (handled / this.violations.length) * 100;
  }

  /**
   * 清除历史违规
   */
  clearHistory(): void {
    this.violations = this.violations.filter((v) => !v.handled);
  }
}

// 全局实例
export const constitutionEngine = new ConstitutionEngine();
