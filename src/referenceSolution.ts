import { createInitialSnapshot, type MachineSnapshot } from './model';

/**
 * Geometry-control solution used to prove that the authored level has a legal physical path.
 * It uses only the three guide rails available to the player and no hidden parameters.
 */
export function createLevel07ReferenceSolution(): MachineSnapshot {
  const snapshot = createInitialSnapshot();
  snapshot.parts.push(
    // A moderate climb converts approach momentum into the height needed for the barrier.
    { id: 'solution-climb', kind: 'plank', x: 715, y: 420, angle: -0.25, fixed: true },
    // The bridge catches the ball at the crest and carries it to the right side.
    { id: 'solution-bridge', kind: 'plank', x: 930, y: 375, angle: 0.06, fixed: true },
    // The final guide picks the ball up from the right bench and feeds the receiver.
    { id: 'solution-exit', kind: 'plank', x: 1260, y: 555, angle: 0.50, fixed: true }
  );
  return snapshot;
}
