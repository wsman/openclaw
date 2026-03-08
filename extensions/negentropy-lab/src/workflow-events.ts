import type { WorkflowEventPayload } from "./workflow-types.js";

type SubagentContextLike = {
  runId?: string;
  requesterSessionKey?: string;
};

type SessionContextLike = {
  agentId?: string;
  sessionId?: string;
  sessionKey?: string;
  channel?: string;
};

type SubagentSpawningEventLike = {
  childSessionKey?: string;
  agentId?: string;
  mode?: string;
  label?: string;
  threadRequested?: boolean;
};

type SubagentSpawnedEventLike = {
  childSessionKey?: string;
  runId?: string;
  agentId?: string;
  mode?: string;
  label?: string;
  threadRequested?: boolean;
};

type SubagentEndedEventLike = {
  targetSessionKey?: string;
  runId?: string;
  outcome?: "ok" | "error" | "timeout" | "killed" | "reset" | "deleted";
  error?: string;
  reason?: string;
  targetKind?: string;
  accountId?: string;
  endedAt?: number;
};

type SessionStartEventLike = {
  sessionId?: string;
  sessionKey?: string;
  resumedFrom?: string;
};

type SessionEndEventLike = {
  sessionId?: string;
  sessionKey?: string;
  messageCount?: number;
  durationMs?: number;
};

const nowIso = () => new Date().toISOString();

function stablePart(value: unknown): string {
  if (typeof value !== "string") {
    return "na";
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "na";
}

function buildDedupeKey(prefix: string, parts: unknown[]): string {
  return `${prefix}:${parts.map(stablePart).join(":")}`;
}

export function mapSubagentSpawningEvent(
  event: SubagentSpawningEventLike,
  ctx?: SubagentContextLike,
): WorkflowEventPayload {
  return {
    type: "subagent_spawning",
    runId: ctx?.runId,
    childSessionKey: event.childSessionKey,
    message: "subagent spawning observed",
    ts: nowIso(),
    dedupeKey: buildDedupeKey("subagent_spawning", [ctx?.runId, event.childSessionKey]),
    metadata: {
      requesterSessionKey: ctx?.requesterSessionKey,
      agentId: event.agentId,
      mode: event.mode,
      label: event.label,
      threadRequested: event.threadRequested,
    },
  };
}

export function mapSubagentSpawnedEvent(
  event: SubagentSpawnedEventLike,
  ctx?: SubagentContextLike,
): WorkflowEventPayload {
  return {
    type: "subagent_spawned",
    runId: ctx?.runId,
    childSessionKey: event.childSessionKey,
    childRunId: event.runId,
    message: "subagent spawned",
    ts: nowIso(),
    dedupeKey: buildDedupeKey("subagent_spawned", [ctx?.runId, event.childSessionKey, event.runId]),
    metadata: {
      requesterSessionKey: ctx?.requesterSessionKey,
      agentId: event.agentId,
      mode: event.mode,
      label: event.label,
      threadRequested: event.threadRequested,
    },
  };
}

export function mapSubagentEndedEvent(
  event: SubagentEndedEventLike,
  ctx?: SubagentContextLike,
): WorkflowEventPayload {
  return {
    type: "subagent_ended",
    runId: ctx?.runId,
    childSessionKey: event.targetSessionKey,
    childRunId: event.runId,
    outcome: event.outcome ?? "error",
    error: event.error,
    message: `subagent ended: ${event.reason ?? "unknown"}`,
    ts: nowIso(),
    dedupeKey: buildDedupeKey("subagent_ended", [
      ctx?.runId,
      event.targetSessionKey,
      event.runId,
      event.outcome,
      event.reason,
      event.endedAt !== undefined ? String(event.endedAt) : "na",
    ]),
    metadata: {
      requesterSessionKey: ctx?.requesterSessionKey,
      reason: event.reason,
      targetKind: event.targetKind,
      accountId: event.accountId,
      endedAt: event.endedAt,
    },
  };
}

export function mapSessionStartEvent(
  event: SessionStartEventLike,
  ctx?: SessionContextLike,
): WorkflowEventPayload {
  return {
    type: "session_start",
    sessionId: event.sessionId,
    sessionKey: event.sessionKey,
    ts: nowIso(),
    dedupeKey: buildDedupeKey("session_start", [event.sessionId, event.sessionKey, event.resumedFrom]),
    metadata: {
      agentId: ctx?.agentId,
      resumedFrom: event.resumedFrom,
    },
  };
}

export function mapSessionEndEvent(
  event: SessionEndEventLike,
  ctx?: SessionContextLike,
): WorkflowEventPayload {
  return {
    type: "session_end",
    sessionId: event.sessionId,
    sessionKey: event.sessionKey,
    ts: nowIso(),
    dedupeKey: buildDedupeKey("session_end", [
      event.sessionId,
      event.sessionKey,
      String(event.messageCount ?? "na"),
      event.durationMs !== undefined ? String(event.durationMs) : "na",
    ]),
    metadata: {
      agentId: ctx?.agentId,
      messageCount: event.messageCount,
      durationMs: event.durationMs,
    },
  };
}
