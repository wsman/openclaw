/**
 * 🚀 插件管理器核心
 * 宪法依据: §101同步公理、§102熵减原则、§306零停机协议、§152单一真理源、§110协作效率公理
 * 
 * 插件管理器是Negentropy-Lab Gateway插件系统的核心组件，负责：
 * 1. 插件生命周期管理 (加载、卸载、热重载)
 * 2. 宪法合规验证 (§101, §102, §108, §152, §306, §110)
 * 3. 依赖关系解析和冲突解决
 * 4. 插件隔离和错误边界
 * 5. 性能监控和资源限制
 * 
 * 版本: v1.0.0
 * 创建时间: 2026-02-11
 * 维护者: 科技部插件系统团队
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import { 
  PluginType, 
  PluginStatus, 
  PluginManifest, 
  LoadedPlugin, 
  PluginManagerOptions, 
  PluginEvent, 
  PluginEventType,
  PluginApiResponse,
  PluginSearchOptions,
  PluginFilter,
  PluginSorter,
  validatePluginManifest,
  createDefaultPluginManifest,
  ConstitutionCompliance
} from './types';

import { PluginRegistry } from './registry';
import { PluginValidator } from './validator';
import { PluginLoader } from './loader';
import { PerformanceMonitor } from './monitor';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const getErrorStack = (error: unknown): string | undefined =>
  error instanceof Error ? error.stack : undefined;

/**
 * 🚀 插件管理器核心类
 * 宪法依据: §306零停机协议、§152单一真理源、§110协作效率公理
 */
export class PluginManager {
  private plugins: Map<string, LoadedPlugin>;
  private registry: PluginRegistry;
  private validator: PluginValidator;
  private loader: PluginLoader;
  private monitor: PerformanceMonitor;
  private eventEmitter: EventEmitter;
  private options: PluginManagerOptions;
  private isInitialized = false;
  
  /**
   * 构造函数
   * @param options 插件管理器配置
   */
  constructor(options: Partial<PluginManagerOptions> = {}) {
    // 默认配置
    this.options = {
      pluginDirectory: path.join(process.cwd(), 'plugins'),
      hotReload: false,
      hotReloadInterval: 5000,
      constitutionCheck: true,
      performanceMonitoring: true,
      monitoringInterval: 30000,
      maxPlugins: 50,
      isolationLevel: 'partial',
      errorHandling: 'strict',
      logLevel: 'info',
      ...options,
    };
    
    this.plugins = new Map();
    this.registry = new PluginRegistry();
    this.validator = new PluginValidator();
    this.loader = new PluginLoader();
    this.monitor = new PerformanceMonitor();
    this.eventEmitter = new EventEmitter();
    
    // §306零停机协议: 初始化时加载持久化插件状态
    this.loadPersistedPluginState().catch(err => {
      console.warn('[PluginManager] 加载持久化插件状态失败:', err.message);
    });
  }
  
