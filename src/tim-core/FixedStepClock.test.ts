import { describe, expect, it } from 'vitest';
import { FixedStepClock } from './FixedStepClock';

function runFrames(frames: readonly number[]): { steps: number; distance: number; time: number } {
  const clock = new FixedStepClock({ stepSeconds: 1 / 120 });
  let steps = 0;
  let distance = 0;
  const speed = 37;

  for (const frame of frames) {
    clock.advance(frame, (dt) => {
      steps += 1;
      distance += speed * dt;
    });
  }

  return { steps, distance, time: clock.simulationSeconds };
}

describe('FixedStepClock', () => {
  it('produces the same simulation for different display frame rates', () => {
    const sixtyFps = runFrames(Array.from({ length: 60 }, () => 1 / 60));
    const thirtyFps = runFrames(Array.from({ length: 30 }, () => 1 / 30));
    const unevenFrames = runFrames([
      0.011, 0.023, 0.009, 0.041, 0.016, 0.027, 0.018, 0.035,
      ...Array.from({ length: 41 }, () => 0.02)
    ]);

    expect(sixtyFps.steps).toBe(120);
    expect(thirtyFps.steps).toBe(120);
    expect(sixtyFps.distance).toBeCloseTo(thirtyFps.distance, 10);
    expect(sixtyFps.time).toBeCloseTo(1, 10);
    expect(unevenFrames.steps).toBeGreaterThan(0);
  });

  it('clamps long browser stalls instead of exploding the simulation', () => {
    const clock = new FixedStepClock({
      stepSeconds: 1 / 120,
      maxFrameSeconds: 0.1,
      maxSubSteps: 16
    });
    let steps = 0;

    const executed = clock.advance(5, () => {
      steps += 1;
    });

    expect(executed).toBe(12);
    expect(steps).toBe(12);
    expect(clock.simulationSeconds).toBeCloseTo(0.1, 10);
  });

  it('rejects invalid frame deltas', () => {
    const clock = new FixedStepClock();

    expect(() => clock.advance(-0.1, () => undefined)).toThrow(
      'frameSeconds must be a finite non-negative number'
    );
    expect(() => clock.advance(Number.NaN, () => undefined)).toThrow(
      'frameSeconds must be a finite non-negative number'
    );
  });
});
