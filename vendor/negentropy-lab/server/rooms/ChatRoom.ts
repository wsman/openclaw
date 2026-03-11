import { Room, Client } from "colyseus";
import { ChatState, ChatMessage, UserState, AgentState } from "../schema/ChatState";
import { logger } from "../utils/logger";
import { uuid } from "../utils/uuid";
import { activeRooms } from "../runtime/activeRooms";
import * as fs from 'fs';
import * as path from 'path';

/**
 * 👥 聊天主房间 (Chat Room)
 * 核心：多Agent协作聊天系统，简化自 SupervisionRoom
 * 
 * 宪法依据：
 * - §106 Agent身份公理：每个Agent必须拥有唯一身份标识和明确职责
 * - §107通信安全公理：私聊消息必须加密，公开消息需身份验证
 * - §108消息历史公理：所有聊天记录必须持久化存储，支持CRUD操作
 * - §110协作效率公理：Agent响应时间必须控制在合理范围内（<3秒）
 * - §321-§324实时通信公理：WebSocket连接需心跳保持、断线重连机制
 * 
 * 简化原则：
 * 1. 移除复杂的监控模块系统（EntropyLabModule, FinanceModule等）
 * 2. 专注聊天功能，支持公开消息和私聊
 * 3. 实现Agent消息路由系统
 * 4. 保留基本的系统健康度监控
 * 5. 新增办公厅主任协调系统
 */

export class ChatRoom extends Room<ChatState> {
    // Agent消息路由映射（关键词 -> Agent类型） - 保留用于简单路由
    private agentRoutingMap: Map<string, string> = new Map([
        // 科技部关键词
        ['code', 'tech_ministry'],
        ['technical', 'tech_ministry'],
        ['implement', 'tech_ministry'],
        ['architecture', 'tech_ministry'],
        ['system', 'tech_ministry'],
        ['optimization', 'tech_ministry'],
        ['technology', 'tech_ministry'],
        
        // 监督部关键词
        ['compliance', 'monitor_ministry'],
        ['regulation', 'monitor_ministry'],
        ['entropy', 'monitor_ministry'],
        ['audit', 'monitor_ministry'],
        ['law', 'monitor_ministry'],
        ['constitution', 'monitor_ministry'],
        
        // 内阁关键词
        ['policy', 'cabinet'],
        ['coordination', 'cabinet'],
        ['resource', 'cabinet'],
        ['sync', 'cabinet'],
        ['cabinet', 'cabinet'],
        
        // 元首关键词
        ['decision', 'head_of_state'],
        ['approve', 'head_of_state'],
        ['sovereignty', 'head_of_state'],
        ['strategic', 'head_of_state']
    ]);
    
    // === 办公厅主任协调系统 ===
    private activeCollaborations: Map<string, any> = new Map(); // 协作ID -> 协作状态
    private collaborationTimeout = 30000; // 协作超时时间（30秒）
    private collaborationProgressInterval = 1000; // 协作进度更新间隔（1秒）
    
    // 仿真计时器
    private timeElapsed = 0;
    
    // 心跳间隔（30秒）
    private heartbeatInterval = 30000;
    private lastHeartbeat: number = Date.now();

    onCreate(options: any) {
        logger.info(`[ChatRoom] 创建聊天房间实例 ${this.roomId}...`);
        
        // 注册到活跃房间列表
        activeRooms.add(this);
        
        // 1. 初始化聊天状态
        this.setState(new ChatState());
        this.state.roomId = this.roomId;
        this.state.createdAt = Date.now();
        this.state.lastActivity = Date.now();
        
        // 2. 初始化默认Agent（包含办公厅主任）
        this.state.initializeDefaultAgents();
        logger.info(`[ChatRoom] 初始化了 ${this.state.activeAgents} 个默认Agent`);
        
        // 3. 设置仿真循环（10Hz，比SupervisionRoom的20Hz简化）
        this.setSimulationInterval((deltaTime) => this.update(deltaTime), 100);
        
        // 4. 设置消息处理器
        this.setupMessageHandlers();
        
        // 5. 设置心跳检测
        this.setupHeartbeatCheck();
        
        logger.info(`[ChatRoom] 聊天房间创建完成，房间名：${this.state.roomName}`);
    }
    
    /**
     * 设置消息处理器
     * 简化自 SupervisionRoom 的复杂消息路由
     */
    private setupMessageHandlers() {
        this.onMessage("*", (client, type, message) => {
            const typeStr = String(type);
            
            switch (typeStr) {
                case "chat-message":
                    this.handleChatMessage(client, message);
                    break;
                    
                case "private_message":
                    this.handlePrivateMessage(client, message);
                    break;
                    
                case "agent_request":
                    this.handleAgentRequest(client, message);
                    break;
                    
                case "edit_message":
                    this.handleEditMessage(client, message);
                    break;
                    
                case "delete_message":
                    this.handleDeleteMessage(client, message);
                    break;
                    
                case "user_action":
                    this.handleUserAction(client, message);
                    break;
                    
                case "heartbeat":
                    this.handleHeartbeat(client, message);
                    break;
                    
                case "knowledge:read":
                    this.handleKnowledgeRead(client, message);
                    break;
                    
                default:
                    logger.warn(`[ChatRoom] 未处理的消息类型：${typeStr}`);
                    this.sendError(client, "unknown_message_type", `不支持的消息类型：${typeStr}`);
            }
        });
    }
    
