import { describe, expect, test } from 'vitest';
import { World } from 'planck';
import { PhysicsEngine } from './physics';
import { createStandardPartBody } from './engine/partFactory';
import { SignalRuntime } from './engine/signalSystem';
import type { MachineSnapshot, PartState } from './model';

function emptySnapshot(parts: PartState[], signals: MachineSnapshot['signals'] = []): MachineSnapshot {
  return { parts, ropes: [], hinges: [], signals };
}

describe('automation signal graph', () => {
  test('relays activation through switches and releases a downstream latch', () => {
    const world = new World();
    const parts: PartState[] = [
      { id: 'source', kind: 'switch', x: 0, y: 0, angle: 0, fixed: true },
      { id: 'relay', kind: 'switch', x: 100, y: 0, angle: 0, fixed: true },
      { id: 'magnet', kind: 'magnet', x: 200, y: 0, angle: 0, fixed: true },
      { id: 'latch', kind: 'latch', x: 300, y: 0, angle: 0, fixed: true }
    ];
    const bodies = new Map(parts.map((part) => [part.id, createStandardPartBody(world, part)]));
    const runtime = new SignalRuntime(emptySnapshot(parts, [
      { id: 'a', sourcePartId: 'source', targetPartId: 'relay', action: 'activate' },
      { id: 'b', sourcePartId: 'relay', targetPartId: 'magnet', action: 'activate' },
      { id: 'c', sourcePartId: 'relay', targetPartId: 'latch', action: 'release' }
    ]), bodies);

    runtime.activate('source');

    expect(runtime.isActive('source')).toBe(true);
    expect(runtime.isActive('relay')).toBe(true);
    expect(runtime.isActive('magnet')).toBe(true);
    expect(runtime.isActive('latch')).toBe(true);
    expect(bodies.get('latch')?.getFixtureList()?.isSensor()).toBe(true);
  });

  test('terminates cyclic switch graphs without repeated side effects', () => {
    const parts: PartState[] = [
      { id: 'a', kind: 'switch', x: 0, y: 0, angle: 0, fixed: true },
      { id: 'b', kind: 'switch', x: 100, y: 0, angle: 0, fixed: true },
      { id: 'fan', kind: 'pulley', x: 200, y: 0, angle: 0, fixed: true }
    ];
    const runtime = new SignalRuntime(emptySnapshot(parts, [
      { id: 'ab', sourcePartId: 'a', targetPartId: 'b', action: 'activate' },
      { id: 'ba', sourcePartId: 'b', targetPartId: 'a', action: 'activate' },
      { id: 'bf', sourcePartId: 'b', targetPartId: 'fan', action: 'activate' }
    ]), new Map());

    runtime.activate('a');
    expect(runtime.isActive('a')).toBe(true);
    expect(runtime.isActive('b')).toBe(true);
    expect(runtime.isActive('fan')).toBe(true);
  });
});

describe('powered automation devices', () => {
  test('a wired magnet remains off until its signal source activates', () => {
    const parts: PartState[] = [
      { id: 'ball', kind: 'ball', x: 100, y: 100, angle: 0, fixed: false },
      { id: 'magnet', kind: 'magnet', x: 300, y: 100, angle: 0, fixed: true },
      { id: 'switch', kind: 'switch', x: 500, y: 100, angle: 0, fixed: true }
    ];
    const engine = new PhysicsEngine(emptySnapshot(parts, [
      { id: 'power', sourcePartId: 'switch', targetPartId: 'magnet', action: 'activate' }
    ]), { includeLevelGeometry: false });

    for (let i = 0; i < 120; i += 1) engine.step(1 / 120);
    const ball = engine.partTransform('ball');
    expect(ball).not.toBeNull();
    expect(Math.abs((ball?.position.x ?? 0) - 100)).toBeLessThan(1);
    expect(engine.snapshot().parts.find((part) => part.id === 'magnet')).toMatchObject({ deviceActive: false });
  });

  test('an unwired magnet remains backward-compatible and attracts metal', () => {
    const parts: PartState[] = [
      { id: 'ball', kind: 'ball', x: 100, y: 100, angle: 0, fixed: false },
      { id: 'magnet', kind: 'magnet', x: 300, y: 100, angle: 0, fixed: true }
    ];
    const engine = new PhysicsEngine(emptySnapshot(parts), { includeLevelGeometry: false });

    for (let i = 0; i < 120; i += 1) engine.step(1 / 120);
    expect(engine.partTransform('ball')?.position.x ?? 0).toBeGreaterThan(105);
  });
});
