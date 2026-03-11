/**
 * @constitution
 * §101 同步公理: authority 合规测试需与真理源文档保持同步
 * §102 熵减原则: 保持 authority 合规测试验证路径清晰可维护
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename AuthorityConstitutionCompliance.test.ts
 * @version 1.0.0
 * @category authority/test
 * @last_updated 2026-03-10
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AgentSessionState } from "../../schema/AuthorityState";
import { resetAuthorityRuntime, initializeAuthorityRuntime } from "../../runtime/authorityRuntime";
import { authorityStateToPlain } from "../../runtime/authorityStateSnapshot";

const authorityStorageDir = path.resolve(process.cwd(), "storage", "authority");

afterEach(() => {
  resetAuthorityRuntime();
  fs.rmSync(authorityStorageDir, { recursive: true, force: true });
});

describe("Authority constitutional compliance", () => {
  it("§101 maintains a single authoritative truth root with explicit write policy", () => {
    const runtime = initializeAuthorityRuntime(true);
    const plain = authorityStateToPlain(runtime.state);

    expect(runtime.state.governance.policies.get("authority.write_mode")).toBe("single-source-of-truth");
    expect((plain.governance as any).policies["authority.write_mode"]).toBe("single-source-of-truth");
  });

  it("§108.1 and §130 enforce explicit model parameters and department-bound access", async () => {
    const runtime = initializeAuthorityRuntime(true);

    expect(() =>
      runtime.agentSessionRegistry.registerSession({
        agentId: "agent:invalid",
        name: "Invalid",
        department: "TECHNOLOGY",
        role: "worker",
        model: "",
        provider: "",
        capabilities: ["observe:*"],
      }),
    ).toThrow("explicit model and provider");

    const foreign = new AgentSessionState();
    foreign.id = "agent:foreign";
    foreign.name = "Foreign";
    foreign.department = "FOREIGN_AFFAIRS";
    foreign.role = "minister";
    foreign.model = "zai/glm-4.7";
    foreign.provider = "zai";
    foreign.available = true;
    foreign.connectionStatus = "connected";
    foreign.capabilities.set("observe:*", "enabled");
    runtime.state.agents.set(foreign.id, foreign);

    runtime.toolCallBridge.registerToolDefinition(
      {
        toolName: "mcp_constitutional_budget",
        allowedDepartments: ["TECHNOLOGY"],
        requiredCapabilities: ["commit:technology:*"],
      },
      async () => ({ approved: true }),
    );

    await expect(
      runtime.toolCallBridge.callToolWithContext({
        toolName: "mcp_constitutional_budget",
        agentId: "agent:foreign",
        args: {},
      }),
    ).rejects.toThrow();
  });

  it("§151 preserves the audit chain across snapshot and recovery", () => {
    const runtime = initializeAuthorityRuntime(true);
    runtime.replicationService.routeProposal({
      proposer: "system",
      targetPath: "governance.policies.audit_marker",
      operation: "set",
      payload: "preserved",
      reason: "constitutional_persistence",
    });

    const snapshot = runtime.replicationService.snapshot();
    expect(snapshot.eventCount).toBeGreaterThan(0);

    resetAuthorityRuntime();
    const recoveredRuntime = initializeAuthorityRuntime(true);
    const recovery = recoveredRuntime.replicationService.recover();

    expect(recovery.recovered).toBe(true);
    expect(recoveredRuntime.state.governance.policies.get("audit_marker")).toBe("preserved");
    expect(recoveredRuntime.state.audit.totalEvents).toBeGreaterThan(0);
  });
});
