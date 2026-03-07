/**
 * ⚖️ ConstitutionalGuard - 宪法合规守卫
 * 
 * @constitution
 * §101 同步公理：代码变更必须触发文档更新
 * §102 熵减原则：所有变更必须降低或维持系统熵值
 * §103 用户确认公理：关键操作必须用户确认
 * §106 Agent身份公理：每个Agent必须拥有唯一身份标识
 * §108 异构模型策略公理：多模型支持
 * §118 质量审计原则：自动化测试验证
 * §152 单一真理源公理：状态同步基于唯一数据源
 * 
 * @filename ConstitutionalGuard.ts
 * @version 1.0.0
 * @category services
 * @last_updated 2026-02-26
 * 
 * 功能：
 * - §101-§103核心公理验证
 * - §108异构模型策略检查
 * - §118长时间任务合规验证
 * - 降级+预检机制
 * - 宪法合规实时监控
 */

import { EventEmitter } from "events";
import { logger } from "../utils/logger";

/**
 * 宪法规则定义
 */
interface ConstitutionRule {
  id: string;
  section: string;
  description: string;
  severity: "error" | "warning" | "info";
  check: (context: ValidationContext) => Promise<RuleResult>;
  remediation?: string;
}

/**
 * 验证上下文
 */
interface ValidationContext {
  operation: string;
  agent?: {
    id: string;
    type: string;
    llmProvider?: string;
    llmModel?: string;
  };
  task?: {
    id: string;
    type: string;
    estimatedDuration?: number;
    data?: any;
  };
  user?: {
    id: string;
    role: string;
    authenticated: boolean;
  };
  metadata?: Record<string, any>;
}

/**
 * 规则检查结果
 */
interface RuleResult {
  passed: boolean;
  ruleId: string;
  message: string;
  details?: any;
  remediation?: string;
}

/**
 * 合规验证结果
 */
interface ComplianceResult {
  valid: boolean;
  ruleResults: RuleResult[];
  score: number; // 0-100
  timestamp: number;
  blockingIssues: string[];
  warnings: string[];
}

/**
 * 守卫配置
 */
interface GuardConfig {
  enableStrictMode: boolean;
  autoRemediation: boolean;
  logViolations: boolean;
  blockOnViolation: boolean;
  cooldownPeriod: number;
}

const DEFAULT_CONFIG: GuardConfig = {
  enableStrictMode: true,
  autoRemediation: false,
  logViolations: true,
  blockOnViolation: true,
  cooldownPeriod: 5000,
};

/**
 * ⚖️ ConstitutionalGuard - 宪法合规守卫
 * 实现宪法公理的实时验证和合规检查
 */
export class ConstitutionalGuard extends EventEmitter {
  private config: GuardConfig;
  private rules: Map<string, ConstitutionRule> = new Map();
  private violationHistory: Array<{ timestamp: number; context: ValidationContext; result: ComplianceResult }> = [];
  private lastViolationTime: number = 0;
  private cooldownActive: boolean = false;

  constructor(config?: Partial<GuardConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeRules();
    logger.info("[ConstitutionalGuard] 宪法合规守卫初始化完成");
  }

