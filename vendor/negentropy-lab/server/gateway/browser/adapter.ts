/**
 * Browser automation adapter.
 *
 * @constitution
 * §101 同步公理：Browser执行层与RPC契约同步维护
 * §102 熵减原则：将执行细节与handler解耦，降低复杂度
 * §306 零停机协议：连接释放时清理会话与资源
 */

import { randomUUID } from 'crypto';
import type {
  BrowserClickParams,
  BrowserScreenshotParams,
  BrowserTypeParams,
} from './contracts';

export type BrowserEnginePreference = 'auto' | 'mock' | 'playwright';
export type BrowserRuntimeEngine = 'mock' | 'playwright';

export type BrowserAutomationErrorCode =
  | 'INVALID_ARGUMENT'
  | 'SESSION_NOT_FOUND'
  | 'TIMEOUT'
  | 'SELECTOR_NOT_FOUND'
  | 'UNSUPPORTED_FORMAT'
  | 'ENGINE_UNAVAILABLE'
  | 'EXECUTION_FAILED';

export class BrowserAutomationError extends Error {
  constructor(
    public readonly code: BrowserAutomationErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'BrowserAutomationError';
  }
}

export interface BrowserAutomationAdapterOptions {
  engine?: BrowserEnginePreference;
  maxSessions?: number;
  sessionTtlMs?: number;
}

interface BrowserSessionState {
  sessionId: string;
  ownerConnectionId?: string;
  engine: BrowserRuntimeEngine;
  createdAt: number;
  updatedAt: number;
  url: string;
  title: string;
  clickCount: number;
  typedValues: Record<string, string>;
  history: string[];
  page?: any;
  context?: any;
}

interface BrowserRuntimeState {
  chromium: any;
  browser: any;
}

export interface BrowserNavigateInput {
  url: string;
  sessionId?: string;
  timeoutMs: number;
  connectionId?: string;
}

export interface BrowserNavigateResult {
  sessionId: string;
  url: string;
  title: string;
  status: number;
  timingMs: number;
  engine: BrowserRuntimeEngine;
}

export interface BrowserClickResult {
  sessionId: string;
  selector: string;
  button: 'left' | 'right' | 'middle';
  clickCount: number;
  totalClicks: number;
  engine: BrowserRuntimeEngine;
}

export interface BrowserTypeResult {
  sessionId: string;
  selector: string;
  clear: boolean;
  textLength: number;
  valueLength: number;
  preview: string;
  engine: BrowserRuntimeEngine;
}

export interface BrowserScreenshotResult {
  sessionId: string;
  format: 'png' | 'jpeg' | 'webp';
  fullPage: boolean;
  quality: number | null;
  mimeType: string;
  data: string;
  bytes: number;
  engine: BrowserRuntimeEngine;
}

export class BrowserAutomationAdapter {
  private readonly enginePreference: BrowserEnginePreference;
  private readonly maxSessions: number;
  private readonly sessionTtlMs: number;
  private readonly sessions = new Map<string, BrowserSessionState>();
  private runtimeEngine: BrowserRuntimeEngine | null = null;
  private runtimeState: BrowserRuntimeState | null = null;

