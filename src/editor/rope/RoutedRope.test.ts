import { describe, expect, it } from 'vitest';
import { buildWrappedRopePath, routedRopeLength, solveRoutedRope } from './RoutedRope';

describe('routed rope geometry', () => {
  it('measures the complete route through intermediate blocks', () => {
    expect(routedRopeLength([
      { x: 0, y: 0 },
      { x: 30, y: 40 },
      { x: 90, y: 40 }
    ])).toBeCloseTo(110, 6);
  });

  it('wraps the rendered rope around a pulley instead of cutting through it', () => {
    const path = buildWrappedRopePath([
      { x: 0, y: 0 },
      { x: 50, y: 50, radius: 20 },
      { x: 100, y: 0 }
    ]);

    expect(path.lines).toHaveLength(2);
    expect(path.arcs).toHaveLength(1);
    expect(path.arcs[0].radius).toBe(20);
    expect(path.lines[0][1]).not.toEqual({ x: 50, y: 50 });
  });
});

describe('constant-length rope solver', () => {
  it('pulls two free ends together when the rope is stretched', () => {
    const result = solveRoutedRope([
      { key: 'a', position: { x: 0, y: 0 }, inverseMass: 1 },
      { key: 'b', position: { x: 120, y: 0 }, inverseMass: 1 }
    ], 100, 1);

    expect(result.stretch).toBeCloseTo(20, 6);
    expect(result.corrections.get('a')?.x).toBeCloseTo(10, 6);
    expect(result.corrections.get('b')?.x).toBeCloseTo(-10, 6);
  });

  it('keeps a fixed redirect block still while moving the free ends', () => {
    const result = solveRoutedRope([
      { key: 'left', position: { x: 0, y: 0 }, inverseMass: 1 },
      { key: 'fixed-pulley', position: { x: 50, y: 50 }, inverseMass: 0 },
      { key: 'right', position: { x: 100, y: 0 }, inverseMass: 1 }
    ], 120, 1);

    expect(result.corrections.has('fixed-pulley')).toBe(false);
    expect(result.corrections.get('left')?.y).toBeGreaterThan(0);
    expect(result.corrections.get('right')?.y).toBeGreaterThan(0);
  });

  it('lifts a movable pulley from the combined tension of both rope legs', () => {
    const result = solveRoutedRope([
      { key: 'left-anchor', position: { x: 0, y: 0 }, inverseMass: 0 },
      { key: 'moving-pulley', position: { x: 50, y: 50 }, inverseMass: 1 },
      { key: 'right-anchor', position: { x: 100, y: 0 }, inverseMass: 0 }
    ], 120, 1);

    expect(result.corrections.get('moving-pulley')?.x).toBeCloseTo(0, 6);
    expect(result.corrections.get('moving-pulley')?.y).toBeLessThan(0);
  });

  it('does nothing while the routed rope still has slack', () => {
    const result = solveRoutedRope([
      { key: 'a', position: { x: 0, y: 0 }, inverseMass: 1 },
      { key: 'b', position: { x: 80, y: 0 }, inverseMass: 1 }
    ], 100);

    expect(result.corrections.size).toBe(0);
    expect(result.stretch).toBe(0);
  });
});
