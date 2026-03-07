/**
 * Negentropy-Lab Plugin Manager
 * 
 * 宪法依据:
 * - §101 同步公理: 代码与文档必须原子性同步
 * - §102 熵减原则: 复用OpenClaw已有架构，避免重复实现
 * - §118 长时间任务执行公理: 支持超时配置
 * - §306 零停机协议: 支持热加载/热卸载
 * 
 * @version 1.0.0
 * @created 2026-02-12
 * @maintainer 科技部后端分队
 */

import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import winston from 'winston';
import type {
  PluginManifest,
  PluginDefinition,
  PluginModule,
  PluginApi,
  PluginState,
  PluginRegistryEntry,
  PluginHookName,
  PluginHookHandlerMap,
  PluginHookContext,
  PluginRuntime,
  PluginLogger,
  DependencyResolution,
} from '../types/plugin-interfaces';

// =============================================================================
// Configuration
// =============================================================================

/**
 * Plugin Manager Configuration
 */
export interface PluginManagerConfig {
  /** 插件目录路径 */
  pluginDir?: string;
  /** Bundled插件目录 */
  bundledDir?: string;
  /** 数据目录 */
  dataDir?: string;
  /** 状态目录 */
  stateDir?: string;
  /** 是否自动加载所有插件 */
  autoLoad?: boolean;
  /** 是否启用沙箱 */
  enableSandbox?: boolean;
  /** 默认超时 (毫秒) */
  defaultTimeout?: number;
}

// =============================================================================
// Plugin Hook Registration
// =============================================================================

/**
 * 插件钩子注册项
 */
interface PluginHookRegistration<K extends PluginHookName = PluginHookName> {
  pluginId: string;
  hookName: K;
  handler: PluginHookHandlerMap[K];
  priority?: number;
}

// =============================================================================
// Plugin Manager Core
// =============================================================================

/**
 * Plugin Manager - 插件系统核心管理器
 * 
 * 职责:
 * 1. 插件发现与加载
 * 2. 插件生命周期管理
 * 3. 插件注册表维护
 * 4. 钩子系统管理
 * 5. 依赖解析
 * 6. 隔离机制 (可选)
 */
export class PluginManager {
  private readonly logger: winston.Logger;
  private readonly config: Required<PluginManagerConfig>;
  
  /** 插件注册表 */
  private readonly registry: Map<string, PluginRegistryEntry> = new Map();
  
  /** 插件钩子映射 */
  private readonly hooks: Map<PluginHookName, PluginHookRegistration[]> = new Map();
  
  /** 插件实例映射 */
  private readonly instances: Map<string, any> = new Map();
  
  /** 运行时环境 */
  private runtime: PluginRuntime;
  
  /** 是否已初始化 */
  private initialized = false;
  
  // ===========================================================================
  // Constructor
  // ===========================================================================

