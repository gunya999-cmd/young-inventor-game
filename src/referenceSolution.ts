import { createInitialSnapshot, type MachineSnapshot } from './model';

/**
 * Geometry-control solution used to prove that the authored level has a legal physical path.
 * It uses only the three guide rails available to the player and no hidden parameters.
 */
export function createLevel07ReferenceSolution(): MachineSnapshot {
  const snapshot = createInitialSnapshot();
  snapshot.parts.push(
    // The stronger approach can now climb this single steeper segment.
    { id: 'solution-climb', kind: 'plank', x: 720, y: 405, angle: -0.32, fixed: true },
    // Immediately after the crest, this shallow descent carries the ball across the barrier.
    { id: 'solution-bridge', kind: 'plank', x: 930, y: 370, angle: 0.08, fixed: true },
    // The final guide catches the ball from the right bench and feeds the receiver.
    { id: 'solution-exit', kind: 'plank', x: 1260, y: 555, angle: 0.50, fixed: true }
  );
  return snapshot;
}
