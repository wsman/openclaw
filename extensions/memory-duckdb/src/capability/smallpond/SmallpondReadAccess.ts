import { assertSelectReadQuery } from "../../repository/duckdb/SelectReadSqlGuard.js";
import {
  SMALLPOND_APPROVED_SOURCE_VIEWS,
  SMALLPOND_FORBIDDEN_RAW_SOURCES,
} from "./SmallpondArtifactInventory.js";
import { SMALLPOND_CONTRACT_SCHEMA_VERSION } from "./SmallpondContracts.js";

export const SMALLPOND_ARTIFACT_READ_CONTRACT_VERSION = SMALLPOND_CONTRACT_SCHEMA_VERSION;

export type SmallpondArtifactRow = Record<string, unknown>;

export type SmallpondArtifactQueryRunner = (
  sql: string,
  params: unknown[],
) => Promise<SmallpondArtifactRow[]>;

export function assertSmallpondArtifactReadQuery(sql: string): string {
  return assertSelectReadQuery(sql, {
    emptyError: "Smallpond artifact read contract requires a non-empty SELECT query",
    multiStatementError: "Smallpond artifact read contract only accepts a single SELECT statement",
    writeError:
      "Smallpond artifact read contract is read-only and cannot execute write, DDL, or admin statements",
    nonSelectError: "Smallpond artifact read contract is SELECT-only",
    blockedRelations: SMALLPOND_FORBIDDEN_RAW_SOURCES,
    blockedRelationError: (relations) =>
      `Smallpond artifact read contract blocks raw internal sources: ${relations.join(", ")}`,
    allowedRelations: SMALLPOND_APPROVED_SOURCE_VIEWS,
    disallowedRelationError: (relations, allowedRelations) =>
      `Smallpond artifact read contract only permits approved source views: ${relations.join(", ")}; allowed: ${allowedRelations.join(", ")}`,
    requireRelation: true,
    missingRelationError:
      "Smallpond artifact read contract requires an approved source view in FROM or JOIN",
  });
}

export class SmallpondArtifactReadAccess {
  readonly #runQuery: SmallpondArtifactQueryRunner;

  constructor(runQuery: SmallpondArtifactQueryRunner) {
    this.#runQuery = runQuery;
  }

  async read(sql: string, params: unknown[] = []): Promise<SmallpondArtifactRow[]> {
    const safeSql = assertSmallpondArtifactReadQuery(sql);
    return this.#runQuery(safeSql, params);
  }
}
