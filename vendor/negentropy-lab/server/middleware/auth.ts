/**
 * 🚀 认证中间件 - 兼容层
 * 
 * @constitution
 * §102 熵减原则：消除冗余代码，统一认证接口
 * §152 单一真理源公理：认证逻辑集中在 gateway/auth
 * 
 * 整合说明：
 * - 所有认证逻辑已迁移到 server/gateway/auth/
 * - 此文件提供向后兼容的中间件函数
 * - 新代码请直接从 '../gateway/auth' 导入
 * 
 * @deprecated 请直接从 '../gateway/auth' 导入
 * @see server/gateway/auth/index.ts
 */

import { Request, Response, NextFunction } from 'express';
import { UnifiedAuthManager, createDefaultUnifiedAuthManager, JWTPayload } from '../gateway/auth';

// 发出废弃警告（非生产环境）
if (process.env.NODE_ENV !== 'production') {
  console.warn('⚠️  DEPRECATED: middleware/auth.ts 已废弃，请直接从 gateway/auth 导入');
}

// ==========================================
// 类型定义（向后兼容）
// ==========================================

/**
 * 认证用户信息
 * @deprecated 使用 JWTPayload 替代
 */
export interface AuthUser {
  sub: string;
  username?: string;
  email?: string;
  role?: string;
  scope?: string[];
  iat?: number;
  exp?: number;
}

// ==========================================
// 单例管理器
// ==========================================

let _authManager: UnifiedAuthManager | null = null;

/**
 * 获取认证管理器单例
 */
function getAuthManager(): UnifiedAuthManager {
  if (!_authManager) {
    _authManager = createDefaultUnifiedAuthManager();
  }
  return _authManager;
}

// ==========================================
// 中间件函数（向后兼容）
// ==========================================

/**
 * JWT 认证中间件
 * 
 * 验证请求头中的 JWT 令牌，并将用户信息附加到 req.user
 * 
 * @deprecated 使用 gateway/auth 中的中间件替代
 */
export async function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: '缺少认证令牌',
        code: 'MISSING_TOKEN'
      });
      return;
    }
    
    const token = authHeader.substring(7);
    const authManager = getAuthManager();
    
    const result = await authManager.verifyToken(token, [], req.ip, req.get('user-agent'));
    
    if (!result.valid || !result.payload) {
      res.status(401).json({
        success: false,
        error: '令牌无效或已过期',
        code: 'INVALID_TOKEN'
      });
      return;
    }
    
    // 将用户信息附加到请求对象
    (req as any).user = {
      sub: result.payload.sub,
      scope: result.payload.scope,
      iat: result.payload.iat,
      exp: result.payload.exp
    } as AuthUser;
    
    next();
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: '认证服务错误',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
}

/**
 * 可选认证中间件
 * 
 * 尝试验证令牌，但不强制要求
 * 
 * @deprecated 使用 gateway/auth 中的中间件替代
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // 没有令牌，继续但 req.user 为 undefined
      next();
      return;
    }
    
    // 有令牌，尝试验证
    await authenticateJWT(req, res, next);
  } catch (error: any) {
    // 可选认证失败时继续，不阻止请求
    next();
  }
}

/**
 * 角色检查中间件工厂
 * 
 * @param requiredRole - 需要的角色
 * @deprecated 使用 gateway/auth 中的权限系统替代
 */
export function requireRole(requiredRole: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user as AuthUser | undefined;
    
    if (!user) {
      res.status(401).json({
        success: false,
        error: '未认证',
        code: 'UNAUTHORIZED'
      });
      return;
    }
    
    if (user.role !== requiredRole && user.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: '权限不足',
        code: 'FORBIDDEN'
      });
      return;
    }
    
    next();
  };
}

// ==========================================
// 重新导出 gateway/auth 内容
// ==========================================

export * from '../gateway/auth';

// 导出主要类和函数
export {
  UnifiedAuthManager,
  createDefaultUnifiedAuthManager
} from '../gateway/auth';

// 导出类型（便于类型检查）
export type { JWTPayload } from '../gateway/auth';
