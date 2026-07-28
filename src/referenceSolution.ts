import { createInitialSnapshot, type MachineSnapshot } from './model';

/**
 * Geometry-control solution used to prove that the authored level has a legal physical path.
 * It uses only the three guide rails available to the player and no hidden parameters.
 */
export function createLevel07ReferenceSolution(): MachineSnapshot {
  const snapshot = createInitialSnapshot();
  snapshot.parts.push(
    // Its right end meets the bridge at nearly the same top-surface height.
    { id: 'solution-climb', kind: 'plank', x: 650, y: 410, angle: -0.22, fixed: true },
    // Only a minimal end overlap remains, avoiding both a gap and a deep collider intersection.
    { id: 'solution-bridge', kind: 'plank', x: 880, y: 390, angle: 0.05, fixed: true },
    { id: 'solution-exit', kind: 'plank', x: 1260, y: 555, angle: 0.50, fixed: true }
  );
  return snapshot;
}
