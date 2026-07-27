import { createInitialSnapshot, type MachineSnapshot } from './model';

/**
 * Geometry-control solution used to prove that the authored level has a legal physical path.
 * It uses only the three guide rails available to the player and no hidden parameters.
 */
export function createLevel07ReferenceSolution(): MachineSnapshot {
  const snapshot = createInitialSnapshot();
  snapshot.parts.push(
    // First gentle climb from the left bench.
    { id: 'solution-climb-a', kind: 'plank', x: 680, y: 440, angle: -0.30, fixed: true },
    // Second gentle climb clears the barrier without requiring a scripted launch.
    { id: 'solution-climb-b', kind: 'plank', x: 900, y: 355, angle: -0.30, fixed: true },
    // Final descent picks the ball up from the right bench and delivers it into the receiver.
    { id: 'solution-exit', kind: 'plank', x: 1270, y: 560, angle: 0.45, fixed: true }
  );
  return snapshot;
}
