import { BLOCKED_RAW_TABLES } from "./constants.js";
import { assertSelectReadQuery } from "./SelectReadSqlGuard.js";

export function assertDuckDbReadQuery(sql: string): string {
  return assertSelectReadQuery(sql, {
    emptyError: "DuckDB read facade requires a non-empty SELECT query",
    multiStatementError: "DuckDB read facade only accepts a single SELECT statement",
    writeError:
      "DuckDB read facade is read-only and cannot execute write, DDL, or admin statements",
    nonSelectError: "DuckDB read facade is SELECT-only",
    blockedRelations: BLOCKED_RAW_TABLES,
    blockedRelationError: (relations) =>
      `DuckDB read facade only permits stable views and compatibility surfaces; raw runtime tables are blocked: ${relations.join(", ")}`,
  });
}
