/**
 * Shared test setup for Vitest/Jest environments.
 */

import 'reflect-metadata';

type MockFactory = (...args: unknown[]) => unknown;

type RuntimeTestApi = {
  vi?: {
    setConfig?: (config: { testTimeout?: number }) => void;
    fn?: MockFactory;
  };
  jest?: {
    setTimeout?: (ms: number) => void;
    fn?: MockFactory;
  };
};

const runtimeApi = globalThis as typeof globalThis & RuntimeTestApi;

if (runtimeApi.jest?.setTimeout) {
  runtimeApi.jest.setTimeout(10_000);
} else {
  runtimeApi.vi?.setConfig?.({ testTimeout: 10_000 });
}

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-jwt-signing-in-test-environment-only';
process.env.PORT = '2567';

export function cleanupTestFiles(): void {
  // Intentionally empty for now.
}

beforeAll(() => {
  console.log('Test suite started');
});

afterAll(() => {
  console.log('Test suite finished');
  cleanupTestFiles();
});

beforeEach(() => {
  console.log('Test case started');
});

afterEach(() => {
  console.log('Test case finished');
});

const mockFactory: MockFactory = runtimeApi.jest?.fn ?? runtimeApi.vi?.fn ?? (() => {
  throw new Error('No test mock function factory available');
});

export const testUtils = {
  generateRandomId: () => `test_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,

  createMockUser: (overrides = {}) => ({
    id: 'user_test_123',
    username: 'test_user',
    role: 'user',
    email: 'test@example.com',
    ...overrides,
  }),

  createMockAgent: (type: string, overrides = {}) => ({
    id: `agent_${type}_123`,
    type,
    name: `Test ${type} Agent`,
    capabilities: ['knowledge_query', 'file_operation'],
    status: 'active',
    ...overrides,
  }),

  createMockMessage: (overrides = {}) => ({
    id: `msg_${Date.now()}`,
    content: 'This is a test message',
    sender: 'user_test_123',
    recipient: 'agent_legal_expert_123',
    timestamp: new Date().toISOString(),
    type: 'text',
    ...overrides,
  }),

  wait: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

  createMockResponse: () => {
    const res: Record<string, unknown> = {};
    const status = mockFactory() as { mockReturnValue: (v: unknown) => unknown };
    const json = mockFactory() as { mockReturnValue: (v: unknown) => unknown };
    const send = mockFactory() as { mockReturnValue: (v: unknown) => unknown };

    (res as any).status = status.mockReturnValue(res);
    (res as any).json = json.mockReturnValue(res);
    (res as any).send = send.mockReturnValue(res);

    return res;
  },

  createMockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    ...overrides,
  }),
};