    /**
     * 处理聊天消息
     */
    private handleChatMessage(client: Client, message: any) {
        const { content, metadata = {} } = message;
        const user = this.state.getUser(`user:${client.sessionId}`);
        
        if (!user) {
            this.sendError(client, "user_not_found", "用户未找到，请先加入房间");
            return;
        }
        
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            this.sendError(client, "invalid_message", "消息内容不能为空");
            return;
        }
        
        if (content.length > 1000) {
            this.sendError(client, "message_too_long", "消息长度不能超过1000字符");
            return;
        }
        
        // 创建聊天消息
        const chatMessage = new ChatMessage();
        chatMessage.id = `msg_${Date.now()}_${uuid().substring(0, 8)}`;
        chatMessage.content = content.trim();
        chatMessage.senderId = user.id;
        chatMessage.channel = "public";
        chatMessage.timestamp = Date.now();
        chatMessage.messageType = "text";
        
        // 添加元数据
        if (metadata) {
            Object.entries(metadata).forEach(([key, value]) => {
                chatMessage.metadata.set(key, String(value));
            });
        }
        
        // 添加到状态
        this.state.addMessage(chatMessage);
        
        // 广播消息给所有客户端
        this.broadcast("chat-message", {
            message: chatMessage,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
        
        logger.info(`[ChatRoom] ${user.username} 发送了公开消息：${content.substring(0, 50)}...`);
        
        // 触发办公厅主任分析（替代原有的简单关键词匹配）
        this.triggerOfficeDirectorAnalysis(chatMessage);
    }
    
    /**
     * 处理私聊消息
     */
    private handlePrivateMessage(client: Client, message: any) {
        const { content, recipientId, metadata = {} } = message;
        const sender = this.state.getUser(`user:${client.sessionId}`);
        
        if (!sender) {
            this.sendError(client, "user_not_found", "发送者未找到");
            return;
        }
        
        if (!recipientId) {
            this.sendError(client, "missing_recipient", "必须指定收件人");
            return;
        }
        
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            this.sendError(client, "invalid_message", "消息内容不能为空");
            return;
        }
        
        // 检查收件人是否存在（用户或Agent）
        const recipient = this.state.getUser(recipientId) || this.state.getAgent(recipientId);
        if (!recipient) {
            this.sendError(client, "recipient_not_found", `收件人 ${recipientId} 不存在`);
            return;
        }
        
        // 创建私聊消息
        const privateMessage = new ChatMessage();
        privateMessage.id = `priv_${Date.now()}_${uuid().substring(0, 8)}`;
        privateMessage.content = content.trim();
        privateMessage.senderId = sender.id;
        privateMessage.recipientId = recipientId;
        privateMessage.channel = "private";
        privateMessage.timestamp = Date.now();
        privateMessage.messageType = "text";
        
        // 添加元数据
        if (metadata) {
            Object.entries(metadata).forEach(([key, value]) => {
                privateMessage.metadata.set(key, String(value));
            });
        }
        
        // 存储私聊历史（简化实现 - 使用JSON字符串存储）
        const conversationKey = `${sender.id}-${recipientId}`;
        let conversation: ChatMessage[] = [];
        
        // 获取现有对话历史
        const existingHistory = this.state.privateConversations.get(conversationKey);
        if (existingHistory) {
            try {
                conversation = JSON.parse(existingHistory) as ChatMessage[];
            } catch (e) {
                logger.warn(`[ChatRoom] 解析私聊历史失败: ${e}`);
                conversation = [];
            }
        }
        
        // 添加新消息并限制历史长度
        if (conversation.length < 50) {
            conversation.push(privateMessage);
        } else {
            conversation.shift(); // 移除最旧的消息
            conversation.push(privateMessage);
        }
        
        // 保存回状态
        this.state.privateConversations.set(conversationKey, JSON.stringify(conversation));
        
        // 发送给收件人（如果在线）
        if (recipientId.startsWith('user:')) {
            const recipientClient = this.clients.find(c => c.sessionId === recipientId.substring(5));
            if (recipientClient) {
                recipientClient.send("private_message", {
                    message: privateMessage,
                    sender: {
                        id: sender.id,
                        username: sender.username
                    }
                });
            }
        } else if (recipientId.startsWith('agent:')) {
            // Agent处理私聊消息（Phase 2实现）
            this.handleAgentPrivateMessage(privateMessage);
        }
        
        // 确认发送给发送者
        client.send("private_message_sent", {
            messageId: privateMessage.id,
            recipientId,
            timestamp: privateMessage.timestamp
        });
        
        logger.info(`[ChatRoom] ${sender.username} 向 ${recipientId} 发送了私聊消息`);
    }
    
