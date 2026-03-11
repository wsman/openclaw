/**
 * @constitution
 * §101 同步公理: authority 复制测试需与真理源文档保持同步
 * §102 熵减原则: 保持 authority 复制测试验证路径清晰可维护
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename AuthorityReplicationService.test.ts
 * @version 1.0.0
 * @category authority/test
 * @last_updated 2026-03-10
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { AuthorityState } from "../../schema/AuthorityState";
import { BreakerService } from "../governance/BreakerService";
import { EntropyEngine } from "../governance/EntropyEngine";
import { EventStore } from "./EventStore";
import { MutationPipeline } from "./MutationPipeline";
import { AuthorityReplicationService } from "./AuthorityReplicationService";

const tempDirs: string[] = [];

afterEach(() => {
  tempDirs.splice(0).forEach((dir) => fs.rmSync(dir, { recursive: true, force: true }));
});

describe("AuthorityReplicationService", () => {
  it("persists event logs and recovers snapshots into a fresh authority state", () => {
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "negentropy-authority-"));
    tempDirs.push(storageDir);

    const state = new AuthorityState();
    const eventStore = new EventStore();
    const pipeline = new MutationPipeline(state, eventStore, new EntropyEngine(state), new BreakerService(state));
    const replication = new AuthorityReplicationService(state, eventStore, pipeline, { storageDir });

    const mutation = pipeline.propose({
      proposer: "system",
      targetPath: "governance.policies.recovery_marker",
      operation: "set",
      payload: "recovery-test",
      reason: "replication_test",
    });
    expect(mutation.ok).toBe(true);

    const snapshot = replication.snapshot();
    expect(fs.existsSync(snapshot.snapshotPath)).toBe(true);

    const recoveredState = new AuthorityState();
    const recoveredStore = new EventStore();
    const recoveredPipeline = new MutationPipeline(
      recoveredState,
      recoveredStore,
      new EntropyEngine(recoveredState),
      new BreakerService(recoveredState),
    );
    const recoveredReplication = new AuthorityReplicationService(
      recoveredState,
      recoveredStore,
      recoveredPipeline,
      { storageDir },
    );
    const recovery = recoveredReplication.recover();

    expect(recovery.recovered).toBe(true);
    expect(recoveredState.governance.policies.get("recovery_marker")).toBe("recovery-test");
    expect(recoveredStore.count()).toBeGreaterThanOrEqual(eventStore.count());
    expect(recoveredReplication.getStatus().snapshotPath).toContain("snapshot.json");

    replication.dispose();
    recoveredReplication.dispose();
  });

  it("auto snapshots and rotates logs under production thresholds", () => {
    const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), "negentropy-authority-"));
    tempDirs.push(storageDir);

    const state = new AuthorityState();
    const eventStore = new EventStore();
    const pipeline = new MutationPipeline(state, eventStore, new EntropyEngine(state), new BreakerService(state));
    const replication = new AuthorityReplicationService(state, eventStore, pipeline, {
      storageDir,
      snapshotEventThreshold: 4,
      snapshotIntervalMs: 60_000,
      maxLogBytes: 200,
      maxArchiveFiles: 2,
    });

    const mutation = pipeline.propose({
      proposer: "system",
      targetPath: "governance.policies.rotation_marker",
      operation: "set",
      payload: "x".repeat(512),
      reason: "replication_rotation_test",
    });

    expect(mutation.ok).toBe(true);

    const status = replication.getStatus();
    expect(status.lastAutoSnapshotAt).toBeGreaterThan(0);
    expect(fs.existsSync(status.snapshotPath)).toBe(true);
    expect(status.storage.archiveCount).toBeGreaterThanOrEqual(1);
    expect(status.storage.files.some((entry) => entry.kind === "archive-log")).toBe(true);
    expect(status.recovery.mode).toBe("startup");

    replication.dispose();
  });
});
