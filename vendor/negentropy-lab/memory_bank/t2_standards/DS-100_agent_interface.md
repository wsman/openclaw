# AS-101 Agent接口规范 (Agent Interface Specification)

**宪法依据**: §106 Agent身份公理、§107通信安全公理、§110协作效率公理
**技术法依据**: AS-101 (Agent接口规范)
**版本**: v1.3.0
**状态**: 🟢 活跃
**AI友好度**: ⭐⭐⭐⭐⭐ (5/5星 - 专为AI Agent设计)

---

## 🎯 标准目的

### AI Agent请注意：
**目标**: 定义所有AI Agent的统一接口和通信协议。
**要解决的问题**: 不同Agent需要标准化的方式接收请求、处理任务、返回结果和相互协作。

### 核心需求：
1. **统一接口**: 所有Agent实现相同的核心接口
2. **标准化消息**: Agent间使用标准化的消息格式通信
3. **职责明确**: 每个Agent有清晰的职责定义
4. **协作能力**: 支持Agent间协作和任务委托
5. **状态管理**: Agent能管理自己的状态和上下文

---

## 📋 Agent核心接口 (面向AI的实现指南)

### 1. IAgent 基础接口 (TypeScript)
```typescript
// AI注意：所有Agent都必须实现这个接口
export interface IAgent {
  // Agent的唯一标识
  readonly id: string;
  
  // Agent的显示名称（用户可见）
  readonly displayName: string;
  
  // Agent的职责描述
  readonly description: string;
  
  // Agent支持的任务类型
  readonly capabilities: AgentCapability[];
  
  /**
   * 处理用户或其它Agent的请求
   * @param request 请求信息
   * @returns 处理结果
   */
  handleRequest(request: AgentRequest): Promise<AgentResponse>;
  
  /**
   * 获取Agent的当前状态
   */
  getStatus(): Promise<AgentStatus>;
  
  /**
   * 初始化Agent（系统启动时调用）
   */
  initialize(): Promise<void>;
  
  /**
   * 清理Agent资源（系统关闭时调用）
   */
  cleanup(): Promise<void>;
}
```

### 2. AgentRequest 请求定义
```typescript
// AI注意：这是Agent接收到的请求格式
export interface AgentRequest {
  // 请求唯一ID（用于追踪）
  requestId: string;
  
  // 发送者：用户ID或其它Agent ID
  sender: string;
  
  // 接收者：本Agent的ID
  recipient: string;
  
  // 请求内容
  content: string;
  
  // 上下文信息（可选）
  context?: {
    // 对话历史
    conversationHistory?: Message[];
    
    // 相关文件或知识库引用
    knowledgeReferences?: string[];
    
    // 用户意图分析结果
    userIntent?: UserIntent;
    
    // 任务优先级：1（低）到10（高）
    priority?: number;
    
    // 超时时间（毫秒）
    timeout?: number;
  };
  
  // 请求时间戳
  timestamp: number;
  
  // 请求类型
  type: 'direct_request' | 'collaboration_request' | 'status_query' | 'system_command';
}
```

### 3. AgentResponse 响应定义
```typescript
// AI注意：这是Agent返回的响应格式
export interface AgentResponse {
  // 对应的请求ID
  requestId: string;
  
  // 响应内容
  content: string;
  
  // 响应类型
  type: 'direct_response' | 'collaboration_invitation' | 'status_report' | 'error';
  
  // 建议的下一步操作（可选）
  suggestedActions?: SuggestedAction[];
  
  // 执行结果（如果涉及知识库修改等操作）
  executionResult?: ExecutionResult;
  
  // 响应时间戳
  timestamp: number;
  
  // 处理耗时（毫秒）
  processingTime: number;
  
  // 置信度：0-1，表示对响应的信心程度
  confidence: number;
}

// AI注意：这是你可以建议用户执行的下一步操作
export interface SuggestedAction {
  // 操作类型
  type: 'edit_knowledge' | 'consult_other_agent' | 'run_code' | 'view_document';
  
  // 操作描述
  description: string;
  
  // 操作参数
  parameters?: Record<string, any>;
  
  // 是否立即执行
  autoExecute?: boolean;
}

// AI注意：如果你执行了知识库修改等操作，需要返回这个
export interface ExecutionResult {
  // 操作是否成功
  success: boolean;
  
  // 影响的文件或实体
  affectedEntities: string[];
  
  // 执行详情
  details: string;
  
  // 错误信息（如果失败）
  error?: string;
}
```

