import fs from 'node:fs';
import path from 'node:path';
import { getDecisionController, resetDecisionController } from '../server/gateway/openclaw-decision/controller';
import { getGrayscaleManager, resetGrayscaleManager } from '../server/gateway/openclaw-decision/config/grayscale-config';
import { getCircuitBreakerManager } from '../server/gateway/openclaw-decision/resilience/circuit-breaker';

interface ScenarioResult {
  name: string;
  pass: boolean;
  details: Record<string, unknown>;
}

interface FaultInjectionReport {
  generatedAt: string;
  status: 'PASS' | 'FAIL';
  scenarios: ScenarioResult[];
}

function runCircuitBreakerScenario(): ScenarioResult {
  const manager = getCircuitBreakerManager();
  manager.resetAll();
  const breaker = manager.getBreaker('phase15-fault', {
    failureThreshold: 50,
    minimumRequests: 5,
    openDuration: 30_000,
  });

  for (let i = 0; i < 10; i++) {
    breaker.recordFailure();
  }

  const state = breaker.getState();
  const canExecute = breaker.canExecute();
  return {
    name: 'circuit-breaker-open',
    pass: state === 'open' && canExecute === false,
    details: { state, canExecute },
  };
}

function runGrayscaleRollbackScenario(): ScenarioResult {
  resetGrayscaleManager();
  const manager = getGrayscaleManager({
    stage: 'production',
    percentage: 100,
    autoRollback: true,
    rollbackThreshold: 10,
    rollbackCooldown: 0,
  });

  for (let i = 0; i < 200; i++) {
    manager.recordResult(i >= 30); // 15% failure, should trigger rollback
  }

  const stats = manager.getStats();
  return {
    name: 'grayscale-auto-rollback',
    pass: stats.stage !== 'production',
    details: {
      stage: stats.stage,
      percentage: stats.percentage,
      errorRate: stats.errorRate,
    },
  };
}

function runEmergencyModeRollbackScenario(): ScenarioResult {
  resetDecisionController();
  const controller = getDecisionController({ mode: 'ENFORCE' });
  controller.setMode('OFF');
  const mode = controller.getMode();
  return {
    name: 'emergency-mode-rollback',
    pass: mode === 'OFF',
    details: { mode },
  };
}

function main(): void {
  const scenarios: ScenarioResult[] = [
    runCircuitBreakerScenario(),
    runGrayscaleRollbackScenario(),
    runEmergencyModeRollbackScenario(),
  ];

  const report: FaultInjectionReport = {
    generatedAt: new Date().toISOString(),
    status: scenarios.every((item) => item.pass) ? 'PASS' : 'FAIL',
    scenarios,
  };

  const outputDir = path.join(process.cwd(), 'reports');
  fs.mkdirSync(outputDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const output = path.join(outputDir, `ops-fault-injection-${ts}.json`);
  fs.writeFileSync(output, JSON.stringify(report, null, 2), 'utf8');

  console.log(`ops fault injection report: ${output}`);
  console.log(`status: ${report.status}`);

  if (report.status !== 'PASS') {
    process.exit(1);
  }
}

main();
