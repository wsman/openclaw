/**
 * 配置模板系统使用示例
 * 
 * 本文件展示了如何使用配置模板管理系统的各项功能
 */

import {
  AgentConfigTemplateManager,
  EnvironmentConfigManager,
  ConfigMigrationTool,
  TaskComplexity,
  AgentConfigTemplate,
} from './AgentConfigTemplateManager';
import { ConfigValidator } from './ConfigValidator';

// ============================================================================
// 示例1: 基本模板管理
// ============================================================================

async function example1_BasicTemplateManagement() {
  console.log('=== 示例1: 基本模板管理 ===\n');

  const manager = new AgentConfigTemplateManager();

  // 1. 列出所有模板
  console.log('1. 列出所有模板:');
  const templates = manager.listTemplates();
  templates.forEach(t => {
    console.log(`   - ${t.id}: ${t.description} (${t.complexity})`);
  });
  console.log('');

  // 2. 加载标准模板
  console.log('2. 加载L2标准模板:');
  const l2Template = await manager.loadTemplate('l2-medium');
  if (l2Template) {
    console.log(`   模板ID: ${l2Template.templateId}`);
    console.log(`   描述: ${l2Template.description}`);
    console.log(`   模型: ${l2Template.model}`);
    console.log(`   超时: ${l2Template.runTimeoutSeconds}秒`);
    console.log(`   深度: ${l2Template.maxSpawnDepth}`);
  }
  console.log('');
}

// ============================================================================
// 示例2: 创建自定义模板
// ============================================================================

async function example2_CreateCustomTemplate() {
  console.log('=== 示例2: 创建自定义模板 ===\n');

  const manager = new AgentConfigTemplateManager();

  const customTemplate: AgentConfigTemplate = {
    templateVersion: '1.0.0',
    templateId: '',
    description: '我的自定义L3任务模板',
    taskComplexity: TaskComplexity.L3,
    model: 'google-antigravity/gemini-3-pro-high',
    runTimeoutSeconds: 2700,
    maxSpawnDepth: 5,
    tags: ['custom', 'L3', 'system-integration'],
    author: 'My Team',
    category: 'custom',
    environmentVariables: {
      NODE_ENV: 'staging',
      LOG_LEVEL: 'debug',
      ENABLE_METRICS: 'true',
    },
  };

  const success = await manager.saveTemplate(customTemplate, true);
  
  if (success) {
    console.log(`✅ 自定义模板创建成功: ${customTemplate.templateId}`);
    console.log(`   复杂度: ${customTemplate.taskComplexity}`);
    console.log(`   模型: ${customTemplate.model}`);
  } else {
    console.log('❌ 模板创建失败');
  }
  console.log('');
}

// ============================================================================
// 示例3: 配置验证
// ============================================================================

async function example3_ConfigurationValidation() {
  console.log('=== 示例3: 配置验证 ===\n');

  const manager = new AgentConfigTemplateManager();
  const validator = new ConfigValidator(manager);

  // 验证标准模板
  const template = await manager.loadTemplate('l2-medium');
  if (!template) {
    console.log('❌ 无法加载模板');
    return;
  }

  console.log('验证L2模板:');
  const report = await validator.validateConfig(template);

  console.log(`   状态: ${report.isValid ? '✅ 有效' : '❌ 无效'}`);
  console.log(`   分数: ${report.score}/100`);
  
  if (report.errors.length > 0) {
    console.log(`   错误:`);
    report.errors.forEach(error => console.log(`     - ${error}`));
  }

  if (report.warnings.length > 0) {
    console.log(`   警告:`);
    report.warnings.forEach(warning => console.log(`     - ${warning}`));
  }

  if (report.suggestions.length > 0) {
    console.log(`   建议:`);
    report.suggestions.forEach(suggestion => console.log(`     - ${suggestion}`));
  }
  console.log('');
}

// ============================================================================
// 示例4: 批量验证
// ============================================================================

async function example4_BatchValidation() {
  console.log('=== 示例4: 批量验证 ===\n');

  const manager = new AgentConfigTemplateManager();
  const validator = new ConfigValidator(manager);

  // 加载所有模板
  const templateIds = ['l1-simple', 'l2-medium', 'l3-complex', 'l4-ultra'];
  const configs: AgentConfigTemplate[] = [];

  for (const id of templateIds) {
    const template = await manager.loadTemplate(id);
    if (template) {
      configs.push(template);
    }
  }

  // 批量验证
  const batchReport = await validator.validateBatch(configs);

  console.log('批量验证结果:');
  console.log(`   总数: ${batchReport.total}`);
  console.log(`   有效: ${batchReport.valid} (${((batchReport.valid / batchReport.total) * 100).toFixed(1)}%)`);
  console.log(`   无效: ${batchReport.invalid} (${((batchReport.invalid / batchReport.total) * 100).toFixed(1)}%)`);
  console.log(`   平均分数: ${batchReport.averageScore.toFixed(1)}/100`);
  console.log('');

  // 显示详细报告
  batchReport.individualReports.forEach(({ templateId, report }) => {
    const status = report.isValid ? '✅' : '❌';
    console.log(`${status} ${templateId}: ${report.score}/100`);
  });
  console.log('');
}