  constructor(options: BrowserAutomationAdapterOptions = {}) {
    this.enginePreference = options.engine || 'auto';
    this.maxSessions = Math.max(1, Number(options.maxSessions ?? 64));
    this.sessionTtlMs = Math.max(10_000, Number(options.sessionTtlMs ?? 15 * 60 * 1000));
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  getRuntimeEngine(): BrowserRuntimeEngine {
    return this.runtimeEngine || 'mock';
  }

  async navigate(input: BrowserNavigateInput): Promise<BrowserNavigateResult> {
    const startAt = Date.now();
    const sessionId = input.sessionId || `browser:${randomUUID()}`;
    const session = await this.getOrCreateSession(sessionId, input.connectionId);

    if (session.engine === 'playwright' && session.page) {
      const response = await this.guardExecution<{ status?: () => number } | null>('navigate', () =>
        session.page.goto(input.url, {
          waitUntil: 'domcontentloaded',
          timeout: input.timeoutMs,
        }),
      );
      const title = await this.guardExecution<string>('navigate', async () =>
        String(await session.page.title()),
      );
      session.url = input.url;
      session.title = title || this.mockTitleFromUrl(input.url);
      session.updatedAt = Date.now();
      session.history.push(session.url);
      this.trimHistory(session);
      return {
        sessionId,
        url: session.url,
        title: session.title,
        status: Number(response?.status?.() || 200),
        timingMs: Date.now() - startAt,
        engine: session.engine,
      };
    }

    session.url = input.url;
    session.title = this.mockTitleFromUrl(input.url);
    session.updatedAt = Date.now();
    session.history.push(session.url);
    this.trimHistory(session);
    return {
      sessionId,
      url: session.url,
      title: session.title,
      status: 200,
      timingMs: Date.now() - startAt,
      engine: session.engine,
    };
  }

  async click(params: BrowserClickParams): Promise<BrowserClickResult> {
    const session = await this.getSessionOrThrow(params.sessionId);

    if (session.engine === 'playwright' && session.page) {
      await this.guardExecution('click', async () => {
        await session.page.waitForSelector(params.selector, { timeout: params.timeoutMs || 5000 });
        await session.page.click(params.selector, {
          button: params.button,
          clickCount: params.clickCount,
          timeout: params.timeoutMs || 5000,
        });
      });
    }

    session.clickCount += params.clickCount;
    session.updatedAt = Date.now();
    return {
      sessionId: session.sessionId,
      selector: params.selector,
      button: params.button,
      clickCount: params.clickCount,
      totalClicks: session.clickCount,
      engine: session.engine,
    };
  }

  async type(params: BrowserTypeParams): Promise<BrowserTypeResult> {
    const session = await this.getSessionOrThrow(params.sessionId);

    if (session.engine === 'playwright' && session.page) {
      await this.guardExecution('type', async () => {
        await session.page.waitForSelector(params.selector, { timeout: params.timeoutMs || 5000 });
        if (params.clear) {
          await session.page.fill(params.selector, '', { timeout: params.timeoutMs || 5000 });
        }
        if (params.text.length > 0) {
          await session.page.type(params.selector, params.text, { timeout: params.timeoutMs || 5000 });
        }
      });
    }

    const currentValue = params.clear ? '' : session.typedValues[params.selector] || '';
    const nextValue = `${currentValue}${params.text}`;
    session.typedValues[params.selector] = nextValue;
    session.updatedAt = Date.now();

    return {
      sessionId: session.sessionId,
      selector: params.selector,
      clear: params.clear,
      textLength: params.text.length,
      valueLength: nextValue.length,
      preview: params.text.length > 64 ? `${params.text.slice(0, 64)}...` : params.text,
      engine: session.engine,
    };
  }

  async screenshot(params: BrowserScreenshotParams): Promise<BrowserScreenshotResult> {
    const session = await this.getSessionOrThrow(params.sessionId);

    let binary: Buffer;
    if (session.engine === 'playwright' && session.page) {
      binary = await this.guardExecution('screenshot', () =>
        session.page.screenshot({
          type: params.format,
          fullPage: params.fullPage,
          quality: params.quality === null || params.quality === undefined ? undefined : params.quality,
          timeout: params.timeoutMs || 5000,
        }),
      );
    } else {
      const mockPayload = JSON.stringify({
        sessionId: session.sessionId,
        url: session.url,
        title: session.title,
        fullPage: params.fullPage,
        format: params.format,
        capturedAt: Date.now(),
      });
      binary = Buffer.from(mockPayload, 'utf-8');
    }

    session.updatedAt = Date.now();
    const base64 = binary.toString('base64');
    const mimeType = `image/${params.format}`;

    return {
      sessionId: session.sessionId,
      format: params.format,
      fullPage: params.fullPage,
      quality: params.quality ?? null,
      mimeType,
      data: `data:${mimeType};base64,${base64}`,
      bytes: binary.length,
      engine: session.engine,
    };
  }

  async releaseSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    await this.disposeSession(session);
    this.sessions.delete(sessionId);
    return true;
  }

  async releaseSessionsByConnection(connectionId: string): Promise<number> {
    if (!connectionId) {
      return 0;
    }

    const targets = Array.from(this.sessions.values()).filter(
      (session) => session.ownerConnectionId === connectionId,
    );
    for (const session of targets) {
      await this.disposeSession(session);
      this.sessions.delete(session.sessionId);
    }
    return targets.length;
  }

  async cleanupExpiredSessions(nowMs: number = Date.now()): Promise<number> {
    const expired = Array.from(this.sessions.values()).filter(
      (session) => nowMs - session.updatedAt > this.sessionTtlMs,
    );
    for (const session of expired) {
      await this.disposeSession(session);
      this.sessions.delete(session.sessionId);
    }
    return expired.length;
  }

  async dispose(): Promise<void> {
    for (const session of Array.from(this.sessions.values())) {
      await this.disposeSession(session);
    }
    this.sessions.clear();

    if (this.runtimeState?.browser) {
      try {
        await this.runtimeState.browser.close();
      } catch {
        // noop
      }
    }
    this.runtimeState = null;
    this.runtimeEngine = null;
  }

  private async guardExecution<T>(action: string, execute: () => Promise<T>): Promise<T> {
    try {
      return await execute();
    } catch (error) {
      throw this.normalizeExecutionError(action, error);
    }
  }

