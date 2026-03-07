/**
 * Express 类型扩展
 * 
 * 扩展 Request 类型以包含认证用户信息和依赖注入容器
 */

import { Container } from 'inversify';

declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: string;
        username?: string;
        email?: string;
        role?: string;
        scope?: string[];
        iat?: number;
        exp?: number;
      };
      /** 依赖注入容器 (InversifyJS) */
      container?: Container;
    }
  }
}

export {};
