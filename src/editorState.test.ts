import { describe, expect, it } from 'vitest';
import { SnapshotHistory, cloneSnapshot, createInitialSnapshot, type MachineSnapshot } from './model';
import { addRope, movePart, removePart, rotatePart, upsertHinge } from './editorState';

function withPlayerParts(): MachineSnapshot {
  const snapshot = createInitialSnapshot();
  snapshot.parts.push(
    { id: 'plank-1', kind: 'plank', x: 600, y: 400, angle: 0, fixed: true },
    { id: 'lever-1', kind: 'lever', x: 800, y: 600, angle: 0.1, fixed: false },
    { id: 'sheave-1', kind: 'sheave', x: 700, y: 250, angle: 0, fixed: true }
  );
  return snapshot;
}

describe('editor snapshot operations', () => {
  it('moves only editable parts and clamps them inside the world', () => {
    const initial = withPlayerParts();
    const moved = movePart(initial, 'plank-1', { x: -500, y: 2000 });
    const plank = moved.parts.find((part) => part.id === 'plank-1')!;
    expect(plank.x).toBeGreaterThan(0);
    expect(plank.y).toBeLessThan(900);
    expect(initial.parts.find((part) => part.id === 'plank-1')!.x).toBe(600);

    const lockedBefore = initial.parts.find((part) => part.locked)!;
    const lockedAfter = movePart(initial, lockedBefore.id, { x: 900, y: 700 });
    expect(lockedAfter.parts.find((part) => part.id === lockedBefore.id)).toEqual(lockedBefore);
  });

  it('rotates supported parts but leaves balls and locked level parts unchanged', () => {
    const initial = withPlayerParts();
    const rotated = rotatePart(initial, 'plank-1', Math.PI / 3);
    expect(rotated.parts.find((part) => part.id === 'plank-1')!.angle).toBeCloseTo(Math.PI / 3);

    const ball = initial.parts.find((part) => part.kind === 'ball')!;
    const unchanged = rotatePart(initial, ball.id, 2);
    expect(unchanged.parts.find((part) => part.id === ball.id)!.angle).toBe(ball.angle);
  });

  it('replaces an existing hinge instead of creating duplicate axes', () => {
    let snapshot = withPlayerParts();
    snapshot = upsertHinge(snapshot, {
      id: 'hinge-1', partId: 'lever-1', localX: -30, localY: 0,
      referenceAngle: 0.1, lowerAngle: -1, upperAngle: 1
    });
    snapshot = upsertHinge(snapshot, {
      id: 'hinge-2', partId: 'lever-1', localX: 40, localY: 0,
      referenceAngle: 0.1, lowerAngle: -1, upperAngle: 1
    });
    expect(snapshot.hinges).toHaveLength(1);
    expect(snapshot.hinges[0].id).toBe('hinge-2');
    expect(snapshot.parts.find((part) => part.id === 'lever-1')!.fixed).toBe(false);
  });

  it('validates rope endpoints and optional pulley', () => {
    let snapshot = withPlayerParts();
    snapshot = addRope(snapshot, {
      id: 'rope-1',
      a: { partId: 'plank-1', localX: 0, localY: 0 },
      b: { partId: 'lever-1', localX: 20, localY: 0 },
      pulleyPartId: 'sheave-1',
      maxLength: 500,
      ratio: 1
    });
    expect(snapshot.ropes).toHaveLength(1);

    const invalid = addRope(snapshot, {
      id: 'rope-invalid',
      a: { partId: 'missing', localX: 0, localY: 0 },
      b: { partId: 'lever-1', localX: 0, localY: 0 },
      maxLength: 100
    });
    expect(invalid.ropes).toHaveLength(1);
  });

  it('deletes a part together with hinges, direct ropes and pulley-routed ropes', () => {
    let snapshot = withPlayerParts();
    snapshot = upsertHinge(snapshot, {
      id: 'hinge-1', partId: 'lever-1', localX: 0, localY: 0,
      referenceAngle: 0.1, lowerAngle: -1, upperAngle: 1
    });
    snapshot = addRope(snapshot, {
      id: 'rope-direct',
      a: { partId: 'plank-1', localX: 0, localY: 0 },
      b: { partId: 'lever-1', localX: 0, localY: 0 },
      maxLength: 300
    });
    snapshot = addRope(snapshot, {
      id: 'rope-pulley',
      a: { partId: 'plank-1', localX: 0, localY: 0 },
      b: { partId: 'lever-1', localX: 0, localY: 0 },
      pulleyPartId: 'sheave-1', maxLength: 500, ratio: 1
    });

    const withoutLever = removePart(snapshot, 'lever-1');
    expect(withoutLever.parts.some((part) => part.id === 'lever-1')).toBe(false);
    expect(withoutLever.hinges).toHaveLength(0);
    expect(withoutLever.ropes).toHaveLength(0);

    const withoutSheave = removePart(snapshot, 'sheave-1');
    expect(withoutSheave.ropes.map((rope) => rope.id)).toEqual(['rope-direct']);
  });

  it('undoes and redoes complete connected snapshots without shared references', () => {
    const initial = withPlayerParts();
    const history = new SnapshotHistory(initial);
    const moved = movePart(initial, 'plank-1', { x: 720, y: 430 });
    history.commit(moved);
    const connected = addRope(moved, {
      id: 'rope-1',
      a: { partId: 'plank-1', localX: 10, localY: 0 },
      b: { partId: 'lever-1', localX: -10, localY: 0 },
      maxLength: 250
    });
    history.commit(connected);

    const undo = history.undo()!;
    expect(undo.ropes).toHaveLength(0);
    expect(undo.parts.find((part) => part.id === 'plank-1')!.x).toBe(720);
    undo.parts.find((part) => part.id === 'plank-1')!.x = 999;

    const redo = history.redo()!;
    expect(redo.ropes).toHaveLength(1);
    expect(redo.parts.find((part) => part.id === 'plank-1')!.x).toBe(720);
  });

  it('restores the exact pre-run construction from a deep clone', () => {
    const build = withPlayerParts();
    build.ropes.push({
      id: 'rope-1',
      a: { partId: 'plank-1', localX: 12, localY: -4 },
      b: { partId: 'lever-1', localX: -20, localY: 3 },
      maxLength: 260
    });
    const runStart = cloneSnapshot(build);
    const runtime = cloneSnapshot(runStart);
    runtime.parts.find((part) => part.id === 'plank-1')!.x += 300;
    runtime.ropes[0].a.localX = 99;

    const restored = cloneSnapshot(runStart);
    expect(restored).toEqual(build);
    expect(restored).not.toBe(runStart);
    expect(restored.ropes[0].a).not.toBe(runStart.ropes[0].a);
  });
});
