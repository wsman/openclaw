/**
 * 🏛️ Agent 模块 - 统一导出入口
 * 
 * 宪法依据：§152 单一真理源公理
 * 
 * 导出内容：
 * - 类型定义
 * - 服务类
 * - 工具函数
 */

// 类型导出
export type {
  AgentType,
  LLMProvider,
  AgentStatus,
  CollaborationRules,
  AgentConfig,
  OfficeDirectorAgentConfig,
  AgentInfo,
  AgentRequest,
  AgentResponse,
  CollaborationRequest,
  CollaborationResult,
  AgentEngineConfig,
  ConstitutionalCompliance
} from './types';

// 服务导出
export { 
  AgentService, 
  getAgentService, 
  resetAgentService 
} from './AgentService';

// 默认配置导出
export { getDefaultAgents } from './types';

// 默认导出
export default {
  AgentService: require('./AgentService').AgentService,
  getAgentService: require('./AgentService').getAgentService,
  getDefaultAgents: require('./types').getDefaultAgents
};
