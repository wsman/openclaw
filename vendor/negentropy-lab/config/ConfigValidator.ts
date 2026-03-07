/**
 * 配置验证工具
 * 版本: 1.0.0
 * 
 * 功能:
 * - 配置完整性验证
 * - 配置冲突检测
 * - 配置兼容性检查
 * - 配置质量评分
 */

import {
  AgentConfigTemplate,
  AgentConfigTemplateManager,
  ValidationResult,
  TaskComplexity,
} from './AgentConfigTemplateManager';

// ============================================================================
// 配置验证器
// ============================================================================

export class ConfigValidator {
  private templateManager: AgentConfigTemplateManager;
  private validationRules: Map<string, ValidationRuleSet>;

  constructor(templateManager?: AgentConfigTemplateManager) {
    this.templateManager = templateManager || new AgentConfigTemplateManager();
    this.validationRules = new Map();
    this.initializeValidationRules();
  }

  /**
   * 初始化验证规则
   */
  private initializeValidationRules(): void {
    // L1任务验证规则
    this.validationRules.set('L1', {
      maxTimeout: 1800,
      maxSpawnDepth: 3,
      recommendedModels: ['google-antigravity/gemini-3-flash', 'bailian/glm-4.7'],
      requiredFields: ['templateVersion', 'templateId', 'model', 'taskComplexity'],
    });

    // L2任务验证规则
    this.validationRules.set('L2', {
      maxTimeout: 3600,
      maxSpawnDepth: 4,
      recommendedModels: ['google-antigravity/gemini-3-pro-high', 'google-antigravity/gemini-3-flash'],
      requiredFields: ['templateVersion', 'templateId', 'model', 'taskComplexity'],
    });

    // L3任务验证规则
    this.validationRules.set('L3', {
      maxTimeout: 5400,
      maxSpawnDepth: 5,
      recommendedModels: ['google-antigravity/gemini-3-pro-high'],
      requiredFields: ['templateVersion', 'templateId', 'model', 'taskComplexity'],
    });

    // L4任务验证规则
    this.validationRules.set('L4', {
      maxTimeout: 7200,
      maxSpawnDepth: 6,
      recommendedModels: ['google-antigravity/gemini-3-pro-high'],
      requiredFields: ['templateVersion', 'templateId', 'model', 'taskComplexity'],
    });
  }

  /**
   * 验证单个配置
   */
  public async validateConfig(config: AgentConfigTemplate): Promise<ValidationReport> {
    const report: ValidationReport = {
      isValid: true,
      score: 100,
      errors: [],
      warnings: [],
      suggestions: [],
    };

    // 基础验证
    const basicValidation = this.templateManager.validateTemplate(config);
    if (!basicValidation.isValid) {
      report.isValid = false;
      report.score -= 30;
      report.errors.push(...basicValidation.errors.map(e => `[${e.path}] ${e.message}`));
    }

    // 复杂度特定验证
    const ruleSet = this.validationRules.get(config.taskComplexity);
    if (!ruleSet) {
      report.isValid = false;
      report.score -= 20;
      report.errors.push(`Unknown task complexity: ${config.taskComplexity}`);
    } else {
      // 验证必填字段
      ruleSet.requiredFields.forEach(field => {
        if (!(config as any)[field]) {
          report.isValid = false;
          report.score -= 10;
          report.errors.push(`Missing required field: ${field}`);
        }
      });

      // 验证超时配置
      if (config.runTimeoutSeconds) {
        if (config.taskComplexity !== TaskComplexity.L4) {
          if (config.runTimeoutSeconds > ruleSet.maxTimeout) {
            report.warnings.push(
              `runTimeoutSeconds (${config.runTimeoutSeconds}) exceeds recommended maximum (${ruleSet.maxTimeout})`
            );
            report.score -= 5;
          }

          const recommended = this.templateManager.getRecommendedTimeout(config.taskComplexity);
          if (config.runTimeoutSeconds < recommended * 0.5) {
            report.warnings.push(
              `runTimeoutSeconds (${config.runTimeoutSeconds}) may be too short for ${config.taskComplexity} task`
            );
            report.score -= 5;
          }
        }
      }

      // 验证spawn深度
      if (config.maxSpawnDepth && config.maxSpawnDepth > ruleSet.maxSpawnDepth) {
        report.warnings.push(
          `maxSpawnDepth (${config.maxSpawnDepth}) exceeds recommended maximum (${ruleSet.maxSpawnDepth}) for ${config.taskComplexity}`
        );
        report.score -= 5;
      }

      // 验证模型选择
      if (!ruleSet.recommendedModels.includes(config.model)) {
        report.suggestions.push(
          `Consider using one of the recommended models for ${config.taskComplexity}: ${ruleSet.recommendedModels.join(', ')}`
        );
        report.score -= 5;
      }
    }

    // 环境变量验证
    if (config.environmentVariables) {
      const envValidation = this.validateEnvironmentVariables(config.environmentVariables);
      report.warnings.push(...envValidation.warnings);
      report.suggestions.push(...envValidation.suggestions);
      report.score -= envValidation.warnings.length * 2;
    }

    // 配置Schema验证
    if (config.configValidation) {
      const schemaValidation = this.validateValidationSchema(config.configValidation);
      report.warnings.push(...schemaValidation.warnings);
      report.suggestions.push(...schemaValidation.suggestions);
      report.score -= schemaValidation.warnings.length * 2;
    }

    // 确保分数在0-100之间
    report.score = Math.max(0, Math.min(100, report.score));

    return report;
  }

