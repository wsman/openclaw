/**
 * 🚀 回滚演练脚本
 *
 * 用于测试灰度发布回滚机制。
 *
 * @constitution
 * §101 同步公理：回滚演练需与灰度配置同步
 * §102 熵减原则：集中维护回滚流程
 * §152 单一真理源公理：此文件为回滚演练脚本
 *
 * @filename rollback-drill.ts
 * @version 1.0.0
 * @category gateway/openclaw-decision/scripts
 * @last_updated 2026-03-02
 */

import {
  GrayscaleManager,
  GrayscaleStage,
  getGrayscaleManager,
  resetGrayscaleManager,
} from '../config/grayscale-config';
import {
  CircuitBreaker,
  getCircuitBreakerManager,
} from '../resilience/circuit-breaker';
import {
  getDecisionController,
  resetDecisionController,
} from '../controller';

// ============================================================================
// 演练结果
// ============================================================================

export interface DrillResult {
  /** 演练名称 */
  name: string;
  /** 是否成功 */
  success: boolean;
  /** 开始时间 */
  startTime: Date;
  /** 结束时间 */
  endTime: Date;
  /** 持续时间（毫秒） */
  duration: number;
  /** 演练详情 */
  details: Record<string, unknown>;
  /** 错误信息 */
  error?: string;
}

// ============================================================================
// 回滚演练类
// ============================================================================

/**
 * 回滚演练执行器
 */
export class RollbackDrill {
  private results: DrillResult[] = [];

  /**
   * 执行所有演练
   */
  async runAll(): Promise<DrillResult[]> {
    console.log('=== 开始回滚演练 ===');
    console.log(`时间: ${new Date().toISOString()}`);
    console.log('');

    // 重置所有状态
    this.resetAll();

    // 执行各项演练
    await this.runGrayscaleRollbackDrill();
    await this.runCircuitBreakerDrill();
    await this.runModeSwitchDrill();
    await this.runFullFlowDrill();

    // 输出总结
    this.printSummary();

    return this.results;
  }

  /**
   * 重置所有状态
   */
  private resetAll(): void {
    resetGrayscaleManager();
    resetDecisionController();
    getCircuitBreakerManager().resetAll();
  }

  /**
   * 演练1: 灰度回滚
   */
  private async runGrayscaleRollbackDrill(): Promise<void> {
    const startTime = new Date();
    const name = '灰度回滚演练';

    console.log(`\n>>> ${name}`);

    try {
      const manager = getGrayscaleManager({
        stage: 'production',
        percentage: 100,
        autoRollback: true,
        rollbackThreshold: 10,
        rollbackCooldown: 0, // 禁用冷却以便测试
      });

      // 模拟高错误率
      for (let i = 0; i < 100; i++) {
        manager.recordResult(i < 15); // 15% 错误率
      }

      const stats = manager.getStats();
      const success = stats.stage !== 'production';

      this.addResult({
        name,
        success,
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime.getTime(),
        details: {
          initialStage: 'production',
          finalStage: stats.stage,
          errorRate: stats.errorRate,
          triggeredRollback: success,
        },
      });

      console.log(`  ✓ 灰度阶段: production -> ${stats.stage}`);
      console.log(`  ✓ 错误率: ${stats.errorRate.toFixed(2)}%`);
    } catch (error) {
      this.addError(name, startTime, error);
    }
  }

  /**
   * 演练2: 断路器熔断
   */
  private async runCircuitBreakerDrill(): Promise<void> {
    const startTime = new Date();
    const name = '断路器熔断演练';

    console.log(`\n>>> ${name}`);

    try {
      const breakerManager = getCircuitBreakerManager();
      const breaker = breakerManager.getBreaker('test-breaker', {
        failureThreshold: 50,
        minimumRequests: 5,
        openDuration: 1000,
      });

      // 模拟失败
      for (let i = 0; i < 10; i++) {
        breaker.recordFailure();
      }

      const state = breaker.getState();
      const stats = breaker.getStats();
      const success = state === 'open' && !breaker.canExecute();

      this.addResult({
        name,
        success,
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime.getTime(),
        details: {
          state,
          failureRate: stats.failureRate,
          canExecute: breaker.canExecute(),
        },
      });

      console.log(`  ✓ 断路器状态: ${state}`);
      console.log(`  ✓ 失败率: ${stats.failureRate.toFixed(2)}%`);
      console.log(`  ✓ 可执行: ${breaker.canExecute()}`);
    } catch (error) {
      this.addError(name, startTime, error);
    }
  }