    /**
     * 处理Agent请求
     */
    private handleAgentRequest(client: Client, message: any) {
        const { agentType, query, context = {} } = message;
        const user = this.state.getUser(`user:${client.sessionId}`);
        
        if (!user) {
            this.sendError(client, "user_not_found", "用户未找到");
            return;
        }
        
        if (!agentType || !query) {
            this.sendError(client, "invalid_request", "必须指定Agent类型和查询内容");
            return;
        }
        
        const agentId = `agent:${agentType}`;
        const agent = this.state.getAgent(agentId);
        
        if (!agent) {
            this.sendError(client, "agent_not_found", `Agent ${agentType} 不存在`);
            return;
        }
        
        if (!agent.available) {
            this.sendError(client, "agent_unavailable", `Agent ${agent.name} 当前不可用`);
            return;
        }
        
        logger.info(`[ChatRoom] ${user.username} 请求 ${agent.name} 处理：${query.substring(0, 100)}...`);
        
        // 记录Agent请求开始时间
        const requestStartTime = Date.now();
        
        // 更新Agent状态
        agent.lastActive = Date.now();
        this.state.updateAgent(agent);
        
        // 发送请求确认
        client.send("agent_request_accepted", {
            agentId: agent.id,
            agentName: agent.name,
            requestId: `req_${requestStartTime}_${uuid().substring(0, 6)}`,
            timestamp: requestStartTime
        });
        
        // 模拟Agent处理（Phase 2将集成真正的LLM处理）
        setTimeout(() => {
            const responseTime = Date.now() - requestStartTime;
            const response = this.generateMockAgentResponse(agentType, query, context);
            
            // 更新Agent响应时间统计
            const totalTasks = agent.tasksCompleted + 1;
            agent.responseTime = (agent.responseTime * agent.tasksCompleted + responseTime) / totalTasks;
            agent.tasksCompleted = totalTasks;
            this.state.updateAgent(agent);
            
            // 发送Agent响应
            client.send("agent_response", {
                agentId: agent.id,
                agentName: agent.name,
                response,
                responseTime,
                requestStartTime,
                timestamp: Date.now()
            });
            
            // 广播Agent活动通知
            this.broadcast("agent_activity", {
                agentId: agent.id,
                agentName: agent.name,
                action: "responded",
                user: user.username,
                responseTime,
                timestamp: Date.now()
            });
            
            logger.info(`[ChatRoom] ${agent.name} 在 ${responseTime}ms 内回复了 ${user.username}`);
            
        }, Math.min(3000, 500 + Math.random() * 1000)); // 模拟处理时间 0.5-1.5秒
    }
    
    // ========================================
    // === 办公厅主任协调系统 - 核心方法 ===
    // ========================================
    
    /**
     * 触发办公厅主任分析消息并启动协作流程
     */
    private triggerOfficeDirectorAnalysis(message: ChatMessage): void {
        // 1. 获取办公厅主任Agent
        const officeDirector = this.state.getAgent("agent:office_director");
        if (!officeDirector || !officeDirector.available) {
            logger.warn(`[ChatRoom] 办公厅主任不可用，无法分析消息：${message.id}`);
            return;
        }
        
        // 2. 创建协作ID
        const collaborationId = `collab_${Date.now()}_${uuid().substring(0, 6)}`;
        
        // 3. 更新办公厅主任状态
        officeDirector.status = "thinking"; // "analyzing" -> "thinking"
        officeDirector.currentTaskId = collaborationId;
        officeDirector.taskProgress = 10;
        officeDirector.lastActive = Date.now();
        this.state.updateAgent(officeDirector);
        
        // 4. 创建协作状态
        const collaboration = {
            id: collaborationId,
            originalMessageId: message.id,
            originalContent: message.content,
            coordinatorAgentId: "agent:office_director",
            participatingAgents: [],
            collaborationStatus: "analyzing",
            progress: 10,
            startTime: Date.now(),
            estimatedCompletionTime: Date.now() + 15000, // 15秒预估完成时间
            agentTasks: new Map(),
            agentStatuses: new Map(),
            agentProgress: new Map(),
            agentResults: new Map()
        };
        
        this.activeCollaborations.set(collaborationId, collaboration);
        
        // 5. 广播协作开始通知
        this.broadcast("collaboration_started", {
            collaborationId,
            originalMessageId: message.id,
            originalContent: message.content.substring(0, 100),
            coordinator: "办公厅主任",
            startTime: collaboration.startTime,
            estimatedCompletionTime: collaboration.estimatedCompletionTime,
            timestamp: Date.now()
        });
        
        logger.info(`[ChatRoom] 办公厅主任开始分析消息 ${message.id}，协作ID：${collaborationId}`);
        
        // 6. 启动协作流程
        setTimeout(() => {
            this.executeCollaborationFlow(collaborationId);
        }, 1000); // 1秒后开始执行协作流程
    }
    
