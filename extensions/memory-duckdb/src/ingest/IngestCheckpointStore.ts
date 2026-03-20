import fs from "node:fs";
import path from "node:path";
import type { IngestCheckpoint } from "./types.js";

export class IngestCheckpointStore {
  readonly #filePath: string;

  constructor(rootDir: string, filename: string) {
    this.#filePath = path.join(path.resolve(rootDir), filename);
    fs.mkdirSync(path.dirname(this.#filePath), { recursive: true });
  }

  getPath(): string {
    return this.#filePath;
  }

  readSync(): IngestCheckpoint | null {
    if (!fs.existsSync(this.#filePath)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(this.#filePath, "utf8")) as IngestCheckpoint;
  }

  async read(): Promise<IngestCheckpoint | null> {
    return this.readSync();
  }

  async write(checkpoint: IngestCheckpoint): Promise<void> {
    fs.writeFileSync(this.#filePath, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
  }
}
