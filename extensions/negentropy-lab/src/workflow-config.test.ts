import { describe, expect, it } from "vitest";
import { resolveWorkflowBridgeConfig } from "./workflow-config.js";

describe("workflow-config", () => {
  it("derives workflow API base from decision serviceUrl when not explicitly configured", () => {
    const config = resolveWorkflowBridgeConfig({
      serviceUrl: "http://127.0.0.1:3000/internal/openclaw/decision",
    });

    expect(config.orchestrationApiBaseUrl).toBe("http://127.0.0.1:3000/internal/openclaw/workflows");
  });

  it("prefers explicit orchestrationApiBaseUrl", () => {
    const config = resolveWorkflowBridgeConfig({
      serviceUrl: "http://127.0.0.1:3000/internal/openclaw/decision",
      orchestrationApiBaseUrl: "http://localhost:3555/internal/openclaw/workflows/",
      workflowTimeoutMs: 7777,
      autoDispatchSubagents: false,
      workflowEnabled: false,
    });

    expect(config.enabled).toBe(false);
    expect(config.orchestrationApiBaseUrl).toBe("http://localhost:3555/internal/openclaw/workflows");
    expect(config.timeoutMs).toBe(7777);
    expect(config.autoDispatchSubagents).toBe(false);
  });
});
