import { createInitialSnapshot, type MachineSnapshot } from './model';

/**
 * Geometry-control solution used to prove that the authored level has a legal physical path.
 * It uses only the three guide rails available to the player and no hidden parameters.
 */
export function createLevel07ReferenceSolution(): MachineSnapshot {
  const snapshot = createInitialSnapshot();
  snapshot.parts.push(
    { id: 'solution-climb-a', kind: 'plank', x: 700, y: 435, angle: -0.18, fixed: true },
    { id: 'solution-climb-b', kind: 'plank', x: 920, y: 395, angle: -0.18, fixed: true },
    { id: 'solution-exit', kind: 'plank', x: 1260, y: 555, angle: 0.50, fixed: true }
  );
  return snapshot;
}
