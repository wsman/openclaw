import type { WorkflowAction } from '../actions/step-actions';
import type { WorkflowDefinition } from '../contracts/workflow-contract';
import { WorkflowRunStore } from '../runtime/run-store';
import {
  createOrchestrationService,
  type OrchestrationResult,
} from '../service/orchestration-service';
import { WorkflowRegistry } from '../service/workflow-registry';

function drainSpawnActions(params: {
  start: OrchestrationResult;
  service: ReturnType<typeof createOrchestrationService>;
  outcomes?: Record<string, 'ok' | 'error' | 'timeout'>;
}) {
  const queue: WorkflowAction[] = [...params.start.actions];
  let guard = 0;

  while (queue.length > 0 && guard < 64) {
    guard += 1;
    const action = queue.shift();
    if (!action || action.type !== 'spawn_subagent') {
      continue;
    }

    const childRunId = `child-${action.stepId}-${guard}`;
    const spawned = params.service.handleEvent({
      type: 'subagent_spawned',
      runId: action.runId,
      stepId: action.stepId,
      childSessionKey: action.payload.childSessionKey,
      childRunId,
    });
    queue.push(...spawned.actions);

    const outcome = params.outcomes?.[action.stepId] ?? 'ok';
    const ended = params.service.handleEvent({
      type: 'subagent_ended',
      runId: action.runId,
      stepId: action.stepId,
      childSessionKey: action.payload.childSessionKey,
      childRunId,
      outcome,
      error: outcome === 'ok' ? undefined : `${action.stepId} failed`,
    });
    queue.push(...ended.actions);
  }

  expect(guard).toBeLessThan(64);
}

