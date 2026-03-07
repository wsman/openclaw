/**
 * 🛡️ 请求验证器 - 宪法合规与参数完整性检查（移植简化版）
 * 
 * 宪法依据: §152单一真理源公理、§125数据完整性公理、§381安全公理、§101同步公理
 * 版本: v1.0.0 (Phase 1B Day 3移植简化版)
 * 状态: 🟢 活跃
 * 
 * 移植说明:
 * 1. 基于MY-DOGE-DEMO/server/agents/resilience/RequestValidator.ts移植
 * 2. 简化了宪法合规验证逻辑，聚焦核心功能
 * 3. 适配Negentropy-Lab Gateway中间件链
 * 4. 支持热重载配置（§306零停机协议）
 * 
 * 核心功能:
 * 1. 结构验证 (JSON Schema, 类型系统) - Tier 1
 * 2. 宪法合规验证 (引用权威法典内核) - Tier 2
 * 3. 安全注入防御 (参数化查询验证) - Tier 3
 * 
 * 开发者注意:
 * - 所有验证失败必须提供有意义的错误信息
 * - 配置变更必须通过宪法合规验证
 * - 错误处理必须支持安全降级（§306零停机协议）
 */

import { logger } from '../../utils/logger';

export interface RequestValidationConfig {
  // 启用验证模式
  enableConstitutionalValidation: boolean;      // 宪法合规验证
  enableParameterValidation: boolean;          // 参数完整性验证
  enableSecurityValidation: boolean;           // 安全注入防御
  enableFormatValidation: boolean;             // 数据格式验证
  enableAuthorizationValidation: boolean;      // 授权权限验证
  
  // 验证规则配置
  maxRequestBodySize: number;                  // 最大请求体大小 (字节)
  maxParameterCount: number;                   // 最大参数数量
  allowedContentTypes: string[];              // 允许的内容类型
  
  // 宪法验证配置
  requireExplicitClauseReference: boolean;     // 是否要求显式宪法条款引用
  
  // 安全配置
  injectionPatterns: RegExp[];                 // 注入攻击模式正则
  maxNestingDepth: number;                     // JSON最大嵌套深度
  maxStringLength: number;                     // 字符串最大长度
  
  // 简化权限配置
  requiredPermissions?: Map<string, string[]>; // 操作到所需权限的映射
}

export interface RequestValidationContext {
  requestId: string;
  userId: string;
  userLevel: string;
  operationType: string;
  targetAgentId: string;
  constitutionalClauses?: string[];            // 引用的宪法条款
  timestamp: number;
}

export interface RequestData {
  body?: any;
  params?: Record<string, any>;
  query?: Record<string, any>;
  headers?: Record<string, string>;
  metadata?: Record<string, any>;
}

export interface ValidationResult {
  valid: boolean;
  validationId: string;
  context: RequestValidationContext;
  
  // 分级验证结果
  tier1: {
    status: 'pass' | 'fail' | 'warning';
    issues: ValidationIssue[];
  };
  
  tier2: {
    status: 'pass' | 'fail' | 'warning';
    issues: ValidationIssue[];
  };
  
  tier3: {
    status: 'pass' | 'fail' | 'warning';
    issues: ValidationIssue[];
  };
  
  // 总体结果
  overallStatus: 'valid' | 'invalid' | 'needs_review';
  rejectionReason?: string;
  suggestions: string[];
  
  // 性能指标
  validationTimeMs: number;
}

export interface ValidationIssue {
  id: string;
  type: 'structural' | 'constitutional' | 'security' | 'semantic' | 'authorization';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  location?: string;                           // JSON路径或参数位置
  expected?: any;                              // 期望值
  actual?: any;                               // 实际值
  constitutionalClause?: string;              // 涉及宪法条款
  fixSuggestion?: string;
}

/**
 * 请求验证器类（简化版）
 * 宪法依据: §152单一真理源公理、§125数据完整性公理、§381安全公理
 */
export class RequestValidator {
  private config: RequestValidationConfig;
  
