/**
 * @constitution
 * §101 同步公理: authority 投影测试需与真理源文档保持同步
 * §102 熵减原则: 保持 authority 投影测试验证路径清晰可维护
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename ProjectionService.test.ts
 * @version 1.0.0
 * @category authority/test
 * @last_updated 2026-03-10
 */

import { describe, expect, it } from "vitest";
import { AgentRegistry } from "../../schema/AgentState";
import { ControlState } from "../../schema/ControlState";
import { AgentSessionState, AuthorityState, AuthorityTaskState } from "../../schema/AuthorityState";
import { TaskState } from "../../schema/TaskState";
import { ProjectionService } from "./ProjectionService";

describe("ProjectionService", () => {
  it("projects authority agents and tasks into legacy schemas", () => {
    const state = new AuthorityState();

    const agent = new AgentSessionState();
    agent.id = "agent:test";
    agent.name = "Test Agent";
    agent.department = "TECHNOLOGY";
    agent.role = "minister";
    agent.model = "zai/glm-4.7";
    agent.provider = "zai";
    agent.status = "terminated";
    agent.available = false;
    agent.metadata.set("terminatedAt", "123456");
    agent.metadata.set("terminationReason", "manual");
    state.agents.set(agent.id, agent);

    const task = new AuthorityTaskState();
    task.id = "task:test";
    task.title = "Migration";
    task.type = "implementation";
    task.department = "TECHNOLOGY";
    task.status = "completed";
    task.assignedTo = agent.id;
    task.progress = 100;
    state.tasks.set(task.id, task);

    const projection = new ProjectionService(state);
    const agentRegistry = new AgentRegistry();
    const taskBoard = new TaskState();

    projection.syncAgentRegistry(agentRegistry);
    projection.syncTaskBoard(taskBoard);

    const legacyAgent = agentRegistry.agents.get(agent.id);
    expect(legacyAgent?.terminatedAt).toBe(123456);
    expect(legacyAgent?.terminationReason).toBe("manual");
    expect(agentRegistry.completedTasks).toBe(1);
    expect(taskBoard.completedTasks).toBe(1);
    expect(taskBoard.tasks.get(task.id)?.assignedTo).toBe(agent.id);
  });

  it("builds control, agent, and task room projections with correct aggregates", () => {
    const state = new AuthorityState();
    state.system.mode = "guarded";
    state.system.status = "warning";
    state.entropy.global = 0.4;
    state.governance.breakerLevel = 1;
    state.audit.integrity = 0.92;

    const activeAgent = new AgentSessionState();
    activeAgent.id = "agent:office";
    activeAgent.name = "Office";
    activeAgent.department = "OFFICE";
    activeAgent.role = "director";
    activeAgent.model = "zai/glm-5";
    activeAgent.provider = "zai";
    activeAgent.available = true;
    activeAgent.status = "idle";
    state.agents.set(activeAgent.id, activeAgent);

    const busyAgent = new AgentSessionState();
    busyAgent.id = "agent:tech";
    busyAgent.name = "Tech";
    busyAgent.department = "TECHNOLOGY";
    busyAgent.role = "specialist";
    busyAgent.model = "zai/glm-4.7";
    busyAgent.provider = "zai";
    busyAgent.available = true;
    busyAgent.status = "processing";
    state.agents.set(busyAgent.id, busyAgent);

    const pendingTask = new AuthorityTaskState();
    pendingTask.id = "task:pending";
    pendingTask.department = "OFFICE";
    pendingTask.status = "pending";
    state.tasks.set(pendingTask.id, pendingTask);

    const failedTask = new AuthorityTaskState();
    failedTask.id = "task:failed";
    failedTask.department = "TECHNOLOGY";
    failedTask.status = "timeout";
    state.tasks.set(failedTask.id, failedTask);

    const projection = new ProjectionService(state);
    const control = projection.getControlRoomProjection();
    const agents = projection.getAgentRoomProjection();
    const tasks = projection.getTaskRoomProjection();
    const controlState = new ControlState();

    projection.syncControlState(controlState);

    expect(control.systemMode).toBe("guarded");
    expect(control.breakerLevel).toBe(1);
    expect(control.activeAgents).toBe(2);
    expect(control.pendingTasks).toBe(1);
    expect(agents.total).toBe(2);
    expect(agents.idle).toBe(1);
    expect(agents.departments.TECHNOLOGY).toBe(1);
    expect(tasks.failed).toBe(1);
    expect(tasks.byDepartment.OFFICE).toBe(1);
    expect(controlState.systemStatus).toBe("warning");
    expect(controlState.connectedClients).toBe(2);
    expect(controlState.gatewayStatus.messageQueueSize).toBe(1);
  });
});
