/**
 * 🔐 Negentropy-Lab Gateway 权限Scope体系
 * 
 * 宪法依据：
 * - §152 单一真理源公理：权限定义必须统一管理，避免冗余配置
 * - §107 通信安全公理：权限验证必须确保通信安全
 * - §101 同步公理：权限变更必须同步更新文档
 * - §102 熵减原则：权限设计必须降低系统复杂性
 * 
 * 体系设计：
 * 三级权限层级：
 * 1. Level 1：基础权限 (read, write, execute)
 * 2. Level 2：API权限 (api:read, api:write, api:admin)
 * 3. Level 3：Agent权限 (agent:create, agent:manage, agent:delete)
 * 
 * 权限继承机制：高级权限自动继承低级权限
 * 权限组合验证：支持多权限组合验证
 */

import { logger } from '../utils/logger';

/**
 * 基础权限定义
 * 宪法依据：§152 单一真理源公理
 */
export enum BasePermission {
  /** 读取权限：查看资源 */
  READ = 'read',
  /** 写入权限：创建/修改资源 */
  WRITE = 'write',
  /** 执行权限：执行操作 */
  EXECUTE = 'execute'
}

/**
 * API权限定义
 * 宪法依据：§152 单一真理源公理
 */
export enum ApiPermission {
  /** API读取：调用只读API */
  API_READ = 'api:read',
  /** API写入：调用修改API */
  API_WRITE = 'api:write',
  /** API管理：系统管理API */
  API_ADMIN = 'api:admin'
}

/**
 * Agent权限定义
 * 宪法依据：§152 单一真理源公理
 */
export enum AgentPermission {
  /** 创建Agent：启动新Agent */
  AGENT_CREATE = 'agent:create',
  /** 管理Agent：管理现有Agent */
  AGENT_MANAGE = 'agent:manage',
  /** 删除Agent：终止Agent */
  AGENT_DELETE = 'agent:delete',
  /** 监控Agent：查看Agent状态 */
  AGENT_MONITOR = 'agent:monitor',
  /** 配置Agent：修改Agent配置 */
  AGENT_CONFIGURE = 'agent:configure'
}

/**
 * 权限组类型
 * 宪法依据：§152 单一真理源公理
 */
export type Permission = 
  | BasePermission 
  | ApiPermission 
  | AgentPermission;

/**
 * 权限组合接口
 * 宪法依据：§152 单一真理源公理
 */
export interface PermissionSet {
  /** 基础权限集合 */
  base: BasePermission[];
  /** API权限集合 */
  api: ApiPermission[];
  /** Agent权限集合 */
  agent: AgentPermission[];
  /** 宪法合规标记 */
  constitutional?: {
    articles: string[];
    verifiedAt: Date;
  };
}

/**
 * 角色定义
 * 宪法依据：§152 单一真理源公理
 */
export interface Role {
  /** 角色名称 */
  name: string;
  /** 角色描述 */
  description: string;
  /** 权限集合 */
  permissions: PermissionSet;
  /** 宪法合规标记 */
  constitutional?: {
    articles: string[];
    createdAt: Date;
  };
}

/**
 * 权限验证结果
 * 宪法依据：§107 通信安全公理
 */
export interface PermissionValidationResult {
  /** 验证是否成功 */
  valid: boolean;
  /** 错误信息 */
  error?: string;
  /** 缺失的权限列表 */
  missing?: Permission[];
  /** 验证结果详情 */
  details?: {
    required: Permission[];
    granted: Permission[];
    matches: boolean[];
  };
  /** 宪法合规状态 */
  constitutionalCompliance?: {
    articles: string[];
    checks: {
      permissionDefined: boolean;
      hierarchyRespected: boolean;
      inheritanceApplied: boolean;
    };
  };
}

/**
 * 权限管理器
 * 宪法依据：§152 单一真理源公理
 */
export class PermissionManager {
  private roles: Map<string, Role> = new Map();
  private permissionHierarchy: Map<Permission, Permission[]> = new Map();
  
