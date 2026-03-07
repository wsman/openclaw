/**
 * 🚀 CostTracker模块
 * 
 * @constitution
 * §101 同步公理：代码变更必须触发文档更新
 * §102 熵减原则：所有变更必须降低或维持系统熵值
 * §107 通信安全公理：私聊消息必须加密，公开消息需身份验证
 * §108 异构模型策略：必须支持多LLM提供商，避免单点依赖
 * §110 协作效率公理：Agent响应时间必须控制在合理范围内
 * §152 单一真理源公理：知识库文件是可执行规范的唯一真理源
 * §192 模型选择器公理：必须根据任务复杂度动态选择最优LLM模型
 * §193 模型选择器更新公理：模型选择器必须持续学习并适应性能变化
 * §306 零停机协议：在生产级开发任务中确保服务连续性
 * §504 监控系统公理：系统必须实时监控宪法合规状态和性能指标
 * §505 熵值计算公理：系统必须实时计算和监控认知熵值
 * §506 成本透视公理：所有LLM调用必须实时追踪成本和性能
 * 
 * @filename CostTracker.ts
 * @version 1.0.0
 * @category gateway
 * @last_updated 2026-02-11
 */
import { logger } from '../../utils/logger';

export interface CostReport {
    totalTokens: number;
    estimatedCost: number;
    modelUsage: Record<string, number>;
}

const MODEL_PRICING: Record<string, { input: number, output: number }> = {
    'gpt-4o': { input: 0.005, output: 0.015 }, // Per 1K
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    'gemini-pro': { input: 0.000125, output: 0.000375 },
    'gemini-flash': { input: 0.000075, output: 0.0003 }, // Tier 1
    'minimax-abab6': { input: 0.001, output: 0.001 } // Estimated
};

export class CostTracker {
    private report: CostReport = {
        totalTokens: 0,
        estimatedCost: 0,
        modelUsage: {}
    };

    public track(model: string, inputTokens: number, outputTokens: number): void {
        const total = inputTokens + outputTokens;
        
        // Update total
        this.report.totalTokens += total;
        
        // Update usage
        if (!this.report.modelUsage[model]) {
            this.report.modelUsage[model] = 0;
        }
        this.report.modelUsage[model] += total;

        // Calculate cost
        const pricing = MODEL_PRICING[model] || MODEL_PRICING['gpt-3.5-turbo']; // Default fallback
        const cost = (inputTokens / 1000 * pricing.input) + (outputTokens / 1000 * pricing.output);
        this.report.estimatedCost += cost;

        logger.debug(`[Monitor] Cost Tracked: ${model} (${inputTokens}/${outputTokens}) -> $${cost.toFixed(6)}`);
    }

    public getReport(): CostReport {
        // Return rounded values for display
        return {
            totalTokens: this.report.totalTokens,
            estimatedCost: Number(this.report.estimatedCost.toFixed(4)),
            modelUsage: this.report.modelUsage
        };
    }
}
