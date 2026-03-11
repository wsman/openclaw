import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  bindAuthorityRoom,
  getAuthorityRuntime,
  getAuthoritySnapshot,
  initializeAuthorityRuntime,
  resetAuthorityRuntime,
} from "./authorityRuntime";

const authorityStorageDir = path.resolve(process.cwd(), "storage", "authority");

afterEach(() => {
  resetAuthorityRuntime();
  fs.rmSync(authorityStorageDir, { recursive: true, force: true });
});

describe("authorityRuntime", () => {
  it("seeds policies, agents, and default tools under a single authority runtime", () => {
    const runtime = initializeAuthorityRuntime(true);

    expect(runtime.state.governance.policies.get("authority.write_mode")).toBe("single-source-of-truth");
    expect(runtime.state.governance.policies.get("agent.model.explicit_required")).toBe("true");
    expect(runtime.state.agents.size).toBeGreaterThan(0);
    expect(runtime.toolCallBridge.getToolDefinition("mcp_authority_snapshot")).toBeTruthy();
    expect(runtime.toolCallBridge.getToolDefinition("context_entropy_report")).toBeTruthy();
    expect(runtime.replicationService.getStatus().snapshotPath).toContain("snapshot.json");
    expect(runtime.monitoringService.getSnapshot().authority.eventCount).toBeGreaterThanOrEqual(0);
    expect(runtime.clusterCoordinationService.getSnapshot().enabled).toBe(false);
  });

  it("binds room ids and emits plain authority snapshots", () => {
    bindAuthorityRoom("authority-room:test");
    const runtime = getAuthorityRuntime();
    const snapshot = getAuthoritySnapshot();

    expect(runtime.state.roomId).toBe("authority-room:test");
    expect(snapshot.roomId).toBe("authority-room:test");
    expect((snapshot.governance as any).policies["authority.write_mode"]).toBe("single-source-of-truth");
  });
});
