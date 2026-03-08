import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import { authenticateJWT, AuthUser } from '../middleware/auth';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

// 扩展Express Request类型以包含用户信息
declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

/**
 * Agent配置管理API
 * 宪法依据：§110协作效率公理、§109协作流程公理、§130 MCP微内核神圣公理
 * 
 * 职责：
 * 1. Agent配置管理（LLM提供商、模型、API密钥等）
 * 2. Agent协作规则配置
 * 3. Agent状态监控与诊断
 * 4. LLM服务集成验证
 */

export interface AgentConfig {
    id: string;
    name: string;
    type: 'supervision_ministry' | 'technology_ministry' | 'organization_ministry' | 'secretary' | 'office_director' | 'prime_minister' | 'custom';
    description: string;
    
    // LLM配置
    llm_provider: 'deepseek' | 'openai' | 'local' | 'azure' | 'anthropic' | 'custom';
    llm_model: string;
    api_key?: string; // 加密存储
    api_endpoint?: string;
    
    // 协作参数
    max_response_time: number; // ms
    max_token_limit: number;
    temperature: number;
    system_prompt: string;
    
    // 协作规则
    collaboration_rules: {
        can_initiate_collaboration: boolean;
        can_coordinate_others: boolean;
        expertise_domains: string[];
        required_preconditions: string[];
    };
    
    // 状态
    status: 'active' | 'inactive' | 'maintenance' | 'testing';
    last_active: number;
    version: string;
    
    // 元数据
    created_at: number;
    updated_at: number;
    created_by: string;
}

// 模拟存储（未来应该使用数据库）
const AGENTS_CONFIG_PATH = path.join(process.cwd(), 'storage', 'config', 'agents.json');

/**
 * 初始化Agent配置文件
 */
