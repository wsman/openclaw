import { describe, expect, it } from "vitest";
import {
  SMALLPOND_ARTIFACT_INVENTORY,
  assertSmallpondArtifactType,
} from "./SmallpondArtifactInventory.js";
import {
  normalizeSmallpondKnowledgeIngestArtifact,
  normalizeSmallpondReadArtifact,
  normalizeSmallpondSkillCandidateArtifact,
} from "./SmallpondContracts.js";

describe("smallpond contract inventory", () => {
  it("accepts only declared artifact types", () => {
    expect(assertSmallpondArtifactType("business_fact")).toBe("business_fact");
    expect(() => assertSmallpondArtifactType("raw_payload")).toThrow(
      "Smallpond artifact type must be one of",
    );
    expect(SMALLPOND_ARTIFACT_INVENTORY).toHaveLength(10);
  });

  it("normalizes read artifacts on approved source surfaces only", () => {
    expect(
      normalizeSmallpondReadArtifact({
        artifactId: "artifact-1",
        artifactType: "governance_decision",
        title: "Gateway policy shift",
        summary: "Move to explicit slot selection before promotion.",
        status: "accepted",
        scope: {
          tenant: "global",
          lane: "governance",
        },
        tags: ["governance", "memory"],
        updatedAt: "2026-03-20T00:00:00.000Z",
        evidenceRefs: ["ev-1"],
        sourceView: "v_smallpond_governance_decisions",
      }),
    ).toMatchObject({
      artifactType: "governance_decision",
      sourceView: "v_smallpond_governance_decisions",
    });

    expect(() =>
      normalizeSmallpondReadArtifact({
        artifactId: "artifact-2",
        artifactType: "governance_decision",
        title: "Broken view",
        summary: "This should fail.",
        status: "draft",
        scope: { tenant: "global" },
        tags: ["bad"],
        updatedAt: "2026-03-20T00:00:00.000Z",
        evidenceRefs: [],
        sourceView: "rogue_smallpond_surface",
      }),
    ).toThrow("Smallpond source view must be one of");
  });

  it("normalizes knowledge ingest artifacts with structured content", () => {
    expect(
      normalizeSmallpondKnowledgeIngestArtifact({
        requestId: "req-1",
        artifactId: "artifact-1",
        artifactType: "tenant_insight",
        scope: {
          tenant: "tenant-a",
          lane: "business",
        },
        title: "Tenant insight",
        summary: "A stable insight summary.",
        content: {
          highlights: ["onboarding friction", "operator hints"],
        },
        semanticCategory: "tenant-ops",
        importance: "high",
        confidence: 0.92,
        evidenceRefs: ["ev-1", "ev-2"],
        sourceTimestamp: "2026-03-20T00:00:00.000Z",
        schemaVersion: "2026-03-20-e2a1",
      }),
    ).toMatchObject({
      artifactType: "tenant_insight",
      importance: "high",
      confidence: 0.92,
    });
  });

  it("normalizes skill candidate artifacts with structured step lists", () => {
    expect(
      normalizeSmallpondSkillCandidateArtifact({
        candidateId: "candidate-1",
        title: "Promote rollback checklist",
        trigger: "slot-selection-failed",
        summary: "A repeatable recovery playbook candidate.",
        steps: ["Inspect diagnostics", "Switch slot", "Restart gateway"],
        priority: "high",
        confidence: 0.88,
        promotionStatus: "candidate",
        sourceRefs: ["artifact-7"],
        evidenceRefs: ["ev-3"],
      }),
    ).toMatchObject({
      candidateId: "candidate-1",
      priority: "high",
      promotionStatus: "candidate",
    });
  });
});
