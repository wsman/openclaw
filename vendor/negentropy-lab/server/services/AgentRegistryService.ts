/**
 * AgentRegistryService - Agent注册表服务实现
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

import { inject, injectable } from 'inversify';
import { logger } from '../utils/logger';
import { TYPES } from '../config/inversify.types';
import { IAgentRegistryService, AgentRegistration, AgentHeartbeat, AgentRegistryConfig, AgentCapacity, AgentRegistryStats } from '../types/system/IAgentRegistry';
import { AgentInfo } from './IntelligentRouter';
import * as crypto from 'crypto';

@injectable()
export class AgentRegistryService implements IAgentRegistryService {
    private agents: Map<string, AgentInfo> = new Map();
    private registrations: Map<string, AgentRegistration> = new Map();
    private heartbeats: Map<string, AgentHeartbeat> = new Map();
    private config: AgentRegistryConfig;
    
    private readonly DEFAULT_CONFIG: AgentRegistryConfig = {
        heartbeatTimeoutMs: 30000, // 30秒
        cleanupIntervalMs: 60000, // 1分钟
        maxLoadThreshold: 0.8, // 80%负载
        enableAutoScaling: false,
        minHealthyAgents: 1,
        maxAgentsPerExpertise: 5
    };

    constructor() {
        this.config = { ...this.DEFAULT_CONFIG };
        this.startCleanupTimer();
        logger.info('[AgentRegistryService] 初始化完成');
    }

    /**
     * 注册Agent
     */
    async registerAgent(registration: AgentRegistration): Promise<void> {
        const existingRegistration = this.registrations.get(registration.agentId);
        
        if (existingRegistration) {
            logger.warn(`[AgentRegistryService] Agent已注册: ${registration.agentId}, 更新注册信息`);
        }

        // 创建AgentInfo
        const agentInfo: AgentInfo = {
            agentId: registration.agentId,
            name: registration.name,
            expertise: registration.capabilities || [],
            capacity: 10, // 默认容量
            currentLoad: 0,
            healthStatus: 'healthy',
            lastHeartbeat: registration.lastHeartbeat || Date.now(),
            version: registration.version
        };

        // 保存注册信息和Agent信息
        this.registrations.set(registration.agentId, registration);
        this.agents.set(registration.agentId, agentInfo);

        logger.info(`[AgentRegistryService] 注册Agent: ${registration.agentId} (${registration.name}) v${registration.version}`);
    }

    /**
     * 注销Agent
     */
    async unregisterAgent(agentId: string): Promise<void> {
        const existed = this.registrations.delete(agentId);
        this.agents.delete(agentId);
        this.heartbeats.delete(agentId);
        
        if (existed) {
            logger.info(`[AgentRegistryService] 注销Agent: ${agentId}`);
        } else {
            logger.warn(`[AgentRegistryService] 尝试注销不存在的Agent: ${agentId}`);
        }
    }

    /**
     * 更新Agent心跳
     */
    async updateHeartbeat(heartbeat: AgentHeartbeat): Promise<void> {
        const agent = this.agents.get(heartbeat.agentId);
        
        if (!agent) {
            logger.warn(`[AgentRegistryService] 尝试为不存在的Agent更新心跳: ${heartbeat.agentId}`);
            return;
        }

        // 更新Agent信息
        agent.currentLoad = heartbeat.load;
        agent.healthStatus = heartbeat.healthStatus;
        agent.lastHeartbeat = heartbeat.timestamp;
        
        // 保存心跳数据
        this.heartbeats.set(heartbeat.agentId, heartbeat);
        
        // 更新Agent缓存
        this.agents.set(heartbeat.agentId, agent);
        
        logger.debug(`[AgentRegistryService] 更新Agent心跳: ${heartbeat.agentId}, 负载: ${heartbeat.load}, 健康状态: ${heartbeat.healthStatus}`);
    }

    /**
     * 获取Agent信息
     */
    async getAgentInfo(agentId: string): Promise<AgentInfo | undefined> {
        return this.agents.get(agentId);
    }

    /**
     * 获取所有Agent信息
     */
    async getAllAgents(): Promise<AgentInfo[]> {
        return Array.from(this.agents.values());
    }

    /**
     * 获取按负载排序的Agent列表
     */
    async getAgentsByLoad(maxLoad?: number): Promise<AgentInfo[]> {
        let agents = Array.from(this.agents.values());
        
        // 按负载排序（升序）
        agents.sort((a, b) => (a.currentLoad / a.capacity) - (b.currentLoad / b.capacity));
        
        // 如果指定了最大负载，过滤
        if (maxLoad !== undefined) {
            agents = agents.filter(agent => (agent.currentLoad / agent.capacity) <= maxLoad);
        }
        
        return agents;
    }

    /**
     * 根据专业领域获取Agent
     */
    async getAgentsByExpertise(expertise: string[]): Promise<AgentInfo[]> {
        if (expertise.length === 0) {
            return this.getAllAgents();
        }
        
        return Array.from(this.agents.values()).filter(agent => {
            // 检查Agent是否具备所有要求的专业领域
            return expertise.every(exp => agent.expertise.includes(exp));
        });
    }

    /**
     * 更新Agent状态
     */
    async updateAgentStatus(agentId: string, status: Partial<AgentInfo>): Promise<void> {
        const agent = this.agents.get(agentId);
        
        if (!agent) {
            logger.warn(`[AgentRegistryService] 尝试更新不存在的Agent状态: ${agentId}`);
            return;
        }
        
        // 合并状态
        Object.assign(agent, status);
        this.agents.set(agentId, agent);
        
        logger.info(`[AgentRegistryService] 更新Agent状态: ${agentId} -> ${JSON.stringify(status)}`);
    }

    /**
     * 检查Agent健康状态
     */
    async checkAgentHealth(agentId: string): Promise<'healthy' | 'degraded' | 'unhealthy'> {
        const agent = this.agents.get(agentId);
        
        if (!agent) {
            return 'unhealthy';
        }
        
        // 检查心跳是否过期
        const heartbeatAge = Date.now() - agent.lastHeartbeat;
        if (heartbeatAge > this.config.heartbeatTimeoutMs) {
            return 'unhealthy';
        }
        
        return agent.healthStatus;
    }

    /**
     * 获取系统负载统计
     */
    async getSystemLoadStatistics(): Promise<{
        totalAgents: number;
        healthyAgents: number;
        averageLoad: number;
        overloadedAgents: number;
        offlineAgents: number;
    }> {
        const agents = Array.from(this.agents.values());
        const totalAgents = agents.length;
        
        let healthyAgents = 0;
        let totalLoad = 0;
        let overloadedAgents = 0;
        let offlineAgents = 0;
        
        for (const agent of agents) {
            const loadPercentage = agent.currentLoad / agent.capacity;
            totalLoad += loadPercentage;
            
            // 检查健康状态
            const healthStatus = await this.checkAgentHealth(agent.agentId);
            if (healthStatus === 'healthy') {
                healthyAgents++;
            }
            
            // 检查是否过载
            if (loadPercentage > this.config.maxLoadThreshold) {
                overloadedAgents++;
            }
            
            // 检查是否离线
            if (healthStatus === 'unhealthy') {
                offlineAgents++;
            }
        }
        
        const averageLoad = totalAgents > 0 ? totalLoad / totalAgents : 0;
        
        return {
            totalAgents,
            healthyAgents,
            averageLoad,
            overloadedAgents,
            offlineAgents
        };
    }

    /**
     * 清理过期Agent
     */
    async cleanupExpiredAgents(timeoutMs?: number): Promise<number> {
        const timeout = timeoutMs || this.config.heartbeatTimeoutMs;
        const now = Date.now();
        let cleanedCount = 0;
        
        const agentsToRemove: string[] = [];
        
        for (const [agentId, agent] of this.agents.entries()) {
            const heartbeatAge = now - agent.lastHeartbeat;
            
            if (heartbeatAge > timeout) {
                agentsToRemove.push(agentId);
            }
        }
        
        // 清理过期Agent
        for (const agentId of agentsToRemove) {
            await this.unregisterAgent(agentId);
            cleanedCount++;
        }
        
        if (cleanedCount > 0) {
            logger.info(`[AgentRegistryService] 清理了 ${cleanedCount} 个过期Agent`);
        }
        
        return cleanedCount;
    }

    /**
     * 重置注册表
     */
    async reset(): Promise<void> {
        this.agents.clear();
        this.registrations.clear();
        this.heartbeats.clear();
        logger.info('[AgentRegistryService] 注册表已重置');
    }

    /**
     * 获取Agent容量信息
     */
    async getAgentCapacities(): Promise<AgentCapacity[]> {
        const capacities: AgentCapacity[] = [];
        const now = Date.now();
        
        for (const agent of this.agents.values()) {
            const loadPercentage = agent.currentLoad / agent.capacity;
            const heartbeatAge = now - agent.lastHeartbeat;
            
            capacities.push({
                agentId: agent.agentId,
                currentLoad: agent.currentLoad,
                capacity: agent.capacity,
                availableCapacity: agent.capacity - agent.currentLoad,
                loadPercentage,
                healthStatus: agent.healthStatus,
                lastHeartbeatAge: heartbeatAge
            });
        }
        
        return capacities;
    }

    /**
     * 获取注册表统计信息
     */
    async getRegistryStats(): Promise<AgentRegistryStats> {
        const agents = Array.from(this.agents.values());
        const totalAgents = agents.length;
        
        let healthyAgents = 0;
        let degradedAgents = 0;
        let unhealthyAgents = 0;
        let totalLoad = 0;
        let maxLoad = 0;
        let minLoad = 1;
        let totalCapacity = 0;
        let usedCapacity = 0;
        
        const byExpertise: Record<string, number> = {};
        const byStatus: Record<string, number> = {
            healthy: 0,
            degraded: 0,
            unhealthy: 0
        };
        
        for (const agent of agents) {
            const loadPercentage = agent.currentLoad / agent.capacity;
            
            // 更新统计
            totalLoad += loadPercentage;
            maxLoad = Math.max(maxLoad, loadPercentage);
            minLoad = Math.min(minLoad, loadPercentage);
            totalCapacity += agent.capacity;
            usedCapacity += agent.currentLoad;
            
            // 按专业领域统计
            for (const expertise of agent.expertise) {
                byExpertise[expertise] = (byExpertise[expertise] || 0) + 1;
            }
            
            // 按状态统计
            const healthStatus = await this.checkAgentHealth(agent.agentId);
            byStatus[healthStatus] = (byStatus[healthStatus] || 0) + 1;
            
            if (healthStatus === 'healthy') {
                healthyAgents++;
            } else if (healthStatus === 'degraded') {
                degradedAgents++;
            } else {
                unhealthyAgents++;
            }
        }
        
        const averageLoad = totalAgents > 0 ? totalLoad / totalAgents : 0;
        const availableCapacity = totalCapacity - usedCapacity;
        
        return {
            totalAgents,
            registeredAgents: this.registrations.size,
            healthyAgents,
            degradedAgents,
            unhealthyAgents,
            averageLoad,
            maxLoad,
            minLoad: totalAgents > 0 ? minLoad : 0,
            totalCapacity,
            usedCapacity,
            availableCapacity,
            byExpertise,
            byStatus,
            timestamp: Date.now()
        };
    }

    /**
     * 配置Agent注册表
     */
    configure(config: Partial<AgentRegistryConfig>): void {
        this.config = { ...this.config, ...config };
        logger.info(`[AgentRegistryService] 配置更新: ${JSON.stringify(config)}`);
    }

    /**
     * 启动清理定时器
     */
    private startCleanupTimer(): void {
        setInterval(async () => {
            try {
                await this.cleanupExpiredAgents();
            } catch (error) {
                logger.error(`[AgentRegistryService] 清理定时器错误: ${error}`);
            }
        }, this.config.cleanupIntervalMs);
        
        logger.info(`[AgentRegistryService] 启动清理定时器，间隔: ${this.config.cleanupIntervalMs}ms`);
    }

    /**
     * 模拟Agent注册（用于测试）
     */
    async simulateAgentRegistration(): Promise<void> {
        const testAgents: AgentRegistration[] = [
            {
                agentId: 'agent:legal_expert',
                name: '法务专家',
                version: '1.0.0',
                startupTime: Date.now(),
                capabilities: ['legal', 'compliance', 'constitutional'],
                status: 'running',
                lastHeartbeat: Date.now()
            },
            {
                agentId: 'agent:programmer',
                name: '程序猿',
                version: '1.0.0',
                startupTime: Date.now(),
                capabilities: ['programming', 'technical', 'implementation'],
                status: 'running',
                lastHeartbeat: Date.now()
            },
            {
                agentId: 'agent:architect',
                name: '架构师',
                version: '1.0.0',
                startupTime: Date.now(),
                capabilities: ['architecture', 'design', 'scalability'],
                status: 'running',
                lastHeartbeat: Date.now()
            },
            {
                agentId: 'agent:secretary',
                name: '书记员',
                version: '1.0.0',
                startupTime: Date.now(),
                capabilities: ['documentation', 'knowledge_management', 'archiving'],
                status: 'running',
                lastHeartbeat: Date.now()
            },
            {
                agentId: 'agent:prime_minister',
                name: '内阁总理',
                version: '1.0.0',
                startupTime: Date.now(),
                capabilities: ['coordination', 'strategic_planning', 'conflict_resolution'],
                status: 'running',
                lastHeartbeat: Date.now()
            },
            {
                agentId: 'agent:office_director',
                name: '办公厅主任',
                version: '1.3.0',
                startupTime: Date.now(),
                capabilities: ['entry_management', 'intent_analysis', 'complexity_assessment'],
                status: 'running',
                lastHeartbeat: Date.now()
            }
        ];

        for (const agent of testAgents) {
            await this.registerAgent(agent);
        }

        logger.info(`[AgentRegistryService] 模拟注册了 ${testAgents.length} 个测试Agent`);
    }
}