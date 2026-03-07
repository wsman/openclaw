#!/usr/bin/env node
/**
 * skip 用例治理报告（TG-81）
 *
 * 扫描测试目录中的 skip 场景并输出分层治理台账。
 */

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = {
    testsDir: 'tests',
    outputBase: 'reports/skip-governance-report',
    waiversFile: 'config/skip-governance-waivers.json',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case '--tests-dir':
        args.testsDir = argv[i + 1] || args.testsDir;
        i += 1;
        break;
      case '--output-base':
        args.outputBase = argv[i + 1] || args.outputBase;
        i += 1;
        break;
      case '--waivers-file':
        args.waiversFile = argv[i + 1] || args.waiversFile;
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

function listTestFiles(rootDir) {
  const out = [];
  if (!fs.existsSync(rootDir)) {
    return out;
  }

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (/\.(test|spec)\.(ts|tsx|js|jsx)$/.test(entry.name)) {
        out.push(full);
      }
    }
  }

  walk(rootDir);
  return out;
}

function inferLayer(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.includes('/performance/')) return 'performance';
  if (normalized.includes('/e2e/')) return 'e2e';
  if (normalized.includes('/integration/')) return 'integration';
  if (normalized.includes('/unit/')) return 'unit';
  return 'other';
}

function inferPriority(layer) {
  if (layer === 'performance' || layer === 'e2e' || layer === 'integration') return 'P1';
  if (layer === 'unit') return 'P2';
  return 'P3';
}

function countBy(items, keyFn) {
  const map = {};
  for (const item of items) {
    const key = keyFn(item);
    map[key] = (map[key] || 0) + 1;
  }
  return map;
}

function loadWaivers(waiversFile) {
  const absolutePath = path.resolve(process.cwd(), waiversFile);
  if (!fs.existsSync(absolutePath)) {
    return { source: waiversFile, waivers: [] };
  }

  const json = safeReadJson(absolutePath);
  if (!json) {
    return { source: waiversFile, waivers: [] };
  }

  const waivers = Array.isArray(json.waivers) ? json.waivers : [];
  return { source: waiversFile, waivers };
}

function isWaiverExpired(waiver, nowMs) {
  if (!waiver.expiresAt) return false;
  const ms = Date.parse(waiver.expiresAt);
  if (!Number.isFinite(ms)) return true;
  return ms < nowMs;
}

function matchWaiver(finding, waivers, nowMs) {
  for (const waiver of waivers) {
    if (!waiver || typeof waiver !== 'object') continue;
    if (isWaiverExpired(waiver, nowMs)) continue;
    if (waiver.file !== finding.file) continue;
    if (waiver.type && waiver.type !== finding.type) continue;
    if (waiver.line && Number(waiver.line) !== Number(finding.line)) continue;
    return waiver;
  }
  return null;
}

