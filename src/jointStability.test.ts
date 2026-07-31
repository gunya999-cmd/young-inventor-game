import { describe, expect, test } from 'vitest';
import { PhysicsEngine } from './physics';
import type { MachineSnapshot } from './model';

const STEP = 1 / 120;

function simulate(engine: PhysicsEngine, seconds: number): void {
  for (let index = 0; index < Math.round(seconds / STEP); index += 1) engine.step(STEP);
}

function expectFinite(engine: PhysicsEngine, ids: string[]): void {
  for (const id of ids) {
    const transform = engine.partTransform(id);
    const motion = engine.partKinematics(id);
    expect(transform).not.toBeNull();
    expect(motion).not.toBeNull();
    expect(Number.isFinite(transform!.position.x)).toBe(true);
    expect(Number.isFinite(transform!.position.y)).toBe(true);
    expect(Number.isFinite(transform!.angle)).toBe(true);
    expect(Number.isFinite(motion!.velocity.x)).toBe(true);
    expect(Number.isFinite(motion!.velocity.y)).toBe(true);
    expect(Number.isFinite(motion!.angularVelocity)).toBe(true);
  }
}

describe('joint stability', () => {
  test('an initially short rope does not create a violent startup correction', () => {
    const snapshot: MachineSnapshot = {
      parts: [
        { id: 'a', kind: 'weight', x: 500, y: 300, angle: 0, fixed: false },
        { id: 'b', kind: 'weight', x: 900, y: 300, angle: 0, fixed: false }
      ],
      ropes: [{
        id: 'rope',
        a: { partId: 'a', localX: 0, localY: 0 },
        b: { partId: 'b', localX: 0, localY: 0 },
        maxLength: 40
      }],
      hinges: []
    };
    const engine = new PhysicsEngine(snapshot, { includeLevelGeometry: false });
    simulate(engine, 3);
    expectFinite(engine, ['a', 'b']);
    const transformA = engine.partTransform('a')!;
    const transformB = engine.partTransform('b')!;
    const speedA = engine.partKinematics('a')!;
    const speedB = engine.partKinematics('b')!;
    expect(Math.abs(speedA.velocity.x)).toBeLessThan(30);
    expect(Math.abs(speedB.velocity.x)).toBeLessThan(30);
    expect(Math.abs(speedA.velocity.y - speedB.velocity.y)).toBeLessThan(5);
    expect(Math.abs((transformB.position.x - transformA.position.x) - 400)).toBeLessThan(5);
  });

  test('a loaded pulley remains finite and keeps both loads bounded', () => {
    const snapshot: MachineSnapshot = {
      parts: [
        { id: 'left', kind: 'weight', x: 620, y: 420, angle: 0, fixed: false },
        { id: 'right', kind: 'weight', x: 980, y: 520, angle: 0, fixed: false },
        { id: 'wheel', kind: 'sheave', x: 800, y: 240, angle: 0, fixed: true }
      ],
      ropes: [{
        id: 'pulley-rope',
        a: { partId: 'left', localX: 0, localY: -30 },
        b: { partId: 'right', localX: 0, localY: -30 },
        maxLength: 900,
        pulleyPartId: 'wheel',
        ratio: 1
      }],
      hinges: []
    };
    const engine = new PhysicsEngine(snapshot, { includeLevelGeometry: false });
    simulate(engine, 8);
    expectFinite(engine, ['left', 'right', 'wheel']);
    for (const id of ['left', 'right']) {
      const transform = engine.partTransform(id)!;
      const speed = engine.partKinematics(id)!;
      expect(Math.abs(transform.position.x)).toBeLessThan(5000);
      expect(Math.abs(transform.position.y)).toBeLessThan(10000);
      expect(Math.hypot(speed.velocity.x, speed.velocity.y)).toBeLessThan(2400);
    }
  });

  test('a limited hinge respects clockwise editor limits without numerical drift', () => {
    const snapshot: MachineSnapshot = {
      parts: [{ id: 'lever', kind: 'lever', x: 800, y: 350, angle: 0, fixed: false }],
      ropes: [],
      hinges: [{
        id: 'pivot',
        partId: 'lever',
        localX: 0,
        localY: 0,
        referenceAngle: 0,
        lowerAngle: -Math.PI / 6,
        upperAngle: Math.PI / 3
      }]
    };
    const engine = new PhysicsEngine(snapshot, { includeLevelGeometry: false });
    simulate(engine, 10);
    expectFinite(engine, ['lever']);
    const angle = engine.partTransform('lever')!.angle;
    expect(angle).toBeGreaterThanOrEqual(-Math.PI / 6 - 0.03);
    expect(angle).toBeLessThanOrEqual(Math.PI / 3 + 0.03);
    expect(Math.abs(engine.partKinematics('lever')!.angularVelocity)).toBeLessThan(15);
  });
});
