/**
 * 🚀 认证系统核心模块
 * 
 * @constitution
 * §101 同步公理：代码变更必须触发文档更新
 * §102 熵减原则：所有变更必须降低或维持系统熵值
 * §107 通信安全公理：私聊消息必须加密，公开消息需身份验证
 * §152 单一真理源公理：知识库文件是可执行规范的唯一真理源
 * §306 零停机协议：在生产级开发任务中确保服务连续性
 * §504 监控系统公理：系统必须实时监控宪法合规状态和性能指标
 * §505 熵值计算公理：系统必须实时计算和监控认知熵值
 * §506 成本透视公理：所有LLM调用必须实时追踪成本和性能
 * 
 * @filename auth.ts
 * @version 1.0.0
 * @category auth
 * @last_updated 2026-02-11
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

// JWT 密钥，与 auth.ts 保持一致
const JWT_SECRET = process.env.JWT_SECRET || 'entropy-lab-secret-key-change-in-production';

// JWT 解码后的用户信息接口
export interface AuthUser {
  sub: string;
  username: string;
  role: 'admin' | 'operator' | 'guest';
  permissions: string[];
  allowed_knowledge_bases?: string[];
}

// 扩展 Express 请求类型以包含用户信息
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * 身份验证中间件
 * 验证 JWT 令牌，并将解码后的用户信息附加到 req.user
 */
export const authenticateJWT = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: '未提供身份验证令牌' });
      return;
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      req.user = decoded;
      next();
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        res.status(401).json({ success: false, error: '令牌已过期' });
      } else if (err instanceof jwt.JsonWebTokenError) {
        res.status(401).json({ success: false, error: '无效令牌' });
      } else {
        res.status(401).json({ success: false, error: '身份验证失败' });
      }
    }
  } catch (error: any) {
    logger.error(`[Auth Middleware] Unexpected error: ${error.message}`);
    res.status(500).json({ success: false, error: '服务器内部错误' });
  }
};

/**
 * 权限检查中间件
 * 检查用户是否拥有指定的权限
 * @param permission 所需的权限字符串，如 "manage_users"、"view_knowledge_base"
 */
export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: '未认证' });
      return;
    }

    // 管理员拥有全部权限
    if (req.user.role === 'admin') {
      next();
      return;
    }

    // 检查权限
    if (req.user.permissions.includes(permission) || req.user.permissions.includes('*')) {
      next();
    } else {
      logger.warn(`[Auth] Permission denied for user ${req.user.username}: missing ${permission}`);
      res.status(403).json({ success: false, error: '权限不足' });
    }
  };
};

/**
 * 角色检查中间件
 * 检查用户是否拥有指定的角色
 * @param requiredRole 所需的角色：'admin' | 'operator' | 'guest'
 */
export const requireRole = (requiredRole: 'admin' | 'operator' | 'guest') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: '未认证' });
      return;
    }

    // 角色层级：admin > operator > guest
    const roleHierarchy: Record<'admin' | 'operator' | 'guest', number> = {
      'admin': 3,
      'operator': 2,
      'guest': 1
    };

    // 确保用户角色是有效的角色
    const userRole = req.user.role;
    if (!(userRole in roleHierarchy)) {
      logger.warn(`[Auth] Invalid role detected for user ${req.user.username}: ${userRole}`);
      res.status(403).json({ success: false, error: '无效的用户角色' });
      return;
    }

    const userRoleLevel = roleHierarchy[userRole];
    const requiredRoleLevel = roleHierarchy[requiredRole];

    if (userRoleLevel >= requiredRoleLevel) {
      next();
    } else {
      logger.warn(`[Auth] Role denied for user ${req.user.username}: ${req.user.role} < ${requiredRole}`);
      res.status(403).json({ success: false, error: '角色权限不足' });
    }
  };
};

/**
 * 组合中间件：先验证JWT，再检查权限
 * @param permission 所需的权限
 */
export const authAndPermission = (permission: string) => {
  return [authenticateJWT, requirePermission(permission)];
};

/**
 * 组合中间件：先验证JWT，再检查角色
 * @param role 所需的角色
 */
export const authAndRole = (role: 'admin' | 'operator' | 'guest') => {
  return [authenticateJWT, requireRole(role)];
};

/**
 * 获取用户信息中间件（可选认证）
 * 如果提供了有效的JWT，将用户信息附加到req.user，但不强制要求认证
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
        req.user = decoded;
      } catch (err) {
        // 令牌无效，但这不是错误，只是不附加用户信息
        logger.debug(`[Optional Auth] Invalid token: ${err}`);
      }
    }
    next();
  } catch (error: any) {
    logger.error(`[Optional Auth] Unexpected error: ${error.message}`);
    next(); // 可选认证不阻止请求
  }
};