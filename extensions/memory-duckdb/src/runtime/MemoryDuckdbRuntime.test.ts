import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryDuckdbRuntime } from "./MemoryDuckdbRuntime.js";

describe("MemoryDuckdbRuntime", () => {
  let tmpDir = "";

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-memory-duckdb-runtime-"));
  });

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("writes through the canonical spool, dedups duplicate content, and supports search", async () => {
    const runtime = new MemoryDuckdbRuntime({
      storagePath: tmpDir,
      duckdbPath: path.join(tmpDir, "memory.duckdb"),
      runtimeMode: "canonical",
      native: { required: false },
      ingest: { maxActiveBytes: 4096 },
      replay: { batchSize: 100 },
      shadow: {
        maxCheckpointAgeSeconds: 900,
        requireParityZeroMismatch: true,
      },
      diagnostics: {
        enableHttpRoutes: true,
      },
    });

    const first = await runtime.store({ text: "Remember canonical ingest ordering" });
    const duplicate = await runtime.store({ text: "Remember canonical ingest ordering" });
    const search = await runtime.search("canonical ingest", 5);
    const status = await runtime.getStatus();

    expect(first.duplicate).toBe(false);
    expect(duplicate.duplicate).toBe(true);
    expect(search).toHaveLength(1);
    expect(status.ingest.canonicalRecordCount).toBe(1);
    expect(status.shadow.checkpoint?.sequence).toBe(1);
    expect(status.shadow.parityState).toBe("ok");
  });

  it("keeps the persisted checkpoint from advancing when parity is broken", async () => {
    const runtime = new MemoryDuckdbRuntime({
      storagePath: tmpDir,
      duckdbPath: path.join(tmpDir, "memory.duckdb"),
      runtimeMode: "canonical",
      native: { required: false },
      ingest: { maxActiveBytes: 4096 },
      replay: { batchSize: 100 },
      shadow: {
        maxCheckpointAgeSeconds: 900,
        requireParityZeroMismatch: true,
      },
      diagnostics: {
        enableHttpRoutes: true,
      },
    });

    await runtime.store({ text: "Remember the first canonical entry" });
    await fs.writeFile(
      path.join(tmpDir, "shadow-records.json"),
      JSON.stringify({ records: [] }, null, 2),
      "utf8",
    );

    await runtime.store({ text: "Remember the second canonical entry" });
    const status = await runtime.getStatus();

    expect(status.shadow.parityState).toBe("mismatch");
    expect(status.shadow.mismatchCount).toBeGreaterThan(0);
    expect(status.shadow.checkpoint?.sequence).toBe(1);
  });

  it("marks the shadow checkpoint as stale when it ages beyond the configured threshold", async () => {
    const runtime = new MemoryDuckdbRuntime({
      storagePath: tmpDir,
      duckdbPath: path.join(tmpDir, "memory.duckdb"),
      runtimeMode: "canonical",
      native: { required: false },
      ingest: { maxActiveBytes: 4096 },
      replay: { batchSize: 100 },
      shadow: {
        maxCheckpointAgeSeconds: 60,
        requireParityZeroMismatch: true,
      },
      diagnostics: {
        enableHttpRoutes: true,
      },
    });

    await runtime.store({ text: "Remember a stale checkpoint example" });
    await fs.writeFile(
      path.join(tmpDir, "shadow-checkpoint.json"),
      JSON.stringify(
        {
          backend: "memory-duckdb-shadow",
          sequence: 1,
          ingestId: "ingest-1",
          updatedAt: "2000-01-01T00:00:00.000Z",
          state: "compared",
          details: {
            mismatchCount: 0,
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const status = await runtime.getStatus();

    expect(status.shadow.checkpointAgeSeconds).toBeGreaterThan(60);
    expect(status.shadow.checkpointStale).toBe(true);
  });

  it("treats shadow-read mode as read-only while keeping read/status surfaces available", async () => {
    const runtime = new MemoryDuckdbRuntime({
      storagePath: tmpDir,
      duckdbPath: path.join(tmpDir, "memory.duckdb"),
      runtimeMode: "shadow-read",
      native: { required: false },
      ingest: { maxActiveBytes: 4096 },
      replay: { batchSize: 100 },
      shadow: {
        maxCheckpointAgeSeconds: 900,
        requireParityZeroMismatch: true,
      },
      diagnostics: {
        enableHttpRoutes: true,
      },
    });

    await expect(runtime.store({ text: "shadow-read should reject writes" })).rejects.toThrow(
      "runtimeMode=shadow-read is read-only",
    );
    await expect(runtime.search("shadow-read", 5)).resolves.toEqual([]);

    const status = await runtime.getStatus();
    expect(status.runtimeMode).toBe("shadow-read");
    expect(status.ingest.canonicalRecordCount).toBe(0);
    expect(status.shadow.checkpointStale).toBe(false);
  });

  it("materializes approved smallpond artifacts into canonical records and updates newer sources", async () => {
    let now = new Date("2026-03-20T10:00:00.000Z");
    const rowsByView: Record<string, Record<string, unknown>[]> = {
      v_smallpond_business_facts: [
        {
          artifactId: "artifact:fact",
          title: "Tenant recovery",
          summary: "The tenant recovered after a release rollback.",
          status: "ready",
          scope: { tenant: "demo" },
          tags: ["tenant", "rollback"],
          updatedAt: "2026-03-20T09:00:00.000Z",
          evidenceRefs: ["ev:fact"],
          sourceRefs: ["sp:fact"],
          content: "Rollback recovered the tenant.",
          semanticCategory: "tenant-recovery",
          importance: "high",
          confidence: 0.92,
        },
      ],
    };
    const runtime = new MemoryDuckdbRuntime(
      {
        storagePath: tmpDir,
        duckdbPath: path.join(tmpDir, "memory.duckdb"),
        runtimeMode: "canonical",
        native: { required: false },
        ingest: { maxActiveBytes: 4096 },
        replay: { batchSize: 100 },
        shadow: {
          maxCheckpointAgeSeconds: 900,
          requireParityZeroMismatch: true,
        },
        diagnostics: {
          enableHttpRoutes: true,
        },
      },
      {
        now: () => now,
        smallpondQueryRunner: async (sql) => {
          const sourceView = sql.replace(/^SELECT \* FROM /u, "").trim();
          return rowsByView[sourceView] ?? [];
        },
      },
    );

    const first = await runtime.syncBusinessKnowledge("manual");
    const firstRecords = await runtime.list();
    const firstRecord = firstRecords[0];

    expect(first).toMatchObject({
      state: "ok",
      syncedArtifactCount: 1,
      skippedArtifactCount: 0,
      failedArtifactCount: 0,
      lastArtifactId: "artifact:fact",
      lastArtifactType: "business_fact",
    });
    expect(firstRecords).toHaveLength(1);
    expect(firstRecord?.source).toBe("smallpond-sync");
    expect(firstRecord?.text).toContain("[business_fact] Tenant recovery");
    expect(firstRecord?.metadata).toMatchObject({
      smallpond: {
        artifactId: "artifact:fact",
        artifactType: "business_fact",
        sourceView: "v_smallpond_business_facts",
        sourceTimestamp: "2026-03-20T09:00:00.000Z",
        sourceRefs: ["sp:fact"],
        evidenceRefs: ["ev:fact"],
      },
      knowledge: {
        kind: "business_fact",
        syncKey: "smallpond:business_fact:artifact:fact:2026-03-20T09:00:00.000Z",
        semanticCategory: "tenant-recovery",
        importance: "high",
        confidence: 0.92,
      },
    });

    const duplicate = await runtime.syncBusinessKnowledge("manual");
    expect(duplicate).toMatchObject({
      state: "ok",
      syncedArtifactCount: 0,
      skippedArtifactCount: 1,
      failedArtifactCount: 0,
    });

    now = new Date("2026-03-20T11:00:00.000Z");
    rowsByView.v_smallpond_business_facts = [
      {
        artifactId: "artifact:fact",
        title: "Tenant recovery",
        summary: "The tenant recovered and the rollback stayed stable.",
        status: "ready",
        scope: { tenant: "demo" },
        tags: ["tenant", "rollback"],
        updatedAt: "2026-03-20T10:30:00.000Z",
        evidenceRefs: ["ev:fact", "ev:fact:2"],
        sourceRefs: ["sp:fact", "sp:fact:2"],
        content: "Rollback recovered the tenant and stabilized the next release.",
        semanticCategory: "tenant-recovery",
        importance: "critical",
        confidence: 0.97,
      },
    ];

    const updated = await runtime.syncBusinessKnowledge("manual");
    const updatedRecords = await runtime.list();
    const updatedRecord = updatedRecords[0];
    const status = await runtime.getStatus();

    expect(updated).toMatchObject({
      state: "ok",
      syncedArtifactCount: 1,
      skippedArtifactCount: 0,
      failedArtifactCount: 0,
    });
    expect(updatedRecords).toHaveLength(1);
    expect(updatedRecord?.id).toBe(firstRecord?.id);
    expect(updatedRecord?.text).toContain("rollback stayed stable");
    expect(updatedRecord?.metadata).toMatchObject({
      smallpond: {
        sourceTimestamp: "2026-03-20T10:30:00.000Z",
        sourceRefs: ["sp:fact", "sp:fact:2"],
      },
      knowledge: {
        syncKey: "smallpond:business_fact:artifact:fact:2026-03-20T10:30:00.000Z",
        importance: "critical",
        confidence: 0.97,
      },
    });
    expect(status.ingest.canonicalRecordCount).toBe(1);
    expect(status.ingest.spool.lastSequence).toBe(2);
    expect(status.businessSync).toMatchObject({
      state: "ok",
      syncedArtifactCount: 2,
      skippedArtifactCount: 1,
      failedArtifactCount: 0,
      lastArtifactId: "artifact:fact",
      lastArtifactType: "business_fact",
      lagSeconds: 1800,
      lastError: null,
    });
  });

  it("projects approved source families into canonical skill candidate records and updates newer revisions", async () => {
    let now = new Date("2026-03-20T12:00:00.000Z");
    const rowsByView: Record<string, Record<string, unknown>[]> = {
      v_smallpond_skill_candidates: [
        {
          candidateId: "candidate:advisory",
          artifactId: "artifact:skill",
          title: "Summarize Advisory Drift",
          summary: "Turn advisory drift into a stable operator summary.",
          trigger: "repeat advisory",
          steps: ["Capture the drift", "Draft the stable response"],
          priority: "high",
          confidence: 0.94,
          promotionStatus: "validated",
          updatedAt: "2026-03-20T11:00:00.000Z",
          evidenceRefs: ["ev:skill"],
          sourceRefs: ["sp:skill"],
        },
      ],
      v_smallpond_operator_patterns: [
        {
          artifactId: "artifact:pattern",
          title: "Tenant Recovery",
          summary: "Replay the tenant recovery rollback sequence.",
          updatedAt: "2026-03-20T11:10:00.000Z",
          evidenceRefs: ["ev:pattern"],
          sourceRefs: ["sp:pattern"],
          semanticCategory: "operator-pattern",
          importance: "high",
          confidence: 0.88,
        },
      ],
      v_smallpond_advisory_summaries: [
        {
          artifactId: "artifact:advisory",
          title: "Advisory Lesson",
          summary: "Convert advisory guidance into a repeatable checklist.",
          updatedAt: "2026-03-20T11:20:00.000Z",
          evidenceRefs: ["ev:advisory"],
          sourceRefs: ["sp:advisory"],
          semanticCategory: "lesson",
          importance: "medium",
          confidence: 0.83,
        },
      ],
    };
    const runtime = new MemoryDuckdbRuntime(
      {
        storagePath: tmpDir,
        duckdbPath: path.join(tmpDir, "memory.duckdb"),
        runtimeMode: "canonical",
        native: { required: false },
        ingest: { maxActiveBytes: 4096 },
        replay: { batchSize: 100 },
        shadow: {
          maxCheckpointAgeSeconds: 900,
          requireParityZeroMismatch: true,
        },
        diagnostics: {
          enableHttpRoutes: true,
        },
      },
      {
        now: () => now,
        smallpondQueryRunner: async (sql) => {
          const sourceView = sql.replace(/^SELECT \* FROM /u, "").trim();
          return rowsByView[sourceView] ?? [];
        },
      },
    );

    await runtime.syncBusinessKnowledge("manual");
    const firstSkillSync = await runtime.syncSkillCandidates("manual");
    const initialCandidates = await runtime.listSkillCandidates();
    const importedCandidate = await runtime.getSkillCandidate("candidate:advisory");
    const projectedPattern = await runtime.getSkillCandidate("operator-pattern:artifact:pattern");

    expect(firstSkillSync).toMatchObject({
      state: "ok",
      generatedCount: 3,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      lastCandidateId: "candidate:advisory",
    });
    expect(initialCandidates).toHaveLength(3);
    expect(importedCandidate?.metadata).toMatchObject({
      knowledge: {
        kind: "skill_candidate",
        syncKey: "skill-candidate:candidate:advisory:2026-03-20T12:00:00.000Z",
      },
      skillCandidate: {
        candidateId: "candidate:advisory",
        lifecycleState: "pending_review",
        sourcePromotionStatus: "validated",
      },
    });
    expect(projectedPattern?.metadata).toMatchObject({
      skillCandidate: {
        candidateId: "operator-pattern:artifact:pattern",
        lifecycleState: "draft",
        derivedFromKinds: ["operator_pattern"],
      },
    });

    const duplicateSkillSync = await runtime.syncSkillCandidates("manual");
    expect(duplicateSkillSync).toMatchObject({
      state: "ok",
      generatedCount: 0,
      updatedCount: 0,
      skippedCount: 3,
      failedCount: 0,
    });

    await runtime.transitionSkillCandidate("operator-pattern:artifact:pattern", "submit-review");
    await runtime.transitionSkillCandidate("operator-pattern:artifact:pattern", "approve");
    expect(
      (await runtime.getSkillCandidate("operator-pattern:artifact:pattern"))?.metadata,
    ).toMatchObject({
      skillCandidate: {
        lifecycleState: "approved",
      },
    });

    now = new Date("2026-03-20T13:00:00.000Z");
    rowsByView.v_smallpond_skill_candidates = [
      {
        candidateId: "candidate:advisory",
        artifactId: "artifact:skill",
        title: "Summarize Advisory Drift",
        summary: "Turn advisory drift into a promoted operator response.",
        trigger: "repeat advisory",
        steps: ["Capture the drift", "Draft the stable response", "Promote the response"],
        priority: "high",
        confidence: 0.97,
        promotionStatus: "promoted",
        updatedAt: "2026-03-20T12:30:00.000Z",
        evidenceRefs: ["ev:skill", "ev:skill:2"],
        sourceRefs: ["sp:skill", "sp:skill:2"],
      },
    ];
    rowsByView.v_smallpond_operator_patterns = [
      {
        artifactId: "artifact:pattern",
        title: "Tenant Recovery",
        summary: "Replay the tenant recovery rollback sequence with the archived drill evidence.",
        updatedAt: "2026-03-20T12:40:00.000Z",
        evidenceRefs: ["ev:pattern", "ev:pattern:2"],
        sourceRefs: ["sp:pattern", "sp:pattern:2"],
        semanticCategory: "operator-pattern",
        importance: "high",
        confidence: 0.9,
      },
    ];

    await runtime.syncBusinessKnowledge("manual");
    const updatedSkillSync = await runtime.syncSkillCandidates("manual");
    const updatedImported = await runtime.getSkillCandidate("candidate:advisory");
    const updatedPattern = await runtime.getSkillCandidate("operator-pattern:artifact:pattern");
    const status = await runtime.getStatus();

    expect(updatedSkillSync).toMatchObject({
      state: "ok",
      generatedCount: 0,
      updatedCount: 2,
      skippedCount: 1,
      failedCount: 0,
    });
    expect(updatedImported?.metadata).toMatchObject({
      skillCandidate: {
        lifecycleState: "materialized",
        sourcePromotionStatus: "promoted",
        updatedAt: "2026-03-20T13:00:00.000Z",
      },
    });
    expect(updatedPattern?.metadata).toMatchObject({
      skillCandidate: {
        lifecycleState: "approved",
        updatedAt: "2026-03-20T13:00:00.000Z",
      },
    });
    expect(status.skillCandidates).toMatchObject({
      state: "ok",
      generatedCount: 3,
      updatedCount: 2,
      skippedCount: 4,
      failedCount: 0,
      lastCandidateId: "candidate:advisory",
      countsByLifecycle: {
        approved: 1,
        draft: 1,
        materialized: 1,
      },
      lastError: null,
    });
  });

  it("reports host-side control-plane alignment from canonical records only", async () => {
    const rowsByView: Record<string, Record<string, unknown>[]> = {
      v_smallpond_business_facts: [
        {
          artifactId: "artifact:fact",
          title: "Tenant recovery",
          summary: "The tenant recovered after a rollback.",
          status: "ready",
          scope: { tenant: "demo" },
          tags: ["tenant", "rollback"],
          updatedAt: "2026-03-20T09:00:00.000Z",
          evidenceRefs: ["ev:fact"],
          sourceRefs: ["sp:fact"],
          content: "Rollback recovered the tenant.",
          semanticCategory: "tenant-recovery",
          importance: "high",
          confidence: 0.92,
        },
      ],
      v_smallpond_advisory_summaries: [
        {
          artifactId: "artifact:advisory",
          title: "Advisory lesson",
          summary: "Convert advisory guidance into a stable checklist.",
          status: "ready",
          scope: { tenant: "demo" },
          tags: ["advisory"],
          updatedAt: "2026-03-20T09:10:00.000Z",
          evidenceRefs: ["ev:advisory"],
          sourceRefs: ["sp:advisory"],
          content: "Checklist content",
          semanticCategory: "lesson",
          importance: "medium",
          confidence: 0.81,
        },
      ],
      v_smallpond_skill_candidates: [
        {
          candidateId: "candidate:demo",
          artifactId: "artifact:skill",
          title: "Summarize recovery drift",
          summary: "Turn repeated recovery drift into a stable operator summary.",
          trigger: "repeat recovery",
          steps: ["capture drift", "draft response"],
          priority: "high",
          confidence: 0.9,
          promotionStatus: "validated",
          updatedAt: "2026-03-20T09:20:00.000Z",
          evidenceRefs: ["ev:skill"],
          sourceRefs: ["sp:skill"],
        },
      ],
    };
    const runtime = new MemoryDuckdbRuntime(
      {
        storagePath: tmpDir,
        duckdbPath: path.join(tmpDir, "memory.duckdb"),
        runtimeMode: "canonical",
        native: { required: false },
        ingest: { maxActiveBytes: 4096 },
        replay: { batchSize: 100 },
        shadow: {
          maxCheckpointAgeSeconds: 900,
          requireParityZeroMismatch: true,
        },
        diagnostics: {
          enableHttpRoutes: true,
        },
      },
      {
        now: () => new Date("2026-03-20T12:00:00.000Z"),
        smallpondQueryRunner: async (sql) => {
          const sourceView = sql.replace(/^SELECT \* FROM /u, "").trim();
          return rowsByView[sourceView] ?? [];
        },
      },
    );

    const manualRecord = await runtime.store({
      text: "Host-private operator note that must stay local.",
      source: "manual",
    });
    await runtime.syncBusinessKnowledge("manual");
    await runtime.syncSkillCandidates("manual");

    const sourceSkillRecord = (await runtime.list()).find(
      (record) =>
        record.source === "smallpond-sync" &&
        typeof record.metadata.smallpond === "object" &&
        !Array.isArray(record.metadata.smallpond) &&
        (record.metadata.smallpond as { artifactType?: string }).artifactType ===
          "skill_candidate" &&
        (record.metadata as { skillCandidate?: unknown }).skillCandidate == null,
    );
    const status = await runtime.getStatus();

    expect(sourceSkillRecord).not.toBeUndefined();
    expect(status.controlPlaneAlignment).toMatchObject({
      state: "ok",
      evaluatedRecordCount: 6,
      absorbEligibleCount: 4,
      writeBackEligibleCount: 1,
      blockedRecordCount: 2,
      countsByClassification: {
        host_local_only: 2,
        control_plane_summary: 2,
        writeback_candidate: 1,
        projection_only: 1,
      },
      lastError: null,
    });
    expect(status.controlPlaneAlignment.blockedSampleIds).toEqual(
      expect.arrayContaining([manualRecord.record.id, sourceSkillRecord!.id]),
    );
  });

  it("disables skill candidate sync outside canonical mode", async () => {
    const runtime = new MemoryDuckdbRuntime({
      storagePath: tmpDir,
      duckdbPath: path.join(tmpDir, "memory.duckdb"),
      runtimeMode: "shadow-read",
      native: { required: false },
      ingest: { maxActiveBytes: 4096 },
      replay: { batchSize: 100 },
      shadow: {
        maxCheckpointAgeSeconds: 900,
        requireParityZeroMismatch: true,
      },
      diagnostics: {
        enableHttpRoutes: true,
      },
    });

    await expect(runtime.transitionSkillCandidate("missing", "approve")).rejects.toThrow(
      "runtimeMode=shadow-read is read-only",
    );

    expect(await runtime.syncBusinessKnowledge("manual")).toMatchObject({
      state: "disabled",
      syncedArtifactCount: 0,
      skippedArtifactCount: 0,
      failedArtifactCount: 0,
    });
    expect(await runtime.syncSkillCandidates("manual")).toMatchObject({
      state: "disabled",
      generatedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
    });
    expect(await runtime.getStatus()).toMatchObject({
      runtimeMode: "shadow-read",
      businessSync: { state: "disabled" },
      skillCandidates: { state: "disabled" },
    });
  });
});
