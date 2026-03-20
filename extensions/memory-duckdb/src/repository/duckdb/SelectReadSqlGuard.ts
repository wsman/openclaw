const WRITE_KEYWORDS = [
  "alter",
  "attach",
  "call",
  "comment",
  "copy",
  "create",
  "delete",
  "detach",
  "drop",
  "export",
  "grant",
  "import",
  "insert",
  "merge",
  "pragma",
  "replace",
  "revoke",
  "truncate",
  "update",
  "vacuum",
] as const;

const FROM_OR_JOIN_PATTERN =
  /\b(?:from|join)\s+((?:"[^"]+"|[a-z_][\w$]*)(?:\.(?:"[^"]+"|[a-z_][\w$]*))*)/giu;
const WRITE_KEYWORD_PATTERN = new RegExp(`\\b(?:${WRITE_KEYWORDS.join("|")})\\b`, "iu");

export type SelectReadSqlGuardOptions = {
  emptyError: string;
  multiStatementError: string;
  writeError: string;
  nonSelectError: string;
  blockedRelations?: readonly string[];
  blockedRelationError?: (relations: string[]) => string;
  allowedRelations?: readonly string[];
  disallowedRelationError?: (relations: string[], allowedRelations: readonly string[]) => string;
  requireRelation?: boolean;
  missingRelationError?: string;
};

function stripSingleQuotedLiteralsAndComments(sql: string): string {
  let index = 0;
  let result = "";

  while (index < sql.length) {
    const current = sql[index] ?? "";
    const next = sql[index + 1] ?? "";

    if (current === "'") {
      result += " ";
      index += 1;
      while (index < sql.length) {
        const char = sql[index] ?? "";
        const peek = sql[index + 1] ?? "";
        result += " ";
        index += 1;
        if (char === "'") {
          if (peek === "'") {
            result += " ";
            index += 1;
            continue;
          }
          break;
        }
      }
      continue;
    }

    if (current === "-" && next === "-") {
      result += "  ";
      index += 2;
      while (index < sql.length && sql[index] !== "\n") {
        result += " ";
        index += 1;
      }
      continue;
    }

    if (current === "/" && next === "*") {
      result += "  ";
      index += 2;
      while (index < sql.length) {
        const char = sql[index] ?? "";
        const peek = sql[index + 1] ?? "";
        result += " ";
        index += 1;
        if (char === "*" && peek === "/") {
          result += " ";
          index += 1;
          break;
        }
      }
      continue;
    }

    result += current;
    index += 1;
  }

  return result;
}

function normalizeStatement(
  sql: string,
  options: Pick<SelectReadSqlGuardOptions, "emptyError" | "multiStatementError">,
): string {
  const stripped = stripSingleQuotedLiteralsAndComments(sql).trim();
  if (!stripped) {
    throw new Error(options.emptyError);
  }
  const withoutTrailingSemicolon = stripped.replace(/;+\s*$/u, "").trim();
  if (!withoutTrailingSemicolon) {
    throw new Error(options.emptyError);
  }
  if (withoutTrailingSemicolon.includes(";")) {
    throw new Error(options.multiStatementError);
  }
  return withoutTrailingSemicolon;
}

export function listReferencedRelations(sql: string): string[] {
  const relations = new Set<string>();

  for (const match of sql.matchAll(FROM_OR_JOIN_PATTERN)) {
    const token = (match[1] ?? "")
      .split(".")
      .pop()
      ?.replace(/^"+|"+$/gu, "")
      .toLowerCase();
    if (token) {
      relations.add(token);
    }
  }

  return [...relations].sort();
}

export function assertSelectReadQuery(sql: string, options: SelectReadSqlGuardOptions): string {
  const normalized = normalizeStatement(sql, options);

  if (WRITE_KEYWORD_PATTERN.test(normalized)) {
    throw new Error(options.writeError);
  }
  if (!/^(select|with)\b/iu.test(normalized)) {
    throw new Error(options.nonSelectError);
  }

  const relations = listReferencedRelations(normalized);

  if (options.requireRelation && relations.length === 0) {
    throw new Error(
      options.missingRelationError ?? "Read contract requires at least one relation reference",
    );
  }

  if ((options.blockedRelations?.length ?? 0) > 0) {
    const blockedRelations = new Set(options.blockedRelations?.map((entry) => entry.toLowerCase()));
    const presentBlockedRelations = relations.filter((entry) => blockedRelations.has(entry));
    if (presentBlockedRelations.length > 0) {
      throw new Error(
        options.blockedRelationError?.(presentBlockedRelations) ??
          `Read contract blocks raw relations: ${presentBlockedRelations.join(", ")}`,
      );
    }
  }

  if ((options.allowedRelations?.length ?? 0) > 0) {
    const allowedRelations = new Set(options.allowedRelations?.map((entry) => entry.toLowerCase()));
    const disallowedRelations = relations.filter((entry) => !allowedRelations.has(entry));
    if (disallowedRelations.length > 0) {
      throw new Error(
        options.disallowedRelationError?.(disallowedRelations, options.allowedRelations ?? []) ??
          `Read contract only permits approved relations: ${disallowedRelations.join(", ")}`,
      );
    }
  }

  return sql.trim().replace(/;+\s*$/u, "");
}
