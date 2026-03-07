#!/usr/bin/env node
/**
 * 添加宪法注解脚本
 * 版本: v1.0.0
 * 宪法依据: §101同步公理、§102熵减原则
 * 功能: 扫描TypeScript文件，添加@constitution注解
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  // 要扫描的目录
  scanDirs: [
    path.join(process.cwd(), 'server', 'gateway'),
    path.join(process.cwd(), 'server', 'agents'),
    path.join(process.cwd(), 'server', 'api'),
    path.join(process.cwd(), 'server', 'services'),
    path.join(process.cwd(), 'server', 'middleware')
  ],
  
  // 文件扩展名
  extensions: ['.ts', '.js'],
  
  // 宪法条款映射
  constitutionMappings: {
    // Gateway模块相关宪法
    'gateway': ['§101', '§102', '§107', '§108', '§152', '§306', '§110'],
    'auth': ['§101', '§102', '§107', '§152', '§306'],
    'websocket': ['§101', '§102', '§107', '§108', '§152', '§306'],
    'http': ['§101', '§102', '§107', '§152', '§306'],
    
    // Agent系统相关宪法
    'agent': ['§106', '§109', '§110', '§152', '§190'],
    'supervision': ['§105', '§107', '§152'], // 监察部
    'technology': ['§108', '§110', '§152'], // 科技部
    'organization': ['§109', '§152', '§190'], // 组织部
    'office': ['§101', '§102', '§109', '§110', '§152'], // 办公厅
    'prime': ['§102.3', '§141', '§152', '§190'], // 内阁总理
    
    // LLM集成相关宪法
    'llm': ['§192', '§193', '§110'],
    'model': ['§192', '§193'],
    
    // 插件系统相关宪法
    'plugin': ['§501', '§502', '§503', '§306'],
    'monitoring': ['§504', '§505', '§506'],
    
    // 其他通用宪法
    'service': ['§101', '§102', '§110'],
    'middleware': ['§101', '§102', '§107'],
    'config': ['§152', '§102'],
    'utils': ['§101', '§102']
  },
  
  // 备份目录
  backupDir: path.join(process.cwd(), 'backup', 'constitution_annotations'),
  
  // 日志文件
  logFile: path.join(process.cwd(), 'logs', 'constitution_annotations.log')
};

class ConstitutionAnnotationAdder {
  constructor() {
    this.logs = [];
    this.stats = {
      totalFiles: 0,
      processedFiles: 0,
      annotatedFiles: 0,
      skippedFiles: 0,
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

  // 备份文件
  backupFile(filePath) {
    try {
      const relativePath = path.relative(process.cwd(), filePath);
      const backupPath = path.join(CONFIG.backupDir, relativePath);
      
      this.ensureDirectory(path.dirname(backupPath));
      
      if (fs.existsSync(filePath)) {
        fs.copyFileSync(filePath, backupPath);
        this.log(`备份文件: ${relativePath} -> ${backupPath}`);
      }
      
      return true;
    } catch (error) {
      this.log(`备份文件失败 ${filePath}: ${error.message}`, 'ERROR');
      return false;
    }
  }

  // 获取文件列表
  getFileList() {
    const files = [];
    
    for (const scanDir of CONFIG.scanDirs) {
      if (!fs.existsSync(scanDir)) {
        this.log(`目录不存在: ${scanDir}`, 'WARN');
        continue;
      }
      
      this.collectFilesRecursive(scanDir, files);
    }
    
    this.log(`找到 ${files.length} 个需要处理的文件`);
    return files;
  }

  // 递归收集文件
  collectFilesRecursive(dirPath, fileList) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // 跳过测试目录和node_modules
        if (!entry.name.includes('test') && !entry.name.includes('node_modules')) {
          this.collectFilesRecursive(fullPath, fileList);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (CONFIG.extensions.includes(ext)) {
          fileList.push(fullPath);
        }
      }
    }
  }

  // 分析文件内容，确定相关宪法条款
  analyzeConstitutionClauses(filePath, content) {
    const fileName = path.basename(filePath);
    const dirName = path.dirname(filePath);
    const clauses = new Set();
    
    // 基于文件名分析
    const fileNameLower = fileName.toLowerCase();
    
    // 检查文件名中的关键词
    for (const [keyword, keywordClauses] of Object.entries(CONFIG.constitutionMappings)) {
      if (fileNameLower.includes(keyword)) {
        keywordClauses.forEach(clause => clauses.add(clause));
      }
    }
    
    // 检查路径中的关键词
    const dirPathLower = dirName.toLowerCase();
    for (const [keyword, keywordClauses] of Object.entries(CONFIG.constitutionMappings)) {
      if (dirPathLower.includes(keyword)) {
        keywordClauses.forEach(clause => clauses.add(clause));
      }
    }
    
    // 检查内容中的关键词
    const contentLower = content.toLowerCase();
    
    // Agent相关关键词
    if (contentLower.includes('agent') || contentLower.includes('agent')) {
      ['§106', '§109', '§110', '§152'].forEach(clause => clauses.add(clause));
    }
    
    // LLM相关关键词
    if (contentLower.includes('llm') || contentLower.includes('model') || contentLower.includes('gpt')) {
      ['§192', '§193', '§110'].forEach(clause => clauses.add(clause));
    }
    
    // 插件相关关键词
    if (contentLower.includes('plugin') || contentLower.includes('plugin')) {
      ['§501', '§502', '§503', '§306'].forEach(clause => clauses.add(clause));
    }
    
    // 监控相关关键词
    if (contentLower.includes('monitor') || contentLower.includes('entropy') || contentLower.includes('cost')) {
      ['§504', '§505', '§506'].forEach(clause => clauses.add(clause));
    }
    
    // WebSocket相关关键词
    if (contentLower.includes('websocket') || contentLower.includes('socket')) {
      ['§107', '§108', '§306'].forEach(clause => clauses.add(clause));
    }
    
    // 如果没有找到特定条款，添加默认条款
    if (clauses.size === 0) {
      clauses.add('§101');
      clauses.add('§102');
      clauses.add('§110');
    }
    
    return Array.from(clauses).sort();
  }

  // 获取宪法条款描述
  getConstitutionDescription(clause) {
    const descriptions = {
      '§101': '同步公理：代码变更必须触发文档更新',
      '§102': '熵减原则：所有变更必须降低或维持系统熵值',
      '§102.3': '宪法同步公理：版本变更必须触发全体系同步扫描与强制对齐',
      '§105': '数据完整性公理：所有状态变更必须是原子的，且经过完整性校验',
      '§106': 'Agent身份公理：每个Agent必须拥有唯一身份标识和明确职责',
      '§107': '通信安全公理：私聊消息必须加密，公开消息需身份验证',
      '§108': '异构模型策略：必须支持多LLM提供商，避免单点依赖',
      '§109': '知识图谱公理：系统必须维护知识实体间的关系图谱',
      '§110': '协作效率公理：Agent响应时间必须控制在合理范围内',
      '§141': '熵减验证公理：重构必须满足语义保持性($S\' = S$)和熵减验证($H\' ≤ H$)',
      '§152': '单一真理源公理：知识库文件是可执行规范的唯一真理源',
      '§190': '网络韧性公理：系统必须具备网络级别的容错和恢复能力',
      '§192': '模型选择器公理：必须根据任务复杂度动态选择最优LLM模型',
      '§193': '模型选择器更新公理：模型选择器必须持续学习并适应性能变化',
      '§306': '零停机协议：在生产级开发任务中确保服务连续性',
      '§501': '插件系统公理：所有扩展功能必须通过插件系统实现',
      '§502': '插件宪法合规公理：插件必须通过宪法合规验证才能加载',
      '§503': '零停机热重载公理：插件更新必须支持零停机热重载',
      '§504': '监控系统公理：系统必须实时监控宪法合规状态和性能指标',
      '§505': '熵值计算公理：系统必须实时计算和监控认知熵值',
      '§506': '成本透视公理：所有LLM调用必须实时追踪成本和性能'
    };
    
    return descriptions[clause] || `${clause}：相关宪法条款`;
  }

  // 生成宪法注解头部
  generateConstitutionHeader(filePath, clauses) {
    const fileName = path.basename(filePath);
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // 确定分类
    let category = 'general';
    const filePathLower = filePath.toLowerCase();
    
    if (filePathLower.includes('gateway')) category = 'gateway';
    else if (filePathLower.includes('agent')) category = 'agent';
    else if (filePathLower.includes('llm')) category = 'llm';
    else if (filePathLower.includes('plugin')) category = 'plugin';
    else if (filePathLower.includes('monitor')) category = 'monitoring';
    else if (filePathLower.includes('auth')) category = 'auth';
    else if (filePathLower.includes('middleware')) category = 'middleware';
    else if (filePathLower.includes('service')) category = 'service';
    else if (filePathLower.includes('utils')) category = 'utils';
    else if (filePathLower.includes('config')) category = 'config';
    
    // 确定版本号（简化处理）
    const version = '1.0.0';
    
    // 构建宪法描述
    const constitutionDescriptions = clauses.map(clause => {
      const description = this.getConstitutionDescription(clause);
      return `${clause} ${description}`;
    }).join('\n * ');
    
    // 生成头部
    const header = `/**
 * 🚀 ${this.getFileDescription(fileName)}
 * 
 * @constitution
 * ${constitutionDescriptions}
 * 
 * @filename ${fileName}
 * @version ${version}
 * @category ${category}
 * @last_updated ${dateStr}
 */
