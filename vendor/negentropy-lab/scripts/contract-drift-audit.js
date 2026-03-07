#!/usr/bin/env node
/**
 * 契约漂移审计脚本（Phase 7 / RPC-73）
 *
 * 读取 contract-count-report.json，输出漂移审计报告，供 CI/nightly 留痕。
 */

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {
    enforce: false,
    input: 'reports/contract-count-report.json',
    output: 'reports/contract-drift-audit.json',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case '--enforce':
        args.enforce = true;
        break;
      case '--input':
        args.input = argv[i + 1] || args.input;
        i += 1;
        break;
      case '--output':
        args.output = argv[i + 1] || args.output;
        i += 1;
        break;
      default:
        break;
    }
  }

  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function inferMethodDomain(methodName) {
  if (!methodName || typeof methodName !== 'string') {
    return 'unknown';
  }
  const [dotPrefix] = methodName.split('.');
  const [hyphenPrefix] = dotPrefix.split('-');
  return hyphenPrefix || dotPrefix || 'unknown';
}

function countBy(items, keyFn) {
  const map = {};
  for (const item of items) {
    const key = keyFn(item);
    map[key] = (map[key] || 0) + 1;
  }
  return map;
}

function highestSeverity(issues) {
  if (issues.some((issue) => issue.severity === 'critical')) {
    return 'critical';
  }
  if (issues.some((issue) => issue.severity === 'high')) {
    return 'high';
  }
  if (issues.some((issue) => issue.severity === 'medium')) {
    return 'medium';
  }
  if (issues.some((issue) => issue.severity === 'low')) {
    return 'low';
  }
  return 'none';
}

function buildAudit(report) {
  const baselineRpc = Number(report?.baseline?.rpcCount || 0);
  const baselineEvent = Number(report?.baseline?.eventCount || 0);
  const actualRpc = Number(report?.contract?.rpcCount || 0);
  const actualEvent = Number(report?.contract?.eventCount || 0);
  const missingCount = Number(report?.implementation?.missingCanonicalCount || 0);
  const strictPass = Boolean(report?.compliance?.strictPass);
  const missingCanonicalMethods = Array.isArray(report?.missingCanonicalMethods)
    ? report.missingCanonicalMethods
    : [];
  const nonCanonicalRegisteredMethods = Array.isArray(report?.nonCanonicalRegisteredMethods)
    ? report.nonCanonicalRegisteredMethods
    : [];
  const aliasBackfilledMethods = Array.isArray(report?.aliasBackfilledMethods)
    ? report.aliasBackfilledMethods
    : [];

  const rpcDrift = actualRpc - baselineRpc;
  const eventDrift = actualEvent - baselineEvent;

  const issues = [];
  if (rpcDrift !== 0) {
    issues.push({
      code: 'RPC_COUNT_DRIFT',
      level: 'error',
      severity: Math.abs(rpcDrift) >= 3 ? 'critical' : 'high',
      message: `RPC count drifted: baseline=${baselineRpc}, actual=${actualRpc}`,
      count: Math.abs(rpcDrift),
    });
  }
  if (eventDrift !== 0) {
    issues.push({
      code: 'EVENT_COUNT_DRIFT',
      level: 'error',
      severity: Math.abs(eventDrift) >= 2 ? 'critical' : 'high',
      message: `Event count drifted: baseline=${baselineEvent}, actual=${actualEvent}`,
      count: Math.abs(eventDrift),
    });
  }
  if (missingCount > 0) {
    issues.push({
      code: 'CANONICAL_IMPLEMENTATION_GAP',
      level: 'error',
      severity: missingCount >= 5 ? 'critical' : 'high',
      message: `Canonical implementation gap: missing=${missingCount}`,
      count: missingCount,
      methods: missingCanonicalMethods,
    });
  }
  if (!strictPass) {
    issues.push({
      code: 'STRICT_GUARD_FAILED',
      level: 'error',
      severity: 'critical',
      message: 'Strict contract guard failed',
    });
  }

  const methodDomainBreakdown = countBy(missingCanonicalMethods, inferMethodDomain);
  const severity = highestSeverity(issues);
  const recommendations = [];

  if (issues.some((issue) => issue.code === 'STRICT_GUARD_FAILED')) {
    recommendations.push('先执行 npm run check:contract:strict 并修复阻断项，再进入 drift 审计。');
  }
  if (issues.some((issue) => issue.code === 'CANONICAL_IMPLEMENTATION_GAP')) {
    recommendations.push('按 methods 列表逐个补齐 canonical 方法实现或占位，并补充对应单测。');
  }
  if (issues.some((issue) => issue.code === 'RPC_COUNT_DRIFT' || issue.code === 'EVENT_COUNT_DRIFT')) {
    recommendations.push('确认是否为预期契约变更；若是，先更新基线文档与守护脚本再合并。');
  }
  if (recommendations.length === 0) {
    recommendations.push('维持 nightly + PR + release 三链路守护，持续监控 drift delta。');
  }

  return {
    timestamp: new Date().toISOString(),
    sourceReportTimestamp: report?.timestamp || null,
    severity,
    baseline: {
      rpcCount: baselineRpc,
      eventCount: baselineEvent,
    },
    actual: {
      rpcCount: actualRpc,
      eventCount: actualEvent,
      missingCanonicalCount: missingCount,
      strictPass,
    },
    drift: {
      rpcDelta: rpcDrift,
      eventDelta: eventDrift,
    },
    methodLevel: {
      missingCanonicalMethods,
      missingCanonicalDomainBreakdown: methodDomainBreakdown,
      nonCanonicalRegisteredMethods: nonCanonicalRegisteredMethods.slice(0, 100),
      aliasBackfilledMethods,
    },
    issues,
    recommendations,
    status: issues.length === 0 ? 'PASS' : 'FAIL',
  };
}

function writeGithubSummary(audit) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    return;
  }
  const lines = [
    '## Contract Drift Audit',
    '',
    `- status: **${audit.status}**`,
    `- severity: **${audit.severity}**`,
    `- rpc delta: ${audit.drift.rpcDelta}`,
    `- event delta: ${audit.drift.eventDelta}`,
    `- missing canonical: ${audit.actual.missingCanonicalCount}`,
    '',
  ];

  if (audit.issues.length > 0) {
    lines.push('### Issues');
    for (const issue of audit.issues) {
      const methods = Array.isArray(issue.methods) && issue.methods.length > 0
        ? ` (methods: ${issue.methods.slice(0, 8).join(', ')}${issue.methods.length > 8 ? ', ...' : ''})`
        : '';
      lines.push(`- [${issue.level.toUpperCase()}|${issue.severity.toUpperCase()}] ${issue.code}: ${issue.message}${methods}`);
    }
  } else {
    lines.push('No drift issues detected.');
  }

  fs.appendFileSync(summaryPath, `${lines.join('\n')}\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(process.cwd(), args.input);
  const outputPath = path.resolve(process.cwd(), args.output);

  if (!fs.existsSync(inputPath)) {
    console.error(`contract report not found: ${inputPath}`);
    process.exit(1);
  }

  const report = readJson(inputPath);
  const audit = buildAudit(report);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(audit, null, 2));

  console.log(`drift audit report: ${outputPath}`);
  console.log(`status: ${audit.status}`);
  if (audit.issues.length > 0) {
    for (const issue of audit.issues) {
      console.log(`- [${issue.level.toUpperCase()}] ${issue.code}: ${issue.message}`);
    }
  }

  writeGithubSummary(audit);

  if (args.enforce && audit.status !== 'PASS') {
    process.exit(1);
  }
}

main();
