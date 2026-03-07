/**
 * 🚀 ILLMService模块
 * 
 * @constitution
 * §101 同步公理：代码变更必须触发文档更新
 * §102 熵减原则：所有变更必须降低或维持系统熵值
 * §106 Agent身份公理：每个Agent必须拥有唯一身份标识和明确职责
 * §109 知识图谱公理：系统必须维护知识实体间的关系图谱
 * §110 协作效率公理：Agent响应时间必须控制在合理范围内
 * §152 单一真理源公理：知识库文件是可执行规范的唯一真理源
 * §192 模型选择器公理：必须根据任务复杂度动态选择最优LLM模型
 * §193 模型选择器更新公理：模型选择器必须持续学习并适应性能变化
 * 
 * @filename ILLMService.ts
 * @version 1.0.0
 * @category llm
 * @last_updated 2026-02-11
 */
/**
 * LLMService 接口定义
 */
import { 
    LLMRequest, 
    LLMResponse, 
    StreamCallback, 
    CollaborationResult, 
    AgentConfig, 
    ServiceStats, 
    ValidationResult 
} from './LLMService';

export interface ILLMService {
    executeAgentRequest(request: LLMRequest): Promise<LLMResponse>;
    executeAgentStreamRequest(request: LLMRequest, callbacks: StreamCallback): Promise<string>;
    executeCollaborationRequest(coordinatorRequest: LLMRequest, specialistRequests: LLMRequest[]): Promise<CollaborationResult>;
    getAgentConfig(agentId: string): Promise<AgentConfig>;
    getServiceStats(): ServiceStats;
    validateAgentRequest(request: LLMRequest): ValidationResult;
}