  private normalizeExecutionError(action: string, error: unknown): BrowserAutomationError {
    if (error instanceof BrowserAutomationError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    const lower = message.toLowerCase();
    if (lower.includes('timeout')) {
      return new BrowserAutomationError('TIMEOUT', `${action} timeout`, { cause: message });
    }
    if (lower.includes('selector')) {
      return new BrowserAutomationError('SELECTOR_NOT_FOUND', `Selector not found for ${action}`, {
        cause: message,
      });
    }
    return new BrowserAutomationError('EXECUTION_FAILED', `Browser ${action} failed`, {
      cause: message,
    });
  }

  private async getOrCreateSession(sessionId: string, connectionId?: string): Promise<BrowserSessionState> {
    await this.cleanupExpiredSessions();

    const existing = this.sessions.get(sessionId);
    if (existing) {
      if (!existing.ownerConnectionId && connectionId) {
        existing.ownerConnectionId = connectionId;
      }
      existing.updatedAt = Date.now();
      return existing;
    }

    await this.enforceMaxSessions();
    const runtimeEngine = await this.ensureRuntimeEngine();
    const session: BrowserSessionState = {
      sessionId,
      ownerConnectionId: connectionId,
      engine: runtimeEngine,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      url: 'about:blank',
      title: 'Mock Page · about:blank',
      clickCount: 0,
      typedValues: {},
      history: [],
    };

    if (runtimeEngine === 'playwright') {
      const runtime = this.runtimeState;
      if (!runtime?.browser) {
        throw new BrowserAutomationError('ENGINE_UNAVAILABLE', 'Playwright browser is not available');
      }
      session.context = await runtime.browser.newContext();
      session.page = await session.context.newPage();
    }

    this.sessions.set(sessionId, session);
    return session;
  }

  private async getSessionOrThrow(sessionId: string): Promise<BrowserSessionState> {
    await this.cleanupExpiredSessions();
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new BrowserAutomationError('SESSION_NOT_FOUND', `Browser session not found: ${sessionId}`, {
        sessionId,
      });
    }
    session.updatedAt = Date.now();
    return session;
  }

  private async enforceMaxSessions(): Promise<void> {
    if (this.sessions.size < this.maxSessions) {
      return;
    }

    const oldest = Array.from(this.sessions.values()).sort((a, b) => a.updatedAt - b.updatedAt)[0];
    if (!oldest) {
      return;
    }
    await this.disposeSession(oldest);
    this.sessions.delete(oldest.sessionId);
  }

  private trimHistory(session: BrowserSessionState): void {
    if (session.history.length > 20) {
      session.history.splice(0, session.history.length - 20);
    }
  }

  private mockTitleFromUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `Mock Page · ${parsed.hostname || 'about:blank'}`;
    } catch {
      return 'Mock Page · about:blank';
    }
  }

  private async ensureRuntimeEngine(): Promise<BrowserRuntimeEngine> {
    if (this.runtimeEngine) {
      return this.runtimeEngine;
    }

    if (this.enginePreference === 'mock') {
      this.runtimeEngine = 'mock';
      return this.runtimeEngine;
    }

    const chromium = await this.loadPlaywrightChromium();
    if (!chromium) {
      if (this.enginePreference === 'playwright') {
        throw new BrowserAutomationError(
          'ENGINE_UNAVAILABLE',
          'Playwright package is unavailable in current runtime',
        );
      }
      this.runtimeEngine = 'mock';
      return this.runtimeEngine;
    }

    try {
      const browser = await chromium.launch({ headless: true });
      this.runtimeState = { chromium, browser };
      this.runtimeEngine = 'playwright';
      return this.runtimeEngine;
    } catch (error) {
      if (this.enginePreference === 'playwright') {
        const message = error instanceof Error ? error.message : String(error);
        throw new BrowserAutomationError('ENGINE_UNAVAILABLE', `Playwright launch failed: ${message}`);
      }
      this.runtimeEngine = 'mock';
      return this.runtimeEngine;
    }
  }

  private async loadPlaywrightChromium(): Promise<any | null> {
    const packages = ['playwright', 'playwright-core'];
    for (const packageName of packages) {
      try {
        const mod: any = await import(packageName);
        if (mod?.chromium?.launch) {
          return mod.chromium;
        }
      } catch {
        // try next package
      }
    }
    return null;
  }

  private async disposeSession(session: BrowserSessionState): Promise<void> {
    if (session.page?.close) {
      try {
        await session.page.close();
      } catch {
        // noop
      }
    }
    if (session.context?.close) {
      try {
        await session.context.close();
      } catch {
        // noop
      }
    }
  }
}

