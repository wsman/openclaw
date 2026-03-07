#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 需要修复导入路径的插件文件
const pluginFiles = [
  'plugins/core/agent-integration/index.ts',
  'plugins/core/entropy-monitor/index.ts',
  'plugins/core/websocket-channel/index.ts',
];

const rootDir = '/home/wsman/桌面/Coding Task/Negentropy-Lab';

console.log('🔄 Fixing plugin import paths...\n');

pluginFiles.forEach((file) => {
  const fullPath = path.join(rootDir, file);

  if (!fs.existsSync(fullPath)) {
    console.log(`❌ File not found: ${file}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');

  // 修复导入路径
  const oldImport = "from '../../server/plugins/types/plugin-interfaces';";
  const newImport = "from '../../../server/plugins/types/plugin-interfaces';";

  let modified = false;
  if (content.includes(oldImport)) {
    content = content.replace(oldImport, newImport);
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`✅ Fixed: ${file}`);
    modified = true;
  }

  if (!modified) {
    console.log(`⏭️  Skipped: ${file} (path already correct or different)`);
  }
});

console.log('\n✨ Import paths fixed!');