---

## 🔧 Agent类型定义 (AI可参考的实现)

### 1. 专业Agent基类示例
```typescript
// AI注意：你可以基于这个基类实现具体Agent
abstract class ProfessionalAgent implements IAgent {
  abstract readonly id: string;
  abstract readonly displayName: string;
  abstract readonly description: string;
  abstract readonly capabilities: AgentCapability[];
  
  // 共享的初始化逻辑
  async initialize(): Promise<void> {
    console.log(`Agent ${this.displayName} 正在初始化...`);
    await this.loadKnowledgeBase();
    await this.establishConnections();
    console.log(`Agent ${this.displayName} 初始化完成`);
  }
  
  // 共享的清理逻辑
  async cleanup(): Promise<void> {
    console.log(`Agent ${this.displayName} 正在清理...`);
    await this.saveState();
    await this.closeConnections();
    console.log(`Agent ${this.displayName} 清理完成`);
  }
  
  // 通用的请求处理方法
  async handleRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    
    try {
      // 1. 验证请求
      this.validateRequest(request);
      
      // 2. 解析请求
      const parsedRequest = await this.parseRequest(request);
      
      // 3. 处理请求（由子类实现）
      const result = await this.processRequest(parsedRequest);
      
      // 4. 构建响应
      const response = this.buildResponse(request, result);
      
      // 5. 记录处理日志
      await this.logRequest(request, response, Date.now() - startTime);
      
      return response;
      
    } catch (error) {
      // 错误处理
      return this.buildErrorResponse(request, error, Date.now() - startTime);
    }
  }
  
  // 子类需要实现的方法
  protected abstract parseRequest(request: AgentRequest): Promise<ParsedRequest>;
  protected abstract processRequest(parsedRequest: ParsedRequest): Promise<ProcessResult>;
  
  // 通用工具方法
  protected validateRequest(request: AgentRequest): void {
    if (!request.content || request.content.trim().length === 0) {
      throw new Error('请求内容不能为空');
    }
    
    if (request.recipient !== this.id) {
      throw new Error(`请求接收者 ${request.recipient} 不匹配本Agent ID ${this.id}`);
    }
  }
  
  protected buildResponse(request: AgentRequest, result: ProcessResult): AgentResponse {
    return {
      requestId: request.requestId,
      content: result.content,
      type: 'direct_response',
      suggestedActions: result.suggestedActions,
      executionResult: result.executionResult,
      timestamp: Date.now(),
      processingTime: Date.now() - Number(request.timestamp),
      confidence: result.confidence || 0.8
    };
  }
}
```

### 2. 具体Agent实现示例：法务专家Agent
```typescript
// AI注意：这是法务专家Agent的具体实现示例
class LegalExpertAgent extends ProfessionalAgent {
  readonly id = 'agent:legal_expert';
  readonly displayName = '法务专家';
  readonly description = '负责解释基本法条款，确保知识库修改符合宪法约束';
  
  readonly capabilities: AgentCapability[] = [
    { id: 'legal_analysis', description: '法律条款分析' },
    { id: 'compliance_check', description: '合规性检查' },
    { id: 'constitutional_interpretation', description: '宪法解释' },
    { id: 'knowledge_validation', description: '知识库内容验证' }
  ];
  
  // 专有知识库
  private legalKnowledgeBase: Map<string, LegalClause> = new Map();
  
  protected async parseRequest(request: AgentRequest): Promise<ParsedLegalRequest> {
    // 分析请求内容，提取法律相关问题
    const content = request.content.toLowerCase();
    
    return {
      originalRequest: request,
      legalTopics: this.extractLegalTopics(content),
      requestedAction: this.determineAction(content),
      urgency: this.assessUrgency(content),
      relevantClauses: await this.findRelevantClauses(content)
    };
  }
  
  protected async processRequest(parsedRequest: ParsedLegalRequest): Promise<LegalProcessResult> {
    const { legalTopics, requestedAction, relevantClauses } = parsedRequest;
    
    // 根据请求类型进行处理
    switch (requestedAction) {
      case 'interpret_clause':
        return await this.interpretLegalClause(legalTopics[0], relevantClauses);
        
      case 'validate_modification':
        return await this.validateKnowledgeModification(parsedRequest.originalRequest.context);
        
      case 'check_compliance':
        return await this.checkCompliance(legalTopics, relevantClauses);
        
      default:
        return await this.provideGeneralLegalAdvice(parsedRequest);
    }
  }
  
  // 具体的法律处理方法
  private async interpretLegalClause(topic: string, clauses: LegalClause[]): Promise<LegalProcessResult> {
    // 实现具体的法律条款解释逻辑
    const interpretation = await this.analyzeClauses(clauses);
    
    return {
      content: `关于"${topic}"的法律解释：\n\n${interpretation.text}`,
      confidence: interpretation.confidence,
      suggestedActions: [
        {
          type: 'edit_knowledge',
          description: '将此次解释添加到知识库',
          parameters: {
            topic: topic,
            interpretation: interpretation.text,
            clauses: clauses.map(c => c.id)
          }
        }
      ],
      executionResult: {
        success: true,
        affectedEntities: ['legal_knowledge_base'],
        details: '法律条款解释完成'
      }
    };
  }
}
```

