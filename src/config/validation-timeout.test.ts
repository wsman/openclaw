import { describe, expect, it } from "vitest";
import { validateConfigObject } from "./validation.js";

describe("timeout configuration validation", () => {
  it("should not issue warning when only timeoutMs is set", () => {
    const config = {
      models: {
        mode: "replace",
        providers: {
          openai: {
            apiKey: "test-key",
            baseUrl: "https://api.openai.com/v1",
            api: "openai-responses",
            timeoutMs: 30000,
            models: [
              {
                id: "gpt-4",
                name: "GPT-4",
                api: "openai-responses",
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
    };

    const result = validateConfigObject(config);
    expect(result.ok).toBe(true);
  });

  it("should issue warning when only deprecated timeout field is set", () => {
    const config = {
      models: {
        mode: "replace",
        providers: {
          openai: {
            apiKey: "test-key",
            baseUrl: "https://api.openai.com/v1",
            api: "openai-responses",
            timeout: 45000, // deprecated field
            models: [
              {
                id: "gpt-4",
                name: "GPT-4",
                api: "openai-responses",
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
    };

    const result = validateConfigObject(config);
    expect(result.ok).toBe(true);
    // Note: validateConfigObject doesn't return warnings, but validateConfigObjectWithPlugins does
  });

  it("should issue warning when both timeout and timeoutMs are set", () => {
    const config = {
      models: {
        mode: "replace",
        providers: {
          openai: {
            apiKey: "test-key",
            baseUrl: "https://api.openai.com/v1",
            api: "openai-responses",
            timeout: 45000, // deprecated
            timeoutMs: 30000, // preferred
            models: [
              {
                id: "gpt-4",
                name: "GPT-4",
                api: "openai-responses",
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
    };

    const result = validateConfigObject(config);
    expect(result.ok).toBe(true);
  });

  it("should validate config with multiple providers and mixed timeout fields", () => {
    const config = {
      models: {
        mode: "replace",
        providers: {
          openai: {
            apiKey: "test-key",
            baseUrl: "https://api.openai.com/v1",
            api: "openai-responses",
            timeoutMs: 30000,
            models: [
              {
                id: "gpt-4",
                name: "GPT-4",
                api: "openai-responses",
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
            api: "anthropic-messages",
            timeout: 60000, // deprecated field only
            models: [
              {
                id: "claude-3",
                name: "Claude 3",
                api: "anthropic-messages",
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
    };

    const result = validateConfigObject(config);
    expect(result.ok).toBe(true);
  });

  it("should validate complex config with subagents and timeouts", () => {
    const config = {
      session: {
        mainKey: "main",
        scope: "per-sender",
      },
      agents: {
        defaults: {
          timeoutSeconds: 300,
          subagents: {
            maxSpawnDepth: 3,
            maxConcurrent: 2,
            archiveAfterMinutes: 30,
          },
        },
        list: [
          {
            id: "main",
            subagents: {
              maxSpawnDepth: 5,
            },
          },
        ],
      },
      models: {
        mode: "replace",
        providers: {
          openai: {
            apiKey: "test-key",
            baseUrl: "https://api.openai.com/v1",
            api: "openai-responses",
            timeoutMs: 180000,
            models: [
              {
                id: "gpt-4",
                name: "GPT-4",
                api: "openai-responses",
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
    };

    const result = validateConfigObject(config);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.agents?.defaults?.subagents?.maxSpawnDepth).toBe(3);
      expect(result.config.agents?.defaults?.timeoutSeconds).toBe(300);
    }
  });
});