  /**
   * 验证环境变量
   */
  private validateEnvironmentVariables(envVars: Record<string, string>): {
    warnings: string[];
    suggestions: string[];
  } {
    const result = { warnings: [] as string[], suggestions: [] as string[] };

    // 检查常见环境变量
    const commonVars = ['NODE_ENV', 'LOG_LEVEL', 'PORT', 'API_KEY'];
    commonVars.forEach(varName => {
      if (envVars[varName]) {
        // NODE_ENV应该有有效值
        if (varName === 'NODE_ENV') {
          const validValues = ['development', 'staging', 'production'];
          if (!validValues.includes(envVars[varName])) {
            result.warnings.push(
              `NODE_ENV should be one of: ${validValues.join(', ')}, got '${envVars[varName]}'`
            );
          }
        }

        // LOG_LEVEL应该有有效值
        if (varName === 'LOG_LEVEL') {
          const validValues = ['error', 'warn', 'info', 'debug'];
          if (!validValues.includes(envVars[varName])) {
            result.warnings.push(
              `LOG_LEVEL should be one of: ${validValues.join(', ')}, got '${envVars[varName]}'`
            );
          }
        }

        // API_KEY不应明文存储
        if (varName === 'API_KEY' && envVars[varName].length > 20) {
          result.suggestions.push(
            'API_KEY should be encrypted. Consider using EnvironmentConfigManager with encryption.'
          );
        }
      }
    });

    return result;
  }

  /**
   * 验证验证Schema
   */
  private validateValidationSchema(schema: any): {
    warnings: string[];
    suggestions: string[];
  } {
    const result = { warnings: [] as string[], suggestions: [] as string[] };

    // 检查是否有validator函数
    Object.entries(schema).forEach(([key, rule]: [string, any]) => {
      if (rule.validator && typeof rule.validator !== 'function') {
        result.warnings.push(
          `Schema field '${key}' has validator property but it's not a function`
        );
      }

      // 检查type和validator的一致性
      if (rule.type && rule.validator && rule.type === 'string') {
        result.suggestions.push(
          `Schema field '${key}' has both type 'string' and custom validator. Consider removing type if validator is comprehensive.`
        );
      }

      // 检查pattern和type的一致性
      if (rule.pattern && rule.type && rule.type !== 'string') {
        result.warnings.push(
          `Schema field '${key}' has pattern but type is not 'string'. Pattern only applies to strings.`
        );
      }
    });

    return result;
  }

  /**
   * 批量验证配置
   */
  public async validateBatch(configs: AgentConfigTemplate[]): Promise<BatchValidationReport> {
    const report: BatchValidationReport = {
      total: configs.length,
      valid: 0,
      invalid: 0,
      averageScore: 0,
      individualReports: [],
      summary: '',
    };

    let totalScore = 0;

    for (const config of configs) {
      const individualReport = await this.validateConfig(config);
      report.individualReports.push({
        templateId: config.templateId,
        report: individualReport,
      });

      if (individualReport.isValid) {
        report.valid++;
      } else {
        report.invalid++;
      }

      totalScore += individualReport.score;
    }

    report.averageScore = report.total > 0 ? totalScore / report.total : 0;
    report.summary = this.generateBatchSummary(report);

    return report;
  }

  /**
   * 生成批量验证摘要
   */
  private generateBatchSummary(report: BatchValidationReport): string {
    const lines: string[] = [];
    lines.push('=== Batch Validation Summary ===');
    lines.push(`Total: ${report.total}`);
    lines.push(`Valid: ${report.valid} (${((report.valid / report.total) * 100).toFixed(1)}%)`);
    lines.push(`Invalid: ${report.invalid} (${((report.invalid / report.total) * 100).toFixed(1)}%)`);
    lines.push(`Average Score: ${report.averageScore.toFixed(1)}/100`);
    lines.push('');

    // 显示最佳和最差配置
    const sorted = [...report.individualReports].sort((a, b) => b.report.score - a.report.score);
    if (sorted.length > 0) {
      lines.push(`Best: ${sorted[0].templateId} (${sorted[0].report.score}/100)`);
      lines.push(`Worst: ${sorted[sorted.length - 1].templateId} (${sorted[sorted.length - 1].report.score}/100)`);
    }

    return lines.join('\n');
  }