function extractFindings(filePath, content, repoRoot) {
  const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, '/');
  const lines = content.split('\n');
  const findings = [];
  const layer = inferLayer(relativePath);
  const priority = inferPriority(layer);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const directMatch = line.match(/\b(describe|it|test)\.skip\s*\(/);
    if (directMatch) {
      findings.push({
        file: relativePath,
        line: i + 1,
        type: `direct-${directMatch[1]}-skip`,
        layer,
        priority,
        estimatedSkippedTests: 1,
        reason: '显式 skip 调用',
        suggestedAction: '将 skip 原因写入注释并拆分为可运行最小用例，优先回补高优先级层。',
      });
    }
  }

  const conditionalAliasMatch = content.match(/const\s+([A-Za-z_$][\w$]*)\s*=\s*[^;\n]*describe\.skip/g) || [];
  for (const declaration of conditionalAliasMatch) {
    const alias = declaration.match(/const\s+([A-Za-z_$][\w$]*)/)?.[1];
    if (!alias) continue;

    const aliasInvocationRegex = new RegExp(`\\b${alias}\\s*\\(`, 'g');
    const invocations = content.match(aliasInvocationRegex) || [];
    const testCount = (content.match(/\b(test|it)\s*\(/g) || []).length;

    findings.push({
      file: relativePath,
      line: lines.findIndex((line) => line.includes(`const ${alias}`)) + 1,
      type: 'conditional-describe-skip-alias',
      layer,
      priority,
      estimatedSkippedTests: Math.max(testCount, invocations.length),
      reason: `条件别名 ${alias} 在禁用开关时退化为 describe.skip`,
      suggestedAction: '为性能/专项测试拆分独立 CI lane，并提供最小 smoke 版本避免主干长期 skip。',
    });
  }

  return findings;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const testsDir = path.resolve(repoRoot, args.testsDir);
  const files = listTestFiles(testsDir);
  const nowMs = Date.now();
  const waiverConfig = loadWaivers(args.waiversFile);

  const findings = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    findings.push(...extractFindings(file, content, repoRoot));
  }

  const resolvedFindings = findings.map((item) => {
    const waiver = matchWaiver(item, waiverConfig.waivers, nowMs);
    if (!waiver) return item;
    return {
      ...item,
      waived: true,
      waiver: {
        id: waiver.id || null,
        owner: waiver.owner || null,
        reason: waiver.reason || null,
        expiresAt: waiver.expiresAt || null,
      },
    };
  });

  const unresolvedFindings = resolvedFindings.filter((item) => !item.waived);
  const waivedFindings = resolvedFindings.filter((item) => item.waived);
  const totalEstimatedSkippedTests = resolvedFindings.reduce((sum, item) => sum + Number(item.estimatedSkippedTests || 0), 0);
  const unresolvedEstimatedSkippedTests = unresolvedFindings.reduce((sum, item) => sum + Number(item.estimatedSkippedTests || 0), 0);

  const summary = {
    timestamp: new Date().toISOString(),
    testsDir: args.testsDir,
    totalFindings: resolvedFindings.length,
    unresolvedFindings: unresolvedFindings.length,
    waivedFindings: waivedFindings.length,
    totalEstimatedSkippedTests,
    unresolvedEstimatedSkippedTests,
    layerBreakdown: countBy(resolvedFindings, (item) => item.layer),
    priorityBreakdown: countBy(resolvedFindings, (item) => item.priority),
    unresolvedPriorityBreakdown: countBy(unresolvedFindings, (item) => item.priority),
    waiverConfig: {
      source: waiverConfig.source,
      activeWaivers: waiverConfig.waivers.length,
    },
    findings: resolvedFindings,
    status: unresolvedEstimatedSkippedTests === 0 ? 'PASS' : 'ATTENTION',
  };

  const jsonPath = `${args.outputBase}.json`;
  const mdPath = `${args.outputBase}.md`;
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));

  const md = [
    '# skip 用例分层治理报告（自动生成）',
    '',
    `- 生成时间: ${summary.timestamp}`,
    `- 状态: **${summary.status}**`,
    `- 扫描目录: ${summary.testsDir}`,
    `- 豁免配置: ${summary.waiverConfig.source}`,
    '',
    '## 总览',
    '',
    `- skip 发现数: ${summary.totalFindings}`,
    `- 估算 skip 用例数: ${summary.totalEstimatedSkippedTests}`,
    `- 未闭环 skip 用例数: ${summary.unresolvedEstimatedSkippedTests}`,
    `- 豁免条目数: ${summary.waivedFindings}`,
    '',
    '## 分层统计',
    '',
    ...Object.entries(summary.layerBreakdown).map(([layer, count]) => `- ${layer}: ${count}`),
    '',
    '## 优先级统计',
    '',
    ...Object.entries(summary.priorityBreakdown).map(([priority, count]) => `- ${priority}: ${count}`),
    '',
    '## 未闭环优先级统计',
    '',
    ...(Object.keys(summary.unresolvedPriorityBreakdown).length === 0
      ? ['- 无']
      : Object.entries(summary.unresolvedPriorityBreakdown).map(([priority, count]) => `- ${priority}: ${count}`)),
    '',
    '## 处置清单',
    '',
    ...(summary.findings.length === 0
      ? ['- 无 skip 项。']
      : summary.findings.map((item, idx) => {
          const waiverSuffix = item.waived
            ? ` | 豁免: ${item.waiver?.id || 'unnamed'} (owner=${item.waiver?.owner || 'N/A'}, expiresAt=${item.waiver?.expiresAt || 'N/A'})`
            : '';
          return `${idx + 1}. ${item.file}:${item.line} [${item.priority}/${item.layer}] ${item.type} | ` +
            `估算skip=${item.estimatedSkippedTests} | 建议: ${item.suggestedAction}${waiverSuffix}`;
        })),
    '',
  ].join('\n');

  fs.writeFileSync(mdPath, md);
  console.log(`skip governance report json: ${jsonPath}`);
  console.log(`skip governance report md: ${mdPath}`);
  console.log(`status: ${summary.status}`);
}

main();
