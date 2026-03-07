/**
 * Negentropy-Lab unified launcher core.
 *
 * This launcher orchestrates two services with dependency order:
 * 1) negentropy
 * 2) openclaw
 */

import { spawn, type ChildProcess, exec } from 'child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
  createWriteStream,
  type WriteStream,
} from 'fs';
import { join, isAbsolute } from 'path';
import net from 'net';

export type LaunchMode = 'dev' | 'staging' | 'production';
export type DecisionMode = 'OFF' | 'SHADOW' | 'ENFORCE';
export type ServiceName = 'negentropy' | 'openclaw';
export type ServiceLogFilter = 'all' | ServiceName;

export interface ManagedServiceConfig {
  enabled: boolean;
  cwd: string;
  command: string;
  port: number;
  healthPath: string;
  startupDelayMs: number;
  envOverrides: Record<string, string>;
}

export interface LauncherConfig {
  mode: LaunchMode;
  decisionMode: DecisionMode;
  healthCheck: boolean;
  logLevel: string;
  logDir: string;
  logFile?: string;
  logFilter: ServiceLogFilter;
  pidFile: string;
  envOverrides: Record<string, string>;
  portScanRange: number;
  autoResolvePorts: boolean;
  openclawPath: string;
  enableOpenclaw: boolean;

  // Backward-compat fields used by previous launcher scripts.
  port: number;
  enableColyseus: boolean;

  negentropy: ManagedServiceConfig;
  openclaw: ManagedServiceConfig;
}

export interface ChildProcessInfo {
  pid: number;
  service: ServiceName;
  command: string;
  cwd: string;
  requestedPort: number;
  resolvedPort: number;
  startTime: number;
}

export interface RuntimeState {
  launcherPid: number;
  startedAt: number;
  config: LauncherConfig;
  services: Record<ServiceName, {
    enabled: boolean;
    requestedPort: number;
    resolvedPort: number;
    command: string;
    cwd: string;
    healthPath: string;
    pid: number | null;
    running: boolean;
  }>;
}

export interface PreflightResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  ports: Record<ServiceName, number>;
}

export interface HealthCheckResult {
  healthy: boolean;
  checks: Record<string, boolean>;
  details: Record<ServiceName, {
    enabled: boolean;
    url: string;
    healthy: boolean;
    statusCode?: number;
    error?: string;
  }>;
}

export interface LauncherStatus {
  running: boolean;
  pid: number | null;
  config: LauncherConfig;
  startedAt?: number;
  services: Record<ServiceName, {
    enabled: boolean;
    pid: number | null;
    running: boolean;
    requestedPort: number;
    resolvedPort: number;
    command: string;
    cwd: string;
  }>;
}

const RUNTIME_DIR = join(process.cwd(), 'storage', 'runtime');
const CONFIG_FILE = join(RUNTIME_DIR, 'launcher-config.json');
const PIDS_FILE = join(RUNTIME_DIR, 'launcher-pids.json');
const STATE_FILE = join(RUNTIME_DIR, 'launcher-state.json');
const DEFAULT_PID_FILE = join(RUNTIME_DIR, 'negentropy.pid');

const SERVICE_START_ORDER: ServiceName[] = ['negentropy', 'openclaw'];
const SERVICE_STOP_ORDER: ServiceName[] = ['openclaw', 'negentropy'];

