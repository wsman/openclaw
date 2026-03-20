import { describe, expect, it } from "vitest";
import { SMALLPOND_APPROVED_SOURCE_VIEWS } from "./SmallpondArtifactInventory.js";
import { SmallpondClient } from "./SmallpondClient.js";
import { SmallpondArtifactReadAccess } from "./SmallpondReadAccess.js";

function createClient(rowsByView: Record<string, Record<string, unknown>[]>) {
  const queries: string[] = [];
  const client = new SmallpondClient({
    readAccess: new SmallpondArtifactReadAccess(async (sql) => {
      queries.push(sql);
      const sourceView = sql.replace(/^SELECT \* FROM /u, "").trim();
      return rowsByView[sourceView] ?? [];
    }),
    now: () => new Date("2026-03-20T10:00:00.000Z"),
  });
  return { client, queries };
}

describe("SmallpondClient", () => {
  it("reads only approved source views and normalizes materialization inputs", async () => {
    const { client, queries } = createClient({
      v_smallpond_business_facts: [
        {
          artifactId: "artifact:fact",
          title: "Tenant churn dropped",
          summary: "The tenant recovered after the last release.",
          status: "ready",
          scope: { tenant: "demo" },
          tags: ["tenant", "retention"],
          updatedAt: "2026-03-20T09:00:00.000Z",
          evidenceRefs: ["ev:fact"],
          sourceRefs: ["sp:fact"],
          content: "Release mitigation stabilized churn.",
          semanticCategory: "tenant-retention",
          importance: "high",
          confidence: 0.91,
        },
      ],
      v_smallpond_skill_candidates: [
        {
          candidateId: "candidate:skill",
          title: "Escalate tenant churn",
          summary: "Escalate repeated churn events to the operator.",
          trigger: "churn-spike",
          steps: ["check recent releases", "notify operator"],
          priority: "high",
          confidence: 0.88,
          promotionStatus: "validated",
          scope: { tenant: "demo" },
          tags: ["skill", "tenant"],
          updatedAt: "2026-03-20T09:30:00.000Z",
          evidenceRefs: ["ev:skill"],
          sourceRefs: ["sp:skill"],
        },
      ],
    });

    const result = await client.readMaterializationInputs();

    expect(queries).toEqual(
      SMALLPOND_APPROVED_SOURCE_VIEWS.map((sourceView) => `SELECT * FROM ${sourceView}`),
    );
    expect(result.failures).toEqual([]);
    expect(result.artifacts).toHaveLength(2);
    expect(result.artifacts[0]).toMatchObject({
      readArtifact: {
        artifactId: "artifact:fact",
        artifactType: "business_fact",
        sourceView: "v_smallpond_business_facts",
      },
      sourceTimestamp: "2026-03-20T09:00:00.000Z",
      sourceRefs: ["sp:fact"],
      semanticCategory: "tenant-retention",
      importance: "high",
      knowledgeKind: "business_fact",
    });
    expect(result.artifacts[1]).toMatchObject({
      readArtifact: {
        artifactId: "candidate:skill",
        artifactType: "skill_candidate",
        sourceView: "v_smallpond_skill_candidates",
      },
      sourceTimestamp: "2026-03-20T09:30:00.000Z",
      sourceRefs: ["sp:skill"],
      semanticCategory: "skill_candidate",
      importance: "high",
      knowledgeKind: "skill_candidate",
      skillCandidate: {
        candidateId: "candidate:skill",
        promotionStatus: "validated",
      },
    });
  });

  it("keeps view failures as diagnostics without switching to raw or bypass paths", async () => {
    const client = new SmallpondClient({
      readAccess: new SmallpondArtifactReadAccess(async (sql) => {
        if (sql === "SELECT * FROM v_smallpond_governance_decisions") {
          throw new Error("missing approved source view");
        }
        return [];
      }),
    });

    const result = await client.readMaterializationInputs();

    expect(result.artifacts).toEqual([]);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceView: "v_smallpond_governance_decisions",
          errorMessage: "missing approved source view",
          diagnostics: expect.objectContaining({
            sourceView: "v_smallpond_governance_decisions",
            failureKind: "guard-rejected",
          }),
        }),
      ]),
    );
  });
});
