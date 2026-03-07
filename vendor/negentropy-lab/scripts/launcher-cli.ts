#!/usr/bin/env node
/**
 * Negentropy-Lab unified launcher CLI.
 */

import {
  createLauncher,
  Launcher,
  type LauncherConfig,
  type LaunchMode,
  type DecisionMode,
  type ServiceLogFilter,
} from './launcher';

interface CLIArgs {
  command: 'start' | 'stop' | 'status' | 'health' | 'preflight' | 'help';
  mode?: LaunchMode;
  decision?: DecisionMode;
  port?: number;
  openclawPort?: number;
  openclawPath?: string;
  negentropyCmd?: string;
  openclawCmd?: string;
  noOpenclaw?: boolean;
  noHealthCheck?: boolean;
  noAutoResolvePorts?: boolean;
  logLevel?: string;
  logFilter?: ServiceLogFilter;
  env?: Record<string, string>;
}

function parseArgs(argv: string[]): CLIArgs {
  const args: CLIArgs = { command: 'help' };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === 'start' || arg === 'stop' || arg === 'status' || arg === 'health' || arg === 'preflight' || arg === 'help') {
      args.command = arg;
      continue;
    }

    if (arg.startsWith('--mode=')) {
      const value = arg.split('=')[1] as LaunchMode;
      if (['dev', 'staging', 'production'].includes(value)) {
        args.mode = value;
      } else {
        console.error(`invalid mode: ${value}`);
        process.exit(1);
      }
      continue;
    }

    if (arg.startsWith('--decision=')) {
      const value = arg.split('=')[1] as DecisionMode;
      if (['OFF', 'SHADOW', 'ENFORCE'].includes(value)) {
        args.decision = value;
      } else {
        console.error(`invalid decision mode: ${value}`);
        process.exit(1);
      }
      continue;
    }

    if (arg.startsWith('--port=')) {
      const value = Number.parseInt(arg.split('=')[1] || '', 10);
      if (value > 0 && value < 65536) {
        args.port = value;
      } else {
        console.error(`invalid port: ${arg.split('=')[1]}`);
        process.exit(1);
      }
      continue;
    }

    if (arg.startsWith('--openclaw-port=')) {
      const value = Number.parseInt(arg.split('=')[1] || '', 10);
      if (value > 0 && value < 65536) {
        args.openclawPort = value;
      } else {
        console.error(`invalid openclaw port: ${arg.split('=')[1]}`);
        process.exit(1);
      }
      continue;
    }

    if (arg.startsWith('--openclaw-path=')) {
      args.openclawPath = arg.slice('--openclaw-path='.length);
      continue;
    }

    if (arg.startsWith('--negentropy-cmd=')) {
      args.negentropyCmd = arg.slice('--negentropy-cmd='.length);
      continue;
    }

    if (arg.startsWith('--openclaw-cmd=')) {
      args.openclawCmd = arg.slice('--openclaw-cmd='.length);
      continue;
    }

    if (arg.startsWith('--log-level=')) {
      args.logLevel = arg.split('=')[1];
      continue;
    }

    if (arg.startsWith('--log-filter=')) {
      const filter = arg.split('=')[1] as ServiceLogFilter;
      if (filter === 'all' || filter === 'negentropy' || filter === 'openclaw') {
        args.logFilter = filter;
      } else {
        console.error(`invalid log filter: ${filter}`);
        process.exit(1);
      }
      continue;
    }

    if (arg === '--no-openclaw' || arg === '--no-colyseus') {
      args.noOpenclaw = true;
      continue;
    }

    if (arg === '--no-health-check') {
      args.noHealthCheck = true;
      continue;
    }

    if (arg === '--no-auto-resolve-ports') {
      args.noAutoResolvePorts = true;
      continue;
    }

    if (arg === '--env' && i + 1 < argv.length) {
      const pair = argv[++i];
      const [key, ...valueParts] = pair.split('=');
      if (key && valueParts.length > 0) {
        args.env = args.env || {};
        args.env[key] = valueParts.join('=');
      }
      continue;
    }

    if (arg === '-m' && i + 1 < argv.length) {
      args.mode = argv[++i] as LaunchMode;
      continue;
    }
    if (arg === '-d' && i + 1 < argv.length) {
      args.decision = argv[++i] as DecisionMode;
      continue;
    }
    if (arg === '-p' && i + 1 < argv.length) {
      const value = Number.parseInt(argv[++i] || '', 10);
      if (!Number.isNaN(value)) args.port = value;
      continue;
    }
    if (arg === '-h' || arg === '--help') {
      args.command = 'help';
      break;
    }
  }

  return args;
}

