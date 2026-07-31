import { describe, expect, test } from 'vitest';
import { World } from 'planck';
import { createStandardPartBody } from './engine/partFactory';
import type { PartKind, PartState } from './model';

function material(kind: PartKind): { friction: number; restitution: number } {
  const world = new World();
  const part: PartState = { id: kind, kind, x: 200, y: 200, angle: 0, fixed: false };
  const fixture = createStandardPartBody(world, part).getFixtureList();
  if (!fixture) throw new Error(`No fixture for ${kind}`);
  return { friction: fixture.getFriction(), restitution: fixture.getRestitution() };
}

describe('contact material tuning', () => {
  test('steel ball rolls freely while retaining a controlled impact response', () => {
    const steel = material('ball');
    expect(steel.friction).toBeCloseTo(0.12, 5);
    expect(steel.restitution).toBeCloseTo(0.34, 5);
  });

  test('rubber ball is clearly more elastic without becoming lossless', () => {
    const steel = material('ball');
    const rubber = material('rubberball');
    expect(rubber.restitution).toBeGreaterThan(steel.restitution * 2);
    expect(rubber.restitution).toBeLessThan(0.9);
    expect(rubber.friction).toBeLessThan(0.25);
  });

  test('dominoes grip the surface and transfer impacts by tipping', () => {
    const domino = material('domino');
    expect(domino.friction).toBeGreaterThanOrEqual(0.75);
    expect(domino.restitution).toBeLessThan(0.03);
  });

  test('guides permit motion without becoming frictionless', () => {
    for (const kind of ['plank', 'lever'] as const) {
      const guide = material(kind);
      expect(guide.friction).toBeGreaterThan(0.5);
      expect(guide.friction).toBeLessThanOrEqual(0.68);
    }
  });
});
