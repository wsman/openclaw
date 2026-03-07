#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

type CheckStatus = 'pass' | 'warn' | 'fail';

interface CheckItem {
  id: string;
  status: CheckStatus;
  message: string;
  expected?: unknown;
  actual?: unknown;
}

interface Report {
  generatedAt: string;
  roots: {
    negentropy: string;
    openclaw: string;
    ui: string;
  };
  summary: {
    total: number;
    pass: number;
    warn: number;
    fail: number;
  };
  checks: CheckItem[];
}

function resolveExternalRoot(candidates: string[]): string {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return candidates[0];
}

function readText(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function parseStringUnion(source: string, typeName: string): string[] {
  const pattern = new RegExp(`export\\s+type\\s+${typeName}\\s*=\\s*([^;]+);`);
  const match = source.match(pattern);
  if (!match) return [];

  return match[1]
    .split('|')
    .map((entry) => entry.trim().replace(/^'/, '').replace(/'$/, '').replace(/^"/, '').replace(/"$/, ''))
    .filter((entry) => entry.length > 0)
    .sort();
}

function parseConstString(source: string, constName: string): string | null {
  const pattern = new RegExp(`const\\s+${constName}\\s*=\\s*["']([^"']+)["']`);
  const match = source.match(pattern);
  return match ? match[1] : null;
}

function parseObjectKeys(source: string, constName: string): string[] {
  const blockPattern = new RegExp(`(?:export\\s+)?const\\s+${constName}\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*as\\s+const`);
  const blockMatch = source.match(blockPattern);
  if (!blockMatch) return [];

  const keys = new Set<string>();
  const keyPattern = /^\s*([A-Z0-9_]+)\s*:/gm;
  let keyMatch = keyPattern.exec(blockMatch[1]);
  while (keyMatch) {
    keys.add(keyMatch[1]);
    keyMatch = keyPattern.exec(blockMatch[1]);
  }
  return Array.from(keys).sort();
}

function extractEnvTokens(source: string): Set<string> {
  const result = new Set<string>();

  const processEnvPattern = /process\.env\.([A-Z0-9_]+)/g;
  let processMatch = processEnvPattern.exec(source);
  while (processMatch) {
    result.add(processMatch[1]);
    processMatch = processEnvPattern.exec(source);
  }

  const vitePattern = /VITE_[A-Z0-9_]+/g;
  let viteMatch = vitePattern.exec(source);
  while (viteMatch) {
    result.add(viteMatch[0]);
    viteMatch = vitePattern.exec(source);
  }

  const runtimePattern = /__NEGENTROPY_DECISION_URL__/g;
  if (runtimePattern.test(source)) {
    result.add('__NEGENTROPY_DECISION_URL__');
  }

  return result;
}

function parseLauncherPort(source: string, serviceName: 'negentropy' | 'openclaw'): number | null {
  const pattern = new RegExp(`${serviceName}:\\s*\\{[\\s\\S]*?port:\\s*(\\d+)`);
  const match = source.match(pattern);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return Number.isNaN(value) ? null : value;
}

function sameSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function main(): void {
  const negentropyRoot = process.cwd();
  const openclawRoot = resolveExternalRoot([
    process.env.OPENCLAW_PROJECT_PATH || '',
    'D:/Games/openclaw',
  ].filter((item) => item.length > 0));
  const uiRoot = resolveExternalRoot([
    process.env.OPENDOGE_UI_PATH || '',
    'D:/Users/WSMAN/Desktop/OpenDoge/opendoge-ui',
  ].filter((item) => item.length > 0));

  const files = {
    negContract: path.join(
      negentropyRoot,
      'server/gateway/openclaw-decision/contracts/decision-contract.ts',
    ),
    launcherConfig: path.join(negentropyRoot, 'config/launcher.config.ts'),
    launcherCore: path.join(negentropyRoot, 'scripts/launcher.ts'),
    openclawBridge: path.join(openclawRoot, 'src/gateway/negentropy/decision-bridge.ts'),
    openaiHttp: path.join(openclawRoot, 'src/gateway/openai-http.ts'),
    openresponsesHttp: path.join(openclawRoot, 'src/gateway/openresponses-http.ts'),
    toolsInvokeHttp: path.join(openclawRoot, 'src/gateway/tools-invoke-http.ts'),
    uiProtocol: path.join(uiRoot, 'control-ui/src/types/protocol.ts'),
    uiWebApi: path.join(uiRoot, 'apps/control-ui-web/src/api/decisionApi.ts'),
    uiDeskApi: path.join(uiRoot, 'apps/control-ui-desk/src/api/decisionApi.ts'),
  };

  const checks: CheckItem[] = [];
  const loaded = new Map<string, string>();

  for (const [key, filePath] of Object.entries(files)) {
    const source = readText(filePath);
    if (source === null) {
      checks.push({
        id: `file.${key}`,
        status: 'fail',
        message: 'required file not found or unreadable',
        actual: filePath,
      });
    } else {
      loaded.set(key, source);
      checks.push({
        id: `file.${key}`,
        status: 'pass',
        message: 'required file is readable',
        actual: filePath,
      });
    }
  }

  if (checks.some((item) => item.status === 'fail')) {
    finalizeReport(negentropyRoot, openclawRoot, uiRoot, checks);
    process.exit(1);
  }

  const negContract = loaded.get('negContract') as string;
  const openclawBridge = loaded.get('openclawBridge') as string;
  const uiProtocol = loaded.get('uiProtocol') as string;
  const uiWebApi = loaded.get('uiWebApi') as string;
  const uiDeskApi = loaded.get('uiDeskApi') as string;
  const openaiHttp = loaded.get('openaiHttp') as string;
  const openresponsesHttp = loaded.get('openresponsesHttp') as string;
  const toolsInvokeHttp = loaded.get('toolsInvokeHttp') as string;
  const launcherConfig = loaded.get('launcherConfig') as string;
  const launcherCore = loaded.get('launcherCore') as string;

  const baselineModes = parseStringUnion(negContract, 'DecisionMode');
  const baselineActions = parseStringUnion(negContract, 'DecisionAction');

  const modeTargets = [
    { id: 'mode.openclawBridge', values: parseStringUnion(openclawBridge, 'DecisionMode') },
    { id: 'mode.uiProtocol', values: parseStringUnion(uiProtocol, 'DecisionMode') },
    { id: 'mode.uiWebApi', values: parseStringUnion(uiWebApi, 'DecisionMode') },
    { id: 'mode.uiDeskApi', values: parseStringUnion(uiDeskApi, 'DecisionMode') },
  ];

  const actionTargets = [
    { id: 'action.openclawBridge', values: parseStringUnion(openclawBridge, 'DecisionAction') },
    { id: 'action.uiProtocol', values: parseStringUnion(uiProtocol, 'DecisionAction') },
    { id: 'action.uiWebApi', values: parseStringUnion(uiWebApi, 'DecisionAction') },
    { id: 'action.uiDeskApi', values: parseStringUnion(uiDeskApi, 'DecisionAction') },
  ];

  for (const target of modeTargets) {
    checks.push({
      id: target.id,
      status: sameSet(target.values, baselineModes) ? 'pass' : 'fail',
      message: 'DecisionMode set must match negentropy contract',
      expected: baselineModes,
      actual: target.values,
    });
  }

  for (const target of actionTargets) {
    checks.push({
      id: target.id,
      status: sameSet(target.values, baselineActions) ? 'pass' : 'fail',
      message: 'DecisionAction set must match negentropy contract',
      expected: baselineActions,
      actual: target.values,
    });
  }

  const httpMethodIds = {
    openai: parseConstString(openaiHttp, 'OPENAI_HTTP_DECISION_METHOD'),
    openresponses: parseConstString(openresponsesHttp, 'OPENRESPONSES_HTTP_DECISION_METHOD'),
    toolsInvoke: parseConstString(toolsInvokeHttp, 'TOOLS_INVOKE_HTTP_DECISION_METHOD'),
  };

  const expectedHttpMethodIds = {
    openai: 'http.openai.chat.completions',
    openresponses: 'http.openresponses.create',
    toolsInvoke: 'http.tools.invoke',
  };

  for (const [key, expected] of Object.entries(expectedHttpMethodIds)) {
    const actual = httpMethodIds[key as keyof typeof httpMethodIds];
    checks.push({
      id: `httpMethod.${key}`,
      status: actual === expected ? 'pass' : 'fail',
      message: 'HTTP ingress decision method id should remain canonical',
      expected,
      actual,
    });
  }

  const uniqueHttpMethods = new Set(Object.values(httpMethodIds).filter((item): item is string => Boolean(item)));
  checks.push({
    id: 'httpMethod.unique',
    status: uniqueHttpMethods.size === 3 ? 'pass' : 'fail',
    message: 'HTTP ingress decision method ids must be unique',
    expected: 3,
    actual: uniqueHttpMethods.size,
  });

  const errorCodes = parseObjectKeys(negContract, 'DECISION_ERROR_CODES');
  checks.push({
    id: 'errorCodes.count',
    status: errorCodes.length >= 10 ? 'pass' : 'warn',
    message: 'Decision error code set should stay non-trivial',
    expected: '>= 10',
    actual: errorCodes.length,
  });

  const launcherEnv = extractEnvTokens(launcherConfig);
  const openclawEnv = extractEnvTokens(openclawBridge);
  const uiWebEnv = extractEnvTokens(uiWebApi);
  const uiDeskEnv = extractEnvTokens(uiDeskApi);

  const requiredLauncherEnv = [
    'LAUNCHER_DECISION_MODE',
    'LAUNCHER_NEGENTROPY_PORT',
    'LAUNCHER_OPENCLAW_PORT',
    'LAUNCHER_OPENCLAW_PATH',
    'OPENCLAW_PROJECT_PATH',
  ];
  for (const token of requiredLauncherEnv) {
    checks.push({
      id: `env.launcher.${token}`,
      status: launcherEnv.has(token) ? 'pass' : 'fail',
      message: 'launcher env mapping key exists',
      expected: true,
      actual: launcherEnv.has(token),
    });
  }

  checks.push({
    id: 'env.launcherCore.NEGENTROPY_DECISION_URL',
    status: launcherCore.includes('NEGENTROPY_DECISION_URL') ? 'pass' : 'fail',
    message: 'launcher core should inject NEGENTROPY_DECISION_URL when needed',
    expected: true,
    actual: launcherCore.includes('NEGENTROPY_DECISION_URL'),
  });

  checks.push({
    id: 'env.openclaw.NEGENTROPY_DECISION_URL',
    status: openclawEnv.has('NEGENTROPY_DECISION_URL') ? 'pass' : 'fail',
    message: 'openclaw bridge should support NEGENTROPY_DECISION_URL',
    expected: true,
    actual: openclawEnv.has('NEGENTROPY_DECISION_URL'),
  });

  const uiEnvRequirements = ['VITE_NEGENTROPY_DECISION_URL', '__NEGENTROPY_DECISION_URL__'];
  for (const token of uiEnvRequirements) {
    checks.push({
      id: `env.uiWeb.${token}`,
      status: uiWebEnv.has(token) ? 'pass' : 'fail',
      message: 'web ui decision env key exists',
      expected: true,
      actual: uiWebEnv.has(token),
    });
    checks.push({
      id: `env.uiDesk.${token}`,
      status: uiDeskEnv.has(token) ? 'pass' : 'fail',
      message: 'desk ui decision env key exists',
      expected: true,
      actual: uiDeskEnv.has(token),
    });
  }

  const negentropyPort = parseLauncherPort(launcherCore, 'negentropy');
  const openclawPort = parseLauncherPort(launcherCore, 'openclaw');

  checks.push({
    id: 'ports.negentropyDefault',
    status: negentropyPort === 3000 ? 'pass' : 'fail',
    message: 'default negentropy port should remain 3000',
    expected: 3000,
    actual: negentropyPort,
  });

  checks.push({
    id: 'ports.openclawDefault',
    status: openclawPort === 18789 ? 'pass' : 'fail',
    message: 'default openclaw port should remain 18789',
    expected: 18789,
    actual: openclawPort,
  });

  checks.push({
    id: 'ports.noCollision',
    status: negentropyPort !== null && openclawPort !== null && negentropyPort !== openclawPort ? 'pass' : 'fail',
    message: 'default service ports must not collide',
    expected: 'different values',
    actual: { negentropyPort, openclawPort },
  });

  const report = finalizeReport(negentropyRoot, openclawRoot, uiRoot, checks);

  const failItems = report.checks.filter((item) => item.status === 'fail');
  const warnItems = report.checks.filter((item) => item.status === 'warn');

  console.log('[integration-config-check] summary');
  console.log(`  pass: ${report.summary.pass}`);
  console.log(`  warn: ${report.summary.warn}`);
  console.log(`  fail: ${report.summary.fail}`);

  if (warnItems.length > 0) {
    console.log('\n[integration-config-check] warnings');
    for (const item of warnItems) {
      console.log(`  - ${item.id}: ${item.message}`);
    }
  }

  if (failItems.length > 0) {
    console.log('\n[integration-config-check] failures');
    for (const item of failItems) {
      console.log(`  - ${item.id}: ${item.message}`);
    }
    process.exit(1);
  }

  process.exit(0);
}

function finalizeReport(
  negentropyRoot: string,
  openclawRoot: string,
  uiRoot: string,
  checks: CheckItem[],
): Report {
  const summary = {
    total: checks.length,
    pass: checks.filter((item) => item.status === 'pass').length,
    warn: checks.filter((item) => item.status === 'warn').length,
    fail: checks.filter((item) => item.status === 'fail').length,
  };

  const report: Report = {
    generatedAt: new Date().toISOString(),
    roots: {
      negentropy: negentropyRoot,
      openclaw: openclawRoot,
      ui: uiRoot,
    },
    summary,
    checks,
  };

  const reportsDir = path.join(negentropyRoot, 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const date = new Date().toISOString().slice(0, 10);
  const reportPath = path.join(reportsDir, `${date}_integration-config-check.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`[integration-config-check] report: ${reportPath}`);

  return report;
}

main();
