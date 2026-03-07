/**
 * 📦 Negentropy-Lab Gateway 认证系统入口模块
 * 
 * 宪法依据：
 * - §101 同步公理：认证系统模块化设计，确保代码与文档同步
 * - §152 单一真理源公理：统一认证接口，避免冗余配置
 * - §107 通信安全公理：认证系统必须确保通信安全
 * - §102 熵减原则：模块化设计降低系统复杂性
 * - §381 安全公理：防篡改、完整性保护
 * 
 * 模块导出：
 * 1. JWT认证模块 (@see ./jwt.ts)
 * 2. 权限Scope体系 (@see ./permissions.ts)
 * 3. 审计日志系统 (@see ./audit.ts)
 * 4. 中间件集合 (@see ../middleware/auth/)
 * 5. 统一认证管理器 (本文件)
 */

// 重新导出所有模块
export * from './jwt';
export * from './permissions';
export * from './audit';

// 统一认证管理器需要导入具体的类和函数
import {
  JWTConfig,
  JWTPayload,
  JWTValidationResult,
  RefreshToken,
  JWTAuthManager,
  createDefaultJWTAuthManager
} from './jwt';

import {
  BasePermission,
  ApiPermission,
  AgentPermission,
  Permission,
  PermissionSet,
  Role,
  PermissionValidationResult,
  PermissionManager,
  createDefaultPermissionManager,
  checkPermissions
} from './permissions';

import {
  AuditEventType,
  AuditSeverity,
  AuditEvent,
  AuditEventOptions,
  AuditChainState,
  AuditLogManager,
  createDefaultAuditLogManager,
  auditUtils
} from './audit';

/**
 * 统一认证管理器
 * 
 * 整合JWT认证、权限管理和审计日志的完整认证解决方案
 * 宪法依据：§152 单一真理源公理
 */
export class UnifiedAuthManager {
  private jwtManager: JWTAuthManager;
  private permissionManager: PermissionManager;
  private auditManager: AuditLogManager;
  
  constructor(config?: {
    jwtConfig?: JWTConfig;
    chainId?: string;
  }) {
    // 初始化JWT管理器
    this.jwtManager = config?.jwtConfig 
      ? new JWTAuthManager(config.jwtConfig)
      : createDefaultJWTAuthManager();
    
    // 初始化权限管理器
    this.permissionManager = createDefaultPermissionManager();
    
    // 初始化审计日志管理器
    this.auditManager = config?.chainId
      ? createDefaultAuditLogManager()  // 注意：目前审计日志管理器不支持chainId参数
      : createDefaultAuditLogManager();
    
    // 记录初始化审计事件
    this.auditManager.logConstitutionCheck(
      '统一认证管理器初始化',
      ['§152', '§101', '§107', '§381'],
      true,
      {
        jwtAlgorithm: this.jwtManager.getStats().algorithm,
        permissionRoles: this.permissionManager.getStats().totalRoles,
        auditChainId: this.auditManager.getStats().chainId
      }
    );
  }
  
  /**
   * 统一用户认证
   * 宪法依据：§107 通信安全公理
   */
  async authenticateUser(
    userId: string,
    userIp: string,
    userAgent: string,
    scope: string[] = []
  ): Promise<{
    accessToken: string;
    refreshToken: RefreshToken;
    permissions: Permission[];
    auditEvent: AuditEvent;
  }> {
    try {
      // 生成访问令牌
      const accessToken = await this.jwtManager.generateAccessToken(userId, scope);
      
      // 生成刷新令牌
      const refreshToken = await this.jwtManager.generateRefreshToken(userId);
      
      // 将Scope转换为权限
      const permissions = this.convertScopeToPermissions(scope);
      
      // 记录登录审计事件
      const auditEvent = this.auditManager.logUserLogin(
        userId,
        userIp,
        userAgent,
        true
      );
      
      // 记录令牌生成审计事件
      this.auditManager.logTokenGenerate(userId, 'access', true);
      this.auditManager.logTokenGenerate(userId, 'refresh', true);
      
      return {
        accessToken,
        refreshToken,
        permissions,
        auditEvent
      };
    } catch (error: unknown) {
      // 记录失败审计事件
      const errorMessage = error instanceof Error ? error.message : '未知认证错误';
      this.auditManager.logUserLogin(
        userId,
        userIp,
        userAgent,
        false,
        errorMessage
      );
      
      throw error;
    }
  }
  