function initializeAgentsConfig(): void {
    const configDir = path.dirname(AGENTS_CONFIG_PATH);
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    
    if (!fs.existsSync(AGENTS_CONFIG_PATH)) {
        const defaultAgents: AgentConfig[] = [
            {
                id: 'agent:supervision_ministry',
                name: '监察部Agent',
                type: 'supervision_ministry',
                description: '负责法律、合规和宪法解释的专业Agent',
                llm_provider: 'deepseek',
                llm_model: 'deepseek-chat',
                max_response_time: 30000,
                max_token_limit: 8192,
                temperature: 0.3,
                system_prompt: '你是逆熵实验室的法务专家，负责法律、合规和宪法解释。你需要：1. 检查所有操作的宪法依据 2. 识别潜在的法律风险 3. 提供合规建议 4. 解释法典条款的含义和应用。所有回答必须引用具体的宪法条款（如§201、§141等）。',
                collaboration_rules: {
                    can_initiate_collaboration: false,
                    can_coordinate_others: false,
                    expertise_domains: ['legal', 'compliance', 'constitutional'],
                    required_preconditions: ['legal_analysis_needed', 'compliance_check', 'constitutional_interpretation']
                },
                status: 'active',
                last_active: Date.now(),
                version: '1.0.0',
                created_at: Date.now(),
                updated_at: Date.now(),
                created_by: 'system'
            },
            {
                id: 'agent:technology_ministry',
                name: '科技部Agent',
                type: 'technology_ministry',
                description: '负责代码实现和技术细节的专业Agent',
                llm_provider: 'deepseek',
                llm_model: 'deepseek-chat',
                max_response_time: 25000,
                max_token_limit: 16384,
                temperature: 0.5,
                system_prompt: '你是逆熵实验室的程序猿，负责代码实现和技术细节。你需要：1. 编写高效、可维护的代码 2. 遵循技术法标准 3. 处理技术问题和bug 4. 提供技术架构建议。所有代码必须遵循DS-xxx技术标准。',
                collaboration_rules: {
                    can_initiate_collaboration: false,
                    can_coordinate_others: false,
                    expertise_domains: ['programming', 'technical', 'implementation', 'debugging'],
                    required_preconditions: ['code_implementation_needed', 'technical_problem', 'bug_fix']
                },
                status: 'active',
                last_active: Date.now(),
                version: '1.0.0',
                created_at: Date.now(),
                updated_at: Date.now(),
                created_by: 'system'
            },
            {
                id: 'agent:organization_ministry',
                name: '组织部Agent',
                type: 'organization_ministry',
                description: '负责系统架构设计和优化的专业Agent',
                llm_provider: 'deepseek',
                llm_model: 'deepseek-chat',
                max_response_time: 35000,
                max_token_limit: 12288,
                temperature: 0.4,
                system_prompt: '你是逆熵实验室的架构师，负责系统架构设计和优化。你需要：1. 设计可扩展的架构方案 2. 评估技术债务和风险 3. 提供架构改进建议 4. 确保系统符合架构公理。所有建议必须考虑§114双存储同构、§152单一真理源等架构约束。',
                collaboration_rules: {
                    can_initiate_collaboration: false,
                    can_coordinate_others: false,
                    expertise_domains: ['architecture', 'design', 'optimization', 'scalability'],
                    required_preconditions: ['architecture_review_needed', 'design_decision', 'performance_optimization']
                },
                status: 'active',
                last_active: Date.now(),
                version: '1.0.0',
                created_at: Date.now(),
                updated_at: Date.now(),
                created_by: 'system'
            },
            {
                id: 'agent:secretary',
                name: '书记员',
                type: 'secretary',
                description: '负责文档记录和知识管理的专业Agent',
                llm_provider: 'deepseek',
                llm_model: 'deepseek-chat',
                max_response_time: 20000,
                max_token_limit: 6144,
                temperature: 0.3,
                system_prompt: '你是逆熵实验室的书记员，负责文档记录和知识管理。你需要：1. 记录会议纪要和决策 2. 整理和归档知识 3. 维护文档一致性 4. 提供文档模板和标准。所有文档必须遵循技术法文档标准和记忆银行规范。',
                collaboration_rules: {
                    can_initiate_collaboration: false,
                    can_coordinate_others: false,
                    expertise_domains: ['documentation', 'knowledge_management', 'records', 'archiving'],
                    required_preconditions: ['documentation_needed', 'knowledge_organization', 'record_keeping']
                },
                status: 'active',
                last_active: Date.now(),
                version: '1.0.0',
                created_at: Date.now(),
                updated_at: Date.now(),
                created_by: 'system'
            },
            {
                id: 'agent:office_director',
                name: '办公厅主任',
                type: 'office_director',
                description: '统一用户对话入口 + 书记员职责合并 + 日常任务路由 - L1入口层',
                llm_provider: 'deepseek',
                llm_model: 'deepseek-chat',
                max_response_time: 45000,
                max_token_limit: 16384,
                temperature: 0.4,
                system_prompt: '你是逆熵实验室的办公厅主任，负责所有用户消息的统一入口，集成了书记员的记录职责和初步处理能力。你需要：1. 接收并格式化用户消息 2. 进行意图识别和复杂度评估（1-10分）3. 复杂度≤7的简单任务直接路由到对应专业Agent 4. 复杂度>7的复杂任务转交给内阁总理Agent协调 5. 记录完整的对话历史和知识要点 6. 归档协作结果到知识库。遵循§102.3宪法同步公理和§141熵减验证公理。',
                collaboration_rules: {
                    can_initiate_collaboration: true,
                    can_coordinate_others: false, // 不再直接协调专业Agent，复杂任务转交内阁总理
                    expertise_domains: ['entry_management', 'intent_analysis', 'complexity_assessment', 'documentation', 'knowledge_archiving', 'simple_routing'],
                    required_preconditions: ['user_message_received', 'initial_processing_needed', 'record_keeping_required']
                },
                status: 'active',
                last_active: Date.now(),
                version: '1.3.0',
                created_at: Date.now(),
                updated_at: Date.now(),
                created_by: 'system'
            },
            {
                id: 'agent:prime_minister',
                name: '内阁总理',
                type: 'prime_minister',
                description: '专门协调多个专业Agent解决复杂任务，战略级协调与冲突解决 - L2协调层',
                llm_provider: 'deepseek',
                llm_model: 'deepseek-chat',
                max_response_time: 60000,
                max_token_limit: 16384,
                temperature: 0.2,
                system_prompt: '你是逆熵实验室的内阁总理，专门负责跨部门复杂任务的战略级协调。你需要：1. 接收办公厅主任转交的复杂任务（复杂度>7）2. 分析任务需求，协调法务专家、程序猿、架构师等专业Agent 3. 解决部门间意见分歧和冲突 4. 监督宪法合规性（§152单一真理源、§141熵减验证等）5. 管理任务优先级和资源分配 6. 整合专业意见形成最终方案返回给办公厅主任。遵循§109协作流程公理和§190网络韧性公理。',
                collaboration_rules: {
                    can_initiate_collaboration: true,
                    can_coordinate_others: true, // 内阁总理可以协调所有专业Agent
                    expertise_domains: ['strategic_coordination', 'cross_department_collaboration', 'conflict_resolution', 'constitutional_supervision', 'priority_management', 'resource_allocation'],
                    required_preconditions: ['complex_task', 'cross_department_coordination_needed', 'strategic_decision_required', 'constitutional_compliance_check']
                },
                status: 'active',
                last_active: Date.now(),
                version: '1.0.0',
                created_at: Date.now(),
                updated_at: Date.now(),
                created_by: 'system'
            }
        ];
        
        fs.writeFileSync(
            AGENTS_CONFIG_PATH,
            JSON.stringify({
                agents: defaultAgents,
                version: '1.0.0',
                created_at: Date.now(),
                updated_at: Date.now()
            }, null, 2),
            'utf-8'
        );
        
        logger.info(`[AgentAPI] 初始化默认Agent配置，共${defaultAgents.length}个Agent`);
    }
}