---

## 🚀 快速开始：创建你的第一个Agent (AI可直接使用的模板)

### 模板：通用专业Agent
```typescript
// AI注意：复制这个模板，修改TODO部分即可创建新Agent
class YourNewAgent extends ProfessionalAgent {
  // TODO: 设置Agent标识
  readonly id = 'agent:your_agent_id';
  readonly displayName = '你的Agent名称';
  readonly description = '你的Agent职责描述';
  
  // TODO: 定义Agent能力
  readonly capabilities: AgentCapability[] = [
    { id: 'capability_1', description: '能力1描述' },
    { id: 'capability_2', description: '能力2描述' },
    // 添加更多能力...
  ];
  
  // TODO: 初始化你的专有资源
  private yourResources: any;
  
  async initialize(): Promise<void> {
    await super.initialize();
    
    // TODO: 加载你的专有知识库或模型
    this.yourResources = await this.loadYourResources();
    console.log(`${this.displayName} 专有资源加载完成`);
  }
  
  protected async parseRequest(request: AgentRequest): Promise<ParsedRequest> {
    // TODO: 解析请求，提取相关信息
    return {
      originalRequest: request,
      // 添加你的解析字段...
    };
  }
  
  protected async processRequest(parsedRequest: ParsedRequest): Promise<ProcessResult> {
    // TODO: 实现你的处理逻辑
    const result = await this.yourProcessingLogic(parsedRequest);
    
    return {
      content: result.content,
      confidence: result.confidence,
      suggestedActions: result.suggestedActions,
      executionResult: result.executionResult
    };
  }
  
  // TODO: 实现你的专有处理方法
  private async yourProcessingLogic(parsedRequest: ParsedRequest): Promise<YourResultType> {
    // 这里是你的核心处理逻辑
    // 可以调用LLM、查询数据库、执行计算等
    
    return {
      content: '处理结果内容',
      confidence: 0.9,
      suggestedActions: [],
      executionResult: {
        success: true,
        affectedEntities: [],
        details: '处理完成'
      }
    };
  }
}
```

