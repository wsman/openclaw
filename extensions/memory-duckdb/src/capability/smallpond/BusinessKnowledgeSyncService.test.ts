import { describe, expect, it } from "vitest";
import { BusinessKnowledgeSyncService } from "./BusinessKnowledgeSyncService.js";
import { SmallpondClient } from "./SmallpondClient.js";
import { SmallpondArtifactReadAccess } from "./SmallpondReadAccess.js";

function createClient(rowsByView: Record<string, Record<string, unknown>[]>, now: Date) {
  return new SmallpondClient({
    readAccess: new SmallpondArtifactReadAccess(async (sql) => {
      const sourceView = sql.replace(/^SELECT \* FROM /u, "").trim();
      if (sourceView === "v_smallpond_governance_decisions" && rowsByView.__throwGovernance) {
        throw new Error("governance view missing");
      }
      return rowsByView[sourceView] ?? [];
    }),
    now: () => now,
  });
}

describe("BusinessKnowledgeSyncService", () => {
  it("supports startup plus manual sync and accumulates status counters", async () => {
    const rowsByView: Record<string, Record<string, unknown>[]> = {
      v_smallpond_business_facts: [
        {
          artifactId: "artifact:fact",
          title: "Fact",
          summary: "Fact summary",
          status: "ready",
          scope: { tenant: "demo" },
          updatedAt: "2026-03-20T09:00:00.000Z",
          evidenceRefs: ["ev:fact"],
        },
      ],
    };
    const client = createClient(rowsByView, new Date("2026-03-20T10:00:00.000Z"));
    let materializeCount = 0;
    const service = new BusinessKnowledgeSyncService({
      client,
      getRuntimeMode: () => "canonical",
      materialize: async (artifact) => {
        materializeCount += 1;
        return {
          action: materializeCount === 1 ? "created" : "duplicate",
          artifactId: artifact.readArtifact.artifactId,
          artifactType: artifact.readArtifact.artifactType,
          sourceTimestamp: artifact.sourceTimestamp,
        };
      },
      now: () => new Date("2026-03-20T10:00:00.000Z"),
    });

    const startup = await service.sync("startup");
    const manual = await service.sync("manual");
    const status = service.getStatus();

    expect(startup).toMatchObject({
      trigger: "startup",
      state: "ok",
      syncedArtifactCount: 1,
      skippedArtifactCount: 0,
      failedArtifactCount: 0,
      lastArtifactId: "artifact:fact",
      lastArtifactType: "business_fact",
    });
    expect(manual).toMatchObject({
      trigger: "manual",
      state: "ok",
      syncedArtifactCount: 0,
      skippedArtifactCount: 1,
      failedArtifactCount: 0,
      lastArtifactId: "artifact:fact",
      lastArtifactType: "business_fact",
    });
    expect(status).toMatchObject({
      state: "ok",
      syncedArtifactCount: 1,
      skippedArtifactCount: 1,
      failedArtifactCount: 0,
      lastArtifactId: "artifact:fact",
      lastArtifactType: "business_fact",
      lagSeconds: 3600,
      lastError: null,
    });
  });

  it("stays disabled outside canonical runtime mode without touching the client", async () => {
    const client = new SmallpondClient({
      readAccess: new SmallpondArtifactReadAccess(async () => {
        throw new Error("client should not be called");
      }),
    });
    const service = new BusinessKnowledgeSyncService({
      client,
      getRuntimeMode: () => "shadow-read",
      materialize: async () => {
        throw new Error("materialize should not be called");
      },
    });

    const result = await service.sync("startup");

    expect(result).toMatchObject({
      trigger: "startup",
      state: "disabled",
      syncedArtifactCount: 0,
      skippedArtifactCount: 0,
      failedArtifactCount: 0,
    });
    expect(service.getStatus().state).toBe("disabled");
  });

  it("keeps degraded failures visible and preserves lag through an empty follow-up sync", async () => {
    const rowsByView: Record<string, Record<string, unknown>[]> = {
      v_smallpond_business_facts: [
        {
          artifactId: "artifact:fact",
          title: "Fact",
          summary: "Fact summary",
          status: "ready",
          scope: { tenant: "demo" },
          updatedAt: "2026-03-20T09:30:00.000Z",
          evidenceRefs: ["ev:fact"],
        },
      ],
    };
    let now = new Date("2026-03-20T10:00:00.000Z");
    const client = new SmallpondClient({
      readAccess: new SmallpondArtifactReadAccess(async (sql) => {
        const sourceView = sql.replace(/^SELECT \* FROM /u, "").trim();
        if (sourceView === "v_smallpond_governance_decisions") {
          throw new Error("governance view missing");
        }
        return rowsByView[sourceView] ?? [];
      }),
      now: () => now,
    });
    let first = true;
    const service = new BusinessKnowledgeSyncService({
      client,
      getRuntimeMode: () => "canonical",
      materialize: async (artifact) => {
        if (first) {
          first = false;
          return {
            action: "created",
            artifactId: artifact.readArtifact.artifactId,
            artifactType: artifact.readArtifact.artifactType,
            sourceTimestamp: artifact.sourceTimestamp,
          };
        }
        throw new Error("manual materialize failed");
      },
      now: () => now,
    });

    const degraded = await service.sync("startup");
    rowsByView.v_smallpond_business_facts = [];
    now = new Date("2026-03-20T10:05:00.000Z");
    const empty = await service.sync("manual");
    const status = service.getStatus();

    expect(degraded.state).toBe("degraded");
    expect(degraded.failedArtifactCount).toBe(1);
    expect(degraded.lastError).toContain("v_smallpond_governance_decisions");
    expect(empty).toMatchObject({
      state: "degraded",
      syncedArtifactCount: 0,
      skippedArtifactCount: 0,
      failedArtifactCount: 1,
    });
    expect(status).toMatchObject({
      state: "degraded",
      syncedArtifactCount: 1,
      failedArtifactCount: 2,
      lagSeconds: 2100,
    });
  });
});