// ============================================================================
// 示例5: 冲突检测
// ============================================================================

async function example5_ConflictDetection() {
  console.log('=== 示例5: 冲突检测 ===\n');

  const manager = new AgentConfigTemplateManager();
  const validator = new ConfigValidator(manager);

  const template1 = await manager.loadTemplate('l1-simple');
  const template2 = await manager.loadTemplate('l2-medium');

  if (!template1 || !template2) {
    console.log('❌ 无法加载模板');
    return;
  }

  console.log('比较L1和L2模板:');
  const conflicts = validator.detectConflicts(template1, template2);

  if (conflicts.length === 0) {
    console.log('   ✅ 未检测到冲突');
  } else {
    console.log(`   检测到 ${conflicts.length} 个冲突:`);
    conflicts.forEach(conflict => {
      const emoji = conflict.severity === 'high' ? '🔴' : 
                    conflict.severity === 'medium' ? '🟡' : '🟢';
      console.log(`   ${emoji} ${conflict.field}:`);
      console.log(`      值1: ${conflict.value1}`);
      console.log(`      值2: ${conflict.value2}`);
    });
  }

  // 计算相似度
  const similarity = validator.calculateSimilarity(template1, template2);
  console.log(`\n   相似度: ${similarity.score.toFixed(1)}%`);
  console.log(`   共同字段: ${similarity.commonFields.join(', ')}`);
  console.log(`   差异字段: ${similarity.differingFields.join(', ')}`);
  console.log('');
}

// ============================================================================
// 示例6: 环境配置管理
// ============================================================================

async function example6_EnvironmentManagement() {
  console.log('=== 示例6: 环境配置管理 ===\n');

  const envManager = new EnvironmentConfigManager();

  // 设置开发环境
  console.log('1. 设置开发环境:');
  envManager.setEnvironment('dev', {
    name: 'dev',
    variables: {
      NODE_ENV: 'development',
      LOG_LEVEL: 'debug',
      API_KEY: 'dev-api-key-123',
    },
    encrypted: [],
  });
  console.log('   ✅ 开发环境已配置');

  // 设置生产环境
  console.log('\n2. 设置生产环境:');
  envManager.setEnvironment('prod', {
    name: 'prod',
    variables: {
      NODE_ENV: 'production',
      LOG_LEVEL: 'info',
      API_KEY: 'prod-api-key-456',
    },
    encrypted: ['API_KEY'],
  });
  console.log('   ✅ 生产环境已配置');

  // 获取环境变量
  console.log('\n3. 获取环境变量:');
  const devVars = envManager.getEnvironmentVariables('dev');
  console.log('   开发环境变量:');
  Object.entries(devVars).forEach(([key, value]) => {
    console.log(`     ${key}: ${value}`);
  });

  const prodVars = envManager.getEnvironmentVariables('prod');
  console.log('\n   生产环境变量:');
  Object.entries(prodVars).forEach(([key, value]) => {
    console.log(`     ${key}: ${value} (已加密)`);
  });
  console.log('');
}

// ============================================================================
// 示例7: 配置合并
// ============================================================================

async function example7_ConfigMerging() {
  console.log('=== 示例7: 配置合并 ===\n');

  const manager = new AgentConfigTemplateManager();
  const migrationTool = new ConfigMigrationTool(manager);

  const baseTemplate = await manager.loadTemplate('l2-medium');
  if (!baseTemplate) {
    console.log('❌ 无法加载基础模板');
    return;
  }

  console.log('1. 基础模板:');
  console.log(`   模型: ${baseTemplate.model}`);
  console.log(`   超时: ${baseTemplate.runTimeoutSeconds}秒`);

  const override: Partial<AgentConfigTemplate> = {
    model: 'google-antigravity/gemini-3-pro-high',
    runTimeoutSeconds: 2400,
    tags: ['custom', 'extended'],
  };

  console.log('\n2. 覆盖配置:');
  console.log(`   模型: ${override.model}`);
  console.log(`   超时: ${override.runTimeoutSeconds}秒`);

  // 合并配置（覆盖策略）
  console.log('\n3. 合并配置（覆盖策略）:');
  const merged = migrationTool.mergeConfigs(baseTemplate, override, 'override');
  console.log(`   合并后模型: ${merged.model}`);
  console.log(`   合并后超时: ${merged.runTimeoutSeconds}秒`);
  console.log(`   合并后标签: ${merged.tags?.join(', ')}`);
  console.log('');
}

// ============================================================================
// 示例8: 统计信息
// ============================================================================

