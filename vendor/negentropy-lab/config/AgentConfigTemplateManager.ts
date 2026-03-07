/**
 * Agent配置模板管理系统
 * 版本: 1.0.0
 * 宪法依据: §101 同步公理、§118 长时间任务执行公理、§118.5 智能体协同统一策略原则
 * 
 * 功能:
 * - Agent配置模板管理器
 * - L1-L4任务配置模板支持
 * - 模板版本控制和继承机制
 * - 环境变量配置增强
 * - 配置验证机制
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 任务复杂度等级
 */
export enum TaskComplexity {
  L1 = 'L1',  // 简单任务 (15分钟)
  L2 = 'L2',  // 中等任务 (30分钟)
  L3 = 'L3',  // 复杂任务 (45分钟)
  L4 = 'L4',  // 超复杂任务 (60分钟+)
}

/**
 * 配置验证规则
 */
export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'object' | 'array';
  enum?: any[];
  min?: number;
  max?: number;
  pattern?: RegExp;
  validator?: (value: any) => boolean | string;
}

/**
 * 验证Schema
 */
export interface ValidationSchema {
  [key: string]: ValidationRule;
}

/**
 * 模板继承配置
 */
export interface TemplateInheritance {
  parentTemplate: string;
  overrides: Partial<AgentConfigTemplate>;
}

/**
 * Agent配置模板
 */
export interface AgentConfigTemplate {
  // 元数据
  templateVersion: string;
  templateId: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;

  // OpenClaw已有功能（直接使用，70%复用）
  model: string;                           // ✅ OpenClaw已支持
  runTimeoutSeconds?: number;               // ✅ OpenClaw已支持
  maxSpawnDepth?: number;                   // ✅ OpenClaw已支持

  // 新增功能
  taskComplexity: TaskComplexity;
  environmentVariables?: Record<string, string>;
  configValidation?: ValidationSchema;
  inheritance?: TemplateInheritance;
  
  // 配置元数据
  tags?: string[];
  author?: string;
  category?: string;
}

/**
 * 配置验证结果
 */
export interface ValidationResult {
  isValid: boolean;
  errors: Array<{ path: string; message: string }>;
  warnings: Array<{ path: string; message: string }>;
}

/**
 * 环境配置
 */
export interface EnvironmentConfig {
  name: 'dev' | 'staging' | 'prod';
  variables: Record<string, string>;
  encrypted?: string[];  // 加密变量名列表
}

// ============================================================================
// Agent配置模板管理器
// ============================================================================

export class AgentConfigTemplateManager {
  private templatesDir: string;
  private customDir: string;
  private cache: Map<string, AgentConfigTemplate>;

  constructor(basePath: string = __dirname) {
    this.templatesDir = path.join(basePath, 'templates');
    this.customDir = path.join(this.templatesDir, 'custom');
    this.cache = new Map();
    
    // 确保目录存在
    this.ensureDirectories();
  }

  /**
   * 确保目录存在
   */
  private ensureDirectories(): void {
    [this.templatesDir, this.customDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * 生成模板ID
   */
  private generateTemplateId(name: string): string {
    const timestamp = Date.now();
    const hash = crypto.createHash('sha256')
      .update(name + timestamp)
      .digest('hex')
      .substring(0, 8);
    return `${name}-${hash}`;
  }

  /**
   * 加载模板
   */
  public async loadTemplate(templateId: string): Promise<AgentConfigTemplate | null> {
    // 检查缓存
    if (this.cache.has(templateId)) {
      return this.cache.get(templateId)!;
    }

    // 尝试从文件加载
    const templatePath = this.findTemplatePath(templateId);
    if (!templatePath) {
      return null;
    }

    try {
      const content = fs.readFileSync(templatePath, 'utf-8');
      const template: AgentConfigTemplate = JSON.parse(content);
      
      // 处理继承
      if (template.inheritance) {
        const parentTemplate = await this.loadTemplate(template.inheritance.parentTemplate);
        if (parentTemplate) {
          template.inheritance.overrides = { ...parentTemplate, ...template.inheritance.overrides };
        }
      }
      
      this.cache.set(templateId, template);
      return template;
    } catch (error) {
      console.error(`Failed to load template ${templateId}:`, error);
      return null;
    }
  }

  /**
   * 查找模板路径
   */
  private findTemplatePath(templateId: string): string | null {
    const possiblePaths = [
      path.join(this.templatesDir, `${templateId}.json`),
      path.join(this.customDir, `${templateId}.json`),
      path.join(this.templatesDir, `${templateId.toLowerCase()}.json`),
    ];

    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        return possiblePath;
      }
    }

    return null;
  }