  constructor(config: PluginManagerConfig = {}) {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              return `${timestamp} [PluginManager] ${level}: ${message}`;
            })
          )
        })
      ]
    });

    this.config = {
      pluginDir: config.pluginDir || path.join(process.cwd(), 'plugins'),
      bundledDir: config.bundledDir || path.join(process.cwd(), 'server', 'plugins', 'bundled'),
      dataDir: config.dataDir || path.join(process.cwd(), 'data'),
      stateDir: config.stateDir || path.join(process.cwd(), 'data', 'plugins'),
      autoLoad: config.autoLoad ?? true,
      enableSandbox: config.enableSandbox ?? false,
      defaultTimeout: config.defaultTimeout ?? 30000,
    };

    this.runtime = {
      workspaceDir: process.cwd(),
      stateDir: this.config.stateDir,
      pluginDir: this.config.pluginDir,
      dataDir: this.config.dataDir,
    };

    this.logger.info('Plugin Manager created', {
      pluginDir: this.config.pluginDir,
      bundledDir: this.config.bundledDir,
      autoLoad: this.config.autoLoad,
    });
  }

  // ===========================================================================
  // Initialization
  // ===========================================================================

  /**
   * 初始化插件管理器
   * 
   * 1. 创建必要的目录
   * 2. 发现插件
   * 3. 加载插件 (如果autoLoad=true)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('Plugin Manager already initialized');
      return;
    }

    this.logger.info('Initializing Plugin Manager...');

    try {
      // 创建必要的目录
      await this.ensureDirectories();
      
      // 触发系统启动钩子
      await this.emitHook('system_start', { pluginId: 'system', timestamp: Date.now() }, { timestamp: Date.now() });
      
      this.initialized = true;
      this.logger.info('Plugin Manager initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Plugin Manager', { error });
      throw error;
    }
  }

  /**
   * 确保必要的目录存在
   */
  private async ensureDirectories(): Promise<void> {
    const dirs = [
      this.config.pluginDir,
      this.config.bundledDir,
      this.config.dataDir,
      this.config.stateDir,
    ];

    for (const dir of dirs) {
      if (!existsSync(dir)) {
        await fs.mkdir(dir, { recursive: true });
        this.logger.debug(`Created directory: ${dir}`);
      }
    }
  }

  // ===========================================================================
  // Plugin Discovery
  // ===========================================================================

  /**
   * 发现插件
   * 
   * 搜索插件目录下的所有插件:
   * 1. 检查 negentropy.plugin.json 文件
   * 2. 解析插件清单
   * 3. 返回插件列表
   */
  async discoverPlugins(): Promise<PluginManifest[]> {
    this.logger.info('Discovering plugins...');

    const manifests: PluginManifest[] = [];

    // 搜索workspace插件
    const workspacePlugins = await this.discoverPluginsInDirectory(this.config.pluginDir, 'workspace');
    manifests.push(...workspacePlugins);

    // 搜索bundled插件
    const bundledPlugins = await this.discoverPluginsInDirectory(this.config.bundledDir, 'bundled');
    manifests.push(...bundledPlugins);

    this.logger.info(`Discovered ${manifests.length} plugins`);
    return manifests;
  }

  /**
   * 在指定目录中发现插件
   */
  private async discoverPluginsInDirectory(
    dir: string,
    origin: 'workspace' | 'bundled'
  ): Promise<PluginManifest[]> {
    const manifests: PluginManifest[] = [];

    try {
      if (!existsSync(dir)) {
        this.logger.debug(`Plugin directory does not exist: ${dir}`);
        return manifests;
      }

      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const pluginPath = path.join(dir, entry.name);
        const manifestPath = path.join(pluginPath, 'negentropy.plugin.json');
        const openclawCompatPath = path.join(pluginPath, 'openclaw.plugin.json');

        // 优先查找 negentropy.plugin.json，兼容 openclaw.plugin.json
        let manifestFile = existsSync(manifestPath) ? manifestPath : null;
        if (!manifestFile && existsSync(openclawCompatPath)) {
          manifestFile = openclawCompatPath;
        }

        if (!manifestFile) {
          continue;
        }

        try {
          const content = await fs.readFile(manifestFile, 'utf-8');
          const manifest = JSON.parse(content);

          // 标记来源
          if (origin === 'workspace') {
            manifest.openclawCompat = true; // Workspace插件可能兼容OpenClaw
          }

          manifests.push(manifest);
          this.logger.debug(`Discovered plugin: ${manifest.id} from ${origin}`, {
            name: manifest.name,
            version: manifest.version,
          });
        } catch (error) {
          this.logger.error(`Failed to parse manifest: ${manifestFile}`, { error });
        }
      }
    } catch (error) {
      this.logger.error(`Failed to discover plugins in directory: ${dir}`, { error });
    }

    return manifests;
  }

  // ===========================================================================
  // Plugin Loading
  // ===========================================================================

  /**
   * 加载插件
   * 
   * 1. 验证插件清单
   * 2. 解析依赖
   * 3. 加载插件模块
   * 4. 注册插件
   */
  async loadPlugin(pluginId: string): Promise<boolean> {
    this.logger.info(`Loading plugin: ${pluginId}`);

    try {
      // 查找插件清单
      const manifest = await this.findPluginManifest(pluginId);
      if (!manifest) {
        throw new Error(`Plugin manifest not found: ${pluginId}`);
      }

      // 检查是否已加载
      if (this.registry.has(pluginId)) {
        this.logger.warn(`Plugin already loaded: ${pluginId}`);
        return true;
      }

      // 触发 plugin_load 钩子
      await this.emitHook('plugin_load', { pluginId, timestamp: Date.now() }, {
        pluginId,
        timestamp: Date.now(),
      });

      // 解析依赖
      const dependencyResolution = await this.resolveDependencies(manifest);
      if (!dependencyResolution.success) {
        throw new Error(`Dependency resolution failed for ${pluginId}: ${dependencyResolution.missing.join(', ')}`);
      }

      // 加载插件模块
      const pluginModule = await this.loadPluginModule(manifest);
      
      // 创建插件API
      const api = await this.createPluginApi(manifest, pluginModule);

      // 创建注册表条目
      const entry: PluginRegistryEntry = {
        manifest,
        definition: pluginModule as PluginDefinition,
        state: 'loaded',
        config: {},
        loadTime: Date.now(),
        origin: (manifest.sourcePath || '').includes(this.config.bundledDir) ? 'bundled' : 'workspace',
        sourcePath: manifest.sourcePath || '',
      };

      this.registry.set(pluginId, entry);

      // 触发 plugin_loaded 钩子
      await this.emitHook('plugin_loaded', { pluginId, timestamp: Date.now() }, {
        pluginId,
        timestamp: Date.now(),
      });

      this.logger.info(`Plugin loaded successfully: ${pluginId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to load plugin: ${pluginId}`, { error });

      // 更新注册表为错误状态
      const entry = this.registry.get(pluginId);
      if (entry) {
        entry.state = 'error';
        entry.error = String(error);
      }

      return false;
    }
  }

  /**
   * 查找插件清单
   */
  private async findPluginManifest(pluginId: string): Promise<PluginManifest | null> {
    // 搜索workspace和bundled目录
    const searchDirs = [
      { dir: this.config.pluginDir, origin: 'workspace' as const },
      { dir: this.config.bundledDir, origin: 'bundled' as const },
    ];

    for (const { dir, origin } of searchDirs) {
      const pluginPath = path.join(dir, pluginId);
      const manifestPath = path.join(pluginPath, 'negentropy.plugin.json');
      const openclawCompatPath = path.join(pluginPath, 'openclaw.plugin.json');

      let manifestFile = existsSync(manifestPath) ? manifestPath : null;
      if (!manifestFile && existsSync(openclawCompatPath)) {
        manifestFile = openclawCompatPath;
      }

      if (manifestFile) {
        const content = await fs.readFile(manifestFile, 'utf-8');
        const manifest = JSON.parse(content);
        manifest.sourcePath = pluginPath;
        return manifest;
      }
    }

    return null;
  }

  /**
   * 加载插件模块
   */
  private async loadPluginModule(manifest: PluginManifest): Promise<PluginModule> {
    const pluginPath = manifest.sourcePath || '';
    const mainFile = manifest.main || 'index.ts';
    const mainPath = path.join(pluginPath, mainFile);

    // 尝试加载 .ts 或 .js 文件
    let modulePath = mainPath;
    if (!existsSync(mainPath)) {
      modulePath = mainPath.replace('.ts', '.js');
    }

    if (!existsSync(modulePath)) {
      throw new Error(`Plugin main file not found: ${modulePath}`);
    }

    // 动态加载模块 (生产环境应该使用已编译的 .js 文件)
    const module = await import(modulePath);
    return module.default || module;
  }

  /**
   * 创建插件API
   */
  private async createPluginApi(
    manifest: PluginManifest,
    pluginModule: PluginModule
  ): Promise<PluginApi> {
    const logger: PluginLogger = {
      debug: (message: string, ...args: any[]) => this.logger.debug(`[${manifest.id}] ${message}`, ...args),
      info: (message: string, ...args: any[]) => this.logger.info(`[${manifest.id}] ${message}`, ...args),
      warn: (message: string, ...args: any[]) => this.logger.warn(`[${manifest.id}] ${message}`, ...args),
      error: (message: string, ...args: any[]) => this.logger.error(`[${manifest.id}] ${message}`, ...args),
    };

    const api: PluginApi = {
      id: manifest.id,
      name: manifest.name || manifest.id,
      version: manifest.version,
      description: manifest.description,
      source: manifest.sourcePath || '',
      config: {},
      pluginConfig: {},
      runtime: this.runtime,
      logger,
      on: <K extends PluginHookName>(
        hookName: K,
        handler: PluginHookHandlerMap[K],
        opts?: { priority?: number }
      ) => this.registerHook(manifest.id, hookName, handler, opts?.priority),
      registerHttpRoute: (params) => {
        // TODO: 集成到Express路由
        this.logger.debug(`HTTP route registered by plugin: ${manifest.id}`, params);
      },
      registerRoom: (name: string, roomClass: any) => {
        // TODO: 集成到Colyseus房间管理
        this.logger.debug(`Room registered by plugin: ${manifest.id}`, { name });
      },
      getRoom: (name: string) => {
        // TODO: 从Colyseus服务器获取房间
        return undefined;
      },
      resolvePath: (input: string) => path.join(manifest.sourcePath || '', input),
    };

    return api;
  }

  // ===========================================================================
  // Plugin Activation
  // ===========================================================================

  /**
   * 激活插件
   * 
   * 1. 检查插件是否已加载
   * 2. 调用插件的 activate 函数
   * 3. 更新插件状态
   */
  async activatePlugin(pluginId: string): Promise<boolean> {
    this.logger.info(`Activating plugin: ${pluginId}`);

    try {
      const entry = this.registry.get(pluginId);
      if (!entry) {
        throw new Error(`Plugin not found: ${pluginId}`);
      }

      if (entry.state === 'active') {
        this.logger.warn(`Plugin already active: ${pluginId}`);
        return true;
      }

      // 触发 plugin_activate 钩子
      await this.emitHook('plugin_activate', { pluginId, timestamp: Date.now() }, {
        pluginId,
        timestamp: Date.now(),
      });

      // 更新状态为激活中
      entry.state = 'activating';

      // 创建插件API
      const api = await this.createPluginApi(entry.manifest, entry.definition);

      // 调用激活函数
      if (typeof entry.definition.activate === 'function') {
        await entry.definition.activate(api);
      }

      // 更新状态
      entry.state = 'active';
      entry.activateTime = Date.now();

      // 触发 plugin_activated 钩子
      await this.emitHook('plugin_activated', { pluginId, timestamp: Date.now() }, {
        pluginId,
        timestamp: Date.now(),
      });

      this.logger.info(`Plugin activated successfully: ${pluginId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to activate plugin: ${pluginId}`, { error });

      const entry = this.registry.get(pluginId);
      if (entry) {
        entry.state = 'error';
        entry.error = String(error);
      }

      return false;
    }
  }

  /**
   * 停用插件
   */
  async deactivatePlugin(pluginId: string): Promise<boolean> {
    this.logger.info(`Deactivating plugin: ${pluginId}`);

    try {
      const entry = this.registry.get(pluginId);
      if (!entry) {
        throw new Error(`Plugin not found: ${pluginId}`);
      }

      if (entry.state !== 'active') {
        this.logger.warn(`Plugin not active: ${pluginId}`);
        return true;
      }

      // 触发 plugin_deactivate 钩子
      await this.emitHook('plugin_deactivate', { pluginId, timestamp: Date.now() }, {
        pluginId,
        timestamp: Date.now(),
      });

      // 更新状态为停用中
      entry.state = 'deactivating';

      // 创建插件API
      const api = await this.createPluginApi(entry.manifest, entry.definition);

      // 调用停用函数
      if (typeof entry.definition.deactivate === 'function') {
        await entry.definition.deactivate(api);
      }

      // 更新状态
      entry.state = 'inactive';

      // 触发 plugin_deactivated 钩子
      await this.emitHook('plugin_deactivated', { pluginId, timestamp: Date.now() }, {
        pluginId,
        timestamp: Date.now(),
      });

      this.logger.info(`Plugin deactivated successfully: ${pluginId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to deactivate plugin: ${pluginId}`, { error });

      const entry = this.registry.get(pluginId);
      if (entry) {
        entry.state = 'error';
        entry.error = String(error);
      }

      return false;
    }
  }

  /**
   * 卸载插件
   */
  async unloadPlugin(pluginId: string): Promise<boolean> {
    this.logger.info(`Unloading plugin: ${pluginId}`);

    try {
      const entry = this.registry.get(pluginId);
      if (!entry) {
        this.logger.warn(`Plugin not found: ${pluginId}`);
        return true;
      }

      // 先停用插件
      if (entry.state === 'active') {
        await this.deactivatePlugin(pluginId);
      }

      // 触发 plugin_unload 钩子
      await this.emitHook('plugin_unload', { pluginId, timestamp: Date.now() }, {
        pluginId,
        timestamp: Date.now(),
      });

      // 调用清理函数
      if (typeof entry.definition.cleanup === 'function') {
        const api = await this.createPluginApi(entry.manifest, entry.definition);
        await entry.definition.cleanup(api);
      }

      // 移除钩子注册
      this.unregisterPluginHooks(pluginId);

      // 从注册表移除
      this.registry.delete(pluginId);
      this.instances.delete(pluginId);

      // 触发 plugin_unloaded 钩子
      await this.emitHook('plugin_unloaded', { pluginId, timestamp: Date.now() }, {
        pluginId,
        timestamp: Date.now(),
      });

      this.logger.info(`Plugin unloaded successfully: ${pluginId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to unload plugin: ${pluginId}`, { error });
      return false;
    }
  }

  // ===========================================================================
  // Dependency Resolution
  // ===========================================================================

  /**
   * 解析插件依赖
   */
  private async resolveDependencies(manifest: PluginManifest): Promise<DependencyResolution> {
    // TODO: 实现依赖解析逻辑
    // 当前版本暂不支持依赖管理，后续版本会添加
    return {
      success: true,
      dependencies: [],
      missing: [],
      conflicts: [],
    };
  }

  // ===========================================================================
  // Hook System
  // ===========================================================================

  /**
   * 注册钩子
   */
  private registerHook<K extends PluginHookName>(
    pluginId: string,
    hookName: K,
    handler: PluginHookHandlerMap[K],
    priority?: number
  ): void {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }

    const registration: PluginHookRegistration<K> = {
      pluginId,
      hookName,
      handler,
      priority: priority ?? 0,
    };

    const hooks = this.hooks.get(hookName)!;
    hooks.push(registration);

    // 按优先级排序 (降序)
    hooks.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    this.logger.debug(`Hook registered: ${pluginId} -> ${hookName}`);
  }

  /**
   * 注销插件的所有钩子
   */
  private unregisterPluginHooks(pluginId: string): void {
    for (const [hookName, hooks] of this.hooks.entries()) {
      const filtered = hooks.filter(h => h.pluginId !== pluginId);
      if (filtered.length !== hooks.length) {
        this.hooks.set(hookName, filtered);
        this.logger.debug(`Unregistered hooks for plugin: ${pluginId} from ${hookName}`);
      }
    }
  }

  /**
   * 触发钩子
   */
  private async emitHook<K extends PluginHookName>(
    hookName: K,
    event: any,
    ctx: any
  ): Promise<void> {
    const hooks = this.hooks.get(hookName);
    if (!hooks || hooks.length === 0) {
      return;
    }

    this.logger.debug(`Emitting hook: ${hookName}`, { event });

    for (const registration of hooks) {
      try {
        await (registration.handler as any)(event, ctx);
      } catch (error) {
        this.logger.error(`Hook handler error: ${registration.pluginId} -> ${hookName}`, { error });
      }
    }
  }

  // ===========================================================================
  // Query Methods
  // ===========================================================================

  /**
   * 获取所有插件
   */
  getPlugins(): PluginRegistryEntry[] {
    return Array.from(this.registry.values());
  }

  /**
   * 获取指定插件
   */
  getPlugin(pluginId: string): PluginRegistryEntry | undefined {
    return this.registry.get(pluginId);
  }

  /**
   * 获取活跃插件
   */
  getActivePlugins(): PluginRegistryEntry[] {
    return this.getPlugins().filter(p => p.state === 'active');
  }

  /**
   * 检查插件是否加载
   */
  isPluginLoaded(pluginId: string): boolean {
    return this.registry.has(pluginId);
  }

  /**
   * 检查插件是否激活
   */
  isPluginActive(pluginId: string): boolean {
    const entry = this.registry.get(pluginId);
    return entry?.state === 'active';
  }

  // ===========================================================================
  // Shutdown
  // ===========================================================================

  /**
   * 关闭插件管理器
   * 
   * 1. 停用所有活跃插件
   * 2. 触发系统停止钩子
   * 3. 清理资源
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Plugin Manager...');

    try {
      // 停用所有活跃插件
      const activePlugins = this.getActivePlugins();
      for (const plugin of activePlugins) {
        await this.deactivatePlugin(plugin.manifest.id);
        await this.unloadPlugin(plugin.manifest.id);
      }

      // 触发系统停止钩子
      await this.emitHook('system_stop', { pluginId: 'system', timestamp: Date.now() }, {
        timestamp: Date.now(),
      });

      this.initialized = false;
      this.logger.info('Plugin Manager shut down successfully');
    } catch (error) {
      this.logger.error('Error during shutdown', { error });
      throw error;
    }
  }

  /**
   * 获取运行时环境
   */
  getRuntime(): PluginRuntime {
    return this.runtime;
  }
}

// =============================================================================
// Export
// =============================================================================

export * from './PluginManager';
