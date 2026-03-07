/**
 * 🚀 插件验证器
 * 宪法依据: §101同步公理、§102熵减原则、§108异构模型策略、§152单一真理源、§306零停机协议、§110协作效率公理
 * 
 * 插件验证器负责：
 * 1. 插件清单格式验证
 * 2. 宪法合规验证
 * 3. 依赖关系验证
 * 4. 安全配置验证
 * 
 * 版本: v1.0.0
 * 创建时间: 2026-02-11
 * 维护者: 科技部插件系统团队
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { PluginManifest, ComplianceReport, PluginType, ConstitutionCompliance } from './types';

/**
 * 🚀 插件验证器
 */
export class PluginValidator {
  private validationRules: ValidationRule[] = [];
  
  constructor() {
    this.initializeValidationRules();
  }
  
  /**
   * 初始化验证器
   */
  async initialize(): Promise<void> {
    console.log('[PluginValidator] 插件验证器初始化完成');
  }
  
  /**
   * 验证插件清单格式
   */
  async validateManifestFormat(manifestPath: string): Promise<PluginManifest> {
    console.log(`[PluginValidator] 验证插件清单格式: ${manifestPath}`);
    
    try {
      // 读取清单文件
      const content = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(content) as PluginManifest;
      
      // 基本字段验证
      if (!manifest.id || typeof manifest.id !== 'string') {
        throw new ValidationError('插件ID缺失或无效');
      }
      
      if (!manifest.name || typeof manifest.name !== 'string') {
        throw new ValidationError('插件名称缺失或无效');
      }
      
      if (!manifest.version || typeof manifest.version !== 'string') {
        throw new ValidationError('插件版本缺失或无效');
      }
      
      if (!manifest.type || !Object.values(PluginType).includes(manifest.type)) {
        throw new ValidationError(`插件类型无效，必须是以下之一: ${Object.values(PluginType).join(', ')}`);
      }
      
      if (!manifest.description || typeof manifest.description !== 'string') {
        throw new ValidationError('插件描述缺失或无效');
      }
      
      if (!manifest.author || typeof manifest.author !== 'string') {
        throw new ValidationError('插件作者缺失或无效');
      }
      
      if (!manifest.license || typeof manifest.license !== 'string') {
        throw new ValidationError('插件许可证缺失或无效');
      }
      
      if (!manifest.entryPoint || typeof manifest.entryPoint !== 'string') {
        throw new ValidationError('插件入口点缺失或无效');
      }
      
      // 宪法合规字段验证
      if (!manifest.constitutionCompliance || typeof manifest.constitutionCompliance !== 'object') {
        throw new ValidationError('宪法合规字段缺失或无效');
      }
      
      const compliance = manifest.constitutionCompliance;
      const requiredComplianceFields = ['article101', 'article102', 'article108', 'article152', 'article306', 'article110'];
      
      for (const field of requiredComplianceFields) {
        if (typeof compliance[field as keyof ConstitutionCompliance] !== 'boolean') {
          throw new ValidationError(`宪法合规字段 ${field} 缺失或不是布尔值`);
        }
      }
      
      // 验证插件ID格式 (允许字母、数字、连字符、下划线)
      const idRegex = /^[a-zA-Z0-9_-]+$/;
      if (!idRegex.test(manifest.id)) {
        throw new ValidationError('插件ID只能包含字母、数字、连字符和下划线');
      }
      
      // 验证版本号格式 (遵循semver)
      const versionRegex = /^\d+\.\d+\.\d+(-\w+(\.\w+)*)?(\+\w+(\.\w+)*)?$/;
      if (!versionRegex.test(manifest.version)) {
        throw new ValidationError('版本号必须遵循semver规范 (例如: 1.0.0, 2.1.5-alpha.1)');
      }
      
      // 验证入口点文件存在
      const pluginDir = path.dirname(manifestPath);
      const entryPointPath = path.join(pluginDir, manifest.entryPoint);
      try {
        await fs.access(entryPointPath);
      } catch {
        throw new ValidationError(`插件入口点文件不存在: ${manifest.entryPoint}`);
      }
      
      console.log(`[PluginValidator] 插件清单格式验证通过: ${manifest.name} (${manifest.id})`);
      return manifest;
      
    } catch (error: any) {
      if (error instanceof ValidationError) {
        throw error;
      }
      
      if (error instanceof SyntaxError) {
        throw new ValidationError(`JSON解析失败: ${error.message}`);
      }
      
      throw new ValidationError(`清单文件读取失败: ${error.message}`);
    }
  }
  
