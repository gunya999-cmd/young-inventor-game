import { createInitialSnapshot, type MachineSnapshot } from './model';

/**
 * Geometry-control solution used to prove that the authored level has a legal physical path.
 * It uses only the three guide rails available to the player and no hidden parameters.
 */
export function createLevel07ReferenceSolution(): MachineSnapshot {
  const snapshot = createInitialSnapshot();
  snapshot.parts.push(
    // Moderate climb: high enough for the barrier, shallow enough to preserve contact.
    { id: 'solution-climb', kind: 'plank', x: 700, y: 410, angle: -0.22, fixed: true },
    // Nearly continuous crest that turns into a gentle downhill run across the barrier.
    { id: 'solution-bridge', kind: 'plank', x: 920, y: 382, angle: 0.05, fixed: true },
    // Final descent from the right bench into the receiver.
    { id: 'solution-exit', kind: 'plank', x: 1260, y: 555, angle: 0.50, fixed: true }
  );
  return snapshot;
}
