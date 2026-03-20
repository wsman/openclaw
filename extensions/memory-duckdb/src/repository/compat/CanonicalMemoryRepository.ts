import fs from "node:fs";
import path from "node:path";
import type { MemoryRecord } from "../../types.js";

type CanonicalStore = {
  records: MemoryRecord[];
};

export class CanonicalMemoryRepository {
  readonly #filePath: string;

  constructor(storagePath: string) {
    this.#filePath = path.join(path.resolve(storagePath), "canonical-records.json");
    fs.mkdirSync(path.dirname(this.#filePath), { recursive: true });
  }

  getPath(): string {
    return this.#filePath;
  }

  list(): MemoryRecord[] {
    return this.#readStore().records;
  }

  save(records: MemoryRecord[]) {
    this.#writeStore({ records });
  }

  findById(id: string): MemoryRecord | null {
    return this.list().find((record) => record.id === id) ?? null;
  }

  findByDedupKey(dedupKey: string): MemoryRecord | null {
    return this.list().find((record) => record.dedupKey === dedupKey) ?? null;
  }

  upsert(record: MemoryRecord): MemoryRecord {
    const records = this.list();
    const existingIndex = records.findIndex((entry) => entry.id === record.id);
    if (existingIndex >= 0) {
      records[existingIndex] = record;
    } else {
      records.push(record);
    }
    this.#writeStore({ records });
    return record;
  }

  #readStore(): CanonicalStore {
    if (!fs.existsSync(this.#filePath)) {
      return { records: [] };
    }
    return JSON.parse(fs.readFileSync(this.#filePath, "utf8")) as CanonicalStore;
  }

  #writeStore(store: CanonicalStore) {
    fs.writeFileSync(this.#filePath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  }
}
