/**
 * Negentropy-Lab Plugin CLI Tools
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
import type { PluginRegistryEntry } from '../types/plugin-interfaces';

// =============================================================================
// CLI Configuration
// =============================================================================

export interface PluginCLIConfig {
  pluginManager: PluginManager;
  workspaceDir?: string;
}

// =============================================================================
// Plugin CLI
// =============================================================================

/**
 * Plugin CLI - 插件命令行工具
 * 
 * 提供以下命令:
 * - plugin list: 列出所有插件
 * - plugin install <id>: 安装插件
 * - plugin enable <id>: 启用插件
 * - plugin disable <id>: 禁用插件
 * - plugin remove <id>: 移除插件
 * - plugin status <id>: 查看插件状态
 * - plugin config <id> [key] [value]: 管理插件配置
 */
export class PluginCLI {
  private pluginManager: PluginManager;
  private workspaceDir: string;

  constructor(config: PluginCLIConfig) {
    this.pluginManager = config.pluginManager;
    this.workspaceDir = config.workspaceDir || process.cwd();
  }

  /**
   * 注册CLI命令到Commander程序
   */
  registerCommands(program: Command): void {
    const pluginCommand = program
      .command('plugin')
      .description('Plugin management commands');

    // List all plugins
    pluginCommand
      .command('list')
      .description('List all plugins')
      .option('-a, --all', 'Show all plugins (including inactive)')
      .option('-v, --verbose', 'Show detailed information')
      .action((options) => this.listPlugins(options));

    // Install a plugin
    pluginCommand
      .command('install <id>')
      .description('Install a plugin')
      .option('-f, --force', 'Force reinstall')
      .action((id, options) => this.installPlugin(id, options));

    // Enable a plugin
    pluginCommand
      .command('enable <id>')
      .description('Enable a plugin')
      .action((id) => this.enablePlugin(id));

    // Disable a plugin
    pluginCommand
      .command('disable <id>')
      .description('Disable a plugin')
      .action((id) => this.disablePlugin(id));

    // Remove a plugin
    pluginCommand
      .command('remove <id>')
      .description('Remove a plugin')
      .option('-f, --force', 'Force removal')
      .action((id, options) => this.removePlugin(id, options));

    // Show plugin status
    pluginCommand
      .command('status <id>')
      .description('Show plugin status')
      .option('-v, --verbose', 'Show detailed information')
      .action((id, options) => this.showPluginStatus(id, options));

    // Manage plugin configuration
    const configCommand = pluginCommand
      .command('config <id>')
      .description('Manage plugin configuration');

    configCommand
      .command('get [key]')
      .description('Get plugin configuration value')
      .action((id, key) => this.getConfig(id, key));

    configCommand
      .command('set <key> <value>')
      .description('Set plugin configuration value')
      .action((id, key, value) => this.setConfig(id, key, value));

    configCommand
      .command('unset <key>')
      .description('Unset plugin configuration value')
      .action((id, key) => this.unsetConfig(id, key));

    configCommand
      .command('list')
      .description('List all configuration values')
      .action((id) => this.listConfig(id));

    // Discover plugins
    pluginCommand
      .command('discover')
      .description('Discover available plugins')
      .action(this.discoverPlugins.bind(this));
  }

  // ===========================================================================
  // List Plugins
  // ===========================================================================

  /**
   * 列出所有插件
   */
  private async listPlugins(options: { all?: boolean; verbose?: boolean } = {}): Promise<void> {
    const plugins = this.pluginManager.getPlugins();
    
    if (plugins.length === 0) {
      console.log('No plugins loaded.');
      return;
    }

    const activePlugins = plugins.filter(p => p.state === 'active');
    const inactivePlugins = (options.all || false) ? plugins.filter(p => p.state !== 'active') : [];

    console.log('\n📦 Plugins:');
    console.log('═══════════════════════════════════════════════\n');

    // 活跃插件
    if (activePlugins.length > 0) {
      console.log('✅ Active Plugins:');
      console.log('───────────────────────────────────────────');
      this.printPlugins(activePlugins, options.verbose || false);
    }

    // 非活跃插件
    if (inactivePlugins.length > 0) {
      console.log('\n⚪ Inactive Plugins:');
      console.log('───────────────────────────────────────────');
      this.printPlugins(inactivePlugins, options.verbose || false);
    }

    console.log('\n');
    console.log(`Total: ${plugins.length} (${activePlugins.length} active, ${inactivePlugins.length} inactive)`);
  }

