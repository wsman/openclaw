/**
 * @constitution
 * §101 同步公理: governance 断路器实现与真理源文档保持同步
 * §141 熵减验证公理: 治理断路策略需保持语义稳定
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename BreakerService.ts
 * @version 1.0.0
 * @category governance
 * @last_updated 2026-03-10
 */

import { AuthorityState } from "../../schema/AuthorityState";

export interface BreakerSnapshot {
  level: number;
  mode: string;
  status: string;
  reason?: string;
}

export class BreakerService {
  constructor(private readonly state: AuthorityState) {}

  evaluate(forecastGlobal?: number): BreakerSnapshot {
    const { global, system, financial } = this.state.entropy;
    const thresholds = {
      warning: this.state.entropy.thresholds.get("global_warning") ?? 0.7,
      danger: this.state.entropy.thresholds.get("global_danger") ?? 0.85,
      critical: this.state.entropy.thresholds.get("global_critical") ?? 0.9,
      systemCritical: this.state.entropy.thresholds.get("system_critical") ?? 0.7,
      financialCritical: this.state.entropy.thresholds.get("financial_critical") ?? 0.8,
    };
    let level = 0;
    let mode = "normal";
    let status = "active";
    let reason = "steady";

    if (global >= thresholds.critical || system >= thresholds.systemCritical || financial >= thresholds.financialCritical) {
      level = 3;
      mode = "lockdown";
      status = "critical";
      reason = "threshold_critical";
    } else if ((forecastGlobal ?? 0) >= thresholds.critical) {
      level = 2;
      mode = "recovery";
      status = "warning";
      reason = "forecast_critical";
    } else if (global >= thresholds.danger) {
      level = 2;
      mode = "recovery";
      status = "warning";
      reason = "threshold_danger";
    } else if ((forecastGlobal ?? 0) >= thresholds.danger) {
      level = 1;
      mode = "guarded";
      status = "warning";
      reason = "forecast_danger";
    } else if (global >= thresholds.warning) {
      level = 1;
      mode = "recovery";
      status = "warning";
      reason = "threshold_warning";
    }

    this.state.entropy.breakerLevel = level;
    this.state.governance.breakerLevel = level;
    this.state.system.mode = mode;
    this.state.system.status = status;

    if (level === 0) {
      if (this.state.governance.sanctions.has("breaker")) {
        this.state.governance.sanctions.delete("breaker");
      }
    } else {
      this.state.governance.sanctions.set("breaker", `level:${level}:${reason}`);
    }

    return { level, mode, status, reason };
  }
}
