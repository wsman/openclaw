import { describe, expect, it } from "vitest";
import {
  isControlPlaneWriteBackRelevantArtifactType,
  isHostMaterializableArtifactType,
  mapSmallpondArtifactTypeToKnowledgeKinds,
  mapSmallpondReadArtifactToKnowledgeKinds,
} from "./BusinessArtifactMapper.js";

describe("smallpond business artifact mapper", () => {
  it("projects advisory artifacts to the frozen knowledge kinds", () => {
    expect(mapSmallpondArtifactTypeToKnowledgeKinds("advisory_summary")).toEqual([
      "lesson",
      "operator_pattern",
    ]);
    expect(
      mapSmallpondReadArtifactToKnowledgeKinds({
        artifactType: "governance_decision",
      }),
    ).toEqual(["governance_decision"]);
  });

  it("keeps materialization and write-back relevance explicit", () => {
    expect(isHostMaterializableArtifactType("skill_candidate")).toBe(true);
    expect(isControlPlaneWriteBackRelevantArtifactType("handoff_summary")).toBe(false);
    expect(isControlPlaneWriteBackRelevantArtifactType("release_readiness_note")).toBe(true);
  });
});
