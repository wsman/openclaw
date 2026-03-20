import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import memoryDuckdbPlugin from "./index.js";

type RegisteredTool = {
  tool: {
    name: string;
    execute: (toolCallId: string, params: Record<string, unknown>) => Promise<unknown>;
  };
  opts?: { name?: string; names?: string[] };
};

type RegisteredRoute = {
  path: string;
};

describe("memory-duckdb plugin", () => {
  let tmpDir = "";

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-duckdb-"));
  });

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("exposes the expected plugin identity and config surface", () => {
    expect(memoryDuckdbPlugin.id).toBe("memory-duckdb");
    expect(memoryDuckdbPlugin.name).toBe("Memory (DuckDB)");
    expect(memoryDuckdbPlugin.kind).toBe("memory");
    expect(typeof memoryDuckdbPlugin.register).toBe("function");

    const parsed = memoryDuckdbPlugin.configSchema?.parse?.({
      storagePath: path.join(tmpDir, "state"),
      duckdbPath: path.join(tmpDir, "db", "memory.duckdb"),
      runtimeMode: "shadow-read",
      native: { required: true },
    }) as {
      runtimeMode: string;
      native: { required: boolean };
      diagnostics: { enableHttpRoutes: boolean };
    };

    expect(parsed.runtimeMode).toBe("shadow-read");
    expect(parsed.native.required).toBe(true);
    expect(parsed.diagnostics.enableHttpRoutes).toBe(true);
    expect(() =>
      memoryDuckdbPlugin.configSchema?.parse?.({
        diagnostics: {
          enableOperatorEvidence: true,
        },
      }),
    ).toThrow("diagnostics has unknown keys: enableOperatorEvidence");
  });

  it("registers selected-owner surfaces and canonical tools", async () => {
    const registeredTools: RegisteredTool[] = [];
    const registeredCli: Array<{ commands: string[] }> = [];
    const registeredServices: Array<{ id: string }> = [];
    const registeredRoutes: RegisteredRoute[] = [];

    memoryDuckdbPlugin.register?.({
      id: "memory-duckdb",
      name: "Memory (DuckDB)",
      pluginConfig: {
        storagePath: path.join(tmpDir, "state"),
        duckdbPath: path.join(tmpDir, "db", "memory.duckdb"),
      },
      resolvePath: (value: string) => value,
      runtime: {} as never,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
      registerTool: (tool: unknown, opts?: RegisteredTool["opts"]) => {
        if (typeof tool === "function") {
          throw new Error("memory-duckdb tools should register concrete tool objects");
        }
        registeredTools.push({
          tool: tool as RegisteredTool["tool"],
          opts,
        });
      },
      registerCli: (_registrar: unknown, opts?: { commands?: string[] }) => {
        registeredCli.push({ commands: opts?.commands ?? [] });
      },
      registerService: (service: { id: string }) => {
        registeredServices.push({ id: service.id });
      },
      registerHttpRoute: (route: { path: string }) => {
        registeredRoutes.push({ path: route.path });
      },
    } as never);

    const toolNames = new Set(
      registeredTools.flatMap((entry) => entry.opts?.names ?? entry.opts?.name ?? []),
    );
    expect([...toolNames].sort()).toEqual([
      "memory_duckdb_status",
      "memory_get",
      "memory_recall",
      "memory_search",
      "memory_sql_query",
      "memory_store",
    ]);
    expect(registeredCli).toEqual([{ commands: ["memory"] }]);
    expect(registeredServices).toEqual([{ id: "memory-duckdb" }]);
    expect(registeredRoutes.map((route) => route.path).sort()).toEqual([
      "/plugin/memory-duckdb/search",
      "/plugin/memory-duckdb/sql",
      "/plugin/memory-duckdb/status",
    ]);

    const storeTool = registeredTools.find((entry) => entry.opts?.name === "memory_store")?.tool;
    const searchTool = registeredTools.find((entry) =>
      entry.opts?.names?.includes("memory_search"),
    )?.tool;
    const statusTool = registeredTools.find(
      (entry) => entry.opts?.name === "memory_duckdb_status",
    )?.tool;
    expect(storeTool).toBeDefined();
    expect(searchTool).toBeDefined();
    expect(statusTool).toBeDefined();

    await storeTool?.execute("tool-1", { text: "Remember the DuckDB slot candidate" });
    const searchResult = await searchTool?.execute("tool-2", { query: "slot candidate", limit: 3 });
    const statusResult = await statusTool?.execute("tool-3", {});
    const searchText = JSON.stringify(searchResult);
    expect(searchText).toContain("DuckDB slot candidate");
    expect(statusResult).toMatchObject({
      details: {
        pluginId: "memory-duckdb",
        businessSync: expect.any(Object),
        skillCandidates: expect.any(Object),
        controlPlaneAlignment: expect.any(Object),
        shadow: expect.any(Object),
        native: expect.any(Object),
      },
    });
  });

  it("keeps the selected-owner write tool deterministic in shadow-read mode", async () => {
    const registeredTools: RegisteredTool[] = [];

    memoryDuckdbPlugin.register?.({
      id: "memory-duckdb",
      name: "Memory (DuckDB)",
      pluginConfig: {
        storagePath: path.join(tmpDir, "state"),
        duckdbPath: path.join(tmpDir, "db", "memory.duckdb"),
        runtimeMode: "shadow-read",
      },
      resolvePath: (value: string) => value,
      runtime: {} as never,
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
      registerTool: (tool: unknown, opts?: RegisteredTool["opts"]) => {
        if (typeof tool === "function") {
          throw new Error("memory-duckdb tools should register concrete tool objects");
        }
        registeredTools.push({
          tool: tool as RegisteredTool["tool"],
          opts,
        });
      },
      registerCli: vi.fn(),
      registerService: vi.fn(),
      registerHttpRoute: vi.fn(),
    } as never);

    const storeTool = registeredTools.find((entry) => entry.opts?.name === "memory_store")?.tool;
    expect(storeTool).toBeDefined();
    await expect(storeTool?.execute("tool-shadow-read", { text: "should fail" })).rejects.toThrow(
      "runtimeMode=shadow-read is read-only",
    );
  });
});