  constructor(config: RequestValidationConfig) {
    this.config = config;
    this.logInfo('请求验证器初始化完成');
    this.logInfo(`宪法依据: §152单一真理源公理、§125数据完整性公理、§381安全公理`);
  }
  
  /**
   * 验证请求（简化版）
   */
  async validateRequest(
    context: RequestValidationContext,
    data: RequestData
  ): Promise<ValidationResult> {
    const startTime = Date.now();
    const validationId = `validation_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    const result: ValidationResult = {
      valid: false,
      validationId,
      context,
      tier1: { status: 'pass', issues: [] },
      tier2: { status: 'pass', issues: [] },
      tier3: { status: 'pass', issues: [] },
      overallStatus: 'valid',
      suggestions: [],
      validationTimeMs: 0
    };
    
    try {
      // 执行三级验证协议
      await this.executeTier1Validation(context, data, result);
      await this.executeTier2Validation(context, data, result);
      await this.executeTier3Validation(context, data, result);
      
      // 确定总体状态
      result.overallStatus = this.determineOverallStatus(result);
      result.valid = result.overallStatus === 'valid';
      
      // 生成建议
      result.suggestions = this.generateSuggestions(result);
      
    } catch (error: any) {
      this.logError(`请求验证失败: ${error.message}`);
      
      // 安全降级: 验证失败时拒绝请求
      // 宪法依据: §125数据完整性公理 - 在不确定的情况下拒绝操作
      result.tier1.status = 'fail';
      result.tier1.issues.push({
        id: 'validation_failure',
        type: 'structural',
        severity: 'critical',
        message: `验证过程失败: ${error.message}`,
        fixSuggestion: '检查验证器配置或联系系统管理员'
      });
      
      result.overallStatus = 'invalid';
      result.valid = false;
      result.rejectionReason = `验证器内部错误: ${error.message}`;
    }
    
    // 计算性能指标
    result.validationTimeMs = Date.now() - startTime;
    
    this.logValidationResult(result);
    
    return result;
  }
  
  /**
   * 执行Tier 1验证 - 结构验证（简化版）
   */
  private async executeTier1Validation(
    context: RequestValidationContext,
    data: RequestData,
    result: ValidationResult
  ): Promise<void> {
    if (!this.config.enableParameterValidation) {
      return;
    }
    
    const issues: ValidationIssue[] = [];
    
    try {
      // 1. 检查请求体大小
      if (data.body && JSON.stringify(data.body).length > this.config.maxRequestBodySize) {
        issues.push({
          id: 'request_body_too_large',
          type: 'structural',
          severity: 'high',
          message: `请求体大小超过限制: ${JSON.stringify(data.body).length} > ${this.config.maxRequestBodySize}字节`,
          expected: `≤ ${this.config.maxRequestBodySize}字节`,
          actual: `${JSON.stringify(data.body).length}字节`,
          constitutionalClause: '§125',
          fixSuggestion: '减少请求体大小或分批次处理'
        });
      }
      
      // 2. 检查参数数量
      const totalParams = this.countParameters(data);
      if (totalParams > this.config.maxParameterCount) {
        issues.push({
          id: 'too_many_parameters',
          type: 'structural',
          severity: 'medium',
          message: `参数数量超过限制: ${totalParams} > ${this.config.maxParameterCount}`,
          expected: `≤ ${this.config.maxParameterCount}个参数`,
          actual: `${totalParams}个参数`,
          constitutionalClause: '§125',
          fixSuggestion: '减少参数数量或使用批量处理接口'
        });
      }
      
      // 3. 检查内容类型
      const contentType = data.headers?.['content-type'];
      if (contentType && !this.config.allowedContentTypes.some(type => contentType.includes(type))) {
        issues.push({
          id: 'unsupported_content_type',
          type: 'structural',
          severity: 'medium',
          message: `不支持的内容类型: ${contentType}`,
          expected: this.config.allowedContentTypes.join(', '),
          actual: contentType,
          fixSuggestion: `使用支持的内容类型: ${this.config.allowedContentTypes.join(', ')}`
        });
      }
      
      // 4. JSON格式验证
      if (data.body) {
        const jsonValidation = this.validateJsonStructure(data.body);
        issues.push(...jsonValidation.issues);
      }
      
      // 更新结果
      const hasCriticalIssues = issues.some(issue => issue.severity === 'critical');
      const hasHighIssues = issues.some(issue => issue.severity === 'high');
      
      if (hasCriticalIssues) {
        result.tier1.status = 'fail';
      } else if (hasHighIssues) {
        result.tier1.status = 'warning';
      } else {
        result.tier1.status = 'pass';
      }
      
      result.tier1.issues = issues;
      
    } catch (error: any) {
      this.logError(`Tier 1验证失败: ${error.message}`);
      result.tier1.status = 'fail';
      result.tier1.issues.push({
        id: 'tier1_validation_failure',
        type: 'structural',
        severity: 'critical',
        message: `结构验证失败: ${error.message}`,
        fixSuggestion: '检查请求数据格式或联系技术支持'
      });
    }
  }
  
  /**
   * 执行Tier 2验证 - 宪法合规验证（简化版）
   */
  private async executeTier2Validation(
    context: RequestValidationContext,
    data: RequestData,
    result: ValidationResult
  ): Promise<void> {
    if (!this.config.enableConstitutionalValidation) {
      return;
    }
    
    const issues: ValidationIssue[] = [];
    
    try {
      // 1. 宪法条款引用检查
      const clauseValidation = this.validateConstitutionalClauses(
        context.operationType,
        context.targetAgentId,
        context.constitutionalClauses || []
      );
      
      // 2. 生成宪法合规问题
      for (const invalidClause of clauseValidation.invalidClauses) {
        issues.push({
          id: `invalid_constitutional_clause_${invalidClause.clause.replace(/[§.]/g, '_')}`,
          type: 'constitutional',
          severity: 'high',
          message: `无效的宪法条款引用: ${invalidClause.clause}`,
          location: 'operationType',
          expected: `有效的宪法条款`,
          actual: invalidClause.clause,
          constitutionalClause: '§102.3',
          fixSuggestion: invalidClause.reason
        });
      }
      
      for (const missingClause of clauseValidation.missingRequiredClauses) {
        issues.push({
          id: `missing_constitutional_clause_${missingClause.replace(/[§.]/g, '_')}`,
          type: 'constitutional',
          severity: this.config.requireExplicitClauseReference ? 'critical' : 'medium',
          message: `缺少必需的宪法条款引用: ${missingClause}`,
          location: 'operationType',
          expected: `包含宪法条款 ${missingClause}`,
          actual: '未引用',
          constitutionalClause: missingClause,
          fixSuggestion: `在请求中显式引用宪法条款 ${missingClause}`
        });
      }
      
      // 更新结果
      const hasCriticalIssues = issues.some(issue => issue.severity === 'critical');
      const hasHighIssues = issues.some(issue => issue.severity === 'high');
      
      if (hasCriticalIssues) {
        result.tier2.status = 'fail';
      } else if (hasHighIssues) {
        result.tier2.status = 'warning';
      } else {
        result.tier2.status = 'pass';
      }
      
      result.tier2.issues = issues;
      
    } catch (error: any) {
      this.logError(`Tier 2验证失败: ${error.message}`);
      result.tier2.status = 'fail';
      result.tier2.issues.push({
        id: 'tier2_validation_failure',
        type: 'constitutional',
        severity: 'critical',
        message: `宪法合规验证失败: ${error.message}`,
        fixSuggestion: '检查宪法条款引用或联系宪法专家'
      });
    }
  }
  
  /**
   * 执行Tier 3验证 - 安全验证（简化版）
   */
  private async executeTier3Validation(
    context: RequestValidationContext,
    data: RequestData,
    result: ValidationResult
  ): Promise<void> {
    const issues: ValidationIssue[] = [];
    
    try {
      // 1. 安全验证（如果需要）
      if (this.config.enableSecurityValidation) {
        const securityCheck = this.performSecurityValidation(data);
        if (!securityCheck.valid) {
          issues.push(...securityCheck.issues);
        }
      }
      
      // 2. 授权验证（如果需要）
      if (this.config.enableAuthorizationValidation) {
        const authCheck = await this.performAuthorizationValidation(context, data);
        if (!authCheck.valid) {
          issues.push(...authCheck.issues);
        }
      }
      
      // 更新结果
      const hasCriticalIssues = issues.some(issue => issue.severity === 'critical');
      const hasHighIssues = issues.some(issue => issue.severity === 'high');
      
      if (hasCriticalIssues) {
        result.tier3.status = 'fail';
      } else if (hasHighIssues) {
        result.tier3.status = 'warning';
      } else {
        result.tier3.status = 'pass';
      }
      
      result.tier3.issues = issues;
      
    } catch (error: any) {
      this.logError(`Tier 3验证失败: ${error.message}`);
      result.tier3.status = 'fail';
      result.tier3.issues.push({
        id: 'tier3_validation_failure',
        type: 'semantic',
        severity: 'critical',
        message: `安全验证失败: ${error.message}`,
        fixSuggestion: '检查操作语义或联系领域专家'
      });
    }
  }
  
  /**
   * 计算参数总数
   */
  private countParameters(data: RequestData): number {
    let count = 0;
    
    if (data.body) {
      count += this.countObjectProperties(data.body);
    }
    
    if (data.params) {
      count += Object.keys(data.params).length;
    }
    
    if (data.query) {
      count += Object.keys(data.query).length;
    }
    
    if (data.headers) {
      count += Object.keys(data.headers).length;
    }
    
    return count;
  }
  
  /**
   * 计算对象属性数量
   */
  private countObjectProperties(obj: any): number {
    if (typeof obj !== 'object' || obj === null) {
      return 1;
    }
    
    let count = 0;
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        count += 1 + this.countObjectProperties(obj[key]);
      }
    }
    
    return count;
  }
  
  /**
   * 验证JSON结构（简化版）
   */
  private validateJsonStructure(body: any): { issues: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];
    
    try {
      // 检查嵌套深度
      const depth = this.calculateJsonDepth(body);
      if (depth > this.config.maxNestingDepth) {
        issues.push({
          id: 'json_nesting_too_deep',
          type: 'structural',
          severity: 'medium',
          message: `JSON嵌套深度超过限制: ${depth} > ${this.config.maxNestingDepth}`,
          expected: `≤ ${this.config.maxNestingDepth}层嵌套`,
          actual: `${depth}层嵌套`,
          constitutionalClause: '§125',
          fixSuggestion: '简化数据结构，减少嵌套层次'
        });
      }
      
      // 检查字符串长度
      this.checkStringLengths(body, issues);
      
      // 安全检查：注入模式检测
      this.checkInjectionPatterns(body, issues);
      
    } catch (error: any) {
      issues.push({
        id: 'json_structure_validation_error',
        type: 'structural',
        severity: 'high',
        message: `JSON结构验证错误: ${error.message}`,
        fixSuggestion: '检查JSON格式有效性'
      });
    }
    
    return { issues };
  }
  
  /**
   * 计算JSON嵌套深度
   */
  private calculateJsonDepth(obj: any, currentDepth = 1): number {
    if (typeof obj !== 'object' || obj === null) {
      return currentDepth;
    }
    
    let maxDepth = currentDepth;
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const depth = this.calculateJsonDepth(obj[key], currentDepth + 1);
        maxDepth = Math.max(maxDepth, depth);
      }
    }
    
    return maxDepth;
  }
  
  /**
   * 检查字符串长度
   */
  private checkStringLengths(obj: any, issues: ValidationIssue[], path = ''): void {
    if (typeof obj === 'string') {
      if (obj.length > this.config.maxStringLength) {
        const fieldPath = path || 'root';
        issues.push({
          id: 'string_length_exceeded',
          type: 'structural',
          severity: 'medium',
          message: `字符串长度超过限制: ${obj.length} > ${this.config.maxStringLength}`,
          location: fieldPath,
          expected: `≤ ${this.config.maxStringLength}字符`,
          actual: `${obj.length}字符`,
          constitutionalClause: '§125',
          fixSuggestion: '缩短字符串长度或使用分块传输'
        });
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const newPath = path ? `${path}.${key}` : key;
          this.checkStringLengths(obj[key], issues, newPath);
        }
      }
    }
  }
  
  /**
   * 检查注入模式
   */
  private checkInjectionPatterns(obj: any, issues: ValidationIssue[], path = ''): void {
    if (typeof obj === 'string') {
      for (const pattern of this.config.injectionPatterns) {
        if (pattern.test(obj)) {
          const fieldPath = path || 'root';
          issues.push({
            id: 'injection_pattern_detected',
            type: 'security',
            severity: 'critical',
            message: `检测到潜在的注入攻击模式: ${pattern.toString()}`,
            location: fieldPath,
            expected: '安全的内容',
            actual: `匹配模式: ${pattern.toString()}`,
            constitutionalClause: '§381',
            fixSuggestion: '移除潜在的恶意内容或使用参数化查询'
          });
          break;
        }
      }
    } else if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const newPath = path ? `${path}.${key}` : key;
          this.checkInjectionPatterns(obj[key], issues, newPath);
        }
      }
    }
  }
  
  /**
   * 验证宪法条款（简化版）
   */
  private validateConstitutionalClauses(
    operationType: string,
    targetAgentId: string,
    clauses: string[]
  ): {
    validClauses: string[];
    invalidClauses: { clause: string; reason: string; evidence: string }[];
    missingRequiredClauses: string[];
  } {
    const validClauses: string[] = [];
    const invalidClauses: Array<{ clause: string; reason: string; evidence: string }> = [];
    const missingRequiredClauses: string[] = [];
    
    // 验证每个引用的条款
    for (const clause of clauses) {
      // 检查条款格式
      if (!/^§\d+(\.\d+)*$/.test(clause)) {
        invalidClauses.push({
          clause,
          reason: '条款格式无效，必须符合 §数字[.数字]* 格式',
          evidence: `条款格式: ${clause}`
        });
        continue;
      }
      
      validClauses.push(clause);
    }
    
    // 检查必需的宪法条款
    if (this.config.requireExplicitClauseReference) {
      const requiredClauses = this.getRequiredClauses(operationType, targetAgentId);
      
      for (const requiredClause of requiredClauses) {
        if (!clauses.includes(requiredClause)) {
          missingRequiredClauses.push(requiredClause);
        }
      }
    }
    
    return { validClauses, invalidClauses, missingRequiredClauses };
  }
  
  /**
   * 获取必需的宪法条款（简化版）
   */
  private getRequiredClauses(
    operationType: string,
    targetAgentId: string
  ): string[] {
    const requiredClauses: string[] = [];
    
    // 所有操作都需要§101
    requiredClauses.push('§101');
    
    // 根据操作类型添加特定条款
    const operationLower = operationType.toLowerCase();
    
    if (operationLower.includes('agent') || operationLower.includes('routing')) {
      requiredClauses.push('§152');
    }
    
    if (operationLower.includes('security') || operationLower.includes('auth')) {
      requiredClauses.push('§381');
    }
    
    if (operationLower.includes('network') || operationLower.includes('resilience')) {
      requiredClauses.push('§190');
    }
    
    return requiredClauses;
  }
  
  /**
   * 执行安全验证（简化版）
   */
  private performSecurityValidation(data: RequestData): { valid: boolean; issues: ValidationIssue[] } {
    const issues: ValidationIssue[] = [];
    
    // 检查头部注入
    if (data.headers) {
      for (const [key, value] of Object.entries(data.headers)) {
        if (key.toLowerCase().includes('script') || value.includes('<script>')) {
          issues.push({
            id: 'header_injection_detected',
            type: 'security',
            severity: 'critical',
            message: '检测到潜在的头部注入攻击',
            location: `headers.${key}`,
            expected: '安全的头部内容',
            actual: value,
            constitutionalClause: '§381',
            fixSuggestion: '移除潜在的恶意头部内容'
          });
        }
      }
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
  
  /**
   * 执行授权验证（简化版）
   */
  private async performAuthorizationValidation(
    context: RequestValidationContext,
    data: RequestData
  ): Promise<{ valid: boolean; issues: ValidationIssue[] }> {
    const issues: ValidationIssue[] = [];
    
    if (!this.config.requiredPermissions) {
      return { valid: true, issues };
    }
    
    const requiredPermissions = this.config.requiredPermissions.get(context.operationType);
    
    if (requiredPermissions && requiredPermissions.length > 0) {
      // 简化：假设所有操作都需要基本权限
      const userPermissions = ['basic_access']; // 应从用户上下文中获取
      
      for (const requiredPermission of requiredPermissions) {
        if (!userPermissions.includes(requiredPermission)) {
          issues.push({
            id: 'insufficient_permission',
            type: 'authorization',
            severity: 'critical',
            message: `用户缺少必需权限: ${requiredPermission}`,
            location: 'user.permissions',
            expected: `包含权限: ${requiredPermission}`,
            actual: `用户权限: ${userPermissions.join(', ')}`,
            constitutionalClause: '§160',
            fixSuggestion: '申请相应权限或联系管理员'
          });
        }
      }
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
  
  /**
   * 确定总体状态
   */
  private determineOverallStatus(result: ValidationResult): 'valid' | 'invalid' | 'needs_review' {
    const tier1Critical = result.tier1.issues.some(i => i.severity === 'critical');
    const tier2Critical = result.tier2.issues.some(i => i.severity === 'critical');
    const tier3Critical = result.tier3.issues.some(i => i.severity === 'critical');
    
    const hasCritical = tier1Critical || tier2Critical || tier3Critical;
    const hasHigh = result.tier1.issues.some(i => i.severity === 'high') ||
                   result.tier2.issues.some(i => i.severity === 'high') ||
                   result.tier3.issues.some(i => i.severity === 'high');
    
    if (hasCritical) {
      return 'invalid';
    } else if (hasHigh) {
      return 'needs_review';
    } else {
      return 'valid';
    }
  }
  
  /**
   * 生成建议
   */
  private generateSuggestions(result: ValidationResult): string[] {
    const suggestions: string[] = [];
    
    // 从问题中提取修复建议
    const allIssues = [
      ...result.tier1.issues,
      ...result.tier2.issues,
      ...result.tier3.issues
    ];
    
    for (const issue of allIssues) {
      if (issue.fixSuggestion && !suggestions.includes(issue.fixSuggestion)) {
        suggestions.push(issue.fixSuggestion);
      }
    }
    
    return suggestions;
  }
  
  /**
   * 记录验证结果
   */
  private logValidationResult(result: ValidationResult): void {
    const level = result.overallStatus === 'valid' ? 'INFO' : 
                 result.overallStatus === 'needs_review' ? 'WARN' : 'ERROR';
    
    const logMessage = `请求验证结果: ${result.validationId}, 状态: ${result.overallStatus}, ` +
                      `用时: ${result.validationTimeMs}ms, 问题数: ` +
                      `${result.tier1.issues.length + result.tier2.issues.length + result.tier3.issues.length}`;
    
    if (level === 'INFO') {
      this.logInfo(logMessage);
    } else if (level === 'WARN') {
      this.logWarning(logMessage);
    } else {
      this.logError(logMessage);
    }
  }
  
  /**
   * Express中间件集成
   * 宪法依据: §101同步公理，确保中间件与主系统同步
   */
  middleware() {
    return async (req: any, res: any, next: Function) => {
      try {
        const context: RequestValidationContext = {
          requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`,
          userId: req.user?.id || 'anonymous',
          userLevel: req.user?.level || 'default',
          operationType: req.method + ' ' + req.path,
          targetAgentId: 'gateway',
          timestamp: Date.now()
        };
        
