#!/usr/bin/env node
/**
 * 契约计数与实现覆盖校验脚本
 *
 * 宪法依据:
 * - §101 同步公理: 契约与实现必须同步
 * - §102 熵减原则: 单点统计口径，避免多源漂移
 * - §152 单一真理源公理: 93 RPC / 19 Events 作为 canonical 基线
 */

const fs = require('fs');
const path = require('path');

const CONTRACT_BASELINE = {
  rpcCount: 93,
  eventCount: 19,
};

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function readFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

function extractConstStringArray(content, constName) {
  const escaped = constName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = content.match(new RegExp(`${escaped}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s*const`));
  if (!match) {
    return [];
  }

  const values = [];
  const rx = /'([^']+)'/g;
  let hit;
  while ((hit = rx.exec(match[1])) !== null) {
    values.push(hit[1]);
  }
  return values;
}

function extractAliasMap(content) {
  const match = content.match(/OPENCLAW_RPC_ALIAS_MAP\s*:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\};/);
  if (!match) {
    return new Map();
  }

  const map = new Map();
  const rx = /'([^']+)'\s*:\s*'([^']+)'/g;
  let hit;
  while ((hit = rx.exec(match[1])) !== null) {
    map.set(hit[1], hit[2]);
  }
  return map;
}

function extractExplicitRegisteredMethods(content) {
  const methods = new Set();
  const rx = /this\.methodHandlers\.set\(\s*['"]([^'"]+)['"]/g;
  let hit;
  while ((hit = rx.exec(content)) !== null) {
    methods.add(hit[1]);
  }
  return methods;
}

function summarizeCoverage(contractMethods, aliasMap, explicitMethods) {
  const canonicalSet = new Set(contractMethods);
  const implementedCanonical = new Set();
  const aliasBackfilled = [];

  for (const method of contractMethods) {
    if (explicitMethods.has(method)) {
      implementedCanonical.add(method);
    }
  }

  for (const [alias, canonical] of aliasMap.entries()) {
    if (!canonicalSet.has(canonical)) {
      continue;
    }
    if (!explicitMethods.has(alias)) {
      continue;
    }
    if (!implementedCanonical.has(canonical)) {
      aliasBackfilled.push({ alias, canonical });
    }
    implementedCanonical.add(canonical);
  }

  const missingCanonical = contractMethods.filter((method) => !implementedCanonical.has(method));

  const nonCanonicalRegistered = Array.from(explicitMethods)
    .filter((method) => !canonicalSet.has(method) && !aliasMap.has(method))
    .sort();

  const coverage = contractMethods.length === 0
    ? 0
    : Number(((implementedCanonical.size / contractMethods.length) * 100).toFixed(1));

  return {
    implementedCanonical: Array.from(implementedCanonical).sort(),
    missingCanonical,
    aliasBackfilled,
    nonCanonicalRegistered,
    coverage,
  };
}

function hasFlag(args, flag) {
  return args.includes(flag);
}

function main() {
  const args = process.argv.slice(2);
  const enforce = hasFlag(args, '--enforce') || process.env.ENFORCE_CONTRACT === 'true';
  const basePath = process.cwd();

  const contractPath = path.join(basePath, 'server/gateway/contracts/openclaw-contract.ts');
  const aliasMapPath = path.join(basePath, 'server/gateway/contracts/openclaw-alias-map.ts');
  const handlerPath = path.join(basePath, 'server/gateway/websocket-handler.ts');

  const contractContent = readFile(contractPath);
  const aliasContent = readFile(aliasMapPath);
  const handlerContent = readFile(handlerPath);

  const contractMethods = extractConstStringArray(contractContent, 'OPENCLAW_RPC_METHODS');
  const contractEvents = extractConstStringArray(contractContent, 'OPENCLAW_EVENTS');
  const aliasMap = extractAliasMap(aliasContent);
  const explicitMethods = extractExplicitRegisteredMethods(handlerContent);

  const coverage = summarizeCoverage(contractMethods, aliasMap, explicitMethods);

  const rpcCountMatched = contractMethods.length === CONTRACT_BASELINE.rpcCount;
  const eventCountMatched = contractEvents.length === CONTRACT_BASELINE.eventCount;
  const implementationComplete = coverage.missingCanonical.length === 0;

  log('blue', '📊 契约计数校验脚本');
  log('blue', '==================');
  log('blue', `基线: ${CONTRACT_BASELINE.rpcCount} RPC / ${CONTRACT_BASELINE.eventCount} Events`);
  log('blue', '');
  log('blue', `📋 契约定义 RPC 方法数量: ${contractMethods.length}`);
  log('blue', `📋 契约定义 Event 数量: ${contractEvents.length}`);
  log('blue', `📋 显式注册方法数量: ${explicitMethods.size}`);
  log('blue', `📋 Canonical RPC 实现覆盖: ${coverage.implementedCanonical.length}/${contractMethods.length} (${coverage.coverage}%)`);

  if (rpcCountMatched) {
    log('green', `✅ RPC 契约计数匹配基线 (${CONTRACT_BASELINE.rpcCount})`);
  } else {
    log('red', `❌ RPC 契约计数漂移: expected=${CONTRACT_BASELINE.rpcCount}, actual=${contractMethods.length}`);
  }

  if (eventCountMatched) {
    log('green', `✅ Event 契约计数匹配基线 (${CONTRACT_BASELINE.eventCount})`);
  } else {
    log('red', `❌ Event 契约计数漂移: expected=${CONTRACT_BASELINE.eventCount}, actual=${contractEvents.length}`);
  }

  if (implementationComplete) {
    log('green', '✅ Canonical RPC 已全部实现（含 alias 回填）');
  } else {
    log('red', `❌ Canonical RPC 缺口: ${coverage.missingCanonical.length}`);
    for (const method of coverage.missingCanonical) {
      log('red', `   - ${method}`);
    }
  }

  if (coverage.aliasBackfilled.length > 0) {
    log('yellow', `ℹ️ alias 回填方法: ${coverage.aliasBackfilled.length}`);
  }

  const report = {
    timestamp: new Date().toISOString(),
    baseline: CONTRACT_BASELINE,
    contract: {
      rpcCount: contractMethods.length,
      eventCount: contractEvents.length,
    },
    implementation: {
      explicitMethodCount: explicitMethods.size,
      canonicalImplementedCount: coverage.implementedCanonical.length,
      coverage: coverage.coverage,
      missingCanonicalCount: coverage.missingCanonical.length,
    },
    compliance: {
      rpcContractCountMatched: rpcCountMatched,
      eventContractCountMatched: eventCountMatched,
      rpcImplementationComplete: implementationComplete,
      strictPass: rpcCountMatched && eventCountMatched && implementationComplete,
    },
    contractMethods: contractMethods.slice().sort(),
    contractEvents: contractEvents.slice().sort(),
    implementedCanonicalMethods: coverage.implementedCanonical,
    missingCanonicalMethods: coverage.missingCanonical,
    aliasBackfilledMethods: coverage.aliasBackfilled,
    nonCanonicalRegisteredMethods: coverage.nonCanonicalRegistered,
  };

  const reportPath = path.join(basePath, 'reports/contract-count-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log('green', `📄 报告已保存: ${reportPath}`);

  const strictPass = report.compliance.strictPass;
  if (enforce && !strictPass) {
    log('red', '❌ Enforced mode: 契约校验失败');
    process.exit(1);
  }

  if (!strictPass) {
    log('yellow', '⚠️ 契约存在漂移或实现缺口（未启用 enforce，不阻断）');
  } else {
    log('green', '✅ 契约计数与实现覆盖校验通过');
  }
}

main();