  /**
   * 保存模板
   */
  public async saveTemplate(template: AgentConfigTemplate, isCustom: boolean = false): Promise<boolean> {
    try {
      // 生成ID和时间戳
      if (!template.templateId) {
        template.templateId = this.generateTemplateId(template.description || 'template');
      }
      
      const now = new Date().toISOString();
      template.updatedAt = now;
      if (!template.createdAt) {
        template.createdAt = now;
      }

      // 保存到文件
      const targetDir = isCustom ? this.customDir : this.templatesDir;
      const filePath = path.join(targetDir, `${template.templateId}.json`);
      
      fs.writeFileSync(filePath, JSON.stringify(template, null, 2), 'utf-8');
      
      // 更新缓存
      this.cache.set(template.templateId, template);
      
      return true;
    } catch (error) {
      console.error('Failed to save template:', error);
      return false;
    }
  }

  /**
   * 列出所有模板
   */
  public listTemplates(): Array<{ id: string; description?: string; complexity: TaskComplexity }> {
    const templates: Array<{ id: string; description?: string; complexity: TaskComplexity }> = [];

    const scanDir = (dir: string) => {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        if (file.endsWith('.json')) {
          const templatePath = path.join(dir, file);
          try {
            const content = fs.readFileSync(templatePath, 'utf-8');
            const template: AgentConfigTemplate = JSON.parse(content);
            templates.push({
              id: template.templateId,
              description: template.description,
              complexity: template.taskComplexity,
            });
          } catch (error) {
            console.error(`Failed to parse template ${file}:`, error);
          }
        }
      });
    };

    scanDir(this.templatesDir);
    scanDir(this.customDir);

    return templates;
  }

  /**
   * 验证配置
   */
  public validateConfig(config: any, schema: ValidationSchema): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    for (const [key, rule] of Object.entries(schema)) {
      const value = config[key];

      // 检查必填项
      if (rule.required && (value === undefined || value === null)) {
        result.isValid = false;
        result.errors.push({ path: key, message: 'Required field is missing' });
        continue;
      }

      // 如果值为空且非必填，跳过验证
      if (value === undefined || value === null) {
        continue;
      }

      // 检查类型
      if (rule.type) {
        const expectedType = rule.type;
        let actualType: string;

        if (Array.isArray(value)) {
          actualType = 'array';
        } else if (value === null) {
          actualType = 'object';
        } else {
          actualType = typeof value;
        }

        if (actualType !== expectedType) {
          result.isValid = false;
          result.errors.push({
            path: key,
            message: `Expected type ${expectedType}, got ${actualType}`,
          });
        }
      }

      // 检查枚举值
      if (rule.enum && !rule.enum.includes(value)) {
        result.isValid = false;
        result.errors.push({
          path: key,
          message: `Value must be one of: ${rule.enum.join(', ')}`,
        });
      }

      // 检查范围
      if (typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          result.isValid = false;
          result.errors.push({
            path: key,
            message: `Value must be >= ${rule.min}`,
          });
        }
        if (rule.max !== undefined && value > rule.max) {
          result.isValid = false;
          result.errors.push({
            path: key,
            message: `Value must be <= ${rule.max}`,
          });
        }
      }

      // 检查正则表达式
      if (rule.pattern && typeof value === 'string') {
        if (!rule.pattern.test(value)) {
          result.isValid = false;
          result.errors.push({
            path: key,
            message: `Value does not match required pattern`,
          });
        }
      }

      // 自定义验证器
      if (rule.validator) {
        const validationResult = rule.validator(value);
        if (validationResult !== true) {
          result.isValid = false;
          result.errors.push({
            path: key,
            message: typeof validationResult === 'string' ? validationResult : 'Validation failed',
          });
        }
      }
    }

    return result;
  }

  /**
   * 验证模板
   */
  public validateTemplate(template: AgentConfigTemplate): ValidationResult {
    const schema: ValidationSchema = {
      templateVersion: { required: true, type: 'string' },
      templateId: { required: true, type: 'string' },
      model: { required: true, type: 'string' },
      taskComplexity: {
        required: true,
        type: 'string',
        enum: [TaskComplexity.L1, TaskComplexity.L2, TaskComplexity.L3, TaskComplexity.L4],
      },
      runTimeoutSeconds: { type: 'number', min: 60, max: 7200 },
      maxSpawnDepth: { type: 'number', min: 1, max: 10 },
    };

    return this.validateConfig(template, schema);
  }

  /**
   * 根据任务复杂度获取推荐的超时时间
   */
  public getRecommendedTimeout(complexity: TaskComplexity): number {
    switch (complexity) {
      case TaskComplexity.L1:
        return 900;   // 15分钟
      case TaskComplexity.L2:
        return 1800;  // 30分钟
      case TaskComplexity.L3:
        return 2700;  // 45分钟
      case TaskComplexity.L4:
        return 3600;  // 60分钟（L4可省略超时，无限制）
      default:
        return 1800;
    }
  }

  /**
   * 获取模板统计信息
   */
  public getTemplateStats(): {
    total: number;
    byComplexity: Record<TaskComplexity, number>;
    custom: number;
    standard: number;
  } {
    const templates = this.listTemplates();
    const stats = {
      total: templates.length,
      byComplexity: {
        [TaskComplexity.L1]: 0,
        [TaskComplexity.L2]: 0,
        [TaskComplexity.L3]: 0,
        [TaskComplexity.L4]: 0,
      },
      custom: 0,
      standard: 0,
    };

    templates.forEach(t => {
      stats.byComplexity[t.complexity]++;
      if (t.id.includes('custom')) {
        stats.custom++;
      } else {
        stats.standard++;
      }
    });

    return stats;
  }

  /**
   * 清除缓存
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * 删除模板
   */
  public async deleteTemplate(templateId: string): Promise<boolean> {
    const templatePath = this.findTemplatePath(templateId);
    if (!templatePath) {
      return false;
    }

    try {
      fs.unlinkSync(templatePath);
      this.cache.delete(templateId);
      return true;
    } catch (error) {
      console.error(`Failed to delete template ${templateId}:`, error);
      return false;
    }
  }
}

