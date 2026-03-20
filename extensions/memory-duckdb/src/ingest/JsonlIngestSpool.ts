import fs from "node:fs";
import path from "node:path";
import type { IngestSpoolRecord, JsonlIngestSpoolDiagnostics } from "./types.js";

type JsonlIngestSpoolOptions = {
  rootDir: string;
  maxActiveBytes?: number;
};

function parseRecord(line: string): IngestSpoolRecord | null {
  if (!line.trim()) {
    return null;
  }
  return JSON.parse(line) as IngestSpoolRecord;
}

function parseSegmentStart(filename: string): number {
  const match = filename.match(/-(\d+)\.jsonl$/u);
  return match ? Number.parseInt(match[1] ?? "", 10) : Number.MAX_SAFE_INTEGER;
}

export class JsonlIngestSpool {
  readonly #rootDir: string;
  readonly #segmentsDir: string;
  readonly #checkpointsDir: string;
  readonly #activePath: string;
  readonly #maxActiveBytes: number;
  #initialized = false;
  #nextSequence = 1;
  #activeStartSequence: number | null = null;

  constructor(options: JsonlIngestSpoolOptions) {
    this.#rootDir = path.resolve(options.rootDir);
    this.#segmentsDir = path.join(this.#rootDir, "segments");
    this.#checkpointsDir = path.join(this.#rootDir, "checkpoints");
    this.#activePath = path.join(this.#rootDir, "active.jsonl");
    this.#maxActiveBytes = options.maxActiveBytes ?? 256 * 1024;
  }

  getRootDir(): string {
    return this.#rootDir;
  }

  getCheckpointsDir(): string {
    return this.#checkpointsDir;
  }

  async initialize(): Promise<void> {
    if (this.#initialized) {
      return;
    }
    fs.mkdirSync(this.#segmentsDir, { recursive: true });
    fs.mkdirSync(this.#checkpointsDir, { recursive: true });
    if (!fs.existsSync(this.#activePath)) {
      fs.writeFileSync(this.#activePath, "", "utf8");
    }

    const activeRecords = this.#readRecordsFromPath(this.#activePath);
    const existing = [
      ...this.#readRecordsFromPaths(this.#getSegmentPaths()),
      ...activeRecords,
    ].sort((left, right) => left.sequence - right.sequence);
    this.#nextSequence = (existing.at(-1)?.sequence ?? 0) + 1;
    this.#activeStartSequence = activeRecords[0]?.sequence ?? null;
    this.#initialized = true;
  }

  async append<TPayload>(
    input: Omit<IngestSpoolRecord<TPayload>, "sequence">,
  ): Promise<IngestSpoolRecord<TPayload>> {
    await this.initialize();
    const record: IngestSpoolRecord<TPayload> = {
      ...input,
      sequence: this.#nextSequence,
    };
    if (this.#activeStartSequence == null) {
      this.#activeStartSequence = record.sequence;
    }
    fs.appendFileSync(this.#activePath, `${JSON.stringify(record)}\n`, "utf8");
    this.#nextSequence += 1;

    if (fs.statSync(this.#activePath).size > this.#maxActiveBytes) {
      this.#rotateActiveSegment();
    }

    return record;
  }

  async listRecords(afterSequence = 0): Promise<IngestSpoolRecord[]> {
    await this.initialize();
    return [
      ...this.#readRecordsFromPaths(this.#getSegmentPaths()),
      ...this.#readRecordsFromPath(this.#activePath),
    ]
      .filter((record) => record.sequence > afterSequence)
      .sort((left, right) => left.sequence - right.sequence);
  }

  async getCurrentSequence(): Promise<number> {
    await this.initialize();
    return Math.max(0, this.#nextSequence - 1);
  }

  getDiagnostics(): JsonlIngestSpoolDiagnostics {
    const segmentCount = fs.existsSync(this.#segmentsDir)
      ? fs.readdirSync(this.#segmentsDir).filter((entry) => entry.endsWith(".jsonl")).length
      : 0;
    const activeSegmentBytes = fs.existsSync(this.#activePath)
      ? fs.statSync(this.#activePath).size
      : 0;

    return {
      rootDir: this.#rootDir,
      checkpointsDir: this.#checkpointsDir,
      segmentCount,
      activeSegmentBytes,
      activeSegmentStartSequence: this.#activeStartSequence,
      lastSequence: Math.max(0, this.#nextSequence - 1),
    };
  }

  #getSegmentPaths(): string[] {
    if (!fs.existsSync(this.#segmentsDir)) {
      return [];
    }
    return fs
      .readdirSync(this.#segmentsDir)
      .filter((entry) => entry.endsWith(".jsonl"))
      .sort((left, right) => parseSegmentStart(left) - parseSegmentStart(right))
      .map((entry) => path.join(this.#segmentsDir, entry));
  }

  #readRecordsFromPaths(paths: string[]): IngestSpoolRecord[] {
    return paths.flatMap((filePath) => this.#readRecordsFromPath(filePath));
  }

  #readRecordsFromPath(filePath: string): IngestSpoolRecord[] {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    return fs
      .readFileSync(filePath, "utf8")
      .split(/\r?\n/u)
      .map((line) => parseRecord(line))
      .filter((record): record is IngestSpoolRecord => record !== null);
  }

  #rotateActiveSegment() {
    const records = this.#readRecordsFromPath(this.#activePath);
    if (records.length === 0 || this.#activeStartSequence == null) {
      return;
    }
    const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
    const segmentPath = path.join(
      this.#segmentsDir,
      `${timestamp}-${this.#activeStartSequence}.jsonl`,
    );
    fs.renameSync(this.#activePath, segmentPath);
    fs.writeFileSync(this.#activePath, "", "utf8");
    this.#activeStartSequence = null;
  }
}
