import { describe, expect, it } from 'vitest';
import {
  clampHingeAngle,
  clampPivotToLever,
  hingeLimitPreset,
  localPointToWorld,
  normalizeAngle,
  worldPointToLocal
} from './HingeMath';

describe('hinge geometry', () => {
  it('converts world and local pivot coordinates without drift', () => {
    const body = { x: 100, y: 200 };
    const world = { x: 130, y: 210 };
    const local = worldPointToLocal(world, body, Math.PI / 3);
    const restored = localPointToWorld(local, body, Math.PI / 3);
    expect(restored.x).toBeCloseTo(world.x, 8);
    expect(restored.y).toBeCloseTo(world.y, 8);
  });

  it('keeps the selected fulcrum on the lever and away from its ends', () => {
    expect(clampPivotToLever({ x: 400, y: 80 }, 270)).toEqual({ x: 113, y: 0 });
    expect(clampPivotToLever({ x: -400, y: -80 }, 270)).toEqual({ x: -113, y: 0 });
  });

  it('clamps a rotating body to its configured angular range', () => {
    const limits = hingeLimitPreset('narrow');
    const result = clampHingeAngle(Math.PI, 0, limits);
    expect(result).toBeCloseTo(Math.PI * 0.2, 8);
  });

  it('leaves a free hinge unrestricted', () => {
    expect(clampHingeAngle(2.4, 0.5, hingeLimitPreset('free'))).toBe(2.4);
  });

  it('normalizes wrapped angles consistently', () => {
    expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI, 8);
    expect(normalizeAngle(-Math.PI * 3)).toBeCloseTo(-Math.PI, 8);
  });
});
