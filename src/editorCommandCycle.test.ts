import { describe, expect, it } from 'vitest';
import { SnapshotHistory, createInitialSnapshot, type MachineSnapshot } from './model';
import {
  addRope,
  clearPlayerParts,
  decodeSnapshot,
  duplicatePart,
  encodeSnapshot,
  movePart,
  togglePartFixed,
  upsertHinge
} from './editorState';

function buildFixture(): MachineSnapshot {
  const snapshot = createInitialSnapshot();
  snapshot.parts.push(
    { id: 'plank-1', kind: 'plank', x: 520, y: 420, angle: 0.1, fixed: true },
    { id: 'lever-1', kind: 'lever', x: 790, y: 520, angle: -0.15, fixed: false },
    { id: 'sheave-1', kind: 'sheave', x: 690, y: 260, angle: 0, fixed: true }
  );
  return snapshot;
}

describe('complete editor command cycle', () => {
  it('duplicates, edits, connects, saves, clears, restores and traverses history', () => {
    const initial = buildFixture();
    const history = new SnapshotHistory(initial);

    let snapshot = duplicatePart(initial, 'plank-1', 'plank-2');
    expect(snapshot.parts.some((part) => part.id === 'plank-2')).toBe(true);
    expect(snapshot.hinges).toHaveLength(0);
    expect(snapshot.ropes).toHaveLength(0);
    history.commit(snapshot);

    snapshot = movePart(snapshot, 'plank-2', { x: 980, y: 360 });
    snapshot = togglePartFixed(snapshot, 'plank-2');
    expect(snapshot.parts.find((part) => part.id === 'plank-2')!.fixed).toBe(false);
    history.commit(snapshot);

    snapshot = upsertHinge(snapshot, {
      id: 'hinge-1', partId: 'lever-1', localX: 30, localY: 0,
      referenceAngle: -0.15, lowerAngle: -1, upperAngle: 1
    });
    snapshot = addRope(snapshot, {
      id: 'rope-1',
      a: { partId: 'plank-2', localX: 40, localY: 0 },
      b: { partId: 'lever-1', localX: -60, localY: 0 },
      pulleyPartId: 'sheave-1',
      ratio: 1,
      maxLength: 620
    });
    history.commit(snapshot);

    const saved = encodeSnapshot(snapshot);
    const cleared = clearPlayerParts(snapshot);
    expect(cleared.parts.every((part) => part.locked)).toBe(true);
    expect(cleared.ropes).toHaveLength(0);
    expect(cleared.hinges).toHaveLength(0);

    const restored = decodeSnapshot(saved)!;
    expect(restored.parts.find((part) => part.id === 'plank-2')).toMatchObject({ x: 980, y: 360, fixed: false });
    expect(restored.hinges).toHaveLength(1);
    expect(restored.ropes).toHaveLength(1);
    expect(restored.ropes[0].pulleyPartId).toBe('sheave-1');

    const undoConnections = history.undo()!;
    expect(undoConnections.ropes).toHaveLength(0);
    expect(undoConnections.hinges).toHaveLength(0);
    expect(undoConnections.parts.find((part) => part.id === 'plank-2')!.fixed).toBe(false);

    const undoEdit = history.undo()!;
    expect(undoEdit.parts.find((part) => part.id === 'plank-2')).toMatchObject({ x: 550, y: 450, fixed: true });

    const redoEdit = history.redo()!;
    const redoConnections = history.redo()!;
    expect(redoEdit.parts.find((part) => part.id === 'plank-2')).toMatchObject({ x: 980, y: 360, fixed: false });
    expect(redoConnections.ropes).toHaveLength(1);
    expect(redoConnections.hinges).toHaveLength(1);
  });

  it('rejects malformed saves and rebuilds locked level objects from the current level', () => {
    expect(decodeSnapshot('{broken')).toBeNull();
    expect(decodeSnapshot(JSON.stringify({ parts: [], ropes: [] }))).toBeNull();

    const source = buildFixture();
    const encoded = JSON.parse(encodeSnapshot(source));
    encoded.parts[0].x = 9999;
    encoded.parts.push({
      id: 'evil-locked', kind: 'weight', x: 10, y: 10, angle: 0,
      fixed: false, locked: true
    });
    encoded.ropes.push({
      id: 'dangling',
      a: { partId: 'missing', localX: 0, localY: 0 },
      b: { partId: 'plank-1', localX: 0, localY: 0 },
      maxLength: 100
    });

    const loaded = decodeSnapshot(JSON.stringify(encoded))!;
    expect(loaded.parts.some((part) => part.id === 'evil-locked')).toBe(false);
    expect(loaded.ropes.some((rope) => rope.id === 'dangling')).toBe(false);
    expect(loaded.parts.filter((part) => part.locked)).toEqual(createInitialSnapshot().parts);
  });

  it('does not toggle sheaves or hinged parts and does not exceed inventory while duplicating', () => {
    let snapshot = buildFixture();
    const unchangedSheave = togglePartFixed(snapshot, 'sheave-1');
    expect(unchangedSheave.parts.find((part) => part.id === 'sheave-1')!.fixed).toBe(true);

    snapshot = upsertHinge(snapshot, {
      id: 'hinge-1', partId: 'lever-1', localX: 0, localY: 0,
      referenceAngle: -0.15, lowerAngle: -1, upperAngle: 1
    });
    const hingedBefore = snapshot.parts.find((part) => part.id === 'lever-1')!.fixed;
    const hingedAfter = togglePartFixed(snapshot, 'lever-1');
    expect(hingedAfter.parts.find((part) => part.id === 'lever-1')!.fixed).toBe(hingedBefore);

    snapshot = duplicatePart(snapshot, 'plank-1', 'plank-2');
    snapshot = duplicatePart(snapshot, 'plank-1', 'plank-3');
    const beyondInventory = duplicatePart(snapshot, 'plank-1', 'plank-4');
    expect(beyondInventory.parts.filter((part) => !part.locked && part.kind === 'plank')).toHaveLength(3);
  });
});