  /**
   * 生成验证报告文本
   */
  public generateValidationReportText(report: ValidationReport, templateId: string): string {
    const lines: string[] = [];
    lines.push('=== Configuration Validation Report ===');
    lines.push(`Template ID: ${templateId}`);
    lines.push(`Status: ${report.isValid ? '✅ VALID' : '❌ INVALID'}`);
    lines.push(`Score: ${report.score}/100`);
    lines.push('');

    if (report.errors.length > 0) {
      lines.push('🔴 Errors:');
      report.errors.forEach(error => {
        lines.push(`  - ${error}`);
      });
      lines.push('');
    }

    if (report.warnings.length > 0) {
      lines.push('🟡 Warnings:');
      report.warnings.forEach(warning => {
        lines.push(`  - ${warning}`);
      });
      lines.push('');
    }

    if (report.suggestions.length > 0) {
      lines.push('💡 Suggestions:');
      report.suggestions.forEach(suggestion => {
        lines.push(`  - ${suggestion}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 检测配置冲突
   */
  public detectConflicts(
    config1: AgentConfigTemplate,
    config2: AgentConfigTemplate
  ): Array<{ field: string; value1: any; value2: any; severity: 'high' | 'medium' | 'low' }> {
    const conflicts: Array<{ field: string; value1: any; value2: any; severity: 'high' | 'medium' | 'low' }> = [];

    // 定义关键冲突字段
    const criticalFields = ['model', 'taskComplexity', 'runTimeoutSeconds', 'maxSpawnDepth'];

    criticalFields.forEach(field => {
      const value1 = (config1 as any)[field];
      const value2 = (config2 as any)[field];

      if (value1 !== undefined && value2 !== undefined && value1 !== value2) {
        const severity = ['model', 'taskComplexity'].includes(field) ? 'high' : 'medium';
        conflicts.push({ field, value1, value2, severity });
      }
    });

    // 检查环境变量冲突
    if (config1.environmentVariables && config2.environmentVariables) {
      const allEnvKeys = new Set([
        ...Object.keys(config1.environmentVariables),
        ...Object.keys(config2.environmentVariables),
      ]);

      allEnvKeys.forEach(key => {
        const value1 = config1.environmentVariables![key];
        const value2 = config2.environmentVariables![key];

        if (value1 !== undefined && value2 !== undefined && value1 !== value2) {
          // 只对关键环境变量报告冲突
          if (['NODE_ENV', 'PORT', 'API_KEY', 'DATABASE_URL'].includes(key)) {
            conflicts.push({
              field: `environmentVariables.${key}`,
              value1,
              value2,
              severity: 'medium',
            });
          }
        }
      });
    }

    return conflicts;
  }

  /**
   * 计算配置相似度
   */
  public calculateSimilarity(
    config1: AgentConfigTemplate,
    config2: AgentConfigTemplate
  ): { score: number; commonFields: string[]; differingFields: string[] } {
    const fields1 = new Set(Object.keys(config1));
    const fields2 = new Set(Object.keys(config2));
    
    const allFields = new Set(Array.from(fields1).concat(Array.from(fields2)));
    const commonFields: string[] = [];
    const differingFields: string[] = [];

    let sameCount = 0;
    let totalCount = 0;

    Array.from(allFields).forEach(field => {
      const value1 = (config1 as any)[field];
      const value2 = (config2 as any)[field];

      if (value1 !== undefined && value2 !== undefined) {
        totalCount++;
        if (JSON.stringify(value1) === JSON.stringify(value2)) {
          sameCount++;
          commonFields.push(field);
        } else {
          differingFields.push(field);
        }
      }
    });

    const score = totalCount > 0 ? (sameCount / totalCount) * 100 : 0;

    return {
      score,
      commonFields,
      differingFields,
    };
  }
}

// ============================================================================
// 类型定义
// ============================================================================

export interface ValidationRuleSet {
  maxTimeout: number;
  maxSpawnDepth: number;
  recommendedModels: string[];
  requiredFields: string[];
}

export interface ValidationReport {
  isValid: boolean;
  score: number; // 0-100
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

export interface IndividualReport {
  templateId: string;
  report: ValidationReport;
}

export interface BatchValidationReport {
  total: number;
  valid: number;
  invalid: number;
  averageScore: number;
  individualReports: IndividualReport[];
  summary: string;
}

// ============================================================================
// 导出
// ============================================================================

export default ConfigValidator;
