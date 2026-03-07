import fs from 'node:fs';
import path from 'node:path';
import { createDecisionController } from '../server/gateway/openclaw-decision/controller';
import { createDefaultDecisionRequest, type DecisionMode } from '../server/gateway/openclaw-decision/contracts/decision-contract';
import { GrayscaleManager } from '../server/gateway/openclaw-decision/config/grayscale-config';
import { DEFAULT_RULES } from '../server/gateway/openclaw-decision/policy/policy-rules';

interface RolloutStage {
  name: string;
  mode: DecisionMode;
  trafficPercent: number;
}

interface RolloutStageResult {
  name: string;
  mode: DecisionMode;
  targetTrafficPercent: number;
  observedTrafficPercent: number;
  totalRequests: number;
  gatedRequests: number;
  bypassRequests: number;
  executeCount: number;
  rejectCount: number;
  errorCount: number;
  pass: boolean;
}

interface RolloutReport {
  generatedAt: string;
  status: 'PASS' | 'FAIL';
  stages: RolloutStageResult[];
}

const STAGES: RolloutStage[] = [
  { name: 'SHADOW', mode: 'SHADOW', trafficPercent: 100 },
  { name: 'ENFORCE-10', mode: 'ENFORCE', trafficPercent: 10 },
  { name: 'ENFORCE-50', mode: 'ENFORCE', trafficPercent: 50 },
  { name: 'ENFORCE-100', mode: 'ENFORCE', trafficPercent: 100 },
];

const TOTAL_REQUESTS = Number(process.env.PHASE15_ROLLOUT_REQUESTS || 1000);

async function runStage(stage: RolloutStage): Promise<RolloutStageResult> {
  const controller = createDecisionController({
    serviceConfig: {
      mode: stage.mode,
      rules: DEFAULT_RULES,
      enableAudit: false,
    },
    enableAuditLog: false,
  });

  const grayscale = new GrayscaleManager({
    stage: 'production',
    percentage: stage.trafficPercent,
    autoRollback: false,
  });

  let gatedRequests = 0;
  let bypassRequests = 0;
  let executeCount = 0;
  let rejectCount = 0;
  let errorCount = 0;

  for (let i = 0; i < TOTAL_REQUESTS; i++) {
    const connId = `phase15-${stage.name}-${i}`;
    const gated = stage.mode === 'SHADOW' ? true : grayscale.shouldEnableDecision(connId);

    if (!gated) {
      bypassRequests++;
      executeCount++;
      continue;
    }

    gatedRequests++;

    try {
      const request = createDefaultDecisionRequest('dangerous.execute', { dryRun: true });
      const response = await controller.handleDecision(request);
      if (response.action === 'REJECT') {
        rejectCount++;
      } else if (response.action === 'EXECUTE') {
        executeCount++;
      } else {
        errorCount++;
      }
    } catch {
      errorCount++;
    }
  }

  const observedTrafficPercent = (gatedRequests / TOTAL_REQUESTS) * 100;
  const trafficDrift = Math.abs(observedTrafficPercent - stage.trafficPercent);
  const errorRate = (errorCount / TOTAL_REQUESTS) * 100;
  const expectedReject = stage.mode === 'ENFORCE' ? gatedRequests : 0;
  const rejectMatch = rejectCount === expectedReject;
  const pass = errorRate < 0.1 && trafficDrift <= 3 && rejectMatch;

  return {
    name: stage.name,
    mode: stage.mode,
    targetTrafficPercent: stage.trafficPercent,
    observedTrafficPercent: Number(observedTrafficPercent.toFixed(2)),
    totalRequests: TOTAL_REQUESTS,
    gatedRequests,
    bypassRequests,
    executeCount,
    rejectCount,
    errorCount,
    pass,
  };
}

async function main(): Promise<void> {
  const stageResults: RolloutStageResult[] = [];
  for (const stage of STAGES) {
    stageResults.push(await runStage(stage));
  }

  const report: RolloutReport = {
    generatedAt: new Date().toISOString(),
    status: stageResults.every((stage) => stage.pass) ? 'PASS' : 'FAIL',
    stages: stageResults,
  };

  const reportDir = path.join(process.cwd(), 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, 'phase15-grayscale-rollout.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log(`phase15 grayscale report: ${reportPath}`);
  console.log(`status: ${report.status}`);

  if (report.status !== 'PASS') {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(String(error));
  process.exit(1);
});