### 模板使用示例：创建一个"数据分析专家Agent"
```typescript
// AI示例：基于模板快速创建数据分析Agent
class DataAnalysisAgent extends ProfessionalAgent {
  readonly id = 'agent:data_analyst';
  readonly displayName = '数据分析专家';
  readonly description = '负责数据分析和可视化建议';
  
  readonly capabilities: AgentCapability[] = [
    { id: 'data_analysis', description: '数据分析' },
    { id: 'statistics', description: '统计分析' },
    { id: 'visualization', description: '数据可视化建议' },
    { id: 'trend_prediction', description: '趋势预测' }
  ];
  
  private dataTools: DataAnalysisTools;
  
  async initialize(): Promise<void> {
    await super.initialize();
    this.dataTools = new DataAnalysisTools();
    await this.dataTools.initialize();
  }
  
  protected async parseRequest(request: AgentRequest): Promise<ParsedDataRequest> {
    const content = request.content;
    
    // 提取数据相关信息
    const dataReferences = this.extractDataReferences(content);
    const analysisType = this.determineAnalysisType(content);
    
    return {
      originalRequest: request,
      dataReferences: dataReferences,
      analysisType: analysisType,
      timeRange: this.extractTimeRange(content),
      metrics: this.extractMetrics(content)
    };
  }
  
  protected async processRequest(parsedRequest: ParsedDataRequest): Promise<ProcessResult> {
    const result = await this.dataTools.analyzeData(parsedRequest);
    
    return {
      content: `数据分析结果：\n\n${result.summary}\n\n关键发现：\n${result.keyFindings.join('\n')}`,
      confidence: result.confidence,
      suggestedActions: [
        {
          type: 'run_code',
          description: '生成数据可视化代码',
          parameters: {
            chartType: result.recommendedChart,
            data: result.processedData
          }
        }
      ],
      executionResult: {
        success: true,
        affectedEntities: ['data_analysis_cache'],
        details: `分析了 ${parsedRequest.dataReferences.length} 个数据集`
      }
    };
  }
}
```

---

## 🤝 Agent协作协议 (AI Agent如何相互协作)

### 1. 协作请求格式
```typescript
// AI注意：当你的Agent需要其它Agent帮助时，使用这个格式
export interface CollaborationRequest {
  // 协作请求ID
  collaborationId: string;
  
  // 发起协作的Agent
  initiator: string;
  
  // 请求协作的Agent列表
  collaborators: string[];
  
  // 协作任务描述
  taskDescription: string;
  
  // 任务分解（可选）
  subtasks?: CollaborationSubtask[];
  
  // 截止时间
  deadline?: number;
  
  // 协作模式
  mode: 'parallel' | 'sequential' | 'hierarchical';
}

// AI注意：将复杂任务分解为子任务
export interface CollaborationSubtask {
  id: string;
  description: string;
  assignedTo?: string;  // 指定分配给哪个Agent
  requiredCapabilities: string[];  // 需要的能力
  dependencies?: string[];  // 依赖的其它子任务
}
```

### 2. 协作响应格式
```typescript
// AI注意：响应协作请求的格式
export interface CollaborationResponse {
  collaborationId: string;
  respondent: string;
  acceptance: boolean;  // 是否接受协作
  reason?: string;  // 接受或拒绝的原因
  
  // 如果接受，提供的信息
  estimatedCompletionTime?: number;
  requiredResources?: string[];
  constraints?: string[];
  
  // 执行结果（完成后提供）
  result?: CollaborationResult;
}

export interface CollaborationResult {
  subtaskId: string;
  result: any;
  status: 'completed' | 'failed' | 'partial';
  details: string;
  nextSteps?: string[];
}
```

### 3. 协作流程示例
```typescript
// AI示例：办公厅主任协调多个Agent协作
class OfficeDirectorAgent extends ProfessionalAgent {
  async coordinateComplexTask(task: ComplexTask): Promise<CollaborationResult> {
    // 1. 分析任务需求
    const requiredCapabilities = this.analyzeTaskRequirements(task);
    
    // 2. 选择合适的协作Agent
    const collaborators = await this.selectCollaborators(requiredCapabilities);
    
    // 3. 发送协作请求
    const collaborationRequest: CollaborationRequest = {
      collaborationId: `collab_${Date.now()}`,
      initiator: this.id,
      collaborators: collaborators.map(c => c.id),
      taskDescription: task.description,
      subtasks: this.decomposeTask(task, collaborators),
      mode: 'parallel'
    };
    
    // 4. 等待所有Agent响应
    const responses = await Promise.all(
      collaborators.map(agent => 
        agent.handleRequest({
          requestId: `req_${Date.now()}`,
          sender: this.id,
          recipient: agent.id,
          content: JSON.stringify(collaborationRequest),
          type: 'collaboration_request',
          timestamp: Date.now()
        })
      )
    );
    
    // 5. 协调执行
    return await this.coordinateExecution(collaborationRequest, responses);
  }
}
```

---

## 📊 Agent状态管理与监控 (AI运维指南)

