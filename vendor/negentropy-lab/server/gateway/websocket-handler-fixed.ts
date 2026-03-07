/**
 * WebSocket处理器兼容入口
 *
 * 为避免 `websocket-handler.ts` 与 `websocket-handler-fixed.ts` 实现漂移，
 * fixed版本统一复用主实现。
 *
 * @constitution
 * §101 同步公理：兼容入口与主实现保持原子同步
 * §102 熵减原则：消除双实现分叉，降低维护熵
 * §321-§324 实时通信公理：统一WebSocket处理语义
 */

export * from './websocket-handler';
import GatewayWebSocketHandler from './websocket-handler';

export default GatewayWebSocketHandler;
