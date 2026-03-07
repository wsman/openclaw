#!/usr/bin/env node
/**
 * 文档-代码一致性检查脚本
 *
 * 宪法依据:
 * - §101 同步公理：确保文档声明与代码实现同步
 * - §102.3 宪法同步公理：版本变更触发全体系一致性检查
 * - §141 熵减验证公理：通过自动化检查降低认知偏差
 * - §152 单一真理源公理：验证真理源文档与实现状态对齐
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function resolvePath(relativeOrAbsolutePath) {
  if (path.isAbsolute(relativeOrAbsolutePath)) {
    return relativeOrAbsolutePath;
  }
  return path.resolve(ROOT, relativeOrAbsolutePath);
}

function existsPath(relativeOrAbsolutePath) {
  return fs.existsSync(resolvePath(relativeOrAbsolutePath));
}

function readUtf8(relativeOrAbsolutePath) {
  const p = resolvePath(relativeOrAbsolutePath);
  return fs.readFileSync(p, 'utf8');
}

function safeReadUtf8(relativeOrAbsolutePath) {
  try {
    return readUtf8(relativeOrAbsolutePath);
  } catch (error) {
    return '';
  }
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(resolvePath(filePath)), { recursive: true });
}

function toFixed2(n) {
  return Number(n.toFixed(2));
}

function dimensionStatus(score, thresholds) {
  if (score >= thresholds.pass) return 'ok';
  if (score >= thresholds.warn) return 'warn';
  return 'bad';
}

function scoreFromChecks(checks) {
  const requiredChecks = checks.filter((c) => c.required !== false);
  if (requiredChecks.length === 0) {
    return 100;
  }
  const passed = requiredChecks.filter((c) => c.passed).length;
  return (passed / requiredChecks.length) * 100;
}

function parseLayerIdsFromText(content) {
  const ids = new Set();
  const re = /\bL\d(?:\.\d)?\b/g;
  let match;
  while ((match = re.exec(content)) !== null) {
    ids.add(match[0]);
  }
  return ids;
}

function parseEnumValues(fileContent, enumName) {
  const enumPattern = new RegExp(`export\\s+enum\\s+${enumName}\\s*\\{([\\s\\S]*?)\\}`);
  const match = fileContent.match(enumPattern);
  if (!match) return [];

  const values = [];
  const body = match[1];
  for (const line of body.split('\n')) {
    const itemMatch = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=/);
    if (itemMatch) {
      values.push(itemMatch[1]);
    }
  }
  return values;
}

function parseUnionValues(fileContent, typeName) {
  const typePattern = new RegExp(`export\\s+type\\s+${typeName}\\s*=([\\s\\S]*?);`);
  const match = fileContent.match(typePattern);
  if (!match) return [];

  const values = [];
  const body = match[1];
  const valuePattern = /'([^']+)'/g;
  let valueMatch;
  while ((valueMatch = valuePattern.exec(body)) !== null) {
    values.push(valueMatch[1]);
  }
  return values;
}

function joinDocContents(files) {
  return files
    .map((f) => safeReadUtf8(f))
    .join('\n');
}

function checkContainsAll(text, requiredTokens) {
  const missing = requiredTokens.filter((token) => !text.includes(token));
  return {
    passed: missing.length === 0,
    missing,
  };
}

function runSevenLayerArchitectureCheck(rules, thresholds) {
  const checks = [];
  const sourceContents = {};

  for (const doc of rules.docSources) {
    sourceContents[doc] = safeReadUtf8(doc);
  }

  const layerIdsInDocs = new Set();
  for (const content of Object.values(sourceContents)) {
    for (const layerId of parseLayerIdsFromText(content)) {
      layerIdsInDocs.add(layerId);
    }
  }

  for (const layerId of rules.requiredLayerIds) {
    checks.push({
      id: `doc-layer-${layerId}`,
      required: true,
      passed: layerIdsInDocs.has(layerId),
      message: `文档声明包含 ${layerId}`,
      evidence: rules.docSources,
    });
  }

  for (const layer of rules.layers) {
    const existingPaths = layer.anyOfPaths.filter((p) => existsPath(p));
    checks.push({
      id: `impl-layer-${layer.id}`,
      required: layer.required !== false,
      passed: existingPaths.length > 0,
      message: `${layer.id}(${layer.name}) 映射实现存在`,
      evidence: layer.anyOfPaths,
      details: existingPaths.length > 0 ? `命中: ${existingPaths.join(', ')}` : '未命中任何预期路径',
    });
  }

  const score = scoreFromChecks(checks);
  const passedChecks = checks.filter((c) => c.required !== false && c.passed).length;
  const totalChecks = checks.filter((c) => c.required !== false).length;

  return {
    score: toFixed2(score),
    status: dimensionStatus(score, thresholds),
    total_layers: rules.requiredLayerIds.length,
    implemented_layers: rules.layers.filter((l) => l.anyOfPaths.some((p) => existsPath(p))).length,
    passed_checks: passedChecks,
    total_checks: totalChecks,
    failed_checks: checks.filter((c) => c.required !== false && !c.passed),
    checks,
  };
}

function runAgentThreeTierCheck(rules, thresholds) {
  const checks = [];

  const combinedDocs = joinDocContents(rules.docSources);
  const requiredTerms = ['办公厅主任', '内阁总理', '监察部Agent', '科技部Agent', '组织部Agent'];
  const docTerms = checkContainsAll(combinedDocs, requiredTerms);

  checks.push({
    id: 'agent-doc-terminology',
    required: true,
    passed: docTerms.passed,
    message: '文档包含三层Agent官方术语',
    evidence: rules.docSources,
    details: docTerms.passed ? '全部命中' : `缺失: ${docTerms.missing.join(', ')}`,
  });

  for (const agent of rules.agents) {
    const exists = existsPath(agent.file);
    const content = exists ? safeReadUtf8(agent.file) : '';
    const hasClass = exists && content.includes(agent.classPattern);

    checks.push({
      id: `agent-file-${agent.name}`,
      required: true,
      passed: exists,
      message: `${agent.name} 文件存在`,
      evidence: [agent.file],
    });

    checks.push({
      id: `agent-class-${agent.name}`,
      required: true,
      passed: hasClass,
      message: `${agent.name} 类定义存在`,
      evidence: [agent.file, agent.classPattern],
    });
  }

  checks.push({
    id: 'agent-terminology-mapping-file',
    required: true,
    passed: existsPath(rules.terminologyMappingFile),
    message: '官方术语映射文件存在',
    evidence: [rules.terminologyMappingFile],
  });

  const score = scoreFromChecks(checks);
  const passedChecks = checks.filter((c) => c.required !== false && c.passed).length;
  const totalChecks = checks.filter((c) => c.required !== false).length;

  return {
    score: toFixed2(score),
    status: dimensionStatus(score, thresholds),
    expected_agents: rules.agents.length,
    found_agents: rules.agents.filter((a) => existsPath(a.file)).length,
    passed_checks: passedChecks,
    total_checks: totalChecks,
    failed_checks: checks.filter((c) => c.required !== false && !c.passed),
    checks,
  };
}

function runGatewayEcosystemCheck(rules, thresholds) {
  const checks = [];

  const docsText = joinDocContents(rules.docSources);
  const docTokens = ['WebSocket RPC', 'Gateway', '插件', '监控'];
  const docCheck = checkContainsAll(docsText, docTokens);

  checks.push({
    id: 'gateway-doc-coverage',
    required: true,
    passed: docCheck.passed,
    message: '文档包含Gateway生态关键声明',
    evidence: rules.docSources,
    details: docCheck.passed ? '全部命中' : `缺失: ${docCheck.missing.join(', ')}`,
  });

  for (const component of rules.components) {
    if (component.file) {
      const exists = existsPath(component.file);
      checks.push({
        id: `gateway-component-file-${component.name}`,
        required: true,
        passed: exists,
        message: `${component.name} 文件存在`,
        evidence: [component.file],
      });

      if (exists && component.mustContain && component.mustContain.length > 0) {
        const text = safeReadUtf8(component.file);
        const contains = checkContainsAll(text, component.mustContain);
        checks.push({
          id: `gateway-component-token-${component.name}`,
          required: true,
          passed: contains.passed,
          message: `${component.name} 包含关键实现标记`,
          evidence: component.mustContain,
          details: contains.passed ? '全部命中' : `缺失: ${contains.missing.join(', ')}`,
        });
      }
    } else if (component.files) {
      const missing = component.files.filter((f) => !existsPath(f));
      checks.push({
        id: `gateway-component-files-${component.name}`,
        required: true,
        passed: missing.length === 0,
        message: `${component.name} 组件文件完整`,
        evidence: component.files,
        details: missing.length === 0 ? '全部存在' : `缺失: ${missing.join(', ')}`,
      });
    }
  }

  const score = scoreFromChecks(checks);
  const passedChecks = checks.filter((c) => c.required !== false && c.passed).length;
  const totalChecks = checks.filter((c) => c.required !== false).length;

  return {
    score: toFixed2(score),
    status: dimensionStatus(score, thresholds),
    components: rules.components.length,
    passed_checks: passedChecks,
    total_checks: totalChecks,
    failed_checks: checks.filter((c) => c.required !== false && !c.passed),
    checks,
  };
}

function runMcpToolLibraryCheck(rules, thresholds) {
  const checks = [];

  const docsText = joinDocContents(rules.docSources);
  const requiredDocTokens = ['MC-001', 'MC-002', 'MC-003', 'MC-004', 'MC-005'];
  const tokenCheck = checkContainsAll(docsText, requiredDocTokens);

  checks.push({
    id: 'mcp-doc-index-coverage',
    required: true,
    passed: tokenCheck.passed,
    message: '文档索引包含MC-001到MC-005',
    evidence: rules.docSources,
    details: tokenCheck.passed ? '全部命中' : `缺失: ${tokenCheck.missing.join(', ')}`,
  });

  for (const doc of rules.requiredDocs) {
    const exists = existsPath(doc);
    checks.push({
      id: `mcp-doc-exists-${path.basename(doc)}`,
      required: true,
      passed: exists,
      message: `${path.basename(doc)} 存在`,
      evidence: [doc],
    });

    if (exists) {
      const nonWhitespaceChars = safeReadUtf8(doc).replace(/\s+/g, '').length;
      checks.push({
        id: `mcp-doc-content-${path.basename(doc)}`,
        required: true,
        passed: nonWhitespaceChars >= rules.minNonWhitespaceChars,
        message: `${path.basename(doc)} 内容完整度达标`,
        evidence: [`minNonWhitespaceChars=${rules.minNonWhitespaceChars}`],
        details: `current=${nonWhitespaceChars}`,
      });
    }
  }

  const score = scoreFromChecks(checks);
  const passedChecks = checks.filter((c) => c.required !== false && c.passed).length;
  const totalChecks = checks.filter((c) => c.required !== false).length;

  return {
    score: toFixed2(score),
    status: dimensionStatus(score, thresholds),
    required_docs: rules.requiredDocs.length,
    found_docs: rules.requiredDocs.filter((d) => existsPath(d)).length,
    passed_checks: passedChecks,
    total_checks: totalChecks,
    failed_checks: checks.filter((c) => c.required !== false && !c.passed),
    checks,
  };
}

function runPluginSystemCheck(rules, thresholds) {
  const checks = [];

  const docsText = joinDocContents(rules.docSources);
  const docTokens = ['PluginType(9)', 'PluginKind(6)'];
  const docCheck = checkContainsAll(docsText, docTokens);

  checks.push({
    id: 'plugin-doc-declaration',
    required: true,
    passed: docCheck.passed,
    message: '文档声明包含PluginType/PluginKind数量',
    evidence: rules.docSources,
    details: docCheck.passed ? '全部命中' : `缺失: ${docCheck.missing.join(', ')}`,
  });

  const pluginTypeContent = safeReadUtf8(rules.pluginTypeFile);
  const pluginKindContent = safeReadUtf8(rules.pluginKindFile);
  const managerContent = safeReadUtf8(rules.pluginManagerFile);

  checks.push({
    id: 'plugin-type-file',
    required: true,
    passed: existsPath(rules.pluginTypeFile),
    message: 'PluginType 文件存在',
    evidence: [rules.pluginTypeFile],
  });

  checks.push({
    id: 'plugin-kind-file',
    required: true,
    passed: existsPath(rules.pluginKindFile),
    message: 'PluginKind 文件存在',
    evidence: [rules.pluginKindFile],
  });

  const parsedTypes = parseEnumValues(pluginTypeContent, 'PluginType');
  const parsedKinds = parseUnionValues(pluginKindContent, 'PluginKind');

  const missingTypes = rules.expectedPluginTypes.filter((t) => !parsedTypes.includes(t));
  const missingKinds = rules.expectedPluginKinds.filter((k) => !parsedKinds.includes(k));

  checks.push({
    id: 'plugin-type-members',
    required: true,
    passed: missingTypes.length === 0 && parsedTypes.length === rules.expectedPluginTypes.length,
    message: 'PluginType 定义与预期一致',
    evidence: rules.expectedPluginTypes,
    details: `parsed=${parsedTypes.length}, missing=${missingTypes.join(',') || 'none'}`,
  });

  checks.push({
    id: 'plugin-kind-members',
    required: true,
    passed: missingKinds.length === 0 && parsedKinds.length === rules.expectedPluginKinds.length,
    message: 'PluginKind 定义与预期一致',
    evidence: rules.expectedPluginKinds,
    details: `parsed=${parsedKinds.length}, missing=${missingKinds.join(',') || 'none'}`,
  });

  for (const method of rules.hotReloadMethods) {
    checks.push({
      id: `plugin-manager-method-${method}`,
      required: true,
      passed: managerContent.includes(method),
      message: `PluginManager 包含 ${method}`,
      evidence: [rules.pluginManagerFile, method],
    });
  }

  const score = scoreFromChecks(checks);
  const passedChecks = checks.filter((c) => c.required !== false && c.passed).length;
  const totalChecks = checks.filter((c) => c.required !== false).length;

  return {
    score: toFixed2(score),
    status: dimensionStatus(score, thresholds),
    plugin_type_count: parsedTypes.length,
    plugin_kind_count: parsedKinds.length,
    passed_checks: passedChecks,
    total_checks: totalChecks,
    failed_checks: checks.filter((c) => c.required !== false && !c.passed),
    checks,
  };
}

function runCoreDocumentAlignmentCheck(rules, thresholds) {
  const checks = [];

  for (const file of rules.coreFiles) {
    checks.push({
      id: `core-doc-exists-${file}`,
      required: true,
      passed: existsPath(file),
      message: `${file} 存在`,
      evidence: [file],
    });
  }

  for (const [file, requiredTokens] of Object.entries(rules.requiredTokensByFile || {})) {
    const content = safeReadUtf8(file);
    const missing = (requiredTokens || []).filter((token) => !content.includes(token));
    checks.push({
      id: `core-doc-required-token-${file}`,
      required: true,
      passed: missing.length === 0,
      message: `${file} 包含必需关键字`,
      evidence: requiredTokens,
      details: missing.length === 0 ? '全部命中' : `缺失: ${missing.join(', ')}`,
    });
  }

  for (const [file, forbiddenTokens] of Object.entries(rules.forbiddenTokensByFile || {})) {
    const content = safeReadUtf8(file);
    const hit = (forbiddenTokens || []).filter((token) => content.includes(token));
    checks.push({
      id: `core-doc-forbidden-token-${file}`,
      required: true,
      passed: hit.length === 0,
      message: `${file} 不包含禁用关键字`,
      evidence: forbiddenTokens,
      details: hit.length === 0 ? '未命中' : `命中: ${hit.join(', ')}`,
    });
  }

  for (const item of rules.frontendPathDualEnvDocs || []) {
    const content = safeReadUtf8(item.file);
    const hasLinux = content.includes(item.linuxPath);
    const hasWindows = content.includes(item.windowsPath);
    checks.push({
      id: `core-doc-dual-env-path-${item.file}`,
      required: true,
      passed: hasLinux && hasWindows,
      message: `${item.file} 包含前端双环境路径说明`,
      evidence: [item.linuxPath, item.windowsPath],
      details: `linux=${hasLinux}, windows=${hasWindows}`,
    });
  }

  const score = scoreFromChecks(checks);
  const passedChecks = checks.filter((c) => c.required !== false && c.passed).length;
  const totalChecks = checks.filter((c) => c.required !== false).length;

  return {
    score: toFixed2(score),
    status: dimensionStatus(score, thresholds),
    docs: (rules.coreFiles || []).length,
    passed_checks: passedChecks,
    total_checks: totalChecks,
    failed_checks: checks.filter((c) => c.required !== false && !c.passed),
    checks,
  };
}

function buildRecommendations(dimensionResults) {
  const recommendations = [];

  for (const [dimensionKey, dimensionResult] of Object.entries(dimensionResults)) {
    for (const failed of dimensionResult.failed_checks || []) {
      recommendations.push({
        dimension: dimensionKey,
        action: failed.message,
        detail: failed.details || '',
        evidence: failed.evidence || [],
      });
    }
  }

  if (recommendations.length === 0) {
    recommendations.push({
      dimension: 'all',
      action: '当前所有必选一致性检查均通过，建议维持每次变更后自动检查。',
      detail: '',
      evidence: [],
    });
  }

  return recommendations;
}

function buildReport(ruleConfig, dimensionResults) {
  const weightedEntries = Object.entries(dimensionResults).map(([key, result]) => {
    const weight = ruleConfig.weights[key] || 0;
    return {
      key,
      score: result.score,
      weight,
      weightedScore: result.score * weight,
    };
  });

  const weightSum = weightedEntries.reduce((sum, e) => sum + e.weight, 0) || 1;
  const consistencyScore = toFixed2(weightedEntries.reduce((sum, e) => sum + e.weightedScore, 0) / weightSum);

  const failedChecksTotal = Object.values(dimensionResults)
    .reduce((sum, d) => sum + (d.failed_checks || []).length, 0);

  const status = dimensionStatus(consistencyScore, ruleConfig.thresholds);

  return {
    timestamp: new Date().toISOString(),
    rules_version: ruleConfig.version,
    consistency_score: consistencyScore,
    status,
    thresholds: ruleConfig.thresholds,
    failed_checks_total: failedChecksTotal,
    check_dimensions: dimensionResults,
    recommendations: buildRecommendations(dimensionResults),
  };
}

function renderHtml(report, templatePath) {
  const template = readUtf8(templatePath);
  const statusTextMap = { ok: 'PASS', warn: 'WARN', bad: 'FAIL' };

  const dimensionRows = Object.entries(report.check_dimensions)
    .map(([name, dim]) => {
      const badgeClass = dim.status;
      const badgeText = statusTextMap[dim.status] || dim.status;
      const failedCount = (dim.failed_checks || []).length;
      const note = failedCount === 0 ? '无失败项' : `失败项 ${failedCount} 个`;
      return `
        <tr>
          <td><code>${name}</code></td>
          <td>${dim.score.toFixed(2)}</td>
          <td><span class="badge ${badgeClass}">${badgeText}</span></td>
          <td>${dim.passed_checks}/${dim.total_checks}</td>
          <td>${note}</td>
        </tr>
      `;
    })
    .join('');

  const findingRows = Object.entries(report.check_dimensions)
    .map(([name, dim]) => {
      const fails = dim.failed_checks || [];
      if (fails.length === 0) {
        return `<div class="empty"><code>${name}</code>：无失败项。</div>`;
      }
      const list = fails
        .map((f) => `<li><code>${f.id}</code> - ${f.message}${f.details ? ` (${f.details})` : ''}</li>`)
        .join('');
      return `<div><div class="empty"><strong>${name}</strong></div><ul>${list}</ul></div>`;
    })
    .join('');

  const recommendationRows = report.recommendations.length === 0
    ? '<div class="empty">无建议。</div>'
    : `<ul>${report.recommendations.map((r) => `<li><code>${r.dimension}</code> - ${r.action}${r.detail ? ` (${r.detail})` : ''}</li>`).join('')}</ul>`;

  return template
    .replace('{{GENERATED_AT}}', report.timestamp)
    .replace('{{RULES_VERSION}}', report.rules_version)
    .replace('{{TOTAL_SCORE}}', report.consistency_score.toFixed(2))
    .replace('{{STATUS_CLASS}}', report.status)
    .replace('{{STATUS_TEXT}}', statusTextMap[report.status] || report.status)
    .replace('{{DIMENSION_COUNT}}', String(Object.keys(report.check_dimensions).length))
    .replace('{{FAILED_CHECKS}}', String(report.failed_checks_total))
    .replace('{{DIMENSION_ROWS}}', dimensionRows)
    .replace('{{FINDING_ROWS}}', findingRows)
    .replace('{{RECOMMENDATION_ROWS}}', recommendationRows);
}

function loadRules(rulesPath) {
  const p = resolvePath(rulesPath);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function runConsistencyCheck(ruleConfig) {
  const thresholds = ruleConfig.thresholds;

  const dimensions = {
    seven_layer_architecture: runSevenLayerArchitectureCheck(ruleConfig.sevenLayerArchitecture, thresholds),
    agent_three_tier_architecture: runAgentThreeTierCheck(ruleConfig.agentThreeTierArchitecture, thresholds),
    gateway_ecosystem: runGatewayEcosystemCheck(ruleConfig.gatewayEcosystem, thresholds),
    mcp_tool_library: runMcpToolLibraryCheck(ruleConfig.mcpToolLibrary, thresholds),
    plugin_system: runPluginSystemCheck(ruleConfig.pluginSystem, thresholds),
    core_document_alignment: runCoreDocumentAlignmentCheck(ruleConfig.coreDocumentAlignment, thresholds),
  };

  return buildReport(ruleConfig, dimensions);
}

function parseArgs(argv) {
  const options = {
    rules: 'config/consistency-rules.json',
    outputJson: null,
    outputHtml: null,
    template: 'templates/consistency-report.html',
    jsonOnly: false,
    quiet: false,
    strict: false,
    timeoutMs: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--rules') options.rules = argv[++i];
    else if (arg === '--output') options.outputJson = argv[++i];
    else if (arg === '--html') options.outputHtml = argv[++i];
    else if (arg === '--template') options.template = argv[++i];
    else if (arg === '--json-only') options.jsonOnly = true;
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '--strict') options.strict = true;
    else if (arg === '--timeout-ms') options.timeoutMs = Number(argv[++i]);
  }

  return options;
}

function main() {
  try {
    const startedAt = Date.now();
    const options = parseArgs(process.argv.slice(2));
    const rules = loadRules(options.rules);
    const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
      ? options.timeoutMs
      : Number(rules.execution?.timeoutMs) || 120000;
    const report = runConsistencyCheck(rules);
    const durationMs = Date.now() - startedAt;
    const timeoutExceeded = durationMs > timeoutMs;

    report.duration_ms = durationMs;
    report.timeout_ms = timeoutMs;
    report.timeout_exceeded = timeoutExceeded;

    if (timeoutExceeded) {
      report.recommendations.push({
        dimension: 'execution',
        action: '一致性检查耗时超过超时阈值',
        detail: `duration=${durationMs}ms, timeout=${timeoutMs}ms`,
        evidence: ['--timeout-ms', 'config.consistency-rules.execution.timeoutMs'],
      });
    }

    const jsonPath = options.outputJson || rules.report.json;
    const htmlPath = options.outputHtml || rules.report.html;

    ensureParentDir(jsonPath);
    fs.writeFileSync(resolvePath(jsonPath), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    if (!options.jsonOnly) {
      ensureParentDir(htmlPath);
      const html = renderHtml(report, options.template);
      fs.writeFileSync(resolvePath(htmlPath), html, 'utf8');
    }

    if (!options.quiet) {
      const statusText = { ok: 'PASS', warn: 'WARN', bad: 'FAIL' }[report.status] || report.status;
      console.log('📊 文档-代码一致性检查报告');
      console.log(`- 时间: ${report.timestamp}`);
      console.log(`- 一致性分数: ${report.consistency_score.toFixed(2)}`);
      console.log(`- 状态: ${statusText}`);
      console.log(`- 失败检查项: ${report.failed_checks_total}`);
      console.log(`- 耗时: ${durationMs}ms`);
      if (timeoutExceeded) {
        console.log(`- 超时状态: 超过阈值(${timeoutMs}ms)`);
      }
      console.log(`- JSON报告: ${resolvePath(jsonPath)}`);
      if (!options.jsonOnly) {
        console.log(`- HTML报告: ${resolvePath(htmlPath)}`);
      }
    }

    if (options.strict) {
      const hasFailedChecks = report.failed_checks_total > 0;
      const belowPassThreshold = report.consistency_score < rules.thresholds.pass;
      if (hasFailedChecks || belowPassThreshold || timeoutExceeded) {
        process.exitCode = 1;
      }
    }
  } catch (error) {
    console.error('❌ 一致性检查脚本执行失败');
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  loadRules,
  parseEnumValues,
  parseUnionValues,
  runConsistencyCheck,
  buildReport,
};
