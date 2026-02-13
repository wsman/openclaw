/**
 * Resource Control Configuration Aggregation Module
 *
 * This module aggregates timeout and subagent depth control configurations
 * to provide a centralized interface for resource management features.
 *
 * @module resource-control
 */

import type { OpenClawConfig } from "./config.js";
import type { AgentDefaultsConfig } from "./types.agent-defaults.js";
import type { ModelProviderConfig } from "./types.models.js";

// Re-export core types
export type { ModelProviderConfig } from "./types.models.js";
export type { AgentDefaultsConfig } from "./types.agent-defaults.js";

import { resolveAgentConfig } from "../agents/agent-scope.js";
// Import runtime functions
import { resolveAgentTimeoutMs, resolveAgentTimeoutSeconds } from "../agents/timeout.js";
import { getSubagentDepth } from "../routing/session-key.js";
// Import validation functions
import { validateConfigObject } from "./validation.js";
import { AgentDefaultsSchema } from "./zod-schema.agent-defaults.js";
// Import Zod schemas
import { ModelProviderSchema } from "./zod-schema.core.js";

/**
 * Resource control configuration interface
 * Aggregates timeout and subagent depth settings
 */
export interface ResourceControlConfig {
  /** Timeout configuration */
  timeout?: {
    /** Provider-level timeout in milliseconds (preferred) */
    providerMs?: number;
    /** Provider-level timeout in milliseconds (deprecated alias) */
    deprecatedProvider?: number;
    /** Agent-level timeout in seconds */
    agentSeconds?: number;
  };

  /** Subagent configuration */
  subagents?: {
    /** Maximum depth of nested sub-agents (default: 2) */
    maxSpawnDepth?: number;
    /** Maximum concurrent sub-agent runs (default: 1) */
    maxConcurrent?: number;
    /** Auto-archive sub-agent sessions after N minutes (default: 60) */
    archiveAfterMinutes?: number;
  };
}

/**
 * Extracts resource control configuration from full OpenClaw config
 */
export function extractResourceControlConfig(cfg: OpenClawConfig): ResourceControlConfig {
  const providerTimeout = (() => {
    const providers = cfg.models?.providers;
    if (!providers) {
      return undefined;
    }

    // Find first provider with timeout configuration
    for (const provider of Object.values(providers)) {
      if (typeof provider !== "object" || !provider) {
        continue;
      }

      // Safe type assertion for timeout fields
      const providerObj = provider as unknown as { timeoutMs?: unknown; timeout?: unknown };
      const timeoutMs = providerObj.timeoutMs;
      const timeout = providerObj.timeout;

      if (typeof timeoutMs === "number") {
        return {
          providerMs: timeoutMs,
          deprecatedProvider: typeof timeout === "number" ? timeout : undefined,
        };
      }
      if (typeof timeout === "number") {
        return { deprecatedProvider: timeout, providerMs: undefined };
      }
    }
    return undefined;
  })();

  return {
    timeout: {
      ...providerTimeout,
      agentSeconds: cfg.agents?.defaults?.timeoutSeconds,
    },
    subagents: cfg.agents?.defaults?.subagents,
  };
}

/**
 * Validates resource control configuration
 * @returns Array of validation issues (empty if valid)
 */
