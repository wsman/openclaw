/**
 * 官方Agent术语体系定义
 * 
 * 宪法依据: §152单一真理源公理、§102.3宪法同步公理、§141熵减验证公理
 * 版本: v1.0.0 (最大化功能同步策略 - 术语统一阶段)
 * 状态: 🟢 活跃
 * 
 * 目的: 建立Negentropy-Lab项目的官方Agent术语体系，确保术语一致性，
 *       支持与MY-DOGE-DEMO母项目的宪法同步。
 * 
 * 熵减验证: $\Delta H = H_{\text{不一致}} - H_{\text{统一}} > 0$
 */

/**
 * 核心Agent ID定义 (官方中文术语)
 * 宪法依据: §152单一真理源公理 - 确保术语的唯一性和权威性
 */
export const OfficialAgentIds = {
  // === 协调层Agent ===
  
  /** 办公厅主任Agent - 统一用户对话入口 + 书记员职责合并 */
  OFFICE_DIRECTOR: 'agent:office_director' as const,
  
  /** 内阁总理Agent - 战略协调与复杂任务处理 */
  PRIME_MINISTER: 'agent:prime_minister' as const,
  
  // === 专业层Agent (部委体系) ===
  
  /** 监察部Agent - 法律、合规和宪法解释 */
  SUPERVISION_MINISTRY: 'agent:supervision_ministry' as const,
  
  /** 科技部Agent - 技术实现、代码编写和技术可行性评估 */
  TECHNOLOGY_MINISTRY: 'agent:technology_ministry' as const,
  
  /** 组织部Agent - 系统架构设计、技术选型和架构治理 */
  ORGANIZATION_MINISTRY: 'agent:organization_ministry' as const,
  
  /** 书记员Agent - 历史管理、摘要生成和知识提取 */
  SECRETARY: 'agent:secretary' as const,
  
  // === 特殊用途Agent ===
  
  /** 默认通用Agent - 简单任务处理 */
  DEFAULT_AGENT: 'agent:default' as const,
  
  /** 系统管理Agent - 系统运维和管理 */
  SYSTEM_ADMIN: 'agent:system_admin' as const,
} as const;

/**
 * Agent类型定义
 * 宪法依据: §181类型公理优先原则 - 先定义类型，后实现代码
 */
export type AgentId = typeof OfficialAgentIds[keyof typeof OfficialAgentIds];

/**
 * Agent名称映射 (ID -> 中文名称)
 * 用于友好显示和日志输出
 */
export const AgentNameMapping: Record<AgentId, string> = {
  [OfficialAgentIds.OFFICE_DIRECTOR]: '办公厅主任',
  [OfficialAgentIds.PRIME_MINISTER]: '内阁总理',
  [OfficialAgentIds.SUPERVISION_MINISTRY]: '监察部',
  [OfficialAgentIds.TECHNOLOGY_MINISTRY]: '科技部',
  [OfficialAgentIds.ORGANIZATION_MINISTRY]: '组织部',
  [OfficialAgentIds.SECRETARY]: '书记员',
  [OfficialAgentIds.DEFAULT_AGENT]: '默认Agent',
  [OfficialAgentIds.SYSTEM_ADMIN]: '系统管理员',
};

/**
 * 专业领域到Agent ID的映射
 * 宪法依据: §152单一真理源公理 - 确保映射的唯一性
 * 
 * 映射规则:
 * 1. 法律合规相关 -> 监察部
 * 2. 技术实现相关 -> 科技部
 * 3. 架构设计相关 -> 组织部
 * 4. 文档知识相关 -> 书记员
 * 5. 协调复杂任务 -> 内阁总理
 * 6. 入口级任务 -> 办公厅主任
 */
