/**
 * @constitution
 * §101 同步公理: governance 试点工作流实现与真理源文档保持同步
 * §141 熵减验证公理: 治理工作流需保持语义稳定
 * §152 单一真理源公理: 当前运行态以 memory_bank/t0_core 为准
 *
 * @filename AuthorityPilotWorkflowService.ts
 * @version 1.0.0
 * @category governance
 * @last_updated 2026-03-10
 */

import { AuthorityState } from "../../schema/AuthorityState";
import { EventStore } from "../authority/EventStore";
import { MutationPipeline } from "../authority/MutationPipeline";
import { EntropyDrillResult, EntropyReport, MorningBrief } from "../authority/types";
import { BreakerService } from "./BreakerService";
import { EntropyEngine } from "./EntropyEngine";

function createId(prefix: string): string {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

export class AuthorityPilotWorkflowService {
  constructor(
    private readonly state: AuthorityState,
    private readonly mutationPipeline: MutationPipeline,
    private readonly eventStore: EventStore,
    private readonly entropyEngine: EntropyEngine,
    private readonly breakerService: BreakerService,
  ) {}

  runMorningBrief(proposer = "system"): MorningBrief {
    const report = this.entropyEngine.getReport();
    const activeAgents = [...this.state.agents.values()].filter((agent) => agent.available).length;
    const pendingTasks = [...this.state.tasks.values()].filter((task) => task.status === "pending").length;
    const openProposals = [...this.state.governance.proposals.values()].filter((value) => value.includes("\"status\":\"open\"")).length;
    const recommendations = this.buildRecommendations(report, pendingTasks);

    const brief: MorningBrief = {
      generatedAt: Date.now(),
      breakerLevel: report.breakerLevel,
      globalEntropy: report.global,
      forecastGlobal: report.forecastGlobal,
      activeAgents,
      pendingTasks,
      openProposals,
      recommendations,
    };

    this.persistWorkflow("morning-brief", proposer, {
      brief: JSON.stringify(brief),
      report: JSON.stringify(report),
    });
    this.appendAudit("workflow.pilot.executed", {
      workflowId: "morning-brief",
      generatedAt: brief.generatedAt,
      breakerLevel: brief.breakerLevel,
    });

    return brief;
  }

  runEntropyDrill(proposer = "system"): EntropyDrillResult {
    const report = this.entropyEngine.getReport();
    const breaker = this.breakerService.evaluate(report.forecastGlobal);
    const actions = [
      breaker.level >= 1 ? "throttle_high_risk_mutations" : "maintain_normal_flow",
      report.forecastGlobal >= (this.state.entropy.thresholds.get("global_danger") ?? 0.85)
        ? "notify_supervision_ministry"
        : "keep_monitoring",
      report.task >= 0.4 ? "prioritize_pending_tasks" : "task_queue_healthy",
    ];

    const drill: EntropyDrillResult = {
      triggeredAt: Date.now(),
      breakerLevel: breaker.level,
      mode: breaker.mode,
      status: breaker.status,
      forecastGlobal: report.forecastGlobal,
      actions,
    };

    this.persistWorkflow("entropy-drill", proposer, {
      drill: JSON.stringify(drill),
      report: JSON.stringify(report),
    });
    this.appendAudit("workflow.pilot.executed", {
      workflowId: "entropy-drill",
      triggeredAt: drill.triggeredAt,
      breakerLevel: drill.breakerLevel,
    });

    return drill;
  }

  private buildRecommendations(report: EntropyReport, pendingTasks: number): string[] {
    const recommendations: string[] = [];
    if (report.trend === "rising") {
      recommendations.push("stabilize_mutation_rate");
    }
    if (report.forecastGlobal >= (this.state.entropy.thresholds.get("global_danger") ?? 0.85)) {
      recommendations.push("prepare_breaker_escalation");
    }
    if (pendingTasks > 5) {
      recommendations.push("rebalance_task_assignments");
    }
    if (recommendations.length === 0) {
      recommendations.push("system_stable_continue_execution");
    }
    return recommendations;
  }

  private persistWorkflow(workflowId: string, proposer: string, outputs: Record<string, string>): void {
    const existing = this.state.workflows.get(workflowId);
    const result = this.mutationPipeline.propose({
      proposer,
      targetPath: `workflows.${workflowId}`,
      operation: existing ? "update" : "set",
      payload: {
        id: workflowId,
        type: "pilot",
        status: "completed",
        outputs: {
          ...(existing ? Object.fromEntries(existing.outputs.entries()) : {}),
          ...outputs,
        },
        updatedAt: Date.now(),
      },
      reason: "pilot_workflow_execute",
    });
    if (!result.ok) {
      throw new Error(result.error || `failed to persist workflow ${workflowId}`);
    }
  }

  private appendAudit(type: "workflow.pilot.executed", payload: Record<string, unknown>): void {
    this.eventStore.append({
      eventId: createId("event"),
      mutationId: createId("pilot"),
      type,
      timestamp: Date.now(),
      payload,
    });
  }
}