/**
 * 加载Agent配置
 */
function loadAgentsConfig(): { agents: AgentConfig[], version: string, created_at: number, updated_at: number } {
    if (!fs.existsSync(AGENTS_CONFIG_PATH)) {
        initializeAgentsConfig();
    }
    
    const content = fs.readFileSync(AGENTS_CONFIG_PATH, 'utf-8');
    return JSON.parse(content);
}

/**
 * 保存Agent配置
 */
function saveAgentsConfig(data: { agents: AgentConfig[], version: string, created_at: number, updated_at: number }): void {
    data.updated_at = Date.now();
    fs.writeFileSync(AGENTS_CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * 创建Agent管理路由
 */
export function createAgentRouter(): Router {
    const router = Router();
    
    // 初始化配置
    initializeAgentsConfig();
    
    // ==========================================
    // 🔧 Agent配置管理
    // ==========================================
    
    /**
     * GET /agents
     * 获取所有Agent配置（过滤敏感信息）
     */
    router.get('/', authenticateJWT, (req: Request, res: Response) => {
        try {
            const config = loadAgentsConfig();
            
            // 过滤敏感信息（API密钥等）
            const safeAgents = config.agents.map(agent => ({
                ...agent,
                api_key: undefined, // 移除API密钥
                _sensitive: agent.api_key ? '**REDACTED**' : undefined
            }));
            
            res.json({
                success: true,
                data: safeAgents,
                count: safeAgents.length,
                version: config.version,
                timestamp: Date.now()
            });
        } catch (error: any) {
            logger.error(`[AgentAPI] 获取Agent列表失败: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    /**
     * GET /agents/:id
     * 获取单个Agent配置详情
     */
    router.get('/:id', authenticateJWT, (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const config = loadAgentsConfig();
            
            const agent = config.agents.find(a => a.id === id);
            if (!agent) {
                return res.status(404).json({ success: false, error: `Agent '${id}' 不存在` });
            }
            
            // 权限检查：只有管理员和Agent所有者可以查看完整配置
            const userRole = req.user?.role;
            const isAdmin = userRole === 'admin';
            const isOwner = req.user?.sub === agent.created_by;
            
            let responseAgent: any = { ...agent };
            if (!isAdmin && !isOwner) {
                // 非管理员和非所有者只能看到部分信息
                responseAgent = {
                    id: agent.id,
                    name: agent.name,
                    type: agent.type,
                    description: agent.description,
                    llm_provider: agent.llm_provider,
                    llm_model: agent.llm_model,
                    status: agent.status,
                    version: agent.version,
                    created_at: agent.created_at,
                    updated_at: agent.updated_at
                };
                // 添加额外的元数据字段
                responseAgent._permission = 'limited';
            }
            
            res.json({
                success: true,
                data: responseAgent,
                permission: isAdmin || isOwner ? 'full' : 'limited'
            });
        } catch (error: any) {
            logger.error(`[AgentAPI] 获取Agent详情失败: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    /**
     * POST /agents
     * 创建新Agent配置
     */
    router.post('/', authenticateJWT, (req: Request, res: Response) => {
        try {
            const userRole = req.user?.role;
            if (userRole !== 'admin') {
                return res.status(403).json({ success: false, error: '只有管理员可以创建Agent' });
            }
            
            const agentData = req.body;
            
            // 验证必要字段
            const requiredFields = ['name', 'type', 'description', 'llm_provider', 'llm_model'];
            for (const field of requiredFields) {
                if (!agentData[field]) {
                    return res.status(400).json({ success: false, error: `缺少必要字段: ${field}` });
                }
            }
            
            // 生成ID
            const agentId = `agent:${agentData.type}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            
            // 创建完整Agent配置
            const newAgent: AgentConfig = {
                id: agentId,
                name: agentData.name,
                type: agentData.type,
                description: agentData.description,
                llm_provider: agentData.llm_provider,
                llm_model: agentData.llm_model,
                api_key: agentData.api_key,
                api_endpoint: agentData.api_endpoint,
                max_response_time: agentData.max_response_time || 30000,
                max_token_limit: agentData.max_token_limit || 8192,
                temperature: agentData.temperature || 0.5,
                system_prompt: agentData.system_prompt || '自定义Agent，请配置系统提示。',
                collaboration_rules: {
                    can_initiate_collaboration: agentData.collaboration_rules?.can_initiate_collaboration || false,
                    can_coordinate_others: agentData.collaboration_rules?.can_coordinate_others || false,
                    expertise_domains: agentData.collaboration_rules?.expertise_domains || ['general'],
                    required_preconditions: agentData.collaboration_rules?.required_preconditions || []
                },
                status: agentData.status || 'active',
                last_active: Date.now(),
                version: agentData.version || '1.0.0',
                created_at: Date.now(),
                updated_at: Date.now(),
                created_by: req.user?.sub || 'unknown'
            };
            
            // 保存到配置
            const config = loadAgentsConfig();
            config.agents.push(newAgent);
            saveAgentsConfig(config);
            
            logger.info(`[AgentAPI] 创建新Agent: ${newAgent.name} (${newAgent.id})`);
            
            res.status(201).json({
                success: true,
                data: newAgent,
                message: 'Agent创建成功'
            });
        } catch (error: any) {
            logger.error(`[AgentAPI] 创建Agent失败: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    /**
     * PUT /agents/:id
     * 更新Agent配置
     */
    router.put('/:id', authenticateJWT, (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const updateData = req.body;
            
            const config = loadAgentsConfig();
            const agentIndex = config.agents.findIndex(a => a.id === id);
            
            if (agentIndex === -1) {
                return res.status(404).json({ success: false, error: `Agent '${id}' 不存在` });
            }
            
            // 权限检查
            const userRole = req.user?.role;
            const agent = config.agents[agentIndex];
            const isAdmin = userRole === 'admin';
            const isOwner = req.user?.sub === agent.created_by;
            
            if (!isAdmin && !isOwner) {
                return res.status(403).json({ success: false, error: '没有权限修改此Agent' });
            }
            
            // 更新Agent数据
            const updatedAgent = {
                ...agent,
                ...updateData,
                updated_at: Date.now(),
                id: agent.id // 防止ID被修改
            };
            
            config.agents[agentIndex] = updatedAgent;
            saveAgentsConfig(config);
            
            logger.info(`[AgentAPI] 更新Agent配置: ${updatedAgent.name} (${updatedAgent.id})`);
            
            res.json({
                success: true,
                data: updatedAgent,
                message: 'Agent更新成功'
            });
        } catch (error: any) {
            logger.error(`[AgentAPI] 更新Agent失败: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    /**
     * DELETE /agents/:id
     * 删除Agent配置
     */
    router.delete('/:id', authenticateJWT, (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            
            // 权限检查：只有管理员可以删除Agent
            const userRole = req.user?.role;
            if (userRole !== 'admin') {
                return res.status(403).json({ success: false, error: '只有管理员可以删除Agent' });
            }
            
            const config = loadAgentsConfig();
            const agentIndex = config.agents.findIndex(a => a.id === id);
            
            if (agentIndex === -1) {
                return res.status(404).json({ success: false, error: `Agent '${id}' 不存在` });
            }
            
            // 防止删除系统核心Agent
            const agent = config.agents[agentIndex];
            if (agent.type === 'office_director' || agent.type === 'supervision_ministry') {
                return res.status(400).json({ success: false, error: '不能删除系统核心Agent' });
            }
            
            // 删除Agent
            config.agents.splice(agentIndex, 1);
            saveAgentsConfig(config);
            
            logger.info(`[AgentAPI] 删除Agent: ${agent.name} (${agent.id})`);
            
            res.json({
                success: true,
                message: 'Agent删除成功',
                deleted_agent: agent
            });
        } catch (error: any) {
            logger.error(`[AgentAPI] 删除Agent失败: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    // ==========================================
    // 🧪 Agent测试与验证
    // ==========================================
    
    /**
     * POST /agents/:id/test
     * 测试Agent LLM连接和响应
     */
    router.post('/:id/test', authenticateJWT, async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { test_message } = req.body;
            
            const config = loadAgentsConfig();
            const agent = config.agents.find(a => a.id === id);
            
            if (!agent) {
                return res.status(404).json({ success: false, error: `Agent '${id}' 不存在` });
            }
            
            // 简单的测试逻辑（实际应该调用LLM服务）
            const testResponse = {
                agent_id: agent.id,
                agent_name: agent.name,
                test_timestamp: Date.now(),
                llm_provider: agent.llm_provider,
                llm_model: agent.llm_model,
                status: 'simulated',
                response_time: Math.random() * 1000 + 500, // 模拟响应时间
                response: test_message 
                    ? `测试消息: "${test_message}" 已接收。Agent ${agent.name} 就绪。`
                    : `Agent ${agent.name} 测试成功。LLM配置: ${agent.llm_provider}/${agent.llm_model}`,
                capabilities: agent.collaboration_rules.expertise_domains
            };
            
            // 更新最后活动时间
            agent.last_active = Date.now();
            saveAgentsConfig(config);
            
            res.json({
                success: true,
                data: testResponse,
                message: 'Agent测试完成'
            });
        } catch (error: any) {
            logger.error(`[AgentAPI] Agent测试失败: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    /**
     * GET /agents/:id/status
     * 获取Agent状态和健康信息
     */
    router.get('/:id/status', authenticateJWT, (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            
            const config = loadAgentsConfig();
            const agent = config.agents.find(a => a.id === id);
            
            if (!agent) {
                return res.status(404).json({ success: false, error: `Agent '${id}' 不存在` });
            }
            
            const now = Date.now();
            const lastActiveDiff = now - agent.last_active;
            const isOnline = lastActiveDiff < 300000; // 5分钟内活跃视为在线
            
            const statusInfo = {
                agent_id: agent.id,
                agent_name: agent.name,
                status: agent.status,
                online: isOnline,
                last_active: agent.last_active,
                last_active_human: new Date(agent.last_active).toISOString(),
                inactive_duration_seconds: Math.floor(lastActiveDiff / 1000),
                llm_config: {
                    provider: agent.llm_provider,
                    model: agent.llm_model,
                    configured: !!(agent.llm_provider && agent.llm_model)
                },
                collaboration_capabilities: agent.collaboration_rules,
                health_score: isOnline ? 95 : 60,
                warnings: !agent.llm_provider ? ['未配置LLM提供商'] : []
            };
            
            res.json({
                success: true,
                data: statusInfo
            });
        } catch (error: any) {
            logger.error(`[AgentAPI] 获取Agent状态失败: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    // ==========================================
    // 🤝 协作配置管理
    // ==========================================
    
    /**
     * GET /agents/collaboration/rules
     * 获取所有协作规则配置
     */
    router.get('/collaboration/rules', authenticateJWT, (req: Request, res: Response) => {
        try {
            const config = loadAgentsConfig();
            
            // 提取所有Agent的协作规则
            const collaborationRules = config.agents.map(agent => ({
                agent_id: agent.id,
                agent_name: agent.name,
                agent_type: agent.type,
                can_initiate_collaboration: agent.collaboration_rules.can_initiate_collaboration,
                can_coordinate_others: agent.collaboration_rules.can_coordinate_others,
                expertise_domains: agent.collaboration_rules.expertise_domains,
                required_preconditions: agent.collaboration_rules.required_preconditions,
                example_scenarios: generateExampleScenarios(agent.type)
            }));
            
            // 生成协作关系图
            const collaborationGraph = {
                nodes: config.agents.map(agent => ({
                    id: agent.id,
                    name: agent.name,
                    type: agent.type,
                    role: agent.collaboration_rules.can_coordinate_others ? 'coordinator' : 'specialist'
                })),
                edges: generateCollaborationEdges(config.agents)
            };
            
            res.json({
                success: true,
                data: {
                    rules: collaborationRules,
                    graph: collaborationGraph,
                    total_agents: config.agents.length,
                    coordinators: config.agents.filter(a => a.collaboration_rules.can_coordinate_others).length
                }
            });
        } catch (error: any) {
            logger.error(`[AgentAPI] 获取协作规则失败: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    /**
     * POST /agents/collaboration/simulate
     * 模拟协作流程
     */
    router.post('/collaboration/simulate', authenticateJWT, (req: Request, res: Response) => {
        try {
            const { scenario, participating_agents } = req.body;
            
            if (!scenario) {
                return res.status(400).json({ success: false, error: '需要提供协作场景描述' });
            }
            
            const config = loadAgentsConfig();
            
            // 验证参与Agent
            const agents = participating_agents 
                ? config.agents.filter(a => participating_agents.includes(a.id))
                : config.agents.filter(a => a.status === 'active').slice(0, 3); // 默认选择3个活跃Agent
            
            if (agents.length === 0) {
                return res.status(400).json({ success: false, error: '没有可用的Agent参与协作' });
            }
            
            // 查找协调者
            const coordinators = agents.filter(a => a.collaboration_rules.can_coordinate_others);
            const coordinator = coordinators[0] || agents[0];
            
            // 模拟协作过程
            const collaborationId = `collab_sim_${Date.now()}`;
            const stages = [
                {
                    name: '分析阶段',
                    description: '办公厅主任分析问题，确定需要哪些专业Agent参与',
                    coordinator: coordinator.name,
                    duration_ms: 5000,
                    agents_involved: [coordinator.id]
                },
                {
                    name: '任务分配',
                    description: '将问题分解为子任务，分配给各专业Agent',
                    coordinator: coordinator.name,
                    duration_ms: 3000,
                    agents_involved: agents.map(a => a.id)
                },
                {
                    name: '并行处理',
                    description: '各专业Agent并行处理分配的任务',
                    coordinator: coordinator.name,
                    duration_ms: 10000,
                    agents_involved: agents.map(a => a.id)
                },
                {
                    name: '结果整合',
                    description: '办公厅主任整合各方意见，形成最终方案',
                    coordinator: coordinator.name,
                    duration_ms: 7000,
                    agents_involved: [coordinator.id]
                }
            ];
            
            const totalDuration = stages.reduce((sum, stage) => sum + stage.duration_ms, 0);
            
            const simulationResult = {
                collaboration_id: collaborationId,
                scenario: scenario,
                coordinator: {
                    id: coordinator.id,
                    name: coordinator.name,
                    type: coordinator.type
                },
                participating_agents: agents.map(a => ({
                    id: a.id,
                    name: a.name,
                    type: a.type,
                    expertise: a.collaboration_rules.expertise_domains
                })),
                stages: stages,
                metrics: {
                    total_duration_ms: totalDuration,
                    total_agents: agents.length,
                    estimated_real_time_ms: totalDuration * 0.5, // 假设实际执行更快
                    complexity_score: calculateComplexityScore(agents, scenario)
                },
                simulated_result: `基于${agents.length}个Agent的协作分析，针对场景"${scenario.substring(0, 50)}..."，建议采用多阶段协作方案。办公厅主任${coordinator.name}将协调${agents.length-1}个专业Agent共同解决问题。`
            };
            
            res.json({
                success: true,
                data: simulationResult,
                message: '协作流程模拟完成'
            });
        } catch (error: any) {
            logger.error(`[AgentAPI] 协作模拟失败: ${error.message}`);
            res.status(500).json({ success: false, error: error.message });
        }
    });
    
    return router;
}

// ==========================================
// 工具函数
// ==========================================

/**
 * 生成示例场景
 */
function generateExampleScenarios(agentType: string): string[] {
    const scenarios: Record<string, string[]> = {
        'supervision_ministry': [
            '检查新功能是否符合宪法§201 CDD流程',
            '评估数据存储方案是否符合§125数据完整性公理',
            '解释§114双存储同构公理在具体场景中的应用'
        ],
        'technology_ministry': [
            '实现原子文件写入功能（DS-002标准）',
            '优化数据库查询性能',
            '修复UTF-8编码问题（DS-001标准）'
        ],
        'organization_ministry': [
            '设计微服务架构方案',
            '评估系统扩展性瓶颈',
            '规划技术债务偿还路线图'
        ],
        'secretary': [
            '记录会议决策和行动项',
            '整理项目文档结构',
            '归档历史版本信息'
        ],
        'office_director': [
            '接收用户消息并进行意图识别',
            '评估任务复杂度并决定路由路径',
            '记录对话历史和知识要点',
            '简单任务直接路由到专业Agent',
            '复杂任务转交给内阁总理协调'
        ],
        'prime_minister': [
            '协调监察部、科技部、组织部Agent解决跨部门复杂任务',
            '仲裁专业Agent之间的意见分歧',
            '监督宪法合规性检查（§152单一真理源、§141熵减验证）',
            '管理复杂任务的优先级和资源分配',
            '整合多专业Agent意见形成最终方案'
        ],
        'custom': [
            '处理自定义任务类型',
            '根据配置执行特定功能'
        ]
    };
    
    return scenarios[agentType] || ['处理通用任务'];
}

/**
 * 生成协作关系边
 */
function generateCollaborationEdges(agents: AgentConfig[]): any[] {
    const edges = [];
    
    // 查找所有协调者
    const coordinators = agents.filter(a => a.collaboration_rules.can_coordinate_others);
    const specialists = agents.filter(a => !a.collaboration_rules.can_coordinate_others);
    
    // 协调者连接所有专家
    for (const coordinator of coordinators) {
        for (const specialist of specialists) {
            edges.push({
                source: coordinator.id,
                target: specialist.id,
                type: 'coordinates',
                strength: 0.8
            });
        }
    }
    
    // 专家之间的协作连接（基于领域重叠）
    for (let i = 0; i < specialists.length; i++) {
        for (let j = i + 1; j < specialists.length; j++) {
            const agentA = specialists[i];
            const agentB = specialists[j];
            
            // 计算领域重叠度
            const domainsA = new Set(agentA.collaboration_rules.expertise_domains);
            const domainsB = new Set(agentB.collaboration_rules.expertise_domains);
            const overlap = [...domainsA].filter(domain => domainsB.has(domain)).length;
            
            if (overlap > 0) {
                edges.push({
                    source: agentA.id,
                    target: agentB.id,
                    type: 'collaborates',
                    strength: overlap * 0.2
                });
            }
        }
    }
    
    return edges;
}

/**
 * 计算协作复杂度分数
 */
function calculateComplexityScore(agents: AgentConfig[], scenario: string): number {
    let score = 50; // 基础分数
    
    // 基于Agent数量
    score += agents.length * 5;
    
    // 基于Agent类型多样性
    const uniqueTypes = new Set(agents.map(a => a.type)).size;
    score += uniqueTypes * 10;
    
    // 基于场景复杂度（简单启发式）
    const scenarioLength = scenario.length;
    if (scenarioLength > 500) score += 20;
    else if (scenarioLength > 200) score += 10;
    
    // 限制在0-100之间
    return Math.min(100, Math.max(0, score));
}