function timestampForFile(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPositivePort(value: number): boolean {
  return Number.isInteger(value) && value > 0 && value < 65536;
}

function resolveModeServiceCommand(service: ServiceName, mode: LaunchMode): string {
  if (service === 'negentropy') {
    return mode === 'dev' ? 'npx tsx watch server/index.ts' : 'npx tsx server/index.ts';
  }
  // Use a cross-platform gateway entrypoint. Skip-channel env is injected via launcher env overrides.
  return mode === 'dev' ? 'node scripts/run-node.mjs --dev gateway' : 'node scripts/run-node.mjs gateway';
}

const DEFAULT_OPENCLAW_PATH = process.env.OPENCLAW_PROJECT_PATH || 'D:/Games/openclaw';

export const DEFAULT_CONFIG: LauncherConfig = {
  mode: 'dev',
  decisionMode: 'OFF',
  healthCheck: true,
  logLevel: 'info',
  logDir: join(process.cwd(), 'logs', 'launcher'),
  logFilter: 'all',
  pidFile: DEFAULT_PID_FILE,
  envOverrides: {},
  portScanRange: 50,
  autoResolvePorts: true,
  openclawPath: DEFAULT_OPENCLAW_PATH,
  enableOpenclaw: true,

  // Backward compatibility defaults.
  port: 3000,
  enableColyseus: true,

  negentropy: {
    enabled: true,
    cwd: process.cwd(),
    command: resolveModeServiceCommand('negentropy', 'dev'),
    port: 3000,
    healthPath: '/health',
    startupDelayMs: 3500,
    envOverrides: {},
  },
  openclaw: {
    enabled: true,
    cwd: DEFAULT_OPENCLAW_PATH,
    command: resolveModeServiceCommand('openclaw', 'dev'),
    port: 18789,
    healthPath: '/health',
    startupDelayMs: 5000,
    envOverrides: {
      OPENCLAW_SKIP_CHANNELS: '1',
      CLAWDBOT_SKIP_CHANNELS: '1',
    },
  },
};

export const MODE_CONFIGS: Record<LaunchMode, Partial<LauncherConfig>> = {
  dev: {
    logLevel: 'debug',
    healthCheck: true,
  },
  staging: {
    logLevel: 'info',
    healthCheck: true,
  },
  production: {
    logLevel: 'warn',
    healthCheck: true,
  },
};

export class Launcher {
  private config: LauncherConfig;
  private processes = new Map<ServiceName, ChildProcess>();
  private processInfos = new Map<ServiceName, ChildProcessInfo>();
  private isShuttingDown = false;
  private resolvedPorts: Record<ServiceName, number>;
  private logStream: WriteStream | null = null;

  constructor(config: Partial<LauncherConfig> = {}) {
    this.config = Launcher.mergeConfig(DEFAULT_CONFIG, config);
    this.applyModeDefaults();
    this.normalizeCompatibilityFields();
    this.normalizeDerivedFields();
    this.resolvedPorts = {
      negentropy: this.config.negentropy.port,
      openclaw: this.config.openclaw.port,
    };
  }

  private static mergeConfig(base: LauncherConfig, override: Partial<LauncherConfig>): LauncherConfig {
    const mergedNegentropy = {
      ...base.negentropy,
      ...(override.negentropy || {}),
      envOverrides: {
        ...base.negentropy.envOverrides,
        ...(override.negentropy?.envOverrides || {}),
      },
    };

    const mergedOpenclaw = {
      ...base.openclaw,
      ...(override.openclaw || {}),
      envOverrides: {
        ...base.openclaw.envOverrides,
        ...(override.openclaw?.envOverrides || {}),
      },
    };

    return {
      ...base,
      ...override,
      envOverrides: {
        ...base.envOverrides,
        ...(override.envOverrides || {}),
      },
      negentropy: mergedNegentropy,
      openclaw: mergedOpenclaw,
    };
  }

  private applyModeDefaults(): void {
    const modeDefaults = MODE_CONFIGS[this.config.mode];
    if (!modeDefaults) return;
    this.config = Launcher.mergeConfig(this.config, modeDefaults);
  }

  private normalizeCompatibilityFields(): void {
    if (isPositivePort(this.config.port)) {
      this.config.negentropy.port = this.config.port;
    }

    if (this.config.enableColyseus === false) {
      this.config.enableOpenclaw = false;
      this.config.openclaw.enabled = false;
    }

    if (this.config.enableOpenclaw === false) {
      this.config.openclaw.enabled = false;
    }
  }

  private normalizeDerivedFields(): void {
    this.config.openclaw.cwd = this.config.openclaw.cwd || this.config.openclawPath;
    this.config.openclawPath = this.config.openclaw.cwd || this.config.openclawPath;

    if (!this.config.negentropy.command.trim()) {
      this.config.negentropy.command = resolveModeServiceCommand('negentropy', this.config.mode);
    }
    if (!this.config.openclaw.command.trim()) {
      this.config.openclaw.command = resolveModeServiceCommand('openclaw', this.config.mode);
    }
  }

  getConfig(): LauncherConfig {
    return JSON.parse(JSON.stringify(this.config)) as LauncherConfig;
  }

  private getServiceConfig(service: ServiceName): ManagedServiceConfig {
    return this.config[service];
  }

  private isServiceEnabled(service: ServiceName): boolean {
    return this.getServiceConfig(service).enabled;
  }

  private ensureRuntimeDir(): void {
    if (!existsSync(RUNTIME_DIR)) {
      mkdirSync(RUNTIME_DIR, { recursive: true });
    }
  }

  private ensureLogDir(): void {
    if (!existsSync(this.config.logDir)) {
      mkdirSync(this.config.logDir, { recursive: true });
    }
  }

  private setupLogFile(): void {
    this.ensureLogDir();
    const configuredPath = this.config.logFile;
    const logFilePath = configuredPath
      ? (isAbsolute(configuredPath) ? configuredPath : join(this.config.logDir, configuredPath))
      : join(this.config.logDir, `launcher-${timestampForFile()}.log`);
    this.logStream = createWriteStream(logFilePath, { flags: 'a' });
    this.emitLauncherLog('info', `log file: ${logFilePath}`);
  }

  private emitLauncherLog(level: 'info' | 'warn' | 'error', message: string): void {
    const formatted = `[Launcher][${new Date().toISOString()}][${level.toUpperCase()}] ${message}`;
    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
    if (this.logStream) {
      this.logStream.write(`${formatted}\n`);
    }
  }

  private emitServiceLog(service: ServiceName, channel: 'stdout' | 'stderr', message: string): void {
    const line = `[${new Date().toISOString()}][${service}][${channel}] ${message}`;
    if (this.config.logFilter === 'all' || this.config.logFilter === service) {
      if (channel === 'stderr') {
        console.error(line);
      } else {
        console.log(line);
      }
    }
    if (this.logStream) {
      this.logStream.write(`${line}\n`);
    }
  }

  private attachProcessLogs(service: ServiceName, proc: ChildProcess): void {
    let stdoutBuffer = '';
    let stderrBuffer = '';

    proc.stdout?.on('data', (chunk: Buffer | string) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || '';
      for (const line of lines) {
        if (line.length > 0) this.emitServiceLog(service, 'stdout', line);
      }
    });

    proc.stderr?.on('data', (chunk: Buffer | string) => {
      stderrBuffer += chunk.toString();
      const lines = stderrBuffer.split(/\r?\n/);
      stderrBuffer = lines.pop() || '';
      for (const line of lines) {
        if (line.length > 0) this.emitServiceLog(service, 'stderr', line);
      }
    });

    proc.stdout?.on('end', () => {
      if (stdoutBuffer.length > 0) {
        this.emitServiceLog(service, 'stdout', stdoutBuffer);
      }
    });

    proc.stderr?.on('end', () => {
      if (stderrBuffer.length > 0) {
        this.emitServiceLog(service, 'stderr', stderrBuffer);
      }
    });
  }

  private writePidFile(): void {
    this.ensureRuntimeDir();
    writeFileSync(this.config.pidFile, process.pid.toString(), 'utf-8');
  }

  private removePidFile(): void {
    if (existsSync(this.config.pidFile)) {
      unlinkSync(this.config.pidFile);
    }
  }

  readPidFile(): number | null {
    if (!existsSync(this.config.pidFile)) return null;
    const raw = readFileSync(this.config.pidFile, 'utf-8').trim();
    const pid = Number.parseInt(raw, 10);
    return Number.isNaN(pid) ? null : pid;
  }

  private saveRuntimeConfig(): void {
    this.ensureRuntimeDir();
    writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  static loadRuntimeConfig(): LauncherConfig | null {
    try {
      if (!existsSync(CONFIG_FILE)) return null;
      return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) as LauncherConfig;
    } catch {
      return null;
    }
  }

  private saveChildPids(): void {
    const infos = Array.from(this.processInfos.values());
    this.ensureRuntimeDir();
    writeFileSync(PIDS_FILE, JSON.stringify(infos, null, 2), 'utf-8');
  }

  static loadChildPids(): ChildProcessInfo[] {
    try {
      if (!existsSync(PIDS_FILE)) return [];
      return JSON.parse(readFileSync(PIDS_FILE, 'utf-8')) as ChildProcessInfo[];
    } catch {
      return [];
    }
  }

  private saveRuntimeState(): void {
    const state: RuntimeState = {
      launcherPid: process.pid,
      startedAt: Date.now(),
      config: this.getConfig(),
      services: {
        negentropy: this.buildServiceRuntimeState('negentropy'),
        openclaw: this.buildServiceRuntimeState('openclaw'),
      },
    };
    this.ensureRuntimeDir();
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  }

  private buildServiceRuntimeState(service: ServiceName): RuntimeState['services'][ServiceName] {
    const cfg = this.getServiceConfig(service);
    const info = this.processInfos.get(service);
    const pid = info?.pid ?? null;
    return {
      enabled: cfg.enabled,
      requestedPort: cfg.port,
      resolvedPort: this.resolvedPorts[service],
      command: cfg.command,
      cwd: cfg.cwd,
      healthPath: cfg.healthPath,
      pid,
      running: pid ? Launcher.isProcessRunning(pid) : false,
    };
  }

  static loadRuntimeState(): RuntimeState | null {
    try {
      if (!existsSync(STATE_FILE)) return null;
      return JSON.parse(readFileSync(STATE_FILE, 'utf-8')) as RuntimeState;
    } catch {
      return null;
    }
  }

  private removeRuntimeFiles(): void {
    for (const file of [CONFIG_FILE, PIDS_FILE, STATE_FILE, this.config.pidFile]) {
      if (!existsSync(file)) continue;
      try {
        unlinkSync(file);
      } catch {
        // Ignore cleanup errors.
      }
    }
  }

  static isProcessRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  static async killProcess(pid: number, force = false): Promise<boolean> {
    if (!Launcher.isProcessRunning(pid)) return true;

    try {
      if (process.platform === 'win32') {
        const cmd = force ? `taskkill /F /T /PID ${pid} 2>nul` : `taskkill /T /PID ${pid} 2>nul`;
        await new Promise<void>((resolve) => {
          exec(cmd, () => resolve());
        });
        if (!force && Launcher.isProcessRunning(pid)) {
          await new Promise<void>((resolve) => {
            exec(`taskkill /F /T /PID ${pid} 2>nul`, () => resolve());
          });
        }
      } else {
        process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
      }
      return true;
    } catch {
      return false;
    }
  }

  private async checkPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port, '127.0.0.1');
    });
  }

  private async findAvailablePort(
    requestedPort: number,
    reserved: Set<number>,
  ): Promise<number | null> {
    if (!isPositivePort(requestedPort)) return null;

    const maxOffset = Math.max(0, this.config.portScanRange);
    const attempts = this.config.autoResolvePorts ? maxOffset : 0;

    for (let offset = 0; offset <= attempts; offset++) {
      const candidate = requestedPort + offset;
      if (!isPositivePort(candidate) || reserved.has(candidate)) {
        continue;
      }
      const available = await this.checkPortAvailable(candidate);
      if (available) {
        return candidate;
      }
    }

    return null;
  }

  private async resolvePorts(): Promise<{ errors: string[]; warnings: string[]; ports: Record<ServiceName, number> }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const reserved = new Set<number>();
    const resolved: Record<ServiceName, number> = {
      negentropy: this.config.negentropy.port,
      openclaw: this.config.openclaw.port,
    };

    for (const service of SERVICE_START_ORDER) {
      const serviceConfig = this.getServiceConfig(service);
      if (!serviceConfig.enabled) continue;

      const requested = serviceConfig.port;
      const availablePort = await this.findAvailablePort(requested, reserved);
      if (availablePort === null) {
        if (this.config.autoResolvePorts) {
          errors.push(
            `failed to allocate port for ${service} (requested: ${requested}, range: +${this.config.portScanRange})`,
          );
        } else {
          errors.push(`port ${requested} is occupied for ${service}`);
        }
        continue;
      }

      resolved[service] = availablePort;
      reserved.add(availablePort);
      if (availablePort !== requested) {
        warnings.push(`${service} port auto-switched: ${requested} -> ${availablePort}`);
      }
    }

    return { errors, warnings, ports: resolved };
  }

  async preflight(): Promise<PreflightResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const nodeMajor = Number.parseInt(process.version.replace(/^v/, '').split('.')[0] || '0', 10);
    if (nodeMajor < 18) {
      errors.push(`node version too low: ${process.version}, requires >= 18`);
    }

    if (this.isServiceEnabled('openclaw') && nodeMajor < 22) {
      warnings.push('openclaw prefers Node.js >= 22.12.0; current runtime may fail to start it');
    }

    if (!existsSync(join(process.cwd(), 'package.json'))) {
      errors.push('missing package.json in current workspace');
    }

    for (const service of SERVICE_START_ORDER) {
      const cfg = this.getServiceConfig(service);
      if (!cfg.enabled) continue;

      if (!cfg.command.trim()) {
        errors.push(`${service} command is empty`);
      }
      if (!cfg.cwd.trim()) {
        errors.push(`${service} cwd is empty`);
      } else if (!existsSync(cfg.cwd)) {
        errors.push(`${service} cwd does not exist: ${cfg.cwd}`);
      }
      if (!isPositivePort(cfg.port)) {
        errors.push(`${service} has invalid port: ${cfg.port}`);
      }
      if (!cfg.healthPath.startsWith('/')) {
        warnings.push(`${service} healthPath should start with '/': ${cfg.healthPath}`);
      }
    }

    if (this.config.decisionMode !== 'OFF' && this.isServiceEnabled('openclaw') && !this.config.envOverrides.NEGENTROPY_DECISION_URL) {
      warnings.push('NEGENTROPY_DECISION_URL not set explicitly; launcher will inject runtime value');
    }

    const resolved = await this.resolvePorts();
    errors.push(...resolved.errors);
    warnings.push(...resolved.warnings);
    this.resolvedPorts = resolved.ports;

    return {
      success: errors.length === 0,
      errors,
      warnings,
      ports: { ...this.resolvedPorts },
    };
  }

  private buildServiceEnv(service: ServiceName): NodeJS.ProcessEnv {
    const common: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: this.config.mode === 'dev' ? 'development' : this.config.mode,
      DECISION_MODE: this.config.decisionMode,
      LOG_LEVEL: this.config.logLevel,
      ...this.config.envOverrides,
    };

    if (service === 'negentropy') {
      return {
        ...common,
        PORT: String(this.resolvedPorts.negentropy),
        OPENCLAW_BRIDGE_URL: common.OPENCLAW_BRIDGE_URL || `http://127.0.0.1:${this.resolvedPorts.openclaw}`,
        ...this.config.negentropy.envOverrides,
      };
    }

    return {
      ...common,
      OPENCLAW_GATEWAY_PORT: String(this.resolvedPorts.openclaw),
      NEGENTROPY_DECISION_URL:
        common.NEGENTROPY_DECISION_URL ||
        `http://127.0.0.1:${this.resolvedPorts.negentropy}/internal/openclaw/decision`,
      ...this.config.openclaw.envOverrides,
    };
  }

  private async startService(service: ServiceName): Promise<void> {
    const cfg = this.getServiceConfig(service);
    if (!cfg.enabled) return;

    this.emitLauncherLog(
      'info',
      `starting ${service} | cwd=${cfg.cwd} | cmd="${cfg.command}" | port=${this.resolvedPorts[service]}`,
    );

    const proc = spawn(cfg.command, {
      cwd: cfg.cwd,
      env: this.buildServiceEnv(service),
      shell: true,
      windowsHide: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.attachProcessLogs(service, proc);

    proc.on('error', (err) => {
      this.emitLauncherLog('error', `${service} failed to spawn: ${err.message}`);
    });

    proc.on('exit', (code, signal) => {
      const summary = `${service} exited with code=${code ?? 'null'}, signal=${signal ?? 'null'}`;
      if (!this.isShuttingDown) {
        this.emitLauncherLog('warn', summary);
      } else {
        this.emitLauncherLog('info', summary);
      }
    });

    this.processes.set(service, proc);
    if (proc.pid) {
      this.processInfos.set(service, {
        pid: proc.pid,
        service,
        command: cfg.command,
        cwd: cfg.cwd,
        requestedPort: cfg.port,
        resolvedPort: this.resolvedPorts[service],
        startTime: Date.now(),
      });
    }
  }

  private async stopManagedProcesses(): Promise<void> {
    for (const service of SERVICE_STOP_ORDER) {
      const info = this.processInfos.get(service);
      if (!info) continue;
      if (!Launcher.isProcessRunning(info.pid)) continue;
      this.emitLauncherLog('info', `stopping ${service} (pid: ${info.pid})`);
      await Launcher.killProcess(info.pid, false);
    }

    await sleep(1500);

    for (const service of SERVICE_STOP_ORDER) {
      const info = this.processInfos.get(service);
      if (!info) continue;
      if (!Launcher.isProcessRunning(info.pid)) continue;
      this.emitLauncherLog('warn', `force-stopping ${service} (pid: ${info.pid})`);
      await Launcher.killProcess(info.pid, true);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      this.emitLauncherLog('info', `received ${signal}, shutting down`);
      await this.stopManagedProcesses();
      this.removeRuntimeFiles();
      if (this.logStream) {
        this.logStream.end();
      }
      process.exit(0);
    };

    process.on('SIGINT', () => {
      void shutdown('SIGINT');
    });
    process.on('SIGTERM', () => {
      void shutdown('SIGTERM');
    });
  }

  async performHealthCheck(): Promise<HealthCheckResult> {
    const details: HealthCheckResult['details'] = {
      negentropy: {
        enabled: this.isServiceEnabled('negentropy'),
        url: `http://127.0.0.1:${this.resolvedPorts.negentropy}${this.config.negentropy.healthPath}`,
        healthy: false,
      },
      openclaw: {
        enabled: this.isServiceEnabled('openclaw'),
        url: `http://127.0.0.1:${this.resolvedPorts.openclaw}${this.config.openclaw.healthPath}`,
        healthy: false,
      },
    };

    for (const service of SERVICE_START_ORDER) {
      const item = details[service];
      if (!item.enabled) {
        item.healthy = true;
        continue;
      }

      try {
        const response = await fetch(item.url, { method: 'GET' });
        item.statusCode = response.status;
        item.healthy = response.ok;
      } catch (error) {
        item.healthy = false;
        item.error = error instanceof Error ? error.message : String(error);
      }
    }

    const checks: Record<string, boolean> = {
      negentropy: details.negentropy.healthy,
      openclaw: details.openclaw.healthy,
    };

    return {
      healthy: Object.values(checks).every(Boolean),
      checks,
      details,
    };
  }

  async getStatus(): Promise<LauncherStatus> {
    const runtime = Launcher.loadRuntimeState();
    const pids = Launcher.loadChildPids();
    const pidMap = new Map<ServiceName, ChildProcessInfo>();
    for (const entry of pids) {
      pidMap.set(entry.service, entry);
    }

    const launcherPid = this.readPidFile();
    const running = launcherPid ? Launcher.isProcessRunning(launcherPid) : false;

    const services: LauncherStatus['services'] = {
      negentropy: this.buildServiceStatus('negentropy', runtime, pidMap),
      openclaw: this.buildServiceStatus('openclaw', runtime, pidMap),
    };

    return {
      running,
      pid: running ? launcherPid : null,
      config: runtime?.config || this.getConfig(),
      startedAt: runtime?.startedAt,
      services,
    };
  }

  private buildServiceStatus(
    service: ServiceName,
    runtime: RuntimeState | null,
    pidMap: Map<ServiceName, ChildProcessInfo>,
  ): LauncherStatus['services'][ServiceName] {
    const runtimeService = runtime?.services[service];
    const fallbackCfg = this.getServiceConfig(service);
    const info = pidMap.get(service);
    const pid = info?.pid ?? runtimeService?.pid ?? null;

    return {
      enabled: runtimeService?.enabled ?? fallbackCfg.enabled,
      pid,
      running: pid ? Launcher.isProcessRunning(pid) : false,
      requestedPort: runtimeService?.requestedPort ?? fallbackCfg.port,
      resolvedPort: runtimeService?.resolvedPort ?? this.resolvedPorts[service],
      command: runtimeService?.command ?? fallbackCfg.command,
      cwd: runtimeService?.cwd ?? fallbackCfg.cwd,
    };
  }

  async launch(): Promise<void> {
    this.emitLauncherLog('info', 'Negentropy-Lab unified launcher v2.0.0');
    this.emitLauncherLog('info', `mode=${this.config.mode}, decision=${this.config.decisionMode}`);

    const preflight = await this.preflight();
    if (!preflight.success) {
      this.emitLauncherLog('error', 'preflight failed:');
      for (const error of preflight.errors) {
        this.emitLauncherLog('error', `  - ${error}`);
      }
      process.exit(1);
    }
    if (preflight.warnings.length > 0) {
      for (const warning of preflight.warnings) {
        this.emitLauncherLog('warn', warning);
      }
    }

    this.setupLogFile();
    this.writePidFile();
    this.setupGracefulShutdown();

    try {
      for (const service of SERVICE_START_ORDER) {
        if (!this.isServiceEnabled(service)) continue;
        await this.startService(service);
        this.saveChildPids();
        this.saveRuntimeConfig();
        this.saveRuntimeState();
        const delay = this.getServiceConfig(service).startupDelayMs;
        if (delay > 0) {
          await sleep(delay);
        }
      }

      this.emitLauncherLog(
        'info',
        `runtime ports: negentropy=${this.resolvedPorts.negentropy}, openclaw=${this.resolvedPorts.openclaw}`,
      );

      if (this.config.healthCheck) {
        const health = await this.performHealthCheck();
        if (!health.healthy) {
          this.emitLauncherLog('warn', `health check indicates partial failure: ${JSON.stringify(health.checks)}`);
        } else {
          this.emitLauncherLog('info', 'health check passed');
        }
      }

      const exitPromises = Array.from(this.processes.values()).map(
        (proc) =>
          new Promise<void>((resolve) => {
            proc.on('exit', () => resolve());
          }),
      );

      await Promise.all(exitPromises);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emitLauncherLog('error', `launch failed: ${message}`);
      await this.stopManagedProcesses();
      this.removeRuntimeFiles();
      process.exit(1);
    }
  }

  static async stopAll(): Promise<{ success: boolean; stopped: number[]; failed: number[] }> {
    const stopped: number[] = [];
    const failed: number[] = [];
    const childPids = Launcher.loadChildPids();

    if (childPids.length === 0 && existsSync(DEFAULT_PID_FILE)) {
      const pidRaw = readFileSync(DEFAULT_PID_FILE, 'utf-8').trim();
      const pid = Number.parseInt(pidRaw, 10);
      if (!Number.isNaN(pid)) {
        childPids.push({
          pid,
          service: 'negentropy',
          command: '',
          cwd: process.cwd(),
          requestedPort: 0,
          resolvedPort: 0,
          startTime: Date.now(),
        });
      }
    }

    const ordered = [...childPids].sort((a, b) => {
      const ai = SERVICE_STOP_ORDER.indexOf(a.service);
      const bi = SERVICE_STOP_ORDER.indexOf(b.service);
      return ai - bi;
    });

    for (const info of ordered) {
      if (!Launcher.isProcessRunning(info.pid)) {
        stopped.push(info.pid);
        continue;
      }
      const ok = await Launcher.killProcess(info.pid, false);
      if (ok) stopped.push(info.pid);
      else failed.push(info.pid);
    }

    await sleep(1200);
    for (const info of ordered) {
      if (!Launcher.isProcessRunning(info.pid)) continue;
      await Launcher.killProcess(info.pid, true);
    }

    for (const file of [CONFIG_FILE, PIDS_FILE, STATE_FILE, DEFAULT_PID_FILE]) {
      if (!existsSync(file)) continue;
      try {
        unlinkSync(file);
      } catch {
        // Ignore cleanup error.
      }
    }

    return { success: failed.length === 0, stopped, failed };
  }

  async stop(): Promise<boolean> {
    const result = await Launcher.stopAll();
    return result.success;
  }
}

export function createLauncher(config?: Partial<LauncherConfig>): Launcher {
  return new Launcher(config);
}

if (require.main === module) {
  const launcher = createLauncher();
  launcher.launch().catch((err) => {
    console.error('[Launcher] fatal:', err);
    process.exit(1);
  });
}
