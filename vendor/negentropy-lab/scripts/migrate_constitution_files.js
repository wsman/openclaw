#!/usr/bin/env node
/**
 * 宪法文件迁移脚本
 * 版本: v1.0.0
 * 宪法依据: §101同步公理、§102熵减原则、§152单一真理源公理
 * 功能: 将.clinerules目录下的宪法文件迁移到memory_bank/t0_core/目录
 * 同时转换文件名为小写+下划线格式
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const CONFIG = {
  sourceDir: path.join(process.cwd(), '.clinerules'),
  targetDir: path.join(process.cwd(), 'memory_bank', 't0_core'),
  backupDir: path.join(process.cwd(), 'backup', 'constitution_migration'),
  logFile: path.join(process.cwd(), 'logs', 'migration.log'),
  
  // 文件名转换规则
  fileNameRules: {
    'activeContext.md': 'active_context.md',
    'KNOWLEDGE_GRAPH.md': 'knowledge_graph.md',
    // 其他文件名保持原样（已经是小写下划线格式）
  },
  
  // 需要更新的文件内容引用
  contentUpdates: {
    'active_context.md': {
      patterns: [
        { from: /\.clinerules\//g, to: 'memory_bank/t0_core/' },
        { from: /KNOWLEDGE_GRAPH\.md/g, to: 'knowledge_graph.md' },
        { from: /activeContext\.md/g, to: 'active_context.md' }
      ]
    },
    'knowledge_graph.md': {
      patterns: [
        { from: /\.clinerules\//g, to: 'memory_bank/t0_core/' },
        { from: /activeContext\.md/g, to: 'active_context.md' },
        { from: /KNOWLEDGE_GRAPH\.md/g, to: 'knowledge_graph.md' }
      ]
    },
    'basic_law_index.md': {
      patterns: [
        { from: /\.clinerules\//g, to: 'memory_bank/t0_core/' }
      ]
    },
    'procedural_law_index.md': {
      patterns: [
        { from: /\.clinerules\//g, to: 'memory_bank/t0_core/' }
      ]
    },
    'technical_law_index.md': {
      patterns: [
        { from: /\.clinerules\//g, to: 'memory_bank/t0_core/' }
      ]
    }
  }
};

class ConstitutionFileMigrator {
  constructor() {
    this.logs = [];
    this.migrationStats = {
      totalFiles: 0,
      migratedFiles: 0,
      renamedFiles: 0,
      updatedFiles: 0,
      errors: 0
    };
  }

  // 日志记录
  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    this.logs.push(logMessage);
    console.log(logMessage);
  }

  // 创建目录
  ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      this.log(`创建目录: ${dirPath}`);
    }
  }

  // 备份源文件
  backupSourceFiles() {
    this.log('开始备份源文件...');
    
    try {
      this.ensureDirectory(CONFIG.backupDir);
      
      // 备份.clinerules目录
      const backupPath = path.join(CONFIG.backupDir, 'clinerules_backup');
      if (fs.existsSync(CONFIG.sourceDir)) {
        execSync(`cp -r "${CONFIG.sourceDir}" "${backupPath}"`);
        this.log(`备份.clinerules目录到: ${backupPath}`);
      }
      
      // 备份memory_bank/t0_core目录（如果存在）
      if (fs.existsSync(CONFIG.targetDir)) {
        const t0BackupPath = path.join(CONFIG.backupDir, 't0_core_backup');
        execSync(`cp -r "${CONFIG.targetDir}" "${t0BackupPath}"`);
        this.log(`备份memory_bank/t0_core目录到: ${t0BackupPath}`);
      }
      
      this.log('备份完成');
      return true;
    } catch (error) {
      this.log(`备份失败: ${error.message}`, 'ERROR');
      return false;
    }
  }

  // 获取需要迁移的文件列表
  getFilesToMigrate() {
    const files = [];
    
    if (!fs.existsSync(CONFIG.sourceDir)) {
      this.log(`源目录不存在: ${CONFIG.sourceDir}`, 'WARN');
      return files;
    }
    
    const entries = fs.readdirSync(CONFIG.sourceDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push({
          sourcePath: path.join(CONFIG.sourceDir, entry.name),
          sourceName: entry.name,
          targetName: this.getTargetFileName(entry.name),
          targetPath: path.join(CONFIG.targetDir, this.getTargetFileName(entry.name))
        });
      }
    }
    
    this.log(`找到 ${files.length} 个需要迁移的文件`);
    return files;
  }

  // 获取目标文件名（小写+下划线格式）
  getTargetFileName(sourceName) {
    // 检查是否有特定的转换规则
    if (CONFIG.fileNameRules[sourceName]) {
      return CONFIG.fileNameRules[sourceName];
    }
    
    // 通用转换：如果是混合大小写，转换为小写下划线
    if (sourceName !== sourceName.toLowerCase()) {
      // 将大写字母前加下划线并转为小写
      let result = sourceName.replace(/([A-Z])/g, '_$1').toLowerCase();
      // 移除开头的下划线
      if (result.startsWith('_')) {
        result = result.substring(1);
      }
      return result;
    }
    
    // 已经是小写格式，直接返回
    return sourceName;
  }

  // 迁移单个文件
  migrateFile(fileInfo) {
    try {
      this.log(`迁移文件: ${fileInfo.sourceName} -> ${fileInfo.targetName}`);
      
      // 读取源文件内容
      const content = fs.readFileSync(fileInfo.sourcePath, 'utf8');
      
      // 更新文件内容中的引用
      let updatedContent = content;
      const targetFile = path.basename(fileInfo.targetName, '.md');
      
      if (CONFIG.contentUpdates[targetFile]) {
        const patterns = CONFIG.contentUpdates[targetFile].patterns;
        patterns.forEach(pattern => {
          updatedContent = updatedContent.replace(pattern.from, pattern.to);
        });
        this.log(`  更新文件内容引用`);
      }
      
      // 写入目标文件
      fs.writeFileSync(fileInfo.targetPath, updatedContent, 'utf8');
      
      // 记录统计
      this.migrationStats.migratedFiles++;
      if (fileInfo.sourceName !== fileInfo.targetName) {
        this.migrationStats.renamedFiles++;
      }
      if (updatedContent !== content) {
        this.migrationStats.updatedFiles++;
      }
      
      return true;
    } catch (error) {
      this.log(`迁移文件失败 ${fileInfo.sourceName}: ${error.message}`, 'ERROR');
      this.migrationStats.errors++;
      return false;
    }
  }

  // 创建单一.clinerules文件
  createSingleClinerulesFile() {
    try {
      this.log('创建单一.clinerules文件...');
      
      const singleClinerulesPath = path.join(process.cwd(), '.clinerules.new');
      const finalClinerulesPath = path.join(process.cwd(), '.clinerules');
      
      // 检查是否已存在.new文件
      if (fs.existsSync(singleClinerulesPath)) {
        this.log('单一.clinerules.new文件已存在，使用现有文件');
        
        // 备份原始的.clinerules目录
        if (fs.existsSync(finalClinerulesPath) && fs.statSync(finalClinerulesPath).isDirectory()) {
          const oldBackupPath = path.join(CONFIG.backupDir, 'clinerules_old_directory');
          execSync(`mv "${finalClinerulesPath}" "${oldBackupPath}"`);
          this.log(`备份原始.clinerules目录到: ${oldBackupPath}`);
        }
        
        // 将.new文件重命名为.clinerules
        fs.renameSync(singleClinerulesPath, finalClinerulesPath);
        this.log(`单一.clinerules文件创建完成: ${finalClinerulesPath}`);
        
        return true;
      } else {
        this.log('未找到.clinerules.new文件，需要先创建', 'WARN');
        return false;
      }
    } catch (error) {
      this.log(`创建单一.clinerules文件失败: ${error.message}`, 'ERROR');
      return false;
    }
  }

  // 验证迁移结果
  validateMigration() {
    this.log('验证迁移结果...');
    
    const validationResults = {
      passed: 0,
      failed: 0,
      details: []
    };
    
    // 检查目标目录是否存在
    if (!fs.existsSync(CONFIG.targetDir)) {
      validationResults.details.push('目标目录不存在');
      validationResults.failed++;
    } else {
      validationResults.details.push('目标目录存在 ✓');
      validationResults.passed++;
    }
    
    // 检查关键文件是否已迁移
    const requiredFiles = [
      'active_context.md',
      'knowledge_graph.md',
      'basic_law_index.md',
      'procedural_law_index.md',
      'technical_law_index.md'
    ];
    
    requiredFiles.forEach(fileName => {
      const filePath = path.join(CONFIG.targetDir, fileName);
      if (fs.existsSync(filePath)) {
        validationResults.details.push(`${fileName} 已迁移 ✓`);
        validationResults.passed++;
      } else {
        validationResults.details.push(`${fileName} 未找到 ✗`);
        validationResults.failed++;
      }
    });
    
    // 检查单一.clinerules文件
    const clinerulesPath = path.join(process.cwd(), '.clinerules');
    if (fs.existsSync(clinerulesPath)) {
      const stats = fs.statSync(clinerulesPath);
      if (stats.isFile()) {
        validationResults.details.push('单一.clinerules文件已创建 ✓');
        validationResults.passed++;
      } else {
        validationResults.details.push('.clinerules不是文件 ✗');
        validationResults.failed++;
      }
    } else {
      validationResults.details.push('.clinerules文件不存在 ✗');
      validationResults.failed++;
    }
    
    return validationResults;
  }

  // 生成迁移报告
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      config: {
        sourceDir: CONFIG.sourceDir,
        targetDir: CONFIG.targetDir,
        backupDir: CONFIG.backupDir
      },
      stats: this.migrationStats,
      logs: this.logs.slice(-100), // 只保留最后100条日志
      validation: this.validateMigration()
    };
    
    // 保存报告
    const reportPath = path.join(CONFIG.backupDir, 'migration_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    
    this.log(`迁移报告已保存到: ${reportPath}`);
    
    // 打印摘要
    console.log('\n' + '=' .repeat(60));
    console.log('📊 宪法文件迁移报告');
    console.log('=' .repeat(60));
    console.log(`📁 总文件数: ${this.migrationStats.totalFiles}`);
    console.log(`✅ 成功迁移: ${this.migrationStats.migratedFiles}`);
    console.log(`🔄 文件重命名: ${this.migrationStats.renamedFiles}`);
    console.log(`✏️ 内容更新: ${this.migrationStats.updatedFiles}`);
    console.log(`❌ 错误: ${this.migrationStats.errors}`);
    console.log('');
    
    console.log('🔍 验证结果:');
    const validation = report.validation;
    console.log(`  通过: ${validation.passed}`);
    console.log(`  失败: ${validation.failed}`);
    validation.details.forEach(detail => {
      console.log(`  ${detail}`);
    });
    
    console.log('\n' + '=' .repeat(60));
    
    return validation.failed === 0;
  }

  // 执行迁移
  run() {
    this.log('开始宪法文件迁移...');
    this.log(`源目录: ${CONFIG.sourceDir}`);
    this.log(`目标目录: ${CONFIG.targetDir}`);
    
    // 创建必要的目录
    this.ensureDirectory(CONFIG.targetDir);
    this.ensureDirectory(path.dirname(CONFIG.logFile));
    
    // 备份
    if (!this.backupSourceFiles()) {
      this.log('备份失败，停止迁移', 'ERROR');
      return false;
    }
    
    // 获取需要迁移的文件
    const filesToMigrate = this.getFilesToMigrate();
    this.migrationStats.totalFiles = filesToMigrate.length;
    
    if (filesToMigrate.length === 0) {
      this.log('没有需要迁移的文件', 'WARN');
    } else {
      // 迁移文件
      filesToMigrate.forEach(fileInfo => {
        this.migrateFile(fileInfo);
      });
    }
    
    // 创建单一.clinerules文件
    this.createSingleClinerulesFile();
    
    // 生成报告
    const success = this.generateReport();
    
    if (success) {
      this.log('宪法文件迁移完成 ✓');
    } else {
      this.log('宪法文件迁移完成，但有错误 ⚠️');
    }
    
    return success;
  }
}

// 主执行函数
function main() {
  try {
    const migrator = new ConstitutionFileMigrator();
    const success = migrator.run();
    
    if (success) {
      console.log('\n💡 后续步骤:');
      console.log('1. 验证 memory_bank/t0_core/ 目录中的文件');
      console.log('2. 检查 .clinerules 文件内容');
      console.log('3. 运行宪法合规检查: node scripts/constitution-check.js');
      console.log('4. 如有需要，可以删除备份目录: backup/constitution_migration/');
      
      process.exit(0);
    } else {
      console.log('\n⚠️ 迁移过程中出现错误，请检查日志');
      process.exit(1);
    }
  } catch (error) {
    console.error('迁移脚本执行失败:', error.message);
    process.exit(1);
  }
}

// 执行迁移
if (require.main === module) {
  console.log('🔧 Negentropy-Lab 宪法文件迁移脚本');
  console.log('宪法依据: §101同步公理、§102熵减原则、§152单一真理源公理\n');
  
  // 询问确认
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  readline.question('⚠️  此操作将迁移.clinerules目录到memory_bank/t0_core/，并创建单一.clinerules文件。是否继续？(y/N): ', (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      readline.close();
      main();
    } else {
      console.log('操作已取消');
      readline.close();
      process.exit(0);
    }
  });
}

module.exports = ConstitutionFileMigrator;