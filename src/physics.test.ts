import { describe, expect, it } from 'vitest';
import { PhysicsEngine } from './physics';
import { createInitialSnapshot, type MachineSnapshot } from './model';

describe('Planck physics core', () => {
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
      }],
      signals: []
    };
    const engine = new PhysicsEngine(snapshot);
    for (let index = 0; index < 120; index += 1) engine.step(1 / 120);
    const result = engine.partTransform('lever-1');
    expect(result).not.toBeNull();
    expect(result!.position.x).toBeGreaterThan(700);
    expect(Math.abs(result!.angle)).toBeLessThanOrEqual(1.25);
  });

  it('transfers motion between two masses through a fixed sheave', () => {
    const snapshot: MachineSnapshot = {
      parts: [
        { id: 'heavy', kind: 'weight', x: 620, y: 350, angle: 0, fixed: false },
        { id: 'light', kind: 'rubberball', x: 980, y: 350, angle: 0, fixed: false },
        { id: 'sheave-1', kind: 'sheave', x: 800, y: 170, angle: 0, fixed: true }
      ],
      ropes: [{
        id: 'pulley-rope',
        a: { partId: 'heavy', localX: 0, localY: 0 },
        b: { partId: 'light', localX: 0, localY: 0 },
        maxLength: 520,
        pulleyPartId: 'sheave-1',
        ratio: 1
      }],
      hinges: [],
      signals: []
    };
    const engine = new PhysicsEngine(snapshot);
    const heavyBefore = engine.partTransform('heavy')!;
    const lightBefore = engine.partTransform('light')!;
    for (let index = 0; index < 90; index += 1) engine.step(1 / 120);
    const heavyAfter = engine.partTransform('heavy')!;
    const lightAfter = engine.partTransform('light')!;

    expect(heavyAfter.position.y).toBeGreaterThan(heavyBefore.position.y + 5);
    expect(lightAfter.position.y).toBeLessThan(lightBefore.position.y - 5);
  });

  it('stores energy by compressing a spring and releases it through rebound', () => {
    const snapshot: MachineSnapshot = {
      parts: [
        { id: 'spring-1', kind: 'spring', x: 900, y: 650, angle: -Math.PI / 2, fixed: true },
        { id: 'falling-weight', kind: 'weight', x: 900, y: 475, angle: 0, fixed: false }
      ],
      ropes: [],
      hinges: [],
      signals: []
    };
    const engine = new PhysicsEngine(snapshot);
    const compressionSamples: number[] = [];
    const weightYSamples: number[] = [];

    for (let index = 0; index < 240; index += 1) {
      engine.step(1 / 120);
      compressionSamples.push(engine.springCompression('spring-1'));
      weightYSamples.push(engine.partTransform('falling-weight')!.position.y);
    }

    const maxCompression = Math.max(...compressionSamples);
    const maxIndex = compressionSamples.indexOf(maxCompression);
    const compressedFrames = compressionSamples.filter((value) => value > 2).length;
    const yAtMaxCompression = weightYSamples[maxIndex];
    const minYAfterRelease = Math.min(...weightYSamples.slice(Math.min(maxIndex + 3, weightYSamples.length - 1)));

    expect(maxCompression).toBeGreaterThan(8);
    expect(compressedFrames).toBeGreaterThan(3);
    expect(minYAfterRelease).toBeLessThan(yAtMaxCompression - 5);
    expect(compressionSamples.at(-1)!).toBeLessThan(maxCompression);
  });

  it('keeps a load supported while an untriggered latch remains closed', () => {
    const snapshot: MachineSnapshot = {
      parts: [
        { id: 'latch-1', kind: 'latch', x: 900, y: 520, angle: 0, fixed: true },
        { id: 'load', kind: 'weight', x: 900, y: 455, angle: 0, fixed: false }
      ],
      ropes: [],
      hinges: [],
      signals: []
    };
    const engine = new PhysicsEngine(snapshot);
    for (let index = 0; index < 180; index += 1) engine.step(1 / 120);
    expect(engine.partTransform('load')!.position.y).toBeLessThan(500);
  });

  it('releases a latch only after a physical body presses its linked button', () => {
    const snapshot: MachineSnapshot = {
      parts: [
        { id: 'button-1', kind: 'button', x: 420, y: 700, angle: 0, fixed: true },
        { id: 'trigger', kind: 'rubberball', x: 420, y: 590, angle: 0, fixed: false },
        { id: 'latch-1', kind: 'latch', x: 900, y: 520, angle: 0, fixed: true },
        { id: 'load', kind: 'weight', x: 900, y: 455, angle: 0, fixed: false }
      ],
      ropes: [],
      hinges: [],
      signals: [{
        id: 'signal-1', sourcePartId: 'button-1', targetPartId: 'latch-1', action: 'release'
      }]
    };
    const engine = new PhysicsEngine(snapshot);
    for (let index = 0; index < 240; index += 1) engine.step(1 / 120);

    expect(engine.deviceActive('button-1')).toBe(true);
    expect(engine.deviceActive('latch-1')).toBe(true);
    expect(engine.partTransform('load')!.position.y).toBeGreaterThan(600);
  });
});