`;
    
    return header;
  }

  // 获取文件描述
  getFileDescription(fileName) {
    const descriptions = {
      'agent-engine.ts': 'Negentropy-Lab Agent引擎集成模块',
      'auth.ts': '认证系统核心模块',
      'websocket-handler.ts': 'WebSocket JSON-RPC处理器',
      'openai-http.ts': 'OpenAI兼容HTTP API端点',
      'llm-service.ts': 'LLM服务集成模块',
      'model-selector.ts': '智能模型选择器服务',
      'plugin-manager.ts': '插件管理器',
      'constitution-monitor.ts': '宪法合规监控引擎',
      'entropy-service.ts': '熵值计算服务',
      'cost-tracker.ts': '成本透视系统',
      'circuit-breaker.ts': '熔断器模式实现',
      'rate-limiter.ts': '速率限制器',
      'office-director.ts': '办公厅主任Agent (L1入口层)',
      'prime-minister.ts': '内阁总理Agent (L2协调层)',
      'supervision-ministry.ts': '监察部Agent (L3专业层)',
      'technology-ministry.ts': '科技部Agent (L3专业层)',
      'organization-ministry.ts': '组织部Agent (L3专业层)',
      'index.ts': '模块入口文件',
      'config.ts': '配置管理模块',
      'logger.ts': '日志记录模块'
    };
    
    return descriptions[fileName] || `${path.basename(fileName, path.extname(fileName))}模块`;
  }

  // 检查是否已有宪法注解
  hasConstitutionAnnotation(content) {
    return content.includes('@constitution') || content.includes('宪法依据');
  }

  // 处理单个文件
  processFile(filePath) {
    try {
      this.stats.totalFiles++;
      
      // 读取文件内容
      let content = fs.readFileSync(filePath, 'utf8');
      
      // 检查是否已有宪法注解
      if (this.hasConstitutionAnnotation(content)) {
        this.log(`跳过文件（已有宪法注解）: ${path.relative(process.cwd(), filePath)}`, 'INFO');
        this.stats.skippedFiles++;
        return false;
      }
      
      // 备份文件
      this.backupFile(filePath);
      
      // 分析相关宪法条款
      const clauses = this.analyzeConstitutionClauses(filePath, content);
      
      // 生成宪法注解头部
      const constitutionHeader = this.generateConstitutionHeader(filePath, clauses);
      
      // 移除可能存在的旧头部注释
      let newContent = content;
      
      // 如果文件以单行注释或空行开头，移除它们
      const lines = newContent.split('\n');
      let startIndex = 0;
      
      while (startIndex < lines.length && 
             (lines[startIndex].trim() === '' || 
              lines[startIndex].trim().startsWith('//') || 
              lines[startIndex].trim().startsWith('/*') && lines[startIndex].trim().endsWith('*/'))) {
        startIndex++;
      }
      
      if (startIndex > 0) {
        // 保留可能的重要单行注释（如环境变量检查）
        const importantComments = lines.slice(0, startIndex).filter(line => 
          line.includes('env') || line.includes('NODE_ENV') || line.includes('require')
        );
        
        newContent = constitutionHeader + 
                    (importantComments.length > 0 ? importantComments.join('\n') + '\n' : '') +
                    lines.slice(startIndex).join('\n');
      } else {
        newContent = constitutionHeader + newContent;
      }
      
      // 写入文件
      fs.writeFileSync(filePath, newContent, 'utf8');
      
      this.log(`添加宪法注解: ${path.relative(process.cwd(), filePath)}`, 'INFO');
      this.log(`  相关宪法条款: ${clauses.join(', ')}`);
      
      this.stats.processedFiles++;
      this.stats.annotatedFiles++;
      
      return true;
    } catch (error) {
      this.log(`处理文件失败 ${filePath}: ${error.message}`, 'ERROR');
      this.stats.errors++;
      return false;
    }
  }

  // 生成报告
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      config: {
        scanDirs: CONFIG.scanDirs,
        extensions: CONFIG.extensions
      },
      stats: this.stats,
      logs: this.logs.slice(-100)
    };
    
    // 保存报告
    const reportPath = path.join(CONFIG.backupDir, 'annotation_report.json');
    this.ensureDirectory(CONFIG.backupDir);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    
    this.log(`注解报告已保存到: ${reportPath}`);
    
    // 打印摘要
    console.log('\n' + '=' .repeat(60));
    console.log('📊 宪法注解添加报告');
    console.log('=' .repeat(60));
    console.log(`📁 总文件数: ${this.stats.totalFiles}`);
    console.log(`✅ 成功处理: ${this.stats.processedFiles}`);
    console.log(`🏷️ 添加注解: ${this.stats.annotatedFiles}`);
    console.log(`⏭️ 跳过文件: ${this.stats.skippedFiles}`);
    console.log(`❌ 错误: ${this.stats.errors}`);
    console.log('\n' + '=' .repeat(60));
    
    return this.stats.errors === 0;
  }

  // 执行注解添加
  run() {
    this.log('开始添加宪法注解...');
    this.log(`扫描目录: ${CONFIG.scanDirs.join(', ')}`);
    
    // 创建必要的目录
    this.ensureDirectory(CONFIG.backupDir);
    this.ensureDirectory(path.dirname(CONFIG.logFile));
    
    // 获取文件列表
    const files = this.getFileList();
    
    if (files.length === 0) {
      this.log('没有找到需要处理的文件', 'WARN');
      return false;
    }
    
    // 处理文件
    files.forEach(filePath => {
      this.processFile(filePath);
    });
    
    // 生成报告
    const success = this.generateReport();
    
    if (success) {
      this.log('宪法注解添加完成 ✓');
    } else {
      this.log('宪法注解添加完成，但有错误 ⚠️');
    }
    
    return success;
  }
}

// 主执行函数
function main() {
  try {
    const adder = new ConstitutionAnnotationAdder();
    const success = adder.run();
    
    if (success) {
      console.log('\n💡 后续步骤:');
      console.log('1. 检查添加的宪法注解是否正确');
      console.log('2. 运行宪法合规检查: node scripts/constitution-check.js');
      console.log('3. 如有需要，可以从备份目录恢复文件: backup/constitution_annotations/');
      
      process.exit(0);
    } else {
      console.log('\n⚠️ 注解添加过程中出现错误，请检查日志');
      process.exit(1);
    }
  } catch (error) {
    console.error('注解添加脚本执行失败:', error.message);
    process.exit(1);
  }
}

// 执行注解添加
if (require.main === module) {
  console.log('🔧 Negentropy-Lab 宪法注解添加脚本');
  console.log('宪法依据: §101同步公理、§102熵减原则\n');
  
  // 检查是否有 --force 或 -f 参数
  const args = process.argv.slice(2);
  const forceMode = args.includes('--force') || args.includes('-f');
  
  if (forceMode) {
    console.log('🚀 强制模式：跳过确认，直接执行\n');
    main();
  } else {
    // 询问确认
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('⚠️  此操作将为TypeScript/JavaScript文件添加@constitution注解。是否继续？(y/N): ', (answer) => {
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
}

module.exports = ConstitutionAnnotationAdder;
