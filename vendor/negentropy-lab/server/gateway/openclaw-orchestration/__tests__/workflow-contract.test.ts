import { validateWorkflowDefinition } from '../contracts/workflow-contract';

describe('workflow-contract', () => {
  it('accepts valid workflow definitions', () => {
    const validation = validateWorkflowDefinition({
      id: 'wf-valid',
      title: 'valid',
      trigger: { type: 'manual' },
      steps: [
        {
          id: 'spawn',
          type: 'spawn_agent',
          agentId: 'worker',
          prompt: 'do it',
        },
        {
          id: 'await',
          type: 'await_subagent',
          sourceStepId: 'spawn',
          dependsOn: ['spawn'],
        },
        {
          id: 'done',
          type: 'complete',
          dependsOn: ['await'],
        },
      ],
    });

    expect(validation.ok).toBe(true);
  });

  it('rejects invalid contract references', () => {
    const validation = validateWorkflowDefinition({
      id: 'wf-invalid',
      title: 'invalid',
      trigger: { type: 'manual' },
      steps: [
        {
          id: 'await',
          type: 'await_subagent',
          sourceStepId: 'missing',
        },
      ],
    });

    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(('errors' in validation ? validation.errors : []).join(' | ')).toContain('sourceStepId references unknown step');
    }
  });
});
