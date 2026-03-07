/**
 * 🚀 插件加载器
 * 宪法依据: §306零停机协议、§110协作效率公理、§381安全公理
 * 
 * 插件加载器负责：
 * 1. 插件模块动态加载
 * 2. 插件隔离和沙箱环境
 * 3. 错误边界处理
 * 4. 资源管理
 * 
 * 版本: v1.0.0
 * 创建时间: 2026-02-11
 * 维护者: 科技部插件系统团队
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as vm from 'vm';
import { PluginManifest, PluginType } from './types';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * 🚀 插件加载器
 */
export class PluginLoader {
  private sandboxCache: Map<string, vm.Context>;
  private moduleCache: Map<string, any>;
  
  constructor() {
    this.sandboxCache = new Map();
    this.moduleCache = new Map();
  }
  
  /**
   * 初始化加载器
   */
  async initialize(): Promise<void> {
    console.log('[PluginLoader] 插件加载器初始化完成');
  }
  
  /**
   * 加载插件清单
   */
  async loadManifest(manifestPath: string): Promise<PluginManifest> {
    console.log(`[PluginLoader] 加载插件清单: ${manifestPath}`);
    
    try {
      const content = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(content) as PluginManifest;
      
      // 验证基本格式
      this.validateManifestBasic(manifest);
      
      // 验证入口点文件存在
      const pluginDir = path.dirname(manifestPath);
      const entryPointPath = path.join(pluginDir, manifest.entryPoint);
      await fs.access(entryPointPath);
      
      console.log(`[PluginLoader] 插件清单加载成功: ${manifest.name} (${manifest.id})`);
      return manifest;
      
    } catch (error) {
      console.error(`[PluginLoader] 加载插件清单失败: ${manifestPath}`, error);
      throw new PluginLoadError(`加载插件清单失败: ${getErrorMessage(error)}`);
    }
  }
  
  /**
   * 加载插件模块
   */
  async loadPluginModule(manifest: PluginManifest, manifestPath?: string): Promise<any> {
    console.log(`[PluginLoader] 加载插件模块: ${manifest.name} (${manifest.id})`);
    
    try {
      const pluginId = manifest.id;
      
      // 检查缓存
      if (this.moduleCache.has(pluginId)) {
        console.log(`[PluginLoader] 使用缓存的插件模块: ${pluginId}`);
        return this.moduleCache.get(pluginId);
      }
      
      // 构建插件模块路径：优先基于manifest所在目录解析entryPoint
      const pluginDir = manifestPath
        ? path.dirname(manifestPath)
        : path.join(process.cwd(), 'plugins', pluginId);
      const entryPointPath = path.isAbsolute(manifest.entryPoint)
        ? manifest.entryPoint
        : path.resolve(pluginDir, manifest.entryPoint);
      
      // 根据插件类型选择合适的加载策略
      let pluginInstance: any;
      
      switch (manifest.type) {
        case PluginType.HTTP_MIDDLEWARE:
        case PluginType.WEBSOCKET_MIDDLEWARE:
        case PluginType.EVENT_HANDLER:
          // 使用安全的模块加载
          pluginInstance = await this.loadWithSandbox(entryPointPath, manifest);
          break;
          
        case PluginType.SCHEDULED_TASK:
        case PluginType.DATA_TRANSFORMER:
          // 使用隔离的VM环境
          pluginInstance = await this.loadWithVM(entryPointPath, manifest);
          break;
          
        case PluginType.EXTERNAL_INTEGRATION:
        case PluginType.MONITORING:
        case PluginType.LOGGING:
        case PluginType.SECURITY:
          // 使用标准require，但进行安全检查
          pluginInstance = await this.loadWithRequire(entryPointPath, manifest);
          break;
          
        default:
          throw new PluginLoadError(`不支持的插件类型: ${manifest.type}`);
      }
      
      // 验证插件实例
      this.validatePluginInstance(pluginInstance, manifest);
      
      // 缓存插件实例
      this.moduleCache.set(pluginId, pluginInstance);
      
      console.log(`[PluginLoader] 插件模块加载成功: ${manifest.name} (${manifest.id})`);
      return pluginInstance;
      
    } catch (error) {
      console.error(`[PluginLoader] 加载插件模块失败: ${manifest.name}`, error);
      throw new PluginLoadError(`加载插件模块失败: ${getErrorMessage(error)}`);
    }
  }
  
