/**
 * @constitution
 * §101 同步公理: governance 熵引擎实现与真理源文档保持同步
 * §141 熵减验证公理: 熵计算与阈值判断需保持语义稳定
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename EntropyEngine.ts
 * @version 1.0.0
 * @category governance
 * @last_updated 2026-03-10
 */

import { AuthorityState } from "../../schema/AuthorityState";
import { EntropyReport } from "../authority/types";

interface EntropySample {
  timestamp: number;
  global: number;
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function round(value: number): number {
  return Number(clamp(value).toFixed(3));
}

export class EntropyEngine {
  private readonly history: EntropySample[] = [];

  constructor(private readonly state: AuthorityState) {}

  recalculate() {
    const tasks = Array.from(this.state.tasks.values());
    const agents = Array.from(this.state.agents.values());
    const workflows = Array.from(this.state.workflows.values());

    const totalTasks = tasks.length;
    const totalAgents = Math.max(agents.length, 1);
    const failedTasks = tasks.filter((task) => task.status === "failed" || task.status === "timeout").length;
    const pendingTasks = tasks.filter((task) => task.status === "pending").length;
    const blockedTasks = tasks.filter((task) => task.status === "blocked").length;
    const timeoutTasks = tasks.filter((task) => task.status === "timeout").length;
    const reworkTasks = tasks.filter((task) => task.metadata.get("rework") === "true").length;
    const busyAgents = agents.filter((agent) => agent.status === "processing" || agent.status === "thinking").length;
    const unhealthyAgents = agents.filter(
      (agent) => !agent.available || agent.status === "error" || agent.status === "terminated" || agent.healthStatus === "unhealthy",
    ).length;
    const degradedAgents = agents.filter((agent) => agent.healthStatus === "degraded").length;
    const overloadedAgents = agents.filter((agent) => agent.currentLoad >= 0.85).length;

    const taskEntropy = round(
      0.3 * Math.min(1, pendingTasks / 100) +
        0.25 * (totalTasks === 0 ? 0 : blockedTasks / totalTasks) +
        0.2 * (totalTasks === 0 ? 0 : timeoutTasks / totalTasks) +
        0.15 * (totalTasks === 0 ? 0 : reworkTasks / totalTasks) +
        0.1 * Math.min(1, workflows.filter((workflow) => workflow.status === "blocked").length / 10),
    );

    const systemEntropy = round(
      0.2 * (totalAgents === 0 ? 0 : unhealthyAgents / totalAgents) +
        0.2 * (totalTasks === 0 ? 0 : failedTasks / totalTasks) +
        0.2 * (totalAgents === 0 ? 0 : overloadedAgents / totalAgents) +
        0.2 * (totalAgents === 0 ? 0 : degradedAgents / totalAgents) +
        0.2 * Math.min(1, (tasks.length + workflows.length + agents.length) / 300),
    );

    const departmentCounts = new Map<string, number>();
    tasks.forEach((task) => {
      const key = task.department || "UNASSIGNED";
      departmentCounts.set(key, (departmentCounts.get(key) || 0) + 1);
    });
    const departmentValues = [...departmentCounts.values()];
    const maxDepartmentLoad = departmentValues.length > 0 ? Math.max(...departmentValues) : 0;
    const minDepartmentLoad = departmentValues.length > 0 ? Math.min(...departmentValues) : 0;
    const financialEntropy = round(
      0.5 * (totalTasks === 0 ? 0 : maxDepartmentLoad / Math.max(totalTasks, 1)) +
        0.5 * (totalTasks === 0 ? 0 : (maxDepartmentLoad - minDepartmentLoad) / Math.max(totalTasks, 1)),
    );

    const socialEntropy = round(
      0.35 * (totalAgents === 0 ? 0 : overloadedAgents / totalAgents) +
        0.25 * Math.min(1, Math.max(0, agents.length - 7) / 10) +
        0.2 * (totalAgents === 0 ? 0 : degradedAgents / totalAgents) +
        0.2 *
          (busyAgents === 0
            ? 0
            : 1 - Math.min(1, tasks.filter((task) => task.status === "completed").length / Math.max(busyAgents, 1))),
    );

    const structuralEntropy = round(1 - this.state.audit.integrity);
    const alignmentEntropy = round(Math.min(1, this.state.governance.mutationQueue.length / 10));
    const biologicalEntropy = round(this.state.entropy.biological);

    const globalEntropy = round(
      0.15 * financialEntropy +
        0.2 * taskEntropy +
        0.2 * systemEntropy +
        0.15 * socialEntropy +
        0.15 * structuralEntropy +
        0.15 * alignmentEntropy,
    );

    this.state.entropy.financial = financialEntropy;
    this.state.entropy.task = taskEntropy;
    this.state.entropy.system = systemEntropy;
    this.state.entropy.social = socialEntropy;
    this.state.entropy.structural = structuralEntropy;
    this.state.entropy.alignment = alignmentEntropy;
    this.state.entropy.biological = biologicalEntropy;
    this.state.entropy.global = globalEntropy;
    this.state.lastUpdate = Date.now();

    this.recordSample(globalEntropy);
    this.applyAdaptiveThresholds();

    return this.state.entropy;
  }

  getReport(): EntropyReport {
    const forecastGlobal = this.forecastGlobal();
    const latest = this.history.slice(-2);
    let trend: EntropyReport["trend"] = "stable";
    if (latest.length >= 2) {
      const delta = latest[latest.length - 1].global - latest[latest.length - 2].global;
      if (delta > 0.02) {
        trend = "rising";
      } else if (delta < -0.02) {
        trend = "falling";
      }
    }

    return {
      global: this.state.entropy.global,
      financial: this.state.entropy.financial,
      biological: this.state.entropy.biological,
      social: this.state.entropy.social,
      task: this.state.entropy.task,
      system: this.state.entropy.system,
      structural: this.state.entropy.structural,
      alignment: this.state.entropy.alignment,
      breakerLevel: this.state.entropy.breakerLevel,
      thresholds: [...this.state.entropy.thresholds.entries()].reduce<Record<string, number>>((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {}),
      forecastGlobal,
      trend,
    };
  }

  forecastGlobal(windowSize = 5): number {
    const samples = this.history.slice(-windowSize);
    if (samples.length < 2) {
      return round(this.state.entropy.global);
    }
    let deltaSum = 0;
    for (let index = 1; index < samples.length; index += 1) {
      deltaSum += samples[index].global - samples[index - 1].global;
    }
    const avgDelta = deltaSum / Math.max(samples.length - 1, 1);
    return round(samples[samples.length - 1].global + avgDelta);
  }

  private recordSample(global: number): void {
    this.history.push({
      timestamp: Date.now(),
      global,
    });
    if (this.history.length > 60) {
      this.history.splice(0, this.history.length - 60);
    }
  }

  private applyAdaptiveThresholds(): void {
    const samples = this.history.slice(-10);
    if (samples.length < 3) {
      return;
    }
    const average = samples.reduce((acc, sample) => acc + sample.global, 0) / samples.length;
    const variance =
      samples.reduce((acc, sample) => acc + Math.pow(sample.global - average, 2), 0) / Math.max(samples.length, 1);
    const adjustment = Math.min(0.08, variance * 2);

    this.state.entropy.thresholds.set("global_warning", round(Math.max(0.6, 0.7 - adjustment)));
    this.state.entropy.thresholds.set("global_danger", round(Math.max(0.75, 0.85 - adjustment / 2)));
    this.state.entropy.thresholds.set("global_critical", round(Math.max(0.82, 0.9 - adjustment / 3)));
  }
}
