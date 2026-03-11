/**
 * @constitution
 * §101 同步公理: authority MCP 传输测试需与真理源文档保持同步
 * §102 熵减原则: 保持 authority 传输测试验证路径清晰可维护
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename AuthorityMcpTransportService.test.ts
 * @version 1.0.0
 * @category authority/test
 * @last_updated 2026-03-10
 */

import http from "node:http";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AgentSessionState, AuthorityState } from "../../schema/AuthorityState";
import { EventStore } from "./EventStore";
import {
  AuthorityMcpTransportService,
  HttpMcpCommandRunner,
  McpCommandRunner,
  SubprocessMcpCommandRunner,
} from "./AuthorityMcpTransportService";
import { AuthorityToolCallBridge } from "./AuthorityToolCallBridge";
import { AuthorityMcpServiceConfig } from "./types";

class FakeRunner implements McpCommandRunner {
  async run(service: AuthorityMcpServiceConfig, operation: "discover" | "health" | "call") {
    if (operation === "discover") {
      return {
        ok: true,
        healthy: true,
        toolCount: 1,
        loadedModules: service.modules,
        moduleErrors: {},
        tools: [
          {
            toolName: "get_context_resources",
            description: "Return MCP resources",
            module: "engine.mcp_core.tools.resources",
            inputSchema: {
              type: "object",
              properties: {
                resource_type: { type: "string" },
              },
            },
            outputSchema: { type: "string" },
            tags: ["authority-transport", "resources"],
            metadata: {
              bridge: "authority-subprocess",
            },
          },
        ],
      };
    }

    if (operation === "health") {
      return {
        ok: true,
        healthy: true,
        toolCount: 1,
        loadedModules: service.modules,
        moduleErrors: {},
      };
    }

    return {
      ok: true,
      healthy: true,
      toolCount: 1,
      loadedModules: service.modules,
      moduleErrors: {},
      result: {
        status: "success",
        resourceType: "index",
      },
    };
  }
}

