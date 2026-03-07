#!/usr/bin/env node
/**
 * Launcher CI smoke tests.
 *
 * This suite does not start real services.
 */

import { Launcher, createLauncher, DEFAULT_CONFIG, MODE_CONFIGS } from './launcher';
import { PRESETS, validateConfig, loadFromEnv } from '../config/launcher.config';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

const results: TestResult[] = [];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  const started = Date.now();
  try {
    await testFn();
    const durationMs = Date.now() - started;
    results.push({ name, passed: true, durationMs });
    console.log(`  PASS ${name} (${durationMs}ms)`);
  } catch (error) {
    const durationMs = Date.now() - started;
    const message = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: message, durationMs });
    console.log(`  FAIL ${name}: ${message}`);
  }
}

async function run(): Promise<void> {
  console.log('\nLauncher CI Smoke\n');

  await runTest('preflight works with OpenClaw disabled', async () => {
    const launcher = createLauncher({
      mode: 'dev',
      openclaw: { enabled: false },
      enableOpenclaw: false,
      healthCheck: false,
      autoResolvePorts: true,
    });
    const result = await launcher.preflight();
    assert(result.success, `preflight failed: ${result.errors.join('; ')}`);
    assert(result.ports.negentropy > 0, 'negentropy port should resolve');
  });

  await runTest('status shape is stable', async () => {
    const launcher = createLauncher({ openclaw: { enabled: false }, enableOpenclaw: false });
    const status = await launcher.getStatus();
    assert(typeof status.running === 'boolean', 'status.running should be boolean');
    assert(status.services.negentropy !== undefined, 'negentropy status should exist');
    assert(status.services.openclaw !== undefined, 'openclaw status should exist');
  });

  await runTest('default config exposes dual services', async () => {
    assert(DEFAULT_CONFIG.negentropy.enabled === true, 'default negentropy should be enabled');
    assert(DEFAULT_CONFIG.openclaw.enabled === true, 'default openclaw should be enabled');
    assert(DEFAULT_CONFIG.negentropy.port === 3000, 'default negentropy port should be 3000');
    assert(DEFAULT_CONFIG.openclaw.port === 18789, 'default openclaw port should be 18789');
  });

  await runTest('mode configs remain defined', async () => {
    assert(MODE_CONFIGS.dev.logLevel === 'debug', 'dev logLevel should be debug');
    assert(MODE_CONFIGS.staging.logLevel === 'info', 'staging logLevel should be info');
    assert(MODE_CONFIGS.production.logLevel === 'warn', 'production logLevel should be warn');
  });

  await runTest('presets include minimal and production', async () => {
    assert(PRESETS.minimal !== undefined, 'minimal preset should exist');
    assert(PRESETS.production !== undefined, 'production preset should exist');
    assert(PRESETS.minimal.enableOpenclaw === false, 'minimal preset should disable openclaw');
    assert(PRESETS.production.decisionMode === 'ENFORCE', 'production preset should enforce decision mode');
  });

  await runTest('validateConfig catches invalid mode', async () => {
    const ok = validateConfig({ mode: 'production', decisionMode: 'ENFORCE' });
    assert(ok.valid, `expected config valid, got errors: ${ok.errors.join('; ')}`);

    const bad = validateConfig({ mode: 'invalid' as any });
    assert(!bad.valid, 'invalid mode should fail validation');
    assert(bad.errors.length > 0, 'invalid mode should produce errors');
  });

  await runTest('env loader reads launcher mode', async () => {
    const previous = process.env.LAUNCHER_MODE;
    process.env.LAUNCHER_MODE = 'staging';
    const loaded = loadFromEnv();
    assert(loaded.mode === 'staging', 'env loader should read LAUNCHER_MODE');
    if (previous === undefined) {
      delete process.env.LAUNCHER_MODE;
    } else {
      process.env.LAUNCHER_MODE = previous;
    }
  });

  await runTest('isProcessRunning handles invalid PID', async () => {
    const running = Launcher.isProcessRunning(999999);
    assert(running === false, 'invalid PID should return false');
  });

  await runTest('runtime config load is tolerant', async () => {
    const loaded = Launcher.loadRuntimeConfig();
    assert(loaded === null || typeof loaded === 'object', 'runtime config loader should be tolerant');
  });

  await runTest('stopAll on empty state does not throw', async () => {
    const result = await Launcher.stopAll();
    assert(typeof result.success === 'boolean', 'stopAll should return result object');
    assert(Array.isArray(result.stopped), 'stopAll.stopped should be array');
    assert(Array.isArray(result.failed), 'stopAll.failed should be array');
  });

  await runTest('createLauncher applies custom ports', async () => {
    const launcher = createLauncher({
      port: 3100,
      negentropy: { port: 3100 },
      openclaw: { port: 19001, enabled: false },
      enableOpenclaw: false,
    });
    const config = launcher.getConfig();
    assert(config.negentropy.port === 3100, 'custom negentropy port should apply');
    assert(config.openclaw.port === 19001, 'custom openclaw port should apply');
  });

  printReport();
}

function printReport(): void {
  const passed = results.filter((x) => x.passed).length;
  const failed = results.length - passed;
  const durationMs = results.reduce((sum, x) => sum + x.durationMs, 0);

  console.log('\nSummary\n');
  console.log(`  total: ${results.length}`);
  console.log(`  passed: ${passed}`);
  console.log(`  failed: ${failed}`);
  console.log(`  duration: ${durationMs}ms`);

  if (failed > 0) {
    console.log('\nFailed tests:');
    for (const item of results.filter((x) => !x.passed)) {
      console.log(`  - ${item.name}: ${item.error}`);
    }
    process.exit(1);
  }

  process.exit(0);
}

run().catch((error) => {
  console.error('Launcher smoke run failed:', error);
  process.exit(1);
});
