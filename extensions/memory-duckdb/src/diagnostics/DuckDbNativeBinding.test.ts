import { describe, expect, it } from "vitest";
import { getDuckDbNativeBindingStatus } from "./DuckDbNativeBinding.js";

describe("getDuckDbNativeBindingStatus", () => {
  it("classifies a missing package", () => {
    const status = getDuckDbNativeBindingStatus({
      loadModule(specifier) {
        if (specifier === "duckdb/package.json") {
          throw new Error("Cannot find module 'duckdb/package.json'");
        }
        throw new Error("Cannot find module 'duckdb'");
      },
    });

    expect(status.bindingAvailable).toBe(false);
    expect(status.failureKind).toBe("missing-package");
  });

  it("classifies a missing native binding", () => {
    const status = getDuckDbNativeBindingStatus({
      loadModule(specifier) {
        if (specifier === "duckdb/package.json") {
          return { version: "1.0.0" };
        }
        throw new Error("Could not locate duckdb.node under lib/binding");
      },
    });

    expect(status.bindingAvailable).toBe(false);
    expect(status.packageVersion).toBe("1.0.0");
    expect(status.failureKind).toBe("missing-binding");
    expect(status.likelyNeedsLocalBuild).toBe(true);
  });
});
