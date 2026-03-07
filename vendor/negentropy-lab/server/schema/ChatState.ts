import { Schema, type, ArraySchema, MapSchema } from "@colyseus/schema";

/**
 * 聊天消息 Schema
 * 遵循 §108 消息历史公理和 §301-§304 聊天系统公理
 * 
 * 宪法依据：
 * - §108 消息历史公理：所有聊天记录必须持久化存储，支持CRUD操作
 * - §301 公开消息：存储在房间状态中，全员可见
 * - §302 私聊消息：加密存储，仅参与方可访问
 * - §303 消息编辑：需保留修改历史
 * - §304 消息删除：执行软删除，保留审计记录
 */
export class ChatMessage extends Schema {
    @type("string") id!: string;
    @type("string") content!: string;
    @type("string") senderId!: string; // 格式：user:xxx 或 agent:xxx
    @type("string") recipientId?: string; // 私聊时指定，格式：user:xxx 或 agent:xxx
    @type("string") channel = "public"; // "public" | "private" | "agent"
    @type("number") timestamp!: number;
    @type("string") messageType = "text"; // "text" | "action" | "system" | "agent_action"
    @type("boolean") edited = false;
    @type("boolean") deleted = false;
    @type({ map: "string" }) metadata = new MapSchema<string>();
    
    // 编辑历史（简化为最后编辑信息）
    @type("string") lastEditor?: string;
    @type("number") lastEditTime?: number;
    @type("string") originalContent?: string;
}

/**
 * 协作状态 Schema
 * 用于跟踪办公厅主任协调的多Agent协作流程
 * 
 * 宪法依据：
 * - §109 协作流程公理：多Agent协作需有明确流程和状态跟踪
 * - §110 协作效率公理：协作响应时间需在合理范围内
 */
export class CollaborationState extends Schema {
    @type("string") collaborationId!: string; // 协作流程ID
    @type("string") originalMessageId!: string; // 原始消息ID
    @type("string") coordinatorAgentId = "agent:office_director"; // 协调Agent（办公厅主任）ID
    @type({ array: "string" }) participatingAgents = new ArraySchema<string>(); // 参与Agent的ID列表
    @type("string") collaborationStatus = "analyzing"; // "analyzing" | "scheduling" | "processing" | "integrating" | "completed" | "failed"
    @type("number") progress = 0; // 整体进度 0-100
    @type("string") result = ""; // 最终整合结果
    @type("number") startTime!: number; // 协作开始时间
    @type("number") estimatedCompletionTime!: number; // 预计完成时间
    @type("number") actualCompletionTime = 0; // 实际完成时间
    @type({ map: "string" }) agentTasks = new MapSchema<string>(); // Agent任务分配映射：agentId -> 任务描述
    @type({ map: "string" }) agentStatuses = new MapSchema<string>(); // Agent状态映射：agentId -> 状态
    @type({ map: "number" }) agentProgress = new MapSchema<number>(); // Agent进度映射：agentId -> 进度
    @type({ map: "string" }) agentResults = new MapSchema<string>(); // Agent结果映射：agentId -> 结果
}
/**
 * 用户状态 Schema
 * 遵循 §311-§314 用户管理公理
 * 
 * 宪法依据：
 * - §311 用户身份：通过JWT令牌验证
 * - §312 用户权限：普通用户、管理员、访客三级角色
 * - §313 用户活动记录：存储30天
 * - §314 异常登录行为：触发安全警报
 */
export class UserState extends Schema {
    @type("string") id!: string; // 格式：user:xxx
    @type("string") username!: string;
    @type("string") role = "user"; // "user" | "admin" | "guest"
    @type("boolean") online = true;
    @type("number") lastActive!: number;
    @type("string") currentRoom?: string;
    @type({ map: "string" }) preferences = new MapSchema<string>();
}

/**
 * Agent 状态 Schema
 * 遵循 §106 Agent身份公理和 §110 协作效率公理
 * 
 * 宪法依据：
 * - §106 Agent身份公理：每个Agent必须拥有唯一身份标识和明确职责
 * - §110 协作效率公理：Agent响应时间必须控制在合理范围内（<3秒）
 */