    /**
     * 执行协作流程（模拟版本）
     */
    private async executeCollaborationFlow(collaborationId: string): Promise<void> {
        const collaboration = this.activeCollaborations.get(collaborationId);
        if (!collaboration) {
            logger.warn(`[ChatRoom] 协作不存在：${collaborationId}`);
            return;
        }
        
        const officeDirector = this.state.getAgent("agent:office_director");
        if (!officeDirector) {
            logger.error(`[ChatRoom] 办公厅主任不存在`);
            return;
        }
        
        // 阶段1：消息复杂度分析 (0-30%)
        collaboration.collaborationStatus = "analyzing";
        collaboration.progress = 30;
        officeDirector.taskProgress = 30;
        this.state.updateAgent(officeDirector);
        this.broadcastCollaborationProgress(collaboration);
        
        await this.delay(1000);
        
        // 阶段2：Agent需求识别与调度 (30-60%)
        collaboration.collaborationStatus = "scheduling";
        collaboration.progress = 60;
        officeDirector.taskProgress = 60;
        
        // 分析消息内容，识别需要的Agent
        const messageContent = collaboration.originalContent.toLowerCase();
        const requiredAgents = this.analyzeMessageForRequiredAgents(messageContent);
        collaboration.participatingAgents = requiredAgents;
        
        // 为每个参与Agent分配任务
        requiredAgents.forEach(agentId => {
            const agent = this.state.getAgent(agentId);
            if (agent) {
                agent.status = "thinking";
                agent.currentTaskId = collaborationId;
                agent.taskProgress = 0;
                this.state.updateAgent(agent);
                
                collaboration.agentTasks.set(agentId, `处理消息中的${this.getAgentTaskDescription(agent.type)}`);
                collaboration.agentStatuses.set(agentId, "processing");
                collaboration.agentProgress.set(agentId, 0);
            }
        });
        
        this.state.updateAgent(officeDirector);
        this.broadcastCollaborationProgress(collaboration);
        
        await this.delay(1000);
        
        // 阶段3：并行Agent处理 (60-90%)
        collaboration.collaborationStatus = "processing";
        collaboration.progress = 90;
        officeDirector.taskProgress = 90;
        this.state.updateAgent(officeDirector);
        this.broadcastCollaborationProgress(collaboration);
        
        // 模拟各个Agent并行处理
        const agentProcessingPromises = requiredAgents.map(async (agentId) => {
            const agent = this.state.getAgent(agentId);
            if (!agent) return;
            
            // 模拟处理过程，逐步更新进度
            for (let progress = 10; progress <= 100; progress += 30) {
                await this.delay(500);
                agent.taskProgress = progress;
                collaboration.agentProgress.set(agentId, progress);
                this.state.updateAgent(agent);
                this.broadcastCollaborationProgress(collaboration);
            }
            
            // 生成模拟结果
            const result = this.generateCollaborationAgentResult(agent.type, collaboration.originalContent);
            collaboration.agentResults.set(agentId, result);
            collaboration.agentStatuses.set(agentId, "completed");
            agent.status = "speaking";
            agent.taskProgress = 100;
            this.state.updateAgent(agent);
            
            await this.delay(1000); // 模拟说话时间
            agent.status = "idle";
            this.state.updateAgent(agent);
        });
        
        await Promise.all(agentProcessingPromises);
        
        // 阶段4：结果整合 (90-100%)
        collaboration.collaborationStatus = "integrating";
        collaboration.progress = 95;
        officeDirector.taskProgress = 95;
        this.state.updateAgent(officeDirector);
        this.broadcastCollaborationProgress(collaboration);
        
        await this.delay(1000);
        
        // 生成最终整合结果
        const finalResult = this.integrateCollaborationResults(collaboration);
        collaboration.result = finalResult;
        
        // 阶段5：协作完成
        collaboration.collaborationStatus = "completed";
        collaboration.progress = 100;
        collaboration.actualCompletionTime = Date.now();
        officeDirector.status = "speaking";
        officeDirector.currentTaskId = "";
        officeDirector.taskProgress = 100;
        this.state.updateAgent(officeDirector);
        
        // 广播最终结果
        this.broadcastCollaborationCompletion(collaboration);
        
        await this.delay(2000); // 模拟报告时间
        officeDirector.status = "idle";
        this.state.updateAgent(officeDirector);
        
        logger.info(`[ChatRoom] 协作 ${collaborationId} 完成，参与Agent：${requiredAgents.length}个`);
        
        // 清理协作状态（30秒后）
        setTimeout(() => {
            this.activeCollaborations.delete(collaborationId);
        }, 30000);
    }
    
    /**
     * 分析消息内容，识别需要的部门
     */
    private analyzeMessageForRequiredAgents(messageContent: string): string[] {
        const requiredAgents: string[] = [];
        const content = messageContent.toLowerCase();
        
        // 检查各种关键词，确定需要的部门
        const agentKeywords: Record<string, string[]> = {
            "agent:tech_ministry": ["代码", "技术", "实现", "架构", "设计", "系统", "优化", "code", "technical", "system", "architecture"],
            "agent:monitor_ministry": ["宪法", "法律", "规则", "合规", "熵", "审计", "rule", "law", "constitution", "compliance", "entropy"],
            "agent:cabinet": ["政策", "协调", "资源", "同步", "内阁", "policy", "coordination", "resource", "cabinet"],
            "user:head_of_state": ["决策", "批准", "主权", "战略", "decision", "approve", "sovereignty", "strategic"]
        };
        
        // 检查每个部门的关键词
        Object.entries(agentKeywords).forEach(([agentId, keywords]) => {
            for (const keyword of keywords) {
                if (content.includes(keyword)) {
                    if (!requiredAgents.includes(agentId)) {
                        requiredAgents.push(agentId);
                    }
                    break;
                }
            }
        });
        
        // 如果没有明确关键词，但消息包含问号，则加入监督部
        if (requiredAgents.length === 0 && messageContent.includes('?')) {
            requiredAgents.push("agent:monitor_ministry");
        }
        
        // 默认至少包含科技部
        if (requiredAgents.length === 0) {
            requiredAgents.push("agent:tech_ministry");
        }
        
        return requiredAgents;
    }
    
    /**
     * 获取部门任务描述
     */
    private getAgentTaskDescription(agentType: string): string {
        const descriptions: Record<string, string> = {
            "ministry": "部门专项事务",
            "cabinet": "跨部门协调事务",
            "user": "最高决策咨询",
            "director": "全局调度事务"
        };
        
        return descriptions[agentType] || "相关事务";
    }
    
