/**
 * @constitution
 * §101 同步公理: governance 断路器测试需与真理源文档保持同步
 * §141 熵减验证公理: 治理测试需验证断路行为稳定
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename BreakerService.test.ts
 * @version 1.0.0
 * @category governance/test
 * @last_updated 2026-03-10
 */

import { describe, expect, it } from "vitest";
import { AuthorityState } from "../../schema/AuthorityState";
import { BreakerService } from "./BreakerService";

describe("BreakerService", () => {
  it("escalates on critical thresholds and clears sanctions when stable", () => {
    const state = new AuthorityState();
    const breaker = new BreakerService(state);

    state.entropy.global = 0.95;
    state.entropy.system = 0.1;
    state.entropy.financial = 0.1;
    const critical = breaker.evaluate();
    expect(critical.level).toBe(3);
    expect(critical.mode).toBe("lockdown");
    expect(state.governance.sanctions.get("breaker")).toContain("level:3");

    state.entropy.global = 0.1;
    state.entropy.system = 0.1;
    state.entropy.financial = 0.1;
    const stable = breaker.evaluate();
    expect(stable.level).toBe(0);
    expect(state.governance.sanctions.has("breaker")).toBe(false);
  });

  it("supports forecast-driven warning escalation", () => {
    const state = new AuthorityState();
    const breaker = new BreakerService(state);

    state.entropy.global = 0.2;
    const snapshot = breaker.evaluate(0.91);
    expect(snapshot.level).toBe(2);
    expect(snapshot.reason).toBe("forecast_critical");

    const warning = breaker.evaluate(0.86);
    expect(warning.level).toBe(1);
    expect(warning.reason).toBe("forecast_danger");
  });
});