export class AgentState extends Schema {
    @type("string") id!: string; // 格式：agent:office_director, agent:tech_ministry, agent:monitor_ministry, agent:cabinet, user:head_of_state
    @type("string") name!: string; // 显示名称
    @type("string") type!: string; // "director" | "ministry" | "cabinet" | "user"
    @type("boolean") available = true;
    @type("number") responseTime = 0; // 平均响应时间（ms）
    @type("number") tasksCompleted = 0;
    @type("number") lastActive!: number;
    @type({ map: "string" }) capabilities = new MapSchema<string>(); // 能力列表
    
    // === LLM配置字段 ===
    @type("string") llmProvider = "simulated"; // "simulated" | "openai" | "claude" | "deepseek" | "custom"
    @type("string") llmModel = "simulated"; // 模型名称，如"gpt-4", "claude-3", "deepseek-chat"
    @type("boolean") llmEnabled = false; // 是否启用真实LLM
    @type("string") apiKeyHash = ""; // API KEY哈希（安全存储）
    
    // === 协作状态字段 ===
    @type("string") status = "idle"; // "idle" | "thinking" | "speaking" | "analyzing" | "processing" | "collaborating" | "finished"
    @type("string") currentTaskId = ""; // 当前处理的任务ID
    @type("number") taskProgress = 0; // 任务进度 0-100
}

/**
 * 聊天房间状态 Schema
 * 核心聊天状态，简化自 SupervisionState
 * 移除了财务状态、生物特征、复杂审计等监控相关状态
 * 
 * 简化原则：
 * 1. 专注聊天功能，移除复杂监控
 * 2. 支持多Agent协作
 * 3. 消息历史管理
 * 4. 用户和Agent状态跟踪
 */
export class ChatState extends Schema {
    // === 消息管理 ===
    @type([ChatMessage]) messages = new ArraySchema<ChatMessage>(); // 最近100条消息
    @type({ map: "string" }) privateConversations = new MapSchema<string>(); // 私聊历史（简化实现，存储JSON字符串）
    
    // === 用户管理 ===
    @type({ map: UserState }) users = new MapSchema<UserState>(); // 在线用户
    @type("uint32") totalUsers = 0; // 历史总用户数
    
    // === Agent 管理 ===
    @type({ map: AgentState }) agents = new MapSchema<AgentState>(); // 活跃Agent
    @type("uint32") activeAgents = 0; // 活跃Agent数量
    
    // === 房间信息 ===
    @type("string") roomId!: string;
    @type("string") roomName = "Negentropy Chat Room";
    @type("string") description = "多Agent协作知识聊天室";
    @type("number") createdAt!: number;
    @type("number") lastActivity!: number; // 最后活动时间
    
    // === 系统状态 ===
    @type("float32") systemHealth = 1.0; // 系统健康度（0.0-1.0）
    @type("string") systemStatus = "normal"; // "normal" | "warning" | "error"
    @type({ map: "string" }) activeAlerts = new MapSchema<string>(); // 活跃告警
    
    // === 协作指标 ===
    @type("float32") collaborationEfficiency = 0.0; // 协作效率（0.0-1.0）
    @type("uint32") messagesProcessed = 0; // 处理的消息总数
    @type("uint32") agentResponses = 0; // Agent响应总数
    
    // === 熵值与协作追踪 ===
    @type("float32") systemEntropy = 0.0; // 系统熵值，表示有序程度
    @type({ map: CollaborationState }) activeCollaborations = new MapSchema<CollaborationState>(); // 活跃协作状态
    
    // === 知识库集成 ===（Phase 3实现，此处预留）
    @type("string") activeKnowledgeProject = "default";
    @type("uint32") knowledgeReferences = 0; // 知识库引用次数
    
    /**
     * 添加消息到房间
     * 遵循原子操作原则，确保状态一致性
     */
    addMessage(message: ChatMessage): void {
        // 限制消息数量，保留最近100条
        if (this.messages.length >= 100) {
            this.messages.shift();
        }
        this.messages.push(message);
        this.lastActivity = message.timestamp;
        this.messagesProcessed++;
        
        // 更新系统健康度（简化计算）
        this.updateSystemHealth();
    }
    
