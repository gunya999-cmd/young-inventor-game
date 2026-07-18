import { describe, expect, it } from 'vitest';
import {
  SnapshotHistory,
  containsPoint,
  createInitialSnapshot,
  remaining,
  type MachineSnapshot,
  type PartState
} from './model';

describe('machine model', () => {
  it('starts with one locked dynamic target ball', () => {
    const snapshot = createInitialSnapshot();
    expect(snapshot.parts).toHaveLength(1);
    expect(snapshot.parts[0]).toMatchObject({ id: 'target-ball', kind: 'ball', fixed: false, locked: true });
  });

  it('does not consume inventory for locked level objects', () => {
    const snapshot = createInitialSnapshot();
    expect(remaining(snapshot, 'ball')).toBe(0);
    expect(remaining(snapshot, 'plank')).toBe(4);
  });

  it('hit-tests a rotated part in local coordinates', () => {
    const part: PartState = { id: 'p', kind: 'plank', x: 400, y: 300, angle: Math.PI / 2, fixed: true };
    expect(containsPoint(part, { x: 400, y: 390 })).toBe(true);
    expect(containsPoint(part, { x: 510, y: 300 }, 0)).toBe(false);
  });
});

describe('snapshot history', () => {
  it('restores independent immutable snapshots', () => {
    const initial = createInitialSnapshot();
    const history = new SnapshotHistory(initial);
    const changed: MachineSnapshot = {
      parts: [...initial.parts, { id: 'plank-1', kind: 'plank', x: 500, y: 400, angle: 0, fixed: true }],
      ropes: [],
      hinges: []
    };
    history.commit(changed);
    changed.parts[1].x = 999;
    const undone = history.undo();
    const redone = history.redo();
    expect(undone?.parts).toHaveLength(1);
    expect(redone?.parts[1].x).toBe(500);
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
