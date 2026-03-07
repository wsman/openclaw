/**
 * LLM模块索引
 * 
 * 导出所有LLM相关模块
 * 
 * 宪法依据: §101 同步公理 - 代码与文档同步
 * 
 * @module llm
 * @version 1.0.0
 * @category LLM
 */

// 适配器
export * from './adapters';

// 模型注册表
export { ModelRegistry, type ModelRegistration, type RegistryConfig } from './ModelRegistry';

// 能力匹配引擎
export {
  CapabilityMatcher,
  type MatchResult,
  type MatcherConfig,
} from './CapabilityMatcher';
