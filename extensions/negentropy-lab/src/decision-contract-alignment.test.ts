import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DECISION_ACTIONS,
  DECISION_ERROR_CODES,
  DECISION_MODES,
  createDefaultDecisionRequest,
} from "./decision-contract.snapshot.js";
import {
  DECISION_ACTIONS as CANONICAL_ACTIONS,
  DECISION_ERROR_CODES as CANONICAL_ERROR_CODES,
  DECISION_MODES as CANONICAL_MODES,
} from "../../../vendor/negentropy-lab/server/gateway/openclaw-decision/contracts/decision-contract.js";

function loadCanonicalSchema(): Record<string, unknown> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const schemaPath = path.resolve(
    here,
    "../../../vendor/negentropy-lab/server/gateway/openclaw-decision/contracts/decision-contract.schema.json",
  );
  return JSON.parse(fs.readFileSync(schemaPath, "utf8")) as Record<string, unknown>;
}

describe("decision contract snapshot alignment", () => {
  it("keeps key union sets aligned with canonical vendor contract", () => {
    expect(DECISION_MODES).toEqual(CANONICAL_MODES);
    expect(DECISION_ACTIONS).toEqual(CANONICAL_ACTIONS);
    expect(DECISION_ERROR_CODES).toEqual(CANONICAL_ERROR_CODES);
  });

  it("preserves canonical required request fields", () => {
    const schema = loadCanonicalSchema();
    const requestSchema = schema.DecisionRequest as { required?: unknown };
    const required = Array.isArray(requestSchema.required) ? requestSchema.required : [];
    expect(required).toEqual(expect.arrayContaining(["traceId", "transport", "method", "params", "ts"]));

    const sample = createDefaultDecisionRequest("chat.send", { text: "hello" }, "ws");
    expect(sample).toEqual(
      expect.objectContaining({
        traceId: expect.any(String),
        transport: "ws",
        method: "chat.send",
        params: { text: "hello" },
        ts: expect.any(String),
      }),
    );
  });

  it("keeps policyTags canonical object shape in schema", () => {
    const schema = loadCanonicalSchema();
    const policyTags = (schema.definitions as Record<string, unknown>).PolicyTags as {
      properties?: Record<string, unknown>;
    };
    const keys = Object.keys(policyTags.properties ?? {});
    expect(keys).toEqual(expect.arrayContaining(["ruleIds", "category", "severity", "custom"]));
  });
});
