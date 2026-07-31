import { describe, expect, test } from 'vitest';
import { PhysicsEngine } from './physics';
import type { MachineSnapshot } from './model';

const STEP = 1 / 120;

function simulate(engine: PhysicsEngine, seconds: number): void {
  for (let index = 0; index < Math.round(seconds / STEP); index += 1) engine.step(STEP);
}

function angular(engine: PhysicsEngine, id: string): number {
  const motion = engine.partKinematics(id);
  expect(motion).not.toBeNull();
  expect(Number.isFinite(motion!.angularVelocity)).toBe(true);
  return motion!.angularVelocity;
}

describe('drivetrain', () => {
  test('a motor reaches a bounded operating speed while remaining pinned', () => {
    const snapshot: MachineSnapshot = {
      parts: [{ id: 'motor', kind: 'motor', x: 500, y: 400, angle: 0, fixed: true }],
      ropes: [],
      hinges: []
    };
    const engine = new PhysicsEngine(snapshot, { includeLevelGeometry: false });
    simulate(engine, 4);
    const transform = engine.partTransform('motor')!;
    expect(Math.abs(transform.position.x - 500)).toBeLessThan(0.5);
    expect(Math.abs(transform.position.y - 400)).toBeLessThan(0.5);
    expect(Math.abs(angular(engine, 'motor'))).toBeGreaterThan(4);
    expect(Math.abs(angular(engine, 'motor'))).toBeLessThan(7);
  });

  test('touching gears rotate in opposite directions without numerical runaway', () => {
    const snapshot: MachineSnapshot = {
      parts: [
        { id: 'motor', kind: 'motor', x: 500, y: 400, angle: 0, fixed: true },
        { id: 'gear-a', kind: 'gear', x: 590, y: 400, angle: 0, fixed: true },
        { id: 'gear-b', kind: 'gear', x: 678, y: 400, angle: 0, fixed: true }
      ],
      ropes: [],
      hinges: []
    };
    const engine = new PhysicsEngine(snapshot, { includeLevelGeometry: false });
    simulate(engine, 5);
    const motor = angular(engine, 'motor');
    const first = angular(engine, 'gear-a');
    const second = angular(engine, 'gear-b');
    expect(Math.sign(first)).toBe(-Math.sign(motor));
    expect(Math.sign(second)).toBe(Math.sign(motor));
    expect(Math.abs(first)).toBeLessThan(12.1);
    expect(Math.abs(second)).toBeLessThan(12.1);
  });

  test('separated motor and sheave behave as a same-direction belt drive', () => {
    const snapshot: MachineSnapshot = {
      parts: [
        { id: 'motor', kind: 'motor', x: 450, y: 350, angle: 0, fixed: true },
        { id: 'sheave', kind: 'sheave', x: 700, y: 350, angle: 0, fixed: true }
      ],
      ropes: [],
      hinges: []
    };
    const engine = new PhysicsEngine(snapshot, { includeLevelGeometry: false });
    simulate(engine, 4);
    const motor = angular(engine, 'motor');
    const sheave = angular(engine, 'sheave');
    expect(Math.sign(sheave)).toBe(Math.sign(motor));
    expect(Math.abs(sheave)).toBeGreaterThan(2.5);
    expect(Math.abs(sheave)).toBeLessThan(12.1);
  });
});
