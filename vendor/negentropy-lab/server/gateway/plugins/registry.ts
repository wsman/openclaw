/**
 * 🚀 插件注册表
 * 宪法依据: §152单一真理源公理、§101同步公理、§110协作效率公理
 * 
 * 插件注册表是插件系统的中央注册中心，负责：
 * 1. 插件元数据管理
 * 2. 插件依赖关系跟踪
 * 3. 插件状态维护
 * 4. 快速查询和检索
 * 
 * 版本: v1.0.0
 * 创建时间: 2026-02-11
 * 维护者: 科技部插件系统团队
 */

import { LoadedPlugin, PluginManifest, PluginType, PluginStatus } from './types';

/**
 * 插件注册表记录
 */
interface PluginRegistryRecord {
  plugin: LoadedPlugin;
  dependencies: Set<string>;
  dependents: Set<string>;
  loadedAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
}

/**
 * 🚀 插件注册表
 */
export class PluginRegistry {
  private plugins: Map<string, PluginRegistryRecord>;
  private typeIndex: Map<PluginType, Set<string>>;
  private statusIndex: Map<PluginStatus, Set<string>>;
  private nameIndex: Map<string, string>; // name -> id
  
  constructor() {
    this.plugins = new Map();
    this.typeIndex = new Map();
    this.statusIndex = new Map();
    this.nameIndex = new Map();
    
    // 初始化索引
    Object.values(PluginType).forEach(type => {
      this.typeIndex.set(type, new Set());
    });
    
    Object.values(PluginStatus).forEach(status => {
      this.statusIndex.set(status, new Set());
    });
  }
  
  /**
   * 初始化注册表
   */
  async initialize(): Promise<void> {
    console.log('[PluginRegistry] 插件注册表初始化完成');
  }
  
  /**
   * 注册插件
   */
  async registerPlugin(plugin: LoadedPlugin): Promise<void> {
    const id = plugin.manifest.id;
    const name = plugin.manifest.name;
    const type = plugin.manifest.type;
    const status = plugin.status;
    
    console.log(`[PluginRegistry] 注册插件: ${name} (${id})`);
    
    // 创建注册记录
    const record: PluginRegistryRecord = {
      plugin,
      dependencies: new Set(plugin.manifest.dependencies?.required || []),
      dependents: new Set(),
      loadedAt: new Date(),
      lastAccessedAt: new Date(),
      accessCount: 0,
    };
    
    // 添加到主注册表
    this.plugins.set(id, record);
    
    // 更新索引
    this.updateTypeIndex(id, type);
    this.updateStatusIndex(id, status);
    this.nameIndex.set(name, id);
    
    // 更新依赖项的dependents集合
    record.dependencies.forEach(depId => {
      const depRecord = this.plugins.get(depId);
      if (depRecord) {
        depRecord.dependents.add(id);
      }
    });
    
    console.log(`[PluginRegistry] 插件注册完成: ${name} (${id})`);
  }
  
  /**
   * 注销插件
   */
  async unregisterPlugin(pluginId: string): Promise<void> {
    const record = this.plugins.get(pluginId);
    if (!record) {
      throw new Error(`插件未找到: ${pluginId}`);
    }
    
    const plugin = record.plugin;
    const name = plugin.manifest.name;
    const type = plugin.manifest.type;
    const status = plugin.status;
    
    console.log(`[PluginRegistry] 注销插件: ${name} (${pluginId})`);
    
    // 检查是否有插件依赖于此插件
    if (record.dependents.size > 0) {
      const dependents = Array.from(record.dependents).join(', ');
      throw new Error(`无法注销插件 ${name}: 以下插件依赖于此插件: ${dependents}`);
    }
    
    // 从依赖项的dependents集合中移除
    record.dependencies.forEach(depId => {
      const depRecord = this.plugins.get(depId);
      if (depRecord) {
        depRecord.dependents.delete(pluginId);
      }
    });
    
    // 从索引中移除
    this.removeFromTypeIndex(pluginId, type);
    this.removeFromStatusIndex(pluginId, status);
    this.nameIndex.delete(name);
    
    // 从主注册表中移除
    this.plugins.delete(pluginId);
    
    console.log(`[PluginRegistry] 插件注销完成: ${name} (${pluginId})`);
  }
  
  /**
   * 获取插件
   */
  getPlugin(pluginId: string): LoadedPlugin | undefined {
    const record = this.plugins.get(pluginId);
    if (record) {
      record.lastAccessedAt = new Date();
      record.accessCount++;
      return record.plugin;
    }
    return undefined;
  }
  
  /**
   * 通过名称获取插件
   */
  getPluginByName(name: string): LoadedPlugin | undefined {
    const id = this.nameIndex.get(name);
    return id ? this.getPlugin(id) : undefined;
  }
  
