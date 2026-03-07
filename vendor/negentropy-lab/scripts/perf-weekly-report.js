#!/usr/bin/env node
/**
 * 性能周报聚合脚本（Phase 6-3 / PERF-33）
 * 从 reports/ 下已有的 ws-soak/ws-perf-baseline 产物生成周报。
 */

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {
    enforce: false,
    reportsDir: 'reports',
    outputBase: 'reports/performance-weekly-report',
    lookbackDays: 7,
    maxPerfDurationSec: 120,
    minSoakPassRate: 1,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case '--enforce':
        args.enforce = true;
        break;
      case '--reports-dir':
        args.reportsDir = argv[i + 1] || args.reportsDir;
        i += 1;
        break;
      case '--output-base':
        args.outputBase = argv[i + 1] || args.outputBase;
        i += 1;
        break;
      case '--lookback-days':
        args.lookbackDays = Number(argv[i + 1] || args.lookbackDays);
        i += 1;
        break;
      case '--max-perf-duration-sec':
        args.maxPerfDurationSec = Number(argv[i + 1] || args.maxPerfDurationSec);
        i += 1;
        break;
      case '--min-soak-pass-rate':
        args.minSoakPassRate = Number(argv[i + 1] || args.minSoakPassRate);
        i += 1;
        break;
      default:
        break;
    }
  }

  return args;
}

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function toMs(value) {
  if (!value) return 0;
  const ms = Date.parse(value);
  if (Number.isFinite(ms)) return ms;

  // ws-soak started_at uses YYYYMMDD-HHMMSS
  const compact = String(value);
  const m = compact.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
  if (!m) return 0;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+08:00`;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : 0;
}

function listReports(reportsDir, prefix) {
  if (!fs.existsSync(reportsDir)) return [];
  return fs
    .readdirSync(reportsDir)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
    .map((name) => path.join(reportsDir, name));
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function evaluateThresholds({
  soakReports,
  soakPassRate,
  perfFail,
  latestPerfDurationSec,
  thresholds,
  alerts,
}) {
  const assessments = {
    soakPassRate: {
      actualPct: Number((soakPassRate * 100).toFixed(1)),
      expectedPct: Number((thresholds.minSoakPassRate * 100).toFixed(1)),
      state: 'pass',
    },
    latestPerfDuration: {
      actualSec: latestPerfDurationSec,
      maxAllowedSec: thresholds.maxPerfDurationSec,
      state: 'pass',
    },
    perfFailures: {
      count: perfFail,
      state: 'pass',
    },
  };

  if (soakReports.length > 0) {
    if (soakPassRate < thresholds.minSoakPassRate) {
      assessments.soakPassRate.state = 'fail';
    } else if (soakPassRate < Math.min(1, thresholds.minSoakPassRate + 0.05)) {
      assessments.soakPassRate.state = 'warn';
    }
  }

  if (latestPerfDurationSec !== null) {
    if (latestPerfDurationSec > thresholds.maxPerfDurationSec) {
      assessments.latestPerfDuration.state = 'fail';
    } else if (latestPerfDurationSec > thresholds.maxPerfDurationSec * 0.9) {
      assessments.latestPerfDuration.state = 'warn';
    }
  }

  if (perfFail > 0) {
    assessments.perfFailures.state = 'fail';
  }

  const errorCount = alerts.filter((a) => a.level === 'error').length;
  const warningCount = alerts.filter((a) => a.level === 'warning').length;
  let score = 100;
  score -= errorCount * 20;
  score -= warningCount * 5;
  if (assessments.soakPassRate.state === 'fail') score -= 15;
  if (assessments.latestPerfDuration.state === 'fail') score -= 15;
  if (assessments.perfFailures.state === 'fail') score -= 20;
  score = Math.max(0, score);

  let grade = 'A';
  if (score < 95) grade = 'B';
  if (score < 85) grade = 'C';
  if (score < 70) grade = 'D';

  return {
    score,
    grade,
    assessments,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const now = Date.now();
  const lookbackMs = args.lookbackDays * 24 * 60 * 60 * 1000;

  const soakFiles = listReports(args.reportsDir, 'ws-soak-');
  const perfFiles = listReports(args.reportsDir, 'ws-perf-baseline-');

  const soakReports = soakFiles
    .map((file) => ({ file, data: safeReadJson(file) }))
    .filter((item) => item.data)
    .map((item) => ({
      ...item,
      endedAtMs: toMs(item.data.ended_at || item.data.started_at),
    }))
    .filter((item) => item.endedAtMs >= now - lookbackMs)
    .sort((a, b) => a.endedAtMs - b.endedAtMs);

  const perfReports = perfFiles
    .map((file) => ({ file, data: safeReadJson(file) }))
    .filter((item) => item.data)
    .map((item) => ({
      ...item,
      endedAtMs: toMs(item.data.ended_at || item.data.started_at),
    }))
    .filter((item) => item.endedAtMs >= now - lookbackMs)
    .sort((a, b) => a.endedAtMs - b.endedAtMs);

  const soakPass = soakReports.filter((r) => r.data.status === 'PASS').length;
  const soakFail = soakReports.filter((r) => r.data.status !== 'PASS').length;
  const soakPassRate = soakReports.length === 0 ? 0 : soakPass / soakReports.length;

  const perfDurations = perfReports
    .map((r) => Number(r.data.duration_sec || 0))
    .filter((n) => Number.isFinite(n));
  const perfPass = perfReports.filter((r) => r.data.status === 'PASS').length;
  const perfFail = perfReports.filter((r) => r.data.status !== 'PASS').length;

  const latestSoak = soakReports[soakReports.length - 1] || null;
  const latestPerf = perfReports[perfReports.length - 1] || null;
  const latestPerfDurationSec = latestPerf ? Number(latestPerf.data.duration_sec || 0) : null;

  const alerts = [];
  if (soakReports.length === 0) {
    alerts.push({ level: 'warning', code: 'SOAK_REPORT_MISSING', message: '未找到最近窗口内的 soak 报告' });
  }
  if (perfReports.length === 0) {
    alerts.push({ level: 'warning', code: 'PERF_REPORT_MISSING', message: '未找到最近窗口内的 perf baseline 报告' });
  }
  if (soakReports.length > 0 && soakPassRate < args.minSoakPassRate) {
    alerts.push({
      level: 'error',
      code: 'SOAK_PASS_RATE_LOW',
      message: `soak 通过率低于阈值: ${(soakPassRate * 100).toFixed(1)}% < ${(args.minSoakPassRate * 100).toFixed(1)}%`,
    });
  }
  if (latestPerf && Number(latestPerf.data.duration_sec || 0) > args.maxPerfDurationSec) {
    alerts.push({
      level: 'error',
      code: 'PERF_DURATION_HIGH',
      message: `最新 baseline 耗时超阈值: ${latestPerf.data.duration_sec}s > ${args.maxPerfDurationSec}s`,
    });
  }
  if (perfFail > 0) {
    alerts.push({ level: 'error', code: 'PERF_FAIL_FOUND', message: `窗口内存在性能失败: ${perfFail}` });
  }

  const thresholdEvaluation = evaluateThresholds({
    soakReports,
    soakPassRate,
    perfFail,
    latestPerfDurationSec,
    thresholds: {
      maxPerfDurationSec: args.maxPerfDurationSec,
      minSoakPassRate: args.minSoakPassRate,
    },
    alerts,
  });

  const summary = {
    timestamp: new Date().toISOString(),
    lookbackDays: args.lookbackDays,
    thresholds: {
      maxPerfDurationSec: args.maxPerfDurationSec,
      minSoakPassRate: args.minSoakPassRate,
    },
    soak: {
      total: soakReports.length,
      pass: soakPass,
      fail: soakFail,
      passRate: Number((soakPassRate * 100).toFixed(1)),
      latest: latestSoak
        ? {
            file: path.basename(latestSoak.file),
            status: latestSoak.data.status,
            iterations: Number(latestSoak.data.iterations || 0),
          }
        : null,
    },
    perf: {
      total: perfReports.length,
      pass: perfPass,
      fail: perfFail,
      avgDurationSec: Number(average(perfDurations).toFixed(2)),
      latestDurationSec: latestPerfDurationSec,
      latest: latestPerf
        ? {
            file: path.basename(latestPerf.file),
            status: latestPerf.data.status,
          }
        : null,
    },
    thresholdEvaluation,
    alerts,
    status: alerts.some((a) => a.level === 'error') ? 'FAIL' : 'PASS',
  };

  const jsonPath = `${args.outputBase}.json`;
  const mdPath = `${args.outputBase}.md`;
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });

  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));

  const md = [
    '# 性能周报（自动生成）',
    '',
    `- 生成时间: ${summary.timestamp}`,
    `- 统计窗口: 最近 ${summary.lookbackDays} 天`,
    `- 状态: **${summary.status}**`,
    `- 阈值等级: **${summary.thresholdEvaluation.grade}** (score=${summary.thresholdEvaluation.score})`,
    '',
    '## Soak 结果',
    '',
    `- 总次数: ${summary.soak.total}`,
    `- 通过/失败: ${summary.soak.pass}/${summary.soak.fail}`,
    `- 通过率: ${summary.soak.passRate}%`,
    `- 最新报告: ${summary.soak.latest ? summary.soak.latest.file : 'N/A'}`,
    '',
    '## Baseline 结果',
    '',
    `- 总次数: ${summary.perf.total}`,
    `- 通过/失败: ${summary.perf.pass}/${summary.perf.fail}`,
    `- 平均耗时: ${summary.perf.avgDurationSec}s`,
    `- 最新耗时: ${summary.perf.latestDurationSec ?? 'N/A'}s`,
    `- 最新报告: ${summary.perf.latest ? summary.perf.latest.file : 'N/A'}`,
    '',
    '## 阈值评估',
    '',
    `- soak通过率: ${summary.thresholdEvaluation.assessments.soakPassRate.actualPct}% / 阈值${summary.thresholdEvaluation.assessments.soakPassRate.expectedPct}% (${summary.thresholdEvaluation.assessments.soakPassRate.state})`,
    `- latest baseline耗时: ${summary.thresholdEvaluation.assessments.latestPerfDuration.actualSec ?? 'N/A'}s / 阈值${summary.thresholdEvaluation.assessments.latestPerfDuration.maxAllowedSec}s (${summary.thresholdEvaluation.assessments.latestPerfDuration.state})`,
    `- 窗口内性能失败数: ${summary.thresholdEvaluation.assessments.perfFailures.count} (${summary.thresholdEvaluation.assessments.perfFailures.state})`,
    '',
    '## 告警',
    '',
    ...(summary.alerts.length > 0
      ? summary.alerts.map((a) => `- [${a.level.toUpperCase()}] ${a.code}: ${a.message}`)
      : ['- 无']),
    '',
  ].join('\n');

  fs.writeFileSync(mdPath, md);

  console.log(`weekly summary json: ${jsonPath}`);
  console.log(`weekly summary md: ${mdPath}`);
  console.log(`status: ${summary.status}`);

  if (args.enforce && summary.status !== 'PASS') {
    process.exit(1);
  }
}

main();
