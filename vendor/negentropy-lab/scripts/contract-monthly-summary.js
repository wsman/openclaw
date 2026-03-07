#!/usr/bin/env node
/**
 * 契约审计月报聚合脚本（RPC-83）
 *
 * 聚合 reports/ 下的 drift 审计结果，输出月度 JSON/MD 报告。
 */

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const now = new Date();
  const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const args = {
    enforce: false,
    month: defaultMonth,
    reportsDir: 'reports',
    outputBase: '',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case '--enforce':
        args.enforce = true;
        break;
      case '--month':
        args.month = argv[i + 1] || args.month;
        i += 1;
        break;
      case '--reports-dir':
        args.reportsDir = argv[i + 1] || args.reportsDir;
        i += 1;
        break;
      case '--output-base':
        args.outputBase = argv[i + 1] || args.outputBase;
        i += 1;
        break;
      default:
        break;
    }
  }

  if (!args.outputBase) {
    args.outputBase = path.join(args.reportsDir, `contract-monthly-summary-${args.month}`);
  }
  return args;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function listAuditFiles(reportsDir) {
  if (!fs.existsSync(reportsDir)) {
    return [];
  }
  return fs
    .readdirSync(reportsDir)
    .filter((name) => name === 'contract-drift-audit.json' || (name.startsWith('contract-drift-audit-') && name.endsWith('.json')))
    .map((name) => path.join(reportsDir, name));
}

function parseMonth(isoLike) {
  if (!isoLike) {
    return null;
  }
  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function countBy(items, keyFn) {
  const out = {};
  for (const item of items) {
    const key = keyFn(item);
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = listAuditFiles(args.reportsDir);
  const items = files
    .map((file) => ({ file, data: readJson(file) }))
    .filter((item) => item.data && parseMonth(item.data.timestamp) === args.month);

  const total = items.length;
  const pass = items.filter((item) => item.data.status === 'PASS').length;
  const fail = items.filter((item) => item.data.status !== 'PASS').length;
  const severityBreakdown = countBy(items, (item) => item.data.severity || 'none');
  const issueCodeBreakdown = countBy(
    items.flatMap((item) => (Array.isArray(item.data.issues) ? item.data.issues : [])),
    (issue) => issue.code || 'UNKNOWN',
  );

  const summary = {
    timestamp: new Date().toISOString(),
    month: args.month,
    totalAudits: total,
    pass,
    fail,
    passRate: total === 0 ? 0 : Number(((pass / total) * 100).toFixed(1)),
    severityBreakdown,
    issueCodeBreakdown,
    audits: items.map((item) => ({
      file: path.basename(item.file),
      timestamp: item.data.timestamp || null,
      status: item.data.status || 'UNKNOWN',
      severity: item.data.severity || 'none',
      issueCount: Array.isArray(item.data.issues) ? item.data.issues.length : 0,
      rpcDelta: Number(item.data?.drift?.rpcDelta || 0),
      eventDelta: Number(item.data?.drift?.eventDelta || 0),
      missingCanonicalCount: Number(item.data?.actual?.missingCanonicalCount || 0),
    })),
    status: fail > 0 ? 'ATTENTION' : 'PASS',
  };

  const jsonPath = `${args.outputBase}.json`;
  const mdPath = `${args.outputBase}.md`;
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));

  const issueLines = Object.entries(summary.issueCodeBreakdown)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([code, count]) => `- ${code}: ${count}`);

  const md = [
    '# 契约审计月报（自动生成）',
    '',
    `- 月份: ${summary.month}`,
    `- 生成时间: ${summary.timestamp}`,
    `- 状态: **${summary.status}**`,
    '',
    '## 总览',
    '',
    `- 审计次数: ${summary.totalAudits}`,
    `- 通过/失败: ${summary.pass}/${summary.fail}`,
    `- 通过率: ${summary.passRate}%`,
    '',
    '## 严重度分布',
    '',
    ...Object.entries(summary.severityBreakdown)
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([level, count]) => `- ${level}: ${count}`),
    '',
    '## 问题码分布',
    '',
    ...(issueLines.length > 0 ? issueLines : ['- 无']),
    '',
  ].join('\n');

  fs.writeFileSync(mdPath, md);
  console.log(`contract monthly summary json: ${jsonPath}`);
  console.log(`contract monthly summary md: ${mdPath}`);
  console.log(`status: ${summary.status}`);

  if (args.enforce && summary.status !== 'PASS') {
    process.exit(1);
  }
}

main();
