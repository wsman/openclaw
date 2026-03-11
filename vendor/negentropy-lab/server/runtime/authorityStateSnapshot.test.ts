import { describe, expect, it } from "vitest";
import {
  AgentSessionState,
  AuthorityState,
  AuthorityTaskState,
  ClusterNodeProjectionState,
  WorkflowRuntimeState,
} from "../schema/AuthorityState";
import { authorityStateToPlain, hydrateAuthorityState } from "./authorityStateSnapshot";

describe("authorityStateSnapshot", () => {
  it("serializes and hydrates authority state including collaboration, replication, and cluster buckets", () => {
    const state = new AuthorityState();
    state.system.mode = "guarded";
    state.system.status = "warning";
    state.governance.policies.set("authority.write_mode", "single-source-of-truth");
    state.collaboration.topics.set("daily__dot__sync", "{\"topic\":\"daily.sync\"}");
    state.collaboration.lastMessages.set("direct:agent:test", "{\"to\":\"agent:test\"}");
    state.replication.status = "snapshotted";
    state.replication.snapshotPath = "storage/authority/snapshot.json";
    state.cluster.enabled = true;
    state.cluster.clusterId = "cluster:test";
    state.cluster.localNodeId = "node-a";
    state.cluster.leaderNodeId = "node-a";
    state.cluster.role = "leader";
    state.cluster.syncStatus = "leader";
    const node = new ClusterNodeProjectionState();
    state.cluster.nodes.set("node-a", node);
    node.nodeId = "node-a";
    node.status = "active";
    node.metadata.set("serviceGroups", "finance");
    state.audit.lastDecisionId = "proposal:test";

    const agent = new AgentSessionState();
    agent.id = "agent:test";
    agent.name = "Tester";
    agent.department = "TECHNOLOGY";
    agent.role = "minister";
    agent.model = "zai/glm-4.7";
    agent.provider = "zai";
    agent.capabilities.set("observe:*", "enabled");
    state.agents.set(agent.id, agent);

    const task = new AuthorityTaskState();
    task.id = "task:test";
    task.department = "TECHNOLOGY";
    task.status = "completed";
    state.tasks.set(task.id, task);

    const workflow = new WorkflowRuntimeState();
    workflow.id = "morning-brief";
    workflow.status = "completed";
    workflow.outputs.set("brief", "{\"ok\":true}");
    state.workflows.set(workflow.id, workflow);

    const plain = authorityStateToPlain(state);
    expect((plain.collaboration as any).topics["daily.sync"]).toContain("daily.sync");
    expect((plain.replication as any).snapshotPath).toContain("snapshot.json");
    expect((plain.cluster as any).leaderNodeId).toBe("node-a");

    const restored = hydrateAuthorityState(new AuthorityState(), plain);
    expect(restored.system.mode).toBe("guarded");
    expect(restored.governance.policies.get("authority.write_mode")).toBe("single-source-of-truth");
    expect(restored.collaboration.topics.get("daily.sync")).toContain("daily.sync");
    expect(restored.replication.status).toBe("snapshotted");
    expect(restored.cluster.clusterId).toBe("cluster:test");
    expect(restored.cluster.nodes.get("node-a")?.metadata.get("serviceGroups")).toBe("finance");
    expect(restored.audit.lastDecisionId).toBe("proposal:test");
    expect(restored.workflows.get("morning-brief")?.outputs.get("brief")).toContain("\"ok\":true");
  });
});
