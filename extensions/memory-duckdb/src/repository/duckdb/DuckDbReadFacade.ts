import { createRequire } from "node:module";
import { getDuckDbNativeBindingStatus } from "../../diagnostics/DuckDbNativeBinding.js";
import { assertDuckDbReadQuery } from "./SqlReadContract.js";

type DuckDbRow = Record<string, unknown>;

type DuckDbConnection = {
  all: (
    sql: string,
    params: unknown[],
    callback: (error: Error | null, rows: DuckDbRow[]) => void,
  ) => void;
  close: () => void;
};

type DuckDbDatabase = {
  connect: () => DuckDbConnection;
  close: () => void;
};

type DuckDbModule = {
  Database: new (filename: string, options?: { access_mode?: string }) => DuckDbDatabase;
};

const requireDuckDb = createRequire(import.meta.url);

function loadDuckDbModule(): DuckDbModule {
  return requireDuckDb("duckdb") as DuckDbModule;
}

export class DuckDbReadFacade {
  readonly #dbPath: string;
  #database: DuckDbDatabase | null = null;
  #connection: DuckDbConnection | null = null;

  constructor(dbPath: string) {
    this.#dbPath = dbPath;
  }

  getStatus() {
    return {
      dbPath: this.#dbPath,
      native: getDuckDbNativeBindingStatus(),
    };
  }

  async query(sql: string, params: unknown[] = []): Promise<DuckDbRow[]> {
    const safeSql = assertDuckDbReadQuery(sql);
    const connection = this.#getConnection();
    return new Promise((resolve, reject) => {
      connection.all(safeSql, params, (error, rows) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(rows ?? []);
      });
    });
  }

  close() {
    try {
      this.#connection?.close();
    } catch {
      // best-effort close
    }
    try {
      this.#database?.close();
    } catch {
      // best-effort close
    }
    this.#connection = null;
    this.#database = null;
  }

  #getConnection(): DuckDbConnection {
    if (this.#connection) {
      return this.#connection;
    }
    const duckdb = loadDuckDbModule();
    this.#database = new duckdb.Database(this.#dbPath, { access_mode: "READ_ONLY" });
    this.#connection = this.#database.connect();
    return this.#connection;
  }
}