// ============================================================================
// 环境配置管理器
// ============================================================================

export class EnvironmentConfigManager {
  private configPath: string;
  private encryptionKey: string;
  private configs: Map<string, EnvironmentConfig>;

  constructor(basePath: string = __dirname, encryptionKey: string = 'default-key-change-me') {
    this.configPath = path.join(basePath, 'environments.json');
    this.encryptionKey = encryptionKey;
    this.configs = new Map();
    
    this.loadConfigs();
  }

  /**
   * 加载环境配置
   */
  private loadConfigs(): void {
    if (fs.existsSync(this.configPath)) {
      try {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        const data: Record<string, EnvironmentConfig> = JSON.parse(content);
        
        for (const [envName, config] of Object.entries(data)) {
          this.configs.set(envName, config);
        }
      } catch (error) {
        console.error('Failed to load environment configs:', error);
      }
    }
  }

  /**
   * 保存环境配置
   */
  private saveConfigs(): void {
    const data: Record<string, EnvironmentConfig> = {};
    this.configs.forEach((config, name) => {
      data[name] = config;
    });

    fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * 加密字符串
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(this.encryptionKey.padEnd(32).substring(0, 32)),
      iv
    );
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * 解密字符串
   */
  private decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(this.encryptionKey.padEnd(32).substring(0, 32)),
      iv
    );
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * 设置环境配置
   */
  public setEnvironment(name: 'dev' | 'staging' | 'prod', config: EnvironmentConfig): void {
    this.configs.set(name, config);
    this.saveConfigs();
  }

  /**
   * 获取环境配置
   */
  public getEnvironment(name: 'dev' | 'staging' | 'prod'): EnvironmentConfig | null {
    return this.configs.get(name) || null;
  }

  /**
   * 获取环境变量（自动解密）
   */
  public getEnvironmentVariables(name: 'dev' | 'staging' | 'prod'): Record<string, string> {
    const config = this.getEnvironment(name);
    if (!config) {
      return {};
    }

    const variables: Record<string, string> = {};
    for (const [key, value] of Object.entries(config.variables)) {
      if (config.encrypted && config.encrypted.includes(key)) {
        try {
          variables[key] = this.decrypt(value);
        } catch (error) {
          console.error(`Failed to decrypt ${key}:`, error);
          variables[key] = value;
        }
      } else {
        variables[key] = value;
      }
    }

    return variables;
  }

  /**
   * 合并环境变量到模板
   */
  public mergeEnvironmentVariables(
    template: AgentConfigTemplate,
    envName: 'dev' | 'staging' | 'prod'
  ): AgentConfigTemplate {
    const envVars = this.getEnvironmentVariables(envName);
    const merged = {
      ...template,
      environmentVariables: {
        ...envVars,
        ...template.environmentVariables,
      },
    };

    return merged;
  }
}

