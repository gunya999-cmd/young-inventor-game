import { createInitialSnapshot, type MachineSnapshot } from './model';

/**
 * Geometry-control solution used to prove that the authored level has a legal physical path.
 * It uses only the three guide rails available to the player and no hidden parameters.
 */
export function createLevel07ReferenceSolution(): MachineSnapshot {
  const snapshot = createInitialSnapshot();
  snapshot.parts.push(
    // The first guide converts the approach momentum into enough height to clear the barrier.
    { id: 'solution-climb', kind: 'plank', x: 715, y: 395, angle: -0.42, fixed: true },
    // A shallow bridge carries the ball across the barrier and toward the right bench.
    { id: 'solution-bridge', kind: 'plank', x: 930, y: 335, angle: 0.08, fixed: true },
    // The final guide catches the ball from the right bench and feeds the receiver.
    { id: 'solution-exit', kind: 'plank', x: 1260, y: 555, angle: 0.50, fixed: true }
  );
  return snapshot;
}