export const ExpertiseToAgentMapping: Record<string, AgentId> = {
  // 法律与合规领域 -> 监察部
  'legal': OfficialAgentIds.SUPERVISION_MINISTRY,
  'compliance': OfficialAgentIds.SUPERVISION_MINISTRY,
  'law': OfficialAgentIds.SUPERVISION_MINISTRY,
  'constitutional': OfficialAgentIds.SUPERVISION_MINISTRY,
  'regulation': OfficialAgentIds.SUPERVISION_MINISTRY,
  
  // 编程与技术实现 -> 科技部
  'programming': OfficialAgentIds.TECHNOLOGY_MINISTRY,
  'technical': OfficialAgentIds.TECHNOLOGY_MINISTRY,
  'code': OfficialAgentIds.TECHNOLOGY_MINISTRY,
  'implementation': OfficialAgentIds.TECHNOLOGY_MINISTRY,
  'development': OfficialAgentIds.TECHNOLOGY_MINISTRY,
  'engineering': OfficialAgentIds.TECHNOLOGY_MINISTRY,
  
  // 架构与系统设计 -> 组织部
  'architecture': OfficialAgentIds.ORGANIZATION_MINISTRY,
  'design': OfficialAgentIds.ORGANIZATION_MINISTRY,
  'system': OfficialAgentIds.ORGANIZATION_MINISTRY,
  'structure': OfficialAgentIds.ORGANIZATION_MINISTRY,
  'infrastructure': OfficialAgentIds.ORGANIZATION_MINISTRY,
  'topology': OfficialAgentIds.ORGANIZATION_MINISTRY,
  
  // 文档与知识管理 -> 书记员
  'documentation': OfficialAgentIds.SECRETARY,
  'knowledge_management': OfficialAgentIds.SECRETARY,
  'record': OfficialAgentIds.SECRETARY,
  'archive': OfficialAgentIds.SECRETARY,
  'history': OfficialAgentIds.SECRETARY,
  'summary': OfficialAgentIds.SECRETARY,
  
  // 协调与复杂任务 -> 内阁总理
  'coordination': OfficialAgentIds.PRIME_MINISTER,
  'complex': OfficialAgentIds.PRIME_MINISTER,
  'strategic': OfficialAgentIds.PRIME_MINISTER,
  'multi_agent': OfficialAgentIds.PRIME_MINISTER,
  'conflict_resolution': OfficialAgentIds.PRIME_MINISTER,
  
  // 入口与路由任务 -> 办公厅主任
  'gateway': OfficialAgentIds.OFFICE_DIRECTOR,
  'routing': OfficialAgentIds.OFFICE_DIRECTOR,
  'intent_recognition': OfficialAgentIds.OFFICE_DIRECTOR,
  'complexity_assessment': OfficialAgentIds.OFFICE_DIRECTOR,
  
  // 通用领域 -> 默认Agent
  'general': OfficialAgentIds.DEFAULT_AGENT,
  'default': OfficialAgentIds.DEFAULT_AGENT,
  'unknown': OfficialAgentIds.DEFAULT_AGENT,
};

/**
 * Agent能力矩阵
 * 定义每个Agent的核心能力和适用场景
 */
export const AgentCapabilityMatrix: Record<AgentId, {
  primaryCapabilities: string[];
  secondaryCapabilities: string[];
  complexityRange: [number, number]; // 处理的复杂度范围 (1-10)
  constitutionalFocus: string[]; // 重点关注的宪法条款
}> = {
  [OfficialAgentIds.OFFICE_DIRECTOR]: {
    primaryCapabilities: ['意图识别', '复杂度评估', '智能路由', '宪法预检查'],
    secondaryCapabilities: ['对话记录', '知识归档', '简单任务处理'],
    complexityRange: [1, 7], // 办公厅主任处理复杂度1-7的任务
    constitutionalFocus: ['§102.3', '§141', '§109'],
  },
  
  [OfficialAgentIds.PRIME_MINISTER]: {
    primaryCapabilities: ['战略协调', '冲突仲裁', '资源调配', '宪法监督'],
    secondaryCapabilities: ['多Agent协作', '风险缓解', '绩效评估'],
    complexityRange: [7, 10], // 内阁总理处理复杂度7-10的复杂任务
    constitutionalFocus: ['§152', '§141', '§110', '§125'],
  },
  
  [OfficialAgentIds.SUPERVISION_MINISTRY]: {
    primaryCapabilities: ['宪法解释', '合规检查', '法律风险分析', '条款验证'],
    secondaryCapabilities: ['规则制定', '审计支持', '争议解决'],
    complexityRange: [3, 9],
    constitutionalFocus: ['§100-§199'], // 关注所有宪法条款
  },
  
  [OfficialAgentIds.TECHNOLOGY_MINISTRY]: {
    primaryCapabilities: ['代码生成', '技术分析', '可行性评估', '实施计划'],
    secondaryCapabilities: ['系统集成', '性能优化', '技术选型'],
    complexityRange: [2, 8],
    constitutionalFocus: ['§300-§399'], // 关注技术法条款
  },
  
  [OfficialAgentIds.ORGANIZATION_MINISTRY]: {
    primaryCapabilities: ['架构设计', '图谱分析', '关系映射', '技术治理'],
    secondaryCapabilities: ['系统扩展', '模式识别', '架构评估'],
    complexityRange: [4, 9],
    constitutionalFocus: ['§340-§349'], // 关注架构相关条款
  },
  
  [OfficialAgentIds.SECRETARY]: {
    primaryCapabilities: ['历史管理', '摘要生成', '知识提取', '文档归档'],
    secondaryCapabilities: ['信息检索', '记录整理', '报告生成'],
    complexityRange: [1, 5],
    constitutionalFocus: ['§186', '§215'], // 关注知识和记录相关条款
  },
  
  [OfficialAgentIds.DEFAULT_AGENT]: {
    primaryCapabilities: ['通用查询', '基本信息提供', '简单指导'],
    secondaryCapabilities: ['基础支持', '常见问题解答'],
    complexityRange: [1, 3],
    constitutionalFocus: ['§160'], // 关注用户主权
  },
  
  [OfficialAgentIds.SYSTEM_ADMIN]: {
    primaryCapabilities: ['系统监控', '性能管理', '故障排查', '资源分配'],
    secondaryCapabilities: ['备份恢复', '安全审计', '配置管理'],
    complexityRange: [5, 10],
    constitutionalFocus: ['§190', '§381'], // 关注网络韧性和安全
  },
};

