import { describe, expect, it } from 'vitest';
import { PhysicsEngine } from './physics';
import { PHYSICS_CONFIG } from './engine/physicsConfig';
import type { MachineSnapshot, PartState } from './model';

const STEP = 1 / 120;

function snapshot(parts: PartState[], extra: Partial<MachineSnapshot> = {}): MachineSnapshot {
  return {
    parts,
    ropes: extra.ropes ?? [],
    hinges: extra.hinges ?? [],
    signals: extra.signals ?? []
  };
}

function run(engine: PhysicsEngine, frames: number): void {
  for (let index = 0; index < frames; index += 1) engine.step(STEP);
}

describe('quantitative physics calibration bench', () => {
  it('matches gravitational free fall over 0.5 seconds within a small numerical tolerance', () => {
    const engine = new PhysicsEngine(snapshot([
      { id: 'ball', kind: 'ball', x: 800, y: 100, angle: 0, fixed: false }
    ]), { includeLevelGeometry: false });
    const before = engine.partTransform('ball')!.position.y;
    run(engine, 60);
    const displacementPx = engine.partTransform('ball')!.position.y - before;
    const idealPx = 0.5 * PHYSICS_CONFIG.gravity * 0.5 * 0.5 * 100;
    expect(displacementPx).toBeGreaterThan(idealPx - 8);
    expect(displacementPx).toBeLessThan(idealPx + 8);
  });

  it('keeps a steel ball impact strongly inelastic instead of creating energy', () => {
    const engine = new PhysicsEngine(snapshot([
      { id: 'floor', kind: 'plank', x: 800, y: 520, angle: 0, fixed: true },
      { id: 'ball', kind: 'ball', x: 800, y: 330, angle: 0, fixed: false }
    ]), { includeLevelGeometry: false });
    const samples: number[] = [];
    for (let index = 0; index < 240; index += 1) {
      engine.step(STEP);
      samples.push(engine.partTransform('ball')!.position.y);
    }
    const impactIndex = samples.indexOf(Math.max(...samples));
    const bottom = samples[impactIndex];
    const reboundTop = Math.min(...samples.slice(Math.min(impactIndex + 2, samples.length - 1)));
    const reboundHeight = bottom - reboundTop;
    expect(reboundHeight).toBeGreaterThan(1);
    expect(reboundHeight).toBeLessThan(45);
  });

  it('preserves the deliberately elastic behavior of the rubber ball', () => {
    const engine = new PhysicsEngine(snapshot([
      { id: 'floor', kind: 'plank', x: 800, y: 520, angle: 0, fixed: true },
      { id: 'ball', kind: 'rubberball', x: 800, y: 330, angle: 0, fixed: false }
    ]), { includeLevelGeometry: false });
    const samples: number[] = [];
    for (let index = 0; index < 240; index += 1) {
      engine.step(STEP);
      samples.push(engine.partTransform('ball')!.position.y);
    }
    const impactIndex = samples.indexOf(Math.max(...samples));
    const bottom = samples[impactIndex];
    const reboundTop = Math.min(...samples.slice(Math.min(impactIndex + 2, samples.length - 1)));
    expect(bottom - reboundTop).toBeGreaterThan(70);
  });

  it('rolls a steel ball down an inclined guide instead of sliding like a crate', () => {
    const engine = new PhysicsEngine(snapshot([
      { id: 'ramp', kind: 'plank', x: 650, y: 510, angle: 0.16, fixed: true },
      { id: 'ball', kind: 'ball', x: 585, y: 440, angle: 0, fixed: false }
    ]), { includeLevelGeometry: false });
    const startX = engine.partTransform('ball')!.position.x;
    run(engine, 150);
    const end = engine.partTransform('ball')!;
    const motion = engine.partKinematics('ball')!;
    expect(end.position.x).toBeGreaterThan(startX + 35);
    expect(Math.abs(end.angle)).toBeGreaterThan(0.4);
    expect(Math.abs(motion.angularVelocity)).toBeGreaterThan(0.2);
  });

  it('keeps a 1:1 fixed pulley displacement constraint without visible rope stretch', () => {
    const engine = new PhysicsEngine(snapshot([
      { id: 'heavy', kind: 'weight', x: 620, y: 360, angle: 0, fixed: false },
      { id: 'light', kind: 'rubberball', x: 980, y: 360, angle: 0, fixed: false },
      { id: 'sheave', kind: 'sheave', x: 800, y: 180, angle: 0, fixed: true }
    ], {
      ropes: [{
        id: 'rope',
        a: { partId: 'heavy', localX: 0, localY: 0 },
        b: { partId: 'light', localX: 0, localY: 0 },
        maxLength: 520,
        pulleyPartId: 'sheave',
        ratio: 1
      }]
    }), { includeLevelGeometry: false });
    const heavyStart = engine.partTransform('heavy')!.position.y;
    const lightStart = engine.partTransform('light')!.position.y;
    run(engine, 90);
    const heavyDelta = engine.partTransform('heavy')!.position.y - heavyStart;
    const lightDelta = engine.partTransform('light')!.position.y - lightStart;
    expect(heavyDelta).toBeGreaterThan(8);
    expect(lightDelta).toBeLessThan(-8);
    expect(Math.abs(heavyDelta + lightDelta)).toBeLessThan(2.5);
  });

  it('produces torque from an off-center load while a centered load stays nearly balanced', () => {
    const makeLever = (weightX: number): PhysicsEngine => new PhysicsEngine(snapshot([
      { id: 'lever', kind: 'lever', x: 800, y: 520, angle: 0, fixed: false },
      { id: 'weight', kind: 'weight', x: weightX, y: 455, angle: 0, fixed: false }
    ], {
      hinges: [{ id: 'hinge', partId: 'lever', localX: 0, localY: 0, referenceAngle: 0, lowerAngle: -1.2, upperAngle: 1.2 }]
    }), { includeLevelGeometry: false });

    const centered = makeLever(800);
    const offCenter = makeLever(690);
    run(centered, 90);
    run(offCenter, 90);
    expect(Math.abs(centered.partTransform('lever')!.angle)).toBeLessThan(0.08);
    expect(Math.abs(offCenter.partTransform('lever')!.angle)).toBeGreaterThan(0.18);
  });

  it('keeps spring compression bounded and rebound speed finite', () => {
    const engine = new PhysicsEngine(snapshot([
      { id: 'spring', kind: 'spring', x: 900, y: 650, angle: -Math.PI / 2, fixed: true },
      { id: 'weight', kind: 'weight', x: 900, y: 470, angle: 0, fixed: false }
    ]), { includeLevelGeometry: false });
    let maxCompression = 0;
    let maxUpwardSpeed = 0;
    for (let index = 0; index < 300; index += 1) {
      engine.step(STEP);
      maxCompression = Math.max(maxCompression, engine.springCompression('spring'));
      maxUpwardSpeed = Math.max(maxUpwardSpeed, -engine.partKinematics('weight')!.velocity.y);
    }
    expect(maxCompression).toBeGreaterThan(6);
    expect(maxCompression).toBeLessThanOrEqual(PHYSICS_CONFIG.spring.travelPx + 1);
    expect(maxUpwardSpeed).toBeGreaterThan(80);
    expect(maxUpwardSpeed).toBeLessThan(900);
  });

  it('lets a slightly tilted domino topple while an upright one remains stable on the same support', () => {
    const makeDomino = (angle: number): PhysicsEngine => new PhysicsEngine(snapshot([
      { id: 'floor', kind: 'plank', x: 800, y: 700, angle: 0, fixed: true },
      { id: 'domino', kind: 'domino', x: 800, y: 635, angle, fixed: false }
    ]), { includeLevelGeometry: false });

    const upright = makeDomino(0);
    const tilted = makeDomino(0.18);
    run(upright, 180);
    run(tilted, 180);
    expect(Math.abs(upright.partTransform('domino')!.angle)).toBeLessThan(0.08);
    expect(Math.abs(tilted.partTransform('domino')!.angle)).toBeGreaterThan(0.7);
  });
});