  /**
   * 初始化插件管理器
   * 宪法依据: §110协作效率公理 - 异步初始化，不阻塞主线程
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    
    try {
      console.log('[PluginManager] 正在初始化插件管理器...');
      
      // 创建插件目录（如果不存在）
      await this.ensurePluginDirectory();
      
      // 初始化组件
      await this.registry.initialize();
      await this.validator.initialize();
      await this.loader.initialize();
      await this.monitor.initialize();
      
      // 启动热重载（如果启用）
      if (this.options.hotReload) {
        this.startHotReloadWatcher();
      }
      
      // 启动性能监控（如果启用）
      if (this.options.performanceMonitoring) {
        this.startPerformanceMonitoring();
      }
      
      this.isInitialized = true;
      console.log('[PluginManager] 插件管理器初始化完成');
      
      // 发送初始化完成事件
      this.emitEvent({
        type: PluginEventType.PLUGIN_STATUS_CHANGED,
        pluginId: 'system',
        timestamp: new Date(),
        data: { status: 'initialized' },
        source: 'PluginManager',
      });
      
    } catch (error) {
      console.error('[PluginManager] 初始化失败:', error);
      throw new PluginManagerError('初始化失败', { cause: error });
    }
  }
  
  /**
   * 加载插件
   * 宪法依据: §306零停机协议 - 优雅的插件加载，不中断服务
   */
  async loadPlugin(manifestPath: string): Promise<LoadedPlugin> {
    this.validateInitialized();
    
    console.log(`[PluginManager] 正在加载插件: ${manifestPath}`);
    
    try {
      // 步骤1: 读取和验证插件清单
      const manifest = await this.loader.loadManifest(manifestPath);
      
      // 步骤2: 宪法合规验证
      if (this.options.constitutionCheck) {
        const complianceReport = await this.validator.validateConstitutionCompliance(manifest);
        if (!complianceReport.overallCompliant) {
          throw new PluginValidationError('插件宪法合规验证失败', complianceReport);
        }
      }
      
      // 步骤3: 检查依赖关系
      await this.resolveDependencies(manifest);
      
      // 步骤4: 加载插件模块
      const pluginInstance = await this.loader.loadPluginModule(manifest, manifestPath);
      
      // 步骤5: 创建加载的插件实例
      const loadedPlugin: LoadedPlugin = {
        manifest,
        status: PluginStatus.LOADED,
        instance: pluginInstance,
        config: manifest.defaultConfig || {},
        loadedAt: new Date(),
        lastActiveAt: new Date(),
      };
      
      // 步骤6: 注册插件
      this.plugins.set(manifest.id, loadedPlugin);
      await this.registry.registerPlugin(loadedPlugin);
      
      // 步骤7: 初始化插件（如果定义了生命周期钩子）
      if (manifest.lifecycle?.onLoad) {
        await this.executeLifecycleHook(manifest.id, 'onLoad');
      }
      
      // 步骤8: 启动性能监控
      if (this.options.performanceMonitoring) {
        await this.monitor.startMonitoring(manifest.id);
      }
      
      console.log(`[PluginManager] 插件加载成功: ${manifest.name} (${manifest.id})`);
      
      // 发送插件加载事件
      this.emitEvent({
        type: PluginEventType.PLUGIN_LOADED,
        pluginId: manifest.id,
        timestamp: new Date(),
        data: { manifest },
        source: 'PluginManager',
      });
      
      return loadedPlugin;
      
    } catch (error) {
      console.error(`[PluginManager] 插件加载失败: ${manifestPath}`, error);
      
      // 发送插件错误事件
      this.emitEvent({
        type: PluginEventType.PLUGIN_ERROR,
        pluginId: path.basename(manifestPath, '.json'),
        timestamp: new Date(),
        data: { error: getErrorMessage(error), manifestPath },
        source: 'PluginManager',
      });
      
      throw error;
    }
  }
  