  /**
   * 打印插件列表
   */
  private printPlugins(plugins: PluginRegistryEntry[], verbose: boolean): void {
    plugins.forEach((plugin, index) => {
      const statusIcon = this.getStatusIcon(plugin.state);
      const pluginInfo = `${statusIcon} ${plugin.manifest.id} ${plugin.manifest.version ? `v${plugin.manifest.version}` : ''}`;
      
      console.log(`${index + 1}. ${pluginInfo}`);
      
      if (verbose) {
        if (plugin.manifest.name) {
          console.log(`   Name: ${plugin.manifest.name}`);
        }
        if (plugin.manifest.description) {
          console.log(`   Description: ${plugin.manifest.description}`);
        }
        if (plugin.manifest.kind) {
          console.log(`   Type: ${plugin.manifest.kind}`);
        }
        console.log(`   Origin: ${plugin.origin}`);
        console.log(`   State: ${plugin.state}`);
        if (plugin.loadTime) {
          console.log(`   Loaded: ${new Date(plugin.loadTime).toLocaleString()}`);
        }
        if (plugin.activateTime) {
          console.log(`   Activated: ${new Date(plugin.activateTime).toLocaleString()}`);
        }
      }
    });
  }

  /**
   * 获取状态图标
   */
  private getStatusIcon(state: string): string {
    const icons: Record<string, string> = {
      active: '✅',
      inactive: '⚪',
      error: '❌',
      loading: '⏳',
      activating: '⏳',
      deactivating: '⏳',
    };
    return icons[state] || '❓';
  }

  // ===========================================================================
  // Install Plugin
  // ===========================================================================

  /**
   * 安装插件
   */
  private async installPlugin(id: string, options: { force?: boolean } = {}): Promise<void> {
    console.log(`📦 Installing plugin: ${id}...`);

    try {
      // 检查是否已安装
      if (this.pluginManager.isPluginLoaded(id) && !options.force) {
        console.log(`⚠️  Plugin '${id}' is already loaded. Use --force to reinstall.`);
        return;
      }

      // 强制重新安装时先卸载
      if (options.force && this.pluginManager.isPluginLoaded(id)) {
        console.log(`   Force reinstall: Unloading existing plugin...`);
        await this.pluginManager.unloadPlugin(id);
      }

      // 加载插件
      const success = await this.pluginManager.loadPlugin(id);

      if (success) {
        console.log(`✅ Plugin '${id}' installed successfully.`);
        
        // 自动激活插件
        const activated = await this.pluginManager.activatePlugin(id);
        if (activated) {
          console.log(`✅ Plugin '${id}' activated successfully.`);
        } else {
          console.log(`⚠️  Plugin '${id}' installed but failed to activate.`);
        }
      } else {
        console.log(`❌ Failed to install plugin '${id}'.`);
        console.log('   Check the logs for more details.');
      }
    } catch (error) {
      console.log(`❌ Error installing plugin '${id}': ${error}`);
    }
  }

  // ===========================================================================
  // Enable Plugin
  // ===========================================================================

  /**
   * 启用插件
   */
  private async enablePlugin(id: string): Promise<void> {
    console.log(`🔌 Enabling plugin: ${id}...`);

    try {
      // 检查是否已加载
      if (!this.pluginManager.isPluginLoaded(id)) {
        console.log(`   Plugin '${id}' is not loaded. Loading...`);
        const loaded = await this.pluginManager.loadPlugin(id);
        if (!loaded) {
          console.log(`❌ Failed to load plugin '${id}'.`);
          return;
        }
      }

      // 激活插件
      const success = await this.pluginManager.activatePlugin(id);

      if (success) {
        console.log(`✅ Plugin '${id}' enabled successfully.`);
      } else {
        console.log(`❌ Failed to enable plugin '${id}'.`);
      }
    } catch (error) {
      console.log(`❌ Error enabling plugin '${id}': ${error}`);
    }
  }

