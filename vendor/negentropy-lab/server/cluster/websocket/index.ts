/**
 * 🚀 跨节点WebSocket事件扇出模块
 * 
 * 宪法依据：
 * - §107 通信安全公理：集群间通信的安全管理
 * - §321-§324 实时通信公理：WebSocket状态同步
 * 
 * @filename server/cluster/websocket/index.ts
 * @version 1.0.0
 * @category cluster
 * @last_updated 2026-03-09
 */

export {
  WebSocketClusterBroadcaster,
  IWebSocketHandler,
} from './WebSocketClusterBroadcaster';

export {
  ClusterWebSocketEvent,
  ClusterWebSocketRouting,
  ClusterWebSocketRoutingStrategy,
  WebSocketClusterDispatchOptions,
  ClusterConnectionSync,
  ClusterConnectionView,
  WebSocketClusterBroadcasterConfig,
  DedupCacheEntry,
  ConnectionStateEntry,
  BatchedEvent,
} from './types';

export { default } from './WebSocketClusterBroadcaster';