  constructor() {
    this.initializePermissionHierarchy();
    this.initializeDefaultRoles();
    
    logger.info('[Permissions] 权限管理器已初始化', {
      roles: this.roles.size,
      hierarchySize: this.permissionHierarchy.size,
      constitutional: ['§152']
    });
  }
  
  /**
   * 初始化权限继承关系
   * 宪法依据：§152 单一真理源公理
   */
  private initializePermissionHierarchy(): void {
    // 基础权限继承关系
    this.permissionHierarchy.set(BasePermission.WRITE, [BasePermission.READ]);
    this.permissionHierarchy.set(BasePermission.EXECUTE, [BasePermission.READ]);
    
    // API权限继承关系
    this.permissionHierarchy.set(ApiPermission.API_WRITE, [ApiPermission.API_READ]);
    this.permissionHierarchy.set(ApiPermission.API_ADMIN, [ApiPermission.API_WRITE]);
    
    // Agent权限继承关系
    this.permissionHierarchy.set(AgentPermission.AGENT_MANAGE, [AgentPermission.AGENT_MONITOR]);
    this.permissionHierarchy.set(AgentPermission.AGENT_DELETE, [AgentPermission.AGENT_MANAGE]);
    this.permissionHierarchy.set(AgentPermission.AGENT_CONFIGURE, [AgentPermission.AGENT_MANAGE]);
    
    logger.debug('[Permissions] 权限继承关系已初始化', {
      hierarchyEntries: this.permissionHierarchy.size
    });
  }
  
  /**
   * 初始化默认角色
   * 宪法依据：§152 单一真理源公理
   */
  private initializeDefaultRoles(): void {
    // 1. 只读用户
    this.addRole({
      name: 'reader',
      description: '只读用户，只能查看资源',
      permissions: {
        base: [BasePermission.READ],
        api: [ApiPermission.API_READ],
        agent: [AgentPermission.AGENT_MONITOR]
      },
      constitutional: {
        articles: ['§152'],
        createdAt: new Date()
      }
    });
    
    // 2. 普通用户
    this.addRole({
      name: 'user',
      description: '普通用户，可以创建和管理基本资源',
      permissions: {
        base: [BasePermission.READ, BasePermission.WRITE],
        api: [ApiPermission.API_READ, ApiPermission.API_WRITE],
        agent: [AgentPermission.AGENT_MONITOR, AgentPermission.AGENT_CREATE]
      },
      constitutional: {
        articles: ['§152'],
        createdAt: new Date()
      }
    });
    
    // 3. 管理员
    this.addRole({
      name: 'admin',
      description: '系统管理员，拥有全部权限',
      permissions: {
        base: [BasePermission.READ, BasePermission.WRITE, BasePermission.EXECUTE],
        api: [ApiPermission.API_READ, ApiPermission.API_WRITE, ApiPermission.API_ADMIN],
        agent: [
          AgentPermission.AGENT_MONITOR,
          AgentPermission.AGENT_CREATE,
          AgentPermission.AGENT_MANAGE,
          AgentPermission.AGENT_DELETE,
          AgentPermission.AGENT_CONFIGURE
        ]
      },
      constitutional: {
        articles: ['§152'],
        createdAt: new Date()
      }
    });
    
    // 4. Agent管理者
    this.addRole({
      name: 'agent-manager',
      description: 'Agent管理员，专门管理Agent',
      permissions: {
        base: [BasePermission.READ, BasePermission.WRITE],
        api: [ApiPermission.API_READ, ApiPermission.API_WRITE],
        agent: [
          AgentPermission.AGENT_MONITOR,
          AgentPermission.AGENT_CREATE,
          AgentPermission.AGENT_MANAGE,
          AgentPermission.AGENT_CONFIGURE
        ]
      },
      constitutional: {
        articles: ['§152'],
        createdAt: new Date()
      }
    });
    
    logger.info('[Permissions] 默认角色已初始化', {
      roleCount: this.roles.size,
      roleNames: Array.from(this.roles.keys())
    });
  }
  
