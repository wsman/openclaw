#!/usr/bin/env node
/**
 * 性能趋势审计脚本（TG-83）
 *
 * 聚合 ws-soak / ws-perf-baseline 报告并输出趋势结论。
 */

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {
    reportsDir: 'reports',
    outputBase: 'reports/performance-trend-audit',
    lookbackDays: 28,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
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
  const m = String(value).match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
  if (!m) return 0;
  return Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+08:00`);
}

function listReports(reportsDir, prefix) {
  if (!fs.existsSync(reportsDir)) return [];
  return fs
    .readdirSync(reportsDir)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
    .map((name) => path.join(reportsDir, name));
}

function linearRegressionSlope(values) {
  if (!values || values.length < 2) return null;
  const n = values.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i += 1) {
    const x = i;
    const y = Number(values[i]);
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;
  return (n * sumXY - sumX * sumY) / denominator;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function classifyTrend(slope, direction) {
  if (slope === null) return 'insufficient_data';
  const threshold = 0.01;
  if (Math.abs(slope) < threshold) return 'stable';
  if (direction === 'down_is_better') {
    return slope < 0 ? 'improving' : 'regressing';
  }
  return slope > 0 ? 'improving' : 'regressing';
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const now = Date.now();
  const lookbackMs = args.lookbackDays * 24 * 60 * 60 * 1000;

  const soakReports = listReports(args.reportsDir, 'ws-soak-')
    .map((file) => ({ file, data: safeReadJson(file) }))
    .filter((item) => item.data)
    .map((item) => ({
      ...item,
      endedAtMs: toMs(item.data.ended_at || item.data.started_at),
      pass: item.data.status === 'PASS' ? 1 : 0,
    }))
    .filter((item) => item.endedAtMs >= now - lookbackMs)
    .sort((a, b) => a.endedAtMs - b.endedAtMs);

  const perfReports = listReports(args.reportsDir, 'ws-perf-baseline-')
    .map((file) => ({ file, data: safeReadJson(file) }))
    .filter((item) => item.data)
    .map((item) => ({
      ...item,
      endedAtMs: toMs(item.data.ended_at || item.data.started_at),
      durationSec: Number(item.data.duration_sec || 0),
      pass: item.data.status === 'PASS' ? 1 : 0,
    }))
    .filter((item) => item.endedAtMs >= now - lookbackMs)
    .sort((a, b) => a.endedAtMs - b.endedAtMs);

  const soakSeries = soakReports.map((item) => item.pass);
  const perfDurationSeries = perfReports.map((item) => item.durationSec);
  const perfPassSeries = perfReports.map((item) => item.pass);

  const soakSlope = linearRegressionSlope(soakSeries);
  const perfDurationSlope = linearRegressionSlope(perfDurationSeries);
  const perfPassSlope = linearRegressionSlope(perfPassSeries);

  const soakTrend = classifyTrend(soakSlope, 'up_is_better');
  const perfDurationTrend = classifyTrend(perfDurationSlope, 'down_is_better');
  const perfPassTrend = classifyTrend(perfPassSlope, 'up_is_better');

  const recentPerf = perfDurationSeries.slice(-3);
  const baselinePerf = perfDurationSeries.slice(0, Math.max(0, perfDurationSeries.length - 3));
  const recentPerfAvg = average(recentPerf);
  const baselinePerfAvg = baselinePerf.length > 0 ? average(baselinePerf) : null;

  const alerts = [];
  if (soakTrend === 'regressing') {
    alerts.push({ level: 'warning', code: 'SOAK_TREND_REGRESSING', message: 'soak 通过趋势出现回退' });
  }
  if (perfDurationTrend === 'regressing') {
    alerts.push({ level: 'warning', code: 'PERF_DURATION_TREND_REGRESSING', message: 'baseline 耗时趋势上升' });
  }
  if (perfPassTrend === 'regressing') {
    alerts.push({ level: 'warning', code: 'PERF_PASS_TREND_REGRESSING', message: 'baseline 通过率趋势下降' });
  }
  if (baselinePerfAvg !== null && baselinePerfAvg > 0 && recentPerfAvg > baselinePerfAvg * 1.15) {
    alerts.push({ level: 'error', code: 'PERF_RECENT_REGRESSION', message: '最近样本平均耗时较历史均值上升超过 15%' });
  }

  const report = {
    timestamp: new Date().toISOString(),
    lookbackDays: args.lookbackDays,
    soak: {
      sampleCount: soakReports.length,
      slope: soakSlope,
      trend: soakTrend,
      passRatePct: soakReports.length === 0 ? 0 : Number(((soakSeries.reduce((a, b) => a + b, 0) / soakReports.length) * 100).toFixed(1)),
    },
    perf: {
      sampleCount: perfReports.length,
      durationSlope: perfDurationSlope,
      durationTrend: perfDurationTrend,
      passSlope: perfPassSlope,
      passTrend: perfPassTrend,
      recentAvgDurationSec: Number(recentPerfAvg.toFixed(2)),
      baselineAvgDurationSec: baselinePerfAvg === null ? null : Number(baselinePerfAvg.toFixed(2)),
    },
    alerts,
    status: alerts.some((item) => item.level === 'error') ? 'FAIL' : 'PASS',
  };

  const jsonPath = `${args.outputBase}.json`;
  const mdPath = `${args.outputBase}.md`;
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const md = [
    '# 性能趋势审计报告（自动生成）',
    '',
    `- 生成时间: ${report.timestamp}`,
    `- 窗口: 最近 ${report.lookbackDays} 天`,
    `- 状态: **${report.status}**`,
    '',
    '## Soak 趋势',
    '',
    `- 样本数: ${report.soak.sampleCount}`,
    `- 通过率: ${report.soak.passRatePct}%`,
    `- 斜率: ${report.soak.slope ?? 'N/A'}`,
    `- 趋势: ${report.soak.trend}`,
    '',
    '## Baseline 趋势',
    '',
    `- 样本数: ${report.perf.sampleCount}`,
    `- 耗时斜率: ${report.perf.durationSlope ?? 'N/A'}`,
    `- 耗时趋势: ${report.perf.durationTrend}`,
    `- 通过率斜率: ${report.perf.passSlope ?? 'N/A'}`,
    `- 通过率趋势: ${report.perf.passTrend}`,
    `- 最近3次平均耗时: ${report.perf.recentAvgDurationSec}s`,
    `- 历史基线平均耗时: ${report.perf.baselineAvgDurationSec ?? 'N/A'}s`,
    '',
    '## 告警',
    '',
    ...(report.alerts.length > 0
      ? report.alerts.map((item) => `- [${item.level.toUpperCase()}] ${item.code}: ${item.message}`)
      : ['- 无']),
    '',
  ].join('\n');
  fs.writeFileSync(mdPath, md);

  console.log(`performance trend audit json: ${jsonPath}`);
  console.log(`performance trend audit md: ${mdPath}`);
  console.log(`status: ${report.status}`);
}

main();