        const data: RequestData = {
          body: req.body,
          params: req.params,
          query: req.query,
          headers: req.headers,
          metadata: {
            ip: req.ip,
            userAgent: req.get('User-Agent')
          }
        };
        
        const result = await this.validateRequest(context, data);
        
        if (!result.valid) {
          // 根据宪法§306零停机协议提供有意义的错误信息
          return res.status(400).json({
            error: '请求验证失败',
            message: result.rejectionReason,
            validationResult: result,
            suggestions: result.suggestions
          });
        }
        
        // 添加验证信息到请求对象
        req.validationContext = context;
        req.validationResult = result;
        
        next();
      } catch (error: any) {
        // 安全降级：验证器异常时允许请求通过
        // 宪法依据: §306零停机协议
        this.logError(`请求验证中间件异常: ${error.message}`);
        next();
      }
    };
  }
  
  /**
   * 更新配置
   * 宪法依据: §101同步公理，配置变更需确保系统稳定性
   */
  updateConfig(config: Partial<RequestValidationConfig>): void {
    const oldConfig = { ...this.config };
    this.config = { ...this.config, ...config };
    
    this.logInfo('请求验证配置已更新');
    this.logInfo(`宪法依据: §101同步公理 - 配置变更触发系统更新`);
    this.logDebug(`旧配置: ${JSON.stringify(oldConfig)}`);
    this.logDebug(`新配置: ${JSON.stringify(this.config)}`);
  }
  
  /**
   * 获取当前配置
   */
  getConfig(): RequestValidationConfig {
    return { ...this.config };
  }
  
  private logInfo(message: string): void {
    logger.info(`[RequestValidator] ${message}`);
  }
  
  private logWarning(message: string): void {
    logger.warn(`[RequestValidator] ${message}`);
  }
  
  private logError(message: string): void {
    logger.error(`[RequestValidator] ${message}`);
  }
  
  private logDebug(message: string): void {
    logger.debug(`[RequestValidator] ${message}`);
  }
}