  /**
   * 验证宪法合规性
   */
  async validateConstitutionCompliance(manifest: PluginManifest): Promise<ComplianceReport> {
    console.log(`[PluginValidator] 验证宪法合规性: ${manifest.name} (${manifest.id})`);
    
    const checks: Array<{
      article: string;
      description: string;
      compliant: boolean;
      checkedAt: Date;
      details?: string;
      recommendations?: string[];
    }> = [];
    
    let overallCompliant = true;
    
    // 应用所有验证规则
    for (const rule of this.validationRules) {
      const result = await rule.validate(manifest);
      checks.push(...result.checks);
      
      if (!result.compliant) {
        overallCompliant = false;
      }
    }
    
    const report: ComplianceReport = {
      overallCompliant,
      checks,
      generatedAt: new Date(),
      version: '1.0.0',
    };
    
    // 添加熵值分析 (§102)
    report.entropyAnalysis = await this.analyzeEntropy(manifest);
    
    // 添加性能分析 (§110)
    report.performanceAnalysis = await this.analyzePerformance(manifest);
    
    console.log(`[PluginValidator] 宪法合规性验证完成: ${manifest.name} - ${overallCompliant ? '通过' : '未通过'}`);
    
    return report;
  }
  
  /**
   * 验证依赖关系
   */
  async validateDependencies(manifest: PluginManifest, availablePlugins: Set<string>): Promise<void> {
    const dependencies = manifest.dependencies;
    if (!dependencies) {
      return;
    }
    
    console.log(`[PluginValidator] 验证插件依赖关系: ${manifest.name}`);
    
    // 验证必需依赖
    if (dependencies.required) {
      for (const depId of dependencies.required) {
        if (!availablePlugins.has(depId)) {
          throw new DependencyValidationError(`必需依赖未找到: ${depId}`);
        }
      }
    }
    
    // 验证对等依赖
    if (dependencies.peer) {
      for (const depId of dependencies.peer) {
        if (!availablePlugins.has(depId)) {
          console.warn(`[PluginValidator] 警告: 对等依赖未找到: ${depId}，插件可能无法正常工作`);
        }
      }
    }
    
    // 验证可选依赖
    if (dependencies.optional) {
      for (const depId of dependencies.optional) {
        if (!availablePlugins.has(depId)) {
          console.warn(`[PluginValidator] 警告: 可选依赖未找到: ${depId}，某些功能可能不可用`);
        }
      }
    }
    
    console.log(`[PluginValidator] 依赖关系验证通过: ${manifest.name}`);
  }
  
  /**
   * 验证安全配置
   */
  async validateSecurity(manifest: PluginManifest): Promise<void> {
    console.log(`[PluginValidator] 验证插件安全配置: ${manifest.name}`);
    
    const permissions = manifest.permissions;
    if (!permissions) {
      return;
    }
    
    // 验证网络权限
    if (permissions.network) {
      for (const permission of permissions.network) {
        if (!['localhost', '127.0.0.1', '*.example.com'].some(allowed => permission.includes(allowed))) {
          console.warn(`[PluginValidator] 警告: 插件请求外部网络访问权限: ${permission}`);
        }
      }
    }
    
    // 验证文件系统权限
    if (permissions.filesystem) {
      for (const path of permissions.filesystem) {
        if (path.includes('..') || path.startsWith('/')) {
          console.warn(`[PluginValidator] 警告: 插件请求可能危险的文件系统权限: ${path}`);
        }
      }
    }
    
    // 验证环境变量权限
    if (permissions.environment) {
      for (const envVar of permissions.environment) {
        if (['SECRET', 'PASSWORD', 'KEY', 'TOKEN'].some(sensitive => envVar.includes(sensitive))) {
          console.warn(`[PluginValidator] 警告: 插件请求敏感环境变量权限: ${envVar}`);
        }
      }
    }
    
    console.log(`[PluginValidator] 安全配置验证完成: ${manifest.name}`);
  }
  