    /**
     * 生成部门协作结果（模拟）
     */
    private generateCollaborationAgentResult(agentType: string, originalContent: string): string {
        const resultTemplates: Record<string, string[]> = {
            "tech_ministry": [
                "🚀 **科技部技术分析**：\n已评估技术可行性，建议采用 §108 异构模型策略进行部署。",
                "🛠️ **架构优化建议**：\n根据 DS-007 标准，系统需要进行同构性验证以提升稳定性。"
            ],
            "monitor_ministry": [
                "⚖️ **监督部合规审查**：\n该提议符合 §101 同步公理。当前系统熵值 $H_{sys}=0.12$，处于健康状态。",
                "🔍 **审计结论**：\n未发现违规操作，建议在执行后同步更新 MEMORY.md。"
            ],
            "cabinet": [
                "🏛️ **内阁协调意见**：\n已协调各部委资源，优先保障当前核心任务的配额分配。",
                "📅 **资源调度方案**：\n建议在下一个配额周期开始前完成非紧急任务的迁移。"
            ],
            "head_of_state": [
                "👑 **元首战略决策**：\n此项提议具有战略价值，准予执行。请办公厅主任全程监督实施。",
                "✨ **最终批示**：\n方案已阅，符合国家利益。立即启动 Phase 4 升级流程。"
            ]
        };
        
        // Map agent IDs to types for template lookup
        let lookupType = agentType;
        if (agentType.includes('tech')) lookupType = 'tech_ministry';
        if (agentType.includes('monitor')) lookupType = 'monitor_ministry';
        if (agentType.includes('cabinet')) lookupType = 'cabinet';
        if (agentType.includes('head_of_state')) lookupType = 'head_of_state';

        const templates = resultTemplates[lookupType] || resultTemplates.tech_ministry;
        const randomIndex = Math.floor(Math.random() * templates.length);
        return templates[randomIndex];
    }
    
    /**
     * 整合协作结果
     */
    private integrateCollaborationResults(collaboration: any): string {
        const agentResults = Array.from(collaboration.agentResults.entries()) as [string, string][];
        
        let integratedResult = `# 🏢 办公厅主任整合报告\n\n`;
        integratedResult += `**协作ID**: ${collaboration.id}\n`;
        integratedResult += `**原始消息**: ${collaboration.originalContent.substring(0, 100)}${collaboration.originalContent.length > 100 ? '...' : ''}\n`;
        integratedResult += `**参与Agent**: ${collaboration.participatingAgents.length}个\n`;
        integratedResult += `**协作耗时**: ${Math.round((Date.now() - collaboration.startTime) / 1000)}秒\n\n`;
        
        integratedResult += `## 📊 协作成果汇总\n\n`;
        
        // 添加各个Agent的结果
        agentResults.forEach(([agentId, result]) => {
            const agent = this.state.getAgent(agentId);
            if (agent) {
                integratedResult += `### ${agent.name}（${agent.type}）\n`;
                integratedResult += `${result}\n\n`;
            }
        });
        
        // 添加综合建议
        integratedResult += `## 🎯 综合建议\n\n`;
        integratedResult += `基于以上分析，建议采取以下综合方案：\n\n`;
        integratedResult += `1. **优先级排序**：${collaboration.participatingAgents.length > 2 ? "多Agent协作问题，需并行处理" : "单一领域问题，可聚焦处理"}\n`;
        integratedResult += `2. **实施路径**：遵循§201 CDD流程，先文档后实现\n`;
        integratedResult += `3. **质量保障**：执行三级验证（Tier 1-3），确保架构同构性\n`;
        integratedResult += `4. **风险控制**：监控系统熵值，确保$H_{sys} \\leq 0.2$\n\n`;
        
        integratedResult += `---\n`;
        integratedResult += `*整合时间：${new Date().toLocaleString()}*\n`;
        integratedResult += `*宪法依据：§109协作流程公理、§110协作效率公理*`;
        
        return integratedResult;
    }
    
    /**
     * 广播协作进度
     */
    private broadcastCollaborationProgress(collaboration: any): void {
        this.broadcast("collaboration_progress", {
            collaborationId: collaboration.id,
            status: collaboration.collaborationStatus,
            progress: collaboration.progress,
            participatingAgents: Array.from(collaboration.participatingAgents),
            agentStatuses: Object.fromEntries(collaboration.agentStatuses),
            agentProgress: Object.fromEntries(collaboration.agentProgress),
            timestamp: Date.now()
        });
    }
    
    /**
     * 广播协作完成
     */
    private broadcastCollaborationCompletion(collaboration: any): void {
        this.broadcast("collaboration_completed", {
            collaborationId: collaboration.id,
            result: collaboration.result,
            participatingAgents: Array.from(collaboration.participatingAgents),
            startTime: collaboration.startTime,
            completionTime: collaboration.actualCompletionTime,
            duration: collaboration.actualCompletionTime - collaboration.startTime,
            timestamp: Date.now()
        });
    }
    
    /**
     * 延迟函数（用于模拟异步操作）
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 生成模拟Agent响应（Phase 2将替换为真正的LLM集成）
     */
    private generateMockAgentResponse(agentType: string, query: string, context: any): string {
        const responses: Record<string, string[]> = {
            legal_expert: [
                "根据基本法§101用户主权公理，您的问题需要用户确认后才能执行。",
                "该操作符合宪法约束，但需要遵循§102单一真理源公理，同步到.clinerules文件。",
                "建议查阅基本法索引第2章Agent协作协议，了解相关规范。",
                "此修改需要法务专家审核，请提供更多上下文信息。"
            ],
            programmer: [
                "这是一个技术实现问题，建议使用TypeScript编写，遵循技术法§300数学公理。",
                "代码实现需要考虑原子性操作，参考DS-002原子文件写入标准。",
                "系统集成需要注意依赖注入配置，参考DS-012标准。",
                "技术问题需要详细的需求分析，请提供具体的功能描述。"
            ],
            architect: [
                "架构设计需要考虑系统分层，遵循基本法§104功能分层拓扑公理。",
                "知识图谱集成可以参考DS-007架构同构性验证标准。",
                "系统扩展需要考虑熵减验证，确保架构有序度提升。",
                "建议使用Colyseus进行实时通信，遵循§321-§324实时通信公理。"
            ],
            secretary: [
                "已记录该对话，历史记录将保存30天，遵循§313用户活动记录公理。",
                "建议生成对话摘要，便于知识整理和后续查询。",
                "历史管理需要遵循§108消息历史公理，支持CRUD操作。",
                "书记员可以协助整理知识库引用，提高协作效率。"
            ]
        };
        
        const agentResponses = responses[agentType] || responses.legal_expert;
        const randomIndex = Math.floor(Math.random() * agentResponses.length);
        
        return agentResponses[randomIndex] + `\n\n（这是模拟响应，Phase 2将实现真正的LLM集成）`;
    }
    
