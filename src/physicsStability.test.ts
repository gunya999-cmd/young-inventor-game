import { describe, expect, it } from 'vitest';
import { PhysicsEngine } from './physics';
import type { MachineSnapshot } from './model';

const STEP = 1 / 120;

function stabilityFixture(): MachineSnapshot {
  return {
    parts: [
      { id: 'floor', kind: 'plank', x: 800, y: 680, angle: 0, fixed: true },
      { id: 'domino-1', kind: 'domino', x: 800, y: 615, angle: 0, fixed: false },
      { id: 'domino-2', kind: 'domino', x: 800, y: 513, angle: 0, fixed: false },
      { id: 'domino-3', kind: 'domino', x: 800, y: 411, angle: 0, fixed: false },
      { id: 'weight', kind: 'weight', x: 800, y: 320, angle: 0, fixed: false }
    ],
    ropes: [],
    hinges: [],
    signals: []
  };
}

describe('physics stability', () => {
  it('keeps a loaded vertical stack finite and locally contained', () => {
    const engine = new PhysicsEngine(stabilityFixture(), { includeLevelGeometry: false });
    let peakSpeed = 0;

    for (let frame = 0; frame < 1200; frame += 1) {
      engine.step(STEP);
      for (const id of ['domino-1', 'domino-2', 'domino-3', 'weight']) {
        const transform = engine.partTransform(id)!;
        const motion = engine.partKinematics(id)!;
        expect(Number.isFinite(transform.position.x)).toBe(true);
        expect(Number.isFinite(transform.position.y)).toBe(true);
        expect(Number.isFinite(transform.angle)).toBe(true);
        peakSpeed = Math.max(peakSpeed, Math.hypot(motion.velocity.x, motion.velocity.y));
      }
    }

    const final = ['domino-1', 'domino-2', 'domino-3', 'weight'].map((id) => ({
      id,
      transform: engine.partTransform(id)!,
      motion: engine.partKinematics(id)!
    }));

    expect(peakSpeed).toBeLessThan(2400);
    expect(final.every(({ transform }) => Math.abs(transform.position.x - 800) < 190)).toBe(true);
    expect(final.every(({ transform }) => transform.position.y > 250 && transform.position.y < 760)).toBe(true);
    expect(final.every(({ motion }) => Math.hypot(motion.velocity.x, motion.velocity.y) < 15)).toBe(true);
  });

  it('preserves the authored reference solution with the stronger solver', async () => {
    const { createLevel07ReferenceSolution } = await import('./referenceSolution');
    const engine = new PhysicsEngine(createLevel07ReferenceSolution());
    let won = false;

    for (let frame = 0; frame < 2400; frame += 1) {
      engine.step(STEP);
      if (engine.hasWon()) {
        won = true;
        break;
      }
    }

    expect(won).toBe(true);
  });
});
