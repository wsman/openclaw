#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// 需要修复类型注解的插件文件
const pluginFiles = [
  'plugins/core/agent-integration/index.ts',
  'plugins/core/entropy-monitor/index.ts',
  'plugins/core/websocket-channel/index.ts',
];

const rootDir = '/home/wsman/桌面/Coding Task/Negentropy-Lab';

console.log('🔄 Fixing plugin type annotations...\n');

pluginFiles.forEach((file) => {
  const fullPath = path.join(rootDir, file);

  if (!fs.existsSync(fullPath)) {
    console.log(`❌ File not found: ${file}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');

  // 移除对象字面量中的类型注解
  // 这种形式会导致Jest/ts-jest编译问题
  // onSystemStart: PluginHookHandlerMap['system_start'] = async (event, ctx) => {
  // 改为：
  // onSystemStart: async (event: any, ctx: any) => {

  const typeAnnotationPattern = /on(\w+):\s*PluginHookHandlerMap\['(\w+)'\]\s*=/g;

  if (typeAnnotationPattern.test(content)) {
    content = content.replace(typeAnnotationPattern, 'on$1: async (event: any, ctx: any) =>');
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`✅ Fixed: ${file}`);
  } else {
    console.log(`⏭️  Skipped: ${file} (no type annotations to fix)`);
  }
});

console.log('\n✨ Type annotations fixed!');