  /**
   * 初始化宪法规则
   */
  private initializeRules() {
    // §101 同步公理
    this.rules.set("§101", {
      id: "§101",
      section: "同步公理",
      description: "代码变更必须触发文档更新",
      severity: "error",
      check: async (ctx) => {
        if (ctx.operation === "code_change" || ctx.operation === "file_modify") {
          const hasDocUpdate = ctx.metadata?.documentSynced === true;
          return {
            passed: hasDocUpdate,
            ruleId: "§101",
            message: hasDocUpdate ? "文档已同步" : "代码变更未触发文档更新",
            remediation: "请在修改代码后更新相关文档",
          };
        }
        return { passed: true, ruleId: "§101", message: "操作不涉及代码变更" };
      },
    });

    // §102 熵减原则
    this.rules.set("§102", {
      id: "§102",
      section: "熵减原则",
      description: "所有变更必须降低或维持系统熵值",
      severity: "error",
      check: async (ctx) => {
        const entropyDelta = ctx.metadata?.entropyDelta ?? 0;
        const passed = entropyDelta <= 0;
        return {
          passed,
          ruleId: "§102",
          message: passed 
            ? `熵值变化符合原则: ΔH = ${entropyDelta}` 
            : `熵值增加违反原则: ΔH = ${entropyDelta}`,
          details: { entropyDelta },
          remediation: "请重构代码以降低系统复杂度",
        };
      },
    });

    // §103 用户确认公理
    this.rules.set("§103", {
      id: "§103",
      section: "用户确认公理",
      description: "关键操作必须用户确认",
      severity: "error",
      check: async (ctx) => {
        const criticalOps = ["delete", "irreversible_change", "system_config", "agent_terminate"];
        if (criticalOps.includes(ctx.operation)) {
          const confirmed = ctx.metadata?.userConfirmed === true;
          return {
            passed: confirmed,
            ruleId: "§103",
            message: confirmed ? "用户已确认关键操作" : "关键操作缺少用户确认",
            remediation: "请获取用户确认后再执行",
          };
        }
        return { passed: true, ruleId: "§103", message: "非关键操作" };
      },
    });

    // §106 Agent身份公理
    this.rules.set("§106", {
      id: "§106",
      section: "Agent身份公理",
      description: "每个Agent必须拥有唯一身份标识和明确职责",
      severity: "error",
      check: async (ctx) => {
        if (ctx.agent) {
          const hasValidId = !!(ctx.agent.id && ctx.agent.id.startsWith("agent:"));
          const hasType = !!ctx.agent.type;
          const passed = hasValidId && hasType;
          return {
            passed,
            ruleId: "§106",
            message: passed 
              ? `Agent身份验证通过: ${ctx.agent.id}` 
              : "Agent身份验证失败",
            details: { agentId: ctx.agent.id, agentType: ctx.agent.type },
            remediation: "请确保Agent具有有效的ID（格式: agent:xxx）和类型",
          };
        }
        return { passed: true, ruleId: "§106", message: "无Agent参与" };
      },
    });

    // §108 异构模型策略公理
    this.rules.set("§108", {
      id: "§108",
      section: "异构模型策略",
      description: "支持多LLM提供商，避免供应商锁定",
      severity: "warning",
      check: async (ctx) => {
        if (ctx.agent?.llmProvider) {
          const validProviders = ["openai", "claude", "deepseek", "local", "simulated", "custom"];
          const isValid = validProviders.includes(ctx.agent.llmProvider);
          return {
            passed: isValid,
            ruleId: "§108",
            message: isValid 
              ? `LLM提供商有效: ${ctx.agent.llmProvider}` 
              : `未知的LLM提供商: ${ctx.agent.llmProvider}`,
            details: { provider: ctx.agent.llmProvider },
            remediation: "请使用支持的LLM提供商",
          };
        }
        return { passed: true, ruleId: "§108", message: "未使用LLM" };
      },
    });

    // §118 质量审计原则（长时间任务）
    this.rules.set("§118", {
      id: "§118",
      section: "质量审计原则",
      description: "长时间任务需有进度检查点",
      severity: "warning",
      check: async (ctx) => {
        if (ctx.task?.estimatedDuration && ctx.task.estimatedDuration > 60000) {
          const hasCheckpoints = ctx.metadata?.checkpoints?.length > 0;
          return {
            passed: hasCheckpoints,
            ruleId: "§118",
            message: hasCheckpoints 
              ? "长时间任务已设置检查点" 
              : "长时间任务缺少进度检查点",
            details: { estimatedDuration: ctx.task.estimatedDuration },
            remediation: "请为长时间任务设置进度检查点",
          };
        }
        return { passed: true, ruleId: "§118", message: "非长时间任务" };
      },
    });

    // §152 单一真理源公理
    this.rules.set("§152", {
      id: "§152",
      section: "单一真理源",
      description: "状态同步必须基于唯一数据源",
      severity: "error",
      check: async (ctx) => {
        if (ctx.operation === "state_update" || ctx.operation === "sync") {
          const hasSource = ctx.metadata?.truthSource !== undefined;
          return {
            passed: hasSource,
            ruleId: "§152",
            message: hasSource 
              ? `状态源: ${ctx.metadata?.truthSource}` 
              : "状态更新缺少真理源标识",
            remediation: "请指定状态的真理源",
          };
        }
        return { passed: true, ruleId: "§152", message: "无状态同步" };
      },
    });

    logger.info(`[ConstitutionalGuard] 已加载 ${this.rules.size} 条宪法规则`);
  }