  /**
   * 卸载插件模块
   */
  async unloadPluginModule(pluginId: string): Promise<void> {
    console.log(`[PluginLoader] 卸载插件模块: ${pluginId}`);
    
    // 从缓存中移除
    this.moduleCache.delete(pluginId);
    this.sandboxCache.delete(pluginId);
    
    // 触发垃圾回收（如果有必要）
    if (global.gc) {
      global.gc();
    }
    
    console.log(`[PluginLoader] 插件模块卸载完成: ${pluginId}`);
  }
  
  /**
   * 销毁加载器
   */
  async destroy(): Promise<void> {
    console.log('[PluginLoader] 清理插件加载器...');
    
    // 清理所有缓存
    this.moduleCache.clear();
    this.sandboxCache.clear();
    
    console.log('[PluginLoader] 插件加载器已销毁');
  }
  
  /**
   * 使用沙箱加载插件
   * 宪法依据: §381安全公理 - 插件隔离
   */
  private async loadWithSandbox(entryPointPath: string, manifest: PluginManifest): Promise<any> {
    const pluginId = manifest.id;
    
    // 创建沙箱环境
    const sandbox = this.createSandbox(pluginId, manifest);
    
    try {
      // 读取插件代码
      const code = await fs.readFile(entryPointPath, 'utf-8');
      
      // 在沙箱中执行代码
      const script = new vm.Script(code, {
        filename: entryPointPath,
      });
      
      script.runInContext(sandbox, { timeout: 5000 });
      
      // 获取插件类或工厂函数（兼容 module.exports / exports / 全局命名导出）
      const moduleExports = (sandbox as any).module?.exports;
      const exportsObject = (sandbox as any).exports;
      const namedExport = (sandbox as any)[this.getExportName(entryPointPath)];
      const pluginClass =
        moduleExports?.default ||
        moduleExports ||
        exportsObject?.default ||
        (exportsObject && Object.keys(exportsObject).length > 0 ? exportsObject : undefined) ||
        namedExport;
      
      if (!pluginClass) {
        throw new PluginLoadError(`插件未导出类或工厂函数: ${entryPointPath}`);
      }
      
      // 创建插件实例
      const pluginInstance = typeof pluginClass === 'function'
        ? new pluginClass()
        : pluginClass;
      
      // 缓存沙箱
      this.sandboxCache.set(pluginId, sandbox);
      
      return pluginInstance;
      
    } catch (error) {
      console.error(`[PluginLoader] 沙箱加载失败: ${pluginId}`, error);
      throw new PluginLoadError(`沙箱加载失败: ${getErrorMessage(error)}`);
    }
  }
  
  /**
   * 使用VM加载插件
   * 宪法依据: §381安全公理 - 严格隔离
   */
  private async loadWithVM(entryPointPath: string, manifest: PluginManifest): Promise<any> {
    const pluginId = manifest.id;
    
    try {
      // 创建更严格的VM环境
      const context = vm.createContext({
        console: {
          log: (...args: any[]) => console.log(`[Plugin:${pluginId}]`, ...args),
          warn: (...args: any[]) => console.warn(`[Plugin:${pluginId}]`, ...args),
          error: (...args: any[]) => console.error(`[Plugin:${pluginId}]`, ...args),
        },
        require: this.createSafeRequire(pluginId),
        exports: {},
        module: { exports: {} },
        __filename: entryPointPath,
        __dirname: path.dirname(entryPointPath),
        Buffer,
        process: {
          env: { NODE_ENV: process.env.NODE_ENV || 'development' },
          cwd: () => path.dirname(entryPointPath),
          platform: process.platform,
          arch: process.arch,
          version: process.version,
          versions: process.versions,
        },
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        Date,
        Math,
        JSON,
        Error,
        TypeError,
        RangeError,
        ReferenceError,
        SyntaxError,
      });
      
      // 读取并执行代码
      const code = await fs.readFile(entryPointPath, 'utf-8');
      const script = new vm.Script(code, {
        filename: entryPointPath,
      });
      
      script.runInContext(context, { timeout: 3000 });
      
      // 获取插件实例
      const pluginInstance = context.module.exports || context.exports;
      
      if (!pluginInstance || Object.keys(pluginInstance).length === 0) {
        throw new PluginLoadError(`插件未导出任何内容: ${entryPointPath}`);
      }
      
      return pluginInstance;
      
    } catch (error) {
      console.error(`[PluginLoader] VM加载失败: ${pluginId}`, error);
      throw new PluginLoadError(`VM加载失败: ${getErrorMessage(error)}`);
    }
  }
  
