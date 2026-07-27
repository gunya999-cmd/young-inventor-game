import { createInitialSnapshot, type MachineSnapshot } from './model';

/**
 * Geometry-control solution used to prove that the authored level has a legal physical path.
 * It uses only the three guide rails available to the player and no hidden parameters.
 */
export function createLevel07ReferenceSolution(): MachineSnapshot {
  const snapshot = createInitialSnapshot();
  snapshot.parts.push(
    // Climb from the left bench to a height that clears the barrier.
    { id: 'solution-climb', kind: 'plank', x: 720, y: 410, angle: -0.55, fixed: true },
    // Carry the ball safely across the top of the barrier.
    { id: 'solution-bridge', kind: 'plank', x: 900, y: 330, angle: 0.08, fixed: true },
    // Final descent from the right bench into the receiver.
    { id: 'solution-exit', kind: 'plank', x: 1260, y: 555, angle: 0.48, fixed: true }
  );
  return snapshot;
}