    /**
     * 处理Agent私聊消息
     */
    private handleAgentPrivateMessage(message: ChatMessage) {
        // Phase 2实现真正的Agent私聊处理
        // 当前仅记录日志
        logger.info(`[ChatRoom] Agent私聊消息：${message.senderId} -> ${message.recipientId}`);
    }
    
    /**
     * 处理消息编辑
     */
    private handleEditMessage(client: Client, message: any) {
        const { messageId, newContent } = message;
        const user = this.state.getUser(`user:${client.sessionId}`);
        
        if (!user) {
            this.sendError(client, "user_not_found", "用户未找到");
            return;
        }
        
        // 查找消息
        const chatMessage = this.state.messages.find(msg => msg.id === messageId);
        if (!chatMessage) {
            this.sendError(client, "message_not_found", "消息未找到");
            return;
        }
        
        // 检查权限：只有发送者可以编辑自己的消息
        if (chatMessage.senderId !== user.id) {
            this.sendError(client, "permission_denied", "只能编辑自己发送的消息");
            return;
        }
        
        // 保存原始内容（如果是第一次编辑）
        if (!chatMessage.edited) {
            chatMessage.originalContent = chatMessage.content;
        }
        
        // 更新消息内容
        chatMessage.content = newContent;
        chatMessage.edited = true;
        chatMessage.lastEditor = user.id;
        chatMessage.lastEditTime = Date.now();
        
        // 广播编辑通知
        this.broadcast("message_edited", {
            messageId,
            senderId: user.id,
            newContent,
            editTime: chatMessage.lastEditTime,
            timestamp: Date.now()
        });
        
        logger.info(`[ChatRoom] ${user.username} 编辑了消息 ${messageId}`);
    }
    
    /**
     * 处理消息删除（软删除）
     */
    private handleDeleteMessage(client: Client, message: any) {
        const { messageId } = message;
        const user = this.state.getUser(`user:${client.sessionId}`);
        
        if (!user) {
            this.sendError(client, "user_not_found", "用户未找到");
            return;
        }
        
        // 查找消息
        const chatMessage = this.state.messages.find(msg => msg.id === messageId);
        if (!chatMessage) {
            this.sendError(client, "message_not_found", "消息未找到");
            return;
        }
        
        // 检查权限：发送者或管理员可以删除
        if (chatMessage.senderId !== user.id && user.role !== 'admin') {
            this.sendError(client, "permission_denied", "没有删除权限");
            return;
        }
        
        // 执行软删除
        chatMessage.deleted = true;
        chatMessage.metadata.set('deleted_by', user.id);
        chatMessage.metadata.set('deleted_at', Date.now().toString());
        
        // 广播删除通知
        this.broadcast("message_deleted", {
            messageId,
            deletedBy: user.id,
            timestamp: Date.now()
        });
        
        logger.info(`[ChatRoom] ${user.username} 删除了消息 ${messageId}`);
    }
    
    /**
     * 处理用户动作
     */
    private handleUserAction(client: Client, message: any) {
        const { action, data = {} } = message;
        const user = this.state.getUser(`user:${client.sessionId}`);
        
        if (!user) {
            this.sendError(client, "user_not_found", "用户未找到");
            return;
        }
        
        switch (action) {
            case "update_status":
                user.online = data.online !== undefined ? data.online : user.online;
                user.lastActive = Date.now();
                this.state.updateUser(user);
                this.broadcast("user_status_updated", {
                    userId: user.id,
                    username: user.username,
                    online: user.online,
                    timestamp: Date.now()
                });
                break;
                
            case "update_preferences":
                if (data.preferences && typeof data.preferences === 'object') {
                    Object.entries(data.preferences).forEach(([key, value]) => {
                        user.preferences.set(key, String(value));
                    });
                    this.state.updateUser(user);
                }
                break;
                
            default:
                this.sendError(client, "unknown_action", `未知的用户动作：${action}`);
        }
    }
    
    /**
     * 处理心跳
     */
    private handleHeartbeat(client: Client, message: any) {
        const user = this.state.getUser(`user:${client.sessionId}`);
        if (user) {
            user.lastActive = Date.now();
            this.state.updateUser(user);
        }
        
        client.send("heartbeat_ack", {
            timestamp: Date.now(),
            serverTime: Date.now()
        });
    }

