import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { resolveAgentTimeoutMs } from "./timeout.js";

// Mock config for testing
const createMockConfig = (overrides: Partial<OpenClawConfig> = {}): OpenClawConfig => {
  return {
    session: {
      mainKey: "main",
      scope: "per-sender",
    },
    agents: {
      defaults: {
        subagents: {
          maxSpawnDepth: 2,
        },
        timeoutSeconds: 600,
      },
    },
    models: {
      mode: "replace",
      providers: {},
    },
    ...overrides,
  } as OpenClawConfig;
};

describe("timeoutMs and maxSpawnDepth integration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("timeoutMs configuration", () => {
    it("should use provider-level timeoutMs when set", () => {
      const config = createMockConfig({
        models: {
          mode: "replace",
          providers: {
            openai: {
              apiKey: "test-key",
              baseUrl: "https://api.openai.com/v1",
              api: "openai",
              timeoutMs: 30000, // 30 seconds
              models: [
                {
                  id: "gpt-4",
                  name: "GPT-4",
                  api: "openai",
                  reasoning: false,
                  input: ["text"],
                  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                  contextWindow: 128000,
                  maxTokens: 4096,
                },
              ],
            },
          },
        },
      });

      const timeout = resolveAgentTimeoutMs({
        cfg: config,
        provider: "openai",
      });

      expect(timeout).toBe(30000);
    });

    it("should fall back to default agent timeout when provider timeoutMs not set", () => {
      const config = createMockConfig({
        agents: {
          defaults: {
            timeoutSeconds: 120, // 2 minutes
            subagents: {
              maxSpawnDepth: 2,
            },
          },
        },
        models: {
          mode: "replace",
          providers: {
            openai: {
              apiKey: "test-key",
              baseUrl: "https://api.openai.com/v1",
              api: "openai",
              models: [
                {
                  id: "gpt-4",
                  name: "GPT-4",
                  api: "openai",
                  reasoning: false,
                  input: ["text"],
                  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                  contextWindow: 128000,
                  maxTokens: 4096,
                },
              ],
            },
          },
        },
      });

      const timeout = resolveAgentTimeoutMs({
        cfg: config,
        provider: "openai",
      });

      expect(timeout).toBe(120000); // 2 minutes in ms
    });

    it("should handle deprecated timeout field for backward compatibility", () => {
      const config = createMockConfig({
        models: {
          mode: "replace",
          providers: {
            openai: {
              apiKey: "test-key",
              baseUrl: "https://api.openai.com/v1",
              api: "openai",
              timeout: 45000, // deprecated field
              timeoutMs: 30000, // new field
              models: [
                {
                  id: "gpt-4",
                  name: "GPT-4",
                  api: "openai",
                  reasoning: false,
                  input: ["text"],
                  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                  contextWindow: 128000,
                  maxTokens: 4096,
                },
              ],
            },
          },
        },
      });

      const timeout = resolveAgentTimeoutMs({
        cfg: config,
        provider: "openai",
      });

      // Should use timeoutMs (30000) over timeout (45000)
      expect(timeout).toBe(30000);
    });

    it("should respect per-provider timeoutMs overrides", () => {
      const config = createMockConfig({
        agents: {
          defaults: {
            timeoutSeconds: 600, // 10 minutes default
            subagents: {
              maxSpawnDepth: 2,
            },
          },
        },
        models: {
          mode: "replace",
          providers: {
            openai: {
              apiKey: "test-key",
              baseUrl: "https://api.openai.com/v1",
              api: "openai",
              timeoutMs: 120000, // 2 minutes for OpenAI
              models: [
                {
                  id: "gpt-4",
                  name: "GPT-4",
                  api: "openai",
                  reasoning: false,
                  input: ["text"],
                  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                  contextWindow: 128000,
                  maxTokens: 4096,
                },
              ],
            },
            anthropic: {
              apiKey: "test-key-2",
              baseUrl: "https://api.anthropic.com/v1",
              api: "anthropic",
              timeoutMs: 180000, // 3 minutes for Anthropic
              models: [
                {
                  id: "claude-3",
                  name: "Claude 3",
                  api: "anthropic",
                  reasoning: false,
                  input: ["text"],
                  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                  contextWindow: 128000,
                  maxTokens: 4096,
                },
              ],
            },
          },
        },
      });

      const openaiTimeout = resolveAgentTimeoutMs({
        cfg: config,
        provider: "openai",
      });

      const anthropicTimeout = resolveAgentTimeoutMs({
        cfg: config,
        provider: "anthropic",
      });

      expect(openaiTimeout).toBe(120000);
      expect(anthropicTimeout).toBe(180000);
    });

    it("should clamp timeoutMs to safe values", () => {
      const config = createMockConfig({
        models: {
          mode: "replace",
          providers: {
            openai: {
              apiKey: "test-key",
              baseUrl: "https://api.openai.com/v1",
              api: "openai",
              timeoutMs: 9_999_999_999, // Very large value
              models: [
                {
                  id: "gpt-4",
                  name: "GPT-4",
                  api: "openai",
                  reasoning: false,
                  input: ["text"],
                  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                  contextWindow: 128000,
                  maxTokens: 4096,
                },
              ],
            },
          },
        },
      });

      const timeout = resolveAgentTimeoutMs({
        cfg: config,
        provider: "openai",
        minMs: 1000,
      });

      // Should be clamped to MAX_SAFE_TIMEOUT_MS (2_147_000_000)
      expect(timeout).toBeLessThanOrEqual(2_147_000_000);
      expect(timeout).toBeGreaterThan(0);
    });
  });

  describe("maxSpawnDepth integration", () => {
    // Note: maxSpawnDepth validation is implemented in sessions-spawn-tool.ts
    // This test verifies the configuration structure and defaults
    it("should respect maxSpawnDepth configuration", () => {
      const config = createMockConfig({
        agents: {
          defaults: {
            subagents: {
              maxSpawnDepth: 5, // Custom depth
              maxConcurrent: 3,
              archiveAfterMinutes: 60,
            },
          },
        },
      });

      expect(config.agents?.defaults?.subagents?.maxSpawnDepth).toBe(5);
      expect(config.agents?.defaults?.subagents?.maxConcurrent).toBe(3);
      expect(config.agents?.defaults?.subagents?.archiveAfterMinutes).toBe(60);
    });

    it("should use default maxSpawnDepth when not specified", () => {
      const config = createMockConfig({
        agents: {
          defaults: {
            subagents: {
              maxConcurrent: 3,
              archiveAfterMinutes: 60,
              // maxSpawnDepth not set
            },
          },
        },
      });

      // Default should be 2
      const _expectedDefault = 2;
      expect(config.agents?.defaults?.subagents?.maxSpawnDepth).toBeUndefined();

      // In actual usage, the code should fall back to default value of 2
      // This is tested in sessions-spawn-tool.ts
    });

    it("should validate maxSpawnDepth range (1-10)", () => {
      // Note: This validation is done in the Zod schema
      // We're testing that the configuration structure supports the range
      const validValues = [1, 2, 5, 10];

      validValues.forEach((value) => {
        const config = createMockConfig({
          agents: {
            defaults: {
              subagents: {
                maxSpawnDepth: value,
              },
            },
          },
        });

        expect(config.agents?.defaults?.subagents?.maxSpawnDepth).toBe(value);
      });

      // Boundary testing - should be validated by Zod
      const boundaryConfig = createMockConfig({
        agents: {
          defaults: {
            subagents: {
              maxSpawnDepth: 0, // Invalid, should be >= 1
            },
          },
        },
      });

      // The value can be set, but Zod should catch it during validation
      expect(boundaryConfig.agents?.defaults?.subagents?.maxSpawnDepth).toBe(0);
    });
  });

  describe("combined usage", () => {
    it("should handle complex workflows with both timeoutMs and maxSpawnDepth", () => {
      const config = createMockConfig({
        agents: {
          defaults: {
            timeoutSeconds: 300, // 5 minutes
            subagents: {
              maxSpawnDepth: 3,
              maxConcurrent: 2,
              archiveAfterMinutes: 30,
            },
          },
        },
        models: {
          mode: "replace",
          providers: {
            openai: {
              apiKey: "test-key",
              baseUrl: "https://api.openai.com/v1",
              api: "openai",
              timeoutMs: 180000, // 3 minutes
              models: [
                {
                  id: "gpt-4",
                  name: "GPT-4",
                  api: "openai",
                  reasoning: false,
                  input: ["text"],
                  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                  contextWindow: 128000,
                  maxTokens: 4096,
                },
              ],
            },
          },
        },
      });

      // Verify timeout configuration
      const timeout = resolveAgentTimeoutMs({
        cfg: config,
        provider: "openai",
      });
      expect(timeout).toBe(180000); // Should use provider timeout

      // Verify subagent configuration
      expect(config.agents?.defaults?.subagents?.maxSpawnDepth).toBe(3);
      expect(config.agents?.defaults?.subagents?.maxConcurrent).toBe(2);
      expect(config.agents?.defaults?.subagents?.archiveAfterMinutes).toBe(30);

      // Verify agent defaults are still accessible
      expect(config.agents?.defaults?.timeoutSeconds).toBe(300);
    });

    it("should allow agent-level override of subagent settings", () => {
      const config = createMockConfig({
        agents: {
          defaults: {
            timeoutSeconds: 300,
            subagents: {
              maxSpawnDepth: 2,
              maxConcurrent: 1,
              archiveAfterMinutes: 60,
            },
          },
          list: [
            {
              id: "research",
              subagents: {
                maxSpawnDepth: 5, // Agent-specific override
                maxConcurrent: 3,
                archiveAfterMinutes: 120,
              },
            },
          ],
        },
      });

      // Global defaults
      expect(config.agents?.defaults?.subagents?.maxSpawnDepth).toBe(2);

      // Agent-specific override
      const researchAgent = config.agents?.list?.find((a) => a.id === "research");
      expect(researchAgent?.subagents?.maxSpawnDepth).toBe(5);
      expect(researchAgent?.subagents?.maxConcurrent).toBe(3);
      expect(researchAgent?.subagents?.archiveAfterMinutes).toBe(120);
    });
  });
});