  /**
   * 使用标准require加载插件
   * 宪法依据: §110协作效率公理 - 性能优先
   */
  private async loadWithRequire(entryPointPath: string, manifest: PluginManifest): Promise<any> {
    const pluginId = manifest.id;
    
    try {
      // 清除require缓存（如果已存在）
      this.clearRequireCache(entryPointPath);
      
      // 使用require加载模块
      const pluginModule = require(entryPointPath);
      
      // 获取插件类或工厂函数
      const pluginClass = pluginModule.default || pluginModule;
      
      if (!pluginClass) {
        throw new PluginLoadError(`插件未导出默认类: ${entryPointPath}`);
      }
      
      // 创建插件实例
      const pluginInstance = typeof pluginClass === 'function'
        ? new pluginClass()
        : pluginClass;
      
      return pluginInstance;
      
    } catch (error) {
      console.error(`[PluginLoader] require加载失败: ${pluginId}`, error);
      throw new PluginLoadError(`require加载失败: ${getErrorMessage(error)}`);
    }
  }
  
  /**
   * 创建沙箱环境
   */
  private createSandbox(pluginId: string, manifest: PluginManifest): vm.Context {
    const sandbox = vm.createContext({
      // 控制台（带插件前缀）
      console: {
        log: (...args: any[]) => console.log(`[Plugin:${pluginId}]`, ...args),
        info: (...args: any[]) => console.info(`[Plugin:${pluginId}]`, ...args),
        warn: (...args: any[]) => console.warn(`[Plugin:${pluginId}]`, ...args),
        error: (...args: any[]) => console.error(`[Plugin:${pluginId}]`, ...args),
        debug: (...args: any[]) => console.debug(`[Plugin:${pluginId}]`, ...args),
      },
      
      // 受限的require函数
      require: this.createSafeRequire(pluginId),
      
      // 模块导出
      exports: {},
      module: { exports: {} },
      
      // 文件信息
      __filename: `plugin://${pluginId}/index.js`,
      __dirname: `plugin://${pluginId}`,
      
      // 安全的全局对象
      Buffer,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Date,
      Math,
      JSON,
      RegExp,
      Error,
      TypeError,
      RangeError,
      ReferenceError,
      SyntaxError,
      Promise,
      
      // 受限的定时器
      setTimeout: (handler: (...args: any[]) => void, timeout?: number, ...args: any[]) => {
        if (timeout && timeout > 10000) {
          throw new Error('定时器超时不能超过10秒');
        }
        return setTimeout(handler, Math.min(timeout || 0, 10000), ...args);
      },
      clearTimeout,
      setInterval: (handler: (...args: any[]) => void, timeout?: number, ...args: any[]) => {
        if (timeout && timeout > 5000) {
          throw new Error('间隔定时器不能超过5秒');
        }
        return setInterval(handler, Math.min(timeout || 0, 5000), ...args);
      },
      clearInterval,
      
      // 受限的进程对象
      process: {
        env: {
          NODE_ENV: process.env.NODE_ENV || 'development',
          PLUGIN_ID: pluginId,
        },
        cwd: () => `plugin://${pluginId}`,
        platform: process.platform,
        arch: process.arch,
        version: process.version,
        versions: process.versions,
        memoryUsage: () => ({
          rss: 0,
          heapTotal: 0,
          heapUsed: 0,
          external: 0,
          arrayBuffers: 0,
        }),
        uptime: () => 0,
        hrtime: process.hrtime,
      },
      
      // 插件特定的全局变量
      PLUGIN_MANIFEST: manifest,
      PLUGIN_ID: pluginId,
    });
    
    return sandbox;
  }
  
