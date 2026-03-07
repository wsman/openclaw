/**
 * Browser RPC contract and schema definitions.
 *
 * @constitution
 * §101 同步公理：Browser RPC契约与实现保持同步
 * §102 熵减原则：统一参数校验入口，减少分叉逻辑
 * §152 单一真理源公理：Browser参数约束集中定义
 */

import { z, ZodError } from 'zod';

export type BrowserAction = 'navigate' | 'click' | 'type' | 'screenshot';
export type BrowserScreenshotFormat = 'png' | 'jpeg' | 'webp';
export type BrowserMouseButton = 'left' | 'right' | 'middle';

const sessionIdSchema = z.string().trim().min(1).max(128);
const selectorSchema = z.string().trim().min(1);
const timeoutSchema = z.coerce.number().int().positive().max(60000).optional();
const simulateDelaySchema = z.coerce.number().int().min(0).max(60000).optional();

const baseNavigateSchema = z.object({
  url: z.string().trim().optional(),
  href: z.string().trim().optional(),
  sessionId: sessionIdSchema.optional(),
  timeoutMs: timeoutSchema,
  simulateDelayMs: simulateDelaySchema,
});

const baseClickSchema = z.object({
  sessionId: sessionIdSchema,
  selector: selectorSchema,
  button: z.enum(['left', 'right', 'middle']).default('left'),
  clickCount: z.coerce.number().int().min(1).max(3).default(1),
  timeoutMs: timeoutSchema,
  simulateDelayMs: simulateDelaySchema,
});

const baseTypeSchema = z.object({
  sessionId: sessionIdSchema,
  selector: selectorSchema,
  text: z.string().max(10000).optional(),
  clear: z.coerce.boolean().optional().default(false),
  timeoutMs: timeoutSchema,
  simulateDelayMs: simulateDelaySchema,
});

const baseScreenshotSchema = z.object({
  sessionId: sessionIdSchema,
  format: z.enum(['png', 'jpeg', 'webp']).default('png'),
  fullPage: z.coerce.boolean().optional().default(false),
  quality: z.coerce.number().int().min(0).max(100).nullable().optional(),
  timeoutMs: timeoutSchema,
  simulateDelayMs: simulateDelaySchema,
});

const baseRequestSchema = z.object({
  action: z.string().trim().optional(),
  op: z.string().trim().optional(),
  method: z.string().trim().optional(),
});

export type BrowserNavigateParams = {
  url: string;
  sessionId?: string;
  timeoutMs?: number;
  simulateDelayMs?: number;
};

export type BrowserClickParams = z.infer<typeof baseClickSchema>;

export type BrowserTypeParams = {
  sessionId: string;
  selector: string;
  text: string;
  clear: boolean;
  timeoutMs?: number;
  simulateDelayMs?: number;
};

export type BrowserScreenshotParams = z.infer<typeof baseScreenshotSchema>;

export type BrowserRequestParams = {
  action: string;
  method?: string;
  payload: Record<string, unknown>;
};

export const BROWSER_CONTRACT_VERSION = '2026-03-01';

export const BROWSER_RPC_METHODS: ReadonlyArray<`browser.${BrowserAction}`> = [
  'browser.navigate',
  'browser.click',
  'browser.type',
  'browser.screenshot',
];

export const BROWSER_COMPAT_METHOD = 'browser.request';

export function parseBrowserNavigateParams(raw: unknown): BrowserNavigateParams {
  const parsed = baseNavigateSchema.parse(raw || {});
  const candidateUrl = (parsed.url || parsed.href || '').trim();
  if (!candidateUrl) {
    throw new ZodError([
      {
        code: 'custom',
        message: 'Missing url',
        path: ['url'],
      },
    ]);
  }

  let normalized: URL;
  try {
    normalized = new URL(candidateUrl);
  } catch {
    throw new ZodError([
      {
        code: 'custom',
        message: `Invalid url: ${candidateUrl}`,
        path: ['url'],
      },
    ]);
  }

  if (normalized.protocol !== 'http:' && normalized.protocol !== 'https:') {
    throw new ZodError([
      {
        code: 'custom',
        message: `Unsupported url protocol: ${normalized.protocol}`,
        path: ['url'],
      },
    ]);
  }

  return {
    url: normalized.toString(),
    sessionId: parsed.sessionId,
    timeoutMs: parsed.timeoutMs,
    simulateDelayMs: parsed.simulateDelayMs,
  };
}

export function parseBrowserClickParams(raw: unknown): BrowserClickParams {
  return baseClickSchema.parse(raw || {});
}

export function parseBrowserTypeParams(raw: unknown): BrowserTypeParams {
  const parsed = baseTypeSchema.parse(raw || {});
  const text = String(parsed.text ?? '');
  if (!parsed.clear && text.length === 0) {
    throw new ZodError([
      {
        code: 'custom',
        message: 'Missing text',
        path: ['text'],
      },
    ]);
  }
  return {
    sessionId: parsed.sessionId,
    selector: parsed.selector,
    text,
    clear: parsed.clear,
    timeoutMs: parsed.timeoutMs,
    simulateDelayMs: parsed.simulateDelayMs,
  };
}

export function parseBrowserScreenshotParams(raw: unknown): BrowserScreenshotParams {
  const parsed = baseScreenshotSchema.parse(raw || {});
  if (
    parsed.quality !== undefined &&
    parsed.quality !== null &&
    parsed.format === 'png'
  ) {
    throw new ZodError([
      {
        code: 'custom',
        message: 'Quality is only supported for jpeg/webp',
        path: ['quality'],
      },
    ]);
  }
  return parsed;
}

export function parseBrowserRequestParams(raw: unknown): BrowserRequestParams {
  const parsed = baseRequestSchema.parse(raw || {});
  const action = String(parsed.action || parsed.op || '').trim().toLowerCase();
  const payload = raw && typeof raw === 'object' ? ({ ...(raw as Record<string, unknown>) }) : {};
  return {
    action,
    method: parsed.method,
    payload,
  };
}

export function toValidationIssueData(method: string, error: ZodError) {
  return {
    method,
    issues: error.issues.map((issue) => ({
      path: issue.path.join('.') || '<root>',
      message: issue.message,
      code: issue.code,
    })),
  };
}