/**
 * 创建默认请求验证器配置
 * 宪法依据: §102熵减原则，复用MY-DOGE-DEMO已验证配置
 */
export function createDefaultRequestValidatorConfig(): RequestValidationConfig {
  // 注入攻击模式检测正则
  const injectionPatterns = [
    /<script\b[^>]*>/i, // 脚本标签
    /javascript:/i,      // JavaScript协议
    /on\w+\s*=/i,       // 事件处理器
    /union\s+select/i,  // SQL注入
    /--\s*$/i,          // SQL注释
    /;\s*(exec|execute)/i, // 命令执行
    /<\?php/i,          // PHP代码
    /eval\s*\(/i,       // eval函数
    /document\./i,      // DOM操作
    /alert\s*\(/i       // alert弹窗
  ];
  
  // 权限映射
  const requiredPermissions = new Map([
    ['create_task', ['task_create']],
    ['update_task', ['task_update']],
    ['delete_task', ['task_delete']],
    ['query_data', ['data_read']],
    ['update_config', ['config_write']],
    ['admin_operation', ['admin_access']]
  ]);
  
  return {
    enableConstitutionalValidation: true,
    enableParameterValidation: true,
    enableSecurityValidation: true,
    enableFormatValidation: true,
    enableAuthorizationValidation: true,
    maxRequestBodySize: 1024 * 1024, // 1MB
    maxParameterCount: 100,
    allowedContentTypes: ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data'],
    requireExplicitClauseReference: false,
    injectionPatterns,
    maxNestingDepth: 10,
    maxStringLength: 10000,
    requiredPermissions
  };
}

export default {
  RequestValidator,
  createDefaultRequestValidatorConfig
};