  /**
   * 执行合规验证
   */
  public async validate(context: ValidationContext): Promise<ComplianceResult> {
    const ruleResults: RuleResult[] = [];
    const blockingIssues: string[] = [];
    const warnings: string[] = [];
    
    // 检查冷却期
    if (this.cooldownActive) {
      logger.warn("[ConstitutionalGuard] 冷却期中，跳过验证");
      return {
        valid: false,
        ruleResults: [],
        score: 0,
        timestamp: Date.now(),
        blockingIssues: ["系统冷却期中"],
        warnings: [],
      };
    }
    
    // 执行所有规则检查
    for (const [ruleId, rule] of this.rules) {
      try {
        const result = await rule.check(context);
        ruleResults.push(result);
        
        if (!result.passed) {
          if (rule.severity === "error") {
            blockingIssues.push(`${ruleId}: ${result.message}`);
          } else {
            warnings.push(`${ruleId}: ${result.message}`);
          }
        }
      } catch (error: any) {
        logger.error(`[ConstitutionalGuard] 规则 ${ruleId} 检查失败: ${error.message}`);
        ruleResults.push({
          passed: false,
          ruleId,
          message: `规则检查异常: ${error.message}`,
        });
      }
    }
    
    // 计算合规分数
    const passedCount = ruleResults.filter(r => r.passed).length;
    const score = Math.round((passedCount / ruleResults.length) * 100);
    
    // 确定是否有效
    const valid = blockingIssues.length === 0;
    
    const result: ComplianceResult = {
      valid,
      ruleResults,
      score,
      timestamp: Date.now(),
      blockingIssues,
      warnings,
    };
    
    // 记录违规
    if (!valid || warnings.length > 0) {
      this.recordViolation(context, result);
    }
    
    // 触发冷却期
    if (!valid && this.config.blockOnViolation) {
      this.activateCooldown();
    }
    
    // 触发事件
    if (!valid) {
      this.emit("violation", { context, result });
    } else {
      this.emit("validated", { context, result });
    }
    
    return result;
  }

  /**
   * 预检（简化版验证，用于快速检查）
   */
  public async preCheck(operation: string, agentId?: string): Promise<boolean> {
    // 检查冷却期
    if (this.cooldownActive) {
      return false;
    }
    
    // 简单规则检查
    if (operation === "agent_spawn" && agentId) {
      return agentId.startsWith("agent:");
    }
    
    return true;
  }

  /**
   * 降级检查（在系统压力下执行简化验证）
   */
  public async degradedCheck(context: ValidationContext): Promise<boolean> {
    // 只检查error级别的规则
    for (const [ruleId, rule] of this.rules) {
      if (rule.severity === "error") {
        try {
          const result = await rule.check(context);
          if (!result.passed) {
            return false;
          }
        } catch {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * 记录违规
   */
  private recordViolation(context: ValidationContext, result: ComplianceResult) {
    this.violationHistory.push({
      timestamp: Date.now(),
      context,
      result,
    });
    
    // 限制历史长度
    if (this.violationHistory.length > 100) {
      this.violationHistory.shift();
    }
    
    this.lastViolationTime = Date.now();
    
    if (this.config.logViolations) {
      logger.warn(`[ConstitutionalGuard] 宪法违规记录: ${JSON.stringify({
        operation: context.operation,
        score: result.score,
        issues: result.blockingIssues,
      })}`);
    }
  }

  /**
   * 激活冷却期
   */
  private activateCooldown() {
    this.cooldownActive = true;
    setTimeout(() => {
      this.cooldownActive = false;
      this.emit("cooldown_ended");
    }, this.config.cooldownPeriod);
  }

  /**
   * 获取规则列表
   */
  public getRules(): ConstitutionRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 添加自定义规则
   */
  public addRule(rule: ConstitutionRule): void {
    this.rules.set(rule.id, rule);
    logger.info(`[ConstitutionalGuard] 添加规则: ${rule.id}`);
  }

  /**
   * 移除规则
   */
  public removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      logger.info(`[ConstitutionalGuard] 移除规则: ${ruleId}`);
    }
    return removed;
  }

  /**
   * 获取违规历史
   */
  public getViolationHistory(limit: number = 50) {
    return this.violationHistory.slice(-limit);
  }

  /**
   * 获取合规统计
   */
  public getStats() {
    const totalChecks = this.violationHistory.length;
    const violations = this.violationHistory.filter(v => !v.result.valid).length;
    
    return {
      totalChecks,
      violations,
      passRate: totalChecks > 0 ? ((totalChecks - violations) / totalChecks) * 100 : 100,
      rulesCount: this.rules.size,
      cooldownActive: this.cooldownActive,
      lastViolationTime: this.lastViolationTime,
    };
  }

  /**
   * 重置守卫状态
   */
  public reset(): void {
    this.violationHistory = [];
    this.cooldownActive = false;
    this.lastViolationTime = 0;
    logger.info("[ConstitutionalGuard] 守卫状态已重置");
  }
}

export default ConstitutionalGuard;