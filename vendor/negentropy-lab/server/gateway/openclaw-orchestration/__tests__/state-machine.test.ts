import { assertTransition, canTransition, isTerminalStatus } from '../runtime/state-machine';

describe('workflow state-machine', () => {
  it('allows canonical lifecycle transitions', () => {
    expect(canTransition('pending', 'ready')).toBe(true);
    expect(canTransition('ready', 'running')).toBe(true);
    expect(canTransition('running', 'waiting')).toBe(true);
    expect(canTransition('waiting', 'completed')).toBe(true);
  });

  it('blocks invalid transitions', () => {
    expect(() => assertTransition('pending', 'completed', 'run', 'run-1')).toThrow(
      'Invalid run transition',
    );
  });

  it('marks terminal statuses correctly', () => {
    expect(isTerminalStatus('completed')).toBe(true);
    expect(isTerminalStatus('failed')).toBe(true);
    expect(isTerminalStatus('timed_out')).toBe(true);
    expect(isTerminalStatus('running')).toBe(false);
  });
});