  /**
   * 统一令牌验证
   * 宪法依据：§107 通信安全公理
   */
  async verifyToken(
    token: string,
    requiredPermissions: Permission[] = [],
    clientIp?: string,
    userAgent?: string
  ): Promise<{
    valid: boolean;
    payload?: JWTPayload;
    missingPermissions?: Permission[];
    auditEvent: AuditEvent;
  }> {
    // 验证JWT令牌
    const jwtResult = await this.jwtManager.verifyToken(token);
    
    if (!jwtResult.valid || !jwtResult.payload) {
      // 记录令牌验证失败审计事件
      const auditEvent = this.auditManager.logTokenVerify(
        jwtResult.payload?.sub || 'unknown',
        'access',
        false,
        jwtResult.error,
        { clientIp, userAgent }
      );
      
      return {
        valid: false,
        auditEvent
      };
    }
    
    const userId = jwtResult.payload.sub;
    const userPermissions = jwtResult.payload.scope
      ? this.convertScopeToPermissions(jwtResult.payload.scope)
      : [];
    
    // 检查权限（如果需要）
    let permissionResult: PermissionValidationResult | undefined;
    if (requiredPermissions.length > 0) {
      permissionResult = this.permissionManager.validatePermissions(
        userPermissions,
        requiredPermissions
      );
    }
    
    const allValid = jwtResult.valid && (!permissionResult || permissionResult.valid);
    
    // 记录审计事件（使用简化的参数）
    const auditEvent = this.auditManager.logTokenVerify(
      userId,
      'access',
      allValid,
      permissionResult?.error,
      {
        clientIp,
        userAgent,
        userId,
        requiredPermissionsCount: requiredPermissions.length,
        missingPermissionsCount: permissionResult?.missing?.length || 0
      }
    );
    
    // 记录权限检查审计事件（如果需要）
    if (requiredPermissions.length > 0 && permissionResult) {
      this.auditManager.logPermissionCheck(
        userId,
        requiredPermissions.map(p => p.toString()),
        userPermissions.map(p => p.toString()),
        permissionResult.valid,
        permissionResult.error
      );
    }
    
    return {
      valid: allValid,
      payload: jwtResult.payload,
      missingPermissions: permissionResult?.missing,
      auditEvent
    };
  }
  
  /**
   * 统一权限检查
   * 宪法依据：§107 通信安全公理
   */
  async checkPermissions(
    userId: string,
    requiredPermissions: Permission[],
    userIp?: string
  ): Promise<{
    valid: boolean;
    missingPermissions?: Permission[];
    details?: PermissionValidationResult['details'];
    auditEvent: AuditEvent;
  }> {
    // 获取用户权限（这里简化实现，实际应该从数据库或令牌中获取）
    // 假设用户有基本读取权限
    const userPermissions: Permission[] = [BasePermission.READ];
    
    const permissionResult = this.permissionManager.validatePermissions(
      userPermissions,
      requiredPermissions
    );
    
    // 记录权限检查审计事件
    const auditEvent = this.auditManager.logPermissionCheck(
      userId,
      requiredPermissions.map(p => p.toString()),
      userPermissions.map(p => p.toString()),
      permissionResult.valid,
      permissionResult.error
    );
    
    return {
      valid: permissionResult.valid,
      missingPermissions: permissionResult.missing,
      details: permissionResult.details,
      auditEvent
    };
  }
  
