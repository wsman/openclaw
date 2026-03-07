/**
 * Plugin CLI Entry Point
 * 
 * 宪法依据:
 * - §101 同步公理: 代码与文档必须原子性同步
 * - §102 熵减原则: 复用OpenClaw已有架构，避免重复实现
 * 
 * @version 1.0.0
 * @created 2026-02-12
 * @maintainer 科技部后端分队
 */

import { Command } from 'commander';
import { PluginManager } from '../core/PluginManager';
import { PluginCLI } from './PluginCLI';
import path from 'path';

// =============================================================================
// CLI Entry Point
// =============================================================================

async function main() {
  // 创建插件管理器
  const manager = new PluginManager({
    pluginDir: path.join(process.cwd(), 'plugins'),
    bundledDir: path.join(process.cwd(), 'server', 'plugins', 'bundled'),
    autoLoad: false,
  });

  // 初始化插件管理器
  await manager.initialize();

  // 创建插件CLI
  const cli = new PluginCLI({
    pluginManager: manager,
    workspaceDir: process.cwd(),
  });

  // 创建Commander程序
  const program = new Command();

  program
    .name('negentropy-lab-plugin')
    .description('Negentropy-Lab Plugin Management CLI')
    .version('1.0.0');

  // 注册插件命令
  cli.registerCommands(program);

  // 解析命令行参数
  await program.parseAsync(process.argv);

  // 关闭插件管理器
  await manager.shutdown();
}

// =============================================================================
// Run
// =============================================================================

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
