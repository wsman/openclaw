#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 需要修复导入的测试文件
const testFiles = [
  'plugins/core/agent-integration/index.test.ts',
  'plugins/core/agent-integration/ModelFallback.test.ts',
  'plugins/core/agent-integration/AgentStateManager.test.ts',
  'plugins/core/agent-integration/TaskScheduler.test.ts',
  'plugins/core/agent-integration/LLMService.test.ts',
  'plugins/core/entropy-monitor/index.test.ts',
  'plugins/core/entropy-monitor/EntropyCalculator.test.ts',
  'plugins/core/entropy-monitor/CPUMonitor.test.ts',
  'plugins/core/entropy-monitor/ThresholdAlerter.test.ts',
  'plugins/core/entropy-monitor/MemoryMonitor.test.ts',
  'plugins/core/websocket-channel/index.test.ts',
  'plugins/core/websocket-channel/Heartbeat.test.ts',
  'plugins/core/websocket-channel/Server.test.ts',
  'plugins/core/websocket-channel/Broadcaster.test.ts',
  'plugins/core/websocket-channel/ClientManager.test.ts',
];

const rootDir = '/home/wsman/桌面/Coding Task/Negentropy-Lab';

// 导入映射
const importMappings = {
  'agent-integration': {
    class: 'AgentIntegrationPlugin',
    types: ['AgentIntegrationConfig', 'Task', 'TaskComplexity', 'LLMResponse', 'AgentStatus'],
  },
  'entropy-monitor': {
    class: 'EntropyMonitorPlugin',
    types: ['EntropyMonitorConfig', 'EntropyMetrics', 'MemoryStats', 'CPUStats', 'DiskStats', 'Alert'],
  },
  'websocket-channel': {
    class: 'WebSocketChannelPlugin',
    types: ['WebSocketConfig', 'WSMessage', 'ClientInfo', 'ChannelStats'],
  },
};

console.log('🔄 Fixing test imports...\n');

testFiles.forEach((file) => {
  const fullPath = path.join(rootDir, file);

  if (!fs.existsSync(fullPath)) {
    console.log(`❌ File not found: ${file}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');

  // 确定插件类型
  let pluginType = null;
  if (file.includes('agent-integration')) {
    pluginType = 'agent-integration';
  } else if (file.includes('entropy-monitor')) {
    pluginType = 'entropy-monitor';
  } else if (file.includes('websocket-channel')) {
    pluginType = 'websocket-channel';
  }

  if (!pluginType) {
    console.log(`⏭️  Skipped: ${file} (unknown plugin type)`);
    return;
  }

  const mapping = importMappings[pluginType];
  const className = mapping.class;

  // 检查并修复导入
  // 模式1: import ClassName from './index'; (需要改为 named import)
  const importPattern = new RegExp(`import ${className} from '\\./index';`, 'g');
  const correctImport = `import { ${className} } from './index';`;

  // 模式2: import ClassName, { types... } from './index'; (需要修改)
  const mixedImportPattern = new RegExp(`import ${className}, \\{([^}]+)\\} from '\\./index';`, 'g');
  const correctMixedImport = `import { ${className}, $1 } from './index';`;

  let modified = false;

  if (mixedImportPattern.test(content)) {
    content = content.replace(mixedImportPattern, correctMixedImport);
    modified = true;
  } else if (importPattern.test(content)) {
    content = content.replace(importPattern, correctImport);
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`✅ Fixed: ${file}`);
  } else {
    console.log(`⏭️  Skipped: ${file} (imports already correct)`);
  }
});

console.log('\n✨ Test imports fixed!');