async function startMockHttpBridge(options: {
  toolName: string;
  provider?: string;
  failCalls?: number;
  failHealthChecks?: number;
  authToken?: string;
  result?: Record<string, unknown>;
}) {
  let callCount = 0;
  let healthCount = 0;
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString("utf-8");
    const body = raw ? JSON.parse(raw) : {};

    if (options.authToken && req.headers.authorization !== `Bearer ${options.authToken}`) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "unauthorized" }));
      return;
    }

    const send = (statusCode: number, payload: Record<string, unknown>) => {
      res.writeHead(statusCode, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
    };

    if (req.url === "/discover") {
      send(200, {
        ok: true,
        healthy: true,
        toolCount: 1,
        loadedModules: body.modules || ["remote"],
        moduleErrors: {},
        tools: [
          {
            toolName: options.toolName,
            description: `${options.toolName} remote tool`,
            module: "remote.http.bridge",
            inputSchema: { type: "object", properties: { q: { type: "string" } } },
            outputSchema: { type: "object" },
            tags: ["remote", "mcp"],
            metadata: {
              bridge: "authority-http",
            },
          },
        ],
      });
      return;
    }

    if (req.url === "/health") {
      healthCount += 1;
      if (healthCount <= (options.failHealthChecks || 0)) {
        send(503, {
          ok: false,
          error: "health probe failed",
        });
        return;
      }
      send(200, {
        ok: true,
        healthy: true,
        toolCount: 1,
        loadedModules: body.modules || ["remote"],
        moduleErrors: {},
      });
      return;
    }

    if (req.url === "/call") {
      callCount += 1;
      if (callCount <= (options.failCalls || 0)) {
        send(502, {
          ok: false,
          error: "primary backend unavailable",
        });
        return;
      }

      send(200, {
        ok: true,
        healthy: true,
        toolCount: 1,
        loadedModules: body.modules || ["remote"],
        moduleErrors: {},
        result: options.result || {
          provider: options.provider || "remote",
          echoed: body.args || {},
        },
      });
      return;
    }

    send(404, { ok: false, error: "not found" });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;

  return {
    endpoint: `http://127.0.0.1:${port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    },
  };
}

function registerConnectedAgent(state: AuthorityState): string {
  const agent = new AgentSessionState();
  agent.id = "agent:transport-tech";
  agent.name = "Transport Tech";
  agent.department = "TECHNOLOGY";
  agent.role = "minister";
  agent.model = "zai/glm-4.7";
  agent.provider = "zai";
  agent.available = true;
  agent.status = "ready";
  agent.connectionStatus = "connected";
  agent.healthStatus = "healthy";
  agent.sessionId = "session:transport-tech";
  agent.sessionToken = "token:transport-tech";
  agent.capacity = 2;
  agent.currentLoad = 0.1;
  agent.pendingTasks = 0;
  agent.leaseExpiresAt = Date.now() + 30_000;
  agent.capabilities.set("observe:*", "enabled");
  state.agents.set(agent.id, agent);
  return agent.id;
}

const cleanupPaths: string[] = [];
const cleanupServers: Array<() => Promise<void>> = [];

async function waitForCondition(check: () => boolean, timeoutMs = 2_000, intervalMs = 50): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (check()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("condition not met within timeout");
}

afterEach(async () => {
  await Promise.all(
    cleanupPaths.splice(0).map(async (target) => {
      await fs.rm(target, { recursive: true, force: true });
    }),
  );
  await Promise.all(cleanupServers.splice(0).map((close) => close()));
});

describe("AuthorityMcpTransportService", () => {
  it("runs subprocess MCP bridge commands and parses json output", async () => {
    const runner = new SubprocessMcpCommandRunner(2_000);
    const service: AuthorityMcpServiceConfig = {
      serviceId: "runner-ok",
      provider: "fixture",
      transport: "stdio-subprocess",
      command: "node",
      args: [
        "-e",
        "let data='';process.stdin.on('data',chunk=>data+=chunk);process.stdin.on('end',()=>process.stdout.write(JSON.stringify({ok:true,healthy:true,toolCount:1,payload:JSON.parse(data)})));",
      ],
      enabled: true,
      source: "fixture",
      modules: ["resources"],
    };

    const result = await runner.run(service, "health", { ping: true });

    expect(result.ok).toBe(true);
    expect(result.toolCount).toBe(1);
  });

  it("surfaces subprocess bridge failures and invalid json responses", async () => {
    const runner = new SubprocessMcpCommandRunner(2_000);
    const failedService: AuthorityMcpServiceConfig = {
      serviceId: "runner-fail",
      provider: "fixture",
      transport: "stdio-subprocess",
      command: "node",
      args: ["-e", "process.stderr.write('boom'); process.exit(1);"],
      enabled: true,
      source: "fixture",
      modules: ["resources"],
    };
    const invalidJsonService: AuthorityMcpServiceConfig = {
      ...failedService,
      serviceId: "runner-invalid-json",
      args: ["-e", "process.stdout.write('not-json');"],
    };

    await expect(runner.run(failedService, "health", {})).rejects.toThrow("boom");
    await expect(runner.run(invalidJsonService, "health", {})).rejects.toThrow("invalid mcp bridge json");
  });

  it("surfaces empty subprocess bridge responses", async () => {
    const runner = new SubprocessMcpCommandRunner(2_000);
    await expect(
      runner.run(
        {
          serviceId: "runner-empty",
          provider: "fixture",
          transport: "stdio-subprocess",
          command: "node",
          args: ["-e", ""],
          enabled: true,
          source: "fixture",
          modules: ["resources"],
        },
        "health",
        {},
      ),
    ).rejects.toThrow("empty mcp bridge response");
  });

  it("discovers services, syncs MCP tools, and routes calls through the authority bridge", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "authority-mcp-transport-"));
    cleanupPaths.push(tempDir);
    const configPath = path.join(tempDir, "authority-mcp-services.json");
    await fs.writeFile(
      configPath,
      JSON.stringify({
        services: [
          {
            serviceId: "fixture-mcp",
            provider: "fixture",
            transport: "stdio-subprocess",
            command: "python",
            args: ["scripts/authority_mcp_bridge.py"],
            enabled: true,
            source: "fixture",
            modules: ["resources"],
            defaultAllowedDepartments: ["TECHNOLOGY"],
            defaultRequiredCapabilities: ["observe:*"],
            tags: ["fixture"],
          },
        ],
      }),
      "utf-8",
    );

    const state = new AuthorityState();
    const eventStore = new EventStore();
    const bridge = new AuthorityToolCallBridge(state, eventStore);
    const transport = new AuthorityMcpTransportService(state, eventStore, bridge, {
      configPath,
      runner: new FakeRunner(),
    });
    const agentId = registerConnectedAgent(state);

    const discovery = await transport.discoverAndSync("fixture-mcp");

    expect(discovery.syncedTools).toContain("get_context_resources");
    expect(bridge.getToolDefinition("get_context_resources")).toMatchObject({
      toolName: "get_context_resources",
      protocol: "mcp",
      provider: "fixture",
    });

    const result = await bridge.callToolWithContext({
      toolName: "get_context_resources",
      args: { resource_type: "index" },
      agentId,
    });

    expect(result).toMatchObject({
      serviceId: "fixture-mcp",
      toolName: "get_context_resources",
    });
    expect(transport.listServices().some((service) => service.serviceId === "fixture-mcp" && service.healthy)).toBe(true);
  });

  it("fails clearly when invoking a non-configured MCP service", async () => {
    const state = new AuthorityState();
    const eventStore = new EventStore();
    const bridge = new AuthorityToolCallBridge(state, eventStore);
    const transport = new AuthorityMcpTransportService(state, eventStore, bridge, {
      configPath: path.join(os.tmpdir(), "missing-authority-mcp-services.json"),
      runner: new FakeRunner(),
    });

    await expect(transport.invokeTool("missing-service", "tool", {})).rejects.toThrow("mcp service not configured");
  });

  it("updates health snapshots for configured MCP services", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "authority-mcp-health-"));
    cleanupPaths.push(tempDir);
    const configPath = path.join(tempDir, "authority-mcp-services.json");
    await fs.writeFile(
      configPath,
      JSON.stringify({
        services: [
          {
            serviceId: "fixture-health",
            provider: "fixture",
            transport: "stdio-subprocess",
            command: "python",
            args: ["scripts/authority_mcp_bridge.py"],
            enabled: true,
            source: "fixture",
            modules: ["resources"],
          },
        ],
      }),
      "utf-8",
    );

    const state = new AuthorityState();
    const transport = new AuthorityMcpTransportService(
      state,
      new EventStore(),
      new AuthorityToolCallBridge(state, new EventStore()),
      {
        configPath,
        runner: new FakeRunner(),
      },
    );

    const snapshots = await transport.checkHealth("fixture-health");

    expect(snapshots).toHaveLength(1);
    expect(snapshots[0]).toMatchObject({
      serviceId: "fixture-health",
      healthy: true,
      toolCount: 1,
    });
  });

  it("fails clearly when discovering an unknown MCP service", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "authority-mcp-disabled-"));
    cleanupPaths.push(tempDir);
    const configPath = path.join(tempDir, "authority-mcp-services.json");
    await fs.writeFile(
      configPath,
      JSON.stringify({
        services: [
          {
            serviceId: "disabled-http",
            provider: "fixture",
            transport: "http",
            endpoint: "http://127.0.0.1:65500",
            enabled: false,
            source: "fixture",
            modules: ["remote"],
          },
        ],
      }),
      "utf-8",
    );

    const state = new AuthorityState();
    const transport = new AuthorityMcpTransportService(
      state,
      new EventStore(),
      new AuthorityToolCallBridge(state, new EventStore()),
      { configPath },
    );

    await expect(transport.discoverAndSync("missing-http")).rejects.toThrow("mcp service not configured");
  });

  it("continues aggregate health checks when one remote service fails", async () => {
    const healthyRemote = await startMockHttpBridge({
      toolName: "aggregate_health_remote",
    });
    cleanupServers.push(healthyRemote.close);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "authority-mcp-aggregate-health-"));
    cleanupPaths.push(tempDir);
    const configPath = path.join(tempDir, "authority-mcp-services.json");

    const state = new AuthorityState();
    const transport = new AuthorityMcpTransportService(
      state,
      new EventStore(),
      new AuthorityToolCallBridge(state, new EventStore()),
      { configPath },
    );

    await transport.registerService({
      serviceId: "remote-health-ok",
      provider: "fixture",
      transport: "http",
      endpoint: healthyRemote.endpoint,
      enabled: true,
      source: "fixture",
      modules: ["remote"],
    });
    await transport.registerService({
      serviceId: "remote-health-fail",
      provider: "fixture",
      transport: "http",
      endpoint: "http://127.0.0.1:65501",
      enabled: true,
      source: "fixture",
      modules: ["remote"],
    });

    const snapshots = await transport.checkHealth();
    expect(snapshots.some((entry) => entry.serviceId === "remote-health-ok" && entry.healthy)).toBe(true);
    expect(snapshots.some((entry) => entry.serviceId === "remote-health-fail" && !entry.healthy)).toBe(true);
  });

  it("rejects invalid remote and subprocess service registrations", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "authority-mcp-invalid-config-"));
    cleanupPaths.push(tempDir);
    const configPath = path.join(tempDir, "authority-mcp-services.json");

    const state = new AuthorityState();
    const transport = new AuthorityMcpTransportService(
      state,
      new EventStore(),
      new AuthorityToolCallBridge(state, new EventStore()),
      { configPath },
    );

    await expect(
      transport.registerService({
        serviceId: "bad-http",
        provider: "fixture",
        transport: "http",
        enabled: true,
        source: "fixture",
        modules: ["remote"],
      } as AuthorityMcpServiceConfig),
    ).rejects.toThrow("mcp http service requires endpoint");

    await expect(
      transport.registerService({
        serviceId: "bad-subprocess",
        provider: "fixture",
        transport: "stdio-subprocess",
        enabled: true,
        source: "fixture",
        modules: ["remote"],
      } as AuthorityMcpServiceConfig),
    ).rejects.toThrow("mcp subprocess service requires command");
  });

  it("rejects invalid json responses from remote http bridges", async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end("not-json");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    cleanupServers.push(async () => {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    });
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    const runner = new HttpMcpCommandRunner(2_000);
    await expect(
      runner.run(
        {
          serviceId: "invalid-json-http",
          provider: "fixture",
          transport: "http",
          endpoint: `http://127.0.0.1:${port}`,
          enabled: true,
          source: "fixture",
          modules: ["remote"],
        },
        "health",
        {},
      ),
    ).rejects.toThrow("invalid mcp bridge json");
  });

  it("surfaces explicit remote http bridge errors", async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "remote bridge unavailable" }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    cleanupServers.push(async () => {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    });
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    const runner = new HttpMcpCommandRunner(2_000);
    await expect(
      runner.run(
        {
          serviceId: "error-http",
          provider: "fixture",
          transport: "http",
          endpoint: `http://127.0.0.1:${port}`,
          enabled: true,
          source: "fixture",
          modules: ["remote"],
        },
        "health",
        {},
      ),
    ).rejects.toThrow("remote bridge unavailable");
  });

  it("times out slow remote http bridges", async () => {
    const server = http.createServer(async (_req, _res) => {
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    cleanupServers.push(async () => {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    });
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;

    const runner = new HttpMcpCommandRunner(50);
    await expect(
      runner.run(
        {
          serviceId: "slow-http",
          provider: "fixture",
          transport: "http",
          endpoint: `http://127.0.0.1:${port}`,
          enabled: true,
          source: "fixture",
          modules: ["remote"],
        },
        "health",
        {},
      ),
    ).rejects.toThrow("mcp http bridge timeout");
  });

  it("surfaces missing backend bindings for routed MCP tools", async () => {
    const state = new AuthorityState();
    const eventStore = new EventStore();
    const bridge = new AuthorityToolCallBridge(state, eventStore);
    const transport = new AuthorityMcpTransportService(state, eventStore, bridge, {
      configPath: path.join(os.tmpdir(), "authority-mcp-orphan-tools.json"),
    });

    bridge.registerToolDefinition(
      {
        toolName: "orphan_mcp_tool",
        protocol: "mcp",
        source: "fixture",
        provider: "fixture",
        metadata: {
          mcpServiceBindings: [],
        },
      },
      async () => ({ ok: true }),
    );

    await expect(transport.invokeToolWithFailover("orphan_mcp_tool", {})).rejects.toThrow(
      "mcp tool has no configured backends",
    );
  });

  it("continues aggregate discovery when one remote service fails", async () => {
    const healthyRemote = await startMockHttpBridge({
      toolName: "aggregate_discovery_remote",
    });
    cleanupServers.push(healthyRemote.close);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "authority-mcp-aggregate-discovery-"));
    cleanupPaths.push(tempDir);
    const configPath = path.join(tempDir, "authority-mcp-services.json");

    const state = new AuthorityState();
    const eventStore = new EventStore();
    const bridge = new AuthorityToolCallBridge(state, eventStore);
    const transport = new AuthorityMcpTransportService(state, eventStore, bridge, {
      configPath,
    });

    await transport.registerService({
      serviceId: "remote-discovery-ok",
      provider: "fixture",
      transport: "http",
      endpoint: healthyRemote.endpoint,
      enabled: true,
      source: "fixture",
      modules: ["remote"],
      defaultAllowedDepartments: ["TECHNOLOGY"],
      defaultRequiredCapabilities: ["observe:*"],
    });
    await transport.registerService({
      serviceId: "remote-discovery-fail",
      provider: "fixture",
      transport: "http",
      endpoint: "http://127.0.0.1:65502",
      enabled: true,
      source: "fixture",
      modules: ["remote"],
    });

    const discovery = await transport.discoverAndSync();
    expect(discovery.syncedTools).toContain("aggregate_discovery_remote");
    expect(discovery.services.some((entry) => entry.serviceId === "remote-discovery-ok" && entry.healthy)).toBe(true);
    expect(discovery.services.some((entry) => entry.serviceId === "remote-discovery-fail" && !entry.healthy)).toBe(true);
  });

  it("keeps existing builtin tools authoritative when a remote discovery collides on tool name", async () => {
    const remote = await startMockHttpBridge({
      toolName: "builtin_conflict_tool",
    });
    cleanupServers.push(remote.close);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "authority-mcp-conflict-"));
    cleanupPaths.push(tempDir);
    const configPath = path.join(tempDir, "authority-mcp-services.json");

    const state = new AuthorityState();
    const eventStore = new EventStore();
    const bridge = new AuthorityToolCallBridge(state, eventStore);
    bridge.registerToolDefinition(
      {
        toolName: "builtin_conflict_tool",
        source: "builtin",
        protocol: "builtin",
        provider: "builtin",
      },
      async () => ({ source: "builtin" }),
    );

    const transport = new AuthorityMcpTransportService(state, eventStore, bridge, {
      configPath,
    });

    await transport.registerService({
      serviceId: "remote-conflict",
      provider: "fixture",
      transport: "http",
      endpoint: remote.endpoint,
      enabled: true,
      source: "fixture",
      modules: ["remote"],
    });

    await transport.discoverAndSync("remote-conflict");
    const tool = bridge.getToolDefinition("builtin_conflict_tool");
    expect(tool?.protocol).toBe("builtin");
    expect(tool?.source).toBe("builtin");
  });

  it("rejects calls to configured but disabled MCP services", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "authority-mcp-disabled-service-"));
    cleanupPaths.push(tempDir);
    const configPath = path.join(tempDir, "authority-mcp-services.json");

    const state = new AuthorityState();
    const transport = new AuthorityMcpTransportService(
      state,
      new EventStore(),
      new AuthorityToolCallBridge(state, new EventStore()),
      { configPath },
    );

    await transport.registerService({
      serviceId: "disabled-service",
      provider: "fixture",
      transport: "http",
      endpoint: "http://127.0.0.1:65503",
      enabled: false,
      source: "fixture",
      modules: ["remote"],
    });

    await expect(transport.invokeTool("disabled-service", "noop", {})).rejects.toThrow("mcp service not configured");
  });

  it("moves unhealthy services through recovering back to healthy during active polling", async () => {
    const remote = await startMockHttpBridge({
      toolName: "recovering_remote_tool",
      failHealthChecks: 1,
    });
    cleanupServers.push(remote.close);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "authority-mcp-recovering-"));
    cleanupPaths.push(tempDir);
    const configPath = path.join(tempDir, "authority-mcp-services.json");

    const state = new AuthorityState();
    const eventStore = new EventStore();
    const bridge = new AuthorityToolCallBridge(state, eventStore);
    const transport = new AuthorityMcpTransportService(state, eventStore, bridge, {
      configPath,
      enableHealthPolling: false,
      recoverySuccessThreshold: 2,
    });

    await transport.registerService({
      serviceId: "recovering-service",
      provider: "fixture",
      transport: "http",
      endpoint: remote.endpoint,
      enabled: true,
      source: "fixture",
      modules: ["remote"],
      failureThreshold: 1,
      recoverySuccessThreshold: 2,
    });

    const failed = await transport.triggerHealthPoll("recovering-service");
    expect(failed[0].healthStatus).toBe("unhealthy");

    const recovering = await transport.triggerHealthPoll("recovering-service");
    expect(recovering[0].healthStatus).toBe("recovering");
    expect(recovering[0].healthy).toBe(false);

    const healthy = await transport.triggerHealthPoll("recovering-service");
    expect(healthy[0].healthStatus).toBe("healthy");
    expect(healthy[0].healthy).toBe(true);
    expect(eventStore.getAll().some((event) => event.type === "mcp.service.state.changed")).toBe(true);
  });

  it("excludes paused services from routing until resumed", async () => {
    const primary = await startMockHttpBridge({
      toolName: "paused_route_tool",
      provider: "primary",
      result: { provider: "primary" },
    });
    const backup = await startMockHttpBridge({
      toolName: "paused_route_tool",
      provider: "backup",
      result: { provider: "backup" },
    });
    cleanupServers.push(primary.close, backup.close);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "authority-mcp-control-"));
    cleanupPaths.push(tempDir);
    const configPath = path.join(tempDir, "authority-mcp-services.json");

    const state = new AuthorityState();
    const eventStore = new EventStore();
    const bridge = new AuthorityToolCallBridge(state, eventStore);
    const transport = new AuthorityMcpTransportService(state, eventStore, bridge, {
      configPath,
      enableHealthPolling: false,
    });
    const agentId = registerConnectedAgent(state);

    await transport.registerService({
      serviceId: "paused-primary",
      provider: "primary",
      transport: "http",
      endpoint: primary.endpoint,
      enabled: true,
      source: "fixture",
      modules: ["remote"],
      priority: 100,
      defaultAllowedDepartments: ["TECHNOLOGY"],
      defaultRequiredCapabilities: ["observe:*"],
    });
    await transport.registerService({
      serviceId: "paused-backup",
      provider: "backup",
      transport: "http",
      endpoint: backup.endpoint,
      enabled: true,
      source: "fixture",
      modules: ["remote"],
      priority: 10,
      defaultAllowedDepartments: ["TECHNOLOGY"],
      defaultRequiredCapabilities: ["observe:*"],
    });

    await transport.discoverAndSync("paused-primary");
    await transport.discoverAndSync("paused-backup");
    await transport.controlService("paused-primary", "pause", "maintenance");

    const result = await bridge.callToolWithContext({
      toolName: "paused_route_tool",
      args: { q: "control" },
      agentId,
    });
    expect(result.serviceId).toBe("paused-backup");

    const resumed = await transport.controlService("paused-primary", "resume", "maintenance_complete");
    expect(resumed.operationalMode).toBe("active");
    expect(eventStore.getAll().some((event) => event.type === "mcp.service.controlled")).toBe(true);
  });

  it("orchestrates maintenance windows and restores routing after the window closes", async () => {
    const primary = await startMockHttpBridge({
      toolName: "maintenance_route_tool",
      provider: "primary",
      result: { provider: "primary" },
    });
    const backup = await startMockHttpBridge({
      toolName: "maintenance_route_tool",
      provider: "backup",
      result: { provider: "backup" },
    });
    cleanupServers.push(primary.close, backup.close);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "authority-mcp-maintenance-"));
    cleanupPaths.push(tempDir);
    const configPath = path.join(tempDir, "authority-mcp-services.json");

    const state = new AuthorityState();
    const eventStore = new EventStore();
    const bridge = new AuthorityToolCallBridge(state, eventStore);
    const transport = new AuthorityMcpTransportService(state, eventStore, bridge, {
      configPath,
      enableHealthPolling: false,
      maintenanceIntervalMs: 100,
    });
    const agentId = registerConnectedAgent(state);

    await transport.registerService({
      serviceId: "maintenance-primary",
      provider: "primary",
      transport: "http",
      endpoint: primary.endpoint,
      enabled: true,
      source: "fixture",
      modules: ["remote"],
      priority: 20,
      defaultAllowedDepartments: ["TECHNOLOGY"],
      defaultRequiredCapabilities: ["observe:*"],
    });
    await transport.registerService({
      serviceId: "maintenance-backup",
      provider: "backup",
      transport: "http",
      endpoint: backup.endpoint,
      enabled: true,
      source: "fixture",
      modules: ["remote"],
      priority: 10,
      defaultAllowedDepartments: ["TECHNOLOGY"],
      defaultRequiredCapabilities: ["observe:*"],
    });

    await transport.discoverAndSync("maintenance-primary");
    await transport.discoverAndSync("maintenance-backup");

    const initial = await bridge.callToolWithContext({
      toolName: "maintenance_route_tool",
      args: { q: "initial" },
      agentId,
    });
    expect(initial.serviceId).toBe("maintenance-primary");

    await transport.scheduleMaintenanceWindow("maintenance-primary", {
      windowId: "window:maintenance-primary",
      startAt: Date.now() + 150,
      endAt: Date.now() + 450,
      action: "pause",
      autoRecover: true,
    });

    await waitForCondition(() => {
      const service = transport.listServices().find((entry) => entry.serviceId === "maintenance-primary");
      return Boolean(service?.servicesInMaintenance && service.operationalMode === "paused");
    });

    const duringWindow = await bridge.callToolWithContext({
      toolName: "maintenance_route_tool",
      args: { q: "maintenance" },
      agentId,
    });
    expect(duringWindow.serviceId).toBe("maintenance-backup");

    await waitForCondition(() => {
      const service = transport.listServices().find((entry) => entry.serviceId === "maintenance-primary");
      return Boolean(service && !service.servicesInMaintenance && service.operationalMode === "active");
    }, 3_000, 75);

    const recovered = await bridge.callToolWithContext({
      toolName: "maintenance_route_tool",
      args: { q: "recovered" },
      agentId,
    });
    expect(recovered.serviceId).toBe("maintenance-primary");
    expect(eventStore.getAll().some((event) => event.type === "mcp.service.window.executed")).toBe(true);
  });

  it("prefers higher-scoring healthy services after SLO degradation on the primary backend", async () => {
    const primary = await startMockHttpBridge({
      toolName: "weighted_route_tool",
      provider: "primary",
      failCalls: 1,
    });
    const backup = await startMockHttpBridge({
      toolName: "weighted_route_tool",
      provider: "backup",
      result: { provider: "backup" },
    });
    cleanupServers.push(primary.close, backup.close);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "authority-mcp-weighted-"));
    cleanupPaths.push(tempDir);
    const configPath = path.join(tempDir, "authority-mcp-services.json");

    const state = new AuthorityState();
    const eventStore = new EventStore();
    const bridge = new AuthorityToolCallBridge(state, eventStore);
    const transport = new AuthorityMcpTransportService(state, eventStore, bridge, {
      configPath,
      enableHealthPolling: false,
    });
    const agentId = registerConnectedAgent(state);

    await transport.registerService({
      serviceId: "weighted-primary",
      provider: "primary",
      transport: "http",
      endpoint: primary.endpoint,
      enabled: true,
      source: "fixture",
      modules: ["remote"],
      priority: 20,
      slo: {
        targetLatencyMs: 500,
        minSuccessRate: 0.95,
        maxFailureRate: 0.1,
        routeBias: 1,
      },
      defaultAllowedDepartments: ["TECHNOLOGY"],
      defaultRequiredCapabilities: ["observe:*"],
    });
    await transport.registerService({
      serviceId: "weighted-backup",
      provider: "backup",
      transport: "http",
      endpoint: backup.endpoint,
      enabled: true,
      source: "fixture",
      modules: ["remote"],
      priority: 10,
      slo: {
        targetLatencyMs: 500,
        minSuccessRate: 0.95,
        maxFailureRate: 0.1,
        routeBias: 1,
      },
      defaultAllowedDepartments: ["TECHNOLOGY"],
      defaultRequiredCapabilities: ["observe:*"],
    });

    await transport.discoverAndSync("weighted-primary");
    await transport.discoverAndSync("weighted-backup");

    const first = await bridge.callToolWithContext({
      toolName: "weighted_route_tool",
      args: { q: "first" },
      agentId,
    });
    expect(first.serviceId).toBe("weighted-backup");

    const snapshots = transport.listServices();
    const primarySnapshot = snapshots.find((entry) => entry.serviceId === "weighted-primary");
    const backupSnapshot = snapshots.find((entry) => entry.serviceId === "weighted-backup");
    expect(primarySnapshot?.sloStatus).not.toBe("healthy");
    expect((backupSnapshot?.routeScore || 0)).toBeGreaterThan(primarySnapshot?.routeScore || 0);

    const second = await bridge.callToolWithContext({
      toolName: "weighted_route_tool",
      args: { q: "second" },
      agentId,
    });
    expect(second.serviceId).toBe("weighted-backup");
  });

  it("locks failback after repeated recovery attempts and keeps the service off the route path", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "authority-mcp-lockout-"));
    cleanupPaths.push(tempDir);
    const configPath = path.join(tempDir, "authority-mcp-services.json");

    const primaryHealthScript = ["fail", "success", "fail", "success", "success"];
    const runner: McpCommandRunner = {
      async run(service, operation) {
        if (operation === "discover") {
          return {
            ok: true,
            healthy: true,
            toolCount: 1,
            loadedModules: service.modules,
            moduleErrors: {},
            tools: [
              {
                toolName: "lockout_route_tool",
                description: "Lockout route tool",
                module: "fixture.lockout",
                inputSchema: { type: "object" },
                outputSchema: { type: "object" },
                tags: ["mcp", "lockout"],
                metadata: {},
              },
            ],
          };
        }

        if (service.serviceId === "lockout-primary" && operation === "health") {
          const next = primaryHealthScript.shift() || "success";
          if (next === "fail") {
            throw new Error("scripted primary health failure");
          }
        }

        return {
          ok: true,
          healthy: true,
          toolCount: 1,
          loadedModules: service.modules,
          moduleErrors: {},
          result: {
            provider: service.provider,
          },
        };
      },
    };

    const state = new AuthorityState();
    const eventStore = new EventStore();
    const bridge = new AuthorityToolCallBridge(state, eventStore);
    const transport = new AuthorityMcpTransportService(state, eventStore, bridge, {
      configPath,
      runner,
      enableHealthPolling: false,
    });
    const agentId = registerConnectedAgent(state);

    await transport.registerService({
      serviceId: "lockout-primary",
      provider: "primary",
      transport: "http",
      endpoint: "http://fixture-primary",
      enabled: true,
      source: "fixture",
      modules: ["remote"],
      failureThreshold: 1,
      recoverySuccessThreshold: 2,
      failback: {
        maxRecoveryAttempts: 1,
        recoveryLockoutMs: 30_000,
      },
      defaultAllowedDepartments: ["TECHNOLOGY"],
      defaultRequiredCapabilities: ["observe:*"],
    });
    await transport.registerService({
      serviceId: "lockout-backup",
      provider: "backup",
      transport: "http",
      endpoint: "http://fixture-backup",
      enabled: true,
      source: "fixture",
      modules: ["remote"],
      defaultAllowedDepartments: ["TECHNOLOGY"],
      defaultRequiredCapabilities: ["observe:*"],
    });

    await transport.discoverAndSync("lockout-primary");
    await transport.discoverAndSync("lockout-backup");

    const failed = await transport.triggerHealthPoll("lockout-primary");
    expect(failed[0].healthStatus).toBe("unhealthy");

    const recovering = await transport.triggerHealthPoll("lockout-primary");
    expect(recovering[0].healthStatus).toBe("recovering");

    const locked = await transport.triggerHealthPoll("lockout-primary");
    expect(locked[0].healthStatus).toBe("unhealthy");
    expect(locked[0].recoveryLockoutUntil).toBeGreaterThan(Date.now());

    const routed = await bridge.callToolWithContext({
      toolName: "lockout_route_tool",
      args: { q: "lockout" },
      agentId,
    });
    expect(routed.serviceId).toBe("lockout-backup");
    expect(eventStore.getAll().some((event) => event.type === "mcp.service.recovery.locked")).toBe(true);
  });

  it("registers a remote http MCP service, discovers tools, and routes calls", async () => {
    const remote = await startMockHttpBridge({
      toolName: "remote_budget_lookup",
      provider: "remote-fixture",
      authToken: "secret-token",
      result: {
        budget: "green",
      },
    });
    cleanupServers.push(remote.close);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "authority-mcp-remote-"));
    cleanupPaths.push(tempDir);
    const configPath = path.join(tempDir, "authority-mcp-services.json");

    const state = new AuthorityState();
    const eventStore = new EventStore();
    const bridge = new AuthorityToolCallBridge(state, eventStore);
    const transport = new AuthorityMcpTransportService(state, eventStore, bridge, {
      configPath,
    });
    const agentId = registerConnectedAgent(state);

    const snapshot = await transport.registerService({
      serviceId: "remote-http-primary",
      provider: "remote-fixture",
      transport: "http",
      endpoint: remote.endpoint,
      auth: {
        type: "bearer",
        token: "secret-token",
      },
      enabled: true,
      source: "remote-fixture",
      modules: ["remote"],
      priority: 20,
      defaultAllowedDepartments: ["TECHNOLOGY"],
      defaultRequiredCapabilities: ["observe:*"],
      tags: ["remote"],
    });

    expect(snapshot.transport).toBe("http");
    expect(snapshot.endpoint).toBe(remote.endpoint);

    const discovery = await transport.discoverAndSync("remote-http-primary");
    expect(discovery.syncedTools).toContain("remote_budget_lookup");

    const tool = bridge.getToolDefinition("remote_budget_lookup");
    expect(tool).toBeTruthy();
    expect(Array.isArray(tool?.metadata?.mcpServiceBindings)).toBe(true);
    expect((tool?.metadata?.mcpServiceBindings as Array<unknown>).length).toBe(1);

    const result = await bridge.callToolWithContext({
      toolName: "remote_budget_lookup",
      args: { q: "budget" },
      agentId,
    });

    expect(result).toMatchObject({
      serviceId: "remote-http-primary",
      toolName: "remote_budget_lookup",
    });
  });

  it("fails over to a healthy backup MCP service when the primary backend errors", async () => {
    const primary = await startMockHttpBridge({
      toolName: "shared_remote_tool",
      provider: "primary",
      failCalls: 1,
    });
    const backup = await startMockHttpBridge({
      toolName: "shared_remote_tool",
      provider: "backup",
      result: {
        provider: "backup",
        status: "ok",
      },
    });
    cleanupServers.push(primary.close, backup.close);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "authority-mcp-failover-"));
    cleanupPaths.push(tempDir);
    const configPath = path.join(tempDir, "authority-mcp-services.json");

    const state = new AuthorityState();
    const eventStore = new EventStore();
    const bridge = new AuthorityToolCallBridge(state, eventStore);
    const transport = new AuthorityMcpTransportService(state, eventStore, bridge, {
      configPath,
    });
    const agentId = registerConnectedAgent(state);

    await transport.registerService({
      serviceId: "remote-primary",
      provider: "primary",
      transport: "http",
      endpoint: primary.endpoint,
      enabled: true,
      source: "remote",
      modules: ["remote"],
      priority: 100,
      defaultAllowedDepartments: ["TECHNOLOGY"],
      defaultRequiredCapabilities: ["observe:*"],
      tags: ["remote", "primary"],
    });
    await transport.registerService({
      serviceId: "remote-backup",
      provider: "backup",
      transport: "http",
      endpoint: backup.endpoint,
      enabled: true,
      source: "remote",
      modules: ["remote"],
      priority: 10,
      defaultAllowedDepartments: ["TECHNOLOGY"],
      defaultRequiredCapabilities: ["observe:*"],
      tags: ["remote", "backup"],
    });

    await transport.discoverAndSync("remote-primary");
    await transport.discoverAndSync("remote-backup");

    const result = await bridge.callToolWithContext({
      toolName: "shared_remote_tool",
      args: { q: "failover" },
      agentId,
    });

    expect(result).toMatchObject({
      serviceId: "remote-backup",
      toolName: "shared_remote_tool",
      attemptedServices: ["remote-primary", "remote-backup"],
    });
    expect(eventStore.getAll().some((event) => event.type === "mcp.service.failover")).toBe(true);
  });

  it("distributes MCP traffic by configured percentages across healthy backends", async () => {
    const primary = await startMockHttpBridge({
      toolName: "traffic_layer_tool",
      provider: "primary",
      result: { provider: "primary" },
    });
    const canary = await startMockHttpBridge({
      toolName: "traffic_layer_tool",
      provider: "canary",
      result: { provider: "canary" },
    });
    cleanupServers.push(primary.close, canary.close);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "authority-mcp-traffic-"));
    cleanupPaths.push(tempDir);
    const configPath = path.join(tempDir, "authority-mcp-services.json");

    const state = new AuthorityState();
    const eventStore = new EventStore();
    const bridge = new AuthorityToolCallBridge(state, eventStore);
    const transport = new AuthorityMcpTransportService(state, eventStore, bridge, {
      configPath,
      enableHealthPolling: false,
    });
    const agentId = registerConnectedAgent(state);

    await transport.registerService({
      serviceId: "traffic-primary",
      provider: "primary",
      transport: "http",
      endpoint: primary.endpoint,
      enabled: true,
      source: "fixture",
      modules: ["remote"],
      priority: 20,
      traffic: {
        allocationPercent: 80,
        lane: "primary",
      },
      defaultAllowedDepartments: ["TECHNOLOGY"],
      defaultRequiredCapabilities: ["observe:*"],
    });
    await transport.registerService({
      serviceId: "traffic-canary",
      provider: "canary",
      transport: "http",
      endpoint: canary.endpoint,
      enabled: true,
      source: "fixture",
      modules: ["remote"],
      priority: 5,
      traffic: {
        allocationPercent: 20,
        lane: "canary",
      },
      defaultAllowedDepartments: ["TECHNOLOGY"],
      defaultRequiredCapabilities: ["observe:*"],
    });

    await transport.discoverAndSync("traffic-primary");
    await transport.discoverAndSync("traffic-canary");
    await transport.triggerHealthPoll("traffic-primary");
    await transport.triggerHealthPoll("traffic-canary");

    const counts = new Map<string, number>();
    for (let index = 0; index < 100; index += 1) {
      const result = await bridge.callToolWithContext({
        toolName: "traffic_layer_tool",
        args: { requestId: `traffic-${index}` },
        agentId,
      });
      counts.set(result.serviceId, (counts.get(result.serviceId) || 0) + 1);
    }

    expect((counts.get("traffic-primary") || 0)).toBeGreaterThan(55);
    expect((counts.get("traffic-canary") || 0)).toBeGreaterThan(5);
    expect((counts.get("traffic-canary") || 0)).toBeLessThan(45);
  });

  it("ramps recovered services through canary traffic before restoring full allocation", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "authority-mcp-canary-ramp-"));
    cleanupPaths.push(tempDir);
    const configPath = path.join(tempDir, "authority-mcp-services.json");
    let canaryHealthChecks = 0;

    const runner: McpCommandRunner = {
      async run(service, operation) {
        if (operation === "discover") {
          return {
            ok: true,
            healthy: true,
            toolCount: 1,
            loadedModules: service.modules,
            moduleErrors: {},
            tools: [
              {
                toolName: "canary_ramp_tool",
                description: "Canary ramp tool",
                module: "fixture.canary",
                inputSchema: { type: "object" },
                outputSchema: { type: "object" },
                tags: ["mcp", "canary"],
                metadata: {},
              },
            ],
          };
        }

        if (operation === "health" && service.serviceId === "canary-ramp-service") {
          canaryHealthChecks += 1;
          if (canaryHealthChecks === 1) {
            return {
              ok: true,
              healthy: false,
              toolCount: 1,
              loadedModules: service.modules,
              moduleErrors: {},
            };
          }
        }

        return {
          ok: true,
          healthy: true,
          toolCount: 1,
          loadedModules: service.modules,
          moduleErrors: {},
          result: {
            provider: service.serviceId,
          },
        };
      },
    };

    const state = new AuthorityState();
    const eventStore = new EventStore();
    const bridge = new AuthorityToolCallBridge(state, eventStore);
    const transport = new AuthorityMcpTransportService(state, eventStore, bridge, {
      configPath,
      runner,
      enableHealthPolling: false,
    });

    await transport.registerService({
      serviceId: "canary-ramp-service",
      provider: "fixture",
      transport: "http",
      endpoint: "http://fixture.local/canary-ramp",
      enabled: true,
      source: "fixture",
      modules: ["remote"],
      failureThreshold: 1,
      recoverySuccessThreshold: 1,
      traffic: {
        allocationPercent: 50,
        canaryPercent: 10,
        rampStepPercent: 20,
        rampIntervalMs: 50,
        lane: "canary",
      },
      failback: {
        minHealthyDurationMs: 5_000,
      },
      defaultAllowedDepartments: ["TECHNOLOGY"],
      defaultRequiredCapabilities: ["observe:*"],
    });

    await transport.discoverAndSync("canary-ramp-service");

    const unhealthy = await transport.triggerHealthPoll("canary-ramp-service");
    expect(unhealthy[0].healthStatus).toBe("unhealthy");
    expect(unhealthy[0].effectiveTrafficPercent).toBe(0);

    const recovering = await transport.triggerHealthPoll("canary-ramp-service");
    expect(recovering[0].healthStatus).toBe("healthy");
    expect(recovering[0].effectiveTrafficPercent).toBe(10);

    await waitForCondition(() => {
      const snapshot = transport.listServices().find((entry) => entry.serviceId === "canary-ramp-service");
      return Boolean(snapshot && snapshot.effectiveTrafficPercent >= 30);
    }, 2_000, 25);

    const ramped = transport.listServices().find((entry) => entry.serviceId === "canary-ramp-service");
    expect(ramped?.effectiveTrafficPercent).toBeGreaterThanOrEqual(30);
    expect(ramped?.configuredTrafficPercent).toBe(50);
    expect(ramped?.trafficLane).toBe("canary");
  });

  it("persists orchestration metadata and resolves overlapping maintenance windows", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "authority-mcp-orchestration-"));
    cleanupPaths.push(tempDir);
    const configPath = path.join(tempDir, "authority-mcp-services.json");

    const state = new AuthorityState();
    const eventStore = new EventStore();
    const bridge = new AuthorityToolCallBridge(state, eventStore);
    const transport = new AuthorityMcpTransportService(state, eventStore, bridge, {
      configPath,
      runner: new FakeRunner(),
      enableHealthPolling: false,
    });

    await transport.registerService({
      serviceId: "orchestration-service",
      provider: "fixture",
      transport: "http",
      endpoint: "http://fixture.local/orchestration",
      enabled: true,
      source: "fixture",
      modules: ["remote"],
      defaultAllowedDepartments: ["TECHNOLOGY"],
      defaultRequiredCapabilities: ["observe:*"],
    });

    const updated = await transport.updateServicePolicy("orchestration-service", {
      traffic: {
        allocationPercent: 35,
        canaryPercent: 10,
        lane: "background",
      },
      orchestration: {
        serviceGroup: "finance",
        templateId: "template:finance-primary",
        preferredNodes: ["node-a", "node-b"],
        excludedNodes: ["node-z"],
        regions: ["cn-east-1"],
        tags: ["batch", "finance"],
      },
    });

    const startAt = Date.now() + 5_000;
    await transport.scheduleMaintenanceWindow("orchestration-service", {
      windowId: "window:base",
      startAt,
      endAt: startAt + 1_000,
      action: "pause",
      priority: 1,
      conflictPolicy: "merge",
    });
    const merged = await transport.scheduleMaintenanceWindow("orchestration-service", {
      windowId: "window:overlap",
      startAt: startAt + 500,
      endAt: startAt + 2_000,
      action: "disable",
      priority: 5,
      conflictPolicy: "merge",
    });

    expect(updated.orchestrationGroup).toBe("finance");
    expect(updated.orchestrationTemplate).toBe("template:finance-primary");
    expect(updated.trafficLane).toBe("background");
    expect(merged.maintenanceWindowCount).toBe(1);
    expect(merged.maintenanceConflictCount).toBe(0);

    const persisted = JSON.parse(await fs.readFile(configPath, "utf-8")) as {
      services: Array<AuthorityMcpServiceConfig>;
    };
    const stored = persisted.services.find((entry) => entry.serviceId === "orchestration-service");
    expect(stored?.orchestration?.serviceGroup).toBe("finance");
    expect(stored?.traffic?.allocationPercent).toBe(35);
    expect(stored?.maintenanceWindows?.length).toBe(1);
    expect(stored?.maintenanceWindows?.[0].action).toBe("disable");
    expect(stored?.maintenanceWindows?.[0].startAt).toBe(startAt);
    expect(stored?.maintenanceWindows?.[0].endAt).toBe(startAt + 2_000);
    expect(eventStore.getAll().some((event) => event.type === "mcp.service.window.conflict.resolved")).toBe(true);
    expect(eventStore.getAll().some((event) => event.type === "mcp.service.orchestration.updated")).toBe(true);
  });
});