    /**
     * 📖 处理知识库读取请求
     * 真实对接：从服务器文件系统中读取内容
     */
    private handleKnowledgeRead(client: Client, message: any) {
        const { id } = message;
        if (!id) {
            this.sendError(client, "missing_id", "知识节点ID不能为空");
            return;
        }

        logger.info(`[ChatRoom] 用户 ${client.sessionId} 请求读取知识: ${id}`);

        try {
            // 基础目录
            const basePaths = [
                path.join(process.cwd(), 'memory_bank'),
                path.join(process.cwd(), 'storage', 'corpus')
            ];

            let content = "";
            let found = false;
            let resolvedPath = "";

            // 递归搜索或直接路径搜索
            for (const base of basePaths) {
                // 如果 id 包含路径，尝试直接拼接并检查
                const directPath = path.join(base, id);
                const directPathWithMd = directPath.endsWith('.md') ? directPath : `${directPath}.md`;
                
                if (fs.existsSync(directPath) && fs.lstatSync(directPath).isFile()) {
                    resolvedPath = directPath;
                    found = true;
                    break;
                } else if (fs.existsSync(directPathWithMd) && fs.lstatSync(directPathWithMd).isFile()) {
                    resolvedPath = directPathWithMd;
                    found = true;
                    break;
                }
                
                // 如果没找到，尝试在基础目录下搜索文件名（降级方案）
                const searchFilename = path.basename(id);
                const searchFilenameWithMd = searchFilename.endsWith('.md') ? searchFilename : `${searchFilename}.md`;
                
                // 深度优先搜索文件名
                const findFile = (dir: string, target: string): string | null => {
                    const files = fs.readdirSync(dir);
                    for (const file of files) {
                        const fullPath = path.join(dir, file);
                        if (fs.lstatSync(fullPath).isDirectory()) {
                            const res = findFile(fullPath, target);
                            if (res) return res;
                        } else if (file === target) {
                            return fullPath;
                        }
                    }
                    return null;
                };

                const searchedPath = findFile(base, searchFilename) || findFile(base, searchFilenameWithMd);
                if (searchedPath) {
                    resolvedPath = searchedPath;
                    found = true;
                    break;
                }
            }

            if (found) {
                content = fs.readFileSync(resolvedPath, 'utf-8');
                client.send("knowledge:content", { id, content });
                logger.info(`[ChatRoom] 已从 ${resolvedPath} 成功发送知识内容`);
            } else {
                client.send("knowledge:error", { 
                    id, 
                    error: `未找到知识节点: ${id}。搜索范围：memory_bank, storage/corpus`
                });
                logger.warn(`[ChatRoom] 知识节点未找到: ${id}`);
            }
        } catch (error: any) {
            logger.error(`[ChatRoom] 读取知识出错: ${error.message}`);
            client.send("knowledge:error", { id, error: `读取失败: ${error.message}` });
        }
    }
    
    /**
     * 发送错误消息
     */
    private sendError(client: Client, errorCode: string, errorMessage: string) {
        client.send("error", {
            code: errorCode,
            message: errorMessage,
            timestamp: Date.now()
        });
        
        logger.warn(`[ChatRoom] 发送错误：${errorCode} - ${errorMessage}`);
    }
    
    onJoin(client: Client, options: any) {
        logger.info(`[ChatRoom] 客户端 ${client.sessionId} 加入，选项：${JSON.stringify(options)}`);
        
        // 创建或更新用户状态
        const userId = `user:${client.sessionId}`;
        const username = options.username || `用户_${client.sessionId.substring(0, 6)}`;
        const role = options.role || 'user';
        
        let user = this.state.getUser(userId);
        if (!user) {
            user = new UserState();
            user.id = userId;
            user.username = username;
            user.role = role;
            user.online = true;
            user.lastActive = Date.now();
            user.currentRoom = this.roomId;
            this.state.totalUsers++;
        } else {
            user.online = true;
            user.lastActive = Date.now();
            user.currentRoom = this.roomId;
        }
        
        this.state.updateUser(user);
        
        // 发送欢迎信息
        const welcomeMessage = new ChatMessage();
        welcomeMessage.id = `sys_${Date.now()}`;
        welcomeMessage.content = `${username} 加入了聊天室`;
        welcomeMessage.senderId = "system";
        welcomeMessage.channel = "public";
        welcomeMessage.timestamp = Date.now();
        welcomeMessage.messageType = "system";
        
        this.state.addMessage(welcomeMessage);
        
        // 发送系统信息给新用户
        client.send("system_info", {
            version: "1.0.0",
            roomName: this.state.roomName,
            description: this.state.description,
            activeUsers: this.state.users.size,
            activeAgents: this.state.activeAgents,
            messagesCount: this.state.messages.length,
            serverTime: Date.now()
        });
        
        // 发送当前状态
        client.send("room_state", {
            messages: Array.from(this.state.messages),
            users: Array.from(this.state.users.values()),
            agents: Array.from(this.state.agents.values()),
            systemHealth: this.state.systemHealth,
            systemStatus: this.state.systemStatus,
            timestamp: Date.now()
        });
        
        // 广播用户加入通知
        this.broadcast("user_joined", {
            userId: user.id,
            username: user.username,
            timestamp: Date.now()
        }, { except: client });
        
        logger.info(`[ChatRoom] ${username} 加入了房间，当前在线用户：${this.state.users.size}`);
    }
    
    onLeave(client: Client, consented: boolean) {
        const userId = `user:${client.sessionId}`;
        const user = this.state.getUser(userId);
        
        if (user) {
            user.online = false;
            user.lastActive = Date.now();
            this.state.updateUser(user);
            
            // 发送离开通知
            const leaveMessage = new ChatMessage();
            leaveMessage.id = `sys_${Date.now()}`;
            leaveMessage.content = `${user.username} 离开了聊天室`;
            leaveMessage.senderId = "system";
            leaveMessage.channel = "public";
            leaveMessage.timestamp = Date.now();
            leaveMessage.messageType = "system";
            
            this.state.addMessage(leaveMessage);
            
            this.broadcast("user_left", {
                userId: user.id,
                username: user.username,
                consented,
                timestamp: Date.now()
            });
            
            const usersArray = Array.from(this.state.users.values()) as UserState[];
            const onlineUsers = usersArray.filter((u: UserState) => u.online).length;
            logger.info(`[ChatRoom] ${user.username} 离开了房间，当前在线用户：${onlineUsers}`);
        }
    }
    
