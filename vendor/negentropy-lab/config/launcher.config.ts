/**
 * Unified launcher config helpers.
 */

import type {
  LauncherConfig,
  LaunchMode,
  DecisionMode,
  ServiceLogFilter,
} from '../scripts/launcher';

export const PRESETS: Record<string, Partial<LauncherConfig>> = {
  dev: {
    mode: 'dev',
    decisionMode: 'OFF',
    port: 3000,
    enableOpenclaw: true,
    healthCheck: true,
    logLevel: 'debug',
    negentropy: { port: 3000 },
    openclaw: { port: 18789, enabled: true },
  },
  'dev-shadow': {
    mode: 'dev',
    decisionMode: 'SHADOW',
    port: 3000,
    enableOpenclaw: true,
    healthCheck: true,
    logLevel: 'debug',
    negentropy: { port: 3000 },
    openclaw: { port: 18789, enabled: true },
  },
  staging: {
    mode: 'staging',
    decisionMode: 'SHADOW',
    port: 3000,
    enableOpenclaw: true,
    healthCheck: true,
    logLevel: 'info',
    negentropy: { port: 3000 },
    openclaw: { port: 18789, enabled: true },
  },
  production: {
    mode: 'production',
    decisionMode: 'ENFORCE',
    port: 3000,
    enableOpenclaw: true,
    healthCheck: true,
    logLevel: 'warn',
    negentropy: { port: 3000 },
    openclaw: { port: 18789, enabled: true },
  },
  minimal: {
    mode: 'dev',
    decisionMode: 'OFF',
    port: 3000,
    enableOpenclaw: false,
    healthCheck: false,
    logLevel: 'info',
    negentropy: { port: 3000, enabled: true },
    openclaw: { enabled: false },
  },
};

// Legacy-friendly map retained for compatibility.
export const ENV_MAPPINGS: Record<string, string> = {
  LAUNCHER_MODE: 'mode',
  LAUNCHER_DECISION_MODE: 'decisionMode',
  LAUNCHER_PORT: 'port',
  LAUNCHER_NEGENTROPY_PORT: 'negentropy.port',
  LAUNCHER_OPENCLAW_PORT: 'openclaw.port',
  LAUNCHER_OPENCLAW_PATH: 'openclawPath',
  OPENCLAW_PROJECT_PATH: 'openclawPath',
  LAUNCHER_ENABLE_OPENCLAW: 'enableOpenclaw',
  LAUNCHER_HEALTH_CHECK: 'healthCheck',
  LAUNCHER_LOG_LEVEL: 'logLevel',
  LAUNCHER_LOG_FILTER: 'logFilter',
  LAUNCHER_AUTO_RESOLVE_PORTS: 'autoResolvePorts',
  LAUNCHER_PORT_SCAN_RANGE: 'portScanRange',
  LAUNCHER_NEGENTROPY_CMD: 'negentropy.command',
  LAUNCHER_OPENCLAW_CMD: 'openclaw.command',
};

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

function parsePort(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const port = Number.parseInt(value, 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) return undefined;
  return port;
}

export function loadFromEnv(): Partial<LauncherConfig> {
  const config: Partial<LauncherConfig> = {};

  const mode = process.env.LAUNCHER_MODE;
  if (mode && ['dev', 'staging', 'production'].includes(mode)) {
    config.mode = mode as LaunchMode;
  }

  const decision = process.env.LAUNCHER_DECISION_MODE;
  if (decision && ['OFF', 'SHADOW', 'ENFORCE'].includes(decision)) {
    config.decisionMode = decision as DecisionMode;
  }

  const logFilter = process.env.LAUNCHER_LOG_FILTER;
  if (logFilter && ['all', 'negentropy', 'openclaw'].includes(logFilter)) {
    config.logFilter = logFilter as ServiceLogFilter;
  }

  const mainPort = parsePort(process.env.LAUNCHER_PORT);
  const negentropyPort = parsePort(process.env.LAUNCHER_NEGENTROPY_PORT);
  const openclawPort = parsePort(process.env.LAUNCHER_OPENCLAW_PORT);

  if (mainPort) {
    config.port = mainPort;
    config.negentropy = { ...(config.negentropy || {}), port: mainPort };
  }
  if (negentropyPort) {
    config.negentropy = { ...(config.negentropy || {}), port: negentropyPort };
  }
  if (openclawPort) {
    config.openclaw = { ...(config.openclaw || {}), port: openclawPort };
  }

  const openclawPath = process.env.LAUNCHER_OPENCLAW_PATH || process.env.OPENCLAW_PROJECT_PATH;
  if (openclawPath) {
    config.openclawPath = openclawPath;
    config.openclaw = { ...(config.openclaw || {}), cwd: openclawPath };
  }

  if (process.env.LAUNCHER_NEGENTROPY_CMD) {
    config.negentropy = {
      ...(config.negentropy || {}),
      command: process.env.LAUNCHER_NEGENTROPY_CMD,
    };
  }
  if (process.env.LAUNCHER_OPENCLAW_CMD) {
    config.openclaw = {
      ...(config.openclaw || {}),
      command: process.env.LAUNCHER_OPENCLAW_CMD,
    };
  }

  const enableOpenclaw = parseBoolean(process.env.LAUNCHER_ENABLE_OPENCLAW);
  if (enableOpenclaw !== undefined) {
    config.enableOpenclaw = enableOpenclaw;
    config.openclaw = { ...(config.openclaw || {}), enabled: enableOpenclaw };
  }

  const healthCheck = parseBoolean(process.env.LAUNCHER_HEALTH_CHECK);
  if (healthCheck !== undefined) config.healthCheck = healthCheck;

  const autoResolve = parseBoolean(process.env.LAUNCHER_AUTO_RESOLVE_PORTS);
  if (autoResolve !== undefined) config.autoResolvePorts = autoResolve;

  if (process.env.LAUNCHER_LOG_LEVEL) config.logLevel = process.env.LAUNCHER_LOG_LEVEL;
  if (process.env.LAUNCHER_LOG_DIR) config.logDir = process.env.LAUNCHER_LOG_DIR;

  const portScanRange = Number.parseInt(process.env.LAUNCHER_PORT_SCAN_RANGE || '', 10);
  if (!Number.isNaN(portScanRange) && portScanRange >= 0) {
    config.portScanRange = portScanRange;
  }

  return config;
}

