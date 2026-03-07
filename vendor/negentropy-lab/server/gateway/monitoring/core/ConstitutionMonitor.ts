/**
 * 📊 宪法监控模块 - Constitution Monitor
 *
 * 宪法依据:
 * - §101 同步公理 - 代码与注解必须原子性同步
 * - §102 熵减原则 - 降低系统熵值，规范化宪法检查
 * - §106 人才把关原则 - 质量检验，确保宪法合规
 * - §151 持久化原则 - 宪法检查结果写入文件
 * - §306 零停机协议 - 实时监控不影响服务运行
 *
 * 功能:
 * - 监控宪法指标评分
 * - 追踪宪法违规数量
 * - 定期扫描宪法合规性
 * - 提供宪法合规报告
 *
 * @维护者 科技部
 * @最后更新 2026-02-12
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger';

export interface ConstitutionMetrics {
    score: number;
    violationCount: number;
    violations: string[];
    lastScan: number;
}

const CRITICAL_AXIOMS = ['§101', '§102', '§152', '§306'];

export class ConstitutionMonitor {
    private metrics: ConstitutionMetrics = {
        score: 100,
        violationCount: 0,
        violations: [],
        lastScan: 0
    };
    
    private scanInterval: any = null; // Type safety fix
    private rootDir: string;

    constructor(rootDir: string = path.join(process.cwd(), 'server', 'gateway')) {
        this.rootDir = rootDir;
    }

    public start(intervalMs = 600000): void { // Default 10min
        if (this.scanInterval) clearInterval(this.scanInterval);
        this.scan(); // Initial scan
        this.scanInterval = setInterval(() => this.scan(), intervalMs);
        logger.info('[Monitor] Constitution Monitor started');
    }

    public stop(): void {
        if (this.scanInterval) clearInterval(this.scanInterval);
    }

    public getMetrics(): ConstitutionMetrics {
        return this.metrics;
    }

    public async scan(): Promise<void> { // Ensure public
        try {
            const files = this.getAllTsFiles(this.rootDir);
            const violations: string[] = [];
            let compliantCount = 0;

            for (const file of files) {
                const content = fs.readFileSync(file, 'utf-8');
                const relativePath = path.relative(process.cwd(), file);
                
                // Check for File Header with @constitution
                const hasHeader = /\/\*\*[\s\S]*?@constitution[\s\S]*?\*\//.test(content);
                // Check for critical axioms
                const hasAxioms = CRITICAL_AXIOMS.some(axiom => content.includes(axiom));

                if (hasHeader || hasAxioms) {
                    compliantCount++;
                } else {
                    violations.push(relativePath);
                }
            }

            const total = files.length;
            this.metrics = {
                score: total > 0 ? (compliantCount / total) * 100 : 100,
                violationCount: violations.length,
                violations: violations.slice(0, 10), // Limit list size
                lastScan: Date.now()
            };

            logger.info(`[Monitor] Constitution Scan: ${this.metrics.score.toFixed(1)}% (${compliantCount}/${total})`);
            
            if (this.metrics.score < 90) {
                logger.warn(`[Monitor] Critical Compliance Alert: Score < 90% (${this.metrics.score.toFixed(1)}%)`);
            }

        } catch (error) {
            logger.error(`[Monitor] Constitution Scan failed: ${(error as Error).message}`);
        }
    }

    private getAllTsFiles(dir: string): string[] {
        let results: string[] = [];
        try {
            const list = fs.readdirSync(dir);
            list.forEach(file => {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);
                if (stat && stat.isDirectory()) {
                    results = results.concat(this.getAllTsFiles(filePath));
                } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
                    results.push(filePath);
                }
            });
        } catch (e) {
            // Directory might not exist yet during init
        }
        return results;
    }
}