/**
 * 旧术语到新术语的兼容性映射
 * 宪法依据: §102.3宪法同步公理 - 支持渐进式迁移
 * 
 * 保留旧术语支持，确保向后兼容性
 */
export const LegacyTerminologyMapping: Record<string, AgentId> = {
  // 办公厅主任相关
  'agent:office_director': OfficialAgentIds.OFFICE_DIRECTOR,
  'office_director': OfficialAgentIds.OFFICE_DIRECTOR,
  
  // 内阁总理相关
  'agent:prime_minister': OfficialAgentIds.PRIME_MINISTER,
  'prime_minister': OfficialAgentIds.PRIME_MINISTER,
  
  // 专业Agent旧术语映射
  'agent:legal_expert': OfficialAgentIds.SUPERVISION_MINISTRY,
  'legal_expert': OfficialAgentIds.SUPERVISION_MINISTRY,
  'agent:programmer': OfficialAgentIds.TECHNOLOGY_MINISTRY,
  'programmer': OfficialAgentIds.TECHNOLOGY_MINISTRY,
  'agent:architect': OfficialAgentIds.ORGANIZATION_MINISTRY,
  'architect': OfficialAgentIds.ORGANIZATION_MINISTRY,
  'agent:secretary': OfficialAgentIds.SECRETARY, // 保持不变
  
  // 其他旧术语
  'agent:default': OfficialAgentIds.DEFAULT_AGENT,
  'agent:system_admin': OfficialAgentIds.SYSTEM_ADMIN,
};

/**
 * 术语统一工具函数
 * 提供术语转换和验证功能
 */
export class TerminologyUnifier {
  /**
   * 将任意Agent标识符转换为官方Agent ID
   * 支持旧术语、专业领域、描述性名称等多种输入
   * 
   * @param identifier 任意Agent标识符
   * @returns 官方Agent ID，如果无法识别则返回默认Agent
   */
  static toOfficialAgentId(identifier: string): AgentId {
    // 1. 检查是否为官方Agent ID
    if (Object.values(OfficialAgentIds).includes(identifier as AgentId)) {
      return identifier as AgentId;
    }
    
    // 2. 检查是否为旧术语
    if (identifier in LegacyTerminologyMapping) {
      return LegacyTerminologyMapping[identifier];
    }
    
    // 3. 检查是否为专业领域
    if (identifier.toLowerCase() in ExpertiseToAgentMapping) {
      return ExpertiseToAgentMapping[identifier.toLowerCase()];
    }
    
    // 4. 尝试模糊匹配专业领域
    const lowerIdentifier = identifier.toLowerCase();
    for (const [expertise, agentId] of Object.entries(ExpertiseToAgentMapping)) {
      if (lowerIdentifier.includes(expertise)) {
        return agentId;
      }
    }
    
    // 5. 检查是否为Agent名称
    for (const [agentId, name] of Object.entries(AgentNameMapping)) {
      if (name === identifier || name.includes(identifier)) {
        return agentId as AgentId;
      }
    }
    
    // 6. 默认返回默认Agent
    return OfficialAgentIds.DEFAULT_AGENT;
  }
  
  /**
   * 获取Agent的中文名称
   * 
   * @param agentId 官方Agent ID
   * @returns Agent中文名称
   */
  static getAgentName(agentId: AgentId): string {
    return AgentNameMapping[agentId] || '未知Agent';
  }
  
  /**
   * 验证Agent ID是否为有效的官方Agent ID
   * 
   * @param agentId 待验证的Agent ID
   * @returns 是否为有效的官方Agent ID
   */
  static isValidAgentId(agentId: string): boolean {
    return Object.values(OfficialAgentIds).includes(agentId as AgentId);
  }
  
  /**
   * 获取所有官方Agent ID列表
   * 
   * @returns 所有官方Agent ID数组
   */
  static getAllOfficialAgentIds(): AgentId[] {
    return Object.values(OfficialAgentIds);
  }
  