    onDispose() {
        logger.info(`[ChatRoom] 销毁房间 ${this.roomId}...`);
        
        // 从活跃房间列表移除
        activeRooms.delete(this);
        
        // 更新所有用户状态为离线
        this.state.users.forEach(user => {
            user.online = false;
            user.lastActive = Date.now();
        });
        
        logger.info(`[ChatRoom] 房间 ${this.roomId} 已销毁`);
    }
    
    /**
     * 更新循环（10Hz）
     */
    update(deltaTime: number) {
        this.timeElapsed += deltaTime;
        
        // 定期更新系统健康度和熵值（1Hz）
        if (this.timeElapsed > 1000) {
            // 基础更新逻辑
            this.state.updateSystemHealth();
            
            // 计算系统熵值（表示有序程度，越低越好）
            this.updateSystemEntropy();
            
            // 添加模拟波动 (Phase 4 需求)
            // 1. 系统健康度微调
            const fluctuation = (Math.random() - 0.5) * 0.05;
            this.state.systemHealth = Math.max(0.7, Math.min(1.0, this.state.systemHealth + fluctuation));
            
            // 同步更新系统状态
            if (this.state.systemHealth >= 0.8) {
                this.state.systemStatus = "normal";
            } else if (this.state.systemHealth >= 0.5) {
                this.state.systemStatus = "warning";
            } else {
                this.state.systemStatus = "error";
            }
            
            // 2. 随机更新一个 Agent 的状态（如果当前没有正在进行的任务）
            const agents = Array.from(this.state.agents.values()) as AgentState[];
            const randomAgent = agents[Math.floor(Math.random() * agents.length)];
            
            if (randomAgent && randomAgent.status === "idle" && Math.random() > 0.8) {
                this.simulateAgentActivity(randomAgent);
            }
            
            this.timeElapsed = 0;
        }
        
        // 心跳检测（30秒）
        if (Date.now() - this.lastHeartbeat > this.heartbeatInterval) {
            this.checkHeartbeats();
            this.lastHeartbeat = Date.now();
        }
    }
    
    /**
     * 更新系统熵值
     * 基于：协作效率、Agent利用率、消息处理速率
     * 熵值越低表示系统越有序（逆熵）
     */
    private updateSystemEntropy(): void {
        // 计算协作效率（基于活跃协作的进度）
        let totalCollaborationProgress = 0;
        let activeCollaborationCount = 0;
        
        this.state.activeCollaborations.forEach((collab: any) => {
            totalCollaborationProgress += collab.progress;
            activeCollaborationCount++;
        });
        
        const avgCollaborationProgress = activeCollaborationCount > 0 
            ? totalCollaborationProgress / activeCollaborationCount 
            : 1.0;
        
        // 计算Agent利用率（正在工作的Agent比例）
        const agents = Array.from(this.state.agents.values()) as any[];
        const activeAgents = agents.filter(a => a.status !== "idle").length;
        const agentUtilization = agents.length > 0 ? activeAgents / agents.length : 0.5;
        
        // 计算消息处理速率健康度
        const timeSinceLastMessage = Date.now() - this.state.lastActivity;
        const messageActivityHealth = timeSinceLastMessage < 60000 ? 1.0 : 0.3; // 1分钟内活跃为健康
        
        // 熵值计算公式：H = 1 - (协作效率 * 0.4 + Agent利用率 * 0.3 + 消息活性 * 0.3)
        // 熵值范围：0.0（完全有序）~ 1.0（完全无序）
        const entropy = 1.0 - (
            avgCollaborationProgress * 0.4 + 
            agentUtilization * 0.3 + 
            messageActivityHealth * 0.3
        );
        
        // 平滑更新熵值（避免剧烈波动）
        const smoothingFactor = 0.2;
        const currentEntropy = this.state.systemEntropy;
        const newEntropy = currentEntropy * (1 - smoothingFactor) + entropy * smoothingFactor;
        
        this.state.systemEntropy = Math.max(0.0, Math.min(1.0, newEntropy));
    }

    /**
     * 模拟 Agent 随机活动
     */
    private simulateAgentActivity(agent: AgentState) {
        const originalStatus = agent.status;
        agent.status = "thinking";
        this.state.updateAgent(agent);
        
        setTimeout(() => {
            if (agent.status === "thinking") {
                agent.status = "speaking";
                this.state.updateAgent(agent);
                
                setTimeout(() => {
                    if (agent.status === "speaking") {
                        agent.status = "idle";
                        this.state.updateAgent(agent);
                    }
                }, 2000);
            }
        }, 1500);
    }
    
    /**
     * 设置心跳检测
     */
    private setupHeartbeatCheck() {
        // 每30秒发送心跳请求
        this.clock.setInterval(() => {
            this.broadcast("heartbeat_request", {
                timestamp: Date.now(),
                interval: this.heartbeatInterval
            });
        }, this.heartbeatInterval);
    }
    
    /**
     * 检查心跳，标记长时间无响应的用户为离线
     */
    private checkHeartbeats() {
        const now = Date.now();
        const timeout = this.heartbeatInterval * 2; // 两倍心跳间隔视为超时
        
        this.state.users.forEach(user => {
            if (user.online && now - user.lastActive > timeout) {
                user.online = false;
                user.lastActive = now;
                this.state.updateUser(user);
                
                logger.info(`[ChatRoom] 用户 ${user.username} 心跳超时，标记为离线`);
            }
        });
    }
}
