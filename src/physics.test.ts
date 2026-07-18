import { describe, expect, it } from 'vitest';
import { PhysicsEngine } from './physics';
import { createInitialSnapshot, type MachineSnapshot } from './model';

describe('Planck physics vertical slice', () => {
  it('moves the unlocked target ball under Box2D gravity', () => {
    const engine = new PhysicsEngine(createInitialSnapshot());
    const before = engine.partTransform('target-ball');
    for (let index = 0; index < 30; index += 1) engine.step(1 / 120);
    const after = engine.partTransform('target-ball');
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(after!.position.y).toBeGreaterThan(before!.position.y);
  });

  it('keeps fixed construction parts exactly static', () => {
    const snapshot = createInitialSnapshot();
    snapshot.parts.push({ id: 'fixed-plank', kind: 'plank', x: 700, y: 400, angle: 0.2, fixed: true });
    const engine = new PhysicsEngine(snapshot);
    for (let index = 0; index < 120; index += 1) engine.step(1 / 120);
    const result = engine.partTransform('fixed-plank');
    expect(result?.position.x).toBeCloseTo(700, 5);
    expect(result?.position.y).toBeCloseTo(400, 5);
    expect(result?.angle).toBeCloseTo(0.2, 5);
  });

  it('pins a lever to a freely chosen local hinge point', () => {
    const snapshot: MachineSnapshot = {
      parts: [{ id: 'lever-1', kind: 'lever', x: 800, y: 420, angle: 0, fixed: false }],
      ropes: [],
      hinges: [{
        id: 'hinge-1', partId: 'lever-1', localX: -90, localY: 0,
        referenceAngle: 0, lowerAngle: -1.2, upperAngle: 1.2
      }]
    };
    const engine = new PhysicsEngine(snapshot);
    for (let index = 0; index < 120; index += 1) engine.step(1 / 120);
    const result = engine.partTransform('lever-1');
    expect(result).not.toBeNull();
    expect(result!.position.x).toBeGreaterThan(700);
    expect(Math.abs(result!.angle)).toBeLessThanOrEqual(1.25);
  });
});
