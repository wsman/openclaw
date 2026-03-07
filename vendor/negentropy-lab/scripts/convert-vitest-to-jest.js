#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 需要转换的测试文件
const testFiles = [
  'plugins/core/agent-integration/index.test.ts',
  'plugins/core/agent-integration/ModelFallback.test.ts',
  'plugins/core/agent-integration/AgentStateManager.test.ts',
  'plugins/core/agent-integration/TaskScheduler.test.ts',
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

console.log('🔄 Converting vitest imports to Jest...\n');

testFiles.forEach((file, index) => {
  const fullPath = path.join(rootDir, file);

  if (!fs.existsSync(fullPath)) {
    console.log(`❌ File not found: ${file}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');

  // 替换vitest导入为Jest导入
  const originalImport = "import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';";
  const newImport = "import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';";

  const originalImport2 = "import { describe, it, expect, beforeEach, vi } from 'vitest';";
  const newImport2 = "import { describe, it, expect, beforeEach, jest } from '@jest/globals';";

  let modified = false;
  if (content.includes(originalImport)) {
    content = content.replace(originalImport, newImport);
    modified = true;
  } else if (content.includes(originalImport2)) {
    content = content.replace(originalImport2, newImport2);
    modified = true;
  }

  // 替换vi为jest
  content = content.replace(/\bvi\./g, 'jest.');

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`✅ Converted: ${file} (${index + 1}/${testFiles.length})`);
  } else {
    console.log(`⏭️  Skipped: ${file} (no vitest import found)`);
  }
});

console.log('\n✨ Conversion complete!');
