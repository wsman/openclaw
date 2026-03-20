import fs from "node:fs";
import path from "node:path";
import { IngestCheckpointStore } from "../ingest/IngestCheckpointStore.js";
import { JsonlIngestSpool } from "../ingest/JsonlIngestSpool.js";
import type { IngestCheckpoint, IngestSpoolRecord } from "../ingest/types.js";
import { SHADOW_CHECKPOINT_BACKEND } from "../ingest/types.js";
import type { CanonicalMemoryRepository } from "../repository/compat/CanonicalMemoryRepository.js";
import type { MemoryRecord, ShadowParityState, ShadowReplayResult } from "../types.js";

type ShadowReplayManagerOptions = {
  storagePath: string;
  spool: JsonlIngestSpool;
  canonicalRepository: CanonicalMemoryRepository;
  batchSize: number;
  requireParityZeroMismatch: boolean;
};

type ShadowStore = {
  records: MemoryRecord[];
};

export class ShadowReplayManager {
  readonly #shadowPath: string;
  readonly #checkpointStore: IngestCheckpointStore;
  readonly #spool: JsonlIngestSpool;
  readonly #canonicalRepository: CanonicalMemoryRepository;
  readonly #batchSize: number;
  readonly #requireParityZeroMismatch: boolean;
  #lastParityState: ShadowParityState = "pending";
  #lastMismatchCount = 0;

  constructor(options: ShadowReplayManagerOptions) {
    this.#shadowPath = path.join(path.resolve(options.storagePath), "shadow-records.json");
    this.#checkpointStore = new IngestCheckpointStore(
      options.storagePath,
      "shadow-checkpoint.json",
    );
    this.#spool = options.spool;
    this.#canonicalRepository = options.canonicalRepository;
    this.#batchSize = options.batchSize;
    this.#requireParityZeroMismatch = options.requireParityZeroMismatch;
    fs.mkdirSync(path.dirname(this.#shadowPath), { recursive: true });
  }

  async replayPending(): Promise<ShadowReplayResult> {
    const checkpoint = (await this.#checkpointStore.read()) ?? null;
    const afterSequence = checkpoint?.sequence ?? 0;
    const pending = (await this.#spool.listRecords(afterSequence)).slice(0, this.#batchSize);
    if (pending.length === 0) {
      const parity = this.#calculateParity();
      this.#lastParityState = parity.parityState;
      this.#lastMismatchCount = parity.mismatchCount;
      return {
        appliedCount: 0,
        parityState: parity.parityState,
        mismatchCount: parity.mismatchCount,
        checkpointAdvanced: false,
        checkpoint,
      };
    }

    const shadowRecords = this.#readShadowRecords();
    for (const record of pending) {
      this.#applyRecord(shadowRecords.records, record);
    }
    this.#writeShadowRecords(shadowRecords);

    const parity = this.#calculateParity();
    this.#lastParityState = parity.parityState;
    this.#lastMismatchCount = parity.mismatchCount;

    let nextCheckpoint: IngestCheckpoint | null = checkpoint;
    let checkpointAdvanced = false;
    const tail = pending.at(-1);
    if (tail && (parity.parityState === "ok" || !this.#requireParityZeroMismatch)) {
      nextCheckpoint = {
        backend: SHADOW_CHECKPOINT_BACKEND,
        sequence: tail.sequence,
        ingestId: tail.ingestId,
        updatedAt: new Date().toISOString(),
        state: parity.parityState === "ok" ? "compared" : "applied",
        details: {
          mismatchCount: parity.mismatchCount,
        },
      };
      await this.#checkpointStore.write(nextCheckpoint);
      checkpointAdvanced = true;
    }

    return {
      appliedCount: pending.length,
      parityState: parity.parityState,
      mismatchCount: parity.mismatchCount,
      checkpointAdvanced,
      checkpoint: nextCheckpoint,
    };
  }

  getCheckpoint(): IngestCheckpoint | null {
    return this.#checkpointStore.readSync();
  }

  getLastParityState(): ShadowParityState {
    return this.#lastParityState;
  }

  getLastMismatchCount(): number {
    return this.#lastMismatchCount;
  }

  getShadowPath(): string {
    return this.#shadowPath;
  }

  #applyRecord(records: MemoryRecord[], record: IngestSpoolRecord) {
    if (record.action !== "memory.store") {
      return;
    }
    const payload = record.payload as MemoryRecord;
    const index = records.findIndex((entry) => entry.id === payload.id);
    if (index >= 0) {
      records[index] = payload;
    } else {
      records.push(payload);
    }
  }

  #calculateParity(): { parityState: ShadowParityState; mismatchCount: number } {
    const canonical = this.#canonicalRepository.list();
    const shadow = this.#readShadowRecords().records;
    const mismatchCount = this.#countMismatches(canonical, shadow);
    return {
      parityState: mismatchCount === 0 ? "ok" : "mismatch",
      mismatchCount,
    };
  }

  #countMismatches(canonical: MemoryRecord[], shadow: MemoryRecord[]): number {
    const byId = new Map(shadow.map((record) => [record.id, record]));
    let mismatches = 0;
    for (const record of canonical) {
      const candidate = byId.get(record.id);
      if (!candidate) {
        mismatches += 1;
        continue;
      }
      if (
        candidate.text !== record.text ||
        candidate.ingestSequence !== record.ingestSequence ||
        candidate.dedupKey !== record.dedupKey
      ) {
        mismatches += 1;
      }
    }
    if (shadow.length !== canonical.length) {
      mismatches += Math.abs(shadow.length - canonical.length);
    }
    return mismatches;
  }

  #readShadowRecords(): ShadowStore {
    if (!fs.existsSync(this.#shadowPath)) {
      return { records: [] };
    }
    return JSON.parse(fs.readFileSync(this.#shadowPath, "utf8")) as ShadowStore;
  }

  #writeShadowRecords(store: ShadowStore) {
    fs.writeFileSync(this.#shadowPath, `${JSON.stringify(store, null, 2)}\n`, "utf8");
  }
}
