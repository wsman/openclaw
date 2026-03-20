import { describe, expect, it } from "vitest";
import {
  canTransitionSkillCandidate,
  mapSourcePromotionStatusToLifecycleState,
  transitionSkillCandidateLifecycle,
} from "./SkillCandidateStateMachine.js";

describe("SkillCandidateStateMachine", () => {
  it("maps imported source promotion states into the host lifecycle", () => {
    expect(mapSourcePromotionStatusToLifecycleState("candidate")).toBe("draft");
    expect(mapSourcePromotionStatusToLifecycleState("validated")).toBe("pending_review");
    expect(mapSourcePromotionStatusToLifecycleState("promoted")).toBe("materialized");
    expect(mapSourcePromotionStatusToLifecycleState("rejected")).toBe("rejected");
  });

  it("allows only the frozen operator transition paths", () => {
    expect(canTransitionSkillCandidate("draft", "submit-review")).toBe(true);
    expect(canTransitionSkillCandidate("pending_review", "approve")).toBe(true);
    expect(canTransitionSkillCandidate("pending_review", "reject")).toBe(true);
    expect(canTransitionSkillCandidate("approved", "archive")).toBe(true);
    expect(canTransitionSkillCandidate("materialized", "archive")).toBe(true);
    expect(canTransitionSkillCandidate("draft", "approve")).toBe(false);
    expect(canTransitionSkillCandidate("archived", "archive")).toBe(false);

    expect(transitionSkillCandidateLifecycle("draft", "submit-review")).toBe("pending_review");
    expect(transitionSkillCandidateLifecycle("pending_review", "approve")).toBe("approved");
    expect(transitionSkillCandidateLifecycle("pending_review", "reject")).toBe("rejected");
    expect(transitionSkillCandidateLifecycle("approved", "archive")).toBe("archived");
    expect(() => transitionSkillCandidateLifecycle("draft", "approve")).toThrow(
      "skill candidate action approve is not allowed from lifecycle draft",
    );
  });
});
