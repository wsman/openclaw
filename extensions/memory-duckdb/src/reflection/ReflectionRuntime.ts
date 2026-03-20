import type { MemoryRecord } from "../types.js";

export class ReflectionRuntime {
  summarize(records: MemoryRecord[]): { summary: string; recentTagCounts: Record<string, number> } {
    const recent = records.slice(-5);
    const recentTagCounts = recent.reduce<Record<string, number>>((accumulator, record) => {
      for (const tag of record.tags) {
        accumulator[tag] = (accumulator[tag] ?? 0) + 1;
      }
      return accumulator;
    }, {});

    if (recent.length === 0) {
      return {
        summary: "No absorbed memory records yet.",
        recentTagCounts,
      };
    }

    const preview = recent
      .map((record) => record.text.trim())
      .filter(Boolean)
      .slice(-3)
      .map((text) => text.slice(0, 80))
      .join(" | ");

    return {
      summary: `Recent absorbed memory activity: ${preview}`,
      recentTagCounts,
    };
  }
}