export function validateResourceControlConfig(cfg: OpenClawConfig): Array<{
  level: "error" | "warning" | "info";
  path: string;
  message: string;
}> {
  const issues: Array<{ level: "error" | "warning" | "info"; path: string; message: string }> = [];

  // Validate provider timeouts
  const providers = cfg.models?.providers;
  if (providers) {
    for (const [providerName, provider] of Object.entries(providers)) {
      if (typeof provider !== "object" || !provider) {
        continue;
      }

      // Safe type assertion for timeout fields
      const providerObj = provider as unknown as { timeoutMs?: unknown; timeout?: unknown };
      const timeoutMs = providerObj.timeoutMs;
      const timeout = providerObj.timeout;

      // Check for deprecated timeout field
      if (typeof timeout === "number" && typeof timeoutMs !== "number") {
        issues.push({
          level: "warning",
          path: `models.providers.${providerName}.timeout`,
          message: "Use timeoutMs instead of timeout field",
        });
      }

      // Check for both timeout and timeoutMs
      if (typeof timeout === "number" && typeof timeoutMs === "number") {
        issues.push({
          level: "warning",
          path: `models.providers.${providerName}`,
          message:
            "Both timeout (deprecated) and timeoutMs fields are set. timeoutMs will be used.",
        });
      }
    }
  }

  // Validate maxSpawnDepth range
  const maxSpawnDepth = cfg.agents?.defaults?.subagents?.maxSpawnDepth;
  if (typeof maxSpawnDepth === "number") {
    if (maxSpawnDepth < 1) {
      issues.push({
        level: "error",
        path: "agents.defaults.subagents.maxSpawnDepth",
        message: "maxSpawnDepth must be at least 1",
      });
    } else if (maxSpawnDepth > 10) {
      issues.push({
        level: "error",
        path: "agents.defaults.subagents.maxSpawnDepth",
        message: "maxSpawnDepth cannot exceed 10",
      });
    }
  }

  // Validate agent-specific subagent settings
  const agentList = cfg.agents?.list;
  if (agentList) {
    for (const [index, agent] of agentList.entries()) {
      const agentMaxSpawnDepth = agent.subagents?.maxSpawnDepth;
      if (typeof agentMaxSpawnDepth === "number") {
        if (agentMaxSpawnDepth < 1) {
          issues.push({
            level: "error",
            path: `agents.list[${index}].subagents.maxSpawnDepth`,
            message: "maxSpawnDepth must be at least 1",
          });
        } else if (agentMaxSpawnDepth > 10) {
          issues.push({
            level: "error",
            path: `agents.list[${index}].subagents.maxSpawnDepth`,
            message: "maxSpawnDepth cannot exceed 10",
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Checks if a session can spawn a subagent based on depth limits
 */
export function canSpawnSubagent(
  cfg: OpenClawConfig,
  requesterSessionKey: string | undefined,
  requesterAgentId: string,
): { allowed: boolean; reason?: string; currentDepth: number; maxDepth: number } {
  const currentDepth = getSubagentDepth(requesterSessionKey);
  const maxSpawnDepth =
    cfg.agents?.defaults?.subagents?.maxSpawnDepth ??
    resolveAgentConfig(cfg, requesterAgentId)?.subagents?.maxSpawnDepth ??
    2;

  if (currentDepth >= maxSpawnDepth) {
    return {
      allowed: false,
      reason: `Maximum spawn depth (${maxSpawnDepth}) exceeded. Current depth: ${currentDepth}.`,
      currentDepth,
      maxDepth: maxSpawnDepth,
    };
  }

  return { allowed: true, currentDepth, maxDepth: maxSpawnDepth };
}

/**
 * Resolves timeout for an agent run, considering provider and agent defaults
 * This is a convenience wrapper around resolveAgentTimeoutMs
 */
export function resolveResourceTimeout(opts: {
  cfg?: OpenClawConfig;
  overrideMs?: number | null;
  overrideSeconds?: number | null;
  minMs?: number;
  provider?: string;
}): number {
  return resolveAgentTimeoutMs(opts);
}

/**
 * Gets the default maxSpawnDepth value
 */
export function getDefaultMaxSpawnDepth(): number {
  return 2;
}

/**
 * Gets the default agent timeout in seconds
 */
export function getDefaultAgentTimeoutSeconds(): number {
  return 600; // 10 minutes
}

/**
 * Gets the default provider timeout in milliseconds
 */
export function getDefaultProviderTimeoutMs(): number {
  return 600000; // 10 minutes
}

// Re-export runtime functions
export { resolveAgentTimeoutMs, resolveAgentTimeoutSeconds };

// Re-export validation functions
export { validateConfigObject };

// Re-export Zod schemas for external use
export { ModelProviderSchema, AgentDefaultsSchema };