  /**
   * 销毁验证器
   */
  async destroy(): Promise<void> {
    console.log('[PluginValidator] 清理插件验证器...');
    this.validationRules = [];
    console.log('[PluginValidator] 插件验证器已销毁');
  }
  
  /**
   * 初始化验证规则
   */
  private initializeValidationRules(): void {
        // §101 同步公理规则
    this.validationRules.push({
      name: '§101同步公理',
      validate: async (manifest: PluginManifest) => {
        const checks: Array<{
          article: string;
          description: string;
          compliant: boolean;
          checkedAt: Date;
          details?: string;
          recommendations?: string[];
        }> = [];
        
        // 检查插件是否有文档
        const hasDocumentation = !!manifest.description && manifest.description.length > 10;
        checks.push({
          article: '§101',
          description: '插件有详细描述',
          compliant: hasDocumentation,
          checkedAt: new Date(),
          details: hasDocumentation ? '插件描述满足§101要求' : '插件描述过于简短',
          recommendations: hasDocumentation ? [] : ['添加更详细的插件描述']
        });
        
        // 检查是否有配置Schema文档
        const hasConfigSchema = !!manifest.configSchema;
        checks.push({
          article: '§101',
          description: '插件配置有Schema定义',
          compliant: hasConfigSchema,
          checkedAt: new Date(),
          details: hasConfigSchema ? '配置Schema已定义' : '配置Schema缺失',
          recommendations: hasConfigSchema ? [] : ['添加配置Schema定义']
        });
        
        return {
          compliant: hasDocumentation && hasConfigSchema,
          checks,
        };
      },
    });
    
    // §102 熵减原则规则
    this.validationRules.push({
      name: '§102熵减原则',
      validate: async (manifest: PluginManifest) => {
        const checks: Array<{
          article: string;
          description: string;
          compliant: boolean;
          checkedAt: Date;
          details?: string;
          recommendations?: string[];
        }> = [];
        
        // 检查是否有依赖声明 (复用现有组件)
        const hasDependencies = Boolean(
          (manifest.dependencies?.required?.length ?? 0) > 0 ||
          (manifest.dependencies?.optional?.length ?? 0) > 0
        );
        
        checks.push({
          article: '§102',
          description: '插件声明依赖关系以复用现有组件',
          compliant: hasDependencies,
          checkedAt: new Date(),
          details: hasDependencies ? '插件声明了依赖关系' : '插件未声明依赖关系，可能重复实现功能',
          recommendations: hasDependencies ? [] : ['检查并声明可复用的依赖插件']
        });
        
        return {
          compliant: hasDependencies,
          checks,
        };
      },
    });
    
    // §108 异构模型策略规则
    this.validationRules.push({
      name: '§108异构模型策略',
      validate: async (manifest: PluginManifest) => {
        const checks: Array<{
          article: string;
          description: string;
          compliant: boolean;
          checkedAt: Date;
          details?: string;
          recommendations?: string[];
        }> = [];
        
        // 检查是否使用了默认模型配置
        const hasModelConfiguration = !!(manifest.configSchema && 
          JSON.stringify(manifest.configSchema).includes('model'));
        
        checks.push({
          article: '§108',
          description: '插件显式配置模型参数',
          compliant: hasModelConfiguration,
          checkedAt: new Date(),
          details: hasModelConfiguration ? '插件显式配置了模型参数' : '插件可能依赖默认模型配置',
          recommendations: hasModelConfiguration ? [] : ['显式配置模型参数，避免使用默认值']
        });
        
        return {
          compliant: hasModelConfiguration,
          checks,
        };
      },
    });
    
    // §152 单一真理源规则
    this.validationRules.push({
      name: '§152单一真理源',
      validate: async (manifest: PluginManifest) => {
        const checks: Array<{
          article: string;
          description: string;
          compliant: boolean;
          checkedAt: Date;
          details?: string;
          recommendations?: string[];
        }> = [];
        
        // 检查插件配置是否在manifest中统一管理
        const hasDefaultConfig = !!manifest.defaultConfig;
        
        checks.push({
          article: '§152',
          description: '插件配置在manifest中统一管理',
          compliant: hasDefaultConfig,
          checkedAt: new Date(),
          details: hasDefaultConfig ? '默认配置已定义' : '默认配置缺失，可能导致配置分散',
          recommendations: hasDefaultConfig ? [] : ['在manifest中添加defaultConfig字段']
        });
        
        return {
          compliant: hasDefaultConfig,
          checks,
        };
      },
    });
    
    // §306 零停机协议规则
    this.validationRules.push({
      name: '§306零停机协议',
      validate: async (manifest: PluginManifest) => {
        const checks = [];
        
        // 检查是否支持热重载 (JSON清单中函数会被剥离，允许声明式lifecycle对象)
        const hasLifecycleHooks = !!manifest.lifecycle;
        
        checks.push({
          article: '§306',
          description: '插件支持热重载生命周期',
          compliant: hasLifecycleHooks,
          checkedAt: new Date(),
          details: hasLifecycleHooks ? '插件定义了生命周期钩子' : '插件未定义生命周期钩子，不支持热重载',
          recommendations: hasLifecycleHooks ? [] : ['添加onLoad和onUnload生命周期钩子']
        });
        
        return {
          compliant: hasLifecycleHooks,
          checks,
        };
      },
    });
    
    // §110 协作效率公理规则
    this.validationRules.push({
      name: '§110协作效率公理',
      validate: async (manifest: PluginManifest) => {
        const checks = [];
        
        // 检查是否有性能指标要求
        const hasPerformanceMetrics = !!manifest.performanceMetrics;
        
        checks.push({
          article: '§110',
          description: '插件定义了性能指标要求',
          compliant: hasPerformanceMetrics,
          checkedAt: new Date(),
          details: hasPerformanceMetrics ? '性能指标已定义' : '性能指标未定义，无法保证效率',
          recommendations: hasPerformanceMetrics ? [] : ['添加performanceMetrics字段定义性能要求']
        });
        
        return {
          compliant: hasPerformanceMetrics,
          checks,
        };
      },
    });
  }
  