  /**
   * 创建安全的require函数
   * 宪法依据: §381安全公理 - 限制模块访问
   */
  private createSafeRequire(pluginId: string): (moduleName: string) => any {
    const safeModules = new Set([
      'path',
      'url',
      'querystring',
      'crypto',
      'stream',
      'util',
      'events',
      'assert',
      'buffer',
      'string_decoder',
      'timers',
    ]);
    
    const allowedNodeModules = new Set([
      'fs/promises',
      'fs',
      'os',
      'net',
      'dns',
      'http',
      'https',
      'zlib',
      'child_process',
    ]);
    
    return (moduleName: string): any => {
      // 检查是否是内置模块
      if (safeModules.has(moduleName)) {
        return require(moduleName);
      }
      
      // 检查是否是允许的Node.js模块
      if (allowedNodeModules.has(moduleName)) {
        // 对于敏感模块，返回受限版本
        if (moduleName === 'fs' || moduleName === 'fs/promises') {
          return this.createRestrictedFs(pluginId);
        }
        
        if (moduleName === 'child_process') {
          throw new Error(`插件 ${pluginId} 不允许访问 child_process 模块`);
        }
        
        if (moduleName === 'net' || moduleName === 'dns') {
          throw new Error(`插件 ${pluginId} 不允许访问网络模块`);
        }
        
        return require(moduleName);
      }
      
      // 检查是否是相对路径模块
      if (moduleName.startsWith('.') || moduleName.startsWith('/')) {
        // 限制插件只能加载自己目录下的模块
        const pluginDir = path.join(process.cwd(), 'plugins', pluginId);
        const resolvedPath = path.resolve(pluginDir, moduleName);
        
        if (!resolvedPath.startsWith(pluginDir)) {
          throw new Error(`插件 ${pluginId} 不允许访问外部模块: ${moduleName}`);
        }
        
        return require(resolvedPath);
      }
      
      // 检查是否是允许的第三方模块
      const allowedThirdParty = new Set([
        'axios',
        'lodash',
        'moment',
        'uuid',
        'winston',
        'pino',
      ]);
      
      if (allowedThirdParty.has(moduleName)) {
        try {
          return require(moduleName);
        } catch (error) {
          throw new Error(`模块 ${moduleName} 未安装，插件 ${pluginId} 无法加载`);
        }
      }
      
      throw new Error(`插件 ${pluginId} 不允许访问模块: ${moduleName}`);
    };
  }
  
  /**
   * 创建受限的文件系统模块
   */
  private createRestrictedFs(pluginId: string): any {
    const pluginDir = path.join(process.cwd(), 'plugins', pluginId);
    const logsDir = path.join(process.cwd(), 'logs');
    
    const allowedPaths = new Set([pluginDir, logsDir]);
    
    const checkPath = (filePath: string, operation: string): void => {
      const resolvedPath = path.resolve(filePath);
      
      // 检查路径是否在允许的目录内
      const isAllowed = Array.from(allowedPaths).some(allowedPath =>
        resolvedPath.startsWith(allowedPath)
      );
      
      if (!isAllowed) {
        throw new Error(`插件 ${pluginId} 不允许 ${operation} 路径: ${filePath}`);
      }
    };
    
    return {
      // 只读操作
      readFile: async (filePath: string, options?: any) => {
        checkPath(filePath, '读取文件');
        return fs.readFile(filePath, options);
      },
      
      readFileSync: (filePath: string, options?: any) => {
        checkPath(filePath, '同步读取文件');
        return require('fs').readFileSync(filePath, options);
      },
      
      exists: async (filePath: string) => {
        checkPath(filePath, '检查文件存在');
        try {
          await fs.access(filePath);
          return true;
        } catch {
          return false;
        }
      },
      
      existsSync: (filePath: string) => {
        checkPath(filePath, '同步检查文件存在');
        return require('fs').existsSync(filePath);
      },
      
      stat: async (filePath: string) => {
        checkPath(filePath, '获取文件状态');
        return fs.stat(filePath);
      },
      
      statSync: (filePath: string) => {
        checkPath(filePath, '同步获取文件状态');
        return require('fs').statSync(filePath);
      },
      
      readdir: async (dirPath: string, options?: any) => {
        checkPath(dirPath, '读取目录');
        return fs.readdir(dirPath, options);
      },
      
      readdirSync: (dirPath: string, options?: any) => {
        checkPath(dirPath, '同步读取目录');
        return require('fs').readdirSync(dirPath, options);
      },
      
      // 受限的写入操作（只能写入插件目录和日志目录）
      writeFile: async (filePath: string, data: any, options?: any) => {
        checkPath(filePath, '写入文件');
        
        // 确保目录存在
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        
        return fs.writeFile(filePath, data, options);
      },
      
      writeFileSync: (filePath: string, data: any, options?: any) => {
        checkPath(filePath, '同步写入文件');
        
        // 确保目录存在
        const dir = path.dirname(filePath);
        require('fs').mkdirSync(dir, { recursive: true });
        
        return require('fs').writeFileSync(filePath, data, options);
      },
      
      appendFile: async (filePath: string, data: any, options?: any) => {
        checkPath(filePath, '追加文件');
        return fs.appendFile(filePath, data, options);
      },
      
      appendFileSync: (filePath: string, data: any, options?: any) => {
        checkPath(filePath, '同步追加文件');
        return require('fs').appendFileSync(filePath, data, options);
      },
      
      // 受限的删除操作
      unlink: async (filePath: string) => {
        checkPath(filePath, '删除文件');
        
        // 不允许删除日志文件
        if (filePath.includes('logs') && !filePath.includes(pluginId)) {
          throw new Error(`插件 ${pluginId} 不允许删除日志文件`);
        }
        
        return fs.unlink(filePath);
      },
      
      unlinkSync: (filePath: string) => {
        checkPath(filePath, '同步删除文件');
        
        // 不允许删除日志文件
        if (filePath.includes('logs') && !filePath.includes(pluginId)) {
          throw new Error(`插件 ${pluginId} 不允许删除日志文件`);
        }
        
        return require('fs').unlinkSync(filePath);
      },
      
      // 其他操作（受限）
      createReadStream: (filePath: string, options?: any) => {
        checkPath(filePath, '创建读流');
        return require('fs').createReadStream(filePath, options);
      },
      
      createWriteStream: (filePath: string, options?: any) => {
        checkPath(filePath, '创建写流');
        return require('fs').createWriteStream(filePath, options);
      },
    };
  }
  