describe('orchestration-service', () => {
  it('supports manual trigger run and serial workflow success path', () => {
    const service = createOrchestrationService();
    const started = service.startWorkflow({
      workflowId: 'serial_planner_executor_complete',
      trigger: { source: 'test' },
    });

    expect(started.run?.workflowId).toBe('serial_planner_executor_complete');
    expect(started.actions.some((action) => action.type === 'spawn_subagent')).toBe(true);

    drainSpawnActions({ start: started, service });

    const run = service.getRun(started.run!.runId)!;
    expect(run.status).toBe('completed');
    expect(run.outputs.final).toBeDefined();
    expect(run.steps.complete.status).toBe('completed');
  });

  it('supports parallel fan-out and join completion', () => {
    const service = createOrchestrationService();
    const started = service.startWorkflow({ workflowId: 'parallel_research_implementation_review' });

    drainSpawnActions({ start: started, service });

    const run = service.getRun(started.run!.runId)!;
    expect(run.status).toBe('completed');
    expect(run.steps.summarize.status).toBe('completed');
    expect(run.steps.complete.status).toBe('completed');
  });

  it('supports retry and escalate failure path', () => {
    const service = createOrchestrationService();
    const started = service.startWorkflow({ workflowId: 'failure_retry_escalate' });

    drainSpawnActions({
      start: started,
      service,
      outcomes: {
        worker: 'error',
      },
    });

    const run = service.getRun(started.run!.runId)!;
    expect(run.status).toBe('failed');
    expect(run.steps.worker.attempts).toBe(3);
    expect(run.steps.escalate.status).toBe('completed');
  });

  it('supports cancel and emergency stop semantics', () => {
    const service = createOrchestrationService();
    const started = service.startWorkflow({ workflowId: 'serial_planner_executor_complete' });

    const canceled = service.cancelRun({
      runId: started.run!.runId,
      emergency: true,
      reason: 'manual emergency stop',
    });

    expect(canceled.run?.status).toBe('canceled');
    expect(canceled.run?.lastError).toContain('manual emergency stop');
  });

  it('supports retry workflow from terminal run', () => {
    const service = createOrchestrationService();
    const started = service.startWorkflow({ workflowId: 'serial_planner_executor_complete' });

    drainSpawnActions({ start: started, service });
    const run = service.getRun(started.run!.runId)!;
    expect(run.status).toBe('completed');

    const retried = service.retryWorkflow({ runId: run.runId });
    expect(retried.run?.runId).not.toBe(run.runId);
    expect(retried.run?.metadata.retryOfRunId).toBe(run.runId);
    expect(retried.actions.some((action) => action.type === 'spawn_subagent')).toBe(true);
  });

  it('deduplicates repeated runtime events by dedupeKey', () => {
    const service = createOrchestrationService();
    const started = service.startWorkflow({ workflowId: 'serial_planner_executor_complete' });
    const spawn = started.actions.find((action) => action.type === 'spawn_subagent');
    expect(spawn).toBeDefined();

    const event = {
      type: 'subagent_spawned' as const,
      runId: started.run!.runId,
      stepId: spawn!.stepId,
      childSessionKey: spawn!.payload.childSessionKey,
      childRunId: 'child-1',
      dedupeKey: 'dupe-key',
    };

    const first = service.handleEvent(event);
    const second = service.handleEvent(event);

    expect(first.ignored).not.toBe(true);
    expect(second.ignored).toBe(true);
    expect(second.message).toContain('duplicate event ignored');
  });

  it('uses session_end fallback to wake waiting steps when lifecycle event is missing', () => {
    const service = createOrchestrationService();
    const started = service.startWorkflow({ workflowId: 'serial_planner_executor_complete' });
    const spawn = started.actions.find((action) => action.type === 'spawn_subagent');
    expect(spawn).toBeDefined();

    service.handleEvent({
      type: 'session_end',
      runId: started.run!.runId,
      sessionKey: spawn!.payload.childSessionKey,
      dedupeKey: 'session-end-fallback',
    });

    const run = service.getRun(started.run!.runId)!;
    expect(run.steps.planner.status).toBe('waiting');
    expect(run.steps.planner.attempts).toBe(2);
    expect(run.steps.planner.metadata?.wakeReason).toBe('waiting_for_child');
  });

  it('supports manual reconcile entry to recover stale orphan waiting steps', async () => {
    const store = new WorkflowRunStore();
    const service = createOrchestrationService({
      store,
      runtimeConfig: {
        staleWaitingMs: 1,
        sweepIntervalMs: 60_000,
      },
    });

    const started = service.startWorkflow({ workflowId: 'serial_planner_executor_complete' });
    const spawn = started.actions.find((action) => action.type === 'spawn_subagent');
    expect(spawn).toBeDefined();

    store.unbindChildSession({ childSessionKey: spawn!.payload.childSessionKey });
    await new Promise((resolve) => setTimeout(resolve, 5));

    const summary = service.reconcileRuns({
      runId: started.run!.runId,
      reason: 'manual_test_reconcile',
    });

    expect(summary.ok).toBe(true);
    expect(summary.scanned).toBe(1);
    expect(summary.updated).toBeGreaterThan(0);
    expect(summary.reason).toBe('manual_test_reconcile');

    const run = service.getRun(started.run!.runId)!;
    expect(run.steps.planner.status).toBe('ready');
    expect(run.steps.planner.metadata?.wakeReason).toBe('sweep_orphan_detected');
  });

  it('marks timed_out when waiting step exceeds timeout without retries', async () => {
    const timeoutWorkflow: WorkflowDefinition = {
      id: 'timeout_once',
      title: 'timeout once',
      trigger: { type: 'manual' },
      steps: [
        {
          id: 'worker',
          type: 'spawn_agent',
          agentId: 'worker',
          prompt: 'wait forever',
          timeoutMs: 5,
          retry: { maxAttempts: 1 },
        },
        {
          id: 'complete',
          type: 'complete',
          dependsOn: ['worker'],
        },
      ],
    };

    const service = createOrchestrationService({
      registry: new WorkflowRegistry([timeoutWorkflow]),
      store: new WorkflowRunStore(),
    });

    const started = service.startWorkflow({ workflowId: 'timeout_once' });
    expect(started.actions.some((action) => action.type === 'spawn_subagent')).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 15));

    const run = service.getRun(started.run!.runId)!;
    expect(run.status).toBe('timed_out');
    expect(run.steps.worker.status).toBe('timed_out');
  });
});
