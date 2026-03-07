/**
 * 🚀 模块入口文件
 * 
 * @constitution
 * §101 同步公理：代码变更必须触发文档更新
 * §102 熵减原则：所有变更必须降低或维持系统熵值
 * §107 通信安全公理：私聊消息必须加密，公开消息需身份验证
 * §108 异构模型策略：必须支持多LLM提供商，避免单点依赖
 * §110 协作效率公理：Agent响应时间必须控制在合理范围内
 * §152 单一真理源公理：知识库文件是可执行规范的唯一真理源
 * §306 零停机协议：在生产级开发任务中确保服务连续性
 * 
 * @filename index.ts
 * @version 1.0.0
 * @category gateway
 * @last_updated 2026-02-25
 */
/**
 * WebSocket组件导出
 */

export { MessageCompressor } from './MessageCompressor';
export { ConnectionPool, ConnectionState } from './ConnectionPool';
export type { 
  CompressionConfig, 
  CompressionResult 
} from './MessageCompressor';
export type { 
  ConnectionPoolConfig, 
  ConnectionMetadata, 
  ConnectionPoolStats 
} from './ConnectionPool';
