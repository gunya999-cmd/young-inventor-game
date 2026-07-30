import { describe, expect, it } from 'vitest';
import { createInitialSnapshot } from './model';
import { PhysicsEngine } from './physics';
import { createLevel07ReferenceSolution } from './referenceSolution';

const STEP = 1 / 120;
const MAX_FRAMES = 2400;

interface RunResult {
  wonFrame: number;
  outOfBounds: boolean;
  buttonActivated: boolean;
  finalX: number;
  finalY: number;
}

function simulateReference(): RunResult {
  const engine = new PhysicsEngine(createLevel07ReferenceSolution());
  let wonFrame = -1;
  let outOfBounds = false;
  let buttonActivated = false;

  for (let frame = 0; frame < MAX_FRAMES; frame += 1) {
    engine.step(STEP);
    const ball = engine.partTransform('target-ball')!;
    buttonActivated ||= engine.deviceActive('level-button');
    outOfBounds ||= ball.position.x < -50 || ball.position.x > 1650 || ball.position.y < -100 || ball.position.y > 950;
    if (engine.hasWon()) {
      wonFrame = frame;
      break;
    }
  }

  const ball = engine.partTransform('target-ball')!;
  return {
    wonFrame,
    outOfBounds,
    buttonActivated,
    finalX: ball.position.x,
    finalY: ball.position.y
  };
}

function simulateEmpty(): RunResult {
  const engine = new PhysicsEngine(createInitialSnapshot());
  let outOfBounds = false;
  let buttonActivated = false;

  for (let frame = 0; frame < MAX_FRAMES; frame += 1) {
    engine.step(STEP);
    const ball = engine.partTransform('target-ball')!;
    buttonActivated ||= engine.deviceActive('level-button');
    outOfBounds ||= ball.position.x < -50 || ball.position.x > 1650 || ball.position.y < -100 || ball.position.y > 950;
  }

  const ball = engine.partTransform('target-ball')!;
  return {
    wonFrame: engine.hasWon() ? MAX_FRAMES : -1,
    outOfBounds,
    buttonActivated,
    finalX: ball.position.x,
    finalY: ball.position.y
  };
}

describe('level 07 robustness', () => {
  it('repeats the canonical solution deterministically without leaving the world', () => {
    const runs = Array.from({ length: 3 }, simulateReference);

    for (const run of runs) {
      expect(run.wonFrame).toBeGreaterThan(0);
      expect(run.outOfBounds).toBe(false);
      // The guide-rail solution crosses above the low shaft switch and must not trigger it accidentally.
      expect(run.buttonActivated).toBe(false);
    }

    expect(new Set(runs.map((run) => run.wonFrame)).size).toBe(1);
    expect(Math.max(...runs.map((run) => run.finalX)) - Math.min(...runs.map((run) => run.finalX))).toBeLessThan(0.01);
    expect(Math.max(...runs.map((run) => run.finalY)) - Math.min(...runs.map((run) => run.finalY))).toBeLessThan(0.01);
  });

  it('does not self-complete, trigger the mechanism, or eject the ball when run empty', () => {
    const run = simulateEmpty();
    expect(run.wonFrame).toBe(-1);
    expect(run.buttonActivated).toBe(false);
    expect(run.outOfBounds).toBe(false);
  });
});
