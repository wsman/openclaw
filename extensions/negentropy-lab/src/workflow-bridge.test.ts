import { describe, expect, it, vi } from 'vitest';
import { createWorkflowBridge } from './workflow-bridge.js';

describe('workflow bridge', () => {
  it('auto-dispatches spawn_subagent actions and posts subagent_spawned follow-up', async () => {
    const runWorkflow = vi.fn().mockResolvedValue({
      run: {
        runId: 'wf-1',
        workflowId: 'serial',
        status: 'running',
        trigger: { type: 'manual' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        outputs: {},
        steps: {},
      },
      actions: [
        {
          type: 'spawn_subagent',
          runId: 'wf-1',
          stepId: 'planner',
          payload: {
            childSessionKey: 'child-1',
            agentId: 'planner',
            prompt: 'plan task',
          },
        },
      ],
    });

    const sendEvent = vi.fn().mockResolvedValue({
      run: {
        runId: 'wf-1',
        workflowId: 'serial',
        status: 'waiting',
        trigger: { type: 'manual' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        outputs: {},
        steps: {},
      },
      actions: [],
    });

    const bridge = createWorkflowBridge({
      client: {
        runWorkflow,
        sendEvent,
        cancelWorkflow: vi.fn(),
        listRuns: vi.fn().mockResolvedValue({ runs: [], total: 0 }),
        getRun: vi.fn(),
      } as any,
      runtime: {
        subagent: {
          run: vi.fn().mockResolvedValue({ runId: 'child-run-1' }),
        },
      } as any,
      autoDispatchSubagents: true,
      logger: { info() {}, warn() {}, error() {}, debug() {} },
    });

    await bridge.runWorkflow({ workflowId: 'serial' });

    expect(runWorkflow).toHaveBeenCalledTimes(1);
    expect(sendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'subagent_spawned',
        childSessionKey: 'child-1',
        childRunId: 'child-run-1',
      }),
    );
  });
});
