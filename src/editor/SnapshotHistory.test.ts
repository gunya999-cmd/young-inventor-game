import { describe, expect, it } from 'vitest';
import { SnapshotHistory } from './SnapshotHistory';
import type { MachineSnapshot } from '../tim-core/types';

const state = (x: number): MachineSnapshot => ({
  parts: [{
    id: 'p',
    definition: { kind: 'ball', canRotate: false, canFlip: false, anchors: [] },
    transform: { position: { x, y: 0 }, angle: 0 },
    fixed: false,
    flipped: false,
    metadata: {}
  }],
  connections: []
});

describe('SnapshotHistory', () => {
  it('undoes and redoes committed editor states', () => {
    const history = new SnapshotHistory(state(0));
    history.commit(state(10));
    history.commit(state(20));
    expect(history.undo()?.parts[0].transform.position.x).toBe(10);
    expect(history.undo()?.parts[0].transform.position.x).toBe(0);
    expect(history.redo()?.parts[0].transform.position.x).toBe(10);
  });

  it('clears redo after a divergent edit', () => {
    const history = new SnapshotHistory(state(0));
    history.commit(state(10));
    history.undo();
    history.commit(state(7));
    expect(history.canRedo()).toBe(false);
  });

  it('ignores duplicate snapshots', () => {
    const history = new SnapshotHistory(state(0));
    expect(history.commit(state(0))).toBe(false);
    expect(history.canUndo()).toBe(false);
  });
});
