export type ParsedAgentSessionKey = {
  agentId: string;
  rest: string;
};

export function parseAgentSessionKey(
  sessionKey: string | undefined | null,
): ParsedAgentSessionKey | null {
  const raw = (sessionKey ?? "").trim();
  if (!raw) {
    return null;
  }
  const parts = raw.split(":").filter(Boolean);
  if (parts.length < 3) {
    return null;
  }
  if (parts[0] !== "agent") {
    return null;
  }
  const agentId = parts[1]?.trim();
  const rest = parts.slice(2).join(":");
  if (!agentId || !rest) {
    return null;
  }
  return { agentId, rest };
}

export function isCronRunSessionKey(sessionKey: string | undefined | null): boolean {
  const parsed = parseAgentSessionKey(sessionKey);
  if (!parsed) {
    return false;
  }
  return /^cron:[^:]+:run:[^:]+$/.test(parsed.rest);
}

export function isSubagentSessionKey(sessionKey: string | undefined | null): boolean {
  const raw = (sessionKey ?? "").trim();
  if (!raw) {
    return false;
  }
  if (raw.toLowerCase().startsWith("subagent:")) {
    return true;
  }
  const parsed = parseAgentSessionKey(raw);
  return Boolean((parsed?.rest ?? "").toLowerCase().startsWith("subagent:"));
}

export function isAcpSessionKey(sessionKey: string | undefined | null): boolean {
  const raw = (sessionKey ?? "").trim();
  if (!raw) {
    return false;
  }
  const normalized = raw.toLowerCase();
  if (normalized.startsWith("acp:")) {
    return true;
  }
  const parsed = parseAgentSessionKey(raw);
  return Boolean((parsed?.rest ?? "").toLowerCase().startsWith("acp:"));
}

const THREAD_SESSION_MARKERS = [":thread:", ":topic:"];

export function resolveThreadParentSessionKey(
  sessionKey: string | undefined | null,
): string | null {
  const raw = (sessionKey ?? "").trim();
  if (!raw) {
    return null;
  }
  const normalized = raw.toLowerCase();
  let idx = -1;
  for (const marker of THREAD_SESSION_MARKERS) {
    const candidate = normalized.lastIndexOf(marker);
    if (candidate > idx) {
      idx = candidate;
    }
  }
  if (idx <= 0) {
    return null;
  }
  const parent = raw.slice(0, idx).trim();
  return parent ? parent : null;
}

/**
 * Calculate the nesting depth of a sub-agent session.
 * Returns 0 for main sessions, 1 for direct sub-agents, 2 for sub-sub-agents, etc.
 *
 * Examples:
 * - "agent:main:main" -> 0
 * - "agent:main:subagent:abc" -> 1
 * - "agent:main:subagent:abc:subagent:def" -> 2
 */
export function getSubagentDepth(sessionKey: string | undefined | null): number {
  const raw = (sessionKey ?? "").trim();
  if (!raw) {
    return 0;
  }
  const parsed = parseAgentSessionKey(raw);
  if (!parsed) {
    return 0;
  }
  // Count the number of "subagent:" segments in the rest part
  const rest = parsed.rest.toLowerCase();
  const matches = rest.match(/:subagent:/g);
  return matches ? matches.length : 0;
}
