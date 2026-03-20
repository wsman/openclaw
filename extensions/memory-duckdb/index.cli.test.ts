import path from "node:path";
import { describe, expect, it, vi } from "vitest";

type CommandAction = (...args: unknown[]) => Promise<void> | void;

class CommandStub {
  readonly name: string;
  readonly children = new Map<string, CommandStub>();
  actionHandler: CommandAction | null = null;

  constructor(name: string) {
    this.name = name;
  }

  command(name: string): CommandStub {
    const key = name.split(" ")[0] ?? name;
    const child = new CommandStub(key);
    this.children.set(key, child);
    return child;
  }

  description(_value: string): this {
    return this;
  }

  option(_flags: string, _description: string, _defaultValue?: string): this {
    return this;
  }

  action(handler: CommandAction): this {
    this.actionHandler = handler;
    return this;
  }

  child(name: string): CommandStub {
    const child = this.children.get(name);
    if (!child) {
      throw new Error(`Missing command ${name}`);
    }
    return child;
  }
}

async function invokeAction(command: CommandStub, ...args: unknown[]) {
  const handler = command.actionHandler;
  expect(handler).not.toBeNull();
  if (!handler) {
    throw new Error(`Missing action handler for ${command.name}`);
  }
  await handler(...args);
}

const runtimeState = vi.hoisted(() => {
  const calls = {
    syncBusinessKnowledge: [] as string[],
    syncSkillCandidates: [] as string[],
    getStatus: 0,
    listSkillCandidates: 0,
    getSkillCandidate: [] as string[],
    transitionSkillCandidate: [] as Array<{ candidateId: string; action: string }>,
  };

  class MockMemoryDuckdbRuntime {
    async start() {}
    stop() {}
    async syncBusinessKnowledge() {
      calls.syncBusinessKnowledge.push("manual");
      return {
        trigger: "manual",
        state: "ok",
        syncedArtifactCount: 0,
        skippedArtifactCount: 0,
        failedArtifactCount: 0,
      };
    }
    async syncSkillCandidates(trigger: string) {
      calls.syncSkillCandidates.push(trigger);
      return {
        trigger,
        state: "ok",
        generatedCount: 1,
        updatedCount: 0,
        skippedCount: 0,
        failedCount: 0,
      };
    }
    async listSkillCandidates() {
      calls.listSkillCandidates += 1;
      return [
        { id: "record:candidate", metadata: { skillCandidate: { candidateId: "candidate:demo" } } },
      ];
    }
    async getSkillCandidate(candidateId: string) {
      calls.getSkillCandidate.push(candidateId);
      return { id: "record:candidate", metadata: { skillCandidate: { candidateId } } };
    }
    async transitionSkillCandidate(candidateId: string, action: string) {
      calls.transitionSkillCandidate.push({ candidateId, action });
      return { candidateId, action, lifecycleState: "approved" };
    }
    async store() {
      return {
        duplicate: false,
        record: { id: "record:memory" },
      };
    }
    async search() {
      return [];
    }
    async getById() {
      return null;
    }
    async getStatus() {
      calls.getStatus += 1;
      return {
        businessSync: { state: "ok" },
        skillCandidates: { state: "ok" },
        controlPlaneAlignment: { state: "ok" },
      };
    }
    async queryDuckDb() {
      return [];
    }
  }

  return { calls, MockMemoryDuckdbRuntime };
});

vi.mock("./src/runtime/MemoryDuckdbRuntime.js", () => ({
  MemoryDuckdbRuntime: runtimeState.MockMemoryDuckdbRuntime,
}));

describe("memory-duckdb CLI operator surface", () => {
  it("keeps status and sync commands on the selected-owner CLI only", async () => {
    const { default: memoryDuckdbPlugin } = await import("./index.js");
    let didRegisterCli = false;
    let registrar: (context: { program: CommandStub }) => void = (_context) => {
      throw new Error("Expected memory-duckdb CLI registrar to be registered");
    };

    memoryDuckdbPlugin.register?.({
      id: "memory-duckdb",
      name: "Memory (DuckDB)",
      pluginConfig: {
        storagePath: path.join("tmp", "state"),
        duckdbPath: path.join("tmp", "db", "memory.duckdb"),
      },
      resolvePath: (value: string) => value,
      runtime: {} as never,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
      registerTool: vi.fn(),
      registerCli: (value: (context: { program: CommandStub }) => void) => {
        didRegisterCli = true;
        registrar = value;
      },
      registerService: vi.fn(),
      registerHttpRoute: vi.fn(),
    } as never);

    expect(didRegisterCli).toBe(true);
    const root = new CommandStub("root");
    registrar({ program: root });
    expect([...root.child("memory").children.keys()].sort()).toEqual([
      "get",
      "search",
      "skill-candidates",
      "sql",
      "status",
      "store",
      "sync-business",
      "sync-skills",
    ]);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await invokeAction(root.child("memory").child("status"));
      await invokeAction(root.child("memory").child("sync-business"));
      await invokeAction(root.child("memory").child("sync-skills"));
      await invokeAction(root.child("memory").child("skill-candidates").child("list"));
      await invokeAction(
        root.child("memory").child("skill-candidates").child("get"),
        "candidate:demo",
      );
      await invokeAction(
        root.child("memory").child("skill-candidates").child("submit-review"),
        "candidate:demo",
      );
      await invokeAction(
        root.child("memory").child("skill-candidates").child("approve"),
        "candidate:demo",
      );
      await invokeAction(
        root.child("memory").child("skill-candidates").child("reject"),
        "candidate:demo",
      );
      await invokeAction(
        root.child("memory").child("skill-candidates").child("archive"),
        "candidate:demo",
      );
    } finally {
      logSpy.mockRestore();
    }

    expect(runtimeState.calls.getStatus).toBe(1);
    expect(runtimeState.calls.syncBusinessKnowledge).toEqual(["manual"]);
    expect(runtimeState.calls.syncSkillCandidates).toEqual(["manual"]);
    expect(runtimeState.calls.listSkillCandidates).toBe(1);
    expect(runtimeState.calls.getSkillCandidate).toEqual(["candidate:demo"]);
    expect(runtimeState.calls.transitionSkillCandidate).toEqual([
      { candidateId: "candidate:demo", action: "submit-review" },
      { candidateId: "candidate:demo", action: "approve" },
      { candidateId: "candidate:demo", action: "reject" },
      { candidateId: "candidate:demo", action: "archive" },
    ]);
  });
});