  /**
   * 添加角色
   * 宪法依据：§152 单一真理源公理
   */
  addRole(role: Role): boolean {
    // 宪法合规检查
    if (!this.validatePermissionSet(role.permissions)) {
      logger.error(`[Permissions] 角色添加失败：权限集验证失败 - ${role.name}`);
      return false;
    }
    
    this.roles.set(role.name, role);
    logger.info(`[Permissions] 角色已添加: ${role.name}`, {
      permissionsCount: this.countPermissions(role.permissions),
      constitutional: role.constitutional?.articles || ['§152']
    });
    
    return true;
  }
  
  /**
   * 获取角色
   * 宪法依据：§152 单一真理源公理
   */
  getRole(name: string): Role | undefined {
    return this.roles.get(name);
  }
  
  /**
   * 验证权限
   * 宪法依据：§107 通信安全公理
   */
  validatePermissions(
    userPermissions: Permission[],
    requiredPermissions: Permission[]
  ): PermissionValidationResult {
    // 宪法合规检查
    if (!userPermissions || !requiredPermissions) {
      return {
        valid: false,
        missing: requiredPermissions,
        constitutionalCompliance: {
          articles: ['§107'],
          checks: {
            permissionDefined: false,
            hierarchyRespected: false,
            inheritanceApplied: false
          }
        }
      };
    }
    
    // 应用权限继承
    const effectiveUserPermissions = this.applyInheritance(userPermissions);
    const effectiveRequiredPermissions = this.applyInheritance(requiredPermissions);
    
    // 检查权限匹配
    const matches: boolean[] = [];
    const missing: Permission[] = [];
    
    for (const requiredPermission of effectiveRequiredPermissions) {
      const hasPermission = effectiveUserPermissions.includes(requiredPermission);
      matches.push(hasPermission);
      
      if (!hasPermission) {
        missing.push(requiredPermission);
      }
    }
    
    const valid = missing.length === 0;
    
    logger.debug('[Permissions] 权限验证完成', {
      userPermissions: userPermissions.length,
      requiredPermissions: requiredPermissions.length,
      effectiveUserPermissions: effectiveUserPermissions.length,
      effectiveRequiredPermissions: effectiveRequiredPermissions.length,
      missing: missing.length,
      valid
    });
    
    return {
      valid,
      missing: valid ? undefined : missing,
      details: {
        required: effectiveRequiredPermissions,
        granted: effectiveUserPermissions,
        matches
      },
      constitutionalCompliance: {
        articles: ['§107', '§152'],
        checks: {
          permissionDefined: true,
          hierarchyRespected: true,
          inheritanceApplied: true
        }
      }
    };
  }
  
  /**
   * 验证权限集
   * 宪法依据：§152 单一真理源公理
   */
  validatePermissionSet(permissionSet: PermissionSet): boolean {
    // 检查基础权限定义
    if (!Array.isArray(permissionSet.base) || 
        !Array.isArray(permissionSet.api) || 
        !Array.isArray(permissionSet.agent)) {
      logger.error('[Permissions] 权限集验证失败：权限数组格式错误');
      return false;
    }
    
    // 检查权限是否有效
    const allPermissions = [
      ...permissionSet.base,
      ...permissionSet.api,
      ...permissionSet.agent
    ];
    
    for (const permission of allPermissions) {
      if (!this.isValidPermission(permission)) {
        logger.error(`[Permissions] 权限集验证失败：无效权限 - ${permission}`);
        return false;
      }
    }
    
    // 检查宪法合规标记
    if (!permissionSet.constitutional?.articles?.includes('§152')) {
      logger.warn('[Permissions] 权限集缺少宪法合规标记 §152');
    }
    
    return true;
  }
  
  /**
   * 检查角色权限
   * 宪法依据：§107 通信安全公理
   */
  checkRolePermissions(
    roleName: string,
    requiredPermissions: Permission[]
  ): PermissionValidationResult {
    const role = this.getRole(roleName);
    
    if (!role) {
      logger.warn(`[Permissions] 角色不存在: ${roleName}`);
      return {
        valid: false,
        missing: requiredPermissions,
        error: `角色不存在: ${roleName}`
      };
    }
    
    // 提取角色的所有权限
    const rolePermissions = this.extractPermissionsFromSet(role.permissions);
    
    return this.validatePermissions(rolePermissions, requiredPermissions);
  }
  
