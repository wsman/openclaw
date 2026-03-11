import { execFile } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetAuthorityRuntime } from "../runtime/authorityRuntime";
import { createNegentropyServer, NegentropyServerInstance } from "./createNegentropyServer";

const execFileAsync = promisify(execFile);
const authorityStorageDir = path.resolve(process.cwd(), "storage", "authority");

let server: NegentropyServerInstance | null = null;

async function waitForJsonCondition<T>(
  fetcher: () => Promise<T>,
  predicate: (payload: T) => boolean,
  timeoutMs = 3_000,
  intervalMs = 75,
): Promise<T> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const payload = await fetcher();
    if (predicate(payload)) {
      return payload;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("condition not met within timeout");
}

async function createRemoteMcpServer(options: {
  toolName: string;
  failHealthChecks?: number;
  result?: Record<string, unknown>;
}) {
  let healthCheckCount = 0;
  const bridge = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }
    const raw = Buffer.concat(chunks).toString("utf-8");
    const body = raw ? JSON.parse(raw) : {};
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
            description: "Remote MCP bridge tool",
            module: "remote.authority.bridge",
            inputSchema: { type: "object", properties: { item: { type: "string" } } },
            outputSchema: { type: "object" },
            tags: ["remote", "mcp"],
            metadata: { bridge: "authority-http" },
          },
        ],
      });
      return;
    }

    if (req.url === "/health") {
      healthCheckCount += 1;
      if (healthCheckCount <= (options.failHealthChecks || 0)) {
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
      send(200, {
        ok: true,
        healthy: true,
        toolCount: 1,
        loadedModules: body.modules || ["remote"],
        moduleErrors: {},
        result: {
          source: "remote-http",
          ...(options.result || {}),
          echoed: body.args || {},
        },
      });
      return;
    }

    send(404, { ok: false, error: "not found" });
  });

  await new Promise<void>((resolve) => bridge.listen(0, "127.0.0.1", () => resolve()));
  const address = bridge.address();
  const port = typeof address === "object" && address ? address.port : 0;

  return {
    endpoint: `http://127.0.0.1:${port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => bridge.close((error) => (error ? reject(error) : resolve())));
    },
  };
}

beforeEach(() => {
  resetAuthorityRuntime();
  fs.rmSync(authorityStorageDir, { recursive: true, force: true });
});

afterEach(async () => {
  if (server) {
    await server.stop();
    server = null;
  }
  resetAuthorityRuntime();
  fs.rmSync(authorityStorageDir, { recursive: true, force: true });
});

describe("createNegentropyServer authority endpoints", () => {
  it("runs the full authority governance, collaboration, replication, and entropy acceptance chain", async () => {
    server = await createNegentropyServer({
      port: 0,
      host: "127.0.0.1",
      autoStart: true,
      registerSignalHandlers: false,
      cluster: { enabled: false },
      discovery: { enabled: false },
    });

    const address = server.httpServer.address();
    const port = typeof address === "object" && address ? address.port : 0;

    const healthResponse = await fetch(`http://127.0.0.1:${port}/health`);
    const health = await healthResponse.json();
    expect(health.features.authority).toBe(true);
    expect(health.features.governance).toBe(true);
    expect(health.features.collaboration).toBe(true);
    expect(health.features.replication).toBe(true);
    expect(health.features.monitoring).toBe(true);
    expect(health.features.liveScenarios).toBe(true);

    const liveSyncResponse = await fetch(`http://127.0.0.1:${port}/api/authority/agents/sync-live`, {
      method: "POST",
    });
    const liveSync = await liveSyncResponse.json();
    expect(liveSync.ok).toBe(true);
    expect(liveSync.sync.syncedAgents).toBeGreaterThan(0);

    const registerResponse = await fetch(`http://127.0.0.1:${port}/api/authority/agents/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentId: "agent:http-tech",
        name: "HTTP Tech",
        department: "TECHNOLOGY",
        role: "minister",
        model: "zai/glm-4.7",
        provider: "zai",
        capabilities: ["observe:*", "commit:technology:*"],
      }),
    });
    const registered = await registerResponse.json();
    expect(registered.ok).toBe(true);
    expect(registered.session.agentId).toBe("agent:http-tech");

    const heartbeatResponse = await fetch(`http://127.0.0.1:${port}/api/authority/agents/agent:http-tech/heartbeat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ load: 0.2, pendingTasks: 1, healthStatus: "healthy" }),
    });
    const heartbeat = await heartbeatResponse.json();
    expect(heartbeat.ok).toBe(true);
    expect(heartbeat.session.pendingTasks).toBe(1);

    const sessionsResponse = await fetch(`http://127.0.0.1:${port}/api/authority/agents/sessions`);
    const sessions = await sessionsResponse.json();
    expect(sessions.total).toBeGreaterThan(0);
    expect(sessions.sessions.some((entry: any) => entry.agentId === "agent:http-tech")).toBe(true);

    const toolRegisterResponse = await fetch(`http://127.0.0.1:${port}/api/authority/tools/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        toolName: "mcp_http_echo",
        allowedDepartments: ["TECHNOLOGY"],
        requiredCapabilities: ["commit:technology:*"],
      }),
    });
    const toolRegistered = await toolRegisterResponse.json();
    expect(toolRegistered.ok).toBe(true);

    const mcpRegisterResponse = await fetch(`http://127.0.0.1:${port}/api/authority/tools/mcp/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        toolName: "mcp_budget_registry",
        provider: "openclaw",
        version: "2026.03",
        allowedDepartments: ["TECHNOLOGY", "OFFICE"],
        requiredCapabilities: ["commit:technology:*"],
        tags: ["budget", "mcp"],
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
        quotaLimit: 4,
      }),
    });
    const mcpRegistered = await mcpRegisterResponse.json();
    expect(mcpRegistered.ok).toBe(true);
    expect(mcpRegistered.tool.protocol).toBe("mcp");

    const discoveryResponse = await fetch(
      `http://127.0.0.1:${port}/api/authority/tools/discovery?agentId=agent:http-tech&department=TECHNOLOGY&protocol=mcp&tag=budget`,
    );
    const discovery = await discoveryResponse.json();
    expect(discovery.tools.some((entry: any) => entry.tool.toolName === "mcp_budget_registry")).toBe(true);

    const metadataResponse = await fetch(
      `http://127.0.0.1:${port}/api/authority/tools/mcp_budget_registry/metadata?agentId=agent:http-tech&department=TECHNOLOGY`,
    );
    const metadata = await metadataResponse.json();
    expect(metadata.ok).toBe(true);
    expect(metadata.access.allowed).toBe(true);

    const toolCallResponse = await fetch(`http://127.0.0.1:${port}/api/authority/tools/call`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        toolName: "mcp_http_echo",
        agentId: "agent:http-tech",
        args: { hello: "world" },
      }),
    });
    const toolCall = await toolCallResponse.json();
    expect(toolCall.ok).toBe(true);
    expect(toolCall.result.accepted).toBe(true);

    const toolUsageResponse = await fetch(`http://127.0.0.1:${port}/api/authority/tools/usage`);
    const toolUsage = await toolUsageResponse.json();
    expect(toolUsage.usage.some((entry: any) => entry.toolName === "mcp_http_echo" && entry.usageCount > 0)).toBe(true);

    const mcpServicesResponse = await fetch(`http://127.0.0.1:${port}/api/authority/tools/mcp/services`);
    const mcpServices = await mcpServicesResponse.json();
    expect(mcpServices.services.some((entry: any) => entry.serviceId === "local-mcp-core")).toBe(true);

    const mcpDiscoverResponse = await fetch(`http://127.0.0.1:${port}/api/authority/tools/mcp/discover`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ serviceId: "local-mcp-core" }),
    });
    const mcpDiscovery = await mcpDiscoverResponse.json();
    expect(mcpDiscovery.ok).toBe(true);
    expect(mcpDiscovery.discovery.services.some((entry: any) => entry.serviceId === "local-mcp-core")).toBe(true);
    expect(mcpDiscovery.discovery.syncedTools).toContain("get_codex_structure");

    const mcpHealthResponse = await fetch(
      `http://127.0.0.1:${port}/api/authority/tools/mcp/services/local-mcp-core/health-check`,
      { method: "POST" },
    );
    const mcpHealth = await mcpHealthResponse.json();
    expect(mcpHealth.ok).toBe(true);
    expect(mcpHealth.services[0].healthy).toBe(true);

    const transportMetadataResponse = await fetch(
      `http://127.0.0.1:${port}/api/authority/tools/get_codex_structure/metadata?agentId=agent:technology_ministry&department=TECHNOLOGY`,
    );
    const transportMetadata = await transportMetadataResponse.json();
    expect(transportMetadata.ok).toBe(true);
    expect(transportMetadata.access.allowed).toBe(true);

    const transportToolCallResponse = await fetch(`http://127.0.0.1:${port}/api/authority/tools/call`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        toolName: "get_codex_structure",
        agentId: "agent:technology_ministry",
        args: { law_type: "all" },
      }),
    });
    const transportToolCall = await transportToolCallResponse.json();
    expect(transportToolCall.ok).toBe(true);
    expect(transportToolCall.result.serviceId).toBe("local-mcp-core");

    const proposalResponse = await fetch(`http://127.0.0.1:${port}/api/authority/governance/conflicts`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Weekly budget conflict",
        proposer: "system",
        department: "CABINET",
        options: ["approve", "defer"],
      }),
    });
    const proposalPayload = await proposalResponse.json();
    expect(proposalPayload.ok).toBe(true);
    const proposalId = proposalPayload.proposal.proposalId as string;

    const voteResponse = await fetch(`http://127.0.0.1:${port}/api/authority/governance/conflicts/${proposalId}/vote`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        voterAgentId: "agent:http-tech",
        option: "approve",
      }),
    });
    const voted = await voteResponse.json();
    expect(voted.ok).toBe(true);
    expect(voted.proposal.votes).toHaveLength(1);

    const resolveResponse = await fetch(`http://127.0.0.1:${port}/api/authority/governance/conflicts/${proposalId}/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decider: "system" }),
    });
    const resolved = await resolveResponse.json();
    expect(resolved.ok).toBe(true);
    expect(resolved.proposal.status).toBe("resolved");

    const morningBriefResponse = await fetch(`http://127.0.0.1:${port}/api/authority/workflows/morning-brief`, {
      method: "POST",
    });
    const morningBrief = await morningBriefResponse.json();
    expect(morningBrief.ok).toBe(true);
    expect(morningBrief.brief.recommendations.length).toBeGreaterThan(0);

    const entropyDrillResponse = await fetch(`http://127.0.0.1:${port}/api/authority/workflows/entropy-drill`, {
      method: "POST",
    });
    const entropyDrill = await entropyDrillResponse.json();
    expect(entropyDrill.ok).toBe(true);
    expect(entropyDrill.drill.actions.length).toBeGreaterThan(0);

    const subscribeResponse = await fetch(`http://127.0.0.1:${port}/api/authority/collaboration/subscribe`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topic: "daily.sync",
        agentId: "agent:http-tech",
        requiredCapabilities: ["observe:*"],
      }),
    });
    const subscribed = await subscribeResponse.json();
    expect(subscribed.ok).toBe(true);

    const publishResponse = await fetch(`http://127.0.0.1:${port}/api/authority/collaboration/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topic: "daily.sync",
        from: "agent:technology_ministry",
        payload: { summary: "authority green" },
        requiredCapabilities: ["observe:*"],
      }),
    });
    const published = await publishResponse.json();
    expect(published.ok).toBe(true);
    expect(published.recipients).toContain("agent:http-tech");

    const directResponse = await fetch(`http://127.0.0.1:${port}/api/authority/collaboration/direct`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        from: "agent:technology_ministry",
        to: "agent:http-tech",
        payload: { action: "review_authority" },
      }),
    });
    const direct = await directResponse.json();
    expect(direct.ok).toBe(true);
    expect(direct.envelope.to).toBe("agent:http-tech");

    const bridgeResponse = await fetch(`http://127.0.0.1:${port}/api/authority/collaboration/workflows/morning-brief/bridge`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topic: "daily.sync",
        payload: { headline: "all clear" },
      }),
    });
    const bridged = await bridgeResponse.json();
    expect(bridged.ok).toBe(true);
    expect(bridged.envelope.from).toBe("workflow:morning-brief");

    const collaborationResponse = await fetch(`http://127.0.0.1:${port}/api/authority/collaboration`);
    const collaboration = await collaborationResponse.json();
    expect(collaboration.topics["daily.sync"]).toBeTruthy();
    expect(collaboration.lastMessages["daily.sync"]).toBeTruthy();

    const routedProposalResponse = await fetch(`http://127.0.0.1:${port}/api/authority/replication/route-proposal`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        proposer: "system",
        targetPath: "governance.policies.routed_marker",
        operation: "set",
        payload: "routed",
        reason: "e2e_route_proposal",
      }),
    });
    const routedProposal = await routedProposalResponse.json();
    expect(routedProposal.ok).toBe(true);

    const snapshotResponse = await fetch(`http://127.0.0.1:${port}/api/authority/replication/snapshot`, {
      method: "POST",
    });
    const snapshot = await snapshotResponse.json();
    expect(snapshot.ok).toBe(true);
    expect(snapshot.snapshot.snapshotPath).toContain("snapshot.json");

    const replicationResponse = await fetch(`http://127.0.0.1:${port}/api/authority/replication`);
    const replication = await replicationResponse.json();
    expect(replication.eventCount).toBeGreaterThan(0);
    expect(replication.storage).toBeTruthy();

    const monitoringResponse = await fetch(`http://127.0.0.1:${port}/api/authority/monitoring`);
    const monitoring = await monitoringResponse.json();
    expect(monitoring.authority.eventCount).toBeGreaterThan(0);
    expect(monitoring.replication.snapshotPath).toContain("snapshot.json");
    expect(Array.isArray(monitoring.alerts)).toBe(true);

    const opsResponse = await fetch(`http://127.0.0.1:${port}/api/authority/ops`);
    const ops = await opsResponse.json();
    expect(Array.isArray(ops.recommendedActions)).toBe(true);

    const liveMorningBriefResponse = await fetch(`http://127.0.0.1:${port}/api/authority/workflows/morning-brief/live`, {
      method: "POST",
    });
    const liveMorningBrief = await liveMorningBriefResponse.json();
    expect(liveMorningBrief.ok).toBe(true);
    expect(liveMorningBrief.result.brief).toBeTruthy();
    expect(Array.isArray(liveMorningBrief.result.participants)).toBe(true);

    const liveBudgetResponse = await fetch(`http://127.0.0.1:${port}/api/authority/governance/scenarios/budget-conflict`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Live budget authority scenario",
        requestedAmount: 2000000,
        options: ["approve", "reallocate", "defer"],
      }),
    });
    const liveBudget = await liveBudgetResponse.json();
    expect(liveBudget.ok).toBe(true);
    expect(liveBudget.result.resolvedProposal.status).toBe("resolved");
    expect(liveBudget.result.voters.length).toBeGreaterThan(0);

    const postLiveSnapshotResponse = await fetch(`http://127.0.0.1:${port}/api/authority/replication/snapshot`, {
      method: "POST",
    });
    const postLiveSnapshot = await postLiveSnapshotResponse.json();
    expect(postLiveSnapshot.ok).toBe(true);

    const recoverResponse = await fetch(`http://127.0.0.1:${port}/api/authority/replication/recover`, {
      method: "POST",
    });
    const recovery = await recoverResponse.json();
    expect(recovery.ok).toBe(true);
    expect(recovery.recovery.recovered).toBe(true);

    const governanceResponse = await fetch(`http://127.0.0.1:${port}/api/authority/governance`);
    const governance = await governanceResponse.json();
    expect(governance.proposals.some((entry: any) => entry.proposalId === proposalId)).toBe(true);
    expect(governance.entropy.forecastGlobal).toBeGreaterThanOrEqual(0);

    const authorityResponse = await fetch(`http://127.0.0.1:${port}/api/authority/state`);
    const authorityPayload = await authorityResponse.json();
    expect(authorityPayload.authority).toBeTruthy();
    expect(Object.keys(authorityPayload.authority.agents || {}).length).toBeGreaterThan(0);
    expect(authorityPayload.authority.governance.policies["authority.write_mode"]).toBe("single-source-of-truth");
    expect(authorityPayload.authority.collaboration.topics["daily.sync"]).toBeTruthy();
    expect(authorityPayload.authority.collaboration.topics["governance.budget"]).toBeTruthy();
    expect(authorityPayload.authority.replication.snapshotPath).toContain("snapshot.json");
    expect(authorityPayload.authority.governance.policies["routed_marker"]).toBe("routed");

    const { stdout } = await execFileAsync(
      "python",
      ["scripts/measure_entropy.py", "--url", `http://127.0.0.1:${port}/api/authority/state`, "--baseline", "0.3"],
      { cwd: process.cwd() },
    );
    const entropy = JSON.parse(stdout);
    expect(entropy.ok).toBe(true);
  });

  it("registers and discovers remote MCP services through the authority control plane", async () => {
    const remote = await createRemoteMcpServer({ toolName: "remote_http_registry" });
    server = await createNegentropyServer({
      port: 0,
      host: "127.0.0.1",
      autoStart: true,
      registerSignalHandlers: false,
      cluster: { enabled: false },
      discovery: { enabled: false },
    });

    try {
      const address = server.httpServer.address();
      const port = typeof address === "object" && address ? address.port : 0;

      const registerResponse = await fetch(`http://127.0.0.1:${port}/api/authority/tools/mcp/services/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serviceId: "remote-http-control-plane",
          provider: "remote-fixture",
          transport: "http",
          endpoint: remote.endpoint,
          source: "remote-fixture",
          modules: ["remote"],
          priority: 50,
          defaultAllowedDepartments: ["TECHNOLOGY"],
          defaultRequiredCapabilities: ["observe:*"],
        }),
      });
      const registered = await registerResponse.json();
      expect(registered.ok).toBe(true);
      expect(registered.service.serviceId).toBe("remote-http-control-plane");

      const discoverResponse = await fetch(`http://127.0.0.1:${port}/api/authority/tools/mcp/discover`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serviceId: "remote-http-control-plane" }),
      });
      const discovery = await discoverResponse.json();
      expect(discovery.ok).toBe(true);
      expect(discovery.discovery.syncedTools).toContain("remote_http_registry");

      const metadataResponse = await fetch(
        `http://127.0.0.1:${port}/api/authority/tools/remote_http_registry/metadata?department=TECHNOLOGY`,
      );
      const metadata = await metadataResponse.json();
      expect(metadata.ok).toBe(true);
      expect(metadata.tool.metadata.mcpServiceBindings.some((binding: any) => binding.serviceId === "remote-http-control-plane")).toBe(true);
    } finally {
      await remote.close();
    }
  });

  it("polls remote MCP health, applies service controls, and reflects lifecycle status in monitoring", async () => {
    const remote = await createRemoteMcpServer({
      toolName: "remote_health_lifecycle",
      failHealthChecks: 1,
      result: { source: "remote-health-lifecycle" },
    });
    server = await createNegentropyServer({
      port: 0,
      host: "127.0.0.1",
      autoStart: true,
      registerSignalHandlers: false,
      cluster: { enabled: false },
      discovery: { enabled: false },
    });

    try {
      const address = server.httpServer.address();
      const port = typeof address === "object" && address ? address.port : 0;

      const registerResponse = await fetch(`http://127.0.0.1:${port}/api/authority/tools/mcp/services/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serviceId: "remote-health-control-plane",
          provider: "remote-fixture",
          transport: "http",
          endpoint: remote.endpoint,
          source: "remote-fixture",
          modules: ["remote"],
          priority: 40,
          failureThreshold: 1,
          recoverySuccessThreshold: 1,
          pollingIntervalMs: 1000,
          defaultAllowedDepartments: ["TECHNOLOGY"],
          defaultRequiredCapabilities: ["observe:*"],
        }),
      });
      const registered = await registerResponse.json();
      expect(registered.ok).toBe(true);
      expect(registered.service.operationalMode).toBe("active");

      const discoverResponse = await fetch(`http://127.0.0.1:${port}/api/authority/tools/mcp/discover`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serviceId: "remote-health-control-plane" }),
      });
      const discovery = await discoverResponse.json();
      expect(discovery.ok).toBe(true);
      expect(discovery.discovery.syncedTools).toContain("remote_health_lifecycle");

      const failedHealthResponse = await fetch(
        `http://127.0.0.1:${port}/api/authority/tools/mcp/services/remote-health-control-plane/health-check`,
        { method: "POST" },
      );
      const failedHealth = await failedHealthResponse.json();
      expect(failedHealthResponse.status).toBe(400);
      expect(failedHealth.ok).toBe(false);

      const unhealthyServicesResponse = await fetch(`http://127.0.0.1:${port}/api/authority/tools/mcp/services`);
      const unhealthyServices = await unhealthyServicesResponse.json();
      const unhealthyService = unhealthyServices.services.find(
        (entry: any) => entry.serviceId === "remote-health-control-plane",
      );
      expect(unhealthyService.healthStatus).toBe("unhealthy");
      expect(unhealthyServices.polling.active).toBe(true);

      const pollingResponse = await fetch(`http://127.0.0.1:${port}/api/authority/tools/mcp/polling/trigger`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serviceId: "remote-health-control-plane" }),
      });
      const polling = await pollingResponse.json();
      expect(polling.ok).toBe(true);
      expect(polling.services[0].serviceId).toBe("remote-health-control-plane");
      expect(polling.services[0].healthStatus).toBe("healthy");
      expect(polling.services[0].lastPollAt).toBeGreaterThan(0);
      expect(polling.polling.active).toBe(true);

      const pauseResponse = await fetch(
        `http://127.0.0.1:${port}/api/authority/tools/mcp/services/remote-health-control-plane/control`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "pause", reason: "maintenance_window" }),
        },
      );
      const paused = await pauseResponse.json();
      expect(paused.ok).toBe(true);
      expect(paused.service.operationalMode).toBe("paused");

      const pausedMonitoringResponse = await fetch(`http://127.0.0.1:${port}/api/authority/monitoring`);
      const pausedMonitoring = await pausedMonitoringResponse.json();
      expect(pausedMonitoring.tools.pausedMcpServices).toBeGreaterThanOrEqual(1);
      expect(pausedMonitoring.alerts).toContain("mcp_service_constrained");

      const resumeResponse = await fetch(
        `http://127.0.0.1:${port}/api/authority/tools/mcp/services/remote-health-control-plane/control`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "resume", reason: "maintenance_complete" }),
        },
      );
      const resumed = await resumeResponse.json();
      expect(resumed.ok).toBe(true);
      expect(resumed.service.operationalMode).toBe("active");

      const disableResponse = await fetch(
        `http://127.0.0.1:${port}/api/authority/tools/mcp/services/remote-health-control-plane/control`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "disable", reason: "operator_disable" }),
        },
      );
      const disabled = await disableResponse.json();
      expect(disabled.ok).toBe(true);
      expect(disabled.service.enabled).toBe(false);
      expect(disabled.service.healthStatus).toBe("unhealthy");
      expect(disabled.service.healthy).toBe(false);

      const enableResponse = await fetch(
        `http://127.0.0.1:${port}/api/authority/tools/mcp/services/remote-health-control-plane/control`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "enable", reason: "operator_enable" }),
        },
      );
      const enabled = await enableResponse.json();
      expect(enabled.ok).toBe(true);
      expect(enabled.service.enabled).toBe(true);
      expect(enabled.service.healthStatus).toBe("degraded");

      const finalPollingResponse = await fetch(`http://127.0.0.1:${port}/api/authority/tools/mcp/polling/trigger`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serviceId: "remote-health-control-plane" }),
      });
      const finalPolling = await finalPollingResponse.json();
      expect(finalPolling.ok).toBe(true);
      expect(finalPolling.services[0].healthStatus).toBe("healthy");

      const finalServicesResponse = await fetch(`http://127.0.0.1:${port}/api/authority/tools/mcp/services`);
      const finalServices = await finalServicesResponse.json();
      const finalService = finalServices.services.find((entry: any) => entry.serviceId === "remote-health-control-plane");
      expect(finalService.enabled).toBe(true);
      expect(finalService.operationalMode).toBe("active");
      expect(finalService.healthStatus).toBe("healthy");
      expect(finalServices.polling.active).toBe(true);
    } finally {
      await remote.close();
    }
  });

  it("manages maintenance windows and service policy through the authority control plane", async () => {
    const remote = await createRemoteMcpServer({
      toolName: "remote_service_policy",
      result: { source: "remote-service-policy" },
    });
    server = await createNegentropyServer({
      port: 0,
      host: "127.0.0.1",
      autoStart: true,
      registerSignalHandlers: false,
      cluster: { enabled: false },
      discovery: { enabled: false },
    });

    try {
      const address = server.httpServer.address();
      const port = typeof address === "object" && address ? address.port : 0;

      const registerResponse = await fetch(`http://127.0.0.1:${port}/api/authority/tools/mcp/services/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          serviceId: "remote-policy-control-plane",
          provider: "remote-fixture",
          transport: "http",
          endpoint: remote.endpoint,
          source: "remote-fixture",
          modules: ["remote"],
          priority: 15,
          defaultAllowedDepartments: ["TECHNOLOGY"],
          defaultRequiredCapabilities: ["observe:*"],
        }),
      });
      const registered = await registerResponse.json();
      expect(registered.ok).toBe(true);

      const discoverResponse = await fetch(`http://127.0.0.1:${port}/api/authority/tools/mcp/discover`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serviceId: "remote-policy-control-plane" }),
      });
      const discovered = await discoverResponse.json();
      expect(discovered.ok).toBe(true);
      expect(discovered.discovery.syncedTools).toContain("remote_service_policy");

      const policyResponse = await fetch(
        `http://127.0.0.1:${port}/api/authority/tools/mcp/services/remote-policy-control-plane/policy`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            slo: {
              targetLatencyMs: 400,
              minSuccessRate: 0.95,
              maxFailureRate: 0.1,
              routeBias: 2,
            },
            traffic: {
              allocationPercent: 35,
              canaryPercent: 10,
              rampStepPercent: 15,
              rampIntervalMs: 1_000,
              lane: "canary",
            },
            failback: {
              maxRecoveryAttempts: 2,
              recoveryLockoutMs: 60000,
            },
            orchestration: {
              serviceGroup: "daily-brief",
              templateId: "template:daily-brief",
              preferredNodes: ["node-alpha"],
              excludedNodes: ["node-omega"],
              regions: ["cn-east-1"],
              tags: ["briefing", "canary"],
            },
          }),
        },
      );
      const policy = await policyResponse.json();
      expect(policy.ok).toBe(true);
      expect(policy.service.routeScore).toBeGreaterThan(0);
      expect(policy.service.configuredTrafficPercent).toBe(35);
      expect(policy.service.trafficLane).toBe("canary");
      expect(policy.service.orchestrationGroup).toBe("daily-brief");

      const windowId = "window:remote-policy-control-plane";
      const windowResponse = await fetch(
        `http://127.0.0.1:${port}/api/authority/tools/mcp/services/remote-policy-control-plane/windows`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            windowId,
            startAt: Date.now() - 100,
            endAt: Date.now() + 3_000,
            action: "pause",
            autoRecover: true,
            reason: "policy_window_test",
            priority: 1,
            conflictPolicy: "merge",
          }),
        },
      );
      const scheduled = await windowResponse.json();
      expect(windowResponse.status).toBe(201);
      expect(scheduled.ok).toBe(true);

      const deferredWindowResponse = await fetch(
        `http://127.0.0.1:${port}/api/authority/tools/mcp/services/remote-policy-control-plane/windows`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            windowId: "window:remote-policy-control-plane:deferred",
            startAt: Date.now(),
            endAt: Date.now() + 2_000,
            action: "isolate",
            autoRecover: true,
            reason: "policy_window_defer",
            priority: 0,
            conflictPolicy: "defer",
          }),
        },
      );
      const deferredWindow = await deferredWindowResponse.json();
      expect(deferredWindowResponse.status).toBe(201);
      expect(deferredWindow.ok).toBe(true);

      const servicesDuringWindow = await waitForJsonCondition(
        async () => {
          const response = await fetch(`http://127.0.0.1:${port}/api/authority/tools/mcp/services`);
          return response.json();
        },
        (payload: any) =>
          payload.services.some(
            (entry: any) =>
              entry.serviceId === "remote-policy-control-plane" &&
              entry.servicesInMaintenance === true &&
              entry.operationalMode === "paused" &&
              entry.maintenanceWindowCount === 2 &&
              entry.maintenanceConflictCount === 0 &&
              entry.orchestrationGroup === "daily-brief",
          ),
        5_000,
      );
      expect(servicesDuringWindow.maintenance.active).toBe(true);

      const monitoringResponse = await fetch(`http://127.0.0.1:${port}/api/authority/monitoring`);
      const monitoring = await monitoringResponse.json();
      expect(monitoring.tools.servicesInMaintenance).toBeGreaterThanOrEqual(1);
      expect(monitoring.tools.canaryMcpServices).toBeGreaterThanOrEqual(1);

      const deleteResponse = await fetch(
        `http://127.0.0.1:${port}/api/authority/tools/mcp/services/remote-policy-control-plane/windows/${windowId}`,
        {
          method: "DELETE",
        },
      );
      const deleted = await deleteResponse.json();
      expect(deleted.ok).toBe(true);

      const deleteDeferredResponse = await fetch(
        `http://127.0.0.1:${port}/api/authority/tools/mcp/services/remote-policy-control-plane/windows/window:remote-policy-control-plane:deferred`,
        {
          method: "DELETE",
        },
      );
      const deletedDeferred = await deleteDeferredResponse.json();
      expect(deletedDeferred.ok).toBe(true);

      const servicesAfterDelete = await waitForJsonCondition(
        async () => {
          const response = await fetch(`http://127.0.0.1:${port}/api/authority/tools/mcp/services`);
          return response.json();
        },
        (payload: any) =>
          payload.services.some(
            (entry: any) =>
              entry.serviceId === "remote-policy-control-plane" &&
              entry.servicesInMaintenance === false &&
              entry.operationalMode === "active" &&
              entry.maintenanceWindowCount === 0,
          ),
      );
      expect(servicesAfterDelete.services.find((entry: any) => entry.serviceId === "remote-policy-control-plane").sloStatus).toBe("healthy");
    } finally {
      await remote.close();
    }
  });

  it("exposes authority cluster coordination routes and monitoring in cluster mode", async () => {
    server = await createNegentropyServer({
      port: 0,
      host: "127.0.0.1",
      autoStart: true,
      registerSignalHandlers: false,
      cluster: {
        enabled: true,
        heartbeatIntervalMs: 100,
        metadata: {
          region: "cn-east-1",
        },
        capabilities: ["gateway", "authority", "mcp"],
      },
      discovery: { enabled: false },
    });

    const address = server.httpServer.address();
    const port = typeof address === "object" && address ? address.port : 0;

    const policyResponse = await fetch(
      `http://127.0.0.1:${port}/api/authority/tools/mcp/services/local-mcp-core/policy`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orchestration: {
            serviceGroup: "cluster-sync",
            regions: ["cn-east-1"],
            tags: ["authority", "cluster"],
          },
        }),
      },
    );
    const policy = await policyResponse.json();
    expect(policy.ok).toBe(true);
    expect(policy.service.orchestrationGroup).toBe("cluster-sync");

    const status = await waitForJsonCondition(
      async () => {
        const response = await fetch(`http://127.0.0.1:${port}/api/authority/cluster/status`);
        return response.json();
      },
      (payload: any) =>
        payload.ok === true &&
        payload.cluster.enabled === true &&
        payload.cluster.role === "leader" &&
        payload.cluster.leaderNodeId === payload.cluster.localNodeId &&
        payload.cluster.nodes.length > 0 &&
        payload.cluster.nodes.some(
          (entry: any) =>
            entry.nodeId === payload.cluster.localNodeId &&
            entry.serviceGroups.includes("cluster-sync") &&
            entry.metadata.region === "cn-east-1",
        ),
      7_000,
      100,
    );
    expect(status.cluster.syncStatus).toBe("leader");

    const recommendationResponse = await fetch(`http://127.0.0.1:${port}/api/authority/cluster/recommend-node`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        serviceGroup: "cluster-sync",
        preferredRegion: "cn-east-1",
        requireLeader: true,
        requiredCapabilities: ["gateway", "authority"],
      }),
    });
    const recommendation = await recommendationResponse.json();
    expect(recommendation.ok).toBe(true);
    expect(recommendation.recommendation.recommendedNodeId).toBe(status.cluster.localNodeId);
    expect(recommendation.recommendation.nodes[0].nodeId).toBe(status.cluster.localNodeId);
    expect(recommendation.recommendation.nodes[0].metadata.region).toBe("cn-east-1");

    const syncResponse = await fetch(`http://127.0.0.1:${port}/api/authority/cluster/sync`, {
      method: "POST",
    });
    const sync = await syncResponse.json();
    expect(sync.ok).toBe(true);
    expect(sync.cluster.enabled).toBe(true);
    expect(sync.cluster.lastPublishedAt).toBeGreaterThan(0);

    const monitoringResponse = await fetch(`http://127.0.0.1:${port}/api/authority/monitoring`);
    const monitoring = await monitoringResponse.json();
    expect(monitoring.cluster.enabled).toBe(true);
    expect(monitoring.cluster.role).toBe("leader");
    expect(monitoring.cluster.leaderNodeId).toBe(status.cluster.localNodeId);
    expect(monitoring.cluster.syncStatus).toBe("leader");
    expect(monitoring.alerts).not.toContain("authority_cluster_leader_missing");
    expect(monitoring.alerts).not.toContain("authority_cluster_sync_stale");
  });
});