export function loadConfigFile(path: string): Partial<LauncherConfig> | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const loaded = require(path);
    return loaded?.default || loaded || null;
  } catch {
    return null;
  }
}

export function mergeConfig(
  preset?: string,
  configFile?: Partial<LauncherConfig>,
  env?: Partial<LauncherConfig>,
  cli?: Partial<LauncherConfig>,
): Partial<LauncherConfig> {
  const merged = {
    ...(preset ? PRESETS[preset] : {}),
    ...(configFile || {}),
    ...(env || {}),
    ...(cli || {}),
  } as Partial<LauncherConfig>;

  if (configFile?.negentropy || env?.negentropy || cli?.negentropy) {
    merged.negentropy = {
      ...(preset ? PRESETS[preset]?.negentropy || {} : {}),
      ...(configFile?.negentropy || {}),
      ...(env?.negentropy || {}),
      ...(cli?.negentropy || {}),
    };
  }

  if (configFile?.openclaw || env?.openclaw || cli?.openclaw) {
    merged.openclaw = {
      ...(preset ? PRESETS[preset]?.openclaw || {} : {}),
      ...(configFile?.openclaw || {}),
      ...(env?.openclaw || {}),
      ...(cli?.openclaw || {}),
    };
  }

  return merged;
}

export function getConfig(options: {
  preset?: string;
  configFile?: string;
  cliArgs?: Partial<LauncherConfig>;
}): Partial<LauncherConfig> {
  const envConfig = loadFromEnv();
  const fileConfig = options.configFile ? loadConfigFile(options.configFile) : null;
  return mergeConfig(options.preset, fileConfig || undefined, envConfig, options.cliArgs);
}

export function validateConfig(config: Partial<LauncherConfig>): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (config.mode && !['dev', 'staging', 'production'].includes(config.mode)) {
    errors.push(`invalid mode: ${config.mode}`);
  }

  if (config.decisionMode && !['OFF', 'SHADOW', 'ENFORCE'].includes(config.decisionMode)) {
    errors.push(`invalid decision mode: ${config.decisionMode}`);
  }

  if (config.logFilter && !['all', 'negentropy', 'openclaw'].includes(config.logFilter)) {
    errors.push(`invalid logFilter: ${config.logFilter}`);
  }

  const ports: Array<[string, number | undefined]> = [
    ['port', config.port],
    ['negentropy.port', config.negentropy?.port],
    ['openclaw.port', config.openclaw?.port],
  ];

  for (const [key, value] of ports) {
    if (value === undefined) continue;
    if (!Number.isInteger(value) || value < 1 || value > 65535) {
      errors.push(`invalid ${key}: ${value}`);
    }
  }

  if (config.portScanRange !== undefined && config.portScanRange < 0) {
    errors.push(`invalid portScanRange: ${config.portScanRange}`);
  }

  if (config.mode === 'production' && config.decisionMode === 'SHADOW') {
    warnings.push('production + SHADOW means requests are observed but not rejected');
  }

  if (config.mode === 'dev' && config.decisionMode === 'ENFORCE') {
    warnings.push('dev + ENFORCE may block local debugging requests');
  }

  if (config.openclaw?.enabled && !config.openclaw?.cwd && !config.openclawPath) {
    warnings.push('openclaw is enabled but no openclaw path is configured');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export const CONFIG_DOCS = {
  mode: {
    type: 'string',
    values: ['dev', 'staging', 'production'],
    default: 'dev',
    description: 'Launcher runtime mode',
  },
  decisionMode: {
    type: 'string',
    values: ['OFF', 'SHADOW', 'ENFORCE'],
    default: 'OFF',
    description: 'Negentropy decision mode',
  },
  port: {
    type: 'number',
    range: [1, 65535],
    default: 3000,
    description: 'Negentropy requested port (legacy compatible)',
  },
  negentropyPort: {
    type: 'number',
    range: [1, 65535],
    default: 3000,
    description: 'Negentropy requested port',
  },
  openclawPort: {
    type: 'number',
    range: [1, 65535],
    default: 18789,
    description: 'OpenClaw requested port',
  },
  openclawPath: {
    type: 'string',
    description: 'OpenClaw workspace path',
  },
  autoResolvePorts: {
    type: 'boolean',
    default: true,
    description: 'Automatically switch to next free port if conflict occurs',
  },
  logFilter: {
    type: 'string',
    values: ['all', 'negentropy', 'openclaw'],
    default: 'all',
    description: 'Console log filter by service',
  },
};

export default {
  PRESETS,
  ENV_MAPPINGS,
  loadFromEnv,
  loadConfigFile,
  mergeConfig,
  getConfig,
  validateConfig,
  CONFIG_DOCS,
};