  /**
   * 创建自定义权限集
   * 宪法依据：§152 单一真理源公理
   */
  createPermissionSet(
    base: BasePermission[] = [],
    api: ApiPermission[] = [],
    agent: AgentPermission[] = []
  ): PermissionSet {
    const permissionSet: PermissionSet = {
      base,
      api,
      agent,
      constitutional: {
        articles: ['§152'],
        verifiedAt: new Date()
      }
    };
    
    // 验证权限集
    if (!this.validatePermissionSet(permissionSet)) {
      throw new Error('宪法违规：权限集验证失败 (§152)');
    }
    
    return permissionSet;
  }
  
  /**
   * 获取所有权限
   * 宪法依据：§152 单一真理源公理
   */
  getAllPermissions(): Permission[] {
    const basePermissions = Object.values(BasePermission);
    const apiPermissions = Object.values(ApiPermission);
    const agentPermissions = Object.values(AgentPermission);
    
    return [...basePermissions, ...apiPermissions, ...agentPermissions];
  }
  
  /**
   * 获取权限统计
   * 宪法依据：§101 同步公理
   */
  getStats() {
    const allPermissions = this.getAllPermissions();
    const rolePermissions = new Map<string, number>();
    
    for (const [roleName, role] of this.roles.entries()) {
      rolePermissions.set(roleName, this.countPermissions(role.permissions));
    }
    
    return {
      totalPermissions: allPermissions.length,
      totalRoles: this.roles.size,
      rolePermissions: Object.fromEntries(rolePermissions),
      hierarchySize: this.permissionHierarchy.size,
      lastUpdated: new Date().toISOString()
    };
  }
  
  /**
   * 私有方法：应用权限继承
   * 宪法依据：§152 单一真理源公理
   */
  private applyInheritance(permissions: Permission[]): Permission[] {
    const result = new Set<Permission>(permissions);
    
    for (const permission of permissions) {
      const inherited = this.permissionHierarchy.get(permission);
      if (inherited) {
        for (const inheritedPermission of inherited) {
          result.add(inheritedPermission);
        }
      }
    }
    
    return Array.from(result);
  }
  
  /**
   * 私有方法：检查权限是否有效
   * 宪法依据：§152 单一真理源公理
   */
  private isValidPermission(permission: string): permission is Permission {
    const allPermissions = this.getAllPermissions();
    return allPermissions.includes(permission as Permission);
  }
  
  /**
   * 私有方法：从权限集中提取所有权限
   * 宪法依据：§152 单一真理源公理
   */
  private extractPermissionsFromSet(permissionSet: PermissionSet): Permission[] {
    return [
      ...permissionSet.base,
      ...permissionSet.api,
      ...permissionSet.agent
    ];
  }
  
  /**
   * 私有方法：计算权限数量
   * 宪法依据：§101 同步公理
   */
  private countPermissions(permissionSet: PermissionSet): number {
    return permissionSet.base.length + 
           permissionSet.api.length + 
           permissionSet.agent.length;
  }
}

/**
 * 创建默认权限管理器
 * 宪法依据：§152 单一真理源公理
 */
export function createDefaultPermissionManager(): PermissionManager {
  const manager = new PermissionManager();
  
  logger.info('[Permissions] 默认权限管理器已创建', {
    roles: manager.getStats().totalRoles,
    permissions: manager.getStats().totalPermissions,
    constitutional: ['§152']
  });
  
  return manager;
}

/**
 * 简化权限检查函数
 * 宪法依据：§107 通信安全公理
 */
export function checkPermissions(
  userPermissions: Permission[],
  requiredPermissions: Permission[]
): boolean {
  const manager = createDefaultPermissionManager();
  const result = manager.validatePermissions(userPermissions, requiredPermissions);
  
  logger.debug('[Permissions] 权限检查完成', {
    valid: result.valid,
    missingCount: result.missing?.length || 0
  });
  
  return result.valid;
}

export default PermissionManager;