  // ===========================================================================
  // Disable Plugin
  // ===========================================================================

  /**
   * 禁用插件
   */
  private async disablePlugin(id: string): Promise<void> {
    console.log(`🔌 Disabling plugin: ${id}...`);

    try {
      // 检查是否已激活
      if (!this.pluginManager.isPluginActive(id)) {
        console.log(`⚠️  Plugin '${id}' is not active.`);
        return;
      }

      // 停用插件
      const success = await this.pluginManager.deactivatePlugin(id);

      if (success) {
        console.log(`✅ Plugin '${id}' disabled successfully.`);
      } else {
        console.log(`❌ Failed to disable plugin '${id}'.`);
      }
    } catch (error) {
      console.log(`❌ Error disabling plugin '${id}': ${error}`);
    }
  }

  // ===========================================================================
  // Remove Plugin
  // ===========================================================================

  /**
   * 移除插件
   */
  private async removePlugin(id: string, options: { force?: boolean }): Promise<void> {
    console.log(`🗑️  Removing plugin: ${id}...`);

    try {
      // 检查插件是否已加载
      if (!this.pluginManager.isPluginLoaded(id)) {
        console.log(`⚠️  Plugin '${id}' is not loaded.`);
        return;
      }

      // 确认操作 (非强制模式)
      if (!options.force) {
        // TODO: 添加用户确认提示
        console.log('   Use --force to skip confirmation.');
        return;
      }

      // 卸载插件
      const success = await this.pluginManager.unloadPlugin(id);

      if (success) {
        console.log(`✅ Plugin '${id}' removed successfully.`);
      } else {
        console.log(`❌ Failed to remove plugin '${id}'.`);
      }
    } catch (error) {
      console.log(`❌ Error removing plugin '${id}': ${error}`);
    }
  }

  // ===========================================================================
  // Show Plugin Status
  // ===========================================================================

  /**
   * 显示插件状态
   */
  private async showPluginStatus(id: string, options: { verbose?: boolean }): Promise<void> {
    const plugin = this.pluginManager.getPlugin(id);

    if (!plugin) {
      console.log(`❌ Plugin '${id}' not found.`);
      return;
    }

    console.log('\n📦 Plugin Status:');
    console.log('═══════════════════════════════════════════════\n');

    // 基本信息
    console.log(`ID: ${plugin.manifest.id}`);
    console.log(`Name: ${plugin.manifest.name || 'N/A'}`);
    console.log(`Version: ${plugin.manifest.version || 'N/A'}`);
    console.log(`Description: ${plugin.manifest.description || 'N/A'}`);
    console.log(`Type: ${plugin.manifest.kind || 'N/A'}`);
    console.log(`State: ${plugin.state}`);
    console.log(`Origin: ${plugin.origin}`);

    // 时间信息
    if (plugin.loadTime) {
      console.log(`Loaded: ${new Date(plugin.loadTime).toLocaleString()}`);
    }
    if (plugin.activateTime) {
      console.log(`Activated: ${new Date(plugin.activateTime).toLocaleString()}`);
    }

    // 详细信息
    if (options.verbose) {
      console.log('\n📋 Details:');
      console.log('───────────────────────────────────────────');

      if (plugin.manifest.negentropy) {
        console.log('\nNegentropy Extension:');
        if (plugin.manifest.negentropy.agentIntegration) {
          console.log(`  Agent Integration:`);
          console.log(`    Model: ${plugin.manifest.negentropy.agentIntegration.model || 'N/A'}`);
          console.log(`    Timeout: ${plugin.manifest.negentropy.agentIntegration.timeout || 'N/A'}`);
          console.log(`    Depth: ${plugin.manifest.negentropy.agentIntegration.depth || 'N/A'}`);
        }
        if (plugin.manifest.negentropy.entropyMonitor) {
          console.log(`  Entropy Monitor:`);
          console.log(`    Metrics: ${plugin.manifest.negentropy.entropyMonitor.metrics.join(', ')}`);
        }
        if (plugin.manifest.negentropy.constitutionalCompliance) {
          console.log(`  Constitutional Compliance:`);
          console.log(`    Required Clauses: ${plugin.manifest.negentropy.constitutionalCompliance.requiredClauses.join(', ')}`);
        }
      }

      // 配置信息
      if (Object.keys(plugin.config).length > 0) {
        console.log('\nConfiguration:');
        for (const [key, value] of Object.entries(plugin.config)) {
          console.log(`  ${key}: ${JSON.stringify(value)}`);
        }
      }
    }

    console.log('\n');
  }

