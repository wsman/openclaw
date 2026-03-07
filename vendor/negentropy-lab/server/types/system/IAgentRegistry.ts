/**
 * IAgentRegistryService - Agent注册表服务接口
 * 
 * 宪法依据: §109协作流程公理、§110协作效率公理、§141熵减验证公理
 * 标准依据: AS-104 智能路由算法标准实现
 * 
 * 核心功能:
 * 1. Agent注册与注销管理
 * 2. Agent健康状态监控
 * 3. Agent负载均衡协调
 * 4. Agent信息查询服务
 * 
 * @version 1.0.0
 * @category Agent System
 */

import { AgentInfo } from '../../services/IntelligentRouter';

/**
 * Agent注册信息
 */
export interface AgentRegistration {
    agentId: string;
    name: string;
    version: string;
    startupTime: number;
    capabilities: string[];
    status: 'starting' | 'running' | 'stopping' | 'stopped' | 'failed';
    lastHeartbeat: number;
    metadata?: Record<string, any>;
}

/**
 * Agent心跳数据
 */
export interface AgentHeartbeat {
    agentId: string;
    timestamp: number;
    cpuUsage?: number;
    memoryUsage?: number;
    load: number; // 0-1, 当前负载比例
    healthStatus: 'healthy' | 'degraded' | 'unhealthy';
    pendingTasks?: number;
    errorCount?: number;
    metrics?: Record<string, number>;
}

/**
 * Agent注册表服务接口
 */
export interface IAgentRegistryService {
    /**
     * 注册Agent
     */
    registerAgent(registration: AgentRegistration): Promise<void>;
    
    /**
     * 注销Agent
     */
    unregisterAgent(agentId: string): Promise<void>;
    
    /**
     * 更新Agent心跳
     */
    updateHeartbeat(heartbeat: AgentHeartbeat): Promise<void>;
    
    /**
     * 获取Agent信息
     */
    getAgentInfo(agentId: string): Promise<AgentInfo | undefined>;
    
    /**
     * 获取所有Agent信息
     */
    getAllAgents(): Promise<AgentInfo[]>;
    
    /**
     * 获取按负载排序的Agent列表
     */
    getAgentsByLoad(maxLoad?: number): Promise<AgentInfo[]>;
    
    /**
     * 根据专业领域获取Agent
     */
    getAgentsByExpertise(expertise: string[]): Promise<AgentInfo[]>;
    
    /**
     * 更新Agent状态
     */
    updateAgentStatus(agentId: string, status: Partial<AgentInfo>): Promise<void>;
    
    /**
     * 检查Agent健康状态
     */
    checkAgentHealth(agentId: string): Promise<'healthy' | 'degraded' | 'unhealthy'>;
    
    /**
     * 获取系统负载统计
     */
    getSystemLoadStatistics(): Promise<{
        totalAgents: number;
        healthyAgents: number;
        averageLoad: number;
        overloadedAgents: number;
        offlineAgents: number;
    }>;
    
    /**
     * 清理过期Agent
     */
    cleanupExpiredAgents(timeoutMs?: number): Promise<number>;
    
    /**
     * 重置注册表
     */
    reset(): Promise<void>;
}

/**
 * Agent注册表配置
 */
export interface AgentRegistryConfig {
    heartbeatTimeoutMs: number;
    cleanupIntervalMs: number;
    maxLoadThreshold: number;
    enableAutoScaling: boolean;
    minHealthyAgents: number;
    maxAgentsPerExpertise: number;
}

/**
 * Agent选择策略
 */
export type AgentSelectionStrategy = 
    | 'load-balanced'     // 负载均衡
    | 'expertise-first'   // 专业领域优先
    | 'health-first'      // 健康状态优先
    | 'round-robin'       // 轮询
    | 'random'            // 随机选择

/**
 * Agent查询选项
 */
export interface AgentQueryOptions {
    strategy?: AgentSelectionStrategy;
    requiredExpertise?: string[];
    maxLoad?: number;
    minHealthStatus?: 'healthy' | 'degraded';
    excludeIds?: string[];
    limit?: number;
}

/**
 * Agent容量信息
 */
export interface AgentCapacity {
    agentId: string;
    currentLoad: number;
    capacity: number;
    availableCapacity: number;
    loadPercentage: number;
    healthStatus: 'healthy' | 'degraded' | 'unhealthy';
    lastHeartbeatAge: number;
}

/**
 * Agent注册表统计信息
 */
export interface AgentRegistryStats {
    totalAgents: number;
    registeredAgents: number;
    healthyAgents: number;
    degradedAgents: number;
    unhealthyAgents: number;
    averageLoad: number;
    maxLoad: number;
    minLoad: number;
    totalCapacity: number;
    usedCapacity: number;
    availableCapacity: number;
    byExpertise: Record<string, number>;
    byStatus: Record<string, number>;
    timestamp: number;
}