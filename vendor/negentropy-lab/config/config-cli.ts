#!/usr/bin/env ts-node

/**
 * 配置模板管理CLI工具
 * 用法: npx ts-node config-cli.ts <command> [options]
 */

import {
  AgentConfigTemplateManager,
  EnvironmentConfigManager,
  ConfigMigrationTool,
  TaskComplexity,
  AgentConfigTemplate,
} from './AgentConfigTemplateManager';
import { ConfigValidator, ValidationReport } from './ConfigValidator';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// CLI类
// ============================================================================

class ConfigCLI {
  private templateManager: AgentConfigTemplateManager;
  private envManager: EnvironmentConfigManager;
  private migrationTool: ConfigMigrationTool;
  private validator: ConfigValidator;

  constructor() {
    this.templateManager = new AgentConfigTemplateManager();
    this.envManager = new EnvironmentConfigManager();
    this.migrationTool = new ConfigMigrationTool(this.templateManager);
    this.validator = new ConfigValidator(this.templateManager);
  }

  /**
   * 运行CLI
   */
  public async run(): Promise<void> {
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
      case 'list':
        await this.listTemplates();
        break;
      case 'create':
        await this.createTemplate(args.slice(1));
        break;
      case 'validate':
        await this.validateTemplate(args.slice(1));
        break;
      case 'validate-batch':
        await this.validateBatch();
        break;
      case 'diff':
        await this.diffTemplates(args.slice(1));
        break;
      case 'merge':
        await this.mergeTemplates(args.slice(1));
        break;
      case 'env':
        await this.manageEnvironment(args.slice(1));
        break;
      case 'stats':
        await this.showStats();
        break;
      case 'export':
        await this.exportTemplate(args.slice(1));
        break;
      default:
        this.showHelp();
    }
  }

  /**
   * 显示帮助
   */
  private showHelp(): void {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║     Agent Configuration Template Manager CLI v1.0.0      ║
╚═══════════════════════════════════════════════════════════╝

Usage: npx ts-node config-cli.ts <command> [options]

Commands:
  list                      List all available templates
  create <options>          Create a new template
    Options:
      --name <name>         Template name
      --complexity <L1|L2|L3|L4>
      --model <model>       Model name
      --timeout <seconds>   Timeout in seconds
      --depth <number>      Max spawn depth
      --custom              Save to custom templates directory

  validate <templateId>     Validate a specific template
  validate-batch            Validate all templates
  diff <id1> <id2>          Compare two templates
  merge <id1> <id2>         Merge two templates
  env <action>              Manage environment configurations
    Actions:
      set <name>            Set environment config (dev|staging|prod)
      get <name>            Get environment config
      list                  List all environments

  stats                     Show template statistics
  export <templateId>       Export template to JSON file

Examples:
  npx ts-node config-cli.ts list
  npx ts-node config-cli.ts create --name my-template --complexity L2 --model google-antigravity/gemini-3-pro-high
  npx ts-node config-cli.ts validate l2-medium
  npx ts-node config-cli.ts diff l1-simple l2-medium
  npx ts-node config-cli.ts env set dev
  npx ts-node config-cli.ts stats
`);
  }

  /**
   * 列出所有模板
   */
  private async listTemplates(): Promise<void> {
    const templates = this.templateManager.listTemplates();

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║              Available Configuration Templates          ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');

    if (templates.length === 0) {
      console.log('No templates found.');
      return;
    }

    templates.forEach(template => {
      console.log(`📋 ${template.id}`);
      console.log(`   Description: ${template.description || 'N/A'}`);
      console.log(`   Complexity:  ${template.complexity}`);
      console.log('');
    });
  }

  /**
   * 创建新模板
   */
  private async createTemplate(args: string[]): Promise<void> {
    const options = this.parseOptions(args);
    const name = options.name || 'custom-template';
    const complexity = (options.complexity || 'L1') as TaskComplexity;
    const model = options.model || 'google-antigravity/gemini-3-flash';
    const timeout = options.timeout ? parseInt(options.timeout) : undefined;
    const depth = options.depth ? parseInt(options.depth) : undefined;
    const isCustom = options.custom !== undefined;

    const template: AgentConfigTemplate = {
      templateVersion: '1.0.0',
      templateId: '',
      description: `Custom ${complexity} template created via CLI`,
      taskComplexity: complexity,
      model: model,
      ...(timeout && { runTimeoutSeconds: timeout }),
      ...(depth && { maxSpawnDepth: depth }),
      tags: ['custom'],
      author: 'CLI',
      category: isCustom ? 'custom' : 'standard',
    };

    const success = await this.templateManager.saveTemplate(template, isCustom);

    if (success) {
      console.log(`✅ Template created successfully: ${template.templateId}`);
      console.log(`   Complexity: ${complexity}`);
      console.log(`   Model: ${model}`);
    } else {
      console.log('❌ Failed to create template');
    }
  }

  /**
   * 验证模板
   */
  private async validateTemplate(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log('Error: template ID required');
      return;
    }

    const templateId = args[0];
    const template = await this.templateManager.loadTemplate(templateId);

    if (!template) {
      console.log(`❌ Template not found: ${templateId}`);
      return;
    }

    const report = await this.validator.validateConfig(template);
    const reportText = this.validator.generateValidationReportText(report, templateId);

    console.log(reportText);

    // 如果有错误，返回非零退出码
    if (!report.isValid) {
      process.exit(1);
    }
  }

  /**
   * 批量验证模板
   */
  private async validateBatch(): Promise<void> {
    const templates = this.templateManager.listTemplates();
    const configs: AgentConfigTemplate[] = [];

    for (const templateInfo of templates) {
      const template = await this.templateManager.loadTemplate(templateInfo.id);
      if (template) {
        configs.push(template);
      }
    }

    const report = await this.validator.validateBatch(configs);
    
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║              Batch Validation Report                    ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(report.summary);
    console.log('');

    // 显示每个模板的详细报告
    report.individualReports.forEach(({ templateId, report }) => {
      console.log(`--- ${templateId} (${report.score}/100) ---`);
      if (!report.isValid) {
        console.log('❌ INVALID');
        report.errors.forEach(error => console.log(`  ${error}`));
      } else if (report.score < 90) {
        console.log('⚠️  NEEDS IMPROVEMENT');
      } else {
        console.log('✅ VALID');
      }
      console.log('');
    });
  }

  /**
   * 比较两个模板
   */
  private async diffTemplates(args: string[]): Promise<void> {
    if (args.length < 2) {
      console.log('Error: two template IDs required');
      return;
    }

    const id1 = args[0];
    const id2 = args[1];

    const template1 = await this.templateManager.loadTemplate(id1);
    const template2 = await this.templateManager.loadTemplate(id2);

    if (!template1 || !template2) {
      console.log('❌ One or both templates not found');
      return;
    }

    const conflicts = this.validator.detectConflicts(template1, template2);
    const similarity = this.validator.calculateSimilarity(template1, template2);

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║              Template Comparison Report                  ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Template 1: ${id1}`);
    console.log(`Template 2: ${id2}`);
    console.log(`Similarity: ${similarity.score.toFixed(1)}%`);
    console.log('');
    console.log('Conflicts:');
    console.log('');

    if (conflicts.length === 0) {
      console.log('✅ No conflicts detected');
    } else {
      conflicts.forEach(conflict => {
        const emoji = conflict.severity === 'high' ? '🔴' : conflict.severity === 'medium' ? '🟡' : '🟢';
        console.log(`  ${emoji} ${conflict.field}`);
        console.log(`     Value 1: ${conflict.value1}`);
        console.log(`     Value 2: ${conflict.value2}`);
      });
    }

    console.log('');
    console.log(`Common Fields (${similarity.commonFields.length}):`);
    similarity.commonFields.forEach(field => console.log(`  - ${field}`));
    console.log('');
    console.log(`Differing Fields (${similarity.differingFields.length}):`);
    similarity.differingFields.forEach(field => console.log(`  - ${field}`));
  }

  /**
   * 合并两个模板
   */
  private async mergeTemplates(args: string[]): Promise<void> {
    if (args.length < 2) {
      console.log('Error: two template IDs required');
      return;
    }

    const id1 = args[0];
    const id2 = args[1];
    const strategy = args[2] as 'override' | 'keep' | 'error' || 'override';

    const template1 = await this.templateManager.loadTemplate(id1);
    const template2 = await this.templateManager.loadTemplate(id2);

    if (!template1 || !template2) {
      console.log('❌ One or both templates not found');
      return;
    }

    try {
      const merged = this.migrationTool.mergeConfigs(template1, template2, strategy);
      const success = await this.templateManager.saveTemplate(merged, true);

      if (success) {
        console.log(`✅ Templates merged successfully: ${merged.templateId}`);
        console.log(`   Strategy: ${strategy}`);
      } else {
        console.log('❌ Failed to save merged template');
      }
    } catch (error) {
      console.log(`❌ Merge failed: ${error}`);
    }
  }

  /**
   * 管理环境配置
   */
  private async manageEnvironment(args: string[]): Promise<void> {
    const action = args[0];

    switch (action) {
      case 'set':
        await this.setEnvironment(args.slice(1));
        break;
      case 'get':
        await this.getEnvironment(args.slice(1));
        break;
      case 'list':
        await this.listEnvironments();
        break;
      default:
        console.log('Environment commands: set, get, list');
    }
  }

  /**
   * 设置环境配置
   */
  private async setEnvironment(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log('Error: environment name required (dev|staging|prod)');
      return;
    }

    const name = args[0] as 'dev' | 'staging' | 'prod';
    
    const envConfig = {
      name,
      variables: {
        NODE_ENV: name,
        LOG_LEVEL: name === 'prod' ? 'info' : 'debug',
      },
      encrypted: [],
    };

    this.envManager.setEnvironment(name, envConfig);
    console.log(`✅ Environment '${name}' configured`);
  }

  /**
   * 获取环境配置
   */
  private async getEnvironment(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log('Error: environment name required (dev|staging|prod)');
      return;
    }

    const name = args[0] as 'dev' | 'staging' | 'prod';
    const config = this.envManager.getEnvironment(name);

    if (!config) {
      console.log(`Environment '${name}' not found`);
      return;
    }

    console.log(`Environment: ${name}`);
    console.log('Variables:');
    Object.entries(config.variables).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
  }

  /**
   * 列出所有环境
   */
  private async listEnvironments(): Promise<void> {
    const environments = ['dev', 'staging', 'prod'];

    console.log('Available Environments:');
    environments.forEach(env => {
      const config = this.envManager.getEnvironment(env as any);
      const status = config ? '✅' : '❌';
      console.log(`  ${status} ${env}`);
    });
  }

  /**
   * 显示统计信息
   */
  private async showStats(): Promise<void> {
    const stats = this.templateManager.getTemplateStats();

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║              Template Statistics                        ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`Total Templates: ${stats.total}`);
    console.log(`Standard Templates: ${stats.standard}`);
    console.log(`Custom Templates: ${stats.custom}`);
    console.log('');
    console.log('By Complexity:');
    console.log(`  L1 (Simple):    ${stats.byComplexity.L1}`);
    console.log(`  L2 (Medium):    ${stats.byComplexity.L2}`);
    console.log(`  L3 (Complex):   ${stats.byComplexity.L3}`);
    console.log(`  L4 (Ultra):     ${stats.byComplexity.L4}`);
  }

  /**
   * 导出模板
   */
  private async exportTemplate(args: string[]): Promise<void> {
    if (args.length === 0) {
      console.log('Error: template ID required');
      return;
    }

    const templateId = args[0];
    const template = await this.templateManager.loadTemplate(templateId);

    if (!template) {
      console.log(`❌ Template not found: ${templateId}`);
      return;
    }

    const outputPath = path.join(process.cwd(), `${templateId}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(template, null, 2), 'utf-8');
    
    console.log(`✅ Template exported to: ${outputPath}`);
  }

  /**
   * 解析命令行选项
   */
  private parseOptions(args: string[]): Record<string, string> {
    const options: Record<string, string> = {};

    for (let i = 0; i < args.length; i += 2) {
      const key = args[i].replace(/^--/, '');
      const value = args[i + 1];
      if (value !== undefined) {
        options[key] = value;
      }
    }

    return options;
  }
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  const cli = new ConfigCLI();
  await cli.run();
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