  // ===========================================================================
  // Plugin Configuration
  // ===========================================================================

  /**
   * 获取配置值
   */
  private async getConfig(id: string, key?: string): Promise<void> {
    const plugin = this.pluginManager.getPlugin(id);

    if (!plugin) {
      console.log(`❌ Plugin '${id}' not found.`);
      return;
    }

    if (key) {
      const value = plugin.config[key];
      console.log(`${key}: ${JSON.stringify(value, null, 2)}`);
    } else {
      console.log(JSON.stringify(plugin.config, null, 2));
    }
  }

  /**
   * 设置配置值
   */
  private async setConfig(id: string, key: string, value: string): Promise<void> {
    const plugin = this.pluginManager.getPlugin(id);

    if (!plugin) {
      console.log(`❌ Plugin '${id}' not found.`);
      return;
    }

    try {
      // 尝试解析JSON值
      let parsedValue: any = value;
      try {
        parsedValue = JSON.parse(value);
      } catch {
        // 保持原始字符串值
      }

      plugin.config[key] = parsedValue;
      console.log(`✅ Set ${key} = ${JSON.stringify(parsedValue)}`);
      
      // TODO: 触发配置变更钩子
      // TODO: 持久化配置
    } catch (error) {
      console.log(`❌ Error setting config: ${error}`);
    }
  }

  /**
   * 删除配置值
   */
  private async unsetConfig(id: string, key: string): Promise<void> {
    const plugin = this.pluginManager.getPlugin(id);

    if (!plugin) {
      console.log(`❌ Plugin '${id}' not found.`);
      return;
    }

    delete plugin.config[key];
    console.log(`✅ Unset ${key}`);
    
    // TODO: 触发配置变更钩子
    // TODO: 持久化配置
  }

  /**
   * 列出所有配置
   */
  private async listConfig(id: string): Promise<void> {
    const plugin = this.pluginManager.getPlugin(id);

    if (!plugin) {
      console.log(`❌ Plugin '${id}' not found.`);
      return;
    }

    const configKeys = Object.keys(plugin.config);

    if (configKeys.length === 0) {
      console.log(`No configuration set for plugin '${id}'.`);
      return;
    }

    console.log('\nConfiguration:');
    for (const key of configKeys) {
      console.log(`  ${key}: ${JSON.stringify(plugin.config[key])}`);
    }
  }

  // ===========================================================================
  // Discover Plugins
  // ===========================================================================

  /**
   * 发现插件
   */
  private async discoverPlugins(): Promise<void> {
    console.log('🔍 Discovering plugins...');

    try {
      const manifests = await this.pluginManager.discoverPlugins();

      if (manifests.length === 0) {
        console.log('No plugins found.');
        return;
      }

      console.log(`\nFound ${manifests.length} plugin(s):\n`);

      manifests.forEach((manifest, index) => {
        const isLoaded = this.pluginManager.isPluginLoaded(manifest.id);
        const isActive = this.pluginManager.isPluginActive(manifest.id);
        const status = isActive ? '✅ Active' : isLoaded ? '⚪ Loaded' : '⭕ Not loaded';

        console.log(`${index + 1}. ${manifest.id} ${manifest.version ? `v${manifest.version}` : ''}`);
        console.log(`   Status: ${status}`);
        if (manifest.name) {
          console.log(`   Name: ${manifest.name}`);
        }
        if (manifest.description) {
          console.log(`   Description: ${manifest.description}`);
        }
        console.log('');
      });
    } catch (error) {
      console.log(`❌ Error discovering plugins: ${error}`);
    }
  }
}

// =============================================================================
// Export
// =============================================================================

export * from './PluginCLI';
