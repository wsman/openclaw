import { describe, expect, it } from "vitest";
import { assertDuckDbReadQuery } from "./SqlReadContract.js";

describe("assertDuckDbReadQuery", () => {
  it("accepts a single select query", () => {
    expect(assertDuckDbReadQuery("SELECT * FROM v_memory_store_compat;")).toBe(
      "SELECT * FROM v_memory_store_compat",
    );
  });

  it("accepts quoted allowed facade views", () => {
    expect(assertDuckDbReadQuery('SELECT * FROM "articles";')).toBe('SELECT * FROM "articles"');
  });

  it("rejects write statements", () => {
    expect(() => assertDuckDbReadQuery("INSERT INTO documents VALUES (1)")).toThrow("read-only");
  });

  it("rejects semicolon-chained statements", () => {
    expect(() => assertDuckDbReadQuery("SELECT 1; SELECT 2")).toThrow("single SELECT statement");
  });

  it("rejects raw runtime tables", () => {
    expect(() => assertDuckDbReadQuery("SELECT * FROM sessions")).toThrow(
      "raw runtime tables are blocked",
    );
  });

  it("rejects quoted raw runtime tables", () => {
    expect(() => assertDuckDbReadQuery('SELECT * FROM "sessions"')).toThrow(
      "raw runtime tables are blocked",
    );
  });

  it("rejects schema-qualified quoted raw runtime tables", () => {
    expect(() => assertDuckDbReadQuery('SELECT * FROM main."sessions"')).toThrow(
      "raw runtime tables are blocked",
    );
  });

  it("does not treat blocked names inside string literals as blocked relations", () => {
    expect(assertDuckDbReadQuery("SELECT 'sessions' AS relation_name FROM articles")).toBe(
      "SELECT 'sessions' AS relation_name FROM articles",
    );
  });

  it("does not treat blocked names inside comments as blocked relations", () => {
    expect(
      assertDuckDbReadQuery("SELECT * FROM articles -- sessions should stay blocked only as SQL\n"),
    ).toBe("SELECT * FROM articles -- sessions should stay blocked only as SQL");
  });
});