// ============================================================================
// 配置迁移工具
// ============================================================================

export class ConfigMigrationTool {
  private templateManager: AgentConfigTemplateManager;

  constructor(templateManager: AgentConfigTemplateManager) {
    this.templateManager = templateManager;
  }

  /**
   * 检测配置冲突
   */
  public detectConflicts(
    config1: Partial<AgentConfigTemplate>,
    config2: Partial<AgentConfigTemplate>
  ): Array<{ key: string; value1: any; value2: any }> {
    const conflicts: Array<{ key: string; value1: any; value2: any }> = [];
    const keys = new Set([...Object.keys(config1), ...Object.keys(config2)]);

    keys.forEach(key => {
      const value1 = config1[key as keyof AgentConfigTemplate];
      const value2 = config2[key as keyof AgentConfigTemplate];

      if (value1 !== undefined && value2 !== undefined && 
          JSON.stringify(value1) !== JSON.stringify(value2)) {
        conflicts.push({
          key,
          value1,
          value2,
        });
      }
    });

    return conflicts;
  }

  /**
   * 合并配置（解决冲突）
   */
  public mergeConfigs(
    base: AgentConfigTemplate,
    override: Partial<AgentConfigTemplate>,
    strategy: 'override' | 'keep' | 'error' = 'override'
  ): AgentConfigTemplate {
    const conflicts = this.detectConflicts(base, override);

    if (strategy === 'error' && conflicts.length > 0) {
      throw new Error(`Configuration conflicts detected: ${JSON.stringify(conflicts)}`);
    }

    const merged: AgentConfigTemplate = { ...base };

    for (const [key, value] of Object.entries(override)) {
      if (strategy === 'keep' && merged[key as keyof AgentConfigTemplate] !== undefined) {
        continue; // 保留原有值
      }
      (merged as any)[key] = value;
    }

    return merged;
  }

  /**
   * 迁移配置到新版本
   */
  public async migrateConfig(
    oldTemplate: AgentConfigTemplate,
    newVersion: string
  ): Promise<AgentConfigTemplate> {
    const newTemplate: AgentConfigTemplate = {
      ...oldTemplate,
      templateVersion: newVersion,
      updatedAt: new Date().toISOString(),
    };

    // 版本特定的迁移逻辑
    switch (newVersion) {
      case '2.0.0':
        // 迁移到v2.0.0的特定逻辑
        if (!oldTemplate.configValidation) {
          newTemplate.configValidation = {};
        }
        break;
      // 可以添加更多版本的迁移逻辑
    }

    return newTemplate;
  }

  /**
   * 验证配置完整性
   */
  public validateConfigIntegrity(template: AgentConfigTemplate): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // 检查必需字段
    if (!template.templateVersion) {
      issues.push('Missing templateVersion');
    }
    if (!template.templateId) {
      issues.push('Missing templateId');
    }
    if (!template.model) {
      issues.push('Missing model');
    }
    if (!template.taskComplexity) {
      issues.push('Missing taskComplexity');
    }

    // 检查版本格式
    if (template.templateVersion && !/^\d+\.\d+\.\d+$/.test(template.templateVersion)) {
      issues.push('Invalid templateVersion format (should be X.Y.Z)');
    }

    // 检查超时配置一致性
    const recommendedTimeout = this.templateManager.getRecommendedTimeout(template.taskComplexity);
    if (template.runTimeoutSeconds && 
        template.taskComplexity !== TaskComplexity.L4 &&
        template.runTimeoutSeconds > recommendedTimeout * 1.5) {
      issues.push(`runTimeoutSeconds (${template.runTimeoutSeconds}) significantly exceeds recommended (${recommendedTimeout})`);
    }

    // 验证配置Schema
    const validation = this.templateManager.validateTemplate(template);
    if (!validation.isValid) {
      issues.push(...validation.errors.map(e => `[${e.path}] ${e.message}`));
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}

// ============================================================================
// 导出
// ============================================================================

export default {
  AgentConfigTemplateManager,
  EnvironmentConfigManager,
  ConfigMigrationTool,
  TaskComplexity,
};
