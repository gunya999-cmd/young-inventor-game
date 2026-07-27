import { describe, expect, it } from 'vitest';
import {
  PARTS,
  SnapshotHistory,
  containsPoint,
  createInitialSnapshot,
  remaining,
  type MachineSnapshot,
  type PartState
} from './model';
import { ACTIVE_LEVEL } from './level';

describe('machine model', () => {
  it('starts from the authored level 07 state with four immutable level objects', () => {
    const snapshot = createInitialSnapshot();
    expect(snapshot.parts).toHaveLength(4);
    expect(snapshot.parts.find((part) => part.id === 'target-ball')).toMatchObject({ kind: 'ball', fixed: false, locked: true });
    expect(snapshot.parts.find((part) => part.id === 'level-weight')).toMatchObject({ kind: 'weight', fixed: false, locked: true });
    expect(snapshot.parts.find((part) => part.id === 'level-button')).toMatchObject({ kind: 'button', fixed: true, locked: true });
    expect(snapshot.parts.find((part) => part.id === 'level-latch')).toMatchObject({ kind: 'latch', fixed: true, locked: true });
    expect(snapshot.signals).toEqual(ACTIVE_LEVEL.initialSignals);
  });

  it('offers only the focused mechanisms intended for this level', () => {
    const snapshot = createInitialSnapshot();
    expect(remaining(snapshot, 'ball')).toBe(0);
    expect(remaining(snapshot, 'plank')).toBe(3);
    expect(remaining(snapshot, 'lever')).toBe(1);
    expect(remaining(snapshot, 'domino')).toBe(6);
    expect(remaining(snapshot, 'spring')).toBe(1);
    expect(remaining(snapshot, 'sheave')).toBe(2);
    expect(remaining(snapshot, 'weight')).toBe(0);
    expect(remaining(snapshot, 'magnet')).toBe(0);
    expect(remaining(snapshot, 'pulley')).toBe(0);
    expect(remaining(snapshot, 'button')).toBe(0);
    expect(remaining(snapshot, 'latch')).toBe(0);
  });

  it('defines physically distinct material roles without passive energy creation', () => {
    expect(PARTS.rubberball.restitution).toBeGreaterThan(0.8);
    expect(PARTS.domino.height).toBeGreaterThan(PARTS.domino.width * 2);
    expect(PARTS.spring.defaultFixed).toBe(true);
    expect(PARTS.sheave.defaultFixed).toBe(true);
    expect(PARTS.sheave.radius).toBeGreaterThan(30);
    for (const spec of Object.values(PARTS)) expect(spec.restitution).toBeLessThanOrEqual(1);
  });

  it('hit-tests a rotated part in local coordinates', () => {
    const part: PartState = { id: 'p', kind: 'plank', x: 400, y: 300, angle: Math.PI / 2, fixed: true };
    expect(containsPoint(part, { x: 400, y: 390 })).toBe(true);
    expect(containsPoint(part, { x: 510, y: 300 }, 0)).toBe(false);
  });

  it('hit-tests circular rubber balls by radius', () => {
    const part: PartState = { id: 'r', kind: 'rubberball', x: 200, y: 200, angle: 0, fixed: false };
    expect(containsPoint(part, { x: 225, y: 200 }, 0)).toBe(true);
    expect(containsPoint(part, { x: 240, y: 200 }, 0)).toBe(false);
  });
});

describe('snapshot history', () => {
  it('restores independent immutable snapshots', () => {
    const initial = createInitialSnapshot();
    const history = new SnapshotHistory(initial);
    const addedIndex = initial.parts.length;
    const changed: MachineSnapshot = {
      ...initial,
      parts: [...initial.parts, { id: 'plank-1', kind: 'plank', x: 500, y: 400, angle: 0, fixed: true }]
    };
    history.commit(changed);
    changed.parts[addedIndex].x = 999;
    const undone = history.undo();
    const redone = history.redo();
    expect(undone?.parts).toHaveLength(initial.parts.length);
    expect(redone?.parts[addedIndex].x).toBe(500);
  });

  it('preserves the sheave route when undoing and redoing a pulley rope', () => {
    const initial = createInitialSnapshot();
    const history = new SnapshotHistory(initial);
    history.commit({
      ...initial,
      ropes: [{
        id: 'routed-rope',
        a: { partId: 'a', localX: 0, localY: 0 },
        b: { partId: 'b', localX: 0, localY: 0 },
        maxLength: 300,
        pulleyPartId: 'sheave-1',
        ratio: 1
      }]
    });
    history.undo();
    const redone = history.redo();
    expect(redone?.ropes[0]).toMatchObject({ pulleyPartId: 'sheave-1', ratio: 1 });
  });

  it('preserves an explicit button-to-latch causal link through history', () => {
    const initial = createInitialSnapshot();
    const history = new SnapshotHistory(initial);
    history.commit({
      ...initial,
      signals: [...(initial.signals ?? []), { id: 'signal-7', sourcePartId: 'button-1', targetPartId: 'latch-1', action: 'release' }]
    });
    history.undo();
    const redone = history.redo();
    expect(redone?.signals?.at(-1)).toEqual({
      id: 'signal-7', sourcePartId: 'button-1', targetPartId: 'latch-1', action: 'release'
    });
  });

  it('clears redo after a new branch of edits', () => {
    const initial = createInitialSnapshot();
    const history = new SnapshotHistory(initial);
    history.commit({ ...initial, ropes: [{ id: 'r1', a: { partId: 'a', localX: 0, localY: 0 }, b: { partId: 'b', localX: 0, localY: 0 }, maxLength: 20 }] });
    history.undo();
    history.commit({ ...initial, hinges: [{ id: 'h1', partId: 'x', localX: 0, localY: 0, referenceAngle: 0 }] });
    expect(history.canRedo).toBe(false);
  });
});
