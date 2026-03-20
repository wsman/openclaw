import type { MemoryRecord, MemorySearchResult } from "../types.js";

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/iu)
    .map((part) => part.trim())
    .filter(Boolean);
}

export class MemoryRetriever {
  search(records: MemoryRecord[], query: string, limit = 5): MemorySearchResult[] {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) {
      return [];
    }

    return records
      .map<MemorySearchResult | null>((record) => {
        const haystack = `${record.normalizedText} ${record.tags.join(" ")}`.trim();
        const matchedTokens = queryTokens.filter((token) => haystack.includes(token));
        if (matchedTokens.length === 0) {
          return null;
        }
        return {
          record,
          score: matchedTokens.length / queryTokens.length,
          reason: `matched tokens: ${matchedTokens.join(", ")}`,
        };
      })
      .filter((entry): entry is MemorySearchResult => entry !== null)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return right.record.updatedAt.localeCompare(left.record.updatedAt);
      })
      .slice(0, limit);
  }
}
