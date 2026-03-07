/**
 * 🚀 EntropyService模块
 * 
 * @constitution
 * §101 同步公理：代码变更必须触发文档更新
 * §102 熵减原则：所有变更必须降低或维持系统熵值
 * §107 通信安全公理：私聊消息必须加密，公开消息需身份验证
 * §108 异构模型策略：必须支持多LLM提供商，避免单点依赖
 * §110 协作效率公理：Agent响应时间必须控制在合理范围内
 * §152 单一真理源公理：知识库文件是可执行规范的唯一真理源
 * §306 零停机协议：在生产级开发任务中确保服务连续性
 * §504 监控系统公理：系统必须实时监控宪法合规状态和性能指标
 * §505 熵值计算公理：系统必须实时计算和监控认知熵值
 * §506 成本透视公理：所有LLM调用必须实时追踪成本和性能
 * 
 * @filename EntropyService.ts
 * @version 1.0.0
 * @category gateway
 * @last_updated 2026-02-11
 */
import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger';

export interface EntropyMetrics {
    sys: number;
    cog: number;
    struct: number;
}

export class EntropyService {
    private metrics: EntropyMetrics = {
        sys: 0.5,
        cog: 0.5,
        struct: 0.5
    };
    
    private rootDir: string;
    private memoryBankDir: string;

    constructor(
        rootDir: string = process.cwd(),
        memoryBankDir: string = path.join(process.cwd(), 'memory_bank')
    ) {
        this.rootDir = rootDir;
        this.memoryBankDir = memoryBankDir;
    }

    public getMetrics(): EntropyMetrics {
        return this.metrics;
    }

    public async calculate(): Promise<EntropyMetrics> {
        try {
            // H_struct: Directory structure complexity
            const fileCount = this.countFiles(this.rootDir);
            const structEntropy = Math.min(1.0, fileCount / 1000); // Normalize 1000 files as 1.0

            // H_cog: Cognitive load (active context size)
            const contextFile = path.join(this.memoryBankDir, 't0_core', 'active_context.md');
            let contextSize = 0;
            if (fs.existsSync(contextFile)) {
                contextSize = fs.statSync(contextFile).size;
            }
            const cogEntropy = Math.min(1.0, contextSize / 10000); // 10KB as 1.0

            // H_sys: Weighted average
            const sysEntropy = (cogEntropy * 0.4) + (structEntropy * 0.3) + (0.3); // Base 0.3 alignment

            this.metrics = {
                sys: Number(sysEntropy.toFixed(2)),
                cog: Number(cogEntropy.toFixed(2)),
                struct: Number(structEntropy.toFixed(2))
            };

            logger.debug(`[Monitor] Entropy Updated: Sys=${this.metrics.sys}`);
            
            return this.metrics;

        } catch (error) {
            logger.error(`[Monitor] Entropy calculation failed: ${error}`);
            return this.metrics; // Return last known good state
        }
    }

    private countFiles(dir: string): number {
        let count = 0;
        try {
            const list = fs.readdirSync(dir);
            list.forEach(file => {
                if (file === 'node_modules' || file === '.git') return;
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);
                if (stat && stat.isDirectory()) {
                    count += this.countFiles(filePath);
                } else {
                    count++;
                }
            });
        } catch (e) {
            // Ignore access errors
        }
        return count;
    }
}
