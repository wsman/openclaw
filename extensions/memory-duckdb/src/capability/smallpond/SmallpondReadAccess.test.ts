import { describe, expect, it } from "vitest";
import { buildSmallpondReadDiagnostics } from "./SmallpondDiagnostics.js";
import {
  SmallpondArtifactReadAccess,
  assertSmallpondArtifactReadQuery,
} from "./SmallpondReadAccess.js";

describe("smallpond read access discipline", () => {
  it("allows approved source views and schema-qualified view access", async () => {
    expect(assertSmallpondArtifactReadQuery("SELECT * FROM v_smallpond_business_facts")).toBe(
      "SELECT * FROM v_smallpond_business_facts",
    );
    expect(
      assertSmallpondArtifactReadQuery("SELECT * FROM contracts.v_smallpond_skill_candidates"),
    ).toBe("SELECT * FROM contracts.v_smallpond_skill_candidates");

    const seen: Array<{ sql: string; params: unknown[] }> = [];
    const access = new SmallpondArtifactReadAccess(async (sql, params) => {
      seen.push({ sql, params });
      return [{ artifactId: "artifact-1" }];
    });

    await expect(
      access.read("SELECT * FROM v_smallpond_operator_patterns WHERE 1 = ?", [1]),
    ).resolves.toEqual([{ artifactId: "artifact-1" }]);
    expect(seen).toEqual([
      {
        sql: "SELECT * FROM v_smallpond_operator_patterns WHERE 1 = ?",
        params: [1],
      },
    ]);
  });

  it("rejects raw tables, schema-qualified bypasses, chained statements, and admin SQL", () => {
    expect(() =>
      assertSmallpondArtifactReadQuery("SELECT * FROM business_fact_events_raw"),
    ).toThrow("raw internal sources");
    expect(() =>
      assertSmallpondArtifactReadQuery("SELECT * FROM smallpond_raw.business_fact_events_raw"),
    ).toThrow("raw internal sources");
    expect(() => assertSmallpondArtifactReadQuery("SELECT * FROM rogue_surface")).toThrow(
      "approved source views",
    );
    expect(() =>
      assertSmallpondArtifactReadQuery(
        "SELECT * FROM v_smallpond_business_facts; SELECT * FROM v_smallpond_skill_candidates",
      ),
    ).toThrow("single SELECT statement");
    expect(() => assertSmallpondArtifactReadQuery("PRAGMA table_info('articles')")).toThrow(
      "read-only",
    );
  });

  it("reports drift and guard failures through package-local diagnostics", () => {
    expect(
      buildSmallpondReadDiagnostics({
        sourceView: "rogue_surface",
      }),
    ).toMatchObject({
      failureKind: "source-view-drift",
      driftDetected: true,
    });

    expect(
      buildSmallpondReadDiagnostics({
        sourceView: "v_smallpond_business_facts",
        error: new Error("Smallpond artifact read contract is SELECT-only"),
      }),
    ).toMatchObject({
      failureKind: "guard-rejected",
      driftDetected: false,
    });
  });
});
