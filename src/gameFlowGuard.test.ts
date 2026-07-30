import { describe, expect, it } from 'vitest';
import { controlAllowedAfterCompletion } from './gameFlowGuard';

describe('completed run controls', () => {
  it('allows normal simulation controls before completion', () => {
    expect(controlAllowedAfterCompletion(false, 'pause')).toBe(true);
    expect(controlAllowedAfterCompletion(false, 'resume')).toBe(true);
    expect(controlAllowedAfterCompletion(false, 'stop')).toBe(true);
    expect(controlAllowedAfterCompletion(false, 'restart')).toBe(true);
  });

  it('blocks pause/resume after victory but keeps explicit exit actions', () => {
    expect(controlAllowedAfterCompletion(true, 'pause')).toBe(false);
    expect(controlAllowedAfterCompletion(true, 'resume')).toBe(false);
    expect(controlAllowedAfterCompletion(true, 'stop')).toBe(true);
    expect(controlAllowedAfterCompletion(true, 'restart')).toBe(true);
  });
});
