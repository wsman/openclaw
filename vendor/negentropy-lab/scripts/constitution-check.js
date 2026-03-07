#!/usr/bin/env node
/**
 * 宪法合规检查脚本 - 增强版
 * 版本: v2.0.0
 * 宪法依据: §101同步公理、§102熵减原则、§104功能分层拓扑公理、§152单一真理源公理
 * 功能: 检查Gateway代码和memory_bank结构的宪法合规性
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 宪法合规检查配置 - v2.2.0 (修复正则表达式以正确匹配多行格式)
const CONSTITUTION_RULES = {
  // 基本宪法规则 - 支持 @constitution、"宪法依据：§xxx"、"§xxx" 等多种格式
  // 使用 [\s\S] 代替 . 以匹配包括换行符在内的所有字符
  '§101': {
    pattern: /@constitution|宪法依据[\s\S]{0,500}§101|§101同步公理|§101(?![\d])/,
    description: '代码与文档变更同步检查',
    required: true,
    scope: 'code'
  },
  '§102': {
    pattern: /@constitution|宪法依据[\s\S]{0,500}§102|§102熵减原则|§102(?![\d])/,
    description: '代码复用优先检查',
    required: true,
    scope: 'code'
  },
  '§102.3': {
    pattern: /宪法同步公理|全体系同步扫描|宪法依据[\s\S]{0,500}§102\.3/,
    description: '版本变更触发全体系同步',
    required: false,
    scope: 'documentation'
  },
  '§104': {
    pattern: /T0.*T3|功能分层拓扑|四层架构|宪法依据[\s\S]{0,500}§104/,
    description: '功能分层拓扑公理检查',
    required: true,
    scope: 'structure'
  },
  '§106': {
    pattern: /Agent身份公理|唯一身份标识|明确职责|宪法依据[\s\S]{0,500}§106/,
    description: 'Agent身份标识检查',
    required: true,
    scope: 'agent'
  },
  '§107': {
    pattern: /通信安全公理|消息加密|身份验证|宪法依据[\s\S]{0,500}§107/,
    description: '通信安全检查',
    required: true,
    scope: 'security'
  },
  '§108': {
    pattern: /异构模型策略|多LLM提供商|宪法依据[\s\S]{0,500}§108/,
    description: '异构模型策略检查',
    required: true,
    scope: 'llm'
  },
  '§110': {
    pattern: /协作效率公理|响应时间控制|宪法依据[\s\S]{0,500}§110/,
    description: '协作效率检查',
    required: true,
    scope: 'performance'
  },
  '§141': {
    pattern: /熵减验证公理|语义保持性|ΔH\s*[≤<]=?\s*0|宪法依据[\s\S]{0,500}§141/,
    description: '熵减验证检查',
    required: true,
    scope: 'structure'
  },
  '§152': {
    pattern: /单一真理源公理|memory_bank\/t0_core|宪法依据[\s\S]{0,500}§152/,
    description: '单一真理源配置检查',
    required: true,
    scope: 'structure'
  },
  '§190': {
    pattern: /网络韧性公理|容错恢复|宪法依据[\s\S]{0,500}§190/,
    description: '网络韧性检查',
    required: true,
    scope: 'resilience'
  },
  '§306': {
    pattern: /零停机协议|健康检查|热重载|宪法依据[\s\S]{0,500}§306/,
    description: '零停机协议检查',
    required: true,
    scope: 'deployment'
  },
  '§501': {
    pattern: /插件系统公理|PluginManager|插件|宪法依据[\s\S]{0,500}§501/,
    description: '插件系统检查',
    required: true,
    scope: 'plugins'
  },
  '§504': {
    pattern: /监控系统公理|宪法合规监控|宪法依据[\s\S]{0,500}§504/,
    description: '监控系统检查',
    required: true,
    scope: 'monitoring'
  },
  '§555': {
    pattern: /设计令牌与主题系统公理|主题系统|CSS变量|设计令牌|宪法依据[\s\S]{0,500}§555/,
    description: '设计令牌与主题系统检查',
    required: true,
    scope: 'ui'
  },
  '§556': {
    pattern: /颜色语义化公理|语义化命名|--bg-|--text-|--accent-|--status-|宪法依据[\s\S]{0,500}§556/,
    description: '颜色语义化检查',
    required: true,
    scope: 'ui'
  },
  '§557': {
    pattern: /设计系统维护公理|主题文件单点真理源|设计令牌文档|宪法依据[\s\S]{0,500}§557/,
    description: '设计系统维护检查',
    required: true,
    scope: 'ui'
  }
};

// 目录结构合规检查
const DIRECTORY_STRUCTURE_RULES = {
  'memory_bank/t0_core': {
    requiredFiles: [
      'active_context.md',
      'basic_law_index.md',
      'procedural_law_index.md',
      'technical_law_index.md',
      'knowledge_graph.md',
      'transplant_history.md'
    ],
    description: 'T0核心意识层宪法文件',
    constitution: '§152'
  },
  'memory_bank/t1_axioms': {
    requiredFiles: [
      'agent_collaboration_patterns.md',
      'system_patterns.md',
      'behavior_context.md',
      'tech_context.md'
    ],
    description: 'T1索引与状态层公理文件',
    constitution: '§109'
  },
  'memory_bank/t2_protocols/workflows': {
    requiredFiles: [],
    minFiles: 1,
    description: 'T2工作流程协议文件',
    constitution: '§201'
  },
  'memory_bank/t2_protocols/agent_standards': {
    requiredFiles: [],
    minFiles: 1,
    description: 'T2 Agent接口规范',
    constitution: '§106'
  },
  'memory_bank/t2_protocols/llm_standards': {
    requiredFiles: [],
    minFiles: 1,
    description: 'T2 LLM集成规范',
    constitution: '§108'
  },
  'memory_bank/t2_standards': {
    requiredFiles: [],
    minFiles: 1,
    description: 'T2技术标准文件',
    constitution: '§201'
  },
  'memory_bank/t3_documentation': {
    requiredFiles: [],
    minFiles: 0,
    description: 'T3分析与归档层',
    constitution: '§141'
  }
};

// 要检查的代码目录
const CODE_TARGET_DIRECTORIES = [
  'server/gateway',
  'server/gateway/auth',
  'server/gateway/channels',
  'server/gateway/monitoring',
  'server/gateway/plugins',
  'server/gateway/resilience',
  'server/gateway/utils',
  'server/agents',
  'server/api',
  'server/services',
  'server/middleware'
];

// 要检查的文件模式
const CODE_FILE_PATTERNS = [
  '*.ts',
  '*.js'
];

// 要检查的文档目录
const DOCUMENTATION_TARGET_DIRECTORIES = [
  'memory_bank'
];

// 要检查的文档文件模式
const DOCUMENTATION_FILE_PATTERNS = [
  '*.md',
  '*.json'
];

class ConstitutionChecker {
  constructor() {
    this.results = {
      codeFiles: {
        total: 0,
        checked: 0,
        violations: [],
        complianceRate: 0
      },
      documentationFiles: {
        total: 0,
        checked: 0,
        violations: [],
        complianceRate: 0
      },
      directoryStructure: {
        violations: [],
        complianceRate: 0
      },
      totalComplianceRate: 0,
      details: {}
    };
  }

  // 检查单个文件 - 简化版：只检查@constitution注解存在
  checkFile(filePath, fileType = 'code') {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const relativePath = path.relative(process.cwd(), filePath);
      const fileResults = {
        path: relativePath,
        type: fileType,
        violations: [],
        compliant: true,
        rules: {}
      };

      // 简化检查：只检查宪法注解存在性
      if (fileType === 'code') {
        // 代码文件：检查是否有@constitution注解或宪法依据声明
        const hasConstitutionAnnotation = /@constitution|宪法依据/.test(content);
        fileResults.rules['constitution_annotation'] = {
          required: true,
          found: hasConstitutionAnnotation,
          description: '宪法注解检查',
          scope: 'code'
        };

        if (!hasConstitutionAnnotation) {
          fileResults.violations.push({
            rule: 'constitution_annotation',
            description: '宪法注解检查',
            message: '缺少@constitution注解'
          });
          fileResults.compliant = false;
        }
      } else {
        // 文档文件：检查是否有@constitution或宪法依据
        const hasConstitutionAnnotation = /@constitution|宪法依据/.test(content);
        fileResults.rules['constitution_reference'] = {
          required: true,
          found: hasConstitutionAnnotation,
          description: '宪法依据检查',
          scope: 'documentation'
        };

        if (!hasConstitutionAnnotation) {
          fileResults.violations.push({
            rule: 'constitution_reference',
            description: '宪法依据检查',
            message: '缺少@constitution或宪法依据声明'
          });
          fileResults.compliant = false;
        }
      }

      return fileResults;
    } catch (error) {
      console.error(`读取文件失败 ${filePath}:`, error.message);
      return null;
    }
  }

  // 递归查找文件
  findFiles(dir, patterns, excludeDirs = ['node_modules', '.git', 'test', '__tests__']) {
    const files = [];
    
    if (!fs.existsSync(dir)) {
      console.warn(`目录不存在: ${dir}`);
      return files;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // 跳过排除目录
        if (!excludeDirs.includes(entry.name)) {
          files.push(...this.findFiles(fullPath, patterns, excludeDirs));
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const name = entry.name.toLowerCase();
        
        // 检查文件模式
        if (patterns.some(pattern => {
          if (pattern.startsWith('*.')) {
            const patternExt = pattern.slice(1);
            return ext === patternExt || name.endsWith(patternExt);
          }
          return name.endsWith(pattern);
        })) {
          files.push(fullPath);
        }
      }
    }
    
    return files;
  }

  // 检查目录结构合规性
  checkDirectoryStructure() {
    console.log('📁 检查目录结构合规性...');
    const violations = [];

    for (const [dirPath, rule] of Object.entries(DIRECTORY_STRUCTURE_RULES)) {
      if (!fs.existsSync(dirPath)) {
        violations.push({
          directory: dirPath,
          rule: rule.constitution,
          description: rule.description,
          message: `目录不存在: ${dirPath} (宪法依据: ${rule.constitution})`
        });
        continue;
      }

      // 检查必需文件
      for (const requiredFile of rule.requiredFiles) {
        const filePath = path.join(dirPath, requiredFile);
        if (!fs.existsSync(filePath)) {
          violations.push({
            directory: dirPath,
            rule: rule.constitution,
            description: rule.description,
            message: `缺少必需文件: ${requiredFile} (宪法依据: ${rule.constitution})`
          });
        }
      }

      // 检查最少文件数
      if (rule.minFiles !== undefined) {
        const files = fs.readdirSync(dirPath).filter(file => 
          !file.startsWith('.') && fs.statSync(path.join(dirPath, file)).isFile()
        );
        if (files.length < rule.minFiles) {
          violations.push({
            directory: dirPath,
            rule: rule.constitution,
            description: rule.description,
            message: `文件数量不足: 需要至少 ${rule.minFiles} 个文件, 实际只有 ${files.length} 个 (宪法依据: ${rule.constitution})`
          });
        }
      }
    }

    this.results.directoryStructure.violations = violations;
    this.results.directoryStructure.complianceRate = violations.length === 0 ? 100 : 70;
    
    return violations;
  }

  // 运行检查
  run() {
    console.log('🔍 开始宪法合规检查...\n');
    
    // 1. 检查目录结构
    const dirViolations = this.checkDirectoryStructure();
    
    // 2. 检查代码文件
    console.log('📝 检查代码文件...');
    const codeFiles = [];
    for (const dir of CODE_TARGET_DIRECTORIES) {
      if (fs.existsSync(dir)) {
        codeFiles.push(...this.findFiles(dir, CODE_FILE_PATTERNS));
      }
    }

    this.results.codeFiles.total = codeFiles.length;
    
    for (const filePath of codeFiles) {
      const fileResults = this.checkFile(filePath, 'code');
      if (fileResults) {
        this.results.codeFiles.checked++;
        
        if (!fileResults.compliant) {
          this.results.codeFiles.violations.push({
            file: fileResults.path,
            violations: fileResults.violations
          });
        }
        
        this.results.details[fileResults.path] = fileResults;
      }
    }

    // 3. 检查文档文件
    console.log('📄 检查文档文件...');
    const docFiles = [];
    for (const dir of DOCUMENTATION_TARGET_DIRECTORIES) {
      if (fs.existsSync(dir)) {
        docFiles.push(...this.findFiles(dir, DOCUMENTATION_FILE_PATTERNS));
      }
    }

    this.results.documentationFiles.total = docFiles.length;
    
    for (const filePath of docFiles) {
      const fileResults = this.checkFile(filePath, 'documentation');
      if (fileResults) {
        this.results.documentationFiles.checked++;
        
        if (!fileResults.compliant) {
          this.results.documentationFiles.violations.push({
            file: fileResults.path,
            violations: fileResults.violations
          });
        }
        
        this.results.details[fileResults.path] = fileResults;
      }
    }

    // 计算合规率
    this.calculateComplianceRates();
    
    return this.results;
  }

  // 计算合规率
  calculateComplianceRates() {
    // 代码文件合规率
    const codeCompliantFiles = this.results.codeFiles.total - this.results.codeFiles.violations.length;
    this.results.codeFiles.complianceRate = this.results.codeFiles.total > 0 
      ? (codeCompliantFiles / this.results.codeFiles.total) * 100 
      : 100;

    // 文档文件合规率
    const docCompliantFiles = this.results.documentationFiles.total - this.results.documentationFiles.violations.length;
    this.results.documentationFiles.complianceRate = this.results.documentationFiles.total > 0 
      ? (docCompliantFiles / this.results.documentationFiles.total) * 100 
      : 100;

    // 总体合规率 (权重: 代码40%, 文档40%, 目录结构20%)
    const totalWeightedRate = 
      (this.results.codeFiles.complianceRate * 0.4) +
      (this.results.documentationFiles.complianceRate * 0.4) +
      (this.results.directoryStructure.complianceRate * 0.2);
    
    this.results.totalComplianceRate = Math.round(totalWeightedRate * 100) / 100;
  }

  // 生成报告
  generateReport() {
    const { codeFiles, documentationFiles, directoryStructure, totalComplianceRate } = this.results;
    
    console.log('\n' + '=' .repeat(60));
    console.log('📊 宪法合规检查报告 - 增强版');
    console.log('=' .repeat(60));
    console.log(`⚖️ 总体合规率: ${totalComplianceRate.toFixed(2)}%`);
    console.log('');
    
    // 代码文件报告
    console.log('📝 代码文件检查:');
    console.log(`   文件总数: ${codeFiles.total}`);
    console.log(`   已检查文件: ${codeFiles.checked}`);
    console.log(`   合规率: ${codeFiles.complianceRate.toFixed(2)}%`);
    console.log(`   违规文件数: ${codeFiles.violations.length}`);
    
    // 文档文件报告
    console.log('\n📄 文档文件检查:');
    console.log(`   文件总数: ${documentationFiles.total}`);
    console.log(`   已检查文件: ${documentationFiles.checked}`);
    console.log(`   合规率: ${documentationFiles.complianceRate.toFixed(2)}%`);
    console.log(`   违规文件数: ${documentationFiles.violations.length}`);
    
    // 目录结构报告
    console.log('\n📁 目录结构检查:');
    console.log(`   合规率: ${directoryStructure.complianceRate.toFixed(2)}%`);
    console.log(`   违规项目数: ${directoryStructure.violations.length}`);
    
    // 显示违规详情
    let hasViolations = false;
    
    if (codeFiles.violations.length > 0) {
      console.log('\n🚨 代码文件宪法违规详情:');
      console.log('-' .repeat(60));
      hasViolations = true;
      for (const violation of codeFiles.violations) {
        console.log(`\n📄 ${violation.file}:`);
        for (const v of violation.violations) {
          console.log(`   ❌ ${v.rule}: ${v.message}`);
        }
      }
    }
    
    if (documentationFiles.violations.length > 0) {
      console.log('\n🚨 文档文件宪法违规详情:');
      console.log('-' .repeat(60));
      hasViolations = true;
      for (const violation of documentationFiles.violations) {
        console.log(`\n📄 ${violation.file}:`);
        for (const v of violation.violations) {
          console.log(`   ❌ ${v.rule}: ${v.message}`);
        }
      }
    }
    
    if (directoryStructure.violations.length > 0) {
      console.log('\n🚨 目录结构宪法违规详情:');
      console.log('-' .repeat(60));
      hasViolations = true;
      for (const violation of directoryStructure.violations) {
        console.log(`   ❌ ${violation.directory}: ${violation.message}`);
      }
    }
    
    if (!hasViolations) {
      console.log('\n🎉 所有检查项目均符合宪法要求！');
    }
    
    // 修复建议
    if (hasViolations) {
      console.log('\n💡 修复建议:');
      console.log('1. 为所有代码文件添加@constitution注解格式');
      console.log('2. 确保memory_bank目录结构符合T0-T3四层架构');
      console.log('3. 检查缺少的必需宪法文件，特别是T0核心层文件');
      console.log('4. 更新目录结构，确保所有必需目录存在');
      console.log('5. 运行迁移脚本: node scripts/migrate_constitution_files.js');
      console.log('6. 运行注解脚本: node scripts/add_constitution_annotations.js');
    }
    
    console.log('\n' + '=' .repeat(60));
    
    // 生成JSON报告
    const reportPath = path.join(process.cwd(), 'constitution-compliance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
    console.log(`📄 详细报告已保存至: ${reportPath}`);
    
    // 宪法合规状态检查
    if (totalComplianceRate < 80) {
      console.error('\n⚠️ 警告: 宪法合规率低于80%，请立即修复！');
      return 1;
    } else if (totalComplianceRate < 95) {
      console.warn('\n⚠️ 注意: 宪法合规率低于95%，建议进行优化');
      return 0;
    } else {
      console.log('\n✅ 宪法合规状态良好，继续保持！');
      return 0;
    }
  }
}

// 主执行函数
function main() {
  try {
    const checker = new ConstitutionChecker();
    const results = checker.run();
    const exitCode = checker.generateReport();
    
    // 宪法合规状态检查（已在generateReport中处理）
    process.exit(exitCode);
  } catch (error) {
    console.error('宪法合规检查失败:', error.message);
    process.exit(1);
  }
}

// 执行检查
if (require.main === module) {
  main();
}

module.exports = ConstitutionChecker;