  /**
   * 卸载插件
   * 宪法依据: §306零停机协议 - 优雅卸载，清理资源
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    this.validateInitialized();
    
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new PluginNotFoundError(`插件未找到: ${pluginId}`);
    }
    
    console.log(`[PluginManager] 正在卸载插件: ${plugin.manifest.name} (${pluginId})`);
    
    try {
      // 步骤1: 执行卸载前生命周期钩子
      if (plugin.manifest.lifecycle?.beforeUnload) {
        await this.executeLifecycleHook(pluginId, 'beforeUnload');
      }
      
      // 步骤2: 停止性能监控
      if (this.options.performanceMonitoring) {
        await this.monitor.stopMonitoring(pluginId);
      }
      
      // 步骤3: 执行卸载生命周期钩子
      if (plugin.manifest.lifecycle?.onUnload) {
        await this.executeLifecycleHook(pluginId, 'onUnload');
      }
      
      // 步骤4: 清理插件实例
      if (plugin.instance?.cleanup && typeof plugin.instance.cleanup === 'function') {
        await plugin.instance.cleanup();
      }
      
      // 步骤5: 从注册表中移除
      await this.registry.unregisterPlugin(pluginId);
      
      // 步骤6: 从内存中移除
      this.plugins.delete(pluginId);
      
      console.log(`[PluginManager] 插件卸载成功: ${plugin.manifest.name} (${pluginId})`);
      
      // 发送插件卸载事件
      this.emitEvent({
        type: PluginEventType.PLUGIN_UNLOADED,
        pluginId,
        timestamp: new Date(),
        data: { manifest: plugin.manifest },
        source: 'PluginManager',
      });
      
    } catch (error) {
      console.error(`[PluginManager] 插件卸载失败: ${pluginId}`, error);
      
      // 发送插件错误事件
      this.emitEvent({
        type: PluginEventType.PLUGIN_ERROR,
        pluginId,
        timestamp: new Date(),
        data: { error: getErrorMessage(error), operation: 'unload' },
        source: 'PluginManager',
      });
      
      throw error;
    }
  }
  
  /**
   * 热重载插件
   * 宪法依据: §306零停机协议 - 不中断服务的插件更新
   */
  async reloadPlugin(pluginId: string): Promise<LoadedPlugin> {
    this.validateInitialized();
    
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new PluginNotFoundError(`插件未找到: ${pluginId}`);
    }
    
    console.log(`[PluginManager] 正在热重载插件: ${plugin.manifest.name} (${pluginId})`);
    
