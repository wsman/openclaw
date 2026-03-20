import type { MemoryRecord } from "../types.js";

const GOVERNANCE_MARKERS = ["policy", "must", "forbidden", "compliance", "governance"];

export class GovernanceRuntime {
  inspect(records: MemoryRecord[]): { flaggedCount: number; flaggedIds: string[] } {
    const flaggedIds = records
      .filter((record) =>
        GOVERNANCE_MARKERS.some((marker) => record.normalizedText.includes(marker)),
      )
      .map((record) => record.id);

    return {
      flaggedCount: flaggedIds.length,
      flaggedIds,
    };
  }
}