  /**
   * 根据复杂度推荐处理Agent
   * 宪法依据: §110协作效率公理 - 优化任务分配
   * 
   * @param complexity 任务复杂度 (1-10)
   * @returns 推荐的Agent ID
   */
  static recommendAgentByComplexity(complexity: number): AgentId {
    // 确保复杂度在1-10范围内
    const normalizedComplexity = Math.max(1, Math.min(10, complexity));
    
    if (normalizedComplexity <= 3) {
      return OfficialAgentIds.SECRETARY; // 低复杂度任务由书记员处理
    } else if (normalizedComplexity <= 7) {
      return OfficialAgentIds.OFFICE_DIRECTOR; // 中等复杂度由办公厅主任处理
    } else {
      return OfficialAgentIds.PRIME_MINISTER; // 高复杂度由内阁总理处理
    }
  }
  
  /**
   * 计算术语统一带来的熵减值
   * 宪法依据: §141熵减验证公理
   * 
   * 数学公式: $\Delta H = H_{\text{before}} - H_{\text{after}}$
   * 
   * @param beforeCount 统一前的术语数量
   * @param afterCount 统一后的术语数量
   * @returns 熵减值 $\Delta H$
   */
  static calculateEntropyReduction(beforeCount: number, afterCount: number): number {
    if (beforeCount <= 0 || afterCount <= 0) {
      return 0;
    }
    
    // 香农熵简化计算: H = -log2(p)
    const pBefore = 1 / beforeCount;
    const pAfter = 1 / afterCount;
    
    const hBefore = -Math.log2(pBefore);
    const hAfter = -Math.log2(pAfter);
    
    return hBefore - hAfter;
  }
}

/**
 * 术语统一宪法合规验证
 * 宪法依据: §156三级司法验证协议
 */
export function verifyTerminologyConstitutionalCompliance(): {
  tier1: { status: 'pass' | 'fail'; message: string };
  tier2: { status: 'pass' | 'fail'; message: string };
  tier3: { status: 'pass' | 'fail'; message: string };
  overall: 'compliant' | 'partial' | 'non-compliant';
  entropyReduction: number;
} {
  // 初始化结果对象 - 使用正确的类型注解
  const results: {
    tier1: { status: 'pass' | 'fail'; message: string };
    tier2: { status: 'pass' | 'fail'; message: string };
    tier3: { status: 'pass' | 'fail'; message: string };
    overall: 'compliant' | 'partial' | 'non-compliant';
    entropyReduction: number;
  } = {
    tier1: { status: 'pass' as const, message: '术语体系结构验证通过' },
    tier2: { status: 'pass' as const, message: '术语引用完整性验证通过' },
    tier3: { status: 'pass' as const, message: '术语行为一致性验证通过' },
    overall: 'compliant' as const,
    entropyReduction: 0.18, // 预计熵减值
  };
  
  // Tier 1验证: 结构完整性
  const allAgentIds = Object.values(OfficialAgentIds);
  const uniqueAgentIds = new Set(allAgentIds);
  
  if (allAgentIds.length !== uniqueAgentIds.size) {
    results.tier1 = { status: 'fail', message: '存在重复的Agent ID定义' };
    results.overall = 'partial';
  }
  
  // Tier 2验证: 映射完整性
  const allExpertises = Object.keys(ExpertiseToAgentMapping);
  const missingMappings = ['legal', 'programming', 'architecture', 'documentation']
    .filter(expertise => !allExpertises.includes(expertise));
  
  if (missingMappings.length > 0) {
    results.tier2 = { status: 'fail', message: `缺少关键专业领域映射: ${missingMappings.join(', ')}` };
    results.overall = 'partial';
  }
  
  // Tier 3验证: 行为一致性
  const allMappedAgentIds = Object.values(ExpertiseToAgentMapping);
  const invalidAgentIds = allMappedAgentIds.filter(id => !TerminologyUnifier.isValidAgentId(id));
  
  if (invalidAgentIds.length > 0) {
    results.tier3 = { status: 'fail', message: `映射中存在无效的Agent ID: ${invalidAgentIds.join(', ')}` };
    results.overall = 'partial';
  }
  
  // 计算实际熵减值
  const beforeCount = Object.keys(LegacyTerminologyMapping).length;
  const afterCount = uniqueAgentIds.size;
  results.entropyReduction = TerminologyUnifier.calculateEntropyReduction(beforeCount, afterCount);
  
  return results;
}

// 默认导出
export default {
  OfficialAgentIds,
  AgentNameMapping,
  ExpertiseToAgentMapping,
  AgentCapabilityMatrix,
  LegacyTerminologyMapping,
  TerminologyUnifier,
  verifyTerminologyConstitutionalCompliance,
};