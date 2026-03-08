/**
 * 🛡️ Negentropy-Lab Gateway 认证模块
 * 
 * 宪法依据：
 * - §107 Agent激活确认公理：技术参数必须经过确认
 * - §102 熵减原则：认证系统必须降低系统熵值
 * - §151 持久化原则：认证信息必须写入文件
 * 
 * 移植来源：OpenClaw Gateway 认证系统
 * 适配目标：Negentropy-Lab 安全框架
 */

import { logger } from '../utils/logger';

/**
 * 认证配置接口
 */
export interface AuthConfig {
  token?: string;
  password?: string;
  allowTailscale?: boolean;
  allowLocal?: boolean;
  scope?: 'admin' | 'read' | 'write';
}

/**
 * 认证结果
 */
export interface AuthResult {
  authenticated: boolean;
  scope?: string;
  user?: string;
  error?: string;
  expiresAt?: Date;
}

/**
 * Gateway 认证管理器
 */
export class GatewayAuthManager {
  private tokens = new Map<string, AuthConfig>();
  private passwords = new Map<string, AuthConfig>();
  
  constructor(initialConfig?: AuthConfig) {
    if (initialConfig?.token) {
      this.addToken(initialConfig.token, initialConfig);
    }
    
    logger.info('[Auth] 认证管理器已初始化');
  }
  
  /**
   * 添加 Token
   */
  addToken(token: string, config: AuthConfig): void {
    this.tokens.set(token, config);
    logger.debug(`[Auth] Token 已添加: ${token.substring(0, 8)}...`);
  }
  
  /**
   * 添加密码
   */
  addPassword(password: string, config: AuthConfig): void {
    this.passwords.set(password, config);
    logger.debug(`[Auth] 密码已添加: ${password.substring(0, 2)}...`);
  }
  
  /**
   * 认证请求
   */
  authenticate(token?: string, password?: string, clientIp?: string): AuthResult {
    // 检查 Token 认证
    if (token && this.tokens.has(token)) {
      const config = this.tokens.get(token)!;
      logger.info(`[Auth] Token 认证成功: ${token.substring(0, 8)}..., 客户端: ${clientIp}`);
      
      return {
        authenticated: true,
        scope: config.scope || 'write',
        user: 'token-user',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时
      };
    }
    
    // 检查密码认证
    if (password && this.passwords.has(password)) {
      const config = this.passwords.get(password)!;
      logger.info(`[Auth] 密码认证成功: ${password.substring(0, 2)}..., 客户端: ${clientIp}`);
      
      return {
        authenticated: true,
        scope: config.scope || 'write',
        user: 'password-user',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时
      };
    }
    
    // 本地直连跳过认证（开发环境）
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[Auth] 开发环境跳过认证: ${clientIp}`);
      
      return {
        authenticated: true,
        scope: 'admin',
        user: 'local-dev',
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8小时
      };
    }
    
    // 认证失败
    logger.warn(`[Auth] 认证失败: token=${token ? 'yes' : 'no'}, password=${password ? 'yes' : 'no'}, 客户端: ${clientIp}`);
    
    return {
      authenticated: false,
      error: '无效的认证凭据',
    };
  }
  
  /**
   * 验证权限范围
   */
  checkScope(requiredScope: string, userScope?: string): boolean {
    const scopeHierarchy = ['read', 'write', 'admin'];
    
    if (!userScope) return false;
    
    const userIndex = scopeHierarchy.indexOf(userScope);
    const requiredIndex = scopeHierarchy.indexOf(requiredScope);
    
    if (userIndex === -1 || requiredIndex === -1) return false;
    
    return userIndex >= requiredIndex;
  }
  
  /**
   * 清理过期的 Token
   */
  cleanupExpiredTokens(): number {
    const now = new Date();
    const count = 0;
    
    // 简化实现，实际应用中需要存储过期时间
    logger.info('[Auth] 执行认证信息清理');
    return count;
  }
  
  /**
   * 获取认证统计
   */
  getStats() {
    return {
      totalTokens: this.tokens.size,
      totalPasswords: this.passwords.size,
      lastCleanup: new Date().toISOString(),
    };
  }
}

/**
 * 创建默认认证管理器
 */
export function createDefaultAuthManager(): GatewayAuthManager {
  const defaultConfig: AuthConfig = {
    token: process.env.GATEWAY_TOKEN || 'negentropy-default-token',
    allowLocal: true,
    scope: 'admin',
  };
  
  return new GatewayAuthManager(defaultConfig);
}

export default GatewayAuthManager;