    /**
     * 获取用户状态
     */
    getUser(userId: string): UserState | undefined {
        return this.users.get(userId);
    }
    
    /**
     * 更新用户状态
     */
    updateUser(user: UserState): void {
        this.users.set(user.id, user);
        this.lastActivity = Date.now();
    }
    
    /**
     * 获取Agent状态
     */
    getAgent(agentId: string): AgentState | undefined {
        return this.agents.get(agentId);
    }
    
    /**
     * 更新Agent状态
     */
    updateAgent(agent: AgentState): void {
        this.agents.set(agent.id, agent);
        this.activeAgents = this.agents.size;
    }
    
    /**
     * 更新系统健康度（简化计算）
     * 基于：在线用户比例、Agent可用性、消息处理速率
     */
    updateSystemHealth(): void {
        const usersArray = Array.from(this.users.values()) as UserState[];
        const onlineUsers = usersArray.filter((u: UserState) => u.online).length;
        const totalUsers = this.users.size || 1; // 避免除零
        const userHealth = onlineUsers / totalUsers;
        
        const agentsArray = Array.from(this.agents.values()) as AgentState[];
        const availableAgents = agentsArray.filter((a: AgentState) => a.available).length;
        const totalAgents = this.agents.size || 1;
        const agentHealth = availableAgents / totalAgents;
        
        // 消息处理健康度（简化：基于时间间隔）
        const timeSinceLastActivity = Date.now() - this.lastActivity;
        const activityHealth = timeSinceLastActivity < 300000 ? 1.0 : 0.5; // 5分钟内活跃为健康
        
        // 加权计算
        this.systemHealth = (userHealth * 0.4) + (agentHealth * 0.4) + (activityHealth * 0.2);
        
        // 更新系统状态
        if (this.systemHealth >= 0.8) {
            this.systemStatus = "normal";
        } else if (this.systemHealth >= 0.5) {
            this.systemStatus = "warning";
        } else {
            this.systemStatus = "error";
        }
    }
    
    /**
     * 初始化默认架构 (Phase 4 升级)
     * 遵循 §106 Agent身份公理，建立以办公厅主任为核心的组织架构
     */
    initializeDefaultAgents(): void {
        const agents = [
            {
                id: "agent:office_director",
                name: "办公厅主任",
                type: "director",
                status: "active",
                capabilities: ["complexity_analysis", "agent_coordination", "task_decomposition", "result_integration"]
            },
            {
                id: "user:head_of_state",
                name: "元首",
                type: "user",
                status: "active",
                capabilities: ["strategic_decision", "final_approval", "sovereignty_control"]
            },
            {
                id: "agent:tech_ministry",
                name: "科技部",
                type: "ministry",
                status: "working",
                capabilities: ["system_development", "architecture_optimization", "technical_innovation"]
            },
            {
                id: "agent:monitor_ministry",
                name: "监督部",
                type: "ministry",
                status: "idle",
                capabilities: ["compliance_monitoring", "entropy_audit", "system_integrity"]
            },
            {
                id: "agent:cabinet",
                name: "内阁",
                type: "cabinet",
                status: "idle",
                capabilities: ["policy_coordination", "inter_departmental_sync", "resource_allocation"]
            }
        ];
        
        agents.forEach(agentConfig => {
            const agent = new AgentState();
            agent.id = agentConfig.id;
            agent.name = agentConfig.name;
            agent.type = agentConfig.type;
            agent.available = true;
            agent.lastActive = Date.now();
            agent.responseTime = 0;
            agent.tasksCompleted = 0;
            
            // 设置LLM配置
            agent.llmProvider = "simulated";
            agent.llmModel = "simulated";
            agent.llmEnabled = false;
            agent.apiKeyHash = "";
            
            // 设置协作状态
            agent.status = agentConfig.status;
            agent.currentTaskId = "";
            agent.taskProgress = 0;
            
            // 设置能力
            agentConfig.capabilities.forEach(capability => {
                agent.capabilities.set(capability, "enabled");
            });
            
            this.agents.set(agent.id, agent);
        });
        
        this.activeAgents = this.agents.size;
        this.updateSystemHealth();
    }
}