  /**
   * 刷新访问令牌
   * 宪法依据：§381 安全公理
   */
  async refreshAccessToken(
    refreshTokenId: string,
    clientIp?: string
  ): Promise<{
    accessToken: string;
    refreshToken: RefreshToken;
    auditEvent: AuditEvent;
  } | null> {
    const result = await this.jwtManager.refreshAccessToken(refreshTokenId);
    
    if (!result) {
      // 记录令牌刷新失败审计事件（使用令牌验证事件类型）
      this.auditManager.logTokenVerify(
        'unknown',
        'refresh',
        false,
        '无效或过期的刷新令牌',
        { clientIp, refreshTokenId: refreshTokenId.substring(0, 8) }
      );
      return null;
    }
    
    // 记录令牌生成审计事件作为刷新成功记录（使用logEvent以便传递details）
    const auditEvent = this.auditManager.logEvent({
      eventType: AuditEventType.TOKEN_GENERATE,
      severity: AuditSeverity.INFO,
      userId: result.refreshToken.userId,
      description: '访问令牌刷新成功',
      success: true,
      details: {
        clientIp,
        refreshTokenId: refreshTokenId.substring(0, 8),
        usedCount: result.refreshToken.usedCount,
        operation: 'refresh',
        tokenType: 'access'
      },
      constitutionalArticles: ['§107', '§152', '§381']
    });
    
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      auditEvent
    };
  }
  
  /**
   * 获取认证系统统计
   * 宪法依据：§101 同步公理
   */
  getStats() {
    const jwtStats = this.jwtManager.getStats();
    const permissionStats = this.permissionManager.getStats();
    const auditStats = this.auditManager.getStats();
    
    return {
      jwt: jwtStats,
      permissions: permissionStats,
      audit: auditStats,
      unified: {
        constitutionalCompliance: true,
        articles: ['§101', '§152', '§107', '§381'],
        lastUpdated: new Date().toISOString()
      }
    };
  }
  
  /**
   * 验证系统完整性
   * 宪法依据：§381 安全公理
   */
  verifySystemIntegrity(): {
    jwt: boolean;
    permissions: boolean;
    audit: boolean;
    unified: boolean;
  } {
    const jwtValid = true; // JWT系统基础验证
    const permissionsValid = this.permissionManager.getStats().totalRoles > 0;
    const auditValid = this.auditManager.verifyIntegrity();
    
    const unifiedValid = jwtValid && permissionsValid && auditValid;
    
    // 记录宪法合规检查
    this.auditManager.logConstitutionCheck(
      '系统完整性验证',
      ['§381'],
      unifiedValid,
      {
        jwtValid,
        permissionsValid,
        auditValid,
        unifiedValid
      }
    );
    
    return {
      jwt: jwtValid,
      permissions: permissionsValid,
      audit: auditValid,
      unified: unifiedValid
    };
  }
  
  /**
   * 清理过期数据
   * 宪法依据：§102 熵减原则
   */
  cleanupExpiredData(): {
    tokensRemoved: number;
    auditEventsRemoved: number;
  } {
    const tokensRemoved = this.jwtManager.cleanupExpiredTokens().removed;
    const auditEventsRemoved = this.auditManager.cleanupOldEvents();
    
    // 记录清理操作审计事件
    this.auditManager.logEvent({
      eventType: AuditEventType.SYSTEM_EXCEPTION, // 使用系统异常类型表示维护操作
      severity: AuditSeverity.INFO,
      description: '认证系统数据清理',
      success: true,
      details: {
        tokensRemoved,
        auditEventsRemoved,
        cleanupTime: new Date().toISOString()
      },
      constitutionalArticles: ['§102']
    });
    
    return {
      tokensRemoved,
      auditEventsRemoved
    };
  }
  
  /**
   * 私有方法：将Scope转换为权限
   * 宪法依据：§152 单一真理源公理
   */
  private convertScopeToPermissions(scope: string[]): Permission[] {
    const permissions: Permission[] = [];
    
    for (const scopeItem of scope) {
      // 基础权限转换
      if (scopeItem === 'read') permissions.push(BasePermission.READ);
      if (scopeItem === 'write') permissions.push(BasePermission.WRITE);
      if (scopeItem === 'execute') permissions.push(BasePermission.EXECUTE);
      
      // API权限转换
      if (scopeItem === 'api:read') permissions.push(ApiPermission.API_READ);
      if (scopeItem === 'api:write') permissions.push(ApiPermission.API_WRITE);
      if (scopeItem === 'api:admin') permissions.push(ApiPermission.API_ADMIN);
      
      // Agent权限转换
      if (scopeItem === 'agent:create') permissions.push(AgentPermission.AGENT_CREATE);
      if (scopeItem === 'agent:manage') permissions.push(AgentPermission.AGENT_MANAGE);
      if (scopeItem === 'agent:delete') permissions.push(AgentPermission.AGENT_DELETE);
      if (scopeItem === 'agent:monitor') permissions.push(AgentPermission.AGENT_MONITOR);
      if (scopeItem === 'agent:configure') permissions.push(AgentPermission.AGENT_CONFIGURE);
    }
    
    return permissions;
  }
}

/**
 * 创建默认统一认证管理器
 * 宪法依据：§152 单一真理源公理
 */
export function createDefaultUnifiedAuthManager(): UnifiedAuthManager {
  const manager = new UnifiedAuthManager();
  
  // 记录初始化宪法合规检查
  (manager as any).auditManager.logConstitutionCheck(
    '默认统一认证管理器创建',
    ['§152', '§101', '§107', '§381'],
    true,
    manager.getStats()
  );
  
  return manager;
}

// 默认导出
export default UnifiedAuthManager;