async function example8_Statistics() {
  console.log('=== 示例8: 统计信息 ===\n');

  const manager = new AgentConfigTemplateManager();
  const stats = manager.getTemplateStats();

  console.log('模板统计:');
  console.log(`   总数: ${stats.total}`);
  console.log(`   标准模板: ${stats.standard}`);
  console.log(`   自定义模板: ${stats.custom}`);
  console.log('');

  console.log('按复杂度分类:');
  console.log(`   L1 (简单):    ${stats.byComplexity.L1}`);
  console.log(`   L2 (中等):    ${stats.byComplexity.L2}`);
  console.log(`   L3 (复杂):    ${stats.byComplexity.L3}`);
  console.log(`   L4 (超复杂):  ${stats.byComplexity.L4}`);
  console.log('');
}

// ============================================================================
// 示例9: 版本迁移
// ============================================================================

async function example9_VersionMigration() {
  console.log('=== 示例9: 版本迁移 ===\n');

  const manager = new AgentConfigTemplateManager();
  const migrationTool = new ConfigMigrationTool(manager);

  const oldTemplate = await manager.loadTemplate('l1-simple');
  if (!oldTemplate) {
    console.log('❌ 无法加载模板');
    return;
  }

  console.log('1. 原始模板:');
  console.log(`   版本: ${oldTemplate.templateVersion}`);
  console.log(`   模板ID: ${oldTemplate.templateId}`);

  console.log('\n2. 迁移到v2.0.0:');
  const newTemplate = await migrationTool.migrateConfig(oldTemplate, '2.0.0');

  console.log(`   新版本: ${newTemplate.templateVersion}`);
  console.log(`   更新时间: ${newTemplate.updatedAt}`);
  console.log('   ✅ 迁移成功');
  console.log('');
}

// ============================================================================
// 示例10: 完整工作流
// ============================================================================

async function example10_CompleteWorkflow() {
  console.log('=== 示例10: 完整工作流 ===\n');

  const manager = new AgentConfigTemplateManager();
  const validator = new ConfigValidator(manager);
  const envManager = new EnvironmentConfigManager();
  const migrationTool = new ConfigMigrationTool(manager);

  // 步骤1: 创建自定义模板
  console.log('步骤1: 创建自定义模板');
  const customTemplate: AgentConfigTemplate = {
    templateVersion: '1.0.0',
    templateId: '',
    description: '我的自定义L2分析模板',
    taskComplexity: TaskComplexity.L2,
    model: 'google-antigravity/gemini-3-pro-high',
    runTimeoutSeconds: 1800,
    maxSpawnDepth: 4,
    tags: ['custom', 'analysis', 'L2'],
    author: 'Data Team',
    category: 'custom',
  };

  await manager.saveTemplate(customTemplate, true);
  console.log(`✅ 模板创建: ${customTemplate.templateId}\n`);

  // 步骤2: 验证配置
  console.log('步骤2: 验证配置');
  const report = await validator.validateConfig(customTemplate);
  console.log(`   分数: ${report.score}/100`);
  console.log(`   状态: ${report.isValid ? '✅ 有效' : '❌ 无效'}\n`);

  // 步骤3: 配合环境
  console.log('步骤3: 配置环境变量');
  envManager.setEnvironment('staging', {
    name: 'staging',
    variables: {
      NODE_ENV: 'staging',
      LOG_LEVEL: 'info',
      DATA_SOURCE: 'mixed',
    },
    encrypted: [],
  });

  const merged = envManager.mergeEnvironmentVariables(customTemplate, 'staging');
  console.log(`   环境变量合并: ${Object.keys(merged.environmentVariables || {}).length} 个\n`);

  // 步骤4: 导出配置
  console.log('步骤4: 准备导出');
  console.log(`   最终配置: ${merged.templateId}`);
  console.log(`   复杂度: ${merged.taskComplexity}`);
  console.log(`   模型: ${merged.model}`);
  console.log(`   超时: ${merged.runTimeoutSeconds}秒`);
  console.log('   ✅ 工作流完成\n`);
}

// ============================================================================
// 主函数
// ============================================================================

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       配置模板管理系统 - 使用示例集合                    ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    await example1_BasicTemplateManagement();
    await example2_CreateCustomTemplate();
    await example3_ConfigurationValidation();
    await example4_BatchValidation();
    await example5_ConflictDetection();
    await example6_EnvironmentManagement();
    await example7_ConfigMerging();
    await example8_Statistics();
    await example9_VersionMigration();
    await example10_CompleteWorkflow();

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║              所有示例执行完成                          ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
  } catch (error) {
    console.error('❌ 执行出错:', error);
    process.exit(1);
  }
}

// 运行示例
if (require.main === module) {
  main();
}

export {
  example1_BasicTemplateManagement,
  example2_CreateCustomTemplate,
  example3_ConfigurationValidation,
  example4_BatchValidation,
  example5_ConflictDetection,
  example6_EnvironmentManagement,
  example7_ConfigMerging,
  example8_Statistics,
  example9_VersionMigration,
  example10_CompleteWorkflow,
};
