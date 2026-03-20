import { describe, expect, it } from "vitest";
import {
  mapSessionEndEvent,
  mapSessionStartEvent,
  mapSubagentEndedEvent,
  mapSubagentSpawnedEvent,
  mapSubagentSpawningEvent,
} from "./workflow-events.js";

describe("workflow event mapping", () => {
  it("maps subagent lifecycle hooks to orchestration events", () => {
    const spawning = mapSubagentSpawningEvent(
      {
        childSessionKey: "child-1",
        agentId: "worker",
        mode: "run",
        threadRequested: false,
        label: "worker",
      },
      {
        runId: "wf-1",
        requesterSessionKey: "agent:main",
      },
    );
    expect(spawning.type).toBe("subagent_spawning");
    expect(spawning.childSessionKey).toBe("child-1");
    expect(spawning.runId).toBe("wf-1");
    expect(spawning.dedupeKey).toContain("subagent_spawning");

    const spawned = mapSubagentSpawnedEvent(
      {
        childSessionKey: "child-1",
        agentId: "worker",
        mode: "run",
        threadRequested: false,
        runId: "run-child-1",
        label: "worker",
      },
      {
        runId: "wf-1",
        requesterSessionKey: "agent:main",
      },
    );
    expect(spawned.type).toBe("subagent_spawned");
    expect(spawned.childRunId).toBe("run-child-1");
    expect(spawned.runId).toBe("wf-1");

    const ended = mapSubagentEndedEvent(
      {
        targetSessionKey: "child-1",
        targetKind: "subagent",
        reason: "done",
        outcome: "ok",
        runId: "run-child-1",
      },
      {
        runId: "wf-1",
        requesterSessionKey: "agent:main",
      },
    );
    expect(ended.type).toBe("subagent_ended");
    expect(ended.outcome).toBe("ok");
    expect(ended.runId).toBe("wf-1");
  });

  it("maps session hooks to orchestration events", () => {
    const start = mapSessionStartEvent(
      {
        sessionId: "session-1",
        sessionKey: "agent:main:session-1",
      },
      {
        channel: "webchat",
      },
    );
    expect(start.type).toBe("session_start");
    expect(start.sessionId).toBe("session-1");
    expect(start.dedupeKey).toContain("session_start");

    const end = mapSessionEndEvent(
      {
        sessionId: "session-1",
        sessionKey: "agent:main:session-1",
        messageCount: 12,
        durationMs: 500,
      },
      {
        channel: "webchat",
      },
    );
    expect(end.type).toBe("session_end");
    expect(end.metadata?.messageCount).toBe(12);
    expect(end.dedupeKey).toContain("session_end");
  });
});
