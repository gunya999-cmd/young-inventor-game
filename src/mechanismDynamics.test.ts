import { describe, expect, test } from 'vitest';
import type { Body } from 'planck';
import { PhysicsEngine } from './physics';
import type { MachineSnapshot } from './model';

const STEP = 1 / 120;

function bodyById(engine: PhysicsEngine, id: string): Body {
  for (let body = engine.world.getBodyList(); body; body = body.getNext()) {
    const data = body.getUserData() as { partId?: string } | undefined;
    if (data?.partId === id) return body;
  }
  throw new Error(`Missing body ${id}`);
}

function simulate(engine: PhysicsEngine, seconds: number): void {
  for (let frame = 0; frame < Math.round(seconds / STEP); frame += 1) engine.step(STEP);
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

describe('lever, pendulum and counterweight dynamics', () => {
  test('a centre-pinned lever responds smoothly and loses injected spin', () => {
    const snapshot: MachineSnapshot = {
      parts: [{ id: 'lever', kind: 'lever', x: 800, y: 420, angle: 0, fixed: false }],
      ropes: [],
      hinges: [{ id: 'pivot', partId: 'lever', localX: 0, localY: 0, referenceAngle: 0 }]
    };
    const engine = new PhysicsEngine(snapshot, { includeLevelGeometry: false });
    bodyById(engine, 'lever').setAngularVelocity(4);
    simulate(engine, 12);
    expectFinite(engine, ['lever']);
    expect(Math.abs(engine.partKinematics('lever')!.angularVelocity)).toBeLessThan(2.1);
    expect(Math.abs(engine.partTransform('lever')!.angle)).toBeLessThan(40);
  });

  test('an end-pinned lever behaves as a damped pendulum without numerical acceleration', () => {
    const snapshot: MachineSnapshot = {
      parts: [{ id: 'pendulum', kind: 'lever', x: 800, y: 350, angle: 0.65, fixed: false }],
      ropes: [],
      hinges: [{ id: 'pivot', partId: 'pendulum', localX: -135, localY: 0, referenceAngle: 0 }]
    };
    const engine = new PhysicsEngine(snapshot, { includeLevelGeometry: false });
    let peakAngularSpeed = 0;
    for (let frame = 0; frame < Math.round(18 / STEP); frame += 1) {
      engine.step(STEP);
      peakAngularSpeed = Math.max(peakAngularSpeed, Math.abs(engine.partKinematics('pendulum')!.angularVelocity));
    }
    expectFinite(engine, ['pendulum']);
    expect(peakAngularSpeed).toBeLessThan(8);
    expect(Math.abs(engine.partKinematics('pendulum')!.angularVelocity)).toBeLessThan(1.4);
    expect(Math.abs(engine.partTransform('pendulum')!.angle)).toBeLessThan(1.8);
  });

  test('a hanging counterweight moves a pinned lever while the system remains bounded', () => {
    const snapshot: MachineSnapshot = {
      parts: [
        { id: 'lever', kind: 'lever', x: 760, y: 330, angle: 0, fixed: false },
        { id: 'weight', kind: 'weight', x: 980, y: 510, angle: 0, fixed: false }
      ],
      ropes: [{
        id: 'counterweight-rope',
        a: { partId: 'lever', localX: 140, localY: 0 },
        b: { partId: 'weight', localX: 0, localY: -30 },
        maxLength: 220
      }],
      hinges: [{ id: 'pivot', partId: 'lever', localX: 0, localY: 0, referenceAngle: 0 }]
    };
    const engine = new PhysicsEngine(snapshot, { includeLevelGeometry: false });
    simulate(engine, 8);
    expectFinite(engine, ['lever', 'weight']);
    expect(Math.abs(engine.partTransform('lever')!.angle)).toBeGreaterThan(0.08);
    expect(Math.abs(engine.partTransform('lever')!.angle)).toBeLessThan(1.7);
    expect(Math.hypot(
      engine.partKinematics('weight')!.velocity.x,
      engine.partKinematics('weight')!.velocity.y
    )).toBeLessThan(1800);
  });
});
