import { describe, expect, it } from 'vitest';
import { PhysicsEngine } from './physics';
import { MAX_DEVICE_POWER, MIN_DEVICE_POWER, clampDevicePower, cloneSnapshot, devicePower, type MachineSnapshot } from './model';

function empty(parts: MachineSnapshot['parts']): MachineSnapshot {
  return { parts, ropes: [], hinges: [], signals: [] };
}

function step(engine: PhysicsEngine, frames = 180): void {
  for (let index = 0; index < frames; index += 1) engine.step(1 / 120);
}

describe('device power settings', () => {
  it('clamps invalid and extreme values to the supported range', () => {
    expect(clampDevicePower(-10)).toBe(MIN_DEVICE_POWER);
    expect(clampDevicePower(10)).toBe(MAX_DEVICE_POWER);
    expect(clampDevicePower(Number.NaN)).toBe(1);
    expect(devicePower({ id: 'm', kind: 'magnet', x: 0, y: 0, angle: 0, fixed: true, power: 1.35 })).toBe(1.35);
  });

  it('preserves bounded power through snapshot cloning', () => {
    const snapshot = cloneSnapshot(empty([
      { id: 'fan', kind: 'pulley', x: 100, y: 100, angle: 0, fixed: true, power: 4 }
    ]));
    expect(snapshot.parts[0].power).toBe(MAX_DEVICE_POWER);
  });

  it('makes a stronger conveyor accelerate a payload farther', () => {
    const weak = new PhysicsEngine(empty([
      { id: 'belt', kind: 'conveyor', x: 400, y: 400, angle: 0, fixed: true, power: 0.35 },
      { id: 'payload', kind: 'ball', x: 400, y: 335, angle: 0, fixed: false }
    ]), { includeLevelGeometry: false });
    const strong = new PhysicsEngine(empty([
      { id: 'belt', kind: 'conveyor', x: 400, y: 400, angle: 0, fixed: true, power: 1.8 },
      { id: 'payload', kind: 'ball', x: 400, y: 335, angle: 0, fixed: false }
    ]), { includeLevelGeometry: false });
    step(weak);
    step(strong);
    const weakX = weak.partTransform('payload')?.position.x ?? 0;
    const strongX = strong.partTransform('payload')?.position.x ?? 0;
    expect(strongX).toBeGreaterThan(weakX + 35);
  });

  it('makes a stronger magnet produce a larger displacement', () => {
    const make = (power: number) => new PhysicsEngine(empty([
      { id: 'magnet', kind: 'magnet', x: 500, y: 300, angle: 0, fixed: true, power },
      { id: 'ball', kind: 'ball', x: 760, y: 300, angle: 0, fixed: false }
    ]), { includeLevelGeometry: false });
    const weak = make(0.3);
    const strong = make(1.8);
    step(weak, 90);
    step(strong, 90);
    const weakX = weak.partTransform('ball')?.position.x ?? 760;
    const strongX = strong.partTransform('ball')?.position.x ?? 760;
    expect(strongX).toBeLessThan(weakX - 8);
  });
});