function showHelp(): void {
  console.log(`
Negentropy-Lab Unified Launcher v2.0.0

Usage:
  npm run launch -- <command> [options]

Commands:
  start       Start services (negentropy -> openclaw)
  stop        Stop services (openclaw -> negentropy)
  status      Show runtime status
  health      Check service health
  preflight   Validate launch environment
  help        Show this message

Options:
  --mode, -m <mode>            dev | staging | production
  --decision, -d <mode>        OFF | SHADOW | ENFORCE
  --port, -p <port>            Negentropy port (default: 3000)
  --openclaw-port <port>       OpenClaw gateway port (default: 18789)
  --openclaw-path <path>       OpenClaw project directory
  --negentropy-cmd <cmd>       Override Negentropy command
  --openclaw-cmd <cmd>         Override OpenClaw command
  --no-openclaw                Disable OpenClaw process
  --no-auto-resolve-ports      Disable automatic port fallback
  --no-health-check            Disable startup health checks
  --log-level <level>          debug | info | warn | error
  --log-filter <scope>         all | negentropy | openclaw
  --env KEY=VALUE              Set environment variable (repeatable)
  -h, --help                   Show this message

Examples:
  npm run launch -- start
  npm run launch -- start --mode=production --decision=ENFORCE
  npm run launch -- start --openclaw-path=D:/Games/openclaw
  npm run launch -- start --port=3100 --openclaw-port=19001
  npm run launch -- status
  npm run launch -- stop
`);
}

function buildConfigFromArgs(args: CLIArgs): Partial<LauncherConfig> {
  const config: Partial<LauncherConfig> = {};

  if (args.mode) config.mode = args.mode;
  if (args.decision) config.decisionMode = args.decision;
  if (args.logLevel) config.logLevel = args.logLevel;
  if (args.logFilter) config.logFilter = args.logFilter;
  if (args.noHealthCheck) config.healthCheck = false;
  if (args.noAutoResolvePorts) config.autoResolvePorts = false;
  if (args.env) config.envOverrides = args.env;

  if (args.port) {
    config.port = args.port;
    config.negentropy = { ...(config.negentropy || {}), port: args.port };
  }

  if (args.openclawPort) {
    config.openclaw = { ...(config.openclaw || {}), port: args.openclawPort };
  }

  if (args.openclawPath) {
    config.openclawPath = args.openclawPath;
    config.openclaw = { ...(config.openclaw || {}), cwd: args.openclawPath };
  }

  if (args.negentropyCmd) {
    config.negentropy = { ...(config.negentropy || {}), command: args.negentropyCmd };
  }

  if (args.openclawCmd) {
    config.openclaw = { ...(config.openclaw || {}), command: args.openclawCmd };
  }

  if (args.noOpenclaw) {
    config.enableOpenclaw = false;
    config.enableColyseus = false;
    config.openclaw = { ...(config.openclaw || {}), enabled: false };
  }

  return config;
}

function runtimeAwareConfig(): Partial<LauncherConfig> | undefined {
  const runtimeConfig = Launcher.loadRuntimeConfig();
  const runtimeState = Launcher.loadRuntimeState();
  if (!runtimeConfig && !runtimeState) return undefined;

  const base = runtimeConfig || runtimeState!.config;
  const merged: Partial<LauncherConfig> = { ...base };

  if (runtimeState) {
    merged.negentropy = {
      ...base.negentropy,
      port: runtimeState.services.negentropy.resolvedPort,
    };
    merged.openclaw = {
      ...base.openclaw,
      port: runtimeState.services.openclaw.resolvedPort,
    };
    merged.port = runtimeState.services.negentropy.resolvedPort;
  }

  return merged;
}