  /**
   * 获取导出名称
   */
  private getExportName(entryPointPath: string): string {
    const ext = path.extname(entryPointPath);
    const basename = path.basename(entryPointPath, ext);
    
    // 转换为驼峰命名
    return basename
      .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
      .replace(/^./, c => c.toUpperCase());
  }
  
  /**
   * 清除require缓存
   */
  private clearRequireCache(modulePath: string): void {
    const resolvedPath = require.resolve(modulePath);
    
    // 删除缓存中所有相关的模块
    Object.keys(require.cache).forEach(key => {
      if (key === resolvedPath || key.startsWith(path.dirname(resolvedPath))) {
        delete require.cache[key];
      }
    });
  }
  
  /**
   * 验证清单基本格式
   */
  private validateManifestBasic(manifest: PluginManifest): void {
    if (!manifest.id || typeof manifest.id !== 'string') {
      throw new PluginLoadError('插件ID缺失或无效');
    }
    
    if (!manifest.name || typeof manifest.name !== 'string') {
      throw new PluginLoadError('插件名称缺失或无效');
    }
    
    if (!manifest.version || typeof manifest.version !== 'string') {
      throw new PluginLoadError('插件版本缺失或无效');
    }
    
    if (!manifest.type || !Object.values(PluginType).includes(manifest.type)) {
      throw new PluginLoadError(`插件类型无效: ${manifest.type}`);
    }
    
    if (!manifest.entryPoint || typeof manifest.entryPoint !== 'string') {
      throw new PluginLoadError('插件入口点缺失或无效');
    }
  }
  
  /**
   * 验证插件实例
   */
  private validatePluginInstance(instance: any, manifest: PluginManifest): void {
    if (!instance) {
      throw new PluginLoadError('插件实例为空');
    }
    
    // 检查必要的接口方法
    const requiredMethods = [
      'initialize',
      'getManifest',
      'getStatus',
      'cleanup',
    ];
    
    const missingMethods = requiredMethods.filter(method => 
      typeof instance[method] !== 'function'
    );
    
    if (missingMethods.length > 0) {
      throw new PluginLoadError(`插件缺失必要方法: ${missingMethods.join(', ')}`);
    }
    
    // 根据插件类型检查特定方法
    switch (manifest.type) {
      case PluginType.HTTP_MIDDLEWARE:
        if (typeof instance.getMiddleware !== 'function') {
          throw new PluginLoadError('HTTP中间件插件必须实现getMiddleware方法');
        }
        break;
        
      case PluginType.WEBSOCKET_MIDDLEWARE:
        if (typeof instance.handleConnection !== 'function' &&
            typeof instance.handleMessage !== 'function') {
          throw new PluginLoadError('WebSocket中间件插件必须实现handleConnection或handleMessage方法');
        }
        break;
        
      case PluginType.EVENT_HANDLER:
        if (typeof instance.subscribe !== 'function' &&
            typeof instance.publish !== 'function') {
          throw new PluginLoadError('事件处理器插件必须实现subscribe或publish方法');
        }
        break;
    }
  }
}

// ========== 错误类型 ==========

export class PluginLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PluginLoadError';
  }
}