  /**
   * 演练3: 模式切换
   */
  private async runModeSwitchDrill(): Promise<void> {
    const startTime = new Date();
    const name = '模式切换演练';

    console.log(`\n>>> ${name}`);

    try {
      resetDecisionController();
      const controller = getDecisionController({ mode: 'OFF' });

      const modes: Array<'OFF' | 'SHADOW' | 'ENFORCE'> = ['OFF', 'SHADOW', 'ENFORCE'];
      const switchResults: Array<{ from: string; to: string; success: boolean }> = [];

      for (let i = 0; i < modes.length - 1; i++) {
        const from = modes[i];
        const to = modes[i + 1];
        controller.setMode(from);
        controller.setMode(to);
        switchResults.push({ from, to, success: controller.getMode() === to });
      }

      const success = switchResults.every(r => r.success);

      this.addResult({
        name,
        success,
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime.getTime(),
        details: {
          switches: switchResults,
          finalMode: controller.getMode(),
        },
      });

      console.log(`  ✓ 模式切换: ${switchResults.map(r => `${r.from}->${r.to}`).join(', ')}`);
      console.log(`  ✓ 最终模式: ${controller.getMode()}`);
    } catch (error) {
      this.addError(name, startTime, error);
    }
  }

  /**
   * 演练4: 完整流程
   */
  private async runFullFlowDrill(): Promise<void> {
    const startTime = new Date();
    const name = '完整流程演练';

    console.log(`\n>>> ${name}`);

    try {
      // 重置状态
      this.resetAll();

      // 设置灰度
      const grayscaleManager = getGrayscaleManager({
        stage: 'beta',
        percentage: 10,
      });

      // 设置断路器
      const breakerManager = getCircuitBreakerManager();
      const breaker = breakerManager.getBreaker('decision-service');

      // 设置控制器
      const controller = getDecisionController({ mode: 'SHADOW' });

      // 模拟请求
      const requests = 100;
      let successCount = 0;
      let rejectCount = 0;

      for (let i = 0; i < requests; i++) {
        const connId = `conn-${i}`;
        const shouldEnable = grayscaleManager.shouldEnableDecision(connId);

        if (shouldEnable && breaker.canExecute()) {
          // 模拟决策
          const healthCheck = await controller.healthCheck();
          if (healthCheck.status === 'healthy') {
            successCount++;
            grayscaleManager.recordResult(true);
          } else {
            rejectCount++;
            grayscaleManager.recordResult(false);
          }
        } else {
          rejectCount++;
        }
      }

      const success = successCount > 0;

      this.addResult({
        name,
        success,
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime.getTime(),
        details: {
          totalRequests: requests,
          successCount,
          rejectCount,
          grayscaleStage: grayscaleManager.getConfig().stage,
          controllerMode: controller.getMode(),
          breakerState: breaker.getState(),
        },
      });

      console.log(`  ✓ 总请求: ${requests}`);
      console.log(`  ✓ 成功: ${successCount}`);
      console.log(`  ✓ 拒绝: ${rejectCount}`);
    } catch (error) {
      this.addError(name, startTime, error);
    }
  }

  /**
   * 添加结果
   */
  private addResult(result: DrillResult): void {
    this.results.push(result);
    console.log(`  ✓ 演练成功: ${result.name}`);
  }

  /**
   * 添加错误
   */
  private addError(name: string, startTime: Date, error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    this.results.push({
      name,
      success: false,
      startTime,
      endTime: new Date(),
      duration: Date.now() - startTime.getTime(),
      details: {},
      error: errorMessage,
    });
    console.log(`  ✗ 演练失败: ${name} - ${errorMessage}`);
  }

  /**
   * 输出总结
   */
  private printSummary(): void {
    console.log('\n=== 演练总结 ===');
    console.log(`总演练数: ${this.results.length}`);
    console.log(`成功: ${this.results.filter(r => r.success).length}`);
    console.log(`失败: ${this.results.filter(r => !r.success).length}`);
    console.log(`总耗时: ${this.results.reduce((sum, r) => sum + r.duration, 0)}ms`);
    console.log('');

    // 输出详细结果
    console.log('详细结果:');
    for (const result of this.results) {
      const status = result.success ? '✓' : '✗';
      console.log(`  ${status} ${result.name} (${result.duration}ms)`);
      if (result.error) {
        console.log(`    错误: ${result.error}`);
      }
    }
  }
}

// ============================================================================
// CLI 入口
// ============================================================================

/**
 * 运行回滚演练
 */
export async function runRollbackDrill(): Promise<DrillResult[]> {
  const drill = new RollbackDrill();
  return drill.runAll();
}

// 如果直接运行此脚本
if (require.main === module) {
  runRollbackDrill()
    .then(results => {
      const allSuccess = results.every(r => r.success);
      process.exit(allSuccess ? 0 : 1);
    })
    .catch(error => {
      console.error('演练执行失败:', error);
      process.exit(1);
    });
}