### 1. Agent状态报告
```typescript
// AI注意：定期报告Agent状态
export interface AgentStatus {
  // 基本信息
  agentId: string;
  status: 'online' | 'offline' | 'busy' | 'degraded';
  lastHeartbeat: number;
  
  // 性能指标
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    averageResponseTime: number;
    currentLoad: number;  // 0-1，当前负载
    errorRate: number;
  };
  
  // 资源使用
  resourceUsage: {
    memoryUsage: number;  // MB
    cpuUsage: number;     // 百分比
    diskUsage: number;    // MB
  };
  
  // 能力状态
  capabilityStatus: Record<string, CapabilityStatus>;
}

// AI注意：在Agent中实现状态报告
async function reportAgentStatus(): Promise<void> {
  const status: AgentStatus = {
    agentId: this.id,
    status: this.isBusy ? 'busy' : 'online',
    lastHeartbeat: Date.now(),
    metrics: this.collectMetrics(),
    resourceUsage: await this.getResourceUsage(),
    capabilityStatus: this.getCapabilityStatus()
  };
  
  // 发送给监控系统
  await this.sendToMonitoringSystem(status);
}
```

### 2. 健康检查机制
```typescript
// AI注意：实现定期健康检查
class AgentHealthMonitor {
  private readonly agents: Map<string, IAgent> = new Map();
  
  // 定期检查所有Agent健康状态
  async checkAllAgents(): Promise<HealthReport[]> {
    const reports: HealthReport[] = [];
    
    for (const [agentId, agent] of this.agents) {
      try {
        const status = await agent.getStatus();
        const isHealthy = this.assessHealth(status);
        
        reports.push({
          agentId,
          timestamp: Date.now(),
          healthy: isHealthy,
          details: status,
          issues: isHealthy ? [] : this.identifyIssues(status)
        });
        
        // 如果Agent不健康，尝试恢复
        if (!isHealthy) {
          await this.tryRecoverAgent(agent);
        }
        
      } catch (error) {
        // Agent完全无响应
        reports.push({
          agentId,
          timestamp: Date.now(),
          healthy: false,
          details: null,
          issues: [`Agent无响应: ${error.message}`]
        });
      }
    }
    
    return reports;
  }
}
```

---

## ⚠️ 常见问题与解决方案 (AI故障排除指南)

### 问题1：Agent请求超时
**现象**: `handleRequest()` 超过设定的timeout时间
**解决方案**：
```typescript
// 实现超时处理
async function handleRequestWithTimeout(
  request: AgentRequest, 
  timeout: number = 30000
): Promise<AgentResponse> {
  
  return Promise.race([
    this.handleRequest(request),
    new Promise<AgentResponse>((_, reject) => {
      setTimeout(() => reject(new Error('请求处理超时')), timeout);
    })
  ]).catch(error => {
    // 返回优雅的错误响应
    return {
      requestId: request.requestId,
      content: `抱歉，处理请求时超时。请稍后重试或简化请求内容。`,
      type: 'error',
      timestamp: Date.now(),
      processingTime: timeout,
      confidence: 0
    };
  });
}
```

### 问题2：Agent间协作失败
**现象**: 协作请求被拒绝或无响应
**解决方案**：
```typescript
// 实现协作降级策略
async function handleCollaborationFailure(
  request: CollaborationRequest,
  failedAgents: string[]
): Promise<CollaborationResult> {
  
  console.warn(`以下Agent协作失败: ${failedAgents.join(', ')}`);
  
  // 策略1：重新分配任务
  const availableAgents = await this.findAvailableAgents(request.requiredCapabilities);
  if (availableAgents.length > 0) {
    console.log(`重新分配任务给: ${availableAgents.map(a => a.displayName).join(', ')}`);
    return this.retryCollaboration(request, availableAgents);
  }
  
  // 策略2：降级为单Agent处理
  console.log('降级为单Agent处理模式');
  const primaryAgent = await this.selectPrimaryAgent(request);
  return primaryAgent.handleRequest({
    ...request,
    content: `由于协作失败，请单独处理：${request.taskDescription}`
  });
  
  // 策略3：返回部分结果
  // return this.buildPartialResult(request, completedSubtasks);
}
```