  /**
   * 获取所有插件
   */
  getAllPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values()).map(record => {
      record.lastAccessedAt = new Date();
      record.accessCount++;
      return record.plugin;
    });
  }
  
  /**
   * 按类型获取插件
   */
  getPluginsByType(type: PluginType): LoadedPlugin[] {
    const ids = this.typeIndex.get(type);
    if (!ids || ids.size === 0) {
      return [];
    }
    
    return Array.from(ids)
      .map(id => this.plugins.get(id))
      .filter(record => record !== undefined)
      .map(record => {
        record!.lastAccessedAt = new Date();
        record!.accessCount++;
        return record!.plugin;
      });
  }
  
  /**
   * 按状态获取插件
   */
  getPluginsByStatus(status: PluginStatus): LoadedPlugin[] {
    const ids = this.statusIndex.get(status);
    if (!ids || ids.size === 0) {
      return [];
    }
    
    return Array.from(ids)
      .map(id => this.plugins.get(id))
      .filter(record => record !== undefined)
      .map(record => {
        record!.lastAccessedAt = new Date();
        record!.accessCount++;
        return record!.plugin;
      });
  }
  
  /**
   * 获取插件依赖关系
   */
  getPluginDependencies(pluginId: string): string[] {
    const record = this.plugins.get(pluginId);
    return record ? Array.from(record.dependencies) : [];
  }
  
  /**
   * 获取插件被依赖关系
   */
  getPluginDependents(pluginId: string): string[] {
    const record = this.plugins.get(pluginId);
    return record ? Array.from(record.dependents) : [];
  }
  
  /**
   * 检查插件是否存在
   */
  hasPlugin(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }
  
  /**
   * 获取插件统计信息
   */
  getStatistics() {
    const total = this.plugins.size;
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    
    // 按类型统计
    for (const [type, ids] of this.typeIndex) {
      byType[type] = ids.size;
    }
    
    // 按状态统计
    for (const [status, ids] of this.statusIndex) {
      byStatus[status] = ids.size;
    }
    
    // 计算平均访问次数
    let totalAccessCount = 0;
    let oldestLoaded: Date | null = null;
    let newestLoaded: Date | null = null;
    
    for (const record of this.plugins.values()) {
      totalAccessCount += record.accessCount;
      
      if (!oldestLoaded || record.loadedAt < oldestLoaded) {
        oldestLoaded = record.loadedAt;
      }
      
      if (!newestLoaded || record.loadedAt > newestLoaded) {
        newestLoaded = record.loadedAt;
      }
    }
    
    const avgAccessCount = total > 0 ? totalAccessCount / total : 0;
    
    return {
      total,
      byType,
      byStatus,
      avgAccessCount,
      oldestLoaded,
      newestLoaded,
    };
  }
  
  /**
   * 更新插件状态
   */
  updatePluginStatus(pluginId: string, newStatus: PluginStatus): void {
    const record = this.plugins.get(pluginId);
    if (!record) {
      throw new Error(`插件未找到: ${pluginId}`);
    }
    
    const oldStatus = record.plugin.status;
    if (oldStatus === newStatus) {
      return;
    }
    
    // 更新索引
    this.removeFromStatusIndex(pluginId, oldStatus);
    this.updateStatusIndex(pluginId, newStatus);
    
    // 更新插件状态
    record.plugin.status = newStatus;
    
    console.log(`[PluginRegistry] 插件状态更新: ${pluginId} ${oldStatus} -> ${newStatus}`);
  }
  
  /**
   * 销毁注册表
   */
  async destroy(): Promise<void> {
    console.log('[PluginRegistry] 清理插件注册表...');
    
    this.plugins.clear();
    this.typeIndex.clear();
    this.statusIndex.clear();
    this.nameIndex.clear();
    
    console.log('[PluginRegistry] 插件注册表已销毁');
  }
  
  /**
   * 更新类型索引
   */
  private updateTypeIndex(pluginId: string, type: PluginType): void {
    const typeSet = this.typeIndex.get(type);
    if (typeSet) {
      typeSet.add(pluginId);
    } else {
      // 如果类型不存在于索引中，创建新的集合
      this.typeIndex.set(type, new Set([pluginId]));
    }
  }
  
  /**
   * 从类型索引中移除
   */
  private removeFromTypeIndex(pluginId: string, type: PluginType): void {
    const typeSet = this.typeIndex.get(type);
    if (typeSet) {
      typeSet.delete(pluginId);
    }
  }
  
  /**
   * 更新状态索引
   */
  private updateStatusIndex(pluginId: string, status: PluginStatus): void {
    const statusSet = this.statusIndex.get(status);
    if (statusSet) {
      statusSet.add(pluginId);
    } else {
      // 如果状态不存在于索引中，创建新的集合
      this.statusIndex.set(status, new Set([pluginId]));
    }
  }
  
  /**
   * 从状态索引中移除
   */
  private removeFromStatusIndex(pluginId: string, status: PluginStatus): void {
    const statusSet = this.statusIndex.get(status);
    if (statusSet) {
      statusSet.delete(pluginId);
    }
  }
}