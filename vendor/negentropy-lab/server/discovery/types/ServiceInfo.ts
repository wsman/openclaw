/**
 * 📡 服务信息类型定义 - Service Info
 *
 * 宪法依据:
 * - §101 同步公理 - 类型定义与使用代码必须同步
 * - §102 熵减原则 - 标准化服务信息结构，降低熵值
 * - §151 持久化原则 - 服务信息必须可持久化
 * - §306 零停机协议 - 支持实时健康状态追踪
 *
 * 功能:
 * - 服务元数据定义
 * - 网络地址协议
 * - 健康状态枚举
 * - 负载均衡权重
 *
 * @维护者 科技部
 * @最后更新 2026-02-12
 */

// Phase 1D (Day 2.5): Biological Perception Update
// §101 Synchronization: Updated to match MDNSDiscoverer.ts
export interface ServiceInfo {
  id: string;
  name: string;
  type: string; // e.g., 'mdns', 'http'
  host: string;
  port: number;
  protocol: 'tcp' | 'udp';
  addresses?: string[]; // IPv4/IPv6 addresses
  txt?: Record<string, string>; // TXT records for metadata
  lastSeen?: number;
  status?: 'active' | 'inactive' | 'unknown' | 'offline'; // Updated
  clusterId?: string;
  role?: string;
  version?: string;
  capabilities?: string[];
  httpPort?: number;
  wsPort?: number;
  rpcPort?: number;
  
  // New fields for Operation CPR
  rtt?: number; 
  connectionStatus?: 'good' | 'degraded' | 'lost';
  
  weight?: number; // For load balancing
  priority?: number; // For failover
  ttl?: number;
}

export interface DiscoveryOptions {
  id?: string; // Added for self-identification
  name?: string;
  role?: string; // Added for TXT record
  serviceType?: string;
  domain?: string;
  timeout?: number;
  interface?: string;
  port?: number; // Added for broadcasting
  host?: string;
  wsPort?: number;
  rpcPort?: number;
  clusterId?: string;
  version?: string;
  capabilities?: string[];
  metadata?: Record<string, string>;
}

export interface BroadcastOptions {
  name: string;
  port: number;
  type?: string;
  txt?: Record<string, string>;
  host?: string;
}