  /**
   * 熵值分析 (§102)
   */
  private async analyzeEntropy(manifest: PluginManifest): Promise<ComplianceReport['entropyAnalysis']> {
    // 这里可以添加更复杂的熵值分析逻辑
    // 暂时返回一个简单的分析结果
    return {
      totalLines: 0, // 需要实际分析插件代码
      reusedLines: 0,
      newLines: 0,
      reuseRate: manifest.dependencies?.required?.length ? 0.5 : 0,
      entropyScore: manifest.dependencies?.required?.length ? 0.3 : 0.7,
      reusableComponents: manifest.dependencies?.required || [],
    };
  }
  
  /**
   * 性能分析 (§110)
   */
  private async analyzePerformance(manifest: PluginManifest): Promise<ComplianceReport['performanceAnalysis']> {
    // 这里可以添加更复杂的性能分析逻辑
    // 暂时返回一个简单的分析结果
    return {
      startupTimeMs: 100, // 预估启动时间
      memoryUsageMB: 10, // 预估内存使用
      apiResponseTimeMs: 50, // 预估API响应时间
      meetsRequirements: !!manifest.performanceMetrics,
    };
  }
}

// ========== 类型定义 ==========

interface ValidationRule {
  name: string;
  validate: (manifest: PluginManifest) => Promise<{
    compliant: boolean;
    checks: Array<{
      article: string;
      description: string;
      compliant: boolean;
      checkedAt: Date;
      details?: string;
      recommendations?: string[];
    }>;
  }>;
}

// ========== 错误类型 ==========

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class DependencyValidationError extends ValidationError {
  constructor(message: string) {
    super(message);
    this.name = 'DependencyValidationError';
  }
}