    try {
      // 步骤1: 获取插件清单路径
      const manifestPath = this.getManifestPath(plugin.manifest);
      
      // 步骤2: 卸载旧插件
      await this.unloadPlugin(pluginId);
      
      // 步骤3: 加载新插件
      const reloadedPlugin = await this.loadPlugin(manifestPath);
      
      console.log(`[PluginManager] 插件热重载成功: ${plugin.manifest.name} (${pluginId})`);
      
      return reloadedPlugin;
      
    } catch (error) {
      console.error(`[PluginManager] 插件热重载失败: ${pluginId}`, error);
      
      // 发送插件错误事件
      this.emitEvent({
        type: PluginEventType.PLUGIN_ERROR,
        pluginId,
        timestamp: new Date(),
        data: { error: getErrorMessage(error), operation: 'reload' },
        source: 'PluginManager',
      });
      
      throw error;
    }
  }
  
  /**
   * 获取插件
   * 宪法依据: §110协作效率公理 - 高效的数据检索
   */
  getPlugin(pluginId: string): LoadedPlugin | undefined {
    return this.plugins.get(pluginId);
  }
  
  /**
   * 获取所有插件
   */
  getAllPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }
  
  /**
   * 搜索插件
   * 宪法依据: §110协作效率公理 - 高效的搜索算法
   */
  searchPlugins(options: PluginSearchOptions): PluginApiResponse<LoadedPlugin[]> {
    try {
      let results = this.getAllPlugins();
      
      // 应用过滤器
      if (options.query) {
        const query = options.query.toLowerCase();
        results = results.filter(plugin => 
          plugin.manifest.name.toLowerCase().includes(query) ||
          plugin.manifest.description.toLowerCase().includes(query) ||
          plugin.manifest.id.toLowerCase().includes(query)
        );
      }
      
      // 按类型过滤
      if (options.types && options.types.length > 0) {
        results = results.filter(plugin => options.types!.includes(plugin.manifest.type));
      }
      
      // 按宪法合规状态过滤
      if (options.constitutionCompliant !== undefined) {
        results = results.filter(plugin => {
          const compliance = plugin.manifest.constitutionCompliance;
          const isCompliant = 
            compliance.article101 && 
            compliance.article102 && 
            compliance.article108 && 
            compliance.article152 && 
            compliance.article306 && 
            compliance.article110;
          return options.constitutionCompliant ? isCompliant : !isCompliant;
        });
      }
      
      // 按状态过滤
      if (options.status && options.status.length > 0) {
        results = results.filter(plugin => options.status!.includes(plugin.status));
      }
      
      // 排序
      if (options.sortBy) {
        const order = options.sortOrder === 'desc' ? -1 : 1;
        results.sort((a, b) => {
          let aValue: any, bValue: any;
          
          switch (options.sortBy) {
            case 'name':
              aValue = a.manifest.name;
              bValue = b.manifest.name;
              break;
            case 'loadedAt':
              aValue = a.loadedAt.getTime();
              bValue = b.loadedAt.getTime();
              break;
            case 'lastActiveAt':
              aValue = a.lastActiveAt?.getTime() || 0;
              bValue = b.lastActiveAt?.getTime() || 0;
              break;
            case 'status':
              aValue = a.status;
              bValue = b.status;
              break;
            default:
              aValue = a.manifest.name;
              bValue = b.manifest.name;
          }
          
          if (aValue < bValue) return -1 * order;
          if (aValue > bValue) return 1 * order;
          return 0;
        });
      }
      
      // 分页
      if (options.pagination) {
        const { page, pageSize } = options.pagination;
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        results = results.slice(startIndex, endIndex);
      }
      
      return {
        success: true,
        data: results,
        meta: {
          timestamp: new Date(),
          processingTimeMs: 0, // 实际应用中应该计算处理时间
        },
      };
      
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SEARCH_ERROR',
          message: `搜索插件失败: ${getErrorMessage(error)}`,
        },
      };
    }
  }
  
  /**
   * 调用插件方法
   * 宪法依据: §110协作效率公理、§306零停机协议 - 安全的插件方法调用
   */
  async callPluginMethod<T>(
    pluginId: string, 
    method: string, 
    args: any[] = []
  ): Promise<PluginApiResponse<T>> {
    this.validateInitialized();
    
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return {
        success: false,
        error: {
          code: 'PLUGIN_NOT_FOUND',
          message: `插件未找到: ${pluginId}`,
        },
      };
    }
    
    // 检查插件状态
    if (plugin.status !== PluginStatus.ACTIVE && plugin.status !== PluginStatus.LOADED) {
      return {
        success: false,
        error: {
          code: 'PLUGIN_NOT_READY',
          message: `插件未就绪: ${pluginId} (状态: ${plugin.status})`,
        },
      };
    }
    
    // 检查插件实例
    if (!plugin.instance) {
      return {
        success: false,
        error: {
          code: 'PLUGIN_INSTANCE_MISSING',
          message: `插件实例缺失: ${pluginId}`,
        },
      };
    }
    
    // 检查方法是否存在
    if (typeof plugin.instance[method] !== 'function') {
      return {
        success: false,
        error: {
          code: 'METHOD_NOT_FOUND',
          message: `方法未找到: ${pluginId}.${method}`,
        },
      };
    }
    
    try {
      const startTime = Date.now();
      
      // 执行方法调用
      const result = await plugin.instance[method](...args);
      
      const processingTimeMs = Date.now() - startTime;
      
      // 更新最后活动时间
      plugin.lastActiveAt = new Date();
      
      // 记录性能指标
      if (plugin.metrics) {
        plugin.metrics.callCount = (plugin.metrics.callCount || 0) + 1;
        plugin.metrics.responseTime = processingTimeMs;
      }
      
      return {
        success: true,
        data: result,
        meta: {
          timestamp: new Date(),
          processingTimeMs,
          pluginVersion: plugin.manifest.version,
        },
      };
      
    } catch (error) {
      // 记录错误
      if (plugin.metrics) {
        plugin.metrics.errorCount = (plugin.metrics.errorCount || 0) + 1;
      }
      
      // 更新插件错误状态
      plugin.error = {
        message: getErrorMessage(error),
        stack: getErrorStack(error),
        timestamp: new Date(),
      };
      
      // 发送插件错误事件
      this.emitEvent({
        type: PluginEventType.PLUGIN_ERROR,
        pluginId,
        timestamp: new Date(),
        data: { 
          error: getErrorMessage(error), 
          method, 
          args,
          stack: getErrorStack(error),
        },
        source: 'PluginManager',
      });
      
      return {
        success: false,
        error: {
          code: 'METHOD_EXECUTION_ERROR',
          message: `方法执行失败: ${pluginId}.${method}`,
          details: getErrorMessage(error),
        },
      };
    }
  }
  
  /**
   * 更新插件配置
   * 宪法依据: §152单一真理源 - 统一的配置管理
   */
  async updatePluginConfig(pluginId: string, config: Record<string, any>): Promise<PluginApiResponse> {
    this.validateInitialized();
    
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return {
        success: false,
        error: {
          code: 'PLUGIN_NOT_FOUND',
          message: `插件未找到: ${pluginId}`,
        },
      };
    }
    
    try {
      // 验证配置Schema
      if (plugin.manifest.configSchema) {
        // 这里应该使用Zod或其他Schema验证库
        // 暂时跳过详细验证
      }
      
      // 更新配置
      const oldConfig = { ...plugin.config };
      plugin.config = { ...plugin.config, ...config };
      
      // 执行配置变更生命周期钩子
      if (plugin.manifest.lifecycle?.onConfigChange) {
        await this.executeLifecycleHook(pluginId, 'onConfigChange', config);
      }
      
      // 发送配置变更事件
      this.emitEvent({
        type: PluginEventType.PLUGIN_CONFIG_CHANGED,
        pluginId,
        timestamp: new Date(),
        data: { oldConfig, newConfig: plugin.config },
        source: 'PluginManager',
      });
      
      return {
        success: true,
        data: plugin.config,
        meta: {
          timestamp: new Date(),
          processingTimeMs: 0,
        },
      };
      
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CONFIG_UPDATE_ERROR',
          message: `配置更新失败: ${pluginId}`,
          details: getErrorMessage(error),
        },
      };
    }
  }
  
  /**
   * 获取插件性能指标
   */
  async getPluginMetrics(pluginId: string): Promise<PluginApiResponse<any>> {
    this.validateInitialized();
    
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return {
        success: false,
        error: {
          code: 'PLUGIN_NOT_FOUND',
          message: `插件未找到: ${pluginId}`,
        },
      };
    }
    
    try {
      let metrics = plugin.metrics || {};
      
      // 从性能监控器获取实时指标
      if (this.options.performanceMonitoring) {
        const realtimeMetrics = await this.monitor.getPluginMetrics(pluginId);
        metrics = { ...metrics, ...realtimeMetrics };
      }
      
      return {
        success: true,
        data: metrics,
        meta: {
          timestamp: new Date(),
          processingTimeMs: 0,
        },
      };
      
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'METRICS_FETCH_ERROR',
          message: `获取性能指标失败: ${pluginId}`,
          details: getErrorMessage(error),
        },
      };
    }
  }
  
  /**
   * 执行宪法合规检查
   * 宪法依据: §101同步公理 - 确保所有插件符合宪法要求
   */
  async checkConstitutionalCompliance(pluginId?: string): Promise<PluginApiResponse<any>> {
    this.validateInitialized();
    
    try {
      const results: any[] = [];
      
      if (pluginId) {
        // 检查单个插件
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
          throw new PluginNotFoundError(`插件未找到: ${pluginId}`);
        }
        
        const report = await this.validator.validateConstitutionCompliance(plugin.manifest);
        results.push({
          pluginId,
          report,
        });
        
      } else {
        // 检查所有插件
        for (const [id, plugin] of this.plugins) {
          const report = await this.validator.validateConstitutionCompliance(plugin.manifest);
          results.push({
            pluginId: id,
            report,
          });
        }
      }
      
      // 发送宪法合规检查事件
      const violations = results.filter(r => !r.report.overallCompliant);
      if (violations.length > 0) {
        this.emitEvent({
          type: PluginEventType.PLUGIN_CONSTITUTION_VIOLATION,
          pluginId: pluginId || 'all',
          timestamp: new Date(),
          data: { violations },
          source: 'PluginManager',
        });
      }
      
      return {
        success: true,
        data: results,
        meta: {
          timestamp: new Date(),
          processingTimeMs: 0,
        },
      };
      
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CONSTITUTION_CHECK_ERROR',
          message: `宪法合规检查失败: ${getErrorMessage(error)}`,
        },
      };
    }
  }
  
  /**
   * 发现插件目录中的插件
   * 宪法依据: §102熵减原则 - 自动发现可用插件
   */
  async discoverPlugins(pluginDir?: string): Promise<PluginManifest[]> {
    const dir = pluginDir || this.options.pluginDirectory;
    
    try {
      const manifests: PluginManifest[] = [];
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          // 检查目录中是否有manifest文件
          const manifestPath = path.join(dir, entry.name, 'manifest.json');
          try {
            const manifest = await this.loader.loadManifest(manifestPath);
            manifests.push(manifest);
          } catch (error) {
            // 忽略没有manifest的目录
            console.debug(`[PluginManager] 忽略目录 ${entry.name}: ${getErrorMessage(error)}`);
          }
        }
      }
      
      return manifests;
      
    } catch (error) {
      console.error(`[PluginManager] 发现插件失败: ${dir}`, error);
      return [];
    }
  }
  
  /**
   * 注册事件监听器
   */
  on(event: PluginEventType, listener: (event: PluginEvent) => void): void {
    this.eventEmitter.on(event, listener);
  }
  
  /**
   * 移除事件监听器
   */
  off(event: PluginEventType, listener: (event: PluginEvent) => void): void {
    this.eventEmitter.off(event, listener);
  }
  
  /**
   * 销毁插件管理器
   * 宪法依据: §306零停机协议 - 优雅关闭所有插件
   */
  async destroy(): Promise<void> {
    console.log('[PluginManager] 正在销毁插件管理器...');
    
    // 停止热重载
    this.stopHotReloadWatcher();
    
    // 停止性能监控
    if (this.options.performanceMonitoring) {
      await this.monitor.destroy();
    }
    
    // 卸载所有插件（从后往前，考虑依赖关系）
    const plugins = Array.from(this.plugins.values());
    for (const plugin of plugins.reverse()) {
      try {
        await this.unloadPlugin(plugin.manifest.id);
      } catch (error) {
        console.warn(`[PluginManager] 卸载插件失败 ${plugin.manifest.id}:`, getErrorMessage(error));
      }
    }
    
    // 清理其他资源
    await this.registry.destroy();
    await this.validator.destroy();
    await this.loader.destroy();
    
    this.plugins.clear();
    this.isInitialized = false;
    
    console.log('[PluginManager] 插件管理器销毁完成');
  }
  
  // ========== 私有方法 ==========
  
  private validateInitialized(): void {
    if (!this.isInitialized) {
      throw new PluginManagerError('插件管理器未初始化，请先调用 initialize() 方法');
    }
  }
  
  private async ensurePluginDirectory(): Promise<void> {
    try {
      await fs.access(this.options.pluginDirectory);
    } catch {
      // 目录不存在，创建它
      await fs.mkdir(this.options.pluginDirectory, { recursive: true });
      console.log(`[PluginManager] 创建插件目录: ${this.options.pluginDirectory}`);
    }
  }
  
  private async loadPersistedPluginState(): Promise<void> {
    // TODO: 从持久化存储加载插件状态
    // 宪法依据: §151持久化原则
    console.log('[PluginManager] 加载持久化插件状态（待实现）');
  }
  
  private async resolveDependencies(manifest: PluginManifest): Promise<void> {
    const dependencies = manifest.dependencies;
    if (!dependencies) {
      return;
    }
    
    // 检查必需依赖
    if (dependencies.required) {
      for (const depId of dependencies.required) {
        const depPlugin = this.plugins.get(depId);
        if (!depPlugin) {
          throw new PluginDependencyError(`必需依赖未满足: ${depId}`);
        }
        
        // 检查依赖插件状态
        if (depPlugin.status !== PluginStatus.ACTIVE && depPlugin.status !== PluginStatus.LOADED) {
          throw new PluginDependencyError(`依赖插件未就绪: ${depId} (状态: ${depPlugin.status})`);
        }
      }
    }
    
    // 检查冲突插件
    if (dependencies.conflicts) {
      for (const conflictId of dependencies.conflicts) {
        if (this.plugins.has(conflictId)) {
          throw new PluginDependencyError(`插件冲突: ${manifest.id} 与 ${conflictId} 冲突`);
        }
      }
    }
  }
  
  private async executeLifecycleHook(
    pluginId: string, 
    hookName: keyof NonNullable<PluginManifest['lifecycle']>, 
    ...args: any[]
  ): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new PluginNotFoundError(`插件未找到: ${pluginId}`);
    }
    
    const hook = plugin.manifest.lifecycle?.[hookName];
    if (!hook || typeof hook !== 'function') {
      return; // 钩子未定义，直接返回
    }
    
    try {
      // 更新插件状态
      if (hookName === 'onLoad') {
        plugin.status = PluginStatus.INITIALIZING;
      } else if (hookName === 'onUnload') {
        plugin.status = PluginStatus.UNLOADING;
      }
      
      // 执行钩子函数
      await (hook as (...hookArgs: any[]) => Promise<void>)(...args);
      
      // 更新插件状态
      if (hookName === 'onLoad') {
        plugin.status = PluginStatus.ACTIVE;
      } else if (hookName === 'onUnload') {
        plugin.status = PluginStatus.UNLOADED;
      }
      
    } catch (error) {
      plugin.status = PluginStatus.ERROR;
      plugin.error = {
        message: `生命周期钩子执行失败 (${hookName}): ${getErrorMessage(error)}`,
        stack: getErrorStack(error),
        timestamp: new Date(),
      };
      
      throw new PluginLifecycleError(`生命周期钩子执行失败: ${hookName}`, { cause: error });
    }
  }
  
  private getManifestPath(manifest: PluginManifest): string {
    // TODO: 根据插件清单中的信息构建清单路径
    // 暂时返回一个占位符路径
    return path.join(this.options.pluginDirectory, manifest.id, 'manifest.json');
  }
  
  private emitEvent(event: PluginEvent): void {
    this.eventEmitter.emit(event.type, event);
  }
  
  private startHotReloadWatcher(): void {
    // TODO: 实现文件系统监听，检测插件目录变更
    console.log('[PluginManager] 热重载监视器启动（待实现）');
  }
  
  private stopHotReloadWatcher(): void {
    // TODO: 停止文件系统监听
    console.log('[PluginManager] 热重载监视器停止（待实现）');
  }
  
  private startPerformanceMonitoring(): void {
    // 性能监控已经在monitor中实现
    console.log('[PluginManager] 性能监控已启用');
  }
}

// ========== 错误类型 ==========

export class PluginManagerError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PluginManagerError';
  }
}

export class PluginNotFoundError extends PluginManagerError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PluginNotFoundError';
  }
}

export class PluginValidationError extends PluginManagerError {
  complianceReport: any;
  
  constructor(message: string, complianceReport: any, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PluginValidationError';
    this.complianceReport = complianceReport;
  }
}

export class PluginDependencyError extends PluginManagerError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PluginDependencyError';
  }
}

export class PluginLifecycleError extends PluginManagerError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PluginLifecycleError';
  }
}

// ========== 导出 ==========

export default PluginManager;