### 问题3：Agent资源不足
**现象**: Agent报告内存或CPU使用率过高
**解决方案**：
```typescript
// 实现资源监控和自动调节
class ResourceAwareAgent extends ProfessionalAgent {
  private resourceMonitor: ResourceMonitor;
  private currentLoadLevel: 'low' | 'medium' | 'high' = 'low';
  
  async handleRequest(request: AgentRequest): Promise<AgentResponse> {
    // 检查当前负载
    const currentLoad = await this.resourceMonitor.getCurrentLoad();
    
    // 如果负载过高，拒绝或延迟处理
    if (currentLoad > 0.8 && request.context?.priority < 5) {
      return {
        requestId: request.requestId,
        content: `当前系统负载较高，您的请求已被排队。预计等待时间: 2-3分钟`,
        type: 'error',
        timestamp: Date.now(),
        processingTime: 100, // 快速响应
        confidence: 0.9
      };
    }
    
    // 调整处理策略以适应负载
    const processingStrategy = this.selectProcessingStrategy(currentLoad);
    return this.processWithStrategy(request, processingStrategy);
  }
  
  private selectProcessingStrategy(load: number): ProcessingStrategy {
    if (load > 0.7) {
      return 'fast_approximation';  // 高负载时使用快速近似算法
    } else if (load > 0.4) {
      return 'balanced';           // 中等负载时使用平衡策略
    } else {
      return 'high_quality';       // 低负载时使用高质量算法
    }
  }
}
```

---

## 🔄 版本兼容性 (AI升级指南)

### 向后兼容性策略
```typescript
// AI注意：确保新版本Agent能与旧版本系统兼容
class BackwardCompatibleAgent implements IAgent {
  // 支持多个版本的请求格式
  async handleRequest(request: AgentRequest): Promise<AgentResponse> {
    // 检测请求版本
    const requestVersion = this.detectRequestVersion(request);
    
    // 根据版本使用不同的处理逻辑
    switch (requestVersion) {
      case 'v1.0.0':
        return await this.handleV1Request(request);
      case 'v1.1.0':
        return await this.handleV11Request(request);
      case 'v1.2.0':
        return await this.handleV12Request(request);
      case 'v1.3.0':
        return await this.handleV13Request(request);  // 最新版本
      default:
        // 未知版本，尝试使用最新版本逻辑
        return await this.handleV13Request(request);
    }
  }
  
  // 版本检测逻辑
  private detectRequestVersion(request: AgentRequest): string {
    // 从请求头或内容中提取版本信息
    if (request.context?.apiVersion) {
      return request.context.apiVersion;
    }
    
    // 根据请求特征推断版本
    if (request.content.includes('§192')) {
      return 'v1.3.0';  // 包含模型选择器公理
    } else if (request.type === 'collaboration_request') {
      return 'v1.2.0';  // 包含协作请求类型
    } else {
      return 'v1.0.0';  // 基础版本
    }
  }
}
```

### 版本迁移清单
- **v1.0.0 → v1.1.0**: 添加协作请求支持
- **v1.1.0 → v1.2.0**: 添加资源监控和负载均衡
- **v1.2.0 → v1.3.0**: **AI友好化重构**，添加详细示例和故障排除

---

## 📝 验证清单 (AI自检清单)

在实现Agent时，请验证以下项目：

✅ **接口完整性**：
- [ ] 实现了完整的 `IAgent` 接口
- [ ] `handleRequest()` 能正确处理各种请求类型
- [ ] `getStatus()` 返回准确的Agent状态

✅ **消息格式**：
- [ ] 使用标准化的 `AgentRequest` 格式
- [ ] 返回标准化的 `AgentResponse` 格式
- [ ] 正确处理 `context` 和 `suggestedActions`

✅ **协作能力**：
- [ ] 支持接收协作请求
- [ ] 能发起协作请求
- [ ] 正确处理协作响应

✅ **错误处理**：
- [ ] 有完善的错误处理机制
- [ ] 返回用户友好的错误信息
- [ ] 支持重试和降级策略

✅ **AI友好性**：
- [ ] 代码示例可直接使用
- [ ] 有详细的故障排除指南
- [ ] 状态监控易于理解和实现

---

**宪法依据**: §106 Agent身份公理、§110协作效率公理  
**维护责任**: 架构师Agent + 程序猿Agent  
**最后更新**: 2026-02-04  
**状态**: **AI友好化标准就绪，可直接用于Agent开发与协作**