async function cmdStart(args: CLIArgs): Promise<void> {
  const config = buildConfigFromArgs(args);
  const launcher = createLauncher(config);
  await launcher.launch();
}

async function cmdStop(): Promise<void> {
  const result = await Launcher.stopAll();
  if (result.stopped.length > 0) {
    console.log(`[Launcher] stopped ${result.stopped.length} processes`);
  }
  if (result.failed.length > 0) {
    console.error(`[Launcher] ${result.failed.length} processes failed to stop`);
  }
  process.exit(result.success ? 0 : 1);
}

async function cmdStatus(): Promise<void> {
  const launcher = createLauncher(runtimeAwareConfig());
  const status = await launcher.getStatus();

  console.log('\nNegentropy-Lab Runtime Status\n');
  console.log(`  launcher: ${status.running ? 'running' : 'stopped'}`);
  if (status.pid) {
    console.log(`  launcher pid: ${status.pid}`);
  }
  if (status.startedAt) {
    console.log(`  started at: ${new Date(status.startedAt).toISOString()}`);
  }
  console.log(`  mode: ${status.config.mode}`);
  console.log(`  decision: ${status.config.decisionMode}`);
  console.log('');

  for (const name of ['negentropy', 'openclaw'] as const) {
    const svc = status.services[name];
    console.log(`  [${name}]`);
    console.log(`    enabled: ${svc.enabled}`);
    console.log(`    running: ${svc.running}`);
    console.log(`    pid: ${svc.pid ?? '-'}`);
    console.log(`    port: ${svc.resolvedPort} (requested: ${svc.requestedPort})`);
    console.log(`    cwd: ${svc.cwd}`);
    console.log(`    cmd: ${svc.command}`);
  }
  console.log('');
  process.exit(0);
}

async function cmdHealth(): Promise<void> {
  const launcher = createLauncher(runtimeAwareConfig());
  const health = await launcher.performHealthCheck();

  console.log('\nNegentropy-Lab Health Check\n');
  console.log(`  overall: ${health.healthy ? 'healthy' : 'unhealthy'}`);
  console.log('');

  for (const name of ['negentropy', 'openclaw'] as const) {
    const item = health.details[name];
    console.log(`  [${name}]`);
    console.log(`    enabled: ${item.enabled}`);
    console.log(`    healthy: ${item.healthy}`);
    console.log(`    url: ${item.url}`);
    if (item.statusCode !== undefined) {
      console.log(`    statusCode: ${item.statusCode}`);
    }
    if (item.error) {
      console.log(`    error: ${item.error}`);
    }
  }
  console.log('');

  process.exit(health.healthy ? 0 : 1);
}

async function cmdPreflight(args: CLIArgs): Promise<void> {
  const launcher = createLauncher(buildConfigFromArgs(args));
  const result = await launcher.preflight();

  console.log('\nNegentropy-Lab Preflight\n');
  console.log(`  success: ${result.success}`);
  console.log(`  resolved ports: negentropy=${result.ports.negentropy}, openclaw=${result.ports.openclaw}`);

  if (result.errors.length > 0) {
    console.log('\n  errors:');
    for (const err of result.errors) {
      console.log(`    - ${err}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log('\n  warnings:');
    for (const warn of result.warnings) {
      console.log(`    - ${warn}`);
    }
  }
  console.log('');

  process.exit(result.success ? 0 : 1);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  switch (args.command) {
    case 'start':
      await cmdStart(args);
      break;
    case 'stop':
      await cmdStop();
      break;
    case 'status':
      await cmdStatus();
      break;
    case 'health':
      await cmdHealth();
      break;
    case 'preflight':
      await cmdPreflight(args);
      break;
    case 'help':
    default:
      showHelp();
      break;
  }
}

main().catch((err) => {
  console.error('[Launcher] CLI error:', err);
  process.exit(1);
});
