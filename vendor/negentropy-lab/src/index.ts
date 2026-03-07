/**
 * 🚨 DEPRECATED: 此文件已废弃，仅作为兼容壳
 * 
 * 新入口请使用: server/index.ts
 * 
 * 迁移说明：
 * - 主入口已迁移至 server/index.ts (Colyseus 服务器)
 * - 此文件仅保留向后兼容，未来版本将移除
 * - 所有新功能请从 server/ 目录开发
 * 
 * 宪法依据：§102 熵减原则 - 统一入口降低系统熵值
 * 
 * @deprecated 使用 server/index.ts 替代
 * @see server/index.ts
 */

// 发出废弃警告
if (process.env.NODE_ENV !== 'production') {
  console.warn('⚠️  DEPRECATED: src/index.ts 已废弃，请使用 server/index.ts 作为入口');
}

// 重新导出服务器入口
export * from '../server/index.js';
export { app, gameServer, server } from '